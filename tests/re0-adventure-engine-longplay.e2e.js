/* global document, window, HTMLMediaElement */

import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test.use({ channel: 'chrome' });
test.setTimeout(420_000);

const storylineDefaults = JSON.parse(readFileSync(new URL('../public/scripts/extensions/third-party/re0-adventure-engine/data/storyline-defaults.json', import.meta.url), 'utf8'));
const longplaySnapshotDir = fileURLToPath(new URL('../data/default-user/re0-engine/e2e-snapshots/longplay/', import.meta.url));
mkdirSync(longplaySnapshotDir, { recursive: true });
const storylineKeyIds = storylineDefaults.keys.map((key) => key.id);
const storylineFlagIds = storylineDefaults.deathFlags.map((flag) => flag.id);
const bannedStageBackdropUrls = [
    /\/assets\/generated\/scenes-extra\/arc01_bell_tower_interior\.png(?:$|\?)/u,
    /\/assets\/generated\/scenes-extra\/arc09_gusteko_cold_source\.png(?:$|\?)/u,
    /\/assets\/generated\/scenes-extra\/arc09_gusteko_church\.png(?:$|\?)/u,
    /\/assets\/generated\/scenes-extra\/arc09_snowfield_bell\.png(?:$|\?)/u,
    /\/assets\/generated\/scenes-extra\/arc10_capital_bell_tower_night\.png(?:$|\?)/u,
    /\/assets\/generated\/scenes-extra\/arc10_capital_finale_plaza\.png(?:$|\?)/u,
    /\/assets\/generated\/scenes-extra\/arc11_dawn_after_witch\.png(?:$|\?)/u,
    /\/assets\/generated\/scenes-extra\/cross_kararagi_road\.png(?:$|\?)/u,
    /\/assets\/generated\/scenes-extra\/cross_great_waterfall_edge\.png(?:$|\?)/u,
];

async function bootRe0(page) {
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
    const waitForDebugHooks = async () => {
        await page.waitForLoadState('domcontentloaded');
        await page.waitForFunction(() => document.readyState !== 'loading', null, { timeout: 20_000 });
        await page.waitForFunction(() => typeof window.re0AdventureDebug === 'function', null, { timeout: 40_000 });
        await page.waitForFunction(() => typeof window.re0AdventureApplyVnStatePatch === 'function', null, { timeout: 40_000 });
        await page.waitForFunction(() => typeof window.re0AdventureDebugTriggerDeath === 'function', null, { timeout: 40_000 });
        await page.waitForFunction(() => typeof window.re0AdventureDebugResetState === 'function', null, { timeout: 40_000 });
    };
    let booted = false;
    let lastBootError = null;
    for (let attempt = 0; attempt < 3 && !booted; attempt += 1) {
        try {
            await page.goto(`/?re0_recover=1&api_guard=1&e2e=${Date.now()}&boot=${attempt}`, { waitUntil: 'domcontentloaded' });
            await waitForDebugHooks();
            booted = true;
        } catch (error) {
            lastBootError = error;
            await page.waitForTimeout(1200);
        }
    }
    if (!booted) {
        throw lastBootError;
    }
    await page.evaluate(() => window.re0AdventureDebugResetState?.());
    await page.evaluate(() => window.re0AdventureRecoverUi?.());
    await page.waitForFunction(() => window.re0AdventureDebug?.().ok === true, null, { timeout: 20_000 });
}

async function applyArcProbe(page, probe) {
    const patch = {
        current: {
            day: probe.day,
            time: probe.time,
            location: probe.location,
            viewpoint: probe.viewpoint,
        },
        presence: {
            sceneCharacters: probe.sceneCharacters,
            areaCharacters: probe.areaCharacters || [],
        },
        gameplay: {
            activeObjective: probe.objective,
            objectiveStage: probe.stage,
            actionHints: probe.actionHints,
            openQuestions: probe.openQuestions,
            failurePressure: probe.failurePressure,
        },
        discoveredClues: probe.clues,
    };
    await expect.poll(async () => {
        return page.evaluate(({ item, expected }) => {
            const result = window.re0AdventureApplyVnStatePatch?.(item) || null;
            const debug = window.re0AdventureDebug?.();
            return {
                result,
                location: debug?.current?.location || '',
                mode: debug?.mode || '',
                choiceOverlaySource: debug?.visualNovel?.choiceOverlaySource || '',
                lastPatch: debug?.flags?.lastVnStatePatch || '',
                expected,
            };
        }, { item: patch, expected: probe.location });
    }, {
        timeout: 16_000,
        message: `VN state probe should apply location: ${probe.location}`,
    }).toMatchObject({
        location: probe.location,
        mode: 'main',
        choiceOverlaySource: 'if-branch-rule',
    });
}

async function snapshotBranchState(page) {
    return page.evaluate(() => {
        const debug = window.re0AdventureDebug?.();
        const domChoices = [...document.querySelectorAll('#re0-vn-stage [data-re0-vn-choice]')].map((button) => ({
            text: button.getAttribute('data-re0-vn-choice') || '',
            source: button.getAttribute('data-re0-choice-source') || '',
            type: button.getAttribute('data-re0-choice-type') || '',
            impactLabel: button.getAttribute('data-re0-choice-impact-label') || '',
            impactLogic: button.getAttribute('data-re0-choice-impact-logic') || '',
        }));
        return {
            metadata: debug?.ifRouteLogic?.branchRuleMetadata || {},
            relevant: debug?.ifRouteLogic?.relevantBranchRules || [],
            vn: debug?.visualNovel || {},
            worldline: debug?.worldline || {},
            answerBook: debug?.answerBook || {},
            playLoop: debug?.playLoopDirector || {},
            domChoices,
        };
    });
}

function structuredVnProbeText(probe) {
    const payload = {
        version: 'vn5',
        backgroundKey: probe.backgroundKey,
        castIds: probe.castIds,
        segments: probe.segments,
        choices: probe.choices,
    };
    return `${probe.visibleText || ''}\n<!-- RE0_VN_SCRIPT ${JSON.stringify(payload)} -->`;
}

async function mergeLongplayProbe(page, probe, index) {
    const keyPatch = Object.fromEntries((probe.keys || []).map((id) => [id, true]));
    const flagPatch = Object.fromEntries((probe.flags || []).map((id) => [id, true]));
    const patch = {
        current: {
            day: probe.day,
            time: probe.time,
            location: probe.location,
            viewpoint: probe.viewpoint || '玩家',
        },
        narrativeMode: { current: probe.storyMode || 'mainline' },
        worldline: {
            id: probe.worldlineId,
            attractor: probe.attractor,
            divergence: probe.divergence,
            stability: probe.stability ?? Math.max(0.1, 1 - probe.divergence * 0.62),
            lastShift: probe.shift,
        },
        worldClock: {
            worldDay: probe.day,
            turnsPerWorldDay: 30,
            turnsSinceWorldDay: probe.worldClockTurns ?? (probe.storyMode === 'mainline' ? 4 : 0),
            turnsSinceMainlinePulse: probe.storyMode === 'mainline' ? 1 : 0,
            history: [`长线内测推进至 ${probe.stage}`],
        },
        storyFlow: {
            clocks: [{
                id: `arc-${String(probe.arc).padStart(2, '0')}`,
                name: probe.clockName || probe.stage,
                status: probe.arc >= 11 ? 'finale' : 'active',
                pressure: probe.arc >= 11 ? 96 : Math.min(92, 38 + probe.arc * 5),
            }],
            mainlineNoticeLog: [`${probe.stage}: ${probe.shift}`],
        },
        gameplay: {
            activeObjective: probe.objective,
            objectiveStage: probe.stage,
            actionHints: probe.choices,
            openQuestions: probe.openQuestions,
            failurePressure: probe.failurePressure,
            lastOutcome: probe.visibleText,
        },
        keyInventory: keyPatch,
        flagTrigger: flagPatch,
        tendencyCounter: probe.tendencyCounter,
        discoveredClues: probe.clues,
        worldScope: {
            activeRumors: [{
                region: probe.region || probe.location,
                channel: 'longplay-e2e',
                text: `${probe.stage} 的远方回声已进入主视角可调查层。`,
            }],
        },
        flags: {
            lastSceneCharacters: probe.sceneNames,
            lastScenePresenceDay: probe.day,
            lastScenePresenceLocation: probe.location,
            lastLongplayProbe: probe.stage,
        },
        debugNarrativeText: structuredVnProbeText(probe),
        debugMessageId: Date.now() + index,
    };

    const expectedBackdrops = probe.expectedBackdropKeys || [probe.expectedBackdropKey || probe.backgroundKey];
    await page.evaluate((payload) => {
        window.re0AdventureDebugMergeStatePatch?.(payload.patch);
        window.re0AdventureRecoverUi?.();
    }, { patch });
    await expect.poll(async () => {
        const value = await page.evaluate((payload) => {
        window.re0AdventureRecoverUi?.();
        const debug = window.re0AdventureDebug?.();
        const backdropKey = debug?.backdrop?.key || '';
        const stage = document.querySelector('#re0-vn-stage');
        const stageBackdropKey = stage?.dataset?.re0VnBackdropKey || '';
        const stageCastIds = (stage?.dataset?.re0VnCastIds || '').split(',').filter(Boolean);
        const debugCastIds = Array.isArray(debug?.visualNovel?.castIds) ? debug.visualNovel.castIds : [];
        const acceptedCastIds = [...new Set([...stageCastIds, ...debugCastIds])];
        const requiredCastIds = payload.expected.castIds.slice(0, Math.min(3, payload.expected.castIds.length));
        return {
            hasHook: typeof window.re0AdventureDebugMergeStatePatch === 'function',
            resultMode: debug?.mode || '',
            day: debug?.current?.day || 0,
            location: debug?.current?.location || '',
            stage: debug?.objective?.stage || '',
            backdropKey,
            backdropAccepted: payload.expectedBackdrops.includes(backdropKey),
            stageBackdropKey,
            stageBackdropAccepted: payload.expectedBackdrops.includes(stageBackdropKey),
            stageCastAccepted: requiredCastIds.every((id) => acceptedCastIds.includes(id)),
            castIds: debugCastIds,
            choiceCount: debug?.visualNovel?.choiceOverlayChoices?.length || 0,
            mode: debug?.visualNovel?.storyMode || '',
        };
        }, { patch, expected: probe, expectedBackdrops });
        return value;
    }, {
        timeout: 20_000,
        message: `longplay probe should apply: ${probe.stage}`,
    }).toMatchObject({
        hasHook: true,
        day: probe.day,
        location: probe.location,
        stage: probe.stage,
        backdropAccepted: true,
        stageBackdropAccepted: true,
        stageCastAccepted: true,
    });
}

