import {
    characterImageAliasMap,
    characterImageMap,
    generatedCharacterImageMap,
    generatedCharacterSpriteMap,
    generatedCharacterSpriteVariantMap,
    remoteCharacterImageMap,
    sourceNovelAssets,
    sourceNovelCharacterImageMap,
    sourceNovelSceneImageMap,
} from './visual-assets.js';
import {
    sceneBackdropByKey,
    sceneBackdropCatalog,
} from './vn-scene-registry.js';

const DEFAULT_CANDIDATE_LIMIT = 8;
const NON_CHARACTER_ASSET_IDS = new Set([
    'narrator',
    'narration',
    'world_will',
    'world-will',
    'system',
    'assistant',
    'unknown',
    'unknown_female',
    'unknown_male',
    'unknown_person',
    'unknown_character',
    '门外女声',
    '门外男声',
    '陌生女声',
    '陌生男声',
    '未知女声',
    '未知男声',
    '神秘女声',
    '神秘男声',
    '不明声源',
    'mystery_female',
    'mystery_male',
    'mystery_person',
    'unrevealed_female',
    'unrevealed_male',
    'unrevealed_person',
]);
const UNREVEALED_CHARACTER_LABEL_PATTERN = /^(?:未知|神秘|未揭示|不明|陌生|黑发|灰衣|蒙面|斗篷|门外|隔门|巷口).{0,8}(?:女性|女人|少女|男人|男子|人物|人|来客|旅人|访客|身影|轮廓|女声|男声|声音|声源)$|^(?:黑发女人|黑发少女|灰衣人|斗篷女人|陌生女人|神秘女人|神秘人物|未揭示人物|陌生女声|陌生男声|门外女声|门外男声|未知女声|未知男声)$/u;
const COMPATIBLE_BACKDROP_GROUPS = [
    ['loot_house', 'arc01_loot_house_interior'],
];

const CHARACTER_NAME_ALIASES = {
    '爱蜜莉雅': 'emilia',
    '艾米莉亚': 'emilia',
    'エミリア': 'emilia',
    '蕾姆': 'rem',
    '雷姆': 'rem',
    '拉姆': 'ram',
    '罗兹瓦尔': 'roswaal',
    '罗兹瓦尔·L·梅札斯': 'roswaal',
    '碧翠丝': 'beatrice',
    '贝蒂': 'beatrice',
    '莱因哈鲁特': 'reinhard',
    '莱因哈特': 'reinhard',
    '菲鲁特': 'felt',
    '菲尔特': 'felt',
    '金发少女': 'felt',
    '盗贼少女': 'felt',
    'Felt': 'felt',
    'rider': 'felt',
    'Rider': 'felt',
    '奥托': 'otto',
    '艾尔莎': 'elsa',
    '艾姬多娜': 'echidna',
    '怠惰': 'petelgeuse',
    '培提其乌斯': 'petelgeuse',
    '帕克': 'puck',
    '弗雷德莉卡': 'frederica',
    '佩特拉': 'petra',
    '帕特拉修': 'patrasche',
    '加菲尔': 'garfiel',
    '琉兹': 'ryuzu',
    '库珥修': 'crusch',
    '菲利克斯': 'ferris',
    '菲利丝': 'ferris',
    '威尔海姆': 'wilhelm',
    '安娜塔西亚': 'anastasia',
    '尤里乌斯': 'julius',
    '约书亚': 'joshua',
    '蜜蜜': 'mimi',
    '黑塔洛': 'hetaro',
    '提比': 'tivey',
    '里卡多': 'ricardo',
    '普莉希拉': 'priscilla',
    '阿尔': 'al',
    '莉莉安娜': 'liliana',
    '奇里塔卡': 'kiritaka',
    '海因克尔': 'heinkel',
    '雷古勒斯': 'regulus',
    '莱伊': 'ley',
    '罗伊': 'roy',
    '露伊': 'rui',
    '路易': 'rui',
    '卡佩拉': 'capella',
    '密涅瓦': 'minerva',
    '达芙妮': 'daphne',
    '提丰': 'typhon',
    '赛赫麦特': 'sekmet',
    '卡蜜拉': 'carmilla',
    '梅莉': 'meili',
    '夏乌拉': 'shaula',
    '雷德': 'reid',
    '莎缇拉': 'satella',
    '潘多拉': 'pandora',
    '福尔图娜': 'fortuna',
    '裘斯': 'geuse',
    '罗姆爷': 'rom',
    '罗姆': 'rom',
    '神龙': 'volcanica',
    '波尔卡尼卡': 'volcanica',
    '奇夏': 'chisha',
    '塞西尔斯': 'cecilus',
    '弗洛普': 'flop',
    '哈利贝尔': 'halibel',
    '梅蒂姆': 'medium',
    '文森特': 'vincent',
    '约尔娜': 'yorna',
    '莉榭尔': 'lishelle',
    '莉榭尔·阿尔戈': 'lishelle',
    '莉雪': 'lishelle',
    '莉雪尔': 'lishelle',
    '莉雪·阿尔戈': 'lishelle',
    '米娅': 'mia',
    '欧文': 'owen',
    '王都卫兵': 'capital_guard',
    '卫兵': 'capital_guard',
    '年轻骑士': 'capital_guard',
    '巡逻卫兵': 'capital_guard',
    '守卫': 'capital_guard',
    '剥钟人': 'bellringer',
    '敲钟人': 'bellringer',
    '昴': 'protagonist',
    '菜月昴': 'protagonist',
    'スバル': 'protagonist',
    'ナツキ・スバル': 'protagonist',
    'Subaru': 'protagonist',
    'Natsuki Subaru': 'protagonist',
    'subaru': 'protagonist',
    'natsuki_subaru': 'protagonist',
    '主角': 'protagonist',
    '玩家': 'protagonist',
    '世界意志': 'world_will',
    '旁白': 'narrator',
};

