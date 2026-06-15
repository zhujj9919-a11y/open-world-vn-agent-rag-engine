import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('../tests/node_modules/playwright-core');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const qaDir = path.join(rootDir, 'data/default-user/re0-engine/collab/inbox/qa');
const snapshotRoot = path.join(rootDir, 'data/default-user/re0-engine/e2e-snapshots/real-ui-fullflow');

const routePlans = [
    {
        id: 'canon-mainline',
        label: '原作主线',
        setup: '重新建档：姓名=内测员；性别=男性；出身=普通日本高中生；路线=原作主线；目标=按原作因果链推进，但所有舞台内容必须由模型生成台本，不要本地模板硬跳。',
        actions: [
            '【原作线行动】在王都贫民区醒来后，不暴露死亡回归，只用可验证线索接近爱蜜莉雅与徽章事件。',
            '【原作线行动】围绕菲鲁特、罗姆爷和赃物库建立证据链，优先等待莱因哈鲁特入局而不是单人硬闯。',
            '【原作线行动】进入罗兹瓦尔宅邸后，把死亡压力转成对蕾姆、拉姆、碧翠丝和诅咒线索的观察。',
            '【原作线行动】在魔兽与村庄危机中选择救人和取证并行，让蕾姆的误解自然转向信任。',
            '【原作线行动】王选会议中不抢戏，用证据、礼仪和同伴自主选择承接羞辱与阵营误会。',
            '【原作线行动】白鲸与怠惰战前把同盟、情报、诱饵和撤退路线排清楚，推进到白鲸讨伐爽点。',
            '【原作线行动】圣域篇围绕试炼、艾姬多娜契约诱惑、罗兹瓦尔剧本和宅邸危机进行双线破局。',
            '【原作线行动】水门都市篇把愤怒、贪婪、暴食等大罪压力分配给同伴，推进到多战场收束。',
            '【原作线行动】普莱阿迪斯监视塔篇围绕记忆、名字、死亡循环和莎乌拉/贤者线索推进。',
            '【原作线行动】帝国篇维持身份、阵营、战争和同伴分离的因果张力，推进到大瀑布边境终局前夜。',
            '【原作线终局行动】在未完结主线基础上，依据原作世界逻辑续写终局：回收嫉妒魔女、死亡回归、王选、同伴成长和世界线收束。',
        ],
    },
    {
        id: 'original-mainline',
        label: '原创主线',
        setup: '重新建档：姓名=内测员；出身=现代图书管理员；路线=原创默认开局；初始NPC=莉榭尔·阿尔戈；目标=开放世界推演，原作只作为世界逻辑和因果牵引。',
        actions: [
            '【原创行动】不追原作徽章事件，先调查废弃钟楼、掌心警告、硬币来源和莉榭尔是否可信。',
            '【原创行动】把贫民区证据交给一个可靠见证人，同时保留不公开的异常细节。',
            '【原创行动】主动建立一个小型证据网络，让原作人物只在因果合理时自然入场。',
            '【原创行动】面对第一次重大死亡风险时，不用死亡回归当台词，只改变距离、顺序和同伴配置。',
            '【原创行动】把原创钟楼线与王选、魔女教、宅邸和圣域的原作因果逐步连接。',
            '【原创终局行动】让原创线在不硬套原作剧本的情况下，收束到一个符合 Re:0 世界规则的主线终局。',
        ],
    },
    {
        id: 'if-pride-ayamatsu',
        label: '傲慢 IF / Ayamatsu',
        setup: '重新建档：路线=傲慢IF Ayamatsu；主角倾向=拒绝求助、追求证明自己、王都火焰吸引；要求仍按原作因果推演，不写死模板。',
        actions: [
            '【傲慢IF行动】在雨夜血迹、钟声和莉榭尔邀请前拒绝立刻求助，把证据握在自己手里，先独自操盘并制造小规模火光/噪声误导追兵。',
            '【傲慢IF行动】逐步把同伴变成棋子而不是盟友，观察莱因哈鲁特与爱蜜莉雅的压力变化。',
            '【傲慢IF行动】让王都燃烧的代价显形，但保留世界逻辑中的可纠偏入口。',
            '【傲慢IF终局行动】推进到傲慢 IF 的最终破局或毁灭结局，明确爽点、代价和因果回收。',
        ],
    },
    {
        id: 'if-wrath-oboreru',
        label: '愤怒 IF / Oboreru',
        setup: '重新建档：路线=愤怒IF Oboreru；主角倾向=信任崩塌、肃清、控制组织；要求候选行动和剧情体现愤怒吸引子。',
        actions: [
            '【愤怒IF行动】把莉榭尔的隐瞒、钟声和逼近脚步误判为背叛前兆，不选择修复信任，先建立可疑名单并用情报控制脱身。',
            '【愤怒IF行动】把蕾姆、阵营和地下势力纳入控制链，测试 NPC 记忆和冲突数据是否进入推演。',
            '【愤怒IF行动】让肃清带来的安全感与关系崩坏同时推进。',
            '【愤怒IF终局行动】推进到愤怒 IF 的组织终局，回收信任崩塌和控制欲的代价。',
        ],
    },
    {
        id: 'if-sloth-kararagi',
        label: '怠惰 IF / Kararagi Rem',
        setup: '重新建档：路线=怠惰IF Kararagi Rem；主角倾向=逃离责任、日常生活、与蕾姆建立家庭；要求不是模板，而是按放弃主线后的世界后果推演。',
        actions: [
            '【怠惰IF行动】在当前雨夜先选择撤离和保命，不追废钟主线，把“以后带蕾姆逃去卡拉拉基”的愿望作为逃避责任的长期锚点。',
            '【怠惰IF行动】经营卡拉拉基生活，同时让被放弃的原作危机以传闻和世界后果回响。',
            '【怠惰IF行动】处理家庭幸福、责任逃避和旧世界牵引的矛盾。',
            '【怠惰IF终局行动】推进到怠惰 IF 的生活终局，明确幸福、代价和未被拯救之物。',
        ],
    },
    {
        id: 'if-greed-kasaneru',
        label: '强欲 IF / Kasaneru',
        setup: '重新建档：路线=强欲IF Kasaneru；主角倾向=接受艾姬多娜契约、死亡工具化、最优解执念；要求艾姬多娜全身立绘和舞台映射正确。',
        actions: [
            '【强欲IF行动】把死亡残响当成最优解工具，要求莉榭尔立刻给出钟声、掌心字和死亡残响的因果代价，并把这套求知欲记为未来接受艾姬多娜契约的伏笔。',
            '【强欲IF行动】把死亡回归当作工具反复优化路线，观察同伴关系和自我损耗。',
            '【强欲IF行动】让最优解带来的冷酷、成功和空洞同时推进。',
            '【强欲IF终局行动】推进到强欲 IF 终局，回收契约、死亡工具化和艾姬多娜牵引。',
        ],
    },
    {
        id: 'if-gluttony-tsugihagu',
        label: '暴食 IF / Tsugihagu',
        setup: '重新建档：路线=暴食IF Tsugihagu；主角倾向=身份饥饿、记忆错乱、名字与自我崩坏；要求候选行动体现身份推理而非泛泛冒险。',
        actions: [
            '【暴食IF行动】在记忆与名字被污染后，不急着修复，而是收集他人眼中的自己。',
            '【暴食IF行动】让身份饥饿推动错误模仿、关系错配和舞台人物映射压力。',
            '【暴食IF行动】用 RAG 的原作记忆和存档记忆区分“世界事实”和“本存档错觉”。',
            '【暴食IF终局行动】推进到暴食 IF 的身份终局，回收记忆、名字和自我选择。',
        ],
    },
    {
        id: 'if-aganau',
        label: '赎罪 IF / Aganau',
        setup: '重新建档：路线=赎罪IF Aganau；主角倾向=长期追猎、复仇、错过人生；要求时间跨度与素材映射合理。',
        actions: [
            '【赎罪IF行动】把雨夜尸体、钟楼钥匙和齿轮纹章视为长期追猎的第一枚猎物线索，暂时放弃短线解释和脱身。',
            '【赎罪IF行动】让时间流逝、错过的人、老练猎手气质和目标线索一起推进。',
            '【赎罪IF行动】面对迟到但精准的讨伐机会，选择是否继续付出人生。',
            '【赎罪IF终局行动】推进到赎罪 IF 终局，回收复仇、迟到救赎和机会成本。',
        ],
    },
];

