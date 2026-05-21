import { initCamera } from './camera.js';
import { updateGesture, resetGesture } from './gesture.js';
import { initParticles, updateParticles } from './particles.js';
import { updatePIP } from './ui.js';

const { HandLandmarker, FilesetResolver } = window;

async function main() {
  // 1. Start camera
  const video = await initCamera();

  // 2. Init Three.js particles
  const canvas = document.getElementById('particle-canvas');
  initParticles(canvas);

  // 3. Init MediaPipe HandLandmarker
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
  );

  const handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 1,
  });

  // 4. Main loop
  function loop() {
    requestAnimationFrame(loop);

    if (video.readyState < 2) return;

    const nowMs = performance.now();
    const results = handLandmarker.detectForVideo(video, nowMs);

    if (results.landmarks && results.landmarks.length > 0) {
      const gestureInfo = updateGesture(results.landmarks[0]);
      updateParticles(gestureInfo);
    } else {
      resetGesture();
    }

    updatePIP(video);
  }

  requestAnimationFrame(loop);
}

main().catch(console.error);
