/**
 * Returns the interpolated track width at a given position along the track.
 *
 * @param {object} circuit - Circuit definition with waypoints, trackWidth, and optional trackWidths array.
 * @param {number} segIdx  - Index of the segment (waypoint pair).
 * @param {number} t       - Interpolation factor within the segment [0, 1].
 * @returns {number} Track width at that position.
 */
export function getTrackWidthAtSegment(circuit, segIdx, t) {
  const baseWidth = circuit.trackWidth || 12;
  const widths = circuit.trackWidths;
  if (!widths) return baseWidth;

  const n = widths.length;
  const idxA = ((segIdx % n) + n) % n;
  const idxB = (idxA + 1) % n;
  return widths[idxA] + (widths[idxB] - widths[idxA]) * t;
}
