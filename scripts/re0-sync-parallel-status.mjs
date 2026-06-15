#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function resolveRoot() {
    const cwd = process.cwd();
    const marker = 'public/scripts/extensions/third-party/re0-adventure-engine';
    if (fs.existsSync(path.join(cwd, marker))) {
        return cwd;
    }
    const child = path.join(cwd, 'SillyTavern');
    if (fs.existsSync(path.join(child, marker))) {
        return child;
    }
    return cwd;
}

const root = resolveRoot();
const rel = (...parts) => path.join(root, ...parts);
const now = new Date();

const collabDir = rel('data/default-user/re0-engine/collab');
const heartbeatsDir = path.join(collabDir, 'heartbeats');
const snapshotsDir = path.join(collabDir, 'snapshots');
const assetsPlanDir = rel('data/default-user/re0-engine/assets-plan');
const generatedAssetsDir = rel('public/scripts/extensions/third-party/re0-adventure-engine/assets/generated');
const projectStatusFile = rel('data/default-user/re0-engine/PROJECT_STATUS.md');
const reindexAuditFile = rel('data/default-user/re0-engine/HANDOFF_2026-05-29_REINDEX_AUDIT.md');

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback = null) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return fallback;
    }
}

function readText(file, fallback = '') {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch {
        return fallback;
    }
}

function fileMtimeMs(file) {
    try {
        return fs.statSync(file).mtimeMs;
    } catch {
        return 0;
    }
}

function parseTimeMs(value) {
    const ms = Date.parse(value || '');
    return Number.isFinite(ms) ? ms : 0;
}

