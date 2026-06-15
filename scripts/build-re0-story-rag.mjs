#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
    canonRouteReferenceByArc,
    canonRouteReferenceSummary,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/re0-canon-rag.generated.js';

const projectRoot = path.resolve(import.meta.dirname, '..');
const novelRoot = path.resolve(projectRoot, '..', 're0_novel_src');
const corpusRoot = path.join(projectRoot, 'data/default-user/re0-engine/rag/novel-corpus');
const storyDbRoot = path.join(novelRoot, 'story_database');
const webNovelRoot = path.join(novelRoot, 're0_web_novel_zh');
const outputPath = path.join(projectRoot, 'public/scripts/extensions/third-party/re0-adventure-engine/data/re0-story-rag.generated.js');

const MAX_DIGEST_CHARS = 320;
const MAX_FACT_CHARS = 140;
const MAX_KEYWORDS = 24;
const MAX_AUTO_FACTS_PER_CHAPTER = 3;

const arcDirectoryMap = [
    [1, /第一篇章|王都的一天/u],
    [2, /第二篇章|豪宅的一周/u],
    [3, /第三篇章|再访王都/u],
    [4, /第四篇章|永远的契约/u],
    [5, /第五篇章|水门都市|铭刻历史/u],
    [6, /第六篇章|记忆的沙滩|监视塔/u],
    [7, /第七篇章|狼之国/u],
    [8, /第八篇章|灾厄之始/u],
    [9, /第九篇章|贤者之塔|无名星光/u],
    [10, /第十篇章|最新连载/u],
];

const characterTerms = [
    '玩家', '爱蜜莉雅', '艾米莉娅', '帕克', '菲鲁特', '罗姆爷', '艾尔莎', '莱因哈鲁特',
    '蕾姆', '雷姆', '拉姆', '罗兹瓦尔', '碧翠丝', '贝蒂', '佩特拉', '弗雷德莉卡',
    '库珥修', '威尔海姆', '菲利斯', '安娜塔西亚', '尤里乌斯', '普莉希拉', '阿尔', '阿尔德巴兰',
    '奥托', '加菲尔', '艾姬多娜', '莎缇拉', '嫉妒魔女', '怠惰', '培提其乌斯', '白鲸',
    '雷古勒斯', '卡佩拉', '暴食', '路伊', '文森特', '托德', '坦萨', '斯芬克斯', '夏乌拉', '雷德',
    '莉榭尔', '剥钟人',
];

const locationTerms = [
    '王都', '赃物库', '水果摊', '贫民区', '小巷', '罗兹瓦尔宅邸', '宅邸', '阿拉姆村', '禁书库',
    '森林', '库珥修宅邸', '白鲸', '魔女教', '圣域', '墓所', '水门都市', '普里斯提拉',
    '普雷阿迪斯监视塔', '监视塔', '佛拉基亚', '吉努恩海芬', '王城', '废弃钟楼', '世界线树',
];

const worldEssenceTerms = [
    '400年前', '四百年前', '嫉妒魔女', '魔女因子', '权能', '神龙', '贤者', '初代剑圣',
    '奥德拉格纳', '奥德', '福音书', '睿智之书', '死亡回归', '影之庭园', '大瀑布',
    '封印', '圣域', '试炼', '名字', '记忆', '灵魂', '龙血', '王选',
];

const causalTerms = [
    '因为', '所以', '于是', '导致', '结果', '代价', '目的', '契约', '诅咒', '死亡', '复活',
    '重置', '失败', '成功', '拯救', '牺牲', '选择', '背叛', '误会', '证据', '预言', '交易',
    '同盟', '阵营', '怀疑', '信任', '记忆', '名字', '权能', '魔女', '魔女教', '收束',
];

const ifRoutePatterns = [
    ['Pride', /傲慢|Ayamatsu|アヤマツ/u],
    ['Wrath', /愤怒|Oboreru|オボレル/u],
    ['Sloth', /怠惰|Rem IF|雷姆IF|Kararagi/u],
    ['Greed', /强欲|Kasaneru|カサネル/u],
    ['Gluttony', /暴食|Tsugihagu|ツギハグ/u],
    ['Aganau', /Aganau|アガナウ|赎罪/u],
    ['Lust', /色欲|Lust/u],
];

