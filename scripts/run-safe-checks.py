"""Run Rust checks with bounded wall time and disposable storage, never the live DB."""
from pathlib import Path
import os
import subprocess
import time

root = Path(__file__).resolve().parent.parent
work = root / '.audit-work'
temporary = work / f'test-temp-{time.time_ns()}'
temporary.mkdir(parents=True)
env = dict(os.environ, CARGO_TARGET_DIR=str(work / 'target'), TEMP=str(temporary), TMP=str(temporary))
checks = [
    ('rust-tests', ['cargo', 'test', '--manifest-path', 'src-tauri/Cargo.toml', '--locked', '--offline', '--', '--test-threads=1']),
    ('clippy', ['cargo', 'clippy', '--manifest-path', 'src-tauri/Cargo.toml', '--locked', '--offline', '--all-targets', '--', '-D', 'warnings']),
    ('format', ['cargo', 'fmt', '--manifest-path', 'src-tauri/Cargo.toml', '--all', '--', '--check']),
]
failed = False
for name, command in checks:
    log = work / f'{name}.log'
    with log.open('w', encoding='utf-8') as output:
        try:
            result = subprocess.run(command, cwd=root, env=env, stdout=output, stderr=subprocess.STDOUT, timeout=240, check=False)
            code = result.returncode
        except subprocess.TimeoutExpired:
            code = 124
    print(f'{name}: exit {code}; {log}', flush=True)
    failed |= code != 0
raise SystemExit(1 if failed else 0)
