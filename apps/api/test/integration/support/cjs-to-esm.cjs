// A Jest transform that wraps a CommonJS file in an ES module.
//
// @nestjs/throttler is CommonJS and require()s @nestjs/common, which is ES
// modules only. Node runs that natively, but Jest's module system cannot
// require() an ES module before Node 24.9. Wrapped like this, the throttler
// imports the same @nestjs/common instance as the app (one Reflector, one
// HttpException), and Jest loads it as an ES module.
const { createRequire } = require('node:module');
const { dirname } = require('node:path');

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

module.exports = {
  process(source, filename) {
    const requireFrom = createRequire(filename);
    const specifiers = [
      ...new Set([...source.matchAll(/\brequire\("([^"]+)"\)/g)].map((match) => match[1])),
    ];
    // Node itself can load the file, which gives its export names.
    const names = Object.keys(requireFrom(filename)).filter(
      (name) => IDENTIFIER.test(name) && name !== 'default',
    );

    const imports = [];
    const deps = [];
    specifiers.forEach((specifier, index) => {
      const local = specifier.startsWith('.');
      const target = local
        ? requireFrom.resolve(specifier, { paths: [dirname(filename)] })
        : specifier;
      imports.push(`import * as __dep${index} from ${JSON.stringify(target)};`);
      // Wrapped siblings export their module.exports as default.
      deps.push(
        `${JSON.stringify(specifier)}: ${local ? `__dep${index}.default` : `__dep${index}`}`,
      );
    });

    const code = [
      ...imports,
      `const __deps = { ${deps.join(', ')} };`,
      'const __module = { exports: {} };',
      '(function (exports, require, module) {',
      source,
      '}).call(undefined, __module.exports, (id) => {',
      '  if (!(id in __deps)) throw new Error(`Unexpected require: ${id}`);',
      '  return __deps[id];',
      '}, __module);',
      'export default __module.exports;',
      ...names.map((name) => `export const ${name} = __module.exports.${name};`),
    ].join('\n');
    return { code };
  },
};
