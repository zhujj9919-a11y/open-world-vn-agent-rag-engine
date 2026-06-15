export const VISUAL_NOVEL_SCRIPT_VERSION = 'vn60';

function defaultCleanText(value, limit = 720) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function extractDirectDialogueText(text = '') {
    const source = String(text || '').trim();
    if (!source) {
        return '';
    }
    const quoteMatch = source.match(/(?:^[^「『“”」』]{0,24}[：:]\s*)?[「『“]([^「『“”」』]{1,180})[」』”]/u);
    if (quoteMatch?.[1]) {
        return quoteMatch[1].trim();
    }
    const colonMatch = source.match(/^[\u4e00-\u9fa5A-Za-z0-9_·.\-\s]{1,24}[：:]\s*([^：:\n]{1,180})$/u);
    if (colonMatch?.[1] && !/[。！？!?]\s*[\u4e00-\u9fa5A-Za-z]/u.test(colonMatch[1])) {
        return colonMatch[1].trim();
    }
    return '';
}

function directSpeakerProfileFromDialogueLabel(text = '', resolveSpeaker = () => null) {
    const source = String(text || '').trim();
    if (!source) {
        return null;
    }
    const match = source.match(/^([\u4e00-\u9fa5A-Za-z0-9_·・.\-\s]{1,36})[：:]\s*[「『“"]/u);
    if (!match?.[1]) {
        return null;
    }
    const label = match[1]
        .replace(/^(?:发言|台词|说话人|speaker)\s*/iu, '')
        .trim();
    const profile = resolveSpeaker(label);
    return profile?.id && profile.id !== 'narrator' ? profile : null;
}

function firstBalancedJsonObjectText(value) {
    const source = String(value || '').trim();
    const start = source.indexOf('{');
    if (start < 0) {
        return '';
    }
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
        const char = source[index];
        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }
        if (char === '"') {
            inString = true;
            continue;
        }
        if (char === '{') {
            depth += 1;
            continue;
        }
        if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return source.slice(start, index + 1);
            }
        }
    }
    return '';
}