const arcFactHints = {
    1: {
        locations: ['王都', '水果摊', '小巷', '赃物库'],
        characters: ['玩家', '爱蜜莉雅', '菲鲁特', '罗姆爷', '艾尔莎', '莱因哈鲁特'],
        facts: [
            '徽章失窃是王都初日的核心证据链，最终必须落到菲鲁特、罗姆爷、赃物库和艾尔莎交易。',
            '莱因哈鲁特是强力收束救援，但不应被玩家无代价远程召唤成万能解法。',
            '艾尔莎的杀意和战斗力会惩罚贸然交易、独自硬闯和低估敌方雇主。',
        ],
        constraints: [
            { ruleType: 'convergence', severity: 'hard', description: '徽章流向、赃物库交易、艾尔莎袭击和迟到救援只能被改路径/代价，不能凭空删除。' },
            { ruleType: 'knowledge', severity: 'warn', description: '初期 NPC 不应知道玩家死亡回归，除非由异常痕迹、梦境残响或玩家危险透露触发。' },
        ],
        promises: ['确认徽章流向', '查明赃物库交易窗口', '让强者入局付出时间或证据代价'],
    },
    2: {
        locations: ['罗兹瓦尔宅邸', '阿拉姆村', '禁书库', '森林'],
        characters: ['玩家', '爱蜜莉雅', '蕾姆', '拉姆', '罗兹瓦尔', '碧翠丝'],
        facts: [
            '宅邸篇的死亡链来自诅咒源、魔女余香误判、雷姆/拉姆警惕和村庄魔兽。',
            '信任重建必须通过可验证证据和舍命保护，而不是一句话洗白。',
            '碧翠丝能提供禁书库保护和咒术线索，但不能替玩家自动解决全部宅邸死局。',
        ],
        constraints: [
            { ruleType: 'knowledge', severity: 'hard', description: '雷姆早期对魔女余香高度警惕；没有证据、救援或长期行动时不应突然完全信任玩家。' },
            { ruleType: 'convergence', severity: 'hard', description: '诅咒源和村庄魔兽是破局核心，不能被纯关系戏跳过。' },
        ],
        promises: ['识别诅咒触发源', '降低蕾姆怀疑或转化为可验证协作', '救回被魔兽卷入的孩子'],
    },
    3: {
        locations: ['王都', '库珥修宅邸', '街道', '白鲸战场', '魔女教据点'],
        characters: ['玩家', '蕾姆', '库珥修', '威尔海姆', '安娜塔西亚', '怠惰司教', '白鲸'],
        facts: [
            '第三篇章的核心不是单兵回援，而是承认软弱、把预知变成可交易证据并组织同盟。',
            '强行公开死亡回归会触发高危惩罚，必须以证据、预言伪装或可验证情报间接表达。',
            '白鲸与怠惰是连续危机，回援宅邸需要先处理交通、同盟、时间窗和魔女教指尖。',
        ],
        constraints: [
            { ruleType: 'death_return', severity: 'hard', description: '死亡回归秘密不能作为普通谈判筹码公开说出。' },
            { ruleType: 'if_pressure', severity: 'warn', description: '逃避责任会推高怠惰 IF；孤立硬闯会推高傲慢/愤怒压力。' },
        ],
        promises: ['把白鲸情报转化为同盟交易', '承认自身限制并求助', '拆解怠惰指尖和宅邸袭击时间窗'],
    },
    4: {
        locations: ['圣域', '墓所', '罗兹瓦尔宅邸', '禁书库', '雪地'],
        characters: ['玩家', '艾姬多娜', '罗兹瓦尔', '奥托', '加菲尔', '碧翠丝', '艾尔莎', '梅莉'],
        facts: [
            '圣域篇是双线死局：圣域试炼、宅邸袭击、罗兹瓦尔降雪和大兔会互相挤压。',
            '强欲契约诱惑会把死亡回归工具化；主线破局需要拒绝单人无限重置。',
            '奥托、加菲尔和碧翠丝的自主选择是破局骨架，不应被玩家独占所有解法。',
        ],
        constraints: [
            { ruleType: 'convergence', severity: 'hard', description: '宅邸袭击与圣域大兔不能被无代价同时抹除，必须用分工和时间窗解决。' },
            { ruleType: 'character_agency', severity: 'hard', description: '碧翠丝的选择需要被尊重，不能被命令式带走替代。' },
        ],
        promises: ['拒绝死亡工具化', '争取奥托/加菲尔协作', '让碧翠丝作出自主选择'],
    },
    5: {
        locations: ['普里斯提拉', '水门都市', '市政厅', '广播塔'],
        characters: ['玩家', '安娜塔西亚', '库珥修', '普莉希拉', '强欲司教', '暴食司教'],
        facts: [
            '水门都市篇依赖多阵营协作、广播鼓舞、市政秩序夺回和司教权能破解。',
            '城市战不能只靠玩家单点胜利，需要同步处理民众、广播、战区和候选阵营。',
        ],
        constraints: [
            { ruleType: 'scope', severity: 'warn', description: '普里斯提拉是多线城市危机，单个战斗胜利不应自动解决全城。' },
        ],
        promises: ['建立跨阵营通信', '夺回关键市政节点', '留下暴食代价和后续追索'],
    },
    6: {
        locations: ['普雷阿迪斯监视塔', '沙丘', '书库', '试炼层'],
        characters: ['玩家', '碧翠丝', '尤里乌斯', '梅莉', '夏乌拉', '雷德'],
        facts: [
            '监视塔篇围绕名字/记忆、自我整合、死者之书诱惑和试炼规则。',
            '失忆或身份混乱时，活人证词、外部事实和行动连续性比自我宣称更可靠。',
        ],
        constraints: [
            { ruleType: 'knowledge', severity: 'hard', description: '死者之书和记忆情报不能被当作无风险全知工具。' },
            { ruleType: 'promise', severity: 'warn', description: '夏乌拉相关承诺具有强情感债务，不能被轻描淡写跳过。' },
        ],
        promises: ['用外部证据拼回自我', '尊重塔内试炼规则', '偿还夏乌拉承诺'],
    },
    7: {
        locations: ['佛拉基亚', '修德拉克', '魔都', '吉努恩海芬'],
        characters: ['玩家', '失忆蕾姆', '路伊', '文森特', '托德', '坦萨'],
        facts: [
            '帝国前半的压力来自失忆蕾姆不信任、文森特夺位、托德追杀和孤岛短循环。',
            '失忆蕾姆不能突然恢复旧关系；信任必须由保护、代价和连续行动重建。',
        ],
        constraints: [
            { ruleType: 'knowledge', severity: 'hard', description: '失忆蕾姆不应拥有旧宅邸时期对玩家的完整记忆。' },
            { ruleType: 'death_return', severity: 'warn', description: '孤岛短循环应保留极短决策窗口和高压学习结构。' },
        ],
        promises: ['在不被信任中证明行动', '识别托德和咒则风险', '从孤岛短循环中提炼可执行策略'],
    },
    8: {
        locations: ['佛拉基亚首都', '战团阵地', '灾厄战场'],
        characters: ['玩家', '普雷阿迪斯战团', '斯芬克斯', '文森特', '失忆蕾姆'],
        facts: [
            '帝国后半是大灾厄多线战场，普雷阿迪斯战团、同盟、灾厄源头和雷姆关系同步推进。',
            '斯芬克斯关联强欲魔女研究与不死者灾厄，不能被普通敌人化简。',
        ],
        constraints: [
            { ruleType: 'scope', severity: 'hard', description: '大灾厄需要战团、同盟和灾厄源头多线收束，不能由单次个人胜利完结。' },
        ],
        promises: ['协调战团与同盟', '确认斯芬克斯灾厄机制', '推动雷姆重新接纳但不强制恢复记忆'],
    },
    9: {
        locations: ['露格尼卡王都', '王选会场', '普莉希拉阵营', '封印相关地点'],
        characters: ['玩家', '阿尔德巴兰', '普莉希拉阵营', '艾蜜莉雅', '雷姆'],
        facts: [
            '第九篇章聚焦阿尔领域循环、王选动荡、普莉希拉阵营决裂和封印/献祭风险。',
            '阿尔的循环权能不能被写成普通时间魔法，它具有孤独累积和领域规则。',
        ],
        constraints: [
            { ruleType: 'knowledge', severity: 'warn', description: '阿尔的真实目的与权能规则应通过冲突和证据逐步显影。' },
        ],
        promises: ['调查阿尔领域逻辑', '处理王选阵营裂痕', '阻止把问题外包给未来牺牲'],
    },
    10: {
        locations: ['王都', '王城', '撤离车队', '六枚舌据点'],
        characters: ['玩家', '碧翠丝', '菲利斯', '库珥修', '六枚舌', '艾蜜莉雅'],
        facts: [
            '第十篇章围绕王都戒严、六枚舌、青蛇菲利斯、撤离车队事故和最优解伦理。',
            '追寻最优解不能等同抛弃可救之人；玩家应在证据链和救援责任之间付出代价选择。',
        ],
        constraints: [
            { ruleType: 'ethics', severity: 'hard', description: '最优解路线不能把抛弃同伴写成无代价正确答案。' },
            { ruleType: 'knowledge', severity: 'warn', description: '六枚舌和青蛇身份需要谍报、目击或交易线索支撑。' },
        ],
        promises: ['保存撤离证据链', '让菲利斯/青蛇线索可验证', '在救援和最优解之间结算代价'],
    },
    11: {
        locations: ['王都雨夜', '废弃钟楼', '世界线树', '魔女残响空间'],
        characters: ['玩家', '莉榭尔', '剥钟人', '米娅', '爱蜜莉雅'],
        facts: [
            'Arc 11 是项目原创延展，不应伪装成官方原文；它只能把官方世界观作为底盘。',
            '废钟雨夜、掌心警告和世界线树是本项目原创开局/终局的核心视觉和因果符号。',
        ],
        constraints: [
            { ruleType: 'source_boundary', severity: 'hard', description: '项目原创 Arc 11 内容必须标记为 project_original，不能当作官方原文引用。' },
        ],
        promises: ['解释掌心警告', '把废弃钟楼和死亡残响接入世界线树', '保持官方底盘与原创延展边界'],
        sourceType: 'project_original',
        canonLevel: 'project_original',
    },
};

