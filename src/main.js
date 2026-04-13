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