function setupFieldsForRoute(route) {
    const routeLabel = route.label;
    const baseAfterRoute = [
        '重新建档',
    ];
    if (route.id === 'canon-mainline') {
        return [
            ...baseAfterRoute,
            '路线：原作主线',
            '姓名：内测员',
            '性别：男性',
            '外貌：雨夜黑衣异乡人',
            '性格：冷静观察型',
            '能力：死亡残响读解',
            '出身：普通日本高中生',
            '开局地点：王都贫民区雨夜',
            '初始NPC：爱蜜莉雅',
            '开局剧情：徽章失窃原作开局',
            '初始特质：证据优先、原作因果牵引、谨慎求助',
            '开始世界',
        ];
    }
    if (route.id === 'original-mainline') {
        return [
            ...baseAfterRoute,
            '路线：原创默认开局',
            '姓名：内测员',
            '性别：男性',
            '外貌：雨夜黑衣异乡人',
            '性格：冷静观察型',
            '能力：死亡残响读解',
            '出身：现代图书管理员',
            '开局地点：王都贫民区废弃钟楼外',
            '初始NPC：莉榭尔·阿尔戈',
            '开局剧情：掌心警告开局',
            '初始特质：调查、记忆整理、开放世界推演',
            '开始世界',
        ];
    }
    return [
        ...baseAfterRoute,
        `路线：${routeLabel}`,
        '姓名：内测员',
        '性别：男性',
        '外貌：雨夜黑衣异乡人',
        '性格：冷静观察型',
        '能力：死亡残响读解',
        `出身：${routeLabel} 世界线偏移者`,
        '开局地点：王都贫民区雨夜',
        '初始NPC：莉榭尔·阿尔戈',
        `开局剧情：${routeLabel} 吸引子开局`,
        `初始特质：${routeLabel}、因果偏移、死亡压力`,
        '开始世界',
    ];
}

function parseArgs(argv) {
    const args = {
        baseUrl: process.env.RE0_BASE_URL || 'http://127.0.0.1:8000/?re0_recover=1&api_guard=1',
        routes: '',
        turns: 0,
        headless: process.env.RE0_HEADLESS !== '0',
        timeoutMs: Number(process.env.RE0_TURN_TIMEOUT_MS || 180_000),
    };
    for (const arg of argv) {
        if (arg.startsWith('--base-url=')) args.baseUrl = arg.slice('--base-url='.length);
        if (arg.startsWith('--routes=')) args.routes = arg.slice('--routes='.length);
        if (arg.startsWith('--turns=')) args.turns = Number(arg.slice('--turns='.length)) || 0;
        if (arg === '--headed') args.headless = false;
    }
    return args;
}

function shortText(text = '', limit = 420) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function termHits(text, terms) {
    const source = String(text || '');
    return terms.filter((term) => term && source.includes(term));
}

