export const VISUAL_NOVEL_CHECKPOINT_LIMIT = 32;

function uniqueStrings(values = []) {
    return [...new Set((Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean))];
}

function shortText(value = '', limit = 120) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > limit ? `${text.slice(0, limit).trimEnd()}...` : text;
}

function checkpointFingerprint(checkpoint = {}) {
    return [
        checkpoint.messageId ?? -1,
        checkpoint.sourceHash || '',
        checkpoint.segmentIndex ?? 0,
        checkpoint.storyMode || '',
        checkpoint.backdropKey || '',
        checkpoint.speakerId || '',
        checkpoint.worldlineNodeId || '',
    ].join('|');
}

export function buildDefaultVisualNovelCheckpointState() {
    return {
        enabled: true,
        currentId: '',
        lastSavedAt: '',
        lastRestoredId: '',
        lastRestoreSummary: '',
        autoCount: 0,
        manualCount: 0,
        history: [],
    };
}

export function normalizeVisualNovelCheckpointState(value = {}, { limit = VISUAL_NOVEL_CHECKPOINT_LIMIT } = {}) {
    const seed = buildDefaultVisualNovelCheckpointState();
    const state = value && typeof value === 'object' ? { ...seed, ...value } : seed;
    state.enabled = state.enabled !== false;
    state.currentId = String(state.currentId || '');
    state.lastSavedAt = String(state.lastSavedAt || '');
    state.lastRestoredId = String(state.lastRestoredId || '');
    state.lastRestoreSummary = String(state.lastRestoreSummary || '');
    state.autoCount = Math.max(0, Number(state.autoCount) || 0);
    state.manualCount = Math.max(0, Number(state.manualCount) || 0);
    state.history = Array.isArray(state.history)
        ? state.history
            .filter((item) => item && typeof item === 'object')
            .slice(-Math.max(1, Number(limit) || VISUAL_NOVEL_CHECKPOINT_LIMIT))
        : [];
    return state;
}

export function createVisualNovelCheckpoint({
    kind = 'auto',
    label = '',
    now = () => new Date().toISOString(),
    current = {},
    worldline = {},
    returnByDeath = {},
    gameplay = {},
    script = {},
    segment = null,
    transition = {},
    backdrop = {},
    castIds = [],
} = {}) {
    const safeSegment = segment || {};
    const segmentIndex = Math.max(0, Number(script.currentIndex) || 0);
    const checkpoint = {
        id: '',
        kind: kind === 'manual' ? 'manual' : 'auto',
        label: shortText(label || (kind === 'manual' ? '手动检查点' : '自动检查点'), 64),
        at: now(),
        day: Number(current.day) || 1,
        time: String(current.time || ''),
        location: String(current.location || ''),
        viewpoint: String(current.viewpoint || ''),
        storyMode: String(script.storyMode || ''),
        messageId: Number(script.messageId ?? script.lastMessageId ?? -1),
        sourceHash: String(script.sourceHash || script.lastSourceHash || ''),
        scriptSource: String(script.scriptSource || 'none'),
        segmentIndex,
        segmentCount: Math.max(0, Number(script.segmentCount ?? script.segments?.length) || 0),
        speakerId: String(safeSegment.speakerId || ''),
        speakerName: String(safeSegment.speakerName || ''),
        segmentType: String(safeSegment.type || 'narration'),
        text: shortText(safeSegment.text || '', 220),
        backdropKey: String(backdrop.key || script.backgroundKey || ''),
        backgroundImage: String(backdrop.imageUrl || ''),
        castIds: uniqueStrings(castIds.length ? castIds : script.castIds),
        worldlineId: String(worldline.id || ''),
        worldlineNodeId: String(worldline.tree?.currentNodeId || ''),
        divergence: Number(worldline.divergence ?? 0),
        returnLoop: Number(returnByDeath.loop || 0),
        deathCount: Number(returnByDeath.deaths || 0),
        objective: shortText(gameplay.activeObjective || '', 120),
        objectiveStage: shortText(gameplay.objectiveStage || '', 120),
        transitionSummary: shortText(transition.summary || '', 120),
    };
    checkpoint.fingerprint = checkpointFingerprint(checkpoint);
    checkpoint.id = `vnc-${Math.abs(hashString(checkpoint.fingerprint + checkpoint.at)).toString(36)}`;
    checkpoint.summary = `${checkpoint.label}：第${checkpoint.day}日 ${checkpoint.time || '未知时间'} / ${checkpoint.location || '未知地点'} / ${checkpoint.speakerName || '世界意志'} ${checkpoint.segmentIndex + 1}/${checkpoint.segmentCount || '?'}`;
    return checkpoint;
}

