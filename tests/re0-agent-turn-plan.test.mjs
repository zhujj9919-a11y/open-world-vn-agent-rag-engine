import assert from 'node:assert/strict';
import {
    buildAgentTurnPlan,
    summarizeAgentTurnPlan,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/agent-turn-plan.js';
import {
    retrieveStoryRagWorkset,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/story-rag.js';

function stateForArc(arc, overrides = {}) {
    return {
        mode: 'main',
        current: {
            arc,
            day: arc * 100,
            time: overrides.time || '深夜',
            location: overrides.location || '未知地点',
            viewpoint: '玩家',
            castIds: overrides.characters || [],
        },
        worldline: {
            id: overrides.worldlineId || `AGENT-ARC-${arc}`,
            divergence: overrides.divergence ?? 0.08,
            attractor: overrides.attractor || '嫉妒/主线',
        },
        flags: {
            worldSessionId: overrides.worldSessionId || `agent-session-${arc}`,
            lastNarrativeActionCommitment: overrides.commitment || null,
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
            resources: overrides.resources || {},
            failurePressure: overrides.failurePressure || [],
            deathRisk: {
                lastWarning: overrides.deathWarning || '',
                lastStrategyPivot: overrides.strategyPivot || '',
            },
        },
        discoveredClues: overrides.clues || [],
        characterCards: Object.fromEntries((overrides.characters || []).map((name) => [name, {
            name,
            role: '当前场景角色',
            trust: 8,
            suspicion: 6,
            memory: [`${name}记得玩家上一轮行动留下的证据。`],
        }])),
        visuals: {
            sceneBackdrop: {
                currentKey: overrides.backgroundKey || 'rain_bell',
            },
            visualNovel: {
                sceneCharacters: overrides.characters || [],
                castIds: overrides.characters || [],
                lastChoiceText: overrides.choice || '',
                currentSpeakerName: overrides.speaker || '',
            },
        },
        deathBranches: overrides.deathBranches || [],
    };
}

function contextWorkset(overrides = {}) {
    return {
        hot: overrides.hot || [{
            id: 'current-objective',
            priority: 0,
            band: 'hot',
            title: '当前目标',
            summary: '玩家正在把行动落到当前现场。',
            sourceDoc: 'CURRENT_STATE.md',
        }],
        warm: overrides.warm || [],
        cold: overrides.cold || [],
        sidecar: overrides.sidecar || [],
    };
}

const canonState = stateForArc(1, {
    location: '王都赃物库',
    objective: '按原作线确认徽章流向并避开艾尔莎袭击',
    characters: ['爱蜜莉雅', '菲鲁特', '罗姆爷'],
    action: '【原作线】按原作因果链确认徽章流向，但保留当前存档差异。',
    speaker: '爱蜜莉雅',
});
const canonRag = retrieveStoryRagWorkset(canonState, canonState.gameplay.lastPlayerAction);
const canonPlan = buildAgentTurnPlan(canonState, {
    rawText: canonState.gameplay.lastPlayerAction,
    source: 'choice',
    sceneLock: canonState.current.location,
}, {
    storyRagWorkset: canonRag,
    contextWorkset: contextWorkset(),
});
assert.equal(canonPlan.routing.mode, 'canon-follow');
assert.equal(canonPlan.routing.followsCanonAction, true);
assert.equal(canonPlan.routing.model, 'mimo-v2.5-pro');
assert.equal(canonPlan.routing.ttsModel, 'mimo-v2.5-tts');
assert.ok(canonPlan.memoryUse.officialFacts.some((fact) => /徽章|赃物库|艾尔莎|爱蜜莉雅/u.test(fact)));
assert.equal(canonPlan.narrativeDirector.version, 're0-narrative-director/v1');
assert.equal(canonPlan.narrativeDirector.scope.routeMode, 'canon-attractor');
assert.ok(canonPlan.narrativeDirector.scope.arcLabel.includes('Arc1'));
assert.ok(canonPlan.narrativeDirector.beat.requiredOutcomeTypes.some((type) => /new_clue|world_rule_pressure|choice_pressure|payoff|new_objective/u.test(type)));
assert.ok(canonPlan.narrativeDirector.candidateSeeds.some((seed) => /原作|徽章|赃物库/u.test(seed.text)));
assert.ok(canonPlan.directorPlan.candidateActionPolicy.ragSeededChoices.some((choice) => /原作|徽章|赃物库/u.test(choice)));
assert.equal(canonPlan.directorPlan.candidateActionPolicy.avoidTemplateFallbackWhenSeedsAvailable, true);
assert.equal(canonPlan.directorPlan.narrativeDirector.planId, canonPlan.narrativeDirector.planId);
assert.ok(canonPlan.directorPlan.firstBeat.includes('玩家行动落地'));
assert.equal(canonPlan.worldContext.version, 're0-world-context/v1');
assert.equal(canonPlan.worldContext.routing.mode, 'canon-follow');
assert.equal(canonPlan.worldContext.authority.official, 'global-causal-groundtruth');
assert.equal(canonPlan.worldContext.stageContract.expectedBackgroundKey, 'loot_house');
assert.equal(canonPlan.directorPlan.candidateActionPolicy.worldContextId, canonPlan.worldContext.contextId);
assert.ok(canonPlan.worldContext.candidateContract.requiredGroundingTerms.some((term) => /赃物库|徽章|爱蜜莉雅/u.test(term)));
assert.equal(canonPlan.assetPlan.selectedBackdrop.key, 'loot_house');
assert.ok(canonPlan.assetPlan.castAssets.some((item) => item.id === 'emilia'));
assert.ok(canonPlan.uiPlan.ttsTargets[0].policy.includes('不朗读候选行动'));

const freeState = stateForArc(1, {
    worldSessionId: 'free-agent-session',
    location: '王都下层图书馆废室',
    objective: '不追徽章，先调查灰衣人留下的寄存记录和禁书区脚印',
    divergence: 0.43,
    characters: ['莉榭尔·阿尔戈', '菲鲁特'],
    action: '我拒绝立刻去赃物库，带着莉榭尔去图书馆废室核对寄存簿和脚印。',
    clues: ['灰衣人在火灾前寄存木盒', '禁书区门缝有新鲜泥点'],
    speaker: '莉榭尔·阿尔戈',
});
freeState.protagonistProfile = { name: '陆临', origin: '现代图书管理员', ability: '目录残响' };
freeState.characterCards['莉榭尔·阿尔戈'] = {
    name: '莉榭尔·阿尔戈',
    role: '原创调查同伴',
    trust: 22,
    suspicion: 5,
    attitudeToPlayer: '相信玩家的记录能力，但要求先给她一个可验证证据。',
    memory: ['她记得玩家没有追逐银发半精灵，而是先检查寄存簿。'],
};
const freeRag = retrieveStoryRagWorkset(freeState, freeState.gameplay.lastPlayerAction);
const freePlan = buildAgentTurnPlan(freeState, {
    rawText: freeState.gameplay.lastPlayerAction,
    source: 'custom',
    sceneLock: freeState.current.location,
}, {
    storyRagWorkset: freeRag,
    contextWorkset: contextWorkset({
        hot: [{
            id: 'custom-origin',
            priority: 0,
            band: 'hot',
            title: '玩家出身',
            summary: '陆临是现代图书管理员，擅长目录和记录。',
            sourceDoc: 'CURRENT_STATE.md',
        }],
    }),
});
assert.equal(freePlan.routing.mode, 'free-simulation');
assert.equal(freePlan.routing.simulatesFreeAction, true);
assert.equal(freePlan.routing.followsCanonAction, false);
assert.ok(freePlan.memoryUse.saveFacts.some((fact) => /陆临|现代图书管理员|图书馆|寄存/u.test(fact)));
assert.ok(freePlan.memoryUse.characterMemories.some((memory) => /莉榭尔|寄存簿|证据/u.test(memory)));
assert.ok(freePlan.directorPlan.consequenceBeats.some((beat) => /开放世界逻辑/u.test(beat)));
assert.equal(freePlan.narrativeDirector.scope.routeMode, 'free-causal-simulation');
assert.ok(freePlan.narrativeDirector.promptDirectives.some((item) => /第一拍|玩家行动/u.test(item)));
assert.ok(freePlan.narrativeDirector.evaluatorRules.some((item) => /行动|VN_SCRIPT|open loop/u.test(item)));
assert.ok(freePlan.narrativeDirector.arcDuty.longRangeGoal.includes('自由行动'));
assert.ok(freePlan.narrativeDirector.candidateSeeds.some((seed) => /图书馆|寄存|莉榭尔/u.test(seed.text)));
assert.ok(freePlan.directorPlan.candidateActionPolicy.ragSeededChoices.some((choice) => /图书馆|寄存|莉榭尔/u.test(choice)));
assert.ok(freePlan.directorPlan.candidateActionPolicy.ragSeededChoiceSources.every((source) => source.grounding));
assert.equal(freePlan.worldContext.routing.mode, 'free-simulation');
assert.ok(freePlan.worldContext.memoryFrame.saveFacts.some((fact) => /陆临|现代图书管理员|图书馆|寄存/u.test(fact)));
assert.ok(freePlan.worldContext.memoryFrame.characterMemories.some((memory) => /莉榭尔|寄存簿|证据/u.test(memory)));
assert.ok(freePlan.worldContext.candidateContract.requiredGroundingTerms.some((term) => /图书馆|寄存|莉榭尔/u.test(term)));
assert.equal(freePlan.worldContext.stageContract.expectedBackgroundKey, 'archive');
assert.equal(freePlan.assetPlan.selectedBackdrop.key, 'archive');
assert.equal(freePlan.uiPlan.expectedBackgroundKey, 'archive');
assert.ok(freePlan.assetPlan.castAssets.some((item) => item.id === 'lishelle'));

const deathState = stateForArc(1, {
    location: '废弃钟楼地下甬道',
    objective: '带着死亡回滚教训重新接近第七下钟声',
    characters: ['莉榭尔·阿尔戈'],
    action: '让莉榭尔先记录祷文代价，再靠近第七下钟声。',
    deathWarning: '第七下钟声会让剥钟人覆写目击者的脸',
    strategyPivot: '不要单独进入甬道，先让莉榭尔记录祷文代价',
    deathBranches: [{
        branchId: 'D-AGENT-001',
        cause: '第七下钟声后剥钟人覆写玩家的脸',
        strategyPivot: '不要单独进入甬道，先让莉榭尔记录祷文代价',
        retainedResidue: ['不要公开死亡回归秘密'],
    }],
});
const deathRag = retrieveStoryRagWorkset(deathState, deathState.gameplay.lastPlayerAction);
const deathPlan = buildAgentTurnPlan(deathState, {
    rawText: deathState.gameplay.lastPlayerAction,
}, {
    storyRagWorkset: deathRag,
    contextWorkset: contextWorkset(),
});
assert.ok(deathPlan.memoryUse.deathLessons.some((lesson) => /第七下钟声|剥钟人|祷文/u.test(lesson)));
assert.ok(deathPlan.memoryUse.forbiddenPublicFacts.some((fact) => /死亡回归/u.test(fact)));
assert.ok(deathPlan.worldContext.memoryFrame.deathLessons.some((lesson) => /第七下钟声|剥钟人|祷文/u.test(lesson)));
assert.ok(deathPlan.worldContext.memoryFrame.forbiddenPublicFacts.some((fact) => /死亡回归/u.test(fact)));
assert.equal(deathPlan.validators.deathReturnPublicLeakBlocked, true);
assert.equal(deathPlan.narrativeDirector.beat.type, 'aftermath');
assert.ok(deathPlan.narrativeDirector.beat.requiredOutcomeTypes.includes('new_strategy'));

const sanctuaryState = stateForArc(4, {
    location: '圣域墓所入口',
    objective: '确认结界规则并决定是否进入试炼',
    characters: ['爱蜜莉雅', '罗兹瓦尔', '艾姬多娜'],
    action: '我不急着进入墓所，先请爱蜜莉雅复述结界条件，再观察罗兹瓦尔是否回避福音书。',
    speaker: '爱蜜莉雅',
    clues: ['结界只拦住特定血统与混血条件', '罗兹瓦尔对墓所试炼的失败反应过于平静'],
});
sanctuaryState.visuals.visualNovel.segments = Array.from({ length: 7 }, (_, index) => ({
    type: index % 2 ? 'dialogue' : 'narration',
    text: `圣域测试段 ${index + 1}`,
}));
sanctuaryState.visuals.visualNovel.currentIndex = 6;
sanctuaryState.storyFlow = { turnsInScene: 3, currentScenePurpose: '圣域结界规则已经盘旋数轮，需要推进试炼或揭露代价。' };
const sanctuaryRag = retrieveStoryRagWorkset(sanctuaryState, sanctuaryState.gameplay.lastPlayerAction);
const sanctuaryPlan = buildAgentTurnPlan(sanctuaryState, {
    rawText: sanctuaryState.gameplay.lastPlayerAction,
    source: 'custom',
    sceneLock: sanctuaryState.current.location,
}, {
    storyRagWorkset: sanctuaryRag,
    contextWorkset: contextWorkset(),
});
assert.ok(sanctuaryPlan.narrativeDirector.scope.arcLabel.includes('Arc4'));
assert.equal(sanctuaryPlan.narrativeDirector.sceneClock.mustTransitionSoon, true);
assert.ok(['payoff', 'transition', 'reveal'].includes(sanctuaryPlan.narrativeDirector.beat.type));
assert.ok(sanctuaryPlan.narrativeDirector.payoff.pressure === 'high' || sanctuaryPlan.narrativeDirector.sceneClock.pressure === 'high');
assert.ok(sanctuaryPlan.narrativeDirector.arcDuty.longRangeGoal.includes('圣域'));
assert.ok(sanctuaryPlan.directorPlan.forbidden.some((item) => /试炼|幕后|玩家候选行动/u.test(item)));

const summary = summarizeAgentTurnPlan(freePlan, 900);
assert.ok(summary.length <= 900);
assert.ok(summary.includes('路由: free-simulation'));
assert.ok(summary.includes('TTS=mimo-v2.5-tts'));
assert.ok(summary.includes('素材计划'));
assert.ok(summary.includes('第一拍'));
assert.ok(summary.includes('剧情导演'));
assert.ok(summary.includes('WorldContext'));
assert.ok(summary.includes('RAG 候选种子'));
assert.ok(!/RE0_VN_SCRIPT|候选行动面板|```/u.test(summary));

console.log(JSON.stringify({
    status: 'pass',
    modes: [canonPlan.routing.mode, freePlan.routing.mode, deathPlan.routing.mode, sanctuaryPlan.routing.mode],
    canonTurnId: canonPlan.turnId,
    freeTurnId: freePlan.turnId,
    deathLessonCount: deathPlan.memoryUse.deathLessons.length,
    sanctuaryBeat: sanctuaryPlan.narrativeDirector.beat.type,
    summaryChars: summary.length,
}, null, 2));
