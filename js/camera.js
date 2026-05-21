// Camera capture module — requests webcam, returns video stream
let videoElement = null;

export async function initCamera() {
  videoElement = document.getElementById('pip-video');
  if (!videoElement) {
    throw new Error('Camera module: #pip-video element not found in DOM');
  }

  // Stop previous stream tracks if re-entering
  if (videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach(t => t.stop());
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' }
    });

    videoElement.srcObject = stream;
    await videoElement.play();

    return videoElement;
  } catch (err) {
    videoElement = null;
    throw new Error(`Camera access denied or unavailable: ${err.message}`);
  }
}

export function getVideoElement() {
  if (!videoElement) {
    console.warn('getVideoElement() called before initCamera() completes — returning null');
  }
  return videoElement;
}
