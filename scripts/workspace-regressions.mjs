// Run after the disposable Vite build. Real App/Monaco, synthetic native IPC only.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { promisify } from 'node:util';

const dist = path.resolve('.audit-work/frontend-dist');
assert(existsSync(path.join(dist, 'index.html')), 'Build .audit-work/frontend-dist first');
const work = path.resolve('.audit-work', `workspace-${Date.now()}`);
await mkdir(work, { recursive: true });
const meta = JSON.parse(await readFile('problems/demo-signal-sum/meta.json', 'utf8'));
const detail = { meta, statement_markdown: await readFile('problems/demo-signal-sum/statement.md', 'utf8'),
  sample_testcases: JSON.parse(await readFile('problems/demo-signal-sum/testcases.json', 'utf8')).filter(c => c.is_sample) };
const bootstrap = `
window.test = { calls: [], errors: [], violations: [], workers: [], callbacks: {}, listeners: {},
  failNote: true, deferJobs: false, pendingJobs: [], notes: 'saved note' };
window.addEventListener('error', e => test.errors.push(String(e.message)));
window.addEventListener('unhandledrejection', e => test.errors.push(String(e.reason)));
window.addEventListener('securitypolicyviolation', e => test.violations.push(e.violatedDirective + ':' + e.blockedURI));
const NativeWorker = window.Worker;
window.Worker = class extends NativeWorker { constructor(url, opts) { test.workers.push(String(url)); super(url, opts); } };
window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
window.__TAURI_INTERNALS__ = {
  transformCallback: callback => { const id = Object.keys(test.callbacks).length + 1; test.callbacks[id] = callback; return id; },
  invoke: async (cmd, args) => {
    test.calls.push({ cmd, args });
    if (cmd === 'get_problems_metadata') return [${JSON.stringify({ ...meta, status: 'unsolved', best_runtime_ms: null, total_submissions: 0, is_bookmarked: false, is_redo: false })}];
    if (cmd === 'get_problem') return ${JSON.stringify(detail)};
    if (cmd === 'get_user_progress') return { total_problems: 1, solved_count: 0, attempted_count: 0, current_streak_days: 0, total_submissions: 1 };
    if (cmd === 'get_lock_in_status') return { is_active: false, problem_slug: null, strikes: 0 };
    if (cmd === 'get_submissions') return [{ id: 1, timestamp: '2026-10-31T00:00:00Z', problem_slug: 'demo-signal-sum', language: 'python', verdict: 'Accepted (AC)', runtime_ms: 1, memory_kb: 1, code: 'print(1)', notes: test.notes }];
    if (cmd === 'get_breaches') return [];
    if (cmd === 'plugin:event|listen') { test.listeners[args.event] = args.handler; return args.handler; }
    if (cmd === 'update_submission_notes') {
      if (test.failNote) { test.failNote = false; throw 'synthetic storage unavailable'; }
      test.notes = args.notes; return;
    }
    if (cmd === 'run_sample_code' || cmd === 'submit_code') {
      if (test.deferJobs) return new Promise((_, reject) => test.pendingJobs.push(() => reject('synthetic execution unavailable')));
      throw 'synthetic execution unavailable';
    }
    return null;
  }
};`;
const flow = `
(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const until = async predicate => { for (let i = 0; i < 200; i++) { if (predicate()) return; await wait(50); } throw Error('Timed out: ' + predicate); };
  const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.includes(text));
  const calls = cmd => test.calls.filter(c => c.cmd === cmd);
  const noteInput = () => document.querySelector('textarea[placeholder^="Write Markdown"]');
  const hotkey = (key, code, number) => {
    const area = document.querySelector('.monaco-editor textarea'); area.focus();
    for (const type of ['keydown', 'keyup']) area.dispatchEvent(new KeyboardEvent(type, { key, code, keyCode: number, which: number, ctrlKey: true, bubbles: true, cancelable: true }));
  };
  try {
    await until(() => [...document.querySelectorAll('span')].some(s => s.textContent === 'Signal Sum'));
    [...document.querySelectorAll('span')].find(s => s.textContent === 'Signal Sum').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await until(() => document.querySelector('.monaco-editor textarea') && button('Run Samples') && !button('Run Samples').disabled);
    const language = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'python'));
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(language, 'python');
    language.dispatchEvent(new Event('change', { bubbles: true }));
    await until(() => !button('Run Samples').disabled && language.value === 'python');
    button('Run Samples').click();
    await until(() => calls('run_sample_code').length === 1 && !button('Run Samples').disabled);
    const clicked = calls('run_sample_code')[0].args;
    check(clicked.code === ${JSON.stringify(meta.templates.python)}, 'Language switch ran the previous template');
    hotkey('Enter', 'Enter', 13);
    await until(() => calls('submit_code').length === 1 && !button('Run Samples').disabled);
    hotkey("'", 'Quote', 222);
    await until(() => calls('run_sample_code').length === 2 && !button('Run Samples').disabled);
    for (const { args } of [...calls('submit_code'), ...calls('run_sample_code')]) {
      check(args.lang === 'python' && args.code === clicked.code, 'Hotkey sent stale language/source');
    }
    test.deferJobs = true;
    hotkey('Enter', 'Enter', 13);
    await until(() => calls('submit_code').length === 2 && button('Run Samples').disabled);
    hotkey('Enter', 'Enter', 13); hotkey("'", 'Quote', 222); await wait(100);
    check(calls('submit_code').length === 2 && calls('run_sample_code').length === 2, 'Busy hotkeys admitted another job');
    test.pendingJobs.pop()(); test.deferJobs = false;
    await until(() => !button('Run Samples').disabled);

    button('Submissions').click(); await until(() => button('Edit Notes'));
    button('Edit Notes').click(); await until(noteInput);
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(noteInput(), 'UNSAVED_SYNTHETIC_NOTE');
    noteInput().dispatchEvent(new Event('input', { bubbles: true })); await wait(50);
    button('Save Note').click(); await until(() => calls('update_submission_notes').length === 1); await wait(100);
    check(noteInput()?.value === 'UNSAVED_SYNTHETIC_NOTE', 'Failed save closed the editor or lost the draft');
    check(test.notes === 'saved note', 'Failed save changed stored notes');
    check(document.querySelector('[role="alert"]')?.textContent.includes('NOT saved'), 'Save failure was not visible');
    button('Save Note').click(); await until(() => calls('update_submission_notes').length === 2 && !noteInput());
    check(test.notes === 'UNSAVED_SYNTHETIC_NOTE', 'Retry did not save the retained draft');
    check(![...document.querySelectorAll('[role="alert"]')].some(el => el.textContent.includes('Notes were NOT saved:')), 'Successful retry left a stale failure warning');

    const strike = test.listeners['zenjudge://strike-event']; check(strike, 'Strike listener missing');
    test.callbacks[strike]({ payload: { strikes: 1, problem_slug: 'demo-signal-sum' } });
    await until(() => button('Run Samples').disabled);
    hotkey('Enter', 'Enter', 13); hotkey("'", 'Quote', 222); await wait(100);
    check(calls('submit_code').length === 2 && calls('run_sample_code').length === 2, 'Locked hotkeys admitted a job');
    check(test.workers.length > 0 && test.workers.every(url => new URL(url, location.href).origin === location.origin), 'Monaco worker was not local');
    check(test.violations.length === 0, 'Production CSP violation: ' + test.violations);
    check(test.errors.length === 0, 'Uncaught UI errors: ' + test.errors);
    const pre = document.createElement('pre'); pre.id = 'workspace-result'; pre.textContent = 'WORKSPACE_REGRESSIONS_PASSED'; document.body.append(pre);
  } catch (error) {
    const pre = document.createElement('pre'); pre.id = 'workspace-result';
    pre.textContent = 'FAILED: ' + error.stack + '\\n' + JSON.stringify(test.calls.filter(c => c.cmd === 'run_sample_code' || c.cmd === 'submit_code').map(c => ({ cmd: c.cmd, lang: c.args.lang, codePreview: c.args.code.slice(0, 80) })));
    document.body.append(pre);
  }
})();`;

