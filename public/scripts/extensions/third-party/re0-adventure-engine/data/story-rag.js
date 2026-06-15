import {
    storyRagChunks,
    storyRagConstraints,
    storyRagFacts,
    storyRagIndexMetadata,
    storyRagPromises,
} from './re0-story-rag.generated.js';
import {
    canonRouteReferenceByArc,
} from './re0-canon-rag.generated.js';

const MAX_WORKSET_FACTS = 8;
const MAX_WORKSET_RISKS = 4;
const MAX_WORKSET_HOOKS = 4;
const MAX_CANDIDATE_SEEDS = 8;
const DEFAULT_SUMMARY_LIMIT = 900;
const worldEssenceStrongTerms = ['400年前', '四百年前', '世界本质', '底层规则', '底层设定', '因果锚点', '魔女因子', '权能', '神龙', '贤者', '初代剑圣', '奥德拉格纳', '福音书', '影之庭园', '灵魂', '龙血'];
const worldEssenceSupportTerms = ['嫉妒魔女', '死亡回归', '封印', '圣域', '名字', '记忆', '王选'];
const worldEssenceIntentTerms = ['追问', '调查', '解释', '确认', '推理', '解析', '本质', '机制', '规则', '源头', '真相', '设定', '因果', '锚点'];
const canonActionTerms = ['原作行动', '原作选择', '原作线', '原作开局', '原作路线', '追随原作', '按原作', '回到原作', '主线吸引', '正史', '正典行动', '嫉妒线'];
const canonActionNegativeTerms = ['不是原作行动', '不走原作', '不要原作线', '拒绝原作线', '偏离原作线', '原创默认开局', '完全自由'];
const ifActionTerms = ['IF', '傲慢', '愤怒', '怠惰', '强欲', '暴食', '赎罪', 'Ayamatsu', 'Oboreru', 'Kasaneru', 'Aganau'];
const ifRouteIds = new Set(['Ayamatsu', 'Oboreru', 'Sloth', 'Kasaneru', 'Greed', 'Tsugihagu', 'Gluttony', 'Aganau', 'Pride', 'Wrath']);
const ifRouteAliases = {
    Ayamatsu: ['Ayamatsu', 'Pride'],
    Pride: ['Pride', 'Ayamatsu'],
    Oboreru: ['Oboreru', 'Wrath'],
    Wrath: ['Wrath', 'Oboreru'],
    Kasaneru: ['Kasaneru', 'Greed'],
    Greed: ['Greed', 'Kasaneru'],
    Tsugihagu: ['Tsugihagu', 'Gluttony'],
    Gluttony: ['Gluttony', 'Tsugihagu'],
    Sloth: ['Sloth'],
    Aganau: ['Aganau'],
};
const ifRouteMentionTerms = {
    Pride: ['Pride', 'Ayamatsu', '傲慢'],
    Wrath: ['Wrath', 'Oboreru', '愤怒'],
    Sloth: ['Sloth', '怠惰', 'Kararagi', '卡拉拉基'],
    Greed: ['Greed', 'Kasaneru', '强欲'],
    Gluttony: ['Gluttony', 'Tsugihagu', '暴食'],
    Aganau: ['Aganau', '赎罪'],
};

// Extra canon-spine constraints are causal guardrails, not scene templates.
// Base canon spine facts come from re0-canon-rag.generated.js; this object only
// keeps narrow repairs found by real playflow audits.
const canonSpineExtrasByArc = {
    1: {
        facts: [],
        constraints: [
            'canon-follow 下禁止把 Arc1 改写为多枚徽章、三天后/明天再来、重复交易、多名买家、贵族雇主长期收货、商会委托、收藏癖收购或与徽章失窃无关的黑市案。',
            'canon-follow 下禁止新增银月商会、内城区第三街、贵族代理人、特殊物品长期收购、魔力残留收藏等组织型设定；若需要信息推进，只能揭示艾尔莎的外貌、危险感、弯刀、血腥味、当夜取货压力。',
            'canon-follow 下前台知识边界严格生效：罗姆爷、菲鲁特或本人尚未现场说出/显影前，可见正文、角色台词和候选行动都禁止写“艾尔莎/猎肠者/黑发/弯刀/血腥味”；只能写“买家/那个女人/门外来者/不好惹的客人”。',
            'canon-follow 下可以改变进入赃物库的方式、谈判代价、谁先暴露信息和救援窗口，但必须保留菲鲁特、罗姆爷、艾尔莎、徽章交易和当夜危险压力。',
        ],
        hooks: [
            '确认菲鲁特与徽章的关系',
            '确认艾尔莎/买家的入场时间和危险距离',
            '用证据、声响、逃生路线或同伴配置争取迟到救援窗口',
        ],
    },
};

const runtimeMemoryPriority = {
    hot: 0,
    warm: 1,
    cold: 2,
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function compactText(value, limit = 120) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= limit) {
        return text;
    }
    const suffix = '...';
    return `${text.slice(0, Math.max(0, limit - suffix.length)).trimEnd()}${suffix}`;
}

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^\u4e00-\u9fa5a-z0-9]+/gi, '');
}

