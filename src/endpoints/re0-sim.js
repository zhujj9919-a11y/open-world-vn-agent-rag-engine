import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { SECRET_KEYS, readSecret } from './secrets.js';

export const router = express.Router();

const MIMO_CHAT_URL = 'https://token-plan-cn.xiaomimimo.com/v1/chat/completions';
const DEFAULT_MODEL = 'mimo-v2.5-pro';
const MAX_PARALLELISM = 32;
const REQUEST_TIMEOUT_MS = 6000;
const VISUAL_REQUEST_TIMEOUT_MS = 6000;
const DEEP_REQUEST_TIMEOUT_MS = 30000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHARD_TEMPLATE_PATH = path.join(__dirname, 'data/re0-shard-templates.json');

function loadShardTemplates() {
    try {
        return JSON.parse(fs.readFileSync(SHARD_TEMPLATE_PATH, 'utf8'));
    } catch {
        return { sideQuests: [], remoteSignals: [], worldMap: { regions: [] }, characterDossiers: {} };
    }
}

const storylineShardTemplates = loadShardTemplates();

const shardDefinitions = [
    { id: 'actor_lishelle', layer: 'actor', focus: '莉榭尔·阿尔戈：死亡记忆残响、救济院、她失去记忆的代价。' },
    { id: 'actor_mia', layer: 'actor', focus: '米娅：贫民区少女的恐惧、愿望、误会、求生选择。' },
    { id: 'actor_owen', layer: 'actor', focus: '欧文·卡斯兰：证据链、骑士团旧案、对主角异常的怀疑。' },
    { id: 'actor_causal_residue', layer: 'actor', focus: '玩家因果继承压力：原世界线救援窗口、迟到代价、失败残响和行动盲点全部压入玩家锚点。' },
    { id: 'actor_emilia', layer: 'actor', focus: '爱蜜莉雅：王选压力、歧视、徽章事件和善意被误读。' },
    { id: 'actor_felt', layer: 'actor', focus: '菲鲁特：盗品蔵、贫民区情报、自由本能和王选伏笔。' },
    { id: 'actor_elsa', layer: 'actor', focus: '艾尔莎：杀意、委托链、盗品蔵风险和异常直觉。' },
    { id: 'slum_predation', layer: 'dark-realism', focus: '贫民区弱肉强食：饥饿、债务、庇护费、掮客、沉默证人。' },
    { id: 'noble_impunity', layer: 'dark-realism', focus: '贵族豁免：权力、名声、程序、骑士团不敢碰的门槛。' },
    { id: 'adult_underworld', layer: 'dark-realism', focus: '成人灰色地下交易：陪酒、债务契约、房门后的交易与事后痕迹；只处理明确成人，不露骨。' },
    { id: 'law_and_silence', layer: 'dark-realism', focus: '法律与沉默：证词被买走、受害者改口、旁观者自保。' },
    { id: 'trauma_aftermath', layer: 'dark-realism', focus: '创伤后果：沉默、失眠、衣物痕迹、回避眼神、复仇冲动。' },
    { id: 'reversal_paths', layer: 'payoff', focus: '爽感与强势反转：正确分支如何用证据、权力、死亡残响和信息差翻盘。' },
    { id: 'actor_otto', layer: 'actor', focus: '奥托·苏文：行商路线、动物情报、倒霉但关键的偶然。' },
    { id: 'actor_roswaal', layer: 'actor', focus: '罗兹瓦尔：长期剧本、利用、边境伯势力与福音书式执念。' },
    { id: 'actor_beatrice', layer: 'actor', focus: '碧翠丝：禁书库、契约、等待、对魔女气味的细微反应。' },
    { id: 'actor_reinhard', layer: 'actor', focus: '莱茵哈鲁特：强者限制、政治距离、信息差和迟到的救援。' },
    { id: 'faction_emilia', layer: 'faction', focus: '爱蜜莉雅阵营：王选信誉、帕克、罗兹瓦尔利益和宅邸引力。' },
    { id: 'faction_felt', layer: 'faction', focus: '菲鲁特阵营：贫民区、莱茵哈鲁特、失窃徽章和王族血统阴影。' },
    { id: 'faction_crusch', layer: 'faction', focus: '库珥修阵营：骑士名誉、白鲸远因、情报纪律。' },
    { id: 'faction_anastasia', layer: 'faction', focus: '安娜塔西亚阵营：商会、情报价格、卡拉拉基网络。' },
    { id: 'faction_priscilla', layer: 'faction', focus: '普莉希拉阵营：傲慢幸运、权贵旁观、阿尔的异样回声。' },
    { id: 'faction_knights', layer: 'faction', focus: '王国骑士团：治安、阶级偏见、被抹除的魔女教记录。' },
    { id: 'faction_witch_cult', layer: 'faction', focus: '魔女教与异端：福音书、剥钟人、魔女气味追踪。' },
    { id: 'location_slums', layer: 'location', focus: '王都贫民区：雨、血水、救济院、地下交易和传言扩散。' },
    { id: 'location_loot_house', layer: 'location', focus: '盗品蔵附近：徽章线、艾尔莎、罗姆爷、交易时间差。' },
    { id: 'location_royal_castle', layer: 'location', focus: '王城与贵族区：王选舆论、调令、强者无法及时抵达的理由。' },
    { id: 'location_old_archive', layer: 'location', focus: '旧档案室：被抹去的记录、废钟图案、欧文线索。' },
    { id: 'location_arlam', layer: 'location', focus: '阿拉姆村与宅邸远端：咒术、魔兽、未来惨剧引力。' },
    { id: 'worldline_convergence', layer: 'worldline', focus: '吸引域与收束节点：哪些事必须发生，哪些代价可以交换。' },
    { id: 'if_route_pride', layer: 'if-route', focus: '傲慢 IF 吸引子：孤身英雄、不求助、把拯救对象神圣化后走向极端。' },
    { id: 'if_route_wrath', layer: 'if-route', focus: '愤怒 IF 吸引子：疑心、清算、灭口、恐惧统治和证人消失后的短期效率。' },
    { id: 'if_route_sloth', layer: 'if-route', focus: '怠惰 IF 吸引子：逃离露格尼卡、局部幸福、卡拉拉基生活与远方主线代价。' },
    { id: 'if_route_greed', layer: 'if-route', focus: '强欲 IF 吸引子：死亡回归无限优化、艾姬多娜式全知、人格和同伴被工具化。' },
    { id: 'if_route_gluttony', layer: 'if-route', focus: '暴食 IF 吸引子：身份饥饿、死者之书、杀知情者拼回自我的危险逻辑。' },
    { id: 'if_route_deception', layer: 'if-route', focus: '欺瞒/错位 IF 吸引子：错误阵营、假身份、帝国线误投和解释权争夺。' },
    { id: 'return_by_death_noise', layer: 'worldline', focus: '死亡回归噪声：玩家接近原世界线关键因果时的锚点错乱、梦、既视感。' },
    { id: 'rumor_market', layer: 'social', focus: '传言市场：贫民、商人、骑士、教徒如何曲解主角行动。' },
    { id: 'dream_residue', layer: 'occult', focus: '梦境残响：失败时间线碎片如何进入他人梦里。' },
    { id: 'od_laguna_pressure', layer: 'occult', focus: '奥德拉格纳与世界修正力：加护、灵魂、命运债务的微妙反应。' },
    { id: 'bellringer_antagonist', layer: 'antagonist', focus: '剥钟人：迟到救赎权能、镜像敌人、临死声音。' },
    { id: 'continent_lugunica', layer: 'continent', focus: '露格尼卡王国大陆切片：王都、罗兹瓦尔领、圣域、普利斯提拉、监视塔远期引力如何同步运作。' },
    { id: 'continent_kararagi', layer: 'continent', focus: '卡拉拉基都市国家群：商路、合辛商会、佣兵、旅店传言和跨国情报价格。' },
    { id: 'continent_vollachia', layer: 'continent', focus: '神圣佛拉基亚帝国：皇帝、九神将、强者逻辑、军令和帝国边境对远期剧情的压力。' },
    { id: 'continent_gusteko', layer: 'continent', focus: '古斯提科圣王国：雪原、精灵信仰、教区、寒冷生存和宗教审判传言。' },
    { id: 'region_priestella', layer: 'region', focus: '水门都市普利斯提拉：水闸、商会、吟游诗人、魔女教广播的远期副本伏笔。' },
    { id: 'region_watchtower', layer: 'region', focus: '贤者监视塔与奥格利亚砂丘：名字、记忆、暴食、星名和禁忌路线的远期压力。' },
    { id: 'population_templates', layer: 'population', focus: '群众模板：贫民、低阶贵族、巡逻骑士、商人、帝国士兵、雪原朝圣者、魔女教外围信使。' },
    { id: 'living_world_noise', layer: 'population', focus: '生活噪声：集市价格、雨天路况、酒馆闲话、债务催收、错过的货车、旅人谣言让世界显得活着。' },
    { id: 'resource_economy', layer: 'system', focus: '资源经济：钱、食物、住所、债、人情、情报价格。' },
    { id: 'clue_integrity', layer: 'system', focus: '推理一致性：线索是否可追溯，是否有矛盾或过早剧透。' },
    { id: 'tragedy_cost', layer: 'system', focus: '悲剧代价：救一人害十人的链条，痛苦必须推动谜团和人物。' },
    {
        id: 'storyline_side_quest_pool',
        layer: 'sidequest',
        focus: `从结构化支线池里选择 1-2 条适合当前时间、地点、倾向的可显影入口。候选示例：${(storylineShardTemplates.sideQuests || []).slice(0, 18).map((quest) => `${quest.id}${quest.name}`).join(' / ')}`,
    },
];

const priorityShardIds = [
    'actor_lishelle',
    'actor_mia',
    'actor_owen',
    'actor_causal_residue',
    'actor_emilia',
    'slum_predation',
    'noble_impunity',
    'law_and_silence',
    'reversal_paths',
    'worldline_convergence',
    'if_route_pride',
    'if_route_wrath',
    'if_route_sloth',
    'if_route_greed',
    'if_route_gluttony',
    'if_route_deception',
    'continent_lugunica',
    'continent_kararagi',
    'continent_vollachia',
    'continent_gusteko',
    'region_priestella',
    'region_watchtower',
    'population_templates',
    'living_world_noise',
    'storyline_side_quest_pool',
    'trauma_aftermath',
    'adult_underworld',
];

