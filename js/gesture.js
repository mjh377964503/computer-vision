// Rule-based gesture classifier from MediaPipe 21 hand landmarks
// Landmarks: 0=wrist, 4/8/12/16/20=fingertips, 2/5/9/13/17=MCP joints

const FINGER_EXTEND_RATIO = 1.3;
const DEBOUNCE_FRAMES = 6;
const MOVE_THRESHOLD = 0.03;

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
    { tip: 4, knuckle: 2 },   // thumb (THUMB_MCP)
    { tip: 8, knuckle: 5 },   // index (INDEX_MCP)
    { tip: 12, knuckle: 9 },  // middle (MIDDLE_MCP)
    { tip: 16, knuckle: 13 }, // ring (RING_MCP)
    { tip: 20, knuckle: 17 }, // pinky (PINKY_MCP)
  ];

  const extended = fingers.map(f => isFingerExtended(landmarks, f.tip, f.knuckle));
  const extendedCount = extended.filter(Boolean).length;
  const wrist = landmarks[0];

  // Open palm: all 5 extended
  if (extendedCount === 5) {
    return 'orbit';
  }

  // Fist: none extended
  if (extendedCount === 0) {
    return 'collapse';
  }

  // Index + pinky = helix (check before peace, both have 2 extended)
  if (extended[1] && extended[4] && extendedCount === 2) {
    return 'helix';
  }

  // Index + middle = dual stream
  if (extended[1] && extended[2] && extendedCount === 2) {
    return 'peace';
  }

  // Index only = vortex (pointing)
  if (extended[1] && extendedCount === 1) {
    return 'vortex';
  }

  // Middle + ring + pinky = ripple (3 fingers)
  if (extended[2] && extended[3] && extended[4] && extendedCount === 3) {
    return 'ripple';
  }

  // Detect hand movement for drag mode
  if (prevWrist) {
    const delta = distance(wrist, prevWrist);
    if (delta > MOVE_THRESHOLD) {
      return 'drag';
    }
  }

  return currentGesture;
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
