import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    characterImageMap,
    generatedCharacterImageMap,
    generatedCharacterSpriteMap,
    generatedCharacterSpriteVariantMap,
    remoteCharacterImageMap,
    sourceNovelAssetSummary,
    sourceNovelAssets,
    sourceNovelCharacterImageMap,
    sourceNovelSceneImageMap,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/visual-assets.js';
import {
    sceneBackdropCatalog,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/vn-scene-registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'data/default-user/re0-engine/rag');
const assetDescriptionHandoffPath = path.join(rootDir, 'data/default-user/re0-engine/collab/merge-queue/20260604-asset-description-map-handoff.json');
const assetDescriptionHandoffMarkdownPath = path.join(rootDir, 'data/default-user/re0-engine/collab/inbox/assets/20260604-asset-description-map-handoff.md');

function sortedEntries(object = {}) {
    return Object.entries(object || {}).sort(([a], [b]) => a.localeCompare(b));
}

function variantStats(variants = {}) {
    const keys = Object.keys(variants || {}).sort();
    return {
        total: keys.length,
        base: keys.filter((key) => key.startsWith('base.')).length,
        adult: keys.filter((key) => key.startsWith('adult.')).length,
        grok: keys.filter((key) => key.includes('.grok.')).length,
        keys,
    };
}

function characterRecord(id) {
    const variants = variantStats(generatedCharacterSpriteVariantMap[id] || {});
    return {
        id,
        portrait: characterImageMap[id] || generatedCharacterImageMap[id] || remoteCharacterImageMap[id] || '',
        sprite: generatedCharacterSpriteMap[id] || '',
        sourceNovelImage: sourceNovelCharacterImageMap[id] || '',
        variantStats: {
            total: variants.total,
            base: variants.base,
            adult: variants.adult,
            grok: variants.grok,
        },
        variantKeys: variants.keys,
        ragUsage: [
            'director.castIds can reference this id only when the character is visibly on stage, speaking, or explicitly framed.',
            'director.segments[].pose/expression/tone/action should prefer tokens visible in variantKeys when possible.',
        ],
    };
}

function sceneRecord(backdrop = {}) {
    return {
        key: backdrop.key,
        title: backdrop.title || backdrop.key,
        imageUrl: backdrop.imageUrl || backdrop.file || '',
        summary: backdrop.summary || '',
        keywords: Array.isArray(backdrop.keywords) ? backdrop.keywords : [],
        palette: Array.isArray(backdrop.palette) ? backdrop.palette : [],
        prompt: backdrop.prompt || '',
        sourceNovelImage: sourceNovelSceneImageMap[backdrop.key] || '',
        ragUsage: 'director.backgroundKey must be one of these registered keys; choose by location/time/event mood instead of inventing new keys.',
    };
}

function markdownTable(rows, headers) {
    const header = `| ${headers.join(' | ')} |`;
    const sep = `| ${headers.map(() => '---').join(' | ')} |`;
    const body = rows.map((row) => `| ${headers.map((key) => String(row[key] ?? '').replace(/\|/g, '/')).join(' | ')} |`);
    return [header, sep, ...body].join('\n');
}

async function loadAssetDescriptionHandoff() {
    try {
        const handoff = JSON.parse(await readFile(assetDescriptionHandoffPath, 'utf8'));
        const assets = Array.isArray(handoff.assets) ? handoff.assets : [];
        const reuseGroups = new Map();
        for (const asset of assets) {
            const group = asset.randomReuseGroup || '';
            if (!group) continue;
            const record = reuseGroups.get(group) || {
                group,
                count: 0,
                kinds: new Set(),
                samples: [],
            };
            record.count += 1;
            if (asset.kind) record.kinds.add(asset.kind);
            if (asset.assetId && record.samples.length < 4) {
                record.samples.push(asset.assetId);
            }
            reuseGroups.set(group, record);
        }
        const topReuseGroups = Array.from(reuseGroups.values())
            .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group))
            .slice(0, 30)
            .map((item) => ({
                group: item.group,
                count: item.count,
                kinds: Array.from(item.kinds).sort(),
                samples: item.samples,
            }));
        return {
            accepted: true,
            generatedAt: handoff.summary?.generatedAt || '',
            json: path.relative(rootDir, assetDescriptionHandoffPath),
            markdown: path.relative(rootDir, assetDescriptionHandoffMarkdownPath),
            totalImages: Number(handoff.summary?.totalImages || assets.length),
            byKind: handoff.summary?.byKind || {},
            byRegistrationStatus: handoff.summary?.byRegistrationStatus || {},
            randomReuseGroupCount: Number(handoff.summary?.randomReuseGroupCount || reuseGroups.size),
            topReuseGroups,
            runtimePolicy: {
                doNotDeleteDuplicates: true,
                randomizeNearDuplicatesWithinGroup: true,
                excludeKindsFromRuntimeRandomPool: ['tmp-chroma-source', 'character-sprite-src'],
                useFullTableAsRetrievalSourceOnly: true,
            },
        };
    } catch {
        return {
            accepted: false,
            json: path.relative(rootDir, assetDescriptionHandoffPath),
            markdown: path.relative(rootDir, assetDescriptionHandoffMarkdownPath),
            totalImages: 0,
            byKind: {},
            byRegistrationStatus: {},
            randomReuseGroupCount: 0,
            topReuseGroups: [],
            runtimePolicy: {
                useFullTableAsRetrievalSourceOnly: true,
            },
        };
    }
}

const characterIds = Array.from(new Set([
    ...Object.keys(characterImageMap),
    ...Object.keys(generatedCharacterImageMap),
    ...Object.keys(generatedCharacterSpriteMap),
    ...Object.keys(generatedCharacterSpriteVariantMap),
    ...Object.keys(remoteCharacterImageMap),
    ...Object.keys(sourceNovelCharacterImageMap),
])).sort();

