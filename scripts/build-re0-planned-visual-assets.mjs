import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STORYLINE_DEFAULTS } from '../public/scripts/extensions/third-party/re0-adventure-engine/data/storyline-defaults.js';

const require = createRequire(import.meta.url);
const Jimp = require('../node_modules/sillytavern-transformers/node_modules/jimp');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const extensionRoot = path.join(projectRoot, 'public/scripts/extensions/third-party/re0-adventure-engine');
const promptPlanPath = path.join(projectRoot, 'data/default-user/re0-engine/assets-plan/prompts.json');
const sceneCatalogPath = path.join(extensionRoot, 'data/scene-backdrops.generated.js');
const visualPromptIndexPath = path.join(projectRoot, 'data/default-user/re0-engine/assets-plan/generated-visual-index.json');
const generatedAvatarDir = path.join(extensionRoot, 'assets/generated/avatars');
const generatedHiresAvatarDir = path.join(extensionRoot, 'assets/generated/avatars-hires');

const force = process.argv.includes('--force');
const generatePlaceholders = process.argv.includes('--placeholder') || process.argv.includes('--force-placeholder');

const PALETTES = {
    Umbra: ['#080b12', '#23121c', '#581c87', '#94a3b8'],
    Bell: ['#120c08', '#4b0f16', '#b45309', '#fef3c7'],
    Truth: ['#0f172a', '#312e27', '#66512c', '#e5e7eb'],
    Light: ['#18212f', '#b45309', '#facc15', '#dbeafe'],
    Mirror: ['#030712', '#1e1b4b', '#7c3aed', '#e9d5ff'],
    Sanctuary: ['#071711', '#14532d', '#4d7c0f', '#d9f99d'],
    Witch: ['#03020a', '#1e1b4b', '#581c87', '#e9d5ff'],
    Imperial: ['#1c1007', '#7f1d1d', '#b45309', '#fed7aa'],
    Stale: ['#111827', '#374151', '#64748b', '#e5e7eb'],
    Snow: ['#020617', '#164e63', '#bae6fd', '#f8fafc'],
};

const SCENE_KEYWORDS = {
    arc01_bell_tower_interior: ['废钟', '钟楼', '雨夜', '铃声', '剥钟人', '第三次死亡', '王都贫民区', '钟锈'],
    arc01_slum_alley_night: ['贫民区', '雨夜', '巷子', '石板路', '黑伞', '血水', '莉榭尔', '米娅'],
    arc01_relief_house_fire: ['救济院', '火', '失火', '米娅', '莉榭尔', '贫民区', '钟锈', '孤儿院'],
    arc01_loot_house_interior: ['盗品蔵', '赃物', '罗姆爷', '菲鲁特', '艾尔莎', '徽章', '仓库'],
    arc01_old_archive_west_hall: ['档案', '旧案', '欧文', '记录', '骑士团', '封蜡', '调查', '档案室'],
    arc01_capital_inner_street: ['王都', '内环', '徽章', '爱蜜莉雅', '银发半精灵', '王选', '街道'],
    arc02_mansion_corridor_night: ['宅邸', '罗兹瓦尔', '走廊', '夜晚', '蕾姆', '拉姆', '咒术', '惨剧'],
    arc02_forbidden_library_door: ['禁书库', '碧翠丝', '门', '契约', '罗兹瓦尔宅邸', '书库'],
    arc02_arlam_village_morning: ['阿拉姆村', '村庄', '清晨', '日常', '村民', '轻松', '宅邸'],
    arc02_arlam_forest: ['森林', '阿拉姆', '魔兽', '咒术', '夜路', '森林深处'],
    arc03_royal_election_hall: ['王选', '会议厅', '王城', '候补', '骑士', '贵族', '王都'],
    arc03_white_whale_fog: ['白鲸', '雾', '讨伐', '库珥修', '威尔海姆', '街道封锁'],
    arc03_sloth_night: ['怠惰', '培提其乌斯', '魔女教', '夜袭', '森林', '狂信'],
    arc04_sanctuary_entrance: ['圣域', '结界', '墓所', '加菲尔', '琉兹', '试炼'],
    arc04_tomb_inside: ['墓所', '试炼', '圣域', '过去', '艾姬多娜', '梦境'],
    arc04_echidna_tea_room: ['茶会', '艾姬多娜', '魔女', '白色房间', '试炼', '契约'],
    arc04_ryuzu_cottage: ['琉兹', '小屋', '圣域', '日常', '避难', '村落'],
    arc05_water_gate_dusk: ['普利斯提拉', '水门', '运河', '黄昏', '歌姬', '都市'],
    arc05_control_tower: ['控制塔', '水门都市', '司教', '塔', '普利斯提拉'],
    arc05_liliana_stage: ['莉莉安娜', '舞台', '歌姬', '普利斯提拉', '广场', '日常'],
    arc05_regulus_appearance: ['雷古勒斯', '司教', '强欲', '婚礼', '白衣', '水门都市'],
    arc06_watchtower_door: ['监视塔', '贤者', '沙漠', '门', '夏乌拉', '星名'],
    arc06_memory_maze: ['记忆', '迷宫', '监视塔', '失忆', '星名', '幻觉'],
    arc06_starname_archive: ['星名', '档案', '贤者监视塔', '书库', '记忆'],
    arc07_vollachia_palace: ['佛拉基亚', '帝国', '皇宫', '文森特', '军旗', '帝都'],
    arc07_chaos_flame_arena: ['混沌焰', '角斗场', '帝国', '战斗', '竞技'],
    arc07_vollachia_tavern: ['佛拉基亚', '酒馆', '哈利贝尔', '商旅', '帝国日常'],
    arc08_post_catastrophe_ruins: ['大灾', '废墟', '帝国', '战后', '灾厄', '瓦砾'],
    arc08_louis_pollution_district: ['路易', '污染', '城区', '记忆', '暴食', '灾厄'],
    arc08_nine_generals_battle: ['九神将', '战线', '帝国', '战场', '军阵'],
    arc09_gusteko_cold_source: ['古斯提科', '冷源', '雪', '寒冷', '北方', '冰'],
    arc09_gusteko_church: ['古斯提科', '教堂', '祈祷厅', '雪', '圣堂'],
    arc09_snowfield_bell: ['雪原', '废钟', '剥钟人', '古斯提科', '钟声', '终局据点'],
    arc10_capital_finale_plaza: ['王都广场', '总决战', '王都', '终局', '王选'],
    arc10_capital_bell_tower_night: ['王都钟楼', '最后一响', '废钟', '夜晚', '剥钟人'],
    arc11_dawn_after_witch: ['终局清晨', '黎明', '魔女之后', '结局', '王都'],
    cross_kararagi_road: ['卡拉拉基', '商路', '传言', '商队', '奥托', '远方'],
    cross_great_waterfall_edge: ['大瀑布', '边境', '世界边缘', '远方', '终局引力'],
};

