#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { createGzip } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const projectRoot = path.resolve(import.meta.dirname, '..');
const novelRoot = process.env.RE0_NOVEL_SRC_ROOT
    ? path.resolve(process.env.RE0_NOVEL_SRC_ROOT)
    : path.resolve(projectRoot, '..', 're0_novel_src');
const webNovelRoot = path.join(novelRoot, 're0_web_novel_zh');
const storyDbRoot = path.join(novelRoot, 'story_database');
const outputRoot = path.join(projectRoot, 'data/default-user/re0-engine/rag/novel-corpus');
const sourceAssetsGeneratedPath = path.join(projectRoot, 'public/scripts/extensions/third-party/re0-adventure-engine/data/source-novel-assets.generated.js');

const MAX_DIGEST_CHARS = 360;
const MAX_SENTENCE_CHARS = 220;
const MAX_FACT_CHARS = 150;
const MAX_FACTS_PER_CHAPTER = 5;
const MAX_KEY_SENTENCES = 6;

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
    '玩家', '菜月昴', 'ナツキ', 'スバル', '爱蜜莉雅', '艾米莉娅', '帕克', '菲鲁特', '罗姆爷',
    '艾尔莎', '莱因哈鲁特', '蕾姆', '雷姆', '拉姆', '罗兹瓦尔', '碧翠丝', '贝蒂',
    '佩特拉', '弗雷德莉卡', '库珥修', '威尔海姆', '菲利斯', '安娜塔西亚', '尤里乌斯',
    '普莉希拉', '阿尔', '阿尔德巴兰', '奥托', '加菲尔', '艾姬多娜', '莎缇拉',
    '嫉妒魔女', '怠惰', '培提其乌斯', '白鲸', '雷古勒斯', '卡佩拉', '暴食',
    '路伊', '文森特', '托德', '坦萨', '斯芬克斯', '夏乌拉', '雷德', '莉榭尔', '剥钟人',
];

const locationTerms = [
    '王都', '赃物库', '盗品蔵', '水果摊', '贫民区', '小巷', '罗兹瓦尔宅邸', '宅邸',
    '阿拉姆村', '禁书库', '森林', '库珥修宅邸', '白鲸', '魔女教', '圣域', '墓所',
    '水门都市', '普里斯提拉', '普雷阿迪斯监视塔', '监视塔', '佛拉基亚',
    '吉努恩海芬', '王城', '废弃钟楼', '世界线树',
];

const worldEssenceTerms = [
    '400年前', '四百年前', '嫉妒魔女', '魔女因子', '权能', '神龙', '贤者', '初代剑圣',
    '奥德拉格纳', '奥德', '福音书', '睿智之书', '死亡回归', '影之庭园', '大瀑布',
    '封印', '圣域', '试炼', '名字', '记忆', '灵魂', '龙血', '王选',
];

