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
