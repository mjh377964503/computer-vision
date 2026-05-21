import * as THREE from 'three';

const PARTICLE_COUNT = 3000;
const TRANSITION_DURATION = 0.4; // seconds

let scene, camera, renderer, points, geometry;
let positions, colors, velocities;
let clock = new THREE.Clock();

// Each particle's metadata for state behaviors
let particleData = [];

// Current state + transition tracking
let currentState = 'drag';
let prevState = 'drag';
let stateTime = 0;
let transitionProgress = 1; // 1 = fully in current state

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
      sprayLife: Math.random(),
      dragOffsetX: 0,
      dragOffsetY: 0,
      dragOffsetZ: 0,
    });
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Point material
  const material = new THREE.PointsMaterial({
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
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
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
  }

  // Smooth transition progress
  if (transitionProgress < 1) {
    transitionProgress += dt / TRANSITION_DURATION;
    if (transitionProgress > 1) transitionProgress = 1;
  }

  const hp = screenToWorld(gestureInfo.handPosition);

  // Dispatch to current state behavior
  switch (currentState) {
    case 'orbit': updateOrbit(dt, hp); break;
    case 'collapse': updateCollapse(dt, hp); break;
    case 'peace': updateDualStream(dt, hp, gestureInfo); break;
    case 'thumbsUp': updateSpray(dt, hp); break;
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
    colors[i3] = 0.6 + t * 0.3;
    colors[i3 + 1] = 0.1 + t * 0.3;
    colors[i3 + 2] = 0.3 + (1 - t) * 0.5;
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
    colors[i3] = heat * 1 + (1 - heat) * 0.6;
    colors[i3 + 1] = heat * 0.8 + (1 - heat) * 0.1;
    colors[i3 + 2] = heat * 0.4 + (1 - heat) * 0.6;
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

    lerpPosition(i3, tx, ty, tz, 0.03);

    colors[i3] = isIndex ? 0.7 : 0.4;
    colors[i3 + 1] = 0.2;
    colors[i3 + 2] = isIndex ? 0.4 : 0.8;
  }
}

function updateSpray(dt, hp) {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const pd = particleData[i];

    pd.sprayLife += dt;

    if (pd.sprayLife > 1.5 + pd.delay) {
      // Respawn at hand position
      pd.sprayLife = 0;
      positions[i3] = hp.x + (Math.random() - 0.5) * 30;
      positions[i3 + 1] = hp.y;
      positions[i3 + 2] = hp.z;
      velocities[i3] = (Math.random() - 0.5) * 30;
      velocities[i3 + 1] = -100 - Math.random() * 200; // upward
      velocities[i3 + 2] = (Math.random() - 0.5) * 30;
    }

    positions[i3] += velocities[i3] * dt;
    positions[i3 + 1] += velocities[i3 + 1] * dt;
    positions[i3 + 2] += velocities[i3 + 2] * dt;

    // Fade with height
    const fade = Math.max(0, 1 - pd.sprayLife / 2);
    colors[i3] = 0.9 * fade;
    colors[i3 + 1] = 0.7 * fade;
    colors[i3 + 2] = 0.2 * fade;
  }
}

function updateDrag(dt, hp) {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const pd = particleData[i];

    // Store offset on first contact
    if (pd.dragOffsetX === 0 && pd.dragOffsetY === 0) {
      pd.dragOffsetX = positions[i3] - hp.x;
      pd.dragOffsetY = positions[i3 + 1] - hp.y;
      pd.dragOffsetZ = positions[i3 + 2] - hp.z;
    }

    // Inertial follow with delay
    const tx = hp.x + pd.dragOffsetX;
    const ty = hp.y + pd.dragOffsetY;
    const tz = hp.z + pd.dragOffsetZ;

    lerpPosition(i3, tx, ty, tz, 0.02);

    colors[i3] = 0.5;
    colors[i3 + 1] = 0.3;
    colors[i3 + 2] = 0.7;
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