const SCENE_IMAGE_URL_OVERRIDES = {
    arc01_bell_tower_interior: '/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes/rain_bell.png',
    arc09_gusteko_cold_source: '/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes/snowfield.png',
    arc09_gusteko_church: '/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes/snowfield.png',
    arc09_snowfield_bell: '/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes/snowfield.png',
    arc10_capital_finale_plaza: '/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes/royal_capital.png',
    arc10_capital_bell_tower_night: '/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes/rain_bell.png',
    arc11_dawn_after_witch: '/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/great_waterfall_edge_dawn.png',
    cross_kararagi_road: '/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/kararagi_caravanserai_evening.png',
    cross_great_waterfall_edge: '/scripts/extensions/third-party/re0-adventure-engine/assets/generated/scenes-extra/great_waterfall_edge_dawn.png',
};

const AVATAR_PROMPT_OVERRIDES = {
    protagonist: 'adult isekai protagonist, ordinary modern traveler reshaped by death-return trauma, dark coat, tired eyes, one strange coin pendant, visual novel character portrait, no plain background',
    narrator: 'abstract adult fate narrator, black mantle and silver clock halo, humanlike silhouette, dark fantasy visual novel portrait, no plain background',
    lishelle: 'adult gray-haired nun, slum relief-house caretaker, gentle but dangerous eyes, black umbrella and worn clerical dress, dark fantasy anime portrait, no plain background',
    owen: 'adult former royal guard knight investigator, scarred practical face, old blue-gray cloak, evidence satchel, stern eyes, dark fantasy anime portrait, no plain background',
    bellringer: 'adult heretical cultist called the bell-peeler, rust-stained coat, broken bell charm, smiling like delayed salvation, psychological horror anime portrait, no plain background',
    mia: 'adult slum survivor girl reimagined as an adult route character, short cloak, guarded hopeful expression, rust shard pendant, dark fantasy anime portrait, no plain background',
    capital_guard: 'adult royal capital guard, practical armor, tired suspicious eyes, rain cloak, street lantern and stone gate background, dark fantasy anime visual novel portrait, no plain background',
    market_vendor: 'adult slum market vendor, sharp streetwise expression, worn apron, steam from soup stall and rainy market background, dark fantasy anime visual novel portrait, no plain background',
};

const EXTRA_GENERATED_DOSSIERS = {
    capital_guard: {
        id: 'capital_guard',
        name: '王都卫兵',
        faction: '露格尼卡王都治安',
        role: '群众模板 / 城门与街巷秩序',
    },
    market_vendor: {
        id: 'market_vendor',
        name: '街市小贩',
        faction: '王都市井',
        role: '群众模板 / 传言、交易与价格风向',
    },
};

const OFFICIAL_IDS = new Set([
    'al', 'anastasia', 'beatrice', 'capella', 'carmilla', 'cecilus', 'chisha', 'crusch', 'daphne', 'echidna',
    'elsa', 'emilia', 'felt', 'ferris', 'flop', 'fortuna', 'frederica', 'garfiel', 'geuse', 'halibel',
    'heinkel', 'hetaro', 'joshua', 'julius', 'kiritaka', 'ley', 'liliana', 'medium', 'meili', 'mimi',
    'minerva', 'otto', 'pandora', 'patrasche', 'petelgeuse', 'petra', 'priscilla', 'puck', 'ram', 'regulus',
    'reid', 'reinhard', 'rem', 'ricardo', 'rom', 'roswaal', 'roy', 'rui', 'ryuzu', 'satella', 'sekmet',
    'shaula', 'sirius', 'tivey', 'typhon', 'vincent', 'volcanica', 'wilhelm', 'yorna',
]);