function repairCommonVisualNovelJsonText(value) {
    const source = String(value || '').trim();
    if (!source || !/"segments"\s*:\s*\[/u.test(source)) {
        return source;
    }
    const candidates = [];
    const beatExtraClose = source.replace(/("beat"\s*:\s*\{[\s\S]*?\})\s*\}\s*,\s*("choices"\s*:)/u, '$1,$2');
    if (beatExtraClose !== source) {
        candidates.push(beatExtraClose);
    }
    candidates.push(
        source.replace(/("segments"\s*:\s*\[[\s\S]*\})\s*,\s*("choices"\s*:)/u, '$1],$2'),
        source.replace(/("segments"\s*:\s*\[[\s\S]*\})\s*,\s*("statePatch"\s*:)/u, '$1],$2'),
        source.replace(/("choices"\s*:\s*\[[\s\S]*?"[^\]]*)\s*,\s*("statePatch"\s*:)/u, '$1],$2'),
    );
    const firstChanged = candidates.find((candidate) => candidate && candidate !== source);
    for (const candidate of candidates) {
        if (!candidate || candidate === source) {
            continue;
        }
        try {
            JSON.parse(candidate);
            return candidate;
        } catch {
            // Keep looking for a repair that preserves the full hidden script.
        }
    }
    return firstChanged || source;
}

function escapeLikelyUnescapedJsonStringQuotes(value = '') {
    const source = String(value || '');
    let output = '';
    let inString = false;
    let escaped = false;
    for (let index = 0; index < source.length; index += 1) {
        const char = source[index];
        if (!inString) {
            output += char;
            if (char === '"') {
                inString = true;
                escaped = false;
            }
            continue;
        }
        if (escaped) {
            output += char;
            escaped = false;
            continue;
        }
        if (char === '\\') {
            output += char;
            escaped = true;
            continue;
        }
        if (char === '"') {
            const tail = source.slice(index + 1);
            const next = tail.match(/\S/u)?.[0] || '';
            if (!next || /[:,}\]]/u.test(next)) {
                output += char;
                inString = false;
            } else {
                output += '\\"';
            }
            continue;
        }
        output += char;
    }
    return output;
}

function defaultExtractJson(text) {
    const source = String(text || '').trim();
    const attempts = [source];
    for (const candidate of [...attempts]) {
        const repaired = repairCommonVisualNovelJsonText(candidate);
        if (repaired && repaired !== candidate) {
            attempts.push(repaired);
        }
        const escapedQuotes = escapeLikelyUnescapedJsonStringQuotes(repaired || candidate);
        if (escapedQuotes && escapedQuotes !== repaired && escapedQuotes !== candidate) {
            attempts.push(escapedQuotes);
        }
    }
    const balanced = firstBalancedJsonObjectText(source);
    if (balanced && balanced !== source) {
        attempts.push(balanced);
        const repairedBalanced = repairCommonVisualNovelJsonText(balanced);
        if (repairedBalanced && repairedBalanced !== balanced) {
            attempts.push(repairedBalanced);
        }
    }
    let firstError = null;
    for (const candidate of attempts) {
        try {
            return JSON.parse(candidate);
        } catch (error) {
            firstError ||= error;
        }
    }
    try {
        return JSON.parse(source);
    } catch (error) {
        throw firstError || error;
    }
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

function directSpeakerTailBeforeDialogue(text = '', resolveSpeaker = () => null) {
    const source = String(text || '').trimEnd();
    const match = source.match(/([\u4e00-\u9fa5A-Za-zA-Z·・]{1,18})\s*$/u);
    if (!match) {
        return null;
    }
    const label = match[1];
    const profile = resolveSpeaker(label);
    if (!profile?.id || profile.id === 'narrator') {
        return null;
    }
    const before = source.slice(0, source.length - label.length).trimEnd();
    if (!before || /[。！？.!?；;\n]\s*$/u.test(before)) {
        return { label, profile, before };
    }
    return null;
}

function cleanNarrationPiece(value = '', cleanText = defaultCleanText) {
    const text = cleanText(String(value || '')
        .replace(/[，、；;：:]\s*$/u, '')
        .trim(), 720);
    if (!text) {
        return '';
    }
    return /[。！？.!?」』”]$/u.test(text) ? text : `${text}。`;
}

function candidateSpeakerLabelsFromTail(tail = '') {
    const source = String(tail || '')
        .replace(/[「『“”"'：:]/gu, '')
        .trim();
    if (!source) {
        return [];
    }
    const withoutVoiceTail = source.replace(/的声音[\s\S]*$/u, '');
    const beforeSpeechCue = source.replace(/(?:声音|低声|轻声|压低声音|冷声|沉声|开口|问|说|说道|喊|回答|提醒|警告|呢喃|喃喃|响起|传来|颤抖|咬牙|叹息|笑)[\s\S]*$/u, '');
    const tokenMatches = source.match(/[\u4e00-\u9fa5A-Za-zA-Z·・]{1,24}/gu) || [];
    return defaultUniqueNames([
        source,
        withoutVoiceTail,
        beforeSpeechCue,
        ...tokenMatches,
        ...tokenMatches.map((item) => item.replace(/的声音$/u, '')),
    ], 12);
}

export function findVisualNovelEmbeddedDialogue(text, {
    cleanText = defaultCleanText,
    resolveSpeaker = () => null,
} = {}) {
    const source = String(text || '');
    if (!source) {
        return null;
    }
    const pattern = /[：:]\s*[「『“"]([^」』”"]{2,520})[」』”"]/gu;
    let match = null;
    while ((match = pattern.exec(source)) !== null) {
        const beforeColon = source.slice(0, match.index).trimEnd();
        const boundary = Math.max(
            beforeColon.lastIndexOf('。'),
            beforeColon.lastIndexOf('！'),
            beforeColon.lastIndexOf('？'),
            beforeColon.lastIndexOf('!'),
            beforeColon.lastIndexOf('?'),
            beforeColon.lastIndexOf('；'),
            beforeColon.lastIndexOf(';'),
            beforeColon.lastIndexOf('\n'),
        );
        const attributionTail = beforeColon.slice(Math.max(0, boundary + 1)).trim();
        if (!attributionTail) {
            continue;
        }
        const hasSpeechCue = /说|问|喊|道|回答|提醒|警告|开口|声音|响起|传来|呢喃|喃喃|咬牙|冷声|沉声|低声|轻声|压低声音|颤抖|嘶哑|笑|叹息|叫住|抓住|盯着|看着|抬头/u.test(attributionTail);
        const directProfile = directSpeakerTailBeforeDialogue(attributionTail, resolveSpeaker)?.profile;
        if (!hasSpeechCue && !directProfile) {
            continue;
        }
        const candidates = candidateSpeakerLabelsFromTail(attributionTail);
        const profile = directProfile || candidates.map((candidate) => resolveSpeaker(candidate)).find((item) => item?.id && item.id !== 'narrator');
        if (!profile?.id || profile.id === 'narrator') {
            continue;
        }
        return {
            index: match.index,
            endIndex: pattern.lastIndex,
            attributionTail,
            speakerId: profile.id,
            speakerName: profile.name || profile.displayName || profile.id,
            text: cleanText(match[1], 520),
        };
    }
    return null;
}

export function splitVisualNovelEmbeddedDialogueSegments(segments = [], {
    cleanText = defaultCleanText,
    resolveSpeaker = () => null,
} = {}) {
    const safe = Array.isArray(segments) ? segments : [];
    const output = [];
    for (const segment of safe) {
        if (!segment || segment.type === 'dialogue') {
            output.push(segment);
            continue;
        }
        const source = cleanText(segment.text || '', 1200);
        if (!source) {
            continue;
        }
        const pattern = /[：:]\s*[「『“"]([^」』”"]{2,520})[」』”"]/gu;
        let cursor = 0;
        let match = null;
        let found = false;
        while ((match = pattern.exec(source)) !== null) {
            const prefix = source.slice(cursor, match.index);
            const embedded = findVisualNovelEmbeddedDialogue(`${prefix}${match[0]}`, { cleanText, resolveSpeaker });
            if (!embedded || embedded.index !== prefix.length) {
                continue;
            }
            const directTail = directSpeakerTailBeforeDialogue(prefix, resolveSpeaker);
            const narrationText = cleanNarrationPiece(directTail ? directTail.before : prefix, cleanText);
            if (narrationText) {
                output.push({
                    ...segment,
                    id: `${segment.id || 'segment'}:n:${output.length}`,
                    type: 'narration',
                    speakerId: 'narrator',
                    speakerName: '世界意志',
                    text: narrationText,
                });
            }
            const dialogueText = cleanText(match[1], 520);
            if (dialogueText) {
                output.push({
                    ...segment,
                    id: `${segment.id || 'segment'}:d:${output.length}`,
                    type: 'dialogue',
                    speakerId: embedded.speakerId,
                    speakerName: embedded.speakerName,
                    text: dialogueText,
                });
                found = true;
            }
            cursor = pattern.lastIndex;
        }
        if (!found) {
            output.push(segment);
            continue;
        }
        const after = cleanNarrationPiece(source.slice(cursor), cleanText);
        if (after) {
            output.push({
                ...segment,
                id: `${segment.id || 'segment'}:n:${output.length}`,
                type: 'narration',
                speakerId: 'narrator',
                speakerName: '世界意志',
                text: after,
            });
        }
    }
    return output.filter(Boolean);
}

export function extractVisualNovelScriptBlock(text, { extractJson = defaultExtractJson } = {}) {
    const raw = String(text || '');
    const patterns = [
        /<!--\s*RE0_VN_SCRIPT\s*:?\s*([\s\S]*?)\s*-->/iu,
        /```(?:re0-vn-script|re0_vn_script|vn-script|visual-novel)\s*([\s\S]*?)```/iu,
    ];
    for (const pattern of patterns) {
        const match = raw.match(pattern);
        if (!match) {
            continue;
        }
        try {
            return {
                script: extractJson(match[1]),
                narrative: raw.replace(match[0], '').trim(),
                sourceMode: pattern.source.startsWith('<!--') ? 'hidden-comment' : 'fenced-block',
                warning: '',
            };
        } catch (error) {
            return {
                script: null,
                narrative: raw.replace(match[0], '').trim(),
                sourceMode: 'invalid-block',
                warning: `VN Script Block JSON 解析失败：${error?.message || error}`,
            };
        }
    }
    const unclosedHidden = raw.match(/<!--\s*RE0_VN_SCRIPT\s*:?\s*([\s\S]*)$/iu);
    if (unclosedHidden) {
        try {
            return {
                script: extractJson(unclosedHidden[1]),
                narrative: raw.slice(0, unclosedHidden.index).trim(),
                sourceMode: 'hidden-comment-unclosed',
                warning: 'VN Script hidden comment 缺少闭合 -->，已按完整 JSON 容错解析。',
            };
        } catch (error) {
            return {
                script: null,
                narrative: raw.slice(0, unclosedHidden.index).trim(),
                sourceMode: 'invalid-unclosed-block',
                warning: `VN Script unclosed hidden comment JSON 解析失败：${error?.message || error}`,
            };
        }
    }
    return {
        script: null,
        narrative: raw,
        sourceMode: 'heuristic',
        warning: '',
    };
}

export function normalizeVisualNovelScriptChoice(choice, { cleanText = defaultCleanText } = {}) {
    const text = typeof choice === 'string'
        ? choice
        : (choice?.text || choice?.label || choice?.action || choice?.title || '');
    return cleanText(text, 120);
}

export function normalizeVisualNovelScriptCastId(value, {
    getProfile = () => null,
    profileFromSpeakerLabel = () => null,
} = {}) {
    const profile = typeof value === 'string'
        ? (getProfile(value) || profileFromSpeakerLabel(value))
        : (getProfile(value?.id || value?.speakerId || '') || profileFromSpeakerLabel(value?.name || value?.speakerName || ''));
    return profile?.id && profile.id !== 'narrator' ? profile.id : '';
}

export function normalizeVisualNovelScriptSegment(segment, messageId, index, {
    cleanText = defaultCleanText,
    getProfile = () => null,
    profileFromSpeakerLabel = () => null,
} = {}) {
    const source = typeof segment === 'string' ? { type: 'narration', text: segment } : (segment || {});
    const rawType = String(source.type || source.kind || source.role || '').toLowerCase();
    const rawText = source.text || source.line || source.content || source.narration || source.dialogue || '';
    const text = cleanText(rawText, 720);
    if (!text) {
        return null;
    }
    const explicitSpeaker = source.speakerId || source.speaker || source.characterId || source.character || source.name || source.speakerName || '';
    const resolveSpeaker = (value = '') => getProfile(value) || profileFromSpeakerLabel(value);
    const directSpeaker = directSpeakerProfileFromDialogueLabel(text, resolveSpeaker);
    const profile = directSpeaker || (explicitSpeaker ? resolveSpeaker(explicitSpeaker) : getProfile('narrator'));
    const wantsDialogue = !!directSpeaker || (/^(dialogue|line|speech|say|voice)$/u.test(rawType) && profile?.id && profile.id !== 'narrator');
    const isDialogue = wantsDialogue || (profile?.id && profile.id !== 'narrator' && rawType !== 'narration' && rawType !== 'narrator');
    const segmentText = isDialogue ? (extractDirectDialogueText(text) || text) : text;
    return {
        id: `${messageId}:s:${index}`,
        type: isDialogue ? 'dialogue' : 'narration',
        speakerId: isDialogue ? profile.id : 'narrator',
        speakerName: isDialogue ? profile.name : '世界意志',
        text: segmentText,
        action: cleanText(source.action || source.stageAction || source.direction || source.beat || '', 80),
        tone: cleanText(source.tone || source.mood || source.delivery || '', 60),
        expression: cleanText(source.expression || source.face || '', 40),
        pose: cleanText(source.pose || source.position || '', 40),
        camera: cleanText(source.camera || source.shot || source.lens || '', 60),
        focus: cleanText(source.focus || source.target || '', 60),
        sfx: cleanText(source.sfx || source.sound || source.audioCue || '', 60),
        enter: cleanText(source.enter || '', 40),
        exit: cleanText(source.exit || '', 40),
    };
}

export function buildVisualNovelRoleMetrics(segments = [], {
    uniqueNames = defaultUniqueNames,
    speakerNameForSegment = (segment) => segment?.speakerName || '',
    now = () => new Date().toISOString(),
} = {}) {
    const safeSegments = Array.isArray(segments) ? segments : [];
    const dialogueSegments = safeSegments.filter((segment) => segment?.type === 'dialogue' && segment.speakerId !== 'narrator');
    const narrationSegments = safeSegments.filter((segment) => segment?.type !== 'dialogue' || segment.speakerId === 'narrator');
    const directSpeakerNames = uniqueNames(dialogueSegments.map(speakerNameForSegment).filter(Boolean), 8);
    const total = Math.max(1, safeSegments.length);
    const narratorShare = Math.round((narrationSegments.length / total) * 100) / 100;
    const roleDrivenPass = directSpeakerNames.length >= 1 && dialogueSegments.length >= 1 && narratorShare <= 0.85;
    return {
        directSpeakerCount: directSpeakerNames.length,
        directSpeakerNames,
        dialogueSegments: dialogueSegments.length,
        narrationSegments: narrationSegments.length,
        narratorShare,
        roleDrivenPass,
        summary: roleDrivenPass
            ? `通过：${directSpeakerNames.join('、')} 直接发声；旁白占比 ${Math.round(narratorShare * 100)}%。`
            : `未达标：直接发声 ${directSpeakerNames.length} 人，旁白占比 ${Math.round(narratorShare * 100)}%。`,
        lastUpdatedAt: now(),
    };
}

export function normalizeVisualNovelRoleMetrics(metrics = {}, segments = [], {
    buildMetrics = buildVisualNovelRoleMetrics,
    summarize = (value) => defaultCleanText(value, 160),
} = {}) {
    const fallback = buildMetrics(segments);
    const hasCurrentSegments = Array.isArray(segments) && segments.length > 0;
    return {
        ...fallback,
        ...(metrics && typeof metrics === 'object' ? metrics : {}),
        directSpeakerNames: hasCurrentSegments ? fallback.directSpeakerNames : (Array.isArray(metrics?.directSpeakerNames) ? metrics.directSpeakerNames.slice(0, 8) : fallback.directSpeakerNames),
        directSpeakerCount: hasCurrentSegments ? fallback.directSpeakerCount : Math.max(0, Number(metrics?.directSpeakerCount ?? fallback.directSpeakerCount) || 0),
        dialogueSegments: hasCurrentSegments ? fallback.dialogueSegments : Math.max(0, Number(metrics?.dialogueSegments ?? fallback.dialogueSegments) || 0),
        narrationSegments: hasCurrentSegments ? fallback.narrationSegments : Math.max(0, Number(metrics?.narrationSegments ?? fallback.narrationSegments) || 0),
        narratorShare: hasCurrentSegments ? fallback.narratorShare : Math.max(0, Math.min(1, Number(metrics?.narratorShare ?? fallback.narratorShare) || 0)),
        roleDrivenPass: hasCurrentSegments ? fallback.roleDrivenPass : (typeof metrics?.roleDrivenPass === 'boolean' ? metrics.roleDrivenPass : fallback.roleDrivenPass),
        summary: summarize(hasCurrentSegments ? fallback.summary : (metrics?.summary || fallback.summary), 160),
        lastUpdatedAt: metrics?.lastUpdatedAt || fallback.lastUpdatedAt,
    };
}
