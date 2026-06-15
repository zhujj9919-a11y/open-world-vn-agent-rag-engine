import { VISUAL_NOVEL_VISIBLE_CHOICE_LIMIT } from './vn-constants.js';

export const VISUAL_NOVEL_MODE_CLASS_NAMES = [
    're0-vn-story-daily',
    're0-vn-story-mainline',
    're0-vn-story-adult',
    're0-vn-story-answer',
];

export function normalizeVisualNovelStoryMode(mode = 'daily') {
    const source = String(mode || 'daily').toLowerCase();
    if (source === 'mainline') return 'mainline';
    if (source === 'adult') return 'adult';
    if (source === 'answer') return 'answer';
    return 'daily';
}

export function visualNovelModeLabel(mode = 'daily') {
    const normalized = normalizeVisualNovelStoryMode(mode);
    if (normalized === 'mainline') return '主线';
    if (normalized === 'adult') return '关系剧情';
    if (normalized === 'answer') return '答案之书';
    return '日常探索';
}

export function buildVisualNovelModeTemplate(mode = 'daily', {
    ifRouteLabel = 'Envy/Main',
    divergence = 0,
    answerPhase = '',
    objectiveTitle = '',
    objectiveStage = '',
    mainlineNotice = '',
} = {}) {
    const normalized = normalizeVisualNovelStoryMode(mode);
    const label = visualNovelModeLabel(normalized);
    const base = {
        mode: normalized,
        label,
        className: `re0-vn-story-${normalized}`,
        routeStatusText: `${label} · ${ifRouteLabel} · Δ ${divergence}`,
        objectiveTitle: objectiveTitle || '确认当前目标',
        objectiveSubtitle: objectiveStage || mainlineNotice || '自由探索中',
        pacingHint: 'balanced',
        choiceLimit: VISUAL_NOVEL_VISIBLE_CHOICE_LIMIT,
        castLimit: 4,
        backdropBiasKeywords: [],
        transitionCue: '继续当前场景。',
    };
    if (normalized === 'mainline') {
        return {
            ...base,
            objectiveTitle: objectiveTitle || '推进主线收束点',
            objectiveSubtitle: objectiveStage || mainlineNotice || '主线钟可推进；死亡、失败和关键选择会改变世界线。',
            pacingHint: 'high-pressure',
            choiceLimit: VISUAL_NOVEL_VISIBLE_CHOICE_LIMIT,
            castLimit: 4,
            backdropBiasKeywords: ['死亡', '魔女', '回归', '收束', '王选', '档案', '废钟', '宅邸', '司教'],
            transitionCue: '主线镜头：优先显影风险、代价、关键证据和即将收束的分支点。',
        };
    }
    if (normalized === 'adult') {
        return {
            ...base,
            objectiveTitle: objectiveTitle || '处理关系张力与情感线',
            objectiveSubtitle: objectiveStage || '主线钟暂停；角色主动表达真情、欲望、冲突与亲密推进，关系深度随互动演化。',
            pacingHint: 'intimate-emotional-direct',
            choiceLimit: VISUAL_NOVEL_VISIBLE_CHOICE_LIMIT,
            castLimit: 3,
            backdropBiasKeywords: ['日常', '旅店', '宅邸', '夜谈', '休息', '独处', '关系', '亲密', '卧室', '烛光', '雨夜窗', '事后', '拥抱'],
            transitionCue: '亲密镜头：角色自己发声袒露真心、欲望张力、身体情感亲近与心理冲突；允许大胆直接的真情实感表达、相互确认、激情流动与事后余韵；优先使用已注册成人情感背板（镜前更衣、誓约书房、治疗室余韵、假面阳台嫉妒、私密雨窗、宅邸夜床等）+ 完整G1立绘差分（Emilia rain_window_wait vulnerable private_indoor 脆弱真情暴露、Rem wounded_care aftercare_soft healer_wrap 事后温柔照料、Ram screen_shadow teasing silk_lounge 调情挑逗、Priscilla rival_table commanding imperial_formal 强势情感博弈、Crusch helmet_off resolved_desire military_formal 决心欲火、Anastasia rival_table jealous_smile formal 嫉妒微笑、Frederica service_tea relieved private_indoor 释然温柔、Julius glove_remove guarded_desire formal_unfastened 守卫欲念）强化角色主动的真情实感与表情张力；显影主动推进、嫉妒、牺牲、温柔与危险并存的大情感规模场景。',
        };
    }
    if (normalized === 'answer') {
        return {
            ...base,
            routeStatusText: `${label}${answerPhase ? ` · ${answerPhase}` : ''} · ${ifRouteLabel} · Δ ${divergence}`,
            objectiveTitle: objectiveTitle || '答案之书',
            objectiveSubtitle: objectiveStage || '解释失败原因、分支点和可追问的一条上帝视角问题。',
            pacingHint: 'analysis',
            choiceLimit: VISUAL_NOVEL_VISIBLE_CHOICE_LIMIT,
            castLimit: 2,
            backdropBiasKeywords: ['答案之书', '死亡', '回归', '魔女', '残响', '心脏', '梦境'],
            transitionCue: '解析镜头：收束到失败原因、分支点、已知线索和一个可追问问题。',
        };
    }
    return {
        ...base,
        objectiveTitle: objectiveTitle || '自由探索与关系经营',
        objectiveSubtitle: objectiveStage || mainlineNotice || '主线钟暂停；可调查、闲逛、经营关系或寻找主线入口。',
        pacingHint: 'relaxed-open-world',
        choiceLimit: VISUAL_NOVEL_VISIBLE_CHOICE_LIMIT,
        castLimit: 4,
        backdropBiasKeywords: ['日常', '街市', '市场', '旅店', '救济院', '闲逛', '套话', '委托'],
        transitionCue: '日常镜头：优先保留自由行动、关系经营、轻松段落和可寻找的主线入口。',
    };
}
