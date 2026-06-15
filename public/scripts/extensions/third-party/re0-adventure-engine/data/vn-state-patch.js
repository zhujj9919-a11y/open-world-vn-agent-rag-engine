const SAFE_STATE_PATCH_KEYS = [
    'current',
    'visuals',
    'sceneBackdrop',
    'gameplay',
    'presence',
    'sceneCharacters',
    'currentSceneCharacters',
    'characterCards',
    'flags',
];

function defaultCleanText(value, limit = 160) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function defaultClampPercent(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round(numeric)));
}

function defaultUniqueNames(values = [], limit = 8) {
    const seen = new Set();
    const output = [];
    for (const value of values) {
        const text = String(value || '').trim();
        if (!text || seen.has(text)) {
            continue;
        }
        seen.add(text);
        output.push(text);
        if (output.length >= limit) {
            break;
        }
    }
    return output;
}

export function visualNovelPatchText(value, limit = 160, { cleanText = defaultCleanText } = {}) {
    return cleanText(value, limit);
}

export function blockedVisualNovelPatchKeys(patch = {}) {
    return Object.keys(patch || {}).filter((key) => !SAFE_STATE_PATCH_KEYS.includes(key));
}

export function normalizeVisualNovelPatchSceneCharacters(state, patch, {
    getProfile = () => null,
    profileFromSpeakerLabel = () => null,
    filterPresenceNamesForContext = (names) => names,
    uniqueNames = defaultUniqueNames,
    cleanText = defaultCleanText,
} = {}) {
    const raw = patch?.presence?.sceneCharacters || patch?.sceneCharacters || patch?.currentSceneCharacters || patch?.castIds || patch?.cast || [];
    const values = Array.isArray(raw) ? raw : [];
    const names = [];
    for (const value of values.slice(0, 8)) {
        const profile = typeof value === 'string'
            ? (getProfile(value) || profileFromSpeakerLabel(value))
            : (getProfile(value?.id || value?.speakerId || '') || profileFromSpeakerLabel(value?.name || value?.speakerName || ''));
        if (profile?.id && profile.id !== 'narrator') {
            names.push(profile.name);
            continue;
        }
        const text = visualNovelPatchText(typeof value === 'string' ? value : (value?.name || value?.speakerName || ''), 40, { cleanText });
        if (text && !/(世界意志|旁白|叙事|系统)/u.test(text)) {
            names.push(text);
        }
    }
    return filterPresenceNamesForContext(uniqueNames(names, 8), state, 6);
}

export function normalizeVisualNovelPatchCharacterCards(patchCards = {}, {
    cleanText = defaultCleanText,
    clampPercent = defaultClampPercent,
} = {}) {
    const safeCards = {};
    for (const [name, patch] of Object.entries(patchCards || {}).slice(0, 6)) {
        if (!patch || typeof patch !== 'object') {
            continue;
        }
        const safe = {};
        for (const key of ['id', 'name', 'role', 'personality', 'attitudeToPlayer', 'routeStrategy']) {
            if (patch[key] !== undefined && patch[key] !== '') {
                safe[key] = visualNovelPatchText(patch[key], key === 'routeStrategy' ? 220 : 160, { cleanText });
            }
        }
        for (const key of ['trust', 'suspicion', 'trauma', 'affection', 'desire', 'emotionalValue', 'emotionalDesire']) {
            if (Number.isFinite(Number(patch[key]))) {
                safe[key] = clampPercent(patch[key]);
            }
        }
        for (const key of ['memory', 'memoryChanges', 'flags', 'arcLog', 'relationshipAxes', 'hobbies', 'likes', 'sexualKinks', 'kinks', 'intimatePreferences']) {
            if (Array.isArray(patch[key])) {
                safe[key] = patch[key].slice(0, 5).map((item) => visualNovelPatchText(item, 180, { cleanText })).filter(Boolean);
            }
        }
        if (Object.keys(safe).length) {
            safeCards[visualNovelPatchText(patch.name || name, 48, { cleanText })] = safe;
        }
    }
    return safeCards;
}

