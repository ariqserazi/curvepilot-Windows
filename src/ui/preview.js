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
