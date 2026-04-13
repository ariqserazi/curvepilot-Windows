var bezier = require("./bezier")
var callHost = require("../cep/bridge").callHost
var sanitizeCurve = bezier.sanitizeCurve
var DEFAULT_CURVE = bezier.DEFAULT_CURVE

var STORAGE_KEY = "curvepilot.cep.state.v1"

var BUILT_IN_PRESETS = [
  { id: "builtin-linear", name: "Linear", builtIn: true, curve: { cp1: { x: 0, y: 0 }, cp2: { x: 1, y: 1 } } },
  { id: "builtin-liftoff", name: "Lift Off", builtIn: true, curve: { cp1: { x: 0.42, y: 0 }, cp2: { x: 0.84, y: 0.3 } } },
  { id: "builtin-soft-arrival", name: "Soft Arrival", builtIn: true, curve: { cp1: { x: 0.16, y: 0.72 }, cp2: { x: 0.22, y: 1 } } },
  { id: "builtin-balanced", name: "Balanced Ease", builtIn: true, curve: { cp1: { x: 0.34, y: 0.08 }, cp2: { x: 0.64, y: 0.92 } } },
  { id: "builtin-punch-in", name: "Punch In", builtIn: true, curve: { cp1: { x: 0.5, y: 0.02 }, cp2: { x: 0.86, y: 0.15 } } },
  { id: "builtin-punch-out", name: "Punch Out", builtIn: true, curve: { cp1: { x: 0.14, y: 0.84 }, cp2: { x: 0.48, y: 0.98 } } },
  { id: "builtin-spring-arc", name: "Spring Arc", builtIn: true, curve: { cp1: { x: 0.3, y: -0.05 }, cp2: { x: 0.72, y: 1.1 } } },
  { id: "builtin-velvet-s", name: "Velvet S", builtIn: true, curve: { cp1: { x: 0.18, y: 0.26 }, cp2: { x: 0.78, y: 0.84 } } }
]

function loadState() {
  var raw
  var parsed
  var customPresets
  var index

  try {
    raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        customPresets: [],
        lastSettings: {},
        lastSelectedPresetId: BUILT_IN_PRESETS[3].id
      }
    }

    parsed = JSON.parse(raw)
    customPresets = []

    if (parsed.customPresets && parsed.customPresets.length) {
      for (index = 0; index < parsed.customPresets.length; index += 1) {
        customPresets.push({
          id: String(parsed.customPresets[index].id),
          name: String(parsed.customPresets[index].name),
          builtIn: false,
          curve: sanitizeCurve(parsed.customPresets[index].curve)
        })
      }
    }

    return {
      customPresets: customPresets,
      lastSettings: parsed.lastSettings || {},
      lastSelectedPresetId: parsed.lastSelectedPresetId || BUILT_IN_PRESETS[3].id
    }
  } catch (error) {
    return {
      customPresets: [],
      lastSettings: {},
      lastSelectedPresetId: BUILT_IN_PRESETS[3].id
    }
  }
}

function saveState(state) {
  var payload = {
    customPresets: state.customPresets || [],
    lastSettings: state.lastSettings || {},
    lastSelectedPresetId: state.lastSelectedPresetId || BUILT_IN_PRESETS[3].id
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

function buildCustomPreset(name, curve) {
  return {
    id: "custom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    name: String(name || "Custom Curve").trim() || "Custom Curve",
    builtIn: false,
    curve: sanitizeCurve(curve || DEFAULT_CURVE)
  }
}

function exportPresets(presets) {
  var safePresets = []
  var input = presets || []
  var index

  for (index = 0; index < input.length; index += 1) {
    safePresets.push({
      id: input[index].id,
      name: input[index].name,
      curve: sanitizeCurve(input[index].curve)
    })
  }

  return callHost("exportPresets", {
    presets: safePresets
  })
}

function importPresets() {
  return callHost("importPresets").then(function (imported) {
    var results = []
    var index
    var presets = imported || []

    for (index = 0; index < presets.length; index += 1) {
      results.push(buildCustomPreset(presets[index].name || ("Imported " + (index + 1)), presets[index].curve))
    }

    return results
  })
}

module.exports = {
  BUILT_IN_PRESETS: BUILT_IN_PRESETS,
  buildCustomPreset: buildCustomPreset,
  exportPresets: exportPresets,
  importPresets: importPresets,
  loadState: loadState,
  saveState: saveState
}
