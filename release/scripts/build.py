#!/usr/bin/env python3
"""Zip the extension into dist/docs-afterglow-<version>.xpi (no other build step)."""
import json, os, zipfile, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
version = json.load(open(os.path.join(root, 'manifest.json')))['version']
skip_dirs = {'dist', 'scripts', '.git', 'node_modules', 'tests'}
out_dir = os.path.join(root, 'dist'); os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, f'docs-afterglow-{version}.xpi')
count = 0
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for base, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d not in skip_dirs and not d.startswith('.'))
        for f in sorted(files):
            if f.startswith('.') or f.endswith(('.xpi', '.zip')): continue
            p = os.path.join(base, f); z.write(p, os.path.relpath(p, root)); count += 1
print(f'{count} files -> {out}')
