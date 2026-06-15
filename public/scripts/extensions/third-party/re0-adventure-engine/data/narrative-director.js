import {
    canonRouteReferenceByArc,
} from './re0-canon-rag.generated.js';

const DEFAULT_SUMMARY_LIMIT = 1100;

const PROJECT_ORIGINAL_ARC_PROFILE = Object.freeze({
    label: 'Arc11 项目原创终局 / 世界线树 / 封印边界',
    longRangeGoal: '以项目原创终局线收束封印、世界边界、阵营代价和玩家路线答案；只能把官方世界观作为底盘，不能伪装成官方原文。',
    nextMilestones: ['确认封印代价', '给出终局阵营选择压力', '回收核心伏笔并保留最终行动权'],
    cannotShortcut: ['不能伪装成官方原文', '不能让终局封印无牺牲解决'],
    source: 'project-original-fallback',
});

function deriveArcMilestonesFromReference(reference = {}) {
    const spine = String(reference.canonSpine || '');
    const digest = String(reference.summaryDigest || '');
    const candidates = [];
    const add = (value) => {
        const text = String(value || '').replace(/\s+/g, ' ').trim();
        if (text) {
            candidates.push(text);
        }
    };
    for (const part of spine.split(/[；;。]/u)) {
        if (/确认|处理|追查|组织|拒绝|救援|调查|恢复|回归|收束|保存|破解|建立|同盟|证据|代价/u.test(part)) {
            add(part);
        }
    }
    for (const sentence of digest.split(/[。；;]/u).slice(0, 8)) {
        if (/核心|冲突|跨越|成功|最终|关键|代价|权能|试炼|同盟|证据/u.test(sentence)) {
            add(sentence);
        }
    }
    return unique(candidates.map((item) => compactText(item, 84)), 6);
}

function deriveArcCannotShortcutFromReference(reference = {}) {
    const title = String(reference.title || '');
    const spine = String(reference.canonSpine || '');
    return unique([
        spine ? `不能把 ${compactText(title || '当前 Arc', 20)} 改写成无代价跳过核心因果：${compactText(spine, 96)}` : '',
        '不能用旁白替角色原谅、背叛、知道或遗忘；必须由角色知识边界和存档记忆支撑。',
        '不能把原作行动写成瞬移路线按钮；必须通过当前场景行动、证据、代价或时间窗连续接回。',
    ], 4);
}

function arcProfileFromRagReference(arc = 1) {
    if (Number(arc) === 11) {
        return PROJECT_ORIGINAL_ARC_PROFILE;
    }
    const reference = canonRouteReferenceByArc?.[String(arc)] || canonRouteReferenceByArc?.[arc];
    if (!reference) {
        return {
            label: `Arc${arc} RAG 未命中 / 使用通用开放世界职责`,
            longRangeGoal: '承接玩家行动，按当前存档、角色知识边界、原作世界规则和可验证因果推进。',
            nextMilestones: ['推进当前目标的可验证因果'],
            cannotShortcut: ['不能无铺垫跳过代价、证据、角色反应或地点转移。'],
            source: 'generic-fallback',
        };
    }
    return {
        label: String(reference.title || `Arc${arc}`).replace(/^Arc\s+(\d+)/iu, 'Arc$1'),
        longRangeGoal: reference.canonSpine || reference.summaryDigest || '按生成的 canon RAG 参考保持原作因果牵引。',
        nextMilestones: deriveArcMilestonesFromReference(reference),
        cannotShortcut: deriveArcCannotShortcutFromReference(reference),
        source: 'canon-rag-generated',
        sourceMode: reference.policy || '',
    };
}

