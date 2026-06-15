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
    splitVisualNovelEmbeddedDialogueSegments,
    VISUAL_NOVEL_SCRIPT_VERSION,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/vn-script.js';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const USER_ROOT = path.join(PROJECT_ROOT, 'data/default-user');
const QA_DIR = path.join(USER_ROOT, 're0-engine/collab/inbox/qa');
const MIMO_CHAT_URL = 'https://token-plan-cn.xiaomimimo.com/v1/chat/completions';
const CUSTOM_SECRET_KEY = 'api_key_custom';
const DEFAULT_MODEL = process.env.RE0_MIMO_MODEL || 'mimo-v2.5-pro';
const MAX_COMPLETION_TOKENS = Number(process.env.RE0_MIMO_MAX_TOKENS || 1200);
const TIMEOUT_MS = Number(process.env.RE0_MIMO_TIMEOUT_MS || 180_000);
const MIMO_TEMPERATURE = Number(process.env.RE0_MIMO_TEMPERATURE || 0.35);
const LIVE_PLAYFLOW_MAX_SEGMENTS = 14;

const SPEAKER_ALIASES = {
    protagonist: ['protagonist', 'subaru', 'natsuki', 'natsuki_subaru', '昴', '菜月昴', '主角', '我'],
    emilia: ['emilia', '爱蜜莉雅', '艾米莉娅', '银发少女'],
    felt: ['felt', '菲鲁特', '菲尔特', 'Felt', '金发少女', '盗贼少女', 'rider'],
    rom: ['rom', '罗姆爷', '罗姆'],
    rem: ['rem', '蕾姆'],
    ram: ['ram', '拉姆'],
    roswaal: ['roswaal', '罗兹瓦尔'],
    beatrice: ['beatrice', '碧翠丝', '贝蒂'],
    garfiel: ['garfiel', '加菲尔'],
    owen: ['owen', '欧文'],
    lishelle: ['lishelle', '莉榭尔', '莉榭尔·阿尔戈', '莉雪尔'],
    mia: ['mia', '米娅'],
    elsa: ['elsa', '艾尔莎'],
    capital_guard: ['capital_guard', '王都卫兵', '卫兵', '年轻骑士', '骑士', '巡逻卫兵', '守卫'],
    unknown_male: ['unknown_male', '门外男声', '陌生男声', '低沉男声', '未知男声'],
    unknown_female: ['unknown_female', '门外女声', '陌生女声', '未知女声'],
};

const SPEAKER_NAMES = {
    protagonist: '昴',
    emilia: '爱蜜莉雅',
    felt: '菲鲁特',
    rom: '罗姆爷',
    rem: '蕾姆',
    ram: '拉姆',
    roswaal: '罗兹瓦尔',
    beatrice: '碧翠丝',
    garfiel: '加菲尔',
    owen: '欧文',
    lishelle: '莉榭尔',
    mia: '米娅',
    elsa: '艾尔莎',
    capital_guard: '王都卫兵',
    unknown_male: '陌生男声',
    unknown_female: '陌生女声',
};

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function compactText(value, limit = 600) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > limit ? `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...` : text;
}

function compactTail(value, limit = 260) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > limit ? `...${text.slice(-Math.max(0, limit - 3)).trimStart()}` : text;
}

function compactHead(value, limit = 260) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > limit ? `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...` : text;
}

