#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const rel = (path) => new URL(path, root);
const trace = (message) => {
    if (process.env.RE0_RELEASE_CHECK_TRACE === '1') {
        console.error(`[release-check] ${message}`);
    }
};

const syntaxFiles = [
    'public/scripts/extensions/third-party/re0-adventure-engine/index.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/re0-agent-module.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/re0-host-adapter.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/agent-turn-plan.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/asset-policy-engine.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/character-dossier-static-patch.generated.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/character-playloop-hooks.generated.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/if-branch-rules.generated.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/grokadult-runtime-assets.generated.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/scene-backdrops.generated.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/story-rag.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/storyline-defaults.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/visual-assets.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-scene-registry.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-adapter.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-checkpoint.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-controls.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-events.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-keyboard.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-constants.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-mode-template.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-runtime.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-script.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-state-patch.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-stage.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-transition.js',
    'src/endpoints/re0-agent.js',
    'src/endpoints/re0-sim.js',
    'src/endpoints/mimo-tts.js',
    'src/server-startup.js',
    'scripts/re0-release-check.mjs',
    'scripts/build-re0-character-dossier-static-patch.mjs',
    'scripts/build-re0-character-playloop-hooks.mjs',
    'scripts/build-re0-if-branch-rules.mjs',
    'scripts/build-re0-grokadult-runtime-assets.mjs',
    'scripts/build-storyline-defaults.js',
    'scripts/build-re0-planned-visual-assets.mjs',
    'scripts/build-re0-asset-manifest.mjs',
    'scripts/generate-re0-visual-assets.mjs',
    'scripts/re0-asset-coverage.mjs',
    'scripts/re0-product-verify.mjs',
    'scripts/re0-live-director-audit.mjs',
    'tests/re0-adventure-engine.e2e.js',
    'tests/re0-adventure-engine-longplay.e2e.js',
    'tests/re0-adventure-onboarding.e2e.js',
    'tests/re0-adventure-onboarding-matrix.e2e.js',
    'tests/re0-agent-module.test.mjs',
    'tests/re0-host-adapter.test.mjs',
];

const jsonFiles = [
    'data/default-user/settings.json',
    'data/default-user/OpenAI Settings/MiMo Re0 Dark Novel.json',
    'src/endpoints/data/re0-shard-templates.json',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/storyline-defaults.json',
    'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/manifest.json',
    'public/scripts/extensions/third-party/re0-adventure-engine/assets/user/manifest.json',
    'data/default-user/re0-engine/assets-plan/generated-visual-index.json',
    'data/default-user/re0-engine/assets-plan/asset-manifest.generated.json',
    'data/default-user/re0-engine/assets-plan/grokadult-runtime-physical-index.generated.json',
    'data/default-user/re0-engine/assets-plan/prompts.json',
    'data/default-user/re0-engine/storylines/ROYAL_CAPITAL_IF_BRANCH_RULES_2026-05-28.json',
    'data/default-user/re0-engine/storylines/MANSION_IF_BRANCH_RULES_2026-05-28.json',
    'data/default-user/re0-engine/storylines/if-rules/ARC3_ARC4_IF_BRANCH_RULES_2026-05-28.json',
    'data/default-user/re0-engine/characters/CHARACTER_DOSSIER_MERGE_PLAN_2026-05-28.json',
    'data/default-user/re0-engine/characters/CHARACTER_PLAYLOOP_ACTIVE_HOOKS_2026-05-29.json',
    'data/default-user/re0-engine/characters/CHARACTER_PLAYLOOP_ACTIVE_HOOKS_2026-05-29_4WAY.json',
    'data/default-user/re0-engine/collab/inbox/storylines/20260529-1624-storyline-if-worker-01-arc1-4-death-failure-choice-tags.json',
];

const secretScanTargets = [
    'package.json',
    'config.yaml',
    'scripts/re0-product-verify.mjs',
    'scripts/re0-release-check.mjs',
    'scripts/re0-live-director-audit.mjs',
    'src/endpoints/re0-sim.js',
    'src/endpoints/re0-agent.js',
    'src/endpoints/mimo-tts.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/index.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/character-playloop-hooks.generated.js',
    'data/default-user/re0-engine/PROJECT_STATUS.md',
    'data/default-user/re0-engine/RE0_PRODUCT_LAUNCH_GUIDE_2026-05-29.md',
    'data/default-user/re0-engine/collab/MAIN_WINDOW_SYNC.md',
];

const lintFiles = [
    'src/endpoints/mimo-tts.js',
    'src/endpoints/re0-agent.js',
    'src/endpoints/re0-sim.js',
    'src/server-startup.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/index.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/re0-agent-module.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/re0-host-adapter.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/agent-turn-plan.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/asset-policy-engine.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/character-dossier-static-patch.generated.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/character-playloop-hooks.generated.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/if-branch-rules.generated.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/grokadult-runtime-assets.generated.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/scene-backdrops.generated.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/story-rag.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/storyline-defaults.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/visual-assets.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-scene-registry.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-adapter.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-checkpoint.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-controls.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-events.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-keyboard.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-constants.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-mode-template.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-runtime.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-script.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-state-patch.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-stage.js',
    'public/scripts/extensions/third-party/re0-adventure-engine/data/vn-transition.js',
    'scripts/re0-asset-coverage.mjs',
    'scripts/re0-product-verify.mjs',
    'scripts/re0-live-director-audit.mjs',
    'scripts/build-re0-character-dossier-static-patch.mjs',
    'scripts/build-re0-character-playloop-hooks.mjs',
    'scripts/build-re0-grokadult-runtime-assets.mjs',
];

function run(name, command, args) {
    const result = spawnSync(command, args, {
        cwd: root,
        encoding: 'utf8',
        stdio: 'pipe',
    });
    if (result.status !== 0) {
        const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
        throw new Error(`${name} failed\n${output}`);
    }
}

function validateJson() {
    for (const file of jsonFiles) {
        JSON.parse(fs.readFileSync(rel(file), 'utf8'));
    }
}

