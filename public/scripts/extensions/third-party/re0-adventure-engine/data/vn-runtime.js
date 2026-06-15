export const VISUAL_NOVEL_BACKLOG_LIMIT = 240;

export function normalizeVisualNovelRuntimeState(state, {
    buildDefaultVisualState,
    buildDefaultVisualNovelState,
    settings = {},
    normalizeRoleMetrics = (metrics, segments) => metrics || { segments },
} = {}) {
    if (typeof buildDefaultVisualState !== 'function' || typeof buildDefaultVisualNovelState !== 'function') {
        throw new TypeError('normalizeVisualNovelRuntimeState requires default visual state builders.');
    }
    state.visuals ??= buildDefaultVisualState();
    state.visuals.visualNovel = {
        ...buildDefaultVisualNovelState(),
        ...(state.visuals.visualNovel || {}),
    };
    const vn = state.visuals.visualNovel;
    vn.currentIndex = Math.max(0, Number(vn.currentIndex) || 0);
    vn.autoPlay = vn.autoPlay === true;
    vn.skipMode = vn.skipMode === true && !vn.autoPlay;
    vn.autoDelayMs = Math.max(900, Math.min(12000, Number(vn.autoDelayMs) || Number(settings.visualNovelAutoDelayMs) || 1800));
    vn.skipDelayMs = Math.max(120, Math.min(3000, Number(vn.skipDelayMs) || Number(settings.visualNovelSkipDelayMs) || 300));
    vn.segments = Array.isArray(vn.segments) ? vn.segments : [];
    vn.choices = Array.isArray(vn.choices) ? vn.choices : [];
    vn.selectedChoiceIndex = Math.max(0, Math.min(5, Number(vn.selectedChoiceIndex) || 0));
    vn.choiceMode = vn.choiceMode === true;
    vn.lastChoiceText = String(vn.lastChoiceText || '');
    vn.lastChoiceAppliedAt = String(vn.lastChoiceAppliedAt || '');
    vn.actionSidebarPage = ['actions', 'state', 'settings'].includes(vn.actionSidebarPage) ? vn.actionSidebarPage : 'actions';
    vn.choiceRefreshNonce = Math.max(0, Number(vn.choiceRefreshNonce) || 0);
    vn.lastChoiceRefreshAt = String(vn.lastChoiceRefreshAt || '');
    vn.customActionDraft = String(vn.customActionDraft || '');
    vn.pendingSend = {
        active: vn.pendingSend?.active === true,
        text: String(vn.pendingSend?.text || ''),
        startedAt: String(vn.pendingSend?.startedAt || ''),
        startedChatLength: Math.max(0, Number(vn.pendingSend?.startedChatLength) || 0),
        status: String(vn.pendingSend?.status || (vn.pendingSend?.active ? 'pending' : 'idle')),
        lastRecoveredAt: String(vn.pendingSend?.lastRecoveredAt || ''),
    };
    vn.castIds = Array.isArray(vn.castIds) ? vn.castIds : [];
    vn.scriptSource = String(vn.scriptSource || 'none');
    vn.queueMode = vn.queueMode === 'replace' ? 'replace' : 'append';
    vn.queueLength = Array.isArray(vn.segments) ? vn.segments.length : Math.max(0, Number(vn.queueLength) || 0);
    vn.queueTrimmedCount = Math.max(0, Number(vn.queueTrimmedCount) || 0);
    vn.queueTrimmedAt = String(vn.queueTrimmedAt || '');
    vn.queuedSourceHashes = Array.isArray(vn.queuedSourceHashes) ? vn.queuedSourceHashes.slice(-120) : [];
    vn.queuedSegmentFingerprints = Array.isArray(vn.queuedSegmentFingerprints) ? vn.queuedSegmentFingerprints.slice(-600) : [];
    vn.lastQueueAppendAt = String(vn.lastQueueAppendAt || '');
    vn.lastQueueAppendMessageId = Number(vn.lastQueueAppendMessageId ?? -1);
    vn.lastCursorMoveAt = String(vn.lastCursorMoveAt || '');
    vn.lastCursorSavedAt = String(vn.lastCursorSavedAt || '');
    vn.lastStatePatchSummary = String(vn.lastStatePatchSummary || '');
    vn.backlog = Array.isArray(vn.backlog) ? vn.backlog.slice(-VISUAL_NOVEL_BACKLOG_LIMIT) : [];
    vn.backlogOpen = vn.backlogOpen === true;
    vn.loadOpen = vn.loadOpen === true;
    vn.worldStatusOpen = vn.worldStatusOpen === true;
    vn.worldlineOpen = vn.worldlineOpen === true;
    vn.answerBookOpen = vn.answerBookOpen === true;
    vn.configOpen = vn.configOpen === true;
    vn.parseWarnings = Array.isArray(vn.parseWarnings) ? vn.parseWarnings.slice(-8) : [];
    vn.roleMetrics = normalizeRoleMetrics(vn.roleMetrics, vn.segments);
    return vn;
}

