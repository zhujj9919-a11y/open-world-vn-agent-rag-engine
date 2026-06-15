import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
    extractVisualNovelScriptBlock,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/vn-script.js';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const USER_ROOT = path.join(PROJECT_ROOT, 'data/default-user');
const QA_DIR = path.join(USER_ROOT, 're0-engine/collab/inbox/qa');
const MIMO_CHAT_URL = process.env.RE0_MIMO_URL || 'https://token-plan-cn.xiaomimimo.com/v1/chat/completions';
const CUSTOM_SECRET_KEY = 'api_key_custom';
const MODELS = String(process.env.RE0_MIMO_BENCH_MODELS || 'mimo-v2.5,mimo-v2.5-pro')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
const TOKEN_BUDGETS = String(process.env.RE0_MIMO_BENCH_TOKENS || '900,1400')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
const REPEATS = Math.max(1, Math.min(3, Number(process.env.RE0_MIMO_BENCH_REPEATS || 1)));
const TEMPERATURE = Number(process.env.RE0_MIMO_BENCH_TEMP || 0.55);
const TOP_P = Number(process.env.RE0_MIMO_BENCH_TOP_P || 0.9);
const TIMEOUT_MS = Number(process.env.RE0_MIMO_BENCH_TIMEOUT_MS || 120_000);

function nowStamp() {
    return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/u, '').replace('T', '-');
}

function compactText(value = '', limit = 240) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function assertLiveSecret() {
    const secretsPath = path.join(USER_ROOT, 'secrets.json');
    if (!fs.existsSync(secretsPath)) {
        throw new Error('Missing data/default-user/secrets.json; live MiMo benchmark cannot run without the configured API key.');
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
        throw new Error('Missing active api_key_custom in data/default-user/secrets.json.');
    }
    return apiKey;
}

function benchmarkMessages() {
    const payload = {
        scenarioId: 'bench-arc1-open-world-director',
        playerAction: '【原作行动】我在王都雨夜先确认徽章交易、贫民区目击者和银发少女的去向，但允许根据当前证据做开放世界推演。',
        state: {
            arc: 1,
            location: '王都贫民区 / 盗品蔵外',
            storyMode: 'mainline',
            worldlineDivergence: 0.041,
            currentObjective: '确认徽章、菲鲁特、艾尔莎袭击和爱蜜莉雅失物之间的因果链。',
            sceneCharacters: ['主角', '菲鲁特', '罗姆爷', '爱蜜莉雅'],
            saveMemory: ['玩家选择原作行动，但允许提前询问交易细节。'],
            deathMemory: [],
        },
        ragWorkset: {
            canonFacts: [
                '徽章失窃把主角、菲鲁特、罗姆爷、爱蜜莉雅与艾尔莎的行动线拉到同一地点。',
                '原作吸引点不是强制复刻台词，而是维持“失物、交易、袭击、救援”的因果压力。',
            ],
            worldRules: [
                '死亡回归只属于主角私有记忆，不能被 NPC 直接知道。',
                '自由行动可以改变事件顺序，但必须给出可观察后果和新的选择压力。',
            ],
            assetMemory: [
                '可用背景 key: loot_house, rain_bell, capital_slum_night。',
                '可用角色: emilia, felt, rom, protagonist。',
            ],
        },
    };
    return [
        {
            role: 'system',
            content: [
                '你是开放世界视觉小说的剧情导演，不是聊天助手。',
                '目标：基于 Re:0 原作因果逻辑推演当前行动，同时保持开放世界自由度。',
                '输出必须先给玩家可见小说正文，再给隐藏 RE0_VN_SCRIPT JSON；首个非空字符必须是中文小说正文，绝不能是 <、{、`。',
                '可见小说正文控制在 260-450 个中文字符，写完后立刻输出隐藏台本；不要把 token 全花在正文。',
                '隐藏台本必须用唯一格式：<!-- RE0_VN_SCRIPT {"version":"vn60",...} -->。',
                '禁止使用普通 Markdown ```json 代码块承载台本；禁止写“隐藏台本：”标题。',
                '如果 token 紧张，优先保证 HTML 注释里的 RE0_VN_SCRIPT JSON 完整可解析。',
                '本轮 deathMemory 为空，可见正文禁止出现“循环、死亡回归、上一轮、我死过、预知”等私有机制词。',
                '正文要有行动落地、过渡、人物对话、旁白和选择压力，不要流水账。',
                '隐藏台本必须包含 backgroundKey、cast、segments、choices、beat.progressDelta。',
                'segments 推荐正好 5 个，允许 4-6 个；choices 控制在 4-6 个。',
                '台本 JSON 最小结构：{"version":"vn60","backgroundKey":"loot_house","cast":["protagonist","felt"],"segments":[{"type":"narration","speakerId":"narrator","speakerName":"世界意志","text":"..."},{"type":"dialogue","speakerId":"felt","speakerName":"菲鲁特","text":"..."}],"choices":["..."],"beat":{"progressDelta":["new_clue"]}}。',
                '不要把系统说明、RAG、JSON 字段名泄漏进可见正文。',
            ].join('\n'),
        },
        {
            role: 'user',
            content: JSON.stringify(payload),
        },
    ];
}