const backendIfRouteProfiles = {
    EnvyMain: {
        label: '嫉妒/主线',
        shardIds: ['worldline_convergence', 'return_by_death_noise', 'reversal_paths', 'clue_integrity'],
        patterns: [/(求助|同伴|信任|证据|见证|交叉验证|尊重.*选择|从零开始)/],
        counterPatterns: [],
        correction: '把失败转化为证据、同伴和关系修正。',
    },
    Pride: {
        label: '傲慢 IF / Ayamatsu',
        shardIds: ['if_route_pride', 'actor_reinhard', 'actor_emilia', 'faction_witch_cult', 'location_loot_house'],
        patterns: [/(不求助|我一个人|只有我能|不要莱茵哈鲁特|成为反派|烧.*王都|英雄)/],
        counterPatterns: [/(呼救|找莱茵哈鲁特|向骑士求助|承认弱小|让别人救|交给.*处理)/],
        correction: '让强者、证据链或第三方见证入局。',
    },
    Wrath: {
        label: '愤怒 IF / Oboreru',
        shardIds: ['if_route_wrath', 'law_and_silence', 'trauma_aftermath', 'faction_knights', 'noble_impunity'],
        patterns: [/(谁都不信|清算|灭口|报复|肃清|恐惧统治|证人|背叛)/],
        counterPatterns: [/(先验证|解释机会|交叉证词|保留证人|不杀证人|让.*作证|怀疑说清)/],
        correction: '保留证人，把怀疑转化为交叉证词。',
    },
    Sloth: {
        label: '怠惰 IF / Kararagi Rem',
        shardIds: ['if_route_sloth', 'continent_kararagi', 'faction_anastasia', 'actor_otto', 'living_world_noise'],
        patterns: [/(逃走|私奔|去卡拉拉基|放弃主线|平静生活|不管王选|远离这一切)/],
        counterPatterns: [/(回去救|不能逃|承担责任|先救村子|白鲸|怠惰讨伐|寻求同盟)/],
        correction: '把休整转成补给、商路情报或下一步救援。',
    },
    Greed: {
        label: '强欲 IF / Kasaneru',
        shardIds: ['if_route_greed', 'dream_residue', 'od_laguna_pressure', 'actor_roswaal', 'actor_beatrice'],
        patterns: [/(艾姬多娜|契约|无限试错|最优解|死一次|死亡.*优化|所有分支)/],
        counterPatterns: [/(拒绝契约|不把死亡当工具|不用死刷|保留人的选择|接受不完美)/],
        correction: '拒绝死亡枚举，保留人的选择和不完美解。',
    },
    Gluttony: {
        label: '暴食 IF / Tsugihagu',
        shardIds: ['if_route_gluttony', 'region_watchtower', 'dream_residue', 'clue_integrity', 'return_by_death_noise'],
        patterns: [/(我是谁|死者之书|记忆不可信|杀.*知情者|拼回自己|名字)/],
        counterPatterns: [/(接受现在的我|不靠杀人确认|让同伴证明|保留证词|交叉验证)/],
        correction: '用外部证据整合身份，不吞噬证人。',
    },
    Aganau: {
        label: '复仇 IF / Aganau',
        shardIds: ['if_route_wrath', 'faction_witch_cult', 'tragedy_cost', 'continent_lugunica'],
        patterns: [/(复仇|追杀怠惰|多年追猎|用余生|只为讨伐)/],
        counterPatterns: [/(先救活人|限时情报|不只为复仇|保留回头路)/],
        correction: '把复仇缩成限时情报任务，先救活人。',
    },
    Lust: {
        label: '色欲/蝶梦 IF',
        shardIds: ['adult_underworld', 'living_world_noise', 'reversal_paths'],
        patterns: [/(后宫|多角|修罗场|欲望优先|恋爱优先|成人日常|亲密)/],
        counterPatterns: [/(先处理主线|暂停亲密|回到任务|关系不能压过危机)/],
        correction: '关系推进要服务动机与代价，不吞掉主线危机。',
    },
    Mirror: {
        label: '虚荣/镜像 IF',
        shardIds: ['if_route_deception', 'dream_residue', 'od_laguna_pressure'],
        patterns: [/(镜像|学院|性别反转|身份互换|舞台变成日常)/],
        counterPatterns: [/(回到原世界规则|解除镜像|保留露格尼卡政治)/],
        correction: '镜像只改外壳，保留角色核心和世界规则。',
    },
    Deception: {
        label: '欺瞒 IF / Azamuku',
        shardIds: ['if_route_deception', 'continent_vollachia', 'faction_priscilla', 'actor_otto'],
        patterns: [/(错误阵营|假身份|站错队|欺瞒|水晶宫|帝国|解释权)/],
        counterPatterns: [/(确认阵营|核验身份|不立刻站队|双向取证|保留中立)/],
        correction: '先核验地点、阵营、身份和谁从误解获利。',
    },
    Sacrifice: {
        label: '献祭 IF / Sasageru',
        shardIds: ['od_laguna_pressure', 'dream_residue', 'continent_gusteko', 'tragedy_cost'],
        patterns: [/(献祭|封印|交给未来|四百年|牺牲现在|冰川)/],
        counterPatterns: [/(现在解决|不交给未来|打断封印|救出封印|拒绝献祭)/],
        correction: '寻找当代解除条件，不把问题外包给未来。',
    },
};

const backendIfRouteAxisRules = {
    supportDeficit: { label: '求助缺失', patterns: [/(不求助|我一个人|不用别人|不要莱茵哈鲁特|只靠我|不要同伴)/], counterPatterns: [/(求助|找见证|找援手|找莱茵哈鲁特|共享线索)/], routeDeltas: { Pride: 1.1, EnvyMain: -0.7 } },
    trustCollapse: { label: '信任崩塌', patterns: [/(谁都不信|灭口|清算|肃清|处理证人|恐惧管理)/], counterPatterns: [/(交叉证词|保留证人|让.*作证|证据链)/], routeDeltas: { Wrath: 1.15, EnvyMain: -0.8 } },
    responsibilityEvasion: { label: '责任逃避', patterns: [/(逃走|私奔|放弃主线|不管王选|不管白鲸|不管怠惰)/], counterPatterns: [/(回去救|承担责任|白鲸讨伐|怠惰讨伐|寻找同盟)/], routeDeltas: { Sloth: 1.2, EnvyMain: -0.65 } },
    deathInstrumentality: { label: '死亡工具化', patterns: [/(先死一次|无限试错|刷.*最优|死亡.*优化|所有分支|反复死亡)/], counterPatterns: [/(不把死亡当工具|不用死刷|可逆实验|接受不完美)/], routeDeltas: { Greed: 1.25, EnvyMain: -0.9 } },
    identityHunger: { label: '身份饥饿', patterns: [/(我是谁|死者之书|杀.*知情者|记忆不可信|为了身份)/], counterPatterns: [/(接受现在的我|外部证据|同伴证明|保留证词|交叉验证)/], routeDeltas: { Gluttony: 1.3, EnvyMain: -1 } },
    vengeanceLock: { label: '复仇锁定', patterns: [/(复仇|追杀怠惰|多年追猎|二十年|只为讨伐)/], counterPatterns: [/(先救活人|限时情报|保留回头路)/], routeDeltas: { Aganau: 1.2, Wrath: 0.35 } },
    relationshipOverride: { label: '关系压过危机', patterns: [/(恋爱优先|欲望优先|成人日常|后宫|多角|修罗场)/], counterPatterns: [/(先处理主线|暂停亲密|回到任务)/], routeDeltas: { Lust: 1.2, EnvyMain: -0.35 } },
    realityDrift: { label: '现实外壳漂移', patterns: [/(镜像世界|性别反转|学院|校园|身份互换)/], counterPatterns: [/(回到原世界规则|解除镜像|保留露格尼卡政治)/], routeDeltas: { Mirror: 1.15 } },
    factionMisread: { label: '阵营误读', patterns: [/(错误阵营|站错队|假身份|投放到敌方|解释权)/], counterPatterns: [/(确认阵营|核验身份|不立刻站队|双向取证|保留中立)/], routeDeltas: { Deception: 1.25 } },
    futureDeferral: { label: '问题外包未来', patterns: [/(献祭|封印.*未来|交给未来|四百年后|封存问题)/], counterPatterns: [/(现在解决|不交给未来|打断封印|拒绝献祭)/], routeDeltas: { Sacrifice: 1.25 } },
    evidenceNetwork: { label: '证据网络', patterns: [/(求助|共享线索|交换证据|找见证|交叉验证|保留撤离|让.*自己选择|承认弱小)/], counterPatterns: [/(不需要证据|证人没用|不用解释|只要结果)/], routeDeltas: { EnvyMain: 1.35, Pride: -0.7, Wrath: -0.7, Greed: -0.65, Gluttony: -0.65 } },
};

const backendIfRoutePleasureGrammar = {
    doctrine: 'IF 线是世界线爽点吸引子：每条线都给玩家一种快感、一个代价形状和一个可纠偏入口。',
    routes: {
        EnvyMain: { pleasure: '证据链翻盘、同伴入局、关系修复后的强势救援。', costShape: '推进慢，需要承认弱小。' },
        Pride: { pleasure: '孤身布局、反派式救赎、以恶名操盘王都。', costShape: '信任坍塌，英雄阵营误判。' },
        Wrath: { pleasure: '复仇清算、恐惧支配、地下王式掌控。', costShape: '服从不等于信任，证人越少真相越碎。' },
        Sloth: { pleasure: '逃亡幸福、小家庭、平静生活。', costShape: '局部幸福成立，远方灾厄继续结算。' },
        Greed: { pleasure: '高智商推演、完美路线、信息压制。', costShape: '人格和关系被工具化。' },
        Gluttony: { pleasure: '身份谜题、记忆拼图、谎言拆解。', costShape: '用吞噬确认身份会破坏信任基础。' },
        Aganau: { pleasure: '长期复仇、老练猎手、迟到但精准的讨伐。', costShape: '时间机会成本巨大。' },
        Lust: { pleasure: '成年角色关系升温、主动靠近、嫉妒修罗场、关系撬动阵营。', costShape: '欲望不能抹掉主线危机，嫉妒和阵营代价会反噬。' },
        Mirror: { pleasure: '镜像舞台、身份互换、梦境/学院日常。', costShape: '镜像只是舞台，不覆盖正传规则。' },
        Deception: { pleasure: '间谍、错位站队、假身份和解释权反杀。', costShape: '站错队越久越难洗清。' },
        Sacrifice: { pleasure: '末世感、未来回声、封印破局。', costShape: '外包未来制造时代断层。' },
    },
};

function clampInteger(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return min;
    }
    return Math.min(max, Math.max(min, Math.floor(number)));
}

function clampNumber(value, min, max, fallback = min) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, number));
}

function truncate(value, limit) {
    const text = String(value ?? '');
    return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function safeState(input) {
    const state = input && typeof input === 'object' ? JSON.parse(JSON.stringify(input)) : {};
    delete state.saves;
    delete state.lastProcessedUserMessageId;
    delete state.lastQuietUpdateMessageId;
    return state;
}

function safeRecentMessages(messages) {
    if (!Array.isArray(messages)) {
        return [];
    }

    return messages.slice(-12).map((message) => {
        if (typeof message === 'string') {
            return truncate(message, 1600);
        }
        return {
            role: message?.role || (message?.is_user ? 'user' : 'assistant'),
            text: truncate(message?.text ?? message?.mes ?? message?.message ?? '', 1600),
        };
    });
}

function tailArray(value, limit, mapper = (item) => item) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.slice(-limit).map(mapper).filter(Boolean);
}

function compactCharacterCard(card, id) {
    if (!card || typeof card !== 'object') {
        return null;
    }
    return {
        id: card.id || id,
        name: card.name || id,
        role: card.role || card.title || '',
        location: card.location || card.currentLocation || card.presence?.location || '',
        presence: card.presence?.scope || card.presence || '',
        attitudeToPlayer: card.attitudeToPlayer || '',
        trust: card.trust ?? card.relationship?.trust ?? '',
        suspicion: card.suspicion ?? card.relationship?.suspicion ?? '',
        affection: card.affection ?? card.relationship?.affection ?? '',
        desire: card.desire ?? card.relationship?.desire ?? '',
        trauma: card.trauma ?? card.relationship?.trauma ?? '',
        memory: tailArray(card.memory, 4, (item) => truncate(item, 160)),
        arcLog: tailArray(card.arcLog, 3, (item) => truncate(item, 160)),
        flags: tailArray(card.flags, 6, (item) => truncate(item, 60)),
    };
}

function compactWorldScope(scope) {
    if (!scope || typeof scope !== 'object') {
        return {};
    }
    return {
        currentRegion: scope.currentRegion || '',
        nearbyRegions: tailArray(scope.nearbyRegions, 6, (item) => truncate(item, 120)),
        activeRumors: tailArray(scope.activeRumors, 8, (item) => truncate(item, 180)),
        remoteHooks: tailArray(scope.remoteHooks, 8, (item) => truncate(item, 180)),
        populationTemplates: tailArray(scope.populationTemplates, 6, (item) => {
            if (typeof item === 'string') {
                return truncate(item, 140);
            }
            return {
                name: item?.name || item?.id || '',
                region: item?.region || '',
                motive: truncate(item?.motive || item?.function || '', 100),
            };
        }),
    };
}