const csp = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8')).app.security.csp;
const mime = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('Content-Security-Policy', csp);
    if (url.pathname === '/__bootstrap.js' || url.pathname === '/__flow.js') {
      response.setHeader('Content-Type', 'application/javascript');
      response.end(url.pathname === '/__bootstrap.js' ? bootstrap : flow);
      return;
    }
    const file = path.resolve(dist, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(dist + path.sep)) { response.writeHead(403); response.end(); return; }
    let data = await readFile(file);
    response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    if (path.extname(file) === '.html') data = Buffer.from(data.toString().replace('<head>', '<head><script src="/__bootstrap.js"></script><script defer src="/__flow.js"></script>'));
    response.end(data);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
  assert(browser, 'A local Chrome or Edge is required');
  const { stdout } = await promisify(execFile)(browser, ['--headless=new', '--disable-gpu', '--no-first-run',
    '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--no-proxy-server',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', `--user-data-dir=${path.join(work, 'profile')}`,
    '--virtual-time-budget=15000', '--dump-dom', `http://127.0.0.1:${server.address().port}/`],
  { timeout: 45000, maxBuffer: 15 * 1024 * 1024 });
  await writeFile(path.join(work, 'result.html'), stdout);
  const status = stdout.match(/<pre id="workspace-result">([\s\S]*?)<\/pre>/)?.[1];
  assert.equal(status, 'WORKSPACE_REGRESSIONS_PASSED', status || 'Harness did not finish');
  console.log('Real App/Monaco: current hotkey source, busy/lock guards, failed note retention/retry, and local-worker/CSP checks passed. Synthetic IPC; no live data used.');
} finally { server.close(); }
