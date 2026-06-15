import assert from 'node:assert/strict';

import {
    RE0_AGENT_MODULE_CONTRACTS,
    buildRe0AgentTurn,
    summarizeRe0AgentTurn,
    validateRe0AgentTurn,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/re0-agent-module.js';

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
        flags: {
            worldSessionId: overrides.worldSessionId || `agent-module-session-${arc}`,
            playerIntentSceneLockLocation: overrides.location || '未知地点',
        },
        protagonistProfile: overrides.protagonistProfile || null,
        setup: overrides.setup || {},
        worldline: {
            id: overrides.worldlineId || `MODULE-ARC-${arc}`,
            divergence: overrides.divergence ?? 0.08,
            attractor: overrides.attractor || '嫉妒/主线',
            tree: {
                lastFailedNodeId: overrides.lastFailedNodeId || '',
            },
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
            failurePressure: overrides.failurePressure || [],
            deathRisk: {
                lastWarning: overrides.deathWarning || '',
                lastStrategyPivot: overrides.strategyPivot || '',
            },
        },
        discoveredClues: overrides.clues || [],
        deathBranches: overrides.deathBranches || [],
        characterCards: Object.fromEntries((overrides.characters || []).map((name) => [name, {
            name,
            role: '当前场景角色',
            attitudeToPlayer: overrides.attitude || '等待玩家给出可验证证据。',
            trust: overrides.trust ?? 8,
            suspicion: overrides.suspicion ?? 6,
            trauma: overrides.trauma ?? 0,
            affection: overrides.affection ?? 0,
            desire: overrides.desire ?? 0,
            conflict: overrides.conflict ?? 0,
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
    };
}

assert.equal(RE0_AGENT_MODULE_CONTRACTS.StoryRAG.authority, 'global-official-causal-reference');
assert.equal(RE0_AGENT_MODULE_CONTRACTS.WorldContext.authority, 'single-turn-world-decision-contract');
assert.equal(RE0_AGENT_MODULE_CONTRACTS.NarrativeDirector.authority, 'deterministic-pacing-and-causal-director');
assert.equal(RE0_AGENT_MODULE_CONTRACTS.SaveMemory.authority, 'current-save-only');
assert.equal(RE0_AGENT_MODULE_CONTRACTS.Evaluator.sideEffects, 'none');

const canonState = stateForArc(1, {
    location: '王都赃物库',
    objective: '按原作线确认徽章流向并避开艾尔莎袭击',
    characters: ['爱蜜莉雅', '菲鲁特', '罗姆爷'],
    action: '【原作线】按原作因果链确认徽章流向，但保留当前存档差异。',
    speaker: '爱蜜莉雅',
});
const canonTurn = buildRe0AgentTurn(canonState, {
    rawText: canonState.gameplay.lastPlayerAction,
    source: 'choice',
    sceneLock: canonState.current.location,
});
assert.equal(canonTurn.version, 're0-agent-turn/v1');
assert.equal(canonTurn.turnPlan.routing.mode, 'canon-follow');
assert.equal(canonTurn.storyRag.actionMode, 'canon-follow');
assert.equal(canonTurn.narrativeDirector.scope.routeMode, 'canon-attractor');
assert.equal(canonTurn.worldContext.version, 're0-world-context/v1');
assert.equal(canonTurn.worldContext.routing.mode, 'canon-follow');
assert.equal(canonTurn.worldContext.stageContract.expectedBackgroundKey, 'loot_house');
assert.equal(canonTurn.moduleStatus.NarrativeDirector, 'available');
assert.equal(canonTurn.moduleStatus.WorldContext, 'available');
assert.equal(canonTurn.assetPlan.selectedBackdrop.key, 'loot_house');
assert.ok(canonTurn.assetPlan.castAssets.some((item) => item.id === 'emilia'));
assert.equal(canonTurn.ttsPlan.model, 'mimo-v2.5-tts');
assert.ok(canonTurn.ttsPlan.excludedSources.includes('VN_SCRIPT'));
assert.equal(canonTurn.validation.status, 'pass');
assert.equal(canonTurn.commitGuidance.commitAllowed, true);

const freeState = stateForArc(1, {
    worldSessionId: 'module-free-save',
    location: '王都下层图书馆废室',
    objective: '不追徽章，先调查灰衣人留下的寄存记录和禁书区脚印',
    divergence: 0.43,
    characters: ['莉榭尔·阿尔戈', '菲鲁特'],
    action: '我拒绝立刻去赃物库，带着莉榭尔去图书馆废室核对寄存簿和脚印。',
    clues: ['灰衣人在火灾前寄存木盒', '禁书区门缝有新鲜泥点'],
    speaker: '莉榭尔·阿尔戈',
    protagonistProfile: { name: '陆临', origin: '现代图书管理员', ability: '目录残响' },
    trust: 22,
    suspicion: 5,
});
const freeTurn = buildRe0AgentTurn(freeState, {
    rawText: freeState.gameplay.lastPlayerAction,
    source: 'custom',
    sceneLock: freeState.current.location,
});
assert.equal(freeTurn.turnPlan.routing.mode, 'free-simulation');
assert.equal(freeTurn.narrativeDirector.scope.routeMode, 'free-causal-simulation');
assert.ok(freeTurn.narrativeDirector.promptDirectives.some((item) => /候选行动|第一拍|当前场景/u.test(item)));
assert.equal(freeTurn.observation.saveMemory.sessionId, 'module-free-save');
assert.ok(freeTurn.memory.save.some((entry) => /陆临|现代图书管理员|图书馆|寄存/u.test(entry.text)));
assert.ok(freeTurn.memory.character.some((entry) => /莉榭尔|证据|玩家/u.test(entry.text)));
assert.ok(freeTurn.worldContext.memoryFrame.saveFacts.some((entry) => /陆临|现代图书管理员|图书馆|寄存/u.test(entry)));
assert.ok(freeTurn.worldContext.candidateContract.requiredGroundingTerms.some((term) => /图书馆|寄存|莉榭尔/u.test(term)));
assert.ok(freeTurn.observation.characterMemory.some((entry) => entry.name === '莉榭尔·阿尔戈' && entry.trust === 22));
assert.equal(freeTurn.assetPlan.selectedBackdrop.key, 'archive');
assert.equal(freeTurn.turnPlan.uiPlan.expectedBackgroundKey, 'archive');
assert.ok(freeTurn.validation.gates.saveScopeIsolation);

const deathState = stateForArc(1, {
    location: '废弃钟楼地下甬道',
    objective: '带着死亡回滚教训重新接近第七下钟声',
    characters: ['莉榭尔·阿尔戈'],
    action: '让莉榭尔先记录祷文代价，再靠近第七下钟声。',
    deathWarning: '第七下钟声会让剥钟人覆写目击者的脸',
    strategyPivot: '不要单独进入甬道，先让莉榭尔记录祷文代价',
    lastFailedNodeId: 'WLN-DEATH-001',
    deathBranches: [{
        branchId: 'D-MODULE-001',
        cause: '第七下钟声后剥钟人覆写玩家的脸',
        strategyPivot: '不要单独进入甬道，先让莉榭尔记录祷文代价',
        retainedResidue: ['不要公开死亡回归秘密'],
    }],
});
const deathTurn = buildRe0AgentTurn(deathState, {
    rawText: deathState.gameplay.lastPlayerAction,
}, {
    assistantText: '我向莉榭尔公开死亡回归，并说我死后会重置。',
});
assert.equal(deathTurn.validation.status, 'block');
assert.equal(deathTurn.commitGuidance.mode, 'blocked');
assert.ok(deathTurn.validation.findings.some((finding) => finding.module === 'SaveMemory' && /死亡回归/u.test(finding.title)));
assert.ok(deathTurn.memory.death.some((entry) => /第七下钟声|剥钟人|祷文/u.test(entry.text)));
assert.ok(deathTurn.worldContext.memoryFrame.deathLessons.some((entry) => /第七下钟声|剥钟人|祷文/u.test(entry)));

const assetValidation = validateRe0AgentTurn({
    state: canonState,
    playerAction: { rawText: canonState.gameplay.lastPlayerAction },
    plan: canonTurn.turnPlan,
    assistantText: canonState.gameplay.lastPlayerAction,
    parsedVnScript: {
        backgroundKey: 'market_day',
        castIds: ['emilia', 'felt'],
    },
});
assert.equal(assetValidation.status, 'repair');
assert.ok(assetValidation.findings.some((finding) => finding.module === 'AssetDirector'));

const ungroundedCandidateValidation = validateRe0AgentTurn({
    state: freeState,
    playerAction: { rawText: freeState.gameplay.lastPlayerAction },
    plan: freeTurn.turnPlan,
    assistantText: freeState.gameplay.lastPlayerAction,
    candidates: [
        { text: '立刻前往王选会议厅要求贤人会承认你的身份' },
        { text: '去白鲸战场寻找库珥修的军旗' },
    ],
});
assert.equal(ungroundedCandidateValidation.status, 'repair');
assert.ok(ungroundedCandidateValidation.findings.some((finding) => finding.module === 'VNRenderer' && finding.repairScope === 'candidate-grounding'));

const groundedCandidateValidation = validateRe0AgentTurn({
    state: freeState,
    playerAction: { rawText: freeState.gameplay.lastPlayerAction },
    plan: freeTurn.turnPlan,
    assistantText: freeState.gameplay.lastPlayerAction,
    candidates: [
        { text: '在王都下层图书馆废室核对寄存簿和禁书区脚印' },
        { text: '请莉榭尔先给出一个可验证证据，再接触菲鲁特' },
    ],
});
assert.equal(groundedCandidateValidation.status, 'pass');

const summary = summarizeRe0AgentTurn(freeTurn, 1000);
assert.ok(summary.includes('AgentTurn'));
assert.ok(summary.includes('StoryRAG') || summary.includes('StoryRAG'.replace('Story', '')));
assert.ok(summary.includes('WorldContext'));
assert.ok(summary.includes('剧情导演'));
assert.ok(summary.includes('TTS'));
assert.ok(summary.length <= 1000);
assert.ok(!/```|RE0_VN_SCRIPT/u.test(summary));

console.log(JSON.stringify({
    status: 'pass',
    modes: [canonTurn.turnPlan.routing.mode, freeTurn.turnPlan.routing.mode, deathTurn.turnPlan.routing.mode],
    contracts: Object.keys(RE0_AGENT_MODULE_CONTRACTS),
    freeSaveId: freeTurn.observation.saveId,
    validationStatuses: [canonTurn.validation.status, deathTurn.validation.status, assetValidation.status],
    summaryChars: summary.length,
}, null, 2));
