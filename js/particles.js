import * as THREE from 'three';

const PARTICLE_COUNT = 3000;
const TRANSITION_DURATION = 0.4; // seconds

let scene, camera, renderer, points, geometry, material;
let positions, colors, velocities;
let previousColors;
let onResize;
let clock = new THREE.Clock();

// Each particle's metadata for state behaviors
let particleData = [];

// Current state + transition tracking
let currentState = 'drag';
let prevState = 'drag';
let stateTime = 0;
let transitionProgress = 1; // 1 = fully in current state

// Hand position trail for drag wake effect
let handTrail = [];
let prevHandPos = null;
const TRAIL_LENGTH = 40;

export function initParticles(canvas) {
  // Scene
  scene = new THREE.Scene();

  // PerspectiveCamera for depth
  camera = new THREE.PerspectiveCamera(
    60, window.innerWidth / window.innerHeight, 10, 1000
  );
  camera.position.z = 300;

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Particle geometry
  geometry = new THREE.BufferGeometry();
  positions = new Float32Array(PARTICLE_COUNT * 3);
  colors = new Float32Array(PARTICLE_COUNT * 3);
  previousColors = new Float32Array(PARTICLE_COUNT * 3);
  velocities = new Float32Array(PARTICLE_COUNT * 3);

  // Initialize particles in random positions within view
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * window.innerWidth;
    positions[i3 + 1] = (Math.random() - 0.5) * window.innerHeight;
    positions[i3 + 2] = (Math.random() - 0.5) * 400;

    colors[i3] = 0.6 + Math.random() * 0.4;     // R: purple range
    colors[i3 + 1] = 0.2 + Math.random() * 0.2;  // G
    colors[i3 + 2] = 0.6 + Math.random() * 0.4;  // B

    velocities[i3] = 0;
    velocities[i3 + 1] = 0;
    velocities[i3 + 2] = 0;

    particleData.push({
      orbitRadius: 30 + Math.random() * 150,
      orbitSpeed: 0.5 + Math.random() * 2,
      orbitAngle: Math.random() * Math.PI * 2,
      orbitY: (Math.random() - 0.5) * 100,
      delay: Math.random() * 0.5,
      dragOffsetX: 0,
      dragOffsetY: 0,
      dragOffsetZ: 0,
      offsetCaptured: false,
    });
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Point material
  material = new THREE.PointsMaterial({
    size: 3,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.8,
  });

  points = new THREE.Points(geometry, material);
  scene.add(points);

  // Handle resize
  onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);
}

export function updateParticles(gestureInfo) {
  const dt = Math.min(clock.getDelta(), 0.1);
  stateTime += dt;

  // Handle state transition
  if (gestureInfo.gesture !== currentState) {
    prevState = currentState;
    currentState = gestureInfo.gesture;
    stateTime = 0;
    transitionProgress = 0;
    // Snapshot current colors for transition blending
    previousColors.set(colors);
  }

  // Reset state-specific data on transition
  if (currentState !== prevState) {
    if (currentState === 'drag') {
      handTrail = [];
      prevHandPos = null;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particleData[i].dragOffsetX = 0;
        particleData[i].dragOffsetY = 0;
        particleData[i].dragOffsetZ = 0;
        particleData[i].offsetCaptured = false;
      }
    }
    if (currentState === 'ripple') {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particleData[i].delay = Math.random() * 2;
      }
    }
  }

  // Smooth transition progress
  if (transitionProgress < 1) {
    transitionProgress += dt / TRANSITION_DURATION;
    if (transitionProgress > 1) transitionProgress = 1;
  }

  const hp = screenToWorld(gestureInfo.handPosition);

  // Maintain hand trail for drag state
  if (currentState === 'drag') {
    handTrail.unshift({ x: hp.x, y: hp.y, z: hp.z });
    if (handTrail.length > TRAIL_LENGTH) handTrail.pop();
  }

  // Dispatch to current state behavior
  switch (currentState) {
    case 'orbit': updateOrbit(dt, hp); break;
    case 'collapse': updateCollapse(dt, hp); break;
    case 'peace': updateDualStream(dt, hp, gestureInfo); break;
    case 'vortex': updateVortex(dt, hp); break;
    case 'ripple': updateRipple(dt, hp); break;
    case 'helix': updateHelix(dt, hp); break;
    case 'drag': default: updateDrag(dt, hp); break;
  }

  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;

  renderer.render(scene, camera);
}