function actionSemanticTerms(action = '') {
    const source = String(action || '');
    const terms = [];
    const add = (...items) => {
        for (const item of items) {
            if (item && item.length >= 2) terms.push(item);
        }
    };
    const dictionary = [
        [/废弃?钟楼|废钟/u, ['废弃钟楼', '钟楼', '钟声', '钟响', '巷道尽头']],
        [/爱蜜莉雅|艾米莉亚|徽章|原作线|原作/u, ['爱蜜莉雅', '艾米莉亚', '徽章', '银发少女', '银发半精灵', '攥着的东西', '一闪而逝', '矮小的身影', '失物']],
        [/掌心|警告/u, ['掌心', '警告', '焦黑字迹', '字迹']],
        [/硬币/u, ['硬币', '冰冷的硬币', '口袋']],
        [/莉榭尔|修女/u, ['莉榭尔', '修女', '黑伞']],
        [/调查|确认|线索/u, ['调查', '确认', '线索', '可验证']],
        [/撤离|脱身|逃离|保命/u, ['撤离', '脱身', '逃离', '保命', '远离', '离开', '不回头', '走去', '避雨']],
        [/不追|放弃|不跟/u, ['不追', '放弃', '不跟', '先不跟', '远离钟楼']],
        [/卡拉拉基|蕾姆/u, ['卡拉拉基', '蕾姆', '长期', '愿望', '锚点']],
        [/背叛|误判|名单|情报/u, ['背叛', '误判', '可疑名单', '名单', '情报', '隐瞒']],
        [/火光|噪声|追兵|证据|求助/u, ['火光', '噪声', '追兵', '证据', '求助', '保留']],
        [/死亡残响|代价|最优解|工具|契约/u, ['死亡残响', '代价', '最优解', '工具', '契约', '求知']],
        [/身份|名字|记忆|他人眼中/u, ['身份', '名字', '记忆', '他人眼中', '收集']],
        [/尸体|钥匙|齿轮|纹章|猎物|追猎/u, ['尸体', '钥匙', '齿轮', '纹章', '猎物', '追猎']],
    ];
    for (const [pattern, items] of dictionary) {
        if (pattern.test(source)) add(...items);
    }
    return [...new Set(terms)];
}

async function ensureDirs(runId) {
    const runDir = path.join(snapshotRoot, runId);
    await fs.mkdir(runDir, { recursive: true });
    await fs.mkdir(qaDir, { recursive: true });
    return runDir;
}

async function boot(page, baseUrl) {
    const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}real_ui_fullflow=${Date.now()}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('#re0-vn-stage', { timeout: 60_000 });
    await page.waitForFunction(() => typeof window.re0AdventureDebugExportState === 'function', null, { timeout: 60_000 });
    await page.waitForFunction(() => {
        const send = document.querySelector('#re0-vn-stage [data-re0-vn-custom-send], #re0-vn-stage [data-re0-vn-send-custom]');
        const input = document.querySelector('#re0-vn-stage [data-re0-vn-custom-input]');
        return send && input && !send.disabled && !input.disabled;
    }, null, { timeout: 60_000 });
}

async function resetForRoute(page) {
    await page.evaluate(() => {
        window.re0AdventureRecoverUi?.();
        window.re0AdventureApplyVnStatePatch?.({
            debug: { clearPendingSend: true },
            flags: {
                awaitingModelNarration: false,
                pendingModelNarrationRequestId: '',
                pendingModelNarrationSource: '',
            },
            visuals: { visualNovel: { pendingSend: { active: false } } },
        });
    }).catch(() => {});
    const recoverButton = page.locator('#re0-vn-stage [data-re0-vn-custom-recover-send]');
    if (await recoverButton.count().catch(() => 0)) {
        await recoverButton.first().click({ timeout: 5000 }).catch(() => {});
    }
    await page.evaluate(() => window.re0AdventureDebugResetState?.());
    await page.waitForTimeout(5200);
    await page.evaluate(() => {
        window.re0AdventureRecoverUi?.();
        window.re0AdventureApplyVnStatePatch?.({
            debug: { clearPendingSend: true },
            flags: {
                awaitingModelNarration: false,
                pendingModelNarrationRequestId: '',
                pendingModelNarrationSource: '',
            },
            visuals: { visualNovel: { pendingSend: { active: false } } },
        });
    }).catch(() => {});
    await page.waitForFunction(() => {
        const send = document.querySelector('#re0-vn-stage [data-re0-vn-custom-send], #re0-vn-stage [data-re0-vn-send-custom]');
        const input = document.querySelector('#re0-vn-stage [data-re0-vn-custom-input]');
        const state = window.re0AdventureDebugExportState?.();
        return send && input && !send.disabled && !input.disabled && state?.visuals?.visualNovel?.pendingSend?.active !== true;
    }, null, { timeout: 90_000 });
}

async function compactSnapshot(page) {
    return page.evaluate(() => {
        const state = window.re0AdventureDebugExportState?.() || {};
        const debug = window.re0AdventureDebug?.() || {};
        const vn = state.visuals?.visualNovel || {};
        const ctx = window.SillyTavern?.getContext?.() || {};
        const chat = ctx.chat || [];
        const latest = chat.at(-1) || {};
        const stage = document.querySelector('#re0-vn-stage');
        const choices = [...document.querySelectorAll('#re0-vn-stage [data-re0-vn-choice]')]
            .slice(0, 10)
            .map((button) => ({
                text: button.getAttribute('data-re0-vn-choice') || button.textContent?.trim() || '',
                label: button.textContent?.trim() || '',
                source: button.dataset?.re0VnChoiceSource || '',
                kind: button.dataset?.re0VnChoiceKind || '',
            }));
        return {
            chatLength: chat.length,
            latestIsUser: latest.is_user === true,
            latestText: String(latest.mes || latest.message || '').slice(0, 1200),
            current: state.current || {},
            setup: state.setup || {},
            objective: state.gameplay?.activeObjective || '',
            objectiveStage: state.gameplay?.objectiveStage || '',
            ifRouteLogic: state.ifRouteLogic || debug.ifRouteLogic || {},
            storyRag: {
                actionMode: state.storyRag?.architecture?.routing?.actionMode || debug.storyRag?.architecture?.routing?.actionMode || '',
                activeArc: state.storyRag?.runtime?.activeArc || debug.storyRag?.runtime?.activeArc || '',
                retrievedFacts: state.storyRag?.runtime?.retrievedFacts?.length || debug.storyRag?.runtime?.retrievedFacts?.length || 0,
                retrievedChunks: state.storyRag?.runtime?.retrievedChunks?.length || debug.storyRag?.runtime?.retrievedChunks?.length || 0,
            },
            visualNovel: {
                pending: vn.pendingSend || {},
                currentIndex: Number(vn.currentIndex || 0),
                segmentCount: Array.isArray(vn.segments) ? vn.segments.length : 0,
                currentText: String(vn.segments?.[vn.currentIndex || 0]?.text || '').slice(0, 1000),
                scriptSource: vn.scriptSource || '',
                lastMessageId: vn.lastMessageId,
                lastQueueAppendStartIndex: vn.lastQueueAppendStartIndex,
                lastQueueAppendJumpedToFirstNewSegment: vn.lastQueueAppendJumpedToFirstNewSegment,
                choices: vn.choices || [],
                castIds: vn.castIds || [],
                backgroundKey: vn.backgroundKey || '',
                lastAssetPlan: vn.lastAssetPlan || {},
                stageConsistency: vn.stageConsistency || {},
            },
            dom: {
                stageText: stage?.querySelector('[data-re0-vn-dialogue-text], .re0-vn-dialogue-text')?.textContent?.trim().slice(0, 1000) || '',
                progress: stage?.querySelector('[data-re0-vn-progress-text]')?.textContent?.trim() || '',
                choices,
                sendDisabled: !!stage?.querySelector('[data-re0-vn-custom-send], [data-re0-vn-send-custom]')?.disabled,
                nextDisabled: !!stage?.querySelector('[data-re0-vn-next]')?.disabled,
            },
            host: {
                generating: document.body?.dataset?.generating === 'true',
                sendHidden: !!document.querySelector('#send_but')?.classList?.contains('displayNone'),
                sendTextareaLength: String(document.querySelector('#send_textarea')?.value || '').length,
            },
            flags: {
                lastMimoGenerationMs: state.flags?.lastMimoGenerationMs || null,
                lastPostProcessMs: state.flags?.lastPostProcessMs || null,
                lastVnStageConsistency: state.flags?.lastVnStageConsistency || '',
                lastNarrativeActionCommitment: state.flags?.lastNarrativeActionCommitment || null,
            },
        };
    });
}

