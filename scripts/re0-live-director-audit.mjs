import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
    buildRe0AgentTurn,
    summarizeRe0AgentTurn,
    validateRe0AgentTurn,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/re0-agent-module.js';
import {
    evaluateAssetUse,
    summarizeAssetPlan,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/asset-policy-engine.js';
import {
    retrieveStoryRagWorkset,
    summarizeStoryRagWorkset,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/story-rag.js';
import {
    extractVisualNovelScriptBlock,
    findVisualNovelEmbeddedDialogue,
    splitVisualNovelEmbeddedDialogueSegments,
    VISUAL_NOVEL_SCRIPT_VERSION,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/vn-script.js';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const USER_ROOT = path.join(PROJECT_ROOT, 'data/default-user');
const QA_DIR = path.join(USER_ROOT, 're0-engine/collab/inbox/qa');
const MIMO_CHAT_URL = 'https://token-plan-cn.xiaomimimo.com/v1/chat/completions';
const CUSTOM_SECRET_KEY = 'api_key_custom';
const DEFAULT_MODEL = process.env.RE0_MIMO_MODEL || 'mimo-v2.5-pro';
const TIMEOUT_MS = Number(process.env.RE0_MIMO_TIMEOUT_MS || 180_000);
const MAX_COMPLETION_TOKENS = Number(process.env.RE0_MIMO_MAX_TOKENS || 1200);
const PASS_STATUSES = new Set(['pass']);
const LIVE_SPEAKER_ALIASES = {
    protagonist: ['protagonist', '昴', '菜月昴', '悠真', '陆临', '主角', '我'],
    emilia: ['emilia', '爱蜜莉雅', '艾米莉娅', '银发少女'],
    felt: ['felt', '菲鲁特'],
    rom: ['rom', '罗姆爷', '罗姆'],
    rem: ['rem', '蕾姆'],
    ram: ['ram', '拉姆'],
    crusch: ['crusch', '库珥修', '库珥修·卡尔斯腾'],
    anastasia: ['anastasia', '安娜塔西亚', '安娜塔西亚·合辛'],
    wilhelm: ['wilhelm', '威尔海姆', '威尔海姆·范·阿斯特雷亚'],
    julius: ['julius', '尤里乌斯', '尤里乌斯·尤克历乌斯'],
    garfiel: ['garfiel', '加菲尔', '加菲尔·汀泽尔'],
    roswaal: ['roswaal', '罗兹瓦尔', '罗兹瓦尔·L·梅札斯'],
    beatrice: ['beatrice', '碧翠丝', '贝蒂'],
    echidna: ['echidna', '艾姬多娜', '强欲魔女'],
    owen: ['owen', '欧文', '欧文·卡斯兰'],
    lishelle: ['lishelle', '莉榭尔', '莉榭尔·阿尔戈', '莉雪尔', '莉雪'],
    mia: ['mia', '米娅'],
};
const LIVE_SPEAKER_DISPLAY_NAMES = {
    protagonist: '主角',
    emilia: '爱蜜莉雅',
    felt: '菲鲁特',
    rom: '罗姆爷',
    rem: '蕾姆',
    ram: '拉姆',
    crusch: '库珥修',
    anastasia: '安娜塔西亚',
    wilhelm: '威尔海姆',
    julius: '尤里乌斯',
    garfiel: '加菲尔',
    roswaal: '罗兹瓦尔',
    beatrice: '碧翠丝',
    echidna: '艾姬多娜',
    owen: '欧文',
    lishelle: '莉榭尔',
    mia: '米娅',
};

function resolveLiveSpeakerProfile(label = '') {
    const source = String(label || '').trim().toLowerCase();
    if (!source) {
        return null;
    }
    for (const [id, aliases] of Object.entries(LIVE_SPEAKER_ALIASES)) {
        if (aliases.some((alias) => {
            const item = String(alias || '').toLowerCase();
            return source === item || source.includes(item) || item.includes(source);
        })) {
            return { id, name: LIVE_SPEAKER_DISPLAY_NAMES[id] || id };
        }
    }
    return null;
}

function looksLikeDialogueSummaryText(segment = {}) {
    const text = String(segment.text || '').replace(/\s+/g, ' ').trim();
    if (!text || segment.speakerId === 'narrator') {
        return false;
    }
    const hasQuote = /[「『“][^」』”]{1,180}[」』”]/u.test(text);
    if (hasQuote && /[」』”]\s*[\u4e00-\u9fa5A-Za-z]/u.test(text)) {
        return true;
    }
    if (hasQuote) {
        return false;
    }
    const profile = resolveLiveSpeakerProfile(segment.speakerId || segment.speaker || segment.speakerName || '');
    const aliases = profile?.id ? [
        profile.name,
        ...(LIVE_SPEAKER_ALIASES[profile.id] || []),
    ].filter(Boolean) : [];
    const mentionsSpeaker = aliases.some((alias) => text.includes(String(alias)));
    const summaryVerbs = /(指尖|袖口|眼眸|目光|声音|姿态|神情|表情|站在|靠在|坐在|抬头|低垂|沉默|终于开口|轻声|低声|压低|提到|话锋|质疑|询问|回应|回答|提出|提醒|看向|扫过|皱眉|前倾|交叠)/u;
    if (mentionsSpeaker && summaryVerbs.test(text)) {
        return true;
    }
    return /^(?:他|她|对方|昴|爱蜜莉雅|蕾姆|拉姆|欧文|菲鲁特|罗姆爷|碧翠丝|艾姬多娜).{0,36}(?:轻声|低声|压低|开口|询问|质疑|回应|回答|提出|提醒|看向|站在|靠在|目光|声音|姿态|神情|表情)/u.test(text);
}

function nowStamp() {
    return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/u, '').replace('T', '-');
}

function compactText(value, limit = 600) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= limit) {
        return text;
    }
    return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function sanitizeVisibleNarrativeMetaText(text = '') {
    const raw = String(text || '');
    const marker = raw.match(/<!--\s*RE0_VN_SCRIPT[\s\S]*?-->/iu);
    const sanitizeVisible = (visible) => String(visible || '')
        .replace(/罗兹瓦尔的剧本|罗兹瓦尔剧本/gu, '罗兹瓦尔的布局')
        .replace(/福音书剧本/gu, '福音书布局')
        .replace(/剧本/gu, '布局')
        .replace(/原作的齿轮/gu, '命运的齿轮')
        .replace(/原作线/gu, '既定因果')
        .replace(/原作剧情/gu, '既定因果')
        .replace(/原作/gu, '命运')
        .replace(/\bRAG\b/giu, '记忆索引')
        .replace(/路线锁定/gu, '无形牵引')
        .replace(/玩家选择/gu, '刚才的决定')
        .replace(/系统提示/gu, '直觉警讯')
        .replace(/游戏机制/gu, '世界规则')
        .replace(/大模型|模型输出/gu, '世界意志');
    if (!marker) {
        return sanitizeVisible(raw);
    }
    const before = raw.slice(0, marker.index);
    const afterStart = Number(marker.index || 0) + marker[0].length;
    const after = raw.slice(afterStart);
    return `${sanitizeVisible(before).trimEnd()}\n${marker[0]}${after}`;
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function unique(values, limit = 12) {
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

function assertLiveSecret() {
    const secretsPath = path.join(USER_ROOT, 'secrets.json');
    if (!fs.existsSync(secretsPath)) {
        throw new Error('Missing data/default-user/secrets.json. Live MiMo audit is blocked; mock/fallback is not allowed.');
    }
    let secrets = {};
    try {
        secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
    } catch (error) {
        throw new Error(`Failed to parse data/default-user/secrets.json: ${error?.message || error}`);
    }
    const secretArray = secrets[CUSTOM_SECRET_KEY];
    const activeSecret = Array.isArray(secretArray)
        ? (secretArray.find((secret) => secret?.active) || secretArray[0])
        : null;
    const apiKey = String(activeSecret?.value || '').trim();
    if (!apiKey) {
        throw new Error('Missing active data/default-user/secrets.json api_key_custom. Live MiMo audit is blocked; mock/fallback is not allowed.');
    }
    return apiKey;
}

function stateForScenario(scenario) {
    const characterCards = Object.fromEntries((scenario.characters || []).map((name) => [name, {
        name,
        trust: scenario.relationship?.trust ?? 0,
        suspicion: scenario.relationship?.suspicion ?? 0,
        affection: scenario.relationship?.affection ?? 0,
        conflict: scenario.relationship?.conflict ?? 0,
        attitudeToPlayer: scenario.relationship?.attitude || '',
        memory: scenario.relationship?.memory ? [scenario.relationship.memory] : [],
    }]));
    return {
        mode: scenario.mode || 'main',
        current: {
            arc: scenario.arc,
            day: scenario.day || scenario.arc * 100,
            time: scenario.time || '深夜',
            location: scenario.location,
            viewpoint: '玩家',
            castIds: scenario.characters || [],
        },
        setup: {
            protagonistName: scenario.protagonist?.name || '昴',
            gender: scenario.protagonist?.gender || '男',
            origin: scenario.protagonist?.origin || '原作开局',
            ability: scenario.protagonist?.ability || '',
            initialScenario: scenario.initialScenario || '',
        },
        protagonistProfile: {
            name: scenario.protagonist?.name || '昴',
            gender: scenario.protagonist?.gender || '男',
            origin: scenario.protagonist?.origin || '原作开局',
            ability: scenario.protagonist?.ability || '',
        },
        flags: {
            worldSessionId: `live-director-${scenario.id}`,
            playerIntentSceneLockLocation: scenario.location,
            lastNarrativeActionCommitment: {
                text: scenario.action,
                source: 'live-director-audit',
            },
        },
        worldline: {
            id: `LIVE-${scenario.id}`,
            divergence: scenario.divergence ?? 0.08,
            attractor: scenario.attractor || '嫉妒/主线',
        },
        ifRouteLogic: {
            dominant: scenario.ifDominant || 'EnvyMain',
            routePressures: scenario.routePressures || {},
        },
        gameplay: {
            activeObjective: scenario.objective,
            objectiveStage: scenario.stage || 'current-scene',
            lastPlayerAction: scenario.action,
            deathRisk: scenario.deathRisk || {},
            openQuestions: scenario.openQuestions || [],
        },
        discoveredClues: scenario.clues || [],
        deathBranches: scenario.deathBranches || [],
        characterCards,
        adultContent: scenario.adultContent || { enabled: false },
        narrativeMode: {
            current: scenario.narrativeMode || scenario.mode || 'main',
        },
        visuals: {
            visualNovel: {
                enabled: true,
                scriptEnabled: true,
                queueMode: 'append',
                backgroundKey: scenario.backgroundKey || '',
                sceneCharacters: scenario.characters || [],
                currentSpeakerName: scenario.characters?.[0] || '',
            },
            sceneBackdrop: {
                currentKey: scenario.backgroundKey || '',
            },
        },
    };
}

const SCENARIOS = [
    {
        id: 'canon-arc1-loot-house',
        title: '原作行动：Arc1 盗品蔵徽章交易',
        expectedMode: 'canon-follow',
        arc: 1,
        time: '雨夜',
        location: '王都贫民区盗品蔵',
        backgroundKey: 'loot_house',
        characters: ['爱蜜莉雅', '菲鲁特', '罗姆爷'],
        objective: '按原作主线确认徽章流向，同时保留当前存档差异。',
        action: '【原作行动】我进入盗品蔵，先向菲鲁特和罗姆爷说明自己只想确认徽章交易，避免今晚流血。',
        ackTerms: ['进入', '盗品蔵', '菲鲁特', '罗姆爷', '徽章', '交易', '流血'],
        clues: ['徽章被盗', '贫民区雨夜', '艾尔莎的威胁还未入场'],
        mustMention: [/徽章|徽章交易/u, /菲鲁特|罗姆爷|爱蜜莉雅/u],
    },
    {
        id: 'free-archive-librarian',
        title: '自由行动：现代图书管理员出身改写开局',
        expectedMode: 'free-simulation',
        arc: 1,
        time: '傍晚',
        location: '王都骑士团旧档案室',
        backgroundKey: 'archive',
        characters: ['欧文', '爱蜜莉雅'],
        protagonist: {
            name: '悠真',
            gender: '男',
            origin: '现代图书管理员',
            ability: '目录化、索引、快速比对异常记录',
        },
        objective: '不走盗品蔵直线，先用档案能力寻找徽章失窃和旧案之间的因果线索。',
        action: '【自由行动】我不急着去盗品蔵，而是以现代图书管理员的索引习惯，请欧文允许我查阅骑士团旧案和徽章失窃记录。',
        ackTerms: ['不急着去盗品蔵', '现代图书管理员', '索引', '欧文', '查阅', '旧案', '徽章失窃'],
        clues: ['封蜡缺页', '王都旧案', '黑伞目击记录'],
        mustMention: [/档案|旧案|索引|记录/u, /欧文|爱蜜莉雅/u],
        mustNotForce: [/你只能去盗品蔵/u, /立刻跳到盗品蔵结局/u],
    },
    {
        id: 'if-sloth-pressure',
        title: 'IF 吸引：怠惰压力不是路线开关',
        expectedMode: 'if-attractor',
        arc: 3,
        time: '清晨',
        location: '罗兹瓦尔宅邸外森林路',
        backgroundKey: 'forest_road_checkpoint',
        characters: ['蕾姆', '拉姆'],
        objective: '在危机压力下测试逃避责任是否只增加怠惰吸引，而不是硬切 IF 路线。',
        action: '【IF 倾向行动】我拉住蕾姆，说我们先离开宅邸和王都纷争，去卡拉拉基重新开始。',
        ackTerms: ['拉住蕾姆', '离开宅邸', '王都纷争', '卡拉拉基', '重新开始'],
        divergence: 0.31,
        attractor: '嫉妒/主线被怠惰压力拉扯',
        ifDominant: 'Sloth',
        routePressures: { Sloth: 0.54, EnvyMain: 0.38 },
        clues: ['宅邸危机未解', '蕾姆对逃避提议动摇', '魔女教传言逼近'],
        relationship: { trust: 6, affection: 4, conflict: 3, attitude: '担心玩家在逃避责任' },
        mustMention: [/蕾姆|拉姆/u, /逃|离开|责任|代价|追兵|宅邸/u],
        forbidden: [/直接进入.*怠惰IF/u, /路线锁定/u],
    },
    {
        id: 'canon-arc3-alliance-white-whale',
        title: '原作行动：Arc3 白鲸讨伐与怠惰防线协商',
        expectedMode: 'canon-follow',
        arc: 3,
        time: '下午',
        location: '王选会议厅 · 白鲸活动与怠惰位置协商',
        backgroundKey: 'arc03_royal_election_hall',
        characters: ['库珥修', '安娜塔西亚', '威尔海姆', '尤里乌斯'],
        objective: '以可验证证据促成白鲸讨伐与怠惰防线协商，不能把预言当证据。',
        action: '【原作行动】我把白鲸活动、商路损失和怠惰袭击窗口拆成可验证证据，先请求库珥修和安娜塔西亚核对情报。',
        ackTerms: ['白鲸活动', '商路损失', '怠惰袭击', '可验证证据', '库珥修', '安娜塔西亚', '核对情报'],
        clues: ['白鲸活动', '怠惰位置', '撤离路线', '商路损失'],
        mustMention: [/白鲸|怠惰|商路|撤离/u, /库珥修|安娜塔西亚|威尔海姆|尤里乌斯/u],
        forbidden: [/预言所以必须相信/u, /路线锁定/u, /直接跳到讨伐结束/u],
    },
    {
        id: 'canon-arc4-sanctuary-trial',
        title: '原作行动：Arc4 圣域试炼与宅邸双线',
        expectedMode: 'canon-follow',
        arc: 4,
        time: '黄昏',
        location: '圣域墓所外 · 试炼与结界分歧',
        backgroundKey: 'arc04_sanctuary_entrance',
        characters: ['爱蜜莉雅', '加菲尔', '罗兹瓦尔', '碧翠丝'],
        objective: '确认圣域试炼、结界规则、宅邸袭击和罗兹瓦尔剧本之间的因果约束。',
        action: '【原作行动】我不再用死亡硬刷答案，而是先让爱蜜莉雅保留自主选择，同时向加菲尔确认结界与墓所试炼规则。',
        ackTerms: ['死亡', '爱蜜莉雅', '自主选择', '加菲尔', '结界', '墓所试炼', '罗兹瓦尔剧本'],
        clues: ['圣域结界', '墓所试炼', '罗兹瓦尔剧本', '碧翠丝契约'],
        deathBranches: [{
            id: 'death-arc4-greed-loop-001',
            lesson: '把死亡当作刷最优解工具会强化罗兹瓦尔剧本，必须改成同伴自主选择与双线协作。',
            private: true,
        }],
        mustMention: [/圣域|结界|墓所|试炼/u, /爱蜜莉雅|加菲尔|罗兹瓦尔|碧翠丝/u],
        forbidden: [/直接接受强欲契约/u, /死亡回归是公开证据/u, /路线锁定/u],
    },
    {
        id: 'death-memory-private',
        title: '死亡回归：私有记忆只能变成策略',
        expectedMode: 'free-simulation',
        arc: 1,
        time: '雨夜',
        location: '王都贫民区雨夜巷口',
        backgroundKey: 'rain_bell',
        characters: ['莉榭尔', '米娅'],
        objective: '利用上一轮死亡线索改变接触顺序，但不能公开死亡回归。',
        action: '【带回线索】我不说出死亡回归，只把上一轮记住的黑伞、钟锈和血水位置当作直觉，先护住米娅再询问莉榭尔。',
        ackTerms: ['不说出死亡回归', '黑伞', '钟锈', '血水', '护住米娅', '询问莉榭尔'],
        deathBranches: [{
            id: 'death-arc1-bell-001',
            lesson: '黑伞靠近废钟后，钟锈会暴露袭击者路线；公开异常会引来更快灭口。',
            private: true,
        }],
        clues: ['黑伞', '钟锈', '血水位置'],
        relationship: { trust: 2, suspicion: 2, trauma: 3, attitude: '把玩家当作可疑但可能救命的人' },
        mustMention: [/黑伞|钟锈|血水|米娅|莉榭尔/u],
        forbiddenDialogue: [/死亡回归|我死过|回到锚点/u],
    },
    {
        id: 'adult-au-daily-soft',
        title: '成人 AU 日常：软性亲密必须仍受主线/RAG约束',
        expectedMode: 'free-simulation',
        mode: 'adult',
        narrativeMode: 'adult',
        arc: 2,
        time: '夜晚',
        location: '罗兹瓦尔宅邸客房',
        backgroundKey: 'mansion_guest_room',
        characters: ['爱蜜莉雅', '蕾姆'],
        objective: '测试成人 AU 下关系推进、素材差分和主线伏笔能否共存。',
        action: '【成人日常】我在宅邸客房里请爱蜜莉雅和蕾姆帮我复盘今天的异常，气氛暧昧但我明确保持尊重和克制。',
        ackTerms: ['宅邸客房', '爱蜜莉雅', '蕾姆', '复盘', '异常', '尊重', '克制'],
        adultContent: {
            enabled: true,
            allCharactersAdult: true,
            tone: 'soft-intimacy',
            hardLimits: ['露骨性行为', '未成年', '非合意'],
        },
        relationship: { trust: 5, affection: 4, conflict: 1, attitude: '愿意靠近但仍警惕危机' },
        clues: ['宅邸咒术前兆', '夜晚客房', '关系张力'],
        mustMention: [/爱蜜莉雅|蕾姆/u, /复盘|异常|克制|尊重|气氛/u],
        forbidden: [/露骨|插入|无法同意|未成年/u],
    },
];

function selectedScenarios() {
    const ids = (process.argv.find((arg) => arg.startsWith('--scenario=')) || '').replace('--scenario=', '').split(',').map((id) => id.trim()).filter(Boolean);
    if (!ids.length) {
        return SCENARIOS;
    }
    const wanted = new Set(ids);
    return SCENARIOS.filter((scenario) => wanted.has(scenario.id));
}

function compactFacts(workset, limit = 6) {
    return asArray(workset?.facts).slice(0, limit).map((fact) => ({
        id: fact?.id || '',
        layer: fact?.layer || fact?.source || '',
        title: compactText(fact?.title || '', 80),
        summary: compactText(fact?.summary || fact?.text || '', 220),
        tags: unique(fact?.tags || [], 6),
    }));
}

function compactSeeds(workset, limit = 6) {
    return asArray(workset?.candidateSeeds).slice(0, limit).map((seed) => ({
        type: seed?.type || '',
        mode: seed?.mode || '',
        label: compactText(seed?.label || '', 60),
        text: compactText(seed?.text || '', 180),
        sourceIds: unique(seed?.sourceIds || [], 4),
        groundingTerms: unique(seed?.groundingTerms || [], 6),
    }));
}

function compactRuntimeMemory(workset) {
    const runtime = workset?.runtimeMemory || {};
    const mapEntry = (entry) => ({
        id: entry?.id || '',
        text: compactText(entry?.text || entry?.summary || entry?.title || '', 160),
        tags: unique(entry?.tags || [], 4),
    });
    return {
        sessionId: runtime.sessionId || workset?.memoryPolicy?.saveMemorySessionId || '',
        saveFacts: asArray(runtime.saveFacts).slice(0, 4).map(mapEntry),
        characterMemories: asArray(runtime.characterMemories).slice(0, 4).map(mapEntry),
        deathMemories: asArray(runtime.deathMemories).slice(0, 4).map(mapEntry),
    };
}

function compactCharacterCards(cards = {}) {
    return Object.fromEntries(Object.entries(cards || {}).slice(0, 8).map(([name, card = {}]) => [name, {
        name: card.name || name,
        trust: Number(card.trust || 0),
        suspicion: Number(card.suspicion || 0),
        affection: Number(card.affection || 0),
        conflict: Number(card.conflict || 0),
        attitudeToPlayer: compactText(card.attitudeToPlayer || '', 90),
        latestMemory: compactText(asArray(card.memory).at(-1) || asArray(card.arcLog).at(-1) || '', 100),
    }]));
}

function compactDirectorPlan(plan = {}) {
    const director = plan.narrativeDirector || plan.directorPlan?.narrativeDirector || {};
    return {
        beat: director.beat || {},
        payoff: director.payoff || {},
        arcDuty: compactText(director.arcDuty || director.longRangeGoal || '', 260),
        promptDirectives: asArray(director.promptDirectives || plan.promptDirectives).slice(0, 8).map((item) => compactText(item, 180)),
        candidateActionPolicy: {
            mode: plan.candidateActionPolicy?.mode || plan.directorPlan?.candidateActionPolicy?.mode || '',
            ragSeededChoices: asArray(plan.candidateActionPolicy?.ragSeededChoices || plan.directorPlan?.candidateActionPolicy?.ragSeededChoices).slice(0, 5).map((item) => compactText(item, 160)),
            avoidTemplateFallbackWhenSeedsAvailable: Boolean(plan.candidateActionPolicy?.avoidTemplateFallbackWhenSeedsAvailable
                || plan.directorPlan?.candidateActionPolicy?.avoidTemplateFallbackWhenSeedsAvailable),
        },
    };
}

function compactBackdrop(backdrop = {}) {
    return {
        key: backdrop.key || '',
        title: backdrop.title || '',
        summary: compactText(backdrop.summary || backdrop.prompt || '', 140),
        score: backdrop.score ?? 0,
        confidence: backdrop.confidence || '',
        reasons: asArray(backdrop.reasons).slice(0, 4).map((item) => compactText(item, 70)),
    };
}

function buildDirectorMessages({ scenario, state, workset, agentTurn }) {
    const plan = agentTurn.turnPlan || {};
    const assetPlan = agentTurn.assetPlan || plan.assetPlan || {};
    const assetKeys = unique([
        assetPlan.selectedBackdrop?.key,
        ...asArray(assetPlan.candidateBackdrops).map((item) => item?.key),
    ], 10);
    const castIds = unique(asArray(assetPlan.castAssets).map((item) => item?.id), 10);
    const payload = {
        task: 'live_narrative_director_generation',
        scenario: {
            id: scenario.id,
            title: scenario.title,
            expectedMode: scenario.expectedMode,
            successCriteria: [
                '第一拍承接玩家行动，不把候选行动当路线按钮。',
                '原作行动沿原作因果吸引，自由行动按世界规则推演。',
                '正文是小说，不输出调试状态块；结尾只给开放行动方向。',
                '隐藏 RE0_VN_SCRIPT 是舞台唯一结构化台本。',
                '可见正文不得出现原作/RAG/剧本/路线锁定等元叙事词。',
            ],
        },
        state: {
            mode: state.mode,
            current: state.current,
            setup: state.setup,
            protagonistProfile: state.protagonistProfile,
            worldline: state.worldline,
            ifRouteLogic: state.ifRouteLogic,
            gameplay: state.gameplay,
            discoveredClues: state.discoveredClues,
            deathBranches: state.deathBranches,
            adultContent: state.adultContent,
            characterCards: compactCharacterCards(state.characterCards),
        },
        playerAction: scenario.action,
        storyRag: {
            routing: workset?.architecture?.routing || {},
            layerNames: worksetLayerNames(workset),
            summary: summarizeStoryRagWorkset(workset, 1100),
            facts: compactFacts(workset, 6),
            risks: asArray(workset?.risks).slice(0, 5).map((risk) => ({
                id: risk?.id || '',
                title: compactText(risk?.title || '', 80),
                summary: compactText(risk?.summary || risk?.text || '', 180),
            })),
            hooks: asArray(workset?.hooks).slice(0, 5).map((hook) => ({
                id: hook?.id || '',
                title: compactText(hook?.title || '', 80),
                summary: compactText(hook?.summary || hook?.text || '', 180),
            })),
            candidateSeeds: compactSeeds(workset, 6),
            runtimeMemory: compactRuntimeMemory(workset),
        },
        agentTurn: {
            summary: summarizeRe0AgentTurn(agentTurn, 1100),
            routing: plan.routing || {},
            directorPlan: compactDirectorPlan(plan),
            validation: {
                status: agentTurn.validation?.status || '',
                findingCount: asArray(agentTurn.validation?.findings).length,
            },
        },
        assetPlan: {
            summary: summarizeAssetPlan(assetPlan, 800),
            allowedBackgroundKeys: assetKeys,
            selectedBackdrop: compactBackdrop(assetPlan.selectedBackdrop),
            castIds,
            castAssets: asArray(assetPlan.castAssets).slice(0, 8).map((item) => ({
                id: item?.id || '',
                displayName: item?.displayName || item?.inputName || '',
                variantKey: item?.variantKey || '',
                reason: compactText(item?.reason || '', 100),
            })),
            sourceNovelReferences: asArray(assetPlan.sourceNovelReferences).slice(0, 5).map((item) => ({
                kind: item?.kind || '',
                characterId: item?.characterId || '',
                sceneKey: item?.sceneKey || '',
                reason: compactText(item?.reason || '', 100),
            })),
        },
        outputContract: {
            visibleNarrative: '可见正文目标 320-620 个中文字符，普通轮接受上限 950；写成可分页的短演出段；角色台词使用“角色名：「台词」”；旁白只写镜头、环境、因果、危险感。事件复杂时缩小本轮范围，不要把 token 花在长篇正文。',
            privateMemoryTerms: 'action/objective/ackTerms 中的“死亡回归、上一轮、循环、锚点、我死过、不说出死亡回归”是内部策略标签，不得出现在可见正文、角色台词、choices 或 segments.text；改写成既视感、旧伤、手心刺痛、模糊预警、直觉或梦。',
            hiddenComment: `可见正文结束后必须立刻追加 <!-- RE0_VN_SCRIPT {...} -->，version 必须是 ${VISUAL_NOVEL_SCRIPT_VERSION}；segments 目标 5-6 段，允许 4-8 段，超过 8 段等同本轮失败。没有隐藏 RE0_VN_SCRIPT 就等同本轮失败，不能只写正文收尾。优先保证隐藏 JSON 完整可解析，禁止把 max_completion_tokens 用在长篇正文上。隐藏字段必须短：segments.text 每段 30-80 字，action 8-24 字，tone/expression/pose/camera/focus/sfx 用短词。dialogue.text 只能写该 speakerId 实际出口的台词，不写动作、神情、心理或转述摘要。JSON 字符串内部不要使用英文双引号，避免未转义破坏 JSON。`,
            backgroundKey: `RE0_VN_SCRIPT 顶层 backgroundKey 必填，必须从 allowedBackgroundKeys 选择；本场优先使用 ${assetKeys[0] || '当前最贴合场景 key'}。缺失 backgroundKey 视为输出失败。`,
            choices: 'choices 必须是 3-6 条当前现场可执行动作；每条至少绑定两个现场锚点，例如地点、人物、物件、线索、交易对象、风险或目标；至少一半 choices 点名当前人物或地点，避免“寻找其他线索”这类泛泛选项。',
            scriptSchema: {
                version: VISUAL_NOVEL_SCRIPT_VERSION,
                segmentsCount: 5,
                backgroundKey: assetKeys[0] || 'rain_bell',
                castIds: castIds.slice(0, 4),
                scene: { location: state.current.location, time: state.current.time, mood: '当前气氛' },
                beat: {
                    type: 'reveal/conflict/payoff/transition/daily/adult-intimacy/survival',
                    pacing: 'balanced/fast/climax/slow-burn',
                    progressDelta: ['new_clue/relationship_shift/danger_shift/payoff/location_transition'],
                    nextHook: '下一步可验证钩子',
                },
                segments: [
                    { type: 'narration', text: '30-80字旁白段', action: '8-24字镜头动作', tone: '短语气', camera: 'wide/close', focus: '短焦点' },
                    { type: 'dialogue', speakerId: castIds[0] || 'emilia', text: '30-80字实际出口台词', action: '8-24字动作', tone: '短语气', expression: '短表情', pose: '短姿势' },
                ],
                choices: ['当前现场可执行候选行动 1', '当前现场可执行候选行动 2', '当前现场可执行候选行动 3'],
                statePatch: { current: { location: state.current.location }, gameplay: { activeObjective: state.gameplay.activeObjective } },
            },
        },
    };

    return [
        {
            role: 'system',
            content: [
                '你是 Re:0 开放世界视觉小说的真实 Agent Director、小说作者、因果模拟器和视觉小说分镜师。',
                '必须基于给定 StoryRAG、存档记忆、角色记忆、死亡记忆、世界线状态和素材计划生成本轮剧情正文。',
                '原作行动：沿原作因果链和命运吸引子推进，但不照抄原文长段。',
                '自由行动：不要写死剧情模板，不要强行拉回下一幕；按原作世界规则、角色动机和当前存档因果推演。',
                'IF 行动：表现为压力、代价、误读、诱惑和纠偏入口，禁止写成一次点击直接路线锁定。',
                '死亡回归：只能作为玩家私有策略记忆，不让 NPC 正常听见或理解。',
                '你只能输出玩家可见小说正文，末尾附一个隐藏 RE0_VN_SCRIPT 注释；不要输出分析、markdown、调试表或额外 JSON。',
                '完成定义：必须同时输出“短可见正文”和“隐藏 RE0_VN_SCRIPT”。只写短正文、只写候选方向或忘记隐藏台本，都视为失败。',
                '可见正文目标 320-620 个中文字符，普通轮接受上限 950；首个非空字符必须是中文小说正文，不能是 <、{、反引号或“隐藏台本”。正文后立即输出隐藏 HTML 注释台本。',
                '如果信息很多，只写一个完整小场景闭环：玩家行动落地 -> NPC 即时反应 -> 一个线索/代价/关系变化 -> 自然暂停点。不要铺成长篇章节。',
                'max_completion_tokens 按 1200 预算设计：可见正文最多约 1/3，剩余预算留给完整 RE0_VN_SCRIPT。',
                '隐藏 JSON 必须能被 JSON.parse 直接解析：所有 key 使用英文双引号；所有 string value 内部禁止再出现英文双引号，必要时使用中文引号「」或直接省略引号；不要在隐藏注释 --> 后追加任何说明。',
                'RE0_VN_SCRIPT 顶层字段必须包含 version、backgroundKey、castIds、scene、beat、segments、choices；backgroundKey 必须从 user payload 的 assetPlan.allowedBackgroundKeys 中选择，缺失就等同失败。',
                '隐藏台本必须紧凑：segments.text 每段 30-80 字，action 8-24 字；tone、expression、pose、camera、focus、sfx 只写短词；choices 每条 35-75 字。',
                '隐藏台本 dialogue.text 只能写 speakerId 这个角色实际出口的台词。不要写“爱蜜莉雅指尖绞着袖口”“蕾姆站在门边”“昴沉稳回应”这类动作、神情、心理或转述摘要；这些必须放进 action/expression/pose/tone。',
                '推荐输出顺序模板：先写 1 段 320-620 字小说正文，紧接着同一条回复输出 <!-- RE0_VN_SCRIPT {"version":"vn60","backgroundKey":"...","castIds":["..."],"scene":{},"beat":{"progressDelta":["new_clue"]},"segments":[...],"choices":[...]} -->。',
                '可见正文绝对禁止元叙事词：原作、小说、剧本、RAG、模型、玩家选择、路线锁定、系统提示、台本、游戏机制。需要表达这些概念时只写世界内证据、人物反应和直觉压力。',
                '死亡记忆私有化是硬规则：即使 playerAction、objective、ackTerms 或测试条件里含有“不说出死亡回归/上一轮/循环/锚点”等机制词，可见正文、角色台词、choices 和 segments.text 也不得照写这些词；必须小说化改写为既视感、旧伤、手心刺痛、模糊预警、梦或直觉。',
                '除非本轮 state.deathBranches 非空，或 playerAction 明确要求处理死亡终局，否则可见正文禁止出现“死亡回归、循环、锚点、上一轮、上一次循环、我死过”等私有机制词。即使有死亡记忆，也只能写成主角内心策略，不能让 NPC 正常听见。',
                '隐藏台本 segments 目标 5-6 个可分页舞台段，允许 4-8 个，超过 8 个视为失败；不要把每一句对白都拆成独立段。',
                '隐藏台本 beat.progressDelta 必须是非空数组，列出本轮至少一个真实推进：new_clue / danger_shift / relationship_shift / route_pressure / strategy_change / choice_pressure。',
                '隐藏台本 choices 必须像当前小说段落末尾自然出现的可执行动作；每条至少绑定两个现场锚点，至少一半点名当前人物或地点。',
            ].join('\n'),
        },
        {
            role: 'user',
            content: JSON.stringify(payload),
        },
    ];
}

async function callMimo(apiKey, messages, scenarioId) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const startedAt = Date.now();
    try {
        const body = {
            model: DEFAULT_MODEL,
            messages,
            temperature: 0.55,
            top_p: 0.9,
            max_completion_tokens: MAX_COMPLETION_TOKENS,
            stream: false,
            thinking: { type: 'disabled' },
        };
        const response = await fetch(MIMO_CHAT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        const raw = await response.text();
        let payload = null;
        try {
            payload = JSON.parse(raw);
        } catch {
            payload = { raw };
        }
        if (!response.ok) {
            const detail = compactText(payload?.error?.message || payload?.raw || response.statusText, 900);
            throw new Error(`MiMo request failed for ${scenarioId}: HTTP ${response.status} ${detail}`);
        }
        const message = payload?.choices?.[0]?.message || {};
        const text = typeof message.content === 'string'
            ? message.content
            : (typeof message.reasoning_content === 'string' ? message.reasoning_content : '');
        if (!text.trim()) {
            throw new Error(`MiMo returned empty content for ${scenarioId}.`);
        }
        return {
            live: true,
            model: payload?.model || DEFAULT_MODEL,
            elapsedMs: Date.now() - startedAt,
            usage: payload?.usage || null,
            text,
        };
    } finally {
        clearTimeout(timeout);
    }
}

function extractJsonObject(text) {
    const source = String(text || '').trim();
    const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/iu);
    const candidate = fenced ? fenced[1].trim() : source;
    const first = candidate.indexOf('{');
    const last = candidate.lastIndexOf('}');
    if (first < 0 || last <= first) {
        throw new Error('No JSON object found in MiMo repair response.');
    }
    return JSON.parse(candidate.slice(first, last + 1));
}

async function repairVisualNovelScriptWithMimo(apiKey, {
    scenario,
    state,
    workset,
    agentTurn,
    originalText,
    sourceMode,
    warning,
}) {
    const assetPlan = agentTurn.assetPlan || agentTurn.turnPlan?.assetPlan || {};
    const allowedBackgroundKeys = unique([
        assetPlan.selectedBackdrop?.key,
        ...asArray(assetPlan.candidateBackdrops).map((item) => item?.key),
    ], 10);
    const allowedCastIds = unique(asArray(assetPlan.castAssets).map((item) => item?.id), 10);
    const messages = [
        {
            role: 'system',
            content: [
                '你是 Re:0 VN_SCRIPT 台本修复器。你不续写剧情，只从已有正文重建结构化台本。',
                '只输出严格 JSON object，不要 Markdown，不要解释，不要隐藏注释。',
                `JSON.version 必须是 ${VISUAL_NOVEL_SCRIPT_VERSION}；segments 推荐 5-6 段，允许 4-8 段；choices 3-6 条。`,
                'segments 要覆盖正文主要节拍：玩家行动落地、NPC 即时反应、线索/代价推进、自然暂停点。',
                'backgroundKey 必须从 allowedBackgroundKeys 中选择；castIds 只包含实际在场/发声/明确入镜角色。',
                '旁白段不能替角色说话；dialogue 必须有 speakerId，dialogue.text 只能写该 speakerId 实际出口的台词。',
                '不要把动作、神情、心理或转述摘要写进 dialogue.text；例如“爱蜜莉雅指尖绞着袖口”“蕾姆站在门边”“昴沉稳回应”应改写到 action/expression/pose/tone，text 只保留实际说出口的话。',
                'beat.progressDelta 必须是非空数组，列出本轮至少一个真实推进，例如 new_clue、relationship_shift、danger_shift、payoff 或 location_transition。',
                'segments.text 和 choices 不得照写“死亡回归 / 不说出死亡回归 / 上一轮 / 循环 / 我死过 / 锚点”等私有机制词；若原正文泄漏这些词，改写为既视感、旧伤、手心刺痛、模糊预警、直觉或梦。',
            ].join('\n'),
        },
        {
            role: 'user',
            content: JSON.stringify({
                task: 'repair_invalid_or_missing_RE0_VN_SCRIPT',
                scenario: {
                    id: scenario.id,
                    title: scenario.title,
                    action: scenario.action,
                    expectedMode: scenario.expectedMode,
                },
                parseFailure: { sourceMode, warning },
                current: state.current,
                objective: state.gameplay?.activeObjective || '',
                storyRag: {
                    actionMode: workset?.architecture?.routing?.actionMode || workset?.directorSignals?.actionMode || '',
                    summary: summarizeStoryRagWorkset(workset, 700),
                    candidateSeeds: compactSeeds(workset, 5),
                },
                assetPlan: {
                    allowedBackgroundKeys,
                    selectedBackdrop: compactBackdrop(assetPlan.selectedBackdrop),
                    allowedCastIds,
                },
                originalNarrative: compactText(originalText, 4200),
                requiredJsonShape: {
                    version: VISUAL_NOVEL_SCRIPT_VERSION,
                    backgroundKey: allowedBackgroundKeys[0] || 'rain_bell',
                    castIds: allowedCastIds.slice(0, 4),
                    scene: { location: state.current.location, time: state.current.time, mood: 'mood' },
                    beat: {
                        type: 'reveal/conflict/payoff/transition/daily/adult-intimacy/survival',
                        pacing: 'balanced/fast/climax/slow-burn',
                        progressDelta: ['new_clue/relationship_shift/danger_shift/payoff/location_transition'],
                        nextHook: 'next playable hook',
                    },
                    segments: [
                        { type: 'narration', text: '玩家行动落地', action: 'stage action', tone: 'tone', camera: 'shot', focus: 'focus' },
                        { type: 'dialogue', speakerId: allowedCastIds[0] || 'protagonist', text: '实际出口台词', action: 'stage action', tone: 'tone', expression: 'expression', pose: 'pose' },
                    ],
                    choices: ['action 1', 'action 2', 'action 3'],
                    statePatch: { current: { location: state.current.location }, gameplay: { activeObjective: state.gameplay?.activeObjective || '' } },
                },
            }),
        },
    ];
    const repair = await callMimo(apiKey, messages, `${scenario.id}:vn-script-repair`);
    const script = normalizeScript(extractJsonObject(repair.text));
    if (!script?.segments?.length) {
        throw new Error(`MiMo repair returned no usable segments for ${scenario.id}.`);
    }
    return {
        live: true,
        model: repair.model,
        elapsedMs: repair.elapsedMs,
        usage: repair.usage,
        raw: repair.text,
        script,
    };
}

function normalizeScript(rawScript) {
    const script = rawScript && typeof rawScript === 'object' ? rawScript : null;
    if (!script) {
        return null;
    }
    const normalizedSegments = asArray(script.segments).map((segment, index) => {
        const item = typeof segment === 'string' ? { type: 'narration', text: segment } : (segment || {});
        const rawType = String(item.type || item.kind || item.role || '').toLowerCase();
        const rawSpeaker = String(item.speakerId || item.speaker || item.characterId || item.character || item.name || item.speakerName || '').trim();
        const narratorSpeaker = /^(narrator|world_will|world-will|worldWill|旁白|世界意志)$/iu.test(rawSpeaker);
        const profile = rawSpeaker ? resolveLiveSpeakerProfile(rawSpeaker) : null;
        const type = narratorSpeaker ? 'narration' : (rawType === 'dialogue' || rawSpeaker ? 'dialogue' : 'narration');
        return {
            id: `live-segment-${index}`,
            type,
            speakerId: type === 'dialogue' ? (profile?.id || rawSpeaker) : 'narrator',
            speakerName: type === 'dialogue' ? (profile?.name || rawSpeaker) : '世界意志',
            text: compactText(item.text || item.line || item.content || item.narration || item.dialogue || '', 900),
            action: compactText(item.action || item.stageAction || item.direction || '', 160),
            tone: compactText(item.tone || item.mood || item.delivery || '', 100),
            expression: compactText(item.expression || item.face || '', 80),
            pose: compactText(item.pose || item.position || '', 80),
            camera: compactText(item.camera || item.shot || '', 80),
            focus: compactText(item.focus || item.target || '', 80),
            sfx: compactText(item.sfx || item.sound || '', 80),
        };
    }).filter((segment) => segment.text);
    const segments = splitVisualNovelEmbeddedDialogueSegments(normalizedSegments, {
        cleanText: compactText,
        resolveSpeaker: resolveLiveSpeakerProfile,
    });
    return {
        version: script.version || '',
        backgroundKey: String(script.backgroundKey || script.background || '').trim(),
        castIds: unique(asArray(script.castIds || script.cast || script.characters).map((item) => {
            const rawId = typeof item === 'string' ? item : item?.id || item?.speakerId || item?.name;
            return resolveLiveSpeakerProfile(rawId)?.id || rawId;
        }), 8),
        scene: script.scene || {},
        beat: script.beat || {},
        segments,
        choices: unique(asArray(script.choices || script.candidates || script.nextActions).map((item) => typeof item === 'string' ? item : item?.text || item?.label || item?.action), 6),
        statePatch: script.statePatch || {},
    };
}

function regexAny(regexes = [], text = '') {
    return regexes.some((pattern) => pattern.test(text));
}

function worksetLayerNames(workset = {}) {
    const layers = workset.layers;
    if (Array.isArray(layers)) {
        return layers.map((item) => item?.name || item?.id || item).filter(Boolean);
    }
    if (layers && typeof layers === 'object') {
        return Object.keys(layers);
    }
    return [];
}

function validateLiveNarrative({ scenario, state, workset, agentTurn, mimo, parsed }) {
    const findings = [];
    const fullText = parsed.narrativeText || '';
    const visibleText = String(fullText || '')
        .replace(/<!--\s*RE0_VN_SCRIPT[\s\S]*?(?:-->|$)/giu, '')
        .trim();
    const script = parsed.script;
    const actionMode = workset?.architecture?.routing?.actionMode || workset?.directorSignals?.actionMode || '';
    const layerNames = worksetLayerNames(workset);
    const requiredLayers = ['officialCausalMemory', 'saveScopedMemory', 'characterMindMemory', 'deathReturnMemory', 'directorDecision'];

    if (visibleText.length > 1000) {
        findings.push({
            severity: 'block',
            module: 'NarrativeDirector',
            title: '可见正文过长，挤占 VN_SCRIPT 预算',
            detail: `visibleChars=${visibleText.length}; 当前配置要求 320-620 字，最多不应超过 1000。`,
        });
    } else if (visibleText.length > 950) {
        findings.push({
            severity: 'warn',
            module: 'NarrativeDirector',
            title: '可见正文略长',
            detail: `visibleChars=${visibleText.length}; 建议 320-620 字，普通轮接受上限 950。`,
        });
    }

    if (!mimo.live) {
        findings.push({ severity: 'block', module: 'MiMo', title: '不是实时 Mimo 调用', detail: 'mock/fallback/localOnly 不允许。' });
    }
    if (scenario.expectedMode && actionMode !== scenario.expectedMode) {
        findings.push({ severity: 'block', module: 'StoryRAG', title: 'RAG 行动模式不符合场景', detail: `expected=${scenario.expectedMode}, actual=${actionMode}` });
    }
    for (const layer of requiredLayers) {
        if (!layerNames.includes(layer)) {
            findings.push({ severity: 'warn', module: 'StoryRAG', title: 'RAG 层未显式暴露', detail: layer });
        }
    }
    if (!asArray(workset?.facts).length) {
        findings.push({ severity: 'block', module: 'StoryRAG', title: '未检索到原作/世界事实', detail: 'facts=0' });
    }
    if (!asArray(workset?.candidateSeeds).length) {
        findings.push({ severity: 'warn', module: 'StoryRAG', title: '未生成 RAG 候选行动种子', detail: 'candidateSeeds=0' });
    }
    if (!script) {
        findings.push({ severity: 'block', module: 'VN_SCRIPT', title: 'Mimo 输出缺少隐藏台本', detail: parsed.sourceMode || 'none' });
        return findings;
    }
    if (script.version !== VISUAL_NOVEL_SCRIPT_VERSION) {
        findings.push({ severity: 'block', module: 'VN_SCRIPT', title: '台本 version 不匹配', detail: `expected=${VISUAL_NOVEL_SCRIPT_VERSION}, actual=${script.version || 'missing'}` });
    }
    const assetPlan = agentTurn.assetPlan || agentTurn.turnPlan?.assetPlan || {};
    const allowedBackgroundKeys = unique([
        assetPlan.selectedBackdrop?.key,
        ...asArray(assetPlan.candidateBackdrops).map((item) => item?.key),
    ], 12);
    if (!script.backgroundKey) {
        findings.push({ severity: 'block', module: 'AssetDirector', title: '台本缺少 backgroundKey', detail: `allowed=${allowedBackgroundKeys.join('/') || 'none'}` });
    } else if (allowedBackgroundKeys.length && !allowedBackgroundKeys.includes(script.backgroundKey)) {
        findings.push({ severity: 'block', module: 'AssetDirector', title: 'backgroundKey 未来自素材计划', detail: `actual=${script.backgroundKey}; allowed=${allowedBackgroundKeys.join('/')}` });
    }
    if (script.segments.length < 3 || script.segments.length > 8) {
        findings.push({ severity: 'block', module: 'VN_SCRIPT', title: '演出段数量越界', detail: `segments=${script.segments.length}` });
    }
    if (!script.beat || !asArray(script.beat.progressDelta).length) {
        findings.push({ severity: 'warn', module: 'NarrativeDirector', title: 'beat.progressDelta 不足', detail: '需要说明本轮真实推进。' });
    }
    const dialogueSegments = script.segments.filter((segment) => segment.type === 'dialogue');
    const narrationSegments = script.segments.filter((segment) => segment.type !== 'dialogue');
    if (state.current.castIds.length && !dialogueSegments.length) {
        findings.push({ severity: 'block', module: 'NarrativeDirector', title: '当前有 NPC 但没有角色直接发声', detail: state.current.castIds.join('/') });
    }
    if (narrationSegments.length / Math.max(1, script.segments.length) > 0.85) {
        findings.push({ severity: 'warn', module: 'NarrativeDirector', title: '旁白占比过高', detail: `${narrationSegments.length}/${script.segments.length}` });
    }
    for (const segment of narrationSegments) {
        const embeddedDialogue = findVisualNovelEmbeddedDialogue(segment.text, {
            cleanText: compactText,
            resolveSpeaker: resolveLiveSpeakerProfile,
        });
        if (embeddedDialogue) {
            findings.push({ severity: 'block', module: 'VN_SCRIPT', title: '旁白段疑似代替角色说话', detail: compactText(segment.text, 180) });
        }
    }
    for (const segment of dialogueSegments) {
        if (/世界意志|旁白|narrator|world_will/iu.test(segment.speakerId)) {
            findings.push({ severity: 'block', module: 'VN_SCRIPT', title: '世界意志被写成角色对白', detail: compactText(segment.text, 180) });
        }
        if (looksLikeDialogueSummaryText(segment)) {
            findings.push({ severity: 'block', module: 'VN_SCRIPT', title: 'dialogue.text 疑似动作/心理摘要', detail: compactText(`${segment.speakerId || 'unknown'}: ${segment.text}`, 220) });
        }
    }
    const firstTwo = script.segments.slice(0, 2).map((segment) => segment.text).join(' ');
    const actionTerms = unique([
        ...asArray(scenario.ackTerms),
        state.current.location,
        ...state.current.castIds,
        ...state.discoveredClues,
    ].join(' ').match(/[\u4e00-\u9fa5A-Za-z0-9]{2,}/gu) || [], 18)
        .filter((term) => !/原作行动|自由行动|倾向行动|成人日常|带回线索|玩家|当前|场景/u.test(term));
    const actionHits = actionTerms.filter((term) => firstTwo.includes(term) || fullText.includes(term));
    const actionAnchored = actionHits.length >= Math.min(2, actionTerms.length);
    if (!actionAnchored) {
        findings.push({ severity: 'block', module: 'NarrativeDirector', title: '剧情未显式承接玩家行动', detail: compactText(scenario.action, 180) });
    }
    const metaLeak = visibleText.match(/原作|RAG|剧本|路线锁定|玩家选择|系统提示|台本|游戏机制|模型/iu);
    if (metaLeak) {
        findings.push({ severity: 'block', module: 'NarrativeDirector', title: '可见正文出现元叙事污染', detail: metaLeak[0] });
    }
    const privateMechanicLeak = visibleText.match(/死亡回归|我死过|回到锚点|上一次循环|上一轮循环/iu);
    if (privateMechanicLeak) {
        findings.push({
            severity: 'block',
            module: 'SaveMemory',
            title: '可见正文泄漏死亡回归私有机制词',
            detail: privateMechanicLeak[0],
        });
    }
    if (scenario.mustMention && !regexAny(scenario.mustMention, fullText)) {
        findings.push({ severity: 'block', module: 'NarrativeDirector', title: '缺少场景核心因果/人物锚点', detail: scenario.mustMention.map(String).join(' / ') });
    }
    if (scenario.mustNotForce && regexAny(scenario.mustNotForce, fullText)) {
        findings.push({ severity: 'block', module: 'NarrativeDirector', title: '自由行动被硬拉回写死路线', detail: scenario.mustNotForce.map(String).join(' / ') });
    }
    if (scenario.forbidden && regexAny(scenario.forbidden, fullText)) {
        findings.push({ severity: 'block', module: 'NarrativeDirector', title: '出现禁止叙事模式', detail: scenario.forbidden.map(String).join(' / ') });
    }
    if (scenario.forbiddenDialogue) {
        const leaked = dialogueSegments.find((segment) => regexAny(scenario.forbiddenDialogue, segment.text));
        if (leaked) {
            findings.push({ severity: 'block', module: 'SaveMemory', title: '死亡回归私有记忆被角色对白公开', detail: compactText(leaked.text, 180) });
        }
    }
    if (script.choices.length < 3 || script.choices.length > 6) {
        findings.push({ severity: 'warn', module: 'CandidateActions', title: '候选行动数量不理想', detail: `choices=${script.choices.length}` });
    }
    const choiceText = script.choices.join(' ');
    const candidateSeedTerms = asArray(workset?.candidateSeeds)
        .flatMap((seed) => [
            seed?.label,
            seed?.text,
            ...(seed?.groundingTerms || []),
        ])
        .filter(Boolean);
    const factTerms = asArray(workset?.facts)
        .slice(0, 5)
        .flatMap((fact) => [fact?.title, fact?.summary, fact?.text])
        .filter(Boolean);
    const sceneTerms = unique([
        state.current.location,
        state.gameplay.activeObjective,
        ...state.current.castIds,
        ...state.discoveredClues,
        ...asArray(scenario.ackTerms),
        ...candidateSeedTerms,
        ...factTerms,
    ].join(' ').match(/[\u4e00-\u9fa5A-Za-z0-9]{2,}/gu) || [], 16);
    const choiceAnchored = script.choices.length && sceneTerms.some((term) => choiceText.includes(term));
    if (script.choices.length && sceneTerms.length && !choiceAnchored) {
        findings.push({ severity: 'warn', module: 'CandidateActions', title: '候选行动和当前场景关联弱', detail: compactText(choiceText, 220) });
    }
    const assetFindings = evaluateAssetUse(agentTurn.assetPlan || agentTurn.turnPlan?.assetPlan || {}, {
        parsedVnScript: script,
        renderedBackdropKey: script.backgroundKey,
        renderedCastIds: script.castIds,
    }).map((finding) => ({
        severity: finding.severity === 'info' ? 'warn' : finding.severity,
        module: 'AssetDirector',
        title: finding.title,
        detail: finding.detail,
    }));
    findings.push(...assetFindings);
    const deterministicValidation = validateRe0AgentTurn({
        state,
        playerAction: { rawText: scenario.action, source: 'live-director-audit', sceneLock: state.current.location },
        plan: agentTurn.turnPlan,
        assistantText: fullText,
        parsedVnScript: script,
        renderedBackdropKey: script.backgroundKey,
        renderedCastIds: script.castIds,
        statePatch: script.statePatch,
        candidates: script.choices,
    });
    for (const finding of deterministicValidation.findings || []) {
        if (actionAnchored && /玩家行动可能没有被显式承接/u.test(finding.title || '')) {
            continue;
        }
        if (choiceAnchored && /候选行动未贴合当前场景/u.test(finding.title || '')) {
            continue;
        }
        findings.push({
            severity: finding.severity === 'block' ? 'block' : 'warn',
            module: finding.module || 'Evaluator',
            title: finding.title || '确定性验收提示',
            detail: finding.detail || '',
        });
    }
    return findings;
}

async function auditScenario(apiKey, scenario) {
    const state = stateForScenario(scenario);
    const playerAction = {
        rawText: scenario.action,
        source: 'live-director-audit',
        sceneLock: scenario.location,
    };
    const workset = retrieveStoryRagWorkset(state, scenario.action);
    const agentTurn = buildRe0AgentTurn(state, playerAction, { storyRagWorkset: workset });
    const messages = buildDirectorMessages({ scenario, state, workset, agentTurn });
    const promptChars = JSON.stringify(messages).length;
    if (promptChars > 28_000) {
        throw new Error(`Live prompt for ${scenario.id} is too large: ${promptChars} chars.`);
    }
    const mimo = await callMimo(apiKey, messages, scenario.id);
    const runtimeText = sanitizeVisibleNarrativeMetaText(mimo.text);
    const extracted = extractVisualNovelScriptBlock(runtimeText);
    let script = normalizeScript(extracted.script);
    let repair = null;
    if (!script?.segments?.length) {
        repair = await repairVisualNovelScriptWithMimo(apiKey, {
            scenario,
            state,
            workset,
            agentTurn,
            originalText: runtimeText,
            sourceMode: extracted.sourceMode,
            warning: extracted.warning || '',
        });
        script = repair.script;
    }
    const parsed = {
        sourceMode: repair ? 'mimo-repair-json' : extracted.sourceMode,
        warning: extracted.warning || '',
        narrativeText: extracted.narrative || runtimeText,
        script,
    };
    const findings = validateLiveNarrative({ scenario, state, workset, agentTurn, mimo, parsed });
    const hasBlock = findings.some((finding) => finding.severity === 'block');
    const hasWarn = findings.some((finding) => finding.severity === 'warn');
    const status = hasBlock ? 'block' : hasWarn ? 'warn' : 'pass';
    return {
        scenario: {
            id: scenario.id,
            title: scenario.title,
            expectedMode: scenario.expectedMode,
        },
        status,
        live: true,
        model: mimo.model,
        elapsedMs: mimo.elapsedMs,
        repairUsed: Boolean(repair),
        repairElapsedMs: repair?.elapsedMs || 0,
        repairModel: repair?.model || '',
        usage: mimo.usage,
        promptChars,
        storyRag: {
            actionMode: workset?.architecture?.routing?.actionMode || workset?.directorSignals?.actionMode || '',
            layerNames: worksetLayerNames(workset),
            factCount: asArray(workset?.facts).length,
            riskCount: asArray(workset?.risks).length,
            hookCount: asArray(workset?.hooks).length,
            candidateSeedCount: asArray(workset?.candidateSeeds).length,
            summary: summarizeStoryRagWorkset(workset, 900),
        },
        agentTurn: {
            validationStatus: agentTurn.validation?.status || '',
            summary: summarizeRe0AgentTurn(agentTurn, 900),
        },
        assetPlan: {
            summary: summarizeAssetPlan(agentTurn.assetPlan || {}, 700),
            selectedBackdrop: agentTurn.assetPlan?.selectedBackdrop?.key || '',
        },
        parsed: {
            sourceMode: parsed.sourceMode,
            warning: parsed.warning,
            version: script?.version || '',
            backgroundKey: script?.backgroundKey || '',
            castIds: script?.castIds || [],
            segmentCount: script?.segments?.length || 0,
            dialogueCount: script?.segments?.filter((segment) => segment.type === 'dialogue').length || 0,
            choices: script?.choices || [],
            beat: script?.beat || null,
        },
        findings,
        outputSample: compactText(runtimeText, 1800),
        repairSample: repair ? compactText(repair.raw, 1200) : '',
    };
}

function writeReport(results) {
    fs.mkdirSync(QA_DIR, { recursive: true });
    const stamp = nowStamp();
    const jsonPath = path.join(QA_DIR, `RE0_LIVE_DIRECTOR_AUDIT_${stamp}.json`);
    const mdPath = path.join(QA_DIR, `RE0_LIVE_DIRECTOR_AUDIT_${stamp}.md`);
    const summary = {
        generatedAt: new Date().toISOString(),
        command: 'npm run re0:director:live-audit',
        model: DEFAULT_MODEL,
        liveMimoRequired: true,
        mockAllowed: false,
        status: results.every((result) => PASS_STATUSES.has(result.status)) ? 'pass'
            : results.some((result) => result.status === 'block') ? 'block'
                : 'warn',
        total: results.length,
        pass: results.filter((result) => result.status === 'pass').length,
        warn: results.filter((result) => result.status === 'warn').length,
        block: results.filter((result) => result.status === 'block').length,
        results,
    };
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
    const lines = [
        `# Re:0 Live Director Audit ${stamp}`,
        '',
        `- status: ${summary.status}`,
        `- model: ${DEFAULT_MODEL}`,
        '- live Mimo required: true',
        '- mock allowed: false',
        `- scenarios: ${summary.pass} pass / ${summary.warn} warn / ${summary.block} block / ${summary.total} total`,
        '',
        '## Scenario Results',
        '',
        ...results.flatMap((result) => [
            `### ${result.scenario.id}`,
            '',
            `- title: ${result.scenario.title}`,
            `- status: ${result.status}`,
            `- elapsedMs: ${result.elapsedMs}`,
            `- repair: ${result.repairUsed ? `yes (${result.repairElapsedMs}ms)` : 'no'}`,
            `- RAG mode: ${result.storyRag.actionMode}`,
            `- RAG counts: facts=${result.storyRag.factCount}, risks=${result.storyRag.riskCount}, hooks=${result.storyRag.hookCount}, seeds=${result.storyRag.candidateSeedCount}`,
            `- VN: source=${result.parsed.sourceMode}, version=${result.parsed.version}, background=${result.parsed.backgroundKey}, segments=${result.parsed.segmentCount}, dialogue=${result.parsed.dialogueCount}`,
            `- choices: ${result.parsed.choices.join(' / ') || 'none'}`,
            '',
            result.findings.length ? 'Findings:' : 'Findings: none',
            ...result.findings.map((finding) => `- [${finding.severity}] ${finding.module}: ${finding.title}${finding.detail ? ` - ${finding.detail}` : ''}`),
            '',
            'Output sample:',
            '',
            '```text',
            result.outputSample,
            '```',
            '',
        ]),
    ];
    fs.writeFileSync(mdPath, lines.join('\n'));
    return { summary, jsonPath, mdPath };
}

async function main() {
    const apiKey = assertLiveSecret();
    const scenarios = selectedScenarios();
    if (!scenarios.length) {
        throw new Error('No live director audit scenarios selected.');
    }
    const results = [];
    for (const scenario of scenarios) {
        process.stdout.write(`live-director-audit ${scenario.id} ... `);
        const result = await auditScenario(apiKey, scenario);
        results.push(result);
        process.stdout.write(`${result.status} (${result.elapsedMs}ms)\n`);
    }
    const { summary, jsonPath, mdPath } = writeReport(results);
    console.log(JSON.stringify({
        status: summary.status,
        model: summary.model,
        total: summary.total,
        pass: summary.pass,
        warn: summary.warn,
        block: summary.block,
        jsonPath,
        mdPath,
    }, null, 2));
    if (summary.status !== 'pass') {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error(JSON.stringify({
        status: 'block',
        error: error?.message || String(error),
        liveMimoRequired: true,
        mockAllowed: false,
    }, null, 2));
    process.exitCode = 1;
});