const hexToRgb = (hex) => {
    const value = parseInt(String(hex).replace('#', ''), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const rgba = (r, g, b, a = 255) => Jimp.rgbaToInt(r, g, b, a) >>> 0;

function hash(value) {
    let h = 2166136261;
    for (const ch of String(value)) {
        h ^= ch.charCodeAt(0);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function safePixel(image, x, y, color) {
    if (x >= 0 && y >= 0 && x < image.bitmap.width && y < image.bitmap.height) {
        image.setPixelColor(color >>> 0, x, y);
    }
}

function rect(image, x0, y0, x1, y1, color) {
    const sx = Math.max(0, Math.floor(x0));
    const ex = Math.min(image.bitmap.width, Math.ceil(x1));
    const sy = Math.max(0, Math.floor(y0));
    const ey = Math.min(image.bitmap.height, Math.ceil(y1));
    for (let y = sy; y < ey; y++) {
        for (let x = sx; x < ex; x++) {
            image.setPixelColor(color >>> 0, x, y);
        }
    }
}

function ellipse(image, cx, cy, rx, ry, color) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const dx = (x - cx) / rx;
            const dy = (y - cy) / ry;
            if (dx * dx + dy * dy <= 1) {
                safePixel(image, x, y, color);
            }
        }
    }
}

function line(image, x0, y0, x1, y1, color, width = 1) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = Math.round(x0);
    let y = Math.round(y0);
    while (true) {
        for (let oy = -width; oy <= width; oy++) {
            for (let ox = -width; ox <= width; ox++) {
                safePixel(image, x + ox, y + oy, color);
            }
        }
        if (x === Math.round(x1) && y === Math.round(y1)) break;
        const e2 = err * 2;
        if (e2 > -dy) {
            err -= dy;
            x += sx;
        }
        if (e2 < dx) {
            err += dx;
            y += sy;
        }
    }
}

function addNoise(image, amount, seed) {
    let state = seed >>> 0;
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
        state = Math.imul(state ^ (x * 374761393 + y * 668265263), 2246822519) >>> 0;
        const n = ((state & 255) - 128) * amount;
        this.bitmap.data[idx] = Math.max(0, Math.min(255, this.bitmap.data[idx] + n));
        this.bitmap.data[idx + 1] = Math.max(0, Math.min(255, this.bitmap.data[idx + 1] + n));
        this.bitmap.data[idx + 2] = Math.max(0, Math.min(255, this.bitmap.data[idx + 2] + n));
    });
}

function paletteFromTags(tags = '') {
    const parts = String(tags).split('+').map((part) => part.trim()).filter(Boolean);
    const colors = parts.flatMap((part) => PALETTES[part] || []);
    if (!colors.length) return PALETTES.Umbra;
    return [colors[0], colors[1] || colors[0], colors[2] || colors[0], colors[3] || colors[1] || colors[0]];
}

function sceneKey(scene) {
    return path.basename(scene.path, path.extname(scene.path));
}

function sceneAssetPath(scene) {
    return scene.path.replace(/\.(png|jpg|jpeg|webp|svg)$/i, '.png');
}

function svgEscape(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function shortTitle(scene) {
    const note = String(scene.notes || '').replace(/^Arc\s*\d+\s*/i, '').trim();
    if (note) {
        const normalized = note
            .replace(/^C\d+\s*/i, '')
            .replace(/^Q-\d+-\d+\s*/i, '')
            .replace(/^E-(?:True|Bad|Normal)\s*/i, '')
            .replace(/^(?:\/\s*\d+\s*)+/, '');
        return normalized.replace(/[—-].*$/, '').trim() || sceneKey(scene).replace(/^arc\d+_/, '').replace(/_/g, ' ');
    }
    return sceneKey(scene).replace(/^arc\d+_/, '').replace(/_/g, ' ');
}

function summaryFromScene(scene) {
    const key = sceneKey(scene);
    const note = String(scene.notes || '').trim();
    if (note) return note;
    return `${key.replace(/_/g, ' ')}：${String(scene.prompt || '').slice(0, 120)}`;
}

function keywordsForScene(scene) {
    const key = sceneKey(scene);
    const pieces = new Set([
        key,
        ...key.split('_'),
        String(scene.arc || ''),
        ...(SCENE_KEYWORDS[key] || []),
    ].filter(Boolean));
    for (const token of String(scene.notes || '').split(/[\\s/，、。:：()（）—-]+/)) {
        if (token && token.length <= 18) pieces.add(token);
    }
    return [...pieces].slice(0, 28);
}

async function makeScene(scene) {
    const relativeAssetPath = sceneAssetPath(scene);
    const targetPath = path.join(extensionRoot, relativeAssetPath);
    if (!generatePlaceholders) {
        return { path: relativeAssetPath, skipped: true };
    }
    if (!force && existsSync(targetPath)) {
        return { path: relativeAssetPath, skipped: true };
    }
    await mkdir(path.dirname(targetPath), { recursive: true });
    const key = sceneKey(scene);
    const palette = paletteFromTags(scene.palette);
    await makeSceneBitmap(scene, key, palette, targetPath);
    return { path: relativeAssetPath, skipped: false };
}

function blendRgb(a, b, t, alpha = 255) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    return rgba(
        Math.round(ca[0] + (cb[0] - ca[0]) * t),
        Math.round(ca[1] + (cb[1] - ca[1]) * t),
        Math.round(ca[2] + (cb[2] - ca[2]) * t),
        alpha,
    );
}