function screenToWorld(landmark) {
  // Convert normalized [0,1] hand coords to world space
  return {
    x: (landmark.x - 0.5) * window.innerWidth,
    y: -(landmark.y - 0.5) * window.innerHeight,
    z: (landmark.z - 0.5) * 400,
  };
}

// --- State Behaviors ---

function updateOrbit(dt, hp) {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const pd = particleData[i];

    pd.orbitAngle += pd.orbitSpeed * dt;

    const targetX = hp.x + Math.cos(pd.orbitAngle) * pd.orbitRadius;
    const targetY = hp.y + pd.orbitY;
    const targetZ = hp.z + Math.sin(pd.orbitAngle) * pd.orbitRadius;

    lerpPosition(i3, targetX, targetY, targetZ, 0.05);

    // Purple → pink based on radius
    const t = pd.orbitRadius / 150;
    const targetR = 0.6 + t * 0.3;
    const targetG = 0.1 + t * 0.3;
    const targetB = 0.3 + (1 - t) * 0.5;
    colors[i3] = previousColors[i3] + (targetR - previousColors[i3]) * transitionProgress;
    colors[i3 + 1] = previousColors[i3 + 1] + (targetG - previousColors[i3 + 1]) * transitionProgress;
    colors[i3 + 2] = previousColors[i3 + 2] + (targetB - previousColors[i3 + 2]) * transitionProgress;
  }
}

function updateCollapse(dt, hp) {
  const phase = stateTime < 0.5 ? 'in' : 'out'; // 0.5s collapse, then burst
  const elapsed = phase === 'in' ? stateTime : stateTime - 0.5;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const pd = particleData[i];

    if (phase === 'in') {
      // Accelerate toward hand
      const dx = hp.x - positions[i3];
      const dy = hp.y - positions[i3 + 1];
      const dz = hp.z - positions[i3 + 2];
      const speed = 1 + elapsed * 8; // accelerating
      velocities[i3] += dx * speed * dt * 2;
      velocities[i3 + 1] += dy * speed * dt * 2;
      velocities[i3 + 2] += dz * speed * dt * 2;
    } else {
      // Burst outward with decay
      if (elapsed < 0.05 && pd.delay < 0.1) {
        const angle = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const power = 200 + Math.random() * 400;
        velocities[i3] = Math.cos(angle) * Math.sin(phi) * power;
        velocities[i3 + 1] = Math.cos(phi) * power;
        velocities[i3 + 2] = Math.sin(angle) * Math.sin(phi) * power;
      }
      velocities[i3] *= 0.95;
      velocities[i3 + 1] *= 0.95;
      velocities[i3 + 2] *= 0.95;
    }

    positions[i3] += velocities[i3] * dt;
    positions[i3 + 1] += velocities[i3 + 1] * dt;
    positions[i3 + 2] += velocities[i3 + 2] * dt;

    // White hot → cooling
    const heat = Math.max(0, 1 - elapsed / 2);
    const targetR = heat * 1 + (1 - heat) * 0.6;
    const targetG = heat * 0.8 + (1 - heat) * 0.1;
    const targetB = heat * 0.4 + (1 - heat) * 0.6;
    colors[i3] = previousColors[i3] + (targetR - previousColors[i3]) * transitionProgress;
    colors[i3 + 1] = previousColors[i3 + 1] + (targetG - previousColors[i3 + 1]) * transitionProgress;
    colors[i3 + 2] = previousColors[i3 + 2] + (targetB - previousColors[i3 + 2]) * transitionProgress;
  }
}