export function recordVisualNovelCheckpoint(vn, checkpoint, {
    limit = VISUAL_NOVEL_CHECKPOINT_LIMIT,
    force = false,
} = {}) {
    if (!vn || typeof vn !== 'object' || !checkpoint) {
        return { changed: false, checkpoint: null, reason: 'invalid' };
    }
    vn.checkpoint = normalizeVisualNovelCheckpointState(vn.checkpoint, { limit });
    if (!vn.checkpoint.enabled) {
        return { changed: false, checkpoint: null, reason: 'disabled' };
    }
    const history = vn.checkpoint.history;
    const last = history[history.length - 1] || null;
    const duplicate = last && last.fingerprint === checkpoint.fingerprint && checkpoint.kind !== 'manual';
    if (duplicate && !force) {
        vn.checkpoint.currentId = last.id;
        return { changed: false, checkpoint: last, reason: 'duplicate' };
    }

    const nextHistory = [
        ...history.filter((item) => item.id !== checkpoint.id),
        checkpoint,
    ].slice(-Math.max(1, Number(limit) || VISUAL_NOVEL_CHECKPOINT_LIMIT));

    vn.checkpoint.history = nextHistory;
    vn.checkpoint.currentId = checkpoint.id;
    vn.checkpoint.lastSavedAt = checkpoint.at;
    if (checkpoint.kind === 'manual') {
        vn.checkpoint.manualCount += 1;
    } else {
        vn.checkpoint.autoCount += 1;
    }
    return { changed: true, checkpoint, reason: checkpoint.kind };
}

export function latestVisualNovelCheckpoint(vn) {
    const state = normalizeVisualNovelCheckpointState(vn?.checkpoint);
    return state.history[state.history.length - 1] || null;
}

export function findVisualNovelCheckpoint(vn, query = '') {
    const state = normalizeVisualNovelCheckpointState(vn?.checkpoint);
    if (!state.history.length) {
        return null;
    }
    const source = String(query || '').trim();
    if (!source) {
        return state.history[state.history.length - 1];
    }
    return state.history.find((item) => item.id === source)
        || state.history.find((item) => item.label === source)
        || state.history.find((item) => item.summary?.includes(source))
        || null;
}

export function restoreVisualNovelCheckpoint(vn, checkpointOrId = '') {
    if (!vn || typeof vn !== 'object') {
        return { restored: false, checkpoint: null, summary: 'VN runtime missing.' };
    }
    vn.checkpoint = normalizeVisualNovelCheckpointState(vn.checkpoint);
    const checkpoint = typeof checkpointOrId === 'object'
        ? checkpointOrId
        : findVisualNovelCheckpoint(vn, checkpointOrId);
    if (!checkpoint) {
        return { restored: false, checkpoint: null, summary: '没有可回滚的 VN 检查点。' };
    }
    const segmentCount = Array.isArray(vn.segments) ? vn.segments.length : 0;
    const maxIndex = Math.max(0, segmentCount - 1);
    vn.currentIndex = Math.max(0, Math.min(maxIndex, Number(checkpoint.segmentIndex) || 0));
    vn.autoPlay = false;
    vn.skipMode = false;
    vn.checkpoint.lastRestoredId = checkpoint.id;
    vn.checkpoint.lastRestoreSummary = `已回滚到 ${checkpoint.summary}`;
    return {
        restored: true,
        checkpoint,
        summary: vn.checkpoint.lastRestoreSummary,
    };
}

export function summarizeVisualNovelCheckpoint(vn) {
    const state = normalizeVisualNovelCheckpointState(vn?.checkpoint);
    const latest = state.history[state.history.length - 1] || null;
    return {
        count: state.history.length,
        currentId: state.currentId,
        latestSummary: latest?.summary || '暂无 VN 检查点。',
        lastRestoreSummary: state.lastRestoreSummary || '',
        autoCount: state.autoCount,
        manualCount: state.manualCount,
    };
}

function hashString(value) {
    let hash = 0;
    const text = String(value ?? '');
    for (let index = 0; index < text.length; index += 1) {
        hash = ((hash << 5) - hash) + text.charCodeAt(index);
        hash |= 0;
    }
    return hash;
}
