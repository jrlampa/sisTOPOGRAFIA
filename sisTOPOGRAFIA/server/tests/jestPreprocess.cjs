/**
 * Jest transform that strips `const __filename` / `const __dirname` computed from
 * `import.meta.url` and transforms top-level `await import()` calls before
 * ts-jest processes the file.
 *
 * In Jest's CommonJS environment:
 * - `__filename`/`__dirname` are already injected by the CJS module wrapper
 * - top-level `await` is not allowed
 */
'use strict';

const { TsJestTransformer } = require('ts-jest');

const base = new TsJestTransformer();

function patchSource(sourceText) {
    return sourceText
        // Strip ESM-only __filename/__dirname declarations (conflict with CJS globals)
        .replace(/const\s+__filename\s*=\s*fileURLToPath\s*\(\s*import\.meta\.url\s*\)\s*;?\r?\n?/g, '')
        .replace(/const\s+__dirname\s*=\s*path\.dirname\s*\(\s*__filename\s*\)\s*;?\r?\n?/g, '')
        // Transform top-level `await import('pkg')` to `require('pkg')`
        // Pattern: (await import('pkg')).default  => require('pkg')
        .replace(/\(\s*await\s+import\s*\(\s*(['"`][^'"` ]+['"`])\s*\)\s*\)\.default/g, 'require($1)')
        // Pattern: await import('pkg')  => require('pkg') (without .default)
        .replace(/await\s+import\s*\(\s*(['"`][^'"` ]+['"`])\s*\)/g, 'require($1)');
}

module.exports = {
    process(sourceText, sourcePath, options) {
        return base.process(patchSource(sourceText), sourcePath, options);
    },
    getCacheKey(sourceText, sourcePath, options) {
        return base.getCacheKey(patchSource(sourceText), sourcePath, options);
    }
};