export function applyVisualNovelSafeStatePatch(state, patch, {
    source = 'vn-script',
    cleanText = defaultCleanText,
    clampPercent = defaultClampPercent,
    getProfile = () => null,
    profileFromSpeakerLabel = () => null,
    filterPresenceNamesForContext = (names) => names,
    uniqueNames = defaultUniqueNames,
    sceneBackdropByKey = {},
    buildDefaultVisualState = () => ({ sceneBackdrop: {} }),
    mergeGameplayState = () => {},
    mergeCharacterCards = () => {},
    now = () => new Date().toISOString(),
} = {}) {
    if (!patch || typeof patch !== 'object') {
        return null;
    }
    const applied = [];
    const blocked = blockedVisualNovelPatchKeys(patch);

    if (patch.current && typeof patch.current === 'object') {
        const nextCurrent = {};
        const allowDebugSceneFields = source === 'debug-hook';
        if (allowDebugSceneFields && Number.isFinite(Number(patch.current.day))) {
            nextCurrent.day = Math.max(1, Math.round(Number(patch.current.day)));
        }
        if (allowDebugSceneFields && patch.current.time) {
            nextCurrent.time = visualNovelPatchText(patch.current.time, 40, { cleanText });
        }
        if (allowDebugSceneFields && patch.current.arc) {
            nextCurrent.arc = visualNovelPatchText(patch.current.arc, 40, { cleanText });
        }
        if (patch.current.location) {
            nextCurrent.location = visualNovelPatchText(patch.current.location, 80, { cleanText });
        }
        if (patch.current.viewpoint) {
            nextCurrent.viewpoint = visualNovelPatchText(patch.current.viewpoint, 80, { cleanText });
        }
        if (Object.keys(nextCurrent).length) {
            state.current = { ...(state.current || {}), ...nextCurrent };
            applied.push('current');
        }
    }

    const patchBackdrop = patch.sceneBackdrop || patch.visuals?.sceneBackdrop;
    if (patchBackdrop && typeof patchBackdrop === 'object') {
        const key = patchBackdrop.currentKey || patchBackdrop.backgroundKey || patchBackdrop.key;
        if (key && sceneBackdropByKey[key]) {
            state.visuals ??= buildDefaultVisualState();
            state.visuals.sceneBackdrop = {
                ...(state.visuals.sceneBackdrop || buildDefaultVisualState().sceneBackdrop),
                currentKey: key,
                mode: patchBackdrop.mode === 'manual' ? 'manual' : 'adaptive',
                imageUrl: patchBackdrop.mode === 'manual' ? visualNovelPatchText(patchBackdrop.imageUrl || '', 260, { cleanText }) : '',
                lastAutoKey: key,
                lastReason: visualNovelPatchText(patchBackdrop.lastReason || patchBackdrop.reason || `VN Script 选择背景：${sceneBackdropByKey[key].title}`, 160, { cleanText }),
                updatedAt: now(),
            };
            applied.push('sceneBackdrop');
        }
    }

    if (patch.gameplay && typeof patch.gameplay === 'object') {
        const safeGameplay = {};
        for (const key of ['activeObjective', 'objectiveStage', 'lastOutcome']) {
            if (patch.gameplay[key]) {
                safeGameplay[key] = visualNovelPatchText(patch.gameplay[key], key === 'lastOutcome' ? 260 : 160, { cleanText });
            }
        }
        for (const key of ['openQuestions', 'actionHints', 'failurePressure']) {
            if (Array.isArray(patch.gameplay[key])) {
                safeGameplay[key] = patch.gameplay[key].slice(0, 6).map((item) => visualNovelPatchText(item, 140, { cleanText })).filter(Boolean);
            }
        }
        if (Object.keys(safeGameplay).length) {
            mergeGameplayState(state, safeGameplay);
            applied.push('gameplay');
        }
    }

    const sceneCharacters = normalizeVisualNovelPatchSceneCharacters(state, patch, {
        getProfile,
        profileFromSpeakerLabel,
        filterPresenceNamesForContext,
        uniqueNames,
        cleanText,
    });
    if (sceneCharacters.length) {
        state.flags ??= {};
        state.flags.lastSceneCharacters = sceneCharacters;
        state.flags.lastScenePresenceDay = Number(state.current?.day) || 1;
        state.flags.lastScenePresenceLocation = state.current?.location || '';
        applied.push('presence');
    }

    const safeCards = normalizeVisualNovelPatchCharacterCards(patch.characterCards, {
        cleanText,
        clampPercent,
    });
    if (Object.keys(safeCards).length) {
        mergeCharacterCards(state, safeCards);
        applied.push('characterCards');
    }

    state.flags ??= {};
    state.flags.lastVnStatePatch = applied.length
        ? `VN Script 安全补丁已应用：${applied.join('、')}。${blocked.length ? `已阻止字段：${blocked.slice(0, 8).join('、')}。` : ''}`
        : `VN Script statePatch 未包含可应用白名单字段。${blocked.length ? `已阻止字段：${blocked.slice(0, 8).join('、')}。` : ''}`;
    state.flags.lastVnStatePatchAt = now();
    state.flags.lastVnStatePatchSource = source;
    return {
        applied,
        blocked,
        summary: state.flags.lastVnStatePatch,
    };
}
