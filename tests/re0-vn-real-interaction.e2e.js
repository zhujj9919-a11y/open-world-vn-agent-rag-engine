/* global document, window, HTMLMediaElement */

import { test, expect } from '@playwright/test';

test.use({ channel: 'chrome' });
test.setTimeout(90_000);

async function boot(page) {
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
    await page.goto(`/?e2e=real_interaction_${Date.now()}&api_guard=1`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => typeof window.re0AdventureDebug === 'function', null, { timeout: 20_000 });
    await page.waitForFunction(() => typeof window.re0AdventureDebugResetState === 'function', null, { timeout: 20_000 });
    await page.evaluate(() => window.re0AdventureDebugResetState?.());
    await page.waitForFunction(() => document.querySelector('#re0-vn-stage [data-re0-vn-next]'), null, { timeout: 20_000 });
}

async function seedPerformanceScript(page) {
    await page.evaluate(() => {
        const snapshot = window.re0AdventureDebugExportState?.();
        if (!snapshot) {
            throw new Error('Missing Re:0 debug export state hook');
        }
        const now = new Date().toISOString();
        const segments = [
            { id: 'perf:0', type: 'narration', speakerId: 'narrator', speakerName: '世界意志', text: '雨水从废弃钟楼的檐角落下，主角停在石阶前，没有跨过那条血水线。', sourceMessageId: 999001, queuedAt: now },
            { id: 'perf:1', type: 'dialogue', speakerId: 'lishelle', speakerName: '莉榭尔·阿尔戈', text: '先别碰门。钟声第三下之前，门后的东西会听见你的呼吸。', action: '抬起黑伞挡住雨线', expression: 'guarded', pose: 'doorway_invitation', sourceMessageId: 999001, queuedAt: now },
            { id: 'perf:2', type: 'narration', speakerId: 'narrator', speakerName: '世界意志', text: '你把脚尖后撤半寸，血水没有追上来，只在石缝里慢慢变黑。', sourceMessageId: 999001, queuedAt: now },
            { id: 'perf:3', type: 'dialogue', speakerId: 'mia', speakerName: '米娅', text: '修女姐姐，里面有人在哭，可我刚才看见窗户是空的。', action: '躲到莉榭尔身后', expression: 'anxious', sourceMessageId: 999001, queuedAt: now },
            { id: 'perf:4', type: 'narration', speakerId: 'narrator', speakerName: '世界意志', text: '这一句让候选行动收紧到证据、撤离距离和谁先进门三个问题上。', sourceMessageId: 999001, queuedAt: now },
            { id: 'perf:5', type: 'dialogue', speakerId: 'lishelle', speakerName: '莉榭尔·阿尔戈', text: '如果你想活过这一夜，就先证明自己听懂了“不要重复”的意思。', action: '压低声音', expression: 'cold', sourceMessageId: 999001, queuedAt: now },
        ];
        snapshot.mode = 'main';
        snapshot.current = {
            ...(snapshot.current || {}),
            day: 1,
            time: '深夜',
            location: '王都贫民区 / 废弃钟楼外',
            viewpoint: '真实交互性能探针',
        };
        snapshot.gameplay = {
            ...(snapshot.gameplay || {}),
            activeObjective: '围绕废弃钟楼门前的血水、钟声和莉榭尔的警告，确认第一处可验证证据。',
            objectiveStage: '真实交互性能探针',
            actionHints: [
                '先固定血水流向和钟声时间，不碰门。',
                '请莉榭尔给出一个可验证细节，再决定是否跟随。',
                '让米娅描述窗户里看见的空白，不让她靠近门。',
            ],
        };
        snapshot.flags = {
            ...(snapshot.flags || {}),
            awaitingModelNarration: false,
            pendingModelNarrationSource: '',
            pendingModelNarrationRequest: '',
            pendingModelNarrationRequestId: '',
            ignoreChatBeforeMessageId: 999000,
            lastLongplayProbe: 'vn-real-interaction-performance-probe',
            debugVnLockUntil: Date.now() + 60_000,
        };
        snapshot.visuals = {
            ...(snapshot.visuals || {}),
            sceneBackdrop: {
                ...(snapshot.visuals?.sceneBackdrop || {}),
                mode: 'adaptive',
                currentKey: 'rain_bell',
                lastAutoKey: 'rain_bell',
                imageUrl: '',
            },
            visualNovel: {
                ...(snapshot.visuals?.visualNovel || {}),
                currentIndex: 0,
                segments,
                choices: [
                    '先固定血水流向和钟声时间，不碰门。',
                    '请莉榭尔给出一个可验证细节，再决定是否跟随。',
                    '让米娅描述窗户里看见的空白，不让她靠近门。',
                ],
                autoPlay: false,
                skipMode: false,
                castIds: ['lishelle', 'mia'],
                backgroundKey: 'rain_bell',
                scriptSource: 'perf-probe',
                sourceMode: 'perf-probe',
                queueMode: 'append',
                queueLength: segments.length,
                pendingSend: {
                    active: false,
                    text: '',
                    startedAt: '',
                    startedChatLength: 0,
                    status: 'idle',
                    lastRecoveredAt: '',
                },
                lastMessageId: 999001,
                roleMetrics: {
                    directSpeakerCount: 2,
                    directSpeakerNames: ['莉榭尔·阿尔戈', '米娅'],
                    dialogueSegments: 3,
                    narrationSegments: 3,
                    narratorShare: 0.5,
                    roleDrivenPass: true,
                    summary: '通过：性能探针直接发声。',
                    lastUpdatedAt: now,
                },
            },
        };
        window.re0AdventureDebugImportState?.(snapshot);
    });
    await page.waitForFunction(() => {
        const stage = document.querySelector('#re0-vn-stage');
        return stage?.querySelector('[data-re0-vn-progress-text]')?.textContent?.trim() === '1/6'
            && stage?.querySelector('[data-re0-vn-next]');
    }, null, { timeout: 10_000 });
    await page.waitForFunction(() => {
        const stage = document.querySelector('#re0-vn-stage');
        const event = window.__re0VnPerf?.lastEvent || null;
        const lastAt = Date.parse(event?.at || '');
        return stage?.querySelector('[data-re0-vn-progress-text]')?.textContent?.trim() === '1/6'
            && Number(stage?.dataset?.re0VnCurrentIndex ?? -1) === 0
            && Number(stage?.dataset?.re0VnSegmentCount ?? 0) === 6
            && (event?.name === 'stage-full-render' || event?.name === 'stage-full-render-skip')
            && Number.isFinite(lastAt)
            && Date.now() - lastAt >= 800;
    }, null, { timeout: 15_000 });
    await page.evaluate(() => {
        window.__re0VnPerf = {
            version: 'vn-perf/v1',
            totalEvents: 0,
            lightweightAdvanceCount: 0,
            stageFullRenderCount: 0,
            deferredRenderCount: 0,
            draftInputCount: 0,
            draftSaveCount: 0,
            lightweightVisualPatchCount: 0,
            deferredRenderSkippedCount: 0,
            redundantFullRenderSkipCount: 0,
            lastEvents: [],
        };
    });
}

