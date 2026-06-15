import {
    buildAgentTurnPlan,
    summarizeAgentTurnPlan,
} from './agent-turn-plan.js';
import {
    buildAssetPlan,
    evaluateAssetUse,
    summarizeAssetPlan,
} from './asset-policy-engine.js';
import {
    retrieveStoryRagWorkset,
    summarizeStoryRagWorkset,
} from './story-rag.js';
import {
    buildRe0HostAdapterBridge,
    summarizeRe0HostAdapterBridge,
} from './re0-host-adapter.js';
import {
    summarizeWorldContext,
} from './world-context.js';

const DEFAULT_SUMMARY_LIMIT = 1400;

function compactText(value, limit = 160) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= limit) {
        return text;
    }
    return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function unique(values, limit = 16) {
    return [...new Set(asArray(values).filter(Boolean).map(String))].slice(0, limit);
}

function stableHash(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function actionTextFrom(state = {}, playerAction = {}) {
    return playerAction.rawText
        || playerAction.text
        || state?.flags?.lastNarrativeActionCommitment?.text
        || state?.visuals?.visualNovel?.pendingSend?.text
        || state?.visuals?.visualNovel?.lastChoiceText
        || state?.gameplay?.lastPlayerAction
        || '';
}

function activeCharacterNames(state = {}) {
    const visualNovel = state?.visuals?.visualNovel || {};
    return unique([
        ...(state?.current?.castIds || []),
        ...(visualNovel.sceneCharacters || []),
        ...(visualNovel.castIds || []),
        visualNovel.currentSpeakerName,
        ...(state?.presence?.sceneCharacters || []),
        ...(state?.presence?.areaCharacters || []).slice(0, 6),
        ...Object.keys(state?.characterCards || {}).slice(0, 8),
    ], 16);
}

function sceneGroundingTerms(state = {}) {
    const stop = new Set(['当前', '未知', '地点', '深夜', '清晨', '玩家', '目标', '推进', '确认', '调查', '继续']);
    const expandTerms = (value) => {
        const output = [];
        for (const part of String(value || '').split(/[\s/／·・,，。:：;；|｜()[\]【】"'“”]+/u)) {
            const terms = String(part || '').match(/[\u4e00-\u9fa5A-Za-z0-9]{2,}/gu) || [];
            for (const term of terms) {
                output.push(term);
                if (/[\u4e00-\u9fa5]/u.test(term) && term.length > 4) {
                    for (let i = 0; i <= term.length - 2; i += 1) {
                        output.push(term.slice(i, i + 2));
                    }
                }
            }
        }
        return output;
    };
    const chunks = [
        state?.current?.location,
        state?.flags?.playerIntentSceneLockLocation,
        state?.gameplay?.activeObjective,
        state?.gameplay?.objectiveStage,
        ...(state?.discoveredClues || []),
        ...activeCharacterNames(state),
    ].filter(Boolean).join(' ');
    const terms = expandTerms(chunks)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2 && !stop.has(term));
    return unique(terms, 32);
}

function compactMemoryEntries(entries = [], limit = 6) {
    return asArray(entries).slice(0, limit).map((entry) => ({
        id: entry?.id || '',
        layer: entry?.layer || '',
        band: entry?.band || '',
        source: entry?.source || '',
        text: compactText(entry?.text || entry?.summary || entry?.title || '', 140),
        tags: unique(entry?.tags || [], 6),
    })).filter((entry) => entry.text || entry.id);
}

function summarizeStoryRag(workset = {}) {
    return {
        id: stableHash({
            query: workset?.query,
            routing: workset?.architecture?.routing,
            facts: asArray(workset?.facts).slice(0, 6).map((fact) => fact?.id),
        }),
        version: workset?.version || '',
        actionMode: workset?.architecture?.routing?.actionMode || workset?.directorSignals?.actionMode || '',
        directorMode: workset?.directorSignals?.mode || '',
        sessionId: workset?.runtimeMemory?.sessionId || workset?.memoryPolicy?.saveMemorySessionId || '',
        factIds: asArray(workset?.facts).slice(0, 6).map((fact) => fact?.id).filter(Boolean),
        riskIds: asArray(workset?.risks).slice(0, 4).map((risk) => risk?.id).filter(Boolean),
        hookIds: asArray(workset?.hooks).slice(0, 4).map((hook) => hook?.id).filter(Boolean),
        summary: compactText(summarizeStoryRagWorkset?.(workset, 900) || '', 900),
    };
}

function summarizeCharacterMemory(state = {}, activeNames = activeCharacterNames(state)) {
    const cards = Object.entries(state?.characterCards || {})
        .filter(([name]) => activeNames.includes(name))
        .slice(0, 8)
        .map(([name, card = {}]) => ({
            name,
            role: compactText(card.role || '', 40),
            attitude: compactText(card.attitudeToPlayer || '', 80),
            trust: Number(card.trust || 0),
            suspicion: Number(card.suspicion || 0),
            trauma: Number(card.trauma || 0),
            affection: Number(card.affection || 0),
            desire: Number(card.desire || 0),
            conflict: Number(card.conflict || 0),
            latestMemory: compactText(asArray(card.memory).at(-1) || asArray(card.arcLog).at(-1) || '', 120),
        }));
    return cards;
}

export const RE0_AGENT_MODULE_CONTRACTS = Object.freeze({
    StoryRAG: {
        authority: 'global-official-causal-reference',
        input: ['state', 'playerAction'],
        output: ['storyRagWorkset', 'officialFacts', 'continuityRisks', 'ifAttractors'],
        sideEffects: 'none',
    },
    WorldContext: {
        authority: 'single-turn-world-decision-contract',
        input: ['storyRagWorkset', 'saveMemory', 'characterMemory', 'deathMemory', 'assetPlan', 'narrativeDirector'],
        output: ['causalFrame', 'memoryFrame', 'decisionContract', 'candidateContract', 'stageContract'],
        sideEffects: 'none',
    },
    NarrativeDirector: {
        authority: 'deterministic-pacing-and-causal-director',
        input: ['state', 'playerAction', 'storyRagWorkset', 'saveMemory', 'characterMemory'],
        output: ['beatPlan', 'sceneClock', 'openLoops', 'payoffPressure', 'promptDirectives'],
        sideEffects: 'none',
    },
    SaveMemory: {
        authority: 'current-save-only',
        input: ['state.flags.worldSessionId', 'state.protagonistProfile', 'state.discoveredClues', 'state.deathBranches'],
        output: ['saveFacts', 'privateDeathLessons', 'sessionId'],
        sideEffects: 'none',
    },
    Worldline: {
        authority: 'deterministic-state-ledger',
        input: ['state.worldline', 'state.answerBook', 'state.deathBranches'],
        output: ['divergence', 'lastFailedNodeId', 'anchorReturnPolicy'],
        sideEffects: 'validated-patch-only',
    },
    CharacterMemory: {
        authority: 'per-save-npc-state',
        input: ['state.characterCards', 'activeCharacters'],
        output: ['npcReactionSignals', 'relationshipConstraints'],
        sideEffects: 'validated-patch-only',
    },
    AssetDirector: {
        authority: 'registered-visual-assets',
        input: ['state', 'playerAction', 'storyRagWorkset'],
        output: ['assetPlan', 'missingAssets', 'assetValidationFindings'],
        sideEffects: 'missing-asset-queue-only',
    },
    VNRenderer: {
        authority: 'validated-narrative-ui',
        input: ['turnPlan', 'assetPlan', 'validatedNarrative'],
        output: ['uiPlan', 'expectedBackgroundKey', 'stageDebug'],
        sideEffects: 'render-only-after-validation',
    },
    TTSDirector: {
        authority: 'validated-dialogue-audio',
        input: ['validatedNarrativeSegments', 'speakerProfile'],
        output: ['ttsPlan', 'voiceTargets'],
        sideEffects: 'audio-cache-only',
    },
    Evaluator: {
        authority: 'deterministic-critic',
        input: ['turnPlan', 'assistantText', 'parsedVnScript', 'statePatch'],
        output: ['validationReport', 'commitGuidance'],
        sideEffects: 'none',
    },
});

export function observeAgentState(state = {}, playerAction = {}) {
    const activeCharacters = activeCharacterNames(state);
    const sessionId = state?.flags?.worldSessionId || state?.worldline?.id || 'unknown-save';
    return {
        version: 're0-agent-observation/v1',
        observationId: `obs-${stableHash({
            sessionId,
            location: state?.current?.location,
            action: actionTextFrom(state, playerAction),
            objective: state?.gameplay?.activeObjective,
        })}`,
        saveId: sessionId,
        mode: state?.mode || 'main',
        current: {
            arc: state?.current?.arc || 1,
            day: state?.current?.day || 1,
            time: state?.current?.time || '',
            location: state?.current?.location || '',
            viewpoint: state?.current?.viewpoint || '',
        },
        playerAction: {
            text: compactText(actionTextFrom(state, playerAction), 260),
            source: playerAction.source || state?.flags?.lastNarrativeActionCommitment?.source || '',
            sceneLock: playerAction.sceneLock || state?.flags?.playerIntentSceneLockLocation || state?.current?.location || '',
        },
        objective: compactText(state?.gameplay?.activeObjective || '', 180),
        worldline: {
            id: state?.worldline?.id || '',
            divergence: Number(state?.worldline?.divergence || 0),
            attractor: compactText(state?.worldline?.attractor || '', 80),
            lastFailedNodeId: state?.worldline?.tree?.lastFailedNodeId || state?.flags?.lastWorldlineFailedNodeId || '',
            answerBookPhase: state?.answerBook?.phase || '',
        },
        activeCharacters,
        characterMemory: summarizeCharacterMemory(state, activeCharacters),
        saveMemory: {
            sessionId,
            protagonist: compactText([
                state?.protagonistProfile?.name || state?.setup?.protagonistName,
                state?.protagonistProfile?.origin || state?.setup?.origin,
                state?.protagonistProfile?.ability || state?.setup?.ability,
            ].filter(Boolean).join(' / '), 180),
            clues: asArray(state?.discoveredClues).slice(-6).map((item) => compactText(item, 120)),
            deathLessonCount: asArray(state?.deathBranches).length,
        },
        visualNovel: {
            speaker: state?.visuals?.visualNovel?.currentSpeakerName || '',
            backgroundKey: state?.visuals?.visualNovel?.backgroundKey || state?.visuals?.sceneBackdrop?.currentKey || '',
            lastChoiceText: compactText(state?.visuals?.visualNovel?.lastChoiceText || '', 160),
        },
    };
}

export function validateRe0AgentTurn({
    state = {},
    playerAction = {},
    plan = {},
    assistantText = '',
    parsedVnScript = null,
    renderedBackdropKey = '',
    renderedCastIds = [],
    statePatch = {},
    candidates = [],
} = {}) {
    const findings = [];
    const actionText = String(plan?.playerAction?.rawText || actionTextFrom(state, playerAction) || '');
    const text = String(assistantText || '');
    if (text && actionText && !text.includes(actionText.slice(0, Math.min(12, actionText.length)))) {
        findings.push({
            module: 'Evaluator',
            severity: 'warn',
            title: '玩家行动可能没有被显式承接',
            detail: compactText(actionText, 120),
            repairScope: 'narrative-first-beat',
        });
    }
    if (/死亡回归|重置|我死后|回到锚点/u.test(text) && !/心脏|禁语|不能说|说不出口/u.test(text)) {
        findings.push({
            module: 'SaveMemory',
            severity: 'block',
            title: '疑似公开死亡回归秘密',
            detail: '死亡回归只能作为玩家私有策略记忆，不能作为普通公开对白。',
            repairScope: 'death-return-privacy',
        });
    }
    if (/切换到|直接进入.*IF|路线锁定/u.test(text)) {
        findings.push({
            module: 'Worldline',
            severity: 'warn',
            title: '疑似 IF 路线硬切',
            detail: 'IF 应表现为压力、代价、误读或纠偏入口。',
            repairScope: 'if-attractor-continuity',
        });
    }
    if (statePatch?.worldline || statePatch?.returnByDeath || statePatch?.worldClock) {
        findings.push({
            module: 'Worldline',
            severity: 'block',
            title: '状态补丁包含受保护核心字段',
            detail: 'worldline/returnByDeath/worldClock 必须走专用确定性函数。',
            repairScope: 'state-patch-permissions',
        });
    }
    const assetFindings = evaluateAssetUse(plan?.assetPlan || {}, {
        parsedVnScript,
        renderedBackdropKey,
        renderedCastIds,
    }).map((finding) => ({
        module: 'AssetDirector',
        repairScope: finding.severity === 'block' ? 'asset-registration' : 'asset-plan-alignment',
        ...finding,
    }));
    findings.push(...assetFindings);
    const candidateTexts = asArray(candidates).map((candidate) => candidate?.text || candidate?.action || candidate).join(' ');
    const groundingTerms = unique([
        ...asArray(plan?.worldContext?.candidateContract?.requiredGroundingTerms),
        ...sceneGroundingTerms(state),
    ], 40);
    const groundingHits = groundingTerms.filter((term) => candidateTexts.includes(term));
    if (candidateTexts && groundingTerms.length && !groundingHits.length) {
        findings.push({
            module: 'VNRenderer',
            severity: 'warn',
            title: '候选行动未贴合当前场景',
            detail: compactText(`缺少当前场景关键词：${groundingTerms.slice(0, 8).join(' / ')}`, 160),
            repairScope: 'candidate-grounding',
        });
    }
    const status = findings.some((finding) => finding.severity === 'block') ? 'block'
        : findings.some((finding) => finding.severity === 'warn') ? 'repair'
            : findings.length ? 'warn'
                : 'pass';
    return {
        version: 're0-agent-validation/v1',
        status,
        commitAllowed: status === 'pass' || status === 'warn',
        findings,
        gates: {
            playerActionAcknowledgement: true,
            deathReturnPublicLeakBlocked: true,
            sceneJumpRequiresIntent: true,
            saveScopeIsolation: true,
            assetConsistency: true,
            ttsSystemTextExcluded: true,
        },
    };
}

function buildTtsPlan(state = {}, plan = {}) {
    const targets = asArray(plan?.uiPlan?.ttsTargets);
    const fallbackSpeaker = state?.visuals?.visualNovel?.currentSpeakerName || 'narrator';
    return {
        version: 're0-tts-plan/v1',
        model: plan?.routing?.ttsModel || 'mimo-v2.5-tts',
        targets: targets.length ? targets : [{
            kind: fallbackSpeaker === 'narrator' ? 'narration' : 'dialogue',
            speaker: fallbackSpeaker,
            model: 'mimo-v2.5-tts',
            policy: '只朗读正文/台词，不朗读候选行动、状态块、RAG、VN_SCRIPT 或调试文本。',
        }],
        excludedSources: ['candidate-actions', 'state-panels', 'story-rag', 'VN_SCRIPT', 'debug-text', 'debug', 'system'],
    };
}

function commitGuidanceFor(validation = {}) {
    if (validation.status === 'block') {
        return {
            mode: 'blocked',
            commitAllowed: false,
            nextStep: '先修复 block finding，再提交任何状态补丁或 UI/VN_SCRIPT 输出。',
        };
    }
    if (validation.status === 'repair') {
        return {
            mode: 'repair-first',
            commitAllowed: false,
            nextStep: '允许保留本地观察和计划，但正文/候选/素材需要修复后再提交。',
        };
    }
    return {
        mode: validation.status === 'warn' ? 'commit-with-warnings' : 'commit-ready',
        commitAllowed: validation.commitAllowed !== false,
        nextStep: validation.status === 'warn'
            ? '可提交低风险 UI/音频输出；建议记录 warning 供下一轮修复。'
            : '可进入渲染、TTS 和受控状态提交。',
    };
}

export function buildRe0AgentTurn(state = {}, playerAction = {}, options = {}) {
    const actionText = actionTextFrom(state, playerAction);
    const observation = observeAgentState(state, playerAction);
    const storyRagWorkset = options.storyRagWorkset || retrieveStoryRagWorkset(state, actionText, options.storyRagOptions || {});
    const turnPlan = buildAgentTurnPlan(state, playerAction, {
        storyRagWorkset,
        contextWorkset: options.contextWorkset || {},
    });
    const assetPlan = turnPlan.assetPlan || buildAssetPlan(state, turnPlan.playerAction || playerAction, {
        storyRagWorkset,
        limit: 8,
    });
    const plan = {
        ...turnPlan,
        assetPlan,
    };
    const validation = validateRe0AgentTurn({
        state,
        playerAction,
        plan,
        assistantText: options.assistantText || '',
        parsedVnScript: options.parsedVnScript || null,
        renderedBackdropKey: options.renderedBackdropKey || '',
        renderedCastIds: options.renderedCastIds || [],
        statePatch: options.statePatch || {},
        candidates: options.candidates || [],
    });
    const ttsPlan = buildTtsPlan(state, plan);
    const storyRagSummary = summarizeStoryRag(storyRagWorkset);
    const moduleStatus = Object.fromEntries(Object.keys(RE0_AGENT_MODULE_CONTRACTS).map((name) => [name, 'available']));
    const hostBridge = buildRe0HostAdapterBridge(state, {
        turnId: plan.turnId,
        moduleStatus,
        storyRag: storyRagSummary,
        turnPlan: plan,
        assetPlan,
        ttsPlan,
        validation,
        commitGuidance: commitGuidanceFor(validation),
    }, options.hostAdapter || {});
    return {
        version: 're0-agent-turn/v1',
        turnId: plan.turnId || `turn-${stableHash({ actionText, saveId: observation.saveId })}`,
        generatedAt: plan.generatedAt || new Date().toISOString(),
        contractsVersion: 're0-agent-contracts/v1',
        moduleContracts: RE0_AGENT_MODULE_CONTRACTS,
        moduleStatus,
        observation,
        storyRag: storyRagSummary,
        narrativeDirector: plan.narrativeDirector || plan.directorPlan?.narrativeDirector || null,
        worldContext: plan.worldContext || null,
        memory: {
            save: compactMemoryEntries(storyRagWorkset?.runtimeMemory?.saveFacts),
            character: compactMemoryEntries(storyRagWorkset?.runtimeMemory?.characterMemories),
            death: compactMemoryEntries(storyRagWorkset?.runtimeMemory?.deathMemories),
        },
        turnPlan: plan,
        assetPlan,
        ttsPlan,
        hostBridge,
        validation,
        commitGuidance: commitGuidanceFor(validation),
        summaries: {
            turnPlan: compactText(summarizeAgentTurnPlan(plan, DEFAULT_SUMMARY_LIMIT), DEFAULT_SUMMARY_LIMIT),
            assetPlan: compactText(summarizeAssetPlan(assetPlan, 900), 900),
            worldContext: compactText(summarizeWorldContext(plan.worldContext, 900), 900),
            storyRag: storyRagSummary.summary,
            hostBridge: compactText(summarizeRe0HostAdapterBridge(hostBridge, 900), 900),
        },
    };
}

export function summarizeRe0AgentTurn(turn = {}, limit = DEFAULT_SUMMARY_LIMIT) {
    const output = [
        `- AgentTurn: ${turn.version || 'unknown'} / ${turn.turnId || 'unknown'} / contracts=${turn.contractsVersion || ''}`,
        `- 观察: save=${turn.observation?.saveId || ''} / ${turn.observation?.current?.location || ''} / action=${compactText(turn.observation?.playerAction?.text || '', 120)}`,
        `- RAG: ${turn.storyRag?.actionMode || ''} / facts=${asArray(turn.storyRag?.factIds).slice(0, 3).join(',') || 'none'} / session=${turn.storyRag?.sessionId || ''}`,
        `- WorldContext: ${turn.worldContext?.contextId || ''} / bg=${turn.worldContext?.stageContract?.expectedBackgroundKey || ''}`,
        `- 剧情导演: ${turn.narrativeDirector?.beat?.type || turn.turnPlan?.narrativeDirector?.beat?.type || 'unknown'} / pacing=${turn.narrativeDirector?.beat?.pacing || turn.turnPlan?.narrativeDirector?.beat?.pacing || ''} / payoff=${turn.narrativeDirector?.payoff?.pressure || turn.turnPlan?.narrativeDirector?.payoff?.pressure || ''}`,
        `- 模块: ${Object.keys(turn.moduleStatus || {}).join(' / ')}`,
        `- 宿主: ${turn.hostBridge?.host?.kind || 'sillytavern-extension'} / phase=${turn.hostBridge?.migration?.phase ?? 0}`,
        `- 素材: ${turn.assetPlan?.selectedBackdrop?.key || ''} / cast=${asArray(turn.assetPlan?.castAssets).map((item) => item.id).filter(Boolean).slice(0, 5).join(',') || 'none'}`,
        `- TTS: ${turn.ttsPlan?.model || ''} / targets=${asArray(turn.ttsPlan?.targets).length}`,
        `- 校验: ${turn.validation?.status || 'unknown'} / commit=${turn.commitGuidance?.mode || ''} / findings=${asArray(turn.validation?.findings).length}`,
    ].join('\n');
    if (output.length <= limit) {
        return output;
    }
    return `${output.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}
