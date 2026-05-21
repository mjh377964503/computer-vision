import { initCamera } from './camera.js';

async function main() {
  const video = await initCamera();
  console.log('Camera ready:', video.videoWidth, 'x', video.videoHeight);
}

main();
