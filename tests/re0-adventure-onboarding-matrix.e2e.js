/* global document, window, HTMLMediaElement */

import { test, expect } from '@playwright/test';

test.use({ channel: 'chrome' });
test.setTimeout(120_000);

const openingCases = [
    {
        id: 'canon-royal-capital',
        setupText: '路线：原作开局 姓名：原作因果模板 性别：男性 外貌：雨夜黑衣异乡人 性格：莽撞救人型 能力：死亡残响读解 出身：异世界召唤者 出生点：王都主街初召唤 初始NPC：爱蜜莉雅 初始剧情：徽章失窃目击者 特质：异常观察力,濒死反射 混沌：低混沌 补充设定：优先观察徽章失窃链条，保留追随原作的候选行动。',
        expected: {
            route: '原作开局',
            gender: '男性',
            appearance: '雨夜黑衣异乡人',
            personality: '莽撞救人型',
            ability: '死亡残响读解',
            traits: ['异常观察力', '濒死反射'],
            chaos: '低混沌',
            notes: '优先观察徽章失窃链条，保留追随原作的候选行动。',
            protagonist: '原作因果模板',
            origin: '异世界召唤者',
            birthplace: '王都主街初召唤',
            locationPattern: /王都主街|主街|王都|徽章/,
            npc: '爱蜜莉雅',
            scenario: '徽章失窃目击者',
            choicePattern: /徽章|银发|菲鲁特|盗品蔵|追随原作/,
            ragProbe: '王都主街 徽章失窃 爱蜜莉雅 菲鲁特 盗品蔵',
        },
    },
    {
        id: 'original-slum-rain',
        setupText: '路线：原创默认开局 姓名：内测员零 性别：未声明 / 由玩家自定 外貌：雨夜黑衣异乡人 性格：冷静观察型 能力：死亡残响读解 出身：现代图书管理员，会急救，熟悉旧书档案和夜班巡查 出生点：王都贫民区雨夜 初始NPC：莉榭尔·阿尔戈 初始剧情：掌心警告开局 特质：异常观察力,痛觉记忆强化 混沌：中混沌 补充设定：不直接追原作主街，先围绕废钟、雨水、掌心文字和莉榭尔做低风险取证。',
        expected: {
            route: '原创默认开局',
            gender: '未声明 / 由玩家自定',
            appearance: '雨夜黑衣异乡人',
            personality: '冷静观察型',
            ability: '死亡残响读解',
            traits: ['异常观察力', '痛觉记忆强化'],
            chaos: '中混沌',
            notes: '不直接追原作主街，先围绕废钟、雨水、掌心文字和莉榭尔做低风险取证。',
            protagonist: '内测员零',
            origin: '现代图书管理员',
            birthplace: '王都贫民区雨夜',
            locationPattern: /王都贫民区|废钟|雨夜/,
            npc: '莉榭尔',
            scenario: '掌心警告',
            choicePattern: /莉榭尔|掌心|雨|贫民区|废钟|可验证/,
            ragProbe: '王都贫民区 雨夜 莉榭尔 掌心警告 废钟',
        },
    },
    {
        id: 'kararagi-trader',
        setupText: '路线：架空开局 姓名：诺亚·格雷 性别：男性 外貌：行商学徒伪装 性格：街巷求生型 能力：锚点直觉 出身：卡拉拉基行商学徒 出生点：卡拉拉基商路 初始NPC：奥托·苏文 初始剧情：债务烙印 特质：交易直觉,异常观察力 混沌：中混沌 补充设定：主线从商路资源、路引、债务和王都情报网切入，不应立刻跳到盗品蔵夜战。',
        expected: {
            route: '架空开局',
            gender: '男性',
            appearance: '行商学徒伪装',
            personality: '街巷求生型',
            ability: '锚点直觉',
            traits: ['交易直觉', '异常观察力'],
            chaos: '中混沌',
            notes: '主线从商路资源、路引、债务和王都情报网切入，不应立刻跳到盗品蔵夜战。',
            protagonist: '诺亚·格雷',
            origin: '卡拉拉基行商学徒',
            birthplace: '卡拉拉基商路',
            locationPattern: /卡拉拉基|商路/,
            npc: '奥托',
            scenario: '债务烙印',
            choicePattern: /商路|奥托|路引|债务|货币|王都/,
            ragProbe: '卡拉拉基 商路 奥托 债务 王都情报',
        },
    },
    {
        id: 'custom-archive-room',
        setupText: '路线：完全自定义开局 姓名：档案见证人 性别：女性 外貌：银痕梦魇相 性格：冷静观察型 能力：微弱玛那视 出身：王都旧档案馆临时抄写员，知道四百年前传承断裂但不确定真伪 出生点：王都旧档案室 初始NPC：菲鲁特 初始剧情：被抹除档案 特质：异常观察力,交易直觉 混沌：高混沌 补充设定：当前目标是判断档案缺页、菲鲁特来意和王选暗流之间的因果，不允许强行跳回原作第一夜。',
        expected: {
            route: '完全自定义开局',
            gender: '女性',
            appearance: '银痕梦魇相',
            personality: '冷静观察型',
            ability: '微弱玛那视',
            traits: ['异常观察力', '交易直觉'],
            chaos: '高混沌',
            notes: '当前目标是判断档案缺页、菲鲁特来意和王选暗流之间的因果，不允许强行跳回原作第一夜。',
            protagonist: '档案见证人',
            origin: '王都旧档案馆临时抄写员',
            birthplace: '王都旧档案室',
            locationPattern: /王都旧档案|旧档案室|档案/,
            npc: '菲鲁特',
            scenario: '被抹除档案',
            choicePattern: /档案|菲鲁特|缺页|四百年前|王选|可验证/,
            ragProbe: '王都旧档案室 菲鲁特 被抹除档案 四百年前 王选',
        },
    },
    {
        id: 'high-chaos-body-custom',
        setupText: '路线：完全自定义开局 姓名：玻璃锚 性别：自定义性别/身体设定 外貌：银痕梦魇相 性格：谨慎共情型 能力：锚点直觉 出身：魔女教事件幸存者，记忆残缺，只能通过气味、伤口和他人反应复原真相 出生点：阿拉姆村外道路 初始NPC：蕾姆 初始剧情：迷雾脚印 特质：痛觉记忆强化,异常观察力 混沌：高混沌 补充设定：玩家身体设定需要被尊重，候选行动应围绕村外道路、雾、蕾姆的警戒和幸存者身份推理。',
        expected: {
            route: '完全自定义开局',
            gender: '自定义性别/身体设定',
            appearance: '银痕梦魇相',
            personality: '谨慎共情型',
            ability: '锚点直觉',
            traits: ['痛觉记忆强化', '异常观察力'],
            chaos: '高混沌',
            notes: '玩家身体设定需要被尊重，候选行动应围绕村外道路、雾、蕾姆的警戒和幸存者身份推理。',
            protagonist: '玻璃锚',
            origin: '魔女教事件幸存者',
            birthplace: '阿拉姆村外道路',
            locationPattern: /阿拉姆|村外|道路|迷雾/,
            npc: '蕾姆',
            scenario: '迷雾脚印',
            choicePattern: /阿拉姆|蕾姆|迷雾|脚印|幸存者|警戒/,
            ragProbe: '阿拉姆村外道路 蕾姆 迷雾脚印 魔女教 幸存者',
        },
    },
];

