import assert from 'node:assert/strict';
import {
    buildAgentTurnPlan,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/agent-turn-plan.js';
import {
    buildRe0AgentTurn,
    validateRe0AgentTurn,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/re0-agent-module.js';
import {
    retrieveStoryRagWorkset,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/story-rag.js';
import {
    buildVisualNovelStageDirector,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/vn-stage-director.js';
import {
    buildVisualNovelRoleMetrics,
    extractVisualNovelScriptBlock,
    findVisualNovelEmbeddedDialogue,
    splitVisualNovelEmbeddedDialogueSegments,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/vn-script.js';

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function stateForDirector({
    arc = 1,
    location = '王都赃物库',
    action = '【原作线】确认徽章流向，但保留当前存档差异。',
    objective = '确认当前目标',
    stage = '',
    characters = ['爱蜜莉雅', '菲鲁特'],
    dominant = 'EnvyMain',
    divergence = 0.08,
    setup = {},
    visualNovel = {},
    deathBranches = [],
    characterCards = {},
    clues = [],
} = {}) {
    const cards = Object.fromEntries(characters.map((name) => [name, {
        name,
        role: '当前场景角色',
        trust: 8,
        suspicion: 6,
        affection: 0,
        conflict: 2,
        memory: [`${name}记得玩家上一轮行动留下了可验证痕迹。`],
    }]));
    return {
        mode: 'main',
        current: {
            arc,
            day: arc * 100,
            time: '深夜',
            location,
            viewpoint: '玩家',
            castIds: characters,
        },
        setup: {
            phase: 'locked',
            routePreset: setup.routePreset || '原创默认开局',
            protagonistName: setup.protagonistName || '陆临',
            origin: setup.origin || '现代图书管理员',
            birthplace: setup.birthplace || location,
            firstNpc: setup.firstNpc || characters[0] || '',
            initialScenario: setup.initialScenario || objective,
            ability: setup.ability || '目录残响',
            traits: setup.traits || ['谨慎取证'],
        },
        protagonistProfile: {
            name: setup.protagonistName || '陆临',
            origin: setup.origin || '现代图书管理员',
            ability: setup.ability || '目录残响',
            customProfileNotes: setup.customProfileNotes || '',
        },
        flags: {
            worldSessionId: `director-flow-${arc}-${dominant}`,
            lastNarrativeActionCommitment: {
                text: action,
                source: 'choice',
                choiceType: 'normal',
                choiceSource: dominant === 'EnvyMain' ? 'canon-or-free' : 'if-attractor',
                location,
                objective,
                stage,
                committedAt: '2026-06-06T00:00:00.000Z',
                status: 'pending-narrative-payoff',
            },
            canonFollowActive: /原作线|追随原作|正典/u.test(action),
        },
        worldline: {
            id: `WL-${arc}-${dominant}`,
            divergence,
            attractor: dominant === 'EnvyMain' ? '嫉妒/主线' : dominant,
        },
        ifRouteLogic: {
            dominant,
            routePressures: dominant === 'EnvyMain' ? {} : { [dominant]: 72 },
            lastShift: dominant === 'EnvyMain' ? '' : `玩家行动正在靠近 ${dominant} IF 吸引域，但尚未硬切路线。`,
        },
        gameplay: {
            activeObjective: objective,
            objectiveStage: stage,
            lastPlayerAction: action,
            lastOutcome: '',
            openQuestions: ['这个行动会让谁立刻反应？', '下一步能验证什么？'],
            actionHints: [
                '先让当前行动落地，再观察在场者反应。',
                '保留一个可验证证据，不把死亡回归公开。',
            ],
            resources: {},
            failurePressure: [],
            deathRisk: {
                lastWarning: deathBranches.length ? '上一轮失败已经证明单人硬闯会触发死亡 flag。' : '',
                lastStrategyPivot: deathBranches.at(-1)?.strategyPivot || '',
            },
        },
        discoveredClues: clues,
        deathBranches,
        characterCards: {
            ...cards,
            ...characterCards,
        },
        presence: {
            sceneCharacters: characters,
            areaCharacters: characters,
        },
        visuals: {
            sceneBackdrop: {
                currentKey: visualNovel.backgroundKey || 'rain_bell',
            },
            visualNovel: {
                sceneCharacters: characters,
                castIds: characters,
                currentSpeakerName: visualNovel.currentSpeakerName || characters[0] || '',
                backgroundKey: visualNovel.backgroundKey || '',
                currentIndex: visualNovel.currentIndex || 0,
                segments: visualNovel.segments || [],
                choices: visualNovel.choices || [],
            },
        },
        storyFlow: {
            turnsInScene: visualNovel.turnsInScene || 0,
            currentScenePurpose: objective,
            lastMainlinePulse: stage,
        },
    };
}

function turnFor(state, action = state.gameplay.lastPlayerAction) {
    const storyRagWorkset = retrieveStoryRagWorkset(state, action);
    const plan = buildAgentTurnPlan(state, {
        rawText: action,
        source: 'choice',
        sceneLock: state.current.location,
    }, {
        storyRagWorkset,
        contextWorkset: {
            hot: [{
                id: 'current-scene',
                title: '当前镜头',
                summary: `${state.current.location} / ${state.gameplay.activeObjective}`,
            }],
        },
    });
    const turn = buildRe0AgentTurn(state, {
        rawText: action,
        source: 'choice',
        sceneLock: state.current.location,
    }, {
        storyRagWorkset,
        contextWorkset: {
            hot: [{
                id: 'current-scene',
                title: '当前镜头',
                summary: `${state.current.location} / ${state.gameplay.activeObjective}`,
            }],
        },
    });
    return { storyRagWorkset, plan, turn };
}

function assertDirectorContract({ plan, turn }, expectedMode) {
    assert.equal(plan.routing.mode, expectedMode);
    assert.equal(turn.storyRag.actionMode, expectedMode);
    assert.equal(plan.directorPlan.candidateActionPolicy.mustGroundInCurrentScene, true);
    assert.ok(plan.narrativeDirector.candidateSeeds.length >= 3);
    assert.ok(plan.directorPlan.candidateActionPolicy.ragSeededChoices.length >= 3);
    assert.ok(plan.directorPlan.firstBeat.includes('玩家行动') || plan.directorPlan.firstBeat.includes(plan.playerAction.rawText.slice(0, 8)));
    assert.ok(plan.narrativeDirector.promptDirectives.some((item) => /第一拍|玩家行动/u.test(item)));
    assert.ok(plan.narrativeDirector.evaluatorRules.some((item) => /VN_SCRIPT|行动|open loop/u.test(item)));
    assert.ok(plan.validators.candidateActionsMustBeCurrentSceneGrounded);
    assert.ok(plan.validators.sceneJumpRequiresExplicitPlayerIntent);
    assert.ok(turn.validation.gates.sceneJumpRequiresIntent);
}

function testSpeakerResolver(label = '') {
    const source = String(label || '');
    if (source.includes('米娅')) {
        return { id: 'mia', name: '米娅' };
    }
    if (source.includes('莉榭尔')) {
        return { id: 'lishelle', name: '莉榭尔' };
    }
    if (source.includes('欧文')) {
        return { id: 'owen', name: '欧文' };
    }
    return null;
}

const embeddedDialogueSegments = splitVisualNovelEmbeddedDialogueSegments([{
    id: 'embedded-1',
    type: 'narration',
    speakerId: 'narrator',
    speakerName: '世界意志',
    text: '米娅紧紧抓着我的袖子，声音颤抖：「他们……是冲我们来的吗？」雨声压低了她的尾音。',
}, {
    id: 'embedded-2',
    type: 'narration',
    speakerId: 'narrator',
    speakerName: '世界意志',
    text: '欧文领我来到标记着「王都旧案·非公开」的档案架前，用钥匙打开柜门。',
}], { resolveSpeaker: testSpeakerResolver });
assert.ok(embeddedDialogueSegments.some((segment) => segment.type === 'dialogue' && segment.speakerId === 'mia' && /冲我们来/u.test(segment.text)));
assert.ok(embeddedDialogueSegments.some((segment) => segment.type === 'narration' && /王都旧案/u.test(segment.text)));
assert.equal(findVisualNovelEmbeddedDialogue('欧文领我来到标记着「王都旧案·非公开」的档案架前。', { resolveSpeaker: testSpeakerResolver }), null);

const canonArc1 = stateForDirector({
    arc: 1,
    location: '王都赃物库',
    objective: '按原作线确认徽章流向，等待强者入局但不抹掉当前存档差异',
    action: '【原作线】不抢夺菲鲁特的徽章，用交换条件拖到爱蜜莉雅或莱因哈鲁特入场。',
    characters: ['爱蜜莉雅', '菲鲁特', '罗姆爷'],
    setup: {
        routePreset: '原作开局',
        birthplace: '王都主街初召唤',
        initialScenario: '徽章失窃目击',
    },
    visualNovel: {
        backgroundKey: 'loot_house',
    },
});
const canonArc1Turn = turnFor(canonArc1);
assertDirectorContract(canonArc1Turn, 'canon-follow');
assert.equal(canonArc1Turn.plan.routing.followsCanonAction, true);
assert.ok(canonArc1Turn.storyRagWorkset.layers.officialCausalMemory.facts.some((fact) => /徽章|赃物库|艾尔莎|爱蜜莉雅/u.test(fact.text)));
assert.ok(canonArc1Turn.plan.narrativeDirector.scope.routeMode === 'canon-attractor');
assert.equal(canonArc1Turn.plan.narrativeDirector.arcDuty.source, 'canon-rag-generated');
assert.ok(canonArc1Turn.plan.directorPlan.consequenceBeats.some((beat) => /原作因果功能|当前存档差异/u.test(beat)));
assert.ok(canonArc1Turn.plan.narrativeDirector.arcDuty.longRangeGoal.includes('原作行动'));
assert.ok(canonArc1Turn.plan.directorPlan.candidateActionPolicy.ragSeededChoices.some((choice) => /徽章|赃物库|原作/u.test(choice)));

const canonArc4 = stateForDirector({
    arc: 4,
    location: '圣域墓所入口',
    objective: '按原作主线处理圣域结界、试炼、罗兹瓦尔剧本和碧翠丝契约',
    action: '【原作线】先确认圣域结界规则，再让爱蜜莉雅保留自主选择进入试炼。',
    characters: ['爱蜜莉雅', '罗兹瓦尔', '艾姬多娜'],
    setup: {
        routePreset: '原作开局',
        birthplace: '圣域墓所入口',
        initialScenario: '圣域试炼分歧',
    },
    visualNovel: {
        backgroundKey: 'sanctuary_tomb',
        segments: Array.from({ length: 7 }, (_, index) => ({
            type: index % 2 ? 'dialogue' : 'narration',
            speakerId: index % 2 ? 'emilia' : 'narrator',
            speakerName: index % 2 ? '爱蜜莉雅' : '世界意志',
            text: `圣域结界测试段 ${index + 1}`,
        })),
        currentIndex: 6,
        turnsInScene: 3,
    },
});
const canonArc4Turn = turnFor(canonArc4);
assertDirectorContract(canonArc4Turn, 'canon-follow');
assert.equal(canonArc4Turn.plan.narrativeDirector.sceneClock.mustTransitionSoon, true);
assert.ok(['reveal', 'payoff', 'transition'].includes(canonArc4Turn.plan.narrativeDirector.beat.type));
assert.equal(canonArc4Turn.plan.narrativeDirector.arcDuty.source, 'canon-rag-generated');
assert.ok(canonArc4Turn.plan.narrativeDirector.arcDuty.longRangeGoal.includes('圣域'));

const projectFinaleArc11 = stateForDirector({
    arc: 11,
    location: '废弃钟楼',
    objective: '解释掌心警告、废弃钟楼与世界线树之间的原创终局因果',
    action: '我要求世界意志把掌心警告作为项目原创世界线残响处理，不伪装成官方原文。',
    characters: ['莉榭尔', '剥钟人'],
    visualNovel: {
        backgroundKey: 'rain_bell',
    },
});
const projectFinaleArc11Turn = turnFor(projectFinaleArc11);
assert.equal(projectFinaleArc11Turn.plan.narrativeDirector.arcDuty.source, 'project-original-fallback');
assert.ok(projectFinaleArc11Turn.plan.narrativeDirector.arcDuty.longRangeGoal.includes('不能伪装成官方原文'));

const slothIf = stateForDirector({
    arc: 3,
    location: '王都旅馆',
    objective: '处理逃避王选失败与怠惰危机造成的怠惰 IF 压力',
    action: '我想看看怠惰 IF 的逻辑如何牵引当前世界，但不要直接切路线。',
    characters: ['蕾姆'],
    dominant: 'Sloth',
    divergence: 0.48,
    clues: ['王选谈判失败后，逃避责任的念头正在变成可见代价。'],
});
const slothIfTurn = turnFor(slothIf);
assertDirectorContract(slothIfTurn, 'if-attractor');
assert.equal(slothIfTurn.plan.routing.usesIfAttractor, true);
assert.ok(slothIfTurn.storyRagWorkset.directorSignals.generationPolicy.includes('不允许一次点击硬切路线'));
assert.ok(slothIfTurn.plan.directorPlan.consequenceBeats.some((beat) => /压力|误读|纠偏入口|IF/u.test(beat)));

const freeArchive = stateForDirector({
    arc: 1,
    location: '王都下层图书馆废室',
    objective: '不追徽章，先调查灰衣人留下的寄存记录和禁书区脚印',
    action: '我拒绝立刻去赃物库，带着莉榭尔去图书馆废室核对寄存簿和脚印。',
    characters: ['莉榭尔·阿尔戈', '菲鲁特'],
    divergence: 0.43,
    setup: {
        routePreset: '原创默认开局',
        birthplace: '王都下层图书馆废室',
        firstNpc: '莉榭尔·阿尔戈',
        origin: '现代图书管理员',
        initialScenario: '寄存簿与灰衣人',
    },
    clues: ['灰衣人在火灾前寄存木盒', '禁书区门缝有新鲜泥点'],
    characterCards: {
        '莉榭尔·阿尔戈': {
            name: '莉榭尔·阿尔戈',
            role: '原创调查同伴',
            trust: 22,
            suspicion: 5,
            attitudeToPlayer: '相信玩家的记录能力，但要求先给她一个可验证证据。',
            memory: ['她记得玩家没有追逐银发半精灵，而是先检查寄存簿。'],
        },
    },
    visualNovel: {
        backgroundKey: 'archive',
    },
});
const freeArchiveTurn = turnFor(freeArchive);
assertDirectorContract(freeArchiveTurn, 'free-simulation');
assert.equal(freeArchiveTurn.plan.routing.simulatesFreeAction, true);
assert.equal(freeArchiveTurn.plan.routing.followsCanonAction, false);
assert.ok(freeArchiveTurn.plan.memoryUse.saveFacts.some((fact) => /现代图书管理员|图书馆|寄存/u.test(fact)));
assert.ok(freeArchiveTurn.plan.memoryUse.characterMemories.some((memory) => /莉榭尔|证据|寄存簿/u.test(memory)));
assert.ok(freeArchiveTurn.plan.directorPlan.consequenceBeats.some((beat) => /开放世界逻辑/u.test(beat)));
assert.equal(freeArchiveTurn.plan.assetPlan.selectedBackdrop.key, 'archive');
assert.ok(freeArchiveTurn.plan.narrativeDirector.arcDuty.longRangeGoal.includes('自由行动'));
assert.ok(freeArchiveTurn.plan.directorPlan.candidateActionPolicy.ragSeededChoices.some((choice) => /图书馆|寄存|莉榭尔/u.test(choice)));

const deathLoop = stateForDirector({
    arc: 1,
    location: '废弃钟楼地下甬道',
    objective: '带着死亡回滚教训重新接近第七下钟声',
    action: '让莉榭尔先记录祷文代价，再靠近第七下钟声。',
    characters: ['莉榭尔·阿尔戈'],
    clues: ['第七下钟声会让剥钟人覆写目击者的脸'],
    deathBranches: [{
        branchId: 'D-FLOW-001',
        cause: '第七下钟声后剥钟人覆写玩家的脸',
        wrongAssumption: '玩家以为单人接近甬道不会触发身份覆写。',
        strategyPivot: '不要单独进入甬道，先让莉榭尔记录祷文代价。',
        retainedResidue: ['不要公开死亡回归秘密'],
    }],
    visualNovel: {
        backgroundKey: 'arc01_bell_tower_interior',
    },
});
const deathLoopTurn = turnFor(deathLoop);
assert.equal(deathLoopTurn.plan.routing.mode, 'free-simulation');
assert.ok(deathLoopTurn.plan.memoryUse.deathLessons.some((lesson) => /第七下钟声|剥钟人|祷文/u.test(lesson)));
assert.ok(deathLoopTurn.plan.memoryUse.forbiddenPublicFacts.some((fact) => /死亡回归/u.test(fact)));
assert.ok(['aftermath', 'survival'].includes(deathLoopTurn.plan.narrativeDirector.beat.type));

const scriptState = stateForDirector({
    arc: 1,
    location: '王都赃物库',
    objective: '确认徽章与艾尔莎入场前的交易窗口',
    characters: ['爱蜜莉雅', '菲鲁特', '罗姆爷'],
    visualNovel: {
        backgroundKey: 'loot_house',
    },
});
const structuredSegments = [
    {
        type: 'narration',
        source: 'chat',
        speakerId: 'world_will',
        speakerName: '世界意志',
        text: '/chat 这只是系统对话，不应驱动舞台演出。',
    },
    {
        type: 'dialogue',
        speakerId: 'emilia',
        speakerName: '爱蜜莉雅',
        text: '先别靠近门。徽章还在菲鲁特手里，但这里的杀意比交易本身更早到了。',
        action: '伸手挡在玩家身前',
        tone: '警惕',
        expression: 'vulnerable',
        pose: 'hand_reach',
        camera: 'close',
        focus: '徽章与门缝',
    },
    {
        type: 'dialogue',
        speakerId: 'felt',
        speakerName: '菲鲁特',
        text: '喂，别把我当诱饵。买家没来之前，谁都别想碰这东西。',
        action: '把徽章藏进掌心',
        tone: '戒备',
        expression: 'cold',
        pose: 'guarded',
    },
];
const roleMetrics = buildVisualNovelRoleMetrics(structuredSegments);
assert.equal(roleMetrics.roleDrivenPass, true);
assert.ok(roleMetrics.directSpeakerNames.includes('爱蜜莉雅'));
const stageDirector = buildVisualNovelStageDirector(scriptState, {
    currentIndex: 1,
    backgroundKey: 'loot_house',
    segments: structuredSegments,
}, {
    fallbackText: '王都赃物库里，徽章交易正在逼近艾尔莎入场。',
});
assert.equal(stageDirector.source, 'vn-text-queue');
assert.ok(stageDirector.ignoredChatCount >= 1);
assert.equal(stageDirector.currentSegment.speakerId, 'emilia');
assert.equal(stageDirector.selectedBackdropKey, 'loot_house');
assert.ok(stageDirector.assetPlan.candidateBackdrops.some((item) => item.key === 'loot_house'));

const invalidCandidateValidation = validateRe0AgentTurn({
    state: freeArchive,
    playerAction: { rawText: freeArchive.gameplay.lastPlayerAction },
    plan: freeArchiveTurn.plan,
    assistantText: '若干时间后，你突然抵达圣域。',
    renderedBackdropKey: 'sanctuary',
    renderedCastIds: ['echidna'],
    candidates: ['【主线线】突然去圣域推进试炼', '【原作线】硬回赃物库'],
});
assert.ok(['repair', 'warn'].includes(invalidCandidateValidation.status));
assert.ok(invalidCandidateValidation.findings.some((finding) => /候选行动|素材|舞台角色|背景/u.test(`${finding.title} ${finding.detail}`)));

const noisyHiddenScript = extractVisualNovelScriptBlock(`
王都赃物库里，门轴发出轻响。
<!-- RE0_VN_SCRIPT {"version":"vn60","backgroundKey":"loot_house","castIds":["felt"],"segments":[{"type":"dialogue","speakerId":"felt","text":"别靠太近。"}],"choices":["后退半步"]} 多余尾噪声 -->
`);
assert.equal(noisyHiddenScript.sourceMode, 'hidden-comment');
assert.equal(noisyHiddenScript.script.backgroundKey, 'loot_house');
assert.equal(noisyHiddenScript.script.segments[0].speakerId, 'felt');

const unclosedHiddenScript = extractVisualNovelScriptBlock(`
罗姆爷把布袋放在柜台上，雨声压住所有人的呼吸。
<!-- RE0_VN_SCRIPT {"version":"vn60","backgroundKey":"loot_house","castIds":["rom","emilia"],"segments":[{"type":"dialogue","speakerId":"rom","text":"今晚有人来取货。"}],"choices":["追问买家身份","先让爱蜜莉雅表态"]}
`);
assert.equal(unclosedHiddenScript.sourceMode, 'hidden-comment-unclosed');
assert.equal(unclosedHiddenScript.script.backgroundKey, 'loot_house');
assert.equal(unclosedHiddenScript.script.choices.length, 2);
assert.match(unclosedHiddenScript.warning, /缺少闭合/u);

const missingSegmentArrayClose = extractVisualNovelScriptBlock(`
王都赃物库里，门外雨声忽然变重。
<!-- RE0_VN_SCRIPT {"version":"vn60","backgroundKey":"loot_house","castIds":["felt","rom"],"segments":[{"type":"dialogue","speakerId":"felt","text":"买家今晚就来。"},{"type":"narration","text":"雨声掩住脚步。"},"choices":["追问买家身份","确认徽章位置"],"statePatch":{"current":{"location":"王都贫民区盗品蔵"}}} -->
`);
assert.equal(missingSegmentArrayClose.sourceMode, 'hidden-comment');
assert.equal(missingSegmentArrayClose.script.segments.length, 2);
assert.equal(missingSegmentArrayClose.script.choices.length, 2);

const extraBeatCloseBeforeChoices = extractVisualNovelScriptBlock(`
罗姆爷把柜台边的铁盒往阴影里推了半寸。
<!-- RE0_VN_SCRIPT {"version":"vn60","backgroundKey":"loot_house","castIds":["protagonist","emilia","felt","rom"],"scene":{"location":"盗品蔵内部","time":"雨夜","mood":"紧张对峙"},"segments":[{"type":"narration","text":"昴盯住铁盒边缘的银光，爱蜜莉雅的指尖也在袖口里收紧。"},{"type":"dialogue","speakerId":"rom","text":"买家今晚子时之前就会来取。"}],"beat":{"type":"reveal","summary":"确认徽章位置和菲鲁特现身","progressDelta":[{"clue":"徽章位置确认","delta":1}]}},"choices":["直接质问菲鲁特为什么要偷爱蜜莉雅的徽章","提出用更高价格买回徽章，试探罗姆爷的态度","假装离开，观察菲鲁特和罗姆爷的后续动作","要求先验看徽章真伪，拖延时间等待机会"]} -->
`);
assert.equal(extraBeatCloseBeforeChoices.sourceMode, 'hidden-comment');
assert.equal(extraBeatCloseBeforeChoices.script.beat.summary, '确认徽章位置和菲鲁特现身');
assert.equal(extraBeatCloseBeforeChoices.script.choices.length, 4);

const unescapedInnerQuoteScript = extractVisualNovelScriptBlock(`
档案页角落留着潦草批注。
<!-- RE0_VN_SCRIPT {"version":"vn60","backgroundKey":"archive","castIds":["protagonist","owen"],"scene":{"location":"旧档案室","time":"傍晚","mood":"紧张"},"beat":{"type":"reveal","progressDelta":[{"thread":"archive-investigation","reason":"黑伞批注与封蜡缺页一致"}]},"segments":[{"type":"narration","text":"页面角落写着："黑伞——再查。"笔迹与封蜡缺页一致。"},{"type":"dialogue","speakerId":"owen","text":"这些旧案早就结案了。"}],"choices":["追问欧文是谁批准结案","继续检查相邻记录"]} -->
`);
assert.equal(unescapedInnerQuoteScript.sourceMode, 'hidden-comment');
assert.equal(unescapedInnerQuoteScript.script.backgroundKey, 'archive');
assert.equal(unescapedInnerQuoteScript.script.segments.length, 2);
assert.match(unescapedInnerQuoteScript.script.segments[0].text, /黑伞/u);

const summary = {
    status: 'pass',
    tracks: {
        canonMainline: ['Arc1', 'Arc4'],
        ifRoutes: ['Sloth'],
        freeSimulation: ['custom archive opening'],
        saveMemory: ['death lesson private memory'],
        stageMapping: ['script current-window asset mapping'],
    },
    routingModes: [
        canonArc1Turn.plan.routing.mode,
        canonArc4Turn.plan.routing.mode,
        slothIfTurn.plan.routing.mode,
        freeArchiveTurn.plan.routing.mode,
        deathLoopTurn.plan.routing.mode,
    ],
    roleDrivenSpeakers: roleMetrics.directSpeakerNames,
    stageBackdrop: stageDirector.selectedBackdropKey,
    validationStatus: invalidCandidateValidation.status,
    gates: {
        playerActionFirstBeat: [
            canonArc1Turn.plan,
            canonArc4Turn.plan,
            slothIfTurn.plan,
            freeArchiveTurn.plan,
            deathLoopTurn.plan,
        ].every((plan) => plan.narrativeDirector.promptDirectives.some((item) => /第一拍|玩家行动/u.test(item))),
        sceneGroundedCandidates: [
            canonArc1Turn.plan,
            canonArc4Turn.plan,
            slothIfTurn.plan,
            freeArchiveTurn.plan,
            deathLoopTurn.plan,
        ].every((plan) => plan.directorPlan.candidateActionPolicy.mustGroundInCurrentScene === true),
        ragSeededCandidates: [
            canonArc1Turn.plan,
            canonArc4Turn.plan,
            slothIfTurn.plan,
            freeArchiveTurn.plan,
            deathLoopTurn.plan,
        ].every((plan) => plan.directorPlan.candidateActionPolicy.ragSeededChoices.length >= 3),
        memoryLayersUsed: asArray(freeArchiveTurn.plan.memoryUse.saveFacts).length > 0
            && asArray(freeArchiveTurn.plan.memoryUse.characterMemories).length > 0
            && asArray(deathLoopTurn.plan.memoryUse.deathLessons).length > 0,
    },
};

assert.equal(summary.gates.playerActionFirstBeat, true);
assert.equal(summary.gates.sceneGroundedCandidates, true);
assert.equal(summary.gates.ragSeededCandidates, true);
assert.equal(summary.gates.memoryLayersUsed, true);

console.log(JSON.stringify(summary, null, 2));
