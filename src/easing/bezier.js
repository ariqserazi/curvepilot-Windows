const { clamp } = require("../utils/math")

const DEFAULT_CURVE = {
  cp1: { x: 0.32, y: 0.12 },
  cp2: { x: 0.68, y: 0.88 }
}

function sanitizeCurve(curve) {
  const input = curve || DEFAULT_CURVE
  const cp1 = input.cp1 || DEFAULT_CURVE.cp1
  const cp2 = input.cp2 || DEFAULT_CURVE.cp2

  return {
    cp1: {
      x: sanitizeAxis(cp1.x, DEFAULT_CURVE.cp1.x, 0, 1),
      y: sanitizeAxis(cp1.y, DEFAULT_CURVE.cp1.y, -0.35, 1.35)
    },
    cp2: {
      x: sanitizeAxis(cp2.x, DEFAULT_CURVE.cp2.x, 0, 1),
      y: sanitizeAxis(cp2.y, DEFAULT_CURVE.cp2.y, -0.35, 1.35)
    }
  }
}

function sanitizeAxis(value, fallback, min, max) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? clamp(numeric, min, max) : fallback
}

function cubicCoordinate(t, a1, a2) {
  const u = 1 - t
  return 3 * u * u * t * a1 + 3 * u * t * t * a2 + t * t * t
}

function cubicDerivative(t, a1, a2) {
  return 3 * (1 - t) * (1 - t) * a1 + 6 * (1 - t) * t * (a2 - a1) + 3 * t * t * (1 - a2)
}

function solveCurveTForX(x, curve) {
  const safeX = clamp(x, 0, 1)
  let t = safeX

  for (let index = 0; index < 8; index += 1) {
    const currentX = cubicCoordinate(t, curve.cp1.x, curve.cp2.x) - safeX
    const slope = cubicDerivative(t, curve.cp1.x, curve.cp2.x)

    if (Math.abs(currentX) < 0.000001) {
      return t
    }

    if (Math.abs(slope) < 0.000001) {
      break
    }

    t -= currentX / slope
  }

  let lower = 0
  let upper = 1
  t = safeX

  for (let index = 0; index < 12; index += 1) {
    const currentX = cubicCoordinate(t, curve.cp1.x, curve.cp2.x)

    if (Math.abs(currentX - safeX) < 0.000001) {
      return t
    }

    if (currentX < safeX) {
      lower = t
    } else {
      upper = t
    }

    t = (lower + upper) / 2
  }

  return t
}

function evaluateBezier(curve, x) {
  const safeCurve = sanitizeCurve(curve)
  const t = solveCurveTForX(x, safeCurve)
  return cubicCoordinate(t, safeCurve.cp1.y, safeCurve.cp2.y)
}

function transformCurve(curve, mode) {
  const safeCurve = sanitizeCurve(curve)

  switch (mode) {
    case "reverse":
      return {
        cp1: {
          x: 1 - safeCurve.cp2.x,
          y: 1 - safeCurve.cp2.y
        },
        cp2: {
          x: 1 - safeCurve.cp1.x,
          y: 1 - safeCurve.cp1.y
        }
      }
    case "mirror":
      return {
        cp1: {
          x: 1 - safeCurve.cp1.x,
          y: safeCurve.cp1.y
        },
        cp2: {
          x: 1 - safeCurve.cp2.x,
          y: safeCurve.cp2.y
        }
      }
    case "flip":
      return {
        cp1: {
          x: safeCurve.cp1.x,
          y: 1 - safeCurve.cp1.y
        },
        cp2: {
          x: safeCurve.cp2.x,
          y: 1 - safeCurve.cp2.y
        }
      }
    default:
      return safeCurve
  }
}

module.exports = {
  DEFAULT_CURVE,
  sanitizeCurve,
  evaluateBezier,
  transformCurve
}
