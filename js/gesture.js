// Rule-based gesture classifier from MediaPipe 21 hand landmarks
// Landmarks: 0=wrist, 4/8/12/16/20=fingertips, 5/9/13/17=knuckles

const FINGER_EXTEND_RATIO = 1.3;
const DEBOUNCE_FRAMES = 6;
const MOVE_THRESHOLD = 0.03; // normalized coord threshold for hand movement

let gestureBuffer = [];
let currentGesture = 'drag';
let prevWrist = null;

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function isFingerExtended(landmarks, tipIdx, knuckleIdx) {
  const wrist = landmarks[0];
  const tipDist = distance(landmarks[tipIdx], wrist);
  const knuckleDist = distance(landmarks[knuckleIdx], wrist);
  return tipDist > FINGER_EXTEND_RATIO * knuckleDist;
}

function classify(landmarks) {
  const fingers = [
    { tip: 4, knuckle: 5 },   // thumb
    { tip: 8, knuckle: 9 },   // index
    { tip: 12, knuckle: 13 }, // middle
    { tip: 16, knuckle: 17 }, // ring
    { tip: 20, knuckle: 18 }, // pinky (knuckle approximated)
  ];

  const extended = fingers.map(f => isFingerExtended(landmarks, f.tip, f.knuckle));
  const extendedCount = extended.filter(Boolean).length;
  const wrist = landmarks[0];
  const thumbTip = landmarks[4];

  // Thumbs up: only thumb extended AND pointing upward
  if (extended[0] && extendedCount === 1 && thumbTip.y < wrist.y - 0.02) {
    return 'thumbsUp';
  }

  // Peace sign: index(1) + middle(2) extended, rest not
  if (extended[1] && extended[2] && extendedCount === 2) {
    return 'peace';
  }

  // Open palm: all 5 extended
  if (extendedCount === 5) {
    return 'orbit';
  }

  // Fist: none extended
  if (extendedCount === 0) {
    return 'collapse';
  }

  // Detect hand movement for drag mode
  if (prevWrist) {
    const delta = distance(wrist, prevWrist);
    if (delta > MOVE_THRESHOLD) {
      return 'drag';
    }
  }

  return currentGesture !== 'none' ? currentGesture : 'drag';
}

export function updateGesture(landmarks) {
  const raw = classify(landmarks);
  prevWrist = landmarks[0];

  gestureBuffer.push(raw);
  if (gestureBuffer.length > DEBOUNCE_FRAMES) {
    gestureBuffer.shift();
  }

  // Only switch if all recent frames agree
  if (gestureBuffer.length === DEBOUNCE_FRAMES
      && gestureBuffer.every(g => g === raw)
      && raw !== currentGesture) {
    currentGesture = raw;
  }

  return {
    gesture: currentGesture,
    handPosition: landmarks[0],
    indexTip: landmarks[8],
    middleTip: landmarks[12],
  };
}

export function getCurrentGesture() {
  return currentGesture;
}

export function resetGesture() {
  gestureBuffer = [];
  currentGesture = 'drag';
  prevWrist = null;
}