const characters = characterIds.map(characterRecord);
const scenes = sceneBackdropCatalog.map(sceneRecord);
const sourceAssets = Array.isArray(sourceNovelAssets) ? sourceNovelAssets : [];
const assetDescriptionHandoff = await loadAssetDescriptionHandoff();
const registry = {
    version: 'asset-rag-registry-v1',
    generatedAt: new Date().toISOString(),
    summary: {
        scenes: scenes.length,
        characters: characters.length,
        characterPortraits: characters.filter((item) => item.portrait).length,
        characterSprites: characters.filter((item) => item.sprite).length,
        characterSpriteVariants: characters.reduce((total, item) => total + item.variantStats.total, 0),
        sourceNovelAssets: sourceNovelAssetSummary?.totalAssets || sourceAssets.length,
        sourceNovelCharacterMap: sourceNovelAssetSummary?.characterMapCount || Object.keys(sourceNovelCharacterImageMap).length,
        sourceNovelSceneMap: sourceNovelAssetSummary?.sceneMapCount || Object.keys(sourceNovelSceneImageMap).length,
    },
    directorContract: {
        backgroundKey: 'Must be selected from scenes[].key.',
        castIds: 'Must use characters[].id only for visible/speaking/framed characters.',
        segmentFields: ['text', 'action', 'tone', 'expression', 'pose', 'camera', 'focus', 'sfx'],
        ragPolicy: 'Use this registry as visual memory. Retrieve a small scene/character subset per turn; do not inject the full catalog into each model call.',
    },
    assetDescriptionHandoff,
    scenes,
    characters,
    sourceNovelAssets: sourceAssets.map((asset) => ({
        id: asset.id || asset.key || asset.file || '',
        category: asset.category || asset.kind || asset.type || '',
        url: asset.url || asset.imageUrl || '',
        sourceRelativePath: asset.sourceRelativePath || asset.file || asset.path || '',
        characterId: asset.characterId || '',
        sceneKey: asset.sceneKey || '',
        bytes: Number(asset.bytes || 0),
    })),
};

const topScenes = scenes.slice(0, 40).map((item) => ({
    key: item.key,
    title: item.title,
    tags: item.keywords.slice(0, 6).join('/'),
    file: path.basename(item.imageUrl || ''),
}));
const topCharacters = characters
    .filter((item) => item.sprite || item.portrait || item.variantStats.total)
    .slice(0, 80)
    .map((item) => ({
        id: item.id,
        sprite: item.sprite ? 'yes' : 'no',
        portrait: item.portrait ? 'yes' : 'no',
        variants: `${item.variantStats.total} (base ${item.variantStats.base} / adult ${item.variantStats.adult} / grok ${item.variantStats.grok})`,
        sampleKeys: item.variantKeys.slice(0, 4).join(' / '),
    }));

const markdown = [
    '# Re:0 Asset RAG Registry',
    '',
    `Generated: ${registry.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Scenes: ${registry.summary.scenes}`,
    `- Characters: ${registry.summary.characters}`,
    `- Character sprites: ${registry.summary.characterSprites}`,
    `- Character sprite variants: ${registry.summary.characterSpriteVariants}`,
    `- Source novel assets: ${registry.summary.sourceNovelAssets}`,
    `- Accepted handoff images: ${assetDescriptionHandoff.accepted ? assetDescriptionHandoff.totalImages : 0}`,
    '',
    '## Director Usage Contract',
    '',
    '- Use `backgroundKey` only from the registered scene keys.',
    '- Use `castIds` only for characters that are visibly on stage, speaking, or explicitly framed.',
    '- Fill `segments[].action/tone/expression/pose/camera/focus/sfx` so VN rendering can select accurate sprites, CG candidates, TTS tone, and scene transitions.',
    '- Retrieve a small relevant subset per turn. Do not paste the full asset registry into a single model request.',
    '- Use `assetDescriptionHandoff` as the full-library retrieval map: randomize within `randomReuseGroup`, and keep `tmp-chroma-source` / `character-sprite-src` out of runtime random pools unless a tool explicitly requests source material.',
    '',
    '## Accepted Asset Description Handoff',
    '',
    `- Accepted: ${assetDescriptionHandoff.accepted ? 'yes' : 'no'}`,
    `- JSON: \`${assetDescriptionHandoff.json}\``,
    `- Markdown: \`${assetDescriptionHandoff.markdown}\``,
    `- Total images: ${assetDescriptionHandoff.totalImages}`,
    `- Random reuse groups: ${assetDescriptionHandoff.randomReuseGroupCount}`,
    '',
    '### Top Reuse Groups',
    '',
    markdownTable(assetDescriptionHandoff.topReuseGroups.slice(0, 20).map((item) => ({
        group: item.group,
        count: item.count,
        kinds: item.kinds.join('/'),
        samples: item.samples.join(' / '),
    })), ['group', 'count', 'kinds', 'samples']),
    '',
    '## Scene Index',
    '',
    markdownTable(topScenes, ['key', 'title', 'tags', 'file']),
    '',
    '## Character Index',
    '',
    markdownTable(topCharacters, ['id', 'sprite', 'portrait', 'variants', 'sampleKeys']),
    '',
    '## Machine-Readable Registry',
    '',
    'See `asset-registry.json` in this directory.',
    '',
].join('\n');

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'asset-registry.json'), `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
await writeFile(path.join(outDir, 'ASSET_REGISTRY.md'), markdown, 'utf8');

console.log(JSON.stringify({
    ok: true,
    outDir,
    summary: registry.summary,
}, null, 2));
