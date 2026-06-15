import {
    buildAssetPlan,
    summarizeAssetPlan,
} from './asset-policy-engine.js';
import {
    buildNarrativeDirectorPlan,
    summarizeNarrativeDirectorPlan,
} from './narrative-director.js';
import {
    buildWorldContext,
    summarizeWorldContext,
} from './world-context.js';

const DEFAULT_PLAN_LIMIT = 1200;

function compactText(value, limit = 120) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= limit) {
        return text;
    }
    return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function unique(values, limit = 16) {
    return [...new Set((values || []).filter(Boolean).map(String))].slice(0, limit);
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

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function factText(item) {
    return compactText(item?.text || item?.summary || item?.title || item?.description || item?.id || '', 150);
}

function entryText(item) {
    return compactText(item?.text || item?.summary || item?.title || item?.description || '', 150);
}

function activePresence(state = {}) {
    const visualNovel = state?.visuals?.visualNovel || {};
    const presence = state?.presence || {};
    return unique([
        ...(asArray(state?.current?.castIds)),
        ...(asArray(visualNovel.sceneCharacters)),
        ...(asArray(visualNovel.castIds)),
        ...(asArray(presence.sceneCharacters)),
        ...(asArray(presence.areaCharacters).slice(0, 6)),
        ...Object.keys(state?.characterCards || {}).slice(0, 6),
    ], 14);
}

function inferPlayerAction(state = {}, playerAction = {}) {
    const commitment = state?.flags?.lastNarrativeActionCommitment || {};
    const visualNovel = state?.visuals?.visualNovel || {};
    const rawText = playerAction.rawText
        || playerAction.text
        || commitment.text
        || visualNovel.pendingSend?.text
        || visualNovel.lastChoiceText
        || state?.gameplay?.lastPlayerAction
        || '';
    const source = playerAction.source || commitment.source || (visualNovel.lastChoiceText ? 'choice' : 'state');
    return {
        rawText: compactText(rawText, 260),
        normalizedIntent: compactText(rawText || state?.gameplay?.activeObjective || '继续当前局势', 160),
        source: compactText(source, 32),
        choiceType: compactText(playerAction.choiceType || commitment.choiceType || '', 32),
        choiceSource: compactText(playerAction.choiceSource || commitment.choiceSource || '', 42),
        sceneLock: compactText(
            playerAction.sceneLock
            || commitment.location
            || state?.flags?.playerIntentSceneLockLocation
            || state?.current?.location
            || '',
            90,
        ),
        committedAt: playerAction.committedAt || commitment.committedAt || state?.flags?.lastPlayerActionCommittedAt || '',
    };
}

function routingFromRag(storyRagWorkset = {}, state = {}) {
    const actionMode = storyRagWorkset?.architecture?.routing?.actionMode
        || storyRagWorkset?.directorSignals?.actionMode
        || (state?.flags?.localCommandBrief ? 'local-command' : 'free-simulation');
    const model = actionMode === 'local-command' ? 'local-deterministic' : 'mimo-v2.5-pro';
    const latencyBudgetMs = actionMode === 'local-command'
        ? 80
        : actionMode === 'canon-follow' || actionMode === 'world-essence-simulation'
            ? 1800
            : 1400;
    return {
        mode: actionMode,
        model,
        candidateModel: actionMode === 'local-command' ? 'local-deterministic' : 'mimo-v2.5',
        ttsModel: 'mimo-v2.5-tts',
        latencyBudgetMs,
        followsCanonAction: storyRagWorkset?.architecture?.routing?.followsCanonAction === true || actionMode === 'canon-follow',
        simulatesFreeAction: storyRagWorkset?.architecture?.routing?.simulatesFreeAction === true || actionMode === 'free-simulation' || actionMode === 'world-essence-simulation',
        usesIfAttractor: storyRagWorkset?.architecture?.routing?.usesIfAttractor === true || actionMode === 'if-attractor',
    };
}

function buildMemoryUse(storyRagWorkset = {}, contextWorkset = {}) {
    const official = storyRagWorkset?.layers?.officialCausalMemory || {};
    const save = storyRagWorkset?.layers?.saveScopedMemory || {};
    const characters = storyRagWorkset?.layers?.characterMindMemory || {};
    const death = storyRagWorkset?.layers?.deathReturnMemory || {};
    const hot = asArray(contextWorkset.hot).map(factText).filter(Boolean).slice(0, 6);
    const warm = asArray(contextWorkset.warm).map(factText).filter(Boolean).slice(0, 5);
    return {
        storyRagWorksetId: stableHash({
            query: storyRagWorkset?.query,
            routing: storyRagWorkset?.architecture?.routing,
            facts: asArray(storyRagWorkset?.facts).slice(0, 4).map((fact) => fact.id),
        }),
        officialFacts: asArray(official.facts || storyRagWorkset?.facts).map(factText).filter(Boolean).slice(0, 6),
        officialRisks: asArray(official.risks || storyRagWorkset?.risks).map((risk) => compactText(risk?.description || risk?.reason || '', 140)).filter(Boolean).slice(0, 4),
        saveFacts: asArray(save.facts || storyRagWorkset?.runtimeMemory?.saveFacts).map(entryText).filter(Boolean).slice(0, 6),
        characterMemories: asArray(characters.memories || storyRagWorkset?.runtimeMemory?.characterMemories).map(entryText).filter(Boolean).slice(0, 6),
        deathLessons: asArray(death.lessons || storyRagWorkset?.runtimeMemory?.deathMemories).map(entryText).filter(Boolean).slice(0, 4),
        contextHotFacts: hot,
        contextWarmFacts: warm,
        forbiddenPublicFacts: [
            '死亡回归、重置、回到锚点只能作为玩家私有策略记忆，不能自动变成公开谈判事实。',
            'hidden/cold/sidecar 记忆不能直接写成 NPC 已知事实，除非本轮有调查、梦境、文书、传言或残响入口。',
            '官方原作长文本不得注入正文，只能使用因果摘要和 source id。',
        ],
    };
}

function buildWorldModel(state = {}, storyRagWorkset = {}, memoryUse = {}) {
    const ifRoute = storyRagWorkset?.query?.ifRoute || state?.ifRouteLogic || {};
    return {
        currentSituation: compactText([
            state?.current?.location,
            state?.current?.time,
            state?.gameplay?.activeObjective,
            state?.gameplay?.objectiveStage,
        ].filter(Boolean).join(' / '), 220),
        activeActors: activePresence(state),
        activeLocations: unique([state?.current?.location, state?.flags?.playerIntentSceneLockLocation, storyRagWorkset?.query?.location], 6),
        timePressure: compactText(state?.storyFlow?.lastMainlinePulse || state?.worldClock?.lastPulseSummary || state?.gameplay?.failurePressure?.slice?.(-2)?.join(' / ') || '', 120),
        resourcePressure: compactText(Object.entries(state?.gameplay?.resources || {}).map(([key, value]) => `${key}=${value}`).join(' / '), 120),
        canonAttractors: [
            ...asArray(storyRagWorkset?.hooks).map((hook) => compactText(hook.text, 110)),
            ...memoryUse.officialRisks,
        ].filter(Boolean).slice(0, 5),
        ifPressure: {
            dominant: ifRoute.dominant || state?.ifRouteLogic?.dominant || 'EnvyMain',
            lastShift: ifRoute.lastShift || state?.ifRouteLogic?.lastShift || '',
            routePressures: ifRoute.routePressures || state?.ifRouteLogic?.routePressures || {},
        },
        impossibleOutcomes: [
            '无铺垫瞬移到无关地点。',
            '候选行动一键完成复杂目标。',
            '公开死亡回归秘密作为普通说服材料。',
            'IF 压力一次点击硬切路线。',
        ],
    };
}

function choiceFromCandidateSeed(seed = {}) {
    const label = compactText(seed.label || 'RAG', 10);
    const text = compactText(seed.text || '', 86);
    if (!text) {
        return '';
    }
    if (/^【[^】]+】/u.test(text)) {
        return text;
    }
    return `【${label}】${text}`;
}

function buildDirectorPlan(action, routing, worldModel, memoryUse, narrativeDirector = {}) {
    const actionText = action.rawText || action.normalizedIntent || '当前行动';
    const directorBeat = narrativeDirector?.beat || {};
    const payoff = narrativeDirector?.payoff || {};
    const ragSeededChoices = asArray(narrativeDirector?.candidateSeeds)
        .map(choiceFromCandidateSeed)
        .filter(Boolean)
        .slice(0, 6);
    const firstBeat = directorBeat.firstBeat || (routing.mode === 'local-command'
        ? `本地执行命令：${actionText}`
        : `第一拍先让玩家行动落地：${actionText}`);
    return {
        firstBeat,
        reactionBeats: [
            '至少一名当前 NPC 或环境规则必须对这个动作产生即时反应。',
            '反应必须来自当前地点、当前信息差、角色卡或世界规则。',
            ...(narrativeDirector?.promptDirectives || []).slice(1, 3),
        ],
        consequenceBeats: [
            routing.followsCanonAction
                ? '复用原作因果功能，但保留当前存档差异和行动顺序变化。'
                : '按开放世界逻辑结算可验证后果、代价或意外收益。',
            routing.usesIfAttractor
                ? 'IF 只表现为压力、传言、死亡风险、NPC 误读或纠偏入口。'
                : '不把 IF 当作路线开关。',
            memoryUse.deathLessons.length
                ? '死亡教训只改变玩家私有策略和谨慎程度，不自动公开。'
                : '没有可用死亡教训时，不伪造回滚记忆。',
            directorBeat.requiredOutcomeTypes?.length
                ? `本轮至少产出：${directorBeat.requiredOutcomeTypes.join(' / ')}。`
                : '',
        ],
        newHooks: unique([
            ...(narrativeDirector?.openLoops || []).map((loop) => loop.text),
            ...memoryUse.officialFacts.slice(0, 2),
            ...memoryUse.saveFacts.slice(0, 2),
            ...memoryUse.characterMemories.slice(0, 2),
        ], 5),
        stopPoint: directorBeat.stopPoint || '停在一个自然选择点：取证、对话、撤离、试探、求援、等待或继续追问。',
        candidateActionPolicy: {
            requiredTypes: ['investigation', 'relationship', 'survival_or_exit'],
            includeCanonOption: routing.mode === 'canon-follow' || worldModel.canonAttractors.length > 0,
            includeCustomOption: true,
            mustGroundInCurrentScene: true,
            requiredOutcomeTypes: directorBeat.requiredOutcomeTypes || [],
            ragSeededChoices,
            ragSeededChoiceSources: asArray(narrativeDirector?.candidateSeeds)
                .slice(0, 6)
                .map((seed) => ({
                    type: seed.type,
                    grounding: seed.grounding,
                    sourceIds: asArray(seed.sourceIds).slice(0, 3),
                })),
            avoidTemplateFallbackWhenSeedsAvailable: ragSeededChoices.length >= 3,
        },
        beatType: directorBeat.type || 'conflict',
        pacing: directorBeat.pacing || 'balanced',
        mustAdvance: directorBeat.mustAdvance !== false,
        requiredOutcomeTypes: directorBeat.requiredOutcomeTypes || [],
        forbidden: directorBeat.forbidden || [],
        payoff,
        sceneClock: narrativeDirector?.sceneClock || {},
        arcDuty: narrativeDirector?.arcDuty || {},
        characterDuty: narrativeDirector?.characterDuty || [],
        narrativeDirector,
    };
}

function attachWorldContextToDirectorPlan(directorPlan = {}, worldContext = {}) {
    const candidateContract = worldContext?.candidateContract || {};
    const stageContract = worldContext?.stageContract || {};
    return {
        ...directorPlan,
        candidateActionPolicy: {
            ...(directorPlan.candidateActionPolicy || {}),
            worldContextId: worldContext?.contextId || '',
            requiredGroundingTerms: candidateContract.requiredGroundingTerms || [],
            bannedPatterns: candidateContract.bannedPatterns || [],
            stageGroundingTerms: stageContract.groundingTerms || [],
            noTemplateFallback: candidateContract.noTemplateFallback === true,
        },
        worldContextId: worldContext?.contextId || '',
    };
}

function buildUiPlan(state = {}, action = {}, routing = {}, assetPlan = {}) {
    const visualNovel = state?.visuals?.visualNovel || {};
    const backdrop = state?.visuals?.sceneBackdrop || {};
    const currentSpeaker = visualNovel.currentSpeakerName
        || visualNovel.activeUi?.speakerName
        || visualNovel.segments?.[visualNovel.currentIndex || 0]?.speaker
        || '';
    return {
        optimisticStageText: routing.mode === 'local-command'
            ? `本地指令处理中：${compactText(action.rawText || action.normalizedIntent, 80)}`
            : `你选择的行动已经落到舞台上：${compactText(action.rawText || action.normalizedIntent, 100)}`,
        expectedBackgroundKey: assetPlan?.selectedBackdrop?.key || backdrop.currentKey || visualNovel.backgroundKey || '',
        expectedSpeaker: compactText(currentSpeaker || activePresence(state)[0] || '旁白', 32),
        ttsTargets: [
            {
                kind: currentSpeaker ? 'dialogue' : 'narration',
                speaker: compactText(currentSpeaker || 'narrator', 32),
                model: 'mimo-v2.5-tts',
                policy: '只朗读正文/台词，不朗读候选行动、状态块、RAG、VN_SCRIPT 或调试文本。',
            },
        ],
        sidePanelDeltas: [
            '显示当前路由模式。',
            '刷新候选行动 grounding。',
            'TTS 生成后写入 HUD 播放器缓存。',
        ],
    };
}

export function buildAgentTurnPlan(state = {}, playerAction = {}, options = {}) {
    const storyRagWorkset = options.storyRagWorkset || {};
    const contextWorkset = options.contextWorkset || {};
    const action = inferPlayerAction(state, playerAction);
    const routing = routingFromRag(storyRagWorkset, state);
    const memoryUse = buildMemoryUse(storyRagWorkset, contextWorkset);
    const worldModel = buildWorldModel(state, storyRagWorkset, memoryUse);
    const narrativeDirector = buildNarrativeDirectorPlan(state, action, {
        storyRagWorkset,
        memoryUse,
        worldModel,
        routing,
    });
    const directorPlan = buildDirectorPlan(action, routing, worldModel, memoryUse, narrativeDirector);
    const assetPlan = buildAssetPlan(state, action, {
        storyRagWorkset,
        limit: 8,
    });
    const worldContext = buildWorldContext(state, action, {
        storyRagWorkset,
        memoryUse,
        worldModel,
        narrativeDirector,
        directorPlan,
        assetPlan,
        routing,
    });
    const groundedDirectorPlan = attachWorldContextToDirectorPlan(directorPlan, worldContext);
    const uiPlan = buildUiPlan(state, action, routing, assetPlan);
    const core = {
        saveId: state?.flags?.worldSessionId || state?.worldline?.id || 'unknown-save',
        action: action.rawText,
        location: state?.current?.location || '',
        objective: state?.gameplay?.activeObjective || '',
        routingMode: routing.mode,
        storyRag: memoryUse.storyRagWorksetId,
    };
    const fingerprint = stableHash(core);
    return {
        version: 'agent-turn-plan/v1',
        turnId: `turn-${fingerprint}`,
        fingerprint,
        generatedAt: action.committedAt || state?.flags?.lastAgentTurnPlan?.generatedAt || '',
        saveId: core.saveId,
        playerAction: action,
        routing,
        memoryUse,
        worldModel,
        worldContext,
        narrativeDirector,
        directorPlan: groundedDirectorPlan,
        assetPlan,
        uiPlan,
        validators: {
            mustAcknowledgePlayerAction: routing.mode !== 'local-command',
            deathReturnPublicLeakBlocked: true,
            sceneJumpRequiresExplicitPlayerIntent: true,
            noLongCanonQuote: true,
            candidateActionsMustBeCurrentSceneGrounded: true,
            backgroundKeyMustUseAssetPlan: true,
            characterSpritesMustMatchVisibleCast: true,
            ttsMustIgnoreSystemPanels: true,
        },
    };
}

export function summarizeAgentTurnPlan(plan, limit = DEFAULT_PLAN_LIMIT) {
    if (!plan) {
        return '- AgentTurnPlan 未生成。';
    }
    const narrativeDirector = plan.narrativeDirector || plan.directorPlan?.narrativeDirector || {};
    const narrativeLine = narrativeDirector?.version
        ? `Arc${narrativeDirector.scope?.arc || '?'} ${narrativeDirector.beat?.type || 'conflict'}/${narrativeDirector.beat?.pacing || 'balanced'} payoff=${narrativeDirector.payoff?.pressure || 'low'} advance=${narrativeDirector.beat?.mustAdvance === false ? 'no' : 'yes'}`
        : compactText(summarizeNarrativeDirectorPlan(narrativeDirector, 180), 180);
    const output = [
        `- 计划: ${plan.version || 'agent-turn-plan'} / ${plan.turnId || 'unknown'} / save=${compactText(plan.saveId || '', 36)}`,
        `- 路由: ${plan.routing?.mode || 'free-simulation'} / model=${plan.routing?.model || 'mimo-v2.5-pro'} / 候选=${plan.routing?.candidateModel || 'mimo-v2.5'} / TTS=${plan.routing?.ttsModel || 'mimo-v2.5-tts'} / 预算=${plan.routing?.latencyBudgetMs ?? '?'}ms`,
        `- 玩家行动: ${compactText(plan.playerAction?.rawText || plan.playerAction?.normalizedIntent || '无', 160)}`,
        `- 第一拍: ${compactText(plan.directorPlan?.firstBeat || '', 160)}`,
        `- 剧情导演: ${narrativeLine}`,
        `- WorldContext: ${compactText(summarizeWorldContext(plan.worldContext, 220), 220)}`,
        `- RAG 候选种子: ${(plan.directorPlan?.candidateActionPolicy?.ragSeededChoices || []).slice(0, 2).map((item) => compactText(item, 80)).join(' / ') || '无'}`,
        `- 素材计划: ${compactText(summarizeAssetPlan(plan.assetPlan, 260), 260)}`,
        `- 当前局势: ${compactText(plan.worldModel?.currentSituation || '', 170)}`,
        `- 原作/风险锚点: ${(plan.memoryUse?.officialFacts || []).slice(0, 2).join(' / ') || '无'}`,
        `- 存档记忆: ${(plan.memoryUse?.saveFacts || []).slice(0, 2).join(' / ') || '无'}`,
        `- 角色记忆: ${(plan.memoryUse?.characterMemories || []).slice(0, 2).join(' / ') || '无'}`,
        `- 死亡私有教训: ${(plan.memoryUse?.deathLessons || []).slice(0, 2).join(' / ') || '无'}`,
        `- UI 即时反馈: ${compactText(plan.uiPlan?.optimisticStageText || '', 150)} / 背景=${compactText(plan.uiPlan?.expectedBackgroundKey || 'auto', 32)} / 声音=${compactText(plan.uiPlan?.ttsTargets?.[0]?.speaker || 'narrator', 32)}`,
        `- 输出契约: ${(plan.directorPlan?.reactionBeats || []).slice(0, 1).join('；')}；${plan.directorPlan?.stopPoint || ''}`,
        `- 校验: ${Object.entries(plan.validators || {}).filter(([, enabled]) => enabled).map(([key]) => key).join(' / ') || '无'}`,
    ].join('\n');
    if (output.length <= limit) {
        return output;
    }
    return `${output.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}