export function latestAssistantMessageForVisualNovel(context, {
    normalizeSourceText = (value) => String(value || '').trim(),
    limit = 5200,
} = {}) {
    const chat = Array.isArray(context?.chat) ? context.chat : [];
    for (let index = chat.length - 1; index >= 0; index -= 1) {
        const message = chat[index];
        if (!message || message.is_user || message.is_system) {
            continue;
        }
        const raw = String(message.extra?.display_text ?? message.mes ?? message.message ?? '');
        const narrative = normalizeSourceText(raw, limit);
        if (narrative) {
            return {
                messageId: index,
                text: narrative,
            };
        }
    }
    return { messageId: -1, text: '' };
}

export function visualNovelSourceHash(version, messageId, text, { hashString } = {}) {
    if (typeof hashString !== 'function') {
        throw new TypeError('visualNovelSourceHash requires hashString.');
    }
    return hashString(`${version}:${messageId}:${text}`);
}

export function applyVisualNovelScriptToRuntime(state, vn, script, {
    messageId,
    sourceHash,
    sourceMode = 'heuristic',
    applyStatePatch = () => null,
    now = () => new Date().toISOString(),
} = {}) {
    if (!vn || !script) {
        return false;
    }
    vn.currentIndex = 0;
    vn.lastMessageId = messageId;
    vn.lastSourceHash = sourceHash;
    vn.lastParsedAt = now();
    vn.segments = Array.isArray(script.segments) ? script.segments : [];
    vn.choices = Array.isArray(script.choices) ? script.choices : [];
    vn.castIds = Array.isArray(script.castIds) ? script.castIds : [];
    vn.backgroundKey = script.backgroundKey || '';
    vn.scriptSource = sourceMode || script.sourceMode || 'heuristic';
    vn.parseWarnings = Array.isArray(script.warnings) ? script.warnings : [];
    vn.roleMetrics = script.roleMetrics || {};
    const safePatchResult = applyStatePatch(state, script.statePatch, { source: vn.scriptSource });
    vn.lastStatePatchSummary = safePatchResult?.summary || '';
    vn.backlog = [
        ...(vn.backlog || []),
        ...vn.segments.map((segment) => ({
            at: vn.lastParsedAt,
            messageId,
            speaker: segment.speakerName,
            type: segment.type,
            text: segment.text,
        })),
    ].slice(-VISUAL_NOVEL_BACKLOG_LIMIT);
    return true;
}

export function buildCurrentVisualNovelScriptSnapshot(vn, {
    segments,
    fallbackChoices = [],
} = {}) {
    const safeSegments = Array.isArray(segments) && segments.length ? segments : [];
    const safeIndex = Math.max(0, Math.min(safeSegments.length - 1, Number(vn.currentIndex) || 0));
    vn.currentIndex = safeIndex;
    return {
        ...vn,
        segments: safeSegments,
        currentIndex: safeIndex,
        currentSegment: safeSegments[safeIndex] || null,
        choices: vn.choices?.length ? vn.choices : fallbackChoices,
    };
}
