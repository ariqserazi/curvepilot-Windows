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
