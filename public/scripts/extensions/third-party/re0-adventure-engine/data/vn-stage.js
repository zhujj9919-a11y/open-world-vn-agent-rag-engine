import { VISUAL_NOVEL_VISIBLE_CHOICE_LIMIT } from './vn-constants.js';

function defaultEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function defaultShortText(value, limit = 80) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

const RE0_VN_ICON_PATHS = {
    actions: ['path:M4 6h16', 'path:M4 12h12', 'path:M4 18h8'],
    answer: ['path:M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'path:M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z', 'path:M9 7h6', 'path:M9 11h5'],
    archive: ['path:M3 7h18', 'path:M5 7v13h14V7', 'path:M8 11h8', 'path:M10 15h4'],
    chevronLeft: ['path:M15 18l-6-6 6-6'],
    chevronRight: ['path:M9 18l6-6-6-6'],
    close: ['path:M6 6l12 12', 'path:M18 6L6 18'],
    collapse: ['path:M8 3v5H3', 'path:M16 3v5h5', 'path:M8 21v-5H3', 'path:M16 21v-5h5'],
    compass: ['circle:12 12 9', 'path:M15 9l-2 5-5 2 2-5z'],
    crosshair: ['circle:12 12 7', 'path:M12 2v4', 'path:M12 18v4', 'path:M2 12h4', 'path:M18 12h4'],
    expand: ['path:M9 3H3v6', 'path:M15 3h6v6', 'path:M9 21H3v-6', 'path:M15 21h6v-6'],
    eye: ['path:M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z', 'circle:12 12 3'],
    eyeOff: ['path:M3 3l18 18', 'path:M10.7 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-3.1 4', 'path:M6.2 6.2C3.7 8 2 12 2 12s3.5 7 10 7c1.5 0 2.9-.3 4.1-.9'],
    fastForward: ['path:M4 5l8 7-8 7V5z', 'path:M12 5l8 7-8 7V5z'],
    flag: ['path:M5 22V4', 'path:M5 4h12l-2 5 2 5H5'],
    folder: ['path:M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
    gauge: ['path:M4 14a8 8 0 1 1 16 0', 'path:M12 14l4-4', 'path:M7 18h10'],
    home: ['path:M3 10.5L12 3l9 7.5', 'path:M5 10v10h14V10', 'path:M9 20v-6h6v6'],
    key: ['circle:8 15 3', 'path:M10.5 12.5L21 2', 'path:M16 7l2 2', 'path:M14 9l2 2'],
    pause: ['path:M9 5v14', 'path:M15 5v14'],
    pen: ['path:M12 20h9', 'path:M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z'],
    play: ['path:M8 5v14l11-7z'],
    refresh: ['path:M20 6v6h-6', 'path:M4 18v-6h6', 'path:M19 12a7 7 0 0 0-12-5', 'path:M5 12a7 7 0 0 0 12 5'],
    replay: ['path:M5 12a7 7 0 1 0 2-5', 'path:M5 4v6h6'],
    save: ['path:M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z', 'path:M17 21v-8H7v8', 'path:M7 3v5h8'],
    send: ['path:M22 2L11 13', 'path:M22 2l-7 20-4-9-9-4z'],
    settings: ['circle:12 12 3', 'path:M19 12h3', 'path:M2 12h3', 'path:M12 2v3', 'path:M12 19v3', 'path:M17 5l-2 2', 'path:M7 17l-2 2', 'path:M5 5l2 2', 'path:M17 17l2 2'],
    spark: ['path:M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z'],
    state: ['path:M4 19V5', 'path:M8 19v-8', 'path:M12 19V7', 'path:M16 19v-5', 'path:M20 19V9'],
    stop: ['path:M7 7h10v10H7z'],
    time: ['circle:12 12 9', 'path:M12 7v5l3 2'],
    upload: ['path:M12 3v13', 'path:M7 8l5-5 5 5', 'path:M5 21h14'],
    worldline: ['circle:6 6 2', 'circle:18 6 2', 'circle:12 18 2', 'path:M8 6h4a4 4 0 0 1 4 4v2', 'path:M12 18v-4a4 4 0 0 0-4-4H6'],
};

const RE0_VN_ICON_IMAGE_ROOT = '/scripts/extensions/third-party/re0-adventure-engine/assets/generated/ui-icons';
const RE0_VN_ICON_IMAGE_PATHS = {
    actions: `${RE0_VN_ICON_IMAGE_ROOT}/actions.png`,
    answer: `${RE0_VN_ICON_IMAGE_ROOT}/answer.png`,
    archive: `${RE0_VN_ICON_IMAGE_ROOT}/folder.png`,
    collapse: `${RE0_VN_ICON_IMAGE_ROOT}/collapse.png`,
    compass: `${RE0_VN_ICON_IMAGE_ROOT}/compass.png`,
    expand: `${RE0_VN_ICON_IMAGE_ROOT}/expand.png`,
    flag: `${RE0_VN_ICON_IMAGE_ROOT}/flag.png`,
    folder: `${RE0_VN_ICON_IMAGE_ROOT}/folder.png`,
    gauge: `${RE0_VN_ICON_IMAGE_ROOT}/state.png`,
    play: `${RE0_VN_ICON_IMAGE_ROOT}/play.png`,
    refresh: `${RE0_VN_ICON_IMAGE_ROOT}/refresh.png`,
    replay: `${RE0_VN_ICON_IMAGE_ROOT}/replay.png`,
    save: `${RE0_VN_ICON_IMAGE_ROOT}/save.png`,
    send: `${RE0_VN_ICON_IMAGE_ROOT}/send.png`,
    settings: `${RE0_VN_ICON_IMAGE_ROOT}/settings.png`,
    spark: `${RE0_VN_ICON_IMAGE_ROOT}/spark.png`,
    state: `${RE0_VN_ICON_IMAGE_ROOT}/state.png`,
    time: `${RE0_VN_ICON_IMAGE_ROOT}/replay.png`,
    worldline: `${RE0_VN_ICON_IMAGE_ROOT}/worldline.png`,
};

function renderVnIcon(name, escapeHtml = defaultEscapeHtml) {
    if (RE0_VN_ICON_IMAGE_PATHS[name]) {
        const safeName = escapeHtml(name);
        const safeSrc = escapeHtml(RE0_VN_ICON_IMAGE_PATHS[name]);
        return `<span class="re0-vn-icon re0-vn-icon-${safeName} re0-vn-icon-bitmap" aria-hidden="true"><img src="${safeSrc}" alt="" loading="lazy" decoding="async"></span>`;
    }
    const safeName = RE0_VN_ICON_PATHS[name] ? name : 'spark';
    const parts = RE0_VN_ICON_PATHS[safeName].map((part) => {
        if (part.startsWith('path:')) {
            return `<path d="${escapeHtml(part.slice(5))}"></path>`;
        }
        if (part.startsWith('circle:')) {
            const [cx, cy, r] = part.slice(7).split(' ');
            return `<circle cx="${escapeHtml(cx)}" cy="${escapeHtml(cy)}" r="${escapeHtml(r)}"></circle>`;
        }
        return '';
    }).join('');
    return `<span class="re0-vn-icon re0-vn-icon-${escapeHtml(safeName)}" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${parts}</svg></span>`;
}

function vnIconLabel(name, label = '', { escapeHtml = defaultEscapeHtml, iconOnly = false } = {}) {
    const safeLabel = escapeHtml(label);
    return `${renderVnIcon(name, escapeHtml)}${label ? `<span class="re0-vn-label ${iconOnly ? 'is-sr-only' : ''}">${safeLabel}</span>` : ''}`;
}

export function buildVisualNovelChoicesMarkup(choices = [], {
    escapeHtml = defaultEscapeHtml,
    shortText = defaultShortText,
    selectedIndex = 0,
    overlay = null,
} = {}) {
    const safeChoices = Array.isArray(choices) ? choices.filter(Boolean).slice(0, VISUAL_NOVEL_VISIBLE_CHOICE_LIMIT) : [];
    if (!safeChoices.length) {
        return '';
    }
    const safeSelectedIndex = Math.max(0, Math.min(safeChoices.length - 1, Number(selectedIndex) || 0));
    const risk = overlay?.riskChoice || '';
    const keep = overlay?.keepInformationChoice || '';
    const pseudo = overlay?.pseudoSafeChoice || '';
    const choiceMeta = Array.isArray(overlay?.choiceMeta) ? overlay.choiceMeta : [];
    return safeChoices.map((choice, index) => {
        const meta = choiceMeta[index] || {};
        const isRisk = choice === risk;
        const isKeep = choice === keep;
        const isPseudo = choice === pseudo;
        const metaKind = meta.kind || (isRisk ? 'risk' : (isKeep ? 'keep' : (isPseudo ? 'pseudo' : 'normal')));
        const typeClass = metaKind === 'risk' ? 'is-risk' : (metaKind === 'keep' ? 'is-keep' : (metaKind === 'pseudo' ? 'is-pseudo' : ''));
        const typeLabel = meta.kindLabel || (metaKind === 'risk' ? '风险' : (metaKind === 'keep' ? '情报' : (metaKind === 'pseudo' ? '伪安' : '')));
        const actorLabel = meta.actor || '';
        const source = meta.source || (overlay?.source === 'if-branch-rule' ? 'if-branch-rule' : (overlay?.source || ''));
        const sourceLabel = meta.sourceLabel || source || '';
        const modeLabel = meta.modeLabel || '';
        const impactLabel = meta.impactLabel || '';
        const impactLogic = meta.impactLogic || '';
        const title = impactLogic ? `${choice}\n\n影响逻辑：${impactLogic}` : choice;
        return `
        <button type="button"
            class="re0-vn-choice ${index === safeSelectedIndex ? 'is-selected' : ''} ${typeClass}"
            data-re0-vn-choice="${escapeHtml(choice)}"
            data-re0-vn-choice-index="${escapeHtml(index)}"
            data-re0-choice-type="${escapeHtml(metaKind)}"
            data-re0-choice-source="${escapeHtml(source)}"
            data-re0-choice-actor="${escapeHtml(meta.actorId || actorLabel)}"
            data-re0-choice-mode="${escapeHtml(meta.mode || '')}"
            data-re0-choice-impact-label="${escapeHtml(impactLabel)}"
            data-re0-choice-impact-logic="${escapeHtml(impactLogic)}"
            aria-current="${index === safeSelectedIndex ? 'true' : 'false'}"
            title="${escapeHtml(title)}"
            data-re0-touch-target="large">
            <b class="${index === safeSelectedIndex ? 'is-selected-key' : ''}" aria-hidden="true">${escapeHtml(index + 1)}</b><span class="re0-choice-main">${escapeHtml(shortText(choice, 92))}</span>
            ${(actorLabel || sourceLabel || modeLabel || impactLabel) ? `<small class="re0-choice-meta">${actorLabel ? `<em>${escapeHtml(actorLabel)}</em>` : ''}${modeLabel ? `<i>${escapeHtml(modeLabel)}</i>` : ''}${sourceLabel ? `<i>${escapeHtml(sourceLabel)}</i>` : ''}${impactLabel ? `<i class="re0-choice-impact" title="${escapeHtml(impactLogic || impactLabel)}">${escapeHtml(impactLabel)}</i>` : ''}</small>` : ''}
            ${typeLabel ? `<small class="re0-choice-type">${escapeHtml(typeLabel)}</small>` : ''}
        </button>`;
    }).join('');
}

export function buildVisualNovelCharacterMarkup(profile, index, total, activeSpeakerId, {
    escapeHtml = defaultEscapeHtml,
    resolveStageAsset = () => ({ mode: 'portrait', image: '', fallback: '' }),
} = {}) {
    const safeProfile = profile || {};
    const active = safeProfile.id === activeSpeakerId;
    const side = total === 1 ? 'center' : (index < Math.ceil(total / 2) ? 'left' : 'right');
    const offset = index - (total - 1) / 2;
    const laneStep = total >= 4 ? 12.5 : total === 3 ? 16 : 23;
    const x = Math.max(-21, Math.min(21, offset * laneStep));
    const asset = resolveStageAsset(safeProfile);
    const countClass = `re0-vn-character-count-${Math.max(1, Math.min(6, total))}`;
    return `
        <div role="button" tabindex="0"
            class="re0-vn-character-hitbox ${countClass} re0-vn-character-${side}"
            style="--re0-vn-x:${x}vw; --re0-vn-z:${active ? 18 : 14};"
            data-re0-character-hitbox="true"
            data-name="${escapeHtml(safeProfile.name)}"
            title="${escapeHtml(safeProfile.name)} · ${escapeHtml(safeProfile.role)}"></div>
        <button type="button"
            class="re0-vn-character ${countClass} re0-vn-character-${side} re0-vn-character-${escapeHtml(asset.mode)} ${active ? 're0-vn-character-active is-active' : ''}"
            style="--re0-vn-x:${x}vw; --re0-vn-z:${active ? 8 : 4}; --re0-vn-active-scale:${active ? (asset.mode === 'portrait' ? 0.96 : 1) : (asset.mode === 'portrait' ? 0.9 : 0.92)};"
            data-re0-character-card="${escapeHtml(safeProfile.id)}"
            data-re0-asset-mode="${escapeHtml(asset.mode)}"
            data-re0-asset-variant-key="${escapeHtml(asset.variantKey || '')}"
            data-re0-asset-match-score="${escapeHtml(asset.matchScore ?? '')}"
            data-re0-asset-match-reason="${escapeHtml(asset.matchReason || '')}"
            data-name="${escapeHtml(safeProfile.name)}"
            title="${escapeHtml(safeProfile.name)} · ${escapeHtml(safeProfile.role)}${asset.matchReason ? ' · ' + escapeHtml(asset.matchReason) : ''}">
            <img src="${escapeHtml(asset.image)}" alt="${escapeHtml(safeProfile.name)}" loading="eager" decoding="async" fetchpriority="${active ? 'high' : 'auto'}" onerror="this.onerror=null;this.src='${escapeHtml(asset.fallback)}'">
            <span>${escapeHtml(safeProfile.name)}</span>
        </button>
    `;
}

export function buildVisualNovelBacklogMarkup(backlog = [], {
    escapeHtml = defaultEscapeHtml,
    shortText = defaultShortText,
} = {}) {
    return (Array.isArray(backlog) ? backlog : []).slice(-12).map((entry) => `
        <div class="re0-vn-backlog-line">
            <b>${escapeHtml(entry?.speaker || '世界意志')}</b>
            <span>${escapeHtml(shortText(entry?.text || '', 180))}</span>
        </div>
    `).join('');
}

function buildVisualNovelModalShell({
    statusTitle = '状态',
    statusText = '',
    contentHtml = '',
    actionHint = '',
    emptyHtml = '<small>暂无内容。</small>',
}, {
    escapeHtml = defaultEscapeHtml,
} = {}) {
    const body = contentHtml || emptyHtml;
    return `
        <div class="re0-vn-modal-shell" data-re0-vn-modal-shell>
            <div class="re0-vn-modal-status">
                <b>${escapeHtml(statusTitle)}</b>
                <span>${escapeHtml(statusText || 'UI-only 面板：只用于查看和操作，不写入剧情事实。')}</span>
            </div>
            <div class="re0-vn-modal-content">${body}</div>
            <div class="re0-vn-modal-actions">
                <small>${escapeHtml(actionHint || '关闭面板后继续当前镜头；若要改变剧情，请在输入框输入行动。')}</small>
            </div>
        </div>
    `;
}

export function renderVisualNovelStageMarkup(payload = {}, {
    escapeHtml = defaultEscapeHtml,
    shortText = defaultShortText,
} = {}) {
    const {
        backdrop = {},
        settings = {},
        apiConfig = {},
        apiKey = '',
        oaiSettings = {},
        state = {},
        backgroundImage = '',
        topbarDayText = '',
        locationTitle = '',
        routeStatusText = '',
        speakerStatusText = '',
        castHtml = '',
        insertCgHtml = '',
        speakerAvatarHtml = '',
        speakerLabel = '世界意志',
        speakerRole = '旁白',
        speakerKind = 'narration',
        speakerText = '等待下一段叙事。',
        progressText = '0/0',
        currentIndex = 0,
        segmentCount = 0,
        autoPlay = false,
        skipMode = false,
        backlogOpen = false,
        loadOpen = false,
        worldStatusOpen = false,
        worldlineOpen = false,
        answerBookOpen = false,
        configOpen = false,
        backlogHtml = '',
        worldStatusHtml = '',
        worldlineHtml = '',
        answerBookHtml = '',
        choicesHtml = '',
        choiceOverlayHint = '',
        saveListHtml = '',
        objectiveTitle = '确认当前目标',
        objectiveSubtitle = '自由探索中',
        immersiveUiHidden = false,
        checkpointText = '暂无检查点',
        textOpacity = 58,
        autoDelayMs = 1800,
        skipDelayMs = 300,
        choiceMode = false,
        selectedChoiceIndex = 0,
        choiceCount = 0,
        choicesCollapsed = false,
        choicesExpanded = false,
        choiceOverlayPosition = null,
        customActionDraft = '',
        pendingSendActive = false,
        pendingSendText = '',
        pendingSendElapsedMs = 0,
        pendingSendRecoverable = false,
        isSetupMode = false,
        activeModalName = 'none',
        activeModalHint = '系统面板只用于查看与操作，不改写当前剧情事实。',
        loadStatusText = '',
        loadActionHint = '',
        worldlineStatusText = '',
        worldlineActionHint = '',
        answerBookStatusText = '',
        answerBookActionHint = '',
    } = payload;
    const safeBackgroundImage = backgroundImage || backdrop.imageUrl || '';
    const modalHint = activeModalName === 'none' ? '' : activeModalHint;
    const manualChoicePosition = choiceOverlayPosition?.mode === 'manual'
        && Number.isFinite(Number(choiceOverlayPosition?.x))
        && Number.isFinite(Number(choiceOverlayPosition?.y));
    const choicePositionX = manualChoicePosition ? Math.max(0, Math.round(Number(choiceOverlayPosition.x))) : 0;
    const choicePositionY = manualChoicePosition ? Math.max(0, Math.round(Number(choiceOverlayPosition.y))) : 0;
    const choicePositionStyle = manualChoicePosition
        ? ` style="left:${choicePositionX}px;top:${choicePositionY}px;right:auto;bottom:auto;transform:none;"`
        : '';
    const sidebarVisible = true;
    const pendingSendSeconds = Math.max(0, Math.floor((Number(pendingSendElapsedMs) || 0) / 1000));
    const pendingSendLabel = pendingSendActive && pendingSendRecoverable ? '重发' : '发送';
    const pendingSendDisabled = false;
    const toggleChoicesLabel = choicesCollapsed ? '显示行动' : '隐藏';
    const expandChoicesLabel = choicesExpanded ? '收回' : '展开';
    const panelLabel = choicesExpanded ? '中央面板' : '右侧面板';
    const backlogLabel = backlogOpen ? '关闭日志' : '历史日志';
    const toggleUiLabel = immersiveUiHidden ? '显示UI' : '隐藏UI';
    const toggleUiIcon = immersiveUiHidden ? 'eye' : 'eyeOff';
    const setupFlowControlHtml = isSetupMode
        ? `<button type="button" data-re0-vn-start-world title="完成开局选择并请求模型生成第一幕">${vnIconLabel('compass', '开始世界', { escapeHtml })}</button>`
        : `<button type="button" data-re0-vn-advance data-re0-advance-time title="推进当前时间段">${vnIconLabel('time', '推进时间', { escapeHtml })}</button>`;
    const topbarControlsHtml = `
        <nav class="re0-vn-top-actions" data-re0-touch-target="large" aria-label="VN 主菜单">
            <button type="button" data-re0-vn-open-hud title="状态">${vnIconLabel('state', '状态', { escapeHtml })}</button>
            <button type="button" data-re0-vn-checkpoint title="${escapeHtml(checkpointText)}">${vnIconLabel('flag', '检查点', { escapeHtml })}</button>
            <button type="button" data-re0-vn-rollback title="${escapeHtml(checkpointText)}">${vnIconLabel('replay', '回滚', { escapeHtml })}</button>
            <button type="button" data-re0-vn-save data-re0-save-now title="保存当前进度">${vnIconLabel('save', '存档', { escapeHtml })}</button>
            <button type="button" data-re0-vn-load data-re0-show-save-list title="打开读档面板">${vnIconLabel('folder', '读档', { escapeHtml })}</button>
            <button type="button" data-re0-vn-worldline title="查看世界线树">${vnIconLabel('worldline', '世界线', { escapeHtml })}</button>
            <button type="button" data-re0-vn-answerbook title="查看答案之书">${vnIconLabel('answer', '答案', { escapeHtml })}</button>
            <button type="button" data-re0-vn-config title="设定">${vnIconLabel('settings', '设定', { escapeHtml })}</button>
            <button type="button" data-re0-vn-toggle-ui title="${escapeHtml(toggleUiLabel)}">${vnIconLabel(toggleUiIcon, toggleUiLabel, { escapeHtml })}</button>
            ${setupFlowControlHtml}
            <button type="button" data-re0-vn-new-game title="重新进入开局建档">${vnIconLabel('spark', '新故事', { escapeHtml })}</button>
        </nav>
    `;
    const pendingSendStatus = pendingSendActive
        ? (pendingSendRecoverable
            ? `模型回复已等待 ${pendingSendSeconds}s，可恢复发送：${shortText(pendingSendText || '当前行动', 44)}`
            : `正在等待模型回复 ${pendingSendSeconds}s：${shortText(pendingSendText || '当前行动', 44)}`)
        : '';
    const loadShellHtml = buildVisualNovelModalShell({
        statusTitle: '存档状态',
        statusText: loadStatusText,
        contentHtml: saveListHtml,
        actionHint: loadActionHint,
        emptyHtml: '<small>暂无存档。先在关键节点创建一个存档。</small>',
    }, { escapeHtml });
    const worldlineShellHtml = buildVisualNovelModalShell({
        statusTitle: '世界线状态',
        statusText: worldlineStatusText,
        contentHtml: worldlineHtml,
        actionHint: worldlineActionHint,
        emptyHtml: '<small>世界线树暂无可展示节点。</small>',
    }, { escapeHtml });
    const answerBookShellHtml = buildVisualNovelModalShell({
        statusTitle: '答案之书状态',
        statusText: answerBookStatusText,
        contentHtml: answerBookHtml,
        actionHint: answerBookActionHint,
        emptyHtml: '<small>尚未进入答案之书。</small>',
    }, { escapeHtml });
    const currentNarrativeMode = state?.narrativeMode?.current || 'daily';
    const currentReplyLength = settings.replyLengthMode || 'rich';
    const currentWorldSimIntensity = settings.worldSimIntensity || 'token-rich';
    const currentModel = apiConfig?.model || 'mimo-v2.5-pro';

    const configPanelHtml = `
        <div class="re0-vn-system-panel re0-vn-config-panel ${configOpen ? 'is-active' : 'is-hidden'}" data-re0-vn-modal="config" data-re0-vn-modal-active="${configOpen ? 'true' : 'false'}" role="dialog" aria-hidden="${configOpen ? 'false' : 'true'}" aria-modal="false">
            <header>
                <span class="re0-vn-modal-heading"><b>Setting</b>${modalHint ? `<small>${escapeHtml(modalHint)}</small>` : ''}</span>
                <button type="button" data-re0-vn-config-close title="关闭 Setting">${vnIconLabel('close', '关闭', { escapeHtml, iconOnly: true })}</button>
            </header>
            
            <div class="re0-vn-settings-scroll-area">
                
                <!-- SECTION 1: Performance & Sound -->
                <details class="re0-vn-setting-section" open>
                    <summary>🎬 演出效果与配音</summary>
                    <div class="re0-vn-setting-fields">
                        <label class="re0-vn-setting-field">
                            <span>文本框不透明度 <b>${escapeHtml(textOpacity)}%</b></span>
                            <input type="range" min="25" max="95" step="5" value="${escapeHtml(textOpacity)}" data-re0-vn-text-opacity>
                        </label>
                        
                        <label class="re0-vn-setting-field">
                            <span>自动播放延迟 <b>${escapeHtml(autoDelayMs)}ms</b></span>
                            <input type="range" min="900" max="12000" step="100" value="${escapeHtml(autoDelayMs)}" data-re0-vn-auto-delay>
                        </label>
                        
                        <label class="re0-vn-setting-field">
                            <span>快进播放延迟 <b>${escapeHtml(skipDelayMs)}ms</b></span>
                            <input type="range" min="120" max="3000" step="30" value="${escapeHtml(skipDelayMs)}" data-re0-vn-skip-delay>
                        </label>
                        
                        <div class="re0-vn-setting-field-toggle">
                            <span>自动对白配音</span>
                            <label class="re0-vn-switch">
                                <input type="checkbox" data-re0-vn-setting-autovoice ${settings.autoVoiceLatest ? 'checked' : ''}>
                                <span class="re0-vn-slider"></span>
                            </label>
                        </div>

                        <div class="re0-vn-setting-field-toggle">
                            <span>沉浸式无 UI 模式</span>
                            <label class="re0-vn-switch">
                                <input type="checkbox" data-re0-vn-setting-immersiveui ${immersiveUiHidden ? 'checked' : ''}>
                                <span class="re0-vn-slider"></span>
                            </label>
                        </div>

                        <div class="re0-vn-setting-field-toggle">
                            <span>HUD 状态栏折叠</span>
                            <label class="re0-vn-switch">
                                <input type="checkbox" data-re0-vn-setting-hudcollapsed ${settings.hudCollapsed !== false ? 'checked' : ''}>
                                <span class="re0-vn-slider"></span>
                            </label>
                        </div>
                        
                        <div class="re0-vn-audio-controls-row">
                            <span>Voice 控制:</span>
                            <button type="button" data-re0-vn-pause-audio>${vnIconLabel('pause', '暂停/继续', { escapeHtml })}</button>
                            <button type="button" data-re0-vn-replay-audio>${vnIconLabel('replay', '重放', { escapeHtml })}</button>
                            <button type="button" data-re0-vn-stop-audio>${vnIconLabel('stop', '停止', { escapeHtml })}</button>
                        </div>
                    </div>
                </details>

                <!-- SECTION 2: Story & Narrative -->
                <details class="re0-vn-setting-section" open>
                    <summary>📖 剧情叙事与篇幅</summary>
                    <div class="re0-vn-setting-fields">
                        <div class="re0-vn-setting-field-select">
                            <span>剧情模式 (Story Mode)</span>
                            <div class="re0-vn-segmented" data-re0-vn-setting-narrative-mode>
                                <button type="button" class="${currentNarrativeMode === 'mainline' ? 'is-active' : ''}" data-value="mainline">主线</button>
                                <button type="button" class="${currentNarrativeMode === 'daily' ? 'is-active' : ''}" data-value="daily">日常</button>
                                <button type="button" class="${currentNarrativeMode === 'adult' ? 'is-active' : ''}" data-value="adult">关系</button>
                            </div>
                        </div>

                        <div class="re0-vn-setting-field-select">
                            <span>篇幅模式 (Reply Budget)</span>
                            <div class="re0-vn-segmented" data-re0-vn-setting-reply-length>
                                <button type="button" class="${currentReplyLength === 'rich' ? 'is-active' : ''}" data-value="rich">豪华</button>
                                <button type="button" class="${currentReplyLength === 'balanced' ? 'is-active' : ''}" data-value="balanced">平衡</button>
                                <button type="button" class="${currentReplyLength === 'short' ? 'is-active' : ''}" data-value="short">精炼</button>
                            </div>
                        </div>

                        <div class="re0-vn-setting-field-toggle">
                            <span>关系扩展内容 (18+)</span>
                            <label class="re0-vn-switch">
                                <input type="checkbox" data-re0-vn-setting-adult-content ${settings.adultContentEnabled ? 'checked' : ''}>
                                <span class="re0-vn-slider"></span>
                            </label>
                        </div>

                        <div class="re0-vn-setting-field-toggle">
                            <span>剧本语法解析</span>
                            <label class="re0-vn-switch">
                                <input type="checkbox" data-re0-vn-setting-vnscript ${settings.visualNovelScriptEnabled !== false ? 'checked' : ''}>
                                <span class="re0-vn-slider"></span>
                            </label>
                        </div>

                        <div class="re0-vn-setting-field-toggle">
                            <span>背景图自动适配</span>
                            <label class="re0-vn-switch">
                                <input type="checkbox" data-re0-vn-setting-backdrop ${settings.adaptiveBackdropEnabled !== false ? 'checked' : ''}>
                                <span class="re0-vn-slider"></span>
                            </label>
                        </div>
                    </div>
                </details>

                <!-- SECTION 3: World & Simulation -->
                <details class="re0-vn-setting-section">
                    <summary>⏳ 世界线推演与后台钟</summary>
                    <div class="re0-vn-setting-fields">
                        <div class="re0-vn-setting-field-toggle">
                            <span>后台世界钟步进</span>
                            <label class="re0-vn-switch">
                                <input type="checkbox" data-re0-vn-setting-bgclock ${settings.backgroundWorldClockEnabled !== false ? 'checked' : ''}>
                                <span class="re0-vn-slider"></span>
                            </label>
                        </div>

                        <div class="re0-vn-setting-field-toggle">
                            <span>手动推进时推演</span>
                            <label class="re0-vn-switch">
                                <input type="checkbox" data-re0-vn-setting-autosim ${settings.worldSimAutoOnDayAdvance ? 'checked' : ''}>
                                <span class="re0-vn-slider"></span>
                            </label>
                        </div>

                        <label class="re0-vn-setting-field">
                            <span>推演线程并行数 <b>${escapeHtml(settings.worldSimParallelism || 8)}</b></span>
                            <input type="range" min="1" max="12" step="1" value="${escapeHtml(settings.worldSimParallelism || 8)}" data-re0-vn-setting-parallelism>
                        </label>

                        <label class="re0-vn-setting-field">
                            <span>单日回数上限 (Turns/Day) <b>${escapeHtml(settings.backgroundTurnsPerWorldDay || 30)}</b></span>
                            <input type="range" min="5" max="120" step="5" value="${escapeHtml(settings.backgroundTurnsPerWorldDay || 30)}" data-re0-vn-setting-turns-per-day>
                        </label>

                        <div class="re0-vn-setting-field-select">
                            <span>世界推演精细度</span>
                            <div class="re0-vn-segmented" data-re0-vn-setting-sim-intensity>
                                <button type="button" class="${currentWorldSimIntensity === 'token-rich' ? 'is-active' : ''}" data-value="token-rich">深度</button>
                                <button type="button" class="${currentWorldSimIntensity === 'light' ? 'is-active' : ''}" data-value="light">轻量</button>
                            </div>
                        </div>
                    </div>
                </details>

                <!-- SECTION 4: API & Key Mounting -->
                <details class="re0-vn-setting-section">
                    <summary>🔑 密钥与模型挂载</summary>
                    <div class="re0-vn-setting-fields">
                        <div class="re0-vn-api-dashboard">
                            <div class="re0-vn-api-db-line">
                                <span>当前模型:</span>
                                <strong id="re0-vn-api-db-model">${escapeHtml(currentModel)}</strong>
                            </div>
                            <div class="re0-vn-api-db-line">
                                <span>API 状态:</span>
                                <strong id="re0-vn-api-db-status" class="is-loading">检测中...</strong>
                            </div>
                            <button type="button" class="re0-vn-api-btn" id="re0-vn-open-api-modal-trigger">
                                ${vnIconLabel('key', '配置密钥与网络端点', { escapeHtml })}
                            </button>
                        </div>

                        <div class="re0-vn-setting-field-select" style="margin-top: 8px;">
                            <span>模型选择 (Model)</span>
                            <div class="re0-vn-segmented" data-re0-vn-setting-model-select>
                                <button type="button" class="${currentModel === 'mimo-v2.5-pro' ? 'is-active' : ''}" data-value="mimo-v2.5-pro">2.5Pro</button>
                                <button type="button" class="${currentModel === 'mimo-v2.5' ? 'is-active' : ''}" data-value="mimo-v2.5">v2.5</button>
                                <button type="button" class="${(currentModel !== 'mimo-v2.5-pro' && currentModel !== 'mimo-v2.5') ? 'is-active' : ''}" data-value="custom">Custom</button>
                            </div>
                        </div>

                        <label class="re0-vn-setting-field">
                            <span>最大 Token (Max Tokens) <b>${escapeHtml(oaiSettings?.max_tokens || 900)}</b></span>
                            <input type="range" min="500" max="4096" step="100" value="${escapeHtml(oaiSettings?.max_tokens || 900)}" data-re0-vn-setting-max-tokens>
                        </label>

                        <div class="re0-vn-setting-field-toggle">
                            <span>深度思考模式 (Thinking)</span>
                            <label class="re0-vn-switch">
                                <input type="checkbox" data-re0-vn-setting-thinking ${oaiSettings?.thinking !== 'disabled' ? 'checked' : ''}>
                                <span class="re0-vn-slider"></span>
                            </label>
                        </div>

                        <label class="re0-vn-setting-field">
                            <span>模型温度 (Temp) <b>${escapeHtml(oaiSettings?.temperature || 0.95)}</b></span>
                            <input type="range" min="0.1" max="1.5" step="0.05" value="${escapeHtml(oaiSettings?.temperature || 0.95)}" data-re0-vn-setting-temp>
                        </label>

                        <label class="re0-vn-setting-field">
                            <span>采样 Top P <b>${escapeHtml(oaiSettings?.top_p || 0.95)}</b></span>
                            <input type="range" min="0.1" max="1.0" step="0.05" value="${escapeHtml(oaiSettings?.top_p || 0.95)}" data-re0-vn-setting-topp>
                        </label>
                    </div>
                </details>
                
            </div>
        </div>
    `;
    return `
        <div class="re0-vn-backdrop" style="background-image:linear-gradient(180deg, rgba(3,7,18,.10), rgba(3,7,18,.68)), url('${escapeHtml(safeBackgroundImage)}')"></div>
        <div class="re0-vn-vignette"></div>
        <div class="re0-vn-topbar">
            <span>${escapeHtml(topbarDayText)}</span>
            <strong>${escapeHtml(locationTitle || backdrop.title || '未知地点')}</strong>
            <em>${escapeHtml(routeStatusText)}</em>
            <small class="re0-vn-current-speaker" data-re0-vn-current-speaker>${escapeHtml(speakerStatusText)}</small>
            ${topbarControlsHtml}
        </div>
        <div class="re0-vn-cast-layer">
            ${castHtml}
        </div>
        ${insertCgHtml ? `<div class="re0-vn-insert-cg-layer" data-re0-vn-insert-cg-layer>${insertCgHtml}</div>` : ''}
        <aside class="re0-vn-choices-overlay re0-vn-action-sidebar ${sidebarVisible ? '' : 'is-hidden'} ${choicesCollapsed ? 'is-collapsed' : ''} ${choicesExpanded ? 'is-expanded' : ''} ${manualChoicePosition ? 'is-manual' : ''} is-page-actions"
            data-re0-vn-choice-mode="${choiceMode ? 'true' : 'false'}"
            data-re0-vn-selected-choice="${escapeHtml(selectedChoiceIndex)}"
            data-re0-vn-choice-count="${escapeHtml(choiceCount)}"
            data-re0-vn-choices-collapsed="${choicesCollapsed ? 'true' : 'false'}"
            data-re0-vn-choices-expanded="${choicesExpanded ? 'true' : 'false'}"
            data-re0-vn-sidebar-page="actions"
            data-re0-vn-choice-position-mode="${manualChoicePosition ? 'manual' : 'auto'}"
            data-re0-vn-choice-position-x="${choicePositionX}"
            data-re0-vn-choice-position-y="${choicePositionY}"
            data-re0-touch-target="large"${choicePositionStyle}>
            <div class="re0-vn-choice-header" data-re0-touch-target="large">
                <button type="button" data-re0-vn-toggle-choices data-re0-touch-target="large" title="${choicesCollapsed ? '显示候选行动' : '隐藏候选行动'}">${vnIconLabel(choicesCollapsed ? 'eye' : 'eyeOff', toggleChoicesLabel, { escapeHtml })}</button>
                <button type="button" data-re0-vn-expand-choices data-re0-touch-target="large" title="${choicesExpanded ? '收回候选面板' : '展开到屏幕中间'}">${vnIconLabel(choicesExpanded ? 'collapse' : 'expand', expandChoicesLabel, { escapeHtml })}</button>
                <button type="button" data-re0-vn-refresh-choices data-re0-touch-target="large" title="根据当前上下文重新生成候选行动">${vnIconLabel('refresh', '刷新', { escapeHtml })}</button>
                <button type="button" data-re0-vn-reset-choices-position data-re0-touch-target="large" title="恢复候选行动框的自动位置">${vnIconLabel('crosshair', '归位', { escapeHtml })}</button>
                <b data-re0-vn-choice-drag-handle title="按住拖动右侧面板">${vnIconLabel(choicesExpanded ? 'expand' : 'archive', panelLabel, { escapeHtml })}</b>
                <span>${escapeHtml(choiceMode ? '候选会写入输入框；你也可以直接写任何第一人称行动。' : '可自由输入任何第一人称行动。')}</span>
            </div>
            <div class="re0-vn-sidebar-page re0-vn-sidebar-page-actions is-active">
                <div class="re0-vn-custom-action" data-re0-touch-target="large">
                    <textarea rows="${choicesExpanded || isSetupMode ? '8' : '6'}" data-re0-vn-custom-input data-re0-custom-action placeholder="${isSetupMode ? '直接输入当前开局字段，例如“现代图书管理员，会急救，熟悉旧书档案和夜班巡查”；也可写“出身：……”' : '自定义行动：例如“我压低声音询问莉榭尔钟声第三下的含义”'}">${escapeHtml(customActionDraft)}</textarea>
                    <div class="re0-vn-custom-action-buttons">
                        <button type="button" data-re0-vn-custom-apply data-re0-apply-custom data-re0-touch-target="large">${vnIconLabel('pen', '写入', { escapeHtml })}</button>
                        <button type="button" data-re0-vn-custom-send data-re0-send-custom data-re0-touch-target="large" ${pendingSendDisabled ? 'disabled aria-busy="true"' : ''}>${vnIconLabel('send', pendingSendLabel, { escapeHtml })}</button>
                    </div>
                    ${pendingSendActive ? `<div class="re0-vn-send-status-row"><small class="re0-vn-send-status ${pendingSendRecoverable ? 'is-recoverable' : ''}">${escapeHtml(pendingSendStatus)}</small>${pendingSendRecoverable ? `<button type="button" data-re0-vn-custom-recover-send data-re0-touch-target="large" class="re0-vn-recover-send" title="模型回复超时后，恢复发送状态并保留当前输入">${vnIconLabel('replay', '恢复发送', { escapeHtml })}</button>` : ''}</div>` : ''}
                </div>
                <div class="re0-vn-choice-body">
                    ${choiceOverlayHint ? `<div class="re0-vn-choice-softness" data-re0-touch-target="large">${escapeHtml(shortText(choiceOverlayHint, 112))}</div>` : ''}
                    ${choicesHtml ? `<div class="re0-vn-choice-keyboard-hint" data-re0-touch-target="large">键盘 1-${escapeHtml(VISUAL_NOVEL_VISIBLE_CHOICE_LIMIT)} 选择 · Enter 确认 · 点击写入输入框 · 悬停查看影响逻辑</div>` : ''}
                    ${choicesHtml}
                </div>
            </div>
        </aside>
        <div class="re0-vn-dialogue-box ${speakerKind === 'narration' ? 're0-vn-narration-box' : ''}">
            <div class="re0-vn-nameplate">
                ${speakerAvatarHtml}
                <span><b>${escapeHtml(speakerLabel)}</b><em>${escapeHtml(speakerRole)}</em></span>
                <button type="button" data-re0-vn-voice data-re0-touch-target="large" title="播放当前对白">${vnIconLabel('play', '播放', { escapeHtml, iconOnly: true })}</button>
            </div>
            <div class="re0-vn-dialogue-text" data-re0-vn-advance-line title="点击进入下一句">${escapeHtml(speakerText || '等待下一段叙事。')}</div>
            <div class="re0-vn-progress" data-re0-touch-target="large">
                <button type="button" data-re0-vn-prev data-re0-touch-target="large" data-re0-vn-boundary="${currentIndex <= 0 ? 'true' : 'false'}">${vnIconLabel('chevronLeft', '上一句', { escapeHtml })}</button>
                <span class="re0-vn-progress-text" data-re0-vn-progress-text>${escapeHtml(progressText)}</span>
                <button type="button" data-re0-vn-next data-re0-touch-target="large" data-re0-vn-boundary="${currentIndex >= segmentCount - 1 ? 'true' : 'false'}">${vnIconLabel('chevronRight', '下一句', { escapeHtml })}</button>
                <button type="button" data-re0-vn-auto data-re0-touch-target="large" class="${autoPlay ? 'is-active' : ''}" title="自动播放对白">${vnIconLabel(autoPlay ? 'pause' : 'play', '自动', { escapeHtml })}</button>
                <button type="button" data-re0-vn-skip data-re0-touch-target="large" class="${skipMode ? 'is-active' : ''}" title="快进本轮演出">${vnIconLabel('fastForward', '快进', { escapeHtml })}</button>
                <button type="button" data-re0-vn-backlog data-re0-touch-target="large">${vnIconLabel('archive', backlogLabel, { escapeHtml })}</button>
            </div>
            <div class="re0-vn-objective">
                <b>${escapeHtml(objectiveTitle)}</b>
                <span>${escapeHtml(shortText(objectiveSubtitle, 120))}</span>
            </div>
        </div>
        <div class="re0-vn-backlog ${backlogOpen ? 'is-active' : 'is-hidden'}" data-re0-vn-modal="backlog" data-re0-vn-modal-active="${backlogOpen ? 'true' : 'false'}" role="dialog" aria-hidden="${backlogOpen ? 'false' : 'true'}" aria-modal="false">
            <header><span class="re0-vn-modal-heading"><b>Backlog</b>${modalHint ? `<small>${escapeHtml(modalHint)}</small>` : ''}</span><button type="button" data-re0-vn-backlog-close title="关闭 Backlog">${vnIconLabel('close', '关闭', { escapeHtml, iconOnly: true })}</button></header>
            <div>${backlogHtml || '<small>暂无历史对白。</small>'}</div>
        </div>
        <div class="re0-vn-system-panel re0-vn-load-panel ${loadOpen ? 'is-active' : 'is-hidden'}" data-re0-vn-modal="load" data-re0-vn-modal-active="${loadOpen ? 'true' : 'false'}" role="dialog" aria-hidden="${loadOpen ? 'false' : 'true'}" aria-modal="false">
            <header><span class="re0-vn-modal-heading"><b>Load</b>${modalHint ? `<small>${escapeHtml(modalHint)}</small>` : ''}</span><button type="button" data-re0-vn-load-close title="关闭 Load">${vnIconLabel('close', '关闭', { escapeHtml, iconOnly: true })}</button></header>
            ${loadShellHtml}
        </div>
        <div class="re0-vn-system-panel re0-vn-worldline-panel ${worldlineOpen ? 'is-active' : 'is-hidden'}" data-re0-vn-modal="worldline" data-re0-vn-modal-active="${worldlineOpen ? 'true' : 'false'}" role="dialog" aria-hidden="${worldlineOpen ? 'false' : 'true'}" aria-modal="false">
            <header><span class="re0-vn-modal-heading"><b>Worldline</b>${modalHint ? `<small>${escapeHtml(modalHint)}</small>` : ''}</span><button type="button" data-re0-vn-worldline-close title="关闭 Worldline">${vnIconLabel('close', '关闭', { escapeHtml, iconOnly: true })}</button></header>
            ${worldlineShellHtml}
        </div>
        <div class="re0-vn-system-panel re0-vn-answerbook-panel ${answerBookOpen ? 'is-active' : 'is-hidden'}" data-re0-vn-modal="answerbook" data-re0-vn-modal-active="${answerBookOpen ? 'true' : 'false'}" role="dialog" aria-hidden="${answerBookOpen ? 'false' : 'true'}" aria-modal="false">
            <header><span class="re0-vn-modal-heading"><b>Answer Book</b>${modalHint ? `<small>${escapeHtml(modalHint)}</small>` : ''}</span><button type="button" data-re0-vn-answerbook-close title="关闭 Answer Book">${vnIconLabel('close', '关闭', { escapeHtml, iconOnly: true })}</button></header>
            ${answerBookShellHtml}
        </div>
        <div class="re0-vn-world-status-panel ${worldStatusOpen ? '' : 'is-hidden'}">
            ${worldStatusHtml || '<small>世界状态读取中。</small>'}
        </div>
        ${configPanelHtml}

        <!-- Floating API & Key Configuration Modal -->
        <div class="re0-vn-api-modal is-hidden" id="re0-vn-api-modal-container" data-re0-touch-target="large">
            <div class="re0-vn-api-modal-content">
                <header>
                    <span class="re0-vn-api-modal-title">${vnIconLabel('key', 'API 密钥与接口配置', { escapeHtml })}</span>
                    <button type="button" id="re0-vn-api-modal-close" class="re0-vn-api-modal-close-btn" title="关闭 API 配置">${vnIconLabel('close', '关闭', { escapeHtml, iconOnly: true })}</button>
                </header>
                <div class="re0-vn-api-modal-body">
                    <p class="re0-vn-api-modal-desc">此配置直接挂载并同步至 SillyTavern Custom API 设置项，确保视觉小说演出接口的持续运转。</p>
                    <div class="re0-vn-api-modal-field">
                        <label>
                            <span>接口代理端点 (API Endpoint)</span>
                            <input type="text" id="re0-vn-api-endpoint-input" value="${escapeHtml(apiConfig?.endpoint || 'https://token-plan-cn.xiaomimimo.com/v1')}" placeholder="https://token-plan-cn.xiaomimimo.com/v1">
                        </label>
                    </div>
                    <div class="re0-vn-api-modal-field">
                        <label>
                            <span>API 身份密钥 (API Key)</span>
                            <div class="re0-vn-api-input-wrap">
                                <input type="password" id="re0-vn-api-key-input" value="${escapeHtml(apiKey || '')}" placeholder="输入 tp-xxxx 或 sk-xxxx 密钥...">
                                <button type="button" id="re0-vn-api-key-toggle-visible" title="显示/隐藏密钥">${vnIconLabel('eye', '显示/隐藏密钥', { escapeHtml, iconOnly: true })}</button>
                            </div>
                        </label>
                    </div>
                </div>
                <div class="re0-vn-api-modal-foot">
                    <button type="button" id="re0-vn-api-modal-cancel">${vnIconLabel('close', '取消', { escapeHtml })}</button>
                    <button type="button" id="re0-vn-api-modal-save">${vnIconLabel('save', '保存并同步', { escapeHtml })}</button>
                </div>
            </div>
        </div>
    `;
}