const BEAT_OUTCOMES = Object.freeze({
    hook: ['new_clue', 'choice_pressure'],
    conflict: ['danger_shift', 'relationship_shift', 'choice_pressure'],
    reveal: ['new_clue', 'world_rule_pressure', 'choice_pressure'],
    payoff: ['payoff', 'relationship_shift', 'new_objective'],
    transition: ['location_transition', 'new_objective', 'cost_or_delay'],
    aftermath: ['relationship_shift', 'private_memory_update', 'new_strategy'],
    daily: ['relationship_shift', 'low_risk_information', 'small_resource_or_comfort'],
    'adult-intimacy': ['relationship_shift', 'consent_boundary', 'soft_intimacy_window'],
    survival: ['danger_shift', 'escape_or_defense_option', 'new_strategy'],
    system: ['local_state_feedback'],
});

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

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function textOf(item) {
    return compactText(item?.text || item?.summary || item?.title || item?.description || item?.promise || item?.id || item || '', 160);
}

function inferArc(state = {}, storyRagWorkset = {}) {
    const direct = Number(storyRagWorkset?.query?.arc || state?.current?.arc || state?.arc);
    if (Number.isFinite(direct) && direct > 0) {
        return clamp(Math.round(direct), 1, 11);
    }
    const day = Number(state?.current?.day || state?.day || 1);
    if (Number.isFinite(day) && day > 0) {
        return clamp(Math.ceil(day / 100), 1, 11);
    }
    return 1;
}

function activeCharacters(state = {}, storyRagWorkset = {}) {
    const visualNovel = state?.visuals?.visualNovel || {};
    return unique([
        ...asArray(storyRagWorkset?.query?.characters),
        ...asArray(state?.current?.castIds),
        ...asArray(visualNovel.sceneCharacters),
        ...asArray(visualNovel.castIds),
        visualNovel.currentSpeakerName,
        ...asArray(state?.presence?.sceneCharacters),
        ...asArray(state?.presence?.areaCharacters).slice(0, 6),
        ...Object.keys(state?.characterCards || {}).slice(0, 8),
    ], 12);
}

function routeModeFrom(routing = {}, state = {}, storyRagWorkset = {}) {
    const actionMode = routing.mode || storyRagWorkset?.architecture?.routing?.actionMode || storyRagWorkset?.directorSignals?.actionMode || 'free-simulation';
    if (actionMode === 'canon-follow') {
        return 'canon-attractor';
    }
    if (actionMode === 'if-attractor' || routing.usesIfAttractor) {
        return 'if-attractor';
    }
    if (actionMode === 'world-essence-simulation') {
        return 'world-essence';
    }
    if (state?.mode === 'setup') {
        return 'setup-director';
    }
    if (actionMode === 'local-command') {
        return 'local-command';
    }
    return 'free-causal-simulation';
}

function storyModeFrom(state = {}, actionText = '') {
    const source = [
        state?.mode,
        state?.narrativeMode?.mode,
        state?.gameplay?.activeObjective,
        state?.gameplay?.objectiveStage,
        actionText,
    ].filter(Boolean).join(' ');
    if (/answer_book|答案之书|死亡复盘|返回锚点/u.test(source)) {
        return 'answer-book';
    }
    if (/setup|建档|开局设定/u.test(source)) {
        return 'setup';
    }
    if (/成人|亲密|暧昧|恋爱|欲望|private|intimacy/u.test(source)) {
        return 'adult-intimacy';
    }
    if (/日常|休整|吃饭|逛街|闲聊|照料/u.test(source)) {
        return 'daily';
    }
    if (/主线|原作线|收束|危机|袭击|司教|白鲸|试炼|封印/u.test(source)) {
        return 'mainline';
    }
    return 'open-world';
}

