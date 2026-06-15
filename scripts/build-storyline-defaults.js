#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const STORY_ROOT = path.join(PROJECT_ROOT, 'data/default-user/re0-engine/storylines');
const ARC_ROOT = path.join(STORY_ROOT, 'arcs');
const FRONTEND_DATA_DIR = path.join(PROJECT_ROOT, 'public/scripts/extensions/third-party/re0-adventure-engine/data');
const BACKEND_DATA_DIR = path.join(PROJECT_ROOT, 'src/endpoints/data');
const WORLDBOOK_PATH = path.join(PROJECT_ROOT, 'data/default-user/worlds/Re0_Dark_Return_World.json');

const TENDENCIES = ['Umbra', 'Light', 'Mirror', 'Stale', 'Bell', 'Truth', 'Witch'];
const IF_ROUTE_WORLDBOOK_ENTRIES = [
    {
        key: ['IF线', '分歧逻辑', '世界线吸引子', 'Ayamatsu', 'Oboreru', 'Kasaneru', 'Tsugihagu'],
        comment: 'IF Route Logic Core',
        content: [
            'IF 线不是随机 AU，而是主线关键心理选择被推向极端后形成的世界线吸引子。',
            '嫉妒/主线：承认软弱、求助、共享证据、尊重角色选择，把死亡回归转化为关系网络中的修正。',
            '傲慢：不求助、孤身英雄、拯救对象神圣化，最终把自己逼到反派位置。',
            '愤怒：疑心转化为清算、灭口和恐惧秩序，短期安全换长期信任崩坏。',
            '怠惰：逃离公共责任，局部幸福成立，但远方白鲸、怠惰、王选和魔女教代价继续推进。',
            '强欲：接受全知式优化，把死亡回归当无限试错，效率提高但人格、同伴和信任被工具化。',
            '暴食：身份饥饿压倒伦理，为确认「我是谁」吞噬记忆、证词和生命。',
            '阶段规则：1-4 为种子，5-8 为分支漂移，9-13 为强吸引，14+ 为软锁风险。软锁不是禁止玩家选择，而是要求明确纠偏行动才能回落。',
            '分歧变量规则：路线压力由更底层变量驱动，包括求助缺失、信任崩塌、责任逃避、死亡工具化、身份饥饿、复仇锁定、关系压过危机、现实外壳漂移、阵营误读、问题外包未来和证据网络。',
            '主线/嫉妒吸引域的核心不是永远正确，而是证据网络持续压住其他危险变量：求助、见证、交叉验证、可逆行动、角色自主性。',
            '写作规则：IF 压力只能通过玩家行动、死亡复盘、NPC 行动、传言、风险或证据中的真实信号逐步累积，不得因为后台选择了某条 IF shard 就自我强化；正文用人物反应、死亡 flag、传言、梦和选择后果表现倾向。',
        ].join('\n'),
    },
    {
        key: ['拉回主线', '主线吸引域', 'EnvyMain', '求助', '证据链'],
        comment: 'IF Route Correction Rules',
        content: [
            '拉回主线的方法不是道德说教，而是具体行动结构：找见证者、共享可验证证据、保留撤离距离、让角色自己选择、拒绝死亡刷最优解。',
            '当玩家主动求助、交换证词、承认弱小、尊重角色自主性、用小预警建立信任时，世界线应向嫉妒/主线吸引域回落。',
            '纠偏不等于删掉玩家自由；它只是把高风险 IF 的代价、补救窗口和可替代路径明确显影。',
            '非主线日常/成人休整推进时，未被继续强化的危险 IF 压力可以缓慢衰减；主线危机现场不自动衰减，必须靠具体纠偏行动。',
            '当玩家重复已证明致命的方针，死亡分支必须给出错误方针、修正方针和下一轮可带回线索。',
        ].join('\n'),
    },
    {
        key: ['IF爽点', '分支快感', '色欲IF', '蝶梦', '成人AU', '复仇', '完美路线'],
        comment: 'IF Route Pleasure Grammar',
        content: [
            'IF 线分支不能只当坏结局惩罚；每条线都应提供一种玩家可追求的快感、对应代价和可纠偏入口。',
            '主线/嫉妒：爽点是证据链翻盘、同伴入局、死亡残响钓凶、关系修复后的强势救援；代价是推进慢、需要承认弱小。',
            '傲慢：爽点是孤身布局、反派式救赎、以恶名操盘王都；代价是信任坍塌和英雄阵营误判。',
            '愤怒：爽点是复仇清算、恐惧支配、地下王式掌控；代价是证人减少、真相碎裂、服从不等于信任。',
            '怠惰：爽点是逃亡幸福、小家庭、平静生活；代价是远方白鲸、怠惰、王选和魔女教危机继续结算。',
            '强欲：爽点是高智商推演、完美路线、信息压制；代价是人格、关系和同伴自主性被工具化。',
            '暴食：爽点是身份谜题、记忆拼图、谎言拆解；代价是用吞噬确认身份会破坏信任基础。',
            '复仇/Aganau：爽点是长期追猎、老练猎手、迟到但精准的讨伐；代价是时间机会成本和被错过的人生。',
            '色欲/蝶梦：爽点是成年角色关系升温、主动靠近、嫉妒修罗场、多角关系和阵营撬动；代价是欲望不能抹掉主线危机，嫉妒、误读和阵营代价会反噬。',
            '镜像/欺瞒/献祭：分别提供镜像舞台、假身份反杀、未来回声破局的快感；都必须保留代价，不得无因果改写正传世界。',
            '写作时要把爽点落到可行动域：玩家能选择布局、拉拢、逃亡、关系推进、复仇、欺瞒或完美推演；系统结算因果，而不是用人设硬墙挡住选择。',
        ].join('\n'),
    },
    {
        key: ['资料校准', 'Arc9', 'Arc10', 'SOURCE_NOTES', '无名星光', '狮子王之国'],
        comment: 'Source Calibration and Current Arc Status',
        content: [
            '资料可信度：T0 作者/官方发布与原文目录优先；T1 Wiki/资料站用于校准 Arc、IF 列表和分歧梗概；T2 论坛/视频解说只作为玩家体验和爽点设计参考。',
            '当前资料边界（2026-05-28）：Narou 官方作品页显示 Web 版仍连载中，全 782 エピソード，最新掲載日 2026-05-25；不得把当前项目终局写死成官方事实。',
            '当前资料边界（2026-05-28）：Re:Zero Wiki 记录 Arc 9「Light of the Nameless Star」Web 版已完结，首章 2024-07-22，末章 2025-11-27，共 60 章 + 2 interlude。',
            '当前资料边界（2026-05-28）：Re:Zero Wiki 记录 Arc 10「The Land of the Lion Kings」Web 版首章 2026-01-29；项目只把它当进行中资料银行，不提前断言官方终局。',
            'Narou 外典作品页说明外典是“正式脱离本篇历史”的作品；IF 线应建模为分支吸引子、分歧变量、爽点与代价语法，不应把原文 IF 直接移植成玩家主线。',
            '运行规则：来源事实只能校准世界线、角色、IF 分歧和远方传言，不得让正文复述原作章节或台词；新资料进入 SOURCE_NOTES.md，再由 FACT_INDEX/CONTEXT_WORKSET 按优先级抽取。',
        ].join('\n'),
    },
];
const STOP_WORDS = new Set([
    '玩家', '主角', '默认', '触发', '激活', '候选', '前置', '需要', '可以', '如果', '时候',
    '是否', '任意', '综合', '没有', '自己', '一个', '某个', '世界线', '死亡回归',
]);

