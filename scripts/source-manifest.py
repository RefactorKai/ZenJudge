"""Produce a local, source-only publication review list. Never uploads anything."""
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
ROOT_FILES = {
    '.gitignore', '.gitattributes', 'package.json', 'package-lock.json', 'index.html',
    'tsconfig.json', 'vite.config.ts', 'tailwind.config.js', 'postcss.config.js',
    'README.md', 'CONTRIBUTING.md', 'SECURITY.md',
    'LICENSE', 'COPYING', 'THIRD_PARTY_NOTICES.md',
}
DIRECTORIES = ('src', 'docs', 'scripts', '.github', 'assets/brand',
               'problems/demo-signal-sum', 'problems/demo-quiet-run', 'problems/demo-rising-steps',
               'src-tauri/src', 'src-tauri/tests', 'src-tauri/icons', 'src-tauri/capabilities')
EXTENSIONS = {'.rs', '.ts', '.tsx', '.css', '.json', '.md', '.py', '.mjs', '.png', '.ico', '.icns', '.svg', '.bin', '.yml', '.yaml'}
SECRET = re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}|sk-(?:proj-)?[A-Za-z0-9_-]{32,})')


def candidates():
    files = [ROOT / name for name in ROOT_FILES if (ROOT / name).is_file()]
    files += [ROOT / 'src-tauri' / name for name in ('Cargo.toml', 'Cargo.lock', 'build.rs', 'tauri.conf.json', '.taurignore')]
    for name in DIRECTORIES:
        folder = ROOT / name
        if not folder.exists():
            continue
        # Explicit traversal refuses links before descending, including junctions.
        pending = [folder]
        while pending:
            path = pending.pop()
            if path.is_symlink() or path.is_junction():
                raise ValueError(f'Publication path is a link: {path.relative_to(ROOT)}')
            if path.is_dir():
                pending.extend(p for p in path.iterdir() if p.name not in ('__pycache__', 'node_modules', 'target', 'dist'))
            elif path.suffix in EXTENSIONS:
                files.append(path)
    return sorted(set(files))


def manifest():
    records = []
    for path in candidates():
        if path.is_symlink() or path.is_junction():
            raise ValueError(f'Publication file is a link: {path.name}')
        data = path.read_bytes()
        if SECRET.search(data):
            raise ValueError(f'Possible secret in publication file: {path.relative_to(ROOT)}')
        records.append({'path': path.relative_to(ROOT).as_posix(), 'bytes': len(data),
                        'sha256': hashlib.sha256(data).hexdigest()})
    return records


if __name__ == '__main__':
    records = manifest()
    assert all(not re.search(r'(^|/)(data|node_modules|target|dist|private|\.audit-work)/|\.(db|sqlite)', r['path']) for r in records)
    output = ROOT / '.audit-work' / 'publication-manifest.json'
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(records, indent=2) + '\n', encoding='utf-8')
    print(f'{len(records)} source/content files; heuristic secret scan passed. Review {output}. No export or upload performed.')
