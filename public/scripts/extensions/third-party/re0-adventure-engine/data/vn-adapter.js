export const VISUAL_NOVEL_ACTION_HANDLER_KEYS = [
    'voice',
    'advance-line',
    'prev',
    'next',
    'auto',
    'skip',
    'backlog',
    'backlog-close',
    'load',
    'load-close',
    'load-save',
    'delete-save',
    'worldline',
    'worldline-close',
    'answerbook',
    'answerbook-close',
    'config',
    'config-close',
    'toggle-ui',
    'open-hud',
    'checkpoint',
    'rollback',
    'save',
    'start-world',
    'new-game',
    'advance',
    'refresh-choices',
    'toggle-choices',
    'expand-choices',
    'reset-choices-position',
    'sidebar-actions',
    'sidebar-settings',
    'custom-apply',
    'custom-send',
    'custom-recover-send',
    'pause-audio',
    'replay-audio',
    'stop-audio',
    'choice',
    'character-card',
];

export function createVisualNovelStageActionHandlers(callbacks = {}) {
    return {
        voice: callbacks.speakCurrentLine,
        'advance-line': callbacks.advanceLine,
        prev: callbacks.previousLine,
        next: callbacks.nextLine,
        auto: callbacks.toggleAuto,
        skip: callbacks.toggleSkip,
        backlog: callbacks.toggleBacklog,
        'backlog-close': callbacks.closeBacklog,
        load: callbacks.toggleLoad,
        'load-close': callbacks.closeLoad,
        'load-save': callbacks.loadSave,
        'delete-save': callbacks.deleteSave,
        worldline: callbacks.toggleWorldline,
        'worldline-close': callbacks.closeWorldline,
        answerbook: callbacks.toggleAnswerBook,
        'answerbook-close': callbacks.closeAnswerBook,
        config: callbacks.toggleConfig,
        'config-close': callbacks.closeConfig,
        'toggle-ui': callbacks.toggleUi,
        'open-hud': callbacks.openHud,
        checkpoint: callbacks.createCheckpoint,
        rollback: callbacks.rollbackCheckpoint,
        save: callbacks.saveSnapshot,
        'start-world': callbacks.startWorld,
        'new-game': callbacks.newGame,
        advance: callbacks.advanceTime,
        'refresh-choices': callbacks.refreshChoices,
        'toggle-choices': callbacks.toggleChoices,
        'expand-choices': callbacks.expandChoices,
        'reset-choices-position': callbacks.resetChoicesPosition,
        'sidebar-actions': callbacks.showActionSidebar,
        'sidebar-settings': callbacks.toggleConfig,
        'custom-apply': callbacks.applyCustomAction,
        'custom-send': (actionContext) => {
            setTimeout(() => callbacks.sendCustomAction?.(actionContext), 80);
        },
        'custom-recover-send': callbacks.recoverPendingSend,
        'pause-audio': callbacks.pauseAudio,
        'replay-audio': callbacks.replayAudio,
        'stop-audio': callbacks.stopAudio,
        choice: callbacks.applyChoice,
        'character-card': callbacks.openCharacterCard,
    };
}

export function dispatchVisualNovelStageAction(actionContext = {}, handlers = {}) {
    const action = String(actionContext.action || 'unknown');
    const handler = handlers[action];
    if (typeof handler !== 'function') {
        return false;
    }
    handler(actionContext);
    return true;
}