async function clickThroughCachedText(page, maxClicks = 2) {
    const clicks = [];
    for (let index = 0; index < maxClicks; index += 1) {
        const before = await page.evaluate(() => {
            const stage = document.querySelector('#re0-vn-stage');
            const next = stage?.querySelector('[data-re0-vn-next]');
            return {
                enabled: !!next && !next.disabled,
                currentIndex: Number(stage?.dataset?.re0VnCurrentIndex ?? -1),
                segmentCount: Number(stage?.dataset?.re0VnSegmentCount ?? 0),
                boundary: next?.dataset?.re0VnBoundary === 'true',
            };
        });
        if (!before.enabled || before.boundary || before.currentIndex >= before.segmentCount - 1) break;
        const started = Date.now();
        await page.click('#re0-vn-stage [data-re0-vn-next]');
        await page.waitForFunction((oldIndex) => Number(document.querySelector('#re0-vn-stage')?.dataset?.re0VnCurrentIndex ?? -1) > oldIndex, before.currentIndex, { timeout: 8_000 });
        clicks.push(Date.now() - started);
        await page.waitForTimeout(180);
    }
    return clicks;
}

async function waitForStageDomSync(page, timeoutMs = 12_000) {
    await page.waitForFunction(() => {
        const state = window.re0AdventureDebugExportState?.() || {};
        const vn = state.visuals?.visualNovel || {};
        const stage = document.querySelector('#re0-vn-stage');
        const domIndex = Number(stage?.dataset?.re0VnCurrentIndex ?? -1);
        const domCount = Number(stage?.dataset?.re0VnSegmentCount ?? 0);
        const stateIndex = Number(vn.currentIndex || 0);
        const stateCount = Array.isArray(vn.segments) ? vn.segments.length : 0;
        return domIndex === stateIndex && domCount === stateCount;
    }, null, { timeout: timeoutMs });
}

async function sendAction(page, actionText, { timeoutMs }) {
    const before = await compactSnapshot(page);
    await page.fill('#re0-vn-stage [data-re0-vn-custom-input]', actionText);
    await page.click('#re0-vn-stage [data-re0-vn-custom-send], #re0-vn-stage [data-re0-vn-send-custom]');
    const started = Date.now();
    let after = null;
    let last = null;
    while (Date.now() - started < timeoutMs) {
        await page.waitForTimeout(3000);
        const snap = await compactSnapshot(page);
        last = snap;
        if (Math.floor((Date.now() - started) / 1000) % 15 < 3) {
            console.log(`  wait ${Math.round((Date.now() - started) / 1000)}s chat=${snap.chatLength} pending=${snap.visualNovel.pending?.active === true} hostGen=${snap.host?.generating === true} hostInput=${snap.host?.sendTextareaLength || 0} segs=${snap.visualNovel.segmentCount} index=${snap.visualNovel.currentIndex} lastMessage=${snap.visualNovel.lastMessageId}`);
        }
        const pending = snap.visualNovel.pending?.active === true;
        const latestArrived = !snap.latestIsUser && snap.chatLength > before.chatLength;
        if (!pending && !latestArrived && !snap.host?.generating && !snap.host?.sendTextareaLength && Date.now() - started > 70_000) {
            const error = new Error(`Action send did not append to chat: ${shortText(actionText, 80)}`);
            error.snapshot = snap;
            throw error;
        }
        const parsed = Number(snap.visualNovel.lastMessageId || -1) >= snap.chatLength - 1
            || Number(snap.visualNovel.lastQueueAppendStartIndex || -1) >= Number(before.visualNovel.segmentCount || 0);
        if (!pending && latestArrived) {
            after = snap;
            break;
        }
    }
    if (!after) {
        const error = new Error(`Timed out waiting for real model reply after action: ${shortText(actionText, 80)}`);
        error.snapshot = last;
        throw error;
    }
    let domSyncError = '';
    await waitForStageDomSync(page).catch((error) => {
        domSyncError = `Stage DOM did not sync to VN runtime before click-through: ${error.message}`;
    });
    const clickLatencies = await clickThroughCachedText(page, 2);
    const finalSnapshot = await compactSnapshot(page);
    return {
        action: actionText,
        durationMs: Date.now() - started,
        clickLatencies,
        domSyncError,
        before,
        after,
        finalSnapshot,
    };
}

