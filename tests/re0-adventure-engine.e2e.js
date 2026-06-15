/* global document, window, getComputedStyle, HTMLMediaElement */

import { test, expect } from '@playwright/test';

test.use({ channel: 'chrome' });
test.setTimeout(150_000);

test.describe('Re:0 adventure engine product smoke', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
                configurable: true,
                get() {
                    return this.__re0Paused !== false;
                },
            });
            Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
                configurable: true,
                get() {
                    return this.__re0CurrentTime || 0;
                },
                set(value) {
                    this.__re0CurrentTime = Number(value) || 0;
                },
            });
            HTMLMediaElement.prototype.play = function play() {
                this.__re0Paused = false;
                this.dispatchEvent(new Event('play'));
                return Promise.resolve();
            };
            HTMLMediaElement.prototype.pause = function pause() {
                this.__re0Paused = true;
                this.dispatchEvent(new Event('pause'));
            };
        });
        await page.goto(`/?re0_recover=1&api_guard=1&e2e=${Date.now()}`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForFunction(() => document.readyState !== 'loading', null, { timeout: 20_000 });
        await page.waitForFunction(() => typeof window.re0AdventureDebug === 'function', null, { timeout: 20_000 });
        await page.waitForFunction(() => typeof window.re0AdventureDebugResetState === 'function', null, { timeout: 20_000 });
        await page.waitForFunction(() => typeof window.re0AdventureApplyVnStatePatch === 'function'
            && typeof window.re0AdventureDebugMergeStatePatch === 'function', null, { timeout: 20_000 });
        await page.evaluate(() => window.re0AdventureApiHealthCheck?.());
        await page.evaluate(() => window.re0AdventureRecoverUi?.());
        await page.evaluate(() => window.re0AdventureDebugResetState?.());
    });

    test('repairs character dialogue leaked into narrator VN_SCRIPT narration segments', async ({ page }) => {
        await page.waitForFunction(() => typeof window.re0AdventureParseVisualNovel === 'function', null, { timeout: 20_000 });
        await page.evaluate(() => {
            window.re0AdventureApplyVnStatePatch?.({
                current: { location: '王都贫民区 / 废弃钟楼外', time: '雨夜' },
                presence: { sceneCharacters: ['莉榭尔·阿尔戈'] },
            });
        });
        const parse = await page.evaluate(() => window.re0AdventureParseVisualNovel?.(`
雨声压低了废钟楼外的巷口。
<!-- RE0_VN_SCRIPT {"version":"vn5","backgroundKey":"rain_bell","castIds":[],"segments":[{"type":"narration","text":"莉榭尔·阿尔戈：别把我的台词挂在世界意志上。"},{"type":"narration","speakerId":"lishelle","text":"先看伞柄，再看钟楼。"},{"type":"narration","text":"莉榭尔低声提醒：「不要让钟声替你做选择。」雨水在石板上汇成细线。"}],"choices":["确认台词归属"]} -->
        `));
        expect(parse.sourceMode).toBe('hidden-comment');
        expect(parse.castIds).toContain('lishelle');
        expect(parse.segments.filter((segment) => segment.type === 'dialogue' && segment.speakerId === 'lishelle')).toHaveLength(3);
        expect(parse.segments.some((segment) => segment.speakerId === 'narrator' && /台词挂在世界意志|先看伞柄|不要让钟声/u.test(segment.text))).toBe(false);
        expect(parse.roleMetrics.roleDrivenPass).toBe(true);
    });

    test('loads HUD, API guard, scene background, and compact sidecar without stale no-connection UI', async ({ page }) => {
        await page.waitForFunction(() => {
            const debug = window.re0AdventureDebug?.();
            return debug?.ok && debug?.hud?.visible;
        }, null, { timeout: 20_000 });

        await page.waitForFunction(() => {
            const debug = window.re0AdventureDebug?.();
            return debug?.flags?.apiHealth?.ok === true;
        }, null, { timeout: 45_000 });

        const snapshot = await page.evaluate(() => {
            const debug = window.re0AdventureDebug?.();
            const sendForm = document.querySelector('#send_form');
            const sendTextarea = document.querySelector('#send_textarea');
            const hud = document.querySelector('#re0-adventure-hud');
            const vnStage = document.querySelector('#re0-vn-stage');
            const chatStyle = getComputedStyle(document.querySelector('#chat'));
            const sidecar = document.querySelector('.re0-sidecar-details textarea')?.value || '';
            const backdrop = debug?.backdrop || {};
            const textPanelOpacity = getComputedStyle(document.documentElement).getPropertyValue('--re0-text-panel-opacity').trim();
            const ifPanelText = document.querySelector('[data-re0-if-branch-panel]')?.textContent?.trim() || '';
            const worldlineTreePanelText = document.querySelector('[data-re0-worldline-tree-panel]')?.textContent?.trim() || '';

            return {
                debug,
                hudHidden: hud?.hidden ?? null,
                vnVisible: !!vnStage && !vnStage.hidden,
                vnCastCount: vnStage?.querySelectorAll('.re0-vn-character')?.length || 0,
                vnDialogue: vnStage?.querySelector('.re0-vn-dialogue-text')?.textContent?.trim() || '',
                vnProgress: vnStage?.dataset?.re0VnProgressText || vnStage?.querySelector('.re0-vn-progress span')?.textContent?.trim() || '',
                vnHasBacklogButton: !!vnStage?.querySelector('[data-re0-vn-backlog]'),
                vnHasNextButton: !!vnStage?.querySelector('[data-re0-vn-next]'),
                vnHasAutoButton: !!vnStage?.querySelector('[data-re0-vn-auto]'),
                vnHasSkipButton: !!vnStage?.querySelector('[data-re0-vn-skip]'),
                vnHasCheckpointButton: !!vnStage?.querySelector('[data-re0-vn-checkpoint]'),
                vnHasRollbackButton: !!vnStage?.querySelector('[data-re0-vn-rollback]'),
                vnHasWorldlineButton: !!vnStage?.querySelector('[data-re0-vn-worldline]'),
                vnHasAnswerBookButton: !!vnStage?.querySelector('[data-re0-vn-answerbook]'),
                vnHasWorldStatusPanel: !!vnStage?.querySelector('.re0-vn-world-status-panel'),
                vnWorldStatusOpen: !!vnStage?.querySelector('.re0-vn-world-status-panel:not(.is-hidden)'),
                vnHasClickAdvance: !!vnStage?.querySelector('[data-re0-vn-advance-line]'),
                vnCurrentSpeaker: vnStage?.dataset?.re0VnCurrentSpeakerName || '',
                vnCurrentSegmentType: vnStage?.dataset?.re0VnCurrentSegmentType || '',
                vnScriptSource: vnStage?.dataset?.re0VnScriptSource || '',
                vnStoryMode: vnStage?.dataset?.re0VnStoryMode || '',
                vnPacingHint: vnStage?.dataset?.re0VnPacingHint || '',
                vnChoiceLimit: Number(vnStage?.dataset?.re0VnChoiceLimit || 0),
                vnChoiceMode: vnStage?.dataset?.re0VnChoiceMode || '',
                vnSelectedChoice: Number(vnStage?.dataset?.re0VnSelectedChoice || 0),
                vnChoiceOverlaySource: vnStage?.dataset?.re0VnChoiceOverlaySource || '',
                vnChoiceOverlayRuleId: vnStage?.dataset?.re0VnChoiceOverlayRuleId || '',
                vnChoiceOverlaySoftness: vnStage?.dataset?.re0VnChoiceOverlaySoftness || '',
                vnChoiceOverlayChoices: (vnStage?.dataset?.re0VnChoiceOverlayChoices || '').split('|').filter(Boolean),
                vnChoiceOverlayContextTerms: (vnStage?.dataset?.re0VnChoiceOverlayContextTerms || '').split('|').filter(Boolean),
                vnChoiceOverlayContextKey: vnStage?.dataset?.re0VnChoiceOverlayContextKey || '',
                vnChoiceRefreshNonce: Number(vnStage?.dataset?.re0VnChoiceRefreshNonce || 0),
                vnChoicesCollapsed: vnStage?.dataset?.re0VnChoicesCollapsed || '',
                vnChoicePositionMode: vnStage?.dataset?.re0VnChoicePositionMode || '',
                vnChoicePositionX: Number(vnStage?.dataset?.re0VnChoicePositionX || 0),
                vnChoicePositionY: Number(vnStage?.dataset?.re0VnChoicePositionY || 0),
                vnHasChoiceToggle: !!vnStage?.querySelector('[data-re0-vn-toggle-choices]'),
                vnHasChoiceDragHandle: !!vnStage?.querySelector('[data-re0-vn-choice-drag-handle]'),
                vnHasChoicePositionReset: !!vnStage?.querySelector('[data-re0-vn-reset-choices-position]'),
                vnHasChoiceRefresh: !!vnStage?.querySelector('[data-re0-vn-refresh-choices]'),
                vnHasCustomActionInput: !!vnStage?.querySelector('[data-re0-vn-custom-input]'),
                vnHasCustomActionApply: !!vnStage?.querySelector('[data-re0-vn-custom-apply]'),
                vnHasCustomActionSend: !!vnStage?.querySelector('[data-re0-vn-custom-send]'),
                vnChoiceMeta: [...(vnStage?.querySelectorAll('[data-re0-vn-choice]') || [])].map((button) => ({
                    actor: button.getAttribute('data-re0-choice-actor') || '',
                    source: button.getAttribute('data-re0-choice-source') || '',
                    mode: button.getAttribute('data-re0-choice-mode') || '',
                    type: button.getAttribute('data-re0-choice-type') || '',
                    impactLabel: button.getAttribute('data-re0-choice-impact-label') || '',
                    impactLogic: button.getAttribute('data-re0-choice-impact-logic') || '',
                    title: button.getAttribute('title') || '',
                    text: button.textContent?.trim() || '',
                    metaText: button.querySelector('.re0-choice-meta')?.textContent?.trim() || '',
                })),
                vnCastLimit: Number(vnStage?.dataset?.re0VnCastLimit || 0),
                vnCastIds: (vnStage?.dataset?.re0VnCastIds || '').split(',').filter(Boolean),
                vnSceneCastIds: (vnStage?.dataset?.re0VnSceneCastIds || '').split(',').filter(Boolean),
                vnCastSource: vnStage?.dataset?.re0VnCastSource || '',
                vnTransitionCue: vnStage?.dataset?.re0VnTransitionCue || '',
                vnTransitionSummary: vnStage?.dataset?.re0VnTransitionSummary || '',
                vnTransitionEvents: (vnStage?.dataset?.re0VnTransitionEvents || '').split(',').filter(Boolean),
                vnTransitionChangedAt: vnStage?.dataset?.re0VnTransitionChangedAt || '',
                vnCheckpointCount: Number(vnStage?.dataset?.re0VnCheckpointCount || 0),
                vnCheckpointLatest: vnStage?.dataset?.re0VnCheckpointLatest || '',
                vnStageConsistency: vnStage?.dataset?.re0VnStageConsistency || '',
                vnStageConsistencySummary: vnStage?.dataset?.re0VnStageConsistencySummary || '',
                vnAssetPlanBackdropKey: vnStage?.dataset?.re0VnAssetPlanBackdropKey || '',
                vnAssetPlanBackdropConfidence: vnStage?.dataset?.re0VnAssetPlanBackdropConfidence || '',
                vnAssetPlanCandidateKeys: (vnStage?.dataset?.re0VnAssetPlanCandidateKeys || '').split('|').filter(Boolean),
                vnAssetPlanCastIds: (vnStage?.dataset?.re0VnAssetPlanCastIds || '').split(',').filter(Boolean),
                vnAssetPlanMissingCount: Number(vnStage?.dataset?.re0VnAssetPlanMissingCount || 0),
                vnAssetPlanFindingCount: Number(vnStage?.dataset?.re0VnAssetPlanFindingCount || 0),
                vnOpenModal: vnStage?.dataset?.re0VnOpenModal || '',
                vnOpenOverlayCount: Number(vnStage?.dataset?.re0VnOpenOverlayCount || 0),
                vnTextOpacity: Number(vnStage?.dataset?.re0VnTextOpacity || 0),
                vnAutoDelayMs: Number(vnStage?.dataset?.re0VnAutoDelayMs || 0),
                vnSkipDelayMs: Number(vnStage?.dataset?.re0VnSkipDelayMs || 0),
                vnImmersiveUiHidden: vnStage?.dataset?.re0VnImmersiveUiHidden || '',
                vnLastConfigSync: vnStage?.dataset?.re0VnLastConfigSync || '',
                vnStoryClass: [...(vnStage?.classList || [])].find((name) => name.startsWith('re0-vn-story-')) || '',
                vnChoiceCount: vnStage?.querySelectorAll('[data-re0-vn-choice]')?.length || 0,
                vnSpeakerBadge: vnStage?.querySelector('[data-re0-vn-current-speaker]')?.textContent?.trim() || '',
                chatVisibility: chatStyle.visibility,
                chatOpacity: chatStyle.opacity,
                chatPointerEvents: chatStyle.pointerEvents,
                sendNoConnection: sendForm?.classList.contains('no-connection') || false,
                placeholder: sendTextarea?.getAttribute('placeholder') || '',
                sidecarLength: sidecar.length,
                sidecarContainsStatusDump: /主线钟|读档报告|提示预算|角色同步/.test(sidecar),
                backdropKey: backdrop.key || '',
                backdropImageUrl: backdrop.imageUrl || '',
                backdropMatch: backdrop.match || null,
                backdropCandidateKeys: backdrop.candidateKeys || [],
                backdropMissingAssetQueueCount: backdrop.missingAssetQueueCount || 0,
                vnBackdropKey: vnStage?.dataset?.re0VnBackdropKey || '',
                vnBackdropTitle: vnStage?.dataset?.re0VnBackdropTitle || '',
                vnBackdropImageUrl: vnStage?.dataset?.re0VnBackdropImageUrl || '',
                vnBackdropMatchScore: Number(vnStage?.dataset?.re0VnBackdropMatchScore || 0),
                vnBackdropConfidence: vnStage?.dataset?.re0VnBackdropConfidence || '',
                textPanelOpacity,
                ifPanelText,
                worldlineTreePanelText,
                renderedText: window.render_game_to_text?.() || '',
            };
        });

        expect(snapshot.hudHidden).toBe(false);
        expect(snapshot.vnVisible).toBe(true);
        expect(snapshot.vnCastCount).toBeGreaterThanOrEqual(1);
        expect(snapshot.vnDialogue.length).toBeGreaterThan(0);
        expect(snapshot.vnProgress).toMatch(/^\d+\/\d+$/);
        expect(snapshot.vnHasBacklogButton).toBe(true);
        expect(snapshot.vnHasNextButton).toBe(true);
        expect(snapshot.vnHasAutoButton).toBe(true);
        expect(snapshot.vnHasSkipButton).toBe(true);
        expect(snapshot.vnHasCheckpointButton).toBe(true);
        expect(snapshot.vnHasRollbackButton).toBe(true);
        expect(snapshot.vnHasClickAdvance).toBe(true);
        expect(snapshot.vnCurrentSpeaker.length).toBeGreaterThan(0);
        expect(['dialogue', 'narration']).toContain(snapshot.vnCurrentSegmentType);
        expect(snapshot.vnScriptSource.length).toBeGreaterThan(0);
        expect(['daily', 'mainline', 'adult', 'answer']).toContain(snapshot.vnStoryMode);
        expect(snapshot.vnPacingHint.length).toBeGreaterThan(0);
        expect(snapshot.vnChoiceLimit).toBeGreaterThanOrEqual(8);
        expect(['true', 'false']).toContain(snapshot.vnChoiceMode);
        expect(snapshot.vnSelectedChoice).toBeGreaterThanOrEqual(0);
        expect(snapshot.vnChoiceOverlaySource.length).toBeGreaterThan(0);
        expect(Array.isArray(snapshot.vnChoiceOverlayChoices)).toBe(true);
        expect(Array.isArray(snapshot.vnChoiceOverlayContextTerms)).toBe(true);
        expect(snapshot.vnChoiceOverlayContextKey.length).toBeGreaterThan(0);
        expect(['true', 'false']).toContain(snapshot.vnChoicesCollapsed);
        expect(['auto', 'manual']).toContain(snapshot.vnChoicePositionMode);
        expect(snapshot.vnChoicePositionX).toBeGreaterThanOrEqual(0);
        expect(snapshot.vnChoicePositionY).toBeGreaterThanOrEqual(0);
        expect(snapshot.vnHasChoiceToggle).toBe(true);
        expect(snapshot.vnHasChoiceDragHandle).toBe(true);
        expect(snapshot.vnHasChoicePositionReset).toBe(true);
        expect(snapshot.vnHasChoiceRefresh).toBe(true);
        expect(snapshot.vnHasCustomActionInput).toBe(true);
        expect(snapshot.vnHasCustomActionApply).toBe(true);
        expect(snapshot.vnHasCustomActionSend).toBe(true);
        expect(snapshot.vnCastLimit).toBeGreaterThanOrEqual(1);
        expect(Array.isArray(snapshot.vnCastIds)).toBe(true);
        expect(Array.isArray(snapshot.vnSceneCastIds)).toBe(true);
        expect(snapshot.vnCastSource.length).toBeGreaterThan(0);
        expect(snapshot.vnTransitionCue.length).toBeGreaterThan(0);
        expect(snapshot.vnTransitionSummary.length).toBeGreaterThan(0);
        expect(Array.isArray(snapshot.vnTransitionEvents)).toBe(true);
        expect(snapshot.vnCheckpointCount).toBeGreaterThanOrEqual(1);
        expect(snapshot.vnCheckpointLatest.length).toBeGreaterThan(0);
        expect(['pass', 'warn', 'fail']).toContain(snapshot.vnStageConsistency);
        expect(snapshot.vnStageConsistencySummary.length).toBeGreaterThan(0);
        expect(snapshot.vnOpenModal).toBe('none');
        expect(snapshot.vnOpenOverlayCount).toBe(0);
        expect(snapshot.vnTextOpacity).toBeGreaterThanOrEqual(25);
        expect(snapshot.vnTextOpacity).toBeLessThanOrEqual(95);
        expect(snapshot.vnAutoDelayMs).toBeGreaterThanOrEqual(900);
        expect(snapshot.vnAutoDelayMs).toBeLessThanOrEqual(12000);
        expect(snapshot.vnSkipDelayMs).toBeGreaterThanOrEqual(120);
        expect(snapshot.vnSkipDelayMs).toBeLessThanOrEqual(3000);
        expect(['true', 'false']).toContain(snapshot.vnImmersiveUiHidden);
        expect(snapshot.vnHasWorldlineButton).toBe(true);
        expect(snapshot.vnHasAnswerBookButton).toBe(true);
        expect(snapshot.vnHasWorldStatusPanel).toBe(true);
        expect(snapshot.vnWorldStatusOpen).toBe(false);
        expect(snapshot.vnChoiceCount).toBeLessThanOrEqual(snapshot.vnChoiceLimit);
        expect(snapshot.vnChoiceCount).toBeGreaterThanOrEqual(6);
        expect(snapshot.vnChoiceMeta.length).toBe(snapshot.vnChoiceCount);
        expect(snapshot.vnChoiceMeta.every((entry) => entry.source.length > 0 && entry.mode.length > 0 && entry.type.length > 0)).toBe(true);
        expect(snapshot.vnChoiceMeta.every((entry) => entry.impactLabel.length > 0 && entry.impactLogic.length > 0 && entry.title.includes('影响逻辑'))).toBe(true);
        expect(snapshot.vnChoiceMeta.every((entry) => entry.metaText.length > 0)).toBe(true);
        const canonChoiceMeta = snapshot.vnChoiceMeta.find((entry) => entry.source === 'canon-follow');
        expect(canonChoiceMeta).toBeTruthy();
        expect(canonChoiceMeta.type).toBe('canon');
        expect(canonChoiceMeta.impactLabel).toContain('原作');
        expect(canonChoiceMeta.impactLogic).toMatch(/连续|吸引域|硬跳/u);
        expect(canonChoiceMeta.text).toContain('原作线');
        expect(snapshot.vnStoryClass).toBe(`re0-vn-story-${snapshot.vnStoryMode}`);
        expect(snapshot.vnSpeakerBadge.length).toBeGreaterThan(0);
        expect(snapshot.chatVisibility).toBe('hidden');
        expect(snapshot.chatOpacity).toBe('0');
        expect(snapshot.chatPointerEvents).toBe('none');
        await expect(page.locator('#chat .re0-message-voice').first()).toBeHidden();
        expect(snapshot.debug.visualNovel.visible).toBe(true);
        expect(snapshot.debug.visualNovel.castCount).toBeGreaterThanOrEqual(1);
        expect(snapshot.debug.visualNovel.segmentCount).toBeGreaterThanOrEqual(1);
        expect(snapshot.debug.visualNovel.currentSpeakerName.length).toBeGreaterThan(0);
        expect(['dialogue', 'narration']).toContain(snapshot.debug.visualNovel.currentSegmentType);
        expect(snapshot.debug.visualNovel.scriptSource.length).toBeGreaterThan(0);
        expect(snapshot.debug.visualNovel.transitionSummary.length).toBeGreaterThan(0);
        expect(Array.isArray(snapshot.debug.visualNovel.transitionEvents)).toBe(true);
        expect(snapshot.debug.visualNovel.transitionCue.length).toBeGreaterThan(0);
        expect(snapshot.debug.visualNovel.checkpointCount).toBeGreaterThanOrEqual(1);
        expect(snapshot.debug.visualNovel.checkpointLatest.length).toBeGreaterThan(0);
        expect(snapshot.debug.visualNovel.stageConsistencySummary.length).toBeGreaterThan(0);
        expect(['pass', 'warn', 'fail']).toContain(snapshot.debug.visualNovel.stageConsistencyStatus);
        expect(snapshot.vnAssetPlanBackdropKey.length).toBeGreaterThan(0);
        expect(snapshot.vnAssetPlanBackdropConfidence.length).toBeGreaterThan(0);
        expect(snapshot.vnAssetPlanCandidateKeys.length).toBeGreaterThanOrEqual(1);
        expect(Array.isArray(snapshot.vnAssetPlanCastIds)).toBe(true);
        expect(Number.isFinite(snapshot.vnAssetPlanMissingCount)).toBe(true);
        expect(Number.isFinite(snapshot.vnAssetPlanFindingCount)).toBe(true);
        expect(snapshot.debug.visualNovel.assetPlanBackdropKey).toBe(snapshot.vnAssetPlanBackdropKey);
        expect(snapshot.debug.visualNovel.assetPlanCandidateKeys.length).toBeGreaterThanOrEqual(1);
        expect(Object.prototype.hasOwnProperty.call(snapshot.debug.visualNovel, 'autoPlay')).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(snapshot.debug.visualNovel, 'skipMode')).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(snapshot.debug.visualNovel, 'choiceOverlaySource')).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(snapshot.debug.visualNovel, 'choiceOverlaySoftness')).toBe(true);
        expect(Array.isArray(snapshot.debug.visualNovel.choiceOverlayChoices)).toBe(true);
        expect(snapshot.debug.visualNovel.choiceOverlayChoices.length).toBeGreaterThanOrEqual(4);
        expect(snapshot.debug.visualNovel.choicePoolCount).toBeGreaterThanOrEqual(snapshot.debug.visualNovel.choiceOverlayChoices.length);
        expect(Array.isArray(snapshot.debug.visualNovel.choicePoolPreview)).toBe(true);
        expect(snapshot.debug.visualNovel.choicePoolPreview.length).toBeGreaterThanOrEqual(snapshot.debug.visualNovel.choiceOverlayChoices.length);
        expect(Array.isArray(snapshot.debug.visualNovel.choiceOverlayContextTerms)).toBe(true);
        expect(Array.isArray(snapshot.debug.visualNovel.choiceOverlayMeta)).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(snapshot.debug.visualNovel, 'choicesCollapsed')).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(snapshot.debug.visualNovel, 'choiceOverlayPosition')).toBe(true);
        expect(Array.isArray(snapshot.debug.visualNovel.castIds)).toBe(true);
        expect(Array.isArray(snapshot.debug.visualNovel.sceneCastIds)).toBe(true);
        expect(snapshot.debug.visualNovel.castSource.length).toBeGreaterThan(0);
        expect(snapshot.debug.visualNovel.openModal).toBe('none');
        expect(snapshot.debug.visualNovel.activeModalKind).toBe('scene');
        expect(snapshot.debug.visualNovel.activeModalLabel).toBe('正文演出');
        expect(snapshot.debug.visualNovel.activeUiScope).toBe('scene');
        expect(snapshot.debug.visualNovel.activeUiExclusive).toBe(true);
        expect(snapshot.debug.visualNovel.openModalCount).toBe(0);
        expect(snapshot.debug.visualNovel.openOverlayCount).toBe(0);
        expect(snapshot.debug.visualNovel.textOpacityPercent).toBe(snapshot.vnTextOpacity);
        expect(snapshot.debug.visualNovel.autoDelayMs).toBe(snapshot.vnAutoDelayMs);
        expect(snapshot.debug.visualNovel.skipDelayMs).toBe(snapshot.vnSkipDelayMs);
        expect(snapshot.debug.visualNovel.immersiveUiHidden).toBe(snapshot.vnImmersiveUiHidden === 'true');
        expect(snapshot.vnBackdropKey.length).toBeGreaterThan(0);
        expect(snapshot.vnBackdropTitle.length).toBeGreaterThan(0);
        expect(snapshot.vnBackdropImageUrl.length).toBeGreaterThan(0);
        expect(snapshot.vnBackdropMatchScore).toBeGreaterThanOrEqual(0);
        expect(snapshot.vnBackdropConfidence.length).toBeGreaterThan(0);
        expect(snapshot.backdropMatch?.key).toBe(snapshot.backdropKey);
        expect(Array.isArray(snapshot.backdropCandidateKeys)).toBe(true);
        expect(snapshot.backdropCandidateKeys.length).toBeGreaterThanOrEqual(1);
        expect(snapshot.debug.visualNovel.worldStatusVisible).toBe(false);
        await page.locator('#re0-vn-stage [data-re0-vn-open-hud]').click();
        await expect.poll(() => page.evaluate(() => window.re0AdventureEngineDebug?.().visualNovel.worldStatusVisible)).toBe(true);
        await expect.poll(() => page.evaluate(() => window.re0AdventureEngineDebug?.().visualNovel.openModal)).toBe('worldStatus');
        await expect.poll(() => page.evaluate(() => window.re0AdventureEngineDebug?.().visualNovel.activeModalKind)).toBe('drawer');
        await expect.poll(() => page.evaluate(() => window.re0AdventureEngineDebug?.().visualNovel.activeUiScope)).toBe('ui-only');
        expect(Object.prototype.hasOwnProperty.call(snapshot.debug.visualNovel, 'directSpeakerCount')).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(snapshot.debug.visualNovel, 'narratorShare')).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(snapshot.debug.visualNovel, 'roleDrivenPass')).toBe(true);
        expect(Array.isArray(snapshot.debug.visualNovel.directSpeakerNames)).toBe(true);
        expect(snapshot.debug.playLoopDirector.version).toBe('play-loop-director-2026-05-29');
        expect(['daily', 'mainline', 'adult', 'answer']).toContain(snapshot.debug.playLoopDirector.mode);
        expect(snapshot.debug.playLoopDirector.mustInclude.length).toBeGreaterThanOrEqual(4);
        expect(snapshot.debug.playLoopDirector.actionBias.length).toBeGreaterThanOrEqual(3);
        expect(Array.isArray(snapshot.debug.playLoopDirector.characterAgencyHooks)).toBe(true);
        expect(snapshot.debug.playLoopDirector.staticHookMetadata.count).toBeGreaterThanOrEqual(48);
        expect(snapshot.debug.playLoopDirector.staticHookMetadata.modes).toEqual(expect.arrayContaining(['daily', 'mainline', 'adultSafe']));
        expect(snapshot.debug.playLoopDirector.loop).toContain('闭环');
        expect(snapshot.debug.agentTurn.summary).toContain('AgentTurn');
        expect(['pass', 'warn', 'repair', 'block']).toContain(snapshot.debug.agentTurn.validation.status);
        expect(snapshot.debug.agentTurn.moduleStatus.StoryRAG).toBe('available');
        expect(snapshot.debug.agentTurn.moduleStatus.NarrativeDirector).toBe('available');
        expect(snapshot.debug.agentTurn.moduleStatus.SaveMemory).toBe('available');
        expect(snapshot.debug.agentTurn.moduleStatus.Worldline).toBe('available');
        expect(snapshot.debug.agentTurn.moduleStatus.CharacterMemory).toBe('available');
        expect(snapshot.debug.agentTurn.moduleStatus.AssetDirector).toBe('available');
        expect(snapshot.debug.agentTurn.moduleStatus.VNRenderer).toBe('available');
        expect(snapshot.debug.agentTurn.moduleStatus.TTSDirector).toBe('available');
        expect(snapshot.debug.agentTurn.moduleStatus.Evaluator).toBe('available');
        expect(['canon-follow', 'free-simulation', 'world-essence-simulation', 'if-attractor']).toContain(snapshot.debug.agentTurn.storyRag.actionMode);
        expect(snapshot.debug.storyRag.health.status).toBe('pass');
        expect(snapshot.debug.storyRag.architecture.layerOrder).toEqual(expect.arrayContaining([
            'officialCausalMemory',
            'saveScopedMemory',
            'characterMindMemory',
            'deathReturnMemory',
            'directorDecision',
        ]));
        expect(snapshot.debug.storyRag.layers.saveScopedMemory.scope).toBe(snapshot.debug.flags.worldSessionId || snapshot.debug.worldline.id);
        expect(snapshot.debug.agentTurn.observation.saveId).toBe(snapshot.debug.flags.worldSessionId || snapshot.debug.worldline.id);
        expect(snapshot.debug.agentTurn.memory.save.length).toBeGreaterThanOrEqual(1);
        expect(snapshot.debug.agentTurn.assetPlan.selectedBackdropKey).toBe(snapshot.debug.backdrop.key);
        expect(snapshot.debug.agentTurn.ttsPlan.excludedSources).toEqual(expect.arrayContaining(['VN_SCRIPT', 'debug', 'system']));
        expect(snapshot.debug.agentTurn.hostBridge.version).toBe('re0-host-adapter-bridge/v1');
        expect(snapshot.debug.agentTurn.hostBridge.host.kind).toBe('sillytavern-extension');
        expect(snapshot.debug.agentTurn.hostBridge.persistence.sessionId).toBe(snapshot.debug.flags.worldSessionId || snapshot.debug.worldline.id);
        expect(snapshot.debug.agentTurn.hostBridge.outboundCommands.map((command) => command.type)).toEqual(expect.arrayContaining([
            'render-vn-stage',
            'present-grounded-choices',
            'set-backdrop',
            'persist-save',
            'play-tts-targets',
        ]));
        const playLoopChoices = await page.evaluate(() => window.re0AdventureDebugPlayLoopChoices?.(6));
        expect(playLoopChoices.director.version).toBe('play-loop-director-2026-05-29');
        expect(playLoopChoices.choices.length).toBeGreaterThanOrEqual(3);
        expect(playLoopChoices.choices.join(' ')).toMatch(/调查|对话|推进|改变|日常|主线|证据|角色/u);
        const staticPlayLoopHook = await page.evaluate(() => {
            window.re0AdventureApplyVnStatePatch?.({
                current: { location: '静态角色钩子测试房间', viewpoint: '爱蜜莉雅面前' },
                presence: { sceneCharacters: ['爱蜜莉雅'] },
                gameplay: {
                    activeObjective: '让当前在场角色主动推动一个非 IF 测试选择',
                    actionHints: [],
                },
            });
            const director = window.re0AdventureDebug?.().playLoopDirector;
            return {
                metadata: director.staticHookMetadata,
                hooks: director.characterAgencyHooks,
            };
        });
        expect(staticPlayLoopHook.metadata.count).toBeGreaterThanOrEqual(48);
        expect(staticPlayLoopHook.hooks.some((hook) => hook.source === 'static-playloop-hook' && hook.hookId)).toBe(true);
        expect(snapshot.ifPanelText).toContain('IF 节点');
        expect(snapshot.ifPanelText).toContain('规则库');
        expect(snapshot.debug.ifRouteLogic.branchRuleMetadata.count).toBeGreaterThanOrEqual(18);
        expect(snapshot.debug.ifRouteLogic.branchRuleMetadata.softDivisionCount).toBeGreaterThanOrEqual(50);
        expect(snapshot.debug.ifRouteLogic.branchTransition.mode).toBe('soft-attractor');
        expect(snapshot.debug.ifRouteLogic.softBranchSummary).toContain('偏移率');
        expect(Array.isArray(snapshot.debug.ifRouteLogic.relevantBranchRules)).toBe(true);
        expect(snapshot.debug.ifRouteLogic.relevantBranchRules.length).toBeGreaterThanOrEqual(1);
        expect(snapshot.debug.ifRouteLogic.scoreLine.length).toBeGreaterThan(0);
        expect(snapshot.worldlineTreePanelText).toContain('世界线树');
        expect(snapshot.worldlineTreePanelText).toContain('死亡回归记录');
        expect(snapshot.worldlineTreePanelText).toContain('连续吸引域');
        expect(snapshot.debug.worldline.treeSummary.nodeCount).toBeGreaterThanOrEqual(1);
        expect(snapshot.debug.worldline.treeSummary.rows.length).toBeGreaterThanOrEqual(1);
        expect(snapshot.debug.worldline.treeSummary.currentNodeId).toBeTruthy();
        expect(Object.prototype.hasOwnProperty.call(snapshot.debug.worldline.treeSummary, 'lastFailedNodeId')).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(snapshot.debug.worldline.treeSummary.rows[0], 'retainedClueCount')).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(snapshot.debug.worldline.treeSummary.rows[0], 'strategyPivot')).toBe(true);
        const heuristicParse = await page.evaluate(() => {
            window.re0AdventureApplyVnStatePatch?.({
                current: { location: '王都贫民区 / 废弃钟楼外', time: '雨夜' },
                presence: { sceneCharacters: ['莉榭尔·阿尔戈'] },
            });
            return window.re0AdventureParseVisualNovel?.(`
远方传言提到阿尔在帝国商路留下了口供，但这只是后台世界脉冲，不在当前镜头。
莉榭尔·阿尔戈：「你现在只该看着我手里的伞，不要被远方名字带偏。」
【下一步可调查 / 可行动方向】
- 追问莉榭尔为什么知道帝国传言
            `);
        });
        expect(heuristicParse.castIds).toContain('lishelle');
        expect(heuristicParse.castIds).not.toContain('al');
        const singleSceneQuoteParse = await page.evaluate(() => window.re0AdventureParseVisualNovel?.(`
雨顺着伞骨往下淌，灰发修女停在你面前。
她低声说：「不要抬头看钟楼，先看我手里的伞柄。」
【下一步可调查 / 可行动方向】
- 观察伞柄上的刻痕
        `));
        expect(singleSceneQuoteParse.segments.some((segment) => segment.type === 'dialogue' && segment.speakerId === 'lishelle')).toBe(true);
        const structuredParse = await page.evaluate(() => window.re0AdventureParseVisualNovel?.(`
雨声压住了街市。
莉榭尔·阿尔戈：「别让钟声数到第三下。」
【下一步可调查 / 可行动方向】
- 追问莉榭尔
<!-- RE0_VN_SCRIPT {"version":"vn5","backgroundKey":"rain_bell","castIds":["lishelle"],"segments":[{"type":"narration","text":"雨声压住了街市。"},{"type":"dialogue","speakerId":"lishelle","text":"别让钟声数到第三下。"}],"choices":["追问莉榭尔"]} -->
        `));
        expect(structuredParse.sourceMode).toBe('hidden-comment');
        expect(structuredParse.segments).toHaveLength(2);
        expect(structuredParse.segments[1].speakerId).toBe('lishelle');
        expect(structuredParse.choices).toContain('追问莉榭尔');
        const structuredBeatParse = await page.evaluate(() => window.re0AdventureParseVisualNovel?.(`
雨声把王都主街切成一段一段的银线。
爱蜜莉雅：「你看起来不像这里的人。」
<!-- RE0_VN_SCRIPT {"version":"vn5","backgroundKey":"arc01_capital_inner_street","castIds":["emilia"],"beat":{"type":"reveal","pacing":"balanced","progressDelta":["new_clue","relationship_shift"],"nextHook":"确认徽章流向"},"segments":[{"type":"narration","text":"雨声把王都主街切成一段一段的银线。"},{"type":"dialogue","speakerId":"emilia","text":"你看起来不像这里的人。"}],"choices":["追上徽章线索"]} -->
        `));
        expect(structuredBeatParse.beat.type).toBe('reveal');
        expect(structuredBeatParse.beat.progressDelta).toEqual(expect.arrayContaining(['new_clue', 'relationship_shift']));
        expect(structuredBeatParse.beat.nextHook).toContain('徽章');
        const wrongHiddenSpeakerParse = await page.evaluate(() => window.re0AdventureParseVisualNovel?.(`
灰发修女把黑伞压低，挡住废钟方向的雨。
莉榭尔·阿尔戈：「别把我的声音记到魔女身上。」
<!-- RE0_VN_SCRIPT {"version":"vn5","backgroundKey":"rain_bell","castIds":["echidna"],"segments":[{"type":"narration","text":"灰发修女把黑伞压低，挡住废钟方向的雨。"},{"type":"dialogue","speakerId":"echidna","text":"莉榭尔·阿尔戈：「别把我的声音记到魔女身上。」"}],"choices":["询问莉榭尔为什么这么说"]} -->
        `));
        expect(wrongHiddenSpeakerParse.sourceMode).toBe('hidden-comment');
        expect(wrongHiddenSpeakerParse.castIds).toContain('lishelle');
        expect(wrongHiddenSpeakerParse.castIds).not.toContain('echidna');
        expect(wrongHiddenSpeakerParse.segments[1].speakerId).toBe('lishelle');
        const narrationSpeakerLeakParse = await page.evaluate(() => window.re0AdventureParseVisualNovel?.(`
雨声压低了废钟楼外的巷口。
<!-- RE0_VN_SCRIPT {"version":"vn5","backgroundKey":"rain_bell","castIds":[],"segments":[{"type":"narration","text":"莉榭尔·阿尔戈：别把我的台词挂在世界意志上。"},{"type":"narration","speakerId":"lishelle","text":"先看伞柄，再看钟楼。"}],"choices":["确认台词归属"]} -->
        `));
        expect(narrationSpeakerLeakParse.sourceMode).toBe('hidden-comment');
        expect(narrationSpeakerLeakParse.castIds).toContain('lishelle');
        expect(narrationSpeakerLeakParse.segments[0].type).toBe('dialogue');
        expect(narrationSpeakerLeakParse.segments[0].speakerId).toBe('lishelle');
        expect(narrationSpeakerLeakParse.segments[1].type).toBe('dialogue');
        expect(narrationSpeakerLeakParse.segments[1].speakerId).toBe('lishelle');
        expect(narrationSpeakerLeakParse.roleMetrics.roleDrivenPass).toBe(true);
        const embeddedNarrationLeakParse = await page.evaluate(() => window.re0AdventureParseVisualNovel?.(`
雨声贴着伞沿往下淌。
<!-- RE0_VN_SCRIPT {"version":"vn5","backgroundKey":"rain_bell","castIds":[],"segments":[{"type":"narration","text":"莉榭尔低声提醒：「先看我手里的伞柄。」雨水在石板上汇成细线。"}],"choices":["观察伞柄"]} -->
        `));
        expect(embeddedNarrationLeakParse.castIds).toContain('lishelle');
        expect(embeddedNarrationLeakParse.segments.some((segment) => segment.type === 'dialogue' && segment.speakerId === 'lishelle' && segment.text.includes('伞柄'))).toBe(true);
        const queueProbe = await page.evaluate(() => {
            const replyOne = `第一段模型正文。
莉榭尔·阿尔戈：「先别让钟声盖过你的判断。」
<!-- RE0_VN_SCRIPT {"version":"vn5","backgroundKey":"rain_bell","castIds":["lishelle"],"segments":[{"type":"narration","text":"第一段模型正文落入雨声。"},{"type":"dialogue","speakerId":"lishelle","text":"先别让钟声盖过你的判断。"}],"choices":["观察伞柄"]} -->`;
            const replyTwo = `第二段模型正文。
米娅：「外面有人在找你们。」
<!-- RE0_VN_SCRIPT {"version":"vn5","backgroundKey":"relief_house","castIds":["mia","lishelle"],"segments":[{"type":"narration","text":"门外的脚步声贴近了救济院。"},{"type":"dialogue","speakerId":"mia","text":"外面有人在找你们。"}],"choices":["让米娅先进来"]} -->`;
            window.re0AdventureDebugMergeStatePatch?.({
                mode: 'main',
                current: { location: '王都贫民区 / 救济院', time: '雨夜' },
                presence: { sceneCharacters: ['莉榭尔·阿尔戈', '米娅'] },
                gameplay: { activeObjective: '测试 VN 队列追加而不是替换' },
                debugNarrativeText: replyOne,
                debugMessageId: 91001,
            });
            const first = window.re0AdventureDebugExportState?.()?.visuals?.visualNovel || {};
            window.re0AdventureDebugMergeStatePatch?.({
                debugResetVnScript: false,
                debugNarrativeText: replyTwo,
                debugMessageId: 91002,
            });
            const second = window.re0AdventureDebugExportState?.()?.visuals?.visualNovel || {};
            window.re0AdventureDebugMergeStatePatch?.({
                debugResetVnScript: false,
                debugNarrativeText: `${replyOne}\n\n【下一步可调查 / 可行动方向】\n- footer 改写后不应重复入队`,
                debugMessageId: 91001,
            });
            const duplicate = window.re0AdventureDebugExportState?.()?.visuals?.visualNovel || {};
            const beforePendingTexts = (second.segments || []).map((segment) => segment.text);
            window.re0AdventureDebugMergeStatePatch?.({
                debugResetVnScript: false,
                visuals: {
                    visualNovel: {
                        pendingSend: {
                            active: true,
                            text: '等待模型时不覆盖缓存',
                            startedAt: new Date().toISOString(),
                            startedChatLength: 99999,
                            status: 'pending',
                        },
                    },
                },
            });
            window.re0AdventureRecoverUi?.();
            const pending = window.re0AdventureDebugExportState?.()?.visuals?.visualNovel || {};
            return {
                firstCount: (first.segments || []).length,
                secondCount: (second.segments || []).length,
                duplicateCount: (duplicate.segments || []).length,
                duplicateSkipCount: Number(duplicate.lastDuplicateQueueSkipCount || 0),
                secondTexts: (second.segments || []).map((segment) => segment.text),
                queueMode: second.queueMode,
                pendingTexts: (pending.segments || []).map((segment) => segment.text),
                beforePendingTexts,
                pendingSource: pending.scriptSource || '',
            };
        });
        expect(queueProbe.firstCount).toBeGreaterThanOrEqual(2);
        expect(queueProbe.secondCount).toBeGreaterThan(queueProbe.firstCount);
        expect(queueProbe.secondTexts.join('\n')).toContain('第一段模型正文');
        expect(queueProbe.secondTexts.join('\n')).toContain('门外的脚步声');
        expect(queueProbe.queueMode).toBe('append');
        expect(queueProbe.duplicateCount).toBe(queueProbe.secondCount);
        expect(queueProbe.duplicateSkipCount).toBeGreaterThanOrEqual(2);
        expect(queueProbe.pendingTexts).toEqual(queueProbe.beforePendingTexts);
        expect(queueProbe.pendingTexts.join('\n')).not.toContain('模型正文还没有落回舞台');
        const safePatchResult = await page.evaluate(() => window.re0AdventureApplyVnStatePatch?.({
            current: { location: '王都主街边缘', viewpoint: '街市摊前' },
            sceneBackdrop: { currentKey: 'royal_capital', lastReason: 'VN Script 测试背景同步' },
            presence: { sceneCharacters: ['street_vendor', '莉榭尔·阿尔戈'] },
            gameplay: { activeObjective: '从街市商贩处确认钟声传言', actionHints: ['问价时套话', '观察摊位背后的卫兵'] },
            characterCards: {
                '街市小贩': {
                    id: 'market_vendor',
                    memory: ['测试：他把钟声传言和热汤价格一起卖给主角。'],
                    suspicion: 12,
                    trust: 8,
                },
            },
            returnByDeath: { deaths: 99 },
            worldline: { divergence: 9.999 },
            worldClock: { worldDay: 99 },
        }));
        expect(safePatchResult.applied).toEqual(expect.arrayContaining(['current', 'sceneBackdrop', 'presence', 'gameplay', 'characterCards']));
        expect(safePatchResult.blocked).toEqual(expect.arrayContaining(['returnByDeath', 'worldline', 'worldClock']));
        const stageAssets = await page.evaluate(() => ({
            lishelle: window.re0AdventureResolveStageAsset?.('lishelle'),
            emiliaAdult: window.re0AdventureResolveStageAsset?.('emilia', {
                storyMode: 'adult',
                adultEnabled: true,
                segment: {
                    type: 'dialogue',
                    speakerId: 'emilia',
                    text: '她在雨窗前脸红着伸出手，声音压得很轻，像终于承认了那份渴望。',
                    pose: 'hand_reach',
                    expression: 'longing',
                },
            }),
            echidnaMainline: window.re0AdventureResolveStageAsset?.('echidna', {
                storyMode: 'mainline',
                segment: {
                    type: 'dialogue',
                    speakerId: 'echidna',
                    text: '魔女茶会中，艾姬多娜端起茶杯，像观察一份珍贵实验记录那样微笑。',
                    pose: 'tea_offer',
                    expression: 'teasing',
                },
            }),
            al: window.re0AdventureResolveStageAsset?.('al'),
            anastasia: window.re0AdventureResolveStageAsset?.('anastasia'),
            julius: window.re0AdventureResolveStageAsset?.('julius'),
            priscilla: window.re0AdventureResolveStageAsset?.('priscilla'),
            baseSpriteBatch: ['rom', 'ryuzu', 'geuse', 'petelgeuse', 'reid', 'sekmet', 'regulus', 'sirius', 'hetaro', 'tivey', 'ley', 'roy']
                .map((id) => window.re0AdventureResolveStageAsset?.(id)),
            elsaDoorway: window.re0AdventureResolveStageAsset?.('elsa', {
                storyMode: 'adult',
                adultEnabled: true,
                segment: {
                    type: 'dialogue',
                    speakerId: 'elsa',
                    text: '她靠在门边冷笑，像是在邀请，也像是在判断猎物是否已经明白危险。',
                    pose: 'doorway_invitation',
                    expression: 'cold_desire',
                },
            }),
            carmillaClose: window.re0AdventureResolveStageAsset?.('carmilla', {
                storyMode: 'adult',
                adultEnabled: true,
                segment: {
                    type: 'dialogue',
                    speakerId: 'carmilla',
                    text: '她贴近半步，脸颊微红，手指停在丝绸边缘，声音有些发颤。',
                    pose: 'close_whisper',
                    expression: 'flustered',
                },
            }),
            fortunaAftercare: window.re0AdventureResolveStageAsset?.('fortuna', {
                storyMode: 'adult',
                adultEnabled: true,
                segment: {
                    type: 'dialogue',
                    speakerId: 'fortuna',
                    text: '她把披风搭到你肩上，战后的紧张终于松开，只剩很轻的安心。',
                    pose: 'cape_wrap',
                    expression: 'aftercare_soft',
                },
            }),
            grokAdultCg: window.re0AdventureResolveGrokAdultInsertCg?.({
                castIds: ['rem'],
                speakerId: 'rem',
                text: '成人模式下，雨夜房间、膝枕、嫉妒余温与主动靠近把这段关系推到高强度桥段。',
                pose: 'lap_pillow',
                expression: 'deep_intensity',
            }),
            renderedModes: [...document.querySelectorAll('#re0-vn-stage [data-re0-character-card]')].map((element) => ({
                name: element.getAttribute('data-name') || '',
                mode: element.getAttribute('data-re0-asset-mode') || '',
                variantKey: element.getAttribute('data-re0-asset-variant-key') || '',
                matchReason: element.getAttribute('data-re0-asset-match-reason') || '',
                image: element.querySelector('img')?.getAttribute('src') || '',
            })),
        }));
        expect(stageAssets.lishelle.mode).toBe('sprite');
        expect(stageAssets.emiliaAdult.mode).toBe('sprite');
        expect(stageAssets.emiliaAdult.variantKey).toMatch(/adult\.hand_reach\.(?:longing|aftercare_soft)\.night_robe/u);
        expect(stageAssets.emiliaAdult.matchReason).toContain('pose:hand_reach');
        expect(stageAssets.echidnaMainline.mode).toBe('sprite');
        expect(stageAssets.echidnaMainline.image).toContain('/assets/generated/characters/echidna/sprite/');
        expect(stageAssets.echidnaMainline.variantKey).toMatch(/^adult\.(?:tea_offer\.teasing\.witch_formal|contract_write\.knowing_smile\.witch_formal_white|book_hold\.guarded_desire\.robe_layered)$/u);
        expect(stageAssets.al.mode).toBe('sprite');
        expect(stageAssets.al.profileName).toBe('阿尔');
        expect(stageAssets.anastasia.mode).toBe('sprite');
        expect(stageAssets.anastasia.profileName).toContain('安娜塔西亚');
        expect(stageAssets.julius.mode).toBe('sprite');
        expect(stageAssets.julius.profileName).toContain('尤里乌斯');
        expect(stageAssets.priscilla.mode).toBe('sprite');
        expect(stageAssets.priscilla.profileName).toContain('普莉希拉');
        expect(stageAssets.baseSpriteBatch.every((asset) => asset?.mode === 'sprite')).toBe(true);
        expect(stageAssets.baseSpriteBatch.map((asset) => asset?.variantKey)).toEqual(expect.arrayContaining([
            'base.idle.gruff.loot_house_apron',
            'base.idle.calm.sanctuary_robe',
            'base.idle.gentle.forest_cleric',
            'base.idle.mad_grin.archbishop_robes',
            'base.idle.confident.sword_saint',
            'base.idle.tired.witch_robe',
            'base.idle.smug.white_formal',
            'base.idle.fanatic.cult_bandage_robe',
            'base.idle.anxious.beast_mercenary',
            'base.idle.studious.beast_mercenary',
            'base.idle.hungry_smile.gluttony_robe',
            'base.idle.blank_smile.gluttony_robe',
        ]));
        expect(stageAssets.elsaDoorway.variantKey).toBe('adult.doorway_invitation.cold_desire.formal_loosened');
        expect(stageAssets.carmillaClose.variantKey).toBe('adult.close_whisper.flustered.silk_lounge');
        expect(stageAssets.fortunaAftercare.variantKey).toBe('adult.cape_wrap.aftercare_soft.travel_rest');
        expect(stageAssets.grokAdultCg.summary.totalImages).toBe(76);
        expect(stageAssets.grokAdultCg.summary.characterSpriteVariants).toBe(24);
        expect(stageAssets.grokAdultCg.summary.sceneBackdrops).toBe(28);
        expect(stageAssets.grokAdultCg.count).toBeGreaterThanOrEqual(1);
        expect(stageAssets.grokAdultCg.candidates[0].key).toContain('adult.grok.');
        expect(stageAssets.grokAdultCg.candidates[0].file).toContain('/assets/external/grokadult/');
        expect([stageAssets.lishelle.image, stageAssets.al.image, stageAssets.anastasia.image, stageAssets.julius.image, stageAssets.priscilla.image, ...stageAssets.baseSpriteBatch.map((asset) => asset?.image || ''), ...stageAssets.renderedModes.map((entry) => entry.image)]
            .every((image) => !/\.svg(?:$|[?#])/i.test(image))).toBe(true);
        const afterSafePatch = await page.evaluate(() => window.re0AdventureDebug?.());
        expect(afterSafePatch.current.location).toBe('王都贫民区 / 主街边缘');
        expect(afterSafePatch.flags.lastVnStatePatch).toContain('VN Script 安全补丁已应用');
        expect(afterSafePatch.backdrop.match.key).toBe(afterSafePatch.backdrop.key);
        expect(['script', 'script-corrected', 'location', 'keyword', 'manual']).toContain(afterSafePatch.backdrop.match.strategy);
        const mappingChecks = await page.evaluate(async () => {
            const cases = [
                { location: '王都贫民区 / 盗品蔵内部', characters: ['菲鲁特', '罗姆爷', '艾尔莎'], objective: '确认徽章失窃与艾尔莎委托链', expected: 'loot_house' },
                { location: '贫民区救济院', characters: ['莉榭尔·阿尔戈', '米娅'], objective: '核验死亡记忆残响与废钟锈迹', expected: 'relief_house' },
                { location: '罗兹瓦尔宅邸厨房', characters: ['蕾姆', '拉姆'], objective: '检查饭菜与仆人铃异常', expected: 'mansion_kitchen' },
                { location: '成人酒馆客房：秘密来访', characters: ['艾尔莎'], objective: '秘密来访，半开门，旅店客房，成人模式关系试探', expected: 'adult_tavern_room__secret_visit' },
                { location: '成人魔女梦境：银线', characters: ['艾姬多娜'], objective: '魔女梦境银线，黑茶，精神边界，成人模式', expected: 'adult_witch_dream_intimacy__silver_threads' },
            ];
            const output = [];
            for (const item of cases) {
                window.re0AdventureApplyVnStatePatch?.({
                    current: { location: item.location },
                    presence: { sceneCharacters: item.characters },
                    gameplay: { activeObjective: item.objective },
                });
                await new Promise((resolve) => setTimeout(resolve, 20));
                const debug = window.re0AdventureDebug?.();
                output.push({
                    location: item.location,
                    expected: item.expected,
                    key: debug?.backdrop?.key || '',
                    strategy: debug?.backdrop?.match?.strategy || '',
                    reasons: (debug?.backdrop?.match?.candidates || [])[0]?.reasons || [],
                });
            }
            return output;
        });
        expect(mappingChecks.map((item) => item.key)).toEqual([
            'loot_house',
            'relief_house',
            'mansion_kitchen',
            'adult_tavern_room__secret_visit',
            'adult_witch_dream_intimacy__silver_threads',
        ]);
        expect(mappingChecks.every((item) => ['location', 'script-corrected', 'keyword'].includes(item.strategy))).toBe(true);
        expect(mappingChecks.every((item) => item.reasons.length >= 1 || item.strategy === 'location')).toBe(true);
        await page.evaluate(() => window.re0AdventureApplyVnStatePatch?.({
            gameplay: {
                activeObjective: 'Arc 3 白鲸活动 怠惰位置 撤离路线 阵营协商',
                objectiveStage: 'Arc 3 战役准备',
            },
        }));
        const ifChoiceOverlay = await page.evaluate(() => window.re0AdventureDebug?.().visualNovel);
        expect(ifChoiceOverlay.choiceOverlaySource).toBe('if-branch-rule');
        expect(ifChoiceOverlay.choiceOverlayRuleId.length).toBeGreaterThan(0);
        expect(ifChoiceOverlay.choiceOverlaySoftness).toContain('soft-attractor');
        expect(ifChoiceOverlay.choiceOverlayChoices.length).toBeGreaterThanOrEqual(3);
        expect(ifChoiceOverlay.choiceOverlayChoices.some((choice) => /^(?:白鲸队?|怠惰|魔女教|撤退|撤离|双线|两线|阿拉姆队?)$/u.test(choice))).toBe(false);
        expect(ifChoiceOverlay.choiceOverlayChoices.every((choice) => /亲自|明确|带着|当场|独自|先|不追|把|让|跟|调查|验证|撤|分|交给|协商|观察|询问|确认|准备/u.test(choice))).toBe(true);
        expect(ifChoiceOverlay.choiceOverlayContextTerms.some((term) => /白鲸|怠惰|撤退|双线/u.test(term))).toBe(true);
        const ifSoftRuleDebug = await page.evaluate(() => window.re0AdventureDebug?.().ifRouteLogic);
        expect(ifSoftRuleDebug.relevantBranchRules.some((rule) => rule.softDivision?.softLocks?.soft >= 1)).toBe(true);
        expect(ifSoftRuleDebug.relevantBranchRules.some((rule) => Array.isArray(rule.softDivision?.playerFacingChoices) && rule.softDivision.playerFacingChoices.length >= 3)).toBe(true);
        if (snapshot.debug.visualNovel.segmentCount > 1 && snapshot.debug.visualNovel.currentIndex < snapshot.debug.visualNovel.segmentCount - 1) {
            const beforeIndex = snapshot.debug.visualNovel.currentIndex;
            await page.locator('#re0-vn-stage [data-re0-vn-next]').click();
            await page.waitForFunction((index) => window.re0AdventureDebug?.().visualNovel.currentIndex > index, beforeIndex, { timeout: 5_000 });
            const afterNext = await page.evaluate(() => window.re0AdventureDebug?.().visualNovel);
            expect(afterNext.currentIndex).toBeGreaterThan(beforeIndex);
        }
        const manualCheckpoint = await page.evaluate(() => window.re0AdventureVnCheckpoint?.('E2E 手动舞台检查点'));
        expect(manualCheckpoint?.checkpoint?.summary || '').toContain('E2E 手动舞台检查点');
        await page.locator('#re0-vn-stage [data-re0-vn-rollback]').click();
        await page.waitForFunction(() => (window.re0AdventureDebug?.().visualNovel.checkpointLastRestore || '').includes('已回滚到'), null, { timeout: 5_000 });
        const afterRollback = await page.evaluate(() => window.re0AdventureDebug?.().visualNovel);
        expect(afterRollback.checkpointLastRestore).toContain('已回滚到');
        await page.locator('#re0-vn-stage [data-re0-vn-auto]').click();
        await page.waitForFunction(() => window.re0AdventureDebug?.().visualNovel.autoPlay === true, null, { timeout: 5_000 });
        await page.locator('#re0-vn-stage [data-re0-vn-skip]').click();
        await page.waitForFunction(() => {
            const vn = window.re0AdventureDebug?.().visualNovel;
            return vn?.skipMode === true && vn?.autoPlay === false;
        }, null, { timeout: 5_000 });
        expect(snapshot.sendNoConnection).toBe(false);
        expect(snapshot.placeholder).not.toContain('未连接');
        expect(snapshot.debug.ok).toBe(true);
        expect(snapshot.debug.flags.apiHealth.ok).toBe(true);
        expect(snapshot.debug.flags.apiHealth.modelSeen).toBe(true);
        expect(snapshot.debug.flags.lastPromptSections).toContain('核心');
        const corePromptCoverage = snapshot.debug.flags.lastPromptSections.match(/核心\s+(\d+)\/(\d+)/);
        expect(corePromptCoverage).not.toBeNull();
        expect(Number(corePromptCoverage?.[1] || 0)).toBe(Number(corePromptCoverage?.[2] || -1));
        expect(Number(corePromptCoverage?.[2] || 0)).toBeGreaterThanOrEqual(12);
        expect(snapshot.debug.flags.lastPromptSections).toMatch(/扩展\s+(?:[4-9]|1[0-5])\/15/);
        expect(Object.prototype.hasOwnProperty.call(snapshot.debug.flags, 'lastGenerationMs')).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(snapshot.debug.flags, 'lastPostProcessMs')).toBe(true);
        expect(snapshot.debug.worldClock.turnsPerWorldDay).toBeGreaterThanOrEqual(1);
        expect(snapshot.debug.worldClock.policy).toMatch(/mainline-pulse-(paused|active)/);
        expect(snapshot.debug.presence.scene.length).toBeGreaterThanOrEqual(1);
        expect(snapshot.backdropKey).toBeTruthy();
        expect(snapshot.backdropImageUrl).toMatch(/\/scripts\/extensions\/third-party\/re0-adventure-engine\/assets\/.+\.(png|jpe?g|webp)$/);
        expect(snapshot.sidecarLength).toBeLessThanOrEqual(7_200);
        expect(snapshot.sidecarContainsStatusDump).toBe(false);
        expect(snapshot.textPanelOpacity || '0.76').toMatch(/^0?\.\d+|1$/);
        const rendered = JSON.parse(snapshot.renderedText);
        expect(rendered.ok).toBe(true);
        expect(rendered.mode).toBeTruthy();
        expect(rendered.storyMode).toMatch(/daily|mainline|adult/);
        expect(rendered.current.location).toBeTruthy();
    });

    test('recovers stale no-connection DOM state through API self-heal', async ({ page }) => {
        await page.evaluate(() => {
            document.querySelector('#send_form')?.classList.add('no-connection');
            document.querySelector('#send_but')?.classList.add('displayNone');
            document.querySelector('#send_textarea')?.setAttribute('placeholder', '未连接到 API！');
        });

        await page.evaluate(() => window.re0AdventureApiHealthCheck?.());

        await page.waitForFunction(() => {
            const debug = window.re0AdventureDebug?.();
            const sendForm = document.querySelector('#send_form');
            const sendButton = document.querySelector('#send_but');
            const placeholder = document.querySelector('#send_textarea')?.getAttribute('placeholder') || '';
            return debug?.flags?.apiHealth?.ok === true
                && !sendForm?.classList.contains('no-connection')
                && !sendButton?.classList.contains('displayNone')
                && !placeholder.includes('未连接');
        }, null, { timeout: 30_000 });

        const recovered = await page.evaluate(() => ({
            api: window.re0AdventureDebug?.().flags?.apiHealth,
            sendNoConnection: document.querySelector('#send_form')?.classList.contains('no-connection') || false,
            sendHidden: document.querySelector('#send_but')?.classList.contains('displayNone') || false,
            placeholder: document.querySelector('#send_textarea')?.getAttribute('placeholder') || '',
        }));

        expect(recovered.api.ok).toBe(true);
        expect(recovered.sendNoConnection).toBe(false);
        expect(recovered.sendHidden).toBe(false);
        expect(recovered.placeholder).not.toContain('未连接');
    });

    test('keeps the visible stage stable while a real custom action is pending', async ({ page }) => {
        await page.waitForFunction(() => {
            const stage = document.querySelector('#re0-vn-stage');
            return !!stage && !stage.hidden && !!stage.querySelector('[data-re0-vn-custom-input]');
        }, null, { timeout: 20_000 });

        const before = await page.evaluate(() => {
            const stage = document.querySelector('#re0-vn-stage');
            return {
                text: stage?.querySelector('.re0-vn-dialogue-text')?.textContent?.trim() || '',
                currentIndex: stage?.dataset?.re0VnCurrentIndex || '',
                queueLength: stage?.dataset?.re0VnQueueLength || '',
                backdrop: stage?.dataset?.re0VnBackdropKey || '',
            };
        });
        await page.locator('#re0-vn-stage [data-re0-vn-custom-input]').fill('我先确认脚边的血迹和脚印，不离开当前巷子。');
        await page.locator('#re0-vn-stage [data-re0-vn-custom-send]').click();
        await page.waitForTimeout(1800);
        const after = await page.evaluate(() => {
            const stage = document.querySelector('#re0-vn-stage');
            return {
                text: stage?.querySelector('.re0-vn-dialogue-text')?.textContent?.trim() || '',
                currentIndex: stage?.dataset?.re0VnCurrentIndex || '',
                queueLength: stage?.dataset?.re0VnQueueLength || '',
                backdrop: stage?.dataset?.re0VnBackdropKey || '',
                pending: stage?.querySelector('.re0-vn-send-status')?.textContent?.trim() || '',
            };
        });

        expect(after.text).toBe(before.text);
        expect(after.currentIndex).toBe(before.currentIndex);
        expect(after.backdrop).toBe(before.backdrop);
        expect(Number(after.queueLength)).toBeGreaterThanOrEqual(Number(before.queueLength));
        expect(after.pending).toMatch(/等待模型回复|正在等待模型回复|可恢复发送|模型回复/);
    });

    test('survives a realistic visual-novel interaction stress flow', async ({ page }) => {
        test.setTimeout(600_000);

        await page.waitForFunction(() => {
            const debug = window.re0AdventureDebug?.();
            return debug?.ok && debug?.visualNovel?.visible && debug.visualNovel.segmentCount >= 1;
        }, null, { timeout: 20_000 });

        const initial = await page.evaluate(() => window.re0AdventureDebug?.());
        expect(initial.visualNovel.segmentCount).toBeGreaterThanOrEqual(1);

        await page.evaluate(() => window.re0AdventureApplyVnStatePatch?.({
            debug: { clearPendingSend: true },
            visuals: { visualNovel: { pendingSend: { active: false } } },
            flags: {
                awaitingModelNarration: false,
                pendingModelNarrationRequestId: '',
                pendingModelNarrationSource: '',
            },
            current: { location: '王都压力测试街区', viewpoint: '雨巷交叉口' },
            sceneBackdrop: { currentKey: 'royal_capital', reason: 'E2E 压力流：切换到王都背景' },
            presence: { sceneCharacters: ['莉榭尔·阿尔戈', '库珥修·卡尔斯腾', '威尔海姆·范·阿斯特雷亚', '菲利克斯'] },
            gameplay: {
                activeObjective: '压力测试：确认 VN 舞台连续交互稳定',
                actionHints: ['检查雨巷', '询问莉榭尔', '观察骑士队'],
            },
        }));
        await page.waitForFunction(() => window.re0AdventureDebug?.().visualNovel.pendingSendActive === false, null, { timeout: 5_000 });

        for (let index = 0; index < 8; index += 1) {
            const canNext = await page.locator('#re0-vn-stage [data-re0-vn-next]').isEnabled();
            if (!canNext) break;
            await page.locator('#re0-vn-stage [data-re0-vn-next]').click();
            await page.waitForTimeout(60);
        }

        for (let index = 0; index < 4; index += 1) {
            const canPrev = await page.locator('#re0-vn-stage [data-re0-vn-prev]').isEnabled();
            if (!canPrev) break;
            await page.locator('#re0-vn-stage [data-re0-vn-prev]').click();
            await page.waitForTimeout(60);
        }

        await page.locator('#re0-vn-stage [data-re0-vn-backlog]').click();
        await expect(page.locator('#re0-vn-stage .re0-vn-backlog:not(.is-hidden)')).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.openModal)).toBe('backlog');
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.activeModalLabel)).toBe('历史日志');
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.activeUiScope)).toBe('ui-only');
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.openModalCount)).toBe(1);
        await expect(page.locator('#re0-vn-stage .re0-vn-backlog[data-re0-vn-modal="backlog"][role="dialog"]')).toBeVisible();
        await page.locator('#re0-vn-stage [data-re0-vn-backlog-close]').click();
        await expect(page.locator('#re0-vn-stage .re0-vn-backlog')).toHaveClass(/is-hidden/);
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.openModal)).toBe('none');

        await page.locator('#re0-vn-stage [data-re0-vn-load]').click();
        await expect(page.locator('#re0-vn-stage .re0-vn-load-panel:not(.is-hidden)')).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.openModal)).toBe('load');
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.activeModalLabel)).toBe('读档');
        await expect(page.locator('#re0-vn-stage .re0-vn-load-panel [data-re0-vn-modal-shell]')).toBeVisible();
        await expect(page.locator('#re0-vn-stage .re0-vn-load-panel .re0-vn-modal-status')).toContainText('存档状态');
        await expect(page.locator('#re0-vn-stage .re0-vn-load-panel .re0-vn-modal-actions')).toContainText('读档会覆盖');
        await page.locator('#re0-vn-stage [data-re0-vn-load-close]').click();
        await expect(page.locator('#re0-vn-stage .re0-vn-load-panel')).toHaveClass(/is-hidden/);
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.openModal)).toBe('none');

        await page.locator('#re0-vn-stage [data-re0-vn-worldline]').click();
        await expect(page.locator('#re0-vn-stage .re0-vn-worldline-panel:not(.is-hidden)')).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.openModal)).toBe('worldline');
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.activeModalLabel)).toBe('世界线树');
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.activeUiScope)).toBe('ui-only');
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.activeUiExclusive)).toBe(true);
        await expect(page.locator('#re0-vn-stage .re0-vn-worldline-panel')).toContainText('世界线树');
        await expect(page.locator('#re0-vn-stage .re0-vn-worldline-panel .re0-vn-modal-heading')).toContainText('UI-only');
        await expect(page.locator('#re0-vn-stage .re0-vn-worldline-panel [data-re0-vn-modal-shell]')).toBeVisible();
        await expect(page.locator('#re0-vn-stage .re0-vn-worldline-panel .re0-vn-modal-status')).toContainText('世界线状态');
        await expect(page.locator('#re0-vn-stage .re0-vn-worldline-panel .re0-vn-modal-actions')).toContainText('不会推进时间');
        await page.locator('#re0-vn-stage [data-re0-vn-worldline-close]').click();
        await expect(page.locator('#re0-vn-stage .re0-vn-worldline-panel')).toHaveClass(/is-hidden/);
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.openModal)).toBe('none');

        await page.locator('#re0-vn-stage [data-re0-vn-answerbook]').click();
        await expect(page.locator('#re0-vn-stage .re0-vn-answerbook-panel:not(.is-hidden)')).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.openModal)).toBe('answerbook');
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.activeModalLabel)).toBe('答案之书');
        await expect(page.locator('#re0-vn-stage .re0-vn-answerbook-panel')).toContainText(/答案之书|Answer Book/);
        await expect(page.locator('#re0-vn-stage .re0-vn-answerbook-panel [data-re0-vn-modal-shell]')).toBeVisible();
        await expect(page.locator('#re0-vn-stage .re0-vn-answerbook-panel .re0-vn-modal-status')).toContainText('答案之书状态');
        await expect(page.locator('#re0-vn-stage .re0-vn-answerbook-panel .re0-vn-modal-actions')).toContainText(/答案之书|失败线|返回锚点|不推进剧情/);
        await page.locator('#re0-vn-stage [data-re0-vn-answerbook-close]').click();
        await expect(page.locator('#re0-vn-stage .re0-vn-answerbook-panel')).toHaveClass(/is-hidden/);
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.openModal)).toBe('none');

        await page.locator('#re0-vn-stage [data-re0-vn-config]').click();
        await expect(page.locator('#re0-vn-stage .re0-vn-config-panel:not(.is-hidden)')).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.openModal)).toBe('config');
        const visibleConfigPanel = page.locator('#re0-vn-stage .re0-vn-config-panel:not(.is-hidden)');
        await visibleConfigPanel.locator('[data-re0-vn-text-opacity]').evaluate((input) => {
            input.value = '65';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await visibleConfigPanel.locator('[data-re0-vn-auto-delay]').evaluate((input) => {
            input.value = '1800';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await visibleConfigPanel.locator('[data-re0-vn-skip-delay]').evaluate((input) => {
            input.value = '300';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.textOpacityPercent)).toBe(65);
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.autoDelayMs)).toBe(1800);
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.skipDelayMs)).toBe(300);
        await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--re0-text-panel-opacity').trim())).toBe('0.65');
        await expect.poll(() => page.evaluate(() => (window.re0AdventureDebug?.().visualNovel.configSyncTrail || []).join('|'))).toContain('skip-delay:');
        await page.locator('#re0-vn-stage [data-re0-vn-config-close]').click();
        await expect(page.locator('#re0-vn-stage .re0-vn-config-panel')).toHaveClass(/is-hidden/);
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.openModal)).toBe('none');

        await page.locator('#re0-vn-stage').click({ position: { x: 24, y: 24 } });
        await page.keyboard.press('b');
        await expect(page.locator('#re0-vn-stage .re0-vn-backlog:not(.is-hidden)')).toBeVisible();
        await page.keyboard.press('b');
        await expect(page.locator('#re0-vn-stage .re0-vn-backlog')).toHaveClass(/is-hidden/);
        await page.keyboard.press('h');
        await page.waitForFunction(() => document.body.classList.contains('re0-immersive-ui-hidden'), null, { timeout: 5_000 });
        await page.keyboard.press('h');
        await page.waitForFunction(() => !document.body.classList.contains('re0-immersive-ui-hidden'), null, { timeout: 5_000 });
        await page.keyboard.press('a');
        await page.waitForFunction(() => {
            const vn = window.re0AdventureDebug?.().visualNovel;
            return vn?.autoPlay === true && vn?.skipMode === false;
        }, null, { timeout: 5_000 });
        await page.keyboard.press('a');
        await page.waitForFunction(() => window.re0AdventureDebug?.().visualNovel.autoPlay === false, null, { timeout: 5_000 });

        await page.locator('#re0-vn-stage [data-re0-vn-auto]').click();
        await page.waitForFunction(() => window.re0AdventureDebug?.().visualNovel.autoPlay === true, null, { timeout: 5_000 });
        await page.locator('#re0-vn-stage [data-re0-vn-skip]').click();
        await page.waitForFunction(() => {
            const vn = window.re0AdventureDebug?.().visualNovel;
            return vn?.skipMode === true && vn?.autoPlay === false;
        }, null, { timeout: 5_000 });

        for (let index = 0; index < 8; index += 1) {
            const canNext = await page.locator('#re0-vn-stage [data-re0-vn-next]').isEnabled();
            if (!canNext) break;
            await page.locator('#re0-vn-stage [data-re0-vn-next]').click();
            await page.waitForTimeout(60);
        }

        const choiceCount = await page.locator('#re0-vn-stage [data-re0-vn-choice]').count();
        expect(choiceCount).toBeGreaterThanOrEqual(1);
        await expect(page.locator('#re0-vn-stage [data-re0-vn-choice].is-selected')).toHaveCount(1);
        const choiceLayout = await page.evaluate(() => {
            const rectOf = (selector) => {
                const element = document.querySelector(selector);
                if (!element) return null;
                const rect = element.getBoundingClientRect();
                return {
                    left: rect.left,
                    right: rect.right,
                    top: rect.top,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height,
                };
            };
            const overlapArea = (a, b) => {
                if (!a || !b) return 0;
                const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
                const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
                return width * height;
            };
            const pointTarget = (x, y) => {
                const element = document.elementFromPoint(x, y);
                return {
                    tag: element?.tagName || '',
                    cls: element?.className || '',
                    isDialogue: !!element?.closest?.('.re0-vn-dialogue-box'),
                    isChoice: !!element?.closest?.('.re0-vn-choices-overlay'),
                    isCharacter: !!element?.closest?.('[data-re0-character-card]'),
                };
            };
            const overlay = rectOf('#re0-vn-stage .re0-vn-choices-overlay');
            const dialogue = rectOf('#re0-vn-stage .re0-vn-dialogue-box');
            const firstCharacter = rectOf('#re0-vn-stage [data-re0-character-card]');
            const overlayElement = document.querySelector('#re0-vn-stage .re0-vn-choices-overlay');
            const bodyElement = document.querySelector('#re0-vn-stage .re0-vn-choice-body');
            const customInput = document.querySelector('#re0-vn-stage [data-re0-vn-custom-input]');
            const customInputRect = customInput?.getBoundingClientRect();
            const sidebarTools = document.querySelectorAll('#re0-vn-stage .re0-vn-sidebar-tools button');
            const sidebarTabs = document.querySelectorAll('#re0-vn-stage .re0-vn-sidebar-tabs button');
            const topActions = document.querySelectorAll('#re0-vn-stage .re0-vn-top-actions button');
            const choiceButtons = [...document.querySelectorAll('#re0-vn-stage [data-re0-vn-choice]')];
            const choiceRects = choiceButtons.map((button) => rectOf(`#re0-vn-stage [data-re0-vn-choice-index="${button.getAttribute('data-re0-vn-choice-index')}"]`)).filter(Boolean);
            const choicePairOverlap = choiceRects.reduce((max, rect, index) => Math.max(max, ...choiceRects.slice(index + 1).map((other) => overlapArea(rect, other))), 0);
            const qrPopout = document.querySelector('#qr--popout');
            return {
                overlay,
                dialogue,
                firstCharacter,
                viewportHeight: window.innerHeight,
                overlayOverflow: overlayElement ? getComputedStyle(overlayElement).overflow : '',
                bodyPointerEvents: bodyElement ? getComputedStyle(bodyElement).pointerEvents : '',
                customInputPointerEvents: customInput ? getComputedStyle(customInput).pointerEvents : '',
                customInputHeight: customInputRect?.height || 0,
                topActionCount: topActions.length,
                sidebarTabsCount: sidebarTabs.length,
                sidebarToolsCount: sidebarTools.length,
                maxChoiceOverflow: choiceButtons.reduce((max, button) => Math.max(max, button.scrollWidth - button.clientWidth), 0),
                choicePairOverlap,
                quickReplyHidden: !qrPopout || getComputedStyle(qrPopout).display === 'none' || getComputedStyle(qrPopout).visibility === 'hidden',
                overlayDialogueOverlap: overlapArea(overlay, dialogue),
                dialogueCenterTarget: dialogue ? pointTarget((dialogue.left + dialogue.right) / 2, (dialogue.top + dialogue.bottom) / 2) : null,
                firstCharacterUpperTarget: firstCharacter ? pointTarget((firstCharacter.left + firstCharacter.right) / 2, firstCharacter.top + firstCharacter.height * 0.25) : null,
            };
        });
        expect(choiceLayout.overlay.height).toBeLessThanOrEqual(Math.max(520, choiceLayout.viewportHeight - 98) + 2);
        expect(choiceLayout.overlayOverflow).toBe('hidden');
        expect(choiceLayout.bodyPointerEvents).toBe('auto');
        expect(choiceLayout.customInputPointerEvents).toBe('auto');
        expect(choiceLayout.customInputHeight).toBeGreaterThanOrEqual(90);
        expect(choiceLayout.topActionCount).toBeGreaterThanOrEqual(9);
        expect(choiceLayout.sidebarTabsCount).toBe(0);
        expect(choiceLayout.sidebarToolsCount).toBe(0);
        expect(choiceLayout.maxChoiceOverflow).toBeLessThanOrEqual(2);
        expect(choiceLayout.choicePairOverlap).toBe(0);
        expect(choiceLayout.quickReplyHidden).toBe(true);
        expect(choiceLayout.overlayDialogueOverlap).toBe(0);
        expect(choiceLayout.overlay.left).toBeGreaterThanOrEqual(choiceLayout.dialogue.right + 2);
        expect(choiceLayout.dialogueCenterTarget.isDialogue).toBe(true);
        expect(choiceLayout.dialogueCenterTarget.isChoice).toBe(false);
        expect(choiceLayout.firstCharacterUpperTarget?.isCharacter).toBe(true);
        expect(choiceLayout.firstCharacterUpperTarget?.isChoice).toBe(false);
        const selectedBeforeCollapse = await page.evaluate(() => window.re0AdventureDebug?.().visualNovel.selectedChoiceIndex);
        await page.locator('#re0-vn-stage [data-re0-vn-toggle-choices]').click();
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.choicesCollapsed)).toBe(true);
        await expect(page.locator('#re0-vn-stage .re0-vn-choice-body')).toBeHidden();
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(120);
        expect(await page.evaluate(() => window.re0AdventureDebug?.().visualNovel.selectedChoiceIndex)).toBe(selectedBeforeCollapse);
        await page.locator('#re0-vn-stage [data-re0-vn-toggle-choices]').click();
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.choicesCollapsed)).toBe(false);
        await expect(page.locator('#re0-vn-stage .re0-vn-choice-body')).toBeVisible();
        const dragHandle = page.locator('#re0-vn-stage [data-re0-vn-choice-drag-handle]');
        await expect(dragHandle).toHaveCount(1);
        const dragBox = await dragHandle.boundingBox();
        expect(dragBox).not.toBeNull();
        const beforeDragPosition = await page.evaluate(() => window.re0AdventureDebug?.().visualNovel.choiceOverlayPosition);
        await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(dragBox.x + dragBox.width / 2 + 120, dragBox.y + dragBox.height / 2 - 70, { steps: 8 });
        await page.mouse.up();
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.choiceOverlayPosition.mode)).toBe('manual');
        const afterDragLayout = await page.evaluate(() => {
            const overlay = document.querySelector('#re0-vn-stage .re0-vn-choices-overlay');
            const rect = overlay?.getBoundingClientRect();
            const debug = window.re0AdventureDebug?.().visualNovel;
            return {
                rect: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null,
                mode: debug?.choiceOverlayPosition?.mode || '',
                x: debug?.choiceOverlayPosition?.x || 0,
                y: debug?.choiceOverlayPosition?.y || 0,
                classList: [...(overlay?.classList || [])],
            };
        });
        expect(afterDragLayout.mode).toBe('manual');
        expect(afterDragLayout.classList).toContain('is-manual');
        expect(Math.abs(afterDragLayout.x - (beforeDragPosition?.x || 0)) + Math.abs(afterDragLayout.y - (beforeDragPosition?.y || 0))).toBeGreaterThan(20);
        expect(afterDragLayout.rect.left).toBeGreaterThanOrEqual(0);
        expect(afterDragLayout.rect.top).toBeGreaterThanOrEqual(0);
        await page.locator('#re0-vn-stage [data-re0-vn-reset-choices-position]').click();
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.choiceOverlayPosition.mode)).toBe('auto');
        await expect(page.locator('#re0-vn-stage .re0-vn-choices-overlay')).not.toHaveClass(/is-manual/);
        const choiceContextBefore = await page.evaluate(() => window.re0AdventureDebug?.().visualNovel.choiceOverlayContextKey || '');
        const nonceBeforeRefresh = await page.evaluate(() => window.re0AdventureDebug?.().visualNovel.choiceRefreshNonce || 0);
        await page.locator('#re0-vn-stage [data-re0-vn-refresh-choices]').click();
        await page.waitForFunction((before) => (window.re0AdventureDebug?.().visualNovel.choiceRefreshNonce || 0) > before, nonceBeforeRefresh, { timeout: 5_000 });
        const choiceContextAfter = await page.evaluate(() => window.re0AdventureDebug?.().visualNovel.choiceOverlayContextKey || '');
        expect(choiceContextAfter).not.toBe(choiceContextBefore);
        await page.locator('#re0-vn-stage [data-re0-vn-custom-input]').fill('我先退半步，观察莉榭尔是否会避开废钟的方向。');
        await page.locator('#re0-vn-stage [data-re0-vn-custom-apply]').click();
        const customTextareaValue = await page.evaluate(() => document.querySelector('#send_textarea')?.value || '');
        expect(customTextareaValue).toContain('观察莉榭尔');
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.customActionDraft
            || document.querySelector('#re0-vn-stage [data-re0-vn-custom-input]')?.value
            || '')).toContain('观察莉榭尔');
        const selectedBeforeKeyboard = await page.evaluate(() => window.re0AdventureDebug?.().visualNovel.selectedChoiceIndex);
        await page.locator('#re0-vn-stage').click({ position: { x: 24, y: 24 } });
        await page.keyboard.press('ArrowDown');
        await page.waitForFunction((before) => {
            const vn = window.re0AdventureDebug?.().visualNovel;
            return vn?.choiceMode === true && vn.selectedChoiceIndex !== before;
        }, selectedBeforeKeyboard, { timeout: 5_000 });
        await page.keyboard.press('Enter');
        const textareaValue = await page.evaluate(() => document.querySelector('#send_textarea')?.value || '');
        expect(textareaValue.trim().length).toBeGreaterThan(0);
        await expect.poll(() => page.evaluate(() => window.re0AdventureDebug?.().visualNovel.lastChoiceText || '')).toBe(textareaValue);

        const characterCount = await page.locator('#re0-vn-stage [data-re0-character-card]').count();
        expect(characterCount).toBeGreaterThanOrEqual(1);
        await page.locator('#re0-vn-stage [data-re0-character-card]').first().click();
        await expect(page.locator('#re0-character-panel')).toBeVisible();
        await expect(page.locator('#re0-character-panel .re0-character-panel-body')).toContainText(/当前段落|识别台词/);
        await page.locator('#re0-character-panel [data-re0-close-character]').click();
        await expect(page.locator('#re0-character-panel')).toBeHidden();

        await page.locator('#re0-vn-stage [data-re0-vn-toggle-ui]').click();
        await page.waitForFunction(() => document.body.classList.contains('re0-immersive-ui-hidden'), null, { timeout: 5_000 });
        await page.getByText('显示界面', { exact: true }).click();
        await page.waitForFunction(() => !document.body.classList.contains('re0-immersive-ui-hidden'), null, { timeout: 5_000 });

        const stress = await page.evaluate(() => {
            const debug = window.re0AdventureDebug?.();
            const stage = document.querySelector('#re0-vn-stage');
            const dialogueBox = stage?.querySelector('.re0-vn-dialogue-box')?.getBoundingClientRect();
            const topbar = stage?.querySelector('.re0-vn-topbar')?.getBoundingClientRect();
            const missingStageImages = [...stage.querySelectorAll('img')]
                .filter((image) => image.complete && image.naturalWidth === 0)
                .map((image) => image.currentSrc || image.src)
                .slice(0, 8);
            return {
                debug,
                stageHidden: stage?.hidden ?? null,
                currentIndex: debug?.visualNovel?.currentIndex,
                segmentCount: debug?.visualNovel?.segmentCount,
                backlogCount: debug?.visualNovel?.backlogCount,
                currentSpeakerName: debug?.visualNovel?.currentSpeakerName || '',
                currentSegmentType: debug?.visualNovel?.currentSegmentType || '',
                openModal: debug?.visualNovel?.openModal || '',
                openModalCount: debug?.visualNovel?.openModalCount ?? -1,
                openOverlayCount: debug?.visualNovel?.openOverlayCount ?? -1,
                sendNoConnection: document.querySelector('#send_form')?.classList.contains('no-connection') || false,
                bodyImmersive: document.body.classList.contains('re0-immersive-ui-hidden'),
                characterPanelOpen: document.body.classList.contains('re0-character-panel-open'),
                dialogueBox,
                topbar,
                missingStageImages,
                renderedText: window.render_game_to_text?.() || '',
            };
        });

        expect(stress.stageHidden).toBe(false);
        expect(stress.currentIndex).toBeGreaterThanOrEqual(0);
        expect(stress.currentIndex).toBeLessThan(stress.segmentCount);
        expect(stress.backlogCount).toBeGreaterThanOrEqual(0);
        expect(stress.currentSpeakerName.length).toBeGreaterThan(0);
        expect(['dialogue', 'narration']).toContain(stress.currentSegmentType);
        expect(stress.openModal).toBe('none');
        expect(stress.openModalCount).toBe(0);
        expect(stress.openOverlayCount).toBe(0);
        expect(stress.sendNoConnection).toBe(false);
        expect(stress.bodyImmersive).toBe(false);
        expect(stress.characterPanelOpen).toBe(false);
        expect(stress.dialogueBox.width).toBeGreaterThan(320);
        expect(stress.dialogueBox.height).toBeGreaterThan(120);
        expect(stress.topbar.width).toBeGreaterThan(320);
        expect(stress.missingStageImages).toEqual([]);
        const rendered = JSON.parse(stress.renderedText);
        expect(rendered.ok).toBe(true);
        expect(rendered.current.location).toBeTruthy();
        expect(rendered.visualNovel.visible).toBe(true);
    });

    test('keeps the visual-novel UI usable on a narrow mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForFunction(() => {
            const debug = window.re0AdventureDebug?.();
            return debug?.ok && debug?.visualNovel?.visible && debug.visualNovel.segmentCount >= 1;
        }, null, { timeout: 20_000 });

        await page.evaluate(() => window.re0AdventureApplyVnStatePatch?.({
            current: { location: '移动端压力测试街区', viewpoint: '窄屏雨巷' },
            sceneBackdrop: { currentKey: 'rain_bell', reason: 'E2E 移动端压力流' },
            presence: { sceneCharacters: ['莉榭尔·阿尔戈', '米娅', '欧文·卡斯兰', '剥钟人'] },
            gameplay: {
                activeObjective: '移动端压力测试：确认 HUD、角色卡和 VN 舞台不遮挡',
                actionHints: ['点击角色卡', '关闭角色卡', '继续翻页'],
            },
        }));
        await page.waitForTimeout(250);

        const beforePanel = await page.evaluate(() => {
            const rectOf = (selector) => {
                const element = document.querySelector(selector);
                if (!element) return null;
                const rect = element.getBoundingClientRect();
                return {
                    left: rect.left,
                    right: rect.right,
                    top: rect.top,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height,
                };
            };
            const overlapArea = (a, b) => {
                if (!a || !b) return 0;
                const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
                const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
                return width * height;
            };
            const topbar = rectOf('#re0-vn-stage .re0-vn-topbar');
            const dialogue = rectOf('#re0-vn-stage .re0-vn-dialogue-box');
            const topActionButtons = [...document.querySelectorAll('#re0-vn-stage .re0-vn-top-actions button')].map((button) => {
                const rect = button.getBoundingClientRect();
                return { left: rect.left, right: rect.right, top: rect.top, width: rect.width, height: rect.height };
            });
            const topActionRows = [...new Set(topActionButtons.map((button) => Math.round(button.top)))];
            const choices = rectOf('#re0-vn-stage .re0-vn-choices-overlay');
            const hud = rectOf('#re0-adventure-hud');
            const viewport = { width: window.innerWidth, height: window.innerHeight };
            return {
                viewport,
                docScrollWidth: document.documentElement.scrollWidth,
                topbar,
                dialogue,
                topActionButtons,
                topActionRows,
                choices,
                hud,
                topbarDialogueOverlap: overlapArea(topbar, dialogue),
                choicesDialogueOverlap: overlapArea(choices, dialogue),
                missingStageImages: [...document.querySelectorAll('#re0-vn-stage img')]
                    .filter((image) => image.complete && image.naturalWidth === 0)
                    .map((image) => image.currentSrc || image.src),
            };
        });

        expect(beforePanel.docScrollWidth).toBeLessThanOrEqual(beforePanel.viewport.width + 2);
        expect(beforePanel.topbar.left).toBeGreaterThanOrEqual(0);
        expect(beforePanel.topbar.right).toBeLessThanOrEqual(beforePanel.viewport.width + 1);
        expect(beforePanel.dialogue.left).toBeGreaterThanOrEqual(0);
        expect(beforePanel.dialogue.right).toBeLessThanOrEqual(beforePanel.viewport.width + 1);
        expect(beforePanel.dialogue.bottom).toBeLessThanOrEqual(beforePanel.viewport.height + 1);
        expect(beforePanel.topActionRows.length).toBe(1);
        expect(beforePanel.topActionButtons.length).toBeGreaterThanOrEqual(9);
        expect(beforePanel.topActionButtons.every((button) => button.left >= -1 && button.right <= beforePanel.viewport.width + 1 && button.width >= 26 && button.height >= 26)).toBe(true);
        expect(beforePanel.topbarDialogueOverlap).toBe(0);
        expect(beforePanel.choices.bottom).toBeLessThanOrEqual(beforePanel.dialogue.top + 2);
        expect(beforePanel.choices.height).toBeLessThanOrEqual(320);
        expect(beforePanel.choicesDialogueOverlap).toBe(0);
        expect(beforePanel.missingStageImages).toEqual([]);

        await page.locator('#re0-vn-stage [data-re0-character-card]').first().click();
        await expect(page.locator('#re0-character-panel')).toBeVisible();

        const panelOpen = await page.evaluate(() => {
            const panel = document.querySelector('#re0-character-panel')?.getBoundingClientRect();
            const hudStyle = getComputedStyle(document.querySelector('#re0-adventure-hud'));
            return {
                bodyPanelOpen: document.body.classList.contains('re0-character-panel-open'),
                hudDisplay: hudStyle.display,
                panel: panel ? {
                    left: panel.left,
                    right: panel.right,
                    top: panel.top,
                    bottom: panel.bottom,
                    width: panel.width,
                    height: panel.height,
                } : null,
                viewport: { width: window.innerWidth, height: window.innerHeight },
            };
        });

        expect(panelOpen.bodyPanelOpen).toBe(true);
        expect(panelOpen.hudDisplay).toBe('none');
        expect(panelOpen.panel.left).toBeGreaterThanOrEqual(0);
        expect(panelOpen.panel.right).toBeLessThanOrEqual(panelOpen.viewport.width + 1);
        expect(panelOpen.panel.bottom).toBeLessThanOrEqual(panelOpen.viewport.height + 1);

        await page.locator('#re0-character-panel [data-re0-close-character]').click();
        await expect(page.locator('#re0-character-panel')).toBeHidden();
        await page.waitForFunction(() => !document.body.classList.contains('re0-character-panel-open'), null, { timeout: 5_000 });

        const afterPanel = await page.evaluate(() => ({
            hudDisplay: getComputedStyle(document.querySelector('#re0-adventure-hud')).display,
            characterPanelOpen: document.body.classList.contains('re0-character-panel-open'),
            vnVisible: !!document.querySelector('#re0-vn-stage') && !document.querySelector('#re0-vn-stage').hidden,
        }));

        expect(afterPanel.characterPanelOpen).toBe(false);
        expect(afterPanel.hudDisplay).not.toBe('none');
        expect(afterPanel.vnVisible).toBe(true);
    });

    test('keeps character voice text, profile selection, and playback controls consistent', async ({ page }) => {
        const fakeAudio = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
        const ttsRequests = [];
        await page.route('**/api/mimo-tts/generate', async (route) => {
            const body = route.request().postDataJSON();
            ttsRequests.push(body);
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    audio: {
                        format: 'wav',
                        data: fakeAudio,
                    },
                    voice: body.voice,
                    model: body.model,
                }),
            });
        });

        const selections = await page.evaluate(() => ({
            lishelle: window.re0AdventureSelectVoice?.('莉榭尔·阿尔戈：「别让钟声数到第三下。」'),
            otto: window.re0AdventureSelectVoice?.('奥托·苏文：「我只是个商人，真的没想卷进这种事！」'),
            narrator: window.re0AdventureSelectVoice?.('雨水落在石板上，世界像一口废钟。'),
        }));

        expect(selections.lishelle.profileId).toBe('lishelle');
        expect(selections.lishelle.voiceText).toBe('别让钟声数到第三下。');
        expect(selections.otto.profileId).toBe('otto');
        expect(selections.otto.voiceText).toBe('我只是个商人，真的没想卷进这种事！');
        expect(selections.narrator.profileId).toBe('narrator');
        expect(selections.lishelle.voice).not.toBe(selections.otto.voice);
        expect(selections.lishelle.voicePrompt).toContain('只朗读 assistant 消息中的原文');

        await page.waitForFunction(() => window.re0AdventureDebug?.().visualNovel?.visible === true, null, { timeout: 10_000 });
        const voiceButton = page.locator('#re0-vn-stage [data-re0-vn-voice]').first();
        await expect(voiceButton).toBeVisible();
        await voiceButton.click();
        await expect.poll(() => ttsRequests.length, { timeout: 10_000 }).toBe(1);
        expect(ttsRequests[0].model).toBe('mimo-v2.5-tts');
        expect(ttsRequests[0].text.length).toBeGreaterThan(0);
        expect(ttsRequests[0].text).not.toContain('RE0_VN_SCRIPT');
        expect(ttsRequests[0].text).not.toContain('【下一步');
        expect(ttsRequests[0].voicePrompt).toContain('只朗读 assistant 消息中的原文');

        await page.waitForFunction(() => window.re0AdventureAudioDebug?.().hasLastPlayback === true, null, { timeout: 5_000 });
        const afterSpeak = await page.evaluate(() => window.re0AdventureAudioDebug?.());
        expect(afterSpeak.hasCurrentAudio).toBe(true);
        expect(afterSpeak.hasLastPlayback).toBe(true);
        expect(afterSpeak.playerSrc).toContain('data:audio/wav;base64,');
        expect(afterSpeak.currentProfileName.length).toBeGreaterThan(0);
        expect(afterSpeak.lastText).toBe(ttsRequests[0].text);
        expect(afterSpeak.lastVoice).toBe(ttsRequests[0].voice);

        await page.locator('#re0-vn-stage [data-re0-vn-config]').click();
        await expect(page.locator('#re0-vn-stage .re0-vn-config-panel.is-active')).toBeVisible();

        await page.locator('#re0-vn-stage [data-re0-vn-pause-audio]').click();
        await page.waitForFunction(() => window.re0AdventureAudioDebug?.().paused === true, null, { timeout: 5_000 });
        const paused = await page.evaluate(() => window.re0AdventureAudioDebug?.());
        expect(paused.status).toContain('已暂停');

        await page.locator('#re0-vn-stage [data-re0-vn-pause-audio]').click();
        await page.waitForFunction(() => window.re0AdventureAudioDebug?.().paused === false, null, { timeout: 5_000 });
        const resumed = await page.evaluate(() => window.re0AdventureAudioDebug?.());
        expect(resumed.status).toMatch(/继续播放|正在播放/);

        await page.evaluate(() => {
            const player = document.querySelector('#re0-adventure-hud [data-re0-audio-player]');
            if (player) player.currentTime = 3.5;
        });
        await page.locator('#re0-vn-stage [data-re0-vn-replay-audio]').click();
        await page.waitForFunction(() => window.re0AdventureAudioDebug?.().currentTime === 0, null, { timeout: 5_000 });
        const replayed = await page.evaluate(() => window.re0AdventureAudioDebug?.());
        expect(replayed.status).toContain('重放');

        await page.locator('#re0-vn-stage [data-re0-vn-stop-audio]').click();
        await page.waitForFunction(() => {
            const audio = window.re0AdventureAudioDebug?.();
            return audio?.paused === true && audio.currentTime === 0;
        }, null, { timeout: 5_000 });
        const stopped = await page.evaluate(() => window.re0AdventureAudioDebug?.());
        expect(stopped.status).toContain('已停止播放');

        await page.locator('#re0-vn-stage [data-re0-vn-replay-audio]').click();
        await page.waitForFunction(() => window.re0AdventureAudioDebug?.().paused === false, null, { timeout: 5_000 });
        const replayedAfterStop = await page.evaluate(() => window.re0AdventureAudioDebug?.());
        expect(replayedAfterStop.currentProfileName).toBe(replayedAfterStop.lastProfileName);
        expect(replayedAfterStop.status).toContain(replayedAfterStop.lastProfileName);

        await voiceButton.click();
        await page.waitForTimeout(150);
        expect(ttsRequests).toHaveLength(1);
    });

    test('links death return, answer book, worldline failed node, and anchor return into one loop', async ({ page }) => {
        await page.waitForFunction(() => {
            const debug = window.re0AdventureDebug?.();
            return debug?.ok && debug?.hud?.visible;
        }, null, { timeout: 20_000 });

        const afterDeath = await page.evaluate(() => window.re0AdventureDebugTriggerDeath?.('我死了'));
        expect(afterDeath.mode).toBe('answer_book');
        expect(afterDeath.storyMode).toBe('answer');
        expect(afterDeath.answerBook.active).toBe(true);
        expect(afterDeath.answerBook.phase).toBe('summary');
        expect(afterDeath.answerBook.branchId).toMatch(/^D\d+/);
        expect(afterDeath.answerBook.retainedClues.length).toBeGreaterThanOrEqual(1);
        expect(afterDeath.worldline.treeSummary.lastFailedNodeId).toBeTruthy();
        expect(afterDeath.worldline.treeSummary.lastAnswerBookSync.branchId).toBe(afterDeath.answerBook.branchId);
        expect(afterDeath.flags.lastAnswerBookWorldlineSync).toContain(afterDeath.answerBook.branchId);

        const questionResult = await page.evaluate(() => window.re0AdventureDebugAnswerBookQuestion?.('真正杀死我的触发条件是什么？'));
        expect(questionResult.handled).toBe(true);
        expect(questionResult.debug.answerBook.phase).toBe('question');
        expect(questionResult.debug.answerBook.questionUsed).toBe(true);
        expect(questionResult.debug.answerBook.lastQuestion).toContain('触发条件');
        expect(questionResult.debug.worldline.treeSummary.lastAnswerBookSync.lastQuestion).toContain('触发条件');

        const afterReply = await page.evaluate(() => window.re0AdventureDebugAnswerBookReply?.('真正的触发条件不是雨夜本身，而是你在没有证据、同伴和撤离窗口时，把死亡回归当成了说服别人的捷径。下一轮必须先改变接触顺序。'));
        expect(afterReply.answerBook.phase).toBe('spent');
        expect(afterReply.answerBook.lastAnswer).toContain('改变接触顺序');
        expect(afterReply.worldline.treeSummary.lastAnswerBookSync.lastAnswer).toContain('改变接触顺序');
        const highlightedFailedRow = afterReply.worldline.treeSummary.rows.find((row) => row.id === afterReply.worldline.treeSummary.lastFailedNodeId);
        expect(highlightedFailedRow).toBeTruthy();
        expect(highlightedFailedRow.highlighted).toBe(true);
        expect(highlightedFailedRow.retainedClueCount).toBeGreaterThanOrEqual(1);
        expect(highlightedFailedRow.strategyPivot.length).toBeGreaterThan(0);

        const panelAfterReply = await page.locator('#re0-adventure-hud [data-re0-worldline-tree-panel]').textContent();
        expect(panelAfterReply).toContain('答案之书');
        expect(panelAfterReply).toContain('纠偏');

        const returnResult = await page.evaluate(() => window.re0AdventureDebugReturnAnchor?.());
        expect(returnResult.handled).toBe(true);
        expect(returnResult.debug.mode).toBe('main');
        expect(returnResult.debug.storyMode).toBe('mainline');
        expect(returnResult.debug.answerBook.active).toBe(false);
        expect(returnResult.debug.current.location).toContain('王都贫民区');
        expect(returnResult.debug.objective.active).toContain('改变行动方针');
        expect(returnResult.debug.playLoopDirector.mode).toBe('mainline');
        expect(returnResult.debug.playLoopDirector.deathRisk.hasDeathLesson).toBe(true);
        expect(returnResult.debug.playLoopDirector.deathRisk.strategyPivot).toContain('改变');
        expect(returnResult.debug.playLoopDirector.mustInclude.join(' ')).toContain('死亡');
        expect(returnResult.debug.worldline.treeSummary.lastFailedNodeId).toBe(afterReply.worldline.treeSummary.lastFailedNodeId);
        expect(returnResult.debug.worldline.treeSummary.lastAnswerBookSync.phase).toBe('returned');
        expect(returnResult.debug.flags.systemNotice).toContain('答案之书关闭');
        expect(returnResult.debug.flags.awaitingAnchorLessonCarryover).toBe(true);

        const badCarryover = await page.evaluate(() => window.re0AdventureDebugValidateAnchorNarration?.('清晨的王都很安静。我随便往前走，没有再想上一轮发生了什么。'));
        expect(badCarryover.required).toBe(true);
        expect(badCarryover.pass).toBe(false);
        expect(badCarryover.missing.length).toBeGreaterThanOrEqual(1);

        const goodCarryover = await page.evaluate(() => window.re0AdventureDebugValidateAnchorNarration?.('清晨的雨落在王都贫民区。我按住掌心，把痛觉残响和魔女气味当成线索，先改变接触顺序，不再重复上一轮把死亡回归当成捷径的错误；这次先找证据和同伴，保留撤离距离。'));
        expect(goodCarryover.required).toBe(true);
        expect(goodCarryover.pass).toBe(true);
        expect(goodCarryover.hits.clue.length).toBeGreaterThanOrEqual(1);
        expect(goodCarryover.hits.pivot.length).toBeGreaterThanOrEqual(1);
    });

    test('preserves save/load rollback and new-world setup isolation through the merged sidebar workflow', async ({ page }) => {
        await page.waitForFunction(() => {
            const debug = window.re0AdventureDebug?.();
            return debug?.ok && debug?.hud?.visible;
        }, null, { timeout: 20_000 });

        const saveName = `E2E-隔离-${Date.now()}`;
        page.on('dialog', async (dialog) => {
            if (dialog.type() === 'prompt') {
                await dialog.accept(saveName);
                return;
            }
            await dialog.accept();
        });

        await page.evaluate(() => window.re0AdventureApplyVnStatePatch?.({
            current: { location: 'E2E 存档A雨巷', viewpoint: '存档A视角' },
            sceneBackdrop: { currentKey: 'rain_bell', reason: 'E2E 存档A背景' },
            presence: { sceneCharacters: ['莉榭尔·阿尔戈', '米娅'] },
            gameplay: {
                activeObjective: 'E2E 存档A目标：确认读档会恢复目标',
                actionHints: ['保存当前锚点', '制造污染状态', '读取存档'],
            },
            characterCards: {
                '莉榭尔·阿尔戈': {
                    trust: 11,
                    suspicion: 22,
                    memory: ['E2E 存档A：莉榭尔只透露了半句钟声线索。'],
                },
            },
        }));
        await page.waitForFunction(() => window.re0AdventureDebug?.().current?.location === 'E2E 存档A雨巷', null, { timeout: 5_000 });

        await page.locator('#re0-vn-stage [data-re0-vn-save]').click();
        await page.waitForFunction((name) => {
            const debug = window.re0AdventureDebug?.();
            return debug?.saves >= 1 && debug?.flags?.lastSaveReport?.includes(name);
        }, saveName, { timeout: 5_000 });

        const afterSave = await page.evaluate(() => window.re0AdventureDebug?.());
        expect(afterSave.current.location).toBe('E2E 存档A雨巷');
        expect(afterSave.objective.active).toBe('E2E 存档A目标：确认读档会恢复目标');
        expect(afterSave.characterCards.preview['莉榭尔·阿尔戈'].trust).toBe(11);
        expect(afterSave.characterCards.preview['莉榭尔·阿尔戈'].suspicion).toBe(22);

        await page.evaluate(() => window.re0AdventureApplyVnStatePatch?.({
            current: { location: 'E2E 污染后的错误地点', viewpoint: '污染视角' },
            sceneBackdrop: { currentKey: 'loot_house', reason: 'E2E 污染背景' },
            presence: { sceneCharacters: ['剥钟人'] },
            gameplay: {
                activeObjective: 'E2E 污染目标：如果读档失败就会残留',
                actionHints: ['这条提示不应在读档后残留'],
            },
            characterCards: {
                '莉榭尔·阿尔戈': {
                    trust: 88,
                    suspicion: 91,
                    trauma: 77,
                    memory: ['E2E 污染：这条记忆必须被读档回滚。'],
                },
            },
        }));

        const polluted = await page.evaluate(() => window.re0AdventureDebug?.());
        expect(polluted.current.location).toBe('E2E 污染后的错误地点');
        expect(polluted.objective.active).toBe('E2E 污染目标：如果读档失败就会残留');
        expect(polluted.characterCards.preview['莉榭尔·阿尔戈'].trust).toBe(88);

        await page.locator('#re0-vn-stage [data-re0-vn-load]').click();
        const saveRow = page.locator('#re0-vn-stage .re0-vn-save-row', { hasText: saveName }).first();
        await expect(saveRow).toBeVisible();
        await saveRow.locator('[data-re0-vn-load-save]').click();
        await page.waitForFunction(() => window.re0AdventureDebug?.().current?.location === 'E2E 存档A雨巷', null, { timeout: 5_000 });

        const loaded = await page.evaluate(() => window.re0AdventureDebug?.());
        expect(loaded.current.location).toBe('E2E 存档A雨巷');
        expect(loaded.objective.active).toBe('E2E 存档A目标：确认读档会恢复目标');
        expect(loaded.characterCards.preview['莉榭尔·阿尔戈'].trust).toBe(11);
        expect(loaded.characterCards.preview['莉榭尔·阿尔戈'].suspicion).toBe(22);
        expect(loaded.flags.lastRollbackReport).toMatch(/莉榭尔|已回滚|一致/);
        expect(loaded.flags.contextIsolationNotice).toContain('单次存档修改不会污染其他存档或全局设定');

        const loadedSessionId = loaded.flags.worldSessionId;
        await page.locator('#re0-vn-stage [data-re0-vn-new-game]').first().click();
        await page.waitForFunction(() => window.re0AdventureDebug?.().mode === 'setup', null, { timeout: 5_000 });

        const setup = await page.evaluate(() => window.re0AdventureDebug?.());
        expect(setup.mode).toBe('setup');
        expect(setup.saves).toBeGreaterThanOrEqual(1);
        expect(setup.flags.worldSessionId).not.toBe(loadedSessionId);
        expect(setup.flags.contextIsolationNotice).toContain('旧世界');
        expect(setup.current.location).not.toBe('E2E 污染后的错误地点');

        await page.locator('#re0-vn-stage [data-re0-vn-start-world]').first().click();
        await page.waitForFunction(() => window.re0AdventureDebug?.().mode === 'main', null, { timeout: 5_000 });

        const restarted = await page.evaluate(() => window.re0AdventureDebug?.());
        expect(restarted.mode).toBe('main');
        expect(restarted.setup.phase).toBe('locked');
        expect(restarted.settingSetupCanon.doctrine).toContain('不得回落到默认开局或旧世界记忆');
        expect(restarted.flags.lastSetupSync).toContain(restarted.setup.protagonistName || '无名异乡人');
        expect(restarted.saves).toBeGreaterThanOrEqual(1);
        expect(restarted.current.location).not.toBe('E2E 污染后的错误地点');
    });
});