async function makeSceneBitmap(scene, key, palette, targetPath) {
    const seed = hash(`${scene.id}:${key}`);
    const width = 1920;
    const height = 1080;
    const image = new Jimp(width, height, rgba(8, 10, 16));
    image.scan(0, 0, width, height, function (x, y, idx) {
        const dx = (x - width * 0.28) / width;
        const dy = (y - height * 0.16) / height;
        const radial = Math.min(1, Math.hypot(dx, dy) * 2.15);
        const vertical = y / height;
        const base = hexToRgb(palette[0]);
        const mid = hexToRgb(radial < 0.72 ? palette[1] : palette[2]);
        const glow = hexToRgb(palette[3]);
        const glowMix = Math.max(0, 1 - radial) * 0.36;
        const mix = Math.min(1, vertical * 0.58 + radial * 0.42);
        this.bitmap.data[idx] = Math.round(base[0] * (1 - mix) + mid[0] * mix + glow[0] * glowMix);
        this.bitmap.data[idx + 1] = Math.round(base[1] * (1 - mix) + mid[1] * mix + glow[1] * glowMix);
        this.bitmap.data[idx + 2] = Math.round(base[2] * (1 - mix) + mid[2] * mix + glow[2] * glowMix);
        this.bitmap.data[idx + 3] = 255;
    });

    const dark = rgba(3, 7, 18, 184);
    const shade = rgba(3, 7, 18, 105);
    const accent = blendRgb(palette[2], palette[3], 0.22, 168);
    const light = blendRgb(palette[3], '#ffffff', 0.24, 132);
    if (/bell|tower|钟/.test(key)) {
        rect(image, 1290, 155, 1445, 900, dark);
        ellipse(image, 1368, 150, 128, 36, dark);
        ellipse(image, 1368, 365, 92, 58, accent);
        line(image, 1368, 205, 1368, 350, light, 3);
        for (let i = 0; i < 110; i++) line(image, (i * 157) % width, 0, (i * 157) % width - 130, height, rgba(210, 230, 250, 44), 1);
    } else if (/slum|alley|capital_inner/.test(key)) {
        rect(image, 0, 765, width, height, shade);
        for (let i = 0; i < 10; i++) rect(image, i * 225 - 40, 342 - (i % 3) * 48, i * 225 + 190, 940, rgba(2, 6, 18, 130 + (i % 3) * 18));
        for (let i = 0; i < 80; i++) line(image, (i * 71) % width, 0, (i * 71) % width - 120, height, rgba(220, 238, 255, 38), 1);
    } else if (/fire|relief/.test(key)) {
        rect(image, 410, 415, 1350, 865, rgba(38, 18, 12, 212));
        for (let i = 0; i < 20; i++) ellipse(image, 470 + i * 52, 760 - (i % 5) * 46, 56, 155, i % 2 ? rgba(245, 158, 11, 72) : rgba(253, 230, 138, 54));
        ellipse(image, 1010, 330, 360, 110, rgba(251, 191, 36, 48));
    } else if (/loot|archive|library|starname/.test(key)) {
        for (let i = 0; i < 12; i++) rect(image, 74 + i * 155, 120, 150 + i * 155, 910, rgba(49, 46, 39, 185));
        for (let i = 0; i < 78; i++) rect(image, 88 + (i % 12) * 155, 170 + Math.floor(i / 12) * 95, 136 + (i % 12) * 155, 205 + Math.floor(i / 12) * 95, rgba(229, 199, 122, 66));
        ellipse(image, 1420, 420, 285, 130, rgba(251, 191, 36, 34));
    } else if (/mansion|corridor/.test(key)) {
        for (let i = 0; i < 10; i++) line(image, 260 + i * 165, 115, 135 + i * 210, 1010, rgba(220, 205, 250, 62), 4);
        rect(image, 755, 160, 1178, 935, rgba(16, 24, 39, 168));
        ellipse(image, 965, 150, 265, 58, rgba(196, 160, 255, 42));
    } else if (/sanctuary|forest|tomb|cottage/.test(key)) {
        for (let i = 0; i < 46; i++) line(image, (i * 113) % width, 120, (i * 113) % width - 105, height, rgba(5, 46, 27, 116), 4);
        rect(image, 730, 442, 1190, 910, rgba(30, 40, 31, 150));
        ellipse(image, 960, 420, 310, 75, rgba(217, 249, 157, 38));
    } else if (/tea|witch|memory|dream|pollution|sloth|regulus/.test(key)) {
        for (let i = 0; i < 16; i++) {
            ellipse(image, 200 + i * 116, 250 + (i % 5) * 96, 98, 36, rgba(233, 213, 255, 34));
            line(image, 200 + i * 116, 230, 330 + i * 98, 900, rgba(233, 213, 255, 42), 2);
        }
        ellipse(image, 970, 560, 330, 350, rgba(5, 3, 21, 120));
    } else if (/water|priestella|gate|canal/.test(key)) {
        rect(image, 0, 690, width, height, rgba(6, 78, 100, 128));
        for (let y = 720; y < height; y += 28) line(image, 0, y, width, y - 50, rgba(224, 242, 254, 44), 2);
        for (let i = 0; i < 8; i++) rect(image, 120 + i * 225, 292 - (i % 2) * 56, 220 + i * 225, 620, rgba(8, 47, 73, 138));
    } else if (/vollachia|imperial|arena|palace|battle|ruins/.test(key)) {
        rect(image, 0, 755, width, height, rgba(100, 43, 14, 165));
        for (let i = 0; i < 9; i++) {
            rect(image, 170 + i * 200, 250, 185 + i * 200, 800, rgba(20, 12, 7, 190));
            line(image, 185 + i * 200, 275, 310 + i * 200, 330, accent, 4);
        }
    } else if (/snow|gusteko|cold|church/.test(key)) {
        rect(image, 0, 720, width, height, rgba(248, 250, 252, 94));
        for (let i = 0; i < 180; i++) ellipse(image, (i * 89) % width, (i * 151) % height, 2 + (i % 4), 2 + (i % 4), rgba(248, 250, 252, 150));
        rect(image, 1280, 350, 1510, 740, rgba(8, 47, 73, 100));
    } else if (/waterfall/.test(key)) {
        rect(image, 1160, 0, 1420, height, rgba(224, 242, 254, 116));
        for (let i = 0; i < 30; i++) line(image, 1180 + (i % 8) * 32, 0, 1130 + (i % 9) * 40, height, rgba(248, 250, 252, 80), 3);
        rect(image, 0, 760, 1120, height, rgba(20, 40, 32, 135));
    } else {
        ellipse(image, 1320, 390, 310, 125, rgba(229, 231, 235, 34));
        rect(image, 0, 800, width, height, shade);
    }

    rect(image, 0, 740, width, height, rgba(0, 0, 0, 72));
    addNoise(image, 0.05, seed ^ 0x51f15e);
    await image.writeAsync(targetPath);
}

