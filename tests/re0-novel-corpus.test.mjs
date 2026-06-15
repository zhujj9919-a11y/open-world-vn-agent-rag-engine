import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpusRoot = path.join(root, 'data/default-user/re0-engine/rag/novel-corpus');

function readJson(fileName) {
    return JSON.parse(fs.readFileSync(path.join(corpusRoot, fileName), 'utf8'));
}

function readJsonl(fileName) {
    return fs.readFileSync(path.join(corpusRoot, fileName), 'utf8')
        .split(/\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
}

for (const fileName of [
    'metadata.json',
    'chapter-vault.jsonl.gz',
    'chapter-digests.jsonl',
    'chapter-index.json',
    'storydb-digests.jsonl',
    'causal-facts.jsonl',
    'illustration-index.json',
]) {
    assert.ok(fs.existsSync(path.join(corpusRoot, fileName)), `missing compact novel corpus file: ${fileName}`);
}

const metadata = readJson('metadata.json');
const summary = metadata.summary || {};
assert.equal(metadata.version, 're0-novel-corpus/v1');
assert.ok(String(metadata.policy?.rawVault || '').includes('never inject the full vault'), 'raw vault policy must forbid full prompt injection');
assert.ok(summary.chapterFiles >= 1600, `chapter corpus is too small: ${summary.chapterFiles}`);
assert.ok(summary.storyDatabaseFiles >= 10, `story database corpus is too small: ${summary.storyDatabaseFiles}`);
assert.ok(summary.causalFacts >= 5000, `causal fact corpus is too small: ${summary.causalFacts}`);
assert.ok(summary.rawTextChars >= 10_000_000, `raw corpus coverage is too small: ${summary.rawTextChars}`);
assert.ok(summary.rawVaultBytes > 0 && summary.rawVaultBytes < 80 * 1024 * 1024, `raw vault should stay compressed and bounded: ${summary.rawVaultBytes}`);
assert.ok(summary.sourceNovelAssets >= 500, `source-novel image registry is too small: ${summary.sourceNovelAssets}`);

const vaultStats = fs.statSync(path.join(corpusRoot, 'chapter-vault.jsonl.gz'));
assert.equal(vaultStats.size, summary.rawVaultBytes, 'metadata rawVaultBytes must match the compressed vault on disk');

const chapterDigests = readJsonl('chapter-digests.jsonl');
assert.equal(chapterDigests.length, summary.chapterFiles, 'chapter digest line count must match metadata');
for (const record of chapterDigests) {
    assert.ok(record.id && record.sourcePath, 'chapter digest must keep source identity');
    assert.equal(Object.hasOwn(record, 'text'), false, `chapter digest must not contain raw text: ${record.sourcePath}`);
    assert.ok(String(record.digest || '').length <= 380, `chapter digest is too long: ${record.sourcePath}`);
    assert.ok(Array.isArray(record.keySentences), `chapter digest must include bounded key sentences: ${record.sourcePath}`);
    assert.ok(record.keySentences.length <= 6, `too many key sentences: ${record.sourcePath}`);
    assert.ok(record.keySentences.every((sentence) => String(sentence).length <= 230), `key sentence too long: ${record.sourcePath}`);
    assert.ok(String(record.rawSha1 || '').length >= 20, `chapter digest must retain raw hash for rebuild verification: ${record.sourcePath}`);
}

const causalFacts = readJsonl('causal-facts.jsonl');
assert.equal(causalFacts.length, summary.causalFacts, 'causal fact line count must match metadata');
for (const fact of causalFacts) {
    assert.ok(fact.id && fact.chunkId, 'causal fact must keep source identity');
    assert.ok(String(fact.object || '').length <= 170, `causal fact text is too long: ${fact.id}`);
    assert.equal(Object.hasOwn(fact, 'text'), false, `causal fact must not contain raw text: ${fact.id}`);
}

const storyDbDigests = readJsonl('storydb-digests.jsonl');
assert.equal(storyDbDigests.length, summary.storyDatabaseFiles, 'story database digest line count must match metadata');
assert.ok(storyDbDigests.some((record) => /timeline|outline|README|arc/i.test(record.sourcePath)), 'story database digests must keep outline/summaries');

const illustrationIndex = readJson('illustration-index.json');
assert.ok(Array.isArray(illustrationIndex.assets), 'illustration index must expose source-novel assets');
assert.ok(illustrationIndex.assets.length >= summary.sourceNovelAssets, 'illustration index asset count must cover metadata');
assert.ok(Object.keys(illustrationIndex.characterMap || {}).length >= 40, 'source-novel character image map is too small');
assert.ok(Object.keys(illustrationIndex.sceneMap || {}).length >= 5, 'source-novel scene image map is too small');

const sourceRetirementProbe = spawnSync(process.execPath, ['scripts/build-re0-novel-corpus.mjs'], {
    cwd: root,
    encoding: 'utf8',
    env: {
        ...process.env,
        RE0_NOVEL_SRC_ROOT: path.join(root, 'tmp', 'missing-re0-novel-src-for-test'),
    },
});
assert.equal(sourceRetirementProbe.status, 0, sourceRetirementProbe.stderr || sourceRetirementProbe.stdout);
const sourceRetirementStatus = JSON.parse(sourceRetirementProbe.stdout);
assert.equal(sourceRetirementStatus.status, 'existing-corpus', 'builder must reuse compact corpus after raw source retirement');
assert.equal(sourceRetirementStatus.chapterFiles, summary.chapterFiles, 'source-retired builder must report the existing corpus coverage');

console.log(JSON.stringify({
    status: 'pass',
    chapters: chapterDigests.length,
    causalFacts: causalFacts.length,
    rawVaultBytes: summary.rawVaultBytes,
    sourceNovelAssets: illustrationIndex.assets.length,
    policy: 'full-raw-held-offline-runtime-bounded',
}, null, 2));
