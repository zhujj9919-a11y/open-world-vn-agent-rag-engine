export const VISUAL_NOVEL_TRANSITION_CLASS_NAMES = [
    're0-vn-transition-backdrop',
    're0-vn-transition-cast',
    're0-vn-transition-speaker',
    're0-vn-transition-mode',
];

function uniqueStrings(values = []) {
    return [...new Set((Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean))];
}

export function buildVisualNovelTransitionSnapshot({
    backdropKey = '',
    backgroundImage = '',
    castIds = [],
    speakerId = '',
    speakerName = '',
    storyMode = 'daily',
    segmentIndex = 0,
    scriptSource = 'none',
} = {}) {
    return {
        backdropKey: String(backdropKey || ''),
        backgroundImage: String(backgroundImage || ''),
        castIds: uniqueStrings(castIds),
        speakerId: String(speakerId || ''),
        speakerName: String(speakerName || ''),
        storyMode: String(storyMode || 'daily'),
        segmentIndex: Math.max(0, Number(segmentIndex) || 0),
        scriptSource: String(scriptSource || 'none'),
    };
}

export function buildVisualNovelTransitionEvent(previous = null, next = null, {
    transitionCue = '',
    now = () => new Date().toISOString(),
} = {}) {
    const safeNext = buildVisualNovelTransitionSnapshot(next || {});
    const safePrevious = previous ? buildVisualNovelTransitionSnapshot(previous) : null;
    const events = [];
    const classNames = [];
    if (!safePrevious) {
        events.push({
            type: 'stage-init',
            label: '舞台初始化',
            detail: 'VN 舞台首次同步当前场景。',
        });
    } else {
        if (safePrevious.backdropKey !== safeNext.backdropKey || safePrevious.backgroundImage !== safeNext.backgroundImage) {
            events.push({
                type: 'backdrop-change',
                label: '背景切换',
                detail: `${safePrevious.backdropKey || 'unknown'} -> ${safeNext.backdropKey || 'unknown'}`,
            });
            classNames.push('re0-vn-transition-backdrop');
        }
        const previousCast = new Set(safePrevious.castIds);
        const nextCast = new Set(safeNext.castIds);
        const entered = safeNext.castIds.filter((id) => !previousCast.has(id));
        const exited = safePrevious.castIds.filter((id) => !nextCast.has(id));
        if (entered.length || exited.length) {
            events.push({
                type: 'cast-change',
                label: '角色调度',
                detail: `入场 ${entered.join(',') || '-'}；退场 ${exited.join(',') || '-'}`,
                entered,
                exited,
            });
            classNames.push('re0-vn-transition-cast');
        }
        if (safePrevious.speakerId !== safeNext.speakerId || safePrevious.speakerName !== safeNext.speakerName) {
            events.push({
                type: 'speaker-change',
                label: '镜头切换',
                detail: `${safePrevious.speakerName || safePrevious.speakerId || 'unknown'} -> ${safeNext.speakerName || safeNext.speakerId || 'unknown'}`,
            });
            classNames.push('re0-vn-transition-speaker');
        }
        if (safePrevious.storyMode !== safeNext.storyMode) {
            events.push({
                type: 'mode-change',
                label: '剧情层切换',
                detail: `${safePrevious.storyMode || 'daily'} -> ${safeNext.storyMode || 'daily'}`,
            });
            classNames.push('re0-vn-transition-mode');
        }
    }
    const changed = events.length > 0;
    const summary = changed
        ? events.map((event) => event.label).join(' / ')
        : '舞台保持';
    return {
        changed,
        changedAt: changed ? now() : '',
        cue: String(transitionCue || ''),
        events,
        classNames: uniqueStrings(classNames),
        summary,
        previous: safePrevious,
        current: safeNext,
    };
}

export function recordVisualNovelTransition(vn, nextSnapshot, {
    transitionCue = '',
    now = () => new Date().toISOString(),
    historyLimit = 24,
} = {}) {
    if (!vn || typeof vn !== 'object') {
        return buildVisualNovelTransitionEvent(null, nextSnapshot, { transitionCue, now });
    }
    const previous = vn.transition?.current || null;
    const transition = buildVisualNovelTransitionEvent(previous, nextSnapshot, { transitionCue, now });
    if (transition.changed) {
        const history = Array.isArray(vn.transition?.history) ? vn.transition.history : [];
        transition.history = [
            ...history,
            {
                at: transition.changedAt,
                summary: transition.summary,
                cue: transition.cue,
                events: transition.events,
            },
        ].slice(-Math.max(1, Number(historyLimit) || 24));
    } else {
        transition.history = Array.isArray(vn.transition?.history) ? vn.transition.history : [];
    }
    vn.transition = transition;
    return transition;
}

