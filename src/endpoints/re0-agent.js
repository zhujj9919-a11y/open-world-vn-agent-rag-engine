import express from 'express';

import { SECRET_KEYS, readSecret } from './secrets.js';
import {
    buildRe0AgentTurn,
    summarizeRe0AgentTurn,
    validateRe0AgentTurn,
} from '../../public/scripts/extensions/third-party/re0-adventure-engine/data/re0-agent-module.js';

export const router = express.Router();

const MIMO_CHAT_URL = 'https://token-plan-cn.xiaomimimo.com/v1/chat/completions';
const DEFAULT_DIRECTOR_MODEL = 'mimo-v2.5-pro';
const DEFAULT_CRITIC_MODEL = 'mimo-v2.5';
const REQUEST_TIMEOUT_MS = 12000;

function compactText(value, limit = 1200) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= limit) {
        return text;
    }
    return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function safeJson(value, fallback = {}) {
    return value && typeof value === 'object' ? value : fallback;
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

function extractJsonObject(text) {
    const source = String(text || '').trim();
    const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : source;
    const first = candidate.indexOf('{');
    const last = candidate.lastIndexOf('}');
    if (first < 0 || last <= first) {
        throw new Error('No JSON object found in MiMo response.');
    }
    return JSON.parse(candidate.slice(first, last + 1));
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
            const error = new Error(payload?.error?.message || upstream.statusText || 'MiMo request failed.');
            error.status = upstream.status;
            error.detail = payload;
            throw error;
        }
        return {
            payload,
            text: messageContentToText(payload?.choices?.[0]?.message?.content)
                || messageContentToText(payload?.choices?.[0]?.message?.reasoning_content)
                || payload?.raw
                || '',
            usage: payload?.usage || null,
        };
    } finally {
        clearTimeout(timeout);
    }
}

function buildLocalAgentTurn(requestBody) {
    return buildRe0AgentTurn(
        safeJson(requestBody.state),
        safeJson(requestBody.playerAction),
        {
            storyRagWorkset: safeJson(requestBody.storyRagWorkset),
            contextWorkset: safeJson(requestBody.contextWorkset),
            assistantText: requestBody.assistantText || '',
            parsedVnScript: safeJson(requestBody.parsedVnScript, null),
            renderedBackdropKey: requestBody.renderedBackdropKey || requestBody.actualBackgroundKey || '',
            renderedCastIds: requestBody.renderedCastIds || requestBody.actualCastIds || [],
            statePatch: safeJson(requestBody.statePatch),
            candidates: Array.isArray(requestBody.candidates) ? requestBody.candidates : [],
        },
    );
}

function buildTurnPlanRequest(model, requestBody, localAgentTurn) {
    return {
        model,
        messages: [
            {
                role: 'system',
                content: [
                    '你是 Re:0 互动小说游戏的 Agent Director，不写正文，只输出严格 JSON object。',
                    '你的任务是审阅本地 AgentTurnPlan，并在不破坏当前存档事实的前提下补强导演计划。',
                    '规则：死亡回归只能作为玩家私有记忆；IF 是连续压力不是路线开关；原作行动复用因果功能，不复刻长原文；自由行动必须按世界逻辑推演。',
                    '输出字段必须包括 status, planPatch, risks, candidatePolicy, uiPlanPatch, assetPlanPatch, criticNotes。',
                ].join('\n'),
            },
            {
                role: 'user',
                content: JSON.stringify({
                    task: 'review_and_patch_agent_turn_plan',
                    localPlan: localAgentTurn.turnPlan,
                    worldContext: localAgentTurn.worldContext || localAgentTurn.turnPlan?.worldContext || null,
                    agentTurnSummary: summarizeRe0AgentTurn(localAgentTurn, 1400),
                    agentValidation: localAgentTurn.validation,
                    state: requestBody.state,
                    playerAction: requestBody.playerAction,
                    storyRagWorkset: requestBody.storyRagWorkset,
                    contextWorkset: requestBody.contextWorkset,
                }),
            },
        ],
        temperature: Number(requestBody.temperature ?? 0.35),
        top_p: Number(requestBody.top_p ?? 0.9),
        max_completion_tokens: Number(requestBody.max_completion_tokens ?? 1800),
        stream: false,
        thinking: { type: 'disabled' },
    };
}