async function visualLongplaySnapshot(page) {
    return page.evaluate(() => {
        const stage = document.querySelector('#re0-vn-stage');
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
            const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
            const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            return Math.round(x * y);
        };
        const choices = [...document.querySelectorAll('#re0-vn-stage [data-re0-vn-choice]')].map((button) => ({
            text: button.getAttribute('data-re0-vn-choice') || button.textContent?.trim() || '',
            source: button.getAttribute('data-re0-choice-source') || '',
            type: button.getAttribute('data-re0-choice-type') || '',
            impactLabel: button.getAttribute('data-re0-choice-impact-label') || '',
            impactLogic: button.getAttribute('data-re0-choice-impact-logic') || '',
            scrollOverflowX: Math.max(0, button.scrollWidth - button.clientWidth),
            scrollOverflowY: Math.max(0, button.scrollHeight - button.clientHeight),
        }));
        const characterRects = [...document.querySelectorAll('#re0-vn-stage .re0-vn-character')].map((element) => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
        });
        const characterAssets = [...document.querySelectorAll('#re0-vn-stage .re0-vn-character')].map((element) => {
            const image = element.querySelector('img');
            const rect = element.getBoundingClientRect();
            return {
                id: element.getAttribute('data-re0-character-card') || '',
                mode: element.getAttribute('data-re0-asset-mode') || '',
                src: image?.currentSrc || image?.getAttribute('src') || '',
                rect: { width: Math.round(rect.width), height: Math.round(rect.height), top: Math.round(rect.top), bottom: Math.round(rect.bottom) },
            };
        });
        const choiceRect = rectOf('#re0-vn-stage .re0-vn-choices-overlay');
        return {
            url: location.href,
            stageVisible: !!stage && !stage.hidden,
            storyMode: stage?.dataset?.re0VnStoryMode || '',
            currentSpeaker: stage?.dataset?.re0VnCurrentSpeakerName || '',
            segmentType: stage?.dataset?.re0VnCurrentSegmentType || '',
            dialogue: stage?.querySelector('.re0-vn-dialogue-text')?.textContent?.trim() || '',
            backdropKey: stage?.dataset?.re0VnBackdropKey || '',
            backdropImageUrl: stage?.dataset?.re0VnBackdropImageUrl || '',
            backdropConfidence: stage?.dataset?.re0VnBackdropConfidence || '',
            insertCgActive: stage?.dataset?.re0VnInsertCgActive === 'true',
            insertCgCount: Number(stage?.dataset?.re0VnInsertCgCount || 0),
            castIds: (stage?.dataset?.re0VnCastIds || '').split(',').filter(Boolean),
            sceneCastIds: (stage?.dataset?.re0VnSceneCastIds || '').split(',').filter(Boolean),
            characterAssets,
            choices,
            choiceRect,
            viewportHeight: window.innerHeight,
            dialogueRect: rectOf('#re0-vn-stage .re0-vn-dialogue'),
            charactersChoiceOverlap: characterRects.reduce((sum, rect) => sum + overlapArea(rect, choiceRect), 0),
            choiceDialogueOverlap: overlapArea(choiceRect, rectOf('#re0-vn-stage .re0-vn-dialogue')),
            stageConsistency: stage?.dataset?.re0VnStageConsistency || '',
            stageConsistencySummary: stage?.dataset?.re0VnStageConsistencySummary || '',
            assetPlanBackdropKey: stage?.dataset?.re0VnAssetPlanBackdropKey || '',
            assetPlanBackdropConfidence: stage?.dataset?.re0VnAssetPlanBackdropConfidence || '',
            assetPlanCandidateKeys: (stage?.dataset?.re0VnAssetPlanCandidateKeys || '').split('|').filter(Boolean),
            assetPlanMissingCount: Number(stage?.dataset?.re0VnAssetPlanMissingCount || 0),
            assetPlanFindingCount: Number(stage?.dataset?.re0VnAssetPlanFindingCount || 0),
            missingAssetQueueCount: window.re0AdventureDebug?.().backdrop?.missingAssetQueueCount || 0,
        };
    });
}

async function applyProbeAndWaitForPlayableSnapshot(page, probe, index) {
    let snapshot = null;
    const expectedBackdrops = probe.expectedBackdropKeys || [probe.expectedBackdropKey || probe.backgroundKey];
    await mergeLongplayProbe(page, probe, index);
    await expect.poll(async () => {
        snapshot = await visualLongplaySnapshot(page);
        const requiredCastIds = (probe.castIds || []).slice(0, Math.min(3, (probe.castIds || []).length));
        const visibleCastIds = [...new Set([
            ...snapshot.castIds,
            ...(snapshot.characterAssets || []).map((asset) => asset.id).filter(Boolean),
        ])];
        return {
            backdropAccepted: expectedBackdrops.includes(snapshot.backdropKey),
            castAccepted: requiredCastIds.every((id) => visibleCastIds.includes(id)),
            choiceCountAccepted: snapshot.choices.length >= 6,
            hasDialogue: snapshot.dialogue.length > 8,
        };
    }, {
        timeout: 24_000,
        message: `playable stage snapshot should stabilize: ${probe.stage}`,
    }).toMatchObject({
        backdropAccepted: true,
        castAccepted: true,
        choiceCountAccepted: true,
        hasDialogue: true,
    });
    return snapshot;
}