function sceneSvgMarkup(scene, key, palette) {
    const title = shortTitle(scene);
    const seed = hash(`${scene.id}:${key}`);
    const motif = svgMotifForScene(key, palette, seed);
    const grain = Array.from({ length: 56 }, (_, index) => {
        const x = (seed * (index + 11) + index * 137) % 1920;
        const y = ((seed >>> (index % 16)) + index * 83) % 1080;
        const rx = 24 + (index % 5) * 18;
        const ry = 5 + (index % 4) * 7;
        const opacity = (0.025 + (index % 6) * 0.006).toFixed(3);
        return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${opacity}"/>`;
    }).join('\n        ');
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" role="img" aria-label="${svgEscape(title)}">
    <title>${svgEscape(title)}</title>
    <defs>
        <radialGradient id="sceneGlow" cx="28%" cy="18%" r="78%">
            <stop offset="0%" stop-color="${palette[3]}" stop-opacity="0.72"/>
            <stop offset="42%" stop-color="${palette[1]}" stop-opacity="0.76"/>
            <stop offset="100%" stop-color="${palette[0]}" stop-opacity="1"/>
        </radialGradient>
        <linearGradient id="sceneDepth" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${palette[0]}"/>
            <stop offset="55%" stop-color="${palette[1]}"/>
            <stop offset="100%" stop-color="${palette[2]}"/>
        </linearGradient>
        <filter id="softBlur"><feGaussianBlur stdDeviation="18"/></filter>
    </defs>
    <rect width="1920" height="1080" fill="url(#sceneDepth)"/>
    <rect width="1920" height="1080" fill="url(#sceneGlow)" opacity="0.88"/>
    <g opacity="0.9">
        ${motif}
    </g>
    <g opacity="0.8" filter="url(#softBlur)">
        ${grain}
    </g>
    <rect width="1920" height="1080" fill="#000" opacity="0.08"/>
    <rect y="740" width="1920" height="340" fill="#000" opacity="0.32"/>
</svg>
`;
}

function svgMotifForScene(key, palette) {
    const dark = '#030712';
    const accent = palette[2];
    const light = palette[3];
    if (/bell|tower|钟/.test(key)) {
        return `
        <rect x="1285" y="140" width="150" height="750" rx="12" fill="${dark}" opacity="0.72"/>
        <ellipse cx="1360" cy="146" rx="116" ry="34" fill="${dark}" opacity="0.78"/>
        <path d="M1280 345 Q1360 280 1440 345 L1410 435 Q1360 475 1310 435 Z" fill="${accent}" opacity="0.62"/>
        <line x1="1360" y1="205" x2="1360" y2="345" stroke="${light}" stroke-width="5" opacity="0.7"/>
        <path d="M0 850 C350 780 680 930 1040 840 S1640 760 1920 845 L1920 1080 L0 1080 Z" fill="#020617" opacity="0.62"/>`;
    }
    if (/slum|alley|capital_inner/.test(key)) {
        return `
        <path d="M0 770 L1920 610 L1920 1080 L0 1080 Z" fill="#020617" opacity="0.55"/>
        ${Array.from({ length: 9 }, (_, i) => `<rect x="${i * 240 - 40}" y="${360 - (i % 3) * 45}" width="245" height="545" fill="${dark}" opacity="${0.42 + (i % 3) * 0.06}"/>`).join('\n        ')}
        ${Array.from({ length: 42 }, (_, i) => `<line x1="${i * 55}" y1="0" x2="${i * 55 - 120}" y2="1080" stroke="#dbeafe" stroke-width="2" opacity="0.16"/>`).join('\n        ')}`;
    }
    if (/fire|relief/.test(key)) {
        return `
        <rect x="420" y="405" width="930" height="445" fill="#28140c" opacity="0.78"/>
        <path d="M390 415 L885 215 L1380 415 Z" fill="#3a1b12" opacity="0.88"/>
        ${Array.from({ length: 16 }, (_, i) => `<ellipse cx="${500 + i * 55}" cy="${720 - (i % 4) * 55}" rx="56" ry="145" fill="${i % 2 ? '#f59e0b' : '#fde68a'}" opacity="0.22"/>`).join('\n        ')}
        <ellipse cx="1010" cy="330" rx="340" ry="95" fill="${accent}" opacity="0.22"/>`;
    }
    if (/loot|archive|library|starname/.test(key)) {
        return `
        ${Array.from({ length: 11 }, (_, i) => `<rect x="${90 + i * 160}" y="120" width="85" height="785" fill="#312e27" opacity="0.72"/>`).join('\n        ')}
        ${Array.from({ length: 70 }, (_, i) => `<rect x="${110 + (i % 11) * 160}" y="${170 + Math.floor(i / 11) * 95}" width="52" height="34" fill="${light}" opacity="0.25"/>`).join('\n        ')}
        <ellipse cx="1420" cy="410" rx="280" ry="120" fill="${accent}" opacity="0.14"/>`;
    }
    if (/mansion|corridor/.test(key)) {
        return `
        ${Array.from({ length: 9 }, (_, i) => `<line x1="${280 + i * 170}" y1="120" x2="${160 + i * 210}" y2="980" stroke="${light}" stroke-width="7" opacity="0.24"/>`).join('\n        ')}
        <rect x="760" y="150" width="410" height="780" rx="16" fill="#101827" opacity="0.66"/>
        <ellipse cx="965" cy="155" rx="260" ry="56" fill="${accent}" opacity="0.18"/>`;
    }
    if (/sanctuary|forest|tomb|cottage/.test(key)) {
        return `
        ${Array.from({ length: 36 }, (_, i) => `<line x1="${(i * 113) % 1920}" y1="120" x2="${(i * 113) % 1920 - 100}" y2="1080" stroke="#052e1b" stroke-width="8" opacity="0.42"/>`).join('\n        ')}
        <rect x="735" y="438" width="450" height="460" rx="26" fill="#20261f" opacity="0.56"/>
        <ellipse cx="960" cy="420" rx="300" ry="70" fill="${light}" opacity="0.18"/>`;
    }
    if (/tea|witch|memory|dream|pollution|sloth|regulus/.test(key)) {
        return `
        ${Array.from({ length: 14 }, (_, i) => `<ellipse cx="${230 + i * 118}" cy="${260 + (i % 5) * 92}" rx="92" ry="34" fill="#e9d5ff" opacity="0.12"/><line x1="${230 + i * 118}" y1="230" x2="${350 + i * 98}" y2="900" stroke="#e9d5ff" stroke-width="3" opacity="0.12"/>`).join('\n        ')}
        <ellipse cx="970" cy="560" rx="310" ry="330" fill="#050315" opacity="0.38"/>`;
    }
    if (/water|priestella|gate|canal/.test(key)) {
        return `
        <rect x="0" y="690" width="1920" height="390" fill="#064e64" opacity="0.5"/>
        ${Array.from({ length: 15 }, (_, i) => `<path d="M0 ${730 + i * 24} C480 ${690 + i * 20}, 1180 ${790 + i * 18}, 1920 ${720 + i * 26}" stroke="#e0f2fe" stroke-width="3" fill="none" opacity="0.16"/>`).join('\n        ')}
        ${Array.from({ length: 7 }, (_, i) => `<rect x="${150 + i * 240}" y="${310 - (i % 2) * 55}" width="90" height="465" fill="#082f49" opacity="0.56"/>`).join('\n        ')}`;
    }
    if (/vollachia|imperial|arena|palace|battle|ruins/.test(key)) {
        return `
        <path d="M0 760 C420 690 750 830 1120 735 S1650 690 1920 740 L1920 1080 L0 1080 Z" fill="#642b0e" opacity="0.58"/>
        ${Array.from({ length: 8 }, (_, i) => `<rect x="${180 + i * 210}" y="260" width="14" height="530" fill="#140c07" opacity="0.72"/><path d="M${194 + i * 210} 280 L${330 + i * 210} 330 L${194 + i * 210} 378 Z" fill="${accent}" opacity="0.7"/>`).join('\n        ')}`;
    }
    if (/snow|gusteko|cold|church/.test(key)) {
        return `
        <path d="M0 720 C390 650 690 790 1040 710 S1580 650 1920 718 L1920 1080 L0 1080 Z" fill="#f8fafc" opacity="0.42"/>
        ${Array.from({ length: 90 }, (_, i) => `<circle cx="${(i * 89) % 1920}" cy="${(i * 151) % 1080}" r="${2 + (i % 4)}" fill="#f8fafc" opacity="0.55"/>`).join('\n        ')}
        <rect x="1290" y="350" width="210" height="390" fill="#082f49" opacity="0.38"/>`;
    }
    if (/waterfall/.test(key)) {
        return `
        <rect x="1160" y="0" width="260" height="1080" fill="#e0f2fe" opacity="0.46"/>
        ${Array.from({ length: 22 }, (_, i) => `<line x1="${1180 + (i % 8) * 32}" y1="0" x2="${1130 + (i % 9) * 40}" y2="1080" stroke="#f8fafc" stroke-width="4" opacity="0.3"/>`).join('\n        ')}
        <path d="M0 780 L1120 700 L1010 1080 L0 1080 Z" fill="#142820" opacity="0.55"/>`;
    }
    return `<path d="M0 800 C430 720 820 880 1230 765 S1650 700 1920 780 L1920 1080 L0 1080 Z" fill="#020617" opacity="0.5"/><ellipse cx="1320" cy="390" rx="300" ry="120" fill="${light}" opacity="0.14"/>`;
}

async function makeAvatar(id, profile) {
    const targetPath = path.join(generatedAvatarDir, `${id}.jpg`);
    if (!force && existsSync(targetPath)) {
        return { id, skipped: true };
    }
    await mkdir(generatedAvatarDir, { recursive: true });
    const seed = hash(`${id}:${profile?.name || ''}`);
    const w = 768;
    const h = 1024;
    const image = new Jimp(w, h, rgba(8, 10, 16));
    const c1 = `#${((seed & 0xffffff) | 0x202020).toString(16).slice(-6)}`;
    const c2 = `#${(((seed >>> 8) & 0xffffff) | 0x303030).toString(16).slice(-6)}`;
    const ca = hexToRgb(c1);
    const cb = hexToRgb(c2);
    image.scan(0, 0, w, h, function (x, y, idx) {
        const t = (x * 0.35 + y * 0.85) / (w * 0.35 + h * 0.85);
        this.bitmap.data[idx] = Math.round(ca[0] + (cb[0] - ca[0]) * t);
        this.bitmap.data[idx + 1] = Math.round(ca[1] + (cb[1] - ca[1]) * t);
        this.bitmap.data[idx + 2] = Math.round(ca[2] + (cb[2] - ca[2]) * t);
        this.bitmap.data[idx + 3] = 255;
    });
    for (let i = 0; i < 34; i++) ellipse(image, (seed * (i + 5) + i * 97) % w, (seed >>> (i % 15)) % h, 68 + (i % 4) * 24, 16 + (i % 5) * 8, rgba(255, 255, 255, 16 + (i % 4) * 5));
    const skin = [rgba(238, 203, 172), rgba(220, 180, 145), rgba(205, 166, 132), rgba(232, 211, 190)][seed % 4];
    const hair = [rgba(25, 25, 35), rgba(92, 64, 45), rgba(202, 205, 215), rgba(114, 45, 70), rgba(34, 83, 70), rgba(210, 190, 115)][(seed >>> 3) % 6];
    const cloth = [rgba(38, 38, 50), rgba(60, 20, 30), rgba(25, 60, 85), rgba(80, 65, 20), rgba(22, 70, 54)][(seed >>> 6) % 5];
    ellipse(image, w * 0.5, h * 0.98, w * 0.34, h * 0.24, cloth);
    rect(image, w * 0.34, h * 0.62, w * 0.66, h * 0.82, cloth);
    ellipse(image, w * 0.5, h * 0.38, w * 0.16, h * 0.18, skin);
    ellipse(image, w * 0.5, h * 0.27, w * 0.18, h * 0.095, hair);
    for (let i = 0; i < 22; i++) line(image, w * (0.34 + i * 0.015), h * 0.24 + (i % 4) * 5, w * (0.28 + i * 0.022), h * (0.42 + ((seed >>> (i % 12)) % 8) / 100), hair, 5);
    ellipse(image, w * 0.44, h * 0.38, 14, 9, rgba(18, 22, 32));
    ellipse(image, w * 0.56, h * 0.38, 14, 9, rgba(18, 22, 32));
    ellipse(image, w * 0.445, h * 0.376, 4, 3, rgba(255, 255, 255, 230));
    ellipse(image, w * 0.565, h * 0.376, 4, 3, rgba(255, 255, 255, 230));
    line(image, w * 0.45, h * 0.485, w * 0.55, h * (0.485 + ((seed % 5) - 2) / 160), rgba(90, 42, 48, 220), 2);
    rect(image, 0, h * 0.82, w, h, rgba(4, 6, 12, 80));
    addNoise(image, 0.035, seed ^ 0xa5a5a5a5);
    await image.quality(94).writeAsync(targetPath);
    return { id, skipped: false };
}

