export const VISUAL_NOVEL_STAGE_ACTION_SELECTORS = [
    '[data-re0-vn-voice]',
    '[data-re0-vn-advance-line]',
    '[data-re0-vn-prev]',
    '[data-re0-vn-next]',
    '[data-re0-vn-auto]',
    '[data-re0-vn-skip]',
    '[data-re0-vn-backlog]',
    '[data-re0-vn-backlog-close]',
    '[data-re0-vn-load]',
    '[data-re0-vn-load-close]',
    '[data-re0-vn-load-save]',
    '[data-re0-vn-delete-save]',
    '[data-re0-vn-worldline]',
    '[data-re0-vn-worldline-close]',
    '[data-re0-vn-answerbook]',
    '[data-re0-vn-answerbook-close]',
    '[data-re0-vn-config]',
    '[data-re0-vn-config-close]',
    '[data-re0-vn-toggle-ui]',
    '[data-re0-vn-open-hud]',
    '[data-re0-vn-checkpoint]',
    '[data-re0-vn-rollback]',
    '[data-re0-vn-save]',
    '[data-re0-vn-start-world]',
    '[data-re0-vn-new-game]',
    '[data-re0-vn-advance]',
    '[data-re0-vn-refresh-choices]',
    '[data-re0-vn-toggle-choices]',
    '[data-re0-vn-expand-choices]',
    '[data-re0-vn-reset-choices-position]',
    '[data-re0-vn-sidebar-actions]',
    '[data-re0-vn-sidebar-settings]',
    '[data-re0-vn-custom-apply]',
    '[data-re0-vn-custom-send]',
    '[data-re0-vn-custom-recover-send]',
    '[data-re0-vn-pause-audio]',
    '[data-re0-vn-replay-audio]',
    '[data-re0-vn-stop-audio]',
    '[data-re0-vn-choice]',
    '[data-re0-character-card]',
];

export const VISUAL_NOVEL_STAGE_ACTION_SELECTOR = VISUAL_NOVEL_STAGE_ACTION_SELECTORS.join(',');

export function visualNovelActionName(attribute = '') {
    const source = String(attribute || '').trim();
    if (source === 'data-re0-character-card') {
        return 'character-card';
    }
    return source.replace(/^data-re0-vn-/u, '') || 'unknown';
}

export function identifyVisualNovelStageAction(eventTarget, stage) {
    if (!eventTarget || !stage) {
        return {
            target: null,
            actionAttribute: '',
            action: 'unknown',
            choice: '',
            characterId: '',
        };
    }
    const target = eventTarget.closest?.(VISUAL_NOVEL_STAGE_ACTION_SELECTOR);
    if (!target || !stage.contains(target)) {
        return {
            target: null,
            actionAttribute: '',
            action: 'unknown',
            choice: '',
            characterId: '',
        };
    }
    const actionAttribute = Array.from(target.attributes || [])
        .map((attribute) => attribute.name)
        .find((name) => name.startsWith('data-re0-vn-') || name === 'data-re0-character-card') || 'unknown';
    return {
        target,
        actionAttribute,
        action: visualNovelActionName(actionAttribute),
        choice: target.getAttribute?.('data-re0-vn-choice') || '',
        characterId: target.getAttribute?.('data-re0-character-card') || '',
    };
}