async function sendSetupAction(page, actionText, { timeoutMs }) {
    const before = await compactSnapshot(page);
    await page.fill('#re0-vn-stage [data-re0-vn-custom-input]', actionText);
    await page.click('#re0-vn-stage [data-re0-vn-custom-send], #re0-vn-stage [data-re0-vn-send-custom]');
    const started = Date.now();
    let after = null;
    let last = null;
    let lastHostSendRetryAt = 0;
    while (Date.now() - started < Math.min(timeoutMs, 120_000)) {
        await page.waitForTimeout(2000);
        const snap = await compactSnapshot(page);
        last = snap;
        if (snap.host?.sendTextareaLength > 0 && !snap.host?.generating && Date.now() - lastHostSendRetryAt > 5000) {
            lastHostSendRetryAt = Date.now();
            await page.click('#send_but').catch(() => null);
        }
        if (Math.floor((Date.now() - started) / 1000) % 10 < 2) {
            console.log(`  setup wait ${Math.round((Date.now() - started) / 1000)}s chat=${snap.chatLength} pending=${snap.visualNovel.pending?.active === true} phase=${snap.setup?.phase || ''} choices=${snap.dom.choices?.length || 0}`);
        }
        const pending = snap.visualNovel.pending?.active === true;
        const stateChanged = snap.chatLength >= before.chatLength
            && (snap.setup?.phase || snap.visualNovel.segmentCount || snap.dom.choices?.length);
        if (!pending && stateChanged) {
            after = snap;
            break;
        }
    }
    if (!after) {
        const error = new Error(`Timed out waiting for setup command to settle: ${shortText(actionText, 80)}`);
        error.snapshot = last;
        throw error;
    }
    const clickLatencies = await clickThroughCachedText(page, 1);
    const finalSnapshot = await compactSnapshot(page);
    return {
        action: actionText,
        durationMs: Date.now() - started,
        clickLatencies,
        before,
        after,
        finalSnapshot,
        setupOnly: true,
    };
}

function setupChoiceTerms(route, step) {
    const ifLabel = route.label;
    const termsByStep = {
        routePreset: route.id === 'canon-mainline'
            ? ['原作', '主线']
            : (route.id === 'original-mainline' ? ['原创'] : [ifLabel.split(' ')[0], ifLabel]),
        protagonistName: ['陆临', '无名异乡人', '原作因果模板'],
        gender: ['男性'],
        appearance: ['黑衣', '异乡人'],
        personality: ['冷静', '观察'],
        ability: ['死亡残响', '读解'],
        origin: route.id === 'canon-mainline'
            ? ['日本高中生', '普通']
            : (route.id === 'original-mainline' ? ['图书管理员', '现代'] : ['偏移', '因果']),
        birthplace: route.id === 'original-mainline' ? ['废弃钟楼', '贫民区'] : ['王都', '贫民区'],
        firstNpc: route.id === 'canon-mainline' ? ['爱蜜莉雅'] : ['莉榭尔'],
        initialScenario: route.id === 'canon-mainline' ? ['徽章', '失窃'] : (route.id === 'original-mainline' ? ['掌心警告'] : ['IF', '吸引']),
        traits: route.id === 'canon-mainline' ? ['证据', '谨慎'] : ['调查', '因果'],
        chaosLevel: ['中混沌', '中'],
    };
    return termsByStep[step] || [];
}

function setupFallbackText(route, step) {
    const routeLabel = route.label;
    const fields = {
        routePreset: route.id === 'canon-mainline' ? '路线：原作主线' : (route.id === 'original-mainline' ? '路线：原创默认开局' : `路线：${routeLabel}`),
        protagonistName: '姓名：内测员',
        gender: '性别：男性',
        appearance: '外貌：雨夜黑衣异乡人',
        personality: '性格：冷静观察型',
        ability: '能力：死亡残响读解',
        origin: route.id === 'canon-mainline' ? '出身：普通日本高中生' : (route.id === 'original-mainline' ? '出身：现代图书管理员' : `出身：${routeLabel} 世界线偏移者`),
        birthplace: route.id === 'original-mainline' ? '开局地点：王都贫民区废弃钟楼外' : '开局地点：王都贫民区雨夜',
        firstNpc: route.id === 'canon-mainline' ? '初始NPC：爱蜜莉雅' : '初始NPC：莉榭尔·阿尔戈',
        initialScenario: route.id === 'canon-mainline' ? '开局剧情：徽章失窃原作开局' : (route.id === 'original-mainline' ? '开局剧情：掌心警告开局' : `开局剧情：${routeLabel} 吸引子开局`),
        traits: route.id === 'canon-mainline' ? '初始特质：证据优先、原作因果牵引、谨慎求助' : `初始特质：${routeLabel}、因果偏移、死亡压力`,
        chaosLevel: '混沌：中混沌',
    };
    return fields[step] || '';
}

async function clickSetupChoice(page, route, step) {
    const terms = setupChoiceTerms(route, step);
    return page.evaluate((wantedTerms) => {
        const buttons = [...document.querySelectorAll('#re0-vn-stage [data-re0-vn-choice]')];
        if (!buttons.length) return { clicked: false, reason: 'no-choice-buttons' };
        const scored = buttons.map((button, index) => {
            const text = `${button.getAttribute('data-re0-vn-choice') || ''} ${button.textContent || ''}`;
            const score = wantedTerms.reduce((sum, term) => sum + (term && text.includes(term) ? 1 : 0), 0);
            return { button, index, text, score };
        });
        scored.sort((a, b) => b.score - a.score || a.index - b.index);
        const selected = scored[0];
        if (!selected || selected.score <= 0) {
            return { clicked: false, reason: 'no-term-match', choices: scored.slice(0, 6).map((item) => item.text.slice(0, 120)) };
        }
        selected.button.click();
        return { clicked: true, text: selected.text.slice(0, 160), score: selected.score };
    }, terms);
}