function validateNoApiSecretLeakage() {
    const secretPatterns = [
        /tp-[a-z0-9]{24,}/gi,
        /(?:api[_-]?key|x-api-key|api-key)\s*[:=]\s*["']?(?:tp-|sk-|ak-)[a-z0-9_-]{16,}/gi,
    ];
    const leaks = [];
    for (const file of secretScanTargets) {
        if (!fs.existsSync(rel(file))) {
            continue;
        }
        const text = fs.readFileSync(rel(file), 'utf8');
        for (const pattern of secretPatterns) {
            const matches = text.match(pattern) || [];
            if (matches.length) {
                leaks.push(`${file} (${matches.length})`);
            }
        }
    }
    if (leaks.length) {
        throw new Error(`Possible API secret leakage detected: ${leaks.join(', ')}`);
    }
}

function validateUiBindings() {
    const source = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/index.js'), 'utf8');
    const attrs = [...source.matchAll(/data-re0-[a-z0-9-]+/g)].map((match) => match[0]);
    const inMarkup = new Set(attrs);
    const bound = new Set([...source.matchAll(/querySelector(?:All)?\('\[([^\]]+)\]/g)].map((match) => match[1]));
    const likelyControls = [...inMarkup].filter((attr) => !attr.endsWith('-panel') && /data-re0-(auto|world|save|load|delete|new|start|show|mainline|daily|adult|reply|pause|replay|stop|character|open|backdrop|text|setting|immersive|collapse|advance|gameplay|presence|routes|visual|tts|voice)/.test(attr));
    const unbound = likelyControls.filter((attr) => !bound.has(attr)).sort();
    if (unbound.length) {
        throw new Error(`Unbound Re:0 UI controls: ${unbound.join(', ')}`);
    }
}

function validateStorylineData() {
    const defaults = JSON.parse(fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/storyline-defaults.json'), 'utf8'));
    const counts = defaults.counts || {};
    const requirements = {
        convergenceNodes: 90,
        keys: 56,
        deathFlags: 87,
        sideQuests: 66,
        decisionPoints: 50,
        endings: 9,
        characterDossiers: 60,
    };
    const failures = Object.entries(requirements)
        .filter(([key, minimum]) => Number(counts[key] || 0) < minimum)
        .map(([key, minimum]) => `${key} ${counts[key] || 0}/${minimum}`);
    if (failures.length) {
        throw new Error(`Storyline data below minimum: ${failures.join(', ')}`);
    }
    if (!Array.isArray(defaults.convergenceNodes) || defaults.convergenceNodes.length !== counts.convergenceNodes) {
        throw new Error('Storyline convergenceNodes count mismatch.');
    }
    if (!Array.isArray(defaults.keys) || defaults.keys.length !== counts.keys) {
        throw new Error('Storyline keys count mismatch.');
    }
    if (!Array.isArray(defaults.deathFlags) || defaults.deathFlags.length !== counts.deathFlags) {
        throw new Error('Storyline deathFlags count mismatch.');
    }
    if (!Array.isArray(defaults.endings) || defaults.endings.length !== counts.endings) {
        throw new Error('Storyline endings count mismatch.');
    }
}

function validateWorldbookNodes() {
    const world = JSON.parse(fs.readFileSync(rel('data/default-user/worlds/Re0_Dark_Return_World.json'), 'utf8'));
    const entries = world.entries ? Object.values(world.entries) : Array.isArray(world) ? world : [];
    const storylineNodes = entries.filter((entry) => /^Storyline Node C\d+\b/.test(entry?.comment || ''));
    const ifRouteEntries = entries.filter((entry) => /^IF Route /.test(entry?.comment || ''));
    if (entries.length < 100 || storylineNodes.length !== 90) {
        throw new Error(`Worldbook storyline nodes invalid: entries=${entries.length}, nodes=${storylineNodes.length}`);
    }
    if (ifRouteEntries.length < 2) {
        throw new Error(`Worldbook IF route entries missing: ${ifRouteEntries.length}/2`);
    }
}

function readTextIfExists(file) {
    const target = rel(file);
    return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
}

function collectTextFiles(paths, exts = new Set(['.js', '.mjs', '.json', '.md'])) {
    const files = [];
    const visit = (fileOrDir) => {
        const target = rel(fileOrDir);
        if (!fs.existsSync(target)) return;
        const stat = fs.statSync(target);
        if (stat.isDirectory()) {
            for (const entry of fs.readdirSync(target)) {
                visit(`${fileOrDir.replace(/\/$/, '')}/${entry}`);
            }
            return;
        }
        const ext = fileOrDir.includes('.') ? fileOrDir.slice(fileOrDir.lastIndexOf('.')) : '';
        if (exts.has(ext)) files.push(fileOrDir);
    };
    for (const target of paths) visit(target);
    return files.sort();
}

function validateCausalInheritanceGuards() {
    const runtime = readTextIfExists('public/scripts/extensions/third-party/re0-adventure-engine/index.js');
    const worldbook = readTextIfExists('data/default-user/worlds/Re0_Dark_Return_World.json');
    const storylineDefaults = readTextIfExists('public/scripts/extensions/third-party/re0-adventure-engine/data/storyline-defaults.json');
    const required = [
        ['runtime doctrine exists', runtime, 'playerCausalInheritanceDoctrine'],
        ['runtime protocol exists', runtime, 'causalInheritanceProtocol'],
        ['state prompt injects causal inheritance protocol', runtime, '因果继承协议：'],
        ['death return carries causal inheritance', runtime, 'returnByDeath.causalInheritance'],
        ['quiet update schema carries causal inheritance', runtime, '"causalInheritance": string'],
        ['worldbook C9 is causal inheritance pressure', worldbook, '收束节点 C9：玩家因果继承压力'],
        ['worldbook C9 contains original causality transfer rule', worldbook, '原世界线关键因果、救援窗口、迟到代价、死亡压力、阵营误会和行动修正全部压入玩家锚点'],
        ['storyline defaults C9 is causal inheritance pressure', storylineDefaults, '"name": "玩家因果继承压力"'],
        ['storyline defaults C9 contains original causality transfer rule', storylineDefaults, '原世界线关键因果、救援窗口、迟到代价、死亡压力、阵营误会和行动修正全部压入玩家锚点'],
        ['runtime memory migrated causal inheritance thread', readTextIfExists('data/default-user/re0-engine/runtime-memory/world-mpoyfiqa/PLOT_THREADS.md'), 'M1-CAUSAL-INHERITANCE'],
        ['asset plan uses causal resonance emotion card', readTextIfExists('data/default-user/re0-engine/assets-plan/prompts.json'), 'emo_causal_resonance.png'],
    ];
    const missing = required
        .filter(([, source, needle]) => !source.includes(needle))
        .map(([label]) => label);
    if (missing.length) {
        throw new Error(`Re:0 causal inheritance guards missing: ${missing.join(', ')}`);
    }

    const scanFiles = collectTextFiles([
        'public/scripts/extensions/third-party/re0-adventure-engine',
        'data/default-user/worlds/Re0_Dark_Return_World.json',
        'data/default-user/re0-engine/storylines',
        'data/default-user/re0-engine/runtime-memory',
        'data/default-user/re0-engine/assets-plan',
        'data/default-user/re0-engine/research',
        'data/default-user/re0-engine/characters',
    ]);
    const forbidden = [
        /SUBARU|NATSUKI|Subaru|subaru|菜月昴|昴|player_anchor|PlayerProtagonist/g,
        /玩家主角|同源回归者|另一名异世界来客|双方锚点|自己的循环/g,
        /双文本框|单一死亡回归|互换灵魂|接班|另一半/g,
        /玩家\/玩家|玩家和玩家|让玩家和玩家|你与玩家|玩家同源记忆/g,
        /双方在同一日|与玩家可能|与玩家正面冲突|寻找另一个行为异常/g,
        /emo_subaru_sync|两个身影/g,
        /characterFocus"\s*:\s*\[[^\]]*"玩家"[^\]]*"玩家"/g,
    ];
    const findings = [];
    for (const file of scanFiles) {
        const text = readTextIfExists(file);
        for (const pattern of forbidden) {
            pattern.lastIndex = 0;
            const match = pattern.exec(text);
            if (match) {
                const line = text.slice(0, match.index).split('\n').length;
                const lineText = text.split('\n')[line - 1] || '';
                if (
                    file.endsWith('public/scripts/extensions/third-party/re0-adventure-engine/data/asset-policy-engine.js')
                    && /['"]昴['"]\s*:\s*['"]protagonist['"]/u.test(lineText)
                ) {
                    continue;
                }
                findings.push(`${file}:${line}: ${match[0]}`);
            }
        }
    }
    if (findings.length) {
        throw new Error(`Stale dual-protagonist / deleted-protagonist terms found:\n${findings.slice(0, 40).join('\n')}`);
    }
}

function validateMimoConfig() {
    const settings = JSON.parse(fs.readFileSync(rel('data/default-user/settings.json'), 'utf8'));
    const preset = JSON.parse(fs.readFileSync(rel('data/default-user/OpenAI Settings/MiMo Re0 Dark Novel.json'), 'utf8'));
    const errors = [];
    if (settings.oai_settings?.openai_model !== 'mimo-v2.5-pro') {
        errors.push(`settings model=${settings.oai_settings?.openai_model}`);
    }
    if (preset.openai_model !== 'mimo-v2.5-pro') {
        errors.push(`preset model=${preset.openai_model}`);
    }
    if (typeof settings.oai_settings?.stream_openai !== 'boolean') {
        errors.push('settings stream_openai must be explicitly configured');
    }
    if (typeof preset.stream_openai !== 'boolean') {
        errors.push('preset stream_openai must be explicitly configured');
    }
    if (Number(settings.oai_settings?.openai_max_context || 0) < 65536 || Number(preset.openai_max_context || 0) < 65536) {
        errors.push('context must stay >= 65536 for long-running worldline memory');
    }
    if (Number(settings.oai_settings?.openai_max_context || 0) > 65536 || Number(preset.openai_max_context || 0) > 65536) {
        errors.push('context must stay <= 65536 unless MiMo limit is re-verified');
    }
    const settingsMaxTokens = Number(settings.oai_settings?.openai_max_tokens || 0);
    const presetMaxTokens = Number(preset.openai_max_tokens || 0);
    if (settingsMaxTokens < 1000 || presetMaxTokens < 1000) {
        errors.push('completion tokens must stay >= 1000 for complete VN_SCRIPT turns');
    }
    if (settingsMaxTokens > 1400 || presetMaxTokens > 1400) {
        errors.push('completion tokens must stay <= 1400 for tested MiMo latency bounds');
    }
    if (Math.abs(Number(settings.oai_settings?.temp_openai ?? settings.oai_settings?.temperature ?? 0) - 0.55) > 0.001
        || Math.abs(Number(preset.temp_openai ?? preset.temperature ?? 0) - 0.55) > 0.001) {
        errors.push('MiMo temperature must stay at 0.55 for tested VN_SCRIPT stability');
    }
    if (Math.abs(Number(settings.oai_settings?.top_p_openai ?? settings.oai_settings?.top_p ?? 0) - 0.9) > 0.001
        || Math.abs(Number(preset.top_p_openai ?? preset.top_p ?? 0) - 0.9) > 0.001) {
        errors.push('MiMo top_p must stay at 0.9 for tested VN_SCRIPT stability');
    }
    const settingsIncludeBody = String(settings.oai_settings?.custom_include_body || '');
    const presetIncludeBody = String(preset.custom_include_body || '');
    if (!/thinking:\s*\n\s*type:\s*disabled/u.test(settingsIncludeBody) || !/thinking:\s*\n\s*type:\s*disabled/u.test(presetIncludeBody)) {
        errors.push('MiMo thinking must stay disabled for tested latency bounds');
    }
    const re0 = settings.extension_settings?.re0AdventureEngine || settings.extensions?.re0AdventureEngine || {};
    if (Number(re0.statePromptMaxChars || 0) < 5200) {
        errors.push('Re:0 statePromptMaxChars must stay >= 5200 to keep setup/worldline/card slices coherent');
    }
    if (Number(re0.mainReplyMaxChars || 0) < 3600) {
        errors.push('Re:0 mainReplyMaxChars must stay >= 3600 to avoid truncation-repair as the normal path');
    }
    const promptText = JSON.stringify([
        settings.oai_settings?.prompts || [],
        preset.prompts || [],
    ]);
    if (/1800-3600|7-10\s*段/u.test(promptText)) {
        errors.push('MiMo prompts must not request legacy 1800-3600 char long-form turns');
    }
    if (errors.length) {
        throw new Error(`MiMo config invalid: ${errors.join('; ')}`);
    }
}

function validateRequiredAssets() {
    const required = [
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/avatars-hires/protagonist.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/avatars-hires/narrator.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/avatars-hires/lishelle.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/al.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/anastasia.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/beatrice.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/bellringer.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/capital_guard.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/crusch.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/elsa.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/emilia.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/felt.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/ferris.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/julius.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/lishelle.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/market_vendor.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/mia.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/otto.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/priscilla.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/owen.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/protagonist.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/protagonist/concept/protagonist__concept.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/narrator/concept/narrator__concept.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/lishelle/concept/lishelle__concept.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/owen/concept/owen__concept.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/mia/concept/mia__concept.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/bellringer/concept/bellringer__concept.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/protagonist/sprite-src/protagonist__pose-idle__expr-neutral__outfit-default__key.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/protagonist/sprite/protagonist__pose-idle__expr-neutral__outfit-default.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/world_will/sprite-src/world_will__pose-system_avatar__expr-neutral__outfit-ceremonial__key.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/world_will/sprite/world_will__pose-system_avatar__expr-neutral__outfit-ceremonial.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/narrator/sprite/narrator__pose-system_avatar__expr-neutral__outfit-ceremonial.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/rishel/sprite-src/rishel__pose-idle__expr-soft_smile__outfit-nun_rain__key.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/rishel/sprite/rishel__pose-idle__expr-soft_smile__outfit-nun_rain.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/lishelle/sprite/lishelle__pose-idle__expr-soft_smile__outfit-nun_rain.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/owen/sprite-src/owen__pose-interrogate__expr-cold__outfit-guard_coat__key.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/owen/sprite/owen__pose-interrogate__expr-cold__outfit-guard_coat.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/mia/sprite-src/mia__pose-hide_clue__expr-fear__outfit-slum_rain__key.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/mia/sprite/mia__pose-hide_clue__expr-fear__outfit-slum_rain.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/bell_stripper/sprite-src/bell_stripper__pose-ritual__expr-cold_laugh__outfit-cult_robe__key.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/bell_stripper/sprite/bell_stripper__pose-ritual__expr-cold_laugh__outfit-cult_robe.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/bellringer/sprite/bellringer__pose-ritual__expr-cold_laugh__outfit-cult_robe.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/protagonist/sprite-src/protagonist__pose-close_whisper__expr-longing__outfit-private_indoor__adult__key.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/protagonist/sprite/protagonist__pose-close_whisper__expr-longing__outfit-private_indoor__adult.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/lishelle/sprite-src/lishelle__pose-sit_bedside__expr-vulnerable__outfit-night_robe__adult__key.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/lishelle/sprite/lishelle__pose-sit_bedside__expr-vulnerable__outfit-night_robe__adult.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/rishel/sprite/rishel__pose-sit_bedside__expr-vulnerable__outfit-night_robe__adult.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/owen/sprite-src/owen__pose-loosen_collar__expr-possessive__outfit-private_indoor__adult__key.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/owen/sprite/owen__pose-loosen_collar__expr-possessive__outfit-private_indoor__adult.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/emilia/sprite-src/emilia__pose-turn_blush__expr-flustered__outfit-private_indoor__adult__key.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/characters/emilia/sprite/emilia__pose-turn_blush__expr-flustered__outfit-private_indoor__adult.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/ram.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/relief_worker.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/rem.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/reinhard.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/rom.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/roswaal.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/sprites/wilhelm.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/avatars-hires/owen.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/avatars-hires/bellringer.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/avatars-hires/mia.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/avatars-hires/capital_guard.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/avatars-hires/market_vendor.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/styleboards/codex-imggen-cast-contact-sheet-2026-05-23.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/market_day.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/death_anchor__black_shadow.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/answer_book__open.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/worldline_tree__stable.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/witch_interference__heart_pressure.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/relief_house.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/loot_house.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/guard_interrogation.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/roadside_inn.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/archive_annex_night.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/forbidden_library_antechamber_night.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/sanctuary_tomb_dusk.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/capital_gate_day.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/tavern_common_room_night.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/noble_salon_evening.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/forest_road_checkpoint_dusk.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/healer_clinic_rain.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/witch_cult_hideout_candle.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/capital_sewer_tunnel.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/capital_rooftops_night.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/arlam_village_night.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/mansion_exterior_day.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/mansion_kitchen_morning.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/mansion_courtyard_dusk.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/mansion_guest_room_night.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/mansion_study_twilight.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/mansion_bath_steam.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/priestella_inn_room_night.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/priestella_sluice_control_room_night.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/imperial_command_tent_night.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/kararagi_caravanserai_evening.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/gusteko_village_house_interior.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/augria_sand_dunes_night.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/great_waterfall_edge_dawn.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/great_waterfall_edge_storm.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/wilderness_camp_night.png',
        'public/scripts/extensions/third-party/re0-adventure-engine/assets/official/emilia.webp',
    ];
    const missing = required.filter((file) => !fs.existsSync(rel(file)));
    if (missing.length) {
        throw new Error(`Required Re:0 assets missing: ${missing.join(', ')}`);
    }
}

function validateGeneratedAssetReferences() {
    const extensionRoot = 'public/scripts/extensions/third-party/re0-adventure-engine';
    const assetSourceFiles = [
        `${extensionRoot}/index.js`,
        `${extensionRoot}/data/visual-assets.js`,
        `${extensionRoot}/data/vn-scene-registry.js`,
        `${extensionRoot}/data/grokadult-runtime-assets.generated.js`,
    ];
    const extensionSource = assetSourceFiles.map((file) => fs.readFileSync(rel(file), 'utf8')).join('\n');
    const catalogSource = fs.readFileSync(rel(`${extensionRoot}/data/scene-backdrops.generated.js`), 'utf8');
    const sceneUrls = [...catalogSource.matchAll(/"imageUrl":\s*"([^"]+)"/g)].map((match) => match[1]);
    const missingScenes = sceneUrls.filter((url) => !fs.existsSync(rel(`public/${url.replace(/^\//, '')}`)));
    const manifest = JSON.parse(fs.readFileSync(rel(`${extensionRoot}/assets/generated/manifest.json`), 'utf8'));
    const localAssetUrls = [
        ...extensionSource.matchAll(/(?:ASSET_ROOT|GENERATED_ASSET_ROOT|USER_ASSET_ROOT)\}\/([^`"']+\.(?:png|jpe?g|webp|gif))/gi),
    ].map((match) => {
        const rootName = match[0].match(/(?:ASSET_ROOT|GENERATED_ASSET_ROOT|USER_ASSET_ROOT)/)?.[0];
        const localPath = match[1];
        if (rootName === 'ASSET_ROOT') return `${extensionRoot}/assets/official/${localPath}`;
        if (rootName === 'GENERATED_ASSET_ROOT') return `${extensionRoot}/assets/generated/${localPath}`;
        return `${extensionRoot}/assets/user/${localPath}`;
    });
    const explicitLocalUrls = [
        ...extensionSource.matchAll(/\/scripts\/extensions\/third-party\/re0-adventure-engine\/assets\/[^`"'\s)]+\.(?:png|jpe?g|webp|gif)/gi),
    ].map((match) => `public${match[0]}`);
    const codeReferencedAssets = [...new Set([...localAssetUrls, ...explicitLocalUrls])]
        .filter((file) => !file.includes('${') && !file.includes('encodeURIComponent'));
    const missingCodeAssets = codeReferencedAssets.filter((file) => !fs.existsSync(rel(file)));
    const missingManifest = [
        ...(manifest.scenes || []).map((file) => `${extensionRoot}/assets/generated/scenes/${file}`),
        ...(manifest.avatars || []).map((file) => `${extensionRoot}/assets/generated/avatars/${file}`),
    ].filter((file) => !fs.existsSync(rel(file)));
    if (missingScenes.length || missingManifest.length || missingCodeAssets.length) {
        throw new Error(`Generated Re:0 asset references missing: ${[...missingScenes, ...missingManifest, ...missingCodeAssets].join(', ')}`);
    }
    const bannedStageBackdropUrls = [
        '/assets/generated/scenes-extra/arc01_bell_tower_interior.png',
        '/assets/generated/scenes-extra/arc09_gusteko_cold_source.png',
        '/assets/generated/scenes-extra/arc09_gusteko_church.png',
        '/assets/generated/scenes-extra/arc09_snowfield_bell.png',
        '/assets/generated/scenes-extra/arc10_capital_bell_tower_night.png',
        '/assets/generated/scenes-extra/arc10_capital_finale_plaza.png',
        '/assets/generated/scenes-extra/arc11_dawn_after_witch.png',
        '/assets/generated/scenes-extra/cross_kararagi_road.png',
        '/assets/generated/scenes-extra/cross_great_waterfall_edge.png',
    ];
    const leakedPlaceholderBackdrops = sceneUrls.filter((url) => bannedStageBackdropUrls.some((bad) => String(url).includes(bad)));
    if (leakedPlaceholderBackdrops.length) {
        throw new Error(`Low-quality placeholder backdrops are still mapped into VN stage catalog: ${leakedPlaceholderBackdrops.join(', ')}`);
    }
    const hiresAvatars = codeReferencedAssets.filter((file) => /assets\/generated\/avatars-hires\/[^/]+\.png$/i.test(file));
    const styleboardDir = rel(`${extensionRoot}/assets/generated/styleboards/`);
    const styleboards = fs.existsSync(styleboardDir)
        ? fs.readdirSync(styleboardDir).filter((file) => /\.(?:png|jpe?g|webp)$/i.test(file))
        : [];
    return {
        sceneUrls: sceneUrls.length,
        manifestScenes: (manifest.scenes || []).length,
        manifestAvatars: (manifest.avatars || []).length,
        hiresAvatars: hiresAvatars.length,
        codeReferencedAssets: codeReferencedAssets.length,
        styleboards: styleboards.length,
    };
}

function validateProductExperienceGuards() {
    const source = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/index.js'), 'utf8');
    const agentModule = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/re0-agent-module.js'), 'utf8');
    const agentTurnPlan = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/agent-turn-plan.js'), 'utf8');
    const vnRuntime = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/vn-runtime.js'), 'utf8');
    const vnSceneRegistry = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/vn-scene-registry.js'), 'utf8');
    const vnScript = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/vn-script.js'), 'utf8');
    const vnStatePatch = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/vn-state-patch.js'), 'utf8');
    const vnStage = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/vn-stage.js'), 'utf8');
    const vnControls = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/vn-controls.js'), 'utf8');
    const vnEvents = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/vn-events.js'), 'utf8');
    const vnAdapter = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/vn-adapter.js'), 'utf8');
    const vnCheckpoint = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/vn-checkpoint.js'), 'utf8');
    const vnKeyboard = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/vn-keyboard.js'), 'utf8');
    const vnModeTemplate = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/vn-mode-template.js'), 'utf8');
    const vnTransition = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/vn-transition.js'), 'utf8');
    const characterDossierStaticPatch = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/character-dossier-static-patch.generated.js'), 'utf8');
    const characterPlayLoopHooksGenerated = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/character-playloop-hooks.generated.js'), 'utf8');
    const ifBranchGenerated = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/if-branch-rules.generated.js'), 'utf8');
    const ifBranchGenerator = fs.readFileSync(rel('scripts/build-re0-if-branch-rules.mjs'), 'utf8');
    const visualAssets = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/visual-assets.js'), 'utf8');
    const re0AgentEndpoint = fs.readFileSync(rel('src/endpoints/re0-agent.js'), 'utf8');
    const backend = fs.readFileSync(rel('src/endpoints/re0-sim.js'), 'utf8');
    const storyRag = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/story-rag.js'), 'utf8');
    const worldContext = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/data/world-context.js'), 'utf8');
    const liveDirectorAudit = fs.readFileSync(rel('scripts/re0-live-director-audit.mjs'), 'utf8');
    const livePlayflowAudit = fs.readFileSync(rel('scripts/re0-live-playflow-audit.mjs'), 'utf8');
    const style = fs.readFileSync(rel('public/scripts/extensions/third-party/re0-adventure-engine/style.css'), 'utf8');
    const productSource = `${source}\n${agentModule}\n${agentTurnPlan}\n${worldContext}\n${vnRuntime}\n${vnSceneRegistry}\n${vnScript}\n${vnStatePatch}\n${vnStage}\n${vnControls}\n${vnEvents}\n${vnAdapter}\n${vnCheckpoint}\n${vnKeyboard}\n${vnModeTemplate}\n${vnTransition}\n${characterDossierStaticPatch}\n${characterPlayLoopHooksGenerated}\n${ifBranchGenerated}\n${ifBranchGenerator}\n${visualAssets}\n${re0AgentEndpoint}\n${livePlayflowAudit}\n${style}`;
    const required = [
        ['background clock does not advance mainline outside mainline mode', "progressMainline: storyMode === 'mainline'"],
        ['background clock user-facing policy explains non-mainline behavior', '只生成传言/时间差，不推进主线钟'],
        ['state prompt rule aligns background clock with mainline policy', '主线钟只在主线模式、用户明确说“推进主线/主线钟推进/主线世界推演”'],
        ['manual time advance routes through explicit mainline gate', 'function shouldProgressMainlineForTimeAdvance'],
        ['manual time advance can record paused mainline notice', 'function recordMainlinePausedNotice'],
        ['manual time advance syncs background day without advancing mainline', 'function syncWorldClockToLocalDay'],
        ['system messages cannot trigger narrative state side effects', 'function isNarrativeAssistantMessage'],
        ['post-message hooks skip local system messages', '!isNarrativeAssistantMessage(context, messageId)'],
        ['sidecar outputs are hard-bounded before storage', 'function clampMultilineText'],
        ['sidecar prompt history is compacted', 'promptHistory = [...(state.visuals.promptHistory || []), shortPromptText(entry.content, 520)].slice(-8)'],
        ['adult visual sidecar uses narrative-only snippet', 'function sidecarNarrativeSnippet'],
        ['HUD explains paused mainline pulse', '主线脉冲暂停'],
        ['narrative QA correction is injected into next state prompt', 'function summarizeNarrativeQaCorrection'],
        ['state prompt contains narrative QA correction section', '叙事验收纠偏'],
        ['product diagnosis escalates failed narrative QA', "lastNarrativeQaStatus === 'fail'"],
        ['product diagnosis returns local command brief', 'state.flags.localCommandBrief = buildProductExperienceAuditBrief'],
        ['review mode auto-returns on normal first-person action', "state.mode === 'review' && !metaCommandPattern.test(text)"],
        ['browser debug hook is installed for smoke tests', 'function installAdventureDebugHooks'],
        ['render_game_to_text exposes concise state for Playwright/Codex', 'globalThis.render_game_to_text'],
        ['volatile systemNotice is tail-prioritized', 'function systemNoticeForPrompt'],
        ['stale derived systemNotice can be dropped', 'function shouldDropStaleSystemNotice'],
        ['debug snapshot exposes systemNotice compression', 'lastSystemNoticeChars'],
        ['prompt compression uses priority sections', 'function buildPriorityCompressedPrompt'],
        ['prompt compression exposes section coverage', 'function summarizePromptSectionCoverage'],
        ['prompt compression preserves current character cards', '存档绑定角色演化卡：'],
        ['prompt compression preserves runtime rules', 'function compactRulesSection'],
        ['debug snapshot exposes prompt section coverage', 'lastPromptSections'],
        ['memory architecture state is defined', 'function buildDefaultMemoryArchitectureState'],
        ['memory architecture is normalized', 'function normalizeMemoryArchitecture'],
        ['context packet priorities are built', 'function buildContextPacketManifest'],
        ['runtime fact index is built', 'function buildRuntimeFactIndex'],
        ['context workset is built', 'function buildContextWorkset'],
        ['context workset is injected into prompt', '本轮事实工作集：'],
        ['context packet manifest includes memory bands', 'band: activeIfPressure'],
        ['context packet manifest includes source documents', 'sourceDoc:'],
        ['state prompt contains context packet section', '上下文包优先级：'],
        ['prompt section relevance routes memory context', 'function promptSectionRelevance'],
        ['memory architecture includes API orchestration policy', 'apiPolicy'],
        ['memory snapshots include routing metadata', 'memoryRouting'],
        ['memory snapshot documents are generated', 'function buildMemorySnapshotForDisk'],
        ['memory snapshot persistence is scheduled', 'function scheduleMemorySnapshot'],
        ['HUD exposes memory snapshot status', 'data-re0-memory'],
        ['IF route logic profiles are defined', 'const ifRouteProfiles'],
        ['IF route logic has context rules', 'const ifRouteLogicRules'],
        ['IF route logic has axis rules', 'const ifRouteAxisRules'],
        ['IF route pleasure grammar is defined', 'const ifRoutePleasureGrammar'],
        ['IF route pleasure grammar enters prompt summary', 'IF 爽点:'],
        ['generated IF branch rules are exported', 'export const generatedIfBranchRules'],
        ['generated IF branch rule metadata is exported', 'export const generatedIfBranchRuleMetadata'],
        ['generated IF branch rules include Arc 3/4 source', 'ARC3_ARC4_IF_BRANCH_RULES_2026-05-28.json'],
        ['runtime imports generated IF branch rules', "from './data/if-branch-rules.generated.js'"],
        ['runtime matches generated IF branch rules', 'function ifBranchRuleMatchScore'],
        ['runtime applies generated IF branch rules', 'function applyIfBranchRulesFromText'],
        ['runtime summarizes generated IF branch catalog', 'function summarizeIfBranchRuleCatalog'],
        ['runtime builds IF branch HUD state', 'function ifBranchRuleHudState'],
        ['HUD exposes IF branch panel', 'data-re0-if-branch-panel'],
        ['debug exposes IF branch rule metadata', 'branchRuleMetadata: ifBranchHud.metadata'],
        ['debug exposes relevant IF branch rules', 'relevantBranchRules: debugRelevantBranchRules.slice(0, 4)'],
        ['character dossier static patch metadata is exported', 'export const characterDossierStaticPatchMetadata'],
        ['character dossier static patch map is exported', 'export const characterDossierStaticPatch'],
        ['runtime imports character dossier static patch', "from './data/character-dossier-static-patch.generated.js'"],
        ['runtime stores static dossier patch metadata without touching dynamic fields', 'staticDossierPatch: staticPlan.id ?'],
        ['static dossier patch preserves runtime collision warnings', 'runtimeFieldCollisionWarnings'],
        ['character playLoop hook metadata is exported', 'export const characterPlayLoopHookMetadata'],
        ['character playLoop hook map is exported', 'export const characterPlayLoopHooks'],
        ['generated playLoop hooks preserve player-only causality policy', '玩家是唯一主动因果承载者'],
        ['runtime imports generated playLoop hooks', "from './data/character-playloop-hooks.generated.js'"],
        ['runtime resolves static playLoop hooks per profile', 'function staticPlayLoopHookForProfile'],
        ['runtime playLoop hook mode maps adult to safe static plan', "return 'adultSafe'"],
        ['play loop director exposes static hook metadata', 'staticHookMetadata:'],
        ['character agency hook records generated hook source', "source: staticHook ? 'static-playloop-hook' : 'runtime-card'"],
        ['runtime builds worldline tree HUD state', 'function worldlineTreeHudState'],
        ['HUD exposes worldline tree panel', 'data-re0-worldline-tree-panel'],
        ['debug exposes worldline tree summary', 'treeSummary: worldlineHud'],
        ['answer book syncs failure lesson into worldline tree', 'function syncAnswerBookToWorldlineFailure'],
        ['worldline failed node stores answer book lesson', 'node.answerBookLesson = answerBookLesson'],
        ['worldline failed node tracks retained answer book clues', 'lastAnswerBookWorldlineSync'],
        ['worldline tree tracks highlighted failed node', 'tree.lastFailedNodeId'],
        ['prompt summarizes synced answer book lesson', 'function summarizeLatestAnswerBookWorldlineLesson'],
        ['state prompt includes answer book worldline lesson section', '最近答案之书教训（已写入世界线失败节点）：'],
        ['runtime fact index promotes answer book death lesson to hot facts', "band: branch.answerBookLesson ? 'hot' : 'warm'"],
        ['debug hook can trigger death loop for E2E', 're0AdventureDebugTriggerDeath'],
        ['debug hook can answer answer-book question for E2E', 're0AdventureDebugAnswerBookReply'],
        ['anchor return carryover validator exists', 'function validateAnchorLessonCarryover'],
        ['anchor return sets carryover expectation', 'awaitingAnchorLessonCarryover = true'],
        ['narrative QA reports missing answer-book carryover', '未承接答案之书教训'],
        ['IF summary exposes structured branch nodes', '结构化 IF 节点:'],
        ['IF route state is normalized', 'function normalizeIfRouteLogicState'],
        ['IF route triggers are applied from user and narration text', 'function applyIfRouteLogicFromText'],
        ['IF route axis signals are applied', 'function applyIfRouteAxisSignals'],
        ['IF route axis scores are tracked', 'axisScores'],
        ['IF route has route momentum', 'routeMomentum'],
        ['IF route drift ledger is persisted', 'driftLedger'],
        ['IF route correction ledger is persisted', 'correctionLedger'],
        ['IF route soft locks are derived', 'function buildIfRouteSoftLocks'],
        ['IF route non-mainline stabilization exists', 'function stabilizeIfRouteLogic'],
        ['state prompt contains IF route attractor section', 'IF 线分歧吸引子：'],
        ['HUD exposes IF route tendency', 'data-re0-if-route'],
        ['HUD exposes generation/postprocess timing', 'lastGenerationMs'],
        ['postprocess timing is measured in updateStateQuietly', 'lastPostProcessMs'],
        ['generation timer starts on generation start event', 'generationStartedAt = performance.now()'],
        ['state prompt side effects are persisted', 'promptFlagsChanged'],
        ['empty scene presence falls back to narrator, not a story NPC', "sceneCharacters: scene.length ? scene : ['世界意志']"],
        ['paused mainline pulse exposes frozen counter', 'frozenMainlinePulseTurns'],
        ['world clock prompt says paused pulse cannot trigger mainline', '不会触发主线钟'],
        ['mobile character panel marks body as open', "document.body.classList.toggle('re0-character-panel-open', open)"],
        ['mobile character panel state is synchronized, not left stale', 'function syncCharacterPanelOpenClass'],
        ['browser UI recovery hook is installed', 'globalThis.re0AdventureRecoverUi = recoverAdventureUi'],
        ['URL recovery flag restores the UI', "has('re0_recover')"],
        ['Escape can recover character panel overlay', "document.body.classList.contains('re0-character-panel-open')"],
        ['message voice badge uses the actual voice profile', 'const profile = voiceSelection.voiceProfile || voiceSelection.profile'],
        ['voice selection debug hook exists', 're0AdventureSelectVoice'],
        ['audio playback debug hook exists', 're0AdventureAudioDebug'],
        ['audio replay preserves last voice profile after stop', 'currentAudioMeta = lastVoicePlayback ? { ...lastVoicePlayback } : null'],
        ['audio player restores active playback after HUD rerender', 'previousWasPlaying && player.paused'],
        ['audio metadata stores concrete TTS voice', 'voice: meta.voice ||'],
        ['HUD status is preserved across renderHud re-renders', "let hudStatusMessage = 'MiMo TTS 就绪'"],
        ['setHudStatus updates persistent HUD status state', 'hudStatusMessage = String(message ||'],
        ['cast director has dialogue separation policy', 'dialogueSeparationPolicy'],
        ['state prompt requires named character speech', '说话权必须分离'],
        ['play loop director state is built', 'function buildPlayLoopDirectorState'],
        ['play loop director is injected into prompt', '玩法导演层：'],
        ['debug snapshot exposes play loop director', 'playLoopDirector,'],
        ['play loop director carries death lesson strategy pivot', 'hasDeathLesson'],
        ['play loop director carries character agency hooks', 'characterAgencyHooks'],
        ['play loop choices are derived for VN actions', 'function playLoopChoiceHints'],
        ['play loop choices debug hook exists', 're0AdventureDebugPlayLoopChoices'],
        ['agent center facade exports turn builder', 'export function buildRe0AgentTurn'],
        ['agent center facade exports state observer', 'export function observeAgentState'],
        ['agent center facade exports validator', 'export function validateRe0AgentTurn'],
        ['agent center facade exports summarizer', 'export function summarizeRe0AgentTurn'],
        ['agent module contracts are declared', 'RE0_AGENT_MODULE_CONTRACTS'],
        ['agent contracts include StoryRAG module', 'StoryRAG:'],
        ['agent contracts include WorldContext module', 'WorldContext:'],
        ['world context builder exists', 'export function buildWorldContext'],
        ['world context summarizer exists', 'export function summarizeWorldContext'],
        ['agent turn plan imports WorldContext', "from './world-context.js'"],
        ['agent turn plan exposes WorldContext', 'worldContext,'],
        ['agent candidate policy uses WorldContext id', 'worldContextId'],
        ['state prompt imports WorldContext summarizer', "from './data/world-context.js'"],
        ['prompt compression treats AgentTurn as core', 'Agent 控制面 / 本轮计划：'],
        ['prompt compression treats WorldContext as core', '世界上下文决策契约：'],
        ['state prompt injects WorldContext summary', 'summarizeWorldContext(currentAgentTurn.worldContext'],
        ['agent endpoint sends WorldContext to MiMo director', 'worldContext: localAgentTurn.worldContext'],
        ['live playflow sends WorldContext payload', 'compactWorldContextPayload(agentTurn.worldContext'],
        ['agent contracts include SaveMemory isolation', "authority: 'current-save-only'"],
        ['agent contracts include AssetDirector module', 'AssetDirector:'],
        ['agent contracts include TTSDirector module', 'TTSDirector:'],
        ['agent facade reuses Story RAG retrieval', 'retrieveStoryRagWorkset'],
        ['agent facade reuses AgentTurnPlan', 'buildAgentTurnPlan'],
        ['agent facade reuses AssetPolicyEngine', 'buildAssetPlan'],
        ['agent facade evaluates asset use', 'evaluateAssetUse'],
        ['agent validation blocks death-return public leaks', 'deathReturnPublicLeakBlocked'],
        ['agent validation guards save scope isolation', 'saveScopeIsolation'],
        ['agent validation guards TTS system text exclusion', 'ttsSystemTextExcluded'],
        ['agent TTS plan excludes VN_SCRIPT and debug text', 'excludedSources'],
        ['runtime builds current Re0 Agent turn', 'function buildCurrentRe0AgentTurn'],
        ['runtime prompt summarizes Re0 Agent turn', 'summarizeRe0AgentTurn(turn'],
        ['debug snapshot exposes Agent facade turn', 'agentTurn: {'],
        ['debug snapshot exposes HostAdapter bridge', 'hostBridge: agentTurn.hostBridge'],
        ['agent endpoint returns facade turn result', 'agentTurn: localAgentTurn'],
        ['agent endpoint exposes facade validation status', 'agentValidation: localAgentTurn.validation'],
        ['visual novel choices carry UI-only metadata', 'function visualNovelChoiceMeta'],
        ['visual novel choice metadata includes actor/source/mode attrs', 'data-re0-choice-actor'],
        ['visual novel choice metadata is styled as Galgame badges', 're0-choice-meta'],
        ['debug snapshot exposes choice overlay metadata', 'choiceOverlayMeta'],
        ['character cards store play loop agency hook', 'lastPlayLoopHook'],
        ['narrative QA detects unseparated character speech', '角色台词未分离'],
        ['narrative QA extracts attributed speakers', 'function attributedSpeechSpeakers'],
        ['visual novel role metrics exist', 'function buildVisualNovelRoleMetrics'],
        ['visual novel role metrics are normalized', 'function normalizeVisualNovelRoleMetrics'],
        ['visual novel prompt exposes role validation', '角色发声验收'],
        ['visual novel hard speaker rule exists', '1f. 角色发声验收是硬指标'],
        ['api health check helper exists', 'function checkMimoApiHealth'],
        ['api health debug hook is installed', 're0AdventureApiHealthCheck'],
        ['visual novel parser debug hook is installed', 're0AdventureParseVisualNovel'],
        ['HUD exposes api self check button', 'data-re0-api-health'],
        ['api health self-heals SillyTavern online status', 'function syncCoreApiStatusFromHealth'],
        ['api health reuses cached ok result while in flight', 'if (apiHealthInFlight)'],
        ['api in-flight health still repairs stale send box', 'syncCoreApiStatusFromHealth(state.flags.apiHealth)'],
        ['api health keeps previous ok state while checking', 'keepSuccessfulHealthDuringProbe ? true : null'],
        ['api health restores last successful result', 'function restoreLastSuccessfulApiHealth'],
        ['api health removes stale send form no-connection class', "sendForm?.classList.remove('no-connection')"],
        ['api self-heal watcher exists', 'function scheduleMimoApiSelfHeal'],
        ['api self-heal listens for no_connection regressions', "event_types.ONLINE_STATUS_CHANGED"],
        ['api self-heal validates MiMo custom source before running', 'function shouldAutoHealMimoApiStatus'],
        ['closed answer book objective is sanitized', 'function sanitizeClosedAnswerBookObjective'],
        ['anchor return clears stale scene presence', "clearScenePresence(state, '答案之书返回锚点"],
        ['product diagnosis catches stale answer book objectives', '答案之书目标滞留'],
        ['read save preserves saved scene location during setup sync', 'syncLocation: false'],
        ['setup sync can intentionally control location when not loading saves', 'syncLocation = true'],
        ['debug snapshot exposes rollback report for save QA', 'lastRollbackReport: state.flags?.lastRollbackReport'],
        ['debug snapshot exposes setup canon for save isolation QA', 'settingSetupCanon: state.settingLayers?.setupCanon'],
        ['debug snapshot exposes character card preview for rollback QA', 'characterCards: {'],
        ['scene presence uses strict location matching', 'function isSceneLocationMatch'],
        ['generic parent locations are not treated as current scene', 'function isGenericParentLocation'],
        ['anchor return suppresses stale scene cache', 'anchorReturnResetWindow'],
        ['anchor return suppresses stale outcome-derived scene names', 'anchorReturnResetWindow ? [] : uniqueNames(splitNamesFromActors(recentSceneText), 8)'],
        ['visual novel mode setting exists', 'visualNovelModeEnabled'],
        ['visual novel script setting exists', 'visualNovelScriptEnabled'],
        ['visual novel default state exists', 'function buildDefaultVisualNovelState'],
        ['visual novel script parser exists', 'function parseVisualNovelScriptFromText'],
        ['visual novel hidden script block parser exists', 'function extractVisualNovelScriptBlock'],
        ['visual novel structured script normalizer exists', 'function normalizeVisualNovelScriptBlock'],
        ['visual novel safe statePatch applier exists', 'function applyVisualNovelSafeStatePatch'],
        ['visual novel statePatch debug hook is installed', 're0AdventureApplyVnStatePatch'],
        ['visual novel debug statePatch persists and rerenders', "const result = applyVisualNovelSafeStatePatch(state, patch, { source: 'debug-hook' })"],
        ['visual novel statePatch blocks core state', '死亡回归、存档、世界线、主线钟、天数、资源、flagTrigger、结局'],
        ['visual novel statePatch debug field is exposed', 'lastVnStatePatch'],
        ['visual novel prompt requests hidden script block', 'RE0_VN_SCRIPT'],
        ['visual novel script sync exists', 'function syncVisualNovelScriptFromNarration'],
        ['visual novel current script selector exists', 'function currentVisualNovelScript'],
        ['visual novel stage renderer exists', 'function syncVisualNovelStage'],
        ['visual novel stage consistency validator exists', 'function validateVisualNovelStageConsistency'],
        ['visual novel stage consistency syncs backdrop state', 'function syncVisualNovelBackdropState'],
        ['visual novel stage consistency report is persisted', 'lastVnStageConsistency'],
        ['visual novel stage consistency debug hook is installed', 're0AdventureValidateVnStageConsistency'],
        ['visual novel stage exposes consistency dataset', 're0VnStageConsistencySummary'],
        ['visual novel stage consistency feeds next-turn correction', '修复 VN舞台'],
        ['HUD exposes VN stage consistency', 'VN舞台'],
        ['visual novel single modal opener exists', 'function setVisualNovelModalOpen'],
        ['visual novel overlay closer exists', 'function closeVisualNovelOverlays'],
        ['visual novel active modal resolver exists', 'function visualNovelOpenModalName'],
        ['visual novel overlay conflict health check exists', 'VN 覆盖层互相重叠'],
        ['visual novel stage exposes open modal dataset', 're0VnOpenModal'],
        ['visual novel debug exposes effective open modal', 'openModal: effectiveVnOpenModal'],
        ['visual novel debug scope follows effective open modal', 'activeUiScope: effectiveVnActiveUiScope'],
        ['visual novel stage module is imported', "from './data/vn-stage.js'"],
        ['visual novel stage module owns markup composition', 'function renderVisualNovelStageMarkup'],
        ['visual novel stage renderer delegates markup composition', 'renderVisualNovelStageMarkupCore({'],
        ['visual novel controls module is imported', "from './data/vn-controls.js'"],
        ['visual novel controls module owns playback mode', 'function applyVisualNovelPlaybackMode'],
        ['visual novel controls module owns segment advance', 'function advanceVisualNovelRuntimeSegment'],
        ['visual novel controls module owns auto advance plan', 'function visualNovelAutoAdvancePlan'],
        ['visual novel controls module toggles backlog', 'function toggleVisualNovelBacklog'],
        ['visual novel events module is imported', "from './data/vn-events.js'"],
        ['visual novel events module owns action selector list', 'VISUAL_NOVEL_STAGE_ACTION_SELECTORS'],
        ['visual novel events module identifies stage actions', 'function identifyVisualNovelStageAction'],
        ['visual novel event delegation uses action identifier', 'identifyVisualNovelStageAction(event.target, stage)'],
        ['visual novel adapter module is imported', "from './data/vn-adapter.js'"],
        ['visual novel adapter declares action handler keys', 'VISUAL_NOVEL_ACTION_HANDLER_KEYS'],
        ['visual novel adapter builds action handlers', 'function createVisualNovelStageActionHandlers'],
        ['visual novel adapter dispatches stage actions', 'function dispatchVisualNovelStageAction'],
        ['visual novel event delegation uses action dispatch', 'dispatchVisualNovelStageAction(action, handlers)'],
        ['visual novel checkpoint module is imported', "from './data/vn-checkpoint.js'"],
        ['visual novel checkpoint module defines default state', 'function buildDefaultVisualNovelCheckpointState'],
        ['visual novel checkpoint module creates checkpoint records', 'function createVisualNovelCheckpoint'],
        ['visual novel checkpoint module records checkpoint history', 'function recordVisualNovelCheckpoint'],
        ['visual novel checkpoint module restores checkpoint state', 'function restoreVisualNovelCheckpoint'],
        ['visual novel runtime state owns checkpoint ledger', 'checkpoint: buildDefaultVisualNovelCheckpointState()'],
        ['visual novel stage exposes checkpoint button', 'data-re0-vn-checkpoint'],
        ['visual novel stage exposes rollback button', 'data-re0-vn-rollback'],
        ['visual novel stage exposes checkpoint count dataset', 're0VnCheckpointCount'],
        ['visual novel checkpoint debug hook is installed', 're0AdventureVnCheckpoint'],
        ['visual novel rollback debug hook is installed', 're0AdventureVnRollback'],
        ['visual novel keyboard module is imported', "from './data/vn-keyboard.js'"],
        ['visual novel keyboard declares key binding map', 'VISUAL_NOVEL_KEYBOARD_BINDINGS'],
        ['visual novel keyboard ignores editable targets', 'function isVisualNovelEditableTarget'],
        ['visual novel keyboard identifies stage actions', 'function identifyVisualNovelKeyboardAction'],
        ['visual novel keydown routes through VN shortcut handler', 'handleVisualNovelKeyboardShortcut(event)'],
        ['visual novel mode template module is imported', "from './data/vn-mode-template.js'"],
        ['visual novel mode template normalizes story mode', 'function normalizeVisualNovelStoryMode'],
        ['visual novel mode template builds route status', 'function buildVisualNovelModeTemplate'],
        ['visual novel mode template controls choice density', 'choiceLimit'],
        ['visual novel choice density is centralized', 'VISUAL_NOVEL_VISIBLE_CHOICE_LIMIT'],
        ['visual novel mode template controls cast density', 'castLimit'],
        ['visual novel mode template controls backdrop bias', 'backdropBiasKeywords'],
        ['visual novel mode template controls transition cue', 'transitionCue'],
        ['visual novel scene registry module is imported', "from './data/vn-scene-registry.js'"],
        ['visual novel scene registry builds merged catalog', 'function buildSceneBackdropCatalog'],
        ['visual novel scene registry merges generated duplicate images into base entries', 'imageUrl: item.imageUrl || planned.imageUrl'],
        ['visual novel scene registry builds key index', 'function buildSceneBackdropIndex'],
        ['visual novel scene registry exports scene catalog', 'export const sceneBackdropCatalog'],
        ['visual novel scene registry exports scene index', 'export const sceneBackdropByKey'],
        ['visual novel backdrop selector accepts mode template', 'function selectSceneBackdrop(state, modeTemplate = null)'],
        ['visual novel backdrop selector consumes template bias keywords', 'modeBiasText'],
        ['visual novel backdrop selector uses semantic scene boosts', 'function semanticSceneBackdropBoosts'],
        ['visual novel backdrop resolver prefers generated/user stage art before source-novel references', 'userSceneImageMap[backdrop.key] || backdrop.imageUrl || sourceNovelSceneImageMap[backdrop.key]'],
        ['visual novel backdrop selector can correct stale script keys', 'script-corrected'],
        ['visual novel backdrop diagnostics exist', 'function sceneBackdropCandidateDiagnostics'],
        ['visual novel backdrop match state persists', 'function recordSceneBackdropMatchState'],
        ['visual novel low confidence scene queue exists', 'function recordLowConfidenceSceneBackdropNeed'],
        ['visual novel stage exposes backdrop key dataset', 're0VnBackdropKey'],
        ['visual novel stage exposes backdrop confidence dataset', 're0VnBackdropConfidence'],
        ['debug snapshot exposes backdrop match', 'match: state.visuals?.sceneBackdrop?.lastMatch'],
        ['IF branch generator includes Arc8-Arc11 rules', 'ARC8_ARC11_IF_BRANCH_RULES_2026-05-28.json'],
        ['IF branch generator ingests choice tag patch files', 'choiceTagPatchFiles'],
        ['IF branch generated metadata exposes choice tag patch count', 'choiceTagPatchCount'],
        ['IF branch generated rules preserve death strategy pivots', 'deathChangesPlayerStrategy'],
        ['IF branch generated choices preserve tagged action choices', 'choices: taggedChoices'],
        ['IF branch generated choices preserve normal action choice', 'normalChoice'],
        ['IF branch runtime preserves choice overlay player-facing choices', 'playerFacingChoices'],
        ['explicit IF objectives preserve IF overlay priority', "const explicitIfProbe = !!currentObjectiveIfRuleId(state) && overlay.source === 'if-branch-rule'"],
        ['non-IF visual novel choices prioritize current script and scene state', ': mergeVisualNovelChoiceSources(\n            scriptChoices,\n            contextualChoices,\n            divergentChoices'],
        ['IF branch debug exposes choice tags', 'choiceTags: Array.isArray(rule.choiceOverlayHints?.choices)'],
        ['generated IF branch rules expose choice overlay hints', 'choiceOverlayHints'],
        ['visual novel choice overlay selector exists', 'function selectVisualNovelChoiceOverlayHints'],
        ['visual novel choice overlay state recorder exists', 'function recordVisualNovelChoiceOverlayState'],
        ['visual novel single-scene NPC quote fallback exists', 'function fallbackVisualNovelDialogueProfileForLine'],
        ['visual novel choices consume template limit', 'visualNovelChoiceList(state, script, modeTemplate.choiceLimit)'],
        ['visual novel cast consumes template limit', 'visualNovelCastProfiles(state, text, modeTemplate.castLimit, script)'],
        ['visual novel mode template classes are applied to stage', 'stage.classList.add(modeTemplate.className)'],
        ['visual novel stage exposes story mode dataset', 're0VnStoryMode'],
        ['visual novel stage exposes choice limit dataset', 're0VnChoiceLimit'],
        ['visual novel stage exposes choice overlay source dataset', 're0VnChoiceOverlaySource'],
        ['visual novel stage exposes choice overlay choices dataset', 're0VnChoiceOverlayChoices'],
        ['visual novel stage exposes soft branch choice overlay dataset', 're0VnChoiceOverlaySoftness'],
        ['soft branch transition updater exists', 'function updateSoftBranchTransition'],
        ['IF branch transition uses soft attractor mode', 'soft-attractor'],
        ['IF prompt defines continuous attractor domain', '连续吸引域'],
        ['IF branch generated rules merge soft divergence matrix', 'softDivisionCount'],
        ['IF branch generated rules expose per-rule soft division payload', 'softDivision'],
        ['IF branch runtime applies per-rule soft lock thresholds', 'softDivision?.softLocks'],
        ['IF branch prompt summarizes soft division continuity risk', '连续性='],
        ['visual novel stage exposes cast limit dataset', 're0VnCastLimit'],
        ['visual novel stage exposes transition cue dataset', 're0VnTransitionCue'],
        ['visual novel transition module is imported', "from './data/vn-transition.js'"],
        ['visual novel transition module builds snapshots', 'function buildVisualNovelTransitionSnapshot'],
        ['visual novel transition module records events', 'function recordVisualNovelTransition'],
        ['visual novel transition classes are removed before apply', 'VISUAL_NOVEL_TRANSITION_CLASS_NAMES'],
        ['visual novel transition state is persisted in VN runtime', 'transition: {'],
        ['visual novel transition snapshot records backdrop', 'backdropKey: backdrop.key'],
        ['visual novel transition snapshot records cast', 'castIds: cast.map'],
        ['visual novel transition snapshot records speaker', 'speakerName: speakerLabel'],
        ['visual novel stage exposes transition summary', 're0VnTransitionSummary'],
        ['visual novel stage exposes transition event list', 're0VnTransitionEvents'],
        ['visual novel transition CSS covers backdrop', 're0-vn-transition-backdrop'],
        ['visual novel transition CSS covers cast', 're0-vn-transition-cast'],
        ['visual novel transition CSS covers speaker', 're0-vn-transition-speaker'],
        ['visual novel transition CSS covers mode', 're0-vn-transition-mode'],
        ['visual novel daily template CSS exists', 're0-vn-story-daily'],
        ['visual novel mainline template CSS exists', 're0-vn-story-mainline'],
        ['visual novel adult template CSS exists', 're0-vn-story-adult'],
        ['visual novel answer template CSS exists', 're0-vn-story-answer'],
        ['visual novel stage uses current cast profiles', 'function visualNovelCastProfiles'],
        ['visual novel distinguishes in-frame mentions from remote mentions', 'function detectInFrameMentionedProfiles'],
        ['visual novel cast cue matcher exists', 'function profileHasInFrameCue'],
        ['visual novel safe cast sanitizer exists', 'function safeVisualNovelCastProfiles'],
        ['visual novel stage exposes cast ids dataset', 're0VnCastIds'],
        ['visual novel stage exposes scene cast ids dataset', 're0VnSceneCastIds'],
        ['visual novel stage exposes cast source dataset', 're0VnCastSource'],
        ['visual novel stage distinguishes sprite and portrait assets', 'function resolveCharacterStageAsset'],
        ['visual novel stage asset debug resolver exists', 're0AdventureResolveStageAsset'],
        ['visual novel portrait-card fallback exists for characters without sprites', 're0-vn-character-portrait'],
        ['visual novel sprite assets remain first-class', 're0-vn-character-sprite'],
        ['visual novel stage does not treat official/source portraits as transparent sprites', '|| generatedCharacterSpriteMap[id]);'],
        ['visual novel character images do not intercept card clicks', '.re0-vn-character img'],
        ['visual novel character image pointer events are disabled', 'pointer-events: none'],
        ['mobile visual novel character width is narrowed for tap stability', 'width: min(25vw, 132px)'],
        ['death anchor system backdrop is registered', 'death_anchor__black_shadow.png'],
        ['answer book system backdrop is registered', 'answer_book__open.png'],
        ['worldline tree system backdrop is registered', 'worldline_tree__stable.png'],
        ['witch interference system backdrop is registered', 'witch_interference__heart_pressure.png'],
        ['character concept map is exported', 'export const generatedCharacterConceptMap'],
        ['protagonist transparent sprite is registered', 'characters/protagonist/sprite/protagonist__pose-idle__expr-neutral__outfit-default.png'],
        ['narrator transparent sprite is registered', 'characters/narrator/sprite/narrator__pose-system_avatar__expr-neutral__outfit-ceremonial.png'],
        ['lishelle transparent sprite is registered', 'characters/lishelle/sprite/lishelle__pose-idle__expr-soft_smile__outfit-nun_rain.png'],
        ['owen transparent sprite is registered', 'characters/owen/sprite/owen__pose-interrogate__expr-cold__outfit-guard_coat.png'],
        ['mia transparent sprite is registered', 'characters/mia/sprite/mia__pose-hide_clue__expr-fear__outfit-slum_rain.png'],
        ['bellringer transparent sprite is registered', 'characters/bellringer/sprite/bellringer__pose-ritual__expr-cold_laugh__outfit-cult_robe.png'],
        ['bell stripper transparent sprite is registered', 'characters/bell_stripper/sprite/bell_stripper__pose-ritual__expr-cold_laugh__outfit-cult_robe.png'],
        ['character sprite variant map is exported', 'export const generatedCharacterSpriteVariantMap'],
        ['character sprite variant map is imported by runtime', 'generatedCharacterSpriteVariantMap,'],
        ['visual novel runtime resolves sprite variants', 'function resolveCharacterSpriteVariantImage'],
        ['visual novel runtime scores sprite variants from text', 'function spriteVariantSignalsFromText'],
        ['visual novel stage exposes sprite variant key', 'data-re0-asset-variant-key'],
        ['visual novel runtime blocks adult variants outside adult mode', "mode === 'adult'"],
        ['visual novel adult insert CG is hard-gated to adult story mode', 'adult insert CG disabled outside adult story mode'],
        ['visual novel stage passes story mode to asset resolver', 'storyMode: modeTemplate.mode'],
        ['visual novel stage passes current segment to asset resolver', 'segment: script.currentSegment'],
        ['visual novel choices render as draggable action sidebar', 're0-vn-action-sidebar'],
        ['visual novel action sidebar consolidates utility controls', 're0-vn-sidebar-tools'],
        ['visual novel choices remain persistent during dialogue', 'const choiceItems = visualNovelChoiceList(state, script, modeTemplate.choiceLimit)'],
        ['visual novel choices can be collapsed to avoid blocking clicks', 'choicesCollapsed'],
        ['visual novel choices expose collapse toggle', 'data-re0-vn-toggle-choices'],
        ['visual novel choices expose drag handle', 'data-re0-vn-choice-drag-handle'],
        ['visual novel choices expose reset position control', 'data-re0-vn-reset-choices-position'],
        ['visual novel choice position is persisted in runtime state', 'choiceOverlayPosition'],
        ['mobile VN action sidebar auto-collapses before it can block character cards', 'mobileAutoCollapseApplied'],
        ['visual novel choice position can be clamped to stage', 'function clampVisualNovelChoiceOverlayPosition'],
        ['visual novel choice position can be applied without rerender', 'function applyVisualNovelChoiceOverlayPosition'],
        ['visual novel choices have collapsed CSS state', '.re0-vn-choices-overlay.is-collapsed'],
        ['visual novel choices have manual drag CSS state', '.re0-vn-choices-overlay.is-manual'],
        ['visual novel choices separate header from scroll body', 're0-vn-choice-body'],
        ['visual novel choices preserve abstract anchor terms as hidden context only', 'choiceOverlayContextTerms'],
        ['visual novel choices convert abstract terms into concrete actions', 'function concreteChoiceFromContextTerm'],
        ['visual novel choices can be manually refreshed', 'data-re0-vn-refresh-choices'],
        ['visual novel custom action input exists', 'data-re0-vn-custom-input'],
        ['visual novel choice impact metadata exists', 'data-re0-choice-impact-logic'],
        ['visual novel choices expose selected choice index', 'selectedChoiceIndex'],
        ['visual novel choices sync selected DOM state', 'function syncVisualNovelChoiceSelectionDom'],
        ['visual novel choices support keyboard selection', 'function handleVisualNovelChoiceKeyboard'],
        ['visual novel choice selection style exists', '.re0-vn-choice.is-selected'],
        ['visual novel toolbar exposes load control', 'data-re0-vn-load'],
        ['visual novel toolbar exposes config control', 'data-re0-vn-config'],
        ['visual novel config sync helper exists', 'function syncVisualNovelConfigState'],
        ['visual novel config snapshot helper exists', 'function visualNovelConfigSnapshot'],
        ['visual novel config sync timestamp exists', 'lastConfigSync'],
        ['visual novel stage exposes text opacity dataset', 're0VnTextOpacity'],
        ['visual novel stage exposes auto delay dataset', 're0VnAutoDelayMs'],
        ['visual novel stage exposes skip delay dataset', 're0VnSkipDelayMs'],
        ['visual novel stage exposes immersive setting dataset', 're0VnImmersiveUiHidden'],
        ['visual novel choices no longer block on final segment only', 'function currentSegmentChoiceHints'],
        ['immersive mode hides VN chrome, not backdrop/cast', 'body.re0-immersive-ui-hidden #re0-vn-stage .re0-vn-dialogue-box'],
        ['immersive mode keeps VN stage visible', 'body.re0-immersive-ui-hidden #re0-vn-stage {\n    opacity: 1 !important;'],
        ['VN collapsed HUD does not cover toolbar', 'body.re0-vn-mode #re0-adventure-hud.re0-collapsed'],
        ['VN toolbar offsets away from collapsed HUD', 'body.re0-vn-mode #re0-vn-stage .re0-vn-toolbar'],
        ['VN toast notifications do not intercept toolbar clicks', 'body.re0-vn-mode #toast-container'],
        ['memory prompt policy uses P0-P8 tiers', 'P0-P2 总是注入'],
        ['memory prompt diagnostics record dropped sections', 'function buildPromptCompressionDiagnostics'],
        ['memory facts include not injected reasons', 'notInjectedReason'],
        ['adult protagonist sprite variant is registered', 'adult.close_whisper.longing.private_indoor'],
        ['adult lishelle sprite variant is registered', 'adult.sit_bedside.vulnerable.night_robe'],
        ['adult owen sprite variant is registered', 'adult.loosen_collar.possessive.private_indoor'],
        ['adult emilia sprite variant is registered', 'adult.turn_blush.flustered.private_indoor'],
        ['visual novel stage exposes choices', 'function visualNovelChoicesMarkup'],
        ['visual novel stage exposes backlog', 'data-re0-vn-backlog'],
        ['visual novel stage exposes pagination', 'data-re0-vn-next'],
        ['visual novel stage exposes autoplay', 'data-re0-vn-auto'],
        ['visual novel stage exposes skip', 'data-re0-vn-skip'],
        ['visual novel stage exposes current speaker dataset', 're0VnCurrentSpeakerName'],
        ['visual novel stage exposes current segment type dataset', 're0VnCurrentSegmentType'],
        ['visual novel stage exposes script source dataset', 're0VnScriptSource'],
        ['visual novel stage exposes current speaker badge', 'data-re0-vn-current-speaker'],
        ['visual novel click-to-advance exists', 'data-re0-vn-advance-line'],
        ['visual novel event delegation exists', 'function installVisualNovelStageEventDelegation'],
        ['visual novel stage installs delegated events', 'installVisualNovelStageEventDelegation(stage)'],
        ['visual novel playback scheduler exists', 'function scheduleVisualNovelAutoAdvance'],
        ['visual novel timer cleanup exists', 'function clearVisualNovelAutoTimer'],
        ['visual novel stage is synchronized from HUD render', 'syncVisualNovelStage(state, context)'],
        ['visual novel stage has CSS layer', '#re0-vn-stage'],
        ['visual novel stage has explicit viewport height', 'height: 100dvh'],
        ['roadside inn bitmap backdrop is registered', "key: 'roadside_inn'"],
        ['archive annex bitmap backdrop is registered', 'archive_annex_night.png'],
        ['visual novel progress has CSS layer', '.re0-vn-progress'],
        ['visual novel active playback CSS exists', '.re0-vn-progress button.is-active'],
        ['visual novel backlog has CSS layer', '.re0-vn-backlog'],
        ['VN mode hides underlying SillyTavern chat instead of leaving dead controls visible', 'body.re0-vn-mode #chat'],
        ['VN mode uses visibility hidden for underlying chat controls', 'visibility: hidden !important'],
        ['mobile VN mode disables SillyTavern shell pointer interception', 'body.re0-vn-mode #sheld'],
        ['mobile VN mode disables background pointer interception', 'body.re0-vn-mode #bg1'],
        ['mobile VN mode raises stage above input chrome', 'body.re0-vn-mode #re0-vn-stage'],
        ['mobile VN dialogue is bounded to a bottom text box', 'max-height: min(30vh, 240px)'],
        ['forbidden library bitmap backdrop is registered', 'forbidden_library_antechamber_night.png'],
        ['sanctuary tomb bitmap backdrop is registered', 'sanctuary_tomb_dusk.png'],
        ['capital gate bitmap backdrop is registered', 'capital_gate_day.png'],
        ['tavern common room bitmap backdrop is registered', 'tavern_common_room_night.png'],
        ['noble salon bitmap backdrop is registered', 'noble_salon_evening.png'],
        ['forest road checkpoint bitmap backdrop is registered', 'forest_road_checkpoint_dusk.png'],
        ['healer clinic bitmap backdrop is registered', 'healer_clinic_rain.png'],
        ['witch cult hideout bitmap backdrop is registered', 'witch_cult_hideout_candle.png'],
        ['capital sewer bitmap backdrop is registered', 'capital_sewer_tunnel.png'],
        ['capital rooftops bitmap backdrop is registered', 'capital_rooftops_night.png'],
        ['arlam village night bitmap backdrop is registered', 'arlam_village_night.png'],
        ['mansion exterior bitmap backdrop is registered', 'mansion_exterior_day.png'],
        ['mansion kitchen bitmap backdrop is registered', 'mansion_kitchen_morning.png'],
        ['mansion courtyard bitmap backdrop is registered', 'mansion_courtyard_dusk.png'],
        ['mansion guest room bitmap backdrop is registered', 'mansion_guest_room_night.png'],
        ['mansion study bitmap backdrop is registered', 'mansion_study_twilight.png'],
        ['mansion bath bitmap backdrop is registered', 'mansion_bath_steam.png'],
        ['priestella inn room bitmap backdrop is registered', 'priestella_inn_room_night.png'],
        ['priestella sluice control bitmap backdrop is registered', 'priestella_sluice_control_room_night.png'],
        ['imperial command tent bitmap backdrop is registered', 'imperial_command_tent_night.png'],
        ['kararagi caravanserai bitmap backdrop is registered', 'kararagi_caravanserai_evening.png'],
        ['gusteko village house bitmap backdrop is registered', 'gusteko_village_house_interior.png'],
        ['augria sand dunes bitmap backdrop is registered', 'augria_sand_dunes_night.png'],
        ['great waterfall safe bitmap backdrop is registered', 'great_waterfall_edge_dawn.png'],
        ['great waterfall storm bitmap backdrop is registered', 'great_waterfall_edge_storm.png'],
        ['wilderness camp bitmap backdrop is registered', 'wilderness_camp_night.png'],
    ];
    const missing = required.filter(([, needle]) => !productSource.includes(needle)).map(([label]) => label);
    if (missing.length) {
        throw new Error(`Re:0 product experience guards missing: ${missing.join(', ')}`);
    }
    const forbiddenCanonChoiceTemplates = [
        '按宅邸一周的因果排查诅咒源',
        '承认我需要同盟，把王选、白鲸和怠惰危机整理成可交易证据链',
        '拒绝用死亡刷最优解，把圣域试炼、宅邸袭击和碧翠丝契约拆成双线协作',
        '围绕水门都市广播、司教权能和多阵营协作推进',
        '以名字、记忆和监视塔规则取证',
        '在帝国规则里先保命、结盟、积累战团信任',
        '沿阿尔权能、王选动荡和封印代价追查',
        '沿六枚舌、青蛇和王都撤离线取证',
    ].filter((needle) => source.includes(needle));
    if (forbiddenCanonChoiceTemplates.length) {
        throw new Error(`Hardcoded canon route choice templates must stay RAG-generated: ${forbiddenCanonChoiceTemplates.join(' / ')}`);
    }
    if (!/function canonRouteFollowChoice[\s\S]*retrieveStoryRagWorkset/u.test(source)) {
        throw new Error('canonRouteFollowChoice must use StoryRAG instead of arc-number hardcoded route templates.');
    }
    if (!storyRag.includes("'原作行动'") || !storyRag.includes('function isCanonActionIntent')) {
        throw new Error('StoryRAG must treat explicit 原作行动 as canon-follow intent before IF/world-essence routing.');
    }
    if (!/RE0_MIMO_TIMEOUT_MS \|\| 180_000/u.test(liveDirectorAudit)) {
        throw new Error('Live director audit default MiMo timeout must stay at least 180s; real calls often exceed 60s.');
    }
    const backendRequired = [
        ['backend IF profiles are defined', 'const backendIfRouteProfiles'],
        ['backend IF axis rules are defined', 'const backendIfRouteAxisRules'],
        ['backend IF pleasure grammar is defined', 'const backendIfRoutePleasureGrammar'],
        ['backend IF prompt exposes pleasure', 'pleasure: pleasure.pleasure'],
        ['backend shard selection uses IF state', 'function selectShards(parallelism, state = {})'],
        ['backend shard prompt receives IF route summary', 'summarizeIfRouteForPrompt(state)'],
        ['backend world sim can patch IF route logic', 'function buildIfRoutePatchFromWorldSim'],
        ['backend IF patch ignores shard metadata self-reinforcement', 'function ifRouteSignalTextFromShardResult'],
        ['backend IF patch tracks route momentum', 'routeMomentum'],
        ['backend IF patch tracks drift ledger', 'driftLedger'],
        ['backend IF patch tracks correction ledger', 'correctionLedger'],
        ['backend patch writes ifRouteLogic', 'ifRouteLogic: ifRoutePatch || undefined'],
        ['backend writes local memory snapshots', "router.post('/memory-snapshot'"],
        ['backend sanitizes memory filenames', 'function sanitizeMemoryFilename'],
        ['backend writes runtime memory manifest', 'function writeMemorySnapshot'],
        ['backend writes runtime memory root index', 'function writeRuntimeMemoryIndex'],
        ['backend exposes memory root index docs', 'INDEX.md'],
    ];
    const backendMissing = backendRequired.filter(([, needle]) => !backend.includes(needle)).map(([label]) => label);
    if (backendMissing.length) {
        throw new Error(`Re:0 backend IF route guards missing: ${backendMissing.join(', ')}`);
    }
    const forbidden = [
        '主线在后台按时间、地点',
        '主线只在后台推进并通过后果回响',
        '主线钟会在后台世界日、时间推进或世界推演中发展',
        "sceneCharacters: scene.length ? scene : ['莉榭尔·阿尔戈']",
        'playableActionHints(state, 4)',
        'function playLoopChoiceHints(state, limit = 4)',
        'function selectVisualNovelChoiceOverlayHints(state, limit = 4)',
        'function currentSegmentChoiceHints(state, script = null, limit = 4)',
        'function divergentActionChoices(state, script = null, limit = 4)',
        'function visualNovelChoicePool(state, script = null, limit = 4)',
        'function visualNovelChoiceList(state, script = null, limit = 4)',
        'function recordVisualNovelChoiceOverlayState(state, choices = [], limit = 4',
    ];
    const stale = forbidden.filter((needle) => source.includes(needle));
    if (stale.length) {
        throw new Error(`Stale Re:0 mainline/background policy text found: ${stale.join(', ')}`);
    }
    if (!style.includes('body.re0-character-panel-open #re0-adventure-hud')) {
        throw new Error('Re:0 mobile character panel guard missing: HUD must hide while character panel is open on narrow viewports.');
    }
}

function validateE2ESmokeTest() {
    const source = fs.readFileSync(rel('tests/re0-adventure-engine.e2e.js'), 'utf8');
    const required = [
        ['browser debug snapshot is asserted', 'window.re0AdventureDebug'],
        ['API self-heal hook is exercised', 'window.re0AdventureApiHealthCheck'],
        ['stale no-connection UI is simulated', "classList.add('no-connection')"],
        ['stale no-connection UI is asserted recovered', 'sendNoConnection'],
        ['scene backdrop is asserted', 'backdropImageUrl'],
        ['sidecar size is bounded', 'sidecarLength'],
        ['generation timing fields are asserted', 'lastGenerationMs'],
        ['postprocess timing fields are asserted', 'lastPostProcessMs'],
        ['rendered game snapshot is parsed', 'JSON.parse(snapshot.renderedText)'],
        ['world clock policy is asserted', 'mainline-pulse-(paused|active)'],
        ['visual novel stage is asserted', 'vnVisible'],
        ['underlying chat is hidden while VN stage is active', 'chatVisibility'],
        ['underlying message voice button is hidden in VN mode', "#chat .re0-message-voice"],
        ['visual novel debug state is asserted', 'debug.visualNovel.visible'],
        ['visual novel hidden script parser is asserted', 're0AdventureParseVisualNovel'],
        ['visual novel safe statePatch is asserted', 're0AdventureApplyVnStatePatch'],
        ['visual novel statePatch blocks core fields in E2E', "blocked).toEqual(expect.arrayContaining(['returnByDeath', 'worldline', 'worldClock']))"],
        ['visual novel E2E covers generated Al sprite mode', "al.mode).toBe('sprite')"],
        ['visual novel E2E covers generated Anastasia sprite mode', "anastasia.mode).toBe('sprite')"],
        ['visual novel E2E covers generated Julius sprite mode', "julius.mode).toBe('sprite')"],
        ['visual novel E2E covers generated Priscilla sprite mode', "priscilla.mode).toBe('sprite')"],
        ['visual novel E2E rejects SVG stage assets', "\\.svg(?:$|[?#])"],
        ['visual novel hidden script source is asserted', "sourceMode).toBe('hidden-comment')"],
        ['visual novel E2E asserts story mode dataset', 'vnStoryMode'],
        ['visual novel E2E asserts story mode class', 'vnStoryClass'],
        ['visual novel E2E asserts pacing hint', 'vnPacingHint'],
        ['visual novel E2E asserts mode choice limit', 'vnChoiceLimit'],
        ['visual novel E2E asserts expanded action choice density', 'vnChoiceLimit).toBeGreaterThanOrEqual(8)'],
        ['visual novel E2E asserts choice overlay source', 'vnChoiceOverlaySource'],
        ['visual novel E2E asserts hidden abstract context terms', 'vnChoiceOverlayContextTerms'],
        ['visual novel E2E asserts choice overlay toggle', 'vnHasChoiceToggle'],
        ['visual novel E2E asserts choice overlay drag handle', 'vnHasChoiceDragHandle'],
        ['visual novel E2E asserts choice overlay reset control', 'vnHasChoicePositionReset'],
        ['visual novel E2E asserts soft branch choice overlay', 'choiceOverlaySoftness'],
        ['visual novel E2E asserts IF choice overlay rule', "choiceOverlaySource).toBe('if-branch-rule')"],
        ['visual novel E2E asserts branchTransition debug', 'branchTransition.mode'],
        ['visual novel E2E asserts single-scene NPC quote fallback', 'singleSceneQuoteParse'],
        ['visual novel E2E asserts mode cast limit', 'vnCastLimit'],
        ['visual novel E2E asserts cast ids dataset', 'vnCastIds'],
        ['visual novel E2E rejects remote-only Al cast pollution', "not.toContain('al')"],
        ['visual novel E2E asserts transition cue', 'vnTransitionCue'],
        ['visual novel E2E asserts transition summary', 'vnTransitionSummary'],
        ['visual novel E2E asserts transition events', 'vnTransitionEvents'],
        ['visual novel E2E asserts checkpoint count', 'vnCheckpointCount'],
        ['visual novel E2E asserts checkpoint latest summary', 'vnCheckpointLatest'],
        ['visual novel E2E asserts stage consistency dataset', 'vnStageConsistencySummary'],
        ['visual novel E2E asserts debug stage consistency', 'stageConsistencyStatus'],
        ['visual novel E2E asserts asset plan backdrop dataset', 'vnAssetPlanBackdropKey'],
        ['visual novel E2E asserts asset plan candidates', 'vnAssetPlanCandidateKeys'],
        ['visual novel E2E asserts debug asset plan sync', 'assetPlanBackdropKey).toBe(snapshot.vnAssetPlanBackdropKey)'],
        ['visual novel E2E asserts backdrop key dataset', 'vnBackdropKey'],
        ['visual novel E2E asserts backdrop confidence', 'vnBackdropConfidence'],
        ['visual novel E2E asserts backdrop candidate list', 'backdropCandidateKeys'],
        ['visual novel E2E asserts open modal dataset', 'vnOpenModal'],
        ['visual novel E2E asserts open modal count', 'openModalCount'],
        ['visual novel E2E exercises checkpoint debug hook', 're0AdventureVnCheckpoint'],
        ['visual novel E2E exercises rollback button', 'data-re0-vn-rollback'],
        ['visual novel E2E asserts choices respect mode limit', 'vnChoiceCount).toBeLessThanOrEqual(snapshot.vnChoiceLimit)'],
        ['visual novel E2E asserts choice metadata badges', 'vnChoiceMeta.every'],
        ['visual novel E2E asserts choice mode dataset', 'vnChoiceMode'],
        ['VN stress covers keyboard choice selection', "page.keyboard.press('ArrowDown')"],
        ['VN stress covers keyboard choice apply', "page.keyboard.press('Enter')"],
        ['realistic VN interaction stress flow exists', 'survives a realistic visual-novel interaction stress flow'],
        ['VN stress covers backlog open/close', 'data-re0-vn-backlog-close'],
        ['VN stress covers keyboard backlog shortcut', "page.keyboard.press('b')"],
        ['VN stress covers keyboard immersive shortcut', "page.keyboard.press('h')"],
        ['VN stress covers keyboard auto shortcut', "page.keyboard.press('a')"],
        ['VN stress covers config panel open', 'data-re0-vn-config'],
        ['VN stress covers text opacity slider', 'data-re0-vn-text-opacity'],
        ['VN stress asserts text opacity debug', 'textOpacityPercent)).toBe(65)'],
        ['VN stress asserts auto delay debug', 'autoDelayMs)).toBe(1800)'],
        ['VN stress asserts skip delay debug', 'skipDelayMs)).toBe(300)'],
        ['VN stress asserts config sync trail', 'configSyncTrail'],
        ['VN stress covers choice-to-input flow', 'data-re0-vn-choice'],
        ['VN stress asserts choice overlay does not overlap dialogue', 'overlayDialogueOverlap'],
        ['VN stress asserts choice overlay collapsed keyboard safety', 'selectedBeforeCollapse'],
        ['VN stress drags candidate-action overlay', 'beforeDragPosition'],
        ['VN stress resets candidate-action overlay position', 'reset-choices-position'],
        ['VN stress covers character panel open/close', '#re0-character-panel'],
        ['VN stress covers immersive UI toggle', 're0-immersive-ui-hidden'],
        ['VN stress checks stage image loading', 'missingStageImages'],
        ['mobile narrow viewport stress flow exists', 'keeps the visual-novel UI usable on a narrow mobile viewport'],
        ['mobile stress checks document overflow', 'docScrollWidth'],
        ['mobile stress checks top menu-dialogue separation', 'topbarDialogueOverlap'],
        ['mobile stress checks choice-dialogue separation', 'choicesDialogueOverlap'],
        ['mobile stress verifies character panel body state', 're0-character-panel-open'],
        ['save/load setup isolation stress flow exists', 'preserves save/load rollback and new-world setup isolation through the merged sidebar workflow'],
        ['save/load stress uses VN save button', 'data-re0-vn-save'],
        ['save/load stress uses VN load button', 'data-re0-vn-load-save'],
        ['save/load stress covers VN new story button', 'data-re0-vn-new-game'],
        ['save/load stress covers VN start-world button', 'data-re0-vn-start-world'],
        ['save/load stress detects polluted location rollback', 'E2E 污染后的错误地点'],
        ['save/load stress asserts context isolation notice', 'contextIsolationNotice'],
        ['save/load stress asserts setup canon', 'settingSetupCanon'],
        ['voice profile stress flow exists', 'keeps character voice text, profile selection, and playback controls consistent'],
        ['voice stress mocks MiMo TTS endpoint', '**/api/mimo-tts/generate'],
        ['voice stress asserts VN voice button', 'data-re0-vn-voice'],
        ['voice stress asserts VN pause control', 'data-re0-vn-pause-audio'],
        ['voice stress asserts VN replay control', 'data-re0-vn-replay-audio'],
        ['voice stress asserts VN stop control', 'data-re0-vn-stop-audio'],
        ['voice stress asserts prompt cannot rewrite source text', '只朗读 assistant 消息中的原文'],
        ['worldline tree HUD is asserted', 'worldlineTreePanelText'],
        ['worldline tree debug summary is asserted', 'worldline.treeSummary'],
        ['worldline tree debug exposes failed node marker', 'lastFailedNodeId'],
        ['worldline tree row exposes answer book retained clue count', 'retainedClueCount'],
        ['death return answer book loop E2E exists', 'links death return, answer book, worldline failed node, and anchor return into one loop'],
        ['death return E2E triggers debug death', 're0AdventureDebugTriggerDeath'],
        ['death return E2E returns anchor', 're0AdventureDebugReturnAnchor'],
        ['E2E asserts play loop director debug state', 'snapshot.debug.playLoopDirector.version'],
        ['E2E asserts generated playLoop hook metadata', 'staticHookMetadata.count'],
        ['E2E asserts generated playLoop hook source reaches runtime', "hook.source === 'static-playloop-hook'"],
        ['E2E asserts play loop choices', 'window.re0AdventureDebugPlayLoopChoices'],
        ['E2E asserts anchor return play loop uses death lesson', 'returnResult.debug.playLoopDirector.deathRisk.hasDeathLesson'],
        ['death return E2E validates bad anchor carryover', 'badCarryover.pass).toBe(false)'],
        ['death return E2E validates good anchor carryover', 'goodCarryover.pass).toBe(true)'],
    ];
    const missing = required.filter(([, needle]) => !source.includes(needle)).map(([label]) => label);
    if (missing.length) {
        throw new Error(`Re:0 E2E smoke test guards missing: ${missing.join(', ')}`);
    }
}

function validateLatestLiveDirectorAuditReport() {
    const qaDirPath = 'data/default-user/re0-engine/collab/inbox/qa';
    const qaDir = rel(`${qaDirPath}/`);
    if (!fs.existsSync(qaDir)) {
        throw new Error('No QA inbox exists for live Mimo director audit evidence.');
    }
    const candidates = fs.readdirSync(qaDir)
        .filter((file) => /^RE0_LIVE_DIRECTOR_AUDIT_\d{8}-\d{6}\.json$/u.test(file))
        .sort();
    if (!candidates.length) {
        throw new Error('Missing live Mimo director audit report. Run `npm run re0:director:live-audit` before release check.');
    }
    const latest = candidates[candidates.length - 1];
    const report = JSON.parse(fs.readFileSync(rel(`${qaDirPath}/${latest}`), 'utf8'));
    const generatedAt = Date.parse(report.generatedAt || '');
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(generatedAt)) {
        throw new Error(`Live director audit report has invalid generatedAt: ${latest}`);
    }
    if (Date.now() - generatedAt > maxAgeMs) {
        throw new Error(`Live director audit report is stale: ${latest}. Run \`npm run re0:director:live-audit\`.`);
    }
    if (report.liveMimoRequired !== true || report.mockAllowed !== false) {
        throw new Error(`Live director audit report is not a strict real-Mimo run: ${latest}`);
    }
    if (report.status !== 'pass' || Number(report.total || 0) < 7 || report.pass !== report.total || report.warn !== 0 || report.block !== 0) {
        throw new Error(`Live director audit report is not clean: ${latest} status=${report.status} pass=${report.pass}/${report.total} warn=${report.warn} block=${report.block}`);
    }
    const results = Array.isArray(report.results) ? report.results : [];
    if (results.length !== report.total || results.some((item) => item?.live !== true || item?.status !== 'pass')) {
        throw new Error(`Live director audit report contains non-live or non-pass scenario rows: ${latest}`);
    }
    if (!String(report.model || '').includes('mimo')) {
        throw new Error(`Live director audit report model is not Mimo: ${report.model || 'missing'}`);
    }
    return {
        file: latest,
        model: report.model,
        total: report.total,
    };
}

function checkServedExtension() {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (message) => {
            if (settled) {
                return;
            }
            settled = true;
            resolve(message);
        };
        const request = http.get('http://127.0.0.1:8000/scripts/extensions/third-party/re0-adventure-engine/index.js', (response) => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                body += chunk;
                if (body.length > 2_000_000) {
                    const required = ['buildDefaultSimulationState', 'reconcileLoadedState', 'selectVoiceProfileForMessage', 'lastRevealCarry', 'buildDefaultCastDirectorState', 'presenceAvatarRowMarkup', 'installAdventureDebugHooks', 'render_game_to_text'];
                    const missing = required.filter((needle) => !body.includes(needle));
                    finish(missing.length ? `WARN: served extension missing ${missing.join(', ')}` : 'served extension ok');
                    request.destroy();
                }
            });
            response.on('end', () => {
                if (response.statusCode !== 200) {
                    finish(`WARN: local SillyTavern returned HTTP ${response.statusCode}`);
                    return;
                }
                const required = ['buildDefaultSimulationState', 'reconcileLoadedState', 'selectVoiceProfileForMessage', 'lastRevealCarry', 'buildDefaultCastDirectorState', 'presenceAvatarRowMarkup', 'installAdventureDebugHooks', 'render_game_to_text'];
                const missing = required.filter((needle) => !body.includes(needle));
                finish(missing.length ? `WARN: served extension missing ${missing.join(', ')}` : 'served extension ok');
            });
        });
        request.on('error', (error) => finish(`WARN: local service not reachable (${error.message})`));
        request.setTimeout(3000, () => {
            request.destroy(new Error('timeout'));
        });
        setTimeout(() => {
            request.destroy(new Error('hard timeout'));
            finish('WARN: local service not reachable (hard timeout)');
        }, 5000).unref();
    });
}

trace('syntax checks start');
for (const file of syntaxFiles) {
    run(`node --check ${file}`, 'node', ['--check', file]);
}

trace('json validation start');
validateJson();
trace('secret scan start');
validateNoApiSecretLeakage();
trace('storyline validation start');
validateStorylineData();
trace('worldbook validation start');
validateWorldbookNodes();
trace('causal guards start');
validateCausalInheritanceGuards();
trace('mimo config validation start');
validateMimoConfig();
trace('required assets validation start');
validateRequiredAssets();
trace('generated asset validation start');
const generatedAssets = validateGeneratedAssetReferences();
trace('asset coverage subprocess start');
run('re0 asset coverage', 'node', ['scripts/re0-asset-coverage.mjs']);
trace('product guards start');
validateProductExperienceGuards();
trace('e2e smoke guard start');
validateE2ESmokeTest();
trace('live director audit report validation start');
const liveDirectorAuditReport = validateLatestLiveDirectorAuditReport();

if (fs.existsSync(rel('node_modules/.bin/eslint'))) {
    trace('eslint start');
    run('runtime eslint', './node_modules/.bin/eslint', lintFiles);
} else {
    console.log('WARN: node_modules/.bin/eslint not found; skipped lint');
}

trace('ui bindings validation start');
validateUiBindings();

trace('served extension check start');
const served = await checkServedExtension();
console.log([
    `syntax ok: ${syntaxFiles.length} files`,
    `json ok: ${jsonFiles.length} files`,
    'secret leakage guard ok',
    'storyline/worldbook/config ok',
    'causal inheritance guards ok',
    'required assets ok',
    'asset coverage ok',
    `generated assets ok: ${generatedAssets.sceneUrls} scene urls, ${generatedAssets.manifestAvatars} fallback avatars, ${generatedAssets.hiresAvatars} imggen hires avatars, ${generatedAssets.styleboards} styleboards, ${generatedAssets.codeReferencedAssets} code refs`,
    'product experience guards ok',
    'e2e smoke guards ok',
    `live Mimo director audit ok: ${liveDirectorAuditReport.file} (${liveDirectorAuditReport.total}/${liveDirectorAuditReport.total}, ${liveDirectorAuditReport.model})`,
    'ui bindings ok',
    served,
].join('\n'));