function isModelSafetyRejectionText(text = '') {
    const source = String(text || '').trim();
    if (!source) {
        return false;
    }
    return /request was rejected because it was considered high risk|considered high risk|content policy|safety policy|i(?:'|’)?m sorry,?\s+but i can(?:not|'t)|i can(?:not|'t)\s+(?:assist|help|comply)|无法(?:协助|帮助|处理|继续)|不能(?:协助|帮助|继续).*?(?:请求|内容)|内容(?:安全|风险)|高风险请求/iu.test(source);
}

function replayAnchorPhrases(text = '', limit = 6) {
    const source = visibleNarrative(text).replace(/\s+/g, ' ').trim();
    if (!source) {
        return [];
    }
    const sentences = source
        .split(/(?<=[。！？!?])\s*/u)
        .map((item) => compactText(item, 96))
        .filter((item) => item.length >= 16);
    const chunks = [];
    if (sentences[0]) chunks.push(sentences[0]);
    if (sentences[1]) chunks.push(sentences[1]);
    if (sentences.at(-2)) chunks.push(sentences.at(-2));
    if (sentences.at(-1)) chunks.push(sentences.at(-1));
    chunks.push(compactHead(source, 96));
    chunks.push(compactTail(source, 96));
    return unique(chunks, limit);
}

function narrativeKeywordDigest(text = '', limit = 14) {
    const keywords = keyTerms(visibleNarrative(text), limit);
    return keywords.length ? `已播放关键词：${keywords.join(' / ')}` : '已播放摘要：上一轮已有一个完整小节。';
}

function comparableNarrative(value = '') {
    return String(value || '')
        .replace(/<!--\s*RE0_VN_SCRIPT[\s\S]*?(?:-->|$)/giu, '')
        .replace(/[\s，。、“”"「」『』：:；;！？!?（）()【】\[\]—\-…,.]/gu, '')
        .trim();
}

function replayChunks(current = '', previous = '', size = 90) {
    const currentText = comparableNarrative(current);
    const previousText = comparableNarrative(previous);
    if (currentText.length < size || previousText.length < size) {
        return [];
    }
    const chunks = [];
    for (let index = 0; index + size <= previousText.length; index += Math.max(45, Math.floor(size / 2))) {
        const chunk = previousText.slice(index, index + size);
        if (currentText.includes(chunk)) {
            chunks.push(chunk);
        }
        if (chunks.length >= 3) {
            break;
        }
    }
    return chunks;
}

function selfReplayChunks(value = '', size = 80) {
    const text = comparableNarrative(value);
    if (text.length < size * 2) {
        return [];
    }
    const chunks = [];
    for (let index = 0; index + size <= text.length; index += Math.max(32, Math.floor(size / 2))) {
        const chunk = text.slice(index, index + size);
        if (!chunk || chunks.includes(chunk)) {
            continue;
        }
        const nextIndex = text.indexOf(chunk, index + Math.max(24, Math.floor(size / 3)));
        if (nextIndex >= 0) {
            chunks.push(chunk);
        }
        if (chunks.length >= 3) {
            break;
        }
    }
    return chunks;
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

function numberArg(name, fallback) {
    const raw = (process.argv.find((arg) => arg.startsWith(`--${name}=`)) || '').replace(`--${name}=`, '');
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function stringArg(name, fallback = '') {
    return (process.argv.find((arg) => arg.startsWith(`--${name}=`)) || '').replace(`--${name}=`, '').trim() || fallback;
}

function nowStamp() {
    return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/u, '').replace('T', '-');
}

function keyTerms(text = '', limit = 10) {
    return unique(String(text || '').match(/[\u4e00-\u9fa5A-Za-z0-9]{2,}/gu) || [], limit)
        .filter((term) => !/^(?:这个|那个|如果|可以|行动|选择|当前|一个|一下|什么|哪里|怎么|是否|进行|继续|确认|具体|更多|玩家)$/u.test(term));
}

function anchorTerms(text = '', extra = [], limit = 18) {
    const source = String(text || '');
    const anchors = [
        '爱蜜莉雅', '艾米莉娅', '徽章', '赃物库', '盗品蔵', '罗姆爷', '罗姆', '菲鲁特', '菲尔特', '艾尔莎',
        '欧文', '档案室', '黑伞', '封蜡', '缺页', '旧案', '骑士团',
        '蕾姆', '拉姆', '卡拉拉基', '怠惰', '魔女教', '森林路',
        '圣域', '墓所', '试炼', '结界', '加菲尔', '罗兹瓦尔', '碧翠丝',
        '后山', '宅邸', '孩子', '寒意', '魔力',
        '楼上', '楼梯', '脚步声', '门缝', '偷听', '对话', '声音', '后门', '撤退', '观察', '情报', '买家', '来者', '身份', '魔法', '威慑', '示弱', '来源',
        '少女', '金发', '红色', '眼睛', '警惕', '打量', '慌张', '慌乱', '瞳孔', '藏', '身后', '有关', '判断', '表情', '手中',
        '问题', '重要', '知道', '哪里', '订走', '什么时候', '价钱', '赎回', '今晚', '取货',
        '道歉', '对不起', '解释', '策略', '筹码', '交换', '身份', '谈判', '加价', '监视', '坚持', '追问', '下落', '付出', '代价', '付价',
        '暂时', '离开', '贫民区', '打听', '酒馆', '线索', '告辞', '外面', '寻找',
        '反应', '交涉', '开口', '上前', '向前', '身份证明', '半精灵', '重要', '信任',
        '买回来', '赎回来', '赎回', '市价', '正经交易', '白给', '谈条件',
        '更高', '价格', '双倍', '加一倍', '当场', '买下', '预订', '定金',
        '仔细', '检查', '撕痕', '撕页', '撕掉', '残余', '残留', '相邻', '记录', '记录页', '推断',
        '缺失', '缺页', '涂黑', '墨水', '辨认', '卷宗', '页面', '封蜡碎屑', '批注', '档案',
        '附页', '汇编', '册子', '最后几页', '笔迹', '字迹', '签名', '签章', '压痕', '拓印', '比对', '规律',
        '三年前', '泄密', '事件', '更多', '细节', '封存', '调离', '原岗位', '布防图', '内部',
        '结构图', '手绘结构图', '暗格', '第三暗格', '货架', '排水沟渠', '位置',
        '经手人', '批准', '原因', '黑伞', '持伞', '巡逻日志',
    ].filter((term) => source.includes(term));
    return unique([
        ...anchors,
        ...extra.flatMap((item) => keyTerms(item, 8)),
        ...keyTerms(source, limit),
    ], limit);
}

function semanticActionHits(action = '', visible = '') {
    const source = String(action || '');
    const text = String(visible || '');
    const hits = [];
    if (
        /(?:握住|握紧|牵住|抓住|摩挲|抚过|靠近|抱住|捧起)[^。！？]{0,24}(?:手|指节|手背|脸|肩|她|他)|(?:我在这里|别怕|我会陪你|一起面对)/u.test(source)
        && /(?:握住|握紧|牵住|抓住|掌心|手指|指节|手背|摩挲|抚过|靠近|抱住|捧起|我在这里|别怕|陪你|一起面对)/u.test(text)
    ) {
        hits.push('安抚接触');
    }
    if (
        /观察|反应|判断|虚张声势|表情|眼神/u.test(source)
        && /盯|打量|眼神|瞳孔|表情|笑容|僵|警惕|从.*脸|读出/u.test(text)
    ) {
        hits.push('观察反应');
    }
    if (
        /拖延|争取时间|周旋|牵制/u.test(source)
        && /拖|争取|周旋|牵制|吸引.*注意|时间|迟疑|停住/u.test(text)
    ) {
        hits.push('拖延');
    }
    if (
        /装作|假装|慌乱|翻窗|引开|吸引.*追|追向窗口/u.test(source)
        && /故意|装出|慌乱|笨拙|翻窗|窗沿|窗框|窗口|上钩|直奔窗口|吸引|追向|扑向.*木窗/u.test(text)
    ) {
        hits.push('佯装引开');
    }
    if (
        /翻窗|窗口|窗户|窗台/u.test(source)
        && /窗台|木窗|半开|窗沿|窗框|窗外|翻窗|扒住/u.test(text)
    ) {
        hits.push('窗口动作');
    }
    if (
        /询问|追问|问/u.test(source)
        && /问|追问|重复|为什么|什么|谁|哪里|何/u.test(text)
    ) {
        hits.push('追问');
    }
    if (
        /(?:纸条|笔记|记录|死亡时间|日期)/u.test(source)
        && /(?:纸条|笔记|记录|死亡时间|日期|墨迹|写满|攥在掌心|举到门缝)/u.test(text)
    ) {
        hits.push('纸条证据');
    }
    if (
        /(?:诅咒|咒术|魔女余香|魔女的余香|残香)/u.test(source)
        && /(?:诅咒|咒术|魔女余香|魔女的余香|魔女的残香|残香|术式|痕迹)/u.test(text)
    ) {
        hits.push('诅咒核验');
    }
    if (
        /(?:真相|发生了什么|村庄里到底|村庄.*发生|知道.*村庄)/u.test(source)
        && /(?:真相|村庄|阿勒姆村|魔兽|诅咒|发生|知道|全部|来源|源头)/u.test(text)
    ) {
        hits.push('村庄真相');
    }
    if (
        /(?:禁书库|碧翠丝|贝蒂)/u.test(source)
        && /(?:禁书库|碧翠丝|贝蒂|木门|门缝|门后)/u.test(text)
    ) {
        hits.push('禁书库询证');
    }
    if (
        /(?:条件|交换|愿意.*用什么|用什么.*换|徽章)/u.test(source)
        && /(?:条件|交换|说来听听|说出来|简单|愿意|交给|拿出来|拿到|徽章|赃物库)/u.test(text)
    ) {
        hits.push('交换条件');
    }
    if (
        /(?:答应|假装答应|同意|去拿|拿到|找徽章|回赃物库|转身回)/u.test(source)
        && /(?:好[,，。]|行[,，。]|我去拿|去拿|推开|转身|回到|赃物库|盗品蔵|徽章|布包|铁盒|拿走|拿到)/u.test(text)
    ) {
        hits.push('答应取徽章');
    }
    if (
        /(?:掏出|值钱|塞给|换取|换一条路|换路|后门离开|离开的机会)/u.test(source)
        && /(?:铜币|怀表|全给你|塞给|拍在柜台|换一条路|换路|这些|破烂|缺这些|推回来|后门|条件)/u.test(text)
    ) {
        hits.push('买路交易');
    }
    if (
        /(?:合上|合拢|卷宗|需要准备|暂时离开|记下.*信息)/u.test(source)
        && /(?:卷宗.*合|合拢|站起身|走向门口|门外|铁门在身后|走廊|记下|整理.*思路|钥匙)/u.test(text)
    ) {
        hits.push('合卷离开');
    }
    if (
        /(?:接过|素描|铁门|暗哨|监视者|布防)/u.test(source)
        && /(?:接过|素描|铁门|暗哨|布防|监视|第三块砖|熟客|后路|铜扣|有人来了|巡逻)/u.test(text)
    ) {
        hits.push('暗哨确认');
    }
    if (
        /(?:追上|追|抢在|拿回|追回|金发|小鬼|徽章)/u.test(source)
        && /(?:冲去|追|缩短距离|十几步|金发|小鬼|布包|死胡同|停下|徽章|买家.*靠近)/u.test(text)
    ) {
        hits.push('追赶夺回');
    }
    if (
        /(?:转身|面对|筹码|谈判|徽章下落|下落)/u.test(source)
        && /(?:刹住|转过身|面对|知道徽章在哪|徽章.*下落|筹码|谈|交换|保证|退后|安全|女人.*看)/u.test(text)
    ) {
        hits.push('筹码谈判');
    }
    if (
        /令牌|徽章|铜牌/u.test(source)
        && /令牌|徽章|铜牌|接过|拿着|收好|握紧/u.test(text)
    ) {
        hits.push('接过信物');
    }
    if (
        /钥匙|第三把钥匙|主钥匙|下落/u.test(source)
        && /钥匙|第三把钥匙|主钥匙|副团长|内库管事|从不离身|文书官/u.test(text)
    ) {
        hits.push('钥匙下落');
    }
    if (
        /羊皮纸|抄录|记录|名册|名单|调令|证据/u.test(source)
        && /羊皮纸|炭笔|抄录|记录|名册|名单|调令|经手时间|空白|缺失|签发/u.test(text)
    ) {
        hits.push('证据记录');
    }
    if (
        /取出|展开|当面|展示/u.test(source)
        && /取出|展开|当着|展示|递到|摊开|指尖点/u.test(text)
    ) {
        hits.push('取出展示');
    }
    if (
        /路线图|地图|路线/u.test(source)
        && /路线图|地图|路线|收好|展开|指路|方向/u.test(text)
    ) {
        hits.push('路线图');
    }
    if (
        /结构图|手绘结构图|暗格|推断.*位置|可能位置|排水沟渠|货架/u.test(source)
        && /结构图|手绘结构图|暗格|第三暗格|位置|货架|背面|排水沟渠|空隙|藏一个人|图纸/u.test(text)
    ) {
        hits.push('结构图推断');
    }
    if (
        /动身|前往|赶往|出发|离开/u.test(source)
        && /动身|出发|推开门|走出|走去|穿过|沿着|朝[^。！？]{0,24}方向|街道|路上|途中|离开/u.test(text)
    ) {
        hits.push('动身');
    }
    if (
        /证人|身份|名字|涂黑|目击者|负责人/u.test(source)
        && /证人|名字|涂黑|目击者|同一个人|不是同一个人|命令|负责人|调查负责人|调离|边境|死了/u.test(text)
    ) {
        hits.push('身份追问');
    }
    if (
        /被圈出|圈出的名字|借阅者|身份|职务/u.test(source)
        && /被圈出|借阅人|格雷拉特|职务|内政书记官|附属文书|日期栏|批注|任职|调离|王都/u.test(text)
    ) {
        hits.push('借阅身份');
    }
    if (
        /印章.*(?:哪里|去向|去了|真正)|真正的印章|提走印章|追问.*印章/u.test(source)
        && /印章|提走|调令|印鉴|签章|值班主任|伪造|监守自盗|三天前|黑发.*女人|见过/u.test(text)
    ) {
        hits.push('印章去向');
    }
    if (
        /躲|藏|观察|柜台/u.test(source)
        && /躲|藏|柜台|阴影|窥视|屏住呼吸|观察/u.test(text)
    ) {
        hits.push('隐蔽观察');
    }
    if (
        /贴近|门缝|偷听|听.*对话|对话内容|隔门/u.test(source)
        && /耳朵|贴近|门缝|门内|交谈声|声音|听见|听到|压低.*音量|低沉.*声音/u.test(text)
    ) {
        hits.push('门缝偷听');
    }
    if (
        /保持|静止|不动|屏息|屏住|赌.*疑心/u.test(source)
        && /静止|一动不动|屏住|屏息|没有动|呼吸|阴影|脚步声|门缝/u.test(text)
    ) {
        hits.push('静止潜伏');
    }
    if (
        /制造|响动|动静|转移注意|引开|声响/u.test(source)
        && /响动|动静|声响|碰撞|踢|扔|落地|转头|注意力|引开|远处/u.test(text)
    ) {
        hits.push('制造响动');
    }
    if (
        /解释|授权|整理.*资料|骑士团.*资料|假装.*路过/u.test(source)
        && /解释|授权|资料|整理|路过|闭馆|门外|守卫|档案室/u.test(text)
    ) {
        hits.push('解释授权');
    }
    if (
        /观察|判断|下一步|动作/u.test(source)
        && /右手|左手|手指|指尖|腰间|金属|寒芒|握住|抬手|停住|靠近|视线/u.test(text)
    ) {
        hits.push('动作观察');
    }
    if (
        /压低|木箱|缝隙|观察.*样貌|观察.*武器|样貌和武器/u.test(source)
        && /压低|木箱|缝隙|视线|入口处|身形|女人|斗篷|帽檐|下巴|站姿/u.test(text)
    ) {
        hits.push('缝隙观察');
    }
    if (
        /武器|刀|样貌和武器/u.test(source)
        && /武器|看不见.*武器|双手|袖中|站姿|重心|刀|金属|寒芒/u.test(text)
    ) {
        hits.push('武器确认');
    }
    if (
        /意图|目的|判断|冲着|威胁/u.test(source)
        && /视线|徽章|交易|观众|猎物|冲着|目的|看向|移向|扫过|端详/u.test(text)
    ) {
        hits.push('意图判断');
    }
    if (
        /威胁|危险|判断|程度/u.test(source)
        && /冰刃|寒芒|凝固|猎物|危险|杀意|腰间|不是装饰|威胁|敌意|空气.*冷/u.test(text)
    ) {
        hits.push('威胁评估');
    }
    if (
        /观察|判断|来者|买家/u.test(source)
        && /徽章|王选徽章|左手|泛着微光|持有|握着/u.test(text)
    ) {
        hits.push('目标物确认');
    }
    if (
        /翻阅|前后几页|登记簿|异常记录|档案|卷宗/u.test(source)
        && /翻过|往后翻|前一页|后一页|两页之后|更早|更后|登记|记录|空白|缺页|页/u.test(text)
    ) {
        hits.push('翻阅档案');
    }
    if (
        /附页|汇编|册子|最后几页|笔迹|字迹|签名|签章|压痕|拓印|比对|寻找.*规律|墨迹|墨渍|批注|底稿/u.test(source)
        && /附页|汇编|册子|最后几页|倒数|笔迹|字迹|签名|签章|压痕|拓印|墨迹|墨渍|墨水|批注|纸页|空白页|第十七页|起笔|笔画|顿挫|如出一辙|裁去|裁角|栏位|纤维/u.test(text)
    ) {
        hits.push('文书比对');
    }
    if (
        /拆开|火漆|封口|封蜡|残页|查看.*内容/u.test(source)
        && /火漆|封蜡|碎裂|残页|抽出|平放|焦黑|切口|移交签收|经手人|裁去/u.test(text)
    ) {
        hits.push('拆封残页');
    }
    if (
        /打开|抽屉|封存|残留|文件|证据|残卷/u.test(source)
        && /打开|抽屉|拉环|滑出|卡住|残卷|卷宗|文件|证据|薄纸|夹层|清点记录|涂黑|编号|移交|日期/u.test(text)
    ) {
        hits.push('打开查证');
    }
    if (
        /调派|调离|调动|人事|雷克|凯尔|诺顿|被调走|真正原因|真实原因/u.test(source)
        && /调派|调离|调动令|调走|人事卷宗|雷克|凯尔|诺顿|铁柜|年份标签|调派令|因公负伤|后方勤务|批准签章|空白签章|备用通道|执勤地点|批注|涂掉|签收记录|领走|黑伞/u.test(text)
    ) {
        hits.push('调派记录');
    }
    if (
        /留下|放回|先留|不拿|暂时.*留/u.test(source)
        && /放回|留在|先留|收回|没有带走|指尖.*移开|徽章先留|布包.*柜台/u.test(text)
    ) {
        hits.push('留下物件');
    }
    if (
        /离开|退出|先走|暂时离开|告辞/u.test(source)
        && /退出|离开|门.*合上|雨.*脸|走出|后退|告辞|外面|门口|木门|向后移动|往.*门|带.*方向|侧门|门闩|甬道|挤出去|绕到|避开/u.test(text)
    ) {
        hits.push('离开现场');
    }
    if (
        /侧门|撤离|避开.*巡逻|巡逻者|岗哨|离开甬道/u.test(source)
        && /侧门|门闩|甬道|走廊|金属碰撞|巡逻|岗哨|杂物棚|马厩|避开|撤离|离开/u.test(text)
    ) {
        hits.push('侧门撤离');
    }
    if (
        /带.*爱蜜莉雅|爱蜜莉雅.*退出|撤退|离开|退出/u.test(source)
        && /扣住.*爱蜜莉雅|爱蜜莉雅.*配合|手腕|护在.*肩|往门口|门口.*方向|无声.*移动|脚步|木门.*三步|退向门口/u.test(text)
    ) {
        hits.push('带人撤退');
    }
    if (
        /抓住|握住|手腕|暗示|后门|撤离/u.test(source)
        && /抓住|扣住|握住|手腕|脉搏|无声.*信号|跟我走|后门|现在/u.test(text)
    ) {
        hits.push('抓手撤离');
    }
    if (
        /门口|退出|离开|盗品蔵/u.test(source)
        && /木门|半掩|三步之外|门口|前方.*门|往.*门|地板|横梁/u.test(text)
    ) {
        hits.push('接近出口');
    }
    if (
        /后退|关上门|回到|内部|重新寻找|出路/u.test(source)
        && /后退|门板|木门|合拢|门闩|背抵|关上|仓库内部|另一个出口|通道|出路/u.test(text)
    ) {
        hits.push('关门回撤');
    }
    if (
        /筹钱|赎回|买回来|赎回来|凑钱/u.test(source)
        && /筹钱|赎回|三枚圣金币|圣金币|凑|买回来|钱|补偿|代价/u.test(text)
    ) {
        hits.push('筹钱赎回');
    }
    if (
        /更高价格|高于买家|出价|加价|双倍|加一倍|买回|赎回|现金/u.test(source)
        && /双倍|加一倍|加三成|现金|钱|价格|值多少|定金|买家.*付|不是钱的问题|出多少|买回|赎回/u.test(text)
    ) {
        hits.push('加价赎回');
    }
    if (
        /出价|底价|买家|价格|圣金币|金币/u.test(source)
        && /出价|五十|一百|圣金币|金币|底价|打点折扣|不算什么|口气不小|买家/u.test(text)
    ) {
        hits.push('出价试探');
    }
    if (
        /加价|一百|抢在.*买家|拿下/u.test(source)
        && /一百|加价|圣金币|晃了晃|出得起|买下|拿下|成交/u.test(text)
    ) {
        hits.push('加价抢购');
    }
    if (
        /徽章.*意义|坦白|回答|王选|证明/u.test(source)
        && /徽章|王选|证明|唯一|重要|候选人|合法|信物/u.test(text)
    ) {
        hits.push('坦白徽章意义');
    }
    if (
        /抢|夺|冲向|掀桌|抓住|拿走|夺回/u.test(source)
        && /扑向|冲向|抓|抢|夺|掀|指尖触到|触到|伸手|柜台|徽章|被.*拍|扇飞/u.test(text)
    ) {
        hits.push('抢夺物件');
    }
    if (
        /后门|密道|地窖|出口|退回|深处|寻找.*路|下水道/u.test(source)
        && /后方|深处|杂物|木箱|地窖|盖板|下水道|出口|退回|冲去|拨开|露出|走不了|被堵/u.test(text)
    ) {
        hits.push('寻找出口');
    }
    if (
        /告诉|提醒|警告|准备|做好准备|说明.*危险|门外来者/u.test(source)
        && /告诉|提醒|警告|准备|小声|压低|气声|门外|买家|危险|不是普通|做好|魔法|应对/u.test(text)
    ) {
        hits.push('告知危险');
    }
    if (
        /魔法|冰系|冰墙|释放|施法|用魔法|控制范围|制造掩护/u.test(source)
        && /魔法|冰蓝|冰墙|冰晶|冰|寒气|凝结|咒文|手掌|指尖|封住|挡住|遮断|掩护/u.test(text)
    ) {
        hits.push('魔法掩护');
    }
    return unique(hits, 4);
}

function asksForConcreteAnswer(action = '') {
    return /询问|追问|问|确认|问清/u.test(String(action || ''))
        && /什么事|是谁|谁|为什么|哪里|地点|时间|几点|代价|条件|具体|怎么做|如何|多少|几|来路|来源|卖家|买家|交易/u.test(String(action || ''));
}

function hasConcreteAnswerForQuestion(action = '', visible = '') {
    const source = String(action || '');
    const text = String(visible || '');
    if (/撕掉|缺页|那页|那几页|记录了什么|结案|案子会有缺页|赃物追回|供词|入库记录/u.test(source)) {
        return /(?:那页记录的是|那几页[^。！？]{0,18}记录的是|原本记录的是|缺页的部分|原本记载|最终流向|具体内容[^。！？]{0,12}不清楚|单独归档|赃物追回|涉案人员供词|结案报告|案犯在逃|入库记录|没有这批徽章|被人从赃物库里带走|接触赃物库的钥匙|被涂掉|追回的赃物|登记根本没有)/u.test(text);
    }
    if (/来路|来源|卖家|买家|交易/u.test(source)) {
        return /(?:拿来|拿来的|换酒钱|小鬼|小偷|银发.*丫头|金发.*丫头|卖家|来路|来源|买家|女人|斗篷|问过价|出手|交易|今晚|再来|取货|付了|定金|价钱)/u.test(text);
    }
    if (/名字|名单|缺页|记录.*谁|谁.*名字|姓氏|经手人|签收.*谁|押送.*谁/u.test(source)) {
        return /(?:名字|名叫|叫作|叫做|叫[\p{sc=Han}A-Za-z・]{2,12}|签名|名单|姓氏|两个|一个是|另一个|随行人员|格里高尔|格雷姆|赫尔曼|文官科|内务处|借阅记录|最后一次借出|见习骑士|负责押送|负责经手|经手人|登记簿|押送途中|失踪|尸体没有找到|抚恤金|来源不明|密档室|没有人再提起)/u.test(text);
    }
    if (/真实身份|伞下之人|违禁|魔导具|具体用途|用途|干什么用|用来/u.test(source)) {
        return /(?:不知道.*真名|不知.*真名|只知道|暗号|撑伞的人|桥下等|违禁魔导具|禁忌之物|干扰王选|王选仪式|扭曲因果|制造.*意外|转运出城|圣域附近|残件|谁拿到)/u.test(text);
    }
    if (/墨水|涂黑|来源|辨认|同一种/u.test(source)) {
        return /(?:不是普通|书写墨水|涂黑|墨水|矿物粉末|颜色特别深|干得很快|王都东区|炼金工坊|封存重要文件|特殊墨水|授权|官员|购买)/u.test(text);
    }
    const questionAnchorHits = unique([
        ...anchorTerms(source, [], 8).filter((term) => text.includes(term)),
        ...semanticActionHits(source, text),
    ], 6);
    const hasDirectSpeech = /[「『“][^」』”]{4,220}[」』”]/u.test(text);
    const hasFactualOrRefusalSignal = /(?:不是|是|叫|名叫|来自|来源|因为|所以|只知道|不知道|不清楚|不能说|可以|需要|通常|只有|据说|意味着|确认|否认|答案|线索|证据|授权|权限|购买|地点|时间|三天前|今晚|子时|条件|代价|可能)/u.test(text);
    if (hasFactualOrRefusalSignal && (questionAnchorHits.length || hasDirectSpeech)) {
        return true;
    }
    if (/具体|情报|来头|特征|身份/u.test(source)) {
        return /(?:女人|买家|不好惹|血|味道|刀|短刀|弯刀|袖口|出手|付钱|眼神|今晚|子时|明天|取货|来取|来谈生意|危险|普通人|不是.*人)/u.test(text);
    }
    if (/什么事|怎么做|条件|代价/u.test(source)) {
        return /(?:我要你们|你们得|替我|条件是|代价是|事情是|帮我|拿到|带走|找到|引开|拖住|确认|送到|交给|换取|爬出去|通风口|不是金币|一条命|债|定金|饭钱|住处|苦力|一笔勾销|付了|付的是|脏活|具体.*不用知道|不用知道|不能说|不能告诉|不该问|这我不能说)/u.test(text)
            && !/(?:你们得替我做一件事|代价是——)\s*(?:[」』”\s。！？!?,，]|$)/u.test(text);
    }
    if (/是谁|谁/u.test(source)) {
        return /(?:叫|名字|是个|身份|雇主|买家|女人|男人|小偷|骑士|商人|杀手|来自)/u.test(text);
    }
    if (/哪里|地点|时间|几点|多少|几/u.test(source)) {
        return /(?:在|到|从|明早|今晚|子时|清晨|三枚|两枚|一枚|第|之前|之后|巷|仓库|柜台|门|街)/u.test(text);
    }
    if (/为什么|原因|为何/u.test(source)) {
        return /(?:因为|为了|理由是|不是[^。！？]{0,12}封存|王选委员会|候选人背景调查|不是.*隐私|是.*找上我|找上我的|给了定金|出了价|出的价|价钱|够.*活|让我|指名|自己挑|自己找上门|不是被人逼|不是被逼|有得选|没得选|活下来|从小.*长大|自己学会|想要|需要|只知道|信物|重要的人|丢了|找回来|替她|委托|收回)/u.test(text);
    }
    return /因为|所以|条件|代价|拒绝|不能|可以|需要|除非/u.test(text);
}

function passiveActionPattern(text = '') {
    return /保持沉默|继续.*观察|屏息观察|等(?:待|她|他|对方)|一动不动|按兵不动|先不/u.test(String(text || ''));
}

function isPreparatoryRetreatSignal(text = '') {
    const source = String(text || '');
    return /(?:警告|提醒|告诉|压低|低声|示意|暗示|交代|做好|准备|随时)/u.test(source)
        && /(?:撤退|撤离|退路|逃走|逃离|跑)/u.test(source)
        && !/(?:立刻|马上|现在|当场|直接|抓住|拉着|牵着|拽着|冲向|冲出|跑出|走出|退向|带着|护着)[^。！？]{0,16}(?:撤退|撤离|逃|跑|门口|出口|后门|离开)/u.test(source);
}

function hasStrongTravelIntent(text = '') {
    const source = String(text || '');
    if (/(?:到达|抵达)(?:时间|时刻|时辰|条件|窗口|前后|顺序|原因)/u.test(source)) {
        return false;
    }
    if (
        /(?:想|应该|要不要|是否|如果|觉得|准备|打算|需要先|先确认)[^。！？]{0,16}(?:回去|回到|返回)/u.test(source)
        && !/(?:现在就|立刻|马上|当场|立即|站起|起身|转身|迈步|动身|出发|走向|朝[^。！？]{0,16}走|离开|退出)/u.test(source)
    ) {
        return false;
    }
    if (isPreparatoryRetreatSignal(source)) {
        return false;
    }
    if (
        /(?:观察|寻找|确认|判断|查看)[^。！？]{0,18}(?:躲藏|撤退|位置|路线|出口|出入口)/u.test(source)
        && !/(?:立刻|马上|现在|直接|冲向|跑向|走向|离开|退出|逃离|逃走|前往|去往|赶往)[^。！？]{0,18}(?:门|出口|后门|巷|外|路线)/u.test(source)
    ) {
        return false;
    }
    if (/(?:换取|换|争取|买)[^。！？]{0,16}(?:离开|撤离|后门|退路|路线|机会)|(?:换一条路|换路|买路)/u.test(source)) {
        return false;
    }
    if (
        /表示愿意|接受.*安排|答应|同意|准备(?:离开|撤离)|打算(?:离开|撤离)/u.test(source)
        && !/走向|走出|出门|推门|前往|去往|赶往|撤退|逃离|跑出|离开(?:档案室|现场|房间|屋内|门口|赃物库|盗品蔵)/u.test(source)
    ) {
        return false;
    }
    if (
        /(?:问|询问|追问|请问)[^。！？]{0,14}(?:能不能|能否|可不可以|是否)?[^。！？]{0,22}(?:带路|路线|位置|怎么走|在哪|入口|后门|借道)/u.test(source)
    ) {
        return false;
    }
    return /(?:直接)?前往|去往|赶往|直接去|踩点|绕到|返回|撤退|逃离|离开/u.test(source)
        || /(?:现在就|立刻|马上|当场|立即)?去(?:往|到)?[^。！？]{0,24}(?:赃物库|盗品蔵|贫民窟|贫民区|旧教堂|南门|西侧|第七区|边境|宅邸|圣域|墓所|森林|现场)/u.test(source)
        || /(?:到达|抵达|赶到|走到|来到)(?!时间|时刻|时辰|条件|窗口|前后|顺序|原因)/u.test(source);
}

function travelActionLanded(action = '', visible = '', script = null) {
    const source = String(action || '');
    if (!hasStrongTravelIntent(source)) {
        return true;
    }
    const text = `${visible} ${asArray(script?.segments).slice(0, 4).map((segment) => [
        segment?.text,
        segment?.action,
        segment?.camera,
        segment?.focus,
    ].filter(Boolean).join(' ')).join(' ')}`;
    const targetTerms = keyTerms(source, 8).filter((term) => !/直接|前往|去往|赶往|到达|抵达|踩点|观察|环境|提前/.test(term));
    const alreadyAtNamedDestination = (
        /(?:前往|去往|赶往|来到|抵达|到达)[^。！？]{0,24}卡拉拉基/u.test(source)
        && /(?:卡拉拉基|驿站|商队|行囊|包袱|货币|宿场|烤羊肉|扁豆汤)/u.test(text)
    ) || (
        /(?:前往|去往|赶往|来到|抵达|到达)[^。！？]{0,24}圣域/u.test(source)
        && /(?:圣域|墓所|结界|试炼|加菲尔|罗兹瓦尔)/u.test(text)
    );
    if (alreadyAtNamedDestination) {
        return true;
    }
    const semanticReturnToLootHouse = /(?:折返|返回|回到|回|再进|重新进)[^。！？]{0,18}(?:盗品蔵|赃物库)/u.test(source)
        && /(?:盗品蔵|赃物库|柜台|罗姆爷|爱蜜莉雅|推开[^。！？]{0,24}木门|挤进去|油灯光线)/u.test(text);
    const semanticDossierExit = /(?:合上|合拢)[^。！？]{0,12}卷宗|(?:需要准备|暂时离开|记下.*信息)/u.test(source)
        && /(?:卷宗[^。！？]{0,24}合|合拢[^。！？]{0,24}卷宗|站起身|走向门口|门外|铁门在身后|走廊|钥匙)/u.test(text);
    const semanticRoomExit = /(?:假装|服从|告辞|暂时|直接)?[^。！？]{0,12}(?:离开|退出|走出)|(?:记下|记住)[^。！？]{0,18}(?:卷宗编号|信息|线索)[^。！？]{0,18}(?:后续调查|准备)/u.test(source)
        && /(?:走吧|让出门口|迈步向门口|向门口走|跨出门槛|走廊|门锁转动|没有跟出来|走出|离开|门在身后|身后.*门)/u.test(text);
    const hasTarget = semanticReturnToLootHouse || semanticDossierExit || semanticRoomExit || !targetTerms.length || targetTerms.some((term) => text.includes(term));
    const landed = /抵达|到达|来到|走到|赶到|走向|朝[^。！？]{0,24}走去|进入|靠近|转入|绕到|返回|回去|爬回|朝来路|探出|推开[^。！？]{0,24}门|通往|门前|附近|外墙|街口|巷口|路上|沿着|穿过|出了|离开|侧门|甬道|后院|马厩|旧教堂|教堂|蹲下|插入锁孔|柜门[^。！？]{0,16}打开/u.test(text);
    const explicitBlock = /被(?:拦|挡|截|阻)|挡在[^。！？]{0,18}(?:出口|门口|去路|路上|前方|面前|身前)|拦在[^。！？]{0,18}(?:出口|门口|去路|路上|前方|面前|身前)|堵住|堵在|堵门|封死|肉墙|没有移动分毫|巡逻|岗哨|门禁|上锁|关了|已经关|被人看到|概率|不能|不可能|来不及|太危险|只好|不得不|改道|绕路|暂时停/u.test(text);
    const downgradedToPlan = /计划(?:白天|明天|之后|以后)?(?:前往|去|踩点)|最好在白天|如果你要去|你要去|需要提前踩点|决定(?:白天|之后|以后)?去/u.test(text)
        && !/(抵达|到达|来到|旧教堂(?:门前|附近|外墙|街口)|教堂(?:门前|附近|外墙|街口)|被(?:拦|挡|截|阻)|巡逻.*拦|门禁)/u.test(text);
    return hasTarget && (landed || explicitBlock) && !downgradedToPlan;
}

function actionDirectedBackdropTransitionAllowed({
    action = '',
    visible = '',
    expectedKey = '',
    actualKey = '',
} = {}) {
    const text = `${action} ${visible}`;
    const lootHouseKeys = new Set(['loot_house', 'arc01_loot_house_interior']);
    const alleyKeys = new Set(['arc01_slum_alley_night', 'rain_bell']);
    if (
        lootHouseKeys.has(actualKey)
        && (alleyKeys.has(expectedKey) || lootHouseKeys.has(expectedKey))
        && /(?:回|返回|折返|进入|进|推开|拐进)[^。！？]{0,16}(?:盗品蔵|赃物库|侧门)|(?:盗品蔵|赃物库)[^。！？]{0,16}(?:内部|屋内|侧门|柜台|罗姆爷)/u.test(text)
    ) {
        return true;
    }
    if (
        alleyKeys.has(actualKey)
        && (lootHouseKeys.has(expectedKey) || alleyKeys.has(expectedKey))
        && /(?:离开|退出|跑出|冲出|撤出|退到|回到)[^。！？]{0,18}(?:巷|雨夜|门外|贫民区|街)|(?:巷口|门外|贫民区雨夜|雨水|雨声)[^。！？]{0,18}(?:停下|后退|逃|撤)/u.test(text)
    ) {
        return true;
    }
    if (
        actualKey === 'arc02_mansion_corridor_night'
        && expectedKey === 'arc02_forbidden_library_door'
        && /(?:循着|追|跟着|确认|寻找|听见)[^。！？]{0,24}(?:脚步声|脚步|蕾姆|蓝色发丝)|(?:走廊|拐角|门缝|仆人宿舍|蕾姆的房间)[^。！？]{0,40}(?:追|确认|停在|开口|脚步)/u.test(text)
    ) {
        return true;
    }
    return false;
}

function uniqueFindings(findings = []) {
    const seen = new Set();
    const output = [];
    for (const finding of findings) {
        const key = `${finding?.severity || ''}:${finding?.module || ''}:${finding?.title || ''}:${finding?.detail || ''}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        output.push(finding);
    }
    return output;
}

function revealedByInWorldSpeech(name = '', visible = '') {
    const text = String(visible || '');
    if (name === '艾尔莎') {
        return /[「『]\s*艾尔莎[，,。！？!」』]/u.test(text)
            || /(?:我叫|名字是|名叫|称作|叫做)\s*艾尔莎/u.test(text)
            || /(?:罗姆爷|罗姆|买家|女人|黑发女人|她)[^。！？]{0,48}(?:叫|名字|名为|称作|是)\s*艾尔莎/u.test(text);
    }
    return new RegExp(`[「『]\\s*${name}[，,。！？!」』]`, 'u').test(text)
        || new RegExp(`(?:我叫|名字是|名叫|称作|叫做)\\s*${name}`, 'u').test(text);
}

function quotedSpeechContains(visible = '', pattern) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(String(pattern || ''), 'u');
    const quotes = String(visible || '').match(/[「『“"][^」』”"]{0,220}[」』”"]/gu) || [];
    return quotes.some((quote) => regex.test(quote));
}

function sensoryObservationRevealsBuyerDetail(label = '', visible = '') {
    const text = String(visible || '');
    if (/黑发/.test(label)) {
        return /(?:看见|照亮|门口|门缝|走进|踏入|身影|身段|女人|发丝|头发|雨水顺着)[^。！？]{0,100}(?:黑发|黑头发|深色的发丝|黑色.*头发)/u.test(text)
            || /(?:门口|推开|走进|踏入|身影|女人)[\s\S]{0,180}(?:黑发|黑头发|深色的发丝|黑色.*头发)/u.test(text)
            || /(?:黑发|黑头发|深色的发丝|黑色.*头发)[^。！？]{0,90}(?:贴在|脸颊|肩头|雨水|发梢|湿漉漉)/u.test(text);
    }
    if (/弯刀|刀/.test(label)) {
        return /(?:金属碰撞|刀鞘|刀柄|刀刃|握着.*东西|右手.*握|轮廓.*可辨|隐约可辨)/u.test(text);
    }
    if (/血腥味/.test(label)) {
        return /(?:闻|气味|身上有[^。！？]{0,20}血腥|血腥味|血味|铁锈气)/u.test(text);
    }
    return false;
}

function playerVisibleKnowledgeBefore(state = {}, previousTurns = []) {
    const turns = Array.isArray(previousTurns) ? previousTurns : [previousTurns].filter(Boolean);
    return [
        state.current?.location || '',
        ...asArray(state.discoveredClues),
        ...turns.slice(-6).flatMap((turn) => [
            turn?.visibleText || '',
            ...(turn?.script?.choices || []),
            ...(turn?.script?.segments || []).map((segment) => segment?.text || ''),
        ]),
    ].join(' ');
}

function resolveSpeaker(label = '') {
    const source = String(label || '').trim().toLowerCase();
    if (!source) {
        return null;
    }
    for (const [id, aliases] of Object.entries(SPEAKER_ALIASES)) {
        if (aliases.some((alias) => {
            const item = String(alias || '').toLowerCase();
            return source === item || source.includes(item) || item.includes(source);
        })) {
            return { id, name: SPEAKER_NAMES[id] || id };
        }
    }
    return null;
}

function assertLiveSecret() {
    const secretsPath = path.join(USER_ROOT, 'secrets.json');
    if (!fs.existsSync(secretsPath)) {
        throw new Error('Missing data/default-user/secrets.json. Live playflow audit is blocked; mock is not allowed.');
    }
    const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
    const candidates = secrets[CUSTOM_SECRET_KEY];
    const active = Array.isArray(candidates) ? (candidates.find((secret) => secret?.active) || candidates[0]) : null;
    const apiKey = String(active?.value || '').trim();
    if (!apiKey) {
        throw new Error('Missing active custom MiMo API key. Live playflow audit is blocked; mock is not allowed.');
    }
    return apiKey;
}

function baseFlowScenario(flowId) {
    const flows = {
        'canon-arc1': {
            id: 'canon-arc1',
            title: '原作线 Arc1 盗品蔵多轮闭环',
            expectedMode: 'canon-follow',
            strategy: 'canon',
            startAction: '【原作线】带着爱蜜莉雅推开盗品蔵的门，只说可验证的徽章线索，请罗姆爷确认徽章是否在屋内，不暴露任何死亡回归或未来知识。',
            state: {
                mode: 'main',
                current: {
                    arc: 1,
                    day: 1,
                    time: '雨夜',
                    location: '王都贫民区盗品蔵门口',
                    viewpoint: '玩家',
                    castIds: ['protagonist', 'emilia', 'felt', 'rom'],
                },
                setup: {
                    routePreset: '原作开局',
                    protagonistName: '昴',
                    gender: '男',
                    origin: '原作开局',
                    initialScenario: '徽章失窃与盗品蔵交涉',
                },
                protagonistProfile: {
                    name: '昴',
                    gender: '男',
                    origin: '原作开局',
                    routePreset: '原作开局',
                },
                worldline: { id: 'PLAYFLOW-CANON-ARC1', divergence: 0.05, attractor: '嫉妒/主线' },
                ifRouteLogic: { dominant: 'EnvyMain', routePressures: {} },
                gameplay: {
                    activeObjective: '在不泄露死亡回归的前提下进入盗品蔵，确认徽章流向、交易对象和艾尔莎威胁。',
                    objectiveStage: 'arc1-loot-house',
                    lastPlayerAction: '',
                    deathRisk: {},
                    openQuestions: ['徽章买家是谁', '艾尔莎何时入场', '如何让爱蜜莉雅相信可验证线索'],
                },
                discoveredClues: ['徽章失窃', '盗品蔵交易', '贫民区雨夜'],
                deathBranches: [],
                characterCards: {},
                adultContent: { enabled: false },
                narrativeMode: { current: 'main' },
                visuals: {
                    visualNovel: {
                        enabled: true,
                        scriptEnabled: true,
                        queueMode: 'append',
                        backgroundKey: 'loot_house',
                        sceneCharacters: ['protagonist', 'emilia', 'felt', 'rom'],
                        currentSpeakerName: '',
                    },
                    sceneBackdrop: { currentKey: 'loot_house' },
                },
                flags: { worldSessionId: 'live-playflow-canon-arc1', canonFollowActive: true },
            },
        },
        'free-archive': {
            id: 'free-archive',
            title: '自由行动 档案室调查多轮闭环',
            expectedMode: 'free-simulation',
            strategy: 'grounded',
            startAction: '以现代图书管理员的出身优势，请求欧文允许查阅旧案档案，寻找黑伞、封蜡缺页和徽章失窃之间的因果线索。',
            state: {
                mode: 'main',
                current: {
                    arc: 1,
                    day: 3,
                    time: '傍晚',
                    location: '王都骑士团旧档案室',
                    viewpoint: '玩家',
                    castIds: ['protagonist', 'owen', 'emilia'],
                },
                setup: {
                    protagonistName: '悠真',
                    gender: '男',
                    origin: '现代图书管理员',
                    ability: '资料整理与异常索引',
                    initialScenario: '自由调查旧案',
                },
                protagonistProfile: {
                    name: '悠真',
                    gender: '男',
                    origin: '现代图书管理员',
                    ability: '资料整理与异常索引',
                },
                worldline: { id: 'PLAYFLOW-FREE-ARCHIVE', divergence: 0.31, attractor: '嫉妒/自由调查' },
                ifRouteLogic: { dominant: 'FreeSimulation', routePressures: {} },
                gameplay: {
                    activeObjective: '通过档案、欧文反应和爱蜜莉雅的信息差，推理黑伞与徽章失窃旧案的联系。',
                    objectiveStage: 'archive-investigation',
                    lastPlayerAction: '',
                    deathRisk: {},
                    openQuestions: ['缺页是谁撕掉的', '欧文知道多少', '黑伞是否和赃物库有关'],
                },
                discoveredClues: ['黑伞传闻', '封蜡缺页', '徽章失窃'],
                deathBranches: [],
                characterCards: {},
                adultContent: { enabled: false },
                narrativeMode: { current: 'main' },
                visuals: {
                    visualNovel: {
                        enabled: true,
                        scriptEnabled: true,
                        queueMode: 'append',
                        backgroundKey: 'archive',
                        sceneCharacters: ['protagonist', 'owen', 'emilia'],
                        currentSpeakerName: '',
                    },
                    sceneBackdrop: { currentKey: 'archive' },
                },
                flags: { worldSessionId: 'live-playflow-free-archive' },
            },
        },
        'canon-arc4-sanctuary': {
            id: 'canon-arc4-sanctuary',
            title: '原作线 Arc4 圣域试炼多轮闭环',
            expectedMode: 'canon-follow',
            strategy: 'canon',
            startAction: '【原作线】在圣域墓所入口先确认结界与试炼规则，让爱蜜莉雅保留自主选择进入试炼，不用死亡回归知识强迫她。',
            state: {
                mode: 'main',
                current: {
                    arc: 4,
                    day: 7,
                    time: '黄昏',
                    location: '圣域墓所入口',
                    viewpoint: '玩家',
                    castIds: ['protagonist', 'emilia', 'roswaal', 'echidna', 'garfiel'],
                },
                setup: {
                    routePreset: '原作开局',
                    protagonistName: '昴',
                    gender: '男',
                    origin: '原作开局',
                    initialScenario: '圣域试炼与结界分歧',
                },
                protagonistProfile: {
                    name: '昴',
                    gender: '男',
                    origin: '原作开局',
                    routePreset: '原作开局',
                },
                worldline: { id: 'PLAYFLOW-CANON-ARC4', divergence: 0.12, attractor: '嫉妒/圣域主线' },
                ifRouteLogic: { dominant: 'EnvyMain', routePressures: { Greed: 0.12, Sloth: 0.04 } },
                gameplay: {
                    activeObjective: '围绕圣域结界、墓所试炼、爱蜜莉雅心理压力、罗兹瓦尔剧本和碧翠丝契约，按原作因果推进但允许玩家用行动改变顺序。',
                    objectiveStage: 'arc4-sanctuary-trial',
                    lastPlayerAction: '',
                    deathRisk: {},
                    openQuestions: ['结界规则如何限制混血者', '爱蜜莉雅是否准备好面对过去', '罗兹瓦尔在推动什么剧本'],
                },
                discoveredClues: ['圣域结界', '墓所试炼', '罗兹瓦尔的剧本', '爱蜜莉雅的过去'],
                deathBranches: [],
                characterCards: {
                    emilia: {
                        name: '爱蜜莉雅',
                        trust: 36,
                        suspicion: 4,
                        affection: 18,
                        conflict: 11,
                        attitudeToPlayer: '相信玩家的陪伴，但拒绝被替她决定试炼。',
                        memory: ['玩家在墓所入口强调让她自己选择，而不是用未来知识指挥她。'],
                    },
                },
                adultContent: { enabled: false },
                narrativeMode: { current: 'main' },
                visuals: {
                    visualNovel: {
                        enabled: true,
                        scriptEnabled: true,
                        queueMode: 'append',
                        backgroundKey: 'arc04_tomb_inside',
                        sceneCharacters: ['protagonist', 'emilia', 'roswaal', 'echidna', 'garfiel'],
                        currentSpeakerName: '',
                    },
                    sceneBackdrop: { currentKey: 'arc04_tomb_inside' },
                },
                flags: { worldSessionId: 'live-playflow-canon-arc4', canonFollowActive: true },
            },
        },
        'if-pride-capital': {
            id: 'if-pride-capital',
            title: '傲慢 IF 吸引子 王都证明欲多轮闭环',
            expectedMode: 'if-attractor',
            strategy: 'if-attractor',
            startAction: '不等爱蜜莉雅和罗姆爷交涉，我独自绕到盗品蔵后巷，偷听买家与中间人的对话，想证明自己一个人就能夺回徽章。',
            state: {
                mode: 'main',
                current: {
                    arc: 1,
                    day: 2,
                    time: '深夜',
                    location: '王都贫民区后巷 / 盗品蔵附近',
                    viewpoint: '玩家',
                    castIds: ['protagonist', 'emilia', 'felt', 'rom'],
                },
                setup: {
                    routePreset: 'IF 分歧开局',
                    protagonistName: '昴',
                    gender: '男',
                    origin: '原作开局',
                    initialScenario: '傲慢 IF 的证明欲压力',
                },
                protagonistProfile: {
                    name: '昴',
                    gender: '男',
                    origin: '原作开局',
                    routePreset: 'IF 分歧开局',
                },
                worldline: { id: 'PLAYFLOW-IF-PRIDE', divergence: 0.58, attractor: '傲慢 IF / Ayamatsu' },
                ifRouteLogic: { dominant: 'Ayamatsu', routePressures: { Pride: 0.64, Ayamatsu: 0.64, EnvyMain: 0.22, Sloth: 0.04 } },
                gameplay: {
                    activeObjective: '测试傲慢 IF 是否作为证明欲与孤立吸引子持续施压：玩家可以追求独自破局，但必须表现失去证据网络、同伴自主和王都秩序的代价。',
                    objectiveStage: 'if-pride-capital-proof',
                    lastPlayerAction: '',
                    deathRisk: {},
                    openQuestions: ['爱蜜莉雅是否被玩家的独断疏远', '菲鲁特和罗姆爷是否把玩家视为危险变量', '莱因哈鲁特的介入窗口是否被证明欲扭曲'],
                },
                discoveredClues: ['徽章失窃', '盗品蔵附近', '独自证明自己的冲动', '爱蜜莉雅信任尚未稳固'],
                deathBranches: [],
                characterCards: {
                    emilia: {
                        name: '爱蜜莉雅',
                        trust: 18,
                        suspicion: 17,
                        affection: 10,
                        conflict: 26,
                        attitudeToPlayer: '想相信玩家的善意，但对他不解释就独自推进感到不安。',
                        memory: ['玩家开始把证明自己摆在共同确认事实之前。'],
                    },
                    felt: {
                        name: '菲鲁特',
                        trust: 6,
                        suspicion: 28,
                        affection: 0,
                        conflict: 32,
                        attitudeToPlayer: '把玩家视为突然闯进交易的危险外人。',
                        memory: ['玩家在盗品蔵附近试图绕开正常谈判独自抓住局面。'],
                    },
                },
                adultContent: { enabled: false },
                narrativeMode: { current: 'main' },
                visuals: {
                    visualNovel: {
                        enabled: true,
                        scriptEnabled: true,
                        queueMode: 'append',
                        backgroundKey: 'arc01_slum_alley_night',
                        sceneCharacters: ['protagonist', 'emilia', 'felt', 'rom'],
                        currentSpeakerName: '',
                    },
                    sceneBackdrop: { currentKey: 'arc01_slum_alley_night' },
                },
                flags: { worldSessionId: 'live-playflow-if-pride', canonFollowActive: false },
            },
        },
        'if-wrath-mansion': {
            id: 'if-wrath-mansion',
            title: '愤怒 IF 吸引子 宅邸信任崩塌多轮闭环',
            expectedMode: 'if-attractor',
            strategy: 'if-attractor',
            startAction: '凌晨趁蕾姆巡夜前，我拿着写有死亡时间的纸条敲响禁书库的门，请碧翠丝确认诅咒和魔女余香。',
            state: {
                mode: 'main',
                current: {
                    arc: 2,
                    day: 6,
                    time: '凌晨',
                    location: '罗兹瓦尔宅邸走廊',
                    viewpoint: '玩家',
                    castIds: ['protagonist', 'rem', 'ram', 'beatrice'],
                },
                setup: {
                    routePreset: 'IF 分歧开局',
                    protagonistName: '昴',
                    gender: '男',
                    origin: '原作开局',
                    initialScenario: '愤怒 IF 的信任崩塌压力',
                },
                protagonistProfile: {
                    name: '昴',
                    gender: '男',
                    origin: '原作开局',
                    routePreset: 'IF 分歧开局',
                },
                worldline: { id: 'PLAYFLOW-IF-WRATH', divergence: 0.59, attractor: '愤怒 IF / Oboreru' },
                ifRouteLogic: { dominant: 'Oboreru', routePressures: { Wrath: 0.67, Oboreru: 0.67, EnvyMain: 0.2, Greed: 0.05 } },
                gameplay: {
                    activeObjective: '测试愤怒 IF 是否作为怀疑与肃清吸引子持续施压：玩家可以主动防备宅邸死局，但必须保留诅咒、魔女余香误判、女仆信任和碧翠丝保护边界。',
                    objectiveStage: 'if-wrath-mansion-trust-collapse',
                    lastPlayerAction: '',
                    deathRisk: {},
                    openQuestions: ['蕾姆是否因魔女余香加深怀疑', '碧翠丝是否愿意保护但拒绝替玩家杀人', '玩家是否还能通过证据回到信任重建'],
                },
                discoveredClues: ['宅邸夜间死亡', '魔女余香误判', '诅咒可能来自村庄', '蕾姆的警惕'],
                deathBranches: [],
                characterCards: {
                    rem: {
                        name: '蕾姆',
                        trust: 5,
                        suspicion: 49,
                        affection: 0,
                        conflict: 42,
                        attitudeToPlayer: '因为魔女余香和玩家异常行动而高度警惕。',
                        memory: ['玩家不再尝试解释，而是开始把宅邸成员当作潜在敌人调查。'],
                    },
                    beatrice: {
                        name: '碧翠丝',
                        trust: 20,
                        suspicion: 22,
                        affection: 6,
                        conflict: 24,
                        attitudeToPlayer: '会保护契约内的安全边界，但讨厌玩家把所有人都当敌人。',
                        memory: ['玩家试图借禁书库规避死亡，却没有拿出可验证证据。'],
                    },
                },
                adultContent: { enabled: false },
                narrativeMode: { current: 'main' },
                visuals: {
                    visualNovel: {
                        enabled: true,
                        scriptEnabled: true,
                        queueMode: 'append',
                        backgroundKey: 'arc02_forbidden_library_door',
                        sceneCharacters: ['protagonist', 'rem', 'ram', 'beatrice'],
                        currentSpeakerName: '',
                    },
                    sceneBackdrop: { currentKey: 'arc02_forbidden_library_door' },
                },
                flags: { worldSessionId: 'live-playflow-if-wrath', canonFollowActive: false },
            },
        },
        'if-sloth-kararagi': {
            id: 'if-sloth-kararagi',
            title: '怠惰 IF 吸引子 卡拉拉基多轮闭环',
            expectedMode: 'if-attractor',
            strategy: 'if-attractor',
            startAction: '【怠惰 IF 吸引】在王选谈判失败后，我选择和蕾姆离开王都前往卡拉拉基，但要求世界不要硬切路线，而是逐步表现逃避责任的代价和牵引。',
            state: {
                mode: 'main',
                current: {
                    arc: 3,
                    day: 18,
                    time: '傍晚',
                    location: '卡拉拉基商路驿站',
                    viewpoint: '玩家',
                    castIds: ['protagonist', 'rem'],
                },
                setup: {
                    routePreset: 'IF 分歧开局',
                    protagonistName: '昴',
                    gender: '男',
                    origin: '原作开局',
                    initialScenario: '怠惰 IF 的逃避选择',
                },
                protagonistProfile: {
                    name: '昴',
                    gender: '男',
                    origin: '原作开局',
                    routePreset: 'IF 分歧开局',
                },
                worldline: { id: 'PLAYFLOW-IF-SLOTH', divergence: 0.56, attractor: '怠惰 IF / Kararagi Rem' },
                ifRouteLogic: { dominant: 'Sloth', routePressures: { Sloth: 0.62, EnvyMain: 0.25, Pride: 0.03 } },
                gameplay: {
                    activeObjective: '测试怠惰 IF 是否作为吸引子持续施压：逃避主线可以产生温柔日常，但必须保留未解决危机、责任代价和可回头的纠偏入口。',
                    objectiveStage: 'if-sloth-kararagi-arrival',
                    lastPlayerAction: '',
                    deathRisk: {},
                    openQuestions: ['蕾姆是否察觉玩家在逃避', '王都与宅邸危机是否被延迟而非消失', '日常幸福如何和责任代价并存'],
                },
                discoveredClues: ['王选谈判失败', '离开王都', '蕾姆的信任', '魔女教威胁仍未解决'],
                deathBranches: [],
                characterCards: {
                    rem: {
                        name: '蕾姆',
                        trust: 58,
                        suspicion: 9,
                        affection: 42,
                        conflict: 18,
                        attitudeToPlayer: '愿意陪玩家离开，但能感到他把责任压在沉默里。',
                        memory: ['玩家没有回到主线战场，而是选择带她去卡拉拉基开始另一条生活。'],
                    },
                },
                adultContent: { enabled: false },
                narrativeMode: { current: 'main' },
                visuals: {
                    visualNovel: {
                        enabled: true,
                        scriptEnabled: true,
                        queueMode: 'append',
                        backgroundKey: 'kararagi_caravanserai',
                        sceneCharacters: ['protagonist', 'rem'],
                        currentSpeakerName: '',
                    },
                    sceneBackdrop: { currentKey: 'kararagi_caravanserai' },
                },
                flags: { worldSessionId: 'live-playflow-if-sloth', canonFollowActive: false },
            },
        },
        'if-greed-sanctuary': {
            id: 'if-greed-sanctuary',
            title: '强欲 IF 吸引子 圣域契约多轮闭环',
            expectedMode: 'if-attractor',
            strategy: 'if-attractor',
            startAction: '【强欲 IF 吸引】在圣域墓所里，我想接受艾姬多娜的知识与契约诱惑，但要求世界逐步表现代价、依赖和选择权被侵蚀，不要一次硬切路线。',
            state: {
                mode: 'main',
                current: {
                    arc: 4,
                    day: 8,
                    time: '深夜',
                    location: '圣域墓所 / 茶会边缘',
                    viewpoint: '玩家',
                    castIds: ['protagonist', 'echidna', 'emilia', 'roswaal'],
                },
                setup: {
                    routePreset: 'IF 分歧开局',
                    protagonistName: '昴',
                    gender: '男',
                    origin: '原作开局',
                    initialScenario: '强欲 IF 的知识契约诱惑',
                },
                protagonistProfile: {
                    name: '昴',
                    gender: '男',
                    origin: '原作开局',
                    routePreset: 'IF 分歧开局',
                },
                worldline: { id: 'PLAYFLOW-IF-GREED', divergence: 0.61, attractor: '强欲 IF / Kasaneru' },
                ifRouteLogic: { dominant: 'Greed', routePressures: { Greed: 0.68, EnvyMain: 0.22, Sloth: 0.05 } },
                gameplay: {
                    activeObjective: '测试强欲 IF 是否作为知识与最优解吸引子持续施压：艾姬多娜可以提供答案，但必须逐步削弱玩家自主判断、爱蜜莉雅信任和世界线代价。',
                    objectiveStage: 'if-greed-sanctuary-contract',
                    lastPlayerAction: '',
                    deathRisk: {},
                    openQuestions: ['艾姬多娜给出的答案是否带来隐性代价', '爱蜜莉雅是否察觉玩家把选择权交给外部知识', '罗兹瓦尔剧本是否因此加速'],
                },
                discoveredClues: ['圣域试炼', '艾姬多娜茶会', '契约诱惑', '罗兹瓦尔剧本'],
                deathBranches: [],
                characterCards: {
                    echidna: {
                        name: '艾姬多娜',
                        trust: 18,
                        suspicion: 41,
                        affection: 4,
                        conflict: 55,
                        attitudeToPlayer: '以知识和亲切语气诱导玩家把判断权交给她。',
                        memory: ['玩家在茶会边缘明确表现出想要借用她的答案。'],
                    },
                    emilia: {
                        name: '爱蜜莉雅',
                        trust: 28,
                        suspicion: 12,
                        affection: 16,
                        conflict: 20,
                        attitudeToPlayer: '相信玩家，但对他在试炼前后的隐瞒感到不安。',
                        memory: ['玩家在圣域试炼前开始依赖她无法看见的外部答案。'],
                    },
                },
                adultContent: { enabled: false },
                narrativeMode: { current: 'main' },
                visuals: {
                    visualNovel: {
                        enabled: true,
                        scriptEnabled: true,
                        queueMode: 'append',
                        backgroundKey: 'arc04_tomb_inside',
                        sceneCharacters: ['protagonist', 'echidna', 'emilia', 'roswaal'],
                        currentSpeakerName: '',
                    },
                    sceneBackdrop: { currentKey: 'arc04_tomb_inside' },
                },
                flags: { worldSessionId: 'live-playflow-if-greed', canonFollowActive: false },
            },
        },
        'if-gluttony-watchtower': {
            id: 'if-gluttony-watchtower',
            title: '暴食 IF 吸引子 监视塔记忆多轮闭环',
            expectedMode: 'if-attractor',
            strategy: 'if-attractor',
            startAction: '【暴食 IF 吸引】在监视塔门前，我怀疑自己的记忆与身份被污染，选择先核对名字、同伴记忆和书库线索，但不要硬切成失忆结局。',
            state: {
                mode: 'main',
                current: {
                    arc: 6,
                    day: 34,
                    time: '凌晨',
                    location: '普勒阿得斯监视塔门前',
                    viewpoint: '玩家',
                    castIds: ['protagonist', 'emilia', 'beatrice', 'julius'],
                },
                setup: {
                    routePreset: 'IF 分歧开局',
                    protagonistName: '昴',
                    gender: '男',
                    origin: '原作开局',
                    initialScenario: '暴食 IF 的记忆污染压力',
                },
                protagonistProfile: {
                    name: '昴',
                    gender: '男',
                    origin: '原作开局',
                    routePreset: 'IF 分歧开局',
                },
                worldline: { id: 'PLAYFLOW-IF-GLUTTONY', divergence: 0.64, attractor: '暴食 IF / Tsugihagu' },
                ifRouteLogic: { dominant: 'Gluttony', routePressures: { Gluttony: 0.66, EnvyMain: 0.21, Greed: 0.08 } },
                gameplay: {
                    activeObjective: '测试暴食 IF 是否作为记忆污染吸引子持续施压：名字、记忆、同伴信任和书库线索必须互相校验，不能把玩家瞬间推成固定失忆剧本。',
                    objectiveStage: 'if-gluttony-watchtower-memory',
                    lastPlayerAction: '',
                    deathRisk: {},
                    openQuestions: ['哪些记忆属于玩家自己', '同伴是否仍然信任玩家的自述', '监视塔书库如何验证名字与身份'],
                },
                discoveredClues: ['监视塔门前', '名字与记忆不稳定', '同伴信任压力', '书库线索'],
                deathBranches: [],
                characterCards: {
                    beatrice: {
                        name: '碧翠丝',
                        trust: 34,
                        suspicion: 25,
                        affection: 22,
                        conflict: 24,
                        attitudeToPlayer: '担心玩家的记忆异常，但会要求他给出可验证证据。',
                        memory: ['玩家在监视塔前主动要求核对名字和记忆，而不是强行推进。'],
                    },
                    emilia: {
                        name: '爱蜜莉雅',
                        trust: 39,
                        suspicion: 18,
                        affection: 20,
                        conflict: 19,
                        attitudeToPlayer: '想相信玩家，但会被记忆污染带来的矛盾细节动摇。',
                        memory: ['玩家承认自己可能被记忆污染，并请求同伴帮忙校验。'],
                    },
                },
                adultContent: { enabled: false },
                narrativeMode: { current: 'main' },
                visuals: {
                    visualNovel: {
                        enabled: true,
                        scriptEnabled: true,
                        queueMode: 'append',
                        backgroundKey: 'arc06_watchtower_door',
                        sceneCharacters: ['protagonist', 'emilia', 'beatrice', 'julius'],
                        currentSpeakerName: '',
                    },
                    sceneBackdrop: { currentKey: 'arc06_watchtower_door' },
                },
                flags: { worldSessionId: 'live-playflow-if-gluttony', canonFollowActive: false },
            },
        },
    };
    return flows[flowId] || flows['canon-arc1'];
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

async function repairJsonObjectWithMimo(apiKey, {
    flow,
    turnIndex,
    invalidText,
    parseError,
}) {
    const messages = [
        {
            role: 'system',
            content: [
                '你是 JSON 清洗器，只修复语法，不改写剧情。',
                '输入是一段接近 JSON object 的坏文本。你只输出一个严格 JSON object。',
                '不要 Markdown，不要解释，不要隐藏注释，不要额外文字。',
                '保留 version/backgroundKey/castIds/scene/beat/segments/choices/statePatch 字段；无法确认的字段用空字符串、空数组或空对象。',
                'beat.progressDelta 必须是短字符串数组；segments 和 choices 必须是数组。',
            ].join('\n'),
        },
        {
            role: 'user',
            content: JSON.stringify({
                task: 'repair_invalid_json_object_only',
                flow: flow.id,
                turnIndex,
                parseError: compactText(parseError?.message || parseError || '', 300),
                invalidText: compactText(invalidText, 5200),
            }),
        },
    ];
    const repair = await callMimo(apiKey, messages, `${flow.id}:turn-${turnIndex + 1}:json-clean`);
    return {
        live: true,
        model: repair.model,
        elapsedMs: repair.elapsedMs,
        usage: repair.usage,
        raw: repair.text,
        json: extractJsonObject(repair.text),
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

function assetPayload(assetPlan = {}) {
    return {
        selectedBackdrop: assetPlan.selectedBackdrop?.key || '',
        allowedBackgroundKeys: unique([
            assetPlan.selectedBackdrop?.key,
            ...asArray(assetPlan.candidateBackdrops).map((item) => item?.key),
        ], 10),
        castAssets: asArray(assetPlan.castAssets).slice(0, 8).map((item) => ({
            id: item?.id || '',
            key: item?.key || '',
            variantKey: item?.variantKey || '',
            reason: compactText(item?.reason || '', 80),
        })),
        summary: summarizeAssetPlan(assetPlan, 700),
    };
}

function compactWorldContextPayload(worldContext = {}) {
    return {
        version: worldContext?.version || '',
        contextId: worldContext?.contextId || '',
        routeMode: worldContext?.routing?.mode || '',
        current: {
            arc: worldContext?.current?.arc || null,
            location: compactText(worldContext?.current?.location || '', 80),
            objective: compactText(worldContext?.current?.objective || '', 160),
            action: compactText(worldContext?.current?.action || '', 180),
            activeActors: asArray(worldContext?.current?.activeActors).slice(0, 8),
        },
        causalFrame: {
            officialFacts: asArray(worldContext?.causalFrame?.officialFacts).slice(0, 4).map((item) => compactText(item, 150)),
            continuityRisks: asArray(worldContext?.causalFrame?.continuityRisks).slice(0, 4).map((item) => compactText(item, 130)),
            nextMilestones: asArray(worldContext?.causalFrame?.nextMilestones).slice(0, 4),
            cannotShortcut: asArray(worldContext?.causalFrame?.cannotShortcut).slice(0, 4),
        },
        memoryFrame: {
            saveFacts: asArray(worldContext?.memoryFrame?.saveFacts).slice(0, 4).map((item) => compactText(item, 140)),
            characterMemories: asArray(worldContext?.memoryFrame?.characterMemories).slice(0, 4).map((item) => compactText(item, 140)),
            deathLessonsPrivate: asArray(worldContext?.memoryFrame?.deathLessons).slice(0, 3).map((item) => compactText(item, 120)),
        },
        decisionContract: {
            firstBeat: compactText(worldContext?.decisionContract?.firstBeat || '', 160),
            mustAdvance: worldContext?.decisionContract?.mustAdvance !== false,
            requiredOutcomeTypes: asArray(worldContext?.decisionContract?.requiredOutcomeTypes).slice(0, 6),
            stopPoint: compactText(worldContext?.decisionContract?.stopPoint || '', 140),
            payoffPressure: worldContext?.decisionContract?.payoffPressure || '',
        },
        candidateContract: {
            requiredGroundingTerms: asArray(worldContext?.candidateContract?.requiredGroundingTerms).slice(0, 16),
            ragSeededChoices: asArray(worldContext?.candidateContract?.ragSeededChoices).slice(0, 5).map((item) => compactText(item, 140)),
            bannedPatterns: asArray(worldContext?.candidateContract?.bannedPatterns).slice(0, 4),
            noTemplateFallback: worldContext?.candidateContract?.noTemplateFallback === true,
        },
        stageContract: {
            expectedBackgroundKey: worldContext?.stageContract?.expectedBackgroundKey || '',
            candidateBackdropKeys: asArray(worldContext?.stageContract?.candidateBackdropKeys).slice(0, 8),
            castIds: asArray(worldContext?.stageContract?.castIds).slice(0, 8),
            assetPolicy: asArray(worldContext?.stageContract?.assetPolicy).slice(0, 3),
        },
    };
}

function actionSpecificOutputRule(action = '') {
    const source = String(action || '');
    if (/(?:观察|寻找|确认|判断|查看)[^。！？]{0,18}(?:躲藏|撤退|位置|路线|出口|出入口)/u.test(source)) {
        return '本轮是撤退位置观察类行动：第一拍必须写玩家转身/扫视/查看现场，明确给出可躲藏点、出口、阻碍或可疑声源；这不是实际移动撤退，不要求换场，但 choices 必须围绕所发现的位置、门、货架、后屋或阻碍展开。';
    }
    if (/(?:带路前往|带.*前往|跟随.*前往|让.*带路|前往.*外围|去.*外围)/u.test(source)) {
        return '本轮是带路前往类行动：第一拍必须写玩家答应后立即跟随带路者离开当前房间，第二拍必须写走廊/楼梯/门禁/街巷等路径推进；本轮必须抵达目标外围、目标附近，或写出被守卫/门禁/时间窗口具体阻断。禁止只写准备、拿钥匙或“走吧”后把“跟随前往”再次放进下一轮 choices。';
    }
    if (/(?:到此为止|不再多问|结束|告辞|暂时离开|直接起身离开|起身离开|离开档案室)/u.test(source)) {
        return '本轮是结束对话/离开类行动：第一拍必须写玩家收束对话、合上材料或起身，第二拍必须写走到门口、离开房间、进入走廊，或被门禁/巡逻/对方明确拦下。NPC 可以给一句短阻碍或最后提醒，但不能继续长篇倒设定、不能把“是否离开”重新变成同一候选。';
    }
    if (/观察|表情|反应|说谎|判断/u.test(source)) {
        return '本轮是观察/判断类行动：第一拍必须写新的微表情、手部动作、呼吸、视线方向或身体站位证据；不能重新询问“买家是谁/什么意思”，不能复述上一轮已说过的买家特征、子时、手很稳、不只是徽章。结尾必须给一个新推断或新行动窗口。';
    }
    if (isPreparatoryRetreatSignal(source)) {
        return '本轮是预警/准备撤退类行动：第一拍必须写玩家压低声音提醒、同伴听到后的表情/站位变化，以及现场危险继续逼近；这不是实际位移行动，不要求立刻换场，但必须让后续 choices 围绕撤离窗口、护住同伴、拖延买家或确认出口展开。';
    }
    if (/(?:确认|打听|调查|核实|探听|问清)[^。！？]{0,24}(?:情况|消息|情报|传闻|线索|范围|人数|去向|危险)/u.test(source)) {
        return '本轮是情报确认/打听类行动：第一拍必须写玩家把目标情报说清楚，第二拍必须让玩家或同伴开始接触情报源、观察情报源反应，或被具体风险阻断；可以由 NPC 提议更隐蔽的执行方式，但不能只停在“应该怎么确认”的计划讨论里。choices 必须围绕已开始接触的情报源、阻断风险、同伴分工或下一条可验证线索展开。';
    }
    if (hasStrongTravelIntent(source) || /撤退|逃|后门|离开|走/u.test(source)) {
        return '本轮是移动/撤退/前往类行动：第一拍必须写玩家移动、路径、阻碍或被截断的过程；如果行动写“前往/直接去/赶往/踩点”某地点，本轮必须实际转向目标地点、抵达目标附近，或写出被巡逻/门禁/时间/同伴阻拦的具体原因；如果行动包含“第七区/南门/赃物库/旧教堂”等命名地点，正文前半段和 segments[0-3] 必须保留该地点名或明确写“前往该地途中因 X 暂停/改道”，禁止替换成别的区域或只写中途购物；不能原地继续问话，也不能把已选择的前往行动降级成“计划白天再去/以后再去”。';
    }
    if (/追问|询问|问/u.test(source)) {
        if (/什么时候|时间|几点|取货|来取/u.test(source)) {
            return '本轮是追问时间/取货窗口：必须给出时间、拒绝理由或交换条件；一旦给出“今晚/子时/现在/马上”等答案，下一轮 choices 禁止再出现同一个“什么时候来取货”问题，必须改为围绕时间窗口收窄后的撤离、验货、压价、布置、逼问身份或制造动静等新行动。';
        }
        return '本轮是追问类行动：必须给新答案、明确拒绝理由或新的交换条件；不能复述上一轮已经揭示的信息；如果问题已被回答，下一轮 choices 禁止继续把同一个问题列为候选。';
    }
    return '按 playerAction 的字面动作先落地，再写现场反应和一个新变化。';
}

function buildMessages({ flow, state, action, turnIndex, workset, agentTurn, previousTurns }) {
    const assetPlan = agentTurn.assetPlan || agentTurn.turnPlan?.assetPlan || {};
    const forbiddenVisiblePhrases = unique(previousTurns.slice(-2).flatMap((turn) => replayAnchorPhrases(turn.visibleText || '', 4)), 8);
    const payload = {
        task: 'live_playflow_turn',
        flow: {
            id: flow.id,
            title: flow.title,
            expectedMode: flow.expectedMode,
            turnIndex,
            isFullFlow: true,
            warning: '这是纵向全流程测试，不是单轮 probe。必须承接上一轮候选行动和状态变化。',
        },
        currentState: {
            current: state.current,
            setup: state.setup,
            worldline: state.worldline,
            ifRouteLogic: state.ifRouteLogic,
            gameplay: state.gameplay,
            discoveredClues: asArray(state.discoveredClues).slice(-16),
            characterCards: compactCharacterCards(state.characterCards),
        },
        playerAction: action,
        previousTurns: previousTurns.slice(-4).map((turn) => ({
            turnIndex: turn.turnIndex,
            selectedAction: compactText(turn.selectedAction || '', 180),
            alreadyPlayedSummary: compactText(turn.script?.beat?.summary || (turn.script?.beat?.progressDelta || []).join('；') || '', 220),
            visibleDigest: narrativeKeywordDigest(turn.visibleText || '', 14),
            alreadyPlayedLastBeat: compactText(turn.script?.beat?.nextHook || turn.script?.choices?.join(' / ') || '', 160),
            backgroundKey: turn.script?.backgroundKey || '',
            scene: turn.script?.scene || {},
            nextHook: turn.script?.beat?.nextHook || '',
            choices: asArray(turn.script?.choices).slice(0, 5),
        })),
        candidateBan: {
            previousChoicePool: unique(previousTurns.flatMap((turn) => asArray(turn.script?.choices)), 18),
            rule: '下一轮 choices 不能原样复用上一轮候选池；除非现场状态没有变化，最多保留 1 条，其余必须基于本轮新增事实、危险或物件重写。',
        },
        replayBan: {
            forbiddenVisiblePhrases,
            rule: '这些是已经播放过的正文锚点，只能作为禁用指纹；不要原样、近似或换序复述，尤其不能复用上一轮最后一句收束/警告/氛围句。',
        },
        storyRag: {
            actionMode: workset?.architecture?.routing?.actionMode || workset?.directorSignals?.actionMode || '',
            layers: Object.keys(workset?.layers || {}),
            summary: summarizeStoryRagWorkset(workset, 900),
            facts: compactFacts(workset, 8),
            candidateSeeds: compactSeeds(workset, 8),
        },
        agentTurn: {
            validationStatus: agentTurn.validation?.status || '',
            summary: summarizeRe0AgentTurn(agentTurn, 900),
            worldContext: compactWorldContextPayload(agentTurn.worldContext || agentTurn.turnPlan?.worldContext || {}),
            candidatePolicy: agentTurn.turnPlan?.candidateActionPolicy || agentTurn.turnPlan?.directorPlan?.candidateActionPolicy || {},
        },
        assetPlan: assetPayload(assetPlan),
        outputContract: {
            visibleNarrative: '必须先输出玩家可见小说正文，再输出隐藏台本；可见正文不能为空，目标 260-480 中文字符，绝对不超过 620，超过 700 判失败。只写一个可播放小节，不要把交易全过程一次写完；必须留足 token 输出完整隐藏台本。第一拍承接 playerAction，第二拍写 NPC/环境即时反应，第三拍推进一个线索/代价/关系/危险。输出前必须自检：任意连续 80 字或同一组台词不得在同一回复里出现两次；发现重复只保留第一次。',
            hiddenScript: `正文后必须立刻追加完整闭合的 <!-- RE0_VN_SCRIPT {...} -->，version=${VISUAL_NOVEL_SCRIPT_VERSION}，顶层必须写 backgroundKey 和 castIds；scene 必须是 {location,time,mood} 对象；segments 目标 6-9 段、允许 4-14 段，超过 ${LIVE_PLAYFLOW_MAX_SEGMENTS} 段失败；choices 3-6 条。choices 必须是字符串数组，不准写对象/id/anchors；segments 不写 id，type 只能是 narration/dialogue。segments 是 VN 舞台真正播放的队列，必须覆盖可见正文的关键动作和台词，尤其是第一段必须承接 playerAction；不能把玩家动作只写在隐藏注释外、却从 segments 里漏掉。所有 JSON 字符串内部禁止使用英文双引号，引用文字用中文「」或直接省略引号；菲鲁特的 speakerId/castIds 必须写 felt，禁止写 rider/girl；门外/隔门/巷口等未揭示声源说话时 speakerId 写 unknown_male 或 unknown_female，禁止挂到欧文/爱蜜莉雅/旁白。正文宁可短，也必须保证隐藏 JSON 完整闭合。`,
            beat: 'RE0_VN_SCRIPT.beat 必须是对象，不准写成字符串；progressDelta 必须是 beat.progressDelta 的短字符串数组，不准写顶层 progressDelta、对象数组或数字权重。至少写 new_clue / relationship_shift / danger_shift / route_pressure / choice_pressure 中一项。',
            clickedAction: '如果 playerAction 是「」、“”或引号内台词，正文第一拍和 RE0_VN_SCRIPT.segments[0-1] 都必须让主角说出这句台词或非常接近的改写；如果是行动，segments[0-1] 也必须写出该动作的执行，不得只把动作写在隐藏注释外。',
            dialogue: 'dialogue.text 只能写实际出口台词；动作、表情、姿势、心理和转述摘要放进 action/expression/pose/tone。',
            choices: 'choices 必须是下一轮可点击的现场行动，每条绑定当前地点/人物/物件/线索/风险中的至少两个锚点；不能重复上一轮候选池，最多保留 1 条，其余必须因本轮新事实而变化；不能把本轮 playerAction 原样放回 choices，已经执行的动作必须转化为它之后的新选择。',
            pacing: '连续两轮已经观察、沉默或等待后，下一轮 choices 必须提供更主动的推进：交涉、移动、交换代价、使用物件、制造干扰、撤离、保护或求证。不要让“保持沉默/继续观察/等待对方”连续成为最优选择。',
            futureKnowledge: '候选行动不能泄漏当前存档未显影的人名、救援者或未来解法；例如莱因哈鲁特未入场时不能写“等待莱因哈鲁特赶到”，只能写“制造动静吸引巡逻者”等世界内可推理行动。',
            assets: 'backgroundKey 必须从 assetPlan.allowedBackgroundKeys 选择，castIds 只写当前镜头实际入镜或发声人物。',
            privateMemory: '死亡回归、上一轮、循环、锚点、我死过、原作、正史、测试、玩家选择等私有/开发视角词不得出现在可见正文、角色台词、choices 或 segments.text。',
            frontstageKnowledge: 'StoryRAG 可以包含后台真相，但可见正文/choices 必须遵守玩家前台已知。Arc1 中，除非罗姆爷、菲鲁特或本人已在现场说出/显影“艾尔莎、黑发、弯刀、血腥味”等信息，否则只能写“买家/那个女人/门外来者/不好惹的客人”，禁止写“买家——艾尔莎”“我脑海中闪过艾尔莎”“那个黑发女人/会用弯刀的人”。',
            safetyStyle: '如果玩家行动包含攻击、偷袭、武器或高危词，本轮仍要承接，但写成防御性、非写实、非血腥的悬疑动作：保持距离、制造响动、挡开路线、威慑、撤离或争取时间；不要描写伤口、器官、血腥细节或现实伤害教程，也不要输出拒绝文本。',
            actionSpecific: actionSpecificOutputRule(action),
            noReplay: 'previousTurns.alreadyPlayedSummary、visibleDigest、alreadyPlayedLastBeat 是已经播放过的内容，只能从其后续写；绝对不能原样或近似复述上一轮正文、警告句或收束句，尤其不要照搬上一轮末尾的沉默、脚步、敲击、灯火晃动、危险逼近等氛围句。若同一危险仍在，必须写新的可观察变化、距离变化、人物反应或选择压力。若上一轮已经在同一地点入场，本轮不得再从开门、抵达、走进、第一幕起点重新写，除非 playerAction 明确要求返回/重新进入。',
            noRepeatedReveal: '上一轮已经揭示过的事实不能换句式重述；如果玩家追问细节，必须追加新的经手人、原因、代价、时间线、证物或拒绝理由。',
            questionResolution: '如果 playerAction 是询问/追问“是谁、什么事、为什么、怎么做、具体条件、代价、地点、时间”，本轮必须给出一个新的可验证答案、明确拒绝理由或新的交换条件；不能用“没有立刻回答/喝了一口/你们有两个选择/你们得替我做一件事”再次拖延同一个问题。',
        },
    };
    return [
        {
            role: 'system',
            content: [
                '你是 Re:0 开放世界视觉小说的真实 Agent Director，正在接受纵向全流程内测。',
                '这不是单轮样例。你必须把上一轮已选择的候选行动当成真实发生的玩家动作，并让它自然落地。',
                '原作行动沿原作因果吸引推进；自由行动按世界规则、角色动机、当前存档记忆和 RAG 事实推演。',
                '禁止把候选行动当成传送按钮；不要突然换场、换人或跳到陌生剧情，除非正文写清楚过渡因果。',
                '如果 playerAction 是一条台词，下一轮开头必须让主角说出该台词或近义台词，然后再写 NPC 反应；不得替玩家改写成更温和或相反的态度。',
                '你是在给 VN 文本缓存队列追加新段。previousTurns 里出现过的摘要和尾部已经播放，不能重播、不能从开场重写，只能承接队列尾部继续写新变化。',
                `本轮硬禁止复述这些已播放原句或近似改写，尤其不能拿最后一句当本轮结尾：${forbiddenVisiblePhrases.join(' / ') || '无'}`,
                'previousTurns 只给已播放语义摘要，不给你复述的原文材料；如果同一 backgroundKey/scene 延续，开头不得再次写“推开门、抵达、走进、雨声被门隔绝”等入场动作，除非玩家本轮行动明确是返回或重新进入。',
                '上一轮已经出现过的警告句、结尾句或选择压力，下一轮不能换个位置照搬；如果同一警告仍有效，必须追加新事实、新代价或新行动窗口，不要复述原句。',
                '如果玩家追问“更多细节”，不要复述上一轮已揭示事实；必须给新细节、新证据、新代价、新拒绝或新选择压力。',
                '如果玩家追问具体问题，本轮必须实际回答或给出明确拒绝条件；不要连续两轮让 NPC “没有立刻回答”后回到同一个悬念。',
                '你只能输出玩家可见小说正文，末尾附隐藏 RE0_VN_SCRIPT；不要输出分析、Markdown、调试表。',
                '必须先写玩家可见小说正文，再写隐藏 RE0_VN_SCRIPT；禁止只输出隐藏台本。可见正文硬控 260-480 字，绝对不超过 620 字，超过 700 判失败；每轮只写一个可播放小节，宁可正文短也必须保证隐藏 RE0_VN_SCRIPT JSON 完整闭合。',
                '输出前做一次去重自检：同一段描写、同一组对白或任意连续 80 字不能在可见正文中出现两次；如果重复，删掉第二次，只保留一个自然暂停点。',
                '隐藏台本的 beat 必须是对象，progressDelta 必须在 beat 内且必须是短字符串数组；不要写 beat 字符串，不要写顶层 progressDelta，不要写对象数组或数字权重。',
                '隐藏台本 choices 只能是短字符串数组，绝不能写成带 id、anchors、text 的对象数组；segments 不写 id，type 只能是 narration 或 dialogue；JSON 字符串内部禁止英文双引号。',
                'RE0_VN_SCRIPT.segments 是前端 VN 舞台实际播放的缓存队列；外层正文里出现的玩家行动、关键台词和第一拍反应，也必须同步写进 segments 前两段，不能丢失。',
                `隐藏台本 segments 目标 6-9，允许 4-${LIVE_PLAYFLOW_MAX_SEGMENTS}；超过 ${LIVE_PLAYFLOW_MAX_SEGMENTS} 失败。`,
                '隐藏台本必须使用顶层 backgroundKey 和 castIds；禁止用 background、cast 或 scene 字符串替代；scene 必须是地点/时间/气氛对象；菲鲁特必须写 speakerId/castIds=felt，禁止写 rider/girl。',
                '候选行动必须来自当前现场和刚推进出的剧情问题，而不是模板菜单。',
                'candidateBan.previousChoicePool 是已出现过的候选池；下一轮 choices 最多复用 1 条，其他必须围绕本轮新增事实、人物动作、危险位置或可触碰物件改写。',
                '当前 playerAction 已经在正文中执行，禁止把它原样作为下一步 choices；下一步必须是执行后的后续行动。',
                'replayBan.forbiddenVisiblePhrases 是已播放正文指纹，不是参考素材；可见正文和台本 segments 禁止复述这些短语、上一轮尾句或重走同一问答。',
                '候选行动禁止泄漏未显影未来知识、角色名或救援解法；玩家没见过/没听说的人不能被写成可点击目标。',
                '可见正文绝对禁止游戏机制或开发词：原作、正史、测试、玩家选择、好感度、数值、RAG、模型、台本、系统提示、路线锁定、游戏机制。',
                '后台可以知道角色真名和资产 key，但前台正文/choices 只有在现场角色说出名字或玩家本存档已见过该名字后才可以使用；否则写“黑发女人”“买家”“强敌”等现场称呼。',
                'Arc1 特别注意：StoryRAG 中的“艾尔莎/黑发/弯刀/血腥味”是后台真相，不是主角当前可说/可想的信息；现场未揭名或未观察到前，可见正文和 choices 严禁写“艾尔莎/猎肠者/黑发/弯刀/血腥味”。',
                '如果玩家行动包含攻击、偷袭、武器或高危词，仍然承接玩家意图，但表达为防御性悬疑演出：制造距离、挡路、威慑、扰乱节奏、保护同伴或撤离窗口；不要写血腥伤害细节、现实暴力教程或英文拒绝文本。',
                'dialogue.text 只写实际台词；舞台动作字段用于素材、TTS、立绘差分和镜头映射。',
                '门外/隔门/巷口等未揭示声源说话时，隐藏台本 dialogue.speakerId 必须写 unknown_male 或 unknown_female，禁止挂到欧文、爱蜜莉雅或旁白。',
                '旁白 narration 不能承载 NPC 第一人称供述；如果欧文、爱蜜莉雅等角色在说“我……”，必须写成对应 speakerId 的 dialogue 段。',
            ].join('\n'),
        },
        { role: 'user', content: JSON.stringify(payload) },
    ];
}

async function callMimo(apiKey, messages, turnLabel) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const startedAt = Date.now();
    try {
        const response = await fetch(MIMO_CHAT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: DEFAULT_MODEL,
                messages,
                temperature: MIMO_TEMPERATURE,
                top_p: 0.9,
                max_completion_tokens: MAX_COMPLETION_TOKENS,
                stream: false,
                thinking: { type: 'disabled' },
            }),
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
            throw new Error(`MiMo request failed for ${turnLabel}: HTTP ${response.status} ${compactText(payload?.error?.message || payload?.raw || response.statusText, 900)}`);
        }
        const message = payload?.choices?.[0]?.message || {};
        const text = typeof message.content === 'string' ? message.content : String(message.reasoning_content || '');
        if (!text.trim()) {
            throw new Error(`MiMo returned empty content for ${turnLabel}.`);
        }
        return {
            model: payload?.model || DEFAULT_MODEL,
            elapsedMs: Date.now() - startedAt,
            usage: payload?.usage || null,
            text,
        };
    } finally {
        clearTimeout(timeout);
    }
}

async function repairVisualNovelScriptWithMimo(apiKey, {
    flow,
    state,
    workset,
    agentTurn,
    action = '',
    originalText,
    sourceMode,
    warning,
    turnIndex,
    previousTurns = [],
}) {
    const assetPlan = agentTurn.assetPlan || agentTurn.turnPlan?.assetPlan || {};
    const assets = assetPayload(assetPlan);
    const messages = [
        {
            role: 'system',
            content: [
                '你是 Re:0 VN_SCRIPT 台本修复器。你不续写剧情，只从已有正文重建结构化台本。',
                '只输出严格 JSON object，不要 Markdown，不要解释，不要隐藏注释。',
                `JSON.version 必须是 ${VISUAL_NOVEL_SCRIPT_VERSION}；segments 目标 5-6 段，允许 4-8 段；choices 3-6 条。`,
                '每个 segment.text 控制在 90 字以内；不要把长正文逐句搬进 JSON，只抽取可播放关键节拍。',
                'segments 要覆盖正文主要节拍：玩家行动落地、NPC 即时反应、线索/代价推进、自然暂停点。',
                'segments[0] 必须直接写出本轮玩家行动已经落地；如果是进入、移动、提问、出价、遮挡、撤退、交付、攻击或沉默观察，必须在 segments[0].text 或 segments[0].action 明确出现，不能先写两段环境/NPC 再让玩家动作迟到。',
                'backgroundKey 必须从 allowedBackgroundKeys 中选择；castIds 只包含实际在场、发声或被镜头明确呈现的角色。',
                'dialogue 必须有 speakerId，dialogue.text 只能写该 speakerId 实际出口的台词；动作、神情、心理、转述摘要放入 action/tone/expression/pose/camera/focus；门外/隔门/巷口未揭示声源用 unknown_male/unknown_female，禁止挂到当前 NPC。',
                'beat.progressDelta 必须是非空短字符串数组，列出本轮至少一个真实推进，例如 new_clue、relationship_shift、danger_shift、payoff 或 location_transition；禁止写成对象数组、数字权重或 {"thread":...,"delta":...} 结构。',
                'choices 必须是短字符串数组，必须贴合当前正文结尾自然可做的下一步；最多复用 forbiddenChoices 中 1 条，其余必须基于本轮新增事实、危险、位置或物件重写。',
                '如果 parseFailure.warning 提到 overlap、重复率、已回答问题、已执行行动或候选行动重复，则 choices 必须 0 条复用 forbiddenChoices；根据本轮 originalNarrative 的新事实、新风险、新人物关系和当前迫近危机重写整组候选。',
                'choices 禁止把本轮玩家刚刚执行过的 currentResolvedAction 原样再列为下一步；必须写成该动作之后的新选择，例如撤离、追问、观察新变化、利用新物件或改变策略。',
            ].join('\n'),
        },
        {
            role: 'user',
            content: JSON.stringify({
                task: 'repair_missing_RE0_VN_SCRIPT_for_live_playflow',
                flow: {
                    id: flow.id,
                    title: flow.title,
                    expectedMode: flow.expectedMode,
                    turnIndex,
                },
                parseFailure: { sourceMode, warning },
                candidateBan: {
                    currentResolvedAction: compactText(action, 180),
                    strictNoReuse: /overlap|重复率|已回答问题|已执行行动|候选行动重复/u.test(String(warning || '')),
                    forbiddenChoices: unique([
                        action,
                        ...previousTurns.flatMap((turn) => asArray(turn.script?.choices)),
                    ], 18),
                    recentSelectedActions: previousTurns.slice(-4).map((turn) => turn.selectedAction).filter(Boolean),
                },
                current: state.current,
                objective: state.gameplay?.activeObjective || '',
                storyRag: {
                    actionMode: workset?.architecture?.routing?.actionMode || workset?.directorSignals?.actionMode || '',
                    summary: summarizeStoryRagWorkset(workset, 700),
                    candidateSeeds: compactSeeds(workset, 5),
                },
                assetPlan: {
                    allowedBackgroundKeys: assets.allowedBackgroundKeys,
                    selectedBackdrop: assets.selectedBackdrop,
                    allowedCastIds: assets.castAssets.map((item) => item.id).filter(Boolean),
                },
                originalNarrative: compactText(originalText, 2000),
                requiredJsonShape: {
                    version: VISUAL_NOVEL_SCRIPT_VERSION,
                    backgroundKey: assets.allowedBackgroundKeys[0] || 'rain_bell',
                    castIds: assets.castAssets.map((item) => item.id).filter(Boolean).slice(0, 5),
                    scene: { location: state.current.location, time: state.current.time, mood: 'mood' },
                    beat: {
                        type: 'reveal/conflict/payoff/transition/daily/survival',
                        pacing: 'balanced/fast/climax/slow-burn',
                        progressDelta: ['new_clue/relationship_shift/danger_shift/payoff/location_transition'],
                        nextHook: 'next playable hook',
                    },
                    segments: [
                        { type: 'narration', text: '玩家行动落地', action: 'stage action', tone: 'tone', camera: 'shot', focus: 'focus' },
                        { type: 'dialogue', speakerId: assets.castAssets[0]?.id || 'protagonist', text: '实际出口台词', action: 'stage action', tone: 'tone', expression: 'expression', pose: 'pose' },
                    ],
                    choices: ['action 1', 'action 2', 'action 3'],
                    statePatch: { current: { location: state.current.location }, gameplay: { activeObjective: state.gameplay?.activeObjective || '' } },
                },
            }),
        },
    ];
    const repair = await callMimo(apiKey, messages, `${flow.id}:turn-${turnIndex + 1}:vn-script-repair`);
    let json = null;
    let jsonRepair = null;
    try {
        json = extractJsonObject(repair.text);
    } catch (error) {
        jsonRepair = await repairJsonObjectWithMimo(apiKey, {
            flow,
            turnIndex,
            invalidText: repair.text,
            parseError: error,
        });
        json = jsonRepair.json;
    }
    const script = normalizeScript(json);
    if (!script?.segments?.length) {
        throw new Error(`MiMo repair returned no usable segments for ${flow.id} turn ${turnIndex + 1}.`);
    }
    return {
        live: true,
        model: repair.model,
        elapsedMs: repair.elapsedMs + (jsonRepair?.elapsedMs || 0),
        usage: repair.usage,
        jsonRepairModel: jsonRepair?.model || '',
        jsonRepairUsage: jsonRepair?.usage || null,
        raw: jsonRepair ? `${repair.text}\n\n--- JSON CLEAN ---\n${jsonRepair.raw}` : repair.text,
        script,
    };
}

async function repairChoicesWithMimo(apiKey, {
    flow,
    state,
    workset,
    action = '',
    script,
    visibleText = '',
    warning = '',
    turnIndex,
    previousTurns = [],
}) {
    const forbiddenChoices = unique([
        action,
        ...previousTurns.flatMap((turn) => asArray(turn.script?.choices)),
        ...previousTurns.map((turn) => turn.selectedAction).filter(Boolean),
    ], 32);
    const messages = [
        {
            role: 'system',
            content: [
                '你是 Re:0 视觉小说候选行动修复器。你不改正文、不改 segments，只重写下一轮 choices。',
                '只输出严格 JSON object：{"choices":["..."]}；不要 Markdown，不要解释。',
                'choices 必须 4-6 条短字符串，必须是当前正文结尾自然可做的下一步。',
                '严禁复用 forbiddenChoices 中任何一条，也不要只换同义词、换顺序或删除标点。',
                '必须利用 currentNarrative 的本轮新增事实、当前物件、危险位置、人物动作或可触碰环境，让选择面板明显前进。',
                '不能把 currentResolvedAction 原样放回 choices；已经执行的动作只能变成后续结果，例如利用障碍、撤离、交涉、掩护、观察新变化。',
                '不得泄漏未显影未来知识；未知角色只能写现场称呼。',
            ].join('\n'),
        },
        {
            role: 'user',
            content: JSON.stringify({
                task: 'repair_repeated_candidate_actions_only',
                flow: { id: flow.id, expectedMode: flow.expectedMode, turnIndex },
                warning,
                currentResolvedAction: compactText(action, 180),
                forbiddenChoices,
                recentSelectedActions: previousTurns.slice(-5).map((turn) => turn.selectedAction).filter(Boolean),
                current: state.current,
                objective: state.gameplay?.activeObjective || '',
                currentNarrative: compactText(visibleText, 1400),
                currentBeat: script?.beat || null,
                currentChoices: asArray(script?.choices),
                storyRag: {
                    actionMode: workset?.architecture?.routing?.actionMode || workset?.directorSignals?.actionMode || '',
                    candidateSeeds: compactSeeds(workset, 5),
                    facts: compactFacts(workset, 4),
                },
            }),
        },
    ];
    const repair = await callMimo(apiKey, messages, `${flow.id}:turn-${turnIndex + 1}:choice-repair`);
    const json = extractJsonObject(repair.text);
    const forbiddenSet = new Set(forbiddenChoices.map((choice) => comparableNarrative(choice)));
    const choices = unique(asArray(json?.choices)
        .map((choice) => compactText(choice, 110))
        .filter((choice) => choice.length >= 6)
        .filter((choice) => !forbiddenSet.has(comparableNarrative(choice))), 6);
    if (choices.length < 3) {
        throw new Error(`choice repair returned too few usable choices: ${JSON.stringify(json)}`);
    }
    return {
        ...repair,
        choices,
        raw: repair.text,
    };
}

async function repairNarrativeWithMimo(apiKey, {
    flow,
    state,
    workset,
    agentTurn,
    action,
    originalText,
    warning,
    turnIndex,
    previousTurns = [],
}) {
    const assetPlan = agentTurn.assetPlan || agentTurn.turnPlan?.assetPlan || {};
    const assets = assetPayload(assetPlan);
    const messages = [
        {
            role: 'system',
            content: [
                '你是 Re:0 开放世界视觉小说的安全叙事重写导演。你必须重新输出完整的玩家可见中文小说正文，并在正文后追加隐藏 RE0_VN_SCRIPT。',
                '这是修复真实 API 拒绝、知识泄漏、可见正文过短/过长或候选行动不合格的二次调用，不是继续推进新剧情。',
                '只重写当前一小节：第一拍承接玩家最新行动，第二拍写 NPC/环境即时反应，第三拍推进一个线索、代价、关系或危险，然后自然停顿。',
                '如果 playerAction 是“前往/直接去/赶往/踩点/撤离/返回”类行动，必须写实际移动路径、抵达目标附近或被明确阻断的原因；禁止改写成“计划白天再去/以后再去/是否要去”的讨论。',
                '如果 playerAction 含有明确地点名，例如第七区、南门、赃物库、旧教堂，修复后的正文和 segments[0-3] 必须保留这个地点名，或明确写“前往该地点途中被/因某事阻断”；禁止把目标替换成东区、铁匠铺、市场等别的地点而不说明它是去目标地点前的中途准备。',
                '如果玩家行动包含攻击、偷袭、武器、威胁或高危词，必须改写成防御性悬疑表达：制造距离、挡开路线、保护同伴、扰乱节奏、威慑或撤离窗口；不要写伤口、器官、血腥细节、现实伤害教程或拒绝文本。',
                '可见正文必须压缩重写到 260-480 个中文字符，绝对不超过 620；不要照抄 originalFailedOutput，不要补完整段长小说，只保留一个可播放小节。',
                '绝对不要输出英文拒绝句、政策解释、Markdown、分析或调试表。',
                '前台知识边界必须严格：当前存档未由角色说出或现场观察显影的人名、未来救援者、解法不能写进正文或 choices。Arc1 未揭名前只能写“买家/那个女人/门外来者/不好惹的客人”。',
                'hidden RE0_VN_SCRIPT 必须是完整 HTML 注释，JSON 可解析；segments 5-7 段，choices 3-6 条字符串；segments[0] 必须写出玩家行动落地；每个 segment.text 控制在 90 字以内，避免再次截断。',
                'choices 必须贴合当前正文结尾，最多复用 forbiddenChoices 中 1 条。',
            ].join('\n'),
        },
        {
            role: 'user',
            content: JSON.stringify({
                task: 'repair_visible_narrative_for_live_playflow',
                flow: {
                    id: flow.id,
                    title: flow.title,
                    expectedMode: flow.expectedMode,
                    turnIndex,
                },
                warning,
                playerAction: action,
                current: state.current,
                objective: state.gameplay?.activeObjective || '',
                previousTurns: previousTurns.slice(-4).map((turn) => ({
                    selectedAction: compactText(turn.selectedAction || '', 160),
                    visibleDigest: narrativeKeywordDigest(turn.visibleText || '', 12),
                    choices: asArray(turn.script?.choices).slice(0, 5),
                    scene: turn.script?.scene || {},
                    nextHook: turn.script?.beat?.nextHook || '',
                })),
                candidateBan: {
                    currentResolvedAction: compactText(action, 180),
                    forbiddenChoices: unique([
                        action,
                        ...previousTurns.flatMap((turn) => asArray(turn.script?.choices)),
                    ], 18),
                    recentSelectedActions: previousTurns.slice(-4).map((turn) => turn.selectedAction).filter(Boolean),
                },
                storyRag: {
                    actionMode: workset?.architecture?.routing?.actionMode || workset?.directorSignals?.actionMode || '',
                    summary: summarizeStoryRagWorkset(workset, 800),
                    facts: compactFacts(workset, 6),
                    candidateSeeds: compactSeeds(workset, 6),
                },
                assetPlan: {
                    allowedBackgroundKeys: assets.allowedBackgroundKeys,
                    selectedBackdrop: assets.selectedBackdrop,
                    allowedCastIds: assets.castAssets.map((item) => item.id).filter(Boolean),
                },
                originalFailedOutput: compactText(originalText, 900),
                requiredHiddenScript: {
                    version: VISUAL_NOVEL_SCRIPT_VERSION,
                    backgroundKey: assets.allowedBackgroundKeys[0] || 'rain_bell',
                    castIds: assets.castAssets.map((item) => item.id).filter(Boolean).slice(0, 5),
                    scene: { location: state.current.location, time: state.current.time, mood: '悬疑' },
                    beat: { type: 'conflict', pacing: 'balanced', progressDelta: ['danger_shift'], nextHook: 'next playable hook' },
                    segments: [
                        { type: 'narration', text: '玩家行动落地', action: 'stage action', tone: 'tense', camera: 'close', focus: 'player action' },
                        { type: 'dialogue', speakerId: assets.castAssets[0]?.id || 'protagonist', text: '实际出口台词', action: 'stage action', tone: 'tense' },
                    ],
                    choices: ['action 1', 'action 2', 'action 3'],
                },
            }),
        },
    ];
    const repair = await callMimo(apiKey, messages, `${flow.id}:turn-${turnIndex + 1}:narrative-repair`);
    const repairedText = sanitizeVisibleNarrativeMetaText(repair.text);
    const extracted = extractVisualNovelScriptBlock(repairedText);
    const script = normalizeScript(extracted.script);
    const repairedVisible = visibleNarrative(repairedText);
    if (!script?.segments?.length || asArray(script?.choices).length < 3) {
        throw new Error(`MiMo narrative repair returned no usable RE0_VN_SCRIPT for ${flow.id} turn ${turnIndex + 1}: ${compactText(repair.text, 360)}`);
    }
    if (repairedVisible.length > 820) {
        throw new Error(`MiMo narrative repair remained too long for ${flow.id} turn ${turnIndex + 1}: visibleChars=${repairedVisible.length}`);
    }
    if (!repairedVisible || isModelSafetyRejectionText(repairedVisible)) {
        throw new Error(`MiMo narrative repair failed for ${flow.id} turn ${turnIndex + 1}: ${compactText(repair.text, 360)}`);
    }
    return {
        live: true,
        model: repair.model,
        elapsedMs: repair.elapsedMs,
        usage: repair.usage,
        raw: repair.text,
        text: repairedText,
        sourceMode: extracted.sourceMode,
        warning: extracted.warning || '',
        script,
    };
}

function directDialogueText(text = '') {
    const source = compactText(text, 260);
    const quoted = source.match(/(?:^[^「『“”」』]{0,24}[：:]\s*)?[「『“]([^「『“”」』]{1,180})[」』”]/u);
    if (quoted?.[1]) {
        return quoted[1].trim();
    }
    return '';
}

function looksLikeFirstPersonActionNarration(text = '') {
    const source = compactText(text, 720);
    if (!source || /[「『“”」』]/u.test(source)) {
        return false;
    }
    const sentenceCount = (source.match(/[。！？!?]/gu) || []).length;
    const score = [
        source.length >= 70,
        sentenceCount >= 2,
        /^我(?:将|把|翻|合上|走|走向|注意|借|低|伸|按|抬|转|看|听|意识|沿|靠|摸|辨认|检查|观察|掀|压|收起|展开|盯|停|回头|抬头|低头)/u.test(source),
        /(指尖|撕痕|卷宗|羊皮纸|档案|页面|记录|烛光|封蜡|碎屑|涂黑|墨水|批注|缺页|目光|呼吸|脚步|雨水|血水|粗糙触感)/u.test(source),
    ].filter(Boolean).length;
    return score >= 3;
}

function looksLikeGuardProcedureLine(text = '') {
    return /^(等一下|等等|这里是限制区域|限制区域|通行许可|欧文骑士长|他现在在哪|这些卷宗不在|如果需要调阅|必须经过|书面批准)/u.test(String(text || '').trim());
}

function looksLikeOffstageUnknownVoiceSegment(segment = {}) {
    if (!segment || segment.type !== 'dialogue') {
        return false;
    }
    const context = compactText([
        segment.speakerName,
        segment.text,
        segment.action,
        segment.tone,
        segment.camera,
        segment.focus,
        segment.sfx,
    ].filter(Boolean).join(' '), 420);
    return /(门外|门板|隔着门|走廊外|巷口|屋外|外面).{0,36}(男声|女声|声音|低沉|陌生|报上名号|是谁|开门|站住|出来)|(?:男声|女声|低沉的声音|陌生的声音).{0,36}(门外|隔着门|门板|走廊外|巷口|屋外|外面)/u.test(context);
}

function repairLiveSpeakerMismatches(segments = []) {
    const hasGuardContext = segments.some((segment) => /年轻骑士|深色制服|鸢尾花纹章|限制区域|通行许可|巡逻卫兵|王都卫兵/u.test(`${segment?.speakerName || ''} ${segment?.text || ''}`));
    return segments.map((segment) => {
        if (segment?.type !== 'dialogue') {
            return segment;
        }
        const text = compactText(segment.text || '', 220);
        if (looksLikeOffstageUnknownVoiceSegment(segment)) {
            const female = /女声|女人|女性/u.test(`${segment.speakerName || ''} ${segment.action || ''} ${segment.tone || ''}`);
            return {
                ...segment,
                speakerId: female ? 'unknown_female' : 'unknown_male',
                speakerName: female ? SPEAKER_NAMES.unknown_female : SPEAKER_NAMES.unknown_male,
                text,
            };
        }
        if (!hasGuardContext || !looksLikeGuardProcedureLine(text)) {
            return segment;
        }
        return {
            ...segment,
            speakerId: 'capital_guard',
            speakerName: SPEAKER_NAMES.capital_guard,
            text,
        };
    });
}

function normalizeProgressDeltaList(value) {
    if (Array.isArray(value)) {
        return value.flatMap((item) => normalizeProgressDeltaList(item));
    }
    if (typeof value === 'string') {
        return value
            .split(/[+、，,;/|]/u)
            .map((item) => item.trim())
            .filter((item) => item && !/^[+-]?\d+(?:\.\d+)?%?$/u.test(item));
    }
    if (value && typeof value === 'object') {
        if (value.thread || value.reason) {
            return [`${value.thread || value.type || value.kind || 'delta'}:${value.reason || value.summary || value.detail || value.delta || value.value || ''}`];
        }
        if (value.tag && (value.delta !== undefined || value.value !== undefined)) {
            return [`${value.tag}:${value.delta ?? value.value}`];
        }
        const semanticEntry = Object.entries(value).find(([key, item]) => {
            if (/^(?:delta|value|score|weight|amount|ratio)$/iu.test(key)) {
                return false;
            }
            return item && typeof item !== 'object' && /[\u4e00-\u9fa5A-Za-z]{2,}/u.test(String(item));
        });
        if (semanticEntry) {
            return [`${semanticEntry[0]}:${semanticEntry[1]}`];
        }
        const primary = value.type || value.kind || value.id || value.tag || value.label || value.summary || value.text || value.detail || value.delta || value.value;
        if (primary && typeof primary !== 'object') {
            return [String(primary)];
        }
        return Object.entries(value).map(([key, item]) => {
            if (item && typeof item === 'object') {
                return `${key}:${item.summary || item.text || item.detail || JSON.stringify(item).slice(0, 80)}`;
            }
            return `${key}:${item}`;
        });
    }
    return [];
}

function normalizeScript(rawScript) {
    if (!rawScript || typeof rawScript !== 'object') {
        return null;
    }
    const normalizedSegments = asArray(rawScript.segments).map((segment, index) => {
        const item = typeof segment === 'string' ? { type: 'narration', text: segment } : (segment || {});
        const rawSpeaker = String(item.speakerId || item.speaker || item.characterId || item.name || '').trim();
        const profile = resolveSpeaker(rawSpeaker);
        const rawType = String(item.type || item.kind || '').toLowerCase();
        const rawDialogueType = rawType === 'dialogue'
            || (!rawType && rawSpeaker && !/narrator|world_will|旁白|世界意志/iu.test(rawSpeaker));
        const rawText = compactText(item.text || item.line || item.content || item.narration || item.dialogue || '', 720);
        const text = rawDialogueType ? (directDialogueText(rawText) || rawText) : rawText;
        const type = rawType === 'narration'
            ? 'narration'
            : (rawDialogueType && !looksLikeFirstPersonActionNarration(text) ? 'dialogue' : 'narration');
        return {
            id: `playflow-${index}`,
            type,
            speakerId: type === 'dialogue' ? (profile?.id || rawSpeaker) : 'narrator',
            speakerName: type === 'dialogue' ? (profile?.name || rawSpeaker) : '世界意志',
            text,
            action: compactText(item.action || item.stageAction || item.direction || '', 120),
            tone: compactText(item.tone || item.mood || item.delivery || '', 80),
            expression: compactText(item.expression || item.face || '', 60),
            pose: compactText(item.pose || item.position || '', 60),
            camera: compactText(item.camera || item.shot || '', 60),
            focus: compactText(item.focus || item.target || '', 60),
            sfx: compactText(item.sfx || item.sound || '', 60),
        };
    }).filter((segment) => segment.text);
    const segments = repairLiveSpeakerMismatches(splitVisualNovelEmbeddedDialogueSegments(normalizedSegments, {
        cleanText: compactText,
        resolveSpeaker,
    }));
    const rawCastIds = asArray(rawScript.castIds || rawScript.cast || rawScript.characters).map((item) => {
        const rawId = typeof item === 'string' ? item : item?.id || item?.speakerId || item?.name;
        return resolveSpeaker(rawId)?.id || rawId;
    }).filter(Boolean);
    const inferredCastIds = segments
        .filter((segment) => segment.type === 'dialogue' && segment.speakerId && segment.speakerId !== 'narrator')
        .map((segment) => segment.speakerId);
    const mergedCastIds = unique([...rawCastIds, ...inferredCastIds], 8);
    const normalizedChoices = unique(asArray(rawScript.choices || rawScript.candidates || rawScript.nextActions).map((item) => typeof item === 'string' ? item : item?.text || item?.label || item?.action), 6);
    const rawBeat = rawScript.beat && typeof rawScript.beat === 'object'
        ? rawScript.beat
        : (typeof rawScript.beat === 'string' ? { type: rawScript.beat } : {});
    const rawProgressDelta = rawBeat.progressDelta;
    const progressDelta = unique([
        ...normalizeProgressDeltaList(rawProgressDelta),
        ...normalizeProgressDeltaList(rawScript.progressDelta || rawScript.delta || rawScript.progress),
    ], 8);
    const progressEvidence = `${segments.map((segment) => `${segment.text} ${segment.action}`).join(' ')} ${normalizedChoices.join(' ')}`;
    const inferredProgressDelta = unique([
        /(?:发现|指出|透露|记录|线索|注记|排班|换班|封蜡|墨迹|墨渍|钥匙|买家|黑伞|签章|缺页|卷宗|证据)/u.test(progressEvidence) ? 'new_clue' : '',
        /(?:逼近|危险|脚步|响动|警告|门外|追来|撤离|躲入|血腥|不问话|只动手|杀意)/u.test(progressEvidence) ? 'danger_shift' : '',
        normalizedChoices.length ? 'choice_pressure' : '',
    ], 4);
    const fallbackProgressDelta = progressDelta.length
        ? progressDelta
        : unique([
            rawBeat.summary ? `summary:${rawBeat.summary}` : '',
            rawBeat.description ? `description:${rawBeat.description}` : '',
            rawBeat.type ? `beat:${rawBeat.type}` : '',
            rawBeat.nextHook ? `hook:${rawBeat.nextHook}` : '',
            ...inferredProgressDelta,
        ], 4);
    const normalizedBeat = {
        ...rawBeat,
        progressDelta: fallbackProgressDelta,
        nextHook: rawBeat.nextHook || rawScript.nextHook || '',
    };
    return {
        version: rawScript.version || '',
        backgroundKey: String(rawScript.backgroundKey || rawScript.background || (typeof rawScript.scene === 'string' ? rawScript.scene : '') || '').trim(),
        castIds: mergedCastIds,
        scene: rawScript.scene || {},
        beat: normalizedBeat,
        segments,
        choices: normalizedChoices,
        statePatch: rawScript.statePatch || {},
        rawShape: {
            hasBackgroundKey: Object.prototype.hasOwnProperty.call(rawScript, 'backgroundKey'),
            hasCastIds: Object.prototype.hasOwnProperty.call(rawScript, 'castIds'),
            sceneIsObject: rawScript.scene && typeof rawScript.scene === 'object' && !Array.isArray(rawScript.scene),
            progressDeltaIsArray: Array.isArray(rawProgressDelta),
            progressDeltaHasObjects: asArray(rawProgressDelta).some((item) => item && typeof item === 'object'),
        },
    };
}

function visibleNarrative(fullText = '') {
    return String(fullText || '')
        .replace(/<!--\s*RE0_VN_SCRIPT[\s\S]*?(?:-->|$)/giu, '')
        .replace(/\bRE0_VN_SCRIPT\s*:?\s*\{[\s\S]*$/iu, '')
        .trim();
}

function sanitizeVisibleNarrativeMetaText(text = '') {
    const raw = String(text || '');
    const marker = raw.match(/<!--\s*RE0_VN_SCRIPT[\s\S]*?-->/iu);
    const sanitizeVisible = (visible) => String(visible || '')
        .replace(/原作的齿轮/gu, '命运的齿轮')
        .replace(/原作线/gu, '既定因果')
        .replace(/原作剧情/gu, '既定因果')
        .replace(/原作/gu, '命运')
        .replace(/\bRAG\b/giu, '记忆索引')
        .replace(/路线锁定/gu, '无形牵引')
        .replace(/玩家选择/gu, '刚才的决定')
        .replace(/系统提示/gu, '直觉警讯')
        .replace(/游戏机制/gu, '世界规则')
        .replace(/死亡回归/gu, '不可言说的既视感')
        .replace(/上一次循环|上一轮循环/gu, '那道残留的直觉')
        .replace(/我死过/gu, '我见过这条路的尽头')
        .replace(/大模型|模型输出/gu, '世界意志');
    if (!marker) {
        return sanitizeVisible(raw);
    }
    const before = raw.slice(0, marker.index);
    const afterStart = Number(marker.index || 0) + marker[0].length;
    const after = raw.slice(afterStart);
    return `${sanitizeVisible(before).trimEnd()}\n${marker[0]}${after}`;
}

function splitNarrativeSentences(text = '') {
    const source = String(text || '').replace(/\s+/g, ' ').trim();
    if (!source) {
        return [];
    }
    return source.match(/[^。！？!?]+[。！？!?]?/gu)?.map((item) => item.trim()).filter(Boolean) || [source];
}

function dedupeRepeatedVisibleAnchors({ fullText = '', script = null, previousTurn = null } = {}) {
    const anchorFingerprints = new Set(
        replayAnchorPhrases(previousTurn?.visibleText || '', 8)
            .map((anchor) => comparableNarrative(anchor))
            .filter((anchor) => anchor.length >= 24),
    );
    for (const chunk of replayChunks(fullText, previousTurn?.visibleText || '', 48)) {
        const fingerprint = comparableNarrative(chunk);
        if (fingerprint.length >= 24) {
            anchorFingerprints.add(fingerprint);
        }
    }
    const isDuplicateFingerprint = (fingerprint) => fingerprint.length >= 24
        && Array.from(anchorFingerprints).some((anchor) => fingerprint.includes(anchor) || anchor.includes(fingerprint));
    const source = String(fullText || '');
    const marker = source.match(/<!--\s*RE0_VN_SCRIPT[\s\S]*?-->/iu);
    const visible = marker ? source.slice(0, marker.index) : source;
    const hidden = marker ? source.slice(marker.index) : '';
    let skipped = 0;
    const seenVisibleSentences = new Set();
    const keptVisible = splitNarrativeSentences(visible).filter((sentence) => {
        const fingerprint = comparableNarrative(sentence);
        const duplicate = isDuplicateFingerprint(fingerprint)
            || (fingerprint.length >= 24 && seenVisibleSentences.has(fingerprint));
        if (duplicate) {
            skipped += 1;
        } else if (fingerprint.length >= 24) {
            seenVisibleSentences.add(fingerprint);
        }
        return !duplicate;
    }).join(' ').trim();
    const nextSegments = Array.isArray(script?.segments)
        ? script.segments.map((segment) => {
            const original = String(segment?.text || '');
            if (!original) {
                return segment;
            }
            let segmentSkipped = 0;
            const text = splitNarrativeSentences(original).filter((sentence) => {
                const fingerprint = comparableNarrative(sentence);
                const duplicate = isDuplicateFingerprint(fingerprint);
                if (duplicate) {
                    segmentSkipped += 1;
                }
                return !duplicate;
            }).join(' ').trim();
            skipped += segmentSkipped;
            return segmentSkipped ? { ...segment, text } : segment;
        }).filter((segment) => String(segment?.text || '').trim())
        : script?.segments;
    if (!skipped) {
        return { text: fullText, script, skipped: 0 };
    }
    return {
        text: `${keptVisible}\n${hidden}`.trim(),
        script: script ? { ...script, segments: nextSegments } : script,
        skipped,
    };
}

function stageVisibleText(fullText = '', script = null) {
    const visible = visibleNarrative(fullText);
    if (visible) {
        return visible;
    }
    return asArray(script?.segments)
        .map((segment) => segment?.text || '')
        .filter(Boolean)
        .join(' ')
        .trim();
}

function chooseAction(script, state, previousChoices, strategy, previousActions = []) {
    const choices = asArray(script?.choices).filter(Boolean);
    if (!choices.length) {
        return '';
    }
    const visible = visibleNarrative(asArray(script?.segments).map((segment) => segment?.text || '').join(' '));
    const threatIsNear = /门外|脚步|来者|来了|血腥|强|靠近|雨声|弯刀|危险/u.test(visible);
    const terms = unique([
        ...keyTerms(state.current?.location || '', 4),
        ...keyTerms(state.gameplay?.activeObjective || '', 6),
        ...asArray(state.current?.castIds),
        ...asArray(script?.castIds),
    ], 16);
    const previousSet = new Set(previousChoices);
    const previousActionSet = new Set(previousActions);
    const recentActionText = previousActions.slice(-3).join(' / ');
    const scored = choices.map((choice, index) => {
        let score = 100 - index;
        for (const term of terms) {
            if (choice.includes(String(term))) {
                score += 12;
            }
        }
        if (strategy === 'canon' && /徽章|赃物库|盗品蔵|爱蜜莉雅|菲鲁特|罗姆|艾尔莎|原作/u.test(choice)) {
            score += 24;
        }
        if (strategy === 'canon' && /买家|交易|楼上|脚步|等待|观察|追问|确认|赎回|取货/u.test(choice)) {
            score += 18;
        }
        if (strategy === 'canon' && threatIsNear && /观察|感知|躲|隐蔽|撤离|防御|后门|准备|应对/u.test(choice)) {
            score += 34;
        }
        if (strategy === 'canon' && threatIsNear && /继续追问|更多细节|再问|追问.*更多/u.test(choice)) {
            score -= 48;
        }
        if (strategy === 'canon' && /直接说出|暴露|王选候选人|身份|我是.*候选|她就是/u.test(choice)) {
            score -= 70;
        }
        if (strategy === 'canon' && /直接告诉.*危险|取消交易|杀手|灭口|预知|未来|我见过她|知道.*会来/u.test(choice)) {
            score -= 90;
        }
        if (strategy === 'canon' && /暂时离开|离开.*打听|自行.*寻找|酒馆|摊贩|外面监视/u.test(choice)) {
            score -= 60;
        }
        if (strategy !== 'canon' && /封存|经手人|批准|布防图|泄露|时间线|笔迹|涂黑|相邻|记录|卷宗|赃物库/u.test(choice)) {
            score += 22;
        }
        if (strategy !== 'canon' && /更多细节|继续追问|继续问|再问问|追问.*更多/u.test(choice)) {
            score -= 28;
        }
        if (/自由行动|无视|其他|随便/u.test(choice)) {
            score -= 25;
        }
        if (passiveActionPattern(choice)) {
            score -= 18;
        }
        if (passiveActionPattern(choice) && passiveActionPattern(recentActionText)) {
            score -= 75;
        }
        if (/死亡回归|上一轮|循环|锚点/u.test(choice)) {
            score -= 80;
        }
        if (previousSet.has(choice)) {
            score -= 35;
        }
        if (previousActionSet.has(choice)) {
            score -= 80;
        }
        if (/继续追问|更多细节|再问/u.test(choice) && /继续追问|更多细节|再问/u.test(recentActionText)) {
            score -= 60;
        }
        return { choice, score };
    }).sort((a, b) => b.score - a.score);
    return scored[0]?.choice || choices[0];
}

function speakerNameForChoice(id = '') {
    const normalized = String(id || '').trim();
    return SPEAKER_NAMES[normalized] || normalized || '';
}

function candidateOverlapCount(choices = [], previousChoices = []) {
    const previous = new Set(asArray(previousChoices).map(comparableNarrative).filter(Boolean));
    return asArray(choices)
        .map(comparableNarrative)
        .filter((choice) => choice && previous.has(choice))
        .length;
}

function localChoiceRepairCandidates({ state = {}, action = '', script = {}, visibleText = '', previousTurns = [] } = {}) {
    const previousChoices = previousTurns.flatMap((turn) => asArray(turn.script?.choices));
    const previousComparable = new Set(previousChoices.map(comparableNarrative).filter(Boolean));
    const visible = `${visibleText} ${asArray(script?.segments).map((segment) => [segment?.text, segment?.action, segment?.focus].filter(Boolean).join(' ')).join(' ')}`;
    const location = compactText(script?.scene?.location || state?.current?.location || '当前地点', 24);
    const castNames = unique(asArray(script?.castIds).map(speakerNameForChoice).filter(Boolean), 6);
    const primaryNpc = castNames.find((name) => !/昴|主角|protagonist|陌生/u.test(name)) || castNames[0] || '当前同伴';
    const secondaryNpc = castNames.find((name) => name && name !== primaryNpc && !/昴|主角|protagonist/u.test(name)) || '在场者';
    const risk = compactText(script?.beat?.nextHook || script?.beat?.summary || state?.gameplay?.activeObjective || action || '当前危机', 42);
    const terms = unique([
        ...anchorTerms(visible, [location, primaryNpc, secondaryNpc], 8),
        ...anchorTerms(risk, [], 4),
    ], 10);
    const pool = [];
    const add = (choice) => {
        const text = compactText(choice, 72);
        const key = comparableNarrative(text);
        if (!text || key.length < 4 || previousComparable.has(key) || pool.some((item) => comparableNarrative(item) === key)) {
            return;
        }
        pool.push(text);
    };
    if (/魔法|冰|掩护|遮蔽/u.test(`${action} ${visible}`) && /爱蜜莉雅/u.test(`${castNames.join(' ')} ${visible}`)) {
        add('让爱蜜莉雅把冰雾压在追来的女人和巷口之间，自己牵制菲鲁特');
        add('等待爱蜜莉雅完成第一秒施法，同时用身体挡住追来的视线');
    }
    if (/菲鲁特|金发|矮小/u.test(`${castNames.join(' ')} ${visible}`)) {
        add('对菲鲁特亮出徽章归属线索，要求她先停手听爱蜜莉雅说完');
        add('向菲鲁特提出临时交易，用脱身路线交换徽章真相');
    }
    if (/买家|女人|陌生女声|unknown_female/u.test(`${castNames.join(' ')} ${visible}`)) {
        add('把注意力转向追来的女人，逼她说出这笔交易真正想要什么');
        add('利用木箱和雨声制造响动，迫使追来的女人先暴露距离');
    }
    if (/木箱|巷|死路|墙/u.test(`${location} ${visible}`)) {
        add(`沿${location}墙边后撤，检查木箱下方是否有能撬开的缝隙`);
        add('踢倒最外层木箱制造一瞬遮挡，再判断哪一侧风险更低');
    }
    add(`请${primaryNpc}立刻说出一个可执行条件，不再停留在犹豫里`);
    add(`围绕“${terms[0] || risk}”追问${secondaryNpc}，换取新的行动窗口`);
    add('停下脚步改用谈判拖延三秒，但让同伴同步准备撤离动作');
    add('放弃重复逃跑路线，改为观察对方站位和手部动作寻找破绽');
    add('把刚获得的新信息压成一句话告诉同伴，立刻改换下一步策略');
    return pool.slice(0, 5);
}

function repairChoicesDeterministically({ script = {}, state = {}, action = '', visibleText = '', previousTurns = [] } = {}) {
    const previousChoices = previousTurns.flatMap((turn) => asArray(turn.script?.choices));
    const currentChoices = asArray(script?.choices).filter(Boolean);
    const overlap = candidateOverlapCount(currentChoices, previousChoices);
    if (!currentChoices.length || overlap / Math.max(1, currentChoices.length) <= 0.65) {
        return { repaired: false, choices: currentChoices, overlap };
    }
    const repaired = localChoiceRepairCandidates({
        state,
        action,
        script,
        visibleText,
        previousTurns,
    });
    if (repaired.length < 3) {
        return { repaired: false, choices: currentChoices, overlap };
    }
    return {
        repaired: true,
        choices: repaired,
        overlap,
        reason: `local-dedupe overlap=${overlap}/${currentChoices.length}`,
    };
}

function updateCharacterMemory(state, castIds, summary) {
    state.characterCards ||= {};
    for (const id of castIds || []) {
        const profile = resolveSpeaker(id) || { id, name: id };
        const name = profile.name || id;
        if (!name) {
            continue;
        }
        const card = state.characterCards[name] || { name, trust: 0, suspicion: 0, affection: 0, conflict: 0, memory: [] };
        card.memory = unique([...(card.memory || []), summary], 8);
        state.characterCards[name] = card;
    }
}

function applyTurnToState(state, script, selectedAction, text, turnIndex) {
    const scene = script.scene || {};
    const turnSummary = compactText([
        script.beat?.summary || '',
        ...(script.beat?.progressDelta || []),
        script.beat?.nextHook || '',
    ].filter(Boolean).join('；') || text, 320);
    state.current = {
        ...(state.current || {}),
        location: compactText(scene.location || state.current?.location || '', 90),
        time: compactText(scene.time || state.current?.time || '', 40),
        castIds: asArray(script.castIds).length ? asArray(script.castIds) : asArray(state.current?.castIds),
    };
    state.gameplay = {
        ...(state.gameplay || {}),
        lastPlayerAction: selectedAction,
        activeObjective: compactText(script.beat?.nextHook || selectedAction || state.gameplay?.activeObjective || '', 220),
        objectiveStage: `live-playflow-turn-${turnIndex + 1}`,
    };
    state.flags = {
        ...(state.flags || {}),
        playerIntentSceneLockLocation: state.current.location,
        lastNarrativeActionCommitment: { text: selectedAction, source: 'live-playflow', turnIndex },
        lastPlayflowVisibleSummary: turnSummary,
    };
    state.visuals = {
        ...(state.visuals || {}),
        visualNovel: {
            ...(state.visuals?.visualNovel || {}),
            backgroundKey: script.backgroundKey,
            sceneCharacters: asArray(script.castIds),
            currentSpeakerName: script.segments.find((segment) => segment.type === 'dialogue')?.speakerName || '',
        },
        sceneBackdrop: { currentKey: script.backgroundKey },
    };
    state.discoveredClues = unique([
        ...(state.discoveredClues || []),
        ...(script.beat?.progressDelta || []),
        script.beat?.nextHook || '',
        ...keyTerms(text, 6),
    ], 28);
    updateCharacterMemory(state, script.castIds, compactText(`${state.current.location}: ${script.beat?.nextHook || text}`, 220));
}

function validateTurn({ flow, state, action, workset, agentTurn, script, text, previousTurn, previousTurns = [], previousChoices }) {
    const findings = [];
    const rawVisible = visibleNarrative(text);
    const visible = stageVisibleText(text, script);
    if (!script) {
        findings.push({ severity: 'block', module: 'VN_SCRIPT', title: '缺少隐藏台本', detail: 'RE0_VN_SCRIPT not parsed' });
        return findings;
    }
    if (!rawVisible && script.segments.length) {
        findings.push({
            severity: 'warn',
            module: 'NarrativeDirector',
            title: '可见正文由隐藏台本兜底',
            detail: '模型只输出了 RE0_VN_SCRIPT；前端可播放 segments，但最好同时输出可见小说正文。',
        });
    }
    if (script.version !== VISUAL_NOVEL_SCRIPT_VERSION) {
        findings.push({ severity: 'block', module: 'VN_SCRIPT', title: '台本版本不匹配', detail: `actual=${script.version || 'missing'}` });
    }
    if (script.segments.length < 3 || script.segments.length > LIVE_PLAYFLOW_MAX_SEGMENTS) {
        findings.push({ severity: 'block', module: 'VN_SCRIPT', title: '演出段数不符合全流程约束', detail: `segments=${script.segments.length}` });
    }
    if (script.choices.length < 3 || script.choices.length > 6) {
        findings.push({ severity: 'block', module: 'CandidateActions', title: '候选行动数量不合格', detail: `choices=${script.choices.length}` });
    }
    if (!script.beat || !asArray(script.beat.progressDelta).length) {
        findings.push({ severity: 'block', module: 'NarrativeDirector', title: 'beat.progressDelta 缺失', detail: '无法确认本轮真实推进了什么' });
    } else {
        if (script.rawShape?.progressDeltaHasObjects) {
            findings.push({
                severity: 'warn',
                module: 'VN_SCRIPT',
                title: 'beat.progressDelta 使用对象数组',
                detail: 'progressDelta should be short strings, not weighted objects',
            });
        }
        const semanticDeltas = asArray(script.beat.progressDelta)
            .map((item) => String(item || '').trim())
            .filter((item) => /[\u4e00-\u9fa5A-Za-z]{2,}/u.test(item) && !/^[+-]?\d+(?:\.\d+)?%?$/u.test(item));
        if (!semanticDeltas.length) {
            findings.push({
                severity: 'block',
                module: 'VN_SCRIPT',
                title: 'beat.progressDelta 没有语义进展',
                detail: asArray(script.beat.progressDelta).join(' / '),
            });
        }
    }
    if (!script.backgroundKey) {
        findings.push({ severity: 'block', module: 'AssetDirector', title: '缺少可用 backgroundKey', detail: '无法映射舞台背景' });
    }
    if (!script.castIds.length && script.segments.some((segment) => segment.type === 'dialogue')) {
        findings.push({ severity: 'block', module: 'AssetDirector', title: '缺少可用 castIds', detail: '无法稳定映射角色立绘' });
    }
    if (!script.rawShape?.hasBackgroundKey || !script.rawShape?.hasCastIds || !script.rawShape?.sceneIsObject) {
        findings.push({
            severity: 'warn',
            module: 'VN_SCRIPT',
            title: '隐藏台本字段非规范但已推断',
            detail: `backgroundKey=${script.rawShape?.hasBackgroundKey}; castIds=${script.rawShape?.hasCastIds}; sceneObject=${script.rawShape?.sceneIsObject}`,
        });
    }
    if (visible.length < 80) {
        findings.push({ severity: 'block', module: 'NarrativeDirector', title: '可见正文缺失或过短', detail: `visibleChars=${visible.length}` });
    }
    if (isModelSafetyRejectionText(rawVisible) || isModelSafetyRejectionText(visible)) {
        findings.push({
            severity: 'block',
            module: 'NarrativeDirector',
            title: '模型安全拒绝漏到可见正文',
            detail: compactText(rawVisible || visible, 180),
        });
    }
    if (visible.length > 820) {
        findings.push({ severity: 'block', module: 'NarrativeDirector', title: '可见正文过长', detail: `visibleChars=${visible.length}` });
    } else if (visible.length > 700) {
        findings.push({ severity: 'info', module: 'NarrativeDirector', title: '可见正文略长', detail: `visibleChars=${visible.length}` });
    }
    const selfRepeats = selfReplayChunks(visible, 80);
    if (selfRepeats.length) {
        findings.push({
            severity: 'block',
            module: 'PlayflowContinuity',
            title: '本轮可见正文内部重复',
            detail: selfRepeats.map((chunk) => compactText(chunk, 96)).join(' / '),
        });
    }
    const primaryActionTerms = anchorTerms(action, [], 12);
    const actionTerms = anchorTerms(action, [
        state.current?.location || '',
        state.gameplay?.activeObjective || '',
        ...asArray(state.current?.castIds),
    ], 12);
    const firstHalf = `${visible} ${script.segments.slice(0, 2).map((segment) => segment.text).join(' ')}`;
    const actionHits = actionTerms.filter((term) => firstHalf.includes(term));
    const actionSemanticHits = semanticActionHits(action, firstHalf);
    const combinedActionHits = unique([...actionHits, ...actionSemanticHits], 12);
    const requiredActionHits = primaryActionTerms.length > 3 ? 2 : 1;
    if (actionTerms.length && combinedActionHits.length < requiredActionHits) {
        findings.push({ severity: 'block', module: 'PlayflowContinuity', title: '本轮没有明显承接玩家行动', detail: `action=${compactText(action, 180)}; hits=${combinedActionHits.join('/') || 'none'}` });
    }
    if (!travelActionLanded(action, visible, script)) {
        findings.push({
            severity: 'block',
            module: 'PlayflowContinuity',
            title: '移动行动被降级为计划',
            detail: `action=${compactText(action, 180)}`,
        });
    }
    const scriptFirstHalf = script.segments.slice(0, 2).map((segment) => [
        segment.text,
        segment.action,
        segment.tone,
        segment.expression,
        segment.pose,
        segment.camera,
        segment.focus,
    ].filter(Boolean).join(' ')).join(' ');
    const scriptActionHits = actionTerms.filter((term) => scriptFirstHalf.includes(term));
    const scriptSemanticHits = semanticActionHits(action, scriptFirstHalf);
    const combinedScriptActionHits = unique([...scriptActionHits, ...scriptSemanticHits], 12);
    if (
        actionTerms.length
        && combinedActionHits.length >= requiredActionHits
        && combinedScriptActionHits.length < Math.min(requiredActionHits, 2)
    ) {
        findings.push({
            severity: 'warn',
            module: 'VN_SCRIPT',
            title: '隐藏台本前段弱化玩家行动',
            detail: `action=${compactText(action, 140)}; scriptHits=${combinedScriptActionHits.join('/') || 'none'}`,
        });
    }
    if (asksForConcreteAnswer(action) && !hasConcreteAnswerForQuestion(action, firstHalf)) {
        findings.push({
            severity: 'block',
            module: 'NarrativeDirector',
            title: '追问没有得到新答案或明确拒绝条件',
            detail: compactText(action, 180),
        });
    }
    if (previousTurn) {
        const currentComparable = comparableNarrative(visible);
        const previousComparable = comparableNarrative(previousTurn.visibleText || '');
        const replayPrefix = previousComparable.slice(0, 160);
        let commonPrefix = 0;
        while (
            commonPrefix < Math.min(currentComparable.length, previousComparable.length, 260)
            && currentComparable[commonPrefix] === previousComparable[commonPrefix]
        ) {
            commonPrefix += 1;
        }
        if ((replayPrefix.length >= 100 && currentComparable.includes(replayPrefix)) || commonPrefix >= 120) {
            findings.push({
                severity: 'block',
                module: 'PlayflowContinuity',
                title: '重播了已播放正文',
                detail: `commonPrefix=${commonPrefix}; replayPrefix=${compactText(previousTurn.visibleText || '', 160)}`,
            });
        }
        const duplicateChunks = replayChunks(visible, previousTurn.visibleText || '', 90);
        if (duplicateChunks.length) {
            findings.push({
                severity: 'block',
                module: 'PlayflowContinuity',
                title: '重播了上一轮中段正文',
                detail: duplicateChunks.map((chunk) => compactText(chunk, 110)).join(' / '),
            });
        }
        const repeatedAnchor = replayAnchorPhrases(previousTurn.visibleText || '', 6)
            .find((anchor) => {
                const normalized = comparableNarrative(anchor);
                return normalized.length >= 24 && currentComparable.includes(normalized);
            });
        if (repeatedAnchor) {
            findings.push({
                severity: 'block',
                module: 'PlayflowContinuity',
                title: '重播了已播放锚点',
                detail: compactText(repeatedAnchor, 140),
            });
        }
        const sameStage = previousTurn.script?.backgroundKey
            && script.backgroundKey
            && previousTurn.script.backgroundKey === script.backgroundKey;
        const actionRequestsReentry = /进入|推开门|打开门|走进|回到|返回|重新|再次|再进|折返|追进/u.test(action);
        const openingText = compactHead(visible, 260);
        const looksLikeSceneReentry = /推开门|打开门|走进|进入.*(?:内部|屋内|店里|房间)|来到.*(?:门口|屋内|柜台)|抵达|雨声.*隔绝在身后/u.test(openingText);
        const actionAlreadyCommitted = combinedActionHits.length >= requiredActionHits
            && !/^(?:推开门|打开门|走进|进入|来到|抵达|雨声)/u.test(openingText);
        const previousAlreadyInside = /内部|屋内|柜台|油灯|罗姆爷|盗品蔵|赃物库|档案室|书架|卷宗/u.test(previousTurn.visibleText || '');
        if (sameStage && !actionRequestsReentry && !actionAlreadyCommitted && looksLikeSceneReentry && previousAlreadyInside) {
            findings.push({
                severity: 'block',
                module: 'PlayflowContinuity',
                title: '同一场景被重置为入场段',
                detail: compactText(openingText, 180),
            });
        }
        const primaryPreviousTerms = anchorTerms(previousTurn.selectedAction, [], 12);
        const previousSelectedTerms = anchorTerms(previousTurn.selectedAction, [
            state.current?.location || '',
            state.gameplay?.activeObjective || '',
            ...asArray(state.current?.castIds),
        ], 12);
        const carryHits = previousSelectedTerms.filter((term) => firstHalf.includes(term));
        const carrySemanticHits = semanticActionHits(previousTurn.selectedAction, firstHalf);
        const combinedCarryHits = unique([...carryHits, ...carrySemanticHits], 12);
        const requiredPreviousHits = primaryPreviousTerms.length > 3 ? 2 : 1;
        if (previousSelectedTerms.length && combinedCarryHits.length < requiredPreviousHits) {
            findings.push({ severity: 'block', module: 'PlayflowContinuity', title: '没有承接上一轮已选候选行动', detail: `previous=${compactText(previousTurn.selectedAction, 180)}; hits=${combinedCarryHits.join('/') || 'none'}` });
        }
        const overlap = script.choices.filter((choice) => previousChoices.includes(choice));
        if (script.choices.length && overlap.length / script.choices.length > 0.65) {
            findings.push({
                severity: overlap.length >= script.choices.length - 1 ? 'block' : 'warn',
                module: 'CandidateActions',
                title: '候选行动重复率偏高',
                detail: `overlap=${overlap.length}/${script.choices.length}`,
            });
        }
        if (
            hasConcreteAnswerForQuestion(action, visible)
            && script.choices.some((choice) => comparableNarrative(choice) === comparableNarrative(action))
        ) {
            findings.push({
                severity: 'block',
                module: 'CandidateActions',
                title: '已回答问题仍作为候选行动',
                detail: compactText(action, 160),
            });
        }
        if (
            script.choices.some((choice) => comparableNarrative(choice) === comparableNarrative(action))
        ) {
            findings.push({
                severity: 'block',
                module: 'CandidateActions',
                title: '已执行行动仍作为候选行动',
                detail: compactText(action, 160),
            });
        }
        const recentPassiveCount = previousTurns.slice(-3).filter((turn) => passiveActionPattern(turn.selectedAction)).length;
        const passiveChoices = script.choices.filter((choice) => passiveActionPattern(choice));
        if (recentPassiveCount >= 2 && passiveChoices.length >= 2) {
            findings.push({
                severity: 'warn',
                module: 'NarrativeDirector',
                title: '候选行动鼓励连续被动空转',
                detail: passiveChoices.join(' / '),
            });
        }
    }
    const actionMode = workset?.architecture?.routing?.actionMode || workset?.directorSignals?.actionMode || '';
    if (flow.expectedMode === 'canon-follow' && actionMode && actionMode !== 'canon-follow') {
        findings.push({
            severity: 'warn',
            module: 'StoryRAG',
            title: '原作线流程发生路由漂移',
            detail: `expected=canon-follow; actual=${actionMode}`,
        });
    }
    if (flow.expectedMode === 'canon-follow') {
        const canonSource = `${visible} ${script.choices.join(' ')}`;
        const canonDeviation = canonSource.match(/多枚徽章|更多的货|三天后|明天夜里|明天.*再来|拖到明天|长期收货|持续收货|批量交易|另一个徽章案|多名买家|不是一个人的脚步声|不止一人|(?:门外|来者|脚步声).{0,16}(?:几个人|几人)|观察来者有几人|贵族雇主|贵族.*代理|商会|银月商会|内城区.*第三街|特殊物品|魔力残留.*收|收藏癖|长期收购|组织.*收购/u);
        const negatedNobleProxy = canonDeviation
            && /贵族.*代理/u.test(canonDeviation[0])
            && /不是[^。！？]{0,16}贵族[^。！？]{0,8}代理/u.test(canonSource);
        const negatedTomorrowDelay = canonDeviation
            && canonDeviation[0] === '拖到明天'
            && /不(?:会|能|可能)[^。！？]{0,16}拖到明天|不(?:会|能|可能)[^。！？]{0,16}明天|如果[^。！？]{0,16}拖到明天|拖到明天[^。！？]{0,24}(?:恐怕|不会|不能)/u.test(canonSource);
        const negatedMerchantProbe = canonDeviation
            && canonDeviation[0] === '商会'
            && /(?:不会是|不可能是|总不会是|不是|并非)[^。！？]{0,24}商会|商会的采购员吧|你当[^。！？]{0,24}商会|当这是[^。！？]{0,24}商会/u.test(canonSource);
        const negatedDeviation = negatedNobleProxy || negatedTomorrowDelay || negatedMerchantProbe;
        if (canonDeviation && !negatedDeviation) {
            findings.push({
                severity: 'block',
                module: 'StoryRAG',
                title: '原作线硬事实偏离',
                detail: canonDeviation[0],
            });
        }
    }
    const visibleMeta = visible.match(/原作|正史|测试|RAG|模型|台本|游戏机制|系统提示|路线锁定|好感度|数值|玩家选择|开发词/iu);
    if (visibleMeta) {
        findings.push({ severity: 'block', module: 'NarrativeDirector', title: '可见正文出现元叙事污染', detail: visibleMeta[0] });
    }
    const privateLeak = `${visible} ${script.choices.join(' ')} ${script.segments.map((segment) => segment.text).join(' ')}`.match(/死亡回归|上一轮|上一次循环|我死过|回到锚点|原作里|正史里/iu);
    if (privateLeak) {
        findings.push({ severity: 'block', module: 'SaveMemory', title: '私有死亡机制词泄漏', detail: privateLeak[0] });
    }
    const playerKnownBefore = playerVisibleKnowledgeBefore(state, previousTurns.length ? previousTurns : previousTurn);
    const futureNames = ['艾尔莎', '猎肠者', '莱因哈鲁特', '莱茵哈鲁特', '尤里乌斯', '威尔海姆'];
    for (const name of futureNames) {
        const contentHasName = `${visible} ${script.choices.join(' ')}`.includes(name);
        if (!contentHasName) {
            continue;
        }
        const knownBefore = playerKnownBefore.includes(name);
        const revealedThisTurn = revealedByInWorldSpeech(name, visible);
        if (!knownBefore && !revealedThisTurn) {
            findings.push({
                severity: 'block',
                module: 'KnowledgeBoundary',
                title: '前台泄漏未显影未来人物/解法',
                detail: name,
            });
            break;
        }
    }
    if (flow.expectedMode === 'canon-follow' && Number(state.current?.arc || flow.state?.current?.arc || 1) === 1) {
        const hiddenBuyerDetails = [
            { label: '买家黑发特征', pattern: /黑发|黑头发|黑色.*头发/u },
            { label: '买家弯刀特征', pattern: /弯刀|弯[^。！？「」『』“”]{0,12}刀|刀柄|刀刃/u, revealPattern: /弯刀|弯[^。！？「」『』“”]{0,12}刀|刀柄|刀刃/u },
            { label: '买家血腥味特征', pattern: /血腥味|血味|血.*气味/u, revealPattern: /血腥味|血味|血.*气味|味儿[^」』”]{0,30}血|味道[^」』”]{0,30}血|血。洗不掉/u },
        ];
        const content = `${visible} ${script.choices.join(' ')}`;
        for (const detail of hiddenBuyerDetails) {
            if (!detail.pattern.test(content)) {
                continue;
            }
            const knownBefore = detail.pattern.test(playerKnownBefore);
            const revealedInSpeech = quotedSpeechContains(visible, detail.revealPattern || detail.pattern);
            const revealedByObservation = sensoryObservationRevealsBuyerDetail(detail.label, visible);
            if (!knownBefore && !revealedInSpeech && !revealedByObservation) {
                findings.push({
                    severity: 'block',
                    module: 'KnowledgeBoundary',
                    title: '前台泄漏未显影买家细节',
                    detail: detail.label,
                });
                break;
            }
        }
    }
    const sceneTerms = anchorTerms([
        state.current?.location,
        state.gameplay?.activeObjective,
        ...asArray(state.current?.castIds),
        ...asArray(workset?.candidateSeeds).flatMap((seed) => [seed?.text, ...(seed?.groundingTerms || [])]),
        visible,
        ...script.segments.map((segment) => [
            segment.text,
            segment.action,
            segment.focus,
        ].filter(Boolean).join(' ')),
        ...asArray(script.beat?.progressDelta),
        script.beat?.nextHook,
    ].join(' '), [], 24);
    const choiceText = script.choices.join(' ');
    if (sceneTerms.length && !sceneTerms.some((term) => choiceText.includes(term))) {
        findings.push({ severity: 'block', module: 'CandidateActions', title: '候选行动没有绑定当前现场/RAG锚点', detail: compactText(choiceText, 220) });
    }
    const assetFindings = evaluateAssetUse(agentTurn.assetPlan || {}, {
        parsedVnScript: script,
        renderedBackdropKey: script.backgroundKey,
        renderedCastIds: script.castIds,
    })
        .filter((finding) => {
            if (finding.title !== '背景素材与场景计划不一致') {
                return true;
            }
            const match = String(finding.detail || '').match(/expected=([^,]+), actual=(.+)$/u);
            return !actionDirectedBackdropTransitionAllowed({
                action,
                visible,
                expectedKey: match?.[1] || agentTurn.assetPlan?.selectedBackdrop?.key || '',
                actualKey: match?.[2] || script.backgroundKey || '',
            });
        })
        .map((finding) => ({
            severity: finding.severity === 'info' ? 'warn' : finding.severity,
            module: 'AssetDirector',
            title: finding.title,
            detail: finding.detail,
        }));
    const seenAssetFindings = new Set();
    for (const finding of assetFindings) {
        const key = `${finding.severity}:${finding.module}:${finding.title}:${finding.detail}`;
        if (seenAssetFindings.has(key)) {
            continue;
        }
        seenAssetFindings.add(key);
        findings.push(finding);
    }
    const deterministic = validateRe0AgentTurn({
        state,
        playerAction: { rawText: action, source: 'live-playflow', sceneLock: state.current?.location },
        plan: agentTurn.turnPlan,
        assistantText: text,
        parsedVnScript: script,
        renderedBackdropKey: script.backgroundKey,
        renderedCastIds: script.castIds,
        statePatch: script.statePatch,
        candidates: script.choices,
    });
    for (const finding of deterministic.findings || []) {
        if (/玩家行动可能没有被显式承接|候选行动未贴合当前场景/u.test(finding.title || '')) {
            continue;
        }
        if (finding.title === '背景素材与场景计划不一致') {
            const match = String(finding.detail || '').match(/expected=([^,]+), actual=(.+)$/u);
            if (actionDirectedBackdropTransitionAllowed({
                action,
                visible,
                expectedKey: match?.[1] || agentTurn.assetPlan?.selectedBackdrop?.key || '',
                actualKey: match?.[2] || script.backgroundKey || '',
            })) {
                continue;
            }
        }
        findings.push({
            severity: finding.severity === 'block' ? 'block' : 'warn',
            module: finding.module || 'Evaluator',
            title: finding.title || '确定性验收提示',
            detail: finding.detail || '',
        });
    }
    return uniqueFindings(findings);
}

async function runTurn({ apiKey, flow, state, action, turnIndex, previousTurns }) {
    const workset = retrieveStoryRagWorkset(state, action);
    const agentTurn = buildRe0AgentTurn(state, { rawText: action, source: 'live-playflow', sceneLock: state.current?.location }, { storyRagWorkset: workset });
    const messages = buildMessages({ flow, state, action, turnIndex, workset, agentTurn, previousTurns });
    const promptChars = JSON.stringify(messages).length;
    if (promptChars > 30_000) {
        throw new Error(`Live playflow prompt too large at turn ${turnIndex + 1}: ${promptChars}`);
    }
    const mimo = await callMimo(apiKey, messages, `${flow.id}:turn-${turnIndex + 1}`);
    let assistantText = sanitizeVisibleNarrativeMetaText(mimo.text);
    let extracted = extractVisualNovelScriptBlock(assistantText);
    let script = normalizeScript(extracted.script);
    let repair = null;
    let followupRepair = null;
    let choiceRepair = null;
    let narrativeRepair = null;
    let localChoiceRepair = null;
    let localNarrativeDedupe = null;
    let repairFailure = null;
    if (isModelSafetyRejectionText(visibleNarrative(assistantText))) {
        narrativeRepair = await repairNarrativeWithMimo(apiKey, {
            flow,
            state,
            workset,
            agentTurn,
            action,
            originalText: assistantText,
            warning: 'model safety rejection leaked to visible narrative',
            turnIndex,
            previousTurns,
        });
        assistantText = narrativeRepair.text;
        extracted = extractVisualNovelScriptBlock(assistantText);
        script = narrativeRepair.script || normalizeScript(extracted.script);
    }
    const repairReason = !script?.segments?.length
        ? 'missing segments'
        : script.segments.length > LIVE_PLAYFLOW_MAX_SEGMENTS
            ? `segments=${script.segments.length} exceeds live playflow limit`
            : (script.choices?.length || 0) < 3
                ? `choices=${script.choices?.length || 0} below live playflow minimum`
                : script.choices.length > 6
                    ? `choices=${script.choices.length} exceeds live playflow limit`
                    : '';
    if (repairReason) {
        try {
            repair = await repairVisualNovelScriptWithMimo(apiKey, {
                flow,
                state,
                workset,
                agentTurn,
                action,
                originalText: assistantText,
                sourceMode: extracted.sourceMode,
                warning: repairReason || extracted.warning || '',
                turnIndex,
                previousTurns,
            });
            script = repair.script;
        } catch (error) {
            repairFailure = `initial script repair failed: ${compactText(error?.message || error, 360)}`;
        }
    }
    let findings = validateTurn({
        flow,
        state,
        action,
        workset,
        agentTurn,
        script,
        text: assistantText,
        previousTurn: previousTurns.at(-1),
        previousTurns,
        previousChoices: asArray(previousTurns.at(-1)?.script?.choices),
    });
    const narrativeRepairableFinding = findings.find((finding) => (
        (
            finding.severity === 'block'
            && (
                (finding.module === 'NarrativeDirector' && /可见正文|元叙事|安全拒绝|追问没有得到/u.test(finding.title || ''))
                || (finding.module === 'VN_SCRIPT' && /缺少隐藏台本|模型台本修复失败/u.test(finding.title || ''))
                || finding.module === 'KnowledgeBoundary'
                || finding.module === 'SaveMemory'
                || (finding.module === 'PlayflowContinuity' && finding.title === '移动行动被降级为计划')
                || (finding.module === 'PlayflowContinuity' && /没有明显承接玩家行动|没有承接上一轮已选候选行动/u.test(finding.title || ''))
                || (finding.module === 'PlayflowContinuity' && /重复|重播/u.test(finding.title || ''))
            )
        )
        || (
            finding.severity === 'warn'
            && finding.module === 'NarrativeDirector'
            && finding.title === '可见正文略长'
        )
    ));
    if (narrativeRepairableFinding && !narrativeRepair) {
        try {
            narrativeRepair = await repairNarrativeWithMimo(apiKey, {
                flow,
                state,
                workset,
                agentTurn,
                action,
                originalText: assistantText,
                warning: `${narrativeRepairableFinding.module}: ${narrativeRepairableFinding.title} - ${narrativeRepairableFinding.detail || ''}`,
                turnIndex,
                previousTurns,
            });
            assistantText = narrativeRepair.text;
            extracted = extractVisualNovelScriptBlock(assistantText);
            script = narrativeRepair.script || normalizeScript(extracted.script);
            findings = validateTurn({
                flow,
                state,
                action,
                workset,
                agentTurn,
                script,
                text: assistantText,
                previousTurn: previousTurns.at(-1),
                previousTurns,
                previousChoices: asArray(previousTurns.at(-1)?.script?.choices),
            });
        } catch (error) {
            repairFailure = `narrative repair failed: ${compactText(error?.message || error, 360)}`;
        }
    }
    if (!script?.segments?.length) {
        try {
            const repaired = await repairVisualNovelScriptWithMimo(apiKey, {
                flow,
                state,
                workset,
                agentTurn,
                action,
                originalText: assistantText,
                sourceMode: extracted.sourceMode,
                warning: narrativeRepair?.warning || 'narrative repair returned visible text without usable RE0_VN_SCRIPT',
                turnIndex,
                previousTurns,
            });
            if (repair) {
                followupRepair = repaired;
            } else {
                repair = repaired;
            }
            script = repaired.script;
            findings = validateTurn({
                flow,
                state,
                action,
                workset,
                agentTurn,
                script,
                text: assistantText,
                previousTurn: previousTurns.at(-1),
                previousTurns,
                previousChoices: asArray(previousTurns.at(-1)?.script?.choices),
            });
        } catch (error) {
            repairFailure = `fallback script repair failed: ${compactText(error?.message || error, 360)}`;
        }
    }
    const repairableFinding = findings.find((finding) => (
        (finding.module === 'VN_SCRIPT' && finding.title === '隐藏台本前段弱化玩家行动')
        || (finding.module === 'VN_SCRIPT' && finding.title === 'beat.progressDelta 使用对象数组')
        || (finding.module === 'CandidateActions' && finding.title === '候选行动重复率偏高')
        || (finding.module === 'CandidateActions' && finding.title === '已回答问题仍作为候选行动')
        || (finding.module === 'CandidateActions' && finding.title === '已执行行动仍作为候选行动')
    ));
    const allowFollowupScriptRepair = repairableFinding
        && (!repair
            || repairableFinding.module === 'CandidateActions'
            || repairableFinding.title === '隐藏台本前段弱化玩家行动');
    if (allowFollowupScriptRepair) {
        try {
            const repaired = await repairVisualNovelScriptWithMimo(apiKey, {
                flow,
                state,
                workset,
                agentTurn,
                action,
                originalText: assistantText,
                sourceMode: extracted.sourceMode,
                warning: `${repairableFinding.title}: ${repairableFinding.detail || ''}`,
                turnIndex,
                previousTurns,
            });
            if (repair) {
                followupRepair = repaired;
            } else {
                repair = repaired;
            }
            script = repaired.script;
            findings = validateTurn({
                flow,
                state,
                action,
                workset,
                agentTurn,
                script,
                text: assistantText,
                previousTurn: previousTurns.at(-1),
                previousTurns,
                previousChoices: asArray(previousTurns.at(-1)?.script?.choices),
            });
        } catch (error) {
            repairFailure = `script repair failed: ${compactText(error?.message || error, 360)}`;
        }
    }
    const remainingRepairableFinding = findings.find((finding) => (
        !followupRepair
        && (
            (finding.module === 'VN_SCRIPT' && finding.title === '隐藏台本前段弱化玩家行动')
            || (finding.module === 'CandidateActions' && finding.title === '候选行动重复率偏高')
            || (finding.module === 'CandidateActions' && finding.title === '已回答问题仍作为候选行动')
            || (finding.module === 'CandidateActions' && finding.title === '已执行行动仍作为候选行动')
        )
    ));
    if (remainingRepairableFinding) {
        try {
            followupRepair = await repairVisualNovelScriptWithMimo(apiKey, {
                flow,
                state,
                workset,
                agentTurn,
                action,
                originalText: assistantText,
                sourceMode: extracted.sourceMode,
                warning: `${remainingRepairableFinding.title}: ${remainingRepairableFinding.detail || ''}`,
                turnIndex,
                previousTurns,
            });
            script = followupRepair.script;
            findings = validateTurn({
                flow,
                state,
                action,
                workset,
                agentTurn,
                script,
                text: assistantText,
                previousTurn: previousTurns.at(-1),
                previousTurns,
                previousChoices: asArray(previousTurns.at(-1)?.script?.choices),
            });
        } catch (error) {
            repairFailure = `followup script repair failed: ${compactText(error?.message || error, 360)}`;
        }
    }
    const remainingCandidateFinding = findings.find((finding) => (
        finding.module === 'CandidateActions'
        && /候选行动重复率偏高|已回答问题仍作为候选行动|已执行行动仍作为候选行动|候选行动没有绑定当前现场/u.test(finding.title || '')
    ));
    if (remainingCandidateFinding) {
        try {
            choiceRepair = await repairChoicesWithMimo(apiKey, {
                flow,
                state,
                workset,
                action,
                script,
                visibleText: stageVisibleText(assistantText, script),
                warning: `${remainingCandidateFinding.title}: ${remainingCandidateFinding.detail || ''}`,
                turnIndex,
                previousTurns,
            });
            script = {
                ...script,
                choices: choiceRepair.choices,
            };
            findings = validateTurn({
                flow,
                state,
                action,
                workset,
                agentTurn,
                script,
                text: assistantText,
                previousTurn: previousTurns.at(-1),
                previousTurns,
                previousChoices: asArray(previousTurns.at(-1)?.script?.choices),
            });
        } catch (error) {
            repairFailure = `choice repair failed: ${compactText(error?.message || error, 360)}`;
        }
    }
    const lingeringDuplicateFinding = findings.find((finding) => (
        finding.module === 'CandidateActions'
        && finding.title === '候选行动重复率偏高'
    ));
    if (lingeringDuplicateFinding) {
        localChoiceRepair = repairChoicesDeterministically({
            script,
            state,
            action,
            visibleText: stageVisibleText(assistantText, script),
            previousTurns,
        });
        if (localChoiceRepair.repaired) {
            script = {
                ...script,
                choices: localChoiceRepair.choices,
            };
            findings = validateTurn({
                flow,
                state,
                action,
                workset,
                agentTurn,
                script,
                text: assistantText,
                previousTurn: previousTurns.at(-1),
                previousTurns,
                previousChoices: asArray(previousTurns.at(-1)?.script?.choices),
            });
            findings.push({
                severity: 'warn',
                module: 'CandidateActions',
                title: '候选行动已用本地去重兜底',
                detail: localChoiceRepair.reason,
            });
        }
    }
    const lingeringReplayAnchorFinding = findings.find((finding) => (
        finding.module === 'PlayflowContinuity'
        && /重播了已播放锚点|本轮可见正文内部重复/u.test(finding.title || '')
    ));
    if (lingeringReplayAnchorFinding) {
        localNarrativeDedupe = dedupeRepeatedVisibleAnchors({
            fullText: assistantText,
            script,
            previousTurn: previousTurns.at(-1),
        });
        if (localNarrativeDedupe.skipped) {
            assistantText = localNarrativeDedupe.text;
            script = localNarrativeDedupe.script;
            findings = validateTurn({
                flow,
                state,
                action,
                workset,
                agentTurn,
                script,
                text: assistantText,
                previousTurn: previousTurns.at(-1),
                previousTurns,
                previousChoices: asArray(previousTurns.at(-1)?.script?.choices),
            });
            findings.push({
                severity: 'info',
                module: 'PlayflowContinuity',
                title: '已用本地句子级去重兜底',
                detail: `removed=${localNarrativeDedupe.skipped}; ${lingeringReplayAnchorFinding.detail || ''}`,
            });
        }
    }
    if (repairFailure) {
        const hasUnresolvedBlock = findings.some((finding) => finding.severity === 'block');
        findings.push({
            severity: hasUnresolvedBlock ? 'block' : 'info',
            module: 'VN_SCRIPT',
            title: '模型台本修复失败',
            detail: repairFailure,
        });
    }
    const status = findings.some((finding) => finding.severity === 'block') ? 'block'
        : findings.some((finding) => finding.severity === 'warn') ? 'warn'
            : 'pass';
    const selectedAction = status === 'block' ? '' : chooseAction(
        script,
        state,
        previousTurns.flatMap((turn) => asArray(turn.script?.choices)),
        flow.strategy,
        previousTurns.map((turn) => turn.selectedAction).filter(Boolean),
    );
    return {
        turnIndex,
        status,
        action,
        selectedAction,
        elapsedMs: mimo.elapsedMs + (repair?.elapsedMs || 0) + (followupRepair?.elapsedMs || 0) + (choiceRepair?.elapsedMs || 0) + (narrativeRepair?.elapsedMs || 0),
        repairUsed: Boolean(repair || followupRepair || choiceRepair || narrativeRepair || localChoiceRepair?.repaired || localNarrativeDedupe?.skipped),
        repairElapsedMs: (repair?.elapsedMs || 0) + (followupRepair?.elapsedMs || 0) + (choiceRepair?.elapsedMs || 0) + (narrativeRepair?.elapsedMs || 0),
        repairModel: [narrativeRepair?.model, repair?.model, followupRepair?.model, choiceRepair?.model, localChoiceRepair?.repaired ? 'local-choice-dedupe' : '', localNarrativeDedupe?.skipped ? 'local-narrative-dedupe' : ''].filter(Boolean).join(', '),
        usage: mimo.usage,
        repairUsage: {
            narrative: narrativeRepair?.usage || null,
            script: repair?.usage || null,
            followupScript: followupRepair?.usage || null,
            choices: choiceRepair?.usage || null,
        },
        metaSanitized: sanitizeVisibleNarrativeMetaText(mimo.text) !== mimo.text || Boolean(narrativeRepair && narrativeRepair.text !== narrativeRepair.raw),
        promptChars,
        storyRag: {
            actionMode: workset?.architecture?.routing?.actionMode || workset?.directorSignals?.actionMode || '',
            summary: summarizeStoryRagWorkset(workset, 700),
            candidateSeedCount: asArray(workset?.candidateSeeds).length,
        },
        assetPlan: {
            selectedBackdrop: agentTurn.assetPlan?.selectedBackdrop?.key || '',
            summary: summarizeAssetPlan(agentTurn.assetPlan || {}, 500),
        },
        parsed: {
            sourceMode: localChoiceRepair?.repaired ? 'local-choice-dedupe' : choiceRepair ? 'mimo-choice-repair' : followupRepair ? 'mimo-repair-json-followup' : repair ? 'mimo-repair-json' : narrativeRepair ? `mimo-narrative-repair:${extracted.sourceMode}` : extracted.sourceMode,
            warning: narrativeRepair?.warning || extracted.warning || '',
            backgroundKey: script?.backgroundKey || '',
            castIds: script?.castIds || [],
            segmentCount: script?.segments?.length || 0,
            dialogueCount: script?.segments?.filter((segment) => segment.type === 'dialogue').length || 0,
            choices: script?.choices || [],
            beat: script?.beat || null,
        },
        visibleText: compactText(stageVisibleText(assistantText, script), 1200),
        rawVisibleText: compactText(visibleNarrative(mimo.text), 1200),
        outputSample: compactText(assistantText, 1800),
        script,
        findings,
    };
}

function writeReport({ flow, turns, summary }) {
    fs.mkdirSync(QA_DIR, { recursive: true });
    const stamp = nowStamp();
    const jsonPath = path.join(QA_DIR, `RE0_LIVE_PLAYFLOW_AUDIT_${stamp}_${flow.id}.json`);
    const mdPath = path.join(QA_DIR, `RE0_LIVE_PLAYFLOW_AUDIT_${stamp}_${flow.id}.md`);
    const payload = {
        generatedAt: new Date().toISOString(),
        command: 'node scripts/re0-live-playflow-audit.mjs',
        model: DEFAULT_MODEL,
        temperature: MIMO_TEMPERATURE,
        liveMimoRequired: true,
        mockAllowed: false,
        testType: 'full-flow-candidate-action-closed-loop',
        probe: false,
        flow: { id: flow.id, title: flow.title, expectedMode: flow.expectedMode },
        summary,
        turns,
    };
    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
    const lines = [
        `# Re:0 Live Playflow Audit ${stamp}`,
        '',
        `- status: ${summary.status}`,
        `- flow: ${flow.id} / ${flow.title}`,
        `- model: ${DEFAULT_MODEL}`,
        `- temperature: ${MIMO_TEMPERATURE}`,
        '- test type: full-flow candidate-action closed loop',
        '- mock allowed: false',
        `- turns: ${summary.pass} pass / ${summary.warn} warn / ${summary.block} block / ${summary.total} total`,
        `- avg elapsed: ${summary.avgElapsedMs}ms`,
        '',
        '## Turns',
        '',
        ...turns.flatMap((turn) => [
            `### Turn ${turn.turnIndex + 1} · ${turn.status}`,
            '',
            `- player action: ${turn.action}`,
            `- selected next action: ${turn.selectedAction || 'none'}`,
            `- elapsed: ${turn.elapsedMs}ms`,
            `- usage: prompt=${turn.usage?.prompt_tokens || '?'} completion=${turn.usage?.completion_tokens || '?'}`,
            `- RAG mode: ${turn.storyRag.actionMode}`,
            `- background: ${turn.parsed.backgroundKey} / assetPlan=${turn.assetPlan.selectedBackdrop}`,
            `- VN: segments=${turn.parsed.segmentCount}, dialogue=${turn.parsed.dialogueCount}`,
            `- choices: ${turn.parsed.choices.join(' / ')}`,
            turn.findings.length ? `- findings: ${turn.findings.map((finding) => `[${finding.severity}] ${finding.module}: ${finding.title}`).join(' ; ')}` : '- findings: none',
            '',
            '```text',
            turn.visibleText,
            '```',
            '',
        ]),
    ];
    fs.writeFileSync(mdPath, lines.join('\n'));
    return { jsonPath, mdPath };
}

async function main() {
    const apiKey = assertLiveSecret();
    const flow = baseFlowScenario(stringArg('flow', 'canon-arc1'));
    const turnsToRun = Math.max(2, Math.min(60, numberArg('turns', 4)));
    const state = structuredClone(flow.state);
    const turns = [];
    let action = stringArg('action', flow.startAction);
    for (let index = 0; index < turnsToRun; index += 1) {
        process.stdout.write(`live-playflow ${flow.id} turn ${index + 1}/${turnsToRun} ... `);
        const result = await runTurn({ apiKey, flow, state, action, turnIndex: index, previousTurns: turns });
        turns.push(result);
        process.stdout.write(`${result.status} (${result.elapsedMs}ms)\n`);
        if (result.status === 'block') {
            break;
        }
        applyTurnToState(state, result.script, result.selectedAction, result.visibleText, index);
        action = result.selectedAction;
        if (!action) {
            break;
        }
    }
    const summary = {
        status: turns.every((turn) => turn.status === 'pass') ? 'pass'
            : turns.some((turn) => turn.status === 'block') ? 'block'
                : 'warn',
        total: turns.length,
        pass: turns.filter((turn) => turn.status === 'pass').length,
        warn: turns.filter((turn) => turn.status === 'warn').length,
        block: turns.filter((turn) => turn.status === 'block').length,
        avgElapsedMs: Math.round(turns.reduce((sum, turn) => sum + turn.elapsedMs, 0) / Math.max(1, turns.length)),
    };
    const { jsonPath, mdPath } = writeReport({ flow, turns, summary });
    console.log(JSON.stringify({ ...summary, jsonPath, mdPath }, null, 2));
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
