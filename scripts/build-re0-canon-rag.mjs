#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const novelRoot = path.resolve(projectRoot, '..', 're0_novel_src');
const corpusRoot = path.join(projectRoot, 'data/default-user/re0-engine/rag/novel-corpus');
const storyDbRoot = path.join(novelRoot, 'story_database');
const webNovelRoot = path.join(novelRoot, 're0_web_novel_zh');
const outputPath = path.join(projectRoot, 'public/scripts/extensions/third-party/re0-adventure-engine/data/re0-canon-rag.generated.js');
const MAX_SNIPPET_CHARS = 360;
const MAX_SUMMARY_CHARS = 900;

const arcPlans = [
    {
        arc: 1,
        file: 'arc1_summaries.md',
        title: 'Arc 1 王都的一天',
        dirNeedles: ['第一篇章'],
        canonSpine: '王都初日以徽章失窃、赃物库、艾尔莎、菲鲁特与莱因哈鲁特入局为收束骨架；玩家可偏离，但回归原作线时必须逐步把证据链拉回“徽章流向 -> 赃物库交易 -> 强者迟到但有效入局”。',
        chapterNeedles: ['第0015章', '第0022章'],
    },
    {
        arc: 2,
        file: 'arc2_summaries.md',
        title: 'Arc 2 豪宅的一周',
        dirNeedles: ['第二篇章'],
        canonSpine: '宅邸篇以诅咒源、魔女余香、雷姆/拉姆误判、村庄魔兽和舍命救援为骨架；回归原作线不是逃离宅邸，而是把怀疑变成可验证证据，重建信任。',
        chapterNeedles: ['第0055章', '第0075章'],
    },
    {
        arc: 3,
        file: 'arc3_summaries.md',
        title: 'Arc 3 王选、白鲸与怠惰',
        dirNeedles: ['第三篇章'],
        canonSpine: '第三篇章以王选失态、求援失败、雷姆救赎、白鲸同盟、怠惰指尖和暴食余波为骨架；回归原作线的核心是承认软弱、组织同盟、把预知转成可交易证据。',
        chapterNeedles: ['从零开始', '第0167章', '怠惰'],
    },
    {
        arc: 4,
        file: 'arc4_summaries.md',
        title: 'Arc 4 圣域与永远的契约',
        dirNeedles: ['第四篇章'],
        canonSpine: '圣域篇以试炼、罗兹瓦尔双线死局、艾姬多娜契约诱惑、奥托/加菲尔协作和碧翠丝“选择我”为骨架；回归原作线必须拒绝死亡工具化，让同伴分担战场。',
        chapterNeedles: ['选择我', '第0315章'],
    },
    {
        arc: 5,
        file: 'arc5_summaries.md',
        title: 'Arc 5 水门都市普里斯提拉',
        dirNeedles: ['第五篇章'],
        canonSpine: '水门都市以四大司教袭击、广播鼓舞、市政厅夺还、强欲权能破解和战后暴食代价为骨架；回归原作线要让多阵营协作与城市秩序先恢复。',
        chapterNeedles: ['英雄幻想', '第0408章'],
    },
    {
        arc: 6,
        file: 'arc6_summaries.md',
        title: 'Arc 6 普雷阿迪斯监视塔',
        dirNeedles: ['第六篇章'],
        canonSpine: '监视塔篇以名字/记忆、失忆恐慌、死者之书诱惑、自我整合、雷德/夏乌拉试炼为骨架；回归原作线要用活人证词与外部事实拼回自我。',
        chapterNeedles: ['Re：从零开始的异世界生活', '第0500章'],
    },
    {
        arc: 7,
        file: 'arc7_8_summaries.md',
        title: 'Arc 7 佛拉基亚狼之国',
        dirNeedles: ['第七篇章'],
        canonSpine: '帝国前半以失忆雷姆不信任、修德拉克、文森特、女装潜入、魔都和角斗士孤岛十秒循环为骨架；回归原作线要先保命、结盟、取得战团信任。',
        chapterNeedles: ['第0578章', '吉努恩海芬'],
    },
    {
        arc: 8,
        file: 'arc7_8_summaries.md',
        title: 'Arc 8 帝国大灾厄',
        dirNeedles: ['第八篇章'],
        canonSpine: '帝国后半以普雷阿迪斯战团、大灾厄、斯芬克斯、首都多线战场和雷姆重新接纳为骨架；回归原作线要让救援、战团、同盟和灾厄节点同步。',
        chapterNeedles: ['斯芬克斯', '大灾厄'],
    },
    {
        arc: 9,
        file: 'arc9_10_summaries.md',
        title: 'Arc 9 无名星光',
        dirNeedles: ['第九篇章'],
        canonSpine: '第九篇章以返国、阿尔领域循环、王选动荡、普莉希拉阵营决裂和封印/献祭风险为骨架；回归原作线要追查权能逻辑，不把问题外包未来。',
        chapterNeedles: ['阿尔', '第0730章'],
    },
    {
        arc: 10,
        file: 'arc9_10_summaries.md',
        title: 'Arc 10 王都秘密与六枚舌',
        dirNeedles: ['第十篇章'],
        canonSpine: '第十篇章以王都戒严、六枚舌、菲利斯青蛇、撤离车队、事故救援和“追寻最优解”为骨架；回归原作线要保留撤离证据链但不抛弃可救之人。',
        chapterNeedles: ['第0779章', '追寻最优解'],
    },
];

