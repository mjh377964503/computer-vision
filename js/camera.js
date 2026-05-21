// Camera capture module — requests webcam, returns video stream
let videoElement = null;

export async function initCamera() {
  videoElement = document.getElementById('pip-video');

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: 'user' }
  });

  videoElement.srcObject = stream;
  await videoElement.play();

  return videoElement;
}

export function getVideoElement() {
  return videoElement;
}
