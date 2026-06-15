#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const novelRoot = path.resolve(projectRoot, '..', 're0_novel_src');
const extensionRoot = path.join(projectRoot, 'public/scripts/extensions/third-party/re0-adventure-engine');
const outputRoot = path.join(extensionRoot, 'assets/source-novel');
const generatedDataPath = path.join(extensionRoot, 'data/source-novel-assets.generated.js');
const webRoot = '/scripts/extensions/third-party/re0-adventure-engine/assets/source-novel';
const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

const skipPattern = /(\/donate\/|收款码|sponsor|kofi|opencollective|\/logo\/|wechat|alipay|qq)/i;
const legacyProtagonistCharacterNames = new Set(['486']);
const characterNameAliases = new Map([
    ['Aegidona', 'echidna'],
    ['Aldebaran', 'al'],
    ['Anastasia', 'anastasia'],
    ['Beatrice', 'beatrice'],
    ['Betrugius', 'petelgeuse'],
    ['Camilla', 'carmilla'],
    ['Capella', 'capella'],
    ['Crusch', 'crusch'],
    ['Daphne', 'daphne'],
    ['Dun', 'daphne'],
    ['Elsa', 'elsa'],
    ['Emilia', 'emilia'],
    ['Felix', 'ferris'],
    ['Felt', 'felt'],
    ['Frederica', 'frederica'],
    ['Garfield', 'garfiel'],
    ['Geuse', 'geuse'],
    ['Halibel', 'halibel'],
    ['Heinkel', 'heinkel'],
    ['Julius', 'julius'],
    ['Joshua', 'joshua'],
    ['Ley', 'ley'],
    ['Liliana', 'liliana'],
    ['Lisa', 'elsa'],
    ['Luz', 'ryuzu'],
    ['Meri', 'meili'],
    ['Mimi', 'mimi'],
    ['Minerva', 'minerva'],
    ['Otto', 'otto'],
    ['Pack', 'puck'],
    ['Pandora', 'pandora'],
    ['Patrasche', 'patrasche'],
    ['Petra', 'petra'],
    ['Ppiscilla', 'priscilla'],
    ['Ram', 'ram'],
    ['Regulus', 'regulus'],
    ['Reinhard', 'reinhard'],
    ['Rem', 'rem'],
    ['Ricardo', 'ricardo'],
    ['Rohm', 'rom'],
    ['Roswaal', 'roswaal'],
    ['Sahmet', 'sekmet'],
    ['Shatira', 'satella'],
    ['Shaula', 'shaula'],
    ['Sirius', 'sirius'],
    ['Theresia', 'theresia'],
    ['Tifeng', 'typhon'],
    ['Whale', 'white_whale'],
    ['Wilhelm', 'wilhelm'],
]);

const sceneKeyByChapter = [
    [/chapter010|第一篇章|王都/i, 'royal_capital'],
    [/chapter020|第二篇章|豪宅|宅邸/i, 'mansion'],
    [/chapter030|第三篇章|白鲸|王选/i, 'royal_capital'],
    [/chapter040|第四篇章|圣域|永远的契约/i, 'sanctuary'],
    [/chapter050|第五篇章|普里斯提拉|水门/i, 'priestella'],
    [/chapter060|第六篇章|监视塔|记忆/i, 'watchtower'],
    [/chapter070|第七篇章|佛拉基亚|帝国/i, 'vollachia'],
    [/chapter080|第八篇章|灾厄/i, 'vollachia'],
    [/chapter090|第九篇章|王都/i, 'royal_capital'],
];

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function walk(dir, files = []) {
    if (!fs.existsSync(dir)) {
        return files;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, files);
        } else if (allowed.has(path.extname(entry.name).toLowerCase())) {
            files.push(full);
        }
    }
    return files;
}

function safeFilePart(value) {
    return String(value || 'asset')
        .normalize('NFKD')
        .replace(/[^\w.-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 90) || 'asset';
}

function classifyAsset(file, relative) {
    if (/\/character\//i.test(relative) || /登场人物/i.test(relative)) {
        return 'characters';
    }
    if (/\/article\//i.test(relative) || /\/images\//i.test(relative)) {
        return 'illustrations';
    }
    return 'site';
}

function characterIdForAsset(relative, baseName) {
    const cleaned = baseName
        .replace(/^第\d+章_登场人物_/u, '')
        .replace(/\.[^.]+$/u, '');
    if (legacyProtagonistCharacterNames.has(cleaned)) {
        return '';
    }
    for (const [name, id] of characterNameAliases) {
        if (cleaned === name || cleaned.includes(name)) {
            return id;
        }
    }
    return '';
}

function sceneKeyForAsset(relative) {
    for (const [pattern, key] of sceneKeyByChapter) {
        if (pattern.test(relative)) {
            return key;
        }
    }
    return '';
}

function webUrlFor(category, fileName) {
    return `${webRoot}/${category}/${encodeURIComponent(fileName)}`;
}

ensureDir(outputRoot);
for (const category of ['characters', 'illustrations', 'site']) {
    ensureDir(path.join(outputRoot, category));
}

const assets = [];
const characterMap = {};
const sceneMap = {};
const seenHashes = new Set();
for (const file of walk(novelRoot).sort()) {
    const relative = path.relative(novelRoot, file).split(path.sep).join('/');
    if (skipPattern.test(relative)) {
        continue;
    }
    const bytes = fs.readFileSync(file);
    const hash = crypto.createHash('sha1').update(bytes).digest('hex');
    if (seenHashes.has(hash)) {
        continue;
    }
    seenHashes.add(hash);
    const ext = path.extname(file).toLowerCase();
    const base = path.basename(file, ext);
    const category = classifyAsset(file, relative);
    const outputName = `${hash.slice(0, 10)}__${safeFilePart(base)}${ext}`;
    const outputPath = path.join(outputRoot, category, outputName);
    if (!fs.existsSync(outputPath)) {
        fs.copyFileSync(file, outputPath);
    }
    const url = webUrlFor(category, outputName);
    const characterId = category === 'characters' ? characterIdForAsset(relative, path.basename(file)) : '';
    const sceneKey = category === 'illustrations' ? sceneKeyForAsset(relative) : '';
    if (characterId && !characterMap[characterId]) {
        characterMap[characterId] = url;
    }
    if (sceneKey && !sceneMap[sceneKey]) {
        sceneMap[sceneKey] = url;
    }
    assets.push({
        id: `source_novel.${category}.${hash.slice(0, 10)}`,
        category,
        url,
        sourceRelativePath: relative,
        characterId,
        sceneKey,
        bytes: bytes.length,
    });
}

const summary = {
    generatedAt: new Date().toISOString(),
    sourceRoot: path.relative(projectRoot, novelRoot),
    totalAssets: assets.length,
    characterMapCount: Object.keys(characterMap).length,
    sceneMapCount: Object.keys(sceneMap).length,
    byCategory: assets.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
    }, {}),
};

const generated = `// Generated by scripts/import-re0-source-assets.mjs. Do not edit by hand.
export const sourceNovelAssetSummary = ${JSON.stringify(summary, null, 4)};
export const sourceNovelCharacterImageMap = ${JSON.stringify(characterMap, null, 4)};
export const sourceNovelSceneImageMap = ${JSON.stringify(sceneMap, null, 4)};
export const sourceNovelAssets = ${JSON.stringify(assets, null, 4)};
`;

fs.writeFileSync(generatedDataPath, `${generated}\n`, 'utf8');
console.log(JSON.stringify(summary, null, 2));
