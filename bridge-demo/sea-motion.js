const TAU = Math.PI * 2;

// Keep the motion below the threshold where it reads as camera shake. The
// small secondary terms make the movement feel layered without introducing
// any discontinuities or random jumps.
const FADE_SECONDS = 1.5;
const ROLL_PERIOD = 12.4;
const PITCH_PERIOD = 9.6;
const HEAVE_PERIOD = 11.8;
const DRIFT_X_PERIOD = 13.4;
const DRIFT_Z_PERIOD = 10.2;
const ROLL_AMPLITUDE_DEGREES = 0.21;
const ROLL_SECONDARY_DEGREES = 0.035;
const PITCH_AMPLITUDE_DEGREES = 0.082;
const PITCH_SECONDARY_DEGREES = 0.018;
const HEAVE_AMPLITUDE_METERS = 0.0051;
const HEAVE_SECONDARY_METERS = 0.0009;
const DRIFT_X_AMPLITUDE_METERS = 0.0012;
const DRIFT_Z_AMPLITUDE_METERS = 0.0009;

const finiteDelta = (dt) => Number.isFinite(dt) ? Math.min(0.25, Math.max(0, dt)) : 0;

/**
 * Add a very small, smooth ocean-like motion to a camera pose.
 *
 * The camera's pose is rewritten by the tour controller every frame. This
 * module therefore always samples that pose first and applies a relative
 * quaternion/position offset. The host calls restoreBasePose() before its
 * controller update so the next sample cannot include the prior offset. The
 * effect starts disabled and is intended to be enabled explicitly by the host
 * UI or tour controller.
 */
export function createSeaMotion(pc, camera, { reducedMotion = false } = {}) {
  const localRight = new pc.Vec3(1, 0, 0);
  const localForward = new pc.Vec3(0, 0, -1);
  const basePosition = new pc.Vec3();
  const baseRotation = new pc.Quat();
  const pitchRotation = new pc.Quat();
  const rollRotation = new pc.Quat();
  const relativeRotation = new pc.Quat();
  const finalRotation = new pc.Quat();
  const phase = { value: 0 };

  let targetEnabled = false;
  let strength = 0;
  let destroyed = false;
  let hasBasePose = false;

  const updateFade = (dt) => {
    if (targetEnabled) {
      strength = Math.min(1, strength + dt / FADE_SECONDS);
    } else {
      strength = Math.max(0, strength - dt / FADE_SECONDS);
    }
  };

  const restoreBasePose = () => {
    if (destroyed || !camera || !hasBasePose) return;
    camera.setPosition(basePosition);
    camera.setRotation(baseRotation);
  };

  const update = (dt) => {
    if (destroyed || !camera) return;

    const seconds = finiteDelta(dt);
    phase.value += seconds;
    updateFade(seconds);

    // These are the controller's current pose, not the pose written by this
    // module on the preceding frame. This prevents cumulative drift.
    const position = camera.getPosition();
    const rotation = camera.getRotation();
    basePosition.copy(position);
    baseRotation.copy(rotation);
    hasBasePose = true;

    if (strength <= 0) return;

    const t = phase.value;
    const roll = (
      ROLL_AMPLITUDE_DEGREES * Math.sin(t * TAU / ROLL_PERIOD + 0.35) +
      ROLL_SECONDARY_DEGREES * Math.sin(t * TAU / 8.8 - 0.9)
    ) * strength;
    const pitch = (
      PITCH_AMPLITUDE_DEGREES * Math.sin(t * TAU / PITCH_PERIOD - 0.55) +
      PITCH_SECONDARY_DEGREES * Math.sin(t * TAU / 12.8 + 0.8)
    ) * strength;
    const heave = (
      HEAVE_AMPLITUDE_METERS * Math.sin(t * TAU / HEAVE_PERIOD + 1.2) +
      HEAVE_SECONDARY_METERS * Math.sin(t * TAU / 8.6 - 0.3)
    ) * strength;
    const driftX = DRIFT_X_AMPLITUDE_METERS * Math.sin(t * TAU / DRIFT_X_PERIOD + 0.15) * strength;
    const driftZ = DRIFT_Z_AMPLITUDE_METERS * Math.cos(t * TAU / DRIFT_Z_PERIOD - 0.7) * strength;

    // Both axes are local to the camera. Multiplying the offset on the right
    // of the base quaternion keeps roll on the view axis rather than world Z.
    pitchRotation.setFromAxisAngle(localRight, pitch);
    rollRotation.setFromAxisAngle(localForward, roll);
    relativeRotation.mul2(pitchRotation, rollRotation);
    finalRotation.mul2(baseRotation, relativeRotation).normalize();

    camera.setPosition(
      basePosition.x + driftX,
      basePosition.y + heave,
      basePosition.z + driftZ
    );
    camera.setRotation(finalRotation);
  };

  const setEnabled = (value) => {
    if (destroyed) return targetEnabled;
    // Reduced-motion users never receive camera sway, even if a host toggle
    // accidentally asks to enable it later.
    targetEnabled = !reducedMotion && Boolean(value);
    return targetEnabled;
  };

  const destroy = () => {
    if (destroyed) return;
    // Restore before marking destroyed so this path shares the same guarded
    // reset used by the host before each controller tick.
    restoreBasePose();
    destroyed = true;
    targetEnabled = false;
    strength = 0;
  };

  return {
    update,
    restoreBasePose,
    setEnabled,
    get enabled() { return targetEnabled; },
    destroy
  };
}

