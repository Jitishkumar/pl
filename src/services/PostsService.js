import { supabase } from '../config/supabase';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';

export class PostsService {
  // Create a new post
  static async createPost(uri = null, caption = '', type = 'text') {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Allow empty caption if media is provided, and vice versa
      if (!uri && !caption.trim()) {
        throw new Error('Please add some text or media to your post');
      }
      
      // Determine post type based on URI presence
      const finalType = uri ? type : 'text';
      
      let postData = {
        user_id: user.id,
        caption: caption.trim() || '',  // Allow empty caption
        type: finalType
      };
      
      // Handle media upload if URI is provided
      if (uri) {
        try {
          // Let cloudinary.js handle file size validation
          console.log(`Uploading ${finalType} to Cloudinary...`);
          
          const cloudinaryResponse = await uploadToCloudinary(uri, finalType);
          if (!cloudinaryResponse || !cloudinaryResponse.url) {
            throw new Error('Failed to upload media. Please check your internet connection and try again.');
          }
          
          console.log('Upload successful, saving post data...');
          postData = {
            ...postData,
            media_url: cloudinaryResponse.url,
            cloudinary_public_id: cloudinaryResponse.publicId
          };
        } catch (uploadError) {
          console.error('Error uploading to Cloudinary:', uploadError);
          if (uploadError.publicId) {
            await deleteFromCloudinary(uploadError.publicId, finalType).catch(console.error);
          }
          // Provide more specific error messages based on the error type
          if (uploadError.message.includes('timed out')) {
            throw new Error('Upload timed out. Please check your internet connection and try again.');
          } else if (uploadError.message.includes('size too large')) {
            throw new Error(uploadError.message);
          } else {
            throw new Error('Failed to upload media. ' + uploadError.message);
          }
        }
      }
      
      // Save post to Supabase
      console.log('Saving post to database...');
      const { data, error } = await supabase
        .from('posts')
        .insert(postData)
        .select(`
          *,
          profiles:user_id (id, username, avatar_url)
        `)
        .single();
      
      if (error) {
        console.error('Supabase error:', error);
        // Clean up Cloudinary upload if Supabase insert fails
        if (postData.cloudinary_public_id) {
          await deleteFromCloudinary(postData.cloudinary_public_id, postData.type).catch(console.error);
        }
        throw new Error(error.message || 'Failed to create post. Please try again.');
      }
      
      console.log('Post created successfully!');
      return data;
      
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }
  
  // Get all posts with likes and comments count
  static async getAllPosts() {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get the list of users the current user follows
      const { data: followingList } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = followingList?.map(f => f.following_id) || [];

      // Get posts from followed users and own posts
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (id, username, avatar_url),
          likes:post_likes (count),
          comments:post_comments (count),
          user_likes:post_likes (user_id)
        `)
        .or(
          `user_id.eq.${user.id},` + // User's own posts
          (followingIds.length > 0 ? `user_id.in.(${followingIds.join(',')})` : 'id.is.null') // Posts from followed users
        )
        .order('created_at', { ascending: false });

      // Add is_liked field to each post
      const postsWithLikeStatus = data?.map(post => ({
        ...post,
        is_liked: post.user_likes?.some(like => like.user_id === user.id) || false
      })) || [];
      
      if (error) throw error;
      return postsWithLikeStatus;
      
    } catch (error) {
      console.error('Error fetching posts:', error);
      throw error;
    }
  }
  
  // Get posts for a specific user
  static async getUserPosts(userId) {
    try {
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // Check if the profile has a private account
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('private_account')
        .eq('user_id', userId)
        .single();
      
      // If the account is private and the current user is not the profile owner
      if (settingsData?.private_account && currentUser?.id !== userId) {
        // Check if current user follows this profile
        const { data: followData } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', currentUser?.id)
          .eq('following_id', userId)
          .single();
          
        // If not following, return empty array
        if (!followData) {
          return [];
        }
      }
      
      // Fetch posts if allowed
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          likes:post_likes (count),
          comments:post_comments (count)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
      
    } catch (error) {
      console.error('Error fetching user posts:', error);
      throw error;
    }
  }
  
  // Delete a post
  static async deletePost(postId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get post details first
      const { data: post, error: fetchError } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .eq('user_id', user.id)
        .single();

      if (fetchError) throw fetchError;
      if (!post) throw new Error('Post not found or you do not have permission to delete it');

      // Delete the post
      const { error: deleteError } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // If post had media, delete from Cloudinary
      if (post.cloudinary_public_id) {
        await deleteFromCloudinary(post.cloudinary_public_id, post.type).catch(console.error);
      }

      return true;
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  }

  // Edit post caption
  static async editPost(postId, newCaption) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Update the post
      const { data, error } = await supabase
        .from('posts')
        .update({ caption: newCaption.trim() })
        .eq('id', postId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error editing post:', error);
      throw error;
    }
  }

  // Like/Unlike a post
  static async toggleLike(postId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Check if user already liked the post
      const { data: existingLike } = await supabase
        .from('post_likes')
        .select()
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .single();
      
      if (existingLike) {
        // Unlike
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
          
        if (error) throw error;
        
        // Get updated like count
        const { data: updatedLikes } = await supabase
          .from('post_likes')
          .select('count')
          .eq('post_id', postId);
          
        return {
          isLiked: false,
          likesCount: updatedLikes?.[0]?.count || 0
        };
      } else {
        // Like
        const { error } = await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: user.id
          });
          
        if (error) throw error;
        
        // Get updated like count
        const { data: updatedLikes } = await supabase
          .from('post_likes')
          .select('count')
          .eq('post_id', postId);
          
        return {
          isLiked: true,
          likesCount: updatedLikes?.[0]?.count || 0
        };
      }
      
    } catch (error) {
      console.error('Error toggling like:', error);
      throw error;
    }
  }
  
  // Add a comment
  static async addComment(postId, content) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content
        })
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .single();
      
      if (error) throw error;
      return data;
      
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }
  
  // Get comments for a post
  static async getComments(postId) {
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
      
    } catch (error) {
      console.error('Error fetching comments:', error);
      throw error;
    }
  }
  
  // Delete a post
  static async deletePost(postId) {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // First get the post to verify ownership and get Cloudinary public_id
      const { data: post, error: fetchError } = await supabase
        .from('posts')
        .select('cloudinary_public_id, type, user_id')
        .eq('id', postId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Verify post ownership
      if (post.user_id !== user.id) {
        throw new Error('You can only delete your own posts');
      }
      
      // Delete from Cloudinary only if it's a media post
      if (post.cloudinary_public_id && post.type !== 'text') {
        try {
          await deleteFromCloudinary(post.cloudinary_public_id, post.type);
        } catch (cloudinaryError) {
          console.error('Error deleting from Cloudinary:', cloudinaryError);
          // Continue with post deletion even if Cloudinary deletion fails
        }
      }
      
      // Delete from Supabase (this will cascade delete likes and comments)
      const { error: deleteError } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);
      
      if (deleteError) throw deleteError;
      
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  }
}