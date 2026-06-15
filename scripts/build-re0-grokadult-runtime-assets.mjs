#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionRoot = 'public/scripts/extensions/third-party/re0-adventure-engine';
const grokRoot = path.join(root, extensionRoot, 'assets/external/grokadult');
const webRoot = '/scripts/extensions/third-party/re0-adventure-engine/assets/external/grokadult';
const outputModule = path.join(root, extensionRoot, 'data/grokadult-runtime-assets.generated.js');
const outputJson = path.join(root, 'data/default-user/re0-engine/assets-plan/grokadult-runtime-physical-index.generated.json');

const imageExt = /\.(?:png|jpe?g|webp)$/i;

function walk(dir) {
    if (!fs.existsSync(dir)) {
        return [];
    }
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return walk(fullPath);
        }
        return imageExt.test(entry.name) ? [fullPath] : [];
    });
}

function relativeToGrok(file) {
    return path.relative(grokRoot, file).split(path.sep).join('/');
}

function webPathFromRelative(relativePath) {
    return `${webRoot}/${relativePath.split('/').map(encodeURIComponent).join('/')}`;
}

function normalizeToken(value = '') {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_\-\u4e00-\u9fff]+/gu, '_')
        .replace(/_+/gu, '_')
        .replace(/^_+|_+$/gu, '');
}

function titleFromKey(key = '') {
    return String(key || '')
        .replace(/^adult_grok_/u, '')
        .replace(/^adult_/u, '')
        .replace(/__/gu, ' · ')
        .replace(/_/gu, ' ')
        .trim();
}

function parseCharacterVariant(fileName = '') {
    const stem = fileName.replace(imageExt, '');
    const pose = stem.match(/__pose-(.*?)__expr-/u)?.[1] || 'deep';
    const expression = stem.match(/__expr-(.*?)__outfit-/u)?.[1] || 'deep';
    const outfit = stem.match(/__outfit-(.*?)(?:__deep|__adult|__key|$)/u)?.[1] || 'private';
    return {
        pose: normalizeToken(pose),
        expression: normalizeToken(expression === 'mindbreak' ? 'deep_intensity' : expression),
        outfit: normalizeToken(outfit),
    };
}

function sceneKeywordsFromStem(stem = '') {
    const normalized = normalizeToken(stem);
    const tokens = normalized.split('_').filter(Boolean);
    const keywords = new Set(['成人模式', '成人场景', 'Grok成人', '高强度插图', ...tokens]);
    const pairs = [
        [/dressing|mirror|换衣|更衣/u, ['更衣', '镜前', '衣物', '室内']],
        [/noble|salon|wine|curtain/u, ['贵族', '沙龙', '帘幕', '酒杯', '密谈']],
        [/wilderness|tent|campfire|storm/u, ['野外', '帐篷', '营地', '篝火', '暴风雨']],
        [/witch|dream|shadow|ritual|jealousy/u, ['魔女', '梦境', '影子', '仪式', '嫉妒']],
        [/healer|aftercare|hut|care/u, ['治疗', '照料', '药屋', '事后']],
        [/mansion|bedroom|storm/u, ['宅邸', '寝室', '卧室', '暴风雨']],
        [/priestella|inn|suite|balcony/u, ['普利斯提拉', '旅馆', '套房', '阳台']],
        [/private|study|oath|candle|power/u, ['书房', '私密', '誓约', '烛火', '权力']],
        [/silk|screen|silhouette/u, ['屏风', '丝绸', '剪影']],
        [/tavern|late|corner/u, ['酒馆', '客房', '深夜', '角落']],
        [/rain|carriage|quarters/u, ['雨夜', '马车', '近距离']],
        [/masked|balcony/u, ['假面', '阳台', '舞会']],
    ];
    for (const [pattern, values] of pairs) {
        if (pattern.test(normalized)) {
            values.forEach((value) => keywords.add(value));
        }
    }
    return [...keywords].filter(Boolean);
}

