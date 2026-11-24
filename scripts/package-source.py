"""Create a clean, reproducible source archive without caches, live API samples or pairing tokens."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parent.parent
version=json.loads((root/'package.json').read_text(encoding='utf8'))['version']
target = root / 'release' / f'SimRail-Hub-Zdroje-{version}.zip'
directories = {'src', 'tests', 'public', 'build', '.github', 'docs', 'scripts', 'site'}
files = {'package.json', 'package-lock.json', 'README.md', 'LICENSE', '.gitignore', '.firebaserc', 'firebase.json', 'firestore.rules', 'firestore.indexes.json', 'tsconfig.json', 'tsconfig.node.json', 'vite.config.mts', 'vitest.config.mts'}
scripts = {'bundle-preload.mjs', 'prepare-assets.mjs', 'verify-ui.mjs', 'verify-mobile.mjs', 'verify-package.mjs', 'verify-tts.py', 'package-source.py', 'wiki-assets.py', 'import-wiki-media.py', 'verify-wiki-ui.mjs', 'verify-fixes.mjs', 'verify-release-audio.mjs'}
target.parent.mkdir(exist_ok=True)
with ZipFile(target, 'w', ZIP_DEFLATED, compresslevel=6) as archive:
    sources = [root / name for name in files]
    for directory in directories:
        sources.extend((root / directory).rglob('*'))
    for source in sorted(sources):
        relative = source.relative_to(root)
        if relative.parts[0] not in directories and str(relative) not in files:
            continue
        if not source.is_file() or 'api-samples' in relative.parts or 'recording' in relative.parts or '__pycache__' in relative.parts:
            continue
        if relative.parts[0] == 'scripts' and source.name not in scripts:
            continue
        archive.write(source, 'simrail-hub/' + relative.as_posix())
print(target.name, target.stat().st_size, 'bytes')
