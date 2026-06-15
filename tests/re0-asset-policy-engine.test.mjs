import assert from 'node:assert/strict';

import {
    buildAssetPlan,
    evaluateAssetUse,
    normalizeAssetCharacterId,
    summarizeAssetPlan,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/asset-policy-engine.js';
import {
    buildVisualNovelStageDirector,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/vn-stage-director.js';

for (const alias of ['昴', '菜月昴', 'Subaru', 'Natsuki Subaru']) {
    assert.equal(normalizeAssetCharacterId(alias), 'protagonist');
}
for (const alias of ['旁白', '世界意志', 'narrator', 'narration']) {
    assert.equal(normalizeAssetCharacterId(alias), '');
}
for (const alias of ['菲鲁特', '金发少女', '盗贼少女', 'rider']) {
    assert.equal(normalizeAssetCharacterId(alias), 'felt');
}
for (const alias of ['王都卫兵', '卫兵', '年轻骑士', '巡逻卫兵']) {
    assert.equal(normalizeAssetCharacterId(alias), 'capital_guard');
}

function state(overrides = {}) {
    return {
        mode: 'main',
        current: {
            arc: overrides.arc || 1,
            day: overrides.day || 1,
            time: overrides.time || '深夜',
            location: overrides.location || '王都贫民区雨夜',
            viewpoint: '玩家',
            castIds: overrides.characters || [],
        },
        gameplay: {
            activeObjective: overrides.objective || '',
            objectiveStage: overrides.stage || '',
            lastPlayerAction: overrides.action || '',
            openQuestions: overrides.openQuestions || [],
        },
        discoveredClues: overrides.clues || [],
        characterCards: Object.fromEntries((overrides.characters || []).map((name) => [name, { name }])),
        visuals: {
            sceneBackdrop: {
                currentKey: overrides.currentKey || 'rain_bell',
            },
            visualNovel: {
                backgroundKey: overrides.backgroundKey || '',
                sceneCharacters: overrides.characters || [],
                castIds: overrides.characters || [],
                currentSpeakerName: overrides.speaker || '',
                currentSegment: overrides.segment || null,
            },
        },
        adultContent: {
            enabled: overrides.adultEnabled === true,
        },
        narrativeMode: {
            current: overrides.narrativeMode || 'daily',
        },
        settingLayers: {
            setupCanon: overrides.setup || {},
        },
    };
}

const lootPlan = buildAssetPlan(state({
    location: '王都赃物库',
    objective: '按原作线确认徽章流向并避开艾尔莎袭击',
    action: '确认徽章交易，观察艾尔莎入场前的门缝影子。',
    characters: ['爱蜜莉雅', '菲鲁特', '罗姆爷'],
    speaker: '爱蜜莉雅',
}));
assert.equal(lootPlan.selectedBackdrop.key, 'loot_house');
assert.ok(lootPlan.candidateBackdrops.some((item) => item.key === 'loot_house'));
assert.ok(lootPlan.castAssets.some((item) => item.id === 'emilia'));
assert.ok(lootPlan.castAssets.some((item) => item.id === 'felt'));
assert.ok(lootPlan.castAssets.some((item) => item.id === 'rom'));
assert.equal(lootPlan.sourceNovelSceneFamily, 'royal_capital');
assert.ok(lootPlan.sourceNovelReferences.some((item) => item.kind === 'scene_reference' && item.sceneKey === 'royal_capital'));
assert.ok(lootPlan.sourceNovelReferences.some((item) => item.kind === 'character_reference' && item.characterId === 'emilia'));
assert.ok(lootPlan.sourceNovelReferences.every((item) => item.usage === 'reference_only'));

const anticipatedElsaPlan = buildAssetPlan(state({
    location: '王都贫民区盗品蔵',
    objective: '拉着爱蜜莉雅躲到柜台后面先观察',
    action: '等罗姆爷取货时制造混乱争取时间',
    characters: ['protagonist', '爱蜜莉雅', '罗姆爷'],
    speaker: '罗姆爷',
    backgroundKey: 'loot_house',
}), {}, {
    storyRagWorkset: {
        facts: [{ text: '艾尔莎会作为徽章买家入场，带来直接武力威胁。' }],
        risks: [{ description: '艾尔莎入场后任何暴露都会升级成战斗风险。' }],
        hooks: [{ text: '门口血腥味和弯刀预示艾尔莎即将发声。' }],
        candidateSeeds: [{ text: '观察艾尔莎的武器和行动模式寻找弱点。' }],
    },
});
assert.ok(anticipatedElsaPlan.castAssets.some((item) => item.id === 'elsa'));
assert.equal(evaluateAssetUse(anticipatedElsaPlan, {
    parsedVnScript: {
        backgroundKey: 'loot_house',
        castIds: ['protagonist', 'emilia', 'rom', 'elsa'],
    },
}).filter((finding) => finding.title === '舞台角色不在资产计划中').length, 0);

const lootSlumPlan = buildAssetPlan(state({
    location: '王都贫民区盗品蔵',
    objective: '确认徽章交易窗口，避免把室内交易错误映射成贫民区外景。',
    action: '我进入盗品蔵，先向菲鲁特和罗姆爷说明自己只想确认徽章交易。',
    characters: ['菲鲁特', '罗姆爷'],
    speaker: '菲鲁特',
    backgroundKey: 'loot_house',
}));
assert.equal(lootSlumPlan.selectedBackdrop.key, 'loot_house');
assert.ok(lootSlumPlan.selectedBackdrop.score > 40);
assert.equal(evaluateAssetUse(lootSlumPlan, {
    parsedVnScript: {
        backgroundKey: 'arc01_loot_house_interior',
        castIds: ['protagonist', 'felt', 'rom'],
    },
}).filter((finding) => finding.title === '背景素材与场景计划不一致').length, 0);

const kitchenPlan = buildAssetPlan(state({
    arc: 2,
    time: '清晨',
    location: '罗兹瓦尔宅邸厨房',
    objective: '观察蕾姆和拉姆备餐时对魔女气味的反应',
    action: '我不急着解释，只帮蕾姆端起铜锅，观察拉姆的视线。',
    characters: ['蕾姆', '拉姆'],
    speaker: '蕾姆',
}));
assert.equal(kitchenPlan.selectedBackdrop.key, 'mansion_kitchen');
assert.ok(kitchenPlan.castAssets.some((item) => item.id === 'rem' && item.mode.includes('sprite')));
assert.ok(kitchenPlan.castAssets.every((item) => item.adult !== true));
assert.equal(kitchenPlan.sourceNovelSceneFamily, 'mansion');
assert.ok(kitchenPlan.sourceNovelReferences.some((item) => item.kind === 'scene_reference' && item.sceneKey === 'mansion'));
assert.ok(kitchenPlan.sourceNovelReferences.some((item) => item.kind === 'character_reference' && item.characterId === 'rem'));

const sanctuaryPlan = buildAssetPlan(state({
    arc: 4,
    time: '黄昏',
    location: '圣域墓所外 · 试炼与结界分歧',
    objective: '确认圣域试炼、结界规则、宅邸袭击和罗兹瓦尔布局之间的因果约束。',
    action: '让爱蜜莉雅保留自主选择，同时向加菲尔确认结界与墓所试炼规则。',
    characters: ['爱蜜莉雅', '加菲尔', '罗兹瓦尔', '碧翠丝'],
    speaker: '加菲尔',
    backgroundKey: 'arc04_sanctuary_entrance',
}));
assert.equal(sanctuaryPlan.selectedBackdrop.key, 'arc04_sanctuary_entrance');
assert.ok(sanctuaryPlan.selectedBackdrop.score > 45);
assert.ok(sanctuaryPlan.candidateBackdrops.some((item) => item.key === 'arc04_sanctuary_entrance'));
assert.ok(!sanctuaryPlan.candidateBackdrops.find((item) => item.key === 'witch_cult_hideout') || sanctuaryPlan.selectedBackdrop.key !== 'witch_cult_hideout');

const archivePlan = buildAssetPlan(state({
    location: '王都下层图书馆废室',
    objective: '不追徽章，先调查灰衣人留下的寄存记录和禁书区脚印',
    action: '带着莉榭尔去图书馆废室核对寄存簿和脚印。',
    characters: ['莉榭尔·阿尔戈', '菲鲁特'],
    speaker: '莉榭尔·阿尔戈',
    setup: {
        origin: '现代图书管理员',
    },
}));
assert.equal(archivePlan.selectedBackdrop.key, 'archive');
assert.ok(archivePlan.castAssets.some((item) => item.id === 'lishelle'));

const unknownPlan = buildAssetPlan(state({
    location: '月面玻璃铁道停靠站',
    objective: '测试完全自由模式下不存在的原创地点',
    action: '我在月面玻璃铁道停靠站寻找蓝色轨票。',
    characters: ['不存在的旅客'],
    currentKey: '',
}));
assert.equal(unknownPlan.selectedBackdrop.confidence, 'fallback');
assert.ok(unknownPlan.missingAssets.some((item) => item.kind === 'scene_background'));
assert.ok(unknownPlan.missingAssets.some((item) => item.kind === 'character_sprite'));

const invalidKeyPlan = buildAssetPlan(state({
    backgroundKey: 'not_registered_scene_key',
    location: '王都贫民区雨夜',
    action: '追问黑伞的来源。',
}));
assert.ok(invalidKeyPlan.missingAssets.some((item) => item.id === 'not_registered_scene_key'));

const adultBlockedPlan = buildAssetPlan(state({
    location: '宅邸客房',
    objective: '伤后照料与私密夜谈',
    action: '我和爱蜜莉雅在夜间客房独处，谈起告白和余温。',
    characters: ['爱蜜莉雅'],
    speaker: '爱蜜莉雅',
    adultEnabled: false,
}));
assert.ok(adultBlockedPlan.castAssets.every((item) => item.adult !== true));

const adultAllowedPlan = buildAssetPlan(state({
    location: '宅邸客房',
    objective: '伤后照料与私密夜谈',
    action: '我和爱蜜莉雅在夜间客房独处，谈起告白和余温。',
    characters: ['爱蜜莉雅'],
    speaker: '爱蜜莉雅',
    adultEnabled: true,
    narrativeMode: 'adult',
}));
assert.ok(adultAllowedPlan.castAssets.some((item) => item.id === 'emilia' && item.adult === true));

const scriptDirectionVariantPlan = buildAssetPlan(state({
    location: '贫民区救济院',
    objective: '用结构化导演台本测试动作字段是否驱动立绘差分',
    action: '我暂时沉默，等待莉榭尔回应。',
    characters: ['莉榭尔·阿尔戈'],
    speaker: '莉榭尔·阿尔戈',
    segment: {
        type: 'dialogue',
        speakerId: 'lishelle',
        speakerName: '莉榭尔',
        text: '她轻声确认你没有踩进血水。',
        action: '雨窗边收紧黑伞，示意你靠近烛光。',
        tone: '温柔但警惕',
        pose: 'rain_window_wait',
        expression: 'soft_smile',
    },
}));
assert.ok(scriptDirectionVariantPlan.castAssets.some((item) => item.id === 'lishelle' && /nun_rain|rain_window_wait|soft_smile/u.test(item.variantKey || item.mode)));

const queueDirectorState = state({
    location: '王都日常市场',
    time: '白天',
    action: '我先在市场里买苹果。',
    characters: ['莉榭尔·阿尔戈'],
    speaker: '莉榭尔·阿尔戈',
    currentKey: 'market_day',
});
queueDirectorState.visuals.visualNovel.segments = [
    {
        type: 'narration',
        text: '王都市场还在白天喧闹。',
    },
    {
        type: 'narration',
        source: 'world-will-chat',
        text: '/chat 解释一下系统设置和素材映射，不要影响舞台。',
    },
    {
        type: 'dialogue',
        speakerId: 'lishelle',
        speakerName: '莉榭尔',
        text: '雨声从贫民区废钟那边压过来，她把黑伞收紧，示意你别踩进血水。',
    },
];
queueDirectorState.visuals.visualNovel.currentIndex = 2;
const queueDirector = buildVisualNovelStageDirector(queueDirectorState, {
    segments: queueDirectorState.visuals.visualNovel.segments,
    currentIndex: 2,
    backgroundKey: 'market_day',
});
assert.equal(queueDirector.source, 'vn-text-queue');
assert.equal(queueDirector.ignoredChatCount, 1);
assert.ok(['rain_bell', 'arc01_slum_alley_night'].includes(queueDirector.selectedBackdropKey));
assert.ok(queueDirector.candidateBackdropKeys.some((key) => ['rain_bell', 'arc01_slum_alley_night'].includes(key)));

const queueVariantPlan = queueDirector.assetPlan;
assert.ok(queueVariantPlan.castAssets.some((item) => item.id === 'lishelle' && /rain_window_wait|nun_rain|soft_smile/u.test(item.variantKey)));

const narratorOnlyPlan = buildAssetPlan(state({
    location: '王都贫民区盗品蔵',
    action: '屋外传来哨声，旁白推进危险。',
    characters: ['昴', '爱蜜莉雅', '罗姆爷'],
    segment: {
        type: 'narration',
        speakerId: 'narrator',
        speakerName: '世界意志',
        text: '屋外突然传来一声尖锐的哨响，像是某种信号。',
    },
}));
assert.ok(!narratorOnlyPlan.missingAssets.some((item) => item.id === 'narration' || item.id === 'narrator' || item.id === 'world_will'));
assert.ok(narratorOnlyPlan.castAssets.some((item) => item.id === 'protagonist'));

const mysterySpeakerPlan = buildAssetPlan(state({
    location: '王都骑士团旧档案室',
    action: '黑发女人的轮廓站在门后，她没有公开身份。',
    characters: ['protagonist', 'unknown_female', '黑发女人', '陌生女声'],
    speaker: '陌生女声',
    backgroundKey: 'archive',
}));
assert.ok(!mysterySpeakerPlan.missingAssets.some((item) => item.id === 'unknown_female' || item.id === '黑发女人' || item.id === '陌生女声'));
assert.ok(!mysterySpeakerPlan.castAssets.some((item) => item.id === 'elsa'));

const assetFindings = evaluateAssetUse(kitchenPlan, {
    parsedVnScript: {
        backgroundKey: 'market_day',
        castIds: ['rem', 'ram'],
    },
});
assert.ok(assetFindings.some((finding) => /背景素材与场景计划不一致/u.test(finding.title)));

const invalidFindings = evaluateAssetUse(kitchenPlan, {
    parsedVnScript: {
        backgroundKey: 'missing_key',
        castIds: ['rem'],
    },
});
assert.ok(invalidFindings.some((finding) => finding.severity === 'block' && /背景 key 未注册/u.test(finding.title)));

assert.equal(normalizeAssetCharacterId('爱蜜莉雅'), 'emilia');
assert.equal(normalizeAssetCharacterId('莉榭尔·阿尔戈'), 'lishelle');

const summary = summarizeAssetPlan(kitchenPlan, 520);
assert.ok(summary.includes('背景选择'));
assert.ok(summary.includes('mansion_kitchen'));
assert.ok(summary.includes('原文素材参考'));
assert.ok(summary.length <= 520);

console.log(JSON.stringify({
    status: 'pass',
    selected: [
        lootPlan.selectedBackdrop.key,
        kitchenPlan.selectedBackdrop.key,
        archivePlan.selectedBackdrop.key,
        unknownPlan.selectedBackdrop.confidence,
    ],
    missingAssets: unknownPlan.missingAssets.length + invalidKeyPlan.missingAssets.length,
    criticFindings: assetFindings.length + invalidFindings.length,
}, null, 2));
