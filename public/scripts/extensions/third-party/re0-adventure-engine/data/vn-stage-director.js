import {
    buildAssetPlan,
} from './asset-policy-engine.js';

function cleanText(value = '', limit = 900) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= limit) {
        return text;
    }
    return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function isStagePlayableSegment(segment = {}) {
    if (!segment?.text) {
        return false;
    }
    const source = String(segment.source || segment.kind || segment.role || '').toLowerCase();
    if (/chat|world-will|tool|system/u.test(source)) {
        return false;
    }
    const text = String(segment.text || '').trim();
    return !/^\/(?:chat|world|will|ask|talk|tool|system|sys|世界意志|对话|聊天|工具|系统)\b/iu.test(text)
        && !/^【\/(?:chat|world|will|ask|talk|tool|system|sys)/iu.test(text);
}

function segmentSpeakerText(segment = {}) {
    return [
        segment.speakerName,
        segment.speaker,
        segment.speakerId,
        segment.type,
        segment.text,
        segment.pose,
        segment.expression,
    ].filter(Boolean).join(' ');
}

export function visualNovelStageTextWindow(script = null, {
    fallbackText = '',
    before = 2,
    after = 2,
} = {}) {
    const segments = Array.isArray(script?.segments) ? script.segments : [];
    const currentIndex = Math.max(0, Math.min(segments.length - 1, Number(script?.currentIndex) || 0));
    if (!segments.length) {
        return {
            text: cleanText(fallbackText, 1200),
            currentSegment: null,
            segmentCount: 0,
            windowStart: 0,
            windowEnd: 0,
            ignoredChatCount: 0,
            source: 'fallback-text',
        };
    }
    const windowStart = Math.max(0, currentIndex - Math.max(0, Number(before) || 0));
    const windowEnd = Math.min(segments.length, currentIndex + Math.max(0, Number(after) || 0) + 1);
    const windowSegments = segments.slice(windowStart, windowEnd);
    const playable = windowSegments.filter(isStagePlayableSegment);
    const currentPlayable = isStagePlayableSegment(segments[currentIndex]);
    const text = cleanText([
        currentPlayable ? segmentSpeakerText(segments[currentIndex]) : '',
        ...playable.map(segmentSpeakerText),
    ].filter(Boolean).join('\n'), 1400);
    return {
        text: text || cleanText(fallbackText, 1200),
        currentSegment: currentPlayable ? segments[currentIndex] : null,
        segmentCount: segments.length,
        windowStart,
        windowEnd,
        ignoredChatCount: windowSegments.length - playable.length,
        source: 'vn-text-queue',
    };
}

export function buildVisualNovelStageDirector(state = {}, script = null, {
    fallbackText = '',
    limit = 8,
} = {}) {
    const queue = visualNovelStageTextWindow(script, { fallbackText });
    const assetPlan = buildAssetPlan(state, {
        rawText: queue.text,
        text: queue.text,
        stageTextOnly: true,
    }, {
        limit,
        requiredBackdropKey: script?.backgroundKey || state?.visuals?.visualNovel?.backgroundKey || '',
    });
    return {
        version: 'vn-stage-director/v1',
        source: queue.source,
        stageText: queue.text,
        windowStart: queue.windowStart,
        windowEnd: queue.windowEnd,
        ignoredChatCount: queue.ignoredChatCount,
        currentSegment: queue.currentSegment,
        selectedBackdropKey: assetPlan.selectedBackdrop?.key || '',
        selectedBackdropConfidence: assetPlan.selectedBackdrop?.confidence || '',
        candidateBackdropKeys: (assetPlan.candidateBackdrops || []).map((item) => item.key).filter(Boolean),
        assetPlan,
    };
}

