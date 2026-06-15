export function applyVisualNovelPlaybackMode(vn, mode = 'off') {
    if (!vn || typeof vn !== 'object') {
        return { mode: 'off', autoPlay: false, skipMode: false };
    }
    const normalizedMode = mode === 'auto' || mode === 'skip' ? mode : 'off';
    vn.autoPlay = normalizedMode === 'auto';
    vn.skipMode = normalizedMode === 'skip';
    return {
        mode: normalizedMode,
        autoPlay: vn.autoPlay,
        skipMode: vn.skipMode,
    };
}

export function nextVisualNovelPlaybackMode(vn, control = 'off') {
    if (control === 'auto') {
        return vn?.autoPlay ? 'off' : 'auto';
    }
    if (control === 'skip') {
        return vn?.skipMode ? 'off' : 'skip';
    }
    return 'off';
}

export function toggleVisualNovelBacklog(vn, forcedOpen = null) {
    if (!vn || typeof vn !== 'object') {
        return false;
    }
    vn.backlogOpen = typeof forcedOpen === 'boolean' ? forcedOpen : !vn.backlogOpen;
    return vn.backlogOpen;
}

export function advanceVisualNovelRuntimeSegment(vn, delta = 1, { stopPlayback = false } = {}) {
    if (!vn || typeof vn !== 'object') {
        return {
            changed: false,
            count: 0,
            current: 0,
            next: 0,
            delta,
            stopPlayback,
            reachedEnd: true,
            autoBefore: false,
            skipBefore: false,
            autoAfter: false,
            skipAfter: false,
        };
    }
    const count = Array.isArray(vn.segments) ? vn.segments.length : 0;
    const maxIndex = Math.max(0, count - 1);
    const current = Math.max(0, Math.min(maxIndex, Number(vn.currentIndex) || 0));
    const next = Math.max(0, Math.min(maxIndex, current + delta));
    const autoBefore = vn.autoPlay === true;
    const skipBefore = vn.skipMode === true;

    if (stopPlayback) {
        vn.autoPlay = false;
        vn.skipMode = false;
    }

    if (next !== current) {
        vn.currentIndex = next;
    } else if (delta > 0 && count > 0 && current >= maxIndex && (vn.autoPlay || vn.skipMode)) {
        vn.autoPlay = false;
        vn.skipMode = false;
    }

    return {
        changed: next !== current,
        count,
        current,
        next,
        delta,
        stopPlayback,
        reachedEnd: count <= 0 || next >= maxIndex,
        autoBefore,
        skipBefore,
        autoAfter: vn.autoPlay === true,
        skipAfter: vn.skipMode === true,
    };
}

export function visualNovelAutoAdvancePlan(vn, script = null) {
    const segmentCount = Array.isArray(script?.segments) ? script.segments.length : (Array.isArray(vn?.segments) ? vn.segments.length : 0);
    const currentIndex = Math.max(0, Number(script?.currentIndex ?? vn?.currentIndex) || 0);
    const autoPlay = vn?.autoPlay === true;
    const skipMode = vn?.skipMode === true;
    if (!(autoPlay || skipMode) || segmentCount <= 1) {
        return {
            shouldSchedule: false,
            shouldStopPlayback: false,
            delay: 0,
            segmentCount,
            currentIndex,
        };
    }
    if (currentIndex >= segmentCount - 1) {
        return {
            shouldSchedule: false,
            shouldStopPlayback: false,
            delay: 0,
            segmentCount,
            currentIndex,
        };
    }
    return {
        shouldSchedule: true,
        shouldStopPlayback: false,
        delay: skipMode ? Math.max(120, Number(vn?.skipDelayMs) || 300) : Math.max(900, Number(vn?.autoDelayMs) || 1800),
        segmentCount,
        currentIndex,
    };
}