function read(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function writeJson(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function stripMd(value) {
    return String(value ?? '')
        .replace(/\*\*/g, '')
        .replace(/`/g, '')
        .replace(/<br\s*\/?>/gi, ' / ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tableRow(line) {
    const text = String(line || '').trim();
    if (!text.startsWith('|') || !text.endsWith('|')) {
        return null;
    }
    const cells = text.slice(1, -1).split('|').map(stripMd);
    if (!cells.length || cells.every((cell) => /^:?-{2,}:?$/.test(cell))) {
        return null;
    }
    if (/^(ID|角色|通道|节点|终局)$/i.test(cells[0] || '')) {
        return null;
    }
    return cells;
}

function arcNumberFromFile(filePath) {
    const match = path.basename(filePath).match(/^arc(\d+)/i);
    return match ? Number(match[1]) : 0;
}

function sortByNaturalId(a, b) {
    const parse = (id) => String(id || '').match(/^([A-Z]+)-?(\d+)?-?(\d+)?$/i) || [];
    const aa = parse(a.id);
    const bb = parse(b.id);
    return String(aa[1] || '').localeCompare(String(bb[1] || ''))
        || Number(aa[2] || 0) - Number(bb[2] || 0)
        || Number(aa[3] || 0) - Number(bb[3] || 0)
        || String(a.id).localeCompare(String(b.id));
}

function uniq(values, limit = 12) {
    return [...new Set((values || []).filter(Boolean).map((value) => String(value).trim()).filter(Boolean))].slice(0, limit);
}

function keywordsFrom(...parts) {
    const text = stripMd(parts.join(' '));
    const ids = text.match(/[A-Z]-\d+-\d+|C\d+|E-[A-Za-z]+|[A-Z]{2,4}-[A-Za-z]+-\d{3}/g) || [];
    const chinese = text.match(/[\u4e00-\u9fa5]{2,10}/g) || [];
    return uniq([
        ...ids,
        ...chinese.filter((word) => !STOP_WORDS.has(word) && !/^第?\d/.test(word)),
    ], 8);
}

function mergeById(items) {
    const map = new Map();
    for (const item of items) {
        if (!item?.id) {
            continue;
        }
        const previous = map.get(item.id) || {};
        map.set(item.id, {
            ...previous,
            ...Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined && value !== null && value !== '')),
            keywords: uniq([...(previous.keywords || []), ...(item.keywords || [])], 12),
        });
    }
    return [...map.values()].sort(sortByNaturalId);
}

function parseArcFiles() {
    const arcFiles = fs.readdirSync(ARC_ROOT)
        .filter((file) => /^arc\d+-.+\.md$/.test(file))
        .sort()
        .map((file) => path.join(ARC_ROOT, file));
    const convergenceNodes = [];
    const deathFlags = [];
    const keys = [];
    const sideQuests = [];
    const remoteSignals = [];
    const branchWorldlines = [];

    for (const filePath of arcFiles) {
        const arc = arcNumberFromFile(filePath);
        const lines = read(filePath).split(/\r?\n/);
        let inRemoteSignals = false;
        let currentWorldline = null;
        for (const line of lines) {
            if (/^##\s+.*远方区域显影/.test(line)) {
                inRemoteSignals = true;
                currentWorldline = null;
            } else if (/^##\s+/.test(line)) {
                inRemoteSignals = false;
                currentWorldline = null;
            }

            const worldlineMatch = line.match(/^###\s+(?:\d+(?:\.\d+)?\s+)?([A-Z]{2,4}-[A-Za-z]+-\d{3})/);
            if (worldlineMatch) {
                currentWorldline = {
                    id: worldlineMatch[1],
                    arc,
                    file: path.relative(STORY_ROOT, filePath),
                    description: '',
                    keywords: keywordsFrom(worldlineMatch[1]),
                };
                branchWorldlines.push(currentWorldline);
                continue;
            }
            if (currentWorldline && line.trim() && !line.startsWith('#') && currentWorldline.description.length < 420) {
                currentWorldline.description = stripMd(`${currentWorldline.description} ${line}`);
                currentWorldline.keywords = uniq([...currentWorldline.keywords, ...keywordsFrom(line)], 10);
            }

            const cells = tableRow(line);
            if (!cells) {
                continue;
            }
            const first = stripMd(cells[0]);

            if (/^C\d+$/.test(first)) {
                const id = first;
                let node = {};
                if (arc === 11 && /^E-|Final Hub/i.test(cells[1] || '')) {
                    node = {
                        id,
                        name: cells[2] || cells[1] || id,
                        arc,
                        window: 'Arc 11 / 终局选择',
                        strength: cells[3] || 'finale',
                        status: 'finale',
                        rule: `终局=${cells[1] || ''}；条件=${cells[4] || ''}`,
                        requiredKey: cells[4] || '',
                        finaleId: /^E-/.test(cells[1] || '') ? cells[1] : '',
                    };
                } else {
                    const hasStatusColumn = /^(active|looming|locked|dormant|resolved|future|finale)$/i.test(cells[4] || '');
                    node = {
                        id,
                        name: cells[1] || id,
                        arc,
                        window: cells[2] || `Arc ${arc}`,
                        strength: cells[3] || 'soft',
                        status: hasStatusColumn ? cells[4] : (String(cells[3] || '').includes('future') ? 'looming' : 'active'),
                        rule: hasStatusColumn ? [cells[5], cells[6]].filter(Boolean).join(' / ') : [cells[4], cells[5], cells[6]].filter(Boolean).join(' / '),
                        requiredKey: hasStatusColumn ? cells[6] || '' : cells[4] || '',
                    };
                }
                node.source = path.relative(PROJECT_ROOT, filePath);
                node.keywords = keywordsFrom(node.id, node.name, node.window, node.rule, node.requiredKey);
                convergenceNodes.push(node);
                continue;
            }

            if (/^F-\d+-\d+$/.test(first)) {
                const flag = {
                    id: first,
                    arc,
                    scene: cells[1] || '',
                    consequence: cells[2] || '',
                    probability: cells[3] || '',
                    source: path.relative(PROJECT_ROOT, filePath),
                };
                flag.keywords = keywordsFrom(flag.id, flag.scene, flag.consequence);
                deathFlags.push(flag);
                continue;
            }

            if (/^K-\d+-\d+$/.test(first)) {
                const key = {
                    id: first,
                    arc,
                    name: cells[1] || first,
                    prerequisite: cells.length >= 4 ? cells[2] || '' : '',
                    effect: cells.length >= 4 ? cells[3] || '' : cells[2] || '',
                    source: path.relative(PROJECT_ROOT, filePath),
                };
                key.tendency = inferTendency(`${key.name} ${key.effect} ${key.prerequisite}`);
                key.keywords = keywordsFrom(key.id, key.name, key.prerequisite, key.effect);
                keys.push(key);
                continue;
            }

            if (/^Q-\d+-\d+$/.test(first)) {
                const quest = {
                    id: first,
                    arc,
                    name: cells[1] || first,
                    tendency: cells[2] || '所有',
                    recommendedTime: cells[3] || '',
                    summary: cells[4] || cells[2] || '',
                    source: path.relative(PROJECT_ROOT, filePath),
                };
                quest.keywords = keywordsFrom(quest.id, quest.name, quest.summary, quest.tendency);
                sideQuests.push(quest);
                continue;
            }

            if (inRemoteSignals && cells.length >= 2) {
                remoteSignals.push({
                    arc,
                    channel: cells[0],
                    samples: cells.slice(1).join(' / '),
                    source: path.relative(PROJECT_ROOT, filePath),
                    keywords: keywordsFrom(cells[0], cells.slice(1).join(' ')),
                });
            }
        }
    }

    return {
        convergenceNodes: mergeById(convergenceNodes),
        deathFlags: mergeById(deathFlags),
        keys: mergeById(keys),
        sideQuests: mergeById(sideQuests),
        remoteSignals,
        branchWorldlines: mergeById(branchWorldlines),
    };
}

function inferTendency(text) {
    const found = TENDENCIES.filter((tendency) => new RegExp(tendency, 'i').test(text));
    if (found.length) {
        return found.join('/');
    }
    if (/证据|档案|真相|解释|公开/.test(text)) return 'Truth';
    if (/救|信任|保住|善|准时|解放/.test(text)) return 'Light';
    if (/镜|同步|同源|灵魂|锚点|因果/.test(text)) return 'Mirror';
    if (/钟|剥钟|迟到/.test(text)) return 'Bell';
    if (/嫉妒|莎缇拉|魔女/.test(text)) return 'Witch';
    return 'Umbra';
}

function parseSideQuestLibrary(existingSideQuests) {
    const filePath = path.join(STORY_ROOT, 'SIDE_QUEST_LIBRARY.md');
    const lines = read(filePath).split(/\r?\n/);
    const details = [];
    let current = null;
    const flush = () => {
        if (!current) return;
        current.summary = current.summary || current.lines.join(' ').slice(0, 220);
        current.keywords = keywordsFrom(current.id, current.name, current.summary, current.trigger, current.reward);
        details.push(current);
    };

    for (const line of lines) {
        const heading = line.match(/^###\s+(Q-\d+-\d+)\s+(.+)$/);
        if (heading) {
            flush();
            current = {
                id: heading[1],
                arc: Number(heading[1].split('-')[1]),
                name: stripMd(heading[2]),
                trigger: '',
                risk: '',
                reward: '',
                tendency: '',
                recommendedTime: '',
                summary: '',
                lines: [],
                source: path.relative(PROJECT_ROOT, filePath),
            };
            continue;
        }
        if (!current) continue;
        const field = line.match(/^\s*-\s+\*\*([^*]+)\*\*[：:]\s*(.+)$/);
        if (field) {
            const key = stripMd(field[1]);
            const value = stripMd(field[2]);
            if (/触发/.test(key)) current.trigger = value;
            else if (/风险|失败/.test(key)) current.risk = value;
            else if (/奖励|回报|结果|收益/.test(key)) current.reward = value;
            else if (/倾向/.test(key)) current.tendency = value;
            else if (/时段|时间/.test(key)) current.recommendedTime = value;
            else current.lines.push(`${key}: ${value}`);
        } else if (line.trim() && !line.startsWith('#')) {
            current.lines.push(stripMd(line));
        }
    }
    flush();
    return mergeById([...existingSideQuests, ...details]);
}

function parseDecisionTree() {
    const filePath = path.join(STORY_ROOT, 'BRANCH_DECISION_TREE.md');
    const lines = read(filePath).split(/\r?\n/);
    const decisions = [];
    let current = null;
    const flush = () => {
        if (!current) return;
        const body = current.lines.join('\n');
        current.trigger = pickField(body, '触发');
        current.defaultAction = pickField(body, '默认');
        current.deviation = pickField(body, '偏离') || pickField(body, '选项');
        current.longTerm = pickField(body, '长程');
        current.tendency = inferTendency(`${current.title} ${body}`);
        current.keywords = keywordsFrom(current.id, current.title, current.trigger, current.defaultAction, current.deviation, body);
        delete current.lines;
        decisions.push(current);
    };

    for (const line of lines) {
        const heading = line.match(/^###\s+(D-\d+-\d+)\s*\/\s*(.+)$/);
        if (heading) {
            flush();
            current = {
                id: heading[1],
                arc: Number(heading[1].split('-')[1]),
                title: stripMd(heading[2]),
                source: path.relative(PROJECT_ROOT, filePath),
                lines: [],
            };
            continue;
        }
        if (current) {
            current.lines.push(line);
        }
    }
    flush();
    return decisions;
}

function pickField(body, fieldName) {
    const regex = new RegExp(`\\*\\*${fieldName}[^*]*\\*\\*[：:]\\s*([^\\n]+)`);
    const match = body.match(regex);
    return match ? stripMd(match[1]) : '';
}

function parseEndings() {
    const filePath = path.join(STORY_ROOT, 'PROJECTED_ENDINGS.md');
    const text = read(filePath);
    const lines = text.split(/\r?\n/);
    const priority = [];
    const endings = [];
    let current = null;
    let inScript = false;

    const flush = () => {
        if (!current) return;
        const body = current.lines.join('\n');
        current.worldline = pickField(body, '世界线');
        current.keyRequirement = pickField(body, '钥匙要求');
        current.script = current.script.trim();
        current.keywords = keywordsFrom(current.id, current.name, current.worldline, current.keyRequirement, current.script);
        delete current.lines;
        endings.push(current);
    };

    for (const line of lines) {
        const pr = line.match(/^\d+\.\s+(E-[A-Za-z]+)/);
        if (pr) {
            priority.push(pr[1]);
        }
        const heading = line.match(/^##\s+(E-[A-Za-z]+)\s+(.+)$/);
        if (heading) {
            flush();
            current = {
                id: heading[1],
                name: stripMd(heading[2]),
                source: path.relative(PROJECT_ROOT, filePath),
                lines: [],
                script: '',
            };
            inScript = false;
            continue;
        }
        if (!current) continue;
        if (/^```/.test(line.trim())) {
            inScript = !inScript;
            continue;
        }
        if (inScript) {
            current.script += `${line}\n`;
        }
        current.lines.push(line);
    }
    flush();
    return { priority, endings };
}

function parseCharacterDossiers() {
    const filePath = path.join(STORY_ROOT, 'CHARACTER_DOSSIERS.md');
    const lines = read(filePath).split(/\r?\n/);
    const dossiers = {};
    let current = null;
    let tableHeaders = null;

    const ensure = (id, name) => {
        dossiers[id] ??= {
            id,
            name,
            faction: '',
            canonCore: '',
            motivation: '',
            hiddenPressure: '',
            knowledgeBoundaries: '',
            routeHooks: [],
            riskTriggers: [],
            speechStyle: '',
            arcRelevance: [],
            routeAvailability: 'conditional',
            dossierSource: path.relative(PROJECT_ROOT, filePath),
        };
        if (name && !dossiers[id].name) dossiers[id].name = name;
        return dossiers[id];
    };

    for (const line of lines) {
        const heading = line.match(/^###\s+(.+?)\s+\(([^)]+)\)/);
        if (heading) {
            current = ensure(stripMd(heading[2]), stripMd(heading[1]));
            tableHeaders = null;
            continue;
        }
        const cells = tableRow(line);
        if (cells) {
            if (/角色/.test(cells[0])) {
                tableHeaders = cells;
                continue;
            }
            const names = [...String(cells[0] || '').matchAll(/([^()/|]+?)\s*\(([^)]+)\)/g)];
            if (names.length) {
                for (const match of names) {
                    const name = stripMd(match[1]);
                    const id = stripMd(match[2]);
                    const card = ensure(id, name);
                    if (tableHeaders) {
                        for (let index = 1; index < cells.length; index++) {
                            const header = tableHeaders[index] || '';
                            const value = stripMd(cells[index]);
                            if (!value) continue;
                            if (/阵营|身份|归属|定位/.test(header)) card.faction ||= value;
                            else if (/核心|性格|底线/.test(header)) card.canonCore ||= value;
                            else if (/动机|目标/.test(header)) card.motivation ||= value;
                            else if (/压力|风险|禁忌/.test(header)) card.hiddenPressure ||= value;
                            else if (/Arc|出场|篇章/.test(header)) card.arcRelevance = uniq([...card.arcRelevance, value], 12);
                            else card.routeHooks = uniq([...card.routeHooks, value], 10);
                        }
                    } else {
                        card.canonCore ||= stripMd(cells.slice(1).join(' / '));
                    }
                    card.keywords = keywordsFrom(card.id, card.name, card.faction, card.canonCore, card.motivation);
                }
            }
            continue;
        }
        if (!current) continue;
        const field = line.match(/^\s*-\s+([A-Za-z][A-Za-z0-9]*|[\u4e00-\u9fa5A-Za-z]+)[：:]\s*(.+)$/);
        if (!field) {
            continue;
        }
        const key = field[1];
        const value = stripMd(field[2]);
        if (!value) continue;
        if (key === 'faction') current.faction = value;
        else if (key === 'canonCore') current.canonCore = value;
        else if (key === 'motivation') current.motivation = value;
        else if (key === 'hiddenPressure') current.hiddenPressure = value;
        else if (key === 'knowledgeBoundaries') current.knowledgeBoundaries = value;
        else if (key === 'routeHooks') current.routeHooks = uniq(value.split(/\s*\/\s*|\s*→\s*|、|，/), 12);
        else if (key === 'riskTriggers') current.riskTriggers = uniq(value.split(/\s*\/\s*|、|，/), 12);
        else if (key === 'speechStyle') current.speechStyle = value;
        else if (key === 'arcRelevance') current.arcRelevance = uniq(value.split(/\s*\/\s*|、|，|,\s*/), 12);
        else if (key === 'routeAvailability') current.routeAvailability = value;
        current.keywords = keywordsFrom(current.id, current.name, current.faction, current.canonCore, current.motivation, current.routeHooks.join(' '));
    }
    return Object.fromEntries(Object.entries(dossiers).sort(([a], [b]) => a.localeCompare(b)));
}

function parseWorldlinesMap() {
    const filePath = path.join(STORY_ROOT, 'WORLDLINES_MAP.md');
    const lines = read(filePath).split(/\r?\n/);
    const domains = {};
    const tendencies = {};
    const ids = [];
    for (const line of lines) {
        const cells = tableRow(line);
        if (cells && /^[A-Z]{2,4}$/.test(cells[0])) {
            domains[cells[0]] = {
                code: cells[0],
                name: cells[1] || '',
                scope: cells[2] || '',
                description: cells.slice(3).join(' / '),
            };
        }
        if (cells && TENDENCIES.includes(cells[0])) {
            tendencies[cells[0]] = {
                code: cells[0],
                name: cells[1] || '',
                description: cells.slice(2).join(' / '),
            };
        }
        const matches = line.match(/[A-Z]{2,4}-[A-Za-z]+-\d{3}/g);
        if (matches) {
            ids.push(...matches);
        }
    }
    return {
        domains,
        tendencies,
        knownIds: uniq(ids, 80),
        source: path.relative(PROJECT_ROOT, filePath),
    };
}

function parseWorldMap() {
    const filePath = path.join(STORY_ROOT, 'WORLD_MAP.md');
    const lines = read(filePath).split(/\r?\n/);
    const regions = [];
    const travelMatrix = [];
    let currentCountry = '';
    for (const line of lines) {
        const h2 = line.match(/^##\s+(.+)$/);
        if (h2) {
            currentCountry = stripMd(h2[1]);
        }
        const cells = tableRow(line);
        if (!cells) continue;
        if (/地区|区域|地点|国家/.test(cells[0])) {
            continue;
        }
        if (cells.length >= 3 && /D\s*\d+|Arc|默认|解锁|小时|天|日|周/.test(cells.slice(1).join(' '))) {
            regions.push({
                id: slugify(cells[0]),
                country: currentCountry || '',
                name: cells[0],
                type: cells[1] || '',
                unlockedBy: cells[2] || '',
                hooks: cells.slice(3).filter(Boolean),
                source: path.relative(PROJECT_ROOT, filePath),
            });
        } else if (cells.length >= 3 && /→|到|小时|天|日|周/.test(cells.join(' '))) {
            travelMatrix.push({
                from: cells[0],
                to: cells[1],
                time: cells[2],
                note: cells.slice(3).join(' / '),
            });
        }
    }
    return {
        regions,
        travelMatrix,
        unlockedByArc: {
            1: ['lugunica_capital', 'royal_capital_slums', 'loot_house'],
            2: ['roswaal_mansion', 'arlam_village'],
            3: ['royal_castle', 'flugel_tree_road'],
            4: ['sanctuary'],
            5: ['priestella'],
            6: ['watchtower', 'auguria_sand_dunes'],
            7: ['vollachia'],
            8: ['vollachia_capital'],
            9: ['gusteko_snowfield'],
            10: ['lugunica_capital_return'],
            11: ['final_hub'],
        },
        source: path.relative(PROJECT_ROOT, filePath),
    };
}

function slugify(value) {
    return String(value || '')
        .trim()
        .replace(/[^\w\u4e00-\u9fa5]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 48) || 'region';
}

function buildTriggerHints(defaults) {
    return {
        keyTriggers: Object.fromEntries(defaults.keys.map((item) => [item.id, item.keywords || []])),
        flagTriggers: Object.fromEntries(defaults.deathFlags.map((item) => [item.id, item.keywords || []])),
        sideQuestTriggers: Object.fromEntries(defaults.sideQuests.map((item) => [item.id, item.keywords || []])),
        decisionTriggers: Object.fromEntries(defaults.decisionPoints.map((item) => [item.id, item.keywords || []])),
    };
}

function updateWorldbook(convergenceNodes) {
    const world = JSON.parse(read(WORLDBOOK_PATH));
    const entries = world.entries || {};
    for (const key of Object.keys(entries)) {
        if (/^Storyline Node C\d+\b/.test(entries[key]?.comment || '') || /^IF Route /.test(entries[key]?.comment || '')) {
            delete entries[key];
        }
    }

    const numericKeys = Object.keys(entries).map(Number).filter(Number.isFinite);
    let nextIndex = numericKeys.length ? Math.max(...numericKeys) + 1 : 0;
    const uidValues = Object.values(entries).map((entry) => Number(entry?.uid)).filter(Number.isFinite);
    let nextUid = uidValues.length ? Math.max(...uidValues) + 1 : 0;

    for (const node of convergenceNodes) {
        const content = [
            `收束节点 ${node.id}：${node.name}`,
            `Arc：${node.arc}`,
            `时间窗：${node.window || '未指定'}`,
            `强度/状态：${node.strength || 'soft'} / ${node.status || 'active'}`,
            `规则：${node.rule || '按原作暗面支线自然收束。'}`,
            node.requiredKey ? `破解钥匙/条件：${node.requiredKey}` : '',
            '写作约束：该节点是命运骨架，不可随机抹消；玩家可改写代价、证据链、伤亡顺序或显影方式，但不能无因果跳过。',
        ].filter(Boolean).join('\n');
        const entry = {
            keysecondary: [],
            constant: false,
            selective: true,
            order: 300 + Number(node.id.replace(/\D/g, '') || 0),
            position: 0,
            disable: false,
            displayIndex: nextUid,
            addMemo: true,
            group: 'Storyline Convergence',
            groupOverride: false,
            groupWeight: 100,
            sticky: 0,
            cooldown: 0,
            delay: 0,
            probability: 100,
            depth: 4,
            useProbability: false,
            role: null,
            vectorized: false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: false,
            scanDepth: null,
            caseSensitive: null,
            matchWholeWords: null,
            useGroupScoring: null,
            automationId: '',
            key: uniq([node.id, node.name, `Arc ${node.arc}`, '收束节点', ...(node.keywords || [])], 8),
            comment: `Storyline Node ${node.id} ${node.name}`,
            content,
            uid: nextUid,
        };
        entries[String(nextIndex)] = entry;
        nextIndex += 1;
        nextUid += 1;
    }
    for (const item of IF_ROUTE_WORLDBOOK_ENTRIES) {
        entries[String(nextIndex)] = {
            keysecondary: [],
            constant: false,
            selective: true,
            order: 250,
            position: 0,
            disable: false,
            displayIndex: nextUid,
            addMemo: true,
            group: 'IF Route Logic',
            groupOverride: false,
            groupWeight: 100,
            sticky: 0,
            cooldown: 0,
            delay: 0,
            probability: 100,
            depth: 4,
            useProbability: false,
            role: null,
            vectorized: false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: false,
            scanDepth: null,
            caseSensitive: null,
            matchWholeWords: null,
            useGroupScoring: null,
            automationId: '',
            key: item.key,
            comment: item.comment,
            content: item.content,
            uid: nextUid,
        };
        nextIndex += 1;
        nextUid += 1;
    }
    world.entries = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => Number(a) - Number(b)));
    writeJson(WORLDBOOK_PATH, world);
}