function compactStateForWorldSimulation(state) {
    const cards = Object.entries(state?.characterCards || {})
        .map(([id, card]) => compactCharacterCard(card, id))
        .filter(Boolean)
        .sort((a, b) => {
            const score = (card) => {
                const presence = String(card.presence || '');
                return (presence.includes('scene') ? 40 : 0)
                    + (presence.includes('near') ? 20 : 0)
                    + Number(card.trust || 0) / 5
                    + Number(card.suspicion || 0) / 5
                    + Number(card.affection || 0) / 8
                    + Number(card.trauma || 0) / 8;
            };
            return score(b) - score(a);
        })
        .slice(0, 18);

    return {
        current: state?.current || {},
        mode: state?.mode || 'main',
        narrativeMode: state?.narrativeMode || state?.storyMode || 'daily',
        worldline: {
            id: state?.worldline?.id || '',
            divergence: state?.worldline?.divergence ?? state?.worldlineDivergence ?? 0,
            anchor: state?.worldline?.anchor || state?.deathReturn?.anchor || '',
            history: tailArray(state?.worldline?.history, 8, (item) => ({
                day: item?.day,
                type: item?.type || item?.kind || '',
                summary: truncate(item?.summary || item?.text || item, 180),
            })),
        },
        mainline: state?.mainline || {},
        storyClocks: state?.storyClocks || state?.mainlineClocks || {},
        routeSystem: state?.routeSystem || {},
        ifRouteLogic: state?.ifRouteLogic || state?.ifRoutes || {},
        gameplay: {
            activeObjective: state?.gameplay?.activeObjective || '',
            objectiveStage: state?.gameplay?.objectiveStage || '',
            tension: state?.gameplay?.tension ?? '',
            resources: state?.gameplay?.resources || {},
            openQuestions: tailArray(state?.gameplay?.openQuestions, 10, (item) => truncate(item, 140)),
            actionHints: tailArray(state?.gameplay?.actionHints, 10, (item) => truncate(item, 140)),
            failurePressure: tailArray(state?.gameplay?.failurePressure, 10, (item) => truncate(item, 140)),
            payoff: state?.gameplay?.payoff || {},
        },
        protagonist: state?.protagonist || state?.player || {},
        setupSelection: state?.setupSelection || {},
        discoveredClues: tailArray(state?.discoveredClues, 24, (item) => truncate(item, 140)),
        keyInventory: tailArray(state?.keyInventory, 18, (item) => truncate(item?.name || item?.id || item, 120)),
        flagTrigger: tailArray(state?.flagTrigger, 18, (item) => truncate(item?.name || item?.id || item, 120)),
        sideQuests: tailArray(state?.sideQuests, 18, (item) => ({
            id: item?.id || item?.name || '',
            status: item?.status || '',
            summary: truncate(item?.summary || item?.description || '', 160),
        })),
        worldPulses: tailArray(state?.worldPulses, 12, (item) => ({
            day: item?.day,
            time: item?.time || '',
            location: item?.location || '',
            actor: item?.actor || '',
            visibility: item?.visibility || '',
            summary: truncate(item?.summary || '', 160),
            futureSignal: truncate(item?.futureSignal || '', 160),
        })),
        daySchedule: tailArray(state?.daySchedule, 12, (item) => ({
            time: item?.time || '',
            location: item?.location || '',
            actor: item?.actor || '',
            visibility: item?.visibility || '',
            event: truncate(item?.event || item?.summary || '', 160),
        })),
        worldScope: compactWorldScope(state?.worldScope),
        characterCards: Object.fromEntries(cards.map((card) => [card.id || card.name, card])),
        flags: {
            pendingReveals: tailArray(state?.flags?.pendingReveals, 8, (item) => truncate(item, 160)),
            pendingRumors: tailArray(state?.flags?.pendingRumors, 8, (item) => truncate(item, 160)),
            lastWorldlineShift: truncate(state?.flags?.lastWorldlineShift || '', 180),
        },
    };
}

function sanitizeMemorySegment(value, fallback = 'current-world') {
    const text = String(value || fallback)
        .replace(/[\\/:"*?<>|\u0000-\u001F]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 80);
    return text || fallback;
}

function sanitizeMemoryFilename(value) {
    const text = String(value || '')
        .replace(/[\\/:"*?<>|\u0000-\u001F]/g, '-')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 96);
    if (!text || !/\.(md|json)$/i.test(text)) {
        return null;
    }
    return text;
}

function memoryRootForRequest(request, sessionId) {
    const root = request.user?.directories?.root;
    if (!root) {
        throw new Error('User data root is unavailable.');
    }
    return path.join(root, 're0-engine', 'runtime-memory', sanitizeMemorySegment(sessionId));
}

function memoryBaseForRequest(request) {
    const root = request.user?.directories?.root;
    if (!root) {
        throw new Error('User data root is unavailable.');
    }
    return path.join(root, 're0-engine', 'runtime-memory');
}

function readMemoryManifest(sessionRoot, sessionId) {
    try {
        const manifestPath = path.join(sessionRoot, 'MANIFEST.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        return {
            sessionId: manifest.sessionId || sessionId,
            reason: manifest.reason || '',
            writtenAt: manifest.writtenAt || '',
            files: Array.isArray(manifest.files) ? manifest.files : [],
            root: manifest.root || sessionRoot,
        };
    } catch {
        return {
            sessionId,
            reason: 'missing-manifest',
            writtenAt: '',
            files: [],
            root: sessionRoot,
        };
    }
}

function sanitizeCausalInheritanceText(value) {
    return String(value || '')
        .replaceAll('M1-SUBARU-NOISE', 'M1-CAUSAL-INHERITANCE')
        .replaceAll('菜月昴', '锚点残响')
        .replaceAll('昴', '锚点残响')
        .replaceAll('SUBARU', 'CAUSAL-INHERITANCE')
        .replaceAll('Subaru', 'causal-inheritance')
        .replaceAll('subaru', 'causal-inheritance')
        .replaceAll('玩家主角', '玩家唯一视角')
        .replaceAll('另一名异世界来客', '失败世界线残响')
        .replaceAll('两种死亡回归', '玩家当前循环与失败残响')
        .replaceAll('双方锚点', '玩家锚点与失败残响')
        .replaceAll('自己的循环', '失败残响的惯性')
        .replaceAll('寻找另一个行为异常的异乡人', '调查锚点异常与失败证词')
        .replaceAll('互相救赎或互相误判', '改变方针或误判代价')
        .replaceAll('交易仍会发生；锚点残响、菲鲁特和艾尔莎可能先行碰撞', '交易仍会发生；玩家若不介入，菲鲁特和艾尔莎可能先行碰撞')
        .replaceAll('锚点残响同源权能干扰', '玩家因果继承压力')
        .replaceAll('NPC: 锚点残响', '信号: 锚点残响');
}

function sanitizeCausalInheritanceValue(value) {
    if (Array.isArray(value)) {
        return value
            .map((item) => sanitizeCausalInheritanceValue(item))
            .filter((item) => item !== '锚点残响');
    }
    if (value && typeof value === 'object') {
        const next = {};
        for (const [key, item] of Object.entries(value)) {
            const safeKey = sanitizeCausalInheritanceText(key);
            if (safeKey === '锚点残响') {
                continue;
            }
            next[safeKey] = sanitizeCausalInheritanceValue(item);
        }
        return next;
    }
    if (typeof value === 'string') {
        return sanitizeCausalInheritanceText(value);
    }
    return value;
}

function writeRuntimeMemoryIndex(request) {
    const base = memoryBaseForRequest(request);
    fs.mkdirSync(base, { recursive: true });
    const sessions = fs.readdirSync(base, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => readMemoryManifest(path.join(base, entry.name), entry.name))
        .sort((a, b) => String(b.writtenAt || '').localeCompare(String(a.writtenAt || '')));
    const index = {
        ok: true,
        updatedAt: new Date().toISOString(),
        root: base,
        sessions,
    };
    fs.writeFileSync(path.join(base, 'INDEX.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(base, 'INDEX.md'), [
        '# Re:0 Runtime Memory Index',
        '',
        `- updatedAt: ${index.updatedAt}`,
        `- root: ${base}`,
        `- sessions: ${sessions.length}`,
        '',
        '## Sessions',
        ...sessions.map((session) => `- ${session.sessionId} / ${session.writtenAt || 'unknown'} / ${session.reason || 'unknown'} / files=${session.files.length}`),
        '',
        '## Usage',
        '先读取本索引，再进入对应 session 目录读取 MEMORY_INDEX.md、CURRENT_STATE.md、WORLDLINE_LEDGER.md、CHARACTER_LEDGER.md 与 PROMPT_CONTEXT.md。',
    ].join('\n'), 'utf8');
    return index;
}

function writeMemorySnapshot(request, body = {}) {
    const sessionId = sanitizeMemorySegment(body.sessionId || body.snapshot?.sessionId || 'current-world');
    const root = memoryRootForRequest(request, sessionId);
    const now = new Date().toISOString();
    const reason = truncate(body.reason || 'auto', 120);
    const documents = Array.isArray(body.documents) ? body.documents.slice(0, 16) : [];
    const snapshot = sanitizeCausalInheritanceValue(body.snapshot && typeof body.snapshot === 'object' ? body.snapshot : {});
    fs.mkdirSync(root, { recursive: true });

    const written = [];
    fs.writeFileSync(path.join(root, 'SNAPSHOT.json'), `${JSON.stringify({ ...snapshot, writtenAt: now, reason, sessionId }, null, 2)}\n`, 'utf8');
    written.push('SNAPSHOT.json');

    for (const document of documents) {
        const filename = sanitizeMemoryFilename(document?.filename);
        if (!filename) {
            continue;
        }
        const content = sanitizeCausalInheritanceText(document?.content || '').slice(0, 180000);
        fs.writeFileSync(path.join(root, filename), content.endsWith('\n') ? content : `${content}\n`, 'utf8');
        written.push(filename);
    }

    if (!written.includes('MEMORY_INDEX.md')) {
        fs.writeFileSync(path.join(root, 'MEMORY_INDEX.md'), `# Re:0 Runtime Memory\n\n- sessionId: ${sessionId}\n- writtenAt: ${now}\n- reason: ${reason}\n- files: ${written.join(', ')}\n`, 'utf8');
        written.push('MEMORY_INDEX.md');
    }
    fs.writeFileSync(path.join(root, 'LATEST.md'), `# Latest Re:0 Memory Snapshot\n\n- sessionId: ${sessionId}\n- writtenAt: ${now}\n- reason: ${reason}\n- root: ${root}\n\n## Files\n${written.map((file) => `- ${file}`).join('\n')}\n`, 'utf8');
    written.push('LATEST.md');

    const manifest = { ok: true, sessionId, reason, writtenAt: now, root, files: written };
    fs.writeFileSync(path.join(root, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    const index = writeRuntimeMemoryIndex(request);
    return { ...manifest, index: { updatedAt: index.updatedAt, sessions: index.sessions.length } };
}

function normalizedIfRouteLogic(state) {
    const logic = state?.ifRouteLogic && typeof state.ifRouteLogic === 'object' ? state.ifRouteLogic : {};
    const routePressures = logic.routePressures && typeof logic.routePressures === 'object' ? logic.routePressures : {};
    const routeMomentum = logic.routeMomentum && typeof logic.routeMomentum === 'object' ? logic.routeMomentum : {};
    const axisScores = logic.axisScores && typeof logic.axisScores === 'object' ? logic.axisScores : {};
    const dominant = backendIfRouteProfiles[logic.dominant] ? logic.dominant : Object.entries(routePressures)
        .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))[0]?.[0] || 'EnvyMain';
    const branchTransition = normalizeBackendBranchTransition(logic.branchTransition, routePressures, axisScores);
    return {
        dominant: backendIfRouteProfiles[dominant] ? dominant : 'EnvyMain',
        dominantLabel: backendIfRouteProfiles[dominant]?.label || '嫉妒/主线',
        routePressures: Object.fromEntries(Object.keys(backendIfRouteProfiles).map((id) => [id, Number(routePressures[id] || (id === 'EnvyMain' ? 1 : 0))])),
        routeMomentum: Object.fromEntries(Object.keys(backendIfRouteProfiles).map((id) => [id, Number(routeMomentum[id] || 0)])),
        axisScores: Object.fromEntries(Object.keys(backendIfRouteAxisRules).map((id) => [id, Number(axisScores[id] || (id === 'evidenceNetwork' ? 1 : 0))])),
        branchTransition,
        lastSignals: Array.isArray(logic.lastSignals) ? logic.lastSignals.slice(-6) : [],
        driftLedger: Array.isArray(logic.driftLedger) ? logic.driftLedger.slice(-6) : [],
        correctionLedger: Array.isArray(logic.correctionLedger) ? logic.correctionLedger.slice(-6) : [],
        softLocks: Array.isArray(logic.softLocks) ? logic.softLocks.slice(0, 5) : [],
        candidateBranches: Array.isArray(logic.candidateBranches) ? logic.candidateBranches.slice(0, 4) : [],
        lastShift: logic.lastShift || '',
    };
}

function normalizeBackendBranchTransition(value = {}, routePressures = {}, axisScores = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const nonMainTop = Object.entries(routePressures)
        .filter(([id]) => id !== 'EnvyMain' && backendIfRouteProfiles[id])
        .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))[0] || ['EnvyMain', 0];
    const softLockThreshold = Math.max(3, Math.min(24, Math.round(Number(source.softLockThreshold || 9))));
    const hardLockThreshold = Math.max(softLockThreshold + 1, Math.min(30, Math.round(Number(source.hardLockThreshold || 16))));
    const pressureFactor = Math.min(1, Number(nonMainTop[1] || 0) / Math.max(1, softLockThreshold + 6));
    const axisEntries = Object.entries(axisScores || {}).filter(([id]) => id !== 'evidenceNetwork');
    const axisAverage = axisEntries.length
        ? axisEntries.reduce((sum, [, score]) => sum + Number(score || 0), 0) / axisEntries.length
        : 0;
    const target = clampNumber(pressureFactor * 0.76 + Math.min(1, axisAverage / 18) * 0.24, 0, 1, 0.08);
    const previous = clampNumber(source.divergenceRate, 0, 1, 0.08);
    const inertia = clampNumber(source.inertia, 0, 1, 0.62);
    const divergenceRate = clampNumber(previous * inertia + target * (1 - inertia), 0, 1, 0.08);
    const continuityIndex = clampNumber(1 - Math.max(0, Number(nonMainTop[1] || 0) - softLockThreshold) * 0.04 + 0.06, 0, 1, 0.92);
    return {
        mode: source.mode || 'soft-attractor',
        divergenceRate: Number(divergenceRate.toFixed(3)),
        continuityIndex: Number(continuityIndex.toFixed(3)),
        inertia,
        volatility: clampNumber(source.volatility, 0, 1, 0.18),
        convergenceElasticity: clampNumber(source.convergenceElasticity, 0, 1, 0.36),
        softLockThreshold,
        hardLockThreshold,
        lastShift: source.lastShift || '后台推演只写入连续偏移压力，不直接锁线。',
        lastShiftReason: source.lastShiftReason || '后台推演前状态',
        updatedAt: source.updatedAt || '',
    };
}

function summarizeIfRouteForPrompt(state) {
    const logic = normalizedIfRouteLogic(state);
    const profile = backendIfRouteProfiles[logic.dominant] || backendIfRouteProfiles.EnvyMain;
    const pleasure = backendIfRoutePleasureGrammar.routes[logic.dominant] || backendIfRoutePleasureGrammar.routes.EnvyMain;
    const ranking = Object.entries(logic.routePressures)
        .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
        .slice(0, 6)
        .map(([id, score]) => `${backendIfRouteProfiles[id]?.label || id}:${score}`)
        .join(' / ');
    const axisRanking = Object.entries(logic.axisScores || {})
        .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
        .slice(0, 6)
        .map(([id, score]) => `${backendIfRouteAxisRules[id]?.label || id}:${score}`)
        .join(' / ');
    return {
        dominant: logic.dominant,
        dominantLabel: logic.dominantLabel,
        pressure: logic.routePressures[logic.dominant] || 0,
        ranking,
        axisRanking,
        correction: profile.correction,
        pleasure: pleasure.pleasure,
        costShape: pleasure.costShape,
        pleasureDoctrine: backendIfRoutePleasureGrammar.doctrine,
        lastSignals: logic.lastSignals,
        candidateBranches: logic.candidateBranches,
        branchTransition: logic.branchTransition,
        rule: `IF 倾向是世界线爽点连续吸引域，不是随机 AU，也不是路线开关。后台推演应让 NPC、传言、死亡 flag、远方区域和关系机会按当前吸引子产生合理蝴蝶效应；必须同时保留快感、代价和纠偏入口，不得一轮直接锁死路线。当前连续分支偏移率=${logic.branchTransition.divergenceRate}，连续性=${logic.branchTransition.continuityIndex}。`,
    };
}

function selectShards(parallelism, state = {}) {
    const byId = new Map(shardDefinitions.map((shard) => [shard.id, shard]));
    const ifLogic = normalizedIfRouteLogic(state);
    const routeIds = [
        ifLogic.dominant,
        ...Object.entries(ifLogic.routePressures)
            .filter(([id, score]) => id !== ifLogic.dominant && Number(score || 0) >= 3)
            .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
            .map(([id]) => id),
    ];
    const routeShardIds = routeIds.flatMap((id) => backendIfRouteProfiles[id]?.shardIds || []);
    const prioritized = [...new Set([...routeShardIds, ...priorityShardIds])].map((id) => byId.get(id)).filter(Boolean);
    const rest = shardDefinitions.filter((shard) => !priorityShardIds.includes(shard.id));
    return [...prioritized, ...rest.filter((shard) => !prioritized.some((item) => item.id === shard.id))].slice(0, parallelism);
}

function extractJsonObject(text) {
    const raw = String(text || '').trim();
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : raw;
    const first = candidate.indexOf('{');
    const last = candidate.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) {
        throw new Error('No JSON object found in MiMo response.');
    }
    return JSON.parse(candidate.slice(first, last + 1));
}

function extractFieldFromLine(line) {
    const match = line.trim().match(/^"([^"]+)"\s*:\s*"([\s\S]*)"\s*,?$/);
    if (!match) {
        return null;
    }
    return [match[1], match[2].replace(/\\"/g, '"').trim()];
}

function recoverShardJsonFromText(text, shard, error) {
    const raw = String(text || '');
    const sectionStart = raw.indexOf('"privateEvents"');
    const section = sectionStart >= 0 ? raw.slice(sectionStart) : raw;
    const events = [];
    let current = null;

    for (const line of section.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed === '{') {
            current = {};
            continue;
        }
        if (!current) {
            continue;
        }

        const field = extractFieldFromLine(line);
        if (field) {
            const [key, value] = field;
            if (['time', 'location', 'actor', 'action', 'cause', 'visibility', 'playerSignal'].includes(key)) {
                current[key] = value;
            }
        }

        if (trimmed === '},' || trimmed === '}') {
            if (current.action || current.playerSignal) {
                events.push({
                    time: current.time || '未知时段',
                    location: current.location || '未知地点',
                    actor: current.actor || shard.focus,
                    action: current.action || current.playerSignal,
                    cause: current.cause || '由并发世界切片恢复，因果细节需要后续叙事自然补全。',
                    visibility: current.visibility === 'revealable' ? 'revealable' : 'hidden',
                    playerSignal: current.playerSignal || '后续可通过调查、梦境、口误或死亡残响显影。',
                });
            }
            current = null;
        }
    }

    if (events.length === 0 && raw.trim()) {
        events.push({
            time: '未知时段',
            location: '未知地点',
            actor: shard.focus,
            action: truncate(raw.replace(/\s+/g, ' '), 260),
            cause: 'MiMo 返回了非严格 JSON，后端已把原始切片压缩为后台事件。',
            visibility: 'hidden',
            playerSignal: '这条后台事件需要通过后续调查或回看机制自然显影。',
        });
    }

    return {
        shardId: shard.id,
        layer: shard.layer,
        focus: shard.focus,
        privateEvents: events.slice(0, 3),
        relationshipDeltas: {},
        characterCardDeltas: {},
        clues: [],
        risks: [],
        continuityWarnings: [`切片 JSON 已兜底恢复：${error.message}`],
        nextHooks: [],
        recovered: true,
    };
}

function messageContentToText(content) {
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        return content.map((part) => part?.text ?? part?.content ?? '').join('');
    }
    if (content && typeof content === 'object') {
        return content.text ?? content.content ?? JSON.stringify(content);
    }
    return '';
}

