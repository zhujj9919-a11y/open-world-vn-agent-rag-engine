#!/usr/bin/env node
import fs from 'node:fs';

import {
    GENERATED_ASSET_ROOT,
    characterImageMap,
    generatedCharacterConceptMap,
    generatedCharacterImageMap,
    generatedCharacterSpriteMap,
    generatedCharacterSpriteVariantMap,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/visual-assets.js';
import {
    BASE_SCENE_BACKDROP_CATALOG,
    sceneBackdropCatalog,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/vn-scene-registry.js';

const root = new URL('../', import.meta.url);
const rel = (path) => new URL(path, root);

const REQUIRED_SCENE_COVERAGE_SLOTS = [
    { key: 'death_anchor', tier: 'P0', slot: '死亡回归/锚点返回/失败结算' },
    { key: 'answer_book', tier: 'P0', slot: '答案之书/死亡解析/死后问答' },
    { key: 'worldline_tree', tier: 'P0', slot: '世界线树/偏移率/分支回看' },
    { key: 'witch_interference', tier: 'P0', slot: '魔女干涉/禁言/记忆污染' },
    { key: 'rain_bell', tier: 'P0', slot: '王都底层开局/雨夜/废钟' },
    { key: 'loot_house', tier: 'P0', slot: '盗品蔵/交易/艾尔莎压力' },
    { key: 'royal_capital', tier: 'P0', slot: '王都公开区域/王选舆论' },
    { key: 'market_day', tier: 'P0', slot: '日常市场/套话/交易' },
    { key: 'capital_gate', tier: 'P0', slot: '城门/通行/盘查/出入城' },
    { key: 'tavern_common_room', tier: 'P0', slot: '酒馆/委托/传言/休整' },
    { key: 'relief_house', tier: 'P0', slot: '救济院/安全屋/底层证言' },
    { key: 'healer_clinic', tier: 'P0', slot: '诊疗/买药/受伤处理' },
    { key: 'archive', tier: 'P0', slot: '档案/证据/旧案调查' },
    { key: 'noble_salon', tier: 'P0', slot: '贵族交涉/王选阵营/礼法压力' },
    { key: 'guard_interrogation', tier: 'P0', slot: '骑士团/审问/政治压力' },
    { key: 'roadside_inn', tier: 'P0', slot: '郊外旅店/短途休整' },
    { key: 'forest_road_checkpoint', tier: 'P0', slot: '商路/护送/追踪/区域移动' },
    { key: 'mansion', tier: 'P0', slot: '宅邸主舞台/禁书库门前' },
    { key: 'mansion_exterior', tier: 'P1', slot: '宅邸外景/抵达/离开/篇章转场' },
    { key: 'sanctuary', tier: 'P0', slot: '圣域墓所/试炼' },
    { key: 'priestella', tier: 'P0', slot: '水门都市外景/灾厄传言' },
    { key: 'vollachia', tier: 'P0', slot: '帝国边境/逃亡/军政生存' },
    { key: 'snowfield', tier: 'P0', slot: '古斯提科/雪原/远方传言' },
    { key: 'augria_sand_dunes', tier: 'P1', slot: '奥古利亚沙丘/监视塔旅途/生存消耗' },
    { key: 'witch_dream', tier: 'P0', slot: '答案之书/死亡残响' },
    { key: 'witch_cult_hideout', tier: 'P0', slot: '魔女教外围/地下调查/高危失败' },
    { key: 'capital_sewer', tier: 'P1', slot: '王都潜入/地下逃亡/藏证据' },
    { key: 'capital_rooftops', tier: 'P1', slot: '屋顶追逐/窥探/秘密会面' },
    { key: 'arlam_village_night', tier: 'P1', slot: '村庄夜巡/魔兽前兆' },
    { key: 'mansion_kitchen', tier: 'P1', slot: '宅邸日常/饭菜线索/女仆互动' },
    { key: 'mansion_courtyard', tier: 'P1', slot: '宅邸庭院/散步/突袭前兆' },
    { key: 'mansion_guest_room', tier: 'P2', slot: '宅邸客房/夜间独处/梦境前兆' },
    { key: 'mansion_study', tier: 'P2', slot: '宅邸书房/密信/魔法研究/暗门' },
    { key: 'mansion_bath', tier: 'P2', slot: '宅邸浴场/伤后休整/关系推进' },
    { key: 'priestella_inn_room', tier: 'P1', slot: '水门旅馆/私密谈话/夜间伏击' },
    { key: 'priestella_sluice_control', tier: 'P2', slot: '水门水闸控制/机关/灾厄防控' },
    { key: 'imperial_command_tent', tier: 'P1', slot: '帝国军帐/战术谈判/生存压力' },
    { key: 'kararagi_caravanserai', tier: 'P2', slot: '卡拉拉基商路/驿站/跨国传言' },
    { key: 'gusteko_village_house', tier: 'P2', slot: '古斯提科雪村室内/避寒/证言' },
    { key: 'great_waterfall_edge_safe', tier: 'P2', slot: '大瀑布安全路线/世界边缘探索' },
    { key: 'great_waterfall_edge_storm', tier: 'P2', slot: '大瀑布高危路线/死亡边界' },
    { key: 'wilderness_camp', tier: 'P2', slot: '野外营地/跨区域休整/伏击' },
];

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

function existsWebAsset(url) {
    const local = localFileFromWebUrl(url);
    return !!local && fs.existsSync(rel(local));
}

function isBitmap(url) {
    return /\.(?:png|jpe?g|webp|gif)(?:$|[?#])/i.test(String(url || ''));
}

function generatedScenePath(key) {
    return `${GENERATED_ASSET_ROOT}/scenes/${encodeURIComponent(key)}.png`;
}

function effectiveSceneUrl(scene) {
    return scene.imageUrl || generatedScenePath(scene.key);
}

function sceneAudit() {
    return sceneBackdropCatalog.map((scene) => {
        const imageUrl = effectiveSceneUrl(scene);
        return {
            key: scene.key,
            title: scene.title,
            priority: scene.priority || '',
            base: BASE_SCENE_BACKDROP_CATALOG.some((item) => item.key === scene.key),
            imageUrl,
            localFile: localFileFromWebUrl(imageUrl),
            bitmap: isBitmap(imageUrl),
            exists: existsWebAsset(imageUrl),
            hasPrompt: Boolean(scene.prompt),
            keywordCount: Array.isArray(scene.keywords) ? scene.keywords.length : 0,
        };
    });
}

function mapAudit(label, map) {
    return Object.entries(map).map(([id, imageUrl]) => ({
        id,
        label,
        imageUrl,
        localFile: localFileFromWebUrl(imageUrl),
        remote: /^https?:\/\//i.test(String(imageUrl || '')),
        bitmap: isBitmap(imageUrl),
        exists: /^https?:\/\//i.test(String(imageUrl || '')) || existsWebAsset(imageUrl),
    }));
}

function variantMapAudit(label, map) {
    return Object.entries(map || {}).flatMap(([id, variants]) => Object.entries(variants || {}).map(([variantKey, imageUrl]) => ({
        id: `${id}:${variantKey}`,
        label,
        imageUrl,
        localFile: localFileFromWebUrl(imageUrl),
        remote: /^https?:\/\//i.test(String(imageUrl || '')),
        bitmap: isBitmap(imageUrl),
        exists: /^https?:\/\//i.test(String(imageUrl || '')) || existsWebAsset(imageUrl),
    })));
}

function summarize(items) {
    return {
        total: items.length,
        bitmap: items.filter((item) => item.bitmap).length,
        existing: items.filter((item) => item.exists).length,
        missing: items.filter((item) => !item.exists).length,
        nonBitmap: items.filter((item) => !item.bitmap).length,
    };
}

const scenes = sceneAudit();
const sceneByKey = new Map(scenes.map((scene) => [scene.key, scene]));
const characterPortraits = mapAudit('officialPortrait', characterImageMap);
const generatedPortraits = mapAudit('generatedPortrait', generatedCharacterImageMap);
const sprites = mapAudit('sprite', generatedCharacterSpriteMap);
const spriteVariants = variantMapAudit('spriteVariant', generatedCharacterSpriteVariantMap);
const concepts = mapAudit('concept', generatedCharacterConceptMap);
const requiredSceneSlots = REQUIRED_SCENE_COVERAGE_SLOTS.map((slot) => {
    const scene = sceneByKey.get(slot.key);
    return {
        ...slot,
        covered: Boolean(scene?.exists && scene?.bitmap),
        imageUrl: scene?.imageUrl || '',
        localFile: scene?.localFile || '',
    };
});

const report = {
    generatedAt: new Date().toISOString(),
    policy: {
        sceneFallback: `${GENERATED_ASSET_ROOT}/scenes/{key}.png`,
        requiredSceneFormat: 'bitmap png/jpg/webp/gif',
        notes: 'Remote official portraits are counted as existing; stage-critical generated sprites must be local bitmap files.',
    },
    summary: {
        scenes: summarize(scenes),
        baseScenes: summarize(scenes.filter((item) => item.base)),
        requiredSceneSlots: summarize(requiredSceneSlots.map((item) => ({
            bitmap: item.covered,
            exists: item.covered,
        }))),
        characterPortraits: summarize(characterPortraits),
        generatedPortraits: summarize(generatedPortraits),
        sprites: summarize(sprites),
        spriteVariants: summarize(spriteVariants),
        concepts: summarize(concepts),
    },
    gaps: {
        scenesMissing: scenes.filter((item) => !item.exists),
        scenesNonBitmap: scenes.filter((item) => !item.bitmap),
        requiredSceneSlotsMissing: requiredSceneSlots.filter((item) => !item.covered),
        generatedPortraitsMissing: generatedPortraits.filter((item) => !item.exists),
        spritesMissing: sprites.filter((item) => !item.exists),
        spriteVariantsMissing: spriteVariants.filter((item) => !item.exists),
        conceptsMissing: concepts.filter((item) => !item.exists),
    },
    requiredSceneSlots,
    scenes,
    characterPortraits,
    generatedPortraits,
    sprites,
    spriteVariants,
    concepts,
};

const outPath = process.argv.includes('--write')
    ? 'data/default-user/re0-engine/assets-plan/asset-coverage-report.json'
    : '';

if (outPath) {
    fs.writeFileSync(rel(outPath), `${JSON.stringify(report, null, 2)}\n`);
}

if (report.gaps.scenesMissing.length || report.gaps.scenesNonBitmap.length || report.gaps.requiredSceneSlotsMissing.length || report.gaps.generatedPortraitsMissing.length || report.gaps.spritesMissing.length || report.gaps.spriteVariantsMissing.length || report.gaps.conceptsMissing.length) {
    console.log(JSON.stringify(report.summary, null, 2));
    const gapCount = report.gaps.scenesMissing.length + report.gaps.scenesNonBitmap.length + report.gaps.requiredSceneSlotsMissing.length + report.gaps.generatedPortraitsMissing.length + report.gaps.spritesMissing.length + report.gaps.spriteVariantsMissing.length + report.gaps.conceptsMissing.length;
    throw new Error(`Re:0 asset coverage gaps detected: ${gapCount}`);
}

console.log(JSON.stringify(report.summary, null, 2));
