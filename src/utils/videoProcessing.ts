/**
 * Video Processing Utilities
 * Reusable functions for video frame extraction and MediaPipe pose estimation
 */

export interface FramePoseData {
  landmarks: Array<{ x: number; y: number; z: number; visibility?: number }>;
  worldLandmarks?: Array<{ x: number; y: number; z: number; visibility?: number }>;
}

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
): Promise<Array<FramePoseData | null>> {
  console.log(`🏃 Running pose estimation on ${frames.length} frames`);
  
  onProgress?.(0, '姿勢推定を準備中...');
  
  // Check if MediaPipe is loaded
  const Pose: any = (window as any).Pose;
  if (!Pose) {
    throw new Error('MediaPipe Pose not loaded. Please reload the page.');
  }
  
  // Create Pose instance
  const pose = new Pose({
    locateFile: (file: string) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`;
    },
  });
  
  // Device detection
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isIPad = /iPad/i.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  // Configure based on device
  const modelComplexity = isIPad ? 1 : (isMobile ? 1 : 2);
  const minDetectionConfidence = 0.05;
  const minTrackingConfidence = 0.05;
  
  pose.setOptions({
    modelComplexity,
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: false,
    minDetectionConfidence,
    minTrackingConfidence,
    selfieMode: false,
    staticImageMode: false,
  });
  
  console.log(`🔧 Pose config: modelComplexity=${modelComplexity}, mobile=${isMobile}, iPad=${isIPad}`);
  
  // Wait for initialization on iPad
  if (isIPad) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const results: Array<FramePoseData | null> = [];
  const totalFrames = frames.length;
  
  // Create canvases for processing
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = frames[0].width;
  tempCanvas.height = frames[0].height;
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
  
  if (!tempCtx) {
    throw new Error('Failed to create canvas context');
  }
  
  // Downscale for MediaPipe
  const maxPoseWidth = isIPad ? 540 : 960;
  const poseScale = Math.min(1, maxPoseWidth / tempCanvas.width);
  const poseCanvas = document.createElement('canvas');
  poseCanvas.width = Math.round(tempCanvas.width * poseScale);
  poseCanvas.height = Math.round(tempCanvas.height * poseScale);
  const poseCtx = poseCanvas.getContext('2d', { willReadFrequently: true });
  
  if (!poseCtx) {
    throw new Error('Failed to create pose canvas context');
  }
  
  // Process frames
  for (let i = 0; i < totalFrames; i++) {
    const frame = frames[i];
    
    // Draw frame to canvas
    tempCtx.putImageData(frame, 0, 0);
    poseCtx.clearRect(0, 0, poseCanvas.width, poseCanvas.height);
    poseCtx.drawImage(tempCanvas, 0, 0, poseCanvas.width, poseCanvas.height);
    
    // Run pose estimation
    try {
      const result = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.warn(`⚠️ Frame ${i} timeout`);
          resolve(null);
        }, isIPad ? 10000 : 5000);
        
        pose.onResults((r: any) => {
          clearTimeout(timeout);
          resolve(r);
        });
        
        pose.send({ image: poseCanvas }).catch((e: any) => {
          console.error(`❌ Frame ${i} error:`, e);
          reject(e);
        });
      });
      
      if (result && result.poseLandmarks) {
        results.push({
          landmarks: result.poseLandmarks,
          worldLandmarks: result.worldLandmarks,
        });
      } else {
        results.push(null);
      }
    } catch (error) {
      console.error(`❌ Frame ${i} error:`, error);
      results.push(null);
    }
    
    // Report progress
    const progress = Math.floor(((i + 1) / totalFrames) * 100);
    onProgress?.(
      Math.min(progress, 99),
      `姿勢推定中... ${i + 1}/${totalFrames}`
    );
  }
  
  onProgress?.(100, `✅ 姿勢推定完了 (${results.filter(r => r !== null).length}/${totalFrames} フレーム成功)`);
  
  console.log(`✅ Pose estimation complete: ${results.filter(r => r !== null).length}/${totalFrames} successful`);
  
  return results;
}