function deterministicCritic(requestBody) {
    const plan = safeJson(requestBody.plan);
    const validation = validateRe0AgentTurn({
        state: safeJson(requestBody.stateBefore || requestBody.state),
        playerAction: safeJson(requestBody.playerAction),
        plan,
        assistantText: requestBody.assistantText || '',
        parsedVnScript: safeJson(requestBody.parsedVnScript, null),
        renderedBackdropKey: requestBody.renderedBackdropKey || requestBody.actualBackgroundKey || '',
        renderedCastIds: requestBody.renderedCastIds || requestBody.actualCastIds || [],
        statePatch: safeJson(requestBody.statePatch),
        candidates: Array.isArray(requestBody.candidates) ? requestBody.candidates : [],
    });
    const findings = (validation.findings || []).map((finding) => ({
        severity: finding.severity,
        title: finding.title,
        detail: finding.detail,
        module: finding.module,
        repairScope: finding.repairScope,
    }));
    return {
        status: findings.some((item) => item.severity === 'block') ? 'repair'
            : findings.length ? 'warn'
                : 'pass',
        findings,
        agentValidation: validation,
        localPatch: {},
    };
}

const CRITIC_STATUS_RANK = Object.freeze({
    pass: 0,
    warn: 1,
    repair: 2,
    regenerate: 3,
});

function normalizedCriticStatus(value) {
    const status = String(value || '').trim().toLowerCase();
    return Object.hasOwn(CRITIC_STATUS_RANK, status) ? status : 'repair';
}

function stricterCriticStatus(first, second) {
    const left = normalizedCriticStatus(first);
    const right = normalizedCriticStatus(second);
    return CRITIC_STATUS_RANK[left] >= CRITIC_STATUS_RANK[right] ? left : right;
}

function mergeCriticFindings(remoteFindings = [], localFindings = []) {
    const output = [];
    const seen = new Set();
    for (const finding of [
        ...(Array.isArray(localFindings) ? localFindings : []),
        ...(Array.isArray(remoteFindings) ? remoteFindings : []),
    ]) {
        if (!finding || typeof finding !== 'object') {
            continue;
        }
        const key = [
            finding.module || '',
            finding.severity || '',
            finding.title || '',
            finding.detail || '',
        ].join('::');
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        output.push(finding);
    }
    return output.slice(0, 32);
}

export function mergeRemoteCriticWithLocal(remoteCritic = {}, localCritic = {}) {
    const localValidationStatus = localCritic?.agentValidation?.status === 'block'
        ? 'repair'
        : localCritic?.status;
    return {
        ...(remoteCritic && typeof remoteCritic === 'object' ? remoteCritic : {}),
        status: stricterCriticStatus(remoteCritic?.status, localValidationStatus),
        findings: mergeCriticFindings(remoteCritic?.findings, localCritic?.findings),
        agentValidation: localCritic?.agentValidation || remoteCritic?.agentValidation || null,
        localPatch: localCritic?.agentValidation?.status === 'block'
            ? {}
            : safeJson(remoteCritic?.localPatch, safeJson(localCritic?.localPatch)),
        deterministicGate: {
            status: localCritic?.status || '',
            agentValidationStatus: localCritic?.agentValidation?.status || '',
            enforced: true,
        },
    };
}

