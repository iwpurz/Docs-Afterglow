#!/usr/bin/env python3
"""Package release/ as dist/docs-afterglow-<version>.xpi."""
import json
import os
import zipfile

project = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(project, 'release')
with open(os.path.join(root, 'manifest.json'), encoding='utf-8') as manifest_file:
    version = json.load(manifest_file)['version']
out_dir = os.path.join(root, 'dist')
os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, f'docs-afterglow-{version}.xpi')
skip_dirs = {'dist', '.git', 'node_modules', 'tests'}
count = 0

with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
    for base, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d not in skip_dirs and not d.startswith('.'))
        for filename in sorted(files):
            if filename.startswith('.') or filename.lower().endswith(('.py', '.pyc', '.xpi', '.zip')):
                continue
            path = os.path.join(base, filename)
            archive.write(path, os.path.relpath(path, root))
            count += 1

print(f'{count} files -> {out}')