function timeoutForSimulationRequest(request, fallback = REQUEST_TIMEOUT_MS) {
    const requested = Number(request?.body?.timeoutMs);
    if (Number.isFinite(requested) && requested >= 1000) {
        return Math.max(1000, Math.min(DEEP_REQUEST_TIMEOUT_MS, Math.round(requested)));
    }
    const intensity = String(request?.body?.intensity || '').toLowerCase();
    if (request?.body?.deepAggregation === true || intensity.includes('deep') || intensity.includes('heavy')) {
        return DEEP_REQUEST_TIMEOUT_MS;
    }
    return fallback;
}

async function fetchMiMo(apiKey, body, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || REQUEST_TIMEOUT_MS));
    try {
        const upstream = await fetch(MIMO_CHAT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        const payloadText = await upstream.text();
        let payload;
        try {
            payload = JSON.parse(payloadText);
        } catch {
            payload = { raw: payloadText };
        }

        if (!upstream.ok) {
            const message = payload?.error?.message || upstream.statusText || 'MiMo request failed.';
            const error = new Error(message);
            error.status = upstream.status;
            error.detail = payload;
            throw error;
        }

        return {
            payload,
            text: messageContentToText(payload?.choices?.[0]?.message?.content)
                || messageContentToText(payload?.choices?.[0]?.message?.reasoning_content)
                || payload?.content?.[0]?.text
                || payload?.raw
                || '',
            usage: payload?.usage || null,
        };
    } finally {
        clearTimeout(timeout);
    }
}

function completionBudgetForIntensity(intensity, fallback = 1100) {
    const value = String(intensity || '').toLowerCase();
    if (value.includes('brief') || value.includes('fast')) {
        return 800;
    }
    if (value.includes('heavy') || value.includes('deep')) {
        return 1600;
    }
    if (value.includes('token-rich')) {
        return 1100;
    }
    return fallback;
}

function buildShardRequest(model, shard, state, recentMessages, intensity) {
    const ifRoute = summarizeIfRouteForPrompt(state);
    const compactIfRoute = {
        dominant: ifRoute.dominant,
        dominantLabel: ifRoute.dominantLabel,
        pressure: ifRoute.pressure,
        pleasure: ifRoute.pleasure,
        costShape: ifRoute.costShape,
        correction: ifRoute.correction,
    };
    const promptState = compactStateForWorldSimulation(state);
    const maxCompletionTokens = completionBudgetForIntensity(intensity, 1100);
    return {
        model,
        messages: [
            {
                role: 'system',
                content: `你是 Re:0 暗黑互动小说的后台世界推演子代理，只模拟一个世界切片，不写玩家正文。
直接输出 JSON object，不要 Markdown，不要解释。privateEvents 必须 1-3 条，每条是同一时间真实发生的后台事实。
规则：尊重 Re:0 核心设定；不复述原作长段；黑暗来自因果、阶级、信息差和错误选择；远方事件只能先变成传言/文书/梦境/价格波动；成人内容只写明确成人的软性氛围和事后影响。
IF 压力：${ifRoute.dominantLabel}；爽点：${ifRoute.pleasure}；代价：${ifRoute.costShape}；纠偏：${ifRoute.correction}。`,
            },
            {
                role: 'user',
                content: JSON.stringify({
                    task: 'simulate_world_shard',
                    shard,
                    intensity,
                    ifRoute: compactIfRoute,
                    currentState: promptState,
                    recentMessages,
                    requiredShape: {
                        shardId: 'same as shard.id',
                        layer: 'same as shard.layer',
                        privateEvents: 'array 1-3: {time, location, actor, action, cause, visibility:hidden|revealable, playerSignal}',
                        relationshipDeltas: 'object, optional',
                        characterCardDeltas: 'object, optional: per character memory/personality/attitudeToPlayer/trust/suspicion/trauma/flags/arcLog',
                        clues: 'array 0-3',
                        risks: 'array 0-3',
                        harmEvents: 'array 0-2: {category, intensity, codedDescription, aftermath}',
                        gameplaySignals: 'object: objectiveChanges/resourceChanges/statusEffects/openQuestions/actionHints/failurePressure/reversalReadinessDelta/bankedAdvantages',
                        reversalOpportunities: 'array 0-3',
                        continuityWarnings: 'array 0-2',
                        nextHooks: 'array 1-3',
                    },
                }, null, 2),
            },
        ],
        max_completion_tokens: maxCompletionTokens,
        temperature: 0.55,
        top_p: 0.95,
        response_format: { type: 'json_object' },
        reasoning_effort: 'low',
        stream: false,
    };
}