async function copyImportantHiresFallbacks() {
    await mkdir(generatedHiresAvatarDir, { recursive: true });
    const originals = ['protagonist', 'narrator', 'lishelle', 'owen', 'bellringer', 'mia'];
    for (const id of originals) {
        const source = path.join(generatedAvatarDir, `${id}.jpg`);
        const target = path.join(generatedHiresAvatarDir, `${id}.jpg`);
        if (force || !existsSync(target)) {
            const image = await Jimp.read(source);
            await image.resize(768, 1024).quality(94).writeAsync(target);
        }
    }
}

function buildSceneCatalogModule(scenes) {
    const entries = scenes.map((scene) => {
        const key = sceneKey(scene);
        return {
            key,
            title: shortTitle(scene),
            summary: summaryFromScene(scene),
            arc: scene.arc ?? null,
            priority: scene.priority || 'P2',
            keywords: keywordsForScene(scene),
            palette: paletteFromTags(scene.palette),
            imageUrl: SCENE_IMAGE_URL_OVERRIDES[key] || `/scripts/extensions/third-party/re0-adventure-engine/${sceneAssetPath(scene)}`,
            prompt: scene.prompt,
            notes: scene.notes || '',
        };
    });
    return `/* eslint-disable */\n// Auto-generated by scripts/build-re0-planned-visual-assets.mjs. Do not hand edit.\nexport const PLANNED_SCENE_BACKDROPS = ${JSON.stringify(entries, null, 4)};\n`;
}