function sceneClockFrom(state = {}, action = {}, storyRagWorkset = {}) {
    const visualNovel = state?.visuals?.visualNovel || {};
    const segmentCount = asArray(visualNovel.segments).length;
    const currentIndex = Number(visualNovel.currentIndex || 0);
    const explicitTurns = Number(state?.storyFlow?.turnsInScene ?? state?.flags?.turnsInCurrentScene ?? 0);
    const sceneProgress = segmentCount > 0 ? clamp(currentIndex / Math.max(1, segmentCount - 1), 0, 1) : 0;
    const sameSceneSignals = [
        state?.current?.location,
        action.sceneLock,
        storyRagWorkset?.query?.location,
        state?.flags?.playerIntentSceneLockLocation,
    ].filter(Boolean);
    const repeatedScene = unique(sameSceneSignals, 2).length <= 1 && sameSceneSignals.length >= 2;
    const staleTurns = clamp(explicitTurns || (repeatedScene && sceneProgress > 0.7 ? 2 : repeatedScene ? 1 : 0), 0, 5);
    return {
        beatIndex: clamp(Math.round(currentIndex) + 1, 1, 99),
        cachedSegments: segmentCount,
        sceneProgress: Number(sceneProgress.toFixed(2)),
        staleTurns,
        pressure: staleTurns >= 3 ? 'high' : staleTurns >= 2 || sceneProgress >= 0.85 ? 'medium' : 'normal',
        mustTransitionSoon: staleTurns >= 3 || (segmentCount >= 6 && sceneProgress >= 0.85),
        scenePurpose: compactText(state?.storyFlow?.currentScenePurpose || state?.gameplay?.activeObjective || '承接玩家行动并推进一个可验证变化', 120),
    };
}

function urgencyForLoop(loop = {}, currentArc = 1, sceneClock = {}) {
    const windowText = String(loop.payoffWindow || loop.window || '');
    const loopArc = Number(loop.arc || 0);
    let score = 1;
    if (loopArc === currentArc || windowText.includes(`Arc ${currentArc}`) || windowText.includes(`Arc${currentArc}`)) {
        score += 2;
    }
    if (/high|hot|必须|关键|死亡|危机|收束|封印|试炼|司教/u.test(`${loop.status || ''} ${loop.text || ''} ${loop.promise || ''}`)) {
        score += 1;
    }
    if (sceneClock.mustTransitionSoon) {
        score += 1;
    }
    return score >= 4 ? 'high' : score >= 3 ? 'medium' : 'low';
}

function openLoopsFrom(state = {}, storyRagWorkset = {}, memoryUse = {}, currentArc = 1, sceneClock = {}) {
    const loops = [];
    const add = (source, item, extra = {}) => {
        const text = textOf(item);
        if (!text) {
            return;
        }
        const loop = {
            id: compactText(item?.id || `${source}-${stableHash(text)}`, 60),
            source,
            arc: Number(item?.arc || currentArc),
            text,
            payoffWindow: item?.payoffWindow || extra.payoffWindow || '',
            urgency: 'low',
            action: 'defer',
        };
        loop.urgency = urgencyForLoop(loop, currentArc, sceneClock);
        loop.action = loop.urgency === 'high' ? 'payoff' : loop.urgency === 'medium' ? 'advance' : 'defer';
        loops.push(loop);
    };
    asArray(storyRagWorkset?.hooks).slice(0, 5).forEach((hook) => add('story-rag-hook', hook));
    asArray(state?.flags?.pendingReveals).slice(0, 3).forEach((entry) => add('pending-reveal', {
        id: entry?.id || entry?.summary || entry,
        arc: currentArc,
        text: entry?.summary || entry?.futureSignal || entry?.event || entry,
    }));
    asArray(state?.flags?.pendingRumors).slice(0, 3).forEach((entry) => add('pending-rumor', {
        id: entry?.id || entry?.text || entry,
        arc: currentArc,
        text: entry?.text || entry?.summary || entry,
    }));
    asArray(state?.gameplay?.openQuestions).slice(0, 4).forEach((question) => add('open-question', {
        id: question,
        arc: currentArc,
        text: question,
    }));
    asArray(memoryUse?.saveFacts).slice(0, 2).forEach((fact) => add('save-memory', {
        id: fact,
        arc: currentArc,
        text: fact,
    }));
    return unique(loops.map((loop) => JSON.stringify(loop)), 8).map((text) => JSON.parse(text));
}