function normalizeProtagonistTerms(value) {
    return String(value || '')
        .replace(/菜月[・·\s]*(?:昴|昂|君|贤一|菜穗子|利格鲁|施瓦茨)?/g, '玩家')
        .replace(/ナツキ[・·\s]*スバル|ナツキ|スバル/g, '玩家')
        .replace(/\bNatsuki\s+Subaru\b|\bSubaru\b|\bSUBARU\b|\bNATSUKI\b/g, '玩家')
        .replace(/\b486\b/g, '玩家')
        .replace(/昴|昂/g, '玩家')
        .replace(/交接班|接班/g, '轮替');
}

function compactText(value, limit = MAX_DIGEST_CHARS) {
    const text = normalizeProtagonistTerms(value)
        .replace(/!\[[^\]]*]\([^)]+\)/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/[#*_`>|\-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (text.length <= limit) {
        return text;
    }
    const suffix = '...';
    return `${text.slice(0, Math.max(0, limit - suffix.length)).trimEnd()}${suffix}`;
}

function walkFiles(dir, predicate, files = []) {
    if (!fs.existsSync(dir)) {
        return files;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkFiles(full, predicate, files);
        } else if (!predicate || predicate(full)) {
            files.push(full);
        }
    }
    return files;
}

function shouldIndexTextFile(file) {
    const name = path.basename(file);
    return name.endsWith('.txt')
        && !/完整合集|合并版|scrape_record|progress|后记|译者/u.test(name);
}

