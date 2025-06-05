import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } from '@env';
import CryptoJS from 'crypto-js';

// Cloudinary configuration object
export const cloudinaryConfig = {
  cloudName: CLOUDINARY_CLOUD_NAME,
  apiKey: CLOUDINARY_API_KEY,
  apiSecret: CLOUDINARY_API_SECRET,
  secure: true
};

// Function to generate signature for upload
export const generateSignature = (params) => {
  const timestamp = Math.round((new Date).getTime() / 1000);
  
  // Create the string to sign
  const toSign = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  // Generate the signature using crypto-js (you'll need to install this package)
  const signature = CryptoJS.SHA1(toSign + CLOUDINARY_API_SECRET).toString();
  
  return {
    signature,
    timestamp
  };
};

// Function to upload media to Cloudinary
export const uploadToCloudinary = async (uri, type = 'image') => {
  try {
    // Handle empty URI case for text-only posts
    if (!uri || uri === '') {
      return {
        url: '',
        publicId: '',
        resourceType: 'text'
      };
    }

    // Validate file size before attempting upload
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileSizeInMB = blob.size / (1024 * 1024);
      const maxSizeMB = type === 'video' ? 50 : 5; // Reduced max size for better reliability
      
      if (fileSizeInMB > maxSizeMB) {
        throw new Error(`File size too large. Please select a ${type} under ${maxSizeMB}MB for reliable uploads.`);
      }
      
      console.log(`File size: ${fileSizeInMB.toFixed(2)}MB`);
    } catch (sizeError) {
      if (sizeError.message.includes('File size too large')) {
        throw sizeError;
      }
      // If we can't check size, continue with upload attempt
      console.warn('Could not check file size:', sizeError);
    }

    const formData = new FormData();
    
    // Prepare the file
    const filename = uri.split('/').pop();
    const match = /\.([\w\d]+)$/.exec(filename);
    const ext = match?.[1] || 'jpg'; // Default to jpg if extension can't be determined
    
    formData.append('file', {
      uri,
      name: `${Date.now()}.${ext}`,
      type: `${type}/${ext}`
    });
    
    // Add upload preset (create this in your Cloudinary dashboard)
    formData.append('upload_preset', 'connect_app_preset');
    
    // Set timeout for fetch request with adaptive timeout based on file size
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout (reduced from 5 minutes)
    
    // Upload to Cloudinary with enhanced retry logic
    let retries = 3; // Reduced retries but with better backoff strategy
    let response;
    let lastError;
    
    while (retries > 0) {
      try {
        // Add network status check before attempting upload
        const networkCheck = await fetch('https://api.cloudinary.com/v1_1', { 
          method: 'HEAD',
          timeout: 5000,
          cache: 'no-cache'
        }).catch(() => ({ ok: false }));
          
        if (!networkCheck.ok) {
          console.warn('Network connection appears unstable');
          // Don't throw here, just try the upload anyway
        }
        
        console.log(`Attempt ${4-retries}: Uploading to Cloudinary...`);
        
        response = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${type}/upload`,
          {
            method: 'POST',
            body: formData,
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'multipart/form-data'
            },
            signal: controller.signal
          }
        );

        // Check if response is ok before breaking
        if (response.ok) {
          console.log('Upload successful!');
          break; // If successful, exit the retry loop
        } else {
          const errorText = await response.text();
          console.error(`HTTP error! status: ${response.status}, response: ${errorText}`);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (fetchError) {
        lastError = fetchError;
        retries--;
        
        // Check if it's an abort error
        if (fetchError.name === 'AbortError') {
          console.error('Upload timed out');
          throw new Error('Upload timed out. Please try with a smaller file or check your connection. For videos, keep them under 50MB and for images under 5MB.');
        }
        
        if (retries === 0) {
          console.error('All upload attempts failed');
          throw new Error(`Upload failed after multiple attempts. Please check your internet connection and try again later.`);
        }
        
        console.log(`Upload attempt failed. Retrying... (${retries} attempts left)`);
        
        // Exponential backoff with jitter - more aggressive for fewer retries
        const backoffDelay = Math.min(2000 * Math.pow(2, 3 - retries) + Math.random() * 2000, 15000);
        console.log(`Waiting ${(backoffDelay/1000).toFixed(1)} seconds before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
    
    clearTimeout(timeoutId);
    
    const data = await response.json();
    
    if (data.error) {
      console.error('Cloudinary API error:', data.error);
      throw new Error(data.error.message);
    }
    
    return {
      url: data.secure_url,
      publicId: data.public_id,
      resourceType: data.resource_type
    };
    
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
};

// Function to delete media from Cloudinary
export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    const timestamp = Math.round((new Date).getTime() / 1000);
    const signature = generateSignature({
      public_id: publicId,
      timestamp
    }).signature;
    
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/destroy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          public_id: publicId,
          signature,
          api_key: CLOUDINARY_API_KEY,
          timestamp
        })
      }
    );
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    return data;
    
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};