function unique(values, limit = 20) {
    return [...new Set((values || []).filter(Boolean).map(String))].slice(0, limit);
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function canonSpineForQuery(query = {}) {
    if (!query.canonAction) {
        return { facts: [], risks: [], hooks: [] };
    }
    const arc = Number(query.arc || 0);
    const reference = canonRouteReferenceByArc?.[String(arc)] || canonRouteReferenceByArc?.[arc];
    const extras = canonSpineExtrasByArc[arc] || {};
    if (!reference && !extras.facts?.length && !extras.constraints?.length && !extras.hooks?.length) {
        return { facts: [], risks: [], hooks: [] };
    }
    const referenceFacts = [
        reference?.canonSpine,
        reference?.summaryDigest,
    ].filter(Boolean);
    const factItems = [
        ...referenceFacts,
        ...asArray(extras.facts),
    ].map((text, index) => ({
        id: `canon-spine-arc${query.arc}-fact-${index + 1}`,
        arc: query.arc,
        canonLevel: 'official_summary',
        causalTier: 'arc-structure',
        routeId: 'EnvyMain',
        text: compactText(text, index === 0 ? 220 : 180),
        certainty: 0.96,
        sourceIds: [`arc${String(query.arc).padStart(2, '0')}-canon-rag-generated`],
        score: 999 - index,
        spine: true,
    }));
    const referenceRisk = reference?.policy
        ? `canon-follow 下必须遵守生成 canon RAG policy：${compactText(reference.policy, 180)}`
        : '';
    const risks = [
        referenceRisk,
        ...asArray(extras.constraints),
    ].filter(Boolean).map((description, index) => ({
        id: `canon-spine-arc${query.arc}-constraint-${index + 1}`,
        arc: query.arc,
        severity: index === 0 && referenceRisk ? 'warn' : 'block',
        ruleType: 'canon-spine',
        description,
        sourceIds: [`arc${String(query.arc).padStart(2, '0')}-canon-rag-generated`],
        reason: '原作行动吸引硬事实；允许改路径和代价，不允许改成另一个事件。',
        spine: true,
    }));
    const derivedHooks = String(reference?.canonSpine || '')
        .split(/[；;。]/u)
        .map((part) => part.trim())
        .filter((part) => /确认|处理|追查|组织|拒绝|救援|调查|恢复|回归|收束|保存|破解|建立|同盟|证据|代价/u.test(part));
    const hooks = [
        ...asArray(extras.hooks),
        ...derivedHooks,
    ].map((text, index) => ({
        id: `canon-spine-arc${query.arc}-hook-${index + 1}`,
        arc: query.arc,
        text: compactText(text, 140),
        status: 'open',
        payoffWindow: 'current-arc',
        sourceIds: [`arc${String(query.arc).padStart(2, '0')}-canon-rag-generated`],
        score: 999 - index,
        spine: true,
    }));
    return { facts: factItems, risks, hooks };
}

function isWorldEssenceQuery(intentText = '') {
    const text = String(intentText || '');
    if (textContainsAny(text, worldEssenceStrongTerms)) {
        return true;
    }
    return textContainsAny(text, worldEssenceSupportTerms) && textContainsAny(text, worldEssenceIntentTerms);
}

function isCanonActionIntent(intentText = '') {
    const text = String(intentText || '');
    return textContainsAny(text, canonActionTerms) && !textContainsAny(text, canonActionNegativeTerms);
}

function isIfDominantRoute(value = '') {
    return ifRouteIds.has(String(value || '').trim());
}

function activeCharacterNames(state = {}, limit = 16) {
    const visualCast = state?.visuals?.visualNovel?.sceneCharacters || state?.visuals?.visualNovel?.castIds || [];
    const presence = state?.presence || {};
    const explicit = [
        ...(Array.isArray(state?.current?.castIds) ? state.current.castIds : []),
        ...(Array.isArray(visualCast) ? visualCast : []),
        ...(Array.isArray(presence.sceneCharacters) ? presence.sceneCharacters : []),
        ...(Array.isArray(presence.areaCharacters) ? presence.areaCharacters.slice(0, 6) : []),
    ];
    const cardNames = Object.keys(state?.characterCards || {});
    return unique([
        ...explicit,
        ...cardNames.slice(0, Math.max(0, limit - explicit.length)),
    ], limit);
}

function runtimeCardScore(name, card = {}, activeNames = []) {
    const activeBoost = activeNames.includes(name) ? 80 : 0;
    const numeric = ['trust', 'suspicion', 'trauma', 'affection', 'desire', 'conflict']
        .reduce((sum, key) => sum + Math.abs(Number(card?.[key] || 0)), 0);
    const memoryBoost = Array.isArray(card?.memory) && card.memory.length ? 20 : 0;
    const logBoost = Array.isArray(card?.arcLog) && card.arcLog.length ? 12 : 0;
    return activeBoost + Math.min(50, numeric) + memoryBoost + logBoost;
}

function runtimeMemoryEntry({ id, layer, band = 'warm', text = '', source = 'state', tags = [] }) {
    const safeBand = ['hot', 'warm', 'cold'].includes(band) ? band : 'warm';
    return {
        id,
        layer,
        band: safeBand,
        source,
        text: compactText(text, safeBand === 'hot' ? 180 : 140),
        tags: unique(tags, 10),
    };
}

function buildRuntimeMemorySignals(state = {}, actionText = '') {
    const activeNames = activeCharacterNames(state, 18);
    const sessionId = state?.flags?.worldSessionId || state?.worldline?.id || 'unknown-save';
    const entries = [];
    const add = (entry) => {
        if (entry?.text) {
            entries.push(runtimeMemoryEntry(entry));
        }
    };
    add({
        id: 'save:identity',
        layer: 'save',
        band: 'hot',
        source: 'CURRENT_STATE.md',
        text: [
            `session=${sessionId}`,
            state?.protagonistProfile?.name || state?.setup?.protagonistName,
            state?.protagonistProfile?.origin || state?.setup?.origin,
            state?.protagonistProfile?.ability || state?.setup?.ability,
            state?.setup?.birthplace,
            state?.setup?.initialScenario,
        ].filter(Boolean).join('；'),
        tags: [sessionId, '主角', '建档'],
    });
    add({
        id: 'save:current-action',
        layer: 'save',
        band: 'hot',
        source: 'PLOT_THREADS.md',
        text: [
            actionText || state?.gameplay?.lastPlayerAction,
            state?.gameplay?.lastOutcome,
            state?.gameplay?.activeObjective,
            state?.gameplay?.objectiveStage,
        ].filter(Boolean).join('；'),
        tags: ['行动', '目标'],
    });
    if (Array.isArray(state?.discoveredClues) && state.discoveredClues.length) {
        add({
            id: 'save:clues',
            layer: 'save',
            band: 'warm',
            source: 'PLOT_THREADS.md',
            text: state.discoveredClues.slice(-6).join('；'),
            tags: ['线索'],
        });
    }
    const deathRisk = state?.gameplay?.deathRisk || {};
    const latestDeath = Array.isArray(state?.deathBranches) ? state.deathBranches.slice(-1)[0] : null;
    add({
        id: 'death:lesson',
        layer: 'death',
        band: latestDeath || deathRisk.lastWarning || deathRisk.lastStrategyPivot ? 'hot' : 'cold',
        source: 'WORLDLINE_LEDGER.md',
        text: [
            deathRisk.lastWarning,
            deathRisk.lastStrategyPivot,
            latestDeath?.cause,
            latestDeath?.wrongAssumption || latestDeath?.answerBookLesson?.wrongAssumption,
            latestDeath?.strategyPivot || latestDeath?.answerBookLesson?.strategyPivot,
            ...(Array.isArray(latestDeath?.retainedResidue) ? latestDeath.retainedResidue.slice(0, 3) : []),
            ...(Array.isArray(latestDeath?.answerBookLesson?.retainedClues) ? latestDeath.answerBookLesson.retainedClues.slice(0, 3) : []),
        ].filter(Boolean).join('；'),
        tags: ['死亡回归', '答案之书', '失败教训'],
    });
    const cards = Object.entries(state?.characterCards || {})
        .map(([name, card]) => ({ name, card: card || {}, score: runtimeCardScore(name, card || {}, activeNames) }))
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-Hans-CN'))
        .slice(0, 8);
    for (const { name, card, score } of cards) {
        add({
            id: `npc:${name}`,
            layer: 'character',
            band: score >= 80 ? 'hot' : 'warm',
            source: 'CHARACTER_LEDGER.md',
            text: [
                `${name}: ${card.role || '角色'}`,
                `态度=${card.attitudeToPlayer || '未定'}`,
                `信/疑/创/好/情/冲=${card.trust ?? 0}/${card.suspicion ?? 0}/${card.trauma ?? 0}/${card.affection ?? 0}/${card.desire ?? 0}/${card.conflict ?? 0}`,
                (card.memory || []).slice(-2).join('；'),
                (card.arcLog || []).slice(-1).join('；'),
                card.routeStrategy || card.routeHint || '',
            ].filter(Boolean).join('；'),
            tags: [name, card.faction, card.location, '角色卡'],
        });
    }
    const sorted = entries
        .filter((entry) => entry.text)
        .sort((a, b) => runtimeMemoryPriority[a.band] - runtimeMemoryPriority[b.band] || a.id.localeCompare(b.id));
    return {
        version: 'runtime-memory-signals/v1',
        sessionId,
        entries: sorted.slice(0, 18),
        queryText: sorted.slice(0, 12).map((entry) => entry.text).join(' '),
    };
}

function inferArcFromState(state = {}) {
    const direct = Number(state?.current?.arc || state?.arc);
    if (Number.isFinite(direct) && direct > 0) {
        return clamp(Math.round(direct), 1, 11);
    }
    const day = Number(state?.current?.day || state?.day || 1);
    if (Number.isFinite(day) && day > 0) {
        return clamp(Math.ceil(day / 100), 1, 11);
    }
    return 1;
}

export function buildStoryRagQuery(state = {}, actionText = '') {
    const current = state?.current || {};
    const gameplay = state?.gameplay || {};
    const setup = state?.setup || {};
    const profile = state?.protagonistProfile || {};
    const deathRisk = gameplay.deathRisk || {};
    const ifRouteLogic = state?.ifRouteLogic || {};
    const runtimeMemory = buildRuntimeMemorySignals(state, actionText);
    const queryParts = [
        current.location,
        current.time,
        setup.routePreset,
        setup.routePresetDetail,
        profile.routePreset,
        profile.routePresetDetail,
        state?.flags?.canonFollowActive ? 'canonFollowActive 原作线 追随原作' : '',
        state?.visuals?.visualNovel?.lastChoiceText,
        gameplay.activeObjective,
        gameplay.objectiveStage,
        gameplay.lastPlayerAction,
        gameplay.lastOutcome,
        deathRisk.lastWarning,
        deathRisk.lastStrategyPivot,
        ifRouteLogic.dominant,
        ifRouteLogic.lastShift,
        actionText,
        runtimeMemory.queryText,
        ...(Array.isArray(gameplay.openQuestions) ? gameplay.openQuestions.slice(-4) : []),
        ...(Array.isArray(gameplay.actionHints) ? gameplay.actionHints.slice(-4) : []),
        ...(Array.isArray(state?.discoveredClues) ? state.discoveredClues.slice(-6) : []),
    ];
    const joinedText = queryParts.filter(Boolean).join(' ');
    const actionIntentText = [
        actionText,
        state?.visuals?.visualNovel?.lastChoiceText,
        gameplay.lastPlayerAction,
        gameplay.activeObjective,
        gameplay.objectiveStage,
    ].filter(Boolean).join(' ');
    const routeIntentText = [
        state?.flags?.canonFollowActive ? '原作线' : '',
        setup.routePreset,
        setup.routePresetDetail,
        profile.routePreset,
        profile.routePresetDetail,
    ].filter(Boolean).join(' ');
    const worldEssenceIntentText = [
        actionText,
        setup.routePreset,
        profile.routePreset,
        gameplay.lastPlayerAction,
        gameplay.activeObjective,
        gameplay.objectiveStage,
        runtimeMemory.queryText,
    ].filter(Boolean).join(' ');
    return {
        arc: inferArcFromState(state),
        location: String(current.location || ''),
        time: String(current.time || ''),
        characters: activeCharacterNames(state, 16),
        worldline: {
            id: state?.flags?.worldSessionId || state?.worldline?.id || '',
            divergence: Number(state?.worldline?.divergence || 0),
            attractor: state?.worldline?.attractor || '',
        },
        ifRoute: {
            dominant: ifRouteLogic.dominant || 'EnvyMain',
            routePressures: ifRouteLogic.routePressures || {},
            lastShift: ifRouteLogic.lastShift || '',
        },
        actionText: String(actionText || gameplay.lastPlayerAction || ''),
        text: joinedText,
        actionIntentText,
        routeIntentText,
        canonAction: isCanonActionIntent(actionIntentText)
            || Boolean(state?.flags?.canonFollowActive)
            || isCanonActionIntent(routeIntentText),
        ifAction: textContainsAny(actionIntentText, ifActionTerms),
        worldEssenceQuery: isWorldEssenceQuery(worldEssenceIntentText),
        runtimeMemory,
    };
}

function scoreKeywords(keywords = [], queryText = '') {
    const normalized = normalizeText(queryText);
    return unique(keywords, 40).reduce((score, keyword) => {
        const needle = normalizeText(keyword);
        if (!needle) {
            return score;
        }
        return normalized.includes(needle) ? score + (needle.length >= 4 ? 4 : 2) : score;
    }, 0);
}

function scoreArc(targetArc, queryArc) {
    if (targetArc === queryArc) {
        return 30;
    }
    if (Math.abs(Number(targetArc) - Number(queryArc)) === 1) {
        return 6;
    }
    return 0;
}

function routeAliasSet(routeId = '') {
    const route = String(routeId || '').trim();
    if (!route) {
        return new Set();
    }
    return new Set(ifRouteAliases[route] || [route]);
}

function routeMatches(itemRouteId = '', targetRouteId = '') {
    const itemRoute = String(itemRouteId || '').trim();
    if (!itemRoute) {
        return false;
    }
    return routeAliasSet(targetRouteId).has(itemRoute);
}

function routeMentionedInText(routeId = '', queryText = '') {
    const route = String(routeId || '').trim();
    if (!route) {
        return false;
    }
    const text = normalizeText(queryText);
    const aliases = routeAliasSet(route);
    return [...aliases].some((alias) => {
        const terms = ifRouteMentionTerms[alias] || [alias];
        return terms.some((term) => text.includes(normalizeText(term)));
    });
}

function scoreIfRoute(item, query) {
    const itemRoute = String(item.routeId || '').trim();
    if (!itemRoute || !ifRouteIds.has(itemRoute)) {
        return 0;
    }
    const dominant = String(query.ifRoute?.dominant || 'EnvyMain').trim();
    const dominantIsIf = isIfDominantRoute(dominant);
    const queryText = `${query.text} ${query.actionText}`;
    if (dominantIsIf && routeMatches(itemRoute, dominant)) {
        return 42;
    }
    if (routeMentionedInText(itemRoute, queryText)) {
        return 26;
    }
    if (dominantIsIf) {
        return -22;
    }
    return query.ifAction ? 4 : 0;
}

function scoreItem(item, query) {
    const keywordScore = scoreKeywords([
        ...(item.keywords || []),
        ...(item.characters || []),
        ...(item.locations || []),
        ...(item.events || []),
        item.subject,
        item.object,
        item.description,
        item.promise,
        item.digest,
    ], `${query.text} ${query.location} ${query.actionText} ${query.characters.join(' ')}`);
    const severityBoost = item.severity === 'hard' ? 8 : item.severity === 'warn' ? 3 : 0;
    const canonBoost = item.canonLevel === 'official' ? 5
        : item.canonLevel === 'official_summary' ? 4
            : item.canonLevel === 'official_if' ? 5
                : item.canonLevel === 'official_side_story' ? 3
                    : item.canonLevel === 'official_reference' ? (query.worldEssenceQuery ? 5 : 1)
                        : 2;
    const sourceBoost = item.sourceType === 'story_database' ? 6
        : item.sourceType === 'web_novel_chapter' ? 4
            : item.sourceType === 'official_if' ? 5
                : item.sourceType === 'reference_misc' ? (query.worldEssenceQuery ? 5 : -8)
                    : 2;
    const causalTierBoost = item.causalTier === 'world-essence' ? (query.worldEssenceQuery ? 22 : 6)
        : item.causalTier === 'if-attractor' ? (query.ifAction ? 14 : 4)
            : item.causalTier === 'arc-structure' ? 8
                : 2;
    const canonActionBoost = query.canonAction
        && /^official/.test(String(item.canonLevel || ''))
        && Number(item.arc || 0) === Number(query.arc || 0)
        ? 18
        : 0;
    const routeBoost = scoreIfRoute(item, query);
    const scoreHintBoost = Math.min(10, Math.max(0, Number(item.scoreHint || 0) / 4));
    const manualCausalBoost = item.predicate === 'requires'
        || item.predicate === 'summarizes_arc_causality'
        || item.causalTier === 'arc-structure'
        ? 18
        : 0;
    return scoreArc(Number(item.arc || 1), query.arc)
        + keywordScore
        + severityBoost
        + canonBoost
        + sourceBoost
        + causalTierBoost
        + canonActionBoost
        + routeBoost
        + scoreHintBoost
        + manualCausalBoost;
}

function buildDirectorSignals(query, workset) {
    const divergence = Number(query.worldline.divergence || 0);
    const ifDominant = isIfDominantRoute(query.ifRoute.dominant);
    const hardRiskCount = workset.risks.filter((risk) => risk.severity === 'block').length;
    const intent = classifyStoryRagIntent(query);
    const mode = intent.directorMode;
    const attractorStrength = query.canonAction
        ? Math.max(0.72, 1 - Math.min(0.6, divergence))
        : ifDominant || query.ifAction
            ? Math.max(0.48, Math.min(0.86, 0.42 + divergence + hardRiskCount * 0.06))
            : Math.max(0.35, Math.min(0.78, 0.52 + hardRiskCount * 0.04 - divergence * 0.2));
    return {
        mode,
        actionMode: intent.actionMode,
        actionModeLabel: intent.actionModeLabel,
        attractorStrength: Number(attractorStrength.toFixed(2)),
        worldSimulation: divergence >= 0.35 || ifDominant || hardRiskCount >= 2 ? 'high' : 'normal',
        reusePolicy: query.canonAction
            ? '优先复用原作因果链和关键节点，但用当前存档差异改写路径、代价、参与者和顺序。'
            : '优先按角色动机、信息差、地点和后台时钟推演；原作作为强牵引参考，不作为剧本锁。',
        ambiguityPolicy: '原作没有定死或可多重解读的内容保持开放，允许存档内长期演化成不同解释。',
        generationPolicy: intent.generationPolicy,
        decisionProtocol: intent.decisionProtocol,
    };
}

function classifyStoryRagIntent(query) {
    const ifDominant = isIfDominantRoute(query.ifRoute.dominant);
    if (query.canonAction) {
        return {
            actionMode: 'canon-follow',
            actionModeLabel: '原作行动吸引',
            directorMode: 'fate-attractor',
            generationPolicy: '把玩家行动解释为主动靠近原作因果链：优先检索同 Arc 官方事实、约束和伏笔；正文必须先承接当前存档差异，再让事件向原作关键因果回落。',
            decisionProtocol: [
                '识别玩家选择的原作行动意图和当前 Arc。',
                '取官方因果事实、硬约束、伏笔作为最高权重参考。',
                '保留当前存档的角色记忆、线索和死亡教训。',
                '输出时复用原作因果功能，不机械复刻原文台词或场面顺序。',
            ],
        };
    }
    if (ifDominant || query.ifAction) {
        return {
            actionMode: 'if-attractor',
            actionModeLabel: 'IF 分歧吸引',
            directorMode: 'if-attractor-director',
            generationPolicy: '把玩家行动解释为靠近某条 IF 逻辑：提升对应路线压力，但仍按连续选择、代价、信息差和纠偏入口推演，不允许一次点击硬切路线。',
            decisionProtocol: [
                '识别 IF 关键词或当前 dominant route。',
                '检索官方 IF/分歧因果和当前 Arc 约束。',
                '把路线压力表现为 NPC 反应、后台传言、死亡风险或目标偏移。',
                '保留回到嫉妒/主线吸引域的可推理入口。',
            ],
        };
    }
    if (query.worldEssenceQuery) {
        return {
            actionMode: 'world-essence-simulation',
            actionModeLabel: '世界本质推演',
            directorMode: 'causal-simulator-director',
            generationPolicy: '把玩家行动解释为追问世界底层规则：优先使用 400 年前、魔女因子、权能、神龙、贤者、灵魂/记忆等高阶设定作为推理约束。',
            decisionProtocol: [
                '识别被追问的世界底层概念。',
                '检索世界本质和当前 Arc 的公开可感知证据。',
                '区分玩家可知道、NPC 可知道、系统后台知道的事实。',
                '用可观察现象推进，不把未公开设定直接灌给角色。',
            ],
        };
    }
    return {
        actionMode: 'free-simulation',
        actionModeLabel: '自由行动推演',
        directorMode: 'causal-simulator-director',
        generationPolicy: '把玩家行动解释为开放世界选择：不强制跟随原作下一幕；以原作世界规则、角色动机、地点、信息差、后台时钟和当前存档记忆推演后果。',
        decisionProtocol: [
            '先承接玩家刚做出的自由行动。',
            '从当前存档热记忆、角色心智、死亡教训抽取直接因果。',
            '用官方原作事实和约束过滤不可能或代价缺失的结果。',
            '生成可验证后果、代价和新的自然选择点，而不是跳到原作固定节点。',
        ],
    };
}

function seedSourceIds(item = {}) {
    return unique([
        ...(Array.isArray(item.sourceIds) ? item.sourceIds : []),
        item.chunkId,
        item.id,
    ], 4);
}

function seedArc(item = {}, query = {}) {
    const direct = Number(item.arc || query.arc || 1);
    return Number.isFinite(direct) ? direct : 1;
}

function buildCandidateActionSeeds(query, workset = {}) {
    const mode = workset.directorSignals?.actionMode || 'free-simulation';
    const location = compactText(query.location || '当前地点', 28);
    const actionText = compactText(query.actionText || '当前行动', 42);
    const seeds = [];
    const seen = new Set();
    const add = ({
        type,
        label,
        text,
        sourceIds = [],
        source = 'story-rag',
        priority = 50,
        grounding = 'current-scene',
        arc = query.arc,
    }) => {
        const safeText = compactText(text, 150);
        if (!safeText) {
            return;
        }
        const key = normalizeText(`${label || ''}${safeText}`);
        if (!key || seen.has(key)) {
            return;
        }
        seen.add(key);
        seeds.push({
            id: `seed:${type || 'action'}:${seeds.length + 1}`,
            type: type || 'action',
            label: compactText(label || 'RAG 行动种子', 28),
            text: safeText,
            source,
            sourceIds: unique(sourceIds, 4),
            priority: Number(priority) || 50,
            mode,
            arc: seedArc({ arc }, query),
            grounding,
            groundingTerms: unique([location, ...asArray(query.characters).slice(0, 4)], 6),
        });
    };

    if (mode === 'canon-follow') {
        asArray(workset.hooks).slice(0, 2).forEach((hook, index) => add({
            type: 'canon-attractor',
            label: '原作因果',
            text: `沿同 Arc 原作牵引推进：${hook.text}`,
            sourceIds: seedSourceIds(hook),
            priority: 96 - index * 3,
            grounding: 'same-arc-canon-hook',
            arc: hook.arc,
        }));
        asArray(workset.facts).slice(0, 2).forEach((fact, index) => add({
            type: 'canon-fact-check',
            label: '原作核验',
            text: `把当前行动接回可验证原作事实：${fact.text}`,
            sourceIds: seedSourceIds(fact),
            priority: 90 - index * 3,
            grounding: 'official-causal-fact',
            arc: fact.arc,
        }));
        asArray(workset.risks).slice(0, 1).forEach((risk) => add({
            type: 'continuity-risk',
            label: '连续性风险',
            text: `先规避原作硬约束风险：${risk.description}`,
            sourceIds: seedSourceIds(risk),
            priority: 84,
            grounding: 'continuity-constraint',
            arc: risk.arc,
        }));
    } else if (mode === 'if-attractor') {
        asArray(workset.facts).slice(0, 2).forEach((fact, index) => add({
            type: 'if-attractor-pressure',
            label: 'IF 压力',
            text: `把 IF 逻辑表现为连续压力而非路线硬切：${fact.text}`,
            sourceIds: seedSourceIds(fact),
            priority: 94 - index * 4,
            grounding: 'if-causal-reference',
            arc: fact.arc,
        }));
        asArray(workset.risks).slice(0, 2).forEach((risk, index) => add({
            type: 'if-correction',
            label: 'IF 纠偏',
            text: `说明分歧代价并保留纠偏入口：${risk.description}`,
            sourceIds: seedSourceIds(risk),
            priority: 88 - index * 3,
            grounding: 'if-risk-boundary',
            arc: risk.arc,
        }));
    } else {
        if (mode === 'world-essence-simulation') {
            add({
                type: 'world-essence-question',
                label: '世界本质',
                text: `把玩家追问的底层概念拆成可观察证据和角色可知信息：${actionText}`,
                sourceIds: ['runtime-world-essence-query'],
                source: 'runtime-current-action',
                priority: 98,
                grounding: 'world-essence-query',
                arc: query.arc,
            });
        }
        asArray(workset.runtimeMemory?.saveFacts).slice(0, 2).forEach((entry, index) => add({
            type: 'save-memory',
            label: '存档记忆',
            text: `先结算本存档已经发生的事实：${entry.text}`,
            sourceIds: [entry.id],
            source: entry.source || 'runtime-save-memory',
            priority: 96 - index * 3,
            grounding: 'current-save',
            arc: query.arc,
        }));
        asArray(workset.runtimeMemory?.characterMemories).slice(0, 2).forEach((entry, index) => add({
            type: 'character-memory',
            label: '角色心智',
            text: `让当前角色按自己的记忆和关系反应：${entry.text}`,
            sourceIds: [entry.id],
            source: entry.source || 'runtime-character-memory',
            priority: 92 - index * 3,
            grounding: 'current-character-state',
            arc: query.arc,
        }));
        asArray(workset.runtimeMemory?.deathMemories)
            .filter((entry) => entry.band !== 'cold')
            .slice(0, 1)
            .forEach((entry) => add({
                type: 'death-return-private',
                label: '死亡私有记忆',
                text: `把失败教训转成谨慎行动，不能公开死亡回归：${entry.text}`,
                sourceIds: [entry.id],
                source: entry.source || 'runtime-death-memory',
                priority: 90,
                grounding: 'player-private-memory',
                arc: query.arc,
            }));
        asArray(workset.risks).slice(0, 2).forEach((risk, index) => add({
            type: 'world-rule-risk',
            label: '世界规则',
            text: `用原作世界规则过滤不可能或无代价结果：${risk.description}`,
            sourceIds: seedSourceIds(risk),
            priority: 84 - index * 3,
            grounding: 'continuity-constraint',
            arc: risk.arc,
        }));
        asArray(workset.facts).slice(0, 2).forEach((fact, index) => add({
            type: mode === 'world-essence-simulation' ? 'world-essence-fact' : 'causal-fact',
            label: mode === 'world-essence-simulation' ? '世界本质' : '因果事实',
            text: `参考原作因果摘要推演后果：${fact.text}`,
            sourceIds: seedSourceIds(fact),
            priority: 78 - index * 3,
            grounding: 'official-causal-fact',
            arc: fact.arc,
        }));
        asArray(workset.hooks).slice(0, 1).forEach((hook) => add({
            type: 'promise-hook',
            label: '伏笔显影',
            text: `推进一个能被当前场景验证的伏笔：${hook.text}`,
            sourceIds: seedSourceIds(hook),
            priority: 74,
            grounding: 'promise-or-payoff',
            arc: hook.arc,
        }));
    }

    add({
        type: 'current-action-grounding',
        label: '当前行动落地',
        text: `第一拍先让“${actionText}”在${location}产生可观察反应，再给后果和下一选择点。`,
        sourceIds: ['runtime-current-action'],
        source: 'runtime-current-state',
        priority: 100,
        grounding: 'current-scene',
        arc: query.arc,
    });

    return seeds
        .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
        .slice(0, MAX_CANDIDATE_SEEDS);
}

function buildStoryRagLayers(workset) {
    const runtime = workset.runtimeMemory || {};
    const director = workset.directorSignals || {};
    const officialFacts = workset.facts.filter((fact) => /^official/.test(String(fact.canonLevel || '')) || fact.causalTier === 'world-essence');
    return {
        version: 'story-rag-layered-workset/v2',
        officialCausalMemory: {
            authority: 'global-causal-groundtruth',
            scope: 'all-saves',
            purpose: '提供原作因果链、世界规则、IF 参考和硬约束；它牵引世界，但不是逐字剧本。',
            facts: (officialFacts.length ? officialFacts : workset.facts).slice(0, 6),
            risks: workset.risks.slice(0, 4),
            hooks: workset.hooks.slice(0, 4),
            sourceChunks: workset.chunks.slice(0, 3),
        },
        saveScopedMemory: {
            authority: 'current-save-groundtruth',
            scope: runtime.sessionId || workset.memoryPolicy?.saveMemorySessionId || 'unknown-save',
            purpose: '记录本存档主角底盘、当前目标、已发现线索和行动后果；不能跨存档泄漏。',
            facts: (runtime.saveFacts || []).slice(0, 6),
        },
        characterMindMemory: {
            authority: 'per-save-npc-state',
            scope: runtime.sessionId || workset.memoryPolicy?.saveMemorySessionId || 'unknown-save',
            purpose: '把角色信任、怀疑、创伤、好感、冲突和已知记忆转成剧情反应约束。',
            memories: (runtime.characterMemories || []).slice(0, 6),
        },
        deathReturnMemory: {
            authority: 'player-retained-private-memory',
            scope: runtime.sessionId || workset.memoryPolicy?.saveMemorySessionId || 'unknown-save',
            purpose: '只作为玩家私有的失败教训和残响；不得自动变成公开谈判事实。',
            lessons: (runtime.deathMemories || []).filter((entry) => entry.band !== 'cold').slice(0, 4),
        },
        directorDecision: {
            mode: director.mode || 'causal-simulator-director',
            actionMode: director.actionMode || 'free-simulation',
            actionModeLabel: director.actionModeLabel || '自由行动推演',
            attractorStrength: director.attractorStrength ?? 0,
            worldSimulation: director.worldSimulation || 'normal',
            generationPolicy: director.generationPolicy || director.reusePolicy || '',
            decisionProtocol: director.decisionProtocol || [],
            candidateActionSeeds: asArray(workset.candidateSeeds).slice(0, MAX_CANDIDATE_SEEDS),
            outputContract: [
                '正文第一拍必须承接玩家行动。',
                '随后写 NPC、环境、规则或后台时钟的反应。',
                '再给可验证后果、代价或新线索。',
                '最后停在自然选择点，候选行动必须来自当前剧情现状。',
                '每条候选行动至少绑定两个现场锚点：当前地点/在场人物/关键物件/线索/风险/目标，不给泛泛菜单项。',
            ],
        },
    };
}

function buildStoryRagArchitecture(workset) {
    const actionMode = workset.directorSignals?.actionMode || 'free-simulation';
    return {
        version: 'story-rag-architecture/v2',
        layerOrder: ['officialCausalMemory', 'saveScopedMemory', 'characterMindMemory', 'deathReturnMemory', 'directorDecision'],
        routing: {
            actionMode,
            followsCanonAction: actionMode === 'canon-follow',
            simulatesFreeAction: actionMode === 'free-simulation' || actionMode === 'world-essence-simulation',
            usesIfAttractor: actionMode === 'if-attractor',
            sessionId: workset.runtimeMemory?.sessionId || workset.memoryPolicy?.saveMemorySessionId || 'unknown-save',
        },
        qualityGates: [
            '原作行动必须高权重命中同 Arc 官方因果、风险或伏笔。',
            '自由行动必须先使用当前存档和角色记忆，再用原作世界规则过滤。',
            '死亡回归信息只能作为玩家私有记忆影响行动，不得默认公开。',
            '输出不得注入长篇原文，只能注入短摘要、source id 和因果要点。',
        ],
    };
}

function topByScore(items, query, limit) {
    return items
        .map((item) => ({ item, score: scoreItem(item, query) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || String(a.item.id).localeCompare(String(b.item.id)))
        .slice(0, limit)
        .map(({ item, score }) => ({ ...item, score }));
}

function continuityRiskForConstraint(constraint, query) {
    const hard = constraint.severity === 'hard';
    const highDivergence = Number(query.worldline.divergence || 0) >= 0.35;
    const ifDominant = query.ifRoute.dominant && query.ifRoute.dominant !== 'EnvyMain';
    return {
        id: constraint.id,
        arc: constraint.arc,
        severity: hard || highDivergence ? 'block' : 'warn',
        ruleType: constraint.ruleType,
        description: constraint.description,
        sourceIds: [constraint.chunkId].filter(Boolean),
        reason: hard
            ? '硬约束命中；生成前必须保留或合理改路径。'
            : ifDominant
                ? 'IF 偏移存在；需要说明偏移代价和纠偏入口。'
                : '连续性风险；需要在本轮显影证据或代价。',
    };
}

export function retrieveStoryRagWorkset(state = {}, actionText = '', options = {}) {
    const query = buildStoryRagQuery(state, actionText);
    const canonSpine = canonSpineForQuery(query);
    const facts = [
        ...canonSpine.facts,
        ...topByScore(storyRagFacts, query, Math.max(0, (options.factLimit || MAX_WORKSET_FACTS) - canonSpine.facts.length))
            .map((fact) => ({
                id: fact.id,
                arc: fact.arc,
                canonLevel: fact.canonLevel,
                causalTier: fact.causalTier,
                routeId: fact.routeId,
                text: fact.object,
                certainty: fact.certainty,
                sourceIds: [fact.chunkId],
                score: fact.score,
            })),
    ].slice(0, options.factLimit || MAX_WORKSET_FACTS);
    const risks = [
        ...canonSpine.risks,
        ...topByScore(storyRagConstraints, query, Math.max(0, (options.riskLimit || MAX_WORKSET_RISKS) - canonSpine.risks.length))
            .map((constraint) => continuityRiskForConstraint(constraint, query)),
    ].slice(0, options.riskLimit || MAX_WORKSET_RISKS);
    const hooks = [
        ...canonSpine.hooks,
        ...topByScore(storyRagPromises, query, Math.max(0, (options.hookLimit || MAX_WORKSET_HOOKS) - canonSpine.hooks.length))
            .map((promise) => ({
                id: promise.id,
                arc: promise.arc,
                text: promise.promise,
                status: promise.status,
                payoffWindow: promise.payoffWindow,
                sourceIds: [promise.chunkId],
                score: promise.score,
            })),
    ].slice(0, options.hookLimit || MAX_WORKSET_HOOKS);
    const chunks = topByScore(storyRagChunks, query, options.chunkLimit || 3)
        .map((chunk) => ({
            id: chunk.id,
            arc: chunk.arc,
            canonLevel: chunk.canonLevel,
            sourceType: chunk.sourceType,
            causalTier: chunk.causalTier,
            routeId: chunk.routeId,
            digest: chunk.digest,
            sourceIds: chunk.sourceIds || [chunk.sourcePath],
            score: chunk.score,
        }));
    const workset = {
        version: 'story-rag-workset/v1',
        generatedAt: new Date().toISOString(),
        metadata: {
            indexGeneratedAt: storyRagIndexMetadata.generatedAt,
            sourceStats: storyRagIndexMetadata.sourceStats || {},
            chunks: storyRagIndexMetadata.chunks,
            facts: storyRagIndexMetadata.facts,
            constraints: storyRagIndexMetadata.constraints,
            promises: storyRagIndexMetadata.promises,
        },
        query,
        facts,
        risks,
        hooks,
        chunks,
        memoryPolicy: {
            officialNovelMemory: 'global-authoritative-causal-groundtruth',
            saveMemory: 'per-save-isolated-runtime-state',
            saveMemorySessionId: query.worldline.id || 'unknown-save',
            priority: ['official novel causal memory', 'current save memory', 'player retained death memory', 'NPC per-save memory', 'debug/development notes'],
        },
        runtimeMemory: {
            sessionId: query.runtimeMemory.sessionId,
            entries: query.runtimeMemory.entries,
            saveFacts: query.runtimeMemory.entries.filter((entry) => entry.layer === 'save'),
            characterMemories: query.runtimeMemory.entries.filter((entry) => entry.layer === 'character'),
            deathMemories: query.runtimeMemory.entries.filter((entry) => entry.layer === 'death'),
        },
    };
    workset.directorSignals = buildDirectorSignals(query, workset);
    workset.candidateSeeds = buildCandidateActionSeeds(query, workset);
    workset.layers = buildStoryRagLayers(workset);
    workset.architecture = buildStoryRagArchitecture(workset);
    return workset;
}

function textContainsAny(text, needles) {
    const normalized = normalizeText(text);
    return needles.some((needle) => {
        const value = normalizeText(needle);
        return value && normalized.includes(value);
    });
}

export function checkStoryRagConflicts(state = {}, candidate = {}, options = {}) {
    const candidateText = [
        candidate.text,
        candidate.summary,
        candidate.action,
        candidate.statePatch ? JSON.stringify(candidate.statePatch) : '',
    ].filter(Boolean).join(' ');
    const workset = options.workset || retrieveStoryRagWorkset(state, candidateText, { riskLimit: 8, factLimit: 6, hookLimit: 6 });
    const risks = [];
    const currentArc = workset.query.arc;
    const publicDeathReturn = /死亡回归|回到锚点|我死后|重置|轮回秘密/.test(candidateText);
    if (publicDeathReturn && currentArc >= 1) {
        risks.push({
            status: 'block',
            ruleType: 'death_return',
            description: '候选内容疑似把死亡回归秘密当作公开谈判信息。',
            sourceIds: ['story-rag-death-return-boundary'],
        });
    }
    const instantRouteSwitch = /切换到|进入.*IF|锁定.*IF|直接.*傲慢|直接.*怠惰|直接.*强欲/.test(candidateText);
    if (instantRouteSwitch) {
        risks.push({
            status: 'warn',
            ruleType: 'if_pressure',
            description: '候选内容疑似把 IF 吸引域写成路线开关；应改为连续压力、代价和纠偏入口。',
            sourceIds: ['story-rag-if-attractor-boundary'],
        });
    }
    const arc11OfficialLeak = currentArc === 11 && textContainsAny(candidateText, ['官方原文写道', '原作第十一章', '官方第十一篇章']);
    if (arc11OfficialLeak) {
        risks.push({
            status: 'block',
            ruleType: 'source_boundary',
            description: 'Arc 11 是项目原创延展，不能伪装成官方原文。',
            sourceIds: ['arc11-source-boundary'],
        });
    }
    for (const risk of workset.risks) {
        if (risk.severity === 'block' && scoreKeywords([risk.description], candidateText) > 0) {
            risks.push({
                status: 'warn',
                ruleType: risk.ruleType,
                description: `候选内容触及硬约束：${risk.description}`,
                sourceIds: risk.sourceIds,
            });
        }
    }
    const hasBlock = risks.some((risk) => risk.status === 'block');
    const hasWarn = risks.length > 0;
    return {
        status: hasBlock ? 'block' : hasWarn ? 'warn' : 'pass',
        risks,
        requiredRepairs: risks.slice(0, 4).map((risk) => risk.description),
        sourceIds: unique(risks.flatMap((risk) => risk.sourceIds || []), 12),
        workset,
    };
}

export function summarizeStoryRagWorkset(workset, limit = DEFAULT_SUMMARY_LIMIT) {
    if (!workset) {
        return '- 独立剧情 RAG 未返回工作集。';
    }
    const factLines = workset.facts.slice(0, 6).map((fact) => `- 事实[${fact.canonLevel}/Arc${fact.arc}]: ${compactText(fact.text, 120)}`);
    const riskLines = workset.risks.slice(0, 4).map((risk) => `- 风险[${risk.severity}/${risk.ruleType}/Arc${risk.arc}]: ${compactText(risk.description, 120)}`);
    const hookLines = workset.hooks.slice(0, 4).map((hook) => `- 钩子[Arc${hook.arc}]: ${compactText(hook.text, 90)}`);
    const seedLines = asArray(workset.candidateSeeds).slice(0, 4).map((seed) => `- 种子[${seed.type}/${seed.grounding}]: ${compactText(seed.text, 110)}`);
    const sourceLines = workset.chunks.slice(0, 3).map((chunk) => `- 来源[${chunk.canonLevel}/${chunk.sourceType}]: ${compactText(chunk.sourceIds?.[0] || chunk.id, 80)} / ${compactText(chunk.digest, 100)}`);
    const runtime = workset.runtimeMemory || {};
    const saveLines = (runtime.saveFacts || runtime.entries?.filter((entry) => entry.layer === 'save') || [])
        .slice(0, 3)
        .map((entry) => `- 存档[${entry.band}/${entry.source}]: ${compactText(entry.text, 110)}`);
    const characterLines = (runtime.characterMemories || runtime.entries?.filter((entry) => entry.layer === 'character') || [])
        .slice(0, 3)
        .map((entry) => `- 角色[${entry.band}/${entry.source}]: ${compactText(entry.text, 120)}`);
    const deathLines = (runtime.deathMemories || runtime.entries?.filter((entry) => entry.layer === 'death') || [])
        .slice(0, 2)
        .map((entry) => `- 死亡[${entry.band}/${entry.source}]: ${compactText(entry.text, 120)}`);
    const oneLine = (lines, fallback, limit = 150) => compactText(String(lines[0] || fallback).replace(/^- /u, ''), limit);
    const output = [
        `- 索引: story-rag ${workset.metadata.indexGeneratedAt || 'unknown'}；chunks=${workset.metadata.chunks} facts=${workset.metadata.facts} constraints=${workset.metadata.constraints}`,
        `- 查询: Arc${workset.query.arc} / ${compactText(workset.query.location || '未知地点', 40)} / IF=${workset.query.ifRoute.dominant || 'EnvyMain'} / Δ=${Number(workset.query.worldline.divergence || 0).toFixed(3)}`,
        `- 导演模式: ${workset.directorSignals?.mode || 'causal-simulator-director'} / 牵引=${workset.directorSignals?.attractorStrength ?? 'n/a'} / 推演=${workset.directorSignals?.worldSimulation || 'normal'}`,
        `- 架构路由: ${workset.architecture?.routing?.actionMode || workset.directorSignals?.actionMode || 'free-simulation'} / ${compactText(workset.directorSignals?.generationPolicy || workset.directorSignals?.reusePolicy || '', 160)}`,
        `- 记忆边界: 原作小说记忆为全局因果 groundtruth；当前存档记忆只在 ${compactText(workset.memoryPolicy?.saveMemorySessionId || '当前存档', 36)} 内有效，不跨存档泄漏。`,
        `- 当前存档热记忆: ${oneLine(saveLines, '无存档热记忆。', 140)}`,
        `- 角色/关系记忆: ${oneLine(characterLines, '无角色记忆。', 140)}`,
        `- 死亡/回滚记忆: ${oneLine(deathLines, '无死亡回滚记忆。', 130)}`,
        '- 候选行动 RAG 种子:',
        ...(seedLines.length ? seedLines : ['- 无候选行动种子。']),
        '- 本轮应保留事实:',
        ...(factLines.length ? factLines : ['- 无高相关事实。']),
        '- 连续性/世界线风险:',
        ...(riskLines.length ? riskLines : ['- 无高风险约束。']),
        '- 可推进原作/世界线钩子:',
        ...(hookLines.length ? hookLines : ['- 无直接钩子。']),
        '- 来源摘要（只给 source id 和短 digest，不注入长原文）:',
        ...(sourceLines.length ? sourceLines : ['- 无来源摘要。']),
    ].join('\n');
    if (output.length <= limit) {
        return output;
    }
    const suffix = '...';
    return `${output.slice(0, Math.max(0, limit - suffix.length)).trimEnd()}${suffix}`;
}

export function storyRagHealthcheck() {
    return {
        status: storyRagChunks.length && storyRagFacts.length && storyRagConstraints.length ? 'pass' : 'fail',
        metadata: storyRagIndexMetadata,
        chunks: storyRagChunks.length,
        facts: storyRagFacts.length,
        constraints: storyRagConstraints.length,
        promises: storyRagPromises.length,
    };
}
