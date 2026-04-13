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
