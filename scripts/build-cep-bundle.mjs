import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src");
const outputPath = path.join(projectRoot, "js", "app.bundle.js");

function toPosixPath(inputPath) {
  return inputPath.split(path.sep).join("/");
}

function collectModules(directoryPath) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const modules = [];

  entries.forEach((entry) => {
    const fullPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      modules.push(...collectModules(fullPath));
      return;
    }

    if (entry.isFile() && entry.name.endsWith(".js")) {
      modules.push(fullPath);
    }
  });

  return modules.sort();
}

function createBundle(modules) {
  const moduleBlocks = modules.map((filePath) => {
    const moduleId = "/" + toPosixPath(path.relative(projectRoot, filePath));
    const source = fs.readFileSync(filePath, "utf8");
    return `    ${JSON.stringify(moduleId)}: function (module, exports, require) {\n${source}\n    }`;
  });

  return [
    "(function () {",
    "  var MODULES = {",
    moduleBlocks.join(",\n"),
    "  };",
    "  var CACHE = {};",
    "",
    "  function normalizePath(input) {",
    '    return input.replace(/\\\\/g, "/");',
    "  }",
    "",
    "  function dirname(input) {",
    "    var normalized = normalizePath(input);",
    '    var lastSlash = normalized.lastIndexOf("/");',
    '    return lastSlash <= 0 ? "/" : normalized.slice(0, lastSlash);',
    "  }",
    "",
    "  function resolvePath(fromId, request) {",
    '    if (request.charAt(0) !== ".") {',
    "      return request;",
    "    }",
    "",
    '    var baseParts = dirname(fromId).split("/");',
    "    var requestParts = normalizePath(request).split('/');",
    "    var index;",
    "",
    "    for (index = 0; index < requestParts.length; index += 1) {",
    "      var part = requestParts[index];",
    '      if (!part || part === ".") {',
    "        continue;",
    "      }",
    '      if (part === "..") {',
    "        if (baseParts.length > 1) {",
    "          baseParts.pop();",
    "        }",
    "      } else {",
    "        baseParts.push(part);",
    "      }",
    "    }",
    "",
    "    var resolved = baseParts.join('/');",
    "",
    '    if (resolved.slice(-3) !== ".js") {',
    '      if (MODULES[resolved + ".js"]) {',
    '        resolved += ".js";',
    '      } else if (MODULES[resolved + "/index.js"]) {',
    '        resolved += "/index.js";',
    "      }",
    "    }",
    "",
    "    return resolved;",
    "  }",
    "",
    "  function localRequire(fromId, request) {",
    "    return executeModule(resolvePath(fromId, request));",
    "  }",
    "",
    "  function executeModule(moduleId) {",
    "    var factory = MODULES[moduleId];",
    "    var module;",
    "",
    "    if (!factory) {",
    '      throw new Error("CurvePilot bundle could not resolve module: " + moduleId);',
    "    }",
    "",
    "    if (CACHE[moduleId]) {",
    "      return CACHE[moduleId].exports;",
    "    }",
    "",
    "    module = { exports: {} };",
    "    CACHE[moduleId] = module;",
    "    factory(module, module.exports, function (request) {",
    "      return localRequire(moduleId, request);",
    "    });",
    "    return module.exports;",
    "  }",
    "",
    "  function showBootError(message) {",
    "    var root = document.getElementById('app');",
    "    if (!root) {",
    "      return;",
    "    }",
    "    root.innerHTML = '' +",
    "      '<div class=\"cp-shell\">' +",
    "      '  <div class=\"cp-box error\">' +",
    "      '    <h4>CurvePilot boot error</h4>' +",
    "      '    <p>The panel loaded, but the bundled CEP app failed during startup.</p>' +",
    "      '    <pre class=\"cp-code cp-small\" style=\"white-space:pre-wrap; margin:10px 0 0;\">' +",
    "      String(message).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +",
    "      '    </pre>' +",
    "      '  </div>' +",
    "      '</div>';",
    "  }",
    "",
    "  function shouldIgnoreError(message) {",
    "    var text = String(message || '');",
    "    return text.indexOf('ResizeObserver loop limit exceeded') !== -1 || text.indexOf('ResizeObserver loop completed with undelivered notifications') !== -1;",
    "  }",
    "",
    "  window.addEventListener('error', function (event) {",
    "    var message;",
    "    if (event && event.error) {",
    "      message = event.error.stack || event.error.message || String(event.error);",
    "      if (shouldIgnoreError(message)) {",
    "        if (typeof event.preventDefault === 'function') {",
    "          event.preventDefault();",
    "        }",
    "        return;",
    "      }",
    "      showBootError(message);",
    "      return;",
    "    }",
    "    if (event && event.message) {",
    "      if (shouldIgnoreError(event.message)) {",
    "        if (typeof event.preventDefault === 'function') {",
    "          event.preventDefault();",
    "        }",
    "        return;",
    "      }",
    "      showBootError(event.message);",
    "    }",
    "  });",
    "",
    "  try {",
    "    executeModule('/src/main.js');",
    "  } catch (error) {",
    "    showBootError(error && error.stack ? error.stack : String(error));",
    "  }",
    "})();",
    ""
  ].join("\n");
}

const modules = collectModules(sourceRoot);
const bundle = createBundle(modules);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, bundle, "utf8");

console.log(`Bundled ${modules.length} modules into ${outputPath}`);
