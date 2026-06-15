#!/usr/bin/env node
import fs from 'node:fs';

import {
    ASSET_ROOT,
    GENERATED_ASSET_ROOT,
    characterImageMap,
    generatedCharacterConceptMap,
    generatedCharacterImageMap,
    generatedCharacterSpriteMap,
    generatedCharacterSpriteVariantMap,
    externalGrokAdultReferenceMap,
    externalGrokAdultRuntimeSummary,
    remoteCharacterImageMap,
    sourceNovelAssetSummary,
    sourceNovelAssets,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/visual-assets.js';
import {
    sceneBackdropCatalog,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/vn-scene-registry.js';

const root = new URL('../', import.meta.url);
const rel = (path) => new URL(path, root);

function localFileFromWebUrl(url) {
    const source = String(url || '').trim();
    if (!source || /^https?:\/\//i.test(source)) {
        return '';
    }
    const clean = source.replace(/^[./]+/, '').replace(/^\/+/, '');
    return clean.startsWith('scripts/')
        ? `public/${clean}`
        : clean;
}

function exists(url) {
    if (/^https?:\/\//i.test(String(url || ''))) {
        return true;
    }
    const local = localFileFromWebUrl(url);
    return Boolean(local && fs.existsSync(rel(local)));
}

function generatedScenePath(key) {
    return `${GENERATED_ASSET_ROOT}/scenes/${encodeURIComponent(key)}.png`;
}

function effectiveSceneUrl(scene) {
    return scene.imageUrl || generatedScenePath(scene.key);
}

function sceneEntry(scene) {
    const file = effectiveSceneUrl(scene);
    const fileExists = exists(file);
    return {
        assetId: `scene.${scene.key}`,
        kind: 'scene',
        owner: scene.key,
        file,
        title: scene.title || scene.key,
        summary: scene.summary || '',
        tags: {
            keywords: scene.keywords || [],
            palette: scene.palette || [],
        },
        fallbackChain: ['scene exact', 'region template', 'biome template', 'system state', 'rain_bell'],
        status: fileExists ? 'qa_passed' : 'missing',
        qa: {
            bitmap: /\.(?:png|jpe?g|webp|gif)(?:$|[?#])/i.test(String(file || '')),
            exists: fileExists,
            vnReadable: true,
        },
        prompt: scene.prompt || '',
    };
}

function characterAssetEntries(map, kind, status = 'qa_passed') {
    return Object.entries(map || {}).map(([id, file]) => ({
        assetId: `character.${id}.${kind}`,
        kind,
        owner: id,
        file,
        tags: {
            characterId: id,
            runtimeUsable: kind !== 'character_concept',
            conceptOnly: kind === 'character_concept',
        },
        fallbackChain: kind === 'character_sprite'
            ? [`character.${id}.portrait`, 'generated portrait', 'official portrait']
            : ['generated portrait', 'official portrait'],
        status: exists(file) ? status : 'missing',
        qa: {
            bitmap: /\.(?:png|jpe?g|webp|gif)(?:$|[?#])/i.test(String(file || '')),
            exists: exists(file),
            alphaRequired: kind === 'character_sprite',
        },
    }));
}

function characterVariantAssetEntries(map) {
    return Object.entries(map || {}).flatMap(([id, variants]) => Object.entries(variants || {}).map(([variantKey, file]) => ({
        assetId: `character.${id}.variant.${variantKey}`,
        kind: 'character_sprite_variant',
        owner: id,
        file,
        tags: {
            characterId: id,
            variantKey,
            runtimeUsable: true,
            adultMode: variantKey.startsWith('adult.'),
        },
        fallbackChain: [`character.${id}.sprite`, `character.${id}.portrait`, 'generated portrait', 'official portrait'],
        status: exists(file) ? 'qa_passed' : 'missing',
        qa: {
            bitmap: /\.(?:png|jpe?g|webp|gif)(?:$|[?#])/i.test(String(file || '')),
            exists: exists(file),
            alphaRequired: true,
        },
    })));
}

function externalGrokAdultReferenceAssetEntries(map) {
    return Object.entries(map || {}).flatMap(([id, items]) => (items || []).map((item, index) => ({
        assetId: `external.grokadult.${id}.reference.${index + 1}`,
        kind: 'external_adult_reference',
        owner: id,
        file: item.file || '',
        tags: {
            characterId: id,
            sourceName: item.sourceName || '',
            runtimeUsable: false,
            referenceOnly: true,
            adultMode: true,
        },
        fallbackChain: [`character.${id}.variant`, `character.${id}.sprite`, `character.${id}.portrait`],
        status: exists(item.file || '') ? 'qa_passed' : 'missing',
        qa: {
            bitmap: /\.(?:png|jpe?g|webp|gif)(?:$|[?#])/i.test(String(item.file || '')),
            exists: exists(item.file || ''),
            alphaRequired: false,
        },
    })));
}

function sourceNovelAssetEntries(items = []) {
    return (Array.isArray(items) ? items : []).map((item) => ({
        assetId: item.id || `source_novel.${item.category || 'unknown'}`,
        kind: `source_novel_${item.category || 'asset'}`,
        owner: item.characterId || item.sceneKey || 'source_novel',
        file: item.url || '',
        tags: {
            sourceRelativePath: item.sourceRelativePath || '',
            characterId: item.characterId || '',
            sceneKey: item.sceneKey || '',
            runtimeUsable: Boolean(item.characterId || item.sceneKey),
            copiedFromLocalCorpus: true,
        },
        fallbackChain: item.characterId
            ? [`character.${item.characterId}.portrait`, 'official portrait', 'generated portrait']
            : (item.sceneKey ? [`scene.${item.sceneKey}`, 'scene exact', 'generated scene'] : ['manual reference']),
        status: exists(item.url || '') ? 'qa_passed' : 'missing',
        qa: {
            bitmap: /\.(?:png|jpe?g|webp|gif)(?:$|[?#])/i.test(String(item.url || '')),
            exists: exists(item.url || ''),
            alphaRequired: false,
        },
    }));
}

function loadQueue() {
    const path = rel('data/default-user/re0-engine/assets-plan/imagegen-job-queue.json');
    if (!fs.existsSync(path)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(path, 'utf8'));
}

const queue = loadQueue();
const manifest = {
    version: '2026-05-28',
    generatedAt: new Date().toISOString(),
    roots: {
        ASSET_ROOT,
        GENERATED_ASSET_ROOT,
    },
    policy: {
        conceptIsStageAsset: false,
        spriteRequiresAlpha: true,
        fallbackGuarantee: 'exact scene -> region template -> biome template -> system state -> rain_bell',
    },
    assets: [
        ...sceneBackdropCatalog.map(sceneEntry),
        ...characterAssetEntries(characterImageMap, 'official_portrait'),
        ...characterAssetEntries(remoteCharacterImageMap, 'remote_portrait'),
        ...characterAssetEntries(generatedCharacterImageMap, 'generated_portrait'),
        ...characterAssetEntries(generatedCharacterSpriteMap, 'character_sprite'),
        ...characterVariantAssetEntries(generatedCharacterSpriteVariantMap),
        ...externalGrokAdultReferenceAssetEntries(externalGrokAdultReferenceMap),
        ...sourceNovelAssetEntries(sourceNovelAssets),
        ...characterAssetEntries(generatedCharacterConceptMap, 'character_concept'),
    ],
    externalGrokAdult: externalGrokAdultRuntimeSummary,
    sourceNovel: sourceNovelAssetSummary,
    generationQueue: {
        policyDocument: queue?.policyDocument || '',
        jobs: queue?.jobs || [],
    },
};

manifest.summary = manifest.assets.reduce((acc, asset) => {
    acc.total += 1;
    acc.byKind[asset.kind] = (acc.byKind[asset.kind] || 0) + 1;
    if (asset.status === 'missing') acc.missing += 1;
    if (asset.qa?.exists) acc.existing += 1;
    return acc;
}, { total: 0, existing: 0, missing: 0, byKind: {} });

const out = rel('data/default-user/re0-engine/assets-plan/asset-manifest.generated.json');
fs.writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest.summary, null, 2));