function candidateSeedsFrom(storyRagWorkset = {}, limit = 6) {
    return asArray(storyRagWorkset?.candidateSeeds)
        .map((seed) => ({
            id: compactText(seed.id || seed.text || '', 60),
            type: compactText(seed.type || 'action', 36),
            label: compactText(seed.label || 'RAG', 28),
            text: compactText(seed.text || '', 150),
            grounding: compactText(seed.grounding || 'current-scene', 40),
            sourceIds: asArray(seed.sourceIds).slice(0, 3),
            priority: Number(seed.priority || 0),
        }))
        .filter((seed) => seed.text)
        .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
        .slice(0, limit);
}

function ragArcDutyFrom(profile = {}, storyRagWorkset = {}, routeMode = '', storyMode = '') {
    const factTexts = asArray(storyRagWorkset?.facts)
        .map((fact) => textOf(fact))
        .filter(Boolean)
        .slice(0, 3);
    const hookTexts = asArray(storyRagWorkset?.hooks)
        .map((hook) => textOf(hook))
        .filter(Boolean)
        .slice(0, 3);
    const riskTexts = asArray(storyRagWorkset?.risks)
        .map((risk) => compactText(risk?.description || risk?.reason || '', 150))
        .filter(Boolean)
        .slice(0, 3);
    const chunkTexts = asArray(storyRagWorkset?.chunks)
        .map((chunk) => compactText(chunk?.digest || '', 140))
        .filter(Boolean)
        .slice(0, 2);
    const seedTexts = candidateSeedsFrom(storyRagWorkset, 4).map((seed) => seed.text);
    const canonicalPull = routeMode === 'canon-attractor'
        ? '原作行动选择时，优先复用原作因果功能和同 Arc 关键节点。'
        : routeMode === 'if-attractor'
            ? 'IF 选择只表现为连续压力、代价、误读和纠偏入口。'
            : '自由行动时，先结算当前存档与角色反应，再用原作规则过滤后果。';
    const longRangePieces = unique([
        canonicalPull,
        profile.longRangeGoal,
        ...hookTexts,
        ...factTexts,
    ], 5);
    const milestoneCandidates = unique([
        ...hookTexts,
        ...seedTexts,
        ...factTexts,
        ...asArray(profile.nextMilestones),
    ].map((item) => compactText(item, 80)), 6);
    const cannotShortcut = unique([
        ...riskTexts,
        ...asArray(profile.cannotShortcut),
        storyMode === 'adult-intimacy' ? '亲密线必须服务角色关系和当前危机，不能覆盖主线逻辑。' : '',
    ], 6);
    return {
        source: profile.source || 'unknown',
        sourceMode: profile.sourceMode || '',
        longRangeGoal: compactText(longRangePieces.join(' / '), 320),
        nextMilestone: milestoneCandidates[0] || profile.nextMilestones?.[0] || '推进当前目标的可验证因果',
        milestoneCandidates,
        cannotShortcut,
        ragFacts: factTexts,
        ragHooks: hookTexts,
        ragRisks: riskTexts,
        sourceDigests: chunkTexts,
    };
}

function payoffPlanFrom(openLoops = [], sceneClock = {}, routing = {}) {
    const candidates = openLoops
        .filter((loop) => loop.action === 'payoff' || loop.action === 'advance')
        .slice(0, 4)
        .map((loop) => ({
            loopId: loop.id,
            text: loop.text,
            action: loop.action,
            urgency: loop.urgency,
        }));
    const hasHigh = candidates.some((item) => item.urgency === 'high');
    const pressure = hasHigh || sceneClock.mustTransitionSoon
        ? 'high'
        : candidates.length >= 2 || routing.followsCanonAction
            ? 'medium'
            : 'low';
    return {
        pressure,
        required: pressure === 'high',
        candidates,
        policy: pressure === 'high'
            ? '本轮必须回收或显著推进至少一个 open loop，不能只写气氛。'
            : '至少种下一个可验证线索、关系变化或代价，为后续回收服务。',
    };
}