async function installMediaMocks(page) {
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
}

async function bootFreshSetup(page, id) {
    await installMediaMocks(page);
    await page.goto(`/?re0_recover=1&api_guard=1&e2e=opening-matrix-${id}-${Date.now()}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => typeof window.re0AdventureDebug === 'function', null, { timeout: 20_000 });
    await page.waitForFunction(() => typeof window.re0AdventureDebugResetState === 'function'
        && typeof window.re0AdventureDebugStartSetup === 'function'
        && typeof window.re0AdventureDebugApplySetupText === 'function'
        && typeof window.re0AdventureDebugImportState === 'function'
        && typeof window.re0AdventureDebugStartWorldWithSetup === 'function'
        && typeof window.re0AdventureDebugExportState === 'function'
        && typeof window.re0AdventureDebugStoryRag === 'function'
        && typeof window.re0AdventureDebugPlayLoopChoices === 'function', null, { timeout: 20_000 });
    await page.evaluate(() => window.re0AdventureDebugResetState?.());
    await page.evaluate(() => window.re0AdventureRecoverUi?.());
    await page.waitForFunction(() => window.re0AdventureDebug?.()?.ok === true, null, { timeout: 20_000 });
    await page.evaluate(() => window.re0AdventureDebugStartSetup?.());
    await page.waitForFunction(() => window.re0AdventureDebugExportState?.().mode === 'setup', null, { timeout: 10_000 });
}

async function applySetupAndStart(page, scenario) {
    const result = await page.evaluate((openingScenario) => {
        return window.re0AdventureDebugStartWorldWithSetup?.({
            routePreset: openingScenario.expected.route,
            protagonistName: openingScenario.expected.protagonist,
            gender: openingScenario.expected.gender,
            appearance: openingScenario.expected.appearance,
            personality: openingScenario.expected.personality,
            ability: openingScenario.expected.ability,
            origin: openingScenario.expected.origin,
            birthplace: openingScenario.expected.birthplace,
            firstNpc: openingScenario.expected.npc,
            initialScenario: openingScenario.expected.scenario,
            traits: openingScenario.expected.traits,
            chaosLevel: openingScenario.expected.chaos,
            customProfileNotes: openingScenario.expected.notes,
        });
    }, scenario);
    expect(result?.handled).toBe(true);
    expect(result?.setup?.routePreset || '').toContain(scenario.expected.route);
    expect(result?.setup?.protagonistName || '').toContain(scenario.expected.protagonist);
    await page.waitForFunction(() => {
        const state = window.re0AdventureDebugExportState?.();
        return state?.mode === 'main' && state?.setup?.phase === 'locked' && state?.gameplay?.activeObjective;
    }, null, { timeout: 10_000 });
}

async function inspectOpeningStability(page, scenario) {
    await page.waitForFunction(() => {
        const choices = window.re0AdventureDebugPlayLoopChoices?.(8)?.choices || [];
        return choices.length >= 4;
    }, null, { timeout: 10_000 });

    const inspection = await page.evaluate((probe) => {
        const state = window.re0AdventureDebugExportState?.();
        const debug = window.re0AdventureDebug?.();
        const playLoop = window.re0AdventureDebugPlayLoopChoices?.(8);
        const rag = window.re0AdventureDebugStoryRag?.(probe);
        const choiceText = [
            ...(playLoop?.choices || []),
            ...(debug?.visualNovel?.choiceOverlayChoices || []),
            ...(debug?.visualNovel?.choicePoolPreview || []),
        ].join('\n');
        return {
            state,
            debug,
            playLoop,
            rag,
            choiceText,
            choiceCount: playLoop?.choices?.length || 0,
        };
    }, scenario.expected.ragProbe);

    const { state, debug, choiceText, rag } = inspection;
    expect(state.mode).toBe('main');
    expect(state.setup.phase).toBe('locked');
    expect(state.setup.routePreset).toContain(scenario.expected.route);
    expect(state.setup.protagonistName).toContain(scenario.expected.protagonist);
    expect(state.setup.origin).toContain(scenario.expected.origin);
    expect(state.setup.birthplace).toContain(scenario.expected.birthplace);
    expect(state.setup.firstNpc).toContain(scenario.expected.npc);
    expect(state.setup.initialScenario).toContain(scenario.expected.scenario);
    expect(state.protagonistProfile?.name).toContain(scenario.expected.protagonist);
    expect(state.protagonistProfile?.origin).toContain(scenario.expected.origin);
    expect(state.current?.location || '').toMatch(scenario.expected.locationPattern);
    expect(state.gameplay?.activeObjective || '').toMatch(scenario.expected.locationPattern);
    expect((state.gameplay?.openQuestions || []).join('\n')).toContain(scenario.expected.npc);
    expect((state.gameplay?.actionHints || []).join('\n')).toMatch(scenario.expected.choicePattern);
    expect(choiceText).toMatch(scenario.expected.choicePattern);
    expect(debug?.visualNovel?.scriptSource || '').not.toBe('none');
    expect(rag?.health?.status).toBe('pass');
    expect(rag?.health?.chunks || 0).toBeGreaterThan(0);
    expect(rag?.summary || '').not.toHaveLength(0);
}

async function applyFirstActionProbe(page, scenario) {
    const action = `按当前开局低风险推进：${scenario.expected.ragProbe}；先确认一个可验证线索，不跳跃到无关原作节点。`;
    await page.evaluate((text) => {
        const snapshot = window.re0AdventureDebugExportState?.();
        window.re0AdventureDebugMergeStatePatch?.({
            setup: snapshot.setup,
            protagonistProfile: snapshot.protagonistProfile,
            current: snapshot.current,
            gameplay: {
                ...(snapshot.gameplay || {}),
                lastPlayerAction: text,
                lastOutcome: `玩家选择围绕 ${text} 做近距离取证。`,
                activeObjective: `继续围绕 ${text} 推进第一幕，不改写建档底盘。`,
                actionHints: [
                    text,
                    '保持场景连续：先让角色看见、听见或触碰到当前线索，再进入下一段推理。',
                    '候选行动必须回应当前地点、初始NPC和初始剧情钩子。',
                ],
            },
        });
    }, action);

    await page.waitForFunction(() => {
        const debug = window.re0AdventureDebug?.();
        return debug?.visualNovel?.choiceOverlayChoices?.length >= 4
            || window.re0AdventureDebugPlayLoopChoices?.(8)?.choices?.length >= 4;
    }, null, { timeout: 10_000 });

    const after = await page.evaluate((probe) => {
        const state = window.re0AdventureDebugExportState?.();
        const playLoop = window.re0AdventureDebugPlayLoopChoices?.(8);
        const rag = window.re0AdventureDebugStoryRag?.(probe);
        return {
            state,
            choices: playLoop?.choices || [],
            ragSummary: rag?.summary || '',
        };
    }, scenario.expected.ragProbe);

    expect(after.state.setup.origin).toContain(scenario.expected.origin);
    expect(after.state.current.location).toContain(scenario.expected.birthplace);
    expect(after.state.gameplay.lastPlayerAction).toContain(scenario.expected.ragProbe);
    expect(after.choices.join('\n')).toMatch(scenario.expected.choicePattern);
    expect(after.ragSummary).not.toHaveLength(0);
}

test.describe('Re:0 adventure free-opening stability matrix', () => {
    for (const scenario of openingCases) {
        test(`keeps later candidates grounded for ${scenario.id}`, async ({ page }) => {
            await bootFreshSetup(page, scenario.id);
            await applySetupAndStart(page, scenario);
            await inspectOpeningStability(page, scenario);
            await applyFirstActionProbe(page, scenario);
        });
    }
});
