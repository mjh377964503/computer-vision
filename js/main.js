import { initCamera } from './camera.js';
import { updateGesture, resetGesture } from './gesture.js';
import { initParticles, updateParticles } from './particles.js';
import { updatePIP, setLoading } from './ui.js';

let rafId = null;
let handLandmarkerInstance = null;

async function main() {
  cleanup(); // Dispose previous resources if re-initializing

  setLoading(true);

  // 1. Start camera
  const video = await initCamera();

  // 2. Init Three.js particles
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) throw new Error('Canvas element #particle-canvas not found');
  initParticles(canvas);

  // 3. Init MediaPipe HandLandmarker (dynamic CDN import)
  const { HandLandmarker, FilesetResolver } = await import(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18'
  );

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
  );

  handLandmarkerInstance = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 1,
  });

  setLoading(false);

  // 4. Main loop
  function loop() {
    rafId = requestAnimationFrame(loop);

    if (video.readyState < 2) return;

    const nowMs = performance.now();
    const results = handLandmarkerInstance.detectForVideo(video, nowMs);

    if (results.landmarks && results.landmarks.length > 0) {
      const gestureInfo = updateGesture(results.landmarks[0]);
      updateParticles(gestureInfo);
    } else {
      resetGesture();
    }
  }

  rafId = requestAnimationFrame(loop);
}

function cleanup() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (handLandmarkerInstance !== null) {
    handLandmarkerInstance.close();
    handLandmarkerInstance = null;
  }
}

window.addEventListener('beforeunload', cleanup);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    resetGesture();
  }
});

main().catch(console.error);
