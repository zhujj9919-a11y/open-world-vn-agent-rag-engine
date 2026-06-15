import assert from 'node:assert/strict';
import http from 'node:http';

import express from 'express';

import {
    retrieveStoryRagWorkset,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/story-rag.js';
import {
    setConfigFilePath,
} from '../src/util.js';

setConfigFilePath('tests/config.yaml');
const {
    mergeRemoteCriticWithLocal,
    router: re0AgentRouter,
} = await import('../src/endpoints/re0-agent.js');

function stateForArc(arc, overrides = {}) {
    return {
        current: {
            arc,
            day: arc * 100,
            time: '深夜',
            location: overrides.location || '未知地点',
            viewpoint: '玩家',
            castIds: overrides.characters || [],
        },
        flags: {
            worldSessionId: overrides.worldSessionId || `endpoint-agent-session-${arc}`,
        },
        worldline: {
            id: overrides.worldlineId || `ENDPOINT-ARC-${arc}`,
            divergence: overrides.divergence ?? 0.08,
            attractor: '嫉妒/主线',
        },
        ifRouteLogic: {
            dominant: overrides.dominant || 'EnvyMain',
            routePressures: {},
        },
        gameplay: {
            activeObjective: overrides.objective || '',
            objectiveStage: overrides.stage || '',
            lastPlayerAction: overrides.action || '',
            deathRisk: {},
        },
        discoveredClues: overrides.clues || [],
        characterCards: Object.fromEntries((overrides.characters || []).map((name) => [name, { name }])),
        visuals: {
            visualNovel: {
                sceneCharacters: overrides.characters || [],
                currentSpeakerName: overrides.speaker || '',
            },
        },
    };
}

async function startServer() {
    const app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use((request, _response, next) => {
        request.user = { directories: { root: process.cwd() } };
        next();
    });
    app.use('/api/re0-agent', re0AgentRouter);
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    return {
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((resolve) => server.close(resolve)),
    };
}

async function postJson(baseUrl, path, body) {
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const json = await response.json();
    assert.equal(response.ok, true, JSON.stringify(json));
    return json;
}

const server = await startServer();
try {
    const canonState = stateForArc(1, {
        location: '王都赃物库',
        objective: '按原作线确认徽章流向',
        characters: ['爱蜜莉雅', '菲鲁特', '罗姆爷'],
        action: '【原作线】按原作因果链确认徽章流向，但保留当前存档差异。',
        speaker: '爱蜜莉雅',
    });
    const storyRagWorkset = retrieveStoryRagWorkset(canonState, canonState.gameplay.lastPlayerAction);
    const turnPlan = await postJson(server.baseUrl, '/api/re0-agent/turn-plan', {
        localOnly: true,
        state: canonState,
        playerAction: {
            rawText: canonState.gameplay.lastPlayerAction,
            source: 'choice',
            sceneLock: canonState.current.location,
        },
        storyRagWorkset,
        contextWorkset: {
            hot: [{ id: 'objective', title: '当前目标', summary: canonState.gameplay.activeObjective, priority: 0, band: 'hot' }],
            warm: [],
        },
    });
    assert.equal(turnPlan.fallback, true);
    assert.equal(turnPlan.model, 'local-deterministic');
    assert.equal(turnPlan.plan.routing.mode, 'canon-follow');
    assert.equal(turnPlan.plan.routing.ttsModel, 'mimo-v2.5-tts');
    assert.equal(turnPlan.plan.assetPlan.selectedBackdrop.key, 'loot_house');
    assert.equal(turnPlan.agentTurn.version, 're0-agent-turn/v1');
    assert.equal(turnPlan.agentTurn.turnPlan.turnId, turnPlan.plan.turnId);
    assert.equal(turnPlan.agentTurn.storyRag.actionMode, 'canon-follow');
    assert.equal(turnPlan.agentTurn.moduleStatus.StoryRAG, 'available');
    assert.equal(turnPlan.agentTurn.moduleStatus.NarrativeDirector, 'available');
    assert.equal(turnPlan.agentTurn.narrativeDirector.scope.routeMode, 'canon-attractor');
    assert.ok(turnPlan.plan.narrativeDirector.promptDirectives.some((item) => /玩家行动|第一拍/u.test(item)));
    assert.equal(turnPlan.agentTurn.ttsPlan.model, 'mimo-v2.5-tts');
    assert.equal(turnPlan.agentValidation.status, 'pass');

    const critic = await postJson(server.baseUrl, '/api/re0-agent/critic', {
        localOnly: true,
        plan: turnPlan.plan,
        assistantText: '我向所有人公开死亡回归，并说我死后会重置。',
        parsedVnScript: null,
        statePatch: {},
        candidates: [],
    });
    assert.equal(critic.fallback, true);
    assert.equal(critic.model, 'local-deterministic');
    assert.equal(critic.critic.status, 'repair');
    assert.equal(critic.critic.agentValidation.status, 'block');
    assert.ok(critic.critic.findings.some((finding) => /死亡回归/u.test(finding.title) || /死亡回归/u.test(finding.detail)));

    const assetCritic = await postJson(server.baseUrl, '/api/re0-agent/critic', {
        localOnly: true,
        plan: turnPlan.plan,
        assistantText: canonState.gameplay.lastPlayerAction,
        parsedVnScript: {
            backgroundKey: 'market_day',
            castIds: ['emilia', 'felt'],
        },
        statePatch: {},
        candidates: [],
    });
    assert.equal(assetCritic.fallback, true);
    assert.equal(assetCritic.critic.status, 'warn');
    assert.equal(assetCritic.critic.agentValidation.status, 'repair');
    assert.ok(assetCritic.critic.findings.some((finding) => /背景素材与场景计划不一致/u.test(finding.title)));

    const mergedRemoteCritic = mergeRemoteCriticWithLocal({
        status: 'pass',
        findings: [],
        localPatch: {
            statePatch: {
                worldline: { divergence: 0.99 },
            },
        },
    }, critic.critic);
    assert.equal(mergedRemoteCritic.status, 'repair');
    assert.equal(mergedRemoteCritic.agentValidation.status, 'block');
    assert.equal(Object.keys(mergedRemoteCritic.localPatch).length, 0);
    assert.equal(mergedRemoteCritic.deterministicGate.enforced, true);
    assert.ok(mergedRemoteCritic.findings.some((finding) => /死亡回归/u.test(finding.title) || /死亡回归/u.test(finding.detail)));

    console.log(JSON.stringify({
        status: 'pass',
        turnPlanMode: turnPlan.plan.routing.mode,
        agentTurnVersion: turnPlan.agentTurn.version,
        ttsModel: turnPlan.plan.routing.ttsModel,
        criticStatus: critic.critic.status,
        assetCriticStatus: assetCritic.critic.status,
    }, null, 2));
} finally {
    await server.close();
}
