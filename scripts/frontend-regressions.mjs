import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

await mkdir('.audit-work', { recursive: true });
const output = path.resolve('.audit-work/markdown-regression.mjs');
await build({ entryPoints: ['src/components/MarkdownRenderer.tsx'], outfile: output,
  bundle: true, platform: 'node', format: 'esm', packages: 'external',
  plugins: [{ name: 'omit-css-in-ssr', setup(build) {
    build.onResolve({ filter: /\.css$/ }, () => ({ path: 'styles', namespace: 'empty-css' }));
    build.onLoad({ filter: /.*/, namespace: 'empty-css' }, () => ({ contents: '', loader: 'js' }));
  } }] });
const { MarkdownRenderer } = await import(pathToFileURL(output).href);
const render = content => renderToStaticMarkup(React.createElement(MarkdownRenderer, { content }));
const remote = render('![canary](https://example.invalid/canary.png) [remote](https://example.invalid/) <script>alert(1)</script> [bad](javascript:alert(1))');
assert(!remote.includes('<img'));
assert(!remote.includes('<a '));
assert(!remote.includes('<script'));
assert(!remote.includes('https://example.invalid'));
const math = render('Inline $x^2$ and $\\frac{a}{b}$.');
assert(math.includes('katex'));
assert(math.includes('<math'));
const untrusted = render('$\\href{https://example.invalid/}{remote}$ $\\includegraphics{https://example.invalid/x.png}$');
assert(!untrusted.includes('<a '));
assert(!untrusted.includes('<img'));
const config = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8'));
assert(config.app.security.csp.includes("object-src 'none'"));
assert(!config.app.security.csp.includes('https:'));
assert.equal(config.bundle.resources['../problems/'], 'problems/');
console.log('Markdown remote media/navigation, untrusted math, local math rendering, CSP and resource configuration checks passed. No network requests made.');