function buildCriticRequest(model, requestBody, localCritic) {
    return {
        model,
        messages: [
            {
                role: 'system',
                content: [
                    '你是 Re:0 互动小说 Agent Critic，只输出严格 JSON object，不重写正文。',
                    '检查 assistantText 是否承接玩家行动、是否跳场景、是否泄露死亡回归、是否把 IF 写成路线开关、候选行动是否贴当前场景、VN_SCRIPT 素材 key 是否符合 assetPlan、TTS 是否应忽略系统文本。',
                    '输出字段：status(pass|warn|repair|regenerate), findings, localPatch, candidateRepairs, assetWarnings, ttsWarnings。',
                ].join('\n'),
            },
            {
                role: 'user',
                content: JSON.stringify({
                    task: 'critic_agent_turn_result',
                    localCritic,
                    plan: requestBody.plan,
                    stateBefore: requestBody.stateBefore,
                    assistantText: compactText(requestBody.assistantText, 6000),
                    parsedVnScript: requestBody.parsedVnScript,
                    statePatch: requestBody.statePatch,
                    candidates: requestBody.candidates,
                }),
            },
        ],
        temperature: Number(requestBody.temperature ?? 0.2),
        top_p: Number(requestBody.top_p ?? 0.85),
        max_completion_tokens: Number(requestBody.max_completion_tokens ?? 1200),
        stream: false,
        thinking: { type: 'disabled' },
    };
}

router.post('/turn-plan', async (request, response) => {
    try {
        const localAgentTurn = buildLocalAgentTurn(request.body || {});
        const localPlan = localAgentTurn.turnPlan;
        if (request.body.localOnly === true) {
            return response.json({
                plan: localPlan,
                agentTurn: localAgentTurn,
                agentValidation: localAgentTurn.validation,
                model: 'local-deterministic',
                fallback: true,
                usage: null,
            });
        }
        const apiKey = readSecret(request.user.directories, SECRET_KEYS.CUSTOM, request.body.secret_id);
        if (!apiKey) {
            return response.json({
                plan: localPlan,
                agentTurn: localAgentTurn,
                agentValidation: localAgentTurn.validation,
                model: 'local-deterministic',
                fallback: true,
                usage: null,
            });
        }

        const model = String(request.body.model || DEFAULT_DIRECTOR_MODEL);
        let result = null;
        try {
            result = await fetchMiMo(apiKey, buildTurnPlanRequest(model, request.body || {}, localAgentTurn), request.body.timeoutMs);
            const patch = extractJsonObject(result.text);
            const patchedPlan = {
                ...localPlan,
                mimoDirector: patch,
            };
            return response.json({
                plan: patchedPlan,
                agentTurn: {
                    ...localAgentTurn,
                    turnPlan: patchedPlan,
                },
                agentValidation: localAgentTurn.validation,
                model,
                fallback: false,
                usage: result.usage,
            });
        } catch (error) {
            return response.json({
                plan: localPlan,
                agentTurn: localAgentTurn,
                agentValidation: localAgentTurn.validation,
                model,
                fallback: true,
                error: error.message || 'MiMo turn planner failed.',
                raw: compactText(result?.text || '', 1600),
                usage: result?.usage || null,
            });
        }
    } catch (error) {
        console.error('Re:0 agent turn plan failed:', error);
        return response.status(error.status || 500).json({
            error: error.message || 'Re:0 agent turn plan failed.',
            detail: error.detail || null,
        });
    }
});

router.post('/critic', async (request, response) => {
    try {
        const localCritic = deterministicCritic(request.body || {});
        if (request.body.localOnly === true) {
            return response.json({ critic: localCritic, model: 'local-deterministic', fallback: true, usage: null });
        }
        const apiKey = readSecret(request.user.directories, SECRET_KEYS.CUSTOM, request.body.secret_id);
        if (!apiKey) {
            return response.json({ critic: localCritic, model: 'local-deterministic', fallback: true, usage: null });
        }

        const model = String(request.body.model || DEFAULT_CRITIC_MODEL);
        let result = null;
        try {
            result = await fetchMiMo(apiKey, buildCriticRequest(model, request.body || {}, localCritic), request.body.timeoutMs);
            return response.json({
                critic: mergeRemoteCriticWithLocal(extractJsonObject(result.text), localCritic),
                model,
                fallback: false,
                usage: result.usage,
            });
        } catch (error) {
            return response.json({
                critic: localCritic,
                model,
                fallback: true,
                error: error.message || 'MiMo critic failed.',
                raw: compactText(result?.text || '', 1600),
                usage: result?.usage || null,
            });
        }
    } catch (error) {
        console.error('Re:0 agent critic failed:', error);
        return response.status(error.status || 500).json({
            error: error.message || 'Re:0 agent critic failed.',
            detail: error.detail || null,
        });
    }
});