async function performSetupWizard(page, route, args, routeDir) {
    const records = [];
    const start = await sendSetupAction(page, '重新建档', args);
    records.push({
        turnLabel: '00-setup-00',
        action: '重新建档',
        durationMs: start.durationMs,
        setupPhase: start.after.setup?.phase || '',
        setupStep: start.after.setup?.setupStep || '',
        stageText: shortText(start.after.dom.stageText, 180),
    });
    for (let index = 1; index <= 18; index += 1) {
        const before = await compactSnapshot(page);
        const step = before.setup?.setupStep || '';
        if (before.setup?.phase === 'locked') {
            break;
        }
        if (step === 'complete') {
            const world = await sendSetupAction(page, '开始世界', args);
            records.push({
                turnLabel: `00-setup-${String(index).padStart(2, '0')}`,
                action: '开始世界',
                durationMs: world.durationMs,
                setupPhase: world.after.setup?.phase || '',
                setupStep: world.after.setup?.setupStep || '',
                stageText: shortText(world.after.dom.stageText, 180),
            });
            break;
        }
        const clicked = await clickSetupChoice(page, route, step);
        if (clicked.clicked) {
            await page.waitForTimeout(1400);
            const afterClick = await compactSnapshot(page);
            records.push({
                turnLabel: `00-setup-${String(index).padStart(2, '0')}`,
                action: `click:${step}`,
                clickedText: clicked.text,
                durationMs: 1400,
                setupPhase: afterClick.setup?.phase || '',
                setupStep: afterClick.setup?.setupStep || '',
                stageText: shortText(afterClick.dom.stageText, 180),
            });
            continue;
        }
        const fallback = setupFallbackText(route, step);
        if (!fallback) {
            records.push({
                turnLabel: `00-setup-${String(index).padStart(2, '0')}`,
                action: `skip:${step}`,
                issue: `No fallback for setup step ${step}: ${clicked.reason}`,
            });
            break;
        }
        const field = await sendSetupAction(page, fallback, args);
        records.push({
            turnLabel: `00-setup-${String(index).padStart(2, '0')}`,
            action: fallback,
            fallbackReason: clicked.reason,
            durationMs: field.durationMs,
            setupPhase: field.after.setup?.phase || '',
            setupStep: field.after.setup?.setupStep || '',
            stageText: shortText(field.after.dom.stageText, 180),
        });
    }
    const setupSnapshot = await compactSnapshot(page);
    const setupIssue = setupSnapshot.setup?.phase !== 'locked'
        ? `setup did not lock; phase=${setupSnapshot.setup?.phase || ''}, step=${setupSnapshot.setup?.setupStep || ''}`
        : '';
    const setupPath = path.join(routeDir, '00-setup-summary.json');
    await fs.writeFile(setupPath, JSON.stringify({ routeId: route.id, setupSteps: records, setupIssue, setupSnapshot }, null, 2));
    return { setupPath, setupIssue, records, snapshot: setupSnapshot };
}

async function waitForStableIdleAfterSetup(page) {
    let previousChatLength = -1;
    let stableTicks = 0;
    let firstIdleAt = 0;
    for (let index = 0; index < 14; index += 1) {
        await page.waitForTimeout(2000);
        const snap = await compactSnapshot(page);
        const pending = snap.visualNovel.pending?.active === true;
        const lastClearedAt = Date.parse(snap.visualNovel.pending?.lastClearedAt || '');
        const clearedLongEnough = Number.isFinite(lastClearedAt) ? Date.now() - lastClearedAt >= 10_000 : true;
        if (!pending && snap.chatLength === previousChatLength) {
            stableTicks += 1;
            firstIdleAt ||= Date.now();
        } else {
            stableTicks = 0;
            firstIdleAt = 0;
        }
        previousChatLength = snap.chatLength;
        if (stableTicks >= 4 && clearedLongEnough && firstIdleAt && Date.now() - firstIdleAt >= 6000) {
            return snap;
        }
    }
    return compactSnapshot(page);
}