function walkFiles(dir, predicate = () => true) {
    if (!fs.existsSync(dir)) {
        return [];
    }
    const out = [];
    const stack = [dir];
    while (stack.length) {
        const current = stack.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(full);
            } else if (predicate(full)) {
                const stat = fs.statSync(full);
                out.push({
                    path: full,
                    relPath: path.relative(root, full),
                    size: stat.size,
                    mtimeMs: stat.mtimeMs,
                    mtime: stat.mtime.toISOString(),
                });
            }
        }
    }
    return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function countBy(items, selector) {
    return items.reduce((acc, item) => {
        const key = selector(item) || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
}

function summarizeQueue(file, buckets) {
    const data = readJson(file, {});
    const summary = [];
    for (const bucket of buckets) {
        const items = Array.isArray(data[bucket]) ? data[bucket] : [];
        summary.push({
            bucket,
            total: items.length,
            statuses: countBy(items, item => item.status),
            recent: items
                .filter(item => item.status && item.status !== 'planned')
                .slice(-8)
                .map(item => ({
                    id: item.id || item.jobId || item.sceneKey || item.characterId || '',
                    status: item.status,
                    targetFile: item.targetFile || item.output || item.path || '',
                })),
        });
    }
    return {
        file: path.relative(root, file),
        exists: fs.existsSync(file),
        summary,
    };
}

function formatStatusCounts(statuses) {
    const keys = Object.keys(statuses || {}).sort();
    return keys.length ? keys.map(key => `${key}:${statuses[key]}`).join(', ') : 'none';
}

function formatRecentFiles(files, limit = 12) {
    if (!files.length) {
        return '- none';
    }
    return files.slice(0, limit).map(file => `- ${file.relPath} (${Math.round(file.size / 1024)} KB, ${file.mtime})`).join('\n');
}

function assetManifestSummary() {
    const file = path.join(assetsPlanDir, 'asset-manifest.generated.json');
    const data = readJson(file, null);
    if (!data) {
        return { exists: false };
    }
    const assets = Array.isArray(data) ? data : Array.isArray(data.assets) ? data.assets : [];
    return {
        exists: true,
        file: path.relative(root, file),
        total: assets.length,
        byKind: countBy(assets, asset => asset.kind),
        missing: assets.filter(asset => asset.exists === false || asset.missing === true).length,
    };
}

function assetCoverageSummary() {
    const file = path.join(assetsPlanDir, 'asset-coverage-report.json');
    const data = readJson(file, null);
    if (!data) {
        return { exists: false };
    }
    return {
        exists: true,
        file: path.relative(root, file),
        generatedAt: data.generatedAt || data.updatedAt || '',
        totals: data.totals || data.summary || {},
    };
}

function latestMainEvidence() {
    const projectStatus = readText(projectStatusFile);
    const reindexAudit = readText(reindexAuditFile);
    const combined = `${projectStatus}\n${reindexAudit}`;
    const releasePass = /node scripts\/re0-release-check\.mjs[\s\S]{0,120}通过|release guard[\s\S]{0,120}(pass|通过|全绿)/i.test(combined);
    const e2ePass = /npx playwright test re0-adventure-engine\.e2e\.js --workers=1[\s\S]{0,160}(7\/7|7 passed|通过)/i.test(combined);
    return {
        files: [
            path.relative(root, projectStatusFile),
            path.relative(root, reindexAuditFile),
        ],
        latestMtimeMs: Math.max(fileMtimeMs(projectStatusFile), fileMtimeMs(reindexAuditFile)),
        releasePass,
        e2ePass,
        mainRuntimeHealthy: releasePass && e2ePass,
    };
}

function detectStaleBlockers(heartbeats, evidence) {
    if (!evidence.mainRuntimeHealthy) {
        return [];
    }
    return heartbeats
        .map(heartbeat => {
            const data = heartbeat.data || {};
            const lastUpdatedMs = parseTimeMs(data.lastUpdatedAt) || heartbeat.mtimeMs;
            const releaseStatus = data.releaseCheck?.status || '';
            const blockedBy = data.blockedBy || '';
            const combined = `${data.status || ''}\n${data.currentTask || ''}\n${releaseStatus}\n${blockedBy}`.toLowerCase();
            const looksBlocked = /blocked|eslint|fail|failing|阻塞|失败/.test(combined);
            const mentionsRuntime = /runtime|index\.js|release|eslint|e2e|前端|运行时/.test(combined);
            if (!looksBlocked || !mentionsRuntime || lastUpdatedMs >= evidence.latestMtimeMs) {
                return null;
            }
            return {
                windowId: data.windowId || path.basename(heartbeat.path),
                heartbeat: heartbeat.relPath,
                lastUpdatedAt: data.lastUpdatedAt || heartbeat.mtime,
                staleAgainst: evidence.files,
                reason: 'Heartbeat still references a runtime/release blocker older than the main-window release+E2E pass; treat as stale until the branch refreshes.',
                staleStatus: releaseStatus || blockedBy || data.status || 'unknown',
            };
        })
        .filter(Boolean);
}

ensureDir(collabDir);
ensureDir(snapshotsDir);

const checkins = walkFiles(path.join(collabDir, 'checkins'), file => /\.(md|json|jsonl)$/i.test(file));
const heartbeats = walkFiles(heartbeatsDir, file => /\.json$/i.test(file))
    .map(file => ({ ...file, data: readJson(file.path, {}) }));
const branchCommandFiles = walkFiles(heartbeatsDir, file => /COMMANDS.*\.md$/i.test(path.basename(file)) || /BRANCH_COMMANDS.*\.md$/i.test(path.basename(file)));
const inboxFiles = walkFiles(path.join(collabDir, 'inbox'), file => /\.(md|json|jsonl)$/i.test(file));
const mergeQueue = walkFiles(path.join(collabDir, 'merge-queue'), file => /\.(md|json|jsonl|patch|diff)$/i.test(file));
const generatedAssets = walkFiles(generatedAssetsDir, file => /\.(png|jpe?g|webp)$/i.test(file));
const mainEvidence = latestMainEvidence();
const staleBlockers = detectStaleBlockers(heartbeats, mainEvidence);

const queues = [
    summarizeQueue(path.join(assetsPlanDir, 'imagegen-job-queue.json'), ['jobs']),
    summarizeQueue(path.join(assetsPlanDir, 'scene-generation-queue.json'), ['jobs']),
    summarizeQueue(path.join(assetsPlanDir, 'adult-mode-asset-queue.json'), ['sceneJobs', 'spriteJobs']),
];

const snapshot = {
    generatedAt: now.toISOString(),
    root,
    registry: readJson(path.join(collabDir, 'WINDOW_REGISTRY.json'), {}),
    locks: readJson(path.join(collabDir, 'TASK_LOCKS.json'), {}),
    mainEvidence,
    branchCommandFiles,
    staleBlockers,
    checkins: checkins.slice(0, 20),
    heartbeats,
    inboxFiles: inboxFiles.slice(0, 40),
    mergeQueue,
    queues,
    assetManifest: assetManifestSummary(),
    assetCoverage: assetCoverageSummary(),
    generatedAssets: {
        total: generatedAssets.length,
        recent: generatedAssets.slice(0, 30),
    },
};

const snapshotFile = path.join(snapshotsDir, 'parallel-status-latest.json');
fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));

