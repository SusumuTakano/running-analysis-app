/**
 * Video Processing Utilities
 * Reusable functions for video frame extraction and MediaPipe pose estimation
 */

/**
 * Extract frames from a video file
 */
export async function extractFramesFromVideo(
  videoFile: File,
  targetFps: number = 120,
  onProgress?: (progress: number, status: string) => void
): Promise<{
  frames: ImageData[];
  videoWidth: number;
  videoHeight: number;
  actualFps: number;
  duration: number;
}> {
  console.log(`🎬 Extracting frames from video: ${videoFile.name}`);
  console.log(`🎬 Target FPS: ${targetFps}`);
  
  return new Promise((resolve, reject) => {
    // Create video and canvas elements
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }
    
    video.preload = 'metadata';
    video.src = URL.createObjectURL(videoFile);
    
    const frames: ImageData[] = [];
    let extractionStarted = false;
    
    video.addEventListener('loadedmetadata', async () => {
      if (extractionStarted) return;
      extractionStarted = true;
      
      try {
        // Get video dimensions
        let actualWidth = video.videoWidth;
        let actualHeight = video.videoHeight;
        let retries = 0;
        
        // Wait for video dimensions (some browsers need this)
        while ((actualWidth === 0 || actualHeight === 0) && retries < 10) {
          console.log(`⏳ Waiting for video dimensions... retry ${retries + 1}`);
          await new Promise(r => setTimeout(r, 100));
          actualWidth = video.videoWidth;
          actualHeight = video.videoHeight;
          retries++;
        }
        
        if (actualWidth === 0 || actualHeight === 0) {
          reject(new Error('Could not get video dimensions'));
          return;
        }
        
        console.log(`📹 Video dimensions: ${actualWidth} × ${actualHeight}`);
        
        // Correct misreported dimensions (e.g., iPhone videos)
        let correctedWidth = actualWidth;
        let correctedHeight = actualHeight;
        
        if (actualWidth === 3840 && actualHeight === 2160) {
          const fileSizeMB = videoFile.size / (1024 * 1024);
          if (fileSizeMB < 250) {
            console.log(`⚠️ File size ${fileSizeMB.toFixed(0)}MB indicates HD, not 4K`);
            correctedWidth = 1920;
            correctedHeight = 1080;
          }
        }
        
        const duration = video.duration;
        console.log(`📹 Video duration: ${duration.toFixed(2)}s`);
        
        onProgress?.(0, `Extracting frames... duration ${duration.toFixed(2)}s, target fps ${targetFps}`);
        
        // Target dimensions for processing
        const maxDimension = Math.max(correctedWidth, correctedHeight);
        const scale = maxDimension > 1920 ? 1920 / maxDimension : 1;
        const targetWidth = Math.round(correctedWidth * scale);
        const targetHeight = Math.round(correctedHeight * scale);
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        console.log(`🎨 Canvas size: ${targetWidth} × ${targetHeight} (scale: ${scale.toFixed(3)})`);
        
        // Calculate frame interval
        const frameInterval = 1 / targetFps;
        const totalFrames = Math.floor(duration * targetFps);
        
        console.log(`🎬 Extracting ${totalFrames} frames (interval: ${frameInterval.toFixed(4)}s)`);
        
        // Extract frames
        for (let i = 0; i < totalFrames; i++) {
          const currentTime = i * frameInterval;
          
          // Seek to frame
          video.currentTime = Math.min(currentTime, duration);
          await new Promise<void>((resolveSeek) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              resolveSeek();
            };
            video.addEventListener('seeked', onSeeked);
          });
          
          // Draw frame to canvas
          ctx.clearRect(0, 0, targetWidth, targetHeight);
          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
          
          // Extract ImageData
          const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
          frames.push(imageData);
          
          // Report progress
          const progress = Math.floor((i / totalFrames) * 100);
          onProgress?.(
            Math.min(progress, 99),
            `Extracting frames... ${i + 1}/${totalFrames}`
          );
        }
        
        console.log(`✅ Extracted ${frames.length} frames`);
        
        // Cleanup
        URL.revokeObjectURL(video.src);
        
        onProgress?.(100, `✅ Extraction complete (${frames.length} frames)`);
        
        resolve({
          frames,
          videoWidth: correctedWidth,
          videoHeight: correctedHeight,
          actualFps: targetFps,
          duration,
        });
      } catch (error) {
        console.error('❌ Frame extraction error:', error);
        reject(error);
      }
    });
    
    video.addEventListener('error', () => {
      reject(new Error('Failed to load video'));
    });
  });
}

/**
 * Run MediaPipe Pose estimation on frames
 */
export async function runPoseEstimationOnFrames(
  frames: ImageData[],
  onProgress?: (progress: number, status: string) => void
): Promise<Array<any | null>> {
  console.log(`🏃 Running pose estimation on ${frames.length} frames`);
  
  // This will be implemented using the existing MediaPipe integration
  // For now, return a placeholder
  const poseResults: Array<any | null> = [];
  
  for (let i = 0; i < frames.length; i++) {
    // TODO: Integrate with existing MediaPipe pose estimation
    // For now, push null as placeholder
    poseResults.push(null);
    
    const progress = Math.floor((i / frames.length) * 100);
    onProgress?.(progress, `Pose estimation: ${i + 1}/${frames.length}`);
  }
  
  onProgress?.(100, `✅ Pose estimation complete`);
  
  return poseResults;
}