function walkTxt(dir, files = []) {
    if (!fs.existsSync(dir)) {
        return files;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkTxt(full, files);
        } else if (entry.name.endsWith('.txt')
            && !/完整合集|合并版|scrape_record|后记|篇章插图/i.test(entry.name)) {
            files.push(full);
        }
    }
    return files;
}

function normalizeProtagonistTerms(value) {
    return String(value || '')
        .replace(/菜月[・·\s]*(?:昴|昂|君|贤一|菜穗子|利格鲁|施瓦茨)?/g, '玩家')
        .replace(/ナツキ[・·\s]*スバル|ナツキ|スバル/g, '玩家')
        .replace(/\bNatsuki\s+Subaru\b|\bSubaru\b|\bSUBARU\b|\bNATSUKI\b/g, '玩家')
        .replace(/\b486\b/g, '玩家')
        .replace(/昴|昂/g, '玩家')
        .replace(/交接班|接班/g, '轮替');
}

function compactText(value, limit) {
    const text = normalizeProtagonistTerms(value)
        .replace(/!\[[^\]]*]\([^)]+\)/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/[#*_`>|\-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return text.length > limit ? `${text.slice(0, limit).trimEnd()}...` : text;
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
        && fs.existsSync(path.join(corpusRoot, 'chapter-vault.jsonl.gz'));
}

let cachedCorpusChapters = null;
let cachedCorpusStoryDb = null;

function corpusChapters() {
    if (!cachedCorpusChapters) {
        cachedCorpusChapters = readJsonlRecords(path.join(corpusRoot, 'chapter-digests.jsonl'));
    }
    return cachedCorpusChapters;
}

function corpusStoryDb() {
    if (!cachedCorpusStoryDb) {
        cachedCorpusStoryDb = readJsonlRecords(path.join(corpusRoot, 'storydb-digests.jsonl'));
    }
    return cachedCorpusStoryDb;
}

function corpusSearchText(record) {
    return [
        record.sourcePath,
        record.scene,
        record.digest,
        ...(Array.isArray(record.keySentences) ? record.keySentences : []),
        ...(Array.isArray(record.keywords) ? record.keywords : []),
    ].filter(Boolean).join(' ');
}

function summaryDigest(fileName) {
    if (compactCorpusAvailable()) {
        const record = corpusStoryDb().find((entry) => path.basename(entry.sourcePath || '') === fileName
            || String(entry.sourcePath || '').endsWith(`/${fileName}`));
        return compactText([
            record?.digest || '',
            ...(Array.isArray(record?.keySentences) ? record.keySentences.slice(0, 3) : []),
        ].filter(Boolean).join(' '), MAX_SUMMARY_CHARS);
    }
    const file = path.join(storyDbRoot, fileName);
    if (!fs.existsSync(file)) {
        return '';
    }
    const text = fs.readFileSync(file, 'utf8');
    const loopStart = text.indexOf('## 🔄');
    const chapterStart = text.indexOf('## 📖');
    const chunk = loopStart >= 0
        ? text.slice(loopStart, chapterStart > loopStart ? chapterStart : loopStart + 2200)
        : text.slice(0, 1800);
    return compactText(chunk, MAX_SUMMARY_CHARS);
}

