import React, { createContext, useState, useContext, useRef } from 'react';

const VideoContext = createContext();

export const VideoProvider = ({ children }) => {
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
  const previousActiveVideo = useRef(null);

  // Set the currently playing video
  const setActiveVideo = (videoId) => {
    // Store the previous active video before changing
    previousActiveVideo.current = activeVideoId;
    setActiveVideoId(videoId);
  };

  // Clear the currently playing video
  const clearActiveVideo = () => {
    previousActiveVideo.current = activeVideoId;
    setActiveVideoId(null);
  };

  // Toggle fullscreen mode
  const setFullscreen = (isFullscreen) => {
    setIsFullscreenMode(isFullscreen);
  };

  // Restore previous active video
  const restorePreviousVideo = () => {
    if (previousActiveVideo.current) {
      setActiveVideoId(previousActiveVideo.current);
      return previousActiveVideo.current;
    }
    return null;
  };

  return (
    <VideoContext.Provider 
      value={{
        activeVideoId,
        isFullscreenMode,
        setActiveVideo,
        clearActiveVideo,
        setFullscreen,
        restorePreviousVideo
      }}
    >
      {children}
    </VideoContext.Provider>
  );
};

// Custom hook to use the video context
export const useVideo = () => useContext(VideoContext);