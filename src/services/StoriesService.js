import { supabase } from '../config/supabase';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';
// UUID generator compatible with Supabase UUID type
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export class StoriesService {
  // Get all active stories grouped by user
  static async getActiveStories() {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Get current timestamp
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      // First get the list of users you follow
      const { data: followingList } = await supabase
        .from('follows')  // Changed from 'follows' to 'followers'
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = followingList?.map(f => f.following_id) || [];

      // Get all stories with proper visibility rules
      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          user:user_id (id, username, avatar_url)
        `)
        .gte('created_at', twentyFourHoursAgo)
        .or(
          `user_id.eq.${user.id},` + // User's own stories
          (followingIds.length > 0 ? `user_id.in.(${followingIds.join(',')})` : 'id.is.null') // Stories from followed users
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get viewed stories for the current user
      const { data: viewedStories, error: viewedError } = await supabase
        .from('story_views')
        .select('story_id')
        .eq('user_id', user.id);
      
      if (viewedError) throw viewedError;
      
      // Create a set of viewed story IDs for faster lookup
      const viewedStoryIds = new Set(viewedStories?.map(view => view.story_id) || []);
      
      // Add viewed status to each story
      const storiesWithViewedStatus = data.map(story => ({
        ...story,
        is_viewed: viewedStoryIds.has(story.id)
      }));
      
      // Group stories by user
      const groupedStories = storiesWithViewedStatus.reduce((groups, story) => {
        const userId = story.user_id;
        const existingGroup = groups.find(group => group.user_id === userId);
        
        if (existingGroup) {
          existingGroup.stories.push(story);
        } else {
          groups.push({
            user_id: userId,
            user: story.user,
            stories: [story],
            has_unviewed: !story.is_viewed
          });
        }
        
        // Update has_unviewed flag if any story is unviewed
        if (existingGroup && !story.is_viewed) {
          existingGroup.has_unviewed = true;
        }
        
        return groups;
      }, []);
      
      return groupedStories;
      
    } catch (error) {
      console.error('Error fetching active stories:', error);
      throw error;
    }
  }

  // Helper function to process stories data
  static async processStoriesData(data, userId) {
    // Get viewed stories for the current user
    const { data: viewedStories } = await supabase
      .from('story_views')
      .select('story_id')
      .eq('user_id', userId);
    
    // Create a set of viewed story IDs for faster lookup
    const viewedStoryIds = new Set(viewedStories?.map(view => view.story_id) || []);
    
    // Add viewed status to each story
    const storiesWithViewedStatus = data.map(story => ({
      ...story,
      is_viewed: viewedStoryIds.has(story.id)
    }));
    
    // Group stories by user
    return storiesWithViewedStatus.reduce((groups, story) => {
      const userId = story.user_id;
      const existingGroup = groups.find(group => group.user_id === userId);
      
      if (existingGroup) {
        existingGroup.stories.push(story);
        if (!story.is_viewed) existingGroup.has_unviewed = true;
      } else {
        groups.push({
          user_id: userId,
          user: story.user,
          stories: [story],
          has_unviewed: !story.is_viewed
        });
      }
      
      return groups;
    }, []);
  }
  
  // Upload a new story
  static async uploadStory(uri, type = 'image') {
    try {
      // Validate file size before upload
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileSizeInMB = blob.size / (1024 * 1024);
      const maxSizeMB = type === 'video' ? 70 : 5; // 20MB for videos, 5MB for images
      
      if (fileSizeInMB > maxSizeMB) {
        throw new Error(`File size too large. Please select a ${type} under ${maxSizeMB}MB.`);
      }
      
      // First upload media to Cloudinary
      const cloudinaryResponse = await uploadToCloudinary(uri, type);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Check if user has any stories in the last 24 hours
      const now = new Date();
      const { data: existingStories, error: fetchError } = await supabase
        .from('stories')
        .select('id, story_group_id')
        .eq('user_id', user.id)
        .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });
      
      if (fetchError) throw fetchError;
      
      let storyGroupId;
      let isFirstStory = true;
      
      if (existingStories && existingStories.length > 0) {
        storyGroupId = existingStories[0].story_group_id;
        isFirstStory = false;
      } else {
        storyGroupId = generateUUID();
      }
      
      // Save story to Supabase (removed followersOnly parameter)
      const { data, error } = await supabase
        .from('stories')
        .insert({
          user_id: user.id,
          media_url: cloudinaryResponse.url,
          cloudinary_public_id: cloudinaryResponse.publicId,
          type: type,
          story_group_id: storyGroupId,
          is_first_story: isFirstStory
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
      
    } catch (error) {
      console.error('Error uploading story:', error);
      throw error;
    }
  }
  
  // Delete a story
  static async deleteStory(storyId) {
    try {
      // First get the story to get Cloudinary public_id
      const { data: story, error: fetchError } = await supabase
        .from('stories')
        .select('cloudinary_public_id, type')
        .eq('id', storyId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Delete from Cloudinary
      await deleteFromCloudinary(story.cloudinary_public_id, story.type);
      
      // Delete from Supabase
      const { error: deleteError } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId);
      
      if (deleteError) throw deleteError;
      
      return true;
    } catch (error) {
      console.error('Error deleting story:', error);
      throw error;
    }
  }
  
  // Get stories for a specific user
  static async getUserStories(userId) {
    try {
      // Validate userId
      if (!userId || typeof userId !== 'string' || userId === '0') {
        console.error('Invalid userId provided:', userId);
        return [];
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get current timestamp
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      
      // If viewing own stories
      if (user.id === userId) {
        const { data, error } = await supabase
          .from('stories')
          .select(`
            *,
            user:user_id (id, username, avatar_url)
          `)
          .eq('user_id', userId)
          .gte('created_at', twentyFourHoursAgo)
          .order('created_at', { ascending: true });
        
        if (error) {
          console.error('Error fetching own stories:', error);
          return [];
        }
        return data || [];
      }

      // If viewing someone else's stories, check if following
      const { data: followData, error: followError } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .maybeSingle();

      if (followError) {
        console.error('Error checking follow status:', followError);
        return [];
      }

      // If not following, return empty array
      if (!followData) return [];

      // Get stories if following
      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          user:user_id (id, username, avatar_url)
        `)
        .eq('user_id', userId)
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching followed user stories:', error);
        return [];
      }
      return data || [];
      
    } catch (error) {
      console.error('Error fetching user stories:', error);
      throw error;
    }
  }
  
  // Mark a story as viewed by the current user
  static async markStoryAsViewed(storyId) {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // First check if the story exists and if the user has permission to view it
      const { data: story, error: storyError } = await supabase
        .from('stories')
        .select('id, user_id')
        .eq('id', storyId)
        .single();
      
      if (storyError) {
        console.error('Error fetching story:', storyError);
        return false;
      }
      
      // Check if the user is the owner of the story or follows the story owner
      if (story.user_id !== user.id) {
        const { data: followData, error: followError } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', story.user_id)
          .maybeSingle();
        
        if (followError || !followData) {
          console.error('User does not have permission to view this story');
          return false;
        }
      }
      
      // Insert a record into story_views table
      const { error } = await supabase
        .from('story_views')
        .upsert({
          story_id: storyId,
          user_id: user.id
        }, { onConflict: 'story_id,user_id' });
      
      if (error) {
        console.error('Error marking story as viewed:', error);
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.error('Error marking story as viewed:', error);
      return false;
    }
  }
  
  // Check if a story has been viewed by the current user
  static async hasViewedStory(storyId) {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Check if a record exists in story_views table
      const { data, error } = await supabase
        .from('story_views')
        .select('id')
        .eq('story_id', storyId)
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is the error code for no rows returned
      
      return !!data;
      
    } catch (error) {
      console.error('Error checking if story is viewed:', error);
      return false;
    }
  }
  
  // Check if any story in a story group has been viewed
  static async hasViewedStoryGroup(storyGroupId) {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Use the custom function we created in SQL
      const { data, error } = await supabase
        .rpc('has_viewed_story_group', { group_id: storyGroupId });
      
      if (error) throw error;
      
      return data;
      
    } catch (error) {
      console.error('Error checking if story group is viewed:', error);
      return false;
    }
  }
  
  // Get the current user ID
  static async getCurrentUserId() {
    try {
      const { data } = await supabase.auth.getUser();
      return data?.user?.id || null;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return null;
    }
  }
}