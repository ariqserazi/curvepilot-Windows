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