async function callMimo(apiKey, { model, maxTokens }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const startedAt = Date.now();
    const body = {
        model,
        messages: benchmarkMessages(),
        temperature: TEMPERATURE,
        top_p: TOP_P,
        max_completion_tokens: maxTokens,
        stream: false,
        thinking: { type: 'disabled' },
    };
    try {
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
        const elapsedMs = Date.now() - startedAt;
        if (!response.ok) {
            return {
                model,
                maxTokens,
                status: 'error',
                elapsedMs,
                error: compactText(payload?.error?.message || payload?.raw || response.statusText, 900),
            };
        }
        const message = payload?.choices?.[0]?.message || {};
        const text = typeof message.content === 'string'
            ? message.content
            : (typeof message.reasoning_content === 'string' ? message.reasoning_content : '');
        return evaluateResult({
            model: payload?.model || model,
            requestedModel: model,
            maxTokens,
            elapsedMs,
            usage: payload?.usage || null,
            text,
        });
    } catch (error) {
        return {
            model,
            maxTokens,
            status: 'error',
            elapsedMs: Date.now() - startedAt,
            error: compactText(error?.message || String(error), 900),
        };
    } finally {
        clearTimeout(timeout);
    }
}

function evaluateResult(result) {
    const extracted = extractVisualNovelScriptBlock(result.text || {});
    const script = extracted.script || null;
    const segments = Array.isArray(script?.segments) ? script.segments : [];
    const choices = Array.isArray(script?.choices) ? script.choices : [];
    const visibleText = String(extracted.narrative || result.text || '');
    const findings = [];
    if (!script) {
        findings.push('missing-vn-script');
    }
    if (segments.length < 4 || segments.length > 6) {
        findings.push(`segment-count-${segments.length}`);
    }
    if (choices.length < 4 || choices.length > 6) {
        findings.push(`choice-count-${choices.length}`);
    }
    if (!script?.backgroundKey) {
        findings.push('missing-background-key');
    }
    if (!Array.isArray(script?.cast) || script.cast.length < 2) {
        findings.push('weak-cast');
    }
    if (!Array.isArray(script?.beat?.progressDelta) || script.beat.progressDelta.length < 1) {
        findings.push('missing-progress-delta');
    }
    if (/RE0_VN_SCRIPT|backgroundKey|progressDelta|segments|choices/u.test(visibleText)) {
        findings.push('visible-meta-leak');
    }
    if (/世界意志[：:]\s*[「『“"]/u.test(visibleText)) {
        findings.push('narrator-dialogue-leak');
    }
    return {
        ...result,
        status: findings.length ? 'warn' : 'pass',
        outputChars: String(result.text || '').length,
        visibleChars: visibleText.length,
        sourceMode: extracted.sourceMode,
        segmentCount: segments.length,
        choiceCount: choices.length,
        backgroundKey: script?.backgroundKey || '',
        cast: Array.isArray(script?.cast) ? script.cast.slice(0, 8) : [],
        findings,
    };
}

function summarize(results) {
    const rows = results.map((item) => ({
        model: item.requestedModel || item.model,
        maxTokens: item.maxTokens,
        status: item.status,
        elapsedMs: item.elapsedMs,
        outputChars: item.outputChars || 0,
        segmentCount: item.segmentCount || 0,
        choiceCount: item.choiceCount || 0,
        findings: item.findings || (item.error ? [item.error] : []),
    }));
    const passRows = rows.filter((item) => item.status === 'pass');
    const fastestPass = [...passRows].sort((a, b) => a.elapsedMs - b.elapsedMs)[0] || null;
    return {
        generatedAt: new Date().toISOString(),
        endpoint: MIMO_CHAT_URL.replace(/\/chat\/completions$/u, '/chat/completions'),
        temperature: TEMPERATURE,
        top_p: TOP_P,
        thinking: 'disabled',
        repeats: REPEATS,
        rows,
        fastestPass,
    };
}

function writeReport(summary, results) {
    fs.mkdirSync(QA_DIR, { recursive: true });
    const stamp = nowStamp();
    const jsonPath = path.join(QA_DIR, `RE0_MIMO_MODEL_BENCHMARK_${stamp}.json`);
    const mdPath = path.join(QA_DIR, `RE0_MIMO_MODEL_BENCHMARK_${stamp}.md`);
    fs.writeFileSync(jsonPath, JSON.stringify({ ...summary, results }, null, 2));
    const lines = [
        '# Re:0 MiMo Model Benchmark',
        '',
        `- generatedAt: ${summary.generatedAt}`,
        `- temperature: ${summary.temperature}`,
        `- top_p: ${summary.top_p}`,
        `- thinking: ${summary.thinking}`,
        '',
        '| model | maxTokens | status | elapsedMs | outputChars | segments | choices | findings |',
        '|---|---:|---|---:|---:|---:|---:|---|',
        ...summary.rows.map((row) => `| ${row.model} | ${row.maxTokens} | ${row.status} | ${row.elapsedMs} | ${row.outputChars} | ${row.segmentCount} | ${row.choiceCount} | ${(row.findings || []).join(', ') || '-'} |`),
        '',
        summary.fastestPass
            ? `Fastest pass: ${summary.fastestPass.model} @ ${summary.fastestPass.maxTokens} tokens in ${summary.fastestPass.elapsedMs}ms.`
            : 'Fastest pass: none.',
        '',
    ];
    fs.writeFileSync(mdPath, lines.join('\n'));
    return { jsonPath, mdPath };
}

async function main() {
    if (!MODELS.length || !TOKEN_BUDGETS.length) {
        throw new Error('No benchmark models or token budgets configured.');
    }
    const apiKey = assertLiveSecret();
    const results = [];
    for (const model of MODELS) {
        for (const maxTokens of TOKEN_BUDGETS) {
            for (let i = 0; i < REPEATS; i += 1) {
                console.log(`[mimo-bench] ${model} maxTokens=${maxTokens} repeat=${i + 1}/${REPEATS}`);
                results.push(await callMimo(apiKey, { model, maxTokens }));
            }
        }
    }
    const summary = summarize(results);
    const paths = writeReport(summary, results);
    console.log(JSON.stringify({
        status: summary.rows.every((row) => row.status !== 'error') ? 'done' : 'done-with-errors',
        fastestPass: summary.fastestPass,
        reports: paths,
    }, null, 2));
}

await main();
