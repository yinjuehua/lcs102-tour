export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

export function isInsidePolygon(x, z, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i], [xj, zj] = polygon[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function allowedMove(position, dx, dz, polygon) {
  let [x, y, z] = position;
  if (isInsidePolygon(x + dx, z + dz, polygon)) return [x + dx, y, z + dz];
  // Slide along the boundary instead of stopping all motion at a corner.
  if (isInsidePolygon(x + dx, z, polygon)) x += dx;
  if (isInsidePolygon(x, z + dz, polygon)) z += dz;
  return [x, y, z];
}

export function angleDelta(start, end) { return (((end - start + 180) % 360) + 360) % 360 - 180; }

export function validateIssue(value) {
  return value && typeof value.id === 'string' && typeof value.note === 'string' &&
    value.note.length > 0 && value.note.length <= 600 && typeof value.createdAt === 'string' &&
    value.camera && Array.isArray(value.camera.position) && value.camera.position.length === 3 &&
    value.camera.position.every(Number.isFinite) && Number.isFinite(value.camera.yaw) && Number.isFinite(value.camera.pitch);
}
