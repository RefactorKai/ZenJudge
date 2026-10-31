// Exercise the real App controller with lightweight child views and synthetic IPC.
// A fresh headless-browser profile keeps real drafts/settings and Tauri data untouched.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const work = path.resolve('.audit-work', `editor-${Date.now()}`);
await mkdir(work, { recursive: true });
const views = {
  Dashboard: `export const Dashboard = p => <button id="open" onClick={() => p.onOpenProblem('two-sum')}>Open</button>;`,
  Header: `export const Header = p => <select id="problem" value={p.currentSlug} onChange={e => p.onSelectProblem(e.target.value)}><option>two-sum</option><option>coin-change</option></select>;`,
  EditorPane: `export const EditorPane = p => <><textarea id="code" value={p.code} disabled={p.isLocked} onChange={e => p.setCode(e.target.value)} /><select id="language" value={p.language} onChange={e => p.setLanguage(e.target.value)}><option>cpp</option><option>python</option></select></>;`,
  ProblemPane: `export const ProblemPane = p => <><span id="title">{p.problemDetail?.meta.title}</span><button id="restore" onClick={() => p.onSelectSubmissionCode('history python', 'python')}>Restore</button></>;`,
  ConsolePane: `export const ConsolePane = () => null;`,
  LockInModal: `export const LockInModal = () => null; export const EmergencyAbortOverlay = () => null;`,
};
const test = `
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './src/App.tsx';
(async () => {
const root = createRoot(document.getElementById('root'));
const wait = () => new Promise(r => setTimeout(r, 0));
const check = (value, message) => { if (!value) throw new Error(message); };
const el = id => document.getElementById(id);
const change = async (id, value) => { await act(async () => {
  const node = el(id);
  const prototype = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLSelectElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, value);
  node.dispatchEvent(new Event(node instanceof HTMLTextAreaElement ? 'input' : 'change', { bubbles: true }));
  await wait();
}); };
try {
  await act(async () => { root.render(<App />); await wait(); });
  await act(async () => { el('open').click(); await wait(); });
  check(el('code').value === 'two-sum cpp template', 'initial template');
  await change('code', 'unsaved cpp');
  window.delay = true;
  await act(async () => { el('restore').click(); await wait(); });
  await act(async () => { window.pending.shift().resolve(); await wait(); });
  check(el('code').value === 'history python', 'template overwrote historical Python source');
  window.delay = false;
  await change('language', 'cpp');
  check(el('code').value === 'unsaved cpp', 'language switch lost unsaved draft');
  window.delay = true;
  await change('problem', 'coin-change');
  await change('problem', 'two-sum');
  check(window.pending.length === 2, 'expected two independently delayed requests');
  await act(async () => { window.pending.pop().resolve(); await wait(); });
  await act(async () => { window.pending.pop().resolve(); await wait(); });
  check(el('title').textContent === 'two-sum', 'stale problem response won race');
  check(el('code').value === 'unsaved cpp', 'stale template overwrote draft');
  check(localStorage.getItem('zenjudge_draft_two-sum:cpp') === 'unsaved cpp', 'draft not persisted');
  await act(async () => { root.unmount(); });
  window.delay = false;
  const fresh = createRoot(document.getElementById('root'));
  await act(async () => { fresh.render(<App />); await wait(); });
  await act(async () => { el('open').click(); await wait(); });
  check(el('code').value === 'unsaved cpp', 'remount did not restore persisted draft');
  document.getElementById('result').textContent = 'EDITOR_REGRESSIONS_PASSED';
} catch (error) {
  document.getElementById('result').textContent = 'EDITOR_REGRESSIONS_FAILED: ' + error.stack;
}
})();
`;
const result = await build({ stdin: { contents: test, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'synthetic-child-views-and-ipc', setup(build) {
    build.onResolve({ filter: /components\// }, args => {
      const name = args.path.split('/').pop();
      return name in views ? { path: name, namespace: 'test-view' } : undefined;
    });
    build.onLoad({ filter: /.*/, namespace: 'test-view' }, args => ({ contents: `import React from 'react'; ${views[args.path]}`, loader: 'jsx', resolveDir: process.cwd() }));
    build.onResolve({ filter: /^@tauri-apps\/api\// }, args => ({ path: args.path, namespace: 'test-ipc' }));
    build.onLoad({ filter: /.*/, namespace: 'test-ipc' }, () => ({ contents: `export const invoke = (...args) => window.testInvoke(...args); export const listen = async () => () => {};` }));
  } }] });
const bootstrap = `
window.IS_REACT_ACT_ENVIRONMENT = true;
window.__TAURI_INTERNALS__ = {};
window.pending = []; window.delay = false;
const detail = slug => ({ meta: { title: slug, slug, templates: { cpp: slug+' cpp template', python: slug+' python template' } }, sample_testcases: [], statement_markdown: '' });
window.testInvoke = async (cmd, args) => {
  if (cmd === 'get_problem') {
    if (window.delay) return new Promise(resolve => window.pending.push({ resolve: () => resolve(detail(args.slug)) }));
    return detail(args.slug);
  }
  if (cmd === 'get_lock_in_status') return { is_active: false, problem_slug: null, strikes: 0 };
  if (cmd === 'get_user_progress') return null;
  if (cmd === 'get_problems_metadata') return [{ slug: 'two-sum' }];
  return [];
};`;
const html = path.join(work, 'test.html');
await writeFile(html, `<html><body><pre id="result">PENDING</pre><div id="root"></div><script>${bootstrap}</script><script>${result.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`);
const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert(browser, 'A local Chrome or Edge is required for the controller regression');
const { stdout } = await promisify(execFile)(browser, ['--headless=new', '--disable-gpu', '--no-first-run',
  '--no-default-browser-check', '--disable-background-networking', '--disable-component-update',
  '--host-resolver-rules=MAP * ~NOTFOUND', `--user-data-dir=${path.join(work, 'profile')}`,
  '--virtual-time-budget=10000', '--dump-dom', pathToFileURL(html).href], { timeout: 45000, maxBuffer: 10 * 1024 * 1024 });
await writeFile(path.join(work, 'result.html'), stdout);
const status = stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
assert.equal(status, 'EDITOR_REGRESSIONS_PASSED', status || 'Harness did not finish');
console.log('App controller: history restore, per-language drafts, stale-response race, persistence and remount checks passed. Synthetic IPC and child views; no real database or settings used.');