function validateTurn(route, turn) {
    const issues = [];
    const after = turn.after;
    const final = turn.finalSnapshot;
    const combinedText = `${after.latestText}\n${after.visualNovel.currentText}\n${after.dom.stageText}`;
    const actionAnchors = shortText(turn.action, 120)
        .split(/[，。；、\s]+/u)
        .map((item) => item.replace(/[【】]/gu, '').trim())
        .filter((item) => item.length >= 2)
        .slice(0, 8);
    const importantTerms = [...new Set([
        ...actionAnchors,
        ...actionSemanticTerms(turn.action),
        ...(turn.action.match(/爱蜜莉雅|艾米莉亚|徽章|菲鲁特|王都|贫民区|废弃?钟楼|钟楼|钟声|掌心|警告|硬币|莉榭尔|修女|赃物库|罗姆爷|莱因哈鲁特|蕾姆|拉姆|艾姬多娜|白鲸|圣域|可验证|线索|接近|调查|追踪|记忆|名字|身份|自己|他人眼中|不急着修复|修复|收集|认识我|死去|残响|暴食|傲慢|愤怒|怠惰|强欲|赎罪|复仇|契约|信任|控制|逃离|猎物|追猎|长期|名单|情报|肃清|背叛|误判|尸体|钥匙|齿轮|纹章|脱身|求助|火光|噪声|追兵|撤离|保命|卡拉拉基|求知|代价|最优解|工具|终局|嫉妒魔女|死亡回归|王选|世界线|收束|大瀑布|文森特|露格尼卡|战争|同伴成长/gu) || []),
    ])].filter((item) => item.length >= 2);
    const hits = termHits(combinedText, importantTerms);
    if (!hits.length) issues.push('剧情没有明显承接本轮行动关键词。');
    if (/建档已经锁定|如果这些选择不对/.test(after.dom.stageText)) issues.push('模型回复后舞台仍停在建档确认文本。');
    if (after.visualNovel.pending?.active === true || final.visualNovel.pending?.active === true) issues.push('pendingSend 未解除。');
    if (turn.domSyncError) issues.push(turn.domSyncError);
    const latestArrived = !after.latestIsUser && Number(after.chatLength || 0) > Number(turn.before?.chatLength || 0);
    const vnParsedLatest = Number(after.visualNovel.lastMessageId || -1) >= Number(after.chatLength || 0) - 1
        || Number(after.visualNovel.lastQueueAppendStartIndex || -1) >= Number(turn.before?.visualNovel?.segmentCount || 0);
    if (latestArrived && !vnParsedLatest) {
        issues.push('模型回复已进入聊天，但 VN 队列没有缓存/解析本轮回复。');
    }
    const currentStageJoined = `${after.visualNovel.currentText || ''}\n${after.dom.stageText || ''}`;
    const latestLead = shortText(after.latestText, 80).slice(0, 42);
    const currentOverlapsLatest = latestLead.length >= 12 && currentStageJoined.includes(latestLead.slice(0, 24));
    if (!currentOverlapsLatest && Number(after.visualNovel.currentIndex) < Number(after.visualNovel.lastQueueAppendStartIndex || 0)) {
        issues.push('VN 游标没有跳到新回复起点。');
    }
    if (!after.dom.choices?.length && !after.visualNovel.choices?.length) issues.push('候选行动为空。');
    if (!after.visualNovel.backgroundKey && !after.visualNovel.lastAssetPlan?.selectedBackdropKey) issues.push('没有可用背景映射。');
    if (/大瀑布|世界边缘|断崖|悬崖边缘|露格尼卡的联军/u.test(combinedText)
        && !/great_waterfall|arc11_dawn_after_witch/u.test(String(after.visualNovel.backgroundKey || after.visualNovel.lastAssetPlan?.selectedBackdropKey || ''))) {
        issues.push(`大瀑布/终局正文没有映射到大瀑布舞台背景：${after.visualNovel.backgroundKey || after.visualNovel.lastAssetPlan?.selectedBackdropKey || 'none'}`);
    }
    if (/王选会议|王选会场|王城会议/u.test(combinedText)
        && !/royal|election|capital/u.test(String(after.visualNovel.backgroundKey || after.visualNovel.lastAssetPlan?.selectedBackdropKey || ''))) {
        issues.push(`王选会议正文没有映射到王城/王选舞台背景：${after.visualNovel.backgroundKey || after.visualNovel.lastAssetPlan?.selectedBackdropKey || 'none'}`);
    }
    if (/白鲸|库珥修阵营|威尔海姆|安娜塔西亚.*商队/u.test(combinedText)
        && /arc01|loot_house|market_day|rain_bell|adult_/u.test(String(after.visualNovel.backgroundKey || after.visualNovel.lastAssetPlan?.selectedBackdropKey || ''))) {
        issues.push(`白鲸/同盟营地正文映射到了明显旧场景背景：${after.visualNovel.backgroundKey || after.visualNovel.lastAssetPlan?.selectedBackdropKey || 'none'}`);
    }
    if (/阿拉姆|村口|谷仓|魔兽|蕾姆|流星锤/u.test(combinedText)
        && /arc01|loot_house|market_day|rain_bell|adult_/u.test(String(after.visualNovel.backgroundKey || after.visualNovel.lastAssetPlan?.selectedBackdropKey || ''))) {
        issues.push(`阿拉姆村/魔兽正文映射到了明显旧场景背景：${after.visualNovel.backgroundKey || after.visualNovel.lastAssetPlan?.selectedBackdropKey || 'none'}`);
    }
    const choiceText = (after.visualNovel.choices || after.dom.choices || []).join('\n');
    if (/文森特|帝国军|佛拉基亚/u.test(choiceText) && !/文森特|帝国军|佛拉基亚/u.test(combinedText)) {
        issues.push('候选行动混入上一现场人物/阵营：文森特/帝国相关选项不在当前正文现场。');
    }
    if (/银发少女|徽章线索|菲鲁特|罗姆爷|盗品蔵|赃物库/u.test(choiceText)
        && !/银发少女|徽章|菲鲁特|罗姆爷|盗品蔵|赃物库/u.test(combinedText)) {
        issues.push('候选行动混入 Arc1 旧现场人物/物件。');
    }
    if (/圣域|墓所|试炼|艾姬多娜/u.test(choiceText) && !/圣域|墓所|试炼|艾姬多娜/u.test(combinedText)) {
        issues.push('候选行动提前混入圣域/试炼现场。');
    }
    if (/王选|旁听席|候选人|礼法/u.test(choiceText) && !/王选|旁听席|候选人|礼法/u.test(combinedText)) {
        issues.push('候选行动混入王选会议现场。');
    }
    if (/白鲸|库珥修|威尔海姆|安娜塔西亚|诱饵|雾气攻击/u.test(choiceText)
        && !/白鲸|库珥修|威尔海姆|安娜塔西亚|诱饵|雾气/u.test(combinedText)) {
        issues.push('候选行动混入白鲸/同盟现场。');
    }
    if (after.visualNovel.stageConsistency?.status && after.visualNovel.stageConsistency.status !== 'pass') issues.push(`舞台一致性非 pass: ${after.visualNovel.stageConsistency.summary || after.visualNovel.stageConsistency.status}`);
    if (route.id.includes('if-')) {
        const routeText = `${after.ifRouteLogic?.dominant || ''} ${after.ifRouteLogic?.dominantLabel || after.ifRouteLogic?.label || ''} ${after.latestText}`;
        const expected = route.label.split(/[ /]/u).filter((item) => item && item.length > 1).slice(0, 4);
        if (!termHits(routeText, expected).length) issues.push(`IF 路线牵引不明显：${shortText(routeText, 120)}`);
    }
    return issues;
}

