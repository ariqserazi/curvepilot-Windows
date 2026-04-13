(function () {
  var MODULES = {
    "/src/cep/bridge.js": function (module, exports, require) {
var errors = require("../utils/errors")
var createLogger = require("../utils/logger").createLogger
var AppError = errors.AppError
var normalizeError = errors.normalizeError

var logger = createLogger("cep-bridge")
var csInterface = null

function getCSInterface() {
  if (!csInterface) {
    if (typeof window === "undefined" || typeof window.CSInterface !== "function") {
      throw new AppError("CSInterface is unavailable. CurvePilot must run inside a CEP host.", {
        code: "NO_CSINTERFACE"
      })
    }

    csInterface = new window.CSInterface()
  }

  return csInterface
}

function encodePayload(payload) {
  return encodeURIComponent(JSON.stringify(payload || {}))
}

function buildScript(functionName, payload) {
  if (typeof payload === "undefined") {
    return "CurvePilotHost." + functionName + "()"
  }

  return "CurvePilotHost." + functionName + "('" + encodePayload(payload) + "')"
}

function parseHostResponse(rawResult) {
  var parsed

  if (!rawResult || rawResult === "EvalScript error.") {
    throw new AppError("Premiere did not return a valid CEP scripting response.", {
      code: "EVALSCRIPT_ERROR"
    })
  }

  try {
    parsed = JSON.parse(rawResult)
  } catch (error) {
    throw new AppError("Premiere returned a malformed CEP scripting response.", {
      code: "INVALID_HOST_RESPONSE",
      details: rawResult
    })
  }

  if (!parsed.ok) {
    throw new AppError(parsed.error && parsed.error.message ? parsed.error.message : "Premiere host command failed.", {
      code: parsed.error && parsed.error.code ? parsed.error.code : "HOST_ERROR",
      hint: parsed.error && parsed.error.hint ? parsed.error.hint : "",
      details: parsed.error
    })
  }

  return parsed.data
}

function callHost(functionName, payload) {
  return new Promise(function (resolve, reject) {
    var script

    try {
      script = buildScript(functionName, payload)
    } catch (error) {
      reject(normalizeError(error, "Unable to build the host scripting payload."))
      return
    }

    try {
      getCSInterface().evalScript(script, function (rawResult) {
        try {
          resolve(parseHostResponse(rawResult))
        } catch (error) {
          reject(normalizeError(error))
        }
      })
    } catch (error) {
      logger.error("CEP host call failed", error)
      reject(normalizeError(error, "CurvePilot could not talk to Premiere through CEP."))
    }
  })
}

function getHostInfo() {
  var environment = getCSInterface().getHostEnvironment() || {}

  return {
    appName: environment.appName || "PPRO",
    appVersion: environment.appVersion || "unknown",
    cepVersion: environment.cepVersion || "unknown"
  }
}

module.exports = {
  callHost: callHost,
  getHostInfo: getHostInfo
}

    },
    "/src/easing/apply-curve.js": function (module, exports, require) {
var callHost = require("../cep/bridge").callHost

function previewCurveApplication(options) {
  return callHost("previewApply", options)
}

function applyCurveToSelection(options) {
  return callHost("applyCurve", options)
}

function clearKeysFromSelection(options) {
  return callHost("clearKeys", options)
}

module.exports = {
  applyCurveToSelection: applyCurveToSelection,
  clearKeysFromSelection: clearKeysFromSelection,
  previewCurveApplication: previewCurveApplication
}

    },
    "/src/easing/bezier.js": function (module, exports, require) {
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

    },
    "/src/easing/preset-store.js": function (module, exports, require) {
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

    },
    "/src/easing/sampler.js": function (module, exports, require) {
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

    },
    "/src/main.js": function (module, exports, require) {
var CurveEditor = require("./ui/curve-editor").CurveEditor
var PresetListView = require("./ui/preset-list").PresetListView
var presetStore = require("./easing/preset-store")
var bezier = require("./easing/bezier")
var curveActions = require("./easing/apply-curve")
var bridge = require("./cep/bridge")
var createLogger = require("./utils/logger").createLogger
var errors = require("./utils/errors")

var BUILT_IN_PRESETS = presetStore.BUILT_IN_PRESETS
var buildCustomPreset = presetStore.buildCustomPreset
var exportPresets = presetStore.exportPresets
var importPresets = presetStore.importPresets
var loadState = presetStore.loadState
var saveState = presetStore.saveState
var DEFAULT_CURVE = bezier.DEFAULT_CURVE
var sanitizeCurve = bezier.sanitizeCurve
var previewCurveApplication = curveActions.previewCurveApplication
var applyCurveToSelection = curveActions.applyCurveToSelection
var clearKeysFromSelection = curveActions.clearKeysFromSelection
var getHostInfo = bridge.getHostInfo
var callHost = bridge.callHost
var normalizeError = errors.normalizeError
var toUserMessage = errors.toUserMessage

var logger = createLogger("main")

function copyArray(items) {
  return items.slice(0)
}

function combinePresets(customPresets) {
  return BUILT_IN_PRESETS.concat(customPresets || [])
}

function findById(items, id) {
  var index
  for (index = 0; index < items.length; index += 1) {
    if (items[index].id === id) {
      return items[index]
    }
  }
  return null
}

function filterSelectedProperties(properties, selectedIds) {
  var output = []
  var index

  for (index = 0; index < properties.length; index += 1) {
    if (selectedIds.indexOf(properties[index].id) !== -1) {
      output.push(properties[index])
    }
  }

  return output
}

function buildPreferredPropertySelection(properties, existingSelection) {
  var availableById = {}
  var preserved = []
  var preferred = []
  var index

  for (index = 0; index < properties.length; index += 1) {
    availableById[properties[index].id] = properties[index]
  }

  if (existingSelection && existingSelection.length) {
    for (index = 0; index < existingSelection.length; index += 1) {
      if (availableById[existingSelection[index]]) {
        preserved.push(existingSelection[index])
      }
    }
  }

  if (availableById["motion.position"]) {
    preferred.push("motion.position")
  }

  if (availableById["motion.scale"]) {
    preferred.push("motion.scale")
  }

  if (preferred.length) {
    return preferred
  }

  if (preserved.length) {
    return preserved
  }

  return properties.length ? [properties[0].id] : []
}

function CurvePilotApp(rootNode) {
  this.rootNode = rootNode
  this.state = {
    curve: sanitizeCurve(DEFAULT_CURVE),
    presets: copyArray(BUILT_IN_PRESETS),
    selectedPresetId: BUILT_IN_PRESETS[3].id,
    advancedMode: false,
    selectedPropertyIds: [],
    selectedClips: [],
    availableProperties: [],
    projectName: "",
    sequenceName: "",
    customPresets: [],
    applyMode: "endpointKeys",
    customStartPercent: 10,
    customEndPercent: 90,
    sampleDensity: "custom",
    customSampleCount: 72,
    interpolationMode: "BEZIER",
    overwriteAck: false,
    warningText: "",
    status: null,
    hostInfo: {
      appName: "PPRO",
      appVersion: "unknown",
      cepVersion: "unknown"
    },
    dryRun: null
  }

  this.views = {}
  this.dom = {}
}

CurvePilotApp.prototype.initialize = function () {
  var self = this

  this.rootNode.innerHTML = this.renderShell()
  this.cacheDom()
  this.mountViews()
  this.bindEvents()
  this.loadPersistedState()

  return this.refreshContext().then(function () {
    self.renderAll()
    self.renderStatus(self.state.status)
  })
}

CurvePilotApp.prototype.renderShell = function () {
  return [
    '<div class="cp-shell">',
    '  <div class="cp-stack">',
    '    <section class="cp-topbar"><div class="cp-topbar-title"><h1>CurvePilot</h1></div></section>',
    '    <section class="cp-card cp-card-editor">',
      '      <div class="cp-card-body cp-editor-body">',
    '        <div id="curve-editor"></div>',
    '        <div class="cp-main-actions">',
    '          <button type="button" id="savePresetButton">Save</button>',
    '          <button type="button" id="deletePresetButton" class="cp-danger">Delete</button>',
    '          <button type="button" id="clearKeysButton">Clear Keys</button>',
    '          <button type="button" id="applyCurveButton" class="cp-primary">Apply</button>',
    '        </div>',
    '        <div id="statusPanel"></div>',
    '      </div>',
    '    </section>',
    '    <section class="cp-card cp-card-presets"><div class="cp-card-body cp-card-body-compact" id="preset-list"></div></section>',
    '    <div class="cp-hidden">',
    '      <select id="applyMode"><option value="clipBounds">Clip bounds</option><option value="endpointKeys">Endpoint keys</option><option value="customSpan">Custom %</option></select>',
    '      <div id="customSpanFields" class="cp-hidden"><input id="startPercent" type="number" min="0" max="99" step="1" /><input id="endPercent" type="number" min="1" max="100" step="1" /></div>',
    '      <select id="sampleDensity"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="custom">Custom</option></select>',
    '      <input id="customSampleCount" type="number" min="2" max="120" step="1" />',
    '      <select id="interpolationMode"><option value="BEZIER">Bezier</option><option value="LINEAR">Linear</option><option value="HOLD">Hold</option></select>',
    '      <div id="dryRunPanel"></div>',
    '      <label id="overwriteAckRow" class="cp-hidden"><input id="overwriteAck" type="checkbox" /></label>',
    "    </div>",
    "  </div>",
    "</div>"
  ].join("")
}

CurvePilotApp.prototype.cacheDom = function () {
  this.dom = {
    versionPill: this.rootNode.querySelector("#cp-version-pill"),
    applyMode: this.rootNode.querySelector("#applyMode"),
    customSpanFields: this.rootNode.querySelector("#customSpanFields"),
    startPercent: this.rootNode.querySelector("#startPercent"),
    endPercent: this.rootNode.querySelector("#endPercent"),
    sampleDensity: this.rootNode.querySelector("#sampleDensity"),
    customSampleCount: this.rootNode.querySelector("#customSampleCount"),
    interpolationMode: this.rootNode.querySelector("#interpolationMode"),
    overwriteAckRow: this.rootNode.querySelector("#overwriteAckRow"),
    overwriteAck: this.rootNode.querySelector("#overwriteAck"),
    dryRunPanel: this.rootNode.querySelector("#dryRunPanel"),
    statusPanel: this.rootNode.querySelector("#statusPanel"),
    savePresetButton: this.rootNode.querySelector("#savePresetButton"),
    deletePresetButton: this.rootNode.querySelector("#deletePresetButton"),
    clearKeysButton: this.rootNode.querySelector("#clearKeysButton"),
    applyCurveButton: this.rootNode.querySelector("#applyCurveButton")
  }
}

CurvePilotApp.prototype.mountViews = function () {
  var self = this

  this.views.curveEditor = new CurveEditor(this.rootNode.querySelector("#curve-editor"), {
    initialCurve: this.state.curve,
    onChange: function (curve) {
      self.state.curve = sanitizeCurve(curve)
      self.state.selectedPresetId = ""
      self.queueSave()
      self.refreshDryRun()
    }
  })
  this.views.curveEditor.mount()

  this.views.presets = new PresetListView(this.rootNode.querySelector("#preset-list"), {
    onSelect: function (presetId) { self.selectPreset(presetId) },
    onSaveCurrent: function () { self.handleSavePreset() },
    onDelete: function () { self.handleDeletePreset() }
  })
  this.views.presets.mount()
}

CurvePilotApp.prototype.bindEvents = function () {
  var self = this

  this.dom.applyMode.addEventListener("change", function (event) {
    self.state.applyMode = event.target.value
    self.state.overwriteAck = false
    self.renderApplySection()
    self.queueSave()
    self.refreshDryRun()
  })

  this.dom.startPercent.addEventListener("input", function (event) {
    self.state.customStartPercent = Number(event.target.value)
    self.queueSave()
    self.refreshDryRun()
  })

  this.dom.endPercent.addEventListener("input", function (event) {
    self.state.customEndPercent = Number(event.target.value)
    self.queueSave()
    self.refreshDryRun()
  })

  this.dom.sampleDensity.addEventListener("change", function (event) {
    self.state.sampleDensity = event.target.value
    self.state.overwriteAck = false
    self.renderApplySection()
    self.queueSave()
    self.refreshDryRun()
  })

  this.dom.customSampleCount.addEventListener("input", function (event) {
    self.state.customSampleCount = Number(event.target.value)
    self.queueSave()
    self.refreshDryRun()
  })

  this.dom.interpolationMode.addEventListener("change", function (event) {
    self.state.interpolationMode = event.target.value
    self.queueSave()
  })

  this.dom.overwriteAck.addEventListener("change", function (event) {
    self.state.overwriteAck = event.target.checked
    self.renderApplySection()
  })

  this.dom.savePresetButton.addEventListener("click", function () {
    self.handleSavePreset()
  })

  this.dom.deletePresetButton.addEventListener("click", function () {
    self.handleDeletePreset()
  })

  this.dom.clearKeysButton.addEventListener("click", function () {
    self.clearKeys()
  })

  this.dom.applyCurveButton.addEventListener("click", function () {
    self.applyCurve()
  })
}

CurvePilotApp.prototype.loadPersistedState = function () {
  var persisted = loadState()
  var settings = persisted.lastSettings || {}

  this.state.customPresets = persisted.customPresets
  this.state.presets = combinePresets(persisted.customPresets)
  this.state.selectedPresetId = persisted.lastSelectedPresetId
  this.state.curve = sanitizeCurve(settings.curve || this.state.curve)
  this.state.advancedMode = !!settings.advancedMode
  this.state.applyMode = settings.applyMode || this.state.applyMode
  this.state.customStartPercent = typeof settings.customStartPercent !== "undefined" ? settings.customStartPercent : this.state.customStartPercent
  this.state.customEndPercent = typeof settings.customEndPercent !== "undefined" ? settings.customEndPercent : this.state.customEndPercent
  this.state.sampleDensity = settings.sampleDensity || this.state.sampleDensity
  this.state.customSampleCount = typeof settings.customSampleCount !== "undefined" ? settings.customSampleCount : this.state.customSampleCount
  this.state.interpolationMode = settings.interpolationMode || this.state.interpolationMode
  this.state.selectedPropertyIds = settings.selectedPropertyIds || []

  this.views.curveEditor.setCurve(this.state.curve)
}

CurvePilotApp.prototype.refreshContext = function () {
  var self = this

  try {
    this.state.hostInfo = getHostInfo()
  } catch (error) {
    this.state.hostInfo = {
      appName: "PPRO",
      appVersion: "unknown",
      cepVersion: "unknown"
    }
  }

  return callHost("getContext", {
    advancedMode: this.state.advancedMode
  }).then(function (context) {
    var validIds = {}
    var preservedSelection = []
    var index

    self.state.projectName = context.projectName || ""
    self.state.sequenceName = context.sequenceName || ""
    self.state.selectedClips = context.selectedClips || []
    self.state.availableProperties = context.availableProperties || []
    self.state.warningText = context.warningText || ""

    for (index = 0; index < self.state.availableProperties.length; index += 1) {
      validIds[self.state.availableProperties[index].id] = true
    }

    for (index = 0; index < self.state.selectedPropertyIds.length; index += 1) {
      if (validIds[self.state.selectedPropertyIds[index]]) {
        preservedSelection.push(self.state.selectedPropertyIds[index])
      }
    }

    self.state.selectedPropertyIds = buildPreferredPropertySelection(self.state.availableProperties, preservedSelection)

    self.state.status = null
    return self.refreshDryRun()
  }).catch(function (error) {
    logger.warn("Context refresh failed", error)
    self.state.projectName = ""
    self.state.sequenceName = ""
    self.state.selectedClips = []
    self.state.availableProperties = []
    self.state.warningText = toUserMessage(error)
    self.state.dryRun = null
    self.renderAll()
    self.queueSave()
  })
}

CurvePilotApp.prototype.getSelectedDescriptors = function () {
  return filterSelectedProperties(this.state.availableProperties, this.state.selectedPropertyIds)
}

CurvePilotApp.prototype.refreshDryRun = function () {
  var self = this

  return previewCurveApplication({
    selectedPropertyIds: this.state.selectedPropertyIds,
    state: {
      curve: this.state.curve,
      advancedMode: this.state.advancedMode,
      applyMode: this.state.applyMode,
      customStartPercent: this.state.customStartPercent,
      customEndPercent: this.state.customEndPercent,
      sampleDensity: this.state.sampleDensity,
      customSampleCount: this.state.customSampleCount,
      interpolationMode: this.state.interpolationMode
    }
  }).then(function (dryRun) {
    self.state.dryRun = dryRun
    self.renderApplySection()
    self.renderAll()
    return dryRun
  }).catch(function (error) {
    self.state.dryRun = {
      error: toUserMessage(error)
    }
    self.renderApplySection()
    self.renderAll()
  })
}

CurvePilotApp.prototype.renderAll = function () {
  if (this.dom.versionPill) {
    this.dom.versionPill.textContent = this.state.hostInfo.appVersion + " · CEP " + this.state.hostInfo.cepVersion
  }
  this.views.presets.render(this.state.presets, this.state.selectedPresetId)
  this.renderApplySection()
}

CurvePilotApp.prototype.renderApplySection = function () {
  var dryRun = this.state.dryRun
  var html = []

  this.dom.applyMode.value = this.state.applyMode
  this.dom.customSpanFields.classList.toggle("cp-hidden", this.state.applyMode !== "customSpan")
  this.dom.startPercent.value = this.state.customStartPercent
  this.dom.endPercent.value = this.state.customEndPercent
  this.dom.sampleDensity.value = this.state.sampleDensity
  this.dom.customSampleCount.value = this.state.customSampleCount
  this.dom.customSampleCount.disabled = this.state.sampleDensity !== "custom"
  this.dom.interpolationMode.value = this.state.interpolationMode
  this.dom.overwriteAck.checked = this.state.overwriteAck

  if (!dryRun) {
    this.dom.dryRunPanel.innerHTML = '<p class="cp-note">Dry run data will appear once CurvePilot can inspect the current selection.</p>'
    return
  }

  if (dryRun.error) {
    this.dom.dryRunPanel.innerHTML = '<div class="cp-box error"><h4>Dry run unavailable</h4><p>' + dryRun.error + "</p></div>"
    return
  }

  html.push('<div class="cp-summary-grid">')
  html.push('<div class="cp-summary-stat"><strong>' + dryRun.clipsCount + '</strong><span>Selected clips</span></div>')
  html.push('<div class="cp-summary-stat"><strong>' + dryRun.sampleCount + '</strong><span>Keyframes per property</span></div>')
  html.push('<div class="cp-summary-stat"><strong>' + dryRun.estimatedAdds + '</strong><span>Estimated keys to write</span></div>')
  html.push('<div class="cp-summary-stat"><strong>' + dryRun.existingKeysInSpan + '</strong><span>Existing keys in span</span></div>')
  html.push("</div>")
  html.push('<div class="cp-divider"></div>')
  html.push('<div class="cp-box"><h4>Dry run summary</h4><p>Properties: ' + (dryRun.propertyLabels.length ? dryRun.propertyLabels.join(", ") : "None selected") + '.</p><p>Apply mode: ' + dryRun.applyModeLabel + ".</p></div>")

  if (dryRun.existingKeysInSpan > 0) {
    html.push('<div class="cp-divider"></div>')
    html.push('<div class="cp-box warning"><h4>' + (dryRun.denseWarning ? "Dense keyframe region detected" : "Existing keyframes will be replaced in span") + "</h4><p>CurvePilot preserves the span endpoint values, then rebuilds the span interior from your sampled curve.</p></div>")
  }

  if (dryRun.flatSpanWarning) {
    html.push('<div class="cp-divider"></div>')
    html.push('<div class="cp-box warning"><h4>No start/end value delta detected</h4><p>The selected span appears flat for at least one target property, so the sampled curve may not produce visible motion.</p></div>')
  }

  if (dryRun.autoCreatedEndpoints) {
    html.push('<div class="cp-divider"></div>')
    html.push('<div class="cp-box warning"><h4>Missing endpoint keys were auto-created</h4><p>CurvePilot fell back to the clip start and end because the selected property did not already have two endpoint keyframes.</p></div>')
  }

  this.dom.dryRunPanel.innerHTML = html.join("")
  this.dom.applyCurveButton.disabled = false
}

CurvePilotApp.prototype.renderStatus = function (status) {
  if (!status) {
    this.dom.statusPanel.innerHTML = ""
    return
  }

  this.dom.statusPanel.innerHTML = '<div class="cp-box ' + status.kind + '"><h4>' + status.title + "</h4><p>" + status.message + "</p></div>"
}

CurvePilotApp.prototype.selectPreset = function (presetId) {
  var self = this
  var preset = findById(this.state.presets, presetId)

  if (!preset) {
    return Promise.resolve()
  }

  this.state.selectedPresetId = preset.id
  this.state.applyMode = "endpointKeys"
  this.state.curve = sanitizeCurve(preset.curve)
  this.views.curveEditor.setCurve(this.state.curve)
  this.renderAll()
  this.queueSave()

  return this.refreshDryRun().then(function () {
    self.renderAll()
  })
}

CurvePilotApp.prototype.handleSavePreset = function () {
  var name = prompt("Name this custom curve preset:", "My Curve")
  var preset

  if (!name) {
    return
  }

  preset = buildCustomPreset(name, this.state.curve)
  this.state.customPresets.push(preset)
  this.state.presets = combinePresets(this.state.customPresets)
  this.state.selectedPresetId = preset.id
  this.state.status = {
    kind: "success",
    title: "Preset saved",
    message: '"' + preset.name + '" is now available in your custom preset list.'
  }
  this.renderAll()
  this.renderStatus(this.state.status)
  this.queueSave()
}

CurvePilotApp.prototype.handleRenamePreset = function () {
  var preset = findById(this.state.customPresets, this.state.selectedPresetId)
  var name

  if (!preset) {
    this.renderStatus({
      kind: "warning",
      title: "Pick a custom preset",
      message: "Only custom presets can be renamed."
    })
    return
  }

  name = prompt("Rename preset:", preset.name)
  if (!name) {
    return
  }

  preset.name = name.replace(/^\s+|\s+$/g, "") || preset.name
  this.state.presets = combinePresets(this.state.customPresets)
  this.renderAll()
  this.queueSave()
}

CurvePilotApp.prototype.handleDuplicatePreset = function () {
  var preset = findById(this.state.presets, this.state.selectedPresetId)
  var duplicate

  if (!preset) {
    return
  }

  duplicate = buildCustomPreset(preset.name + " Copy", preset.curve)
  this.state.customPresets.push(duplicate)
  this.state.presets = combinePresets(this.state.customPresets)
  this.state.selectedPresetId = duplicate.id
  this.renderAll()
  this.queueSave()
}

CurvePilotApp.prototype.handleDeletePreset = function () {
  var nextCustom = []
  var index
  var preset = findById(this.state.customPresets, this.state.selectedPresetId)

  if (!preset) {
    this.renderStatus({
      kind: "warning",
      title: "Nothing to delete",
      message: "Built-in presets stay available. Select a custom preset to remove it."
    })
    return
  }

  if (!confirm('Delete custom preset "' + preset.name + '"?')) {
    return
  }

  for (index = 0; index < this.state.customPresets.length; index += 1) {
    if (this.state.customPresets[index].id !== preset.id) {
      nextCustom.push(this.state.customPresets[index])
    }
  }

  this.state.customPresets = nextCustom
  this.state.presets = combinePresets(this.state.customPresets)
  this.state.selectedPresetId = BUILT_IN_PRESETS[3].id
  this.renderAll()
  this.queueSave()
}

CurvePilotApp.prototype.handleImportPresets = function () {
  var self = this

  importPresets().then(function (imported) {
    var index

    if (!imported.length) {
      return
    }

    for (index = 0; index < imported.length; index += 1) {
      self.state.customPresets.push(imported[index])
    }

    self.state.presets = combinePresets(self.state.customPresets)
    self.state.selectedPresetId = imported[0].id
    self.state.status = {
      kind: "success",
      title: "Presets imported",
      message: "Imported " + imported.length + " preset" + (imported.length === 1 ? "" : "s") + " into CurvePilot."
    }
    self.renderAll()
    self.renderStatus(self.state.status)
    self.queueSave()
  }).catch(function (error) {
    self.renderStatus({
      kind: "error",
      title: "Import failed",
      message: toUserMessage(error)
    })
  })
}

CurvePilotApp.prototype.handleExportPresets = function () {
  var self = this
  var source = this.state.customPresets.length ? this.state.customPresets : this.state.presets

  exportPresets(source).then(function (exportResult) {
    if (!exportResult || !exportResult.saved) {
      return
    }

    self.renderStatus({
      kind: "success",
      title: "Presets exported",
      message: "CurvePilot wrote the preset export to " + exportResult.path + "."
    })
  }).catch(function (error) {
    self.renderStatus({
      kind: "error",
      title: "Export failed",
      message: toUserMessage(error)
    })
  })
}

CurvePilotApp.prototype.applyCurve = function (progressMessage) {
  var self = this
  this.renderStatus({
    kind: "warning",
    title: "Checking selection",
    message: "Refreshing the current Premiere selection and keyframes..."
  })

  this.refreshContext().then(function () {
    var dryRun = self.state.dryRun

    if (!self.state.selectedClips.length) {
      self.renderStatus({
        kind: "warning",
        title: "No clips selected",
        message: "Select one or more video clips in Premiere, then click Apply again."
      })
      return
    }

    if (!self.getSelectedDescriptors().length) {
      self.renderStatus({
        kind: "warning",
        title: "No supported property",
        message: "CurvePilot could not find a shared supported keyframed property on the selected clips."
      })
      return
    }

    if (dryRun && dryRun.error) {
      self.renderStatus({
        kind: "warning",
        title: "Cannot apply yet",
        message: dryRun.error
      })
      return
    }

    if (dryRun && !dryRun.error && (dryRun.denseWarning || dryRun.existingKeysInSpan > 0)) {
      if (!confirm("CurvePilot will replace keyframes between the endpoints for the current span. Continue?")) {
        return
      }
    }

    self.renderStatus({
      kind: "warning",
      title: "Applying curve",
      message: progressMessage || "Sending the sampled easing job to Premiere..."
    })

    return applyCurveToSelection({
      selectedPropertyIds: self.state.selectedPropertyIds,
      state: {
        curve: self.state.curve,
        advancedMode: self.state.advancedMode,
        applyMode: self.state.applyMode,
        customStartPercent: self.state.customStartPercent,
        customEndPercent: self.state.customEndPercent,
        sampleDensity: self.state.sampleDensity,
        customSampleCount: self.state.customSampleCount,
        interpolationMode: self.state.interpolationMode
      }
    }).then(function (result) {
      self.renderStatus({
        kind: "success",
        title: "Curve applied",
        message: "Updated " + result.clipsChanged + " clip" + (result.clipsChanged === 1 ? "" : "s") + " across " + result.propertiesChanged + " target propert" + (result.propertiesChanged === 1 ? "y" : "ies") + "." + (result.autoCreatedEndpoints ? " CurvePilot auto-created missing endpoint keys." : "")
      })
      return self.refreshContext()
    }).catch(function (error) {
      var normalized = normalizeError(error)
      logger.error("Apply failed", normalized)
      self.renderStatus({
        kind: "error",
        title: "Apply failed",
        message: toUserMessage(normalized)
      })
    })
  })
}

CurvePilotApp.prototype.clearKeys = function () {
  var self = this

  this.renderStatus({
    kind: "warning",
    title: "Checking selection",
    message: "Refreshing the current Premiere selection and keyframes..."
  })

  this.refreshContext().then(function () {
    if (!self.state.selectedClips.length) {
      self.renderStatus({
        kind: "warning",
        title: "No clips selected",
        message: "Select one or more video clips in Premiere, then click Clear Keys again."
      })
      return
    }

    if (!self.getSelectedDescriptors().length) {
      self.renderStatus({
        kind: "warning",
        title: "No supported property",
        message: "CurvePilot could not find a shared supported keyframed property on the selected clips."
      })
      return
    }

    if (!confirm("Clear all keyframes for the targeted properties on the selected clips?")) {
      return
    }

    self.renderStatus({
      kind: "warning",
      title: "Clearing keyframes",
      message: "Removing keyframes from the selected clips..."
    })

    return clearKeysFromSelection({
      selectedPropertyIds: self.state.selectedPropertyIds,
      state: {
        advancedMode: self.state.advancedMode
      }
    }).then(function (result) {
      self.renderStatus({
        kind: "success",
        title: "Keyframes cleared",
        message: "Removed " + result.removedKeys + " keyframe" + (result.removedKeys === 1 ? "" : "s") + " across " + result.clipsChanged + " clip" + (result.clipsChanged === 1 ? "" : "s") + "."
      })
      return self.refreshContext()
    }).catch(function (error) {
      var normalized = normalizeError(error)
      logger.error("Clear keys failed", normalized)
      self.renderStatus({
        kind: "error",
        title: "Clear failed",
        message: toUserMessage(normalized)
      })
    })
  })
}

CurvePilotApp.prototype.queueSave = function () {
  var self = this

  clearTimeout(this.saveTimer)
  this.saveTimer = setTimeout(function () {
    try {
      self.persistState()
    } catch (error) {
      logger.warn("Persist failed", error)
    }
  }, 120)
}

CurvePilotApp.prototype.persistState = function () {
  saveState({
    customPresets: this.state.customPresets,
    lastSelectedPresetId: this.state.selectedPresetId,
    lastSettings: {
      curve: this.state.curve,
      advancedMode: this.state.advancedMode,
      applyMode: this.state.applyMode,
      customStartPercent: this.state.customStartPercent,
      customEndPercent: this.state.customEndPercent,
      sampleDensity: this.state.sampleDensity,
      customSampleCount: this.state.customSampleCount,
      interpolationMode: this.state.interpolationMode,
      selectedPropertyIds: this.state.selectedPropertyIds
    }
  })
}

function boot() {
  var rootNode = document.querySelector("#app")
  var app

  if (!rootNode) {
    return
  }

  app = new CurvePilotApp(rootNode)
  app.initialize().catch(function (error) {
    logger.error("Boot failed", error)
    rootNode.innerHTML = '<div class="cp-shell"><div class="cp-box error"><h4>CurvePilot failed to start</h4><p>' + toUserMessage(error) + "</p></div></div>"
  })
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot)
} else {
  boot()
}

    },
    "/src/ui/curve-editor.js": function (module, exports, require) {
var bezier = require("../easing/bezier")
var sampleCurve = require("../easing/sampler").sampleCurve
var math = require("../utils/math")
var sanitizeCurve = bezier.sanitizeCurve
var DEFAULT_CURVE = bezier.DEFAULT_CURVE
var clamp = math.clamp
var roundTo = math.roundTo

function CurveEditor(container, options) {
  options = options || {}
  this.container = container
  this.onChange = options.onChange || function () {}
  this.curve = sanitizeCurve(options.initialCurve || DEFAULT_CURVE)
  this.dragTarget = null
  this.resizeObserver = null
  this.stage = null
  this.canvas = null
  this.inputs = {}
  this._boundMouseDown = this.handleMouseDown.bind(this)
  this._boundMouseMove = this.handleMouseMove.bind(this)
  this._boundMouseUp = this.handleMouseUp.bind(this)
  this._boundTouchStart = this.handleTouchStart.bind(this)
  this._boundTouchMove = this.handleTouchMove.bind(this)
  this._boundTouchEnd = this.handleTouchEnd.bind(this)
  this._boundInputChange = this.handleInputChange.bind(this)
  this._boundResize = this.resize.bind(this)
  this._resizeTimer = null
}

CurveEditor.prototype.mount = function () {
  this.container.innerHTML = [
    '<div class="cp-curve-layout">',
    '  <div class="cp-curve-stage">',
    '    <canvas class="cp-curve-canvas" aria-label="Curve editor canvas"></canvas>',
    "  </div>",
    '  <div class="cp-hidden">',
    '    <div class="cp-form-grid cp-form-grid-compact">',
    '    <div class="cp-field"><label for="cp1x">Handle A X</label><input id="cp1x" data-handle="cp1" data-axis="x" type="number" min="0" max="1" step="0.001" /></div>',
    '    <div class="cp-field"><label for="cp1y">Handle A Y</label><input id="cp1y" data-handle="cp1" data-axis="y" type="number" min="-0.35" max="1.35" step="0.001" /></div>',
    '    <div class="cp-field"><label for="cp2x">Handle B X</label><input id="cp2x" data-handle="cp2" data-axis="x" type="number" min="0" max="1" step="0.001" /></div>',
    '    <div class="cp-field"><label for="cp2y">Handle B Y</label><input id="cp2y" data-handle="cp2" data-axis="y" type="number" min="-0.35" max="1.35" step="0.001" /></div>',
    "    </div>",
    "  </div>",
    "</div>"
  ].join("")

  this.stage = this.container.querySelector(".cp-curve-stage")
  this.canvas = this.container.querySelector(".cp-curve-canvas")
  this.inputs = {
    cp1x: this.container.querySelector("#cp1x"),
    cp1y: this.container.querySelector("#cp1y"),
    cp2x: this.container.querySelector("#cp2x"),
    cp2y: this.container.querySelector("#cp2y")
  }

  this.stage.addEventListener("mousedown", this._boundMouseDown)
  window.addEventListener("mousemove", this._boundMouseMove)
  window.addEventListener("mouseup", this._boundMouseUp)
  this.stage.addEventListener("touchstart", this._boundTouchStart, { passive: false })
  window.addEventListener("touchmove", this._boundTouchMove, { passive: false })
  window.addEventListener("touchend", this._boundTouchEnd)
  window.addEventListener("touchcancel", this._boundTouchEnd)

  this.inputs.cp1x.addEventListener("input", this._boundInputChange)
  this.inputs.cp1y.addEventListener("input", this._boundInputChange)
  this.inputs.cp2x.addEventListener("input", this._boundInputChange)
  this.inputs.cp2y.addEventListener("input", this._boundInputChange)

  window.addEventListener("resize", this._boundResize)

  this.syncInputs()
  this.scheduleResize()
}

CurveEditor.prototype.destroy = function () {
  if (this.resizeObserver) {
    this.resizeObserver.disconnect()
    this.resizeObserver = null
  }

  if (this.stage) {
    this.stage.removeEventListener("mousedown", this._boundMouseDown)
    this.stage.removeEventListener("touchstart", this._boundTouchStart)
  }

  window.removeEventListener("mousemove", this._boundMouseMove)
  window.removeEventListener("mouseup", this._boundMouseUp)
  window.removeEventListener("touchmove", this._boundTouchMove)
  window.removeEventListener("touchend", this._boundTouchEnd)
  window.removeEventListener("touchcancel", this._boundTouchEnd)
  window.removeEventListener("resize", this._boundResize)

  if (this._resizeTimer) {
    clearTimeout(this._resizeTimer)
    this._resizeTimer = null
  }
}

CurveEditor.prototype.getCurve = function () {
  return sanitizeCurve(this.curve)
}

CurveEditor.prototype.setCurve = function (curve, shouldNotify) {
  this.curve = sanitizeCurve(curve)
  this.syncInputs()
  this.draw()

  if (shouldNotify) {
    this.onChange(this.getCurve())
  }
}

CurveEditor.prototype.resize = function () {
  var rect
  var ratio
  var width
  var height

  if (!this.canvas || !this.stage) {
    return
  }

  rect = this.stage.getBoundingClientRect()
  ratio = window.devicePixelRatio || 1
  width = Math.max(240, Math.floor(rect.width))
  height = Math.max(240, Math.floor(Math.min(rect.width * 0.96, 310)))

  this.canvas.width = Math.floor(width * ratio)
  this.canvas.height = Math.floor(height * ratio)
  this.canvas.style.height = height + "px"
  this.draw()
}

CurveEditor.prototype.scheduleResize = function () {
  var self = this

  if (this._resizeTimer) {
    clearTimeout(this._resizeTimer)
  }

  this._resizeTimer = setTimeout(function () {
    self._resizeTimer = null
    self.resize()
  }, 0)
}

CurveEditor.prototype.draw = function () {
  var context = this.canvas.getContext("2d")
  var ratio
  var width
  var height
  var padding
  var step
  var x
  var y
  var start
  var end
  var handleA
  var handleB
  var samples
  var index
  var point

  if (!context) {
    return
  }

  ratio = window.devicePixelRatio || 1
  width = this.canvas.width / ratio
  height = this.canvas.height / ratio
  padding = 20

  context.setTransform(1, 0, 0, 1, 0, 0)
  context.scale(ratio, ratio)
  context.clearRect(0, 0, width, height)

  context.fillStyle = "#1a1a1a"
  context.fillRect(0, 0, width, height)

  context.strokeStyle = "rgba(255,255,255,0.04)"
  context.lineWidth = 1.5
  context.strokeRect(10, 10, width - 20, height - 20)

  context.strokeStyle = "rgba(255,255,255,0.075)"
  context.lineWidth = 1

  for (step = 0; step <= 4; step += 1) {
    x = padding + ((width - padding * 2) * step) / 4
    y = padding + ((height - padding * 2) * step) / 4
    context.beginPath()
    context.moveTo(x, padding)
    context.lineTo(x, height - padding)
    context.stroke()
    context.beginPath()
    context.moveTo(padding, y)
    context.lineTo(width - padding, y)
    context.stroke()
  }

  start = this.toCanvasPoint({ x: 0, y: 0 }, width, height, padding)
  end = this.toCanvasPoint({ x: 1, y: 1 }, width, height, padding)
  handleA = this.toCanvasPoint(this.curve.cp1, width, height, padding)
  handleB = this.toCanvasPoint(this.curve.cp2, width, height, padding)

  context.strokeStyle = "rgba(255,255,255,0.14)"
  context.setLineDash([5, 5])
  context.beginPath()
  context.moveTo(start.x, start.y)
  context.lineTo(handleA.x, handleA.y)
  context.moveTo(end.x, end.y)
  context.lineTo(handleB.x, handleB.y)
  context.stroke()
  context.setLineDash([])

  samples = sampleCurve(this.curve, 48)
  context.beginPath()
  for (index = 0; index < samples.length; index += 1) {
    point = this.toCanvasPoint(samples[index], width, height, padding)
    if (index === 0) {
      context.moveTo(point.x, point.y)
    } else {
      context.lineTo(point.x, point.y)
    }
  }
  context.lineWidth = 4
  context.strokeStyle = "rgba(255,255,255,0.7)"
  context.stroke()

  context.fillStyle = "rgba(255,255,255,0.22)"
  context.beginPath()
  context.arc(start.x, start.y, 5, 0, Math.PI * 2)
  context.arc(end.x, end.y, 5, 0, Math.PI * 2)
  context.fill()

  this.drawHandle(context, handleA, "#b8b8b8")
  this.drawHandle(context, handleB, "#b8b8b8")

  context.fillStyle = "rgba(255,255,255,0.34)"
  context.font = '11px "SF Mono", Menlo, monospace'
  context.fillText("0", padding - 8, height - padding + 16)
  context.fillText("1", width - padding - 4, height - padding + 16)
  context.fillText("1", padding - 16, padding + 4)
  context.fillText("0", padding - 16, height - padding + 4)
}

CurveEditor.prototype.drawHandle = function (context, point, color) {
  context.fillStyle = color
  context.beginPath()
  context.arc(point.x, point.y, 8, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = "#1a1a1a"
  context.lineWidth = 3
  context.stroke()
}

CurveEditor.prototype.toCanvasPoint = function (point, width, height, padding) {
  var yMin = -0.25
  var yMax = 1.25
  var yRange = yMax - yMin

  return {
    x: padding + point.x * (width - padding * 2),
    y: height - padding - ((point.y - yMin) / yRange) * (height - padding * 2)
  }
}

CurveEditor.prototype.toCurvePoint = function (clientX, clientY) {
  var rect = this.canvas.getBoundingClientRect()
  var padding = 22
  var x = clamp((clientX - rect.left - padding) / (rect.width - padding * 2), 0, 1)
  var y = clamp(1 - (clientY - rect.top - padding) / (rect.height - padding * 2), 0, 1)
  return { x: x, y: y }
}

CurveEditor.prototype.pickHandle = function (clientX, clientY) {
  var rect = this.canvas.getBoundingClientRect()
  var ratio = window.devicePixelRatio || 1
  var width = this.canvas.width / ratio
  var height = this.canvas.height / ratio
  var padding = 22
  var handleA = this.toCanvasPoint(this.curve.cp1, width, height, padding)
  var handleB = this.toCanvasPoint(this.curve.cp2, width, height, padding)
  var stagePoint = {
    x: clientX - rect.left,
    y: clientY - rect.top
  }
  var dxA = stagePoint.x - handleA.x
  var dyA = stagePoint.y - handleA.y
  var dxB = stagePoint.x - handleB.x
  var dyB = stagePoint.y - handleB.y
  var distanceA = Math.sqrt(dxA * dxA + dyA * dyA)
  var distanceB = Math.sqrt(dxB * dxB + dyB * dyB)

  if (distanceA < 18 || distanceB < 18) {
    return distanceA <= distanceB ? "cp1" : "cp2"
  }

  return null
}

CurveEditor.prototype.commitCurveChange = function () {
  this.syncInputs()
  this.draw()
  this.onChange(this.getCurve())
}

CurveEditor.prototype.syncInputs = function () {
  this.inputs.cp1x.value = roundTo(this.curve.cp1.x, 3)
  this.inputs.cp1y.value = roundTo(this.curve.cp1.y, 3)
  this.inputs.cp2x.value = roundTo(this.curve.cp2.x, 3)
  this.inputs.cp2y.value = roundTo(this.curve.cp2.y, 3)
}

CurveEditor.prototype.beginInteraction = function (clientX, clientY) {
  var point = this.toCurvePoint(clientX, clientY)

  this.dragTarget = this.pickHandle(clientX, clientY) || this.pickNearestHandle(point)
  this.curve[this.dragTarget] = point
  this.commitCurveChange()
}

CurveEditor.prototype.updateInteraction = function (clientX, clientY) {
  var point

  if (!this.dragTarget) {
    return
  }

  point = this.toCurvePoint(clientX, clientY)
  this.curve[this.dragTarget] = point
  this.commitCurveChange()
}

CurveEditor.prototype.endInteraction = function () {
  this.dragTarget = null
}

CurveEditor.prototype.handleMouseDown = function (event) {
  event.preventDefault()
  this.beginInteraction(event.clientX, event.clientY)
}

CurveEditor.prototype.handleMouseMove = function (event) {
  if (!this.dragTarget) {
    return
  }

  event.preventDefault()
  this.updateInteraction(event.clientX, event.clientY)
}

CurveEditor.prototype.handleMouseUp = function () {
  this.endInteraction()
}

CurveEditor.prototype.handleTouchStart = function (event) {
  var touch

  if (!event.touches || !event.touches.length) {
    return
  }

  touch = event.touches[0]
  event.preventDefault()
  this.beginInteraction(touch.clientX, touch.clientY)
}

CurveEditor.prototype.handleTouchMove = function (event) {
  var touch

  if (!this.dragTarget || !event.touches || !event.touches.length) {
    return
  }

  touch = event.touches[0]
  event.preventDefault()
  this.updateInteraction(touch.clientX, touch.clientY)
}

CurveEditor.prototype.handleTouchEnd = function () {
  this.endInteraction()
}

CurveEditor.prototype.handleInputChange = function (event) {
  var handle = event.target.dataset.handle
  var axis = event.target.dataset.axis
  var bounds = axis === "x" ? [0, 1] : [-0.35, 1.35]
  var value = clamp(Number(event.target.value), bounds[0], bounds[1])
  this.curve[handle][axis] = value
  this.commitCurveChange()
}

CurveEditor.prototype.pickNearestHandle = function (point) {
  var distanceA = Math.abs(point.x - this.curve.cp1.x) + Math.abs(point.y - this.curve.cp1.y)
  var distanceB = Math.abs(point.x - this.curve.cp2.x) + Math.abs(point.y - this.curve.cp2.y)

  return distanceA <= distanceB ? "cp1" : "cp2"
}

module.exports = {
  CurveEditor: CurveEditor
}

    },
    "/src/ui/preset-list.js": function (module, exports, require) {
function PresetListView(container, handlers) {
  this.container = container
  this.handlers = handlers
  this.handleClick = this.handleClick.bind(this)
}

PresetListView.prototype.mount = function () {
  this.container.innerHTML = [
    '<div class="cp-preset-groups">',
    '  <div class="cp-preset-group">',
    '    <div class="cp-row-label">Built-In Presets</div>',
    '    <div class="cp-preset-grid" data-builtin-grid></div>',
    "  </div>",
    '  <div class="cp-divider"></div>',
    '  <div class="cp-preset-group">',
    '    <div class="cp-row-label">My Presets</div>',
    '    <div class="cp-preset-grid" data-custom-grid></div>',
    '    <p class="cp-note" data-empty-state>No saved presets yet.</p>',
    "  </div>",
    "</div>"
  ].join("")

  this.container.addEventListener("click", this.handleClick)
}

PresetListView.prototype.render = function (presets, selectedPresetId) {
  var builtinGrid = this.container.querySelector("[data-builtin-grid]")
  var customGrid = this.container.querySelector("[data-custom-grid]")
  var emptyState = this.container.querySelector("[data-empty-state]")
  var builtIn = []
  var custom = []
  var index
  var html

  for (index = 0; index < presets.length; index += 1) {
    if (presets[index].builtIn) {
      builtIn.push(presets[index])
    } else {
      custom.push(presets[index])
    }
  }

  html = []
  for (index = 0; index < builtIn.length; index += 1) {
    html.push(this.renderButton(builtIn[index], selectedPresetId))
  }
  builtinGrid.innerHTML = html.join("")

  html = []
  for (index = 0; index < custom.length; index += 1) {
    html.push(this.renderButton(custom[index], selectedPresetId))
  }
  customGrid.innerHTML = html.join("")

  emptyState.classList.toggle("cp-hidden", custom.length > 0)
}

PresetListView.prototype.renderButton = function (preset, selectedPresetId) {
  var selected = preset.id === selectedPresetId ? "is-selected" : ""
  return [
    '<button type="button" class="cp-preset-button ',
    selected,
    '" data-preset-id="',
    preset.id,
    '">',
    preset.name,
    "</button>"
  ].join("")
}

PresetListView.prototype.handleClick = function (event) {
  var presetButton = event.target.closest("[data-preset-id]")
  var actionButton
  var action

  if (presetButton) {
    this.handlers.onSelect(presetButton.dataset.presetId)
    return
  }

  actionButton = event.target.closest("[data-action]")
  if (!actionButton) {
    return
  }

  action = actionButton.dataset.action
  if (action === "save-current") {
    this.handlers.onSaveCurrent()
  } else if (action === "delete") {
    this.handlers.onDelete()
  }
}

module.exports = {
  PresetListView: PresetListView
}

    },
    "/src/ui/preview.js": function (module, exports, require) {
var evaluateBezier = require("../easing/bezier").evaluateBezier

function PreviewView(container) {
  this.container = container
  this.canvas = null
  this.curve = null
  this.timer = null
  this.startedAt = Date.now()
  this._boundResize = this.resize.bind(this)
  this._boundDraw = this.draw.bind(this)
}

PreviewView.prototype.mount = function () {
  this.container.innerHTML = [
    '<div class="cp-mini-stage">',
    '  <canvas class="cp-preview-canvas" aria-label="Curve preview"></canvas>',
    "</div>"
  ].join("")

  this.canvas = this.container.querySelector(".cp-preview-canvas")

  window.addEventListener("resize", this._boundResize)

  this.resize()
  this.timer = setInterval(this._boundDraw, 33)
}

PreviewView.prototype.destroy = function () {
  window.removeEventListener("resize", this._boundResize)
  if (this.timer) {
    clearInterval(this.timer)
  }
}

PreviewView.prototype.setCurve = function (curve) {
  this.curve = curve
  this.draw()
}

PreviewView.prototype.resize = function () {
  var rect = this.container.getBoundingClientRect()
  var ratio = window.devicePixelRatio || 1
  var width = Math.max(260, Math.floor(rect.width))
  var height = 72

  this.canvas.width = Math.floor(width * ratio)
  this.canvas.height = Math.floor(height * ratio)
  this.canvas.style.height = height + "px"
  this.draw()
}

PreviewView.prototype.draw = function () {
  var context
  var ratio
  var width
  var height
  var elapsed
  var travel
  var eased
  var padding
  var trackY

  if (!this.canvas || !this.curve) {
    return
  }

  context = this.canvas.getContext("2d")
  ratio = window.devicePixelRatio || 1
  width = this.canvas.width / ratio
  height = this.canvas.height / ratio
  elapsed = ((Date.now() - this.startedAt) % 1800) / 1800
  travel = elapsed < 0.92 ? elapsed / 0.92 : 1
  eased = evaluateBezier(this.curve, travel)
  padding = 16
  trackY = height / 2

  context.setTransform(1, 0, 0, 1, 0, 0)
  context.scale(ratio, ratio)
  context.clearRect(0, 0, width, height)

  context.fillStyle = "#1b1b1b"
  context.fillRect(0, 0, width, height)

  context.strokeStyle = "rgba(255,255,255,0.08)"
  context.lineWidth = 8
  context.lineCap = "round"
  context.beginPath()
  context.moveTo(padding, trackY)
  context.lineTo(width - padding, trackY)
  context.stroke()

  context.strokeStyle = "rgba(255,255,255,0.44)"
  context.beginPath()
  context.moveTo(padding, trackY)
  context.lineTo(padding + (width - padding * 2) * eased, trackY)
  context.stroke()

  context.fillStyle = "rgba(255,255,255,0.72)"
  context.beginPath()
  context.arc(padding + (width - padding * 2) * eased, trackY, 7, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = "rgba(255,255,255,0.42)"
  context.font = '11px "SF Mono", Menlo, monospace'
  context.fillText("Preview", padding, 15)
  context.fillText("0", padding, height - 12)
  context.fillText("1", width - padding - 8, height - 12)
}

module.exports = {
  PreviewView: PreviewView
}

    },
    "/src/ui/property-picker.js": function (module, exports, require) {
function PropertyPickerView(container, handlers) {
  this.container = container
  this.handlers = handlers
  this.handleChange = this.handleChange.bind(this)
  this.handleClick = this.handleClick.bind(this)
}

PropertyPickerView.prototype.mount = function () {
  this.container.innerHTML = [
    '<div class="cp-stack">',
    '  <div class="cp-inline-grid cp-inline-grid-compact">',
    '    <div class="cp-box">',
    '      <div class="cp-row-label">Project</div>',
    '      <strong data-project-name>Waiting for Premiere...</strong>',
    '      <p class="cp-note" data-sequence-name></p>',
    "    </div>",
    '    <div class="cp-box">',
    '      <div class="cp-row-label">Clips</div>',
    '      <strong data-selection-count>0 clips</strong>',
    '      <p class="cp-note" data-selection-note>Select clips.</p>',
    "    </div>",
    "  </div>",
    '  <div class="cp-row">',
    "    <div>",
    '      <div class="cp-row-label">Properties</div>',
    '      <p class="cp-note">Pick what the preset should rebuild.</p>',
    "    </div>",
    '    <div style="display:flex; gap:8px; align-items:center;">',
    '      <label class="cp-note" style="display:flex; gap:6px; align-items:center;">',
    '        <input type="checkbox" data-advanced-toggle />',
    "        Adv",
    "      </label>",
    '      <button type="button" data-refresh class="cp-pill-button">Refresh</button>',
    "    </div>",
    "  </div>",
    '  <div class="cp-property-grid" data-property-grid></div>',
    '  <div class="cp-box warning cp-hidden" data-warning-box>',
    "    <h4>Selection warning</h4>",
    "    <p data-warning-text></p>",
    "  </div>",
    "</div>"
  ].join("")

  this.container.addEventListener("change", this.handleChange)
  this.container.addEventListener("click", this.handleClick)
}

PropertyPickerView.prototype.render = function (data) {
  var sequenceText = data.sequenceName ? "Sequence: " + data.sequenceName : "Open a sequence in Premiere."
  var countLabel = data.selectedClips.length + " clip" + (data.selectedClips.length === 1 ? "" : "s")
  var note = "Select one or more video clips in the timeline."
  var clipNames = []
  var grid = this.container.querySelector("[data-property-grid]")
  var warningBox = this.container.querySelector("[data-warning-box]")
  var warningText = this.container.querySelector("[data-warning-text]")
  var html = []
  var i
  var property
  var checked

  this.container.querySelector("[data-project-name]").textContent = data.projectName || "No active project"
  this.container.querySelector("[data-sequence-name]").textContent = sequenceText
  this.container.querySelector("[data-selection-count]").textContent = countLabel

  if (data.selectedClips.length) {
    for (i = 0; i < data.selectedClips.length && i < 3; i += 1) {
      clipNames.push(data.selectedClips[i].name)
    }
    note = clipNames.join(", ") + (data.selectedClips.length > 3 ? "..." : "")
  }

  this.container.querySelector("[data-selection-note]").textContent = note
  this.container.querySelector("[data-advanced-toggle]").checked = !!data.advancedMode

  if (data.properties.length) {
    for (i = 0; i < data.properties.length; i += 1) {
      property = data.properties[i]
      checked = data.selectedPropertyIds.indexOf(property.id) !== -1 ? "checked" : ""
      html.push([
        '<label class="cp-property-option">',
        '  <input type="checkbox" value="', property.id, '" ', checked, " />",
        "  <div>",
        "    <strong>", property.label, "</strong>",
        "    <span>", property.group, " · ", property.kind === "point" ? "2D value" : "scalar value", "</span>",
        "  </div>",
        "</label>"
      ].join(""))
    }
    grid.innerHTML = html.join("")
  } else {
    grid.innerHTML = [
      '<div class="cp-box">',
      "  <h4>No shared keyframe-safe properties found</h4>",
      "  <p>Select supported video clips, then refresh. Motion Position, Scale, Rotation, and Opacity are the default targets.</p>",
      "</div>"
    ].join("")
  }

  warningBox.classList.toggle("cp-hidden", !data.warningText)
  warningText.textContent = data.warningText || ""
}

PropertyPickerView.prototype.handleChange = function (event) {
  var checkboxes
  var values
  var i

  if (event.target.matches("[data-advanced-toggle]")) {
    this.handlers.onToggleAdvanced(event.target.checked)
    return
  }

  if (event.target.matches('input[type="checkbox"][value]')) {
    checkboxes = this.container.querySelectorAll('input[type="checkbox"][value]:checked')
    values = []

    for (i = 0; i < checkboxes.length; i += 1) {
      values.push(checkboxes[i].value)
    }

    this.handlers.onSelectionChange(values)
  }
}

PropertyPickerView.prototype.handleClick = function (event) {
  if (event.target.closest("[data-refresh]")) {
    this.handlers.onRefresh()
  }
}

module.exports = {
  PropertyPickerView: PropertyPickerView
}

    },
    "/src/utils/errors.js": function (module, exports, require) {
function AppError(message, options) {
  options = options || {}
  this.name = "AppError"
  this.message = message
  this.code = options.code || "APP_ERROR"
  this.hint = options.hint || ""
  this.details = options.details
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, AppError)
  } else {
    this.stack = new Error(message).stack
  }
}

AppError.prototype = Object.create(Error.prototype)
AppError.prototype.constructor = AppError

function normalizeError(error, fallbackMessage) {
  var message

  fallbackMessage = fallbackMessage || "Something went wrong."

  if (error instanceof AppError) {
    return error
  }

  message = error && error.message ? error.message : fallbackMessage
  return new AppError(message, {
    details: error
  })
}

function toUserMessage(error) {
  var normalized = normalizeError(error)
  return normalized.hint ? normalized.message + " " + normalized.hint : normalized.message
}

module.exports = {
  AppError: AppError,
  normalizeError: normalizeError,
  toUserMessage: toUserMessage
}

    },
    "/src/utils/logger.js": function (module, exports, require) {
function prefix(namespace, argsLike) {
  var output = ["[CurvePilot:" + namespace + "]"]
  var index

  for (index = 0; index < argsLike.length; index += 1) {
    output.push(argsLike[index])
  }

  return output
}

function createLogger(namespace) {
  return {
    info: function () {
      console.log.apply(console, prefix(namespace, arguments))
    },
    warn: function () {
      console.warn.apply(console, prefix(namespace, arguments))
    },
    error: function () {
      console.error.apply(console, prefix(namespace, arguments))
    }
  }
}

module.exports = {
  createLogger: createLogger
}

    },
    "/src/utils/math.js": function (module, exports, require) {
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

    }
  };
  var CACHE = {};

  function normalizePath(input) {
    return input.replace(/\\/g, "/");
  }

  function dirname(input) {
    var normalized = normalizePath(input);
    var lastSlash = normalized.lastIndexOf("/");
    return lastSlash <= 0 ? "/" : normalized.slice(0, lastSlash);
  }

  function resolvePath(fromId, request) {
    if (request.charAt(0) !== ".") {
      return request;
    }

    var baseParts = dirname(fromId).split("/");
    var requestParts = normalizePath(request).split('/');
    var index;

    for (index = 0; index < requestParts.length; index += 1) {
      var part = requestParts[index];
      if (!part || part === ".") {
        continue;
      }
      if (part === "..") {
        if (baseParts.length > 1) {
          baseParts.pop();
        }
      } else {
        baseParts.push(part);
      }
    }

    var resolved = baseParts.join('/');

    if (resolved.slice(-3) !== ".js") {
      if (MODULES[resolved + ".js"]) {
        resolved += ".js";
      } else if (MODULES[resolved + "/index.js"]) {
        resolved += "/index.js";
      }
    }

    return resolved;
  }

  function localRequire(fromId, request) {
    return executeModule(resolvePath(fromId, request));
  }

  function executeModule(moduleId) {
    var factory = MODULES[moduleId];
    var module;

    if (!factory) {
      throw new Error("CurvePilot bundle could not resolve module: " + moduleId);
    }

    if (CACHE[moduleId]) {
      return CACHE[moduleId].exports;
    }

    module = { exports: {} };
    CACHE[moduleId] = module;
    factory(module, module.exports, function (request) {
      return localRequire(moduleId, request);
    });
    return module.exports;
  }

  function showBootError(message) {
    var root = document.getElementById('app');
    if (!root) {
      return;
    }
    root.innerHTML = '' +
      '<div class="cp-shell">' +
      '  <div class="cp-box error">' +
      '    <h4>CurvePilot boot error</h4>' +
      '    <p>The panel loaded, but the bundled CEP app failed during startup.</p>' +
      '    <pre class="cp-code cp-small" style="white-space:pre-wrap; margin:10px 0 0;">' +
      String(message).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
      '    </pre>' +
      '  </div>' +
      '</div>';
  }

  function shouldIgnoreError(message) {
    var text = String(message || '');
    return text.indexOf('ResizeObserver loop limit exceeded') !== -1 || text.indexOf('ResizeObserver loop completed with undelivered notifications') !== -1;
  }

  window.addEventListener('error', function (event) {
    var message;
    if (event && event.error) {
      message = event.error.stack || event.error.message || String(event.error);
      if (shouldIgnoreError(message)) {
        if (typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        return;
      }
      showBootError(message);
      return;
    }
    if (event && event.message) {
      if (shouldIgnoreError(event.message)) {
        if (typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        return;
      }
      showBootError(event.message);
    }
  });

  try {
    executeModule('/src/main.js');
  } catch (error) {
    showBootError(error && error.stack ? error.stack : String(error));
  }
})();
