import React, { createContext, useState, useContext } from 'react';

const VideoContext = createContext();

export const VideoProvider = ({ children }) => {
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);

  // Set the currently playing video
  const setActiveVideo = (videoId) => {
    setActiveVideoId(videoId);
  };

  // Clear the currently playing video
  const clearActiveVideo = () => {
    setActiveVideoId(null);
  };

  // Toggle fullscreen mode
  const setFullscreen = (isFullscreen) => {
    setIsFullscreenMode(isFullscreen);
  };

  return (
    <VideoContext.Provider 
      value={{
        activeVideoId,
        isFullscreenMode,
        setActiveVideo,
        clearActiveVideo,
        setFullscreen
      }}
    >
      {children}
    </VideoContext.Provider>
  );
};

// Custom hook to use the video context
export const useVideo = () => useContext(VideoContext);