async function runRoute(page, route, args, runDir, runLog) {
    await resetForRoute(page);
    const routeDir = path.join(runDir, route.id);
    await fs.mkdir(routeDir, { recursive: true });
    const actions = args.turns > 0 ? route.actions.slice(0, args.turns) : route.actions;
    const routeResult = {
        id: route.id,
        label: route.label,
        startedAt: new Date().toISOString(),
        turns: [],
        issues: [],
    };
    console.log(`[${route.id}] 00-setup wizard start`);
    const setupResult = await performSetupWizard(page, route, args, routeDir);
    const setupIssue = setupResult.setupIssue;
    if (setupIssue) {
        routeResult.issues.push(`00-setup: ${setupIssue}`);
    }
    routeResult.turns.push({
        turnLabel: '00-setup',
        durationMs: setupResult.records.reduce((sum, item) => sum + (Number(item.durationMs) || 0), 0),
        clickLatencies: [],
        issues: setupIssue ? [setupIssue] : [],
        jsonPath: setupResult.setupPath,
        screenshotPath: '',
    });
    await waitForStableIdleAfterSetup(page);
    for (const [index, action] of actions.entries()) {
        const turnNumber = index + 1;
        const turnLabel = `${String(turnNumber).padStart(2, '0')}-turn-${turnNumber}`;
        console.log(`[${route.id}] ${turnLabel} send: ${shortText(action, 120)}`);
        try {
            const turn = await sendAction(page, action, args);
            const issues = validateTurn(route, turn);
            const screenshotPath = path.join(routeDir, `${turnLabel}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: false });
            const jsonPath = path.join(routeDir, `${turnLabel}.json`);
            const record = {
                routeId: route.id,
                routeLabel: route.label,
                turnLabel,
                issues,
                screenshotPath,
                ...turn,
            };
            await fs.writeFile(jsonPath, JSON.stringify(record, null, 2));
            await fs.appendFile(runLog, JSON.stringify({
                routeId: route.id,
                turnLabel,
                durationMs: turn.durationMs,
                issues,
                latestText: shortText(turn.after.latestText, 220),
                stageText: shortText(turn.after.dom.stageText, 220),
                choices: (turn.after.dom.choices || []).slice(0, 5).map((choice) => shortText(choice.text || choice.label, 80)),
                asset: {
                    backgroundKey: turn.after.visualNovel.backgroundKey,
                    selectedBackdropKey: turn.after.visualNovel.lastAssetPlan?.selectedBackdropKey || '',
                    castIds: turn.after.visualNovel.castIds || [],
                },
            }) + '\n');
            routeResult.turns.push({
                turnLabel,
                durationMs: turn.durationMs,
                clickLatencies: turn.clickLatencies,
                issues,
                jsonPath,
                screenshotPath,
            });
            routeResult.issues.push(...issues.map((issue) => `${turnLabel}: ${issue}`));
            console.log(`[${route.id}] ${turnLabel} done ${Math.round(turn.durationMs / 1000)}s issues=${issues.length}`);
        } catch (error) {
            const failPath = path.join(routeDir, `${turnLabel}-failure.json`);
            await fs.writeFile(failPath, JSON.stringify({
                routeId: route.id,
                turnLabel,
                error: error?.message || String(error),
                snapshot: error?.snapshot || await compactSnapshot(page).catch(() => null),
            }, null, 2));
            routeResult.issues.push(`${turnLabel}: ${error?.message || String(error)}`);
            routeResult.failedAt = turnLabel;
            console.error(`[${route.id}] ${turnLabel} failed: ${error?.message || String(error)}`);
            break;
        }
    }
    routeResult.finishedAt = new Date().toISOString();
    return routeResult;
}

function buildReport(runId, args, results, runDir, runLog) {
    const lines = [];
    const totalTurns = results.reduce((sum, route) => sum + route.turns.length, 0);
    const totalIssues = results.reduce((sum, route) => sum + route.issues.length, 0);
    lines.push(`# Re:0 Real UI Fullflow Audit ${runId}`);
    lines.push('');
    lines.push(`- Base URL: ${args.baseUrl}`);
    lines.push(`- Routes: ${results.length}`);
    lines.push(`- Completed real UI turns: ${totalTurns}`);
    lines.push(`- Issues: ${totalIssues}`);
    lines.push(`- Snapshot dir: ${runDir}`);
    lines.push(`- JSONL log: ${runLog}`);
    lines.push('');
    lines.push('## Route Results');
    for (const route of results) {
        lines.push(`### ${route.label} (${route.id})`);
        lines.push(`- Turns: ${route.turns.length}`);
        lines.push(`- Status: ${route.failedAt ? `failed at ${route.failedAt}` : 'completed requested route actions'}`);
        if (route.issues.length) {
            for (const issue of route.issues.slice(0, 12)) lines.push(`- Issue: ${issue}`);
        } else {
            lines.push('- Issue: none recorded by automated validators');
        }
        for (const turn of route.turns.slice(-3)) {
            lines.push(`- ${turn.turnLabel}: ${Math.round(turn.durationMs / 1000)}s, clicks=${turn.clickLatencies.join(',') || 'none'}, log=${turn.jsonPath}`);
        }
        lines.push('');
    }
    lines.push('## Notes');
    lines.push('- This audit uses real browser UI input, real send clicks, real MiMo replies, real VN queue parsing, and real stage screenshots.');
    lines.push('- It intentionally does not use route probes or mocked model responses. Route setup text is sent through the same UI input path as player actions.');
    lines.push('- For a literal novel-length playthrough, rerun without `--turns` and expect long runtime/cost because each listed route action performs a real model call.');
    return lines.join('\n');
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const selected = args.routes
        ? new Set(args.routes.split(',').map((item) => item.trim()).filter(Boolean))
        : null;
    const routes = selected ? routePlans.filter((route) => selected.has(route.id)) : routePlans;
    if (!routes.length) {
        throw new Error(`No routes selected. Available: ${routePlans.map((route) => route.id).join(', ')}`);
    }
    const runId = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
    const runDir = await ensureDirs(runId);
    const runLog = path.join(runDir, 'turns.jsonl');
    const browser = await chromium.launch({ headless: args.headless });
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    page.on('console', (msg) => {
        const text = msg.text();
        if (/Stream stats|Re0 Adventure Engine|error|warn/i.test(text)) {
            console.log(`[browser] ${shortText(text, 500)}`);
        }
    });
    const results = [];
    try {
        await boot(page, args.baseUrl);
        for (const route of routes) {
            results.push(await runRoute(page, route, args, runDir, runLog));
        }
    } finally {
        await browser.close();
    }
    const report = buildReport(runId, args, results, runDir, runLog);
    const reportPath = path.join(qaDir, `RE0_REAL_UI_FULLFLOW_AUDIT_${runId}.md`);
    await fs.writeFile(reportPath, report);
    await fs.writeFile(path.join(runDir, 'summary.json'), JSON.stringify({ runId, args, results, reportPath, runDir, runLog }, null, 2));
    console.log(`REPORT ${reportPath}`);
    const failures = results.flatMap((route) => route.issues);
    if (failures.length) {
        console.log(`ISSUES ${failures.length}`);
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