function characterPrompt(id, dossier = {}) {
    if (AVATAR_PROMPT_OVERRIDES[id]) return AVATAR_PROMPT_OVERRIDES[id];
    return [
        `adult character portrait for ${dossier.name || id}`,
        dossier.faction ? `faction: ${dossier.faction}` : '',
        dossier.role ? `role: ${dossier.role}` : '',
        'original Japanese dark fantasy anime light novel visual novel portrait',
        'three-quarter bust, expressive eyes, environmental fantasy background, no plain color background, no text, no logo, no watermark',
    ].filter(Boolean).join(', ');
}

async function main() {
    const plan = JSON.parse(await readFile(promptPlanPath, 'utf8'));
    const scenes = Array.isArray(plan.scenes) ? plan.scenes : [];
    await mkdir(path.dirname(sceneCatalogPath), { recursive: true });
    const sceneResults = [];
    for (const scene of scenes) {
        sceneResults.push(await makeScene(scene));
    }

    const dossiers = {
        ...(STORYLINE_DEFAULTS.characterDossiers || {}),
        ...EXTRA_GENERATED_DOSSIERS,
    };
    const avatarResults = [];
    if (generatePlaceholders) {
        await mkdir(generatedAvatarDir, { recursive: true });
        for (const [id, dossier] of Object.entries(dossiers).sort(([a], [b]) => a.localeCompare(b))) {
            avatarResults.push(await makeAvatar(id, dossier));
        }
        await copyImportantHiresFallbacks();
    }

    await writeFile(sceneCatalogPath, buildSceneCatalogModule(scenes));
    await writeFile(visualPromptIndexPath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        force,
        scenes: scenes.map((scene) => ({
            id: scene.id,
            key: sceneKey(scene),
            arc: scene.arc ?? null,
            priority: scene.priority || 'P2',
            file: `public/scripts/extensions/third-party/re0-adventure-engine/${sceneAssetPath(scene)}`,
            webUrl: `/scripts/extensions/third-party/re0-adventure-engine/${sceneAssetPath(scene)}`,
            title: shortTitle(scene),
            summary: summaryFromScene(scene),
            keywords: keywordsForScene(scene),
            prompt: scene.prompt,
            negativePrompt: 'low quality, blurry, text, logo, watermark, copied official screenshot, explicit sex, nude, genitalia, sexual violence, non-consensual',
        })),
        characters: Object.entries(dossiers).sort(([a], [b]) => a.localeCompare(b)).map(([id, dossier]) => ({
            id,
            name: dossier.name || id,
            source: OFFICIAL_IDS.has(id) ? 'official-or-local-canon-asset-first' : 'generated-fallback',
            fallbackFile: `public/scripts/extensions/third-party/re0-adventure-engine/assets/generated/avatars/${id}.jpg`,
            prompt: characterPrompt(id, dossier),
            negativePrompt: 'low quality, blurry, plain color background, text, logo, watermark, copied official screenshot, minor, child, young-looking, explicit sex, nude',
        })),
        note: generatePlaceholders
            ? '已生成本地占位 PNG/JPG；高精 AI 图可按同名路径替换。原作角色前端优先使用 assets/official，本文件保留替换提示词。'
            : '默认只生成高精 AI 图用的路径与提示词索引，不再用代码画占位图；请用 Codex imggen 或外部生图按同名路径落图。原作角色前端优先使用 assets/official。',
    }, null, 2));

    const madeScenes = sceneResults.filter((item) => !item.skipped).length;
    const madeAvatars = avatarResults.filter((item) => !item.skipped).length;
    console.log(`planned scene catalog: ${scenes.length} entries`);
    console.log(`scenes generated: ${madeScenes}, skipped/reserved: ${sceneResults.length - madeScenes}`);
    console.log(`avatars generated: ${madeAvatars}, skipped/reserved: ${generatePlaceholders ? avatarResults.length - madeAvatars : Object.keys(dossiers).length}`);
    if (!generatePlaceholders) {
        console.log('placeholder generation disabled; use --placeholder only for emergency local placeholders.');
    }
    console.log(`catalog: ${path.relative(projectRoot, sceneCatalogPath)}`);
    console.log(`prompt index: ${path.relative(projectRoot, visualPromptIndexPath)}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