function sourceRelativePath(file) {
    return normalizeProtagonistTerms(path.relative(novelRoot, file).split(path.sep).join('/'));
}

function stableId(prefix, value) {
    const raw = normalizeProtagonistTerms(value)
        .replace(/\\/g, '/')
        .replace(/[^\u4e00-\u9fa5A-Za-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 96);
    let hash = 2166136261;
    for (const char of String(value || '')) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return `${prefix}-${raw || 'item'}-${(hash >>> 0).toString(36)}`;
}

function readJsonlRecords(filePath) {
    if (!fs.existsSync(filePath)) {
        return [];
    }
    return fs.readFileSync(filePath, 'utf8')
        .split(/\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
}

function readJsonFile(filePath, fallback = {}) {
    if (!fs.existsSync(filePath)) {
        return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function compactCorpusAvailable() {
    return fs.existsSync(path.join(corpusRoot, 'metadata.json'))
        && fs.existsSync(path.join(corpusRoot, 'chapter-digests.jsonl'))
        && fs.existsSync(path.join(corpusRoot, 'storydb-digests.jsonl'))
        && fs.existsSync(path.join(corpusRoot, 'causal-facts.jsonl'))
        && fs.existsSync(path.join(corpusRoot, 'chapter-vault.jsonl.gz'));
}

function normalizeStringArray(values = [], limit = 20) {
    return (Array.isArray(values) ? values : [])
        .map((value) => normalizeProtagonistTerms(value))
        .filter(Boolean)
        .slice(0, limit);
}

function inferArcFromRelative(relativePath) {
    if (/篇章[_-]?misc|登场人物|译名字典/u.test(relativePath)) {
        return 0;
    }
    for (const [arc, pattern] of arcDirectoryMap) {
        if (pattern.test(relativePath)) {
            return arc;
        }
    }
    return /外传|特典|短篇|Ex|EX|IF/u.test(relativePath) ? 0 : 1;
}

function inferSourceType(relativePath) {
    if (/篇章[_-]?misc|登场人物|译名字典/u.test(relativePath)) {
        return 'reference_misc';
    }
    if (/IF|傲慢|愤怒|怠惰|强欲|暴食|赎罪|Ayamatsu|Oboreru|Kasaneru|Aganau|Tsugihagu/u.test(relativePath)) {
        return 'official_if';
    }
    if (/外传|特典|短篇|Ex|EX/u.test(relativePath)) {
        return 'official_side_story';
    }
    return 'web_novel_chapter';
}

function inferCanonLevel(sourceType) {
    if (sourceType === 'reference_misc') {
        return 'official_reference';
    }
    if (sourceType === 'official_if') {
        return 'official_if';
    }
    if (sourceType === 'official_side_story') {
        return 'official_side_story';
    }
    return 'official';
}

function inferIfRoute(relativePath, text = '') {
    const haystack = `${relativePath} ${text.slice(0, 1200)}`;
    const hit = ifRoutePatterns.find(([, pattern]) => pattern.test(haystack));
    return hit?.[0] || '';
}

function chapterNumberFromPath(relativePath) {
    const match = relativePath.match(/第(\d+)章/u);
    return match ? match[1] : '';
}

function titleFromPath(relativePath) {
    const base = path.basename(relativePath, path.extname(relativePath));
    const cleaned = base.replace(/^第\d+章[_\s]*/u, '').replace(/^\d+\s*/u, '').trim();
    return compactText(cleaned || base, 80);
}

function extractTerms(text, terms, limit = 12) {
    return terms.filter((term) => text.includes(term)).slice(0, limit);
}

function sentenceList(raw) {
    return String(raw || '')
        .replace(/\r/g, '\n')
        .split(/(?<=[。！？!?」』])\s*|\n+/u)
        .map((line) => compactText(line, 220))
        .filter((line) => line.length >= 14 && !/^第?\d+章?$/u.test(line))
        .slice(0, 1800);
}

function sentenceCausalScore(sentence) {
    const essence = extractTerms(sentence, worldEssenceTerms, 12).length * 8;
    const causal = extractTerms(sentence, causalTerms, 16).length * 4;
    const character = extractTerms(sentence, characterTerms, 12).length * 2;
    const location = extractTerms(sentence, locationTerms, 8).length * 2;
    const lengthBonus = sentence.length >= 28 && sentence.length <= 180 ? 2 : 0;
    return essence + causal + character + location + lengthBonus;
}

function selectDigestSentences(sentences) {
    const ranked = sentences
        .map((sentence, index) => ({ sentence, index, score: sentenceCausalScore(sentence) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, 4)
        .sort((a, b) => a.index - b.index)
        .map((entry) => entry.sentence);
    const edges = [
        sentences[0],
        sentences[Math.floor(sentences.length / 2)],
        sentences[sentences.length - 1],
    ].filter(Boolean);
    return [...new Set([...ranked, ...edges])].slice(0, 5);
}

function chapterKeywords(relativePath, text, hints = {}) {
    const route = inferIfRoute(relativePath, text);
    return [
        titleFromPath(relativePath),
        ...extractTerms(text, characterTerms, 12),
        ...extractTerms(text, locationTerms, 10),
        ...extractTerms(text, worldEssenceTerms, 10),
        ...extractTerms(text, causalTerms, 8),
        route,
        ...(hints.extraKeywords || []),
    ].filter(Boolean).slice(0, MAX_KEYWORDS);
}

function buildChapterChunk(file) {
    const relativePath = sourceRelativePath(file);
    const raw = fs.readFileSync(file, 'utf8');
    const sentences = sentenceList(raw);
    const arc = inferArcFromRelative(relativePath);
    const sourceType = inferSourceType(relativePath);
    const routeId = inferIfRoute(relativePath, raw);
    const keywords = chapterKeywords(relativePath, raw);
    const digestSentences = selectDigestSentences(sentences);
    return {
        id: stableId('chapter', relativePath),
        sourcePath: relativePath,
        sourceType,
        canonLevel: inferCanonLevel(sourceType),
        arc,
        chapter: chapterNumberFromPath(relativePath),
        scene: titleFromPath(relativePath),
        routeId,
        causalTier: extractTerms(raw, worldEssenceTerms, 1).length ? 'world-essence' : (routeId ? 'if-attractor' : 'chapter-causal'),
        characters: extractTerms(raw, characterTerms, 16),
        locations: extractTerms(raw, locationTerms, 12),
        events: extractTerms(raw, causalTerms, 12),
        keywords,
        digest: compactText([titleFromPath(relativePath), ...digestSentences].filter(Boolean).join(' '), MAX_DIGEST_CHARS),
        sourceIds: [relativePath],
        rawChars: raw.length,
    };
}

function buildChapterFacts(chunk, file) {
    const raw = fs.readFileSync(file, 'utf8');
    const sentences = sentenceList(raw)
        .map((sentence, index) => ({ sentence, index, score: sentenceCausalScore(sentence) }))
        .filter((entry) => entry.score >= 8)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, MAX_AUTO_FACTS_PER_CHAPTER);
    return sentences.map((entry, index) => ({
        id: `${chunk.id}-fact-${index + 1}`,
        chunkId: chunk.id,
        arc: chunk.arc,
        canonLevel: chunk.canonLevel,
        subject: chunk.scene || `Arc ${chunk.arc}`,
        predicate: chunk.causalTier === 'world-essence' ? 'anchors_world_rule' : (chunk.routeId ? 'anchors_if_route' : 'observes_causal_event'),
        object: compactText(entry.sentence, MAX_FACT_CHARS),
        certainty: chunk.canonLevel === 'official' ? 0.88 : 0.78,
        causalTier: chunk.causalTier,
        routeId: chunk.routeId,
        keywords: chunk.keywords,
        scoreHint: entry.score,
    }));
}

function buildStoryDbChunks() {
    return walkFiles(storyDbRoot, (file) => /\.(md|json|txt)$/u.test(file))
        .sort()
        .map((file) => {
            const relative = sourceRelativePath(file);
            const raw = fs.readFileSync(file, 'utf8');
            const arc = inferArcFromRelative(relative);
            return {
                id: stableId('storydb', relative),
                sourcePath: relative,
                sourceType: 'story_database',
                canonLevel: 'official_summary',
                arc,
                chapter: '',
                scene: titleFromPath(relative),
                routeId: inferIfRoute(relative, raw),
                causalTier: 'arc-structure',
                characters: extractTerms(raw, characterTerms, 16),
                locations: extractTerms(raw, locationTerms, 12),
                events: extractTerms(raw, causalTerms, 12),
                keywords: chapterKeywords(relative, raw),
                digest: compactText(raw, MAX_DIGEST_CHARS),
                sourceIds: [relative],
                rawChars: raw.length,
            };
        });
}

function chunkFromCorpusRecord(record) {
    const sourcePath = normalizeProtagonistTerms(record.sourcePath || record.sourceIds?.[0] || record.id || '');
    const sourceType = record.sourceType || 'web_novel_chapter';
    const canonLevel = record.canonLevel || inferCanonLevel(sourceType);
    return {
        id: record.id || stableId('corpus', sourcePath),
        sourcePath,
        sourceType,
        canonLevel,
        arc: Number(record.arc || inferArcFromRelative(sourcePath) || 0),
        chapter: String(record.chapter || ''),
        scene: compactText(record.scene || titleFromPath(sourcePath), 90),
        routeId: record.routeId || inferIfRoute(sourcePath, record.digest || ''),
        causalTier: record.causalTier || (record.routeId ? 'if-attractor' : 'chapter-causal'),
        characters: normalizeStringArray(record.characters, 18),
        locations: normalizeStringArray(record.locations, 14),
        events: normalizeStringArray(record.events, 14),
        keywords: normalizeStringArray(record.keywords, MAX_KEYWORDS),
        digest: compactText(record.digest || '', MAX_DIGEST_CHARS),
        sourceIds: normalizeStringArray(Array.isArray(record.sourceIds) ? record.sourceIds : [sourcePath], 12),
        rawChars: Number(record.rawChars || 0),
    };
}

function factFromCorpusRecord(record) {
    return {
        id: record.id || stableId('corpus-fact', `${record.chunkId || ''}:${record.object || ''}`),
        chunkId: record.chunkId || '',
        arc: Number(record.arc || 0),
        canonLevel: record.canonLevel || 'official',
        subject: compactText(record.subject || `Arc ${record.arc || 0}`, 90),
        predicate: record.predicate || 'observes_causal_event',
        object: compactText(record.object || '', MAX_FACT_CHARS),
        certainty: Number(record.certainty || 0.78),
        causalTier: record.causalTier || '',
        routeId: record.routeId || '',
        keywords: normalizeStringArray(record.keywords, MAX_KEYWORDS),
        scoreHint: Number(record.scoreHint || 0),
    };
}

function chunkForArc(arc, ref, hints) {
    const sourceType = hints.sourceType || 'official_summary';
    const canonLevel = hints.canonLevel || 'official_summary';
    return {
        id: `arc${String(arc).padStart(2, '0')}-canon-spine`,
        sourcePath: ref?.title || `Arc ${arc}`,
        sourceType,
        canonLevel,
        arc,
        chapter: '',
        scene: ref?.title || `Arc ${arc}`,
        characters: hints.characters || [],
        locations: hints.locations || [],
        events: hints.promises || [],
        digest: compactText(`${ref?.canonSpine || ''} ${ref?.summaryDigest || ''}`, MAX_DIGEST_CHARS),
        sourceIds: [`canon-arc-${arc}`],
    };
}

function snippetChunksForArc(arc, ref, hints) {
    return (ref?.sourceSnippets || []).slice(0, 2).map((snippet, index) => ({
        id: `arc${String(arc).padStart(2, '0')}-source-${index + 1}`,
        sourcePath: snippet.sourceRelativePath || `canon-arc-${arc}`,
        sourceType: 'web_novel_digest',
        canonLevel: 'official',
        arc,
        chapter: '',
        scene: ref?.title || `Arc ${arc}`,
        characters: hints.characters || [],
        locations: hints.locations || [],
        events: hints.promises || [],
        digest: compactText(snippet.text || '', 220),
        sourceIds: [snippet.sourceRelativePath || `canon-arc-${arc}`],
    }));
}

const chunks = [];
const facts = [];
const constraints = [];
const promises = [];

for (let arc = 1; arc <= 11; arc += 1) {
    const ref = canonRouteReferenceByArc[String(arc)] || canonRouteReferenceByArc[arc] || {};
    const hints = arcFactHints[arc] || {};
    const baseChunk = chunkForArc(arc, ref, hints);
    chunks.push(baseChunk, ...snippetChunksForArc(arc, ref, hints));
    for (const [index, fact] of (hints.facts || []).entries()) {
        facts.push({
            id: `arc${String(arc).padStart(2, '0')}-fact-${index + 1}`,
            chunkId: baseChunk.id,
            arc,
            canonLevel: hints.canonLevel || 'official_summary',
            subject: `Arc ${arc}`,
            predicate: 'requires',
            object: compactText(fact, MAX_FACT_CHARS),
            certainty: hints.canonLevel === 'project_original' ? 0.82 : 0.92,
            keywords: [...(hints.locations || []), ...(hints.characters || []), ...(hints.promises || [])],
        });
    }
    for (const [index, constraint] of (hints.constraints || []).entries()) {
        constraints.push({
            id: `arc${String(arc).padStart(2, '0')}-constraint-${index + 1}`,
            chunkId: baseChunk.id,
            arc,
            canonLevel: hints.canonLevel || 'official_summary',
            ruleType: constraint.ruleType || 'continuity',
            scope: `Arc ${arc}`,
            severity: constraint.severity || 'warn',
            description: compactText(constraint.description, MAX_FACT_CHARS),
            keywords: [...(hints.locations || []), ...(hints.characters || []), ...(hints.promises || [])],
        });
    }
    for (const [index, promise] of (hints.promises || []).entries()) {
        promises.push({
            id: `arc${String(arc).padStart(2, '0')}-promise-${index + 1}`,
            chunkId: baseChunk.id,
            arc,
            promise: compactText(promise, 80),
            status: 'open',
            payoffWindow: `Arc ${arc}`,
        });
    }
}

let indexedWebNovelFiles = 0;
let indexedWebNovelChars = 0;
let indexedRawVaultBytes = 0;
let storyDbChunks = [];
let sourceMode = 'raw-source';

if (compactCorpusAvailable()) {
    sourceMode = 'compact-corpus';
    const metadata = readJsonFile(path.join(corpusRoot, 'metadata.json'));
    const summary = metadata.summary || {};
    const chapterRecords = readJsonlRecords(path.join(corpusRoot, 'chapter-digests.jsonl'));
    const storyDbRecords = readJsonlRecords(path.join(corpusRoot, 'storydb-digests.jsonl'));
    const causalFactRecords = readJsonlRecords(path.join(corpusRoot, 'causal-facts.jsonl'));
    for (const record of chapterRecords) {
        const chunk = chunkFromCorpusRecord(record);
        chunks.push(chunk);
        indexedWebNovelFiles += 1;
        indexedWebNovelChars += chunk.rawChars || 0;
    }
    storyDbChunks = storyDbRecords.map(chunkFromCorpusRecord);
    chunks.push(...storyDbChunks);
    facts.push(...causalFactRecords.map(factFromCorpusRecord));
    indexedWebNovelFiles = Number(summary.chapterFiles || indexedWebNovelFiles);
    indexedWebNovelChars = Number(summary.rawTextChars || indexedWebNovelChars);
    indexedRawVaultBytes = Number(summary.rawVaultBytes || 0);
} else {
    const webNovelFiles = walkFiles(webNovelRoot, shouldIndexTextFile).sort();
    for (const file of webNovelFiles) {
        const chunk = buildChapterChunk(file);
        chunks.push(chunk);
        facts.push(...buildChapterFacts(chunk, file));
        indexedWebNovelFiles += 1;
        indexedWebNovelChars += chunk.rawChars || 0;
    }

    storyDbChunks = buildStoryDbChunks();
    chunks.push(...storyDbChunks);
    for (const chunk of storyDbChunks) {
        facts.push({
            id: `${chunk.id}-fact-1`,
            chunkId: chunk.id,
            arc: chunk.arc,
            canonLevel: chunk.canonLevel,
            subject: chunk.scene || `Arc ${chunk.arc}`,
            predicate: 'summarizes_arc_causality',
            object: compactText(chunk.digest, MAX_FACT_CHARS),
            certainty: 0.86,
            causalTier: chunk.causalTier,
            routeId: chunk.routeId,
            keywords: chunk.keywords,
        });
    }
}

const payload = {
    generatedAt: new Date().toISOString(),
    source: 'scripts/build-re0-story-rag.mjs',
    canonGeneratedAt: canonRouteReferenceSummary?.generatedAt || '',
    sourceRoot: sourceMode === 'compact-corpus'
        ? path.relative(projectRoot, corpusRoot)
        : path.relative(projectRoot, novelRoot),
    sourceStats: {
        sourceMode,
        webNovelFiles: indexedWebNovelFiles,
        webNovelChars: indexedWebNovelChars,
        storyDatabaseFiles: storyDbChunks.length,
        rawVaultBytes: indexedRawVaultBytes,
    },
    chunks: chunks.length,
    facts: facts.length,
    constraints: constraints.length,
    promises: promises.length,
    maxDigestChars: MAX_DIGEST_CHARS,
    maxFactChars: MAX_FACT_CHARS,
};

const generated = `// Generated by scripts/build-re0-story-rag.mjs. Do not edit by hand.
export const storyRagIndexMetadata = ${JSON.stringify(payload, null, 4)};
export const storyRagChunks = ${JSON.stringify(chunks, null, 4)};
export const storyRagFacts = ${JSON.stringify(facts, null, 4)};
export const storyRagConstraints = ${JSON.stringify(constraints, null, 4)};
export const storyRagPromises = ${JSON.stringify(promises, null, 4)};
`;

fs.writeFileSync(outputPath, `${generated}\n`, 'utf8');
console.log(JSON.stringify(payload, null, 2));