function buildAggregatorRequest(model, state, recentMessages, shardResults) {
    const ifRoute = summarizeIfRouteForPrompt(state);
    const promptState = compactStateForWorldSimulation(state);
    return {
        model,
        messages: [
            {
                role: 'system',
                content: `你是 Re:0 暗黑小说冒险游戏的世界服务器汇总器。
你会收到多个并发世界切片。你的任务是把它们收束成“可写回状态块”的权威补丁，保证因果一致、角色不崩、主线收束仍存在、随机性来自蝴蝶效应。
当前 IF 吸引子：${ifRoute.dominantLabel}，压力排行：${ifRoute.ranking}，分歧变量：${ifRoute.axisRanking}。该线爽点为「${ifRoute.pleasure}」，代价形状为「${ifRoute.costShape}」。汇总时必须保留 IF 倾向的因果影响和玩家快感入口，但只能作为压力和候选，不得无因果直接锁线。ifRouteLogic 只允许根据 shard 结果里的真实事件、风险、线索、角色变化或纠偏行动更新；不得因 selected shard id 或 focus 文本自我强化。
你不写玩家正文，不替玩家行动，不剧透隐藏终局。只输出单个 JSON 对象，不要 Markdown。数组保留最高价值的 12 项以内，每个字符串尽量少于 100 个汉字。字符串内部不要使用英文双引号，需引用概念时用中文书名号。`,
            },
            {
                role: 'user',
                content: JSON.stringify({
                    task: 'aggregate_world_simulation_patch',
                    currentState: promptState,
                    ifRoute,
                    recentMessages,
                    shardResults,
                    outputSchema: {
                        worldPulses: [
                            {
                                tick: '数字或短 ID',
                                shardId: '来源切片',
                                day: 1,
                                time: '时段',
                                location: '地点',
                                actor: '角色或阵营',
                                visibility: 'hidden|revealable',
                                summary: '后台发生的事实',
                                futureSignal: '玩家可推理到的表层信号',
                                causalTags: ['伏笔/资源/误会/派系/死亡残响'],
                            },
                        ],
                        daySchedule: [
                            {
                                time: '时段',
                                location: '地点',
                                actor: '角色或阵营',
                                visibility: 'main|revealable|hidden',
                                event: '会影响当日的事件',
                            },
                        ],
                        offscreenArchive: [
                            {
                                day: 1,
                                type: 'world-sim',
                                visibility: 'revealable|hidden',
                                summary: '可回看的幕后摘要',
                            },
                        ],
                        discoveredClues: ['只包含玩家已经可合理获得或被状态机允许记录的线索'],
                        relationships: { '角色名': '更新后的关系状态' },
                        characterCards: {
                            '角色名': {
                                memory: ['存档绑定记忆变化'],
                                personality: '性格偏移',
                                attitudeToPlayer: '对主角态度',
                                trust: 0,
                                suspicion: 0,
                                trauma: 0,
                                affection: 0,
                                desire: 0,
                                intimacyExperience: '本存档亲密/关系经验',
                                intimacyHistory: ['本存档亲密/关系经验日志，追加而非覆盖'],
                                sexualKinks: ['成人 AU 下的癖好/亲密取向'],
                                hobbies: ['普通爱好/偏好'],
                                routeStrategy: '攻略/关系推进方式',
                                flags: ['状态标签'],
                                arcLog: ['关键事件日志'],
                                lastUpdatedDay: 1,
                            },
                        },
                        convergenceNodes: [
                            { id: 'C1', name: '节点名', window: '时间窗', strength: 'strong|soft|future-attractor', status: 'active|looming|dormant|resolved', rule: '收束规则' },
                        ],
                        chaos: {
                            entropy: 0.26,
                            butterflyLog: ['新的蝴蝶效应日志'],
                        },
                        simulation: {
                            summary: '本次并发推演总览',
                            riskLevel: 'low|medium|high|catastrophic',
                            nextRecommendedFocus: ['下一次最值得模拟的切片'],
                        },
                        darkRealism: {
                            harmLedger: [
                                {
                                    day: 1,
                                    category: 'violence|coercion|debt|class|adult_soft|trauma',
                                    intensity: 'low|medium|high',
                                    codedDescription: '委婉但清楚的事实',
                                    aftermath: '后果',
                                    revealability: 'hidden|revealable',
                                },
                            ],
                            reversalBank: ['可通过正确行动触发的强势反转'],
                        },
                        worldScope: {
                            pendingRegionalHooks: ['远方区域或群众模板可在后续显影的钩子'],
                        },
                        ifRouteLogic: {
                            dominant: '当前主导 IF 吸引子',
                            routePressures: { Pride: 0, Wrath: 0, Sloth: 0, Greed: 0, Gluttony: 0 },
                            routeMomentum: { Pride: 0, Wrath: 0, Sloth: 0, Greed: 0, Gluttony: 0 },
                            axisScores: { supportDeficit: 0, trustCollapse: 0, responsibilityEvasion: 0, deathInstrumentality: 0, evidenceNetwork: 1 },
                            lastSignals: ['本次世界推演中触发 IF 压力的信号'],
                            driftLedger: [{ route: 'Pride', delta: 1, reason: '真实剧情信号', text: '不超过80字' }],
                            correctionLedger: [{ route: 'Pride', delta: -1, reason: '纠偏行动', text: '不超过80字' }],
                            candidateBranches: [
                                { id: 'Pride', label: '傲慢 IF', score: 0, logic: '为什么靠近该分支', correction: '如何拉回主线' },
                            ],
                            softLocks: [{ id: 'Pride', label: '傲慢 IF', score: 9, level: 'strong-attractor', requiredCorrection: '纠偏入口' }],
                            lastShift: 'IF 倾向变化解释',
                        },
                        gameplay: {
                            activeObjective: '当前最该推进的主目标',
                            objectiveStage: '当前阶段',
                            tension: 0,
                            resources: { coins: 0, food: 0, shelter: '无', evidence: 0, favors: 0, reputation: '无名' },
                            inventory: ['新增或保留的关键物品'],
                            statusEffects: ['状态异常'],
                            openQuestions: ['线索板未解问题'],
                            actionHints: ['自然行动方向'],
                            failurePressure: ['失败压力'],
                            payoff: { reversalReadiness: 0, nextBreakthrough: '下一突破口', bankedAdvantages: ['已攒优势'] },
                            lastOutcome: '本次推演给玩家造成的局势变化',
                        },
                        flags: {
                            systemNotice: '给下一轮叙事模型的简短后台提示',
                        },
                    },
                }, null, 2),
            },
        ],
        max_completion_tokens: 2600,
        temperature: 0.35,
        top_p: 0.9,
        response_format: { type: 'json_object' },
        reasoning_effort: 'low',
        stream: false,
    };
}

function normalizeHarmEvent(event, result, day) {
    const text = `${event?.codedDescription || ''} ${event?.aftermath || ''}`;
    const category = event?.category || 'none';
    const minorCue = /(未成年|孩子|孩童|小孩|儿童|幼女|小女孩|孤儿)/.test(text);
    if (minorCue && category === 'adult_soft') {
        return null;
    }

    return {
        day,
        source: result.shardId,
        category,
        intensity: event?.intensity || 'medium',
        codedDescription: event?.codedDescription || event?.aftermath || '后台残酷事件需要后续自然显影。',
        aftermath: event?.aftermath || '后果待后续推演落地。',
        revealability: event?.revealability || 'hidden',
    };
}

function isLikelyCharacterName(name) {
    const text = String(name || '').trim();
    if (!text || text.length > 24) {
        return false;
    }
    if (/(视为实体|钟楼|王都|贫民区|救济院|盗品蔵|王城|宅邸|地点|阵营|骑士团|魔女教|商会|帮|团伙|组织|世界线|奥德拉格纳|嫉妒魔女|福音书|账本|契约|证据|债务|硬币|徽章)/.test(text)) {
        return false;
    }
    return true;
}

function splitActorNames(actor) {
    return String(actor || '')
        .split(/[、,，/]|与|和/)
        .map((name) => name.trim())
        .filter((name) => isLikelyCharacterName(name));
}

function normalizeCharacterCardDelta(name, delta, day, source) {
    if (!delta || typeof delta !== 'object' || !isLikelyCharacterName(name)) {
        return null;
    }

    const numberOrUndefined = (value) => {
        const number = Number(value);
        return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : undefined;
    };

    return {
        name,
        memory: Array.isArray(delta.memory) ? delta.memory.slice(0, 6) : Array.isArray(delta.memoryChanges) ? delta.memoryChanges.slice(0, 6) : [],
        personality: delta.personality,
        attitudeToPlayer: delta.attitudeToPlayer,
        trust: numberOrUndefined(delta.trust),
        suspicion: numberOrUndefined(delta.suspicion),
        trauma: numberOrUndefined(delta.trauma),
        affection: numberOrUndefined(delta.affection ?? delta.affinity),
        desire: numberOrUndefined(delta.desire ?? delta.emotionalValue ?? delta.emotionalDesire),
        intimacyExperience: delta.intimacyExperience || delta.sexualExperience,
        intimacyHistory: Array.isArray(delta.intimacyHistory) ? delta.intimacyHistory.slice(0, 6) : Array.isArray(delta.intimacyExperiences) ? delta.intimacyExperiences.slice(0, 6) : [],
        sexualKinks: Array.isArray(delta.sexualKinks) ? delta.sexualKinks.slice(0, 8) : Array.isArray(delta.kinks) ? delta.kinks.slice(0, 8) : Array.isArray(delta.intimatePreferences) ? delta.intimatePreferences.slice(0, 8) : [],
        hobbies: Array.isArray(delta.hobbies) ? delta.hobbies.slice(0, 8) : Array.isArray(delta.likes) ? delta.likes.slice(0, 8) : Array.isArray(delta.preferences) ? delta.preferences.slice(0, 8) : [],
        routeStrategy: delta.routeStrategy,
        flags: Array.isArray(delta.flags) ? delta.flags.slice(0, 8) : [],
        arcLog: Array.isArray(delta.arcLog) ? delta.arcLog.slice(0, 8) : [`第${day}日：${source} 切片记录了该角色的状态变化。`],
        lastUpdatedDay: day,
        saveBound: true,
    };
}

function mergeCardPatch(target, source) {
    const asArray = (value) => Array.isArray(value) ? value : [];
    for (const [name, card] of Object.entries(source)) {
        if (!card) {
            continue;
        }
        const current = target[name] || { name, memory: [], flags: [], arcLog: [] };
        target[name] = {
            ...current,
            ...Object.fromEntries(Object.entries(card).filter(([, value]) => value !== undefined && value !== null && value !== '')),
            memory: [...new Set([...(current.memory || []), ...(card.memory || [])])].slice(-14),
            intimacyHistory: [...new Set([...(current.intimacyHistory || []), ...(card.intimacyHistory || []), card.intimacyExperience, card.sexualExperience].filter(Boolean))].slice(-8),
            sexualKinks: [...new Set([...asArray(current.sexualKinks || current.kinks || current.intimatePreferences), ...asArray(card.sexualKinks || card.kinks || card.intimatePreferences)])].slice(-10),
            hobbies: [...new Set([...asArray(current.hobbies || current.likes || current.preferences), ...asArray(card.hobbies || card.likes || card.preferences)])].slice(-10),
            flags: [...new Set([...(current.flags || []), ...(card.flags || [])])].slice(-12),
            arcLog: [...new Set([...(current.arcLog || []), ...(card.arcLog || [])])].slice(-18),
            saveBound: true,
        };
    }
}

const FAR_LAYERS = new Set(['continent', 'region', 'population']);
const FAR_SHARD_PREFIXES = ['continent_', 'region_', 'population_', 'living_world_'];

function isFarShard(shardId, layer) {
    if (FAR_LAYERS.has(String(layer || ''))) {
        return true;
    }
    const id = String(shardId || '');
    return FAR_SHARD_PREFIXES.some((prefix) => id.startsWith(prefix));
}