function characterDutyFrom(state = {}, names = []) {
    return names.slice(0, 5).map((name) => {
        const card = state?.characterCards?.[name] || {};
        const trust = Number(card.trust || 0);
        const suspicion = Number(card.suspicion || 0);
        const conflict = Number(card.conflict || 0);
        const desire = Number(card.desire || 0);
        const attitude = compactText(card.attitudeToPlayer || card.role || '', 80);
        let duty = '用自己的目标或信息差主动反应，不能只当旁白背景。';
        if (suspicion > trust + 4) {
            duty = '优先表现怀疑、试探、证据门槛或误判。';
        } else if (trust >= 15 || desire >= 15) {
            duty = '优先表现协作、靠近、保护或带有代价的主动帮助。';
        } else if (conflict >= 12) {
            duty = '优先制造冲突、交易条件或阵营压力。';
        }
        return {
            name,
            trust,
            suspicion,
            conflict,
            desire,
            attitude,
            duty,
        };
    });
}

function inferBeatType({
    routeMode,
    storyMode,
    sceneClock,
    payoff,
    memoryUse,
    routing,
    actionText,
    state,
}) {
    if (routeMode === 'local-command' || storyMode === 'setup') {
        return 'system';
    }
    if (storyMode === 'answer-book' || asArray(memoryUse?.deathLessons).length || state?.answerBook?.active) {
        return 'aftermath';
    }
    if (/撤离|躲避|逃|防御|伏击|袭击|死|杀|危险|警告/u.test(actionText) || asArray(state?.gameplay?.failurePressure).length) {
        return 'survival';
    }
    if (storyMode === 'adult-intimacy') {
        return 'adult-intimacy';
    }
    if (storyMode === 'daily') {
        return payoff.required ? 'reveal' : 'daily';
    }
    if (payoff.required) {
        return 'payoff';
    }
    if (sceneClock.mustTransitionSoon) {
        return 'transition';
    }
    if (routing.followsCanonAction || routeMode === 'canon-attractor') {
        return 'reveal';
    }
    if (/询问|调查|观察|核对|检查|追问|寻找|确认|看/u.test(actionText)) {
        return 'hook';
    }
    return 'conflict';
}

function pacingFor({ beatType, sceneClock, payoff, routeMode, storyMode }) {
    if (beatType === 'system') {
        return 'instant';
    }
    if (payoff.pressure === 'high' || beatType === 'survival') {
        return 'climax';
    }
    if (sceneClock.pressure === 'high' || beatType === 'transition') {
        return 'fast';
    }
    if (storyMode === 'daily' || beatType === 'adult-intimacy') {
        return 'slow-burn';
    }
    if (routeMode === 'canon-attractor' || payoff.pressure === 'medium') {
        return 'balanced-with-payoff';
    }
    return 'balanced';
}

function forbiddenFor(profile = {}, routeMode = '', storyMode = '') {
    return unique([
        ...asArray(profile.cannotShortcut),
        '不得把玩家候选行动写成路线按钮或结果传送，必须先写动作落地。',
        '不得无铺垫瞬移到无关地点；地点变化必须由玩家行动、交通、追逐、邀请、传言或明确时间跳转触发。',
        '不得复述已缓存 VN 队列片段；同一地点延续时不得重新写开门、抵达、走进或第一幕开场。',
        '不得让世界意志/旁白替 NPC 说台词；角色发声必须归属角色。',
        '不得整轮只写气氛、心理或流水账；至少产生一个可验证变化。',
        routeMode === 'if-attractor' ? 'IF 只能表现为连续压力、代价、误读或纠偏入口，不能硬切路线。' : '',
        storyMode === 'adult-intimacy' ? '亲密线只写成年角色、合意边界、关系代价和软性氛围，不覆盖主线危机。' : '',
    ], 8);
}