const BACKDROP_SEMANTIC_RULES = [
    { key: 'loot_house', score: 34, reason: '盗品蔵/徽章交易语义', pattern: /盗品蔵|赃物|罗姆爷|菲鲁特|徽章|艾尔莎|仓库|地下交易/u },
    { key: 'relief_house', score: 30, reason: '救济院/莉榭尔/米娅语义', pattern: /救济院|修女院|莉榭尔|莉雪|米娅|汤碗|病床|黑伞|死亡残响/u },
    { key: 'arc01_bell_tower_interior', score: 38, reason: '废弃钟楼地下甬道语义', pattern: /(废弃钟楼|废钟楼|钟楼|废钟|钟声).{0,18}(地下甬道|甬道|地底|空腔|墙后|提灯)|(?:地下甬道|甬道|地底|空腔|墙后|提灯).{0,18}(废弃钟楼|废钟楼|钟楼|废钟|钟声)/u },
    { key: 'arc01_slum_alley_night', score: 34, reason: 'Arc1 贫民区雨夜语义', pattern: /贫民区|王都贫民区|雨夜|雨声|湿冷|血水|黑伞|废钟|钟声/u },
    { key: 'rain_bell', score: 24, reason: '王都底层雨夜/废钟语义', pattern: /贫民区|雨夜|废钟|钟楼|莉榭尔|米娅|血水|黑伞|后巷/u },
    { key: 'market_day', score: 28, reason: '王都市场/街市语义', pattern: /主街|街市|市场|摊贩|叫卖|卫兵|巡逻|日常买卖/u },
    { key: 'royal_capital', score: 22, reason: '王都公开区域语义', pattern: /王都|露格尼卡|王选|广场|骑士团公开区域/u },
    { key: 'capital_gate', score: 32, reason: '城门关口语义', pattern: /城门|入城|出城|关口|盘查|通行证|闸门|马车队/u },
    { key: 'capital_sewer', score: 32, reason: '地下水渠语义', pattern: /下水道|地下水渠|暗渠|铁栅|潜入|逃亡路线/u },
    { key: 'capital_rooftops', score: 32, reason: '屋顶线语义', pattern: /屋顶|屋脊|房顶|瓦片|追逐|夜间潜行|窥探/u },
    { key: 'archive', score: 48, reason: '档案/图书馆/旧案调查语义', pattern: /档案|旧档案室|欧文|骑士团旧案|封蜡|缺页|图书馆|禁书|寄存簿|目录/u },
    { key: 'healer_clinic', score: 30, reason: '诊疗/药铺语义', pattern: /药铺|诊疗室|医师|治疗|草药|绷带|急救/u },
    { key: 'tavern_common_room', score: 28, reason: '酒馆/旅店公共厅语义', pattern: /酒馆|旅店室内|公共厅|壁炉|公告板|夜谈/u },
    { key: 'noble_salon', score: 30, reason: '贵族交涉/沙龙语义', pattern: /贵族|沙龙|会客|礼法|阵营交涉|王选阵营/u },
    { key: 'guard_interrogation', score: 30, reason: '骑士团审问语义', pattern: /骑士团|审问|盘问|审讯|旧案房|证据箱/u },
    { key: 'roadside_inn', score: 26, reason: '郊外旅店语义', pattern: /郊外旅店|路边旅店|旅途休整|马厩|雨夜投宿/u },
    { key: 'forest_road_checkpoint', score: 28, reason: '商路/森林检查点语义', pattern: /商路|森林路|检查点|护送|追踪|木栅|路障/u },
    { key: 'mansion_kitchen', score: 34, reason: '宅邸厨房语义', pattern: /宅邸厨房|厨房|石灶|铜锅|备餐|女仆工作|饭菜/u },
    { key: 'mansion_courtyard', score: 32, reason: '宅邸庭院语义', pattern: /宅邸庭院|庭院|花园|喷泉|石径|散步/u },
    { key: 'mansion_guest_room', score: 32, reason: '宅邸客房语义', pattern: /宅邸客房|客房|卧室|帷幔|油灯|疗伤房间|留宿/u },
    { key: 'mansion_study', score: 32, reason: '宅邸书房语义', pattern: /宅邸书房|书房|密信|地图|壁炉|暗门|研究室/u },
    { key: 'mansion_bath', score: 32, reason: '宅邸浴场语义', pattern: /宅邸浴场|浴场|浴室|温泉|热水池|蒸汽|屏风/u },
    { key: 'mansion_exterior', score: 30, reason: '宅邸外景语义', pattern: /宅邸外景|宅邸门口|尖塔|长坡|抵达宅邸/u },
    { key: 'mansion', score: 24, reason: '罗兹瓦尔宅邸阵营语义', pattern: /宅邸|罗兹瓦尔|禁书库|碧翠丝|帕克|蕾姆|拉姆/u },
    { key: 'sanctuary', score: 32, reason: '圣域/墓所语义', pattern: /圣域|墓所|试炼|加菲尔|艾姬多娜/u },
    { key: 'priestella_sluice_control', score: 32, reason: '普利斯提拉水闸控制语义', pattern: /水门都市|普利斯提拉|水闸|控制室|阀门|机关|水轮/u },
    { key: 'priestella_inn_room', score: 28, reason: '普利斯提拉旅馆语义', pattern: /水门都市|普利斯提拉|运河|水城|旅馆|套房/u },
    { key: 'imperial_command_tent', score: 30, reason: '帝国军帐语义', pattern: /帝国|佛拉基亚|军帐|军营|指挥帐/u },
    { key: 'kararagi_caravanserai', score: 30, reason: '卡拉拉基商路语义', pattern: /卡拉拉基|商队|驿站|香料|跨国贸易/u },
    { key: 'gusteko_village_house', score: 30, reason: '古斯提科雪村语义', pattern: /古斯提科|雪村|炉火|结霜窗/u },
    { key: 'snowfield', score: 28, reason: '雪原/古斯提科户外语义', pattern: /雪原|吹雪|冰原|修道院|古斯提科/u },
    { key: 'augria_sand_dunes', score: 30, reason: '奥古利亚沙丘语义', pattern: /沙丘|奥古利亚|监视塔|沙海/u },
    { key: 'great_waterfall_edge_storm', score: 32, reason: '大瀑布高危暴风语义', pattern: /大瀑布|世界边缘|断崖|暴风|黑雾|死亡边界/u },
    { key: 'great_waterfall_edge_safe', score: 28, reason: '大瀑布安全路线语义', pattern: /大瀑布|世界边缘|断崖|护绳|边境/u },
    { key: 'wilderness_camp', score: 28, reason: '野外营地语义', pattern: /营地|篝火|露营|睡袋|夜营|旅途夜谈/u },
    { key: 'witch_cult_hideout', score: 32, reason: '魔女教调查语义', pattern: /魔女教|邪教|福音书|狂信|剥钟人|地下礼拜/u },
    { key: 'answer_book', score: 36, reason: '答案之书/死因解析语义', pattern: /答案之书|死因|死亡解析|上帝视角|死后问答/u },
    { key: 'witch_interference', score: 34, reason: '魔女干涉/禁言语义', pattern: /魔女干涉|不能说|心脏压迫|嫉妒魔女|禁言/u },
    { key: 'witch_dream', score: 30, reason: '死亡回归/魔女梦境语义', pattern: /死亡回归|心脏|魔女气味|锚点|黑影|银线/u },
];

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

