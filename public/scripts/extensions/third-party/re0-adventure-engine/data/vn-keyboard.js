export const VISUAL_NOVEL_KEYBOARD_BINDINGS = {
    Enter: { action: 'next', selector: '[data-re0-vn-next]', label: '下一句' },
    Space: { action: 'advance-line', selector: '[data-re0-vn-advance-line]', label: '推进当前对白' },
    ArrowRight: { action: 'next', selector: '[data-re0-vn-next]', label: '下一句' },
    PageDown: { action: 'next', selector: '[data-re0-vn-next]', label: '下一句' },
    ArrowLeft: { action: 'prev', selector: '[data-re0-vn-prev]', label: '上一句' },
    PageUp: { action: 'prev', selector: '[data-re0-vn-prev]', label: '上一句' },
    KeyA: { action: 'auto', selector: '[data-re0-vn-auto]', label: '自动播放' },
    KeyB: { action: 'backlog', selector: '[data-re0-vn-backlog]', label: '历史日志' },
    KeyC: { action: 'checkpoint', selector: '[data-re0-vn-checkpoint]', label: '创建检查点' },
    KeyH: { action: 'toggle-ui', selector: '[data-re0-vn-toggle-ui]', label: '隐藏或显示 UI' },
    KeyR: { action: 'rollback', selector: '[data-re0-vn-rollback]', label: '回滚到检查点' },
    KeyS: { action: 'save', selector: '[data-re0-vn-save]', label: '存档' },
    KeyV: { action: 'voice', selector: '[data-re0-vn-voice]', label: '播放当前对白' },
    KeyN: { action: 'new-game', selector: '[data-re0-vn-new-game], [data-re0-new-game-panel]', label: '开始新游戏' },
};

export function isVisualNovelEditableTarget(target) {
    const element = typeof Element !== 'undefined' && target instanceof Element ? target : null;
    if (!element) {
        return false;
    }
    if (element.isContentEditable) {
        return true;
    }
    return !!element.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"]');
}

export function identifyVisualNovelKeyboardAction(event, {
    vnMode = false,
    stage = null,
    target = null,
} = {}) {
    if (!event || !vnMode || !stage || stage.hidden) {
        return {
            matched: false,
            action: 'unknown',
            selector: '',
            label: '',
            target: null,
        };
    }
    if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) {
        return {
            matched: false,
            action: 'unknown',
            selector: '',
            label: '',
            target: null,
        };
    }
    if (isVisualNovelEditableTarget(target || event.target)) {
        return {
            matched: false,
            action: 'unknown',
            selector: '',
            label: '',
            target: null,
        };
    }
    const binding = VISUAL_NOVEL_KEYBOARD_BINDINGS[event.code] || null;
    if (!binding) {
        return {
            matched: false,
            action: 'unknown',
            selector: '',
            label: '',
            target: null,
        };
    }
    const control = stage.querySelector?.(binding.selector) || null;
    if (!control || control.disabled || control.dataset?.re0VnBoundary === 'true') {
        return {
            matched: false,
            action: binding.action,
            selector: binding.selector,
            label: binding.label,
            target: null,
        };
    }
    return {
        matched: true,
        action: binding.action,
        selector: binding.selector,
        label: binding.label,
        target: control,
    };
}
