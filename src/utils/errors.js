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
