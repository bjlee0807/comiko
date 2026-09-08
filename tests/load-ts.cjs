const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const cache = new Map();
module.exports = function load(file) {
  const filename = path.resolve(file);
  if (cache.has(filename)) return cache.get(filename);
  const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
  const normalRequire = m.require.bind(m);
  m.require = key => key.startsWith('./') ? load(path.resolve(path.dirname(filename), key + '.ts')) : normalRequire(key);
  m._compile(ts.transpile(fs.readFileSync(filename, 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }), filename);
  cache.set(filename, m.exports); return m.exports;
};