const causalTerms = [
    '因为', '所以', '于是', '导致', '结果', '代价', '目的', '契约', '诅咒', '死亡',
    '复活', '重置', '失败', '成功', '拯救', '牺牲', '选择', '背叛', '误会', '证据',
    '预言', '交易', '同盟', '阵营', '怀疑', '信任', '记忆', '名字', '权能',
    '魔女', '魔女教', '收束',
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

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function sha1(value) {
    return crypto.createHash('sha1').update(value).digest('hex');
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
    return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
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
        && !/完整合集|合并版|scrape_record|progress|后记|译者|篇章插图/u.test(name);
}

function sourceRelativePath(file) {
    return path.relative(novelRoot, file).split(path.sep).join('/');
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

function titleFromPath(relativePath) {
    const base = path.basename(relativePath, path.extname(relativePath));
    const cleaned = base.replace(/^第\d+章[_\s]*/u, '').replace(/^\d+\s*/u, '').trim();
    return compactText(cleaned || base, 90);
}

function chapterNumberFromPath(relativePath) {
    const match = relativePath.match(/第(\d+)章/u);
    return match ? match[1] : '';
}

function extractTerms(text, terms, limit = 14) {
    return terms.filter((term) => text.includes(term)).slice(0, limit);
}

function sentenceList(raw) {
    return String(raw || '')
        .replace(/\r/g, '\n')
        .split(/(?<=[。！？!?」』])\s*|\n+/u)
        .map((line) => compactText(line, MAX_SENTENCE_CHARS))
        .filter((line) => line.length >= 14 && !/^第?\d+章?$/u.test(line))
        .slice(0, 2400);
}

function sentenceCausalScore(sentence) {
    const essence = extractTerms(sentence, worldEssenceTerms, 12).length * 8;
    const causal = extractTerms(sentence, causalTerms, 16).length * 4;
    const character = extractTerms(sentence, characterTerms, 12).length * 2;
    const location = extractTerms(sentence, locationTerms, 8).length * 2;
    const lengthBonus = sentence.length >= 28 && sentence.length <= 180 ? 2 : 0;
    return essence + causal + character + location + lengthBonus;
}

function selectKeySentences(sentences) {
    const ranked = sentences
        .map((sentence, index) => ({ sentence, index, score: sentenceCausalScore(sentence) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, MAX_KEY_SENTENCES)
        .sort((a, b) => a.index - b.index)
        .map((entry) => entry.sentence);
    const edges = [
        sentences[0],
        sentences[Math.floor(sentences.length / 2)],
        sentences[sentences.length - 1],
    ].filter(Boolean);
    return [...new Set([...ranked, ...edges])].slice(0, MAX_KEY_SENTENCES);
}

function chapterKeywords(relativePath, text) {
    const route = inferIfRoute(relativePath, text);
    return [
        titleFromPath(relativePath),
        ...extractTerms(text, characterTerms, 14),
        ...extractTerms(text, locationTerms, 12),
        ...extractTerms(text, worldEssenceTerms, 12),
        ...extractTerms(text, causalTerms, 10),
        route,
    ].filter(Boolean).slice(0, 32);
}

function buildChapterRecord(file, raw) {
    const relativePath = sourceRelativePath(file);
    const sourceType = inferSourceType(relativePath);
    const arc = inferArcFromRelative(relativePath);
    const routeId = inferIfRoute(relativePath, raw);
    const sentences = sentenceList(raw);
    const keySentences = selectKeySentences(sentences);
    const keywords = chapterKeywords(relativePath, raw);
    const causalTier = extractTerms(raw, worldEssenceTerms, 1).length ? 'world-essence' : (routeId ? 'if-attractor' : 'chapter-causal');
    const rankedFacts = sentences
        .map((sentence, index) => ({ sentence, index, score: sentenceCausalScore(sentence) }))
        .filter((entry) => entry.score >= 8)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, MAX_FACTS_PER_CHAPTER);
    const base = {
        id: `chapter-${sha1(relativePath).slice(0, 16)}`,
        sourcePath: relativePath,
        sourceType,
        canonLevel: inferCanonLevel(sourceType),
        arc,
        chapter: chapterNumberFromPath(relativePath),
        scene: titleFromPath(relativePath),
        routeId,
        causalTier,
        characters: extractTerms(raw, characterTerms, 18),
        locations: extractTerms(raw, locationTerms, 14),
        events: extractTerms(raw, causalTerms, 14),
        keywords,
        digest: compactText([titleFromPath(relativePath), ...keySentences].filter(Boolean).join(' '), MAX_DIGEST_CHARS),
        keySentences,
        sourceIds: [relativePath],
        rawChars: raw.length,
        rawSha1: sha1(raw),
    };
    const facts = rankedFacts.map((entry, index) => ({
        id: `${base.id}-fact-${index + 1}`,
        chunkId: base.id,
        arc: base.arc,
        canonLevel: base.canonLevel,
        subject: base.scene || `Arc ${base.arc}`,
        predicate: base.causalTier === 'world-essence' ? 'anchors_world_rule' : (base.routeId ? 'anchors_if_route' : 'observes_causal_event'),
        object: compactText(entry.sentence, MAX_FACT_CHARS),
        certainty: base.canonLevel === 'official' ? 0.88 : 0.78,
        causalTier: base.causalTier,
        routeId: base.routeId,
        keywords: base.keywords,
        scoreHint: entry.score,
        sourcePath: base.sourcePath,
    }));
    return { ...base, facts };
}

function buildStoryDbRecord(file, raw) {
    const relativePath = sourceRelativePath(file);
    const arc = inferArcFromRelative(relativePath);
    const routeId = inferIfRoute(relativePath, raw);
    const base = {
        id: `storydb-${sha1(relativePath).slice(0, 16)}`,
        sourcePath: relativePath,
        sourceType: 'story_database',
        canonLevel: 'official_summary',
        arc,
        chapter: '',
        scene: titleFromPath(relativePath),
        routeId,
        causalTier: 'arc-structure',
        characters: extractTerms(raw, characterTerms, 18),
        locations: extractTerms(raw, locationTerms, 14),
        events: extractTerms(raw, causalTerms, 14),
        keywords: chapterKeywords(relativePath, raw),
        digest: compactText(raw, MAX_DIGEST_CHARS),
        keySentences: selectKeySentences(sentenceList(raw)),
        sourceIds: [relativePath],
        rawChars: raw.length,
        rawSha1: sha1(raw),
    };
    const fact = {
        id: `${base.id}-fact-1`,
        chunkId: base.id,
        arc: base.arc,
        canonLevel: base.canonLevel,
        subject: base.scene || `Arc ${base.arc}`,
        predicate: 'summarizes_arc_causality',
        object: compactText(base.digest, MAX_FACT_CHARS),
        certainty: 0.86,
        causalTier: base.causalTier,
        routeId: base.routeId,
        keywords: base.keywords,
        sourcePath: base.sourcePath,
    };
    return { ...base, facts: [fact] };
}

async function writeRawVault(records) {
    const vaultPath = path.join(outputRoot, 'chapter-vault.jsonl.gz');
    const gzip = createGzip({ level: 9 });
    const output = fs.createWriteStream(vaultPath);
    gzip.pipe(output);
    for (const record of records) {
        const line = `${JSON.stringify(record)}\n`;
        if (!gzip.write(line)) {
            await once(gzip, 'drain');
        }
    }
    gzip.end();
    await once(output, 'finish');
    return vaultPath;
}

function writeJsonl(fileName, records) {
    fs.writeFileSync(path.join(outputRoot, fileName), `${records.map((record) => JSON.stringify(record)).join('\n')}\n`, 'utf8');
}

async function loadSourceNovelAssets() {
    if (!fs.existsSync(sourceAssetsGeneratedPath)) {
        return {
            summary: { totalAssets: 0 },
            assets: [],
            characterMap: {},
            sceneMap: {},
        };
    }
    const module = await import(pathToFileURL(sourceAssetsGeneratedPath).href);
    return {
        summary: module.sourceNovelAssetSummary || {},
        assets: module.sourceNovelAssets || [],
        characterMap: module.sourceNovelCharacterImageMap || {},
        sceneMap: module.sourceNovelSceneImageMap || {},
    };
}

function corpusExists() {
    return fs.existsSync(path.join(outputRoot, 'metadata.json'))
        && fs.existsSync(path.join(outputRoot, 'chapter-digests.jsonl'))
        && fs.existsSync(path.join(outputRoot, 'chapter-vault.jsonl.gz'));
}

async function main() {
    ensureDir(outputRoot);
    if (!fs.existsSync(webNovelRoot)) {
        if (!corpusExists()) {
            throw new Error(`re0_novel_src is missing and no compact corpus exists at ${outputRoot}`);
        }
        const metadata = JSON.parse(fs.readFileSync(path.join(outputRoot, 'metadata.json'), 'utf8'));
        console.log(JSON.stringify({
            status: 'existing-corpus',
            outputRoot: path.relative(projectRoot, outputRoot),
            ...metadata.summary,
        }, null, 2));
        return;
    }

    const textFiles = walkFiles(webNovelRoot, shouldIndexTextFile).sort();
    const storyDbFiles = walkFiles(storyDbRoot, (file) => /\.(md|json|txt)$/u.test(file)).sort();
    const chapterRecords = [];
    const storyDbRecords = [];
    const factRecords = [];
    const vaultRecords = [];

    for (const file of textFiles) {
        const raw = fs.readFileSync(file, 'utf8');
        const record = buildChapterRecord(file, raw);
        chapterRecords.push(record);
        factRecords.push(...record.facts);
        vaultRecords.push({
            id: record.id,
            sourcePath: record.sourcePath,
            sourceType: record.sourceType,
            canonLevel: record.canonLevel,
            arc: record.arc,
            chapter: record.chapter,
            scene: record.scene,
            routeId: record.routeId,
            rawSha1: record.rawSha1,
            rawChars: record.rawChars,
            text: raw,
        });
    }

    for (const file of storyDbFiles) {
        const raw = fs.readFileSync(file, 'utf8');
        const record = buildStoryDbRecord(file, raw);
        storyDbRecords.push(record);
        factRecords.push(...record.facts);
    }

    const chapterIndex = chapterRecords.map((record) => ({
        id: record.id,
        sourcePath: record.sourcePath,
        sourceType: record.sourceType,
        canonLevel: record.canonLevel,
        arc: record.arc,
        chapter: record.chapter,
        scene: record.scene,
        routeId: record.routeId,
        causalTier: record.causalTier,
        characters: record.characters,
        locations: record.locations,
        events: record.events,
        keywords: record.keywords,
        rawChars: record.rawChars,
        rawSha1: record.rawSha1,
    }));
    const rawVaultPath = await writeRawVault(vaultRecords);
    const sourceAssets = await loadSourceNovelAssets();
    const metadata = {
        version: 're0-novel-corpus/v1',
        generatedAt: new Date().toISOString(),
        sourceRoot: path.relative(projectRoot, novelRoot),
        outputRoot: path.relative(projectRoot, outputRoot),
        policy: {
            rawVault: 'chapter-vault.jsonl.gz stores full chapter text for offline retrieval/rebuild only; never inject the full vault into prompt or Codex context.',
            runtime: 'Runtime RAG imports generated compact chunks/facts and retrieves a small workset per turn.',
            sourceRetirement: 'After this corpus and source-novel assets are verified, re0_novel_src can be moved outside the active workspace.',
        },
        limits: {
            maxDigestChars: MAX_DIGEST_CHARS,
            maxSentenceChars: MAX_SENTENCE_CHARS,
            maxFactChars: MAX_FACT_CHARS,
            maxFactsPerChapter: MAX_FACTS_PER_CHAPTER,
        },
        summary: {
            chapterFiles: chapterRecords.length,
            storyDatabaseFiles: storyDbRecords.length,
            causalFacts: factRecords.length,
            rawVaultBytes: fs.statSync(rawVaultPath).size,
            rawTextChars: chapterRecords.reduce((sum, record) => sum + Number(record.rawChars || 0), 0),
            sourceNovelAssets: sourceAssets.summary?.totalAssets || sourceAssets.assets.length,
            sourceNovelCharacters: Object.keys(sourceAssets.characterMap || {}).length,
            sourceNovelScenes: Object.keys(sourceAssets.sceneMap || {}).length,
        },
    };

    fs.writeFileSync(path.join(outputRoot, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');
    fs.writeFileSync(path.join(outputRoot, 'chapter-index.json'), JSON.stringify(chapterIndex, null, 2), 'utf8');
    writeJsonl('chapter-digests.jsonl', chapterRecords);
    writeJsonl('storydb-digests.jsonl', storyDbRecords);
    writeJsonl('causal-facts.jsonl', factRecords);
    fs.writeFileSync(path.join(outputRoot, 'illustration-index.json'), JSON.stringify({
        generatedAt: metadata.generatedAt,
        sourceNovelAssetSummary: sourceAssets.summary,
        characterMap: sourceAssets.characterMap,
        sceneMap: sourceAssets.sceneMap,
        assets: sourceAssets.assets,
    }, null, 2), 'utf8');
    fs.writeFileSync(path.join(outputRoot, 'README.md'), [
        '# Re:0 Novel Corpus',
        '',
        'This directory is the compact, source-retirement-safe corpus for the Re:0 open-world VN engine.',
        '',
        '- `chapter-vault.jsonl.gz`: full chapter text, compressed, for offline retrieval/rebuild only.',
        '- `chapter-digests.jsonl`: compact chapter RAG chunks with summaries, key sentences, terms, and facts.',
        '- `causal-facts.jsonl`: extracted causal/world/IF facts used by Story RAG builders.',
        '- `storydb-digests.jsonl`: compact hand-authored arc summaries and outlines.',
        '- `illustration-index.json`: source-novel image registry already copied into runtime assets.',
        '',
        'Do not attach or paste the raw vault into Codex or model prompts. Runtime generation must retrieve a bounded workset.',
        '',
        `Generated: ${metadata.generatedAt}`,
        `Chapters: ${metadata.summary.chapterFiles}`,
        `Story DB files: ${metadata.summary.storyDatabaseFiles}`,
        `Causal facts: ${metadata.summary.causalFacts}`,
        `Raw vault bytes: ${metadata.summary.rawVaultBytes}`,
        `Source novel assets: ${metadata.summary.sourceNovelAssets}`,
        '',
    ].join('\n'), 'utf8');

    console.log(JSON.stringify({
        status: 'built',
        outputRoot: metadata.outputRoot,
        ...metadata.summary,
    }, null, 2));
}

await main();