function buildDefaults() {
    const arcData = parseArcFiles();
    const sideQuests = parseSideQuestLibrary(arcData.sideQuests);
    const { priority, endings } = parseEndings();
    const defaults = {
        generatedAt: new Date().toISOString(),
        sourceRoot: path.relative(PROJECT_ROOT, STORY_ROOT),
        convergenceNodes: arcData.convergenceNodes,
        keys: arcData.keys,
        deathFlags: arcData.deathFlags,
        sideQuests,
        decisionPoints: parseDecisionTree(),
        endings,
        endingPriority: priority,
        characterDossiers: parseCharacterDossiers(),
        worldlines: {
            ...parseWorldlinesMap(),
            branches: arcData.branchWorldlines,
        },
        worldMap: parseWorldMap(),
        remoteSignals: arcData.remoteSignals,
    };
    defaults.triggerHints = buildTriggerHints(defaults);
    defaults.counts = {
        convergenceNodes: defaults.convergenceNodes.length,
        keys: defaults.keys.length,
        deathFlags: defaults.deathFlags.length,
        sideQuests: defaults.sideQuests.length,
        decisionPoints: defaults.decisionPoints.length,
        endings: defaults.endings.length,
        characterDossiers: Object.keys(defaults.characterDossiers).length,
        remoteSignals: defaults.remoteSignals.length,
        worldlineBranches: defaults.worldlines.branches.length,
    };
    defaults.targetCounts = {
        convergenceNodes: 90,
        keys: 56,
        deathFlags: 87,
        sideQuests: 66,
        decisionPoints: 50,
        endings: 9,
        characterDossiers: 60,
    };
    defaults.countWarnings = Object.entries(defaults.targetCounts)
        .filter(([key, target]) => key === 'decisionPoints' || key === 'characterDossiers' || key === 'sideQuests'
            ? defaults.counts[key] < target
            : defaults.counts[key] !== target)
        .map(([key, target]) => `${key}: parsed ${defaults.counts[key]} / target ${target}`);
    return defaults;
}

function main() {
    const defaults = buildDefaults();
    writeJson(path.join(FRONTEND_DATA_DIR, 'storyline-defaults.json'), defaults);
    fs.writeFileSync(
        path.join(FRONTEND_DATA_DIR, 'storyline-defaults.js'),
        `/* eslint-disable */\nexport const STORYLINE_DEFAULTS = ${JSON.stringify(defaults, null, 2)};\nexport default STORYLINE_DEFAULTS;\n`,
    );
    writeJson(path.join(BACKEND_DATA_DIR, 're0-shard-templates.json'), {
        generatedAt: defaults.generatedAt,
        counts: defaults.counts,
        sideQuests: defaults.sideQuests,
        remoteSignals: defaults.remoteSignals,
        worldMap: defaults.worldMap,
        characterDossiers: defaults.characterDossiers,
    });
    updateWorldbook(defaults.convergenceNodes);
    console.log(JSON.stringify(defaults.counts, null, 2));
}

main();
