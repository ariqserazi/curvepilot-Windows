function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function lerp(start, end, amount) {
  return start + (end - start) * amount
}

function inverseLerp(start, end, value) {
  if (start === end) {
    return 0
  }
  return (value - start) / (end - start)
}

function roundTo(value, precision = 3) {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function nearlyEqual(a, b, epsilon = 0.00001) {
  return Math.abs(a - b) <= epsilon
}

module.exports = {
  clamp,
  lerp,
  inverseLerp,
  roundTo,
  nearlyEqual
}
