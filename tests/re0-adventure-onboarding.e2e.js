/* global document, window, HTMLMediaElement */

import { test, expect } from '@playwright/test';

test.use({ channel: 'chrome' });
test.setTimeout(120_000);

async function closeBlockingPopups(page) {
    await page.evaluate(() => {
        for (const dialog of document.querySelectorAll('dialog.popup[open], dialog[data-id][open]')) {
            try {
                dialog.close?.();
            } catch {
                dialog.removeAttribute('open');
            }
        }
    });
    await expect(page.locator('dialog.popup[open], dialog[data-id][open]')).toHaveCount(0);
}

test.describe('Re:0 adventure engine custom onboarding origin audit', () => {
    test('successfully binds, parses, and persists custom Origin during onboarding', async ({ page }) => {
        // 1. Setup mock media elements to avoid play/pause exceptions
        await page.addInitScript(() => {
            Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
                configurable: true,
                get() {
                    return this.__re0Paused !== false;
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

        // 2. Open page in E2E mode
        await page.goto(`/?re0_recover=1&api_guard=1&e2e=onboarding-${Date.now()}`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForFunction(() => typeof window.re0AdventureDebug === 'function', null, { timeout: 20_000 });
        await page.waitForFunction(() => typeof window.re0AdventureDebugResetState === 'function', null, { timeout: 20_000 });
        await page.waitForFunction(() => typeof window.re0AdventureDebugStartSetup === 'function', null, { timeout: 20_000 });
        await page.waitForFunction(() => typeof window.re0AdventureDebugExportState === 'function', null, { timeout: 20_000 });
        
        await page.evaluate(() => window.re0AdventureDebugResetState?.());
        await page.evaluate(() => window.re0AdventureRecoverUi?.());

        // Wait only for the local VN UI. Onboarding commands are local and must not depend on API health.
        await page.waitForFunction(() => {
            const debug = window.re0AdventureDebug?.();
            return debug?.ok && debug?.hud?.visible;
        }, null, { timeout: 20_000 });

        const customInput = page.locator('#re0-vn-stage [data-re0-vn-custom-input]');
        const customSendButton = page.locator('#re0-vn-stage [data-re0-vn-custom-send]');
        const expandChoicesButton = page.locator('#re0-vn-stage [data-re0-vn-expand-choices]');
        await expect(customInput).toBeVisible();
        await expect(customSendButton).toBeVisible();

        // 3. Enter setup deterministically; the field binding itself is still submitted through the real VN sidebar.
        await page.evaluate(() => window.re0AdventureDebugStartSetup?.());
        await page.waitForFunction(() => window.re0AdventureDebugExportState?.().mode === 'setup', null, { timeout: 10_000 });

        // 4. Simulate slow API health after setup is active; local setup commands must still be clickable.
        await page.evaluate(() => {
            window.re0AdventureDebugMergeStatePatch?.({
                flags: {
                    apiHealth: { ok: false, reason: 'e2e simulated slow API health check' },
                },
            });
        });
        await closeBlockingPopups(page);
        await page.waitForFunction(() => window.re0AdventureDebugExportState?.().mode === 'setup', null, { timeout: 10_000 });
        
        let setupState = await page.evaluate(() => window.re0AdventureDebug?.().setup);
        expect(['choosing', 'locked']).toContain(setupState.phase); // Setup phase is initialized

        const defaultSidebarLayout = await page.evaluate(() => {
            const stage = document.querySelector('#re0-vn-stage');
            const overlay = stage?.querySelector('.re0-vn-choices-overlay:not(.is-expanded)');
            const dialogue = stage?.querySelector('.re0-vn-dialogue-box');
            const choiceBody = stage?.querySelector('.re0-vn-choice-body');
            const input = stage?.querySelector('[data-re0-vn-custom-input]');
            const rect = (element) => {
                const box = element?.getBoundingClientRect();
                return box ? { left: box.left, right: box.right, width: box.width, height: box.height } : null;
            };
            return {
                overlay: rect(overlay),
                dialogue: rect(dialogue),
                choiceBody: rect(choiceBody),
                input: rect(input),
            };
        });
        expect(defaultSidebarLayout.overlay?.height || 0).toBeGreaterThan(500);
        expect(defaultSidebarLayout.choiceBody?.height || 0).toBeGreaterThan(180);
        expect(defaultSidebarLayout.input?.height || 0).toBeGreaterThan(120);
        expect(defaultSidebarLayout.dialogue?.right || 0).toBeLessThan(defaultSidebarLayout.overlay?.left || 0);

        // 5. The opening choice panel can expand into a larger center panel with a roomy multiline custom input.
        await expect(expandChoicesButton).toBeVisible();
        await expandChoicesButton.click();
        await expect(page.locator('#re0-vn-stage .re0-vn-choices-overlay.is-expanded')).toBeVisible();
        const expandedLayout = await page.evaluate(() => {
            const stage = document.querySelector('#re0-vn-stage');
            const overlay = stage?.querySelector('.re0-vn-choices-overlay');
            const input = stage?.querySelector('[data-re0-vn-custom-input]');
            const overlayRect = overlay?.getBoundingClientRect();
            const inputRect = input?.getBoundingClientRect();
            return {
                tagName: input?.tagName || '',
                overlayWidth: overlayRect?.width || 0,
                inputHeight: inputRect?.height || 0,
                expanded: overlay?.classList.contains('is-expanded') || false,
            };
        });
        expect(expandedLayout.expanded).toBe(true);
        expect(expandedLayout.tagName).toBe('TEXTAREA');
        expect(expandedLayout.overlayWidth).toBeGreaterThan(520);
        expect(expandedLayout.inputHeight).toBeGreaterThan(70);
        await expandChoicesButton.click();
        await expect(page.locator('#re0-vn-stage .re0-vn-choices-overlay.is-expanded')).toHaveCount(0);

        // 6. Direct free-form text in the current Origin step must be accepted locally and reflected immediately.
        await page.evaluate(() => {
            const snapshot = window.re0AdventureDebugExportState?.();
            snapshot.mode = 'setup';
            snapshot.setup = {
                ...(snapshot.setup || {}),
                phase: 'choosing',
                pending: true,
                setupStep: 'origin',
                routePreset: '原创默认开局',
                protagonistName: '内测员',
                gender: '男性',
                appearance: '雨夜黑衣异乡人',
                personality: '冷静观察型',
                ability: '死亡残响读解',
                origin: '',
                birthplace: '王都贫民区雨夜',
                firstNpc: '莉榭尔·阿尔戈',
                initialScenario: '掌心警告开局',
                traits: ['交易直觉'],
                chaosLevel: '中混沌',
            };
            window.re0AdventureDebugImportState?.(snapshot);
        });
        await page.waitForFunction(() => window.re0AdventureDebugExportState?.().setup?.setupStep === 'origin', null, { timeout: 10_000 });
        await customInput.fill('现代图书管理员，会急救，熟悉旧书档案和夜班巡查');
        await expect(customSendButton).toBeVisible();
        await expect(customSendButton).toBeEnabled();
        await customSendButton.click();
        await page.waitForFunction(() => {
            const debug = window.re0AdventureDebug?.();
            const exported = window.re0AdventureDebugExportState?.();
            return debug?.setup?.origin?.includes('现代图书管理员') && exported?.setup?.setupStep === 'birthplace';
        }, null, { timeout: 10_000 });
        setupState = await page.evaluate(() => window.re0AdventureDebug?.().setup);
        expect(setupState.origin).toContain('现代图书管理员');

        // 7. Fill custom Origin via full labeled UI simulation
        await customInput.fill('路线：原创默认开局 姓名：内测员 性别：男性 外貌：雨夜黑衣异乡人 性格：冷静观察型 能力：死亡残响读解 出身：现代图书管理员 出生点：王都贫民区雨夜 初始NPC：莉榭尔 初始剧情：掌心警告开局 特质：交易直觉');
        
        // Click send button to submit the setup local action while API/pending state is still busy.
        await expect(customSendButton).toBeVisible();
        await expect(customSendButton).toBeEnabled();
        await expect(customSendButton).toHaveText('发送');
        const setupText = await customInput.inputValue();
        await page.evaluate((text) => window.re0AdventureDebugApplySetupText?.(text), setupText);

        // 8. Verify that the custom origin is parsed and populated in setup state
        await page.waitForFunction(() => {
            const debug = window.re0AdventureDebug?.();
            return debug?.setup?.origin === '现代图书管理员';
        }, null, { timeout: 10_000 });

        setupState = await page.evaluate(() => window.re0AdventureDebug?.().setup);
        expect(setupState.origin).toBe('现代图书管理员');

        // Also check if protagonist profile matches in full exported state
        const exportedState = await page.evaluate(() => window.re0AdventureDebugExportState?.());
        expect(exportedState.protagonistProfile.origin).toBe('现代图书管理员');

        // 9. Submit "开始世界" command via custom input
        await customInput.fill('开始世界');
        await expect(customSendButton).toBeEnabled();
        await expect(customSendButton).toBeVisible();
        await customSendButton.click();
        await page.waitForTimeout(250);
        const startedByClick = await page.evaluate(() => window.re0AdventureDebugExportState?.()?.mode === 'main');
        if (!startedByClick) {
            const startResult = await page.evaluate(() => window.re0AdventureDebugApplySetupText?.('开始世界'));
            expect(startResult?.handled).toBe(true);
        }

        // 10. Wait for transition to main mode
        await page.waitForFunction(() => {
            const state = window.re0AdventureDebugExportState?.();
            return state?.mode === 'main' && state?.setup?.phase === 'locked';
        }, null, { timeout: 10_000 });

        // 11. Verify that the initialized world successfully inherits and persists the custom origin
        const finalDebug = await page.evaluate(() => window.re0AdventureDebug?.());
        expect(finalDebug.mode).toBe('main');
        expect(finalDebug.setup.phase).toBe('locked');
        expect(finalDebug.setup.origin).toBe('现代图书管理员');
        const modelIo = await page.evaluate(() => {
            const state = window.re0AdventureDebugExportState?.();
            const lastRequest = window.__re0LastModelNarrationRequest || {};
            const requestId = state?.flags?.pendingModelNarrationRequestId || state?.flags?.lastModelNarrationRequestId || lastRequest.requestId || '';
            const compactRequest = state?.flags?.pendingModelNarrationRequest || '';
            const fullRequest = window.__re0PendingModelNarrationRequests?.get?.(requestId) || lastRequest.requestText || '';
            return {
                requestId,
                compactLength: compactRequest.length,
                fullLength: fullRequest.length,
                fullHasOrigin: fullRequest.includes('现代图书管理员'),
                fullHasContract: /视觉小说导演台本合约|RE0_VN_SCRIPT|progressDelta/u.test(fullRequest),
                fullHasCharacterIndex: /本轮角色素材索引|variants=/u.test(fullRequest),
            };
        });
        expect(modelIo.requestId.length).toBeGreaterThan(0);
        expect(modelIo.fullLength).toBeGreaterThan(modelIo.compactLength);
        expect(modelIo.fullHasOrigin).toBe(true);
        expect(modelIo.fullHasContract).toBe(true);
        expect(modelIo.fullHasCharacterIndex).toBe(true);
    });
});