function buildRumorChannel(pulse) {
    const actor = String(pulse.actor || '').slice(0, 18);
    const location = String(pulse.location || '').slice(0, 24);
    const signal = String(pulse.futureSignal || pulse.summary || '').slice(0, 80);
    const shard = String(pulse.shardId || '');
    let channel = '商路传言';
    if (shard.includes('kararagi')) channel = '卡拉拉基商路传言';
    else if (shard.includes('vollachia')) channel = '佛拉基亚商旅信件';
    else if (shard.includes('gusteko')) channel = '雪原朝圣者口供';
    else if (shard.includes('priestella')) channel = '普利斯提拉魔矿商汇报';
    else if (shard.includes('watchtower')) channel = '边境梦境残响';
    else if (shard.includes('population') || shard.includes('living_world')) channel = '王都市井闲话';
    else if (shard.includes('region')) channel = '区域文书延迟';
    return {
        channel,
        from: actor || location || '匿名旅人',
        text: signal || '远方传来一句没有解释的话。',
        shardId: shard,
        location,
    };
}

function clampRoutePressure(value) {
    return Math.max(0, Math.min(30, Math.round(Number(value) || 0)));
}

function ifRoutePressureLevel(score) {
    const value = Number(score || 0);
    if (value >= 14) return 'lock-risk';
    if (value >= 9) return 'strong-attractor';
    if (value >= 5) return 'branch-drift';
    if (value >= 1) return 'seed';
    return 'neutral';
}

function ifRouteSignalTextFromShardResult(result) {
    const json = result?.json && typeof result.json === 'object' ? result.json : {};
    return truncate(JSON.stringify({
        privateEvents: json.privateEvents,
        relationshipDeltas: json.relationshipDeltas,
        characterCardDeltas: json.characterCardDeltas,
        clues: json.clues,
        risks: json.risks,
        harmEvents: json.harmEvents,
        gameplaySignals: json.gameplaySignals,
        reversalOpportunities: json.reversalOpportunities,
        continuityWarnings: json.continuityWarnings,
        nextHooks: json.nextHooks,
    }), 2200);
}

function buildIfRoutePatchFromWorldSim(state, shardResults, pulses, risks, hooks) {
    const current = normalizedIfRouteLogic(state);
    const routePressures = { ...current.routePressures };
    const routeMomentum = { ...current.routeMomentum };
    const axisScores = { ...current.axisScores };
    const sourceText = [
        ...pulses.map((pulse) => `${pulse.actor} ${pulse.location} ${pulse.summary} ${pulse.futureSignal} ${(pulse.causalTags || []).join(' ')}`),
        ...risks,
        ...hooks,
        ...shardResults.map(ifRouteSignalTextFromShardResult),
    ].join(' ');
    const signals = [];
    const driftLedger = [];
    const correctionLedger = [];
    for (const [id, profile] of Object.entries(backendIfRouteProfiles)) {
        const hits = (profile.patterns || []).filter((pattern) => pattern.test(sourceText)).length;
        const counters = (profile.counterPatterns || []).filter((pattern) => pattern.test(sourceText)).length;
        const rawDelta = Math.max(-3, Math.min(3, hits - counters));
        if (!rawDelta) {
            continue;
        }
        routeMomentum[id] = Math.max(-12, Math.min(12, Math.round(Number(routeMomentum[id] || 0) * 0.55 + rawDelta)));
        const momentumBonus = rawDelta > 0 && routeMomentum[id] >= 4 ? 1 : rawDelta < 0 && routeMomentum[id] <= -3 ? -1 : 0;
        const delta = rawDelta + momentumBonus;
        routePressures[id] = clampRoutePressure(Number(routePressures[id] || 0) + delta);
        if (id === 'EnvyMain' && hits) {
            for (const routeId of Object.keys(backendIfRouteProfiles)) {
                if (routeId !== 'EnvyMain') {
                    routePressures[routeId] = clampRoutePressure(Number(routePressures[routeId] || 0) - 1);
                }
            }
        }
        if (id !== 'EnvyMain' && counters) {
            routePressures.EnvyMain = clampRoutePressure(Number(routePressures.EnvyMain || 0) + 1);
        }
        const ledgerItem = {
            route: id,
            label: profile.label,
            delta,
            source: 'worldSim',
            reason: delta > 0 ? '后台真实事件强化 IF 吸引子' : profile.correction,
            text: truncate(sourceText, 180),
        };
        if (delta > 0 && id !== 'EnvyMain') {
            driftLedger.push(ledgerItem);
        } else {
            correctionLedger.push(ledgerItem);
        }
        signals.push(`${profile.label}${delta > 0 ? '+' : ''}${delta}（后台推演，命中${hits}/纠偏${counters}）`);
    }
    for (const [axisId, axis] of Object.entries(backendIfRouteAxisRules)) {
        const hits = (axis.patterns || []).filter((pattern) => pattern.test(sourceText)).length;
        const counters = (axis.counterPatterns || []).filter((pattern) => pattern.test(sourceText)).length;
        const axisDelta = Math.max(-4, Math.min(4, hits - counters));
        if (!axisDelta) {
            continue;
        }
        axisScores[axisId] = clampRoutePressure(Number(axisScores[axisId] || 0) + axisDelta);
        for (const [routeId, routeWeight] of Object.entries(axis.routeDeltas || {})) {
            if (!backendIfRouteProfiles[routeId]) {
                continue;
            }
            const routeDelta = Math.round(axisDelta * Number(routeWeight || 0));
            if (!routeDelta) {
                continue;
            }
            routePressures[routeId] = clampRoutePressure(Number(routePressures[routeId] || 0) + routeDelta);
            routeMomentum[routeId] = Math.max(-12, Math.min(12, Math.round(Number(routeMomentum[routeId] || 0) + Math.max(-2, Math.min(2, routeDelta)))));
        }
        const ledgerItem = {
            route: axisId,
            label: axis.label,
            delta: axisDelta,
            source: 'worldSim-axis',
            reason: axisDelta > 0 ? '后台真实事件强化分歧变量' : '后台真实事件出现纠偏变量',
            text: truncate(sourceText, 180),
        };
        if (axisDelta > 0 && axisId !== 'evidenceNetwork') {
            driftLedger.push(ledgerItem);
        } else {
            correctionLedger.push(ledgerItem);
        }
        signals.push(`${axis.label}${axisDelta > 0 ? '+' : ''}${axisDelta}（分歧变量）`);
    }
    if (!signals.length) {
        return null;
    }
    const dominant = Object.entries(routePressures)
        .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))[0]?.[0] || 'EnvyMain';
    const dominantProfile = backendIfRouteProfiles[dominant] || backendIfRouteProfiles.EnvyMain;
    const candidateBranches = Object.entries(routePressures)
        .filter(([id, score]) => id !== 'EnvyMain' && Number(score || 0) >= 3)
        .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
        .slice(0, 6)
        .map(([id, score]) => ({
            id,
            label: backendIfRouteProfiles[id]?.label || id,
            score,
            logic: `后台世界推演出现了接近「${backendIfRouteProfiles[id]?.label || id}」的行动、传言或死亡压力。`,
            correction: backendIfRouteProfiles[id]?.correction || '用证据、同伴和可逆行动拉回主线。',
        }));
    const softLocks = Object.entries(routePressures)
        .filter(([id, score]) => id !== 'EnvyMain' && Number(score || 0) >= 9)
        .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
        .slice(0, 5)
        .map(([id, score]) => ({
            id,
            label: backendIfRouteProfiles[id]?.label || id,
            score,
            level: ifRoutePressureLevel(score),
            requiredCorrection: backendIfRouteProfiles[id]?.correction || '用证据、同伴和可逆行动拉回主线。',
        }));
    const branchTransition = normalizeBackendBranchTransition(current.branchTransition, routePressures, axisScores);
    branchTransition.lastShiftReason = signals.slice(0, 3).join('；') || '后台推演信号';
    branchTransition.lastShift = `后台连续分支偏移率=${branchTransition.divergenceRate}，连续性=${branchTransition.continuityIndex}；这只是吸引域漂移，不是硬切路线。`;
    branchTransition.updatedAt = new Date().toISOString();
    return {
        dominant,
        dominantLabel: dominantProfile.label,
        level: ifRoutePressureLevel(routePressures[dominant]),
        routePressures,
        routeMomentum,
        axisScores,
        branchTransition,
        lastSignals: signals,
        driftLedger,
        correctionLedger,
        candidateBranches,
        softLocks,
        lastShift: `后台世界推演更新 IF 倾向：${dominantProfile.label} / ${ifRoutePressureLevel(routePressures[dominant])} / 压力 ${routePressures[dominant]}；连续偏移率 ${branchTransition.divergenceRate}。${signals.slice(0, 4).join('；')}`,
    };
}

function buildDeterministicShardFallback(state, result, index = 0) {
    const current = state?.current || {};
    const day = Number(current.day) || 1;
    const time = current.time || current.timeOfDay || '当前时段';
    const location = current.location || current.scene || '当前区域';
    const far = isFarShard(result?.shardId, result?.layer);
    const actor = far
        ? '远方区域传言'
        : truncate(String(result?.focus || result?.shardId || '后台世界切片').split(/[：:]/)[0], 32);
    const shardLabel = truncate(result?.focus || result?.shardId || '未知切片', 80);
    const localSignal = `${location} 的异常没有停止：${shardLabel} 仍在同一时间推进，只是本轮需要用保守因果补全。`;
    const farSignal = `${shardLabel} 暂时只能通过商路传言、文书延迟或梦境残响进入玩家视野。`;
    return {
        ...result,
        json: {
            shardId: result?.shardId || `fallback_${index}`,
            layer: result?.layer || 'fallback',
            focus: result?.focus || '本地保守推演',
            privateEvents: [
                {
                    time,
                    location: far ? '远方区域' : location,
                    actor,
                    action: far ? farSignal : localSignal,
                    cause: '上游世界推演子代理超时或失败，后端使用当前状态、收束节点和角色动机生成保守事实，避免世界时间空转。',
                    visibility: far ? 'hidden' : 'revealable',
                    playerSignal: far
                        ? '下一次进入旅店、商路、救济院或王都公告时，可听到这条远方传言的变体。'
                        : '玩家可以立刻通过观察现场、询问目击者或核对时间差验证这条异常。',
                },
            ],
            relationshipDeltas: {},
            characterCardDeltas: {},
            clues: far ? [] : [`第${day}日${time}：${location} 的后台推演降级，但异常仍被记录为可验证线索。`],
            risks: ['世界推演子代理未返回完整事实，保守推演会提高信息差风险。'],
            harmEvents: [],
            gameplaySignals: {
                objectiveChanges: [],
                resourceChanges: {},
                statusEffects: ['后台推演降级：信息差风险上升'],
                openQuestions: [`为什么 ${actor} 的行动只能留下间接信号？`],
                actionHints: far ? ['通过旅人、商路价格、王都公告或梦境残响核验远方传言。'] : ['先把当前场景的时间、人物、物证三者对齐，避免被错误线索带走。'],
                failurePressure: ['若继续推进时间而不核验降级线索，明日可能以误会、证据消失或 NPC 抢先行动的形式收费。'],
                reversalReadinessDelta: 0,
                bankedAdvantages: [],
            },
            reversalOpportunities: ['用死亡残响与现实证据交叉验证，可把降级推演中的信息差转化为反打筹码。'],
            continuityWarnings: [`世界推演切片降级：${truncate(result?.error || 'unknown error', 120)}`],
            nextHooks: far ? ['远方传言核验'] : ['当前场景证据核验'],
            fallback: true,
        },
    };
}

function hasUsableShardJson(result) {
    const json = result?.json;
    if (!json || json.parseError) {
        return false;
    }
    return [
        json.privateEvents,
        json.clues,
        json.risks,
        json.nextHooks,
        json.reversalOpportunities,
        json.harmEvents,
    ].some((value) => Array.isArray(value) && value.length > 0)
        || (json.relationshipDeltas && Object.keys(json.relationshipDeltas).length > 0)
        || (json.characterCardDeltas && Object.keys(json.characterCardDeltas).length > 0)
        || (json.gameplaySignals && Object.keys(json.gameplaySignals).some((key) => {
            const value = json.gameplaySignals[key];
            return Array.isArray(value) ? value.length > 0 : Boolean(value && typeof value === 'object' ? Object.keys(value).length : value);
        }));
}

