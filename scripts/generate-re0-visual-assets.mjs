import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STORYLINE_DEFAULTS } from '../public/scripts/extensions/third-party/re0-adventure-engine/data/storyline-defaults.js';

const require = createRequire(import.meta.url);
const Jimp = require('../node_modules/sillytavern-transformers/node_modules/jimp');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const assetRoot = path.join(projectRoot, 'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated');
const avatarDir = path.join(assetRoot, 'avatars');
const sceneDir = path.join(assetRoot, 'scenes');

const scenes = [
    ['rain_bell', ['#080b12', '#23121c', '#4b0f16', '#94a3b8'], 'rain'],
    ['loot_house', ['#120c08', '#4a1d12', '#7c2d12', '#fbbf24'], 'candle'],
    ['royal_capital', ['#111827', '#334155', '#b45309', '#dbeafe'], 'city'],
    ['archive', ['#0f172a', '#312e27', '#66512c', '#e5e7eb'], 'archive'],
    ['mansion', ['#101827', '#34243d', '#6d28d9', '#f8fafc'], 'mansion'],
    ['sanctuary', ['#071711', '#14532d', '#4d7c0f', '#d9f99d'], 'forest'],
    ['priestella', ['#082f49', '#0e7490', '#155e75', '#f0f9ff'], 'water'],
    ['vollachia', ['#1c1007', '#7f1d1d', '#b45309', '#fed7aa'], 'empire'],
    ['snowfield', ['#020617', '#164e63', '#bae6fd', '#f8fafc'], 'snow'],
    ['witch_dream', ['#03020a', '#1e1b4b', '#581c87', '#e9d5ff'], 'dream'],
].map(([key, colors, mood]) => ({ key, colors, mood }));

const coreProfiles = [
    ['narrator', '命运旁白'], ['protagonist', '无名异乡人'], ['lishelle', '莉榭尔·阿尔戈'],
    ['owen', '欧文·卡斯兰'], ['bellringer', '剥钟人'], ['mia', '米娅'],
];

const C = (r, g, b, a = 255) => Jimp.rgbaToInt(r, g, b, a) >>> 0;
const hexInt = (hex, alpha = 255) => ((parseInt(String(hex).replace('#', ''), 16) << 8) + alpha) >>> 0;

function hash(value) {
    let h = 2166136261;
    for (const ch of String(value)) {
        h ^= ch.charCodeAt(0);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function hexRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function blend(c1, c2, t, alpha = 255) {
    const a = hexRgb(c1);
    const b = hexRgb(c2);
    return C(
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t),
        alpha,
    );
}

function setPixelSafe(image, x, y, color) {
    if (x >= 0 && y >= 0 && x < image.bitmap.width && y < image.bitmap.height) {
        image.setPixelColor(color >>> 0, x, y);
    }
}

function fillRect(image, x0, y0, x1, y1, color) {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(image.bitmap.height, Math.ceil(y1)); y++) {
        for (let x = Math.max(0, Math.floor(x0)); x < Math.min(image.bitmap.width, Math.ceil(x1)); x++) {
            image.setPixelColor(color >>> 0, x, y);
        }
    }
}

function fillEllipse(image, cx, cy, rx, ry, color) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const dx = (x - cx) / rx;
            const dy = (y - cy) / ry;
            if (dx * dx + dy * dy <= 1) setPixelSafe(image, x, y, color);
        }
    }
}

function drawLine(image, x0, y0, x1, y1, color, width = 1) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = Math.round(x0);
    let y = Math.round(y0);
    while (true) {
        for (let oy = -width; oy <= width; oy++) for (let ox = -width; ox <= width; ox++) setPixelSafe(image, x + ox, y + oy, color);
        if (x === Math.round(x1) && y === Math.round(y1)) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 < dx) { err += dx; y += sy; }
    }
}

function addNoise(image, amount, seed) {
    let h = seed >>> 0;
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
        h = Math.imul(h ^ (x * 374761393 + y * 668265263), 2246822519) >>> 0;
        const n = ((h & 255) - 128) * amount;
        this.bitmap.data[idx] = Math.max(0, Math.min(255, this.bitmap.data[idx] + n));
        this.bitmap.data[idx + 1] = Math.max(0, Math.min(255, this.bitmap.data[idx + 1] + n));
        this.bitmap.data[idx + 2] = Math.max(0, Math.min(255, this.bitmap.data[idx + 2] + n));
    });
}

