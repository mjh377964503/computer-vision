const GESTURE_LABELS = {
  orbit: '旋转星云',
  collapse: '聚拢炸裂',
  peace: '双股粒子流',
  thumbsUp: '向上喷射',
  drag: '拖拽云团',
};

export function updateGestureLabel(gesture) {
  const el = document.getElementById('gesture-label');
  if (el) {
    el.textContent = GESTURE_LABELS[gesture] || '';
  }
}

// UI utilities — PIP window management
export function updatePIP(videoElement) {
  // PIP video already positioned via CSS, no extra logic needed
  // Placeholder for future UI additions
}

export function setLoading(visible) {
  let el = document.getElementById('loading-indicator');
  if (visible) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'loading-indicator';
      el.textContent = 'Loading...';
      el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);font-size:1.5rem;color:#fff;z-index:9999;';
      document.body.appendChild(el);
    }
    el.style.display = '';
  } else if (el) {
    el.style.display = 'none';
  }
}