function localPatchFromShards(state, shardResults) {
    const day = Number(state?.current?.day) || 1;
    const time = state?.current?.time || '未知时段';
    const existingSchedule = Array.isArray(state?.daySchedule) ? state.daySchedule : [];
    const effectiveShardResults = shardResults.map((result, index) => (
        hasUsableShardJson(result) ? result : buildDeterministicShardFallback(state, result, index)
    ));
    const parsed = effectiveShardResults.filter((result) => result?.json && !result.json.parseError);
    const rumorEntries = [];
    const pulses = effectiveShardResults
        .flatMap((result) => (Array.isArray(result?.json?.privateEvents) ? result.json.privateEvents.slice(0, 3).map((event, index) => {
            const far = isFarShard(result.shardId, result.layer);
            const rawVisibility = event.visibility === 'revealable' ? 'revealable' : 'hidden';
            const visibility = far ? 'hidden' : rawVisibility;
            const pulse = {
                tick: `sim-${Date.now().toString(36)}-${result.shardId}-${index}`,
                shardId: result.shardId,
                day,
                time: event.time || time,
                location: event.location || '未知地点',
                actor: event.actor || result.shardId,
                visibility,
                summary: event.action || event.playerSignal || '后台切片产生了未公开变动。',
                futureSignal: event.playerSignal || '后续可由调查、梦境或他人口误揭示。',
                causalTags: ['并发推演', result.layer || 'unknown', far ? 'far-region' : 'local'],
            };
            if (far && rawVisibility === 'revealable') {
                rumorEntries.push(buildRumorChannel(pulse));
            }
            return pulse;
        }) : []))
        .slice(0, 24);

    const relationshipDeltas = parsed.reduce((accumulator, result) => {
        if (result.json.relationshipDeltas && typeof result.json.relationshipDeltas === 'object') {
            Object.assign(accumulator, result.json.relationshipDeltas);
        }
        return accumulator;
    }, {});
    const characterCards = {};
    for (const result of parsed) {
        if (result.json.characterCardDeltas && typeof result.json.characterCardDeltas === 'object') {
            const normalized = {};
            for (const [name, delta] of Object.entries(result.json.characterCardDeltas)) {
                const card = normalizeCharacterCardDelta(name, delta, day, result.shardId);
                if (card) {
                    normalized[name] = card;
                }
            }
            mergeCardPatch(characterCards, normalized);
        }
    }
    for (const [name, relationship] of Object.entries(relationshipDeltas)) {
        if (!isLikelyCharacterName(name)) {
            continue;
        }
        mergeCardPatch(characterCards, {
            [name]: {
                name,
                attitudeToPlayer: relationship,
                memory: [`第${day}日：关系状态变化为「${relationship}」。`],
                arcLog: [`第${day}日：并发推演记录其对主角态度发生变化。`],
                lastUpdatedDay: day,
                saveBound: true,
            },
        });
    }
    for (const pulse of pulses) {
        for (const name of splitActorNames(pulse.actor)) {
            mergeCardPatch(characterCards, {
                [name]: {
                    name,
                    memory: [`第${day}日 ${pulse.time}：${pulse.summary}`],
                    attitudeToPlayer: relationshipDeltas[name] || undefined,
                    flags: pulse.causalTags || [],
                    arcLog: [`第${day}日：后台世界脉冲记录其在 ${pulse.location} 的行动；可显影信号：${pulse.futureSignal}`],
                    lastUpdatedDay: day,
                    saveBound: true,
                },
            });
        }
    }

    const clues = [...new Set(parsed.flatMap((result) => Array.isArray(result.json.clues) ? result.json.clues : []).filter(Boolean))].slice(0, 24);
    const risks = [...new Set(parsed.flatMap((result) => Array.isArray(result.json.risks) ? result.json.risks : []).filter(Boolean))].slice(0, 12);
    const harmLedger = parsed.flatMap((result) => (Array.isArray(result.json.harmEvents) ? result.json.harmEvents : [])
        .map((event) => normalizeHarmEvent(event, result, day)))
        .filter((event) => event && event.category !== 'none')
        .slice(0, 18);
    const reversalBank = [...new Set(parsed.flatMap((result) => Array.isArray(result.json.reversalOpportunities) ? result.json.reversalOpportunities : []).filter(Boolean))].slice(0, 12);
    const hooks = [...new Set(parsed.flatMap((result) => Array.isArray(result.json.nextHooks) ? result.json.nextHooks : []).filter(Boolean))].slice(0, 8);
    const warnings = [...new Set(parsed.flatMap((result) => Array.isArray(result.json.continuityWarnings) ? result.json.continuityWarnings : []).filter(Boolean))].slice(0, 8);
    const regionalHooks = [...new Set(pulses
        .filter((pulse) => ['continent', 'region', 'population'].some((layer) => String(pulse.shardId || '').includes(layer) || pulse.causalTags?.includes(layer)))
        .map((pulse) => `${pulse.location}：${pulse.futureSignal || pulse.summary}`)
        .filter(Boolean))]
        .slice(0, 10);
    const gameplaySignals = parsed
        .map((result) => result.json.gameplaySignals)
        .filter((signal) => signal && typeof signal === 'object');
    const signalList = (key, limit = 12) => [...new Set(gameplaySignals
        .flatMap((signal) => Array.isArray(signal[key]) ? signal[key] : [])
        .filter(Boolean))]
        .slice(0, limit);
    const objectiveChanges = signalList('objectiveChanges', 6);
    const statusEffects = signalList('statusEffects', 10);
    let openQuestions = [...new Set([
        ...signalList('openQuestions', 12),
        ...clues.slice(0, 8).map((clue) => `线索待验证：${clue}`),
    ])].slice(0, 16);
    if (!openQuestions.length && pulses.length) {
        openQuestions = pulses.slice(0, 8).map((pulse) => `为什么 ${pulse.actor} 会在 ${pulse.location} 留下「${truncate(pulse.futureSignal || pulse.summary, 42)}」？`);
    }
    let actionHints = [...new Set([
        ...signalList('actionHints', 12),
        ...hooks.slice(0, 6),
        ...reversalBank.slice(0, 4).map((item) => `为反转蓄力：${item}`),
    ])].slice(0, 14);
    if (!actionHints.length && pulses.length) {
        actionHints = pulses
            .filter((pulse) => pulse.visibility === 'revealable')
            .slice(0, 8)
            .map((pulse) => `调查 ${pulse.location}：${truncate(pulse.futureSignal || pulse.summary, 56)}`);
    }
    if (!actionHints.length && pulses.length) {
        actionHints = pulses.slice(0, 4).map((pulse) => `核验 ${pulse.location} 的异常：找人证、梦境残响或物证确认「${truncate(pulse.summary, 42)}」。`);
    }
    let failurePressure = [...new Set([
        ...signalList('failurePressure', 12),
        ...risks.slice(0, 8),
        ...harmLedger.slice(0, 4).map((item) => `${item.category}/${item.intensity} 后果正在发酵：${item.aftermath}`),
    ])].slice(0, 14);
    if (!failurePressure.length && pulses.some((pulse) => pulse.visibility === 'hidden')) {
        failurePressure = ['已有隐藏幕后事实开始推进；若不调查可揭示信号，明日会以误会、迟到或证据消失的形式收费。'];
    }
    const currentGameplay = state?.gameplay || {};
    const currentResources = currentGameplay.resources || {};
    const resources = {
        coins: Number(currentResources.coins || 0),
        food: Number(currentResources.food || 0),
        shelter: currentResources.shelter || '无',
        evidence: Number(currentResources.evidence || 0),
        favors: Number(currentResources.favors || 0),
        reputation: currentResources.reputation || '无名异乡人',
    };
    for (const signal of gameplaySignals) {
        const changes = signal.resourceChanges && typeof signal.resourceChanges === 'object' ? signal.resourceChanges : {};
        for (const key of ['coins', 'food', 'evidence', 'favors']) {
            if (Number.isFinite(Number(changes[key]))) {
                resources[key] = clampNumber(resources[key] + Number(changes[key]), -99, 999, resources[key]);
            }
        }
        if (changes.shelter) {
            resources.shelter = String(changes.shelter).slice(0, 80);
        }
        if (changes.reputation) {
            resources.reputation = String(changes.reputation).slice(0, 80);
        }
    }
    if (clues.length) {
        resources.evidence = clampNumber(resources.evidence + Math.min(3, clues.length), -99, 999, resources.evidence);
    }
    const reversalDelta = gameplaySignals.reduce((total, signal) => total + (Number(signal.reversalReadinessDelta) || 0), 0);
    const baseTension = Number(currentGameplay.tension || 42);
    const tension = Math.round(clampNumber(baseTension + risks.length * 4 + harmLedger.length * 3 + warnings.length * 2 - reversalBank.length, 0, 100, 42));
    const baseReadiness = Number(currentGameplay.payoff?.reversalReadiness || 0);
    const reversalReadiness = Math.round(clampNumber(baseReadiness + reversalDelta + reversalBank.length * 5 + clues.length * 2, 0, 100, baseReadiness));
    const bankedAdvantages = [...new Set([
        ...(Array.isArray(currentGameplay.payoff?.bankedAdvantages) ? currentGameplay.payoff.bankedAdvantages : []),
        ...signalList('bankedAdvantages', 8),
        ...reversalBank.slice(0, 4),
    ])].slice(-12);
    const pulseSchedule = pulses.slice(0, 12).map((pulse) => ({
        time: pulse.time,
        location: pulse.location,
        actor: pulse.actor,
        visibility: pulse.visibility === 'revealable' ? 'revealable' : 'hidden',
        event: `${pulse.summary}${pulse.futureSignal ? `；可显影信号：${pulse.futureSignal}` : ''}`,
    }));
    const riskLevel = risks.length >= 8 ? 'catastrophic' : risks.length >= 5 ? 'high' : risks.length >= 2 ? 'medium' : 'low';
    const failedCount = shardResults.filter((item) => !item.ok).length;
    const fallbackCount = parsed.filter((item) => item?.json?.fallback).length;
    const ifRoutePatch = buildIfRoutePatchFromWorldSim(state, effectiveShardResults, pulses, risks, hooks);

    return {
        worldPulses: pulses,
        daySchedule: [...existingSchedule, ...pulseSchedule].slice(-16),
        offscreenArchive: pulses.map((pulse) => ({
            day,
            type: 'world-sim',
            visibility: pulse.visibility,
            summary: `${pulse.time} / ${pulse.location} / ${pulse.actor}: ${pulse.futureSignal}`,
        })),
        discoveredClues: clues,
        relationships: relationshipDeltas,
        characterCards,
        darkRealism: {
            harmLedger,
            reversalBank,
        },
        worldScope: (regionalHooks.length || rumorEntries.length) ? {
            pendingRegionalHooks: regionalHooks,
            activeRumors: rumorEntries.slice(0, 8),
        } : undefined,
        ifRouteLogic: ifRoutePatch || undefined,
        worldline: ifRoutePatch ? {
            ifAttractor: ifRoutePatch.dominantLabel,
            ifRoutePressure: ifRoutePatch.routePressures?.[ifRoutePatch.dominant] || 0,
            lastShift: ifRoutePatch.lastShift,
        } : undefined,
        gameplay: {
            activeObjective: objectiveChanges[0] || currentGameplay.activeObjective || '把当前异常转化为可验证证据，避免被世界线牵着走。',
            objectiveStage: objectiveChanges[1] || currentGameplay.objectiveStage || `第${day}日 ${time}`,
            tension,
            resources,
            inventory: Array.isArray(currentGameplay.inventory) ? currentGameplay.inventory : [],
            statusEffects,
            openQuestions,
            actionHints,
            failurePressure,
            payoff: {
                reversalReadiness,
                nextBreakthrough: actionHints[0] || reversalBank[0] || currentGameplay.payoff?.nextBreakthrough || '找到一条能让别人相信的外部证据。',
                bankedAdvantages,
            },
            lastOutcome: `世界推演落盘：${pulses.length} 条后台事实、${risks.length} 个风险、${reversalBank.length} 个反转机会进入线索板。`,
        },
        chaos: {
            butterflyLog: [
                `并发世界推演完成：${shardResults.length} 个切片，成功 ${shardResults.filter((item) => item.ok).length} 个，降级兜底 ${fallbackCount} 个，生成世界脉冲 ${pulses.length} 条。`,
                ...warnings.map((warning) => `一致性警告：${warning}`),
            ].slice(0, 8),
        },
        simulation: {
            summary: `本轮并发模拟了 ${shardResults.length} 个世界切片，成功 ${shardResults.length - failedCount} 个，降级 ${fallbackCount} 个，生成 ${pulses.length} 条事实脉冲、${harmLedger.length} 条残酷后果、${reversalBank.length} 个反转机会；主要风险：${risks.slice(0, 3).join('；') || '暂无显性风险'}。`,
            riskLevel,
            nextRecommendedFocus: hooks.length ? hooks : effectiveShardResults.slice(0, 4).map((item) => item.shardId),
        },
        flags: {
            systemNotice: `后台并发推演已写入${fallbackCount ? `，其中 ${fallbackCount} 个切片使用本地保守兜底` : ''}。叙事时必须使用 worldPulses 和 darkRealism；残酷内容用委婉但有冲击的方式显影，并保留正确分支的强势反转机会。${ifRoutePatch ? ` IF 倾向：${ifRoutePatch.lastShift}` : ''}`,
        },
    };
}