function updateDualStream(dt, hp, gi) {
  const idxTip = screenToWorld(gi.indexTip);
  const midTip = screenToWorld(gi.middleTip);
  const half = PARTICLE_COUNT / 2;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const isIndex = i < half;
    const target = isIndex ? idxTip : midTip;
    const dirX = target.x - hp.x;
    const dirY = target.y - hp.y;
    const dirZ = target.z - hp.z;

    // Flow along finger direction from hand
    const dist = isIndex ? i / half : (i - half) / half;
    const tx = hp.x + dirX * dist * 3;
    const ty = hp.y + dirY * dist * 3;
    const tz = hp.z + dirZ * dist * 3;

    lerpPosition(i3, tx, ty, tz, 1 - Math.exp(-10 * dt));

    const targetR = isIndex ? 0.7 : 0.4;
    const targetG = 0.2;
    const targetB = isIndex ? 0.4 : 0.8;
    colors[i3] = previousColors[i3] + (targetR - previousColors[i3]) * transitionProgress;
    colors[i3 + 1] = previousColors[i3 + 1] + (targetG - previousColors[i3 + 1]) * transitionProgress;
    colors[i3 + 2] = previousColors[i3 + 2] + (targetB - previousColors[i3 + 2]) * transitionProgress;
  }
}

function updateVortex(dt, hp) {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const pd = particleData[i];

    pd.orbitAngle += (0.8 + pd.orbitSpeed * 1.5) * dt;
    pd.orbitY += dt * 60; // rise upward
    if (pd.orbitY > 400) pd.orbitY -= 400;

    const radius = pd.orbitRadius * (1 - pd.orbitY / 500); // narrower at top
    const tx = hp.x + Math.cos(pd.orbitAngle) * radius;
    const ty = hp.y + pd.orbitY - 200;
    const tz = hp.z + Math.sin(pd.orbitAngle) * radius;

    lerpPosition(i3, tx, ty, tz, 0.06);

    // Deep purple at base → cyan at top
    const t = pd.orbitY / 400;
    const targetR = 0.3 + t * 0.4;
    const targetG = 0.1 + t * 0.7;
    const targetB = 0.7 * (1 - t) + 0.5 * t;
    colors[i3] = previousColors[i3] + (targetR - previousColors[i3]) * transitionProgress;
    colors[i3 + 1] = previousColors[i3 + 1] + (targetG - previousColors[i3 + 1]) * transitionProgress;
    colors[i3 + 2] = previousColors[i3 + 2] + (targetB - previousColors[i3 + 2]) * transitionProgress;
  }
}

function updateRipple(dt, hp) {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const pd = particleData[i];

    pd.delay += dt;
    const phase = pd.delay % 2.5; // cycle every 2.5s

    // Expanding ring radius
    const ringRadius = 30 + phase * 120;
    const rings = 5;
    const ringIndex = i % rings;
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 * rings + phase * 3;

    const spread = 20 + ringIndex * 8;
    const tx = hp.x + Math.cos(angle) * (ringRadius + (Math.random() - 0.5) * spread);
    const ty = hp.y + (Math.random() - 0.5) * 40 + ringIndex * 15;
    const tz = hp.z + Math.sin(angle) * (ringRadius + (Math.random() - 0.5) * spread);

    lerpPosition(i3, tx, ty, tz, 0.08);

    // Teal/cyan rings with brightness proportional to phase
    const bright = phase < 0.3 ? 1 : Math.max(0.3, 1 - phase / 2.5);
    const targetR = 0.2 * bright;
    const targetG = 0.6 * bright;
    const targetB = 0.7 * bright;
    colors[i3] = previousColors[i3] + (targetR - previousColors[i3]) * transitionProgress;
    colors[i3 + 1] = previousColors[i3 + 1] + (targetG - previousColors[i3 + 1]) * transitionProgress;
    colors[i3 + 2] = previousColors[i3 + 2] + (targetB - previousColors[i3 + 2]) * transitionProgress;
  }
}

