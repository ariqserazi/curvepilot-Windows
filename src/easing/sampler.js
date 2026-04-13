const { evaluateBezier } = require("./bezier")

const DENSITY_OPTIONS = {
  low: 10,
  medium: 18,
  high: 34
}

function resolveSampleCount(mode, customCount) {
  if (mode === "custom") {
    const parsed = Number(customCount)
    return Number.isFinite(parsed) ? Math.max(2, Math.min(120, Math.round(parsed))) : 18
  }

  return DENSITY_OPTIONS[mode] || DENSITY_OPTIONS.medium
}

function sampleCurve(curve, count) {
  const safeCount = Math.max(2, count)
  const samples = []

  for (let index = 0; index < safeCount; index += 1) {
    const time = safeCount === 1 ? 0 : index / (safeCount - 1)
    samples.push({
      x: time,
      y: evaluateBezier(curve, time)
    })
  }

  return samples
}

module.exports = {
  DENSITY_OPTIONS,
  resolveSampleCount,
  sampleCurve
}
