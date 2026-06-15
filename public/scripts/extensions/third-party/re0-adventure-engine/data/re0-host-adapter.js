const DEFAULT_SUMMARY_LIMIT = 1000;

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function compactText(value, limit = 140) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= limit) {
        return text;
    }
    return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function unique(values, limit = 16) {
    return [...new Set(asArray(values).filter(Boolean).map(String))].slice(0, limit);
}

function stableHash(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

export const RE0_HOST_CORE_MODULES = Object.freeze([
    'StoryRAG',
    'NarrativeDirector',
    'SaveMemory',
    'Worldline',
    'CharacterMemory',
    'AssetDirector',
    'VNRenderer',
    'TTSDirector',
    'Evaluator',
]);

export const RE0_HOST_PROFILES = Object.freeze({
    'sillytavern-extension': {
        label: 'SillyTavern Extension Host',
        maturity: 'current-production',
        shell: 'browser-extension-panel',
        persistence: 'chatMetadata + extension_settings + data/default-user files',
        transport: 'in-process JS + local Express endpoints',
        packaging: 'SillyTavern extension',
        strengths: ['fast iteration', 'existing E2E coverage', 'current save compatibility'],
        tradeoffs: ['host UI constraints', 'desktop packaging depends on SillyTavern'],
    },
    'standalone-web': {
        label: 'Standalone Web Runtime',
        maturity: 'recommended-next',
        shell: 'web app',
        persistence: 'IndexedDB + import/export packets + optional local endpoint',
        transport: 'HTTP/SSE/WebSocket adapter to re0-agent endpoints',
        packaging: 'static web app or local server',
        strengths: ['lowest migration risk', 'keeps current JS modules', 'best AI-native UI velocity'],
        tradeoffs: ['native filesystem requires browser permissions or companion server'],
    },
    tauri: {
        label: 'Tauri Desktop Shell',
        maturity: 'future-shell',
        shell: 'Rust native wrapper + WebView',
        persistence: 'app data directory + SQLite/JSON save packets',
        transport: 'local commands + HTTP fallback',
        packaging: 'desktop app',
        strengths: ['small desktop bundle', 'native file access', 'good long-term product shell'],
        tradeoffs: ['requires Rust build pipeline', 'adapter API must be stable first'],
    },
    electron: {
        label: 'Electron Desktop Shell',
        maturity: 'future-shell',
        shell: 'Node desktop wrapper + Chromium',
        persistence: 'app data directory + SQLite/JSON save packets',
        transport: 'IPC + HTTP fallback',
        packaging: 'desktop app',
        strengths: ['Node ecosystem fit', 'easy local services', 'mature desktop tooling'],
        tradeoffs: ['larger bundle', 'more desktop security surface'],
    },
});

export const RE0_HOST_ADAPTER_CONTRACT = Object.freeze({
    inputEvents: [
        'player-action',
        'choice-selected',
        'custom-action',
        'setup-command',
        'save-load-command',
        'audio-command',
    ],
    coreRequests: [
        'buildRe0AgentTurn',
        'retrieveStoryRagWorkset',
        'buildNarrativeDirectorPlan',
        'validateRe0AgentTurn',
        'buildAssetPlan',
        'applyValidatedStatePatch',
    ],
    renderCommands: [
        'render-vn-stage',
        'present-grounded-choices',
        'set-backdrop',
        'set-character-cast',
        'show-worldline',
        'play-tts-targets',
    ],
    protectedStateRoots: [
        'worldline',
        'returnByDeath',
        'worldClock',
        'answerBook',
        'deathBranches',
        'setup',
    ],
    deterministicGates: [
        'death-return-public-leak',
        'candidate-grounding',
        'asset-plan-alignment',
        'narrative-beat-progress',
        'protected-state-patch',
        'save-scope-isolation',
    ],
});

function normalizeHostKind(kind = 'sillytavern-extension') {
    const value = String(kind || '').trim();
    return Object.hasOwn(RE0_HOST_PROFILES, value) ? value : 'sillytavern-extension';
}

function moduleStatusFrom(agentTurn = {}) {
    const declared = agentTurn.moduleStatus && typeof agentTurn.moduleStatus === 'object'
        ? agentTurn.moduleStatus
        : {};
    return Object.fromEntries(RE0_HOST_CORE_MODULES.map((name) => [name, declared[name] || 'available']));
}

function selectedBackdropKey(agentTurn = {}, state = {}) {
    return agentTurn.assetPlan?.selectedBackdrop?.key
        || agentTurn.turnPlan?.assetPlan?.selectedBackdrop?.key
        || state?.visuals?.sceneBackdrop?.currentKey
        || state?.visuals?.visualNovel?.backgroundKey
        || '';
}

function castAssetIds(agentTurn = {}, state = {}) {
    return unique([
        ...asArray(agentTurn.assetPlan?.castAssets).map((item) => item?.id || item?.name),
        ...asArray(agentTurn.turnPlan?.assetPlan?.castAssets).map((item) => item?.id || item?.name),
        ...asArray(state?.visuals?.visualNovel?.castIds),
        ...asArray(state?.visuals?.visualNovel?.sceneCharacters),
        ...asArray(state?.presence?.sceneCharacters),
    ], 12);
}

function persistencePlanFor(hostKind, state = {}) {
    const sessionId = state?.flags?.worldSessionId || state?.worldline?.id || 'unknown-save';
    if (hostKind === 'standalone-web') {
        return {
            primary: 'IndexedDB',
            exportFormat: 're0-save-packet-v1.json',
            sessionId,
            migrationFrom: 'SillyTavern chatMetadata packet',
            isolation: 'one save packet per worldSessionId',
        };
    }
    if (hostKind === 'tauri' || hostKind === 'electron') {
        return {
            primary: 'app-data SQLite + JSON snapshot',
            exportFormat: 're0-save-packet-v1.json',
            sessionId,
            migrationFrom: 'standalone-web IndexedDB packet',
            isolation: 'profile directory + worldSessionId',
        };
    }
    return {
        primary: 'SillyTavern chatMetadata',
        exportFormat: 're0-save-packet-v1.json',
        sessionId,
        migrationFrom: 'current live state',
        isolation: 'chatMetadata module key + worldSessionId',
    };
}

function transportPlanFor(hostKind) {
    if (hostKind === 'standalone-web') {
        return {
            director: 'HTTP /api/re0-agent/turn-plan',
            critic: 'HTTP /api/re0-agent/critic',
            streaming: 'SSE-ready narrative stream adapter',
            localFallback: true,
        };
    }
    if (hostKind === 'tauri') {
        return {
            director: 'Tauri command -> local core, HTTP fallback',
            critic: 'Tauri command -> deterministic critic, HTTP fallback',
            streaming: 'event channel',
            localFallback: true,
        };
    }
    if (hostKind === 'electron') {
        return {
            director: 'IPC -> local core, HTTP fallback',
            critic: 'IPC -> deterministic critic, HTTP fallback',
            streaming: 'IPC event stream',
            localFallback: true,
        };
    }
    return {
        director: 'in-process buildRe0AgentTurn + Express endpoint fallback',
        critic: 'deterministic critic + MiMo endpoint fallback',
        streaming: 'SillyTavern generation events',
        localFallback: true,
    };
}

function migrationPhaseFor(hostKind) {
    if (hostKind === 'sillytavern-extension') {
        return {
            phase: 0,
            label: 'current-runtime',
            next: 'extract reusable host adapter packets while keeping SillyTavern as production host',
        };
    }
    if (hostKind === 'standalone-web') {
        return {
            phase: 1,
            label: 'recommended-next-runtime',
            next: 'build a Web shell that consumes this bridge without rewriting core modules',
        };
    }
    return {
        phase: 2,
        label: 'desktop-shell-after-web-runtime',
        next: 'wrap stable standalone Web runtime after save packets, asset cache, and endpoints are frozen',
    };
}

export function buildRe0HostAdapterBridge(state = {}, agentTurn = {}, options = {}) {
    const hostKind = normalizeHostKind(options.hostKind || options.targetHost || 'sillytavern-extension');
    const profile = RE0_HOST_PROFILES[hostKind];
    const moduleStatus = moduleStatusFrom(agentTurn);
    const bridgeId = `host-${stableHash({
        hostKind,
        save: state?.flags?.worldSessionId || state?.worldline?.id,
        turn: agentTurn.turnId || agentTurn.turnPlan?.turnId,
        location: state?.current?.location,
    })}`;
    return {
        version: 're0-host-adapter-bridge/v1',
        bridgeId,
        host: {
            kind: hostKind,
            label: profile.label,
            maturity: profile.maturity,
            shell: profile.shell,
            target: options.targetHost || hostKind,
        },
        core: {
            modules: moduleStatus,
            requiredModules: RE0_HOST_CORE_MODULES.slice(),
            requestContract: RE0_HOST_ADAPTER_CONTRACT.coreRequests.slice(),
            deterministicGates: RE0_HOST_ADAPTER_CONTRACT.deterministicGates.slice(),
        },
        inboundEvents: RE0_HOST_ADAPTER_CONTRACT.inputEvents.map((type) => ({
            type,
            target: type.includes('audio') ? 'TTSDirector' : type.includes('save') ? 'SaveMemory' : 'Evaluator',
        })),
        outboundCommands: [
            {
                type: 'render-vn-stage',
                target: 'VNRenderer',
                payloadShape: ['segments', 'currentIndex', 'speaker', 'stageText'],
            },
            {
                type: 'present-grounded-choices',
                target: 'VNRenderer',
                payloadShape: ['choices', 'choiceType', 'groundingTerms'],
            },
            {
                type: 'set-backdrop',
                target: 'AssetDirector',
                key: selectedBackdropKey(agentTurn, state),
            },
            {
                type: 'set-character-cast',
                target: 'AssetDirector',
                castIds: castAssetIds(agentTurn, state),
            },
            {
                type: 'play-tts-targets',
                target: 'TTSDirector',
                targets: asArray(agentTurn.ttsPlan?.targets).slice(0, 4),
            },
            {
                type: 'persist-save',
                target: 'SaveMemory',
                payloadShape: ['stateSnapshot', 'worldSessionId', 'savePacketVersion'],
            },
        ],
        persistence: persistencePlanFor(hostKind, state),
        transport: transportPlanFor(hostKind),
        security: {
            remoteCriticCannotBypassLocalGate: true,
            rendererCannotWriteProtectedRoots: true,
            protectedStateRoots: RE0_HOST_ADAPTER_CONTRACT.protectedStateRoots.slice(),
            publicDeathReturnLeakBlocked: true,
            officialNovelTextPolicy: 'causal summaries and source ids only; no long canon text in host packets',
        },
        migration: migrationPhaseFor(hostKind),
        diagnostics: {
            location: compactText(state?.current?.location || '', 120),
            objective: compactText(state?.gameplay?.activeObjective || '', 160),
            routeMode: agentTurn.turnPlan?.routing?.mode || agentTurn.storyRag?.actionMode || '',
            validationStatus: agentTurn.validation?.status || '',
            commitMode: agentTurn.commitGuidance?.mode || '',
        },
    };
}

export function validateRe0HostAdapterBridge(bridge = {}) {
    const findings = [];
    const modules = bridge?.core?.modules || {};
    for (const name of RE0_HOST_CORE_MODULES) {
        if (!modules[name] || modules[name] === 'missing') {
            findings.push({
                severity: 'block',
                module: 'HostAdapter',
                title: `缺少核心模块 ${name}`,
                detail: '宿主只能替换 UI/存储/传输，不能绕过核心 agent/game 模块。',
            });
        }
    }
    const commandTypes = new Set(asArray(bridge?.outboundCommands).map((command) => command?.type));
    for (const required of ['render-vn-stage', 'present-grounded-choices', 'set-backdrop', 'persist-save']) {
        if (!commandTypes.has(required)) {
            findings.push({
                severity: 'block',
                module: 'HostAdapter',
                title: `缺少宿主输出命令 ${required}`,
                detail: '独立 Web/Tauri/Electron 壳必须能消费完整 VN 渲染、候选行动、素材和存档命令。',
            });
        }
    }
    if (bridge?.security?.remoteCriticCannotBypassLocalGate !== true) {
        findings.push({
            severity: 'block',
            module: 'HostAdapter',
            title: '远端 critic 不能覆盖本地硬门禁',
            detail: 'MiMo director/critic 只能补强计划，不能绕过 deterministic Evaluator。',
        });
    }
    if (bridge?.security?.rendererCannotWriteProtectedRoots !== true) {
        findings.push({
            severity: 'block',
            module: 'HostAdapter',
            title: '渲染层不能写受保护状态根',
            detail: RE0_HOST_ADAPTER_CONTRACT.protectedStateRoots.join(', '),
        });
    }
    if (!bridge?.persistence?.sessionId || bridge.persistence.sessionId === 'unknown-save') {
        findings.push({
            severity: 'warn',
            module: 'HostAdapter',
            title: '宿主存档缺少稳定 worldSessionId',
            detail: '独立壳需要用 worldSessionId 隔离存档记忆、NPC 记忆和死亡记忆。',
        });
    }
    const status = findings.some((finding) => finding.severity === 'block') ? 'block'
        : findings.some((finding) => finding.severity === 'warn') ? 'warn'
            : 'pass';
    return {
        version: 're0-host-adapter-validation/v1',
        status,
        findings,
        readyForStandaloneShell: status === 'pass' && bridge?.host?.kind !== 'sillytavern-extension',
        readyForCurrentHost: status === 'pass',
    };
}

export function summarizeRe0HostAdapterBridge(bridge = {}, limit = DEFAULT_SUMMARY_LIMIT) {
    const validation = validateRe0HostAdapterBridge(bridge);
    const output = [
        `- HostAdapter: ${bridge.version || 'unknown'} / ${bridge.host?.kind || 'unknown'} / ${bridge.host?.maturity || ''}`,
        `- 核心模块: ${Object.keys(bridge.core?.modules || {}).join(' / ')}`,
        `- 传输: ${bridge.transport?.director || ''}`,
        `- 存储: ${bridge.persistence?.primary || ''} / session=${bridge.persistence?.sessionId || ''}`,
        `- 渲染命令: ${asArray(bridge.outboundCommands).map((command) => command.type).slice(0, 6).join(' / ')}`,
        `- 迁移阶段: ${bridge.migration?.phase ?? '?'} / ${bridge.migration?.label || ''}`,
        `- 校验: ${validation.status} / findings=${validation.findings.length}`,
    ].join('\n');
    if (output.length <= limit) {
        return output;
    }
    return `${output.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}