function promptDirectivesFor(plan) {
    const actionText = plan.playerAction || '当前行动';
    const outcomeText = plan.beat.requiredOutcomeTypes.join(' / ');
    const payoffText = plan.payoff.candidates.slice(0, 2).map((item) => item.text).join('；') || '当前目标或角色反应';
    return unique([
        `第一拍必须具体承接玩家行动：${actionText}`,
        '如果 VN 队列已有内容，本轮只追加队尾之后的新变化；禁止重播入场、开场寒暄或上一轮已揭示事实。',
        /询问|追问|问|确认/u.test(actionText)
            ? '玩家正在追问具体信息；本轮必须给新答案、明确拒绝理由或交换条件，不能继续复述同一个悬念。'
            : '',
        `本轮节拍=${plan.beat.type} / pacing=${plan.beat.pacing}；必须产生：${outcomeText}`,
        `至少让 1 名当前 NPC 从自身目标/恐惧/误判出发直接发声或行动；旁白只做镜头、环境和因果。`,
        plan.payoff.required
            ? `必须回收或显著推进伏笔：${payoffText}`
            : `种下或推进一个可验证伏笔：${payoffText}`,
        `保持 ${plan.scope.arcLabel} 的长期牵引：${plan.arcDuty.longRangeGoal}`,
        '输出 3-8 个可分页演出段，并在 RE0_VN_SCRIPT.segments 写 speaker/action/tone/expression/pose/camera/focus 供舞台和素材映射。',
        '候选行动必须从当前场景、在场人物、资源、信息差和死亡风险生成，不要给无关主线菜单。',
    ], 9);
}

function evaluatorRulesFor(plan) {
    return unique([
        'assistantText 必须显式承接玩家行动文本的核心动词或对象。',
        'VN_SCRIPT.backgroundKey 必须服从 AssetDirector 的场景计划，castIds 只能写本镜头实际在场/发声人物。',
        '每轮至少有 new_clue / relationship_shift / danger_shift / payoff / location_transition 之一。',
        '如果上一轮已缓存 VN segments，模型新回复只追加队尾；舞台不能因异步回复跳过用户未点击文本。',
        '同一背景/地点延续时，assistantText 不得重新描写开门、抵达、走进或首次进入场景，除非玩家行动明确要求返回或重新进入。',
        '当 playerAction 是追问具体信息时，assistantText 必须包含新答案、拒绝理由或新交换条件，不能只复述上一轮选择压力。',
        plan.payoff.required ? '本轮若没有推进 open loop，应判定为 repair。' : '',
        plan.sceneClock.mustTransitionSoon ? '本轮不得继续原地空转，应进入线索回收、冲突升级或自然转场。' : '',
    ], 8);
}

export function buildNarrativeDirectorPlan(state = {}, playerAction = {}, options = {}) {
    const storyRagWorkset = options.storyRagWorkset || {};
    const routing = options.routing || {};
    const memoryUse = options.memoryUse || {};
    const actionText = compactText(playerAction.rawText || playerAction.normalizedIntent || playerAction.text || state?.gameplay?.lastPlayerAction || '继续当前局势', 180);
    const arc = inferArc(state, storyRagWorkset);
    const profile = arcProfileFromRagReference(arc);
    const routeMode = routeModeFrom(routing, state, storyRagWorkset);
    const storyMode = storyModeFrom(state, actionText);
    const characters = activeCharacters(state, storyRagWorkset);
    const sceneClock = sceneClockFrom(state, playerAction, storyRagWorkset);
    const openLoops = openLoopsFrom(state, storyRagWorkset, memoryUse, arc, sceneClock);
    const payoff = payoffPlanFrom(openLoops, sceneClock, routing);
    const candidateSeeds = candidateSeedsFrom(storyRagWorkset, 6);
    const arcDuty = ragArcDutyFrom(profile, storyRagWorkset, routeMode, storyMode);
    const beatType = inferBeatType({
        routeMode,
        storyMode,
        sceneClock,
        payoff,
        memoryUse,
        routing,
        actionText,
        state,
    });
    const beat = {
        type: beatType,
        pacing: pacingFor({ beatType, sceneClock, payoff, routeMode, storyMode }),
        mustAdvance: beatType !== 'system' && (payoff.required || sceneClock.pressure !== 'normal' || storyMode === 'mainline' || routeMode !== 'local-command'),
        requiredOutcomeTypes: BEAT_OUTCOMES[beatType] || BEAT_OUTCOMES.conflict,
        firstBeat: routeMode === 'local-command'
            ? `本地执行命令：${actionText}`
            : `第一拍先让玩家行动落地，并写清它如何在当前镜头发生：${actionText}`,
        stopPoint: '停在自然选择点：取证、对话、撤离、试探、交易、等待、继续追问或进入下一处明确地点。',
        forbidden: forbiddenFor(profile, routeMode, storyMode),
    };
    const plan = {
        version: 're0-narrative-director/v1',
        planId: `narrative-${stableHash({
            arc,
            routeMode,
            storyMode,
            actionText,
            location: state?.current?.location,
            saveId: state?.flags?.worldSessionId || state?.worldline?.id,
        })}`,
        playerAction: actionText,
        scope: {
            arc,
            arcLabel: profile.label,
            routeMode,
            ifDominant: storyRagWorkset?.query?.ifRoute?.dominant || state?.ifRouteLogic?.dominant || 'EnvyMain',
            storyMode,
            location: compactText(state?.current?.location || storyRagWorkset?.query?.location || '', 80),
            activeCharacters: characters,
        },
        sceneClock,
        beat,
        openLoops,
        payoff,
        arcDuty,
        candidateSeeds,
        characterDuty: characterDutyFrom(state, characters),
        promptDirectives: [],
        evaluatorRules: [],
    };
    plan.promptDirectives = promptDirectivesFor(plan);
    plan.evaluatorRules = evaluatorRulesFor(plan);
    return plan;
}

