import assert from 'node:assert/strict';

import {
    RE0_HOST_CORE_MODULES,
    buildRe0HostAdapterBridge,
    summarizeRe0HostAdapterBridge,
    validateRe0HostAdapterBridge,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/re0-host-adapter.js';
import {
    buildRe0AgentTurn,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/re0-agent-module.js';

const state = {
    mode: 'main',
    current: {
        arc: 1,
        day: 1,
        time: '雨夜',
        location: '王都下层图书馆废室',
        viewpoint: '玩家',
        castIds: ['莉榭尔·阿尔戈', '菲鲁特'],
    },
    flags: {
        worldSessionId: 'host-adapter-save-001',
        playerIntentSceneLockLocation: '王都下层图书馆废室',
    },
    setup: {
        protagonistName: '陆临',
        origin: '现代图书管理员',
        ability: '目录残响',
        birthplace: '王都下层图书馆废室',
        initialScenario: '寄存簿脚印',
    },
    protagonistProfile: {
        name: '陆临',
        origin: '现代图书管理员',
        ability: '目录残响',
    },
    worldline: {
        id: 'HOST-BRIDGE-001',
        divergence: 0.41,
        attractor: '自由调查 / 王都下层',
        tree: {
            lastFailedNodeId: '',
        },
    },
    ifRouteLogic: {
        dominant: 'EnvyMain',
        routePressures: {},
    },
    gameplay: {
        activeObjective: '在王都下层图书馆废室核对寄存簿和禁书区脚印',
        objectiveStage: '王都下层图书馆废室 / 寄存簿脚印',
        lastPlayerAction: '我让莉榭尔记录书页编号，再请菲鲁特辨认寄存簿上的泥点。',
        openQuestions: ['寄存簿是否与徽章线有关？'],
        actionHints: ['核对寄存簿', '询问莉榭尔', '观察菲鲁特反应'],
        deathRisk: {},
    },
    discoveredClues: ['灰衣人在火灾前寄存木盒', '禁书区门缝有新鲜泥点'],
    characterCards: {
        '莉榭尔·阿尔戈': {
            name: '莉榭尔·阿尔戈',
            role: '原创调查同伴',
            trust: 22,
            suspicion: 5,
            memory: ['她记得玩家先检查寄存簿，而不是硬追原作徽章线。'],
        },
        '菲鲁特': {
            name: '菲鲁特',
            role: '徽章线索持有者',
            trust: 3,
            suspicion: 14,
            memory: ['玩家暂时没有追她，反而让她好奇。'],
        },
    },
    visuals: {
        sceneBackdrop: {
            currentKey: 'archive',
        },
        visualNovel: {
            sceneCharacters: ['莉榭尔·阿尔戈', '菲鲁特'],
            castIds: ['lishelle', 'felt'],
            currentSpeakerName: '莉榭尔·阿尔戈',
        },
    },
};

const turn = buildRe0AgentTurn(state, {
    rawText: state.gameplay.lastPlayerAction,
    source: 'custom',
    sceneLock: state.current.location,
}, {
    hostAdapter: {
        hostKind: 'sillytavern-extension',
    },
});

assert.equal(turn.hostBridge.version, 're0-host-adapter-bridge/v1');
assert.equal(turn.hostBridge.host.kind, 'sillytavern-extension');
assert.equal(turn.hostBridge.persistence.sessionId, 'host-adapter-save-001');
assert.deepEqual(Object.keys(turn.hostBridge.core.modules), RE0_HOST_CORE_MODULES);
assert.ok(turn.summaries.hostBridge.includes('HostAdapter'));
assert.equal(validateRe0HostAdapterBridge(turn.hostBridge).status, 'pass');

const standaloneBridge = buildRe0HostAdapterBridge(state, turn, {
    hostKind: 'standalone-web',
    targetHost: 'standalone-web',
});
const standaloneValidation = validateRe0HostAdapterBridge(standaloneBridge);
assert.equal(standaloneBridge.host.kind, 'standalone-web');
assert.equal(standaloneBridge.host.maturity, 'recommended-next');
assert.equal(standaloneBridge.persistence.primary, 'IndexedDB');
assert.equal(standaloneBridge.transport.localFallback, true);
assert.equal(standaloneValidation.status, 'pass');
assert.equal(standaloneValidation.readyForStandaloneShell, true);

const brokenBridge = {
    ...standaloneBridge,
    core: {
        ...standaloneBridge.core,
        modules: {
            ...standaloneBridge.core.modules,
            Worldline: 'missing',
        },
    },
    outboundCommands: standaloneBridge.outboundCommands.filter((command) => command.type !== 'persist-save'),
    security: {
        ...standaloneBridge.security,
        rendererCannotWriteProtectedRoots: false,
    },
};
const brokenValidation = validateRe0HostAdapterBridge(brokenBridge);
assert.equal(brokenValidation.status, 'block');
assert.ok(brokenValidation.findings.some((finding) => /Worldline/u.test(finding.title)));
assert.ok(brokenValidation.findings.some((finding) => /persist-save/u.test(finding.title)));
assert.ok(brokenValidation.findings.some((finding) => /渲染层/u.test(finding.title)));

const summary = summarizeRe0HostAdapterBridge(standaloneBridge, 900);
assert.ok(summary.includes('HostAdapter'));
assert.ok(summary.includes('standalone-web'));
assert.ok(summary.includes('IndexedDB'));
assert.ok(summary.length <= 900);

console.log(JSON.stringify({
    status: 'pass',
    currentHost: turn.hostBridge.host.kind,
    nextHost: standaloneBridge.host.kind,
    requiredModules: RE0_HOST_CORE_MODULES.length,
    commands: standaloneBridge.outboundCommands.length,
    brokenFindings: brokenValidation.findings.length,
}, null, 2));