function updateHelix(dt, hp) {
  const half = PARTICLE_COUNT / 2;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const pd = particleData[i];
    const isStrandA = i < half;

    pd.orbitAngle += (1.5 + pd.orbitSpeed) * dt;
    pd.orbitY += dt * 80;
    if (pd.orbitY > 300) pd.orbitY -= 300;

    const phaseOffset = isStrandA ? 0 : Math.PI;
    const radius = 40 + pd.orbitRadius * 0.5;
    const angle = pd.orbitAngle + phaseOffset;

    const tx = hp.x + Math.cos(angle) * radius;
    const ty = hp.y + pd.orbitY - 150;
    const tz = hp.z + Math.sin(angle) * radius;

    lerpPosition(i3, tx, ty, tz, 0.06);

    // Strand A: gold, Strand B: rose
    const targetR = isStrandA ? 0.9 : 0.8;
    const targetG = isStrandA ? 0.7 : 0.2;
    const targetB = isStrandA ? 0.1 : 0.5;
    colors[i3] = previousColors[i3] + (targetR - previousColors[i3]) * transitionProgress;
    colors[i3 + 1] = previousColors[i3 + 1] + (targetG - previousColors[i3 + 1]) * transitionProgress;
    colors[i3 + 2] = previousColors[i3 + 2] + (targetB - previousColors[i3 + 2]) * transitionProgress;
  }
}

function updateDrag(dt, hp) {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const pd = particleData[i];

    // Assign particles to trail positions — front 30% follow hand, rest trail behind
    let trailIdx;
    if (i < PARTICLE_COUNT * 0.3) {
      trailIdx = 0;
    } else {
      const t = (i - PARTICLE_COUNT * 0.3) / (PARTICLE_COUNT * 0.7);
      trailIdx = Math.floor(t * (handTrail.length - 1));
    }

    const target = handTrail[Math.min(trailIdx, handTrail.length - 1)] || hp;

    if (!pd.offsetCaptured) {
      pd.dragOffsetX = positions[i3] - target.x;
      pd.dragOffsetY = positions[i3 + 1] - target.y;
      pd.dragOffsetZ = positions[i3 + 2] - target.z;
      if (i < PARTICLE_COUNT - 1) pd.offsetCaptured = true; // capture gradually
    }

    // Trail particles have wider spread (wave-like)
    const trailFactor = trailIdx / Math.max(handTrail.length, 1);
    const spreadX = trailFactor * 60 * Math.sin(i * 0.1 + trailIdx * 0.5);
    const spreadY = trailFactor * 40 * Math.cos(i * 0.13 + trailIdx * 0.4);
    const spreadZ = trailFactor * 50;

    const tx = target.x + pd.dragOffsetX + spreadX;
    const ty = target.y + pd.dragOffsetY + spreadY;
    const tz = target.z + pd.dragOffsetZ + spreadZ;

    // Front particles follow quickly, trail particles lag
    const lerpFactor = trailIdx === 0 ? 0.04 : 0.015;
    lerpPosition(i3, tx, ty, tz, lerpFactor);

    // Bright at front, dim and blue at tail
    const targetR = 0.5 * (1 - trailFactor * 0.6);
    const targetG = 0.3 * (1 - trailFactor * 0.7);
    const targetB = 0.5 + 0.5 * trailFactor;
    colors[i3] = previousColors[i3] + (targetR - previousColors[i3]) * transitionProgress;
    colors[i3 + 1] = previousColors[i3 + 1] + (targetG - previousColors[i3 + 1]) * transitionProgress;
    colors[i3 + 2] = previousColors[i3 + 2] + (targetB - previousColors[i3 + 2]) * transitionProgress;
  }
}

function lerpPosition(i3, tx, ty, tz, factor) {
  positions[i3] += (tx - positions[i3]) * factor;
  positions[i3 + 1] += (ty - positions[i3 + 1]) * factor;
  positions[i3 + 2] += (tz - positions[i3 + 2]) * factor;
}

export function getRenderer() {
  return renderer;
}

export function disposeParticles() {
  if (onResize) {
    window.removeEventListener('resize', onResize);
    onResize = null;
  }
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
  if (geometry) {
    geometry.dispose();
    geometry = null;
  }
  if (material) {
    material.dispose();
    material = null;
  }
}
