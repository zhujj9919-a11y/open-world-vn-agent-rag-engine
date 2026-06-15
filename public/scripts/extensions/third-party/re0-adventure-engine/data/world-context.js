const DEFAULT_SUMMARY_LIMIT = 1100;

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function compactText(value, limit = 140) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= limit) {
        return text;
    }
    return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function unique(values, limit = 16) {
    const seen = new Set();
    const output = [];
    for (const value of values || []) {
        const text = String(value || '').trim();
        if (!text || seen.has(text)) {
            continue;
        }
        seen.add(text);
        output.push(text);
        if (output.length >= limit) {
            break;
        }
    }
    return output;
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

function textOf(item, limit = 150) {
    return compactText(item?.text || item?.summary || item?.title || item?.description || item?.promise || item?.id || item || '', limit);
}

function activeActorsFrom(state = {}, worldModel = {}, storyRagWorkset = {}) {
    const visualNovel = state?.visuals?.visualNovel || {};
    return unique([
        ...asArray(worldModel?.activeActors),
        ...asArray(storyRagWorkset?.query?.characters),
        ...asArray(state?.current?.castIds),
        ...asArray(visualNovel.sceneCharacters),
        ...asArray(visualNovel.castIds),
        visualNovel.currentSpeakerName,
        ...asArray(state?.presence?.sceneCharacters),
        ...asArray(state?.presence?.areaCharacters).slice(0, 6),
        ...Object.keys(state?.characterCards || {}).slice(0, 8),
    ], 14);
}

function extractGroundingTerms(values = [], limit = 36) {
    const stop = new Set([
        '当前',
        '未知',
        '地点',
        '深夜',
        '清晨',
        '玩家',
        '目标',
        '推进',
        '确认',
        '调查',
        '继续',
        '行动',
        '选择',
        '原作',
        '原创',
        '立刻',
        '马上',
        '前往',
        '带着',
        '拒绝',
        '要求',
        '承认',
        '身份',
        '你的',
        '一个',
        '这个',
    ]);
    const keyTermPattern = /王都|露格尼卡|赃物库|徽章|艾尔莎|爱蜜莉雅|菲鲁特|罗姆爷|莱因哈鲁特|图书馆|档案室|废室|禁书区|寄存簿|寄存|脚印|灰衣人|木盒|黑伞|莉榭尔|米娅|救济院|修女院|钟楼|废钟|钟声|甬道|剥钟人|祷文|宅邸|诅咒|蕾姆|拉姆|碧翠丝|罗兹瓦尔|圣域|墓所|试炼|艾姬多娜|王选|白鲸|怠惰|魔女教|水门都市|普利斯提拉|监视塔|死者之书|帝国|大瀑布|答案之书/gu;
    const output = [];
    for (const value of values || []) {
        const source = String(value || '');
        for (const match of source.matchAll(keyTermPattern)) {
            output.push(match[0]);
        }
        for (const part of source.split(/[\s/／·・,，。:：;；|｜()[\]【】"'“”]+/u)) {
            const terms = String(part || '').match(/[\u4e00-\u9fa5A-Za-z0-9]{2,}/gu) || [];
            for (const rawTerm of terms) {
                const term = rawTerm.trim();
                if (!term || term.length < 2 || stop.has(term)) {
                    continue;
                }
                if (term.length <= 12) {
                    output.push(term);
                }
            }
        }
    }
    return unique(output, limit);
}

function actionRouting(routing = {}, storyRagWorkset = {}, state = {}) {
    const mode = routing.mode
        || storyRagWorkset?.architecture?.routing?.actionMode
        || storyRagWorkset?.directorSignals?.actionMode
        || (state?.flags?.localCommandBrief ? 'local-command' : 'free-simulation');
    return {
        mode,
        followsCanonAction: routing.followsCanonAction === true || mode === 'canon-follow',
        simulatesFreeAction: routing.simulatesFreeAction === true || mode === 'free-simulation' || mode === 'world-essence-simulation',
        usesIfAttractor: routing.usesIfAttractor === true || mode === 'if-attractor',
        attractorStrength: storyRagWorkset?.directorSignals?.attractorStrength || storyRagWorkset?.architecture?.routing?.attractorStrength || '',
        divergence: Number(state?.worldline?.divergence || 0),
    };
}

function sourceIds(items = [], limit = 8) {
    return unique(asArray(items).map((item) => item?.id || item?.sourceId || item?.sourceDoc || '').filter(Boolean), limit);
}

function candidateSeedText(seed = {}) {
    const label = seed.label || seed.type || 'RAG';
    const text = textOf(seed, 100);
    return text ? `【${compactText(label, 10)}】${text}` : '';
}

export function buildWorldContext(state = {}, playerAction = {}, options = {}) {
    const storyRagWorkset = options.storyRagWorkset || {};
    const memoryUse = options.memoryUse || {};
    const worldModel = options.worldModel || {};
    const narrativeDirector = options.narrativeDirector || {};
    const directorPlan = options.directorPlan || {};
    const assetPlan = options.assetPlan || {};
    const routing = actionRouting(options.routing || {}, storyRagWorkset, state);
    const actionText = compactText(playerAction.rawText || playerAction.text || playerAction.normalizedIntent || state?.gameplay?.lastPlayerAction || '', 260);
    const actors = activeActorsFrom(state, worldModel, storyRagWorkset);
    const officialFacts = unique(asArray(memoryUse.officialFacts || storyRagWorkset?.facts).map((item) => textOf(item, 150)).filter(Boolean), 8);
    const continuityRisks = unique(asArray(memoryUse.officialRisks || storyRagWorkset?.risks).map((item) => textOf(item, 140)).filter(Boolean), 6);
    const hooks = unique(asArray(storyRagWorkset?.hooks).map((item) => textOf(item, 130)).filter(Boolean), 6);
    const requiredGroundingTerms = extractGroundingTerms([
        state?.current?.location,
        state?.flags?.playerIntentSceneLockLocation,
        state?.gameplay?.activeObjective,
        state?.gameplay?.objectiveStage,
        actionText,
        ...asArray(state?.discoveredClues),
        ...actors,
    ], 40);
    const ragSeededChoices = unique(asArray(narrativeDirector?.candidateSeeds).map(candidateSeedText).filter(Boolean), 8);
    const selectedBackdrop = assetPlan?.selectedBackdrop || {};
    const candidateBackdrops = asArray(assetPlan?.candidateBackdrops);
    const castAssets = asArray(assetPlan?.castAssets);
    const voiceTargets = asArray(assetPlan?.voiceTargets);
    const contextId = `wctx-${stableHash({
        saveId: state?.flags?.worldSessionId || state?.worldline?.id || '',
        arc: state?.current?.arc || 1,
        location: state?.current?.location || '',
        action: actionText,
        routing: routing.mode,
        facts: sourceIds(storyRagWorkset?.facts, 5),
        backdrop: selectedBackdrop.key || '',
    })}`;
    return {
        version: 're0-world-context/v1',
        contextId,
        authority: {
            official: 'global-causal-groundtruth',
            save: 'current-save-groundtruth',
            character: 'per-save-npc-state',
            death: 'player-private-memory',
            assets: 'registered-visual-asset-catalog',
        },
        routing,
        current: {
            arc: Number(state?.current?.arc || storyRagWorkset?.query?.arc || 1),
            day: Number(state?.current?.day || 1),
            time: compactText(state?.current?.time || '', 60),
            location: compactText(state?.current?.location || storyRagWorkset?.query?.location || '', 90),
            objective: compactText(state?.gameplay?.activeObjective || '', 180),
            action: actionText,
            activeActors: actors,
        },
        causalFrame: {
            officialFacts,
            continuityRisks,
            hooks,
            longRangeGoal: compactText(narrativeDirector?.arcDuty?.longRangeGoal || '', 180),
            nextMilestones: unique(narrativeDirector?.arcDuty?.nextMilestones || [], 6),
            cannotShortcut: unique(narrativeDirector?.arcDuty?.cannotShortcut || [], 6),
            canonAttractors: unique(worldModel?.canonAttractors || [], 6),
            impossibleOutcomes: unique(worldModel?.impossibleOutcomes || [], 8),
            sourceIds: sourceIds(storyRagWorkset?.facts, 8),
        },
        memoryFrame: {
            saveFacts: unique(memoryUse.saveFacts || [], 8),
            characterMemories: unique(memoryUse.characterMemories || [], 8),
            deathLessons: unique(memoryUse.deathLessons || [], 6),
            forbiddenPublicFacts: unique(memoryUse.forbiddenPublicFacts || [], 8),
            saveSessionId: storyRagWorkset?.runtimeMemory?.sessionId || storyRagWorkset?.memoryPolicy?.saveMemorySessionId || '',
        },
        decisionContract: {
            firstBeat: compactText(directorPlan?.firstBeat || narrativeDirector?.beat?.firstBeat || '', 180),
            mustAdvance: narrativeDirector?.beat?.mustAdvance !== false && directorPlan?.mustAdvance !== false,
            requiredOutcomeTypes: unique(directorPlan?.requiredOutcomeTypes || narrativeDirector?.beat?.requiredOutcomeTypes || [], 8),
            stopPoint: compactText(directorPlan?.stopPoint || narrativeDirector?.beat?.stopPoint || '', 180),
            openLoops: asArray(narrativeDirector?.openLoops).slice(0, 6).map((loop) => ({
                id: compactText(loop?.id || '', 60),
                source: compactText(loop?.source || '', 40),
                urgency: compactText(loop?.urgency || '', 24),
                action: compactText(loop?.action || '', 32),
                text: textOf(loop, 120),
            })),
            payoffPressure: narrativeDirector?.payoff?.pressure || 'low',
            promptDirectives: unique(narrativeDirector?.promptDirectives || [], 8),
            evaluatorRules: unique(narrativeDirector?.evaluatorRules || [], 8),
        },
        candidateContract: {
            requiredGroundingTerms,
            requiredChoiceTypes: ['canon_or_attractor', 'current_scene_probe', 'relationship_or_memory', 'custom'],
            ragSeededChoices,
            seedSources: asArray(narrativeDirector?.candidateSeeds).slice(0, 8).map((seed) => ({
                type: compactText(seed?.type || '', 40),
                grounding: compactText(seed?.grounding || '', 120),
                sourceIds: sourceIds(seed?.sourceIds || seed?.sources || [], 4),
            })),
            bannedPatterns: [
                '候选行动不能无铺垫跳到无关地点。',
                '候选行动不能一键完成复杂目标。',
                '候选行动不能把死亡回归写成公开事实。',
                '候选行动不能只复读原作主线而忽略当前玩家行动。',
            ],
            includeCanonOption: routing.followsCanonAction || asArray(worldModel?.canonAttractors).length > 0,
            includeCustomOption: true,
            noTemplateFallback: ragSeededChoices.length >= 3,
        },
        stageContract: {
            expectedBackgroundKey: selectedBackdrop.key || state?.visuals?.visualNovel?.backgroundKey || state?.visuals?.sceneBackdrop?.currentKey || '',
            candidateBackdropKeys: unique(candidateBackdrops.map((item) => item?.key).filter(Boolean), 8),
            castIds: unique(castAssets.map((item) => item?.id || item?.characterId).filter(Boolean), 10),
            sourceNovelReferences: asArray(assetPlan?.sourceNovelReferences).slice(0, 8).map((item) => ({
                id: compactText(item?.id || '', 70),
                kind: compactText(item?.kind || '', 32),
                reason: compactText(item?.reason || '', 100),
            })),
            voiceTargets: voiceTargets.slice(0, 8).map((target) => ({
                id: compactText(target?.id || target?.speaker || '', 50),
                speaker: compactText(target?.speaker || target?.name || '', 50),
                model: compactText(target?.model || 'mimo-v2.5-tts', 32),
            })),
            assetPolicy: [
                '舞台只根据当前已播放文本队列和已验证 VN_SCRIPT 更新，不抢跑模型未播放内容。',
                '背景和立绘优先使用 assetPlan 的注册资源，不让模型凭空写 key。',
                '世界意志/chat 文本不驱动舞台切换，剧情旁白和角色台词才驱动舞台演出。',
            ],
            groundingTerms: requiredGroundingTerms.slice(0, 20),
        },
        promptPayload: {
            routeMode: routing.mode,
            currentScene: compactText([state?.current?.location, state?.current?.time, state?.gameplay?.activeObjective].filter(Boolean).join(' / '), 220),
            action: actionText,
            officialFacts: officialFacts.slice(0, 4),
            saveFacts: unique(memoryUse.saveFacts || [], 4),
            characterMemories: unique(memoryUse.characterMemories || [], 4),
            deathLessonsPrivate: unique(memoryUse.deathLessons || [], 3),
            assetKeys: unique([selectedBackdrop.key, ...candidateBackdrops.map((item) => item?.key)].filter(Boolean), 6),
            candidateSeeds: ragSeededChoices.slice(0, 5),
        },
    };
}

export function summarizeWorldContext(context = {}, limit = DEFAULT_SUMMARY_LIMIT) {
    if (!context) {
        return '- WorldContext 未生成。';
    }
    const output = [
        `- WorldContext: ${context.version || 'unknown'} / ${context.contextId || 'unknown'} / mode=${context.routing?.mode || ''}`,
        `- 当前: Arc${context.current?.arc || '?'} / ${compactText(context.current?.location || '', 70)} / action=${compactText(context.current?.action || '', 120)}`,
        `- 因果: facts=${asArray(context.causalFrame?.officialFacts).slice(0, 2).join(' / ') || '无'} / risks=${asArray(context.causalFrame?.continuityRisks).slice(0, 2).join(' / ') || '无'}`,
        `- 存档: save=${asArray(context.memoryFrame?.saveFacts).slice(0, 2).join(' / ') || '无'} / npc=${asArray(context.memoryFrame?.characterMemories).slice(0, 1).join(' / ') || '无'} / death=${asArray(context.memoryFrame?.deathLessons).slice(0, 1).join(' / ') || '无'}`,
        `- 决策: firstBeat=${compactText(context.decisionContract?.firstBeat || '', 130)} / advance=${context.decisionContract?.mustAdvance === false ? 'no' : 'yes'} / payoff=${context.decisionContract?.payoffPressure || 'low'}`,
        `- 候选: terms=${asArray(context.candidateContract?.requiredGroundingTerms).slice(0, 8).join(',') || '无'} / seeds=${asArray(context.candidateContract?.ragSeededChoices).slice(0, 2).map((item) => compactText(item, 70)).join(' / ') || '无'}`,
        `- 舞台: bg=${context.stageContract?.expectedBackgroundKey || 'auto'} / cast=${asArray(context.stageContract?.castIds).slice(0, 6).join(',') || 'none'}`,
    ].join('\n');
    if (output.length <= limit) {
        return output;
    }
    return `${output.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}
