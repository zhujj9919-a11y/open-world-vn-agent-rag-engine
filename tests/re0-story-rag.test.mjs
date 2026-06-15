import assert from 'node:assert/strict';
import {
    checkStoryRagConflicts,
    retrieveStoryRagWorkset,
    storyRagHealthcheck,
    summarizeStoryRagWorkset,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/story-rag.js';

function stateForArc(arc, overrides = {}) {
    return {
        current: {
            arc,
            day: arc * 100,
            time: '深夜',
            location: overrides.location || '未知地点',
            viewpoint: '玩家',
        },
        worldline: {
            id: overrides.worldlineId || `TEST-ARC-${arc}`,
            divergence: overrides.divergence ?? 0.08,
            attractor: overrides.attractor || '嫉妒/主线',
        },
        ifRouteLogic: {
            dominant: overrides.dominant || 'EnvyMain',
            routePressures: overrides.routePressures || {},
            lastShift: overrides.lastShift || '',
        },
        gameplay: {
            activeObjective: overrides.objective || '',
            objectiveStage: overrides.stage || '',
            lastPlayerAction: overrides.action || '',
            openQuestions: overrides.openQuestions || [],
            actionHints: overrides.actionHints || [],
            deathRisk: {
                lastWarning: overrides.deathWarning || '',
                lastStrategyPivot: overrides.strategyPivot || '',
            },
        },
        discoveredClues: overrides.clues || [],
        characterCards: Object.fromEntries((overrides.characters || []).map((name) => [name, { name }])),
        setup: overrides.setup || {},
        protagonistProfile: overrides.protagonistProfile || {},
        flags: overrides.flags || {},
        visuals: {
            visualNovel: {
                sceneCharacters: overrides.characters || [],
                lastChoiceText: overrides.choice || '',
            },
        },
    };
}

const health = storyRagHealthcheck();
assert.equal(health.status, 'pass');
assert.ok(health.chunks >= 1600);
assert.ok(health.facts >= 3000);
assert.ok(health.constraints >= 10);
assert.ok(health.metadata.sourceStats.webNovelFiles >= 1600);
assert.ok(health.metadata.sourceStats.webNovelChars >= 10_000_000);

const arc1 = retrieveStoryRagWorkset(stateForArc(1, {
    location: '王都赃物库',
    objective: '确认徽章流向并避开艾尔莎袭击',
    characters: ['爱蜜莉雅', '菲鲁特', '罗姆爷'],
    action: '只说可验证的徽章线索，等待莱因哈鲁特迟到入局',
}));
assert.ok(arc1.facts.some((fact) => /徽章|赃物库|艾尔莎/u.test(fact.text)));
assert.ok(arc1.risks.some((risk) => risk.ruleType === 'convergence'));
assert.ok(arc1.hooks.some((hook) => /徽章|赃物库|强者/u.test(hook.text)));
assert.equal(arc1.directorSignals.mode, 'causal-simulator-director');
assert.equal(arc1.architecture.routing.actionMode, 'free-simulation');
assert.ok(arc1.layers.officialCausalMemory.facts.length > 0);
assert.ok(arc1.layers.directorDecision.outputContract.some((rule) => /玩家行动/u.test(rule)));
assert.ok(arc1.candidateSeeds.length >= 4);
assert.ok(arc1.candidateSeeds.some((seed) => seed.type === 'current-action-grounding' && /当前行动|可观察反应/u.test(seed.text)));
assert.ok(arc1.layers.directorDecision.candidateActionSeeds.some((seed) => /当前行动|原作世界规则|因果/u.test(seed.text)));

const arc2 = retrieveStoryRagWorkset(stateForArc(2, {
    location: '罗兹瓦尔宅邸厨房',
    objective: '验证诅咒源并降低蕾姆怀疑',
    characters: ['蕾姆', '拉姆', '碧翠丝'],
    action: '把犬型魔兽咬痕、村庄儿童和魔女余香分开核实',
}));
assert.ok(arc2.facts.some((fact) => /诅咒|魔女余香|魔兽/u.test(fact.text)));
assert.ok(arc2.risks.some((risk) => /雷姆|蕾姆|诅咒/u.test(risk.description)));

const arc4 = retrieveStoryRagWorkset(stateForArc(4, {
    location: '圣域墓所',
    objective: '拒绝强欲契约并争取奥托和加菲尔协作',
    characters: ['艾姬多娜', '奥托', '加菲尔', '碧翠丝'],
    action: '不把死亡当工具，分工处理圣域试炼与宅邸袭击',
}));
assert.ok(arc4.facts.some((fact) => /圣域|死亡回归|奥托|碧翠丝/u.test(fact.text)));
assert.ok(arc4.risks.some((risk) => /宅邸|圣域|碧翠丝/u.test(risk.description)));

const arc7 = retrieveStoryRagWorkset(stateForArc(7, {
    location: '吉努恩海芬',
    objective: '从十秒短循环中识别托德与咒则风险',
    characters: ['失忆蕾姆', '托德', '坦萨'],
    action: '不要求失忆蕾姆立刻恢复旧记忆，先用保护行动换取最低限度协作',
}));
assert.ok(arc7.facts.some((fact) => /失忆|托德|孤岛|短循环/u.test(fact.text)));
assert.ok(arc7.risks.some((risk) => /失忆|蕾姆|循环/u.test(risk.description)));

const arc10 = retrieveStoryRagWorkset(stateForArc(10, {
    location: '王都撤离车队',
    objective: '保存撤离证据链并处理青蛇菲利斯线索',
    characters: ['碧翠丝', '菲利斯', '库珥修'],
    action: '不把抛弃可救之人当成无代价最优解',
}));
assert.ok(arc10.facts.some((fact) => /六枚舌|青蛇|最优解|撤离/u.test(fact.text)));
assert.ok(arc10.risks.some((risk) => /最优解|六枚舌|青蛇/u.test(risk.description)));

const arc3Conflict = checkStoryRagConflicts(stateForArc(3, {
    location: '库珥修宅邸',
    objective: '说服王选阵营协助白鲸与怠惰战',
    characters: ['蕾姆', '库珥修', '威尔海姆'],
}), {
    text: '我向所有人公开说明死亡回归和重置秘密，要求他们立刻相信我。',
});
assert.equal(arc3Conflict.status, 'block');
assert.ok(arc3Conflict.requiredRepairs.some((repair) => /死亡回归/u.test(repair)));

const ifConflict = checkStoryRagConflicts(stateForArc(1, {
    location: '王都小巷',
    dominant: 'Ayamatsu',
}), {
    text: '这一次直接切换到傲慢 IF，路线锁定，不再需要连续偏移和代价。',
});
assert.equal(ifConflict.status, 'warn');
assert.ok(ifConflict.requiredRepairs.some((repair) => /IF/u.test(repair)));

const arc11Conflict = checkStoryRagConflicts(stateForArc(11, {
    location: '废弃钟楼',
    objective: '解释掌心警告和世界线树',
    characters: ['莉榭尔', '剥钟人'],
}), {
    text: '官方第十一篇章原文写道，废弃钟楼就是世界线树的入口。',
});
assert.equal(arc11Conflict.status, 'block');
assert.ok(arc11Conflict.requiredRepairs.some((repair) => /Arc 11|项目原创/u.test(repair)));

const arc11Workset = retrieveStoryRagWorkset(stateForArc(11, {
    location: '废弃钟楼',
    objective: '解释掌心警告、废弃钟楼与世界线树',
    characters: ['莉榭尔', '剥钟人'],
    action: '把掌心警告作为项目原创世界线残响处理，不伪装成官方原文',
}));
assert.ok(arc11Workset.facts.some((fact) => /项目原创|废钟|掌心|世界线树/u.test(fact.text)));
assert.ok(arc11Workset.risks.some((risk) => /project_original|官方|项目原创/u.test(risk.description)));
assert.ok(arc11Workset.chunks.every((chunk) => chunk.digest.length <= 320));

const arc2TopFacts = arc2.facts.slice(0, 3).map((fact) => fact.arc);
assert.ok(arc2TopFacts.every((arc) => arc === 2), `Arc2 top facts should stay arc-local: ${arc2TopFacts.join(',')}`);

const canonAction = retrieveStoryRagWorkset(stateForArc(1, {
    location: '王都赃物库',
    objective: '确认徽章流向',
    action: '【原作线】按原作因果链确认徽章流向，但保留当前存档差异',
    characters: ['爱蜜莉雅', '菲鲁特', '罗姆爷'],
}));
assert.equal(canonAction.directorSignals.mode, 'fate-attractor');
assert.equal(canonAction.architecture.routing.actionMode, 'canon-follow');
assert.equal(canonAction.architecture.routing.followsCanonAction, true);
assert.equal(canonAction.architecture.routing.simulatesFreeAction, false);
assert.ok(canonAction.layers.officialCausalMemory.facts.some((fact) => /徽章|赃物库|艾尔莎|爱蜜莉雅/u.test(fact.text)));
assert.ok(canonAction.directorSignals.attractorStrength >= 0.72);
assert.ok(canonAction.directorSignals.reusePolicy.includes('改写路径'));
assert.ok(canonAction.layers.directorDecision.generationPolicy.includes('原作因果链'));
assert.ok(canonAction.candidateSeeds.some((seed) => seed.type === 'canon-attractor' && /原作牵引|徽章|赃物库|强者/u.test(seed.text)));
assert.ok(canonAction.layers.directorDecision.candidateActionSeeds.every((seed) => seed.mode === 'canon-follow'));

const canonContinuation = retrieveStoryRagWorkset(stateForArc(1, {
    location: '盗品蔵店内',
    objective: '在原作开局下继续核实徽章流向，不泄漏未来知识。',
    action: '坚持追问徽章下落，表示愿意付出代价',
    characters: ['爱蜜莉雅', '罗姆爷'],
    setup: { routePreset: '原作开局' },
    protagonistProfile: { routePreset: '原作开局' },
    flags: { canonFollowActive: true },
}));
assert.equal(canonContinuation.architecture.routing.actionMode, 'canon-follow');
assert.ok(canonContinuation.candidateSeeds.some((seed) => seed.mode === 'canon-follow' && /徽章|原作|罗姆/u.test(seed.text)));

const originalOriginFreeAction = retrieveStoryRagWorkset(stateForArc(1, {
    location: '王都骑士团旧档案室',
    objective: '用现代图书管理员能力调查徽章失窃旧案',
    action: '【自由行动】我暂时不去盗品蔵，而是先核对旧档案室里被涂黑的徽章失窃记录。',
    setup: { origin: '原作开局' },
    protagonistProfile: { origin: '原作开局' },
    characters: ['欧文', '爱蜜莉雅'],
}));
assert.equal(originalOriginFreeAction.architecture.routing.actionMode, 'free-simulation');

const originalOriginIfAction = retrieveStoryRagWorkset(stateForArc(3, {
    location: '罗兹瓦尔宅邸外森林路',
    objective: '测试怠惰压力下的逃避提议',
    action: '【IF 倾向行动】我拉住蕾姆，说我们先离开宅邸和王都纷争，去卡拉拉基重新开始。',
    setup: { origin: '原作开局' },
    protagonistProfile: { origin: '原作开局' },
    characters: ['蕾姆', '拉姆'],
}));
assert.equal(originalOriginIfAction.architecture.routing.actionMode, 'if-attractor');

const explicitFreeSimulationDominant = retrieveStoryRagWorkset(stateForArc(1, {
    location: '王都骑士团旧档案室',
    objective: '通过档案、欧文反应和爱蜜莉雅的信息差，推理黑伞与徽章失窃旧案的联系。',
    dominant: 'FreeSimulation',
    action: '以现代图书管理员的出身优势，请求欧文允许查阅旧案档案，寻找黑伞、封蜡缺页和徽章失窃之间的因果线索。',
    characters: ['欧文', '爱蜜莉雅'],
}));
assert.equal(explicitFreeSimulationDominant.architecture.routing.actionMode, 'free-simulation');

const freeDivergence = retrieveStoryRagWorkset(stateForArc(1, {
    worldlineId: 'FREE-RAG-A',
    location: '王都下层图书馆废室',
    objective: '不追徽章，先调查灰衣人留下的寄存记录和禁书区脚印',
    divergence: 0.42,
    characters: ['莉榭尔·阿尔戈', '菲鲁特'],
    action: '我拒绝立刻去赃物库，带着莉榭尔去图书馆废室核对寄存簿和脚印。',
    clues: ['灰衣人在火灾前寄存木盒', '禁书区门缝有新鲜泥点', '莉榭尔的黑伞能挡住一次钟声残响'],
}));
freeDivergence.flags = { worldSessionId: 'free-rag-session-001' };
freeDivergence.protagonistProfile = { name: '陆临', origin: '现代图书管理员', ability: '目录残响' };
freeDivergence.characterCards = {
    '莉榭尔·阿尔戈': {
        name: '莉榭尔·阿尔戈',
        role: '原创调查同伴',
        trust: 22,
        suspicion: 5,
        trauma: 12,
        attitudeToPlayer: '相信玩家的记录能力，但要求先给她一个可验证证据。',
        memory: ['她记得玩家没有追逐银发半精灵，而是先检查寄存簿。'],
    },
    '菲鲁特': {
        name: '菲鲁特',
        role: '徽章线索持有者',
        trust: 3,
        suspicion: 14,
        memory: ['玩家暂时没有追她，反而让她产生警惕和好奇。'],
    },
};
const freeWorkset = retrieveStoryRagWorkset(freeDivergence, '继续在图书馆废室核对寄存簿，不跳回赃物库。');
assert.equal(freeWorkset.directorSignals.mode, 'causal-simulator-director');
assert.equal(freeWorkset.architecture.routing.actionMode, 'free-simulation');
assert.equal(freeWorkset.architecture.routing.simulatesFreeAction, true);
assert.equal(freeWorkset.architecture.routing.followsCanonAction, false);
assert.ok(freeWorkset.layers.saveScopedMemory.facts.some((entry) => /陆临|现代图书管理员|图书馆|寄存/u.test(entry.text)));
assert.ok(freeWorkset.layers.characterMindMemory.memories.some((entry) => /莉榭尔|证据|寄存簿/u.test(entry.text)));
assert.ok(freeWorkset.layers.officialCausalMemory.risks.length > 0);
assert.ok(freeWorkset.layers.directorDecision.generationPolicy.includes('开放世界选择'));
assert.ok(freeWorkset.candidateSeeds.some((seed) => seed.type === 'save-memory' && /图书馆|寄存/u.test(seed.text)));
assert.ok(freeWorkset.candidateSeeds.some((seed) => seed.type === 'character-memory' && /莉榭尔|证据/u.test(seed.text)));
assert.ok(freeWorkset.candidateSeeds.every((seed) => seed.mode === 'free-simulation'));

const ifAttractor = retrieveStoryRagWorkset(stateForArc(3, {
    location: '王都旅馆',
    objective: '处理逃避责任导致的怠惰 IF 压力',
    dominant: 'Sloth',
    action: '我想看看怠惰 IF 的逻辑如何牵引当前世界，但不要直接切路线',
    characters: ['蕾姆'],
}));
assert.equal(ifAttractor.directorSignals.mode, 'if-attractor-director');
assert.equal(ifAttractor.architecture.routing.actionMode, 'if-attractor');
assert.equal(ifAttractor.architecture.routing.usesIfAttractor, true);
assert.ok(ifAttractor.facts.some((fact) => fact.routeId === 'Sloth')
    || ifAttractor.chunks.some((chunk) => chunk.routeId === 'Sloth'));

const ifRoutePurityMatrix = [
    {
        dominant: 'Ayamatsu',
        aliases: ['Ayamatsu', 'Pride'],
        arc: 1,
        location: '燃烧后的王都屋顶',
        action: '我想沿傲慢 IF 的压力理解这次选择，但不要直接切路线。',
        pattern: /傲慢|Ayamatsu|莱因哈鲁特|王都|燃烧/u,
    },
    {
        dominant: 'Oboreru',
        aliases: ['Oboreru', 'Wrath'],
        arc: 2,
        location: '罗兹瓦尔宅邸外的小路',
        action: '我想沿愤怒 IF 的压力理解这次选择，但不要直接切路线。',
        pattern: /愤怒|Oboreru|信任|肃清|雷姆|蕾姆/u,
    },
    {
        dominant: 'Kasaneru',
        aliases: ['Kasaneru', 'Greed'],
        arc: 4,
        location: '圣域墓所',
        action: '我想沿强欲 IF 的压力理解这次选择，但不要直接切路线。',
        pattern: /强欲|Kasaneru|艾姬多娜|死亡|契约/u,
    },
    {
        dominant: 'Tsugihagu',
        aliases: ['Tsugihagu', 'Gluttony'],
        arc: 6,
        location: '普勒阿得斯监视塔',
        action: '我想沿暴食 IF 的压力理解这次选择，但不要直接切路线。',
        pattern: /暴食|Gluttony|Tsugihagu|记忆|身份/u,
    },
];
for (const scenario of ifRoutePurityMatrix) {
    const workset = retrieveStoryRagWorkset(stateForArc(scenario.arc, {
        location: scenario.location,
        objective: `${scenario.dominant} IF 路线压力审计`,
        dominant: scenario.dominant,
        action: scenario.action,
        characters: ['爱蜜莉雅', '蕾姆', '碧翠丝', '艾姬多娜'],
    }), scenario.action, { factLimit: 8, chunkLimit: 5 });
    assert.equal(workset.architecture.routing.actionMode, 'if-attractor', scenario.dominant);
    const routeHits = [
        ...workset.facts.slice(0, 5).map((fact) => fact.routeId),
        ...workset.chunks.slice(0, 3).map((chunk) => chunk.routeId),
    ].filter((routeId) => scenario.aliases.includes(routeId));
    assert.ok(routeHits.length >= 2, `${scenario.dominant}: IF RAG should prefer its own route aliases, got facts=${workset.facts.map((fact) => fact.routeId || '-').join(',')}`);
    assert.ok(workset.facts.some((fact) => scenario.pattern.test(fact.text))
        || workset.chunks.some((chunk) => scenario.pattern.test(chunk.digest)), `${scenario.dominant}: missing route-specific IF causal content`);
}

const worldEssence = retrieveStoryRagWorkset(stateForArc(4, {
    location: '圣域墓所',
    objective: '追问400年前魔女、神龙、贤者与圣域试炼的世界本质',
    action: '调查四百年前嫉妒魔女、魔女因子、神龙和贤者的因果锚点',
    characters: ['艾姬多娜'],
}));
assert.ok(worldEssence.query.worldEssenceQuery);
assert.equal(worldEssence.architecture.routing.actionMode, 'world-essence-simulation');
assert.equal(worldEssence.architecture.routing.simulatesFreeAction, true);
assert.ok(worldEssence.facts.some((fact) => /400|四百|嫉妒魔女|魔女因子|神龙|贤者/u.test(fact.text)));
assert.ok(worldEssence.chunks.some((chunk) => chunk.canonLevel === 'official_reference' || chunk.sourceType === 'story_database' || chunk.causalTier === 'world-essence'));
assert.ok(worldEssence.candidateSeeds.some((seed) => /^world-essence/u.test(seed.type) && /魔女因子|神龙|贤者|四百|400/u.test(seed.text)));

const saveMemoryState = stateForArc(1, {
    worldlineId: 'SAVE-RAG-A',
    location: '王都贫民区 / 废弃钟楼地下甬道',
    objective: '把掌心警告、灰衣寄存木盒和银发警告分开核实',
    characters: ['莉榭尔·阿尔戈', '罗姆爷'],
    action: '先回应莉榭尔失去一段记忆的代价，再决定是否追银发半精灵',
    clues: ['掌心写着第三次死亡前不要相信银发半精灵', '灰衣服的人在赃物库火灾前寄存木盒'],
});
saveMemoryState.flags = { worldSessionId: 'world-save-rag-001' };
saveMemoryState.protagonistProfile = { name: '陆临', origin: '现代图书管理员', ability: '死亡残响读解' };
saveMemoryState.setup = { origin: '现代图书管理员', firstNpc: '莉榭尔·阿尔戈', initialScenario: '掌心警告开局' };
saveMemoryState.presence = { sceneCharacters: ['莉榭尔·阿尔戈', '罗姆爷'], areaCharacters: ['菲鲁特'] };
saveMemoryState.gameplay.deathRisk = {
    lastWarning: '第七下钟声会让剥钟人覆写目击者的脸',
    lastStrategyPivot: '不要单独进入甬道，先让莉榭尔记录祷文代价',
};
saveMemoryState.characterCards = {
    '莉榭尔·阿尔戈': {
        name: '莉榭尔·阿尔戈',
        role: '原创调查同伴',
        trust: 18,
        suspicion: 9,
        trauma: 16,
        affection: 8,
        conflict: 12,
        attitudeToPlayer: '愿意继续记录玩家异常，但担心自己再次丢失记忆。',
        memory: ['第1日：她用祷文阻断第七下钟声，代价是一段记忆。'],
        hobbies: ['旧祷文', '黑伞'],
    },
    '罗姆爷': {
        name: '罗姆爷',
        role: '赃物库证人',
        trust: 7,
        suspicion: 4,
        memory: ['灰衣人曾在火灾前寄存一只木盒。'],
    },
};
saveMemoryState.deathBranches = [{
    branchId: 'D-001',
    cause: '第七下钟声后剥钟人覆写玩家的脸',
    strategyPivot: '不要单独进入甬道，先让莉榭尔记录祷文代价',
    retainedResidue: ['第三次死亡前不要相信银发半精灵'],
}];
const saveMemoryWorkset = retrieveStoryRagWorkset(saveMemoryState, '让莉榭尔先记录祷文代价，再核实掌心警告。');
assert.equal(saveMemoryWorkset.runtimeMemory.sessionId, 'world-save-rag-001');
assert.equal(saveMemoryWorkset.layers.saveScopedMemory.scope, 'world-save-rag-001');
assert.equal(saveMemoryWorkset.layers.deathReturnMemory.scope, 'world-save-rag-001');
assert.ok(saveMemoryWorkset.runtimeMemory.saveFacts.some((entry) => /陆临|现代图书管理员|死亡残响/u.test(entry.text)));
assert.ok(saveMemoryWorkset.runtimeMemory.characterMemories.some((entry) => /莉榭尔|祷文|记忆/u.test(entry.text)));
assert.ok(saveMemoryWorkset.runtimeMemory.deathMemories.some((entry) => /第七下钟声|剥钟人|甬道/u.test(entry.text)));
assert.ok(saveMemoryWorkset.layers.deathReturnMemory.lessons.some((entry) => /第七下钟声|剥钟人/u.test(entry.text)));
const saveMemorySummary = summarizeStoryRagWorkset(saveMemoryWorkset, 1300);
assert.ok(saveMemorySummary.length <= 1300);
assert.ok(saveMemorySummary.includes('当前存档热记忆'));
assert.ok(saveMemorySummary.includes('角色/关系记忆'));
assert.ok(saveMemorySummary.includes('死亡/回滚记忆'));

const ragModeMatrix = [
    {
        name: 'canon arc2 mansion curse',
        expected: 'canon-follow',
        workset: retrieveStoryRagWorkset(stateForArc(2, {
            location: '罗兹瓦尔宅邸走廊',
            objective: '按原作线核实诅咒和村庄魔兽源头',
            characters: ['蕾姆', '拉姆', '碧翠丝'],
            action: '【原作线】按原作因果链先处理诅咒，不把蕾姆的怀疑跳过。',
        })),
        pattern: /诅咒|魔女余香|魔兽|蕾姆/u,
    },
    {
        name: 'free arc3 anti whale detour',
        expected: 'free-simulation',
        workset: retrieveStoryRagWorkset(stateForArc(3, {
            location: '卡拉拉基商路临时驿站',
            objective: '暂不参加白鲸讨伐，先调查商队失踪和雾中账本',
            divergence: 0.31,
            characters: ['奥托', '威尔海姆'],
            action: '我先跟奥托核对商队账本，判断白鲸雾是否已经改变商路。',
        })),
        pattern: /白鲸|商队|奥托|雾/u,
    },
    {
        name: 'canon arc3 white whale sloth alliance',
        expected: 'canon-follow',
        workset: retrieveStoryRagWorkset(stateForArc(3, {
            location: '王选会议厅 · 白鲸活动与怠惰位置协商',
            objective: '以可验证证据促成白鲸讨伐与怠惰防线协商，不能把预言当证据',
            characters: ['库珥修', '安娜塔西亚', '威尔海姆', '尤里乌斯'],
            action: '【原作行动】我把白鲸活动、商路损失和怠惰袭击窗口拆成可验证证据，先请求库珥修和安娜塔西亚核对情报。',
            clues: ['白鲸活动', '怠惰位置', '撤离路线'],
        })),
        pattern: /白鲸|怠惰|库珥修|安娜塔西亚|威尔海姆/u,
    },
    {
        name: 'world essence sanctuary',
        expected: 'world-essence-simulation',
        workset: retrieveStoryRagWorkset(stateForArc(4, {
            location: '圣域墓所',
            objective: '追问四百年前圣域和魔女因子的因果源头',
            characters: ['艾姬多娜', '加菲尔'],
            action: '调查四百年前魔女因子和圣域试炼如何约束现在。',
        })),
        pattern: /四百|400|圣域|魔女因子|试炼/u,
    },
    {
        name: 'canon arc4 sanctuary trial despite world terms',
        expected: 'canon-follow',
        workset: retrieveStoryRagWorkset(stateForArc(4, {
            location: '圣域墓所外 · 试炼与结界分歧',
            objective: '确认圣域试炼、结界规则、宅邸袭击和罗兹瓦尔剧本之间的因果约束',
            characters: ['爱蜜莉雅', '加菲尔', '罗兹瓦尔', '碧翠丝'],
            action: '【原作行动】我不再用死亡硬刷答案，而是先让爱蜜莉雅保留自主选择，同时向加菲尔确认结界与墓所试炼规则。',
            clues: ['圣域结界', '墓所试炼', '罗兹瓦尔剧本', '碧翠丝契约'],
        })),
        pattern: /圣域|试炼|结界|罗兹瓦尔|碧翠丝|加菲尔/u,
    },
    {
        name: 'if greed pressure',
        expected: 'if-attractor',
        workset: retrieveStoryRagWorkset(stateForArc(4, {
            location: '圣域墓所',
            objective: '用强欲 IF 的逻辑评估是否把死亡当成刷最优解工具',
            dominant: 'Greed',
            characters: ['艾姬多娜'],
            action: '我想沿强欲 IF 的压力理解这次选择，但不要直接切路线。',
        })),
        pattern: /强欲|死亡|契约|艾姬多娜/u,
    },
];
for (const scenario of ragModeMatrix) {
    assert.equal(scenario.workset.architecture.routing.actionMode, scenario.expected, scenario.name);
    assert.ok(scenario.workset.layers.officialCausalMemory.facts.length > 0, `${scenario.name}: missing official facts`);
    assert.ok(scenario.workset.facts.some((fact) => scenario.pattern.test(fact.text))
        || scenario.workset.risks.some((risk) => scenario.pattern.test(risk.description))
        || scenario.workset.hooks.some((hook) => scenario.pattern.test(hook.text)), `${scenario.name}: missing causal match`);
    assert.ok(scenario.workset.layers.directorDecision.decisionProtocol.length >= 4, `${scenario.name}: missing decision protocol`);
    assert.ok(scenario.workset.candidateSeeds.length >= 3, `${scenario.name}: missing candidate seeds`);
    assert.equal(scenario.workset.layers.directorDecision.candidateActionSeeds.length, scenario.workset.candidateSeeds.length, `${scenario.name}: layered seeds mismatch`);
}

const summary = summarizeStoryRagWorkset(arc1, 900);
assert.ok(summary.length <= 900);
assert.ok(!/第0015章[\s\S]{500,}/u.test(summary), 'summary should not inject long raw chapter text');
assert.ok(summary.includes('本轮应保留事实'));
assert.ok(summary.includes('导演模式'));
assert.ok(summary.includes('架构路由'));
assert.ok(summary.includes('记忆边界'));
assert.ok(summary.includes('候选行动 RAG 种子'));

console.log(JSON.stringify({
    status: 'pass',
    health,
    arc1: { facts: arc1.facts.length, risks: arc1.risks.length, hooks: arc1.hooks.length },
    arc2: { facts: arc2.facts.length, risks: arc2.risks.length, hooks: arc2.hooks.length },
    arc4: { facts: arc4.facts.length, risks: arc4.risks.length, hooks: arc4.hooks.length },
    arc7: { facts: arc7.facts.length, risks: arc7.risks.length, hooks: arc7.hooks.length },
    arc10: { facts: arc10.facts.length, risks: arc10.risks.length, hooks: arc10.hooks.length },
    arc11: { facts: arc11Workset.facts.length, risks: arc11Workset.risks.length, hooks: arc11Workset.hooks.length },
    directorModes: [canonAction.directorSignals.mode, ifAttractor.directorSignals.mode, worldEssence.directorSignals.mode],
    architectureModes: ragModeMatrix.map((scenario) => scenario.workset.architecture.routing.actionMode),
    conflictStatuses: [arc3Conflict.status, ifConflict.status, arc11Conflict.status],
    summaryChars: summary.length,
}, null, 2));
