(function () {
  function CSInterface() {}

  CSInterface.prototype.evalScript = function (script, callback) {
    if (window.__adobe_cep__ && typeof window.__adobe_cep__.evalScript === "function") {
      window.__adobe_cep__.evalScript(script, callback || function () {})
      return
    }

    if (typeof callback === "function") {
      callback("EvalScript error.")
    }
  }

  CSInterface.prototype.getHostEnvironment = function () {
    if (!window.__adobe_cep__ || typeof window.__adobe_cep__.getHostEnvironment !== "function") {
      return null
    }

    var environment = window.__adobe_cep__.getHostEnvironment()
    if (typeof environment === "string") {
      try {
        return JSON.parse(environment)
      } catch (error) {
        return null
      }
    }

    return environment
  }

  window.CSInterface = CSInterface
})()