async function cursorSnapshot(page) {
    return page.evaluate(() => {
        const stage = document.querySelector('#re0-vn-stage');
        const button = stage?.querySelector('[data-re0-vn-next]');
        return {
            index: Number(stage?.dataset?.re0VnCurrentIndex ?? -1),
            count: Number(stage?.dataset?.re0VnSegmentCount ?? stage?.dataset?.re0VnQueueLength ?? 0),
            boundary: button?.dataset?.re0VnBoundary === 'true',
            text: stage?.querySelector('[data-re0-vn-dialogue-text], .re0-vn-dialogue-text')?.textContent?.trim() || '',
        };
    });
}

async function snapshot(page) {
    return page.evaluate(() => {
        const debug = window.re0AdventureDebug?.() || {};
        const stage = document.querySelector('#re0-vn-stage');
        const choices = [...document.querySelectorAll('#re0-vn-stage [data-re0-vn-choice]')].map((button) => ({
            text: button.getAttribute('data-re0-vn-choice') || '',
            label: button.textContent?.trim() || '',
            meta: button.querySelector('.re0-choice-meta, .re0-vn-choice-meta')?.textContent?.trim() || '',
        }));
        return {
            progress: stage?.querySelector('[data-re0-vn-progress-text]')?.textContent?.trim() || '',
            text: stage?.querySelector('[data-re0-vn-dialogue-text], .re0-vn-dialogue-text')?.textContent?.trim() || '',
            input: stage?.querySelector('[data-re0-vn-custom-input]')?.value || '',
            sendExists: !!stage?.querySelector('[data-re0-vn-custom-send], [data-re0-vn-send-custom]'),
            sendDisabled: !!stage?.querySelector('[data-re0-vn-custom-send], [data-re0-vn-send-custom]')?.disabled,
            nextDisabled: !!stage?.querySelector('[data-re0-vn-next]')?.disabled,
            currentIndex: Number(debug?.visualNovel?.currentIndex ?? -1),
            queueLength: Number(debug?.visualNovel?.segmentCount ?? debug?.visualNovel?.queueLength ?? 0),
            pending: debug?.visualNovel?.pendingSend || null,
            performance: debug?.visualNovel?.performance || window.__re0VnPerf || null,
            choices,
        };
    });
}