function backdropKeysCompatible(expected = '', actual = '') {
    if (!expected || !actual || expected === actual) {
        return true;
    }
    return COMPATIBLE_BACKDROP_GROUPS.some((group) => group.includes(expected) && group.includes(actual));
}

function hasUsableImage(backdrop = {}) {
    return Boolean(backdrop.imageUrl || backdrop.file || backdrop.key);
}

function sceneFileName(backdrop = {}) {
    const source = String(backdrop.imageUrl || backdrop.file || `${backdrop.key || 'scene'}.png`).split(/[?#]/u)[0];
    return decodeURIComponent(source.split('/').pop() || `${backdrop.key || 'scene'}.png`);
}

function sourceNovelSceneFamilyForText(text = '') {
    const source = String(text || '');
    if (/圣域|墓所|试炼|加菲尔|艾姬多娜|sanctuary/u.test(source)) {
        return 'sanctuary';
    }
    if (/宅邸|罗兹瓦尔|禁书库|碧翠丝|蕾姆|拉姆|mansion/u.test(source)) {
        return 'mansion';
    }
    if (/水门都市|普利斯提拉|普里斯提拉|运河|司教|priestella/u.test(source)) {
        return 'priestella';
    }
    if (/监视塔|普雷阿迪斯|沙丘|死者之书|夏乌拉|watchtower/u.test(source)) {
        return 'watchtower';
    }
    if (/佛拉基亚|帝国|文森特|托德|修德拉克|vollachia/u.test(source)) {
        return 'vollachia';
    }
    if (/王都|赃物|贫民区|徽章|市场|骑士团|王选|royal_capital|loot_house|market_day|rain_bell|capital/u.test(source)) {
        return 'royal_capital';
    }
    return '';
}

function sourceNovelReferenceCandidate(asset = {}, score = 0, reason = '') {
    return {
        id: asset.id || '',
        kind: asset.characterId ? 'character_reference' : 'scene_reference',
        category: asset.category || '',
        imageUrl: asset.url || '',
        sourceRelativePath: asset.sourceRelativePath || '',
        characterId: asset.characterId || '',
        sceneKey: asset.sceneKey || '',
        bytes: Number(asset.bytes || 0),
        score: Number(score.toFixed(3)),
        reason,
        usage: 'reference_only',
    };
}

function buildSourceNovelReferencePlan(state = {}, backdropPlan = {}, castPlan = {}, source = '', limit = 8) {
    const selected = backdropPlan?.selectedBackdrop || {};
    const sceneFamily = sourceNovelSceneFamilyForText([
        selected.key,
        selected.title,
        state?.current?.location,
        state?.gameplay?.activeObjective,
        state?.gameplay?.lastPlayerAction,
        source,
    ].filter(Boolean).join(' '));
    const castIds = new Set((castPlan?.castAssets || []).map((item) => item.id).filter(Boolean));
    const candidates = [];
    for (const asset of asArray(sourceNovelAssets)) {
        if (!asset?.url || Number(asset.bytes || 0) < 12_000) {
            continue;
        }
        if (asset.characterId && castIds.has(asset.characterId)) {
            candidates.push(sourceNovelReferenceCandidate(asset, 90, '当前出场角色的原文角色图参考'));
            continue;
        }
        if (asset.sceneKey && sceneFamily && asset.sceneKey === sceneFamily) {
            const exactSceneScore = source.includes(asset.sceneKey) || selected.key === asset.sceneKey ? 82 : 70;
            candidates.push(sourceNovelReferenceCandidate(asset, exactSceneScore, '当前地点/篇章的原文插图参考'));
        }
    }
    for (const id of castIds) {
        const imageUrl = sourceNovelCharacterImageMap[id];
        if (imageUrl && !candidates.some((item) => item.imageUrl === imageUrl)) {
            candidates.push({
                id: `source_novel.character.${id}`,
                kind: 'character_reference',
                category: 'characters',
                imageUrl,
                sourceRelativePath: '',
                characterId: id,
                sceneKey: '',
                bytes: 0,
                score: 76,
                reason: '角色原文图兜底参考',
                usage: 'reference_only',
            });
        }
    }
    const sceneImageUrl = sceneFamily ? sourceNovelSceneImageMap[sceneFamily] : '';
    if (sceneImageUrl && !candidates.some((item) => item.imageUrl === sceneImageUrl)) {
        candidates.push({
            id: `source_novel.scene.${sceneFamily}`,
            kind: 'scene_reference',
            category: 'illustrations',
            imageUrl: sceneImageUrl,
            sourceRelativePath: '',
            characterId: '',
            sceneKey: sceneFamily,
            bytes: 0,
            score: 68,
            reason: '篇章场景原文图兜底参考',
            usage: 'reference_only',
        });
    }
    const ranked = candidates
        .sort((a, b) => b.score - a.score || b.bytes - a.bytes || a.id.localeCompare(b.id))
        .slice(0, Math.max(1, limit));
    return {
        sceneFamily,
        references: ranked,
        policy: 'source-novel images are style/CG/reference candidates; generated/user VN stage art remains preferred for live backdrops and sprites.',
    };
}

function assetSearchText(state = {}, playerAction = {}, storyRagWorkset = {}) {
    const visualNovel = state?.visuals?.visualNovel || {};
    const setup = state?.settingLayers?.setupCanon || state?.setup || {};
    const segment = visualNovel.currentSegment || visualNovel.segments?.[visualNovel.currentIndex || 0] || {};
    if (playerAction?.stageTextOnly) {
        return [
            playerAction?.rawText,
            playerAction?.text,
            segment?.text,
            segment?.action,
            segment?.tone,
            segment?.pose,
            segment?.expression,
            segment?.camera,
            segment?.focus,
            segment?.sfx,
            segment?.speaker,
            segment?.speakerName,
            state?.current?.location,
            state?.current?.time,
            setup.birthplace,
            setup.initialScenario,
            setup.origin,
        ].filter(Boolean).join(' ');
    }
    const facts = asArray(storyRagWorkset?.facts).slice(0, 6).map((fact) => [
        fact?.title,
        fact?.summary,
        fact?.text,
    ].filter(Boolean).join(' '));
    return [
        state?.mode,
        state?.current?.location,
        state?.current?.time,
        state?.gameplay?.activeObjective,
        state?.gameplay?.objectiveStage,
        state?.gameplay?.lastPlayerAction,
        state?.gameplay?.lastOutcome,
        playerAction?.rawText,
        playerAction?.text,
        visualNovel.backgroundKey,
        visualNovel.currentSpeakerName,
        segment?.text,
        segment?.action,
        segment?.tone,
        segment?.pose,
        segment?.expression,
        segment?.camera,
        segment?.focus,
        segment?.sfx,
        segment?.speaker,
        setup.birthplace,
        setup.initialScenario,
        setup.origin,
        ...(state?.gameplay?.openQuestions || []),
        ...(state?.discoveredClues || []),
        ...facts,
    ].filter(Boolean).join(' ');
}

function scoreKeywordText(backdrop = {}, source = '') {
    const keywordScore = (backdrop.keywords || []).reduce((total, keyword) => {
        const word = String(keyword || '').trim();
        if (!word || !source.includes(word)) {
            return total;
        }
        return total + Math.max(2, Math.min(10, Math.ceil(word.length / 2)));
    }, 0);
    const titleScore = backdrop.title && source.includes(backdrop.title) ? 12 : 0;
    const keyScore = backdrop.key && source.includes(backdrop.key) ? 8 : 0;
    const summaryScore = String(backdrop.summary || '').split(/[、，,/\s]+/u)
        .filter((word) => word.length >= 2 && source.includes(word))
        .slice(0, 4).length * 2;
    return keywordScore + titleScore + keyScore + summaryScore;
}

function semanticBoostsForBackdrop(backdrop = {}, source = '') {
    return BACKDROP_SEMANTIC_RULES
        .filter((rule) => rule.key === backdrop.key && rule.pattern.test(source))
        .map((rule) => ({
            score: rule.score,
            reason: rule.reason,
        }));
}

function conflictPenalty(backdrop = {}, source = '') {
    const key = String(backdrop.key || '');
    const rainyDeathAnchor = /雨夜|雨水|雨声|黑伞|湿冷|石板|死亡回归|返回锚点|幻痛|钟声|废钟/u.test(source);
    const indoorPrivate = /室内|房间|卧室|客房|浴场|书房|酒馆楼上|帐篷|马车|厨房|档案室|图书馆/u.test(source);
    if (rainyDeathAnchor && /market_day|royal_capital/u.test(key)) {
        return -55;
    }
    if (/深夜|夜晚|雨夜|黑暗|潜行/u.test(source) && /market_day/u.test(key)) {
        return -35;
    }
    if (/白天|上午|早晨|日间|阳光|街市|市场|摊贩/u.test(source) && /rain_bell|death_anchor|witch_dream/u.test(key) && !rainyDeathAnchor) {
        return -18;
    }
    if (indoorPrivate && /market_day|royal_capital|capital_gate/u.test(key)) {
        return -24;
    }
    return 0;
}

function timeScore(backdrop = {}, source = '') {
    const key = String(backdrop.key || '');
    if (/夜|夜晚|深夜|雨夜|黄昏|暮色|dusk|night/i.test(source) && /night|dusk|rain|candle|witch|adult|rooftops|camp|inn/u.test(key)) {
        return 5;
    }
    if (/白天|上午|早晨|日间|day|morning/i.test(source) && /day|morning|market|gate|exterior/u.test(key)) {
        return 5;
    }
    return 0;
}

function scoreSceneBackdrop(backdrop = {}, source = '', index = 0, state = {}) {
    const baseScore = scoreKeywordText(backdrop, source);
    const boosts = semanticBoostsForBackdrop(backdrop, source);
    const semanticScore = boosts.reduce((total, boost) => total + boost.score, 0);
    const explicitVnKey = state?.visuals?.visualNovel?.backgroundKey || '';
    const currentSceneKey = state?.visuals?.sceneBackdrop?.currentKey || '';
    const currentKey = explicitVnKey || currentSceneKey;
    const currentScore = currentKey && currentKey === backdrop.key && baseScore + semanticScore > 0
        ? (explicitVnKey === backdrop.key ? 34 : 12)
        : 0;
    const penalty = conflictPenalty(backdrop, source);
    const clockScore = timeScore(backdrop, source);
    const score = Math.max(0, baseScore + semanticScore + currentScore + clockScore + penalty + (index / 10000));
    return {
        score,
        baseScore,
        semanticScore,
        currentScore,
        timeScore: clockScore,
        conflictPenalty: penalty,
        reasons: [
            ...boosts.map((boost) => boost.reason),
            currentScore ? '当前舞台背景可延续' : '',
            clockScore ? '时间/天气吻合' : '',
            penalty ? '自然语言场景冲突惩罚' : '',
        ].filter(Boolean),
    };
}

function backdropCandidate(backdrop = {}, scored = {}) {
    return {
        key: backdrop.key || '',
        title: backdrop.title || backdrop.key || '',
        imageUrl: backdrop.imageUrl || backdrop.file || '',
        file: sceneFileName(backdrop),
        score: Number((scored.score || 0).toFixed(3)),
        baseScore: Number((scored.baseScore || 0).toFixed(3)),
        semanticScore: Number((scored.semanticScore || 0).toFixed(3)),
        conflictPenalty: Number((scored.conflictPenalty || 0).toFixed(3)),
        reasons: scored.reasons || [],
        summary: compactText(backdrop.summary || backdrop.prompt || '', 120),
        hasImage: hasUsableImage(backdrop),
    };
}

function fallbackBackdrop(state = {}) {
    const explicitKey = state?.visuals?.visualNovel?.backgroundKey || state?.visuals?.sceneBackdrop?.currentKey || '';
    return sceneBackdropByKey[explicitKey] || sceneBackdropByKey.rain_bell || sceneBackdropCatalog[0] || {};
}

function preferredBackdropKeyForLocationText(text = '') {
    const source = String(text || '');
    if (/盗品蔵|赃物库|赃物庫|徽章交易|罗姆爷.*菲鲁特|菲鲁特.*罗姆爷/u.test(source)) {
        return sceneBackdropByKey.loot_house ? 'loot_house' : '';
    }
    if (/圣域墓所外|墓所外|圣域入口|结界分歧|结界.*墓所|加菲尔.*结界/u.test(source)) {
        return sceneBackdropByKey.arc04_sanctuary_entrance ? 'arc04_sanctuary_entrance' : 'sanctuary';
    }
    if (/圣域墓所内|墓所内|墓所.*试炼|试炼空间|艾姬多娜.*梦/u.test(source)) {
        return sceneBackdropByKey.arc04_tomb_inside ? 'arc04_tomb_inside' : 'sanctuary';
    }
    if (/废弃钟楼地下|地下甬道|钟楼地下|废钟.*甬道|空心石砖|墙后空腔|墙壁后面/u.test(source)) {
        return sceneBackdropByKey.arc01_bell_tower_interior ? 'arc01_bell_tower_interior' : '';
    }
    if (/王都贫民区雨夜|贫民区雨夜|王都贫民区|贫民区|废弃钟楼外|废钟楼外|废钟|黑伞|血水|雨夜.*贫民区/u.test(source)) {
        return sceneBackdropByKey.arc01_slum_alley_night ? 'arc01_slum_alley_night' : 'rain_bell';
    }
    if (/王都主街初召唤|主街|徽章失窃|街市|市场/u.test(source)) {
        return sceneBackdropByKey.arc01_capital_inner_street ? 'arc01_capital_inner_street' : 'market_day';
    }
    return '';
}

function currentBackdropCandidate(state = {}, source = '') {
    const backdrop = fallbackBackdrop(state);
    if (!backdrop?.key) {
        return null;
    }
    return backdropCandidate(backdrop, {
        ...scoreSceneBackdrop(backdrop, source, 0, state),
        reasons: ['当前舞台背景必须进入素材候选', ...(scoreSceneBackdrop(backdrop, source, 0, state).reasons || [])],
    });
}

function includeCurrentBackdropCandidate(candidates = [], state = {}, source = '', limit = DEFAULT_CANDIDATE_LIMIT) {
    const current = currentBackdropCandidate(state, source);
    if (!current?.key) {
        return candidates.slice(0, Math.max(1, limit));
    }
    const withoutCurrent = candidates.filter((item) => item?.key !== current.key);
    return [current, ...withoutCurrent].slice(0, Math.max(1, limit));
}

function includeRequiredBackdropCandidate(candidates = [], requiredKey = '', state = {}, source = '', limit = DEFAULT_CANDIDATE_LIMIT) {
    const key = String(requiredKey || '').trim();
    if (!key || !sceneBackdropByKey[key]) {
        return candidates.slice(0, Math.max(1, limit));
    }
    const scored = scoreSceneBackdrop(sceneBackdropByKey[key], source, 0, state);
    const required = backdropCandidate(sceneBackdropByKey[key], {
        ...scored,
        reasons: ['当前 VN_SCRIPT 背景必须进入素材候选', ...(scored.reasons || [])],
    });
    const withoutRequired = candidates.filter((item) => item?.key !== key);
    return [required, ...withoutRequired].slice(0, Math.max(1, limit));
}

function preferredLocationBackdropCandidate(state = {}, source = '', {
    includeSource = false,
} = {}) {
    const key = preferredBackdropKeyForLocationText([
        state?.flags?.playerIntentSceneLockLocation,
        state?.current?.location,
        state?.setup?.birthplace,
        includeSource ? source : '',
    ].filter(Boolean).join(' '));
    if (!key || !sceneBackdropByKey[key]) {
        return null;
    }
    const scored = scoreSceneBackdrop(sceneBackdropByKey[key], source, 0, state);
    return backdropCandidate(sceneBackdropByKey[key], {
        ...scored,
        score: Math.max(Number(scored.score || 0), 42),
        reasons: ['当前地点硬匹配', ...(scored.reasons || [])],
    });
}

function buildBackdropPlan(state = {}, playerAction = {}, storyRagWorkset = {}, limit = DEFAULT_CANDIDATE_LIMIT, {
    requiredBackdropKey = '',
} = {}) {
    const source = assetSearchText(state, playerAction, storyRagWorkset);
    const adultVisualsAllowed = state?.adultContent?.enabled === true || state?.narrativeMode?.current === 'adult';
    const scored = sceneBackdropCatalog
        .filter((backdrop) => backdrop?.key && (adultVisualsAllowed || backdrop.source !== 'grokadult'))
        .map((backdrop, index) => ({
            backdrop,
            index,
            scored: scoreSceneBackdrop(backdrop, source, index, state),
        }))
        .sort((a, b) => b.scored.score - a.scored.score || b.scored.baseScore - a.scored.baseScore || a.index - b.index);
    const candidates = scored
        .filter((item, index) => item.scored.score > 0 || index < 3)
        .slice(0, Math.max(1, limit))
        .map((item) => backdropCandidate(item.backdrop, item.scored));
    const preferredLocation = preferredLocationBackdropCandidate(state, source, {
        includeSource: playerAction?.stageTextOnly === true,
    });
    const candidateBackdrops = includeRequiredBackdropCandidate(
        includeRequiredBackdropCandidate(
            includeCurrentBackdropCandidate(candidates, state, source, limit),
            preferredLocation?.key || '',
            state,
            source,
            limit,
        ),
        requiredBackdropKey,
        state,
        source,
        limit,
    );
    const rawBest = scored[0]?.scored || {};
    const meaningfulBest = Number(rawBest.baseScore || 0) + Number(rawBest.semanticScore || 0) + Number(rawBest.currentScore || 0) > 0;
    const best = preferredLocation || (candidates[0]?.score > 0 && meaningfulBest
        ? candidates[0]
        : backdropCandidate(fallbackBackdrop(state), { score: 0, reasons: ['素材匹配低置信，使用当前/默认背景'] }));
    return {
        selectedBackdrop: {
            ...best,
            confidence: best.score >= 30 ? 'high' : best.score >= 12 ? 'medium' : best.score > 0 ? 'low' : 'fallback',
        },
        candidateBackdrops,
        searchText: compactText(source, 420),
        adultVisualsAllowed,
    };
}

export function normalizeAssetCharacterId(value = '') {
    const raw = String(value || '').trim();
    if (!raw) {
        return '';
    }
    const lowered = raw.toLowerCase().replace(/\s+/g, '_');
    if (NON_CHARACTER_ASSET_IDS.has(lowered) || UNREVEALED_CHARACTER_LABEL_PATTERN.test(raw)) {
        return '';
    }
    const alias = characterImageAliasMap[lowered] || characterImageAliasMap[raw] || CHARACTER_NAME_ALIASES[raw] || '';
    const direct = alias || lowered;
    if (NON_CHARACTER_ASSET_IDS.has(direct)) {
        return '';
    }
    if (
        generatedCharacterSpriteMap[direct]
        || generatedCharacterImageMap[direct]
        || characterImageMap[direct]
        || remoteCharacterImageMap[direct]
        || sourceNovelCharacterImageMap[direct]
    ) {
        return direct;
    }
    for (const [label, id] of Object.entries(CHARACTER_NAME_ALIASES)) {
        if (raw.includes(label)) {
            return NON_CHARACTER_ASSET_IDS.has(id) ? '' : id;
        }
    }
    return '';
}

function isNonCharacterAssetName(value = '') {
    const raw = String(value || '').trim();
    const normalized = raw.toLowerCase().replace(/\s+/g, '_');
    return !normalized || NON_CHARACTER_ASSET_IDS.has(normalized) || UNREVEALED_CHARACTER_LABEL_PATTERN.test(raw);
}

function activeCastNames(state = {}) {
    const visualNovel = state?.visuals?.visualNovel || {};
    const segment = visualNovel.currentSegment || visualNovel.segments?.[visualNovel.currentIndex || 0] || {};
    return unique([
        ...(state?.current?.castIds || []),
        ...(visualNovel.sceneCharacters || []),
        ...(visualNovel.castIds || []),
        segment?.speakerId,
        segment?.speaker,
        visualNovel.currentSpeakerName,
        ...(state?.presence?.sceneCharacters || []),
    ], 10).filter((name) => !isNonCharacterAssetName(name));
}

function anticipatedCastNames(state = {}, playerAction = {}, storyRagWorkset = {}, source = '') {
    const current = activeCastNames(state);
    const ragText = [
        source,
        playerAction?.rawText,
        playerAction?.text,
        ...(storyRagWorkset?.facts || []).slice(0, 8).map((item) => item?.text || item?.summary || item?.title || ''),
        ...(storyRagWorkset?.risks || []).slice(0, 4).map((item) => item?.description || item?.text || ''),
        ...(storyRagWorkset?.hooks || []).slice(0, 4).map((item) => item?.text || item?.promise || ''),
        ...(storyRagWorkset?.candidateSeeds || []).slice(0, 6).map((item) => item?.text || item?.label || ''),
    ].filter(Boolean).join(' ');
    const anticipatedIds = [];
    for (const [label, id] of Object.entries(CHARACTER_NAME_ALIASES)) {
        if (NON_CHARACTER_ASSET_IDS.has(id) || String(label).length < 2) {
            continue;
        }
        if (ragText.includes(label)) {
            anticipatedIds.push(id);
        }
    }
    return unique([...current, ...anticipatedIds], 10).filter((name) => !isNonCharacterAssetName(name));
}

function characterDisplayName(inputName = '', id = '', state = {}) {
    const card = state?.characterCards?.[inputName] || state?.characterCards?.[id] || {};
    return card.name || inputName || id;
}

function selectedVariant(id = '', source = '', allowAdult = false) {
    const variants = generatedCharacterSpriteVariantMap[id] || {};
    const entries = Object.entries(variants);
    if (!entries.length) {
        return null;
    }
    const wantsAdult = allowAdult && /成人|私密|暧昧|独处|告白|亲密|合意|照料|余温|浴|夜袍|欲言又止/u.test(source);
    const signals = [
        [/雨|雨窗|窗边|湿冷|夜/u, ['rain_window_wait', 'nun_rain']],
        [/照料|包扎|治疗|伤|血|疼|披肩/u, ['wounded_care', 'aftercare_soft', 'healer_wrap', 'aftercare_shawl']],
        [/茶|端茶|厨房|餐/u, ['tea_offer']],
        [/审问|盘问|警戒|冷声|卫兵/u, ['interrogate', 'cold', 'guard_coat']],
        [/宣誓|誓约|骑士|跪/u, ['kneel_oath', 'oathful']],
        [/门口|邀请|靠近/u, ['doorway_invitation', 'hand_reach']],
        [/脸红|羞|慌|欲言又止/u, ['turn_blush', 'flustered', 'longing']],
        [/危险|命令|高傲|冷笑|威压/u, ['stage_command', 'commanding', 'dangerous_smile', 'cold_laugh']],
        [/读书|笔记|研究|图书馆|档案/u, ['studious']],
        [/疯狂|狂信|福音书|怠惰/u, ['mad_grin', 'fanatic', 'archbishop_robes']],
    ].flatMap(([pattern, tokens]) => (pattern.test(source) ? tokens : []));
    const scored = entries
        .filter(([variantKey]) => wantsAdult || !variantKey.startsWith('adult.'))
        .map(([variantKey, imageUrl], index) => {
            const normalized = variantKey.toLowerCase();
            const adultScore = variantKey.startsWith('adult.') ? (wantsAdult ? 90 : -200) : 40;
            const signalScore = signals.reduce((total, token) => normalized.includes(String(token).toLowerCase()) ? total + 18 : total, 0);
            const baseScore = /base\.idle|neutral|soft_smile/u.test(variantKey) ? 8 : 0;
            return {
                variantKey,
                imageUrl,
                score: adultScore + signalScore + baseScore - (index / 1000),
            };
        })
        .sort((a, b) => b.score - a.score);
    const preferred = scored[0] ? [scored[0].variantKey, scored[0].imageUrl] : null;
    if (!preferred) {
        return null;
    }
    return {
        variantKey: preferred[0],
        imageUrl: preferred[1],
        adult: preferred[0].startsWith('adult.'),
        score: scored[0]?.score || 0,
    };
}

function buildCharacterAsset(inputName = '', state = {}, source = '', allowAdult = false) {
    const id = normalizeAssetCharacterId(inputName);
    if (!id) {
        return {
            inputName,
            id: '',
            displayName: characterDisplayName(inputName, '', state),
            missing: true,
            reason: '当前角色没有可识别素材 ID。',
        };
    }
    const variant = selectedVariant(id, source, allowAdult);
    if (variant) {
        return {
            inputName,
            id,
            displayName: characterDisplayName(inputName, id, state),
            mode: 'sprite_variant',
            imageUrl: variant.imageUrl,
            variantKey: variant.variantKey,
            matchScore: variant.adult ? 88 : 82,
            matchReason: variant.adult ? '成人/私密语义允许后选择成人变体。' : '选择基础立绘变体，避免成人素材误触。',
            adult: variant.adult,
        };
    }
    const imageUrl = generatedCharacterSpriteMap[id]
        || generatedCharacterImageMap[id]
        || characterImageMap[id]
        || sourceNovelCharacterImageMap[id]
        || remoteCharacterImageMap[id]
        || '';
    if (!imageUrl) {
        return {
            inputName,
            id,
            displayName: characterDisplayName(inputName, id, state),
            missing: true,
            reason: '角色 ID 已识别，但素材映射中没有可用立绘。',
        };
    }
    return {
        inputName,
        id,
        displayName: characterDisplayName(inputName, id, state),
        mode: generatedCharacterSpriteMap[id] ? 'sprite' : 'portrait',
        imageUrl,
        variantKey: '',
        matchScore: generatedCharacterSpriteMap[id] ? 74 : 58,
        matchReason: generatedCharacterSpriteMap[id] ? '使用角色基础 sprite。' : '使用角色头像/原作图兜底。',
        adult: false,
    };
}

function buildCastAssetPlan(state = {}, playerAction = {}, storyRagWorkset = {}, allowAdult = false) {
    const source = assetSearchText(state, playerAction, storyRagWorkset);
    const castAssets = anticipatedCastNames(state, playerAction, storyRagWorkset, source)
        .map((name) => buildCharacterAsset(name, state, source, allowAdult))
        .filter((asset) => asset.id || asset.inputName)
        .slice(0, 8);
    return {
        castAssets,
        missingCharacters: castAssets.filter((asset) => asset.missing),
    };
}

function missingAssetsForPlan(state = {}, backdropPlan = {}, castPlan = {}) {
    const missing = [];
    const explicitKey = state?.visuals?.visualNovel?.backgroundKey || '';
    if (explicitKey && !sceneBackdropByKey[explicitKey]) {
        missing.push({
            kind: 'scene_background',
            id: explicitKey,
            reason: 'VN_SCRIPT 或状态引用了未注册背景 key。',
            promptHint: `补齐 16:9 Galgame 背景 key=${explicitKey}；地点=${state?.current?.location || '未知'}；时间=${state?.current?.time || '未知'}。`,
        });
    }
    if (
        backdropPlan.selectedBackdrop?.confidence === 'fallback'
        && String(backdropPlan.searchText || '').replace(/未知地点|等待下一段/gu, '').trim().length >= 8
    ) {
        missing.push({
            kind: 'scene_background',
            id: `natural:${compactText(state?.current?.location || 'unknown_scene', 72)}`,
            reason: '自然语言场景没有高置信背景候选，当前只能使用默认/当前背景。',
            promptHint: `补齐 16:9 Galgame 背景：${state?.current?.location || '未知地点'}；目标=${state?.gameplay?.activeObjective || '未定'}。`,
        });
    }
    for (const character of castPlan.missingCharacters || []) {
        missing.push({
            kind: 'character_sprite',
            id: character.inputName || character.id || 'unknown_character',
            reason: character.reason,
            promptHint: `补齐角色立绘：${character.displayName || character.inputName || character.id}；当前场景=${state?.current?.location || '未知'}。`,
        });
    }
    return missing.slice(0, 10);
}

export function buildAssetPlan(state = {}, playerAction = {}, options = {}) {
    const storyRagWorkset = options.storyRagWorkset || {};
    const limit = Number(options.limit || DEFAULT_CANDIDATE_LIMIT) || DEFAULT_CANDIDATE_LIMIT;
    const backdropPlan = buildBackdropPlan(state, playerAction, storyRagWorkset, limit, {
        requiredBackdropKey: options.requiredBackdropKey || '',
    });
    const castPlan = buildCastAssetPlan(state, playerAction, storyRagWorkset, backdropPlan.adultVisualsAllowed);
    const sourceNovelReferencePlan = buildSourceNovelReferencePlan(state, backdropPlan, castPlan, backdropPlan.searchText, 8);
    const missingAssets = missingAssetsForPlan(state, backdropPlan, castPlan);
    const currentSpeaker = state?.visuals?.visualNovel?.currentSpeakerName || '';
    return {
        version: 'asset-policy/v1',
        selectedBackdrop: backdropPlan.selectedBackdrop,
        candidateBackdrops: backdropPlan.candidateBackdrops,
        castAssets: castPlan.castAssets,
        sourceNovelReferences: sourceNovelReferencePlan.references,
        sourceNovelReferencePolicy: sourceNovelReferencePlan.policy,
        sourceNovelSceneFamily: sourceNovelReferencePlan.sceneFamily,
        missingAssets,
        voiceTargets: [
            {
                speaker: normalizeAssetCharacterId(currentSpeaker) || 'narrator',
                displayName: currentSpeaker || '旁白',
                policy: 'TTS 只读取正文/台词，不读取候选行动、状态块、RAG、VN_SCRIPT 或调试文本。',
            },
        ],
        promptInjection: summarizeAssetPlan({
            selectedBackdrop: backdropPlan.selectedBackdrop,
            candidateBackdrops: backdropPlan.candidateBackdrops,
            castAssets: castPlan.castAssets,
            sourceNovelReferences: sourceNovelReferencePlan.references,
            missingAssets,
        }, 650),
        validators: {
            backgroundKeyMustExist: true,
            selectedBackdropMustFitScene: true,
            castSpritesMustMatchVisibleCast: true,
            adultVariantsRequireAdultMode: true,
            unknownAssetsGoToMissingQueue: true,
        },
        diagnostics: {
            searchText: backdropPlan.searchText,
            adultVisualsAllowed: backdropPlan.adultVisualsAllowed,
            sourceNovelSceneFamily: sourceNovelReferencePlan.sceneFamily,
        },
    };
}

export function summarizeAssetPlan(assetPlan = {}, limit = 900) {
    const selected = assetPlan.selectedBackdrop || {};
    const candidates = (assetPlan.candidateBackdrops || [])
        .slice(0, 4)
        .map((item) => `${item.key}(${item.score})`)
        .join(' / ') || '无';
    const cast = (assetPlan.castAssets || [])
        .slice(0, 5)
        .map((item) => `${item.displayName || item.inputName || item.id}:${item.id || 'missing'}${item.variantKey ? `#${item.variantKey}` : ''}`)
        .join(' / ') || '无';
    const missing = (assetPlan.missingAssets || [])
        .slice(0, 4)
        .map((item) => `${item.kind}:${item.id}`)
        .join(' / ') || '无';
    const refs = (assetPlan.sourceNovelReferences || [])
        .slice(0, 4)
        .map((item) => `${item.kind}:${item.characterId || item.sceneKey || item.id}`)
        .join(' / ') || '无';
    const output = [
        `- 背景选择: ${selected.key || 'auto'} / ${selected.title || ''} / confidence=${selected.confidence || 'unknown'} / score=${selected.score ?? 0}`,
        `- 背景候选: ${candidates}`,
        `- 角色立绘: ${cast}`,
        `- 原文素材参考: ${refs}`,
        `- 素材缺口: ${missing}`,
        '- 素材规则: backgroundKey 必须来自候选或已注册素材；角色立绘只显示当前镜头实际在场/发声者；成人变体只能在 adult mode 启用。',
    ].join('\n');
    if (output.length <= limit) {
        return output;
    }
    return `${output.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

export function evaluateAssetUse(assetPlan = {}, {
    parsedVnScript = null,
    renderedBackdropKey = '',
    renderedCastIds = [],
} = {}) {
    const findings = [];
    const selectedKey = assetPlan?.selectedBackdrop?.key || '';
    const candidateKeys = new Set((assetPlan?.candidateBackdrops || []).slice(0, 5).map((item) => item.key).filter(Boolean));
    const actualKey = parsedVnScript?.backgroundKey || renderedBackdropKey || '';
    if (actualKey && !sceneBackdropByKey[actualKey]) {
        findings.push({
            severity: 'block',
            title: '背景 key 未注册',
            detail: `backgroundKey=${actualKey}`,
        });
    } else if (actualKey && selectedKey && !backdropKeysCompatible(selectedKey, actualKey) && !candidateKeys.has(actualKey)) {
        findings.push({
            severity: 'warn',
            title: '背景素材与场景计划不一致',
            detail: `expected=${selectedKey}, actual=${actualKey}`,
        });
    }
    const expectedCast = new Set((assetPlan?.castAssets || []).map((item) => item.id).filter(Boolean));
    const actualCast = new Set(asArray(parsedVnScript?.castIds).concat(asArray(renderedCastIds)).map(normalizeAssetCharacterId).filter(Boolean));
    for (const id of actualCast) {
        if (!expectedCast.has(id) && expectedCast.size > 0) {
            findings.push({
                severity: 'warn',
                title: '舞台角色不在资产计划中',
                detail: `unexpectedCast=${id}`,
            });
        }
    }
    for (const missing of assetPlan?.missingAssets || []) {
        findings.push({
            severity: missing.kind === 'scene_background' ? 'warn' : 'info',
            title: '素材缺口待补齐',
            detail: `${missing.kind}:${missing.id}`,
        });
    }
    return findings;
}
