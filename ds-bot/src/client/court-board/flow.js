// The clock behind the board's slow background motion. Everything that keeps moving while
// nobody is doing anything — the 金水河, the clouds — is a plain function of the time, so
// the board looks the same whether it draws sixty frames a second or ten.

/**
 * How far the 金水河 has drifted after `seconds`, wrapped to one lap of the texture.
 * @param {number} seconds since the board opened
 * @param {number} [rate] laps per second
 * @returns {number} between 0 and 1
 */
export function flowOffset(seconds, rate = 0.02) {
  const at = (Number(seconds) * rate) % 1
  return at < 0 ? at + 1 : at
}

/**
 * Where a drifting cloud sits after `seconds`, wrapped into the span it crosses.
 * @param {number} start where it began
 * @param {number} speed units per second
 * @param {number} seconds since the board opened
 * @param {number} [span] how far it travels before it comes round again
 * @returns {number} between -span/2 and span/2
 */
export function driftX(start, speed, seconds, span = 380) {
  const moved = start + speed * Number(seconds)
  return ((moved + span / 2) % span + span) % span - span / 2
}
