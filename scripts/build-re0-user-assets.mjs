import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const extensionRoot = path.join(projectRoot, 'public/scripts/extensions/third-party/re0-adventure-engine');
const userRoot = path.join(extensionRoot, 'assets/user');
const webRoot = '/scripts/extensions/third-party/re0-adventure-engine/assets/user';
const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function scanAssetDir(kind) {
    const dir = path.join(userRoot, kind);
    ensureDir(dir);
    const entries = {};
    for (const file of fs.readdirSync(dir)) {
        const ext = path.extname(file).toLowerCase();
        if (!allowed.has(ext)) {
            continue;
        }
        const id = path.basename(file, ext).trim();
        if (!id) {
            continue;
        }
        entries[id] = `${webRoot}/${kind}/${encodeURIComponent(file)}`;
    }
    return entries;
}

ensureDir(userRoot);
const manifest = {
    generatedAt: new Date().toISOString(),
    note: 'User-provided local override assets. Put files under assets/user/avatars or assets/user/scenes and rerun scripts/build-re0-user-assets.mjs.',
    avatars: scanAssetDir('avatars'),
    scenes: scanAssetDir('scenes'),
};

fs.writeFileSync(path.join(userRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Re0 user asset manifest written: ${Object.keys(manifest.avatars).length} avatars, ${Object.keys(manifest.scenes).length} scenes`);
