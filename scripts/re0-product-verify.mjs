#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skipE2e = process.argv.includes('--skip-e2e');
const liveDirector = process.argv.includes('--live-director');

function run(label, command, args, options = {}) {
    const cwd = options.cwd || root;
    const pretty = `${command} ${args.join(' ')}`;
    console.log(`\n[re0-verify] ${label}`);
    console.log(`[re0-verify] cwd=${path.relative(root, cwd) || '.'} :: ${pretty}`);
    const result = spawnSync(command, args, {
        cwd,
        stdio: 'inherit',
        shell: false,
        env: {
            ...process.env,
            FORCE_COLOR: process.env.FORCE_COLOR || '1',
        },
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`${label} failed with exit code ${result.status}`);
    }
}

run('rebuild storyline defaults', 'node', ['scripts/build-storyline-defaults.js']);
run('rebuild IF branch rules', 'node', ['scripts/build-re0-if-branch-rules.mjs']);
run('rebuild character playLoop hooks', 'node', ['scripts/build-re0-character-playloop-hooks.mjs']);
run('build compact novel corpus', 'node', ['scripts/build-re0-novel-corpus.mjs']);
run('novel corpus boundary tests', 'node', ['tests/re0-novel-corpus.test.mjs']);
run('rebuild canon route RAG', 'node', ['scripts/build-re0-canon-rag.mjs']);
run('rebuild story RAG index', 'node', ['scripts/build-re0-story-rag.mjs']);
run('story RAG targeted tests', 'node', ['tests/re0-story-rag.test.mjs']);
run('canon mainline spine tests', 'node', ['tests/re0-canon-mainline-spine.test.mjs']);
run('narrative director fullflow tests', 'node', ['tests/re0-narrative-director-fullflow.test.mjs']);
run('rebuild asset RAG registry', 'node', ['scripts/re0-build-asset-rag-registry.mjs']);
run('asset policy targeted tests', 'node', ['tests/re0-asset-policy-engine.test.mjs']);
run('agent module targeted tests', 'node', ['tests/re0-agent-module.test.mjs']);
run('agent turn plan targeted tests', 'node', ['tests/re0-agent-turn-plan.test.mjs']);
run('agent endpoint local fallback tests', 'node', ['tests/re0-agent-endpoint.test.mjs']);
run('host adapter contract tests', 'node', ['tests/re0-host-adapter.test.mjs']);
run('rebuild Grok adult runtime assets', 'node', ['scripts/build-re0-grokadult-runtime-assets.mjs']);
run('rebuild asset manifest', 'node', ['scripts/build-re0-asset-manifest.mjs']);
run('asset coverage audit', 'node', ['scripts/re0-asset-coverage.mjs']);
run('release guard', 'node', ['scripts/re0-release-check.mjs']);

if (liveDirector) {
    run('live Mimo narrative director audit', 'node', ['scripts/re0-live-director-audit.mjs']);
}

if (!skipE2e) {
    run('visual novel E2E', 'npx', ['playwright', 'test', 're0-adventure-engine.e2e.js', '--workers=1'], {
        cwd: path.join(root, 'tests'),
    });
    run('longplay branch E2E', 'npx', ['playwright', 'test', 're0-adventure-engine-longplay.e2e.js', '--workers=1'], {
        cwd: path.join(root, 'tests'),
    });
    run('onboarding E2E', 'npx', ['playwright', 'test', 're0-adventure-onboarding.e2e.js', '--workers=1'], {
        cwd: path.join(root, 'tests'),
    });
    run('free-opening matrix E2E', 'npx', ['playwright', 'test', 're0-adventure-onboarding-matrix.e2e.js', '--workers=1'], {
        cwd: path.join(root, 'tests'),
    });
}

console.log('\n[re0-verify] PASS: Re:0 visual novel engine release gate is green.');
