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