function buildRuntimeIndex() {
    const files = walk(grokRoot).sort();
    const characterSprites = {};
    const characterReferences = {};
    const sceneBackdrops = [];
    const physicalFiles = [];

    for (const file of files) {
        const relative = relativeToGrok(file);
        const imageUrl = webPathFromRelative(relative);
        const basename = path.basename(relative);
        const sceneMatch = relative.match(/(?:^2026-05-29-deep-adult-galgame-batch\/generated\/|^adult-assets\/scenes\/[^/]+\/)([^/]+)\.(?:jpe?g|png|webp)$/iu);
        const spriteMatch = relative.match(/^adult-assets\/characters\/([^/]+)\/sprite-deep\/([^/]+)\.(?:png|webp)$/iu);
        const referenceMatch = relative.match(/^adult-assets\/characters\/([^/]+)\/sprite-src-deep\/([^/]+)\.(?:jpe?g|png|webp)$/iu);

        physicalFiles.push({
            relative,
            imageUrl,
            bucket: spriteMatch ? 'character-sprite-deep' : (referenceMatch ? 'character-reference' : (sceneMatch ? 'scene-backdrop' : 'other')),
            characterId: spriteMatch?.[1] || referenceMatch?.[1] || '',
        });

        if (spriteMatch) {
            const characterId = normalizeToken(spriteMatch[1]);
            const variant = parseCharacterVariant(basename);
            const key = `adult.grok.${variant.pose}.${variant.expression}.${variant.outfit}`;
            characterSprites[characterId] ??= {};
            characterSprites[characterId][key] = imageUrl;
            continue;
        }

        if (referenceMatch) {
            const characterId = normalizeToken(referenceMatch[1]);
            characterReferences[characterId] ??= [];
            characterReferences[characterId].push({
                file: imageUrl,
                sourceName: basename,
            });
            continue;
        }

        if (sceneMatch) {
            const stem = sceneMatch[1].replace(imageExt, '');
            const key = `adult_grok_${normalizeToken(stem)}`;
            sceneBackdrops.push({
                key,
                title: `Grok成人场景：${titleFromKey(key)}`,
                summary: '外部 Grok 成人向场景素材。仅在成人模式或成人剧情窗口中作为高强度桥段、插图背景、关系推进 CG 候选使用。',
                keywords: sceneKeywordsFromStem(stem),
                palette: ['#09090b', '#3f1d2e', '#9f1239', '#f8fafc'],
                imageUrl,
                source: 'grokadult',
                priority: 'external-adult-cg',
                prompt: '',
            });
        }
    }

    const summary = {
        generatedAt: new Date().toISOString(),
        totalImages: physicalFiles.length,
        characterSpriteVariants: Object.values(characterSprites).reduce((total, variants) => total + Object.keys(variants).length, 0),
        characterReferenceImages: Object.values(characterReferences).reduce((total, items) => total + items.length, 0),
        sceneBackdrops: sceneBackdrops.length,
        characters: Object.fromEntries(Object.entries(characterSprites).map(([id, variants]) => [id, Object.keys(variants).length])),
    };
    return {
        summary,
        characterSprites,
        characterReferences,
        sceneBackdrops,
        physicalFiles,
    };
}

function writeRuntimeModule(index) {
    const source = `/* eslint-disable */
// Generated by scripts/build-re0-grokadult-runtime-assets.mjs.
// Do not edit by hand. This file is built from physical files under assets/external/grokadult.

export const EXTERNAL_GROK_ADULT_ASSET_ROOT = ${JSON.stringify(webRoot)};

export const externalGrokAdultCharacterSpriteVariantMap = ${JSON.stringify(index.characterSprites, null, 4)};

export const externalGrokAdultReferenceMap = ${JSON.stringify(index.characterReferences, null, 4)};

export const externalGrokAdultSceneBackdrops = ${JSON.stringify(index.sceneBackdrops, null, 4)};

export const externalGrokAdultRuntimeSummary = ${JSON.stringify(index.summary, null, 4)};
`;
    fs.writeFileSync(outputModule, source);
}

function writePhysicalIndex(index) {
    fs.mkdirSync(path.dirname(outputJson), { recursive: true });
    fs.writeFileSync(outputJson, `${JSON.stringify(index, null, 2)}\n`);
}

const index = buildRuntimeIndex();
writeRuntimeModule(index);
writePhysicalIndex(index);
console.log(JSON.stringify(index.summary, null, 2));