function extractSnippet(file) {
    if (file && typeof file === 'object') {
        return compactText([
            file.scene || '',
            file.digest || '',
            ...(Array.isArray(file.keySentences) ? file.keySentences.slice(0, 2) : []),
        ].filter(Boolean).join(' '), MAX_SNIPPET_CHARS);
    }
    const raw = fs.readFileSync(file, 'utf8');
    const cleaned = compactText(raw, MAX_SNIPPET_CHARS);
    return cleaned;
}

function findSnippetFiles(allFiles, needles, dirNeedles = []) {
    if (allFiles.some((file) => file && typeof file === 'object')) {
        const candidates = dirNeedles.length
            ? allFiles.filter((record) => dirNeedles.some((needle) => String(record.sourcePath || '').includes(needle)))
            : allFiles;
        const found = [];
        for (const needle of needles) {
            const hit = candidates.find((record) => String(record.sourcePath || '').includes(needle))
                || candidates.find((record) => corpusSearchText(record).includes(needle));
            if (hit && !found.includes(hit)) {
                found.push(hit);
            }
            if (found.length >= 2) {
                break;
            }
        }
        return found;
    }
    const candidates = dirNeedles.length
        ? allFiles.filter((file) => dirNeedles.some((needle) => file.includes(needle)))
        : allFiles;
    const found = [];
    for (const needle of needles) {
        const hit = candidates.find((file) => file.includes(needle))
            || candidates.find((file) => {
                try {
                    return fs.readFileSync(file, 'utf8').includes(needle);
                } catch {
                    return false;
                }
            });
        if (hit && !found.includes(hit)) {
            found.push(hit);
        }
        if (found.length >= 2) {
            break;
        }
    }
    return found;
}

const usingCompactCorpus = compactCorpusAvailable();
const corpusMetadata = usingCompactCorpus ? readJsonFile(path.join(corpusRoot, 'metadata.json')) : {};
const allTextFiles = usingCompactCorpus ? corpusChapters() : walkTxt(webNovelRoot).sort();
const references = {};
for (const plan of arcPlans) {
    const snippetFiles = findSnippetFiles(allTextFiles, plan.chapterNeedles || [], plan.dirNeedles || []);
    references[plan.arc] = {
        arc: plan.arc,
        title: plan.title,
        canonSpine: plan.canonSpine,
        summaryDigest: summaryDigest(plan.file),
        sourceSnippets: snippetFiles.map((file) => ({
            sourceRelativePath: file && typeof file === 'object'
                ? normalizeProtagonistTerms(String(file.sourcePath || file.id || ''))
                : normalizeProtagonistTerms(path.relative(novelRoot, file).split(path.sep).join('/')),
            text: extractSnippet(file),
        })),
        policy: '仅作为当前 Arc 的原作风味锚点和场景重现参考；模型必须用视觉小说方式重演/改写，不得大段复读原文；玩家偏离后的差异必须保留，并通过连续纠偏逐步接回原作吸引域。',
    };
}

const payload = {
    generatedAt: new Date().toISOString(),
    sourceRoot: usingCompactCorpus ? path.relative(projectRoot, corpusRoot) : path.relative(projectRoot, novelRoot),
    sourceMode: usingCompactCorpus ? 'compact-corpus' : 'raw-source',
    rawVaultBytes: Number(corpusMetadata.summary?.rawVaultBytes || 0),
    sourceChapterFiles: Number(corpusMetadata.summary?.chapterFiles || allTextFiles.length),
    arcs: Object.keys(references).length,
    maxSnippetChars: MAX_SNIPPET_CHARS,
    maxSummaryChars: MAX_SUMMARY_CHARS,
};

const generated = `// Generated by scripts/build-re0-canon-rag.mjs. Do not edit by hand.
export const canonRouteReferenceSummary = ${JSON.stringify(payload, null, 4)};
export const canonRouteReferenceByArc = ${JSON.stringify(references, null, 4)};
`;

fs.writeFileSync(outputPath, `${generated}\n`, 'utf8');
console.log(JSON.stringify(payload, null, 2));