const md = `# Main Window Sync

Generated at: ${snapshot.generatedAt}

Root: \`${root}\`

## Active Heartbeats

${heartbeats.length ? heartbeats.map(h => `- \`${h.data.windowId || path.basename(h.path)}\`: ${h.data.status || 'unknown'} | ${h.data.role || ''} | task: ${h.data.currentTask || ''} | updated: ${h.data.lastUpdatedAt || h.mtime}`).join('\n') : '- none'}

## Branch Command Files

${branchCommandFiles.length ? branchCommandFiles.map(file => `- \`${file.relPath}\` (${Math.round(file.size / 1024)} KB, ${file.mtime})`).join('\n') : '- none'}

## Stale Blockers / Needs Main Review

${staleBlockers.length ? staleBlockers.map(item => `- \`${item.windowId}\`: ${item.staleStatus} | ${item.reason} | heartbeat: \`${item.heartbeat}\``).join('\n') : '- none'}

## Main Runtime Evidence

- releaseCheckPass: ${mainEvidence.releasePass}
- e2ePass: ${mainEvidence.e2ePass}
- evidenceFiles: ${mainEvidence.files.map(file => `\`${file}\``).join(', ')}

## Task Locks

${(snapshot.locks.locks || []).map(lock => `- \`${lock.lockId}\`: ${lock.mode} by ${lock.owner} (${lock.status})`).join('\n') || '- none'}

## Recent Check-ins

${formatRecentFiles(checkins, 10)}

## Inbox Updates

${formatRecentFiles(inboxFiles, 16)}

## Merge Queue

${formatRecentFiles(mergeQueue, 16)}

## Asset Queue Status

${queues.map(queue => {
    const lines = queue.summary.map(bucket => `  - ${bucket.bucket}: total ${bucket.total}; ${formatStatusCounts(bucket.statuses)}`).join('\n');
    return `- \`${queue.file}\`\n${lines}`;
}).join('\n')}

## Asset Manifest

${snapshot.assetManifest.exists ? [
    `- file: \`${snapshot.assetManifest.file}\``,
    `- total: ${snapshot.assetManifest.total}`,
    `- missing: ${snapshot.assetManifest.missing}`,
    `- byKind: ${formatStatusCounts(snapshot.assetManifest.byKind)}`,
].join('\n') : '- missing'}

## Asset Coverage

${snapshot.assetCoverage.exists ? [
    `- file: \`${snapshot.assetCoverage.file}\``,
    `- generatedAt: ${snapshot.assetCoverage.generatedAt || 'unknown'}`,
    `- totals: \`${JSON.stringify(snapshot.assetCoverage.totals)}\``,
].join('\n') : '- missing'}

## Recent Generated Assets

Total generated bitmap assets: ${snapshot.generatedAssets.total}

${formatRecentFiles(snapshot.generatedAssets.recent, 16)}

## Main Window Actions

- Read any new files listed under Inbox Updates.
- If Merge Queue is non-empty, inspect and merge from the main runtime window only.
- If asset queues changed, run \`node scripts/build-re0-asset-manifest.mjs\` after merging mappings.
- If generated assets were added without queue updates, ask the asset window to write a batch report before merging.

Snapshot JSON: \`${path.relative(root, snapshotFile)}\`
`;

const mdFile = path.join(collabDir, 'MAIN_WINDOW_SYNC.md');
fs.writeFileSync(mdFile, md);

console.log(`Wrote ${path.relative(root, mdFile)}`);
console.log(`Wrote ${path.relative(root, snapshotFile)}`);
