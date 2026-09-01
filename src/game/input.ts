export const input = {
  forward: 0,
  strafe: 0,
  run: false,
  yaw: 0,
  pitch: -0.1,
  lookDX: 0,
  lookDY: 0,
  fireQueued: false,
  holdBreath: false,
  pointerLocked: false,
  touch: false,
};

export function queueFire() {
  input.fireQueued = true;
}