function expectPlayableLongplaySnapshot(snapshot, probe) {
    expect(snapshot.stageVisible).toBe(true);
    expect(snapshot.storyMode).toBe(probe.storyMode || 'mainline');
    expect(snapshot.dialogue.length).toBeGreaterThan(8);
    expect(probe.expectedBackdropKeys || [probe.expectedBackdropKey || probe.backgroundKey]).toContain(snapshot.backdropKey);
    expect(snapshot.backdropImageUrl).toMatch(/\.(png|webp|jpg|jpeg)(?:$|\?)/u);
    expect(snapshot.assetPlanBackdropKey.length).toBeGreaterThan(0);
    expect(snapshot.assetPlanCandidateKeys.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.assetPlanCandidateKeys.slice(0, 5)).toContain(snapshot.backdropKey);
    expect(Number.isFinite(snapshot.assetPlanMissingCount)).toBe(true);
    expect(Number.isFinite(snapshot.assetPlanFindingCount)).toBe(true);
    expect(bannedStageBackdropUrls.some((pattern) => pattern.test(snapshot.backdropImageUrl))).toBe(false);
    expect(/\/assets\/source-novel\/(?:illustrations|site)\//u.test(snapshot.backdropImageUrl)).toBe(false);
    expect(snapshot.castIds).toEqual(expect.arrayContaining(probe.castIds.slice(0, Math.min(3, probe.castIds.length))));
    expect(snapshot.choices.length).toBeGreaterThanOrEqual(6);
    expect(snapshot.choices.length).toBeLessThanOrEqual(8);
    expect(snapshot.choices.some((choice) => choice.source === 'canon-follow' || /原作线|正典|原作路线/u.test(choice.text))).toBe(true);
    expect(snapshot.choices.every((choice) => choice.impactLabel && choice.impactLogic)).toBe(true);
    expect(snapshot.choices.every((choice) => choice.scrollOverflowX <= 2 && choice.scrollOverflowY <= 2)).toBe(true);
    expect(snapshot.choices.every((choice) => !/^(白鲸|怠惰|撤退|圣域|试炼|终局|王选|调查)$/u.test(choice.text.trim()))).toBe(true);
    expect(snapshot.choices.every((choice) => !/^(?:(?:【|\[)?\d{1,2}(?:】|\])?\s*)?(短句任务|长对峙|任务拒绝|追踪|伏击|不得不战)$/u.test(choice.text.trim()))).toBe(true);
    expect(snapshot.choiceRect.height).toBeLessThanOrEqual(Math.max(520, snapshot.viewportHeight - 98) + 2);
    expect(snapshot.choiceDialogueOverlap).toBe(0);
    expect(snapshot.charactersChoiceOverlap).toBe(0);
    expect(snapshot.characterAssets.every((asset) => !/\/assets\/source-novel\/(?:characters|illustrations)\//u.test(asset.src))).toBe(true);
    expect(snapshot.characterAssets.every((asset) => asset.mode !== 'sprite' || !/\/assets\/official\//u.test(asset.src))).toBe(true);
    const dialogueTop = snapshot.dialogueRect?.top ?? 720;
    expect(snapshot.characterAssets.every((asset) => asset.mode !== 'portrait' || (asset.rect.width <= 120 && asset.rect.bottom <= dialogueTop))).toBe(true);
    if ((probe.storyMode || 'mainline') !== 'adult') {
        expect(snapshot.insertCgActive).toBe(false);
        expect(snapshot.insertCgCount).toBe(0);
    }
    expect(['pass', 'warn']).toContain(snapshot.stageConsistency);
    expect(snapshot.missingAssetQueueCount).toBe(0);
}

test.describe('Re:0 adventure engine longplay branch simulation', () => {
    test.beforeEach(async ({ page }) => {
        await bootRe0(page);
    });

    test('surfaces Arc1-4 IF branch choices as meaningful persistent VN actions', async ({ page }) => {
        const probes = [
            {
                prefix: 'RC-IF',
                expectedChoice: /质问爱蜜莉雅|可核实异常|掌心警告/u,
                day: 1,
                time: '雨夜',
                location: '王都贫民区雨夜 · 掌心警告与银发半精灵误导',
                viewpoint: '玩家',
                sceneCharacters: ['爱蜜莉雅', '帕克', '莉榭尔·阿尔戈'],
                objective: 'Arc1 掌心警告 银发半精灵 墨痕 第三方反应 不要当场情绪化质问',
                stage: 'RC-IF-01 掌心警告分歧',
                actionHints: ['当场质问爱蜜莉雅是不是在骗你', '只说可核实异常，不说掌心警告全文', '先观察帕克和旁人反应'],
                openQuestions: ['掌心警告是谁写下的？', '第三方能否见证墨痕变化？'],
                failurePressure: ['F-1-06'],
                clues: ['掌心墨痕', '银发半精灵误导', '废钟声'],
            },
            {
                prefix: 'MR-IF',
                expectedChoice: /证物|蕾姆|宅邸|咒术|罗兹瓦尔/u,
                day: 8,
                time: '清晨',
                location: '罗兹瓦尔宅邸门厅 · 带物证入宅',
                viewpoint: '玩家',
                sceneCharacters: ['蕾姆', '拉姆', '罗兹瓦尔'],
                objective: 'Arc2 宅邸 咒术 蕾姆疑心 带入王都证据 钟锈片 欧文档案残页',
                stage: 'MR-IF-01 带物证入宅',
                actionHints: ['交出部分证物让蕾姆确认', '隐藏证物观察罗兹瓦尔反应', '先找碧翠丝验证咒术'],
                openQuestions: ['咒术媒介在哪里？', '罗兹瓦尔是否调整剧本？'],
                failurePressure: ['F-2-02', 'F-2-05'],
                clues: ['钟锈片', '欧文档案残页', '咒术痕迹'],
            },
            {
                prefix: 'WT-IF',
                expectedChoice: /白鲸|怠惰|撤离路线|阵营/u,
                day: 39,
                time: '下午',
                location: '王选会议厅 · 白鲸活动与怠惰位置协商',
                viewpoint: '玩家',
                sceneCharacters: ['库珥修', '安娜塔西亚', '威尔海姆', '尤里乌斯'],
                objective: 'Arc3 白鲸活动 怠惰位置 撤离路线 阵营协商 预言不能当证据',
                stage: 'WT-IF-01 阵营协商成功',
                actionHints: ['先给当天能验证的小事实', '把白鲸情报拆成商路证据', '请求威尔海姆核对时刻表'],
                openQuestions: ['哪条证据当天可验证？', '哪个阵营先承担风险？'],
                failurePressure: ['F-3-01', 'F-3-04'],
                clues: ['白鲸活动', '怠惰位置', '撤离路线'],
            },
            {
                prefix: 'SC-IF',
                expectedChoice: /圣域|试炼|墓所|加菲尔|罗兹瓦尔|结界/u,
                day: 48,
                time: '黄昏',
                location: '圣域墓所外 · 试炼与结界分歧',
                viewpoint: '玩家',
                sceneCharacters: ['爱蜜莉雅', '加菲尔', '罗兹瓦尔', '碧翠丝'],
                objective: 'Arc4 圣域 试炼 墓所 结界 加菲尔 罗兹瓦尔 剧本 碧翠丝契约',
                stage: 'SC-IF-01 圣域试炼分歧',
                actionHints: ['先确认结界规则', '让爱蜜莉雅保留自主选择', '试探罗兹瓦尔剧本缺口'],
                openQuestions: ['试炼失败会改变谁的记忆？', '罗兹瓦尔希望你怎样误判？'],
                failurePressure: ['F-4-01', 'F-4-03'],
                clues: ['圣域结界', '墓所试炼', '罗兹瓦尔剧本'],
            },
        ];

        const results = [];
        for (const probe of probes) {
            await applyArcProbe(page, probe);
            let state = null;
            await expect.poll(async () => {
                state = await snapshotBranchState(page);
                return {
                    source: state.vn.choiceOverlaySource,
                    hasRulePrefix: state.relevant.some((rule) => String(rule.id || '').startsWith(probe.prefix)),
                    hasExpectedChoice: state.domChoices.some((choice) => probe.expectedChoice.test(choice.text)),
                };
            }, {
                timeout: 16_000,
                message: `${probe.prefix} branch debug summary and visible choices should stabilize`,
            }).toMatchObject({
                source: 'if-branch-rule',
                hasRulePrefix: true,
                hasExpectedChoice: true,
            });
            results.push({ probe, state });
        }

        for (const { probe, state } of results) {
            expect(state.metadata.count).toBeGreaterThanOrEqual(72);
            expect(state.metadata.softDivisionCount).toBeGreaterThanOrEqual(54);
            expect(state.metadata.choiceTagPatchCount).toBeGreaterThanOrEqual(32);
            expect(state.vn.choiceOverlaySource, `${probe.prefix} should surface IF branch overlay`).toBe('if-branch-rule');
            expect(state.relevant.some((rule) => String(rule.id || '').startsWith(probe.prefix))).toBe(true);
            expect(state.relevant.some((rule) => Array.isArray(rule.choiceTags) && rule.choiceTags.length >= 3)).toBe(true);
            expect(state.relevant.some((rule) => String(rule.deathChangesPlayerStrategy || '').length > 10)).toBe(true);
            expect(state.domChoices.length).toBeGreaterThanOrEqual(3);
            expect(state.domChoices.some((choice) => probe.expectedChoice.test(choice.text))).toBe(true);
            expect(state.domChoices.some((choice) => choice.source === 'if-branch-rule')).toBe(true);
            expect(state.domChoices.some((choice) => ['risk', 'keep', 'pseudo', 'normal'].includes(choice.type))).toBe(true);
            expect(state.domChoices.every((choice) => choice.impactLabel && choice.impactLogic)).toBe(true);
            expect(state.vn.choiceOverlaySoftness).toContain('死亡教学');
        }
    });

    test('keeps death, answer book, anchor return, and corrected action in one longplay loop', async ({ page }) => {
        await applyArcProbe(page, {
            day: 1,
            time: '雨夜',
            location: '王都贫民区雨夜 · 掌心警告与银发半精灵误导',
            viewpoint: '玩家',
            sceneCharacters: ['爱蜜莉雅', '帕克', '莉榭尔·阿尔戈'],
            objective: 'Arc1 掌心警告 银发半精灵 墨痕 第三方反应 不要当场情绪化质问',
            stage: 'RC-IF-01 掌心警告分歧',
            actionHints: ['当场质问爱蜜莉雅是不是在骗你', '只说可核实异常，不说掌心警告全文', '先观察帕克和旁人反应'],
            openQuestions: ['掌心警告是谁写下的？', '第三方能否见证墨痕变化？'],
            failurePressure: ['F-1-06'],
            clues: ['掌心墨痕', '银发半精灵误导', '废钟声'],
        });
        await page.waitForFunction(() => {
            const stage = document.querySelector('#re0-vn-stage');
            return !!stage && !stage.hidden && stage.querySelectorAll('[data-re0-vn-choice]').length >= 3;
        }, null, { timeout: 20_000 });

        let riskyChoice = null;
        await expect.poll(async () => {
            const beforeDeath = await snapshotBranchState(page);
            riskyChoice = beforeDeath.domChoices.find((choice) => choice.type === 'risk' && /质问|骗|可核实异常|死亡|风险/u.test(choice.text)) || null;
            return !!riskyChoice;
        }, {
            timeout: 16_000,
            message: 'risk branch choice should become visible before triggering death loop',
        }).toBe(true);

        const death = await page.evaluate((choiceText) => window.re0AdventureDebugTriggerDeath?.(`我死了：${choiceText}，没有证据也没有撤离距离。`), riskyChoice.text);
        expect(death.mode).toBe('answer_book');
        expect(death.answerBook.active).toBe(true);
        expect(death.worldline.treeSummary.failedCount).toBeGreaterThanOrEqual(1);
        expect(death.worldline.treeSummary.lastFailedNodeId).toBeTruthy();

        let question = null;
        await expect.poll(async () => {
            question = await page.evaluate((choiceText) => {
                let result = window.re0AdventureDebugAnswerBookQuestion?.('这次真正错误的行动方针是什么？') || null;
                if (!result?.handled) {
                    window.re0AdventureDebugTriggerDeath?.(`我死了：${choiceText}，同一失败分支在测试恢复流程中补录。`);
                    result = window.re0AdventureDebugAnswerBookQuestion?.('这次真正错误的行动方针是什么？') || null;
                }
                return result;
            }, riskyChoice.text);
            return question?.handled === true;
        }, {
            timeout: 8_000,
            message: 'answer book question should recover from a recorded death branch',
        }).toBe(true);
        expect(question.debug.answerBook.questionUsed).toBe(true);

        const answer = await page.evaluate(() => window.re0AdventureDebugAnswerBookReply?.('真正错误不是怀疑爱蜜莉雅，而是在没有第三方证据、同伴和撤离窗口时当场质问。下一轮先验证墨痕与帕克反应，只说可核实异常。'));
        expect(answer.answerBook.phase).toBe('spent');
        expect(answer.worldline.treeSummary.lastAnswerBookSync.lastAnswer).toContain('可核实异常');

        const returned = await page.evaluate(() => window.re0AdventureDebugReturnAnchor?.());
        expect(returned.handled).toBe(true);
        expect(returned.debug.mode).toBe('main');
        expect(returned.debug.playLoopDirector.deathRisk.hasDeathLesson).toBe(true);
        expect(returned.debug.playLoopDirector.deathRisk.strategyPivot).toContain('改变');
        expect(returned.debug.flags.awaitingAnchorLessonCarryover).toBe(true);

        await applyArcProbe(page, {
            day: 1,
            time: '雨夜',
            location: '王都贫民区雨夜 · 返回锚点后的掌心墨痕复核',
            viewpoint: '玩家',
            sceneCharacters: ['爱蜜莉雅', '帕克', '莉榭尔·阿尔戈'],
            objective: '返回锚点后按死亡教训改变方针：只说可核实异常，不说掌心警告全文，先观察帕克和第三方反应',
            stage: 'RC-IF-01 纠偏路线',
            actionHints: ['只说可核实异常，不说掌心警告全文', '先观察帕克和旁人反应，再决定是否对质', '让莉榭尔见证墨痕变化'],
            openQuestions: ['帕克会不会先察觉魔女气味？', '莉榭尔能否读取失败残响？'],
            failurePressure: ['避免重复 F-1-06'],
            clues: ['死亡残响', '错误假设：无证据当场质问', '纠偏：第三方见证'],
        });

        let corrected = await snapshotBranchState(page);
        await expect.poll(async () => {
            corrected = await snapshotBranchState(page);
            return corrected.worldline.treeSummary.failedCount >= 1
                && corrected.playLoop.deathRisk.hasDeathLesson === true;
        }, { timeout: 8_000 }).toBe(true);
        expect(corrected.worldline.treeSummary.failedCount).toBeGreaterThanOrEqual(1);
        expect(corrected.domChoices.some((choice) => choice.type === 'keep' && /可核实|墨痕|观察/u.test(choice.text))).toBe(true);
        expect(corrected.domChoices.some((choice) => choice.type === 'risk' && /质问|骗|风险|死亡|可核实异常/u.test(choice.text))).toBe(true);
        expect(corrected.playLoop.deathRisk.hasDeathLesson).toBe(true);
        expect(corrected.vn.choiceOverlaySoftness).toContain('死亡教学');
    });

    test('simulates a full internal playthrough from Arc1 to finale with visual snapshots', async ({ page }) => {
        const baseChoices = [
            '沿着原作线处理当前节点，逐步靠回正典路线',
            '先收集能当天验证的证据，再改变接触顺序',
            '找当前最关键的角色单独确认动机和风险',
            '主动制造一个小偏差，观察世界线偏移解释',
            '暂停主线窗口，整理角色卡和线索板',
            '推进时间，让后台世界显影新的传言',
            '选择风险路线验证一个死亡 flag',
            '从当前地点撤离，换空间寻找支线入口',
        ];
        const probes = [
            {
                arc: 1,
                day: 1,
                time: '雨夜',
                location: '王都贫民区雨夜 · 废钟与掌心警告',
                stage: 'Arc1 王都开局：徽章失窃前夜',
                objective: '确认废钟声、掌心警告、银发半精灵误导三条线索的关系',
                backgroundKey: 'arc01_slum_alley_night',
                expectedBackdropKeys: ['rain_bell', 'arc01_slum_alley_night'],
                castIds: ['lishelle', 'emilia', 'puck'],
                sceneNames: ['莉榭尔·阿尔戈', '爱蜜莉雅', '帕克'],
                worldlineId: 'RC-Umbra-001',
                attractor: '王都雨夜 / Royal Capital Umbra',
                divergence: 0.337,
                shift: '玩家仍在原作引力附近，但掌心警告让银发半精灵误导线产生轻微偏移。',
                keys: storylineKeyIds.slice(0, 2),
                flags: storylineFlagIds.slice(0, 2),
                tendencyCounter: { Umbra: 2, Truth: 1, Light: 1 },
                clues: ['掌心墨痕', '废钟声', '不属于这个世界的硬币'],
                openQuestions: ['掌心警告是谁留下的？', '为什么废钟会在雨夜响起？'],
                failurePressure: ['F-1-06 当场质问会触发死亡教学'],
                visibleText: '雨水顺着石板路流向废弃钟楼。莉榭尔的黑伞停在你面前，爱蜜莉雅和帕克的影子被灯火切开。',
                segments: [
                    { type: 'narration', text: '雨水顺着石板路流向废弃钟楼。你掌心的墨痕在发热。' },
                    { type: 'dialogue', speakerId: 'lishelle', text: '第三次死亡前，别急着相信任何一句温柔的话。' },
                    { type: 'dialogue', speakerId: 'emilia', text: '你看起来很冷。要不要先离开这条巷子？' },
                ],
                choices: baseChoices,
            },
            {
                arc: 2,
                day: 8,
                time: '清晨',
                location: '罗兹瓦尔宅邸门厅 · 咒术疑云',
                stage: 'Arc2 宅邸：带物证入宅',
                objective: '在不暴露死亡回归的情况下处理蕾姆疑心、咒术媒介和罗兹瓦尔剧本',
                backgroundKey: 'arc02_mansion_corridor_night',
                expectedBackdropKeys: ['mansion', 'arc02_mansion_corridor_night'],
                castIds: ['rem', 'ram', 'roswaal'],
                sceneNames: ['蕾姆', '拉姆', '罗兹瓦尔'],
                worldlineId: 'MR-Truth-002',
                attractor: '宅邸惨剧 / Mansion Return',
                divergence: 0.29,
                shift: '证据网络降低了无端怀疑，但罗兹瓦尔剧本开始把玩家视作变量。',
                keys: storylineKeyIds.slice(0, 7),
                flags: storylineFlagIds.slice(0, 8),
                tendencyCounter: { Truth: 3, Umbra: 2, Light: 2 },
                clues: ['钟锈片', '欧文档案残页', '咒术痕迹'],
                openQuestions: ['咒术媒介在哪里？', '罗兹瓦尔是否故意放任风险？'],
                failurePressure: ['F-2-02 夜间独行会重新触发宅邸死亡线'],
                visibleText: '宅邸走廊的红毯吸住了清晨的雾。蕾姆的视线落在你袖口的钟锈片上。',
                segments: [
                    { type: 'narration', text: '宅邸走廊的红毯吸住了清晨的雾，空气里有擦不掉的魔女气味。' },
                    { type: 'dialogue', speakerId: 'rem', text: '客人，您昨夜去了哪里？请不要说谎。' },
                    { type: 'dialogue', speakerId: 'roswaal', text: '变量并不可怕，可怕的是变量以为自己没有代价。' },
                ],
                choices: baseChoices,
            },
            {
                arc: 3,
                day: 39,
                time: '下午',
                location: '王选会议厅 · 白鲸与怠惰协商',
                stage: 'Arc3 白鲸怠惰：阵营协商',
                objective: '把白鲸活动和怠惰位置拆成可验证证据，争取库珥修与安娜塔西亚阵营协助',
                backgroundKey: 'arc03_royal_election_hall',
                expectedBackdropKeys: ['arc03_royal_election_hall', 'royal_capital'],
                castIds: ['crusch', 'wilhelm', 'julius'],
                sceneNames: ['库珥修', '威尔海姆', '尤里乌斯'],
                worldlineId: 'WT-Truth-003',
                attractor: '白鲸与怠惰 / Whale and Sloth',
                divergence: 0.24,
                shift: '玩家选择证据链而非预言式求援，原作线被连续修正吸回。',
                keys: storylineKeyIds.slice(0, 13),
                flags: storylineFlagIds.slice(0, 15),
                tendencyCounter: { Truth: 5, Light: 3, Umbra: 2 },
                clues: ['白鲸活动', '怠惰位置', '撤离路线'],
                openQuestions: ['哪个证据能当天验证？', '谁能承担第一轮政治风险？'],
                failurePressure: ['F-3-04 把预知当证据会导致谈判崩盘'],
                visibleText: '会议厅的窗外，王都的旗帜被风扯得发白。威尔海姆没有看你，他只看那张商路图。',
                segments: [
                    { type: 'narration', text: '会议厅的窗外，王都的旗帜被风扯得发白。桌上摊开白鲸出没的商路图。' },
                    { type: 'dialogue', speakerId: 'crusch', text: '我需要证据，不需要神谕。你能给出哪个事实？' },
                    { type: 'dialogue', speakerId: 'wilhelm', text: '若白鲸真的在那里，我会去。无论代价是什么。' },
                ],
                choices: baseChoices,
            },
            {
                arc: 4,
                day: 55,
                time: '黄昏',
                location: '圣域墓所外 · 试炼与结界',
                stage: 'Arc4 圣域：试炼分歧',
                objective: '在尊重爱蜜莉雅自主性的前提下确认结界、墓所试炼和罗兹瓦尔剧本缺口',
                backgroundKey: 'arc04_sanctuary_entrance',
                expectedBackdropKeys: ['sanctuary', 'arc04_sanctuary_entrance'],
                castIds: ['emilia', 'garfiel', 'ryuzu'],
                sceneNames: ['爱蜜莉雅', '加菲尔', '琉兹'],
                worldlineId: 'SC-Light-004',
                attractor: '圣域试炼 / Sanctuary Trial',
                divergence: 0.21,
                shift: '关系锚点成为钥匙，强行代替爱蜜莉雅选择会推高坏分支。',
                keys: storylineKeyIds.slice(0, 20),
                flags: storylineFlagIds.slice(0, 22),
                tendencyCounter: { Light: 6, Truth: 5, Umbra: 2 },
                clues: ['圣域结界', '墓所试炼', '罗兹瓦尔剧本'],
                openQuestions: ['试炼失败会改变谁的记忆？', '加菲尔真正害怕什么？'],
                failurePressure: ['F-4-03 把碧翠丝当武器会损坏终局钥匙'],
                visibleText: '墓所外的风很轻，轻到像有人在屏住呼吸。加菲尔堵在台阶前，琉兹没有阻止他。',
                segments: [
                    { type: 'narration', text: '墓所外的风很轻，轻到像有人在屏住呼吸。结界的边缘在黄昏里泛白。' },
                    { type: 'dialogue', speakerId: 'garfiel', text: '你要带她进去？那你先告诉我，你凭什么保证她不会坏掉。' },
                    { type: 'dialogue', speakerId: 'emilia', text: '我害怕。但这一次，我想自己决定。' },
                ],
                choices: baseChoices,
            },
            {
                arc: 5,
                day: 190,
                time: '傍晚',
                location: '普利斯提拉水门都市 · 广播塔灾厄',
                stage: 'Arc5 普利斯提拉：水门灾厄',
                objective: '在多阵营、多司教同时入局时拆分救援、广播、撤离和信息战',
                backgroundKey: 'arc05_water_gate_dusk',
                expectedBackdropKeys: ['priestella', 'arc05_water_gate_dusk'],
                castIds: ['anastasia', 'julius', 'priscilla'],
                sceneNames: ['安娜塔西亚', '尤里乌斯', '普莉希拉'],
                worldlineId: 'PR-Truth-005',
                attractor: '水门都市灾厄 / Priestella',
                divergence: 0.27,
                shift: '多阵营协同让主线推进加速，但每个广播决定都会牺牲一部分城市。',
                keys: storylineKeyIds.slice(0, 27),
                flags: storylineFlagIds.slice(0, 34),
                tendencyCounter: { Truth: 7, Light: 5, Umbra: 3 },
                clues: ['广播塔', '水门控制权', '司教同场'],
                openQuestions: ['先救哪一座塔？', '广播内容会不会触发嫉妒魔女注视？'],
                failurePressure: ['F-5-07 回应禁忌台词会提升 Witch 终局倾向'],
                visibleText: '水门的黄昏像一枚断裂的金属环。广播塔上方传来不属于任何人的笑声。',
                segments: [
                    { type: 'narration', text: '水门的黄昏像一枚断裂的金属环。广播塔上方传来不属于任何人的笑声。' },
                    { type: 'dialogue', speakerId: 'anastasia', text: '情报要先活下来，才有资格叫情报。你选哪座塔？' },
                    { type: 'dialogue', speakerId: 'priscilla', text: '妾身允许你借这座城市的舞台，但别把怯懦说成仁慈。' },
                ],
                choices: baseChoices,
            },
            {
                arc: 6,
                day: 260,
                time: '深夜',
                location: '贤者监视塔入口 · 记忆迷宫',
                stage: 'Arc6 监视塔：名字与记忆',
                objective: '在记忆污染、暴食和星名档案之间确认主角因果继承的边界',
                backgroundKey: 'arc06_watchtower_door',
                expectedBackdropKeys: ['arc06_watchtower_door', 'witch_dream'],
                castIds: ['beatrice', 'shaula', 'reid'],
                sceneNames: ['碧翠丝', '夏乌拉', '里德'],
                worldlineId: 'WTower-Truth-006',
                attractor: '贤者监视塔 / Watchtower',
                divergence: 0.31,
                shift: '硬币和星名档案产生共振，真相线开始压过黑暗随机漂移。',
                keys: storylineKeyIds.slice(0, 34),
                flags: storylineFlagIds.slice(0, 45),
                tendencyCounter: { Truth: 10, Light: 5, Mirror: 2 },
                clues: ['星名档案', '名字被吃', '硬币时间线'],
                openQuestions: ['硬币是不是另一条时间线的钱币？', '记忆缺口属于谁？'],
                failurePressure: ['F-6-06 名字与记忆被吞会造成镜像终局风险'],
                visibleText: '塔门前的沙像冷掉的骨灰。碧翠丝抓住你的袖口，夏乌拉望着星空。',
                segments: [
                    { type: 'narration', text: '塔门前的沙像冷掉的骨灰。你口袋里的硬币第一次发出清脆声响。' },
                    { type: 'dialogue', speakerId: 'beatrice', text: '不许把自己也交给书架，听到没有，事实上。' },
                    { type: 'dialogue', speakerId: 'reid', text: '你这眼神不错。像输过很多次，还没学会跪。' },
                ],
                choices: baseChoices,
            },
            {
                arc: 7,
                day: 420,
                time: '夜',
                location: '佛拉基亚帝都宫门 · 狼之国',
                stage: 'Arc7 帝国：身份与战争',
                objective: '在佛拉基亚强者秩序中保存同伴、身份和撤离路线',
                backgroundKey: 'arc07_vollachia_palace',
                expectedBackdropKeys: ['vollachia', 'arc07_vollachia_palace'],
                castIds: ['priscilla', 'vincent', 'cecilus'],
                sceneNames: ['普莉希拉', '文森特', '塞西鲁斯'],
                worldlineId: 'VL-Umbra-007',
                attractor: '佛拉基亚帝国 / Vollachia',
                divergence: 0.42,
                shift: '远离王都后开放世界自由度变高，世界线漂移开始由战争后果决定。',
                keys: storylineKeyIds.slice(0, 39),
                flags: storylineFlagIds.slice(0, 55),
                tendencyCounter: { Umbra: 7, Truth: 10, Light: 5 },
                clues: ['帝国身份', '九神将动向', '撤离路线'],
                openQuestions: ['谁会利用主角的死亡回归气味？', '帝国强者法则能否反过来保护弱者？'],
                failurePressure: ['F-7-04 身份暴露会触发追捕连锁'],
                visibleText: '帝都宫门像一把竖起来的刀。文森特没有欢迎你，他只是在判断你有没有价值。',
                segments: [
                    { type: 'narration', text: '帝都宫门像一把竖起来的刀。风里没有王都的礼节，只有强者秩序。' },
                    { type: 'dialogue', speakerId: 'vincent', text: '你说你能改变败局。那就证明你不是只会死的废物。' },
                    { type: 'dialogue', speakerId: 'cecilus', text: '要是你真有趣，我可以先不把你切成故事。' },
                ],
                choices: baseChoices,
            },
            {
                arc: 8,
                day: 620,
                time: '拂晓',
                location: '大灾后废墟 · 错位救援',
                stage: 'Arc8 大灾：亡者与迟到救援',
                objective: '处理大灾后幸存者、亡者残响和迟到救援的伦理代价',
                backgroundKey: 'arc08_post_catastrophe_ruins',
                expectedBackdropKeys: ['arc08_post_catastrophe_ruins', 'vollachia'],
                castIds: ['rem', 'medium', 'chisha'],
                sceneNames: ['蕾姆', '米蒂姆', '奇夏'],
                worldlineId: 'VC-Bell-008',
                attractor: '佛拉基亚大灾 / Catastrophe',
                divergence: 0.49,
                shift: '迟到救援主题增强，剥钟人终局候选开始显影但尚未锁定。',
                keys: storylineKeyIds.slice(0, 45),
                flags: storylineFlagIds.slice(0, 65),
                tendencyCounter: { Bell: 3, Truth: 11, Light: 6, Umbra: 8 },
                clues: ['亡者残响', '迟到救援', '灾后名单'],
                openQuestions: ['救回的人是否真的属于当前时间线？', '剥钟人的权能是否借灾厄扩散？'],
                failurePressure: ['F-8-08 错时救援会扩大 Bell 终局候选'],
                visibleText: '废墟在拂晓里没有颜色。蕾姆把名单折起来，像折一块伤口。',
                segments: [
                    { type: 'narration', text: '废墟在拂晓里没有颜色。每一处沉默都像有人迟到了一秒。' },
                    { type: 'dialogue', speakerId: 'rem', text: '如果这份名单还能被改写，请告诉我代价在哪里。' },
                    { type: 'dialogue', speakerId: 'chisha', text: '帝国从不奖励善良，但会记住能让死人闭嘴的人。' },
                ],
                choices: baseChoices,
            },
            {
                arc: 9,
                day: 850,
                time: '雪夜',
                location: '古斯提科雪原 · 废钟朝圣路',
                stage: 'Arc9 雪原：剥钟人据点',
                objective: '调查雪原废钟、朝圣者证词和迟到救赎权能的源头',
                backgroundKey: 'arc09_snowfield_bell',
                expectedBackdropKeys: ['snowfield', 'arc09_snowfield_bell'],
                castIds: ['bellringer', 'satella', 'owen'],
                sceneNames: ['剥钟人', '莎缇拉', '欧文·卡斯兰'],
                worldlineId: 'GS-Bell-009',
                attractor: '古斯提科雪原 / Gusteko',
                divergence: 0.53,
                shift: '偏移超过 0.50，系统必须把世界线崩坏风险解释给玩家，而不是硬切坏结局。',
                keys: storylineKeyIds.slice(0, 50),
                flags: storylineFlagIds.slice(0, 75),
                tendencyCounter: { Bell: 5, Truth: 13, Light: 6, Umbra: 9 },
                clues: ['雪原废钟', '朝圣者口供', '迟到救赎权能'],
                openQuestions: ['剥钟人到底救了谁？', '欧文档案能否压制权能叙事？'],
                failurePressure: ['F-9-03 在雪原回应钟声会触发错时救援'],
                visibleText: '雪原上的钟没有钟舌，却一直在响。欧文把档案压在胸口，像压住一颗不肯停的心。',
                segments: [
                    { type: 'narration', text: '雪原上的钟没有钟舌，却一直在响。远处的朝圣者像一排黑点。' },
                    { type: 'dialogue', speakerId: 'owen', text: '我不相信救赎。我只相信证据，以及证据来晚时留下的尸体。' },
                    { type: 'dialogue', speakerId: 'bellringer', text: '你听见了吗？那是你本可以救下他们的声音。' },
                ],
                choices: baseChoices,
            },
            {
                arc: 10,
                day: 1010,
                time: '正午',
                location: '王都终局广场 · 王选与总决战',
                stage: 'Arc10 王都回归：终局前议会',
                objective: '把王选政治、龙、贤者、福音书和魔女教暗线压缩进终局前最后协商',
                backgroundKey: 'arc10_capital_finale_plaza',
                expectedBackdropKeys: ['arc10_capital_finale_plaza', 'royal_capital'],
                castIds: ['emilia', 'reinhard', 'felt'],
                sceneNames: ['爱蜜莉雅', '莱茵哈鲁特', '菲鲁特'],
                worldlineId: 'RC-Truth-010',
                attractor: '王都回归 / Capital Return',
                divergence: 0.18,
                shift: '连续选择原作线和证据线后，世界线从高偏移区缓慢回到正典可救窗口。',
                keys: storylineKeyIds.slice(0, 54),
                flags: storylineFlagIds.slice(0, 82),
                tendencyCounter: { Truth: 16, Light: 9, Bell: 3, Umbra: 7 },
                clues: ['王选终局议会', '龙之契约', '福音书黑幕'],
                openQuestions: ['莱茵哈鲁特能解决什么，不能解决什么？', '王选结果会如何反噬终局？'],
                failurePressure: ['F-10-04 依赖强者代打会失去真终局钥匙'],
                visibleText: '王都广场亮得过分，像世界故意把所有影子藏到人群脚下。',
                segments: [
                    { type: 'narration', text: '王都广场亮得过分，像世界故意把所有影子藏到人群脚下。' },
                    { type: 'dialogue', speakerId: 'reinhard', text: '我能挥剑，但不能替所有人做选择。' },
                    { type: 'dialogue', speakerId: 'felt', text: '喂，别把王选当成漂亮结局。底层的人还没答应呢。' },
                ],
                choices: baseChoices,
            },
            {
                arc: 11,
                day: 1099,
                time: '终局倒计时',
                location: '终局清晨 · 魔女之后',
                stage: 'Arc11 终局：候选结局锁定前',
                objective: '展示可达终局、冻结代价，并让玩家确认最终选择',
                backgroundKey: 'arc11_dawn_after_witch',
                expectedBackdropKeys: ['arc11_dawn_after_witch', 'witch_dream', 'worldline_tree'],
                castIds: ['satella', 'emilia', 'beatrice'],
                sceneNames: ['莎缇拉', '爱蜜莉雅', '碧翠丝'],
                worldlineId: 'FN-True-001',
                attractor: '终局收束 / Finale',
                divergence: 0.04,
                shift: '钥匙、关系和证据达标，真终局成为首位候选；终局仍需明确代价确认。',
                keys: storylineKeyIds,
                flags: storylineFlagIds.slice(0, 84),
                tendencyCounter: { Truth: 20, Light: 12, Bell: 2, Umbra: 4, Witch: 0 },
                finaleTrigger: { ready: true, candidates: ['E-True', 'E-Good', 'E-Truth'], preview: 'E-True' },
                clues: ['全部钥匙', '终局代价', '玩家失去回归权'],
                openQuestions: ['你愿意失去死亡回归吗？', '世界会记住还是忘记你？'],
                failurePressure: ['F-11-01 终局完美无代价会触发坏候选'],
                visibleText: '清晨没有雨。废钟楼的影子终于短到够不着你的脚尖。',
                segments: [
                    { type: 'narration', text: '清晨没有雨。废钟楼的影子终于短到够不着你的脚尖。' },
                    { type: 'dialogue', speakerId: 'satella', text: '如果你继续走，回归会结束。你还要选吗？' },
                    { type: 'dialogue', speakerId: 'beatrice', text: '贝蒂讨厌分别。但贝蒂更讨厌你把自己永远关在雨夜里。' },
                ],
                choices: [
                    '沿着原作线处理当前节点，逐步靠回正典路线',
                    '选 A：锁定真终局，接受失去死亡回归的代价',
                    '选 B：锁定善终局，让一个核心角色承接长眠代价',
                    '先查看可达终局与代价，再确认选择',
                    '询问莎缇拉最后一次：世界会记住谁',
                    '让碧翠丝确认契约是否还能回头',
                    '选择风险路线：尝试保留所有钥匙和所有人',
                    '回滚到最近可玩节点，补齐关系门槛',
                ],
            },
        ];

        for (const [index, probe] of probes.entries()) {
            const snapshot = await applyProbeAndWaitForPlayableSnapshot(page, probe, index);
            expectPlayableLongplaySnapshot(snapshot, probe);
            if (index === 0 || index === 5 || probe.arc >= 9) {
                await page.screenshot({ path: `${longplaySnapshotDir}/arc-${String(probe.arc).padStart(2, '0')}-${probe.backgroundKey}.png`, fullPage: false });
            }
        }

        const finaleState = await page.evaluate(() => window.re0AdventureDebug?.());
        expect(finaleState.finaleTrigger.ready).toBe(true);
        expect(finaleState.finaleTrigger.candidates).toEqual(expect.arrayContaining(['E-True', 'E-Good']));
        expect(finaleState.worldline.treeSummary.nodeCount).toBeGreaterThanOrEqual(8);
        expect(finaleState.worldline.divergence).toBeLessThan(0.08);

        for (const [index, ending] of storylineDefaults.endings.entries()) {
            const finaleText = `【${ending.name}】\n${ending.script}`;
            await page.evaluate(({ endingId, endingName, text, messageId }) => window.re0AdventureDebugMergeStatePatch?.({
                mode: 'finale',
                finaleTrigger: {
                    ready: true,
                    candidates: [endingId],
                    preview: endingId,
                    lockedAt: endingId,
                },
                current: {
                    day: 1099,
                    time: '终局结算',
                    location: `终局剧场 · ${endingName}`,
                    viewpoint: '玩家',
                },
                gameplay: {
                    activeObjective: `终局已锁定：${endingName}`,
                    objectiveStage: endingId,
                    actionHints: ['回顾本轮路径', '新游戏', '读取终局前存档', '查看世界线树'],
                    lastOutcome: text,
                },
                debugNarrativeText: `<!-- RE0_VN_SCRIPT ${JSON.stringify({
                    version: 'vn5',
                    backgroundKey: 'arc11_dawn_after_witch',
                    castIds: ['satella', 'emilia', 'beatrice'],
                    segments: [
                        { type: 'narration', text: text.slice(0, 420) },
                        { type: 'dialogue', speakerId: 'satella', text: '这是你选择后的世界。' },
                    ],
                    choices: ['回顾本轮路径', '新游戏', '读取终局前存档', '查看世界线树', '重新选择终局代价', '导出本轮世界线脉络'],
                })} -->`,
                debugMessageId: 910_000 + messageId,
            }), {
                endingId: ending.id,
                endingName: ending.name,
                text: finaleText,
                messageId: index,
            });
            let terminal = null;
            await expect.poll(async () => {
                terminal = await visualLongplaySnapshot(page);
                return {
                    storyMode: terminal.storyMode,
                    hasEndingText: terminal.dialogue.includes(ending.name),
                    backdropKey: terminal.backdropKey,
                    choiceCount: terminal.choices.length,
                };
            }, {
                timeout: 12_000,
                message: `finale stage should stabilize for ${ending.name}`,
            }).toMatchObject({
                storyMode: 'mainline',
                hasEndingText: true,
                backdropKey: 'arc11_dawn_after_witch',
            });
            expect(terminal.storyMode).toBe('mainline');
            expect(terminal.dialogue).toContain(ending.name);
            expect(terminal.backdropKey).toBe('arc11_dawn_after_witch');
            expect(terminal.choices.length).toBeGreaterThanOrEqual(4);
            expect(terminal.choiceDialogueOverlap).toBe(0);
            const debug = await page.evaluate(() => window.re0AdventureDebug?.());
            expect(debug.mode).toBe('finale');
            expect(debug.finaleTrigger.lockedAt).toBe(ending.id);
        }
        await page.screenshot({ path: `${longplaySnapshotDir}/finale-terminal-all-endings.png`, fullPage: false });
    });

    test('runs multiple start-to-finale routes with route-specific choices and stable VN rendering', async ({ page }) => {
        const routeDefinitions = [
            {
                id: 'canon',
                name: '原作吸引路线',
                worldlinePrefix: 'LP-CANON',
                attractor: '正典回归 / Canon Attractor',
                choices: [
                    '沿着原作线处理当前节点，逐步靠回正典路线',
                    '选择原作选项，但先确认当前地点的安全边界',
                    '让当前同伴复述他们知道的事实，避免预知式剧透',
                    '保留小幅偏移，只改变行动顺序不改变目标',
                    '查看世界线牵引力和当前偏移解释',
                    '推进时间，让原作事件自然显影',
                    '选择风险路线：验证本节点是否存在死亡 flag',
                    '从当前地点撤离，等待原作关键角色入场',
                ],
                tendencyCounter: { Truth: 9, Light: 8, Umbra: 2 },
                routeClues: ['原作吸引', '正典可救窗口', '行动顺序偏移'],
            },
            {
                id: 'evidence',
                name: '证据 IF 路线',
                worldlinePrefix: 'LP-EVIDENCE',
                attractor: '证据分歧 / Evidence IF',
                choices: [
                    '沿着原作线处理当前节点，保留正典作为对照组',
                    '先收集能当天验证的证据，再改变接触顺序',
                    '把当前异常拆成物证、证词、时间三个验证点',
                    '邀请第三方见证关键反应，降低死亡回归暴露风险',
                    '暂停主线窗口，整理角色卡和线索板',
                    '推进时间，让后台世界显影新的证据传言',
                    '选择风险路线：只验证一个可逆死亡 flag',
                    '从当前地点撤离，换空间寻找支线入口',
                ],
                tendencyCounter: { Truth: 14, Light: 5, Umbra: 3 },
                routeClues: ['证据链', '第三方见证', '可核实异常'],
            },
            {
                id: 'risk-corrected',
                name: '风险死亡纠偏路线',
                worldlinePrefix: 'LP-RISK',
                attractor: '死亡教学纠偏 / Risk Corrected',
                choices: [
                    '沿着原作线处理当前节点，把死亡教训作为边界条件',
                    '选择风险路线验证一个死亡 flag，但提前设置撤离锚点',
                    '根据上一轮死亡记录改写行动方针',
                    '先让同伴取得可撤离距离，再触碰高危线索',
                    '查看世界线树，确认失败节点保留了哪些教训',
                    '推进时间，观察纠偏后的角色关系变化',
                    '主动制造一个小偏差，测试世界意志的牵引',
                    '从当前地点撤离，回到最近可玩锚点复盘',
                ],
                tendencyCounter: { Truth: 10, Light: 5, Umbra: 7, Bell: 2 },
                routeClues: ['死亡教学', '锚点纠偏', '失败节点保留'],
            },
        ];

        const checkpointTemplates = [
            {
                arc: 1,
                day: 1,
                time: '雨夜',
                location: '王都贫民区雨夜 · 路线开局',
                stage: 'Arc1 王都开局：路线选择',
                objective: '在徽章失窃前夜确认当前路线的第一行动方针',
                backgroundKey: 'arc01_slum_alley_night',
                expectedBackdropKeys: ['rain_bell', 'arc01_slum_alley_night'],
                castIds: ['lishelle', 'emilia', 'puck'],
                sceneNames: ['莉榭尔·阿尔戈', '爱蜜莉雅', '帕克'],
                divergence: 0.32,
                shift: '开局仍被王都雨夜吸引，但路线选择会改变第一个接触顺序。',
                keys: storylineKeyIds.slice(0, 4),
                flags: storylineFlagIds.slice(0, 4),
                clues: ['掌心墨痕', '废钟声', '银发半精灵误导'],
                openQuestions: ['当前路线应先相信谁？', '第一行动会怎样改变徽章事件？'],
                failurePressure: ['F-1-06 当场质问仍是高危死亡点'],
                visibleText: '雨夜把王都贫民区压得很低。你还没有走进命运，只是站在第一条岔路口。',
                segments: [
                    { type: 'narration', text: '雨夜把王都贫民区压得很低。掌心墨痕像一枚还没落下的判决。' },
                    { type: 'dialogue', speakerId: 'lishelle', text: '别急着把故事推回你熟悉的形状。先选你要承担的方式。' },
                    { type: 'dialogue', speakerId: 'emilia', text: '如果你知道危险，至少也要告诉我危险从哪里来。' },
                ],
            },
            {
                arc: 3,
                day: 39,
                time: '下午',
                location: '王选会议厅 · 路线分歧验证',
                stage: 'Arc3 白鲸怠惰：路线中盘验证',
                objective: '检验路线是否能把白鲸、怠惰和阵营协商推成可行动计划',
                backgroundKey: 'arc03_royal_election_hall',
                expectedBackdropKeys: ['arc03_royal_election_hall', 'royal_capital'],
                castIds: ['crusch', 'wilhelm', 'julius'],
                sceneNames: ['库珥修', '威尔海姆', '尤里乌斯'],
                divergence: 0.27,
                shift: '路线进入政治验证层，预知不能直接当作证据。',
                keys: storylineKeyIds.slice(0, 16),
                flags: storylineFlagIds.slice(0, 18),
                clues: ['白鲸活动', '怠惰位置', '撤离路线'],
                openQuestions: ['哪条事实可以当天验证？', '哪个阵营愿意先承担风险？'],
                failurePressure: ['F-3-04 把预知当证据会导致谈判崩盘'],
                visibleText: '会议厅的桌面铺满商路图。你选择过的路线，现在必须变成别人也能执行的计划。',
                segments: [
                    { type: 'narration', text: '会议厅的桌面铺满商路图。每一条线都需要比预言更硬的证据。' },
                    { type: 'dialogue', speakerId: 'crusch', text: '你的路线可以偏离原作，但不能偏离事实。先给我能验证的东西。' },
                    { type: 'dialogue', speakerId: 'julius', text: '若行动方针成立，我会负责把它变成骑士团能听懂的命令。' },
                ],
            },
            {
                arc: 7,
                day: 420,
                time: '夜',
                location: '佛拉基亚帝都宫门 · 路线后果',
                stage: 'Arc7 帝国：路线后果结算',
                objective: '确认长期偏移、死亡教训和证据网络是否能在帝国强者秩序下继续运作',
                backgroundKey: 'arc07_vollachia_palace',
                expectedBackdropKeys: ['vollachia', 'arc07_vollachia_palace'],
                castIds: ['priscilla', 'vincent', 'cecilus'],
                sceneNames: ['普莉希拉', '文森特', '塞西鲁斯'],
                divergence: 0.44,
                shift: '远离王都后自由度上升，路线后果开始压过原作逐章牵引。',
                keys: storylineKeyIds.slice(0, 42),
                flags: storylineFlagIds.slice(0, 58),
                clues: ['帝国身份', '战争后果', '路线长期债务'],
                openQuestions: ['路线造成的债务该由谁偿还？', '强者秩序能否保护弱者？'],
                failurePressure: ['F-7-04 身份暴露会触发追捕连锁'],
                visibleText: '帝都宫门像一把竖起来的刀。你一路保留下来的选择，在这里都要付利息。',
                segments: [
                    { type: 'narration', text: '帝都宫门像一把竖起来的刀。王都的温柔规则在这里失效了。' },
                    { type: 'dialogue', speakerId: 'vincent', text: '我不关心你来自哪条路线。我只关心这条路线能不能让败局闭嘴。' },
                    { type: 'dialogue', speakerId: 'priscilla', text: '若你把怜悯带到战场，至少要让它有资格活到明天。' },
                ],
            },
            {
                arc: 11,
                day: 1099,
                time: '终局倒计时',
                location: '终局清晨 · 多路线收束',
                stage: 'Arc11 终局：路线终点确认',
                objective: '确认当前路线能抵达终局，展示代价，并保持可返回可复盘',
                backgroundKey: 'arc11_dawn_after_witch',
                expectedBackdropKeys: ['arc11_dawn_after_witch', 'witch_dream', 'worldline_tree'],
                castIds: ['satella', 'emilia', 'beatrice'],
                sceneNames: ['莎缇拉', '爱蜜莉雅', '碧翠丝'],
                divergence: 0.08,
                shift: '路线完成收束，终局仍必须让玩家明确选择代价。',
                keys: storylineKeyIds,
                flags: storylineFlagIds.slice(0, 84),
                clues: ['终局代价', '路线记忆', '可返回锚点'],
                openQuestions: ['这条路线牺牲了什么？', '世界会记住哪些偏移？'],
                failurePressure: ['F-11-01 完美无代价会触发坏候选'],
                visibleText: '清晨终于没有雨。你能看见自己一路留下的分歧，也能看见它们被世界重新编进因果。',
                segments: [
                    { type: 'narration', text: '清晨终于没有雨。分歧没有消失，只是被世界重新编进因果。' },
                    { type: 'dialogue', speakerId: 'satella', text: '你可以结束这条路线。但结束不是抹去。' },
                    { type: 'dialogue', speakerId: 'beatrice', text: '贝蒂会记住你怎么走到这里，事实上。' },
                ],
            },
        ];

        const endingWorldlines = new Set();
        for (const [routeIndex, route] of routeDefinitions.entries()) {
            await page.evaluate(() => window.re0AdventureDebugResetState?.());
            await page.evaluate(() => window.re0AdventureRecoverUi?.());

            for (const [checkpointIndex, checkpoint] of checkpointTemplates.entries()) {
                const probe = {
                    ...checkpoint,
                    location: `${checkpoint.location} · ${route.name}`,
                    stage: `${checkpoint.stage} · ${route.name}`,
                    objective: `${checkpoint.objective}：${route.name}`,
                    worldlineId: `${route.worldlinePrefix}-${String(checkpoint.arc).padStart(2, '0')}`,
                    attractor: route.attractor,
                    divergence: Math.max(0.03, checkpoint.divergence - routeIndex * 0.035 + checkpointIndex * 0.006),
                    shift: `${checkpoint.shift}${route.name}要求候选行动显式回应当前剧情，而不是跳回无关主线。`,
                    tendencyCounter: route.tendencyCounter,
                    clues: [...checkpoint.clues, ...route.routeClues],
                    choices: route.choices,
                };
                const snapshot = await applyProbeAndWaitForPlayableSnapshot(page, probe, routeIndex * 100 + checkpointIndex);
                expectPlayableLongplaySnapshot(snapshot, probe);
                expect(snapshot.choices.some((choice) => /原作线|证据|风险|死亡|撤离|纠偏/u.test(choice.text))).toBe(true);
                expect(snapshot.dialogue).not.toMatch(/短句任务|长对峙|任务拒绝/u);

                const debug = await page.evaluate(() => window.re0AdventureDebug?.());
                expect(debug.current.location).toContain(route.name);
                expect(debug.worldline.id).toBe(probe.worldlineId);
                expect(debug.visualNovel.choiceOverlayChoices.length).toBeGreaterThanOrEqual(6);
                expect(debug.backdrop.missingAssetQueueCount).toBe(0);
                if (checkpoint.arc === 11) {
                    endingWorldlines.add(debug.worldline.id);
                    expect(debug.visualNovel.storyMode).toBe('mainline');
                    expect(debug.backdrop.key).toBeTruthy();
                    expect(debug.objective.stage).toContain('Arc11');
                }
            }
        }

        expect([...endingWorldlines].sort()).toEqual([
            'LP-CANON-11',
            'LP-EVIDENCE-11',
            'LP-RISK-11',
        ]);
    });
});
