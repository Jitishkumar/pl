import { supabase } from '../config/supabase';

// Your OneSignal REST API key from the OneSignal Dashboard
const ONE_SIGNAL_REST_API_KEY = 'os_v2_app_xvar67mys5abzhqor6lzw572sndsnutu7kxu2leczhmln2kkpuvfcteu2nzcc7gckpog63mx2ttjuhqjcegi45h257futr2qyxinsqq';
const ONE_SIGNAL_APP_ID = 'bd411f7d-9897-401c-9e0e-8f979b77fa93';

/**
 * Send a notification to a specific user
 * @param {string} recipientId - Supabase user ID of the recipient
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {object} data - Additional data for the notification
 */
export const sendNotification = async (recipientId, title, message, data = {}) => {
  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONE_SIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONE_SIGNAL_APP_ID,
        include_external_user_ids: [recipientId],
        headings: { en: title },
        contents: { en: message },
        data: data
      })
    });
    
    return response.json();
  } catch (error) {
    console.error('Error sending notification:', error);
    return null;
  }
};

/**
 * Send a like notification
 */
export const sendLikeNotification = async (postId, likedByUserId, postOwnerId) => {
  try {
    // Skip if user is liking their own post
    if (likedByUserId === postOwnerId) return;
    
    // Get user info of the person who liked
    const { data: userData } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', likedByUserId)
      .single();
    
    // Get post info
    const { data: postData } = await supabase
      .from('posts')
      .select('title')
      .eq('id', postId)
      .single();
    
    if (!userData || !postData) return;
    
    return sendNotification(
      postOwnerId,
      'New Like',
      `${userData.username} liked your post: ${postData.title.substring(0, 30)}${postData.title.length > 30 ? '...' : ''}`,
      {
        type: 'like',
        postId: postId,
        userId: likedByUserId,
        senderName: userData.username,
        senderAvatar: userData.avatar_url
      }
    );
  } catch (error) {
    console.error('Error sending like notification:', error);
  }
};

/**
 * Send a comment notification
 */
export const sendCommentNotification = async (postId, commentId, commentByUserId, postOwnerId) => {
  try {
    // Skip if user is commenting on their own post
    if (commentByUserId === postOwnerId) return;
    
    // Get user info of the commenter
    const { data: userData } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', commentByUserId)
      .single();
    
    // Get post info
    const { data: postData } = await supabase
      .from('posts')
      .select('title')
      .eq('id', postId)
      .single();
    
    // Get comment text
    const { data: commentData } = await supabase
      .from('comments')
      .select('content')
      .eq('id', commentId)
      .single();
    
    if (!userData || !postData || !commentData) return;
    
    return sendNotification(
      postOwnerId,
      'New Comment',
      `${userData.username} commented on your post: "${commentData.content.substring(0, 30)}${commentData.content.length > 30 ? '...' : ''}"`,
      {
        type: 'comment',
        postId: postId,
        commentId: commentId,
        userId: commentByUserId,
        senderName: userData.username,
        senderAvatar: userData.avatar_url
      }
    );
  } catch (error) {
    console.error('Error sending comment notification:', error);
  }
};

/**
 * Send a confession notification
 */
export const sendConfessionNotification = async (confessionId, confessionByUserId, recipientId) => {
  try {
    // Get user info if not anonymous
    let userData = null;
    if (confessionByUserId) {
      const { data } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', confessionByUserId)
        .single();
      userData = data;
    }
    
    // Get confession info
    const { data: confessionData } = await supabase
      .from('confessions')
      .select('content')
      .eq('id', confessionId)
      .single();
    
    if (!confessionData) return;
    
    const senderName = userData ? userData.username : 'Anonymous';
    const senderAvatar = userData ? userData.avatar_url : 'https://via.placeholder.com/40';
    
    return sendNotification(
      recipientId,
      'New Confession',
      `${senderName} sent you a confession: "${confessionData.content.substring(0, 30)}${confessionData.content.length > 30 ? '...' : ''}"`,
      {
        type: 'confession',
        confessionId: confessionId,
        userId: confessionByUserId,
        senderName: senderName,
        senderAvatar: senderAvatar
      }
    );
  } catch (error) {
    console.error('Error sending confession notification:', error);
  }
};