async function makeScene({ key, colors, mood }) {
    const w = 1280;
    const h = 720;
    const image = new Jimp(w, h, hexInt(colors[0]));
    for (let y = 0; y < h; y++) {
        const t = y / h;
        for (let x = 0; x < w; x++) {
            const radial = Math.hypot((x - w * 0.28) / w, (y - h * 0.18) / h);
            image.setPixelColor(blend(colors[0], radial < 0.32 ? colors[3] : colors[1], Math.min(1, t * 0.75 + radial * 0.9)), x, y);
        }
    }
    const dark = C(3, 7, 18, 180);
    const accent = hexInt(colors[2], 170);
    if (mood === 'rain') {
        for (let i = 0; i < 130; i++) drawLine(image, (i * 97) % w, 0, ((i * 97) % w) - 90, h, C(180, 210, 230, 65), 1);
        fillRect(image, 820, 160, 910, 620, dark); fillEllipse(image, 865, 145, 70, 22, dark); fillRect(image, 0, 540, w, 720, C(5, 8, 13, 190));
    } else if (mood === 'candle') {
        fillRect(image, 60, 440, 1220, 610, C(35, 18, 8, 210));
        for (let i = 0; i < 12; i++) fillRect(image, 80 + i * 92, 390 - (i % 3) * 30, 160 + i * 92, 580, C(76, 29, 18, 150));
        fillEllipse(image, 900, 330, 170, 90, C(251, 191, 36, 58));
    } else if (mood === 'city') {
        for (let i = 0; i < 12; i++) fillRect(image, i * 120, 280 - (i % 4) * 35, i * 120 + 150, 630, C(20 + i * 4, 30 + i * 2, 45, 160));
        drawLine(image, 0, 590, w, 430, C(210, 190, 145, 100), 2); drawLine(image, 0, 650, w, 500, C(210, 190, 145, 75), 2);
    } else if (mood === 'archive') {
        for (let i = 0; i < 8; i++) fillRect(image, 80 + i * 145, 90, 150 + i * 145, 650, C(49, 46, 39, 185));
        for (let i = 0; i < 38; i++) fillRect(image, 90 + (i % 8) * 145, 120 + Math.floor(i / 8) * 80, 140 + (i % 8) * 145, 145 + Math.floor(i / 8) * 80, C(180, 150, 95, 110));
    } else if (mood === 'mansion') {
        for (let i = 0; i < 9; i++) drawLine(image, 160 + i * 120, 90, 80 + i * 140, 660, C(190, 170, 220, 70), 3);
        fillRect(image, 500, 110, 780, 650, C(18, 24, 39, 175)); fillEllipse(image, 640, 110, 180, 38, C(196, 160, 255, 55));
    } else if (mood === 'forest') {
        for (let i = 0; i < 40; i++) drawLine(image, (i * 83) % w, 80, ((i * 83) % w) - 60, 720, C(4, 36, 24, 135), 3);
        fillRect(image, 490, 330, 790, 650, C(35, 48, 38, 160)); fillEllipse(image, 640, 310, 190, 42, C(210, 250, 170, 60));
    } else if (mood === 'water') {
        for (let y = 470; y < 720; y += 15) drawLine(image, 0, y, w, y - 20, C(190, 240, 255, 60), 1);
        for (let i = 0; i < 6; i++) fillRect(image, 110 + i * 185, 240 - (i % 2) * 35, 210 + i * 185, 530, C(8, 47, 73, 150));
        drawLine(image, 0, 510, w, 380, C(240, 249, 255, 80), 3);
    } else if (mood === 'empire') {
        fillRect(image, 0, 505, w, 720, C(100, 43, 14, 190));
        for (let i = 0; i < 8; i++) { fillRect(image, 120 + i * 140, 210, 128 + i * 140, 500, C(20, 12, 7, 190)); drawLine(image, 128 + i * 140, 225, 210 + i * 140, 250, accent, 3); }
    } else if (mood === 'snow') {
        fillRect(image, 0, 500, w, 720, C(230, 248, 255, 145));
        for (let i = 0; i < 120; i++) fillEllipse(image, (i * 67) % w, (i * 131) % h, 2 + (i % 3), 2 + (i % 3), C(248, 250, 252, 170));
        fillRect(image, 840, 260, 1000, 520, C(8, 35, 50, 110));
    } else if (mood === 'dream') {
        for (let i = 0; i < 11; i++) { fillEllipse(image, 160 + i * 110, 200 + ((i * 61) % 260), 65, 24, C(220, 190, 255, 38)); drawLine(image, 160 + i * 110, 180, 240 + i * 90, 600, C(235, 210, 255, 45), 2); }
        fillEllipse(image, 640, 360, 210, 210, C(10, 5, 25, 125));
    }
    addNoise(image, 0.08, hash(key));
    await image.quality(92).writeAsync(path.join(sceneDir, `${key}.jpg`));
}

async function makeAvatar(id) {
    const seed = hash(id);
    const image = new Jimp(512, 512, C(10, 12, 18));
    const c1 = `#${((seed & 0xffffff) | 0x202020).toString(16).slice(-6)}`;
    const c2 = `#${(((seed >>> 8) & 0xffffff) | 0x404040).toString(16).slice(-6)}`;
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) image.setPixelColor(blend(c1, c2, (x * 0.55 + y * 0.75) / 1024), x, y);
    for (let i = 0; i < 18; i++) fillEllipse(image, (seed * (i + 3) + i * 73) % 512, (seed >>> (i % 16)) % 512, 42 + (i % 5) * 15, 12 + (i % 4) * 7, C(255, 255, 255, 18 + (i % 5) * 4));
    const skin = [C(238, 203, 172), C(220, 180, 145), C(205, 166, 132)][seed % 3];
    const hair = [C(25, 25, 35), C(92, 64, 45), C(202, 205, 215), C(114, 45, 70), C(34, 83, 70)][(seed >>> 3) % 5];
    const cloth = [C(38, 38, 50), C(60, 20, 30), C(25, 60, 85), C(80, 65, 20)][(seed >>> 6) % 4];
    fillEllipse(image, 256, 610, 190, 210, cloth);
    fillEllipse(image, 256, 255, 118, 145, skin);
    fillEllipse(image, 256, 165, 130, 75, hair);
    for (let i = 0; i < 18; i++) drawLine(image, 150 + i * 13, 155 + (i % 3) * 4, 118 + i * 15, 288 + ((seed >>> (i % 12)) % 38), hair, 4);
    fillEllipse(image, 214, 255, 12, 8, C(22, 25, 35)); fillEllipse(image, 298, 255, 12, 8, C(22, 25, 35));
    fillEllipse(image, 217, 252, 4, 3, C(255, 255, 255, 220)); fillEllipse(image, 301, 252, 4, 3, C(255, 255, 255, 220));
    drawLine(image, 225, 330, 287, 330 + ((seed % 3) - 1) * 10, C(95, 45, 50, 210), 2);
    fillEllipse(image, 256, 410, 132, 30, C(5, 7, 12, 88)); fillRect(image, 0, 420, 512, 512, C(4, 6, 12, 70));
    addNoise(image, 0.045, seed ^ 0xa5a5a5a5);
    await image.quality(92).writeAsync(path.join(avatarDir, `${id}.jpg`));
}

async function main() {
    await mkdir(sceneDir, { recursive: true });
    await mkdir(avatarDir, { recursive: true });
    for (const scene of scenes) await makeScene(scene);
    const profiles = new Map(coreProfiles);
    for (const dossier of Object.values(STORYLINE_DEFAULTS.characterDossiers || {})) if (dossier?.id) profiles.set(dossier.id, dossier.name || dossier.id);
    for (const id of [...profiles.keys()].sort()) await makeAvatar(id);
    await writeFile(path.join(assetRoot, 'manifest.json'), JSON.stringify({
        generatedAt: new Date().toISOString(),
        scenes: scenes.map((scene) => `${scene.key}.jpg`),
        avatars: [...profiles.keys()].sort().map((id) => `${id}.jpg`),
        note: 'Procedurally generated Re:0 style visual novel assets; replace same filenames with higher fidelity AI/manual art anytime.',
    }, null, 2));
    console.log(`generated ${scenes.length} scenes and ${profiles.size} avatars in ${assetRoot}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