test('real VN click flow keeps executable choices clean and does not jump queued text on send', async ({ page }) => {
    await boot(page);
    await seedPerformanceScript(page);
    await page.waitForTimeout(200);

    const perfBeforeClicks = await page.evaluate(() => window.__re0VnPerf || {});
    const clickTimes = [];
    for (let index = 0; index < 6; index += 1) {
        const nextButton = page.locator('#re0-vn-stage [data-re0-vn-next]');
        if (!await nextButton.isEnabled()) {
            break;
        }
        const before = await cursorSnapshot(page);
        if (before.boundary || before.index >= before.count - 1) {
            break;
        }
        const start = Date.now();
        await nextButton.click();
        await page.waitForFunction((indexBefore) => (
            Number(document.querySelector('#re0-vn-stage')?.dataset?.re0VnCurrentIndex ?? -1)
        ) > indexBefore, before.index, { timeout: 5_000 });
        clickTimes.push(Date.now() - start);
        await page.waitForTimeout(120);
    }

    const beforeChoice = await snapshot(page);
    expect(beforeChoice.progress).toMatch(/^\d+\/\d+$/);
    expect(beforeChoice.text.length).toBeGreaterThan(0);
    expect(beforeChoice.choices.length).toBeGreaterThan(0);
    expect(clickTimes.length).toBeGreaterThan(0);
    expect(clickTimes.every((value) => value < 1200), `VN next click latency ms: ${JSON.stringify(clickTimes)}`).toBe(true);
    expect((beforeChoice.performance?.lightweightAdvanceCount || 0)).toBeGreaterThan(perfBeforeClicks.lightweightAdvanceCount || 0);
    expect(
        (beforeChoice.performance?.stageFullRenderCount || 0) - (perfBeforeClicks.stageFullRenderCount || 0),
        `VN full render count changed during next-click flow: before=${JSON.stringify(perfBeforeClicks)} after=${JSON.stringify(beforeChoice.performance)}`,
    ).toBeLessThanOrEqual(2);

    const badChoices = beforeChoice.choices.filter((choice) => /\.{3}|…|已截断/u.test(choice.text));
    expect(badChoices).toEqual([]);

    const input = page.locator('#re0-vn-stage [data-re0-vn-custom-input]');
    const perfBeforeTyping = await page.evaluate(() => window.__re0VnPerf || {});
    await input.fill('');
    await input.focus();
    await page.keyboard.type('我先退半步观察脚边的血迹和莉榭尔的视线。', { delay: 3 });
    const perfImmediatelyAfterTyping = await page.evaluate(() => window.__re0VnPerf || {});
    expect((perfImmediatelyAfterTyping.draftInputCount || 0)).toBeGreaterThan(perfBeforeTyping.draftInputCount || 0);
    expect(
        (perfImmediatelyAfterTyping.draftSaveCount || 0) - (perfBeforeTyping.draftSaveCount || 0),
        `Draft save should be debounced while typing: before=${JSON.stringify(perfBeforeTyping)} after=${JSON.stringify(perfImmediatelyAfterTyping)}`,
    ).toBeLessThanOrEqual(1);
    await page.waitForTimeout(900);
    const perfAfterDraftDebounce = await page.evaluate(() => window.__re0VnPerf || {});
    expect((perfAfterDraftDebounce.draftSaveCount || 0)).toBeGreaterThanOrEqual(perfImmediatelyAfterTyping.draftSaveCount || 0);

    await page.locator('#re0-vn-stage [data-re0-vn-choice]').nth(Math.min(2, beforeChoice.choices.length - 1)).click();
    await page.waitForTimeout(200);
    const afterChoice = await snapshot(page);
    expect(afterChoice.input.length).toBeGreaterThan(0);
    expect(afterChoice.input).not.toMatch(/\.{3}|…|已截断/u);
    expect(afterChoice.sendExists).toBe(true);
    expect(afterChoice.sendDisabled).toBe(false);

    const beforeSend = await snapshot(page);
    await page.locator('#re0-vn-stage [data-re0-vn-custom-send], #re0-vn-stage [data-re0-vn-send-custom]').click();
    await page.waitForTimeout(500);
    const afterSend = await snapshot(page);

    expect(afterSend.currentIndex).toBe(beforeSend.currentIndex);
    expect(afterSend.queueLength).toBeGreaterThanOrEqual(beforeSend.queueLength);
    expect(afterSend.progress).toBe(beforeSend.progress);
});
