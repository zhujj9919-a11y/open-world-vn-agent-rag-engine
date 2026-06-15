import assert from 'node:assert/strict';
import {
    canonRouteReferenceByArc,
    canonRouteReferenceSummary,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/re0-canon-rag.generated.js';
import storylineDefaults from '../public/scripts/extensions/third-party/re0-adventure-engine/data/storyline-defaults.js';
import {
    retrieveStoryRagWorkset,
    storyRagHealthcheck,
} from '../public/scripts/extensions/third-party/re0-adventure-engine/data/story-rag.js';

function stateForCanonArc(arc, spec = {}) {
    return {
        current: {
            arc,
            day: arc * 100,
            time: spec.time || '主线推进',
            location: spec.location || '原作主线地点',
            viewpoint: '玩家',
        },
        worldline: {
            id: `CANON-SPINE-${String(arc).padStart(2, '0')}`,
            divergence: spec.divergence ?? 0.04,
            attractor: '原作主线 / 嫉妒线吸引域',
        },
        ifRouteLogic: {
            dominant: 'EnvyMain',
            routePressures: { EnvyMain: 94 },
            lastShift: '玩家选择原作线行动，世界线保持低偏移。',
        },
        gameplay: {
            activeObjective: spec.objective,
            objectiveStage: `Arc${arc} 原作主线骨架`,
            lastPlayerAction: spec.action,
            openQuestions: spec.openQuestions || [],
            actionHints: spec.actionHints || [],
            deathRisk: {
                lastWarning: spec.warning || '',
                lastStrategyPivot: spec.strategyPivot || '',
            },
        },
        discoveredClues: spec.clues || [],
        characterCards: Object.fromEntries((spec.characters || []).map((name) => [name, {
            name,
            memory: [`原作主线测试中，${name} 的行动必须服从 Arc${arc} 的因果前置。`],
        }])),
        visuals: {
            visualNovel: {
                sceneCharacters: spec.characters || [],
                lastChoiceText: spec.action,
            },
        },
    };
}

const canonMainlineSpine = [
    {
        arc: 1,
        location: '王都赃物库',
        objective: '确认徽章流向，等待莱因哈鲁特迟到但有效入局',
        action: '【原作线】把徽章线索、菲鲁特交易和艾尔莎威胁接回赃物库破局。',
        characters: ['爱蜜莉雅', '菲鲁特', '罗姆爷', '莱因哈鲁特'],
        terms: ['徽章', '赃物库', '艾尔莎', '菲鲁特', '莱因哈鲁特'],
    },
    {
        arc: 2,
        location: '罗兹瓦尔宅邸',
        objective: '验证诅咒源，降低雷姆误判，用舍命救援重建信任',
        action: '【原作线】把魔女余香、犬型魔兽咬痕和村庄孩子失踪拆成可验证证据。',
        characters: ['雷姆', '拉姆', '碧翠丝', '罗兹瓦尔'],
        terms: ['诅咒', '魔女余香', '雷姆', '村庄', '魔兽'],
    },
    {
        arc: 3,
        location: '王选会议厅',
        objective: '承认软弱，组织白鲸同盟，再处理怠惰与暴食余波',
        action: '【原作线】把白鲸出没情报转成可交易证据，争取库珥修和安娜塔西亚阵营。',
        characters: ['雷姆', '库珥修', '威尔海姆', '尤里乌斯'],
        terms: ['王选', '白鲸', '怠惰', '雷姆', '同盟'],
    },
    {
        arc: 4,
        location: '圣域墓所',
        objective: '拒绝强欲契约，让奥托、加菲尔和碧翠丝共同分担战场',
        action: '【原作线】不把死亡当工具，分工处理圣域试炼、宅邸袭击和碧翠丝契约。',
        characters: ['艾姬多娜', '奥托', '加菲尔', '碧翠丝'],
        terms: ['圣域', '试炼', '罗兹瓦尔', '奥托', '碧翠丝'],
    },
    {
        arc: 5,
        location: '普里斯提拉水门都市',
        objective: '在四大司教袭击中恢复城市秩序并承担暴食代价',
        action: '【原作线】通过广播鼓舞和多阵营协作处理强欲、愤怒、色欲、暴食同场危机。',
        characters: ['莉莉安娜', '库珥修', '安娜塔西亚', '莱因哈鲁特'],
        terms: ['水门都市', '司教', '广播', '强欲', '暴食'],
    },
    {
        arc: 6,
        location: '普雷阿迪斯监视塔',
        objective: '用活人证词与外部事实拼回名字、记忆和自我',
        action: '【原作线】面对死者之书诱惑时，先用同伴证词和监视塔试炼确认自我连续性。',
        characters: ['碧翠丝', '爱蜜莉雅', '雷德', '夏乌拉'],
        terms: ['监视塔', '名字', '记忆', '死者之书', '夏乌拉'],
    },
    {
        arc: 7,
        location: '佛拉基亚帝国',
        objective: '在失忆雷姆不信任、文森特夺位和角斗士短循环中保命结盟',
        action: '【原作线】先获得修德拉克与帝国战团最低限度信任，不要求失忆雷姆立刻恢复旧记忆。',
        characters: ['失忆雷姆', '文森特', '托德', '坦萨'],
        terms: ['帝国', '失忆雷姆', '文森特', '角斗士', '十秒循环'],
    },
    {
        arc: 8,
        location: '佛拉基亚帝国首都',
        objective: '让普雷阿迪斯战团、同盟救援和大灾厄战场同步',
        action: '【原作线】把斯芬克斯大灾厄、首都多线战场和雷姆重新接纳连成同一战役。',
        characters: ['雷姆', '斯芬克斯', '文森特', '普雷阿迪斯战团'],
        terms: ['普雷阿迪斯战团', '大灾厄', '斯芬克斯', '首都', '雷姆重新接纳'],
    },
    {
        arc: 9,
        location: '露格尼卡王都',
        objective: '追查阿尔领域循环、王选动荡和封印风险',
        action: '【原作线】处理阿尔德巴兰领域重置与普莉希拉阵营决裂，不把问题外包未来。',
        characters: ['阿尔德巴兰', '普莉希拉', '爱蜜莉雅', '雷姆'],
        terms: ['阿尔', '领域循环', '王选', '普莉希拉', '封印'],
    },
    {
        arc: 10,
        location: '王都撤离车队',
        objective: '保留六枚舌与青蛇菲利斯证据链，同时不抛弃可救之人',
        action: '【原作线】在撤离车队事故中追寻最优解，但拒绝把抛弃同伴当作无代价答案。',
        characters: ['碧翠丝', '菲利斯', '库珥修', '拉塞尔'],
        terms: ['王都戒严', '六枚舌', '菲利斯', '撤离车队', '最优解'],
    },
];

const health = storyRagHealthcheck();
assert.equal(health.status, 'pass');
assert.ok(canonRouteReferenceSummary.arcs >= 10, 'canon route reference must cover the published mainline arcs in the source index');
assert.equal(canonRouteReferenceByArc[11], undefined, 'Arc11 is project-projected/open-world material, not verified canon mainline reference');

for (const spec of canonMainlineSpine) {
    const reference = canonRouteReferenceByArc[spec.arc];
    assert.ok(reference, `missing canon reference for Arc${spec.arc}`);
    const referenceText = `${reference.title} ${reference.canonSpine} ${reference.summaryDigest}`;
    for (const term of spec.terms) {
        assert.ok(referenceText.includes(term), `Arc${spec.arc} canon reference is missing required term: ${term}`);
    }

    const workset = retrieveStoryRagWorkset(stateForCanonArc(spec.arc, spec), spec.action);
    assert.equal(workset.architecture.routing.actionMode, 'canon-follow', `Arc${spec.arc} should route canon actions through canon-follow`);
    assert.equal(workset.architecture.routing.followsCanonAction, true, `Arc${spec.arc} should mark followsCanonAction`);
    assert.ok(workset.directorSignals.attractorStrength >= 0.72, `Arc${spec.arc} canon attractor should be strong`);
    assert.ok(workset.layers.officialCausalMemory.facts.length > 0, `Arc${spec.arc} should retrieve official causal facts`);
    assert.ok(workset.facts.slice(0, 5).some((fact) => Number(fact.arc) === spec.arc), `Arc${spec.arc} top facts should include same-arc canon memory`);
    assert.ok(workset.layers.directorDecision.generationPolicy.includes('原作因果链'), `Arc${spec.arc} generation policy should name canon causality`);
}

const projectedEndingSources = storylineDefaults.endings.map((ending) => ending.source || '');
assert.ok(projectedEndingSources.length >= 1);
assert.ok(projectedEndingSources.every((source) => source.includes('PROJECTED_ENDINGS.md')), 'project endings must remain labeled as projected/custom endings');
assert.ok(storylineDefaults.endings.every((ending) => /^E-/u.test(ending.id)), 'projected endings are game ending IDs, not original novel completion markers');

console.log(JSON.stringify({
    status: 'pass',
    canonArcs: canonMainlineSpine.length,
    canonReferenceArcs: canonRouteReferenceSummary.arcs,
    projectedEndings: storylineDefaults.endings.length,
    routing: 'canon-follow',
}, null, 2));
