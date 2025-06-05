import { supabase } from '../config/supabase';

export const api = {
  // Auth
  signUp: async (email, password) => {
    return await supabase.auth.signUp({ email, password });
  },

  // Profile
  updateProfile: async (userId, data) => {
    return await supabase
      .from('profiles')
      .update(data)
      .match({ id: userId });
  },

  // Posts
  createPost: async (userId, content, mediaUrls) => {
    return await supabase
      .from('posts')
      .insert([{ user_id: userId, content, media_urls: mediaUrls }]);
  },

  // Stories
  createStory: async (userId, mediaUrl, type) => {
    return await supabase
      .from('stories')
      .insert([{ user_id: userId, media_url: mediaUrl, type }]);
  },

  // Search
  searchUsers: async (query) => {
    return await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${query}%`);
  },
};