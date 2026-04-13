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