function buildVisualPromptRequest(model, state, sceneCharactersInput = []) {
    const current = state.current || {};
    const gameplay = state.gameplay || {};
    const adult = state.adultContent || {};
    const sceneCharacters = Array.isArray(sceneCharactersInput) && sceneCharactersInput.length
        ? sceneCharactersInput.slice(0, 6)
        : requestSceneCharacters(state);
    return {
        model,
        messages: [
            {
                role: 'system',
                content: `你是 Re:0 黑暗互动小说的插图提示词副导演。只生成插图提示词，不续写小说，不输出 Markdown 解释。
输出必须是单个 JSON 对象。不要包含代码块。字段为 title, chinesePrompt, englishPrompt, adultPrompt, negativePrompt, aspectRatio, insertNote。
风格：原作动画观感的日系异世界轻小说同人插画；黑暗奇幻、雨、铁锈、烛光、石板路、微表情、命运压迫、电影构图；不要要求复制具体画师或工作室。
成人规则：adultEnabled=true 时采用成人 AU，入镜人物均为成年且成年外观。成人氛围版可以大胆、详细、性感但不露骨，强调衣料、肩颈、锁骨、腰线、呼吸距离、眼神、姿势张力、危险关系和心理压迫；禁止露骨性行为、裸露器官、性暴力、无法同意状态。
negativePrompt 必须包含 minor, child, young-looking, loli, explicit sex, nude, genitalia, sexual violence, non-consensual。`,
            },
            {
                role: 'user',
                content: JSON.stringify({
                    task: 'build_visual_sidecar_prompt',
                    adultEnabled: !!adult.enabled,
                    current: {
                        day: current.day || 1,
                        time: current.time || '',
                        location: current.location || '',
                        viewpoint: current.viewpoint || '',
                    },
                    sceneCharacters,
                    activeObjective: gameplay.activeObjective || '',
                    openQuestions: (gameplay.openQuestions || []).slice(-5),
                    actionHints: (gameplay.actionHints || []).slice(-4),
                    discoveredClues: (state.discoveredClues || []).slice(-6),
                    tonePacing: state.tonePacing || {},
                    outputSchema: {
                        title: '短标题',
                        chinesePrompt: '详细中文生图提示词',
                        englishPrompt: 'detailed English prompt',
                        adultPrompt: '仅 adultEnabled=true 且画面适合成人氛围时输出，否则空字符串',
                        negativePrompt: '负面提示词',
                        aspectRatio: '16:9|3:4|1:1',
                        insertNote: '玩家生成并上传后如何插入当前剧情',
                    },
                }, null, 2),
            },
        ],
        max_tokens: 900,
        max_completion_tokens: 900,
        temperature: 0.88,
        top_p: 0.95,
        stream: false,
    };
}

function requestSceneCharacters(state) {
    const text = [
        state?.current?.location,
        state?.gameplay?.activeObjective,
        ...(state?.gameplay?.actionHints || []),
    ].join(' ');
    const knownNames = Object.keys(state?.characterCards || {});
    return knownNames.filter((name) => text.includes(name)).slice(0, 6);
}

function buildDeterministicVisualPrompt(state, sceneCharactersInput = [], reason = '') {
    const current = state?.current || {};
    const gameplay = state?.gameplay || {};
    const adult = state?.adultContent || {};
    const sceneCharacters = Array.isArray(sceneCharactersInput) && sceneCharactersInput.length
        ? sceneCharactersInput.slice(0, 6)
        : requestSceneCharacters(state);
    const location = current.location || '露格尼卡王都';
    const time = current.time || `第${current.day || 1}日`;
    const objective = gameplay.activeObjective || '观察异常并保留可验证线索';
    const characters = sceneCharacters.length ? sceneCharacters.join('、') : '主角与当前场景人物';
    const atmosphere = adult.enabled
        ? '成人 AU 氛围，所有入镜人物均为成年外观，危险暧昧、心理拉扯、克制亲密张力'
        : '黑暗奇幻、轻小说日常与命运压迫并存';
    const clueText = Array.isArray(state?.discoveredClues) && state.discoveredClues.length
        ? `关键线索：${state.discoveredClues.slice(-4).join('；')}`
        : '关键线索：雨水、铁锈、钟声、被世界线擦掉的记忆残响';

    return {
        title: `${location}插图提示词`,
        chinesePrompt: [
            '日系异世界轻小说动画风格插画，接近 Re:0 的黑暗奇幻观感但不复制官方镜头或具体画师。',
            `场景：${time}，${location}，${current.scene || objective}。`,
            `人物：${characters}。`,
            `画面重点：${objective}；${clueText}。`,
            `氛围：${atmosphere}；雨夜湿冷、石板反光、烛火与阴影、人物微表情、命运压迫感、电影级构图、细腻服装褶皱、背景有可推理异常细节。`,
            '质量：high detail, expressive anime eyes, cinematic lighting, layered background, sharp focus, polished visual novel key art。',
        ].join(' '),
        englishPrompt: [
            'dark fantasy isekai anime visual novel key art, Re:Zero-inspired atmosphere without copying official shots or a specific artist',
            `${time}, ${location}, ${current.scene || objective}`,
            `characters: ${characters}`,
            `focus: ${objective}; ${clueText}`,
            'rain-soaked stone pavement, rusty bells, candlelight, subtle facial expressions, oppressive fate, cinematic composition, detailed costumes, hidden clues in the background, polished high-detail illustration',
        ].join(', '),
        adultPrompt: adult.enabled
            ? 'Adult AU soft-romance variant: all visible characters are clearly adult, suggestive but non-explicit tension through gaze, distance, posture, clothing texture, shoulder and neckline framing, restrained intimacy, dangerous relationship psychology; no nudity, no explicit sex, no coercion.'
            : '',
        negativePrompt: 'low quality, blurry, bad anatomy, bad hands, watermark, text, logo, minor, child, young-looking, loli, explicit sex, nude, genitalia, sexual violence, non-consensual',
        aspectRatio: '16:9',
        insertNote: reason
            ? `MiMo 视觉副导演超时或异常（${truncate(reason, 120)}），已生成本地兜底提示词。生成图片后上传到当前聊天，可作为下一段剧情视觉参考。`
            : '生成图片后上传到当前聊天，可作为下一段剧情视觉参考。',
    };
}

router.post('/memory-snapshot', async (request, response) => {
    try {
        const manifest = writeMemorySnapshot(request, request.body || {});
        return response.json(manifest);
    } catch (error) {
        console.error('Re:0 memory snapshot failed:', error);
        return response.status(500).json({
            ok: false,
            error: error.message || 'Re:0 memory snapshot failed.',
        });
    }
});

router.post('/visual-prompt', async (request, response) => {
    try {
        const apiKey = readSecret(request.user.directories, SECRET_KEYS.CUSTOM, request.body.secret_id);
        if (!apiKey) {
            return response.status(400).json({ error: 'MiMo API key is not configured.' });
        }

        const model = String(request.body.model || DEFAULT_MODEL);
        const state = safeState(request.body.state);
        const sceneCharacters = Array.isArray(request.body.sceneCharacters) ? request.body.sceneCharacters : [];
        const timeoutMs = timeoutForSimulationRequest(request, VISUAL_REQUEST_TIMEOUT_MS);
        let result = null;
        let prompt = null;
        try {
            result = await fetchMiMo(apiKey, buildVisualPromptRequest(model, state, sceneCharacters), timeoutMs);
            prompt = extractJsonObject(result.text);
        } catch (error) {
            if (result?.text) {
                prompt = {
                    ...buildDeterministicVisualPrompt(state, sceneCharacters, '模型输出不是合法 JSON'),
                    chinesePrompt: truncate(result.text, 1400),
                };
            } else {
                prompt = buildDeterministicVisualPrompt(state, sceneCharacters, error.message || 'upstream failed');
            }
            return response.json({ model, prompt, usage: result?.usage || null, fallback: true });
        }
        return response.json({ model, prompt, usage: result.usage, fallback: false });
    } catch (error) {
        console.error('Re:0 visual prompt generation failed:', error);
        return response.status(error.status || 500).json({
            error: error.message || 'Re:0 visual prompt generation failed.',
            detail: error.detail || null,
        });
    }
});

router.post('/run', async (request, response) => {
    try {
        const apiKey = readSecret(request.user.directories, SECRET_KEYS.CUSTOM, request.body.secret_id);
        if (!apiKey) {
            return response.status(400).json({ error: 'MiMo API key is not configured.' });
        }

        const model = String(request.body.model || DEFAULT_MODEL);
        const parallelism = clampInteger(request.body.parallelism ?? 12, 1, MAX_PARALLELISM);
        const state = safeState(request.body.state);
        const selectedShards = selectShards(parallelism, state);
        const recentMessages = safeRecentMessages(request.body.recentMessages);
        const intensity = String(request.body.intensity || 'token-rich');
        const shardTimeoutMs = timeoutForSimulationRequest(request, REQUEST_TIMEOUT_MS);
        const aggregatorTimeoutMs = timeoutForSimulationRequest({ body: { ...request.body, deepAggregation: true } }, DEEP_REQUEST_TIMEOUT_MS);

        const settled = await Promise.allSettled(selectedShards.map(async (shard) => {
            const result = await fetchMiMo(apiKey, buildShardRequest(model, shard, state, recentMessages, intensity), shardTimeoutMs);
            let json = null;
            try {
                json = extractJsonObject(result.text);
            } catch (error) {
                json = recoverShardJsonFromText(result.text, shard, error);
                json.raw = truncate(result.text, 2000);
            }
            return {
                ok: true,
                shardId: shard.id,
                layer: shard.layer,
                focus: shard.focus,
                json,
                usage: result.usage,
            };
        }));

        const shardResults = settled.map((item, index) => {
            if (item.status === 'fulfilled') {
                return item.value;
            }
            return {
                ok: false,
                shardId: selectedShards[index].id,
                layer: selectedShards[index].layer,
                focus: selectedShards[index].focus,
                error: item.reason?.message || 'Shard failed.',
            };
        });

        let patch = localPatchFromShards(state, shardResults);
        let aggregatorUsage = null;
        let aggregatorRaw = '';
        if (request.body.deepAggregation === true) {
            try {
                const aggregator = await fetchMiMo(apiKey, buildAggregatorRequest(model, state, recentMessages, shardResults), aggregatorTimeoutMs);
                aggregatorUsage = aggregator.usage;
                aggregatorRaw = aggregator.text;
                patch = {
                    ...patch,
                    ...extractJsonObject(aggregator.text),
                };
            } catch (error) {
                patch.flags ??= {};
                patch.flags.systemNotice = `${patch.flags.systemNotice || ''} 深度汇总器异常：${error.message || 'unknown'}；已保留本地确定性收束补丁。`.trim();
            }
        }

        return response.json({
            model,
            parallelism: selectedShards.length,
            maxParallelism: MAX_PARALLELISM,
            patch,
            shards: shardResults,
            usageSummary: {
                shardCalls: selectedShards.length,
                successfulShards: shardResults.filter((item) => item.ok).length,
                failedShards: shardResults.filter((item) => !item.ok).length,
                shardTimeoutMs,
                aggregatorTimeoutMs: request.body.deepAggregation === true ? aggregatorTimeoutMs : null,
                aggregatorUsage,
            },
            aggregatorRaw: truncate(aggregatorRaw, 4000),
        });
    } catch (error) {
        console.error('Re:0 world simulation failed:', error);
        return response.status(error.status || 500).json({
            error: error.message || 'Re:0 world simulation failed.',
            detail: error.detail || null,
        });
    }
});