export function summarizeNarrativeDirectorPlan(plan, limit = DEFAULT_SUMMARY_LIMIT) {
    if (!plan) {
        return '- NarrativeDirector 未生成。';
    }
    const output = [
        `- NarrativeDirector: ${plan.version || 'unknown'} / ${plan.planId || 'unknown'}`,
        `- 范围: Arc${plan.scope?.arc || 1} ${plan.scope?.arcLabel || ''} / route=${plan.scope?.routeMode || ''} / story=${plan.scope?.storyMode || ''} / ${compactText(plan.scope?.location || '', 50)}`,
        `- 节拍: ${plan.beat?.type || 'conflict'} / pacing=${plan.beat?.pacing || 'balanced'} / mustAdvance=${plan.beat?.mustAdvance === false ? 'no' : 'yes'} / outcomes=${asArray(plan.beat?.requiredOutcomeTypes).join(',') || 'new_clue'}`,
        `- 场景钟: progress=${plan.sceneClock?.sceneProgress ?? 0} / stale=${plan.sceneClock?.staleTurns ?? 0} / pressure=${plan.sceneClock?.pressure || 'normal'} / transitionSoon=${plan.sceneClock?.mustTransitionSoon ? 'yes' : 'no'}`,
        `- 长程职责: ${compactText(plan.arcDuty?.longRangeGoal || '', 150)} / 下一里程碑=${compactText(plan.arcDuty?.nextMilestone || '', 60)}`,
        `- RAG 行动种子: ${asArray(plan.candidateSeeds).slice(0, 3).map((item) => `${item.label}:${compactText(item.text, 46)}`).join(' / ') || '暂无'}`,
        `- 回收压力: ${plan.payoff?.pressure || 'low'} / required=${plan.payoff?.required ? 'yes' : 'no'} / ${asArray(plan.payoff?.candidates).slice(0, 2).map((item) => compactText(item.text, 70)).join(' / ') || '暂无'}`,
        `- 角色职责: ${asArray(plan.characterDuty).slice(0, 3).map((item) => `${item.name}:${compactText(item.duty, 42)}`).join(' / ') || '无在场角色'}`,
        `- 导演指令: ${asArray(plan.promptDirectives).slice(0, 4).map((item) => compactText(item, 90)).join('；')}`,
        `- 禁止: ${asArray(plan.beat?.forbidden).slice(0, 3).map((item) => compactText(item, 70)).join('；')}`,
    ].join('\n');
    if (output.length <= limit) {
        return output;
    }
    return `${output.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}
