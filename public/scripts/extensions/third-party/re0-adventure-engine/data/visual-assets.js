import {
    externalGrokAdultCharacterSpriteVariantMap,
    externalGrokAdultReferenceMap,
    externalGrokAdultRuntimeSummary,
} from './grokadult-runtime-assets.generated.js';
import {
    sourceNovelAssetSummary,
    sourceNovelAssets,
    sourceNovelCharacterImageMap,
    sourceNovelSceneImageMap,
} from './source-novel-assets.generated.js';

export const ASSET_ROOT = '/scripts/extensions/third-party/re0-adventure-engine/assets/official';
export const GENERATED_ASSET_ROOT = '/scripts/extensions/third-party/re0-adventure-engine/assets/generated';
export const USER_ASSET_ROOT = '/scripts/extensions/third-party/re0-adventure-engine/assets/user';

export const characterImageMap = {
    emilia: `${ASSET_ROOT}/emilia.webp`,
    rem: `${ASSET_ROOT}/rem.webp`,
    ram: `${ASSET_ROOT}/ram.webp`,
    roswaal: `${ASSET_ROOT}/roswaal.webp`,
    beatrice: `${ASSET_ROOT}/beatrice.webp`,
    reinhard: `${ASSET_ROOT}/reinhard.webp`,
    felt: `${ASSET_ROOT}/felt.webp`,
    otto: `${ASSET_ROOT}/otto.webp`,
    elsa: `${ASSET_ROOT}/elsa.webp`,
    echidna: `${ASSET_ROOT}/echidna.png`,
    petelgeuse: `${ASSET_ROOT}/petelgeuse.png`,
    puck: `${ASSET_ROOT}/puck.webp`,
    frederica: `${ASSET_ROOT}/frederica.webp`,
    petra: `${ASSET_ROOT}/petra.webp`,
    patrasche: `${ASSET_ROOT}/patrasche.webp`,
    garfiel: `${ASSET_ROOT}/garfiel.webp`,
    ryuzu: `${ASSET_ROOT}/ryuzu.webp`,
    crusch: `${ASSET_ROOT}/crusch.webp`,
    ferris: `${ASSET_ROOT}/ferris.webp`,
    wilhelm: `${ASSET_ROOT}/wilhelm.webp`,
    anastasia: `${ASSET_ROOT}/anastasia.webp`,
    julius: `${ASSET_ROOT}/julius.webp`,
    joshua: `${ASSET_ROOT}/joshua.webp`,
    mimi: `${ASSET_ROOT}/mimi.webp`,
    hetaro: `${ASSET_ROOT}/hetaro.webp`,
    tivey: `${ASSET_ROOT}/tivey.webp`,
    ricardo: `${ASSET_ROOT}/ricardo.webp`,
    priscilla: `${ASSET_ROOT}/priscilla.webp`,
    al: `${ASSET_ROOT}/al.webp`,
    liliana: `${ASSET_ROOT}/liliana.webp`,
    kiritaka: `${ASSET_ROOT}/kiritaka.webp`,
    heinkel: `${ASSET_ROOT}/heinkel.webp`,
    regulus: `${ASSET_ROOT}/regulus.webp`,
    sirius: `${ASSET_ROOT}/sirius.webp`,
    ley: `${ASSET_ROOT}/ley.webp`,
    roy: `${ASSET_ROOT}/roy.webp`,
    rui: `${ASSET_ROOT}/louis.webp`,
    capella: `${ASSET_ROOT}/capella.webp`,
    minerva: `${ASSET_ROOT}/minerva.webp`,
    daphne: `${ASSET_ROOT}/daphne.webp`,
    typhon: `${ASSET_ROOT}/typhon.webp`,
    sekmet: `${ASSET_ROOT}/sekmet.webp`,
    carmilla: `${ASSET_ROOT}/carmilla.webp`,
    meili: `${ASSET_ROOT}/meili.webp`,
    shaula: `${ASSET_ROOT}/shaula.webp`,
    reid: `${ASSET_ROOT}/reid.webp`,
    satella: `${ASSET_ROOT}/satella.webp`,
    pandora: `${ASSET_ROOT}/pandora.webp`,
    fortuna: `${ASSET_ROOT}/fortuna.webp`,
    geuse: `${ASSET_ROOT}/geuse.webp`,
    rom: `${ASSET_ROOT}/rom.webp`,
    volcanica: `${ASSET_ROOT}/volcanica.webp`,
    chisha: `${ASSET_ROOT}/chisha.webp`,
    cecilus: `${ASSET_ROOT}/cecilus.webp`,
    flop: `${ASSET_ROOT}/flop.webp`,
    halibel: `${ASSET_ROOT}/halibel.webp`,
    medium: `${ASSET_ROOT}/medium.webp`,
    vincent: `${ASSET_ROOT}/vincent.webp`,
    yorna: `${ASSET_ROOT}/yorna.webp`,
};

export const generatedCharacterImageMap = {
    bellringer: `${GENERATED_ASSET_ROOT}/avatars-hires/bellringer.png`,
    capital_guard: `${GENERATED_ASSET_ROOT}/avatars-hires/capital_guard.png`,
    lishelle: `${GENERATED_ASSET_ROOT}/avatars-hires/lishelle.png`,
    market_vendor: `${GENERATED_ASSET_ROOT}/avatars-hires/market_vendor.png`,
    mia: `${GENERATED_ASSET_ROOT}/avatars-hires/mia.png`,
    narrator: `${GENERATED_ASSET_ROOT}/avatars-hires/narrator.png`,
    owen: `${GENERATED_ASSET_ROOT}/avatars-hires/owen.png`,
    pandora: `${GENERATED_ASSET_ROOT}/avatars-hires/pandora.png`,
    protagonist: `${GENERATED_ASSET_ROOT}/avatars-hires/protagonist.png`,
    satella: `${GENERATED_ASSET_ROOT}/avatars-hires/satella.png`,
};

export const generatedCharacterSpriteMap = {
    al: `${GENERATED_ASSET_ROOT}/sprites/al.png`,
    anastasia: `${GENERATED_ASSET_ROOT}/sprites/anastasia.png`,
    beatrice: `${GENERATED_ASSET_ROOT}/sprites/beatrice.png`,
    bellringer: `${GENERATED_ASSET_ROOT}/characters/bellringer/sprite/bellringer__pose-ritual__expr-cold_laugh__outfit-cult_robe.png`,
    capital_guard: `${GENERATED_ASSET_ROOT}/sprites/capital_guard.png`,
    crusch: `${GENERATED_ASSET_ROOT}/sprites/crusch.png`,
    elsa: `${GENERATED_ASSET_ROOT}/sprites/elsa.png`,
    emilia: `${GENERATED_ASSET_ROOT}/sprites/emilia.png`,
    felt: `${GENERATED_ASSET_ROOT}/sprites/felt.png`,
    ferris: `${GENERATED_ASSET_ROOT}/sprites/ferris.png`,
    julius: `${GENERATED_ASSET_ROOT}/sprites/julius.png`,
    lishelle: `${GENERATED_ASSET_ROOT}/characters/lishelle/sprite/lishelle__pose-idle__expr-soft_smile__outfit-nun_rain.png`,
    market_vendor: `${GENERATED_ASSET_ROOT}/sprites/market_vendor.png`,
    mia: `${GENERATED_ASSET_ROOT}/characters/mia/sprite/mia__pose-hide_clue__expr-fear__outfit-slum_rain.png`,
    narrator: `${GENERATED_ASSET_ROOT}/characters/narrator/sprite/narrator__pose-system_avatar__expr-neutral__outfit-ceremonial.png`,
    owen: `${GENERATED_ASSET_ROOT}/characters/owen/sprite/owen__pose-interrogate__expr-cold__outfit-guard_coat.png`,
    protagonist: `${GENERATED_ASSET_ROOT}/characters/protagonist/sprite/protagonist__pose-idle__expr-neutral__outfit-default.png`,
    ram: `${GENERATED_ASSET_ROOT}/sprites/ram.png`,
    relief_worker: `${GENERATED_ASSET_ROOT}/sprites/relief_worker.png`,
    rem: `${GENERATED_ASSET_ROOT}/sprites/rem.png`,
    reinhard: `${GENERATED_ASSET_ROOT}/sprites/reinhard.png`,
    rom: `${GENERATED_ASSET_ROOT}/characters/rom/sprite/rom__pose-idle__expr-gruff__outfit-loot_house_apron.png`,
    roswaal: `${GENERATED_ASSET_ROOT}/sprites/roswaal.png`,
    otto: `${GENERATED_ASSET_ROOT}/sprites/otto.png`,
    priscilla: `${GENERATED_ASSET_ROOT}/sprites/priscilla.png`,
    regulus: `${GENERATED_ASSET_ROOT}/characters/regulus/sprite/regulus__pose-idle__expr-smug__outfit-white_formal.png`,
    reid: `${GENERATED_ASSET_ROOT}/characters/reid/sprite/reid__pose-idle__expr-confident__outfit-sword_saint.png`,
    ryuzu: `${GENERATED_ASSET_ROOT}/characters/ryuzu/sprite/ryuzu__pose-idle__expr-calm__outfit-sanctuary_robe.png`,
    sekmet: `${GENERATED_ASSET_ROOT}/characters/sekmet/sprite/sekmet__pose-idle__expr-tired__outfit-witch_robe.png`,
    sirius: `${GENERATED_ASSET_ROOT}/characters/sirius/sprite/sirius__pose-idle__expr-fanatic__outfit-cult_bandage_robe.png`,
    geuse: `${GENERATED_ASSET_ROOT}/characters/geuse/sprite/geuse__pose-idle__expr-gentle__outfit-forest_cleric.png`,
    petelgeuse: `${GENERATED_ASSET_ROOT}/characters/petelgeuse/sprite/petelgeuse__pose-idle__expr-mad_grin__outfit-archbishop_robes.png`,
    hetaro: `${GENERATED_ASSET_ROOT}/characters/hetaro/sprite/hetaro__pose-idle__expr-anxious__outfit-beast_mercenary.png`,
    tivey: `${GENERATED_ASSET_ROOT}/characters/tivey/sprite/tivey__pose-idle__expr-studious__outfit-beast_mercenary.png`,
    ley: `${GENERATED_ASSET_ROOT}/characters/ley/sprite/ley__pose-idle__expr-hungry_smile__outfit-gluttony_robe.png`,
    roy: `${GENERATED_ASSET_ROOT}/characters/roy/sprite/roy__pose-idle__expr-blank_smile__outfit-gluttony_robe.png`,
    wilhelm: `${GENERATED_ASSET_ROOT}/sprites/wilhelm.png`,
    bell_stripper: `${GENERATED_ASSET_ROOT}/characters/bell_stripper/sprite/bell_stripper__pose-ritual__expr-cold_laugh__outfit-cult_robe.png`,
    rishel: `${GENERATED_ASSET_ROOT}/characters/rishel/sprite/rishel__pose-idle__expr-soft_smile__outfit-nun_rain.png`,
    world_will: `${GENERATED_ASSET_ROOT}/characters/world_will/sprite/world_will__pose-system_avatar__expr-neutral__outfit-ceremonial.png`,
};

export const generatedCharacterSpriteVariantMap = {
    protagonist: {
        'adult.close_whisper.longing.private_indoor': `${GENERATED_ASSET_ROOT}/characters/protagonist/sprite/protagonist__pose-close_whisper__expr-longing__outfit-private_indoor__adult.png`,
        'base.idle.neutral.default': `${GENERATED_ASSET_ROOT}/characters/protagonist/sprite/protagonist__pose-idle__expr-neutral__outfit-default.png`,
    },
    lishelle: {
        'adult.rain_window_wait.hurt_softness.night_robe': `${GENERATED_ASSET_ROOT}/characters/lishelle/sprite/lishelle__pose-rain_window_wait__expr-hurt_softness__outfit-night_robe__adult.png`,
        'adult.sit_bedside.vulnerable.night_robe': `${GENERATED_ASSET_ROOT}/characters/lishelle/sprite/lishelle__pose-sit_bedside__expr-vulnerable__outfit-night_robe__adult.png`,
        'base.idle.soft_smile.nun_rain': `${GENERATED_ASSET_ROOT}/characters/lishelle/sprite/lishelle__pose-idle__expr-soft_smile__outfit-nun_rain.png`,
    },
    rishel: {
        'adult.sit_bedside.vulnerable.night_robe': `${GENERATED_ASSET_ROOT}/characters/rishel/sprite/rishel__pose-sit_bedside__expr-vulnerable__outfit-night_robe__adult.png`,
        'base.idle.soft_smile.nun_rain': `${GENERATED_ASSET_ROOT}/characters/rishel/sprite/rishel__pose-idle__expr-soft_smile__outfit-nun_rain.png`,
    },
    owen: {
        'adult.interrogate.conflicted.guard_coat_loosened': `${GENERATED_ASSET_ROOT}/characters/owen/sprite/owen__pose-interrogate__expr-conflicted__outfit-guard_coat_loosened__adult.png`,
        'adult.loosen_collar.possessive.private_indoor': `${GENERATED_ASSET_ROOT}/characters/owen/sprite/owen__pose-loosen_collar__expr-possessive__outfit-private_indoor__adult.png`,
        'base.interrogate.cold.guard_coat': `${GENERATED_ASSET_ROOT}/characters/owen/sprite/owen__pose-interrogate__expr-cold__outfit-guard_coat.png`,
    },
    emilia: {
        'adult.cape_wrap.aftercare_soft.aftercare_shawl': `${GENERATED_ASSET_ROOT}/characters/emilia/sprite/emilia__pose-cape_wrap__expr-aftercare_soft__outfit-aftercare_shawl__adult.png`,
        'adult.cape_wrap.jealous_smile.masked_party_formal': `${GENERATED_ASSET_ROOT}/characters/emilia/sprite/emilia__pose-cape_wrap__expr-jealous_smile__outfit-masked_party_formal__adult.png`,
        'adult.hand_reach.aftercare_soft.night_robe': `${GENERATED_ASSET_ROOT}/characters/emilia/sprite/emilia__pose-hand_reach__expr-aftercare_soft__outfit-night_robe__adult.png`,
        'adult.hand_reach.longing.night_robe': `${GENERATED_ASSET_ROOT}/characters/emilia/sprite/emilia__pose-hand_reach__expr-longing__outfit-night_robe__adult.png`,
        'adult.turn_blush.flustered.private_indoor': `${GENERATED_ASSET_ROOT}/characters/emilia/sprite/emilia__pose-turn_blush__expr-flustered__outfit-private_indoor__adult.png`,
        'adult.rain_window_wait.vulnerable.private_indoor': `${GENERATED_ASSET_ROOT}/characters/emilia/sprite/emilia__pose-rain_window_wait__expr-vulnerable__outfit-private_indoor__adult.png`,
        'adult.sit_bedside.hurt_softness.formal_loosened': `${GENERATED_ASSET_ROOT}/characters/emilia/sprite/emilia__pose-sit_bedside__expr-hurt_softness__outfit-formal_loosened__adult.png`,
    },
    rem: {
        'adult.hair_touch.breathless_shy.private_indoor': `${GENERATED_ASSET_ROOT}/characters/rem/sprite/rem__pose-hair_touch__expr-breathless_shy__outfit-private_indoor__adult.png`,
        'adult.lap_pillow.aftercare_soft.aftercare_shawl': `${GENERATED_ASSET_ROOT}/characters/rem/sprite/rem__pose-lap_pillow__expr-aftercare_soft__outfit-aftercare_shawl__adult.png`,
        'adult.protective_hold.longing.night_robe': `${GENERATED_ASSET_ROOT}/characters/rem/sprite/rem__pose-protective_hold__expr-longing__outfit-night_robe__adult.png`,
        'adult.rain_window_wait.conflicted.private_indoor': `${GENERATED_ASSET_ROOT}/characters/rem/sprite/rem__pose-rain_window_wait__expr-conflicted__outfit-private_indoor__adult.png`,
        'adult.tea_offer.teasing.formal': `${GENERATED_ASSET_ROOT}/characters/rem/sprite/rem__pose-tea_offer__expr-teasing__outfit-formal__adult.png`,
        'adult.wounded_care.aftercare_soft.healer_wrap': `${GENERATED_ASSET_ROOT}/characters/rem/sprite/rem__pose-wounded_care__expr-aftercare_soft__outfit-healer_wrap__adult.png`,
    },
    ram: {
        'adult.collar_adjust.warm_command.formal_loosened': `${GENERATED_ASSET_ROOT}/characters/ram/sprite/ram__pose-collar_adjust__expr-warm_command__outfit-formal_loosened__adult.png`,
        'adult.doorway_invitation.teasing.night_robe': `${GENERATED_ASSET_ROOT}/characters/ram/sprite/ram__pose-doorway_invitation__expr-teasing__outfit-night_robe__adult.png`,
        'adult.mirror_turn.guarded_desire.formal_loosened': `${GENERATED_ASSET_ROOT}/characters/ram/sprite/ram__pose-mirror_turn__expr-guarded_desire__outfit-formal_loosened__adult.png`,
        'adult.turn_blush.teasing.private_indoor': `${GENERATED_ASSET_ROOT}/characters/ram/sprite/ram__pose-turn_blush__expr-teasing__outfit-private_indoor__adult.png`,
        'adult.screen_shadow.teasing.silk_lounge': `${GENERATED_ASSET_ROOT}/characters/ram/sprite/ram__pose-screen_shadow__expr-teasing__outfit-silk_lounge__adult.png`,
    },
    julius: {
        'adult.kneel_oath.conflicted.formal_loosened': `${GENERATED_ASSET_ROOT}/characters/julius/sprite/julius__pose-kneel_oath__expr-conflicted__outfit-formal_loosened__adult.png`,
        'adult.loosen_collar.conflicted.formal_loosened': `${GENERATED_ASSET_ROOT}/characters/julius/sprite/julius__pose-loosen_collar__expr-conflicted__outfit-formal_loosened__adult.png`,
        'adult.glove_remove.guarded_desire.formal_unfastened': `${GENERATED_ASSET_ROOT}/characters/julius/sprite/julius__pose-glove_remove__expr-guarded_desire__outfit-formal_unfastened__adult.png`,
    },
    priscilla: {
        'adult.doorway_invitation.possessive.formal_loosened': `${GENERATED_ASSET_ROOT}/characters/priscilla/sprite/priscilla__pose-doorway_invitation__expr-possessive__outfit-formal_loosened__adult.png`,
        'adult.glove_remove.commanding.silk_lounge': `${GENERATED_ASSET_ROOT}/characters/priscilla/sprite/priscilla__pose-glove_remove__expr-commanding__outfit-silk_lounge__adult.png`,
        'adult.loosen_collar.teasing.formal_loosened': `${GENERATED_ASSET_ROOT}/characters/priscilla/sprite/priscilla__pose-loosen_collar__expr-teasing__outfit-formal_loosened__adult.png`,
        'adult.mirror_turn.cold_desire.masked_party_formal': `${GENERATED_ASSET_ROOT}/characters/priscilla/sprite/priscilla__pose-mirror_turn__expr-cold_desire__outfit-masked_party_formal__adult.png`,
        'adult.rival_table.commanding.imperial_formal': `${GENERATED_ASSET_ROOT}/characters/priscilla/sprite/priscilla__pose-rival_table__expr-commanding__outfit-imperial_formal__adult.png`,
        'adult.stage_command.dangerous_smile.imperial_formal': `${GENERATED_ASSET_ROOT}/characters/priscilla/sprite/priscilla__pose-stage_command__expr-dangerous_smile__outfit-imperial_formal__adult.png`,
    },
    regulus: {
        'base.idle.smug.white_formal': `${GENERATED_ASSET_ROOT}/characters/regulus/sprite/regulus__pose-idle__expr-smug__outfit-white_formal.png`,
    },
    reid: {
        'base.idle.confident.sword_saint': `${GENERATED_ASSET_ROOT}/characters/reid/sprite/reid__pose-idle__expr-confident__outfit-sword_saint.png`,
    },
    ryuzu: {
        'base.idle.calm.sanctuary_robe': `${GENERATED_ASSET_ROOT}/characters/ryuzu/sprite/ryuzu__pose-idle__expr-calm__outfit-sanctuary_robe.png`,
    },
    sekmet: {
        'base.idle.tired.witch_robe': `${GENERATED_ASSET_ROOT}/characters/sekmet/sprite/sekmet__pose-idle__expr-tired__outfit-witch_robe.png`,
    },
    sirius: {
        'base.idle.fanatic.cult_bandage_robe': `${GENERATED_ASSET_ROOT}/characters/sirius/sprite/sirius__pose-idle__expr-fanatic__outfit-cult_bandage_robe.png`,
    },
    geuse: {
        'base.idle.gentle.forest_cleric': `${GENERATED_ASSET_ROOT}/characters/geuse/sprite/geuse__pose-idle__expr-gentle__outfit-forest_cleric.png`,
    },
    petelgeuse: {
        'base.idle.mad_grin.archbishop_robes': `${GENERATED_ASSET_ROOT}/characters/petelgeuse/sprite/petelgeuse__pose-idle__expr-mad_grin__outfit-archbishop_robes.png`,
    },
    rom: {
        'base.idle.gruff.loot_house_apron': `${GENERATED_ASSET_ROOT}/characters/rom/sprite/rom__pose-idle__expr-gruff__outfit-loot_house_apron.png`,
    },
    hetaro: {
        'base.idle.anxious.beast_mercenary': `${GENERATED_ASSET_ROOT}/characters/hetaro/sprite/hetaro__pose-idle__expr-anxious__outfit-beast_mercenary.png`,
    },
    tivey: {
        'base.idle.studious.beast_mercenary': `${GENERATED_ASSET_ROOT}/characters/tivey/sprite/tivey__pose-idle__expr-studious__outfit-beast_mercenary.png`,
    },
    ley: {
        'base.idle.hungry_smile.gluttony_robe': `${GENERATED_ASSET_ROOT}/characters/ley/sprite/ley__pose-idle__expr-hungry_smile__outfit-gluttony_robe.png`,
    },
    roy: {
        'base.idle.blank_smile.gluttony_robe': `${GENERATED_ASSET_ROOT}/characters/roy/sprite/roy__pose-idle__expr-blank_smile__outfit-gluttony_robe.png`,
    },
    crusch: {
        'adult.cape_wrap.vulnerable.aftercare_shawl': `${GENERATED_ASSET_ROOT}/characters/crusch/sprite/crusch__pose-cape_wrap__expr-vulnerable__outfit-aftercare_shawl__adult.png`,
        'adult.cape_wrap.guarded_desire.military_formal': `${GENERATED_ASSET_ROOT}/characters/crusch/sprite/crusch__pose-cape_wrap__expr-guarded_desire__outfit-military_formal__adult.png`,
        'adult.sit_bedside.vulnerable.formal_loosened': `${GENERATED_ASSET_ROOT}/characters/crusch/sprite/crusch__pose-sit_bedside__expr-vulnerable__outfit-formal_loosened__adult.png`,
        'adult.helmet_off.resolved_desire.military_formal': `${GENERATED_ASSET_ROOT}/characters/crusch/sprite/crusch__pose-helmet_off__expr-resolved_desire__outfit-military_formal__adult.png`,
    },
    anastasia: {
        'adult.doorway_invitation.conflicted.private_indoor': `${GENERATED_ASSET_ROOT}/characters/anastasia/sprite/anastasia__pose-doorway_invitation__expr-conflicted__outfit-private_indoor__adult.png`,
        'adult.mirror_turn.teasing.formal_loosened': `${GENERATED_ASSET_ROOT}/characters/anastasia/sprite/anastasia__pose-mirror_turn__expr-teasing__outfit-formal_loosened__adult.png`,
        'adult.rival_table.jealous_smile.formal': `${GENERATED_ASSET_ROOT}/characters/anastasia/sprite/anastasia__pose-rival_table__expr-jealous_smile__outfit-formal__adult.png`,
        'adult.tea_offer.jealous_smile.formal': `${GENERATED_ASSET_ROOT}/characters/anastasia/sprite/anastasia__pose-tea_offer__expr-jealous_smile__outfit-formal__adult.png`,
    },
    roswaal: {
        'adult.tea_offer.dangerous_smile.formal_unfastened': `${GENERATED_ASSET_ROOT}/characters/roswaal/sprite/roswaal__pose-tea_offer__expr-dangerous_smile__outfit-formal_unfastened__adult.png`,
    },
    otto: {
        'adult.hand_reach.relieved.travel_rest': `${GENERATED_ASSET_ROOT}/characters/otto/sprite/otto__pose-hand_reach__expr-relieved__outfit-travel_rest__adult.png`,
    },
    reinhard: {
        'adult.protective_hold.after_battle_relief.military_formal': `${GENERATED_ASSET_ROOT}/characters/reinhard/sprite/reinhard__pose-protective_hold__expr-after_battle_relief__outfit-military_formal__adult.png`,
    },
    al: {
        'adult.helmet_off.conflicted.travel_cloak_loosened': `${GENERATED_ASSET_ROOT}/characters/al/sprite/al__pose-helmet_off__expr-conflicted__outfit-travel_cloak_loosened__adult.png`,
    },
    garfiel: {
        'adult.wounded_care.resolved_desire.travel_rest': `${GENERATED_ASSET_ROOT}/characters/garfiel/sprite/garfiel__pose-wounded_care__expr-resolved_desire__outfit-travel_rest__adult_au.png`,
    },
    heinkel: {
        'adult.loosen_collar.conflicted.formal_unfastened': `${GENERATED_ASSET_ROOT}/characters/heinkel/sprite/heinkel__pose-loosen_collar__expr-conflicted__outfit-formal_unfastened__adult.png`,
    },
    vincent: {
        'adult.rival_table.commanding.imperial_formal': `${GENERATED_ASSET_ROOT}/characters/vincent/sprite/vincent__pose-rival_table__expr-commanding__outfit-imperial_formal__adult.png`,
    },
    cecilus: {
        'adult.stage_command.dangerous_smile.travel_rest': `${GENERATED_ASSET_ROOT}/characters/cecilus/sprite/cecilus__pose-stage_command__expr-dangerous_smile__outfit-travel_rest__adult.png`,
    },
    ricardo: {
        'adult.cape_wrap.relieved.travel_cloak_loosened': `${GENERATED_ASSET_ROOT}/characters/ricardo/sprite/ricardo__pose-cape_wrap__expr-relieved__outfit-travel_cloak_loosened__adult.png`,
    },
    joshua: {
        'adult.book_hold.guarded_desire.formal': `${GENERATED_ASSET_ROOT}/characters/joshua/sprite/joshua__pose-book_hold__expr-guarded_desire__outfit-formal__adult.png`,
    },
    kiritaka: {
        'adult.hand_reach.conflicted.formal': `${GENERATED_ASSET_ROOT}/characters/kiritaka/sprite/kiritaka__pose-hand_reach__expr-conflicted__outfit-formal__adult.png`,
    },
    flop: {
        'adult.service_tea.relieved.travel_rest': `${GENERATED_ASSET_ROOT}/characters/flop/sprite/flop__pose-service_tea__expr-relieved__outfit-travel_rest__adult.png`,
    },
    halibel: {
        'adult.cape_wrap.guarded_desire.travel_cloak_loosened': `${GENERATED_ASSET_ROOT}/characters/halibel/sprite/halibel__pose-cape_wrap__expr-guarded_desire__outfit-travel_cloak_loosened__adult.png`,
    },
    chisha: {
        'adult.rival_table.commanding.imperial_formal': `${GENERATED_ASSET_ROOT}/characters/chisha/sprite/chisha__pose-rival_table__expr-commanding__outfit-imperial_formal__adult.png`,
    },
    wilhelm: {
        'adult.cape_wrap.after_battle_relief.military_formal': `${GENERATED_ASSET_ROOT}/characters/wilhelm/sprite/wilhelm__pose-cape_wrap__expr-after_battle_relief__outfit-military_formal__adult.png`,
        'adult.hand_kiss_offer.resolved_desire.formal_unfastened': `${GENERATED_ASSET_ROOT}/characters/wilhelm/sprite/wilhelm__pose-hand_kiss_offer__expr-resolved_desire__outfit-formal_unfastened__adult.png`,
    },
    elsa: {
        'adult.close_whisper.cold_desire.formal_loosened': `${GENERATED_ASSET_ROOT}/characters/elsa/sprite/elsa__pose-close_whisper__expr-cold_desire__outfit-formal_loosened__adult.png`,
        'adult.doorway_invitation.cold_desire.formal_loosened': `${GENERATED_ASSET_ROOT}/characters/elsa/sprite/elsa__pose-doorway_invitation__expr-cold_desire__outfit-formal_loosened__adult.png`,
        'adult.glove_remove.dangerous_smile.formal_loosened': `${GENERATED_ASSET_ROOT}/characters/elsa/sprite/elsa__pose-glove_remove__expr-dangerous_smile__outfit-formal_loosened__adult.png`,
        'adult.rival_table.dangerous_smile.formal_loosened': `${GENERATED_ASSET_ROOT}/characters/elsa/sprite/elsa__pose-rival_table__expr-dangerous_smile__outfit-formal_loosened__adult.png`,
    },
    satella: {
        'adult.hand_reach.longing.shadow_veil': `${GENERATED_ASSET_ROOT}/characters/satella/sprite/satella__pose-hand_reach__expr-longing__outfit-shadow_veil__adult.png`,
        'adult.mirror_turn.masked_longing.shadow_veil': `${GENERATED_ASSET_ROOT}/characters/satella/sprite/satella__pose-mirror_turn__expr-masked_longing__outfit-shadow_veil__adult.png`,
        'adult.screen_shadow.masked_longing.shadow_veil': `${GENERATED_ASSET_ROOT}/characters/satella/sprite/satella__pose-screen_shadow__expr-masked_longing__outfit-shadow_veil__adult.png`,
        'adult.thread_reach.longing.shadow_veil': `${GENERATED_ASSET_ROOT}/characters/satella/sprite/satella__pose-thread_reach__expr-longing__outfit-shadow_veil__adult.png`,
    },
    echidna: {
        'adult.screen_shadow.cold_desire.silk_lounge': `${GENERATED_ASSET_ROOT}/characters/echidna/sprite/echidna__pose-screen_shadow__expr-cold_desire__outfit-silk_lounge__adult.png`,
        'adult.sit_bedside.cold_desire.private_indoor': `${GENERATED_ASSET_ROOT}/characters/echidna/sprite/echidna__pose-sit_bedside__expr-cold_desire__outfit-private_indoor__adult.png`,
        'adult.tea_offer.cold_desire.silk_lounge': `${GENERATED_ASSET_ROOT}/characters/echidna/sprite/echidna__pose-tea_offer__expr-cold_desire__outfit-silk_lounge__adult.png`,
        'adult.tea_offer.teasing.witch_formal': `${GENERATED_ASSET_ROOT}/characters/echidna/sprite/echidna__pose-tea_offer__expr-teasing__outfit-witch_formal__adult.png`,
        'adult.book_hold.guarded_desire.robe_layered': `${GENERATED_ASSET_ROOT}/characters/echidna/sprite/echidna__pose-book_hold__expr-guarded_desire__outfit-robe_layered__adult.png`,
    },
    frederica: {
        'adult.hair_touch.aftercare_soft.private_indoor': `${GENERATED_ASSET_ROOT}/characters/frederica/sprite/frederica__pose-hair_touch__expr-aftercare_soft__outfit-private_indoor__adult.png`,
        'adult.hand_reach.relieved.formal': `${GENERATED_ASSET_ROOT}/characters/frederica/sprite/frederica__pose-hand_reach__expr-relieved__outfit-formal__adult.png`,
        'adult.service_tea.teasing.private_indoor': `${GENERATED_ASSET_ROOT}/characters/frederica/sprite/frederica__pose-service_tea__expr-teasing__outfit-private_indoor__adult.png`,
        'adult.service_tea.relieved.private_indoor': `${GENERATED_ASSET_ROOT}/characters/frederica/sprite/frederica__pose-service_tea__expr-relieved__outfit-private_indoor__adult.png`,
    },
    beatrice: {
        'adult.book_hold.oathful.robe_layered': `${GENERATED_ASSET_ROOT}/characters/beatrice/sprite/beatrice__pose-book_hold__expr-oathful__outfit-robe_layered__adult_au.png`,
        'adult.hand_reach.vulnerable.aftercare_shawl': `${GENERATED_ASSET_ROOT}/characters/beatrice/sprite/beatrice__pose-hand_reach__expr-vulnerable__outfit-aftercare_shawl__adult_au.png`,
        'adult.ritual_vow.guarded_desire.robe_layered': `${GENERATED_ASSET_ROOT}/characters/beatrice/sprite/beatrice__pose-ritual_vow__expr-guarded_desire__outfit-robe_layered__adult_au.png`,
    },
    petra: {
        'adult.rain_window_wait.resolved_desire.travel_rest': `${GENERATED_ASSET_ROOT}/characters/petra/sprite/petra__pose-rain_window_wait__expr-resolved_desire__outfit-travel_rest__adult_au.png`,
    },
    felt: {
        'adult.hand_reach.teasing.private_indoor': `${GENERATED_ASSET_ROOT}/characters/felt/sprite/felt__pose-hand_reach__expr-teasing__outfit-private_indoor__adult_au.png`,
        'adult.rain_window_wait.flustered.travel_rest': `${GENERATED_ASSET_ROOT}/characters/felt/sprite/felt__pose-rain_window_wait__expr-flustered__outfit-travel_rest__adult_au.png`,
        'adult.rival_table.commanding.formal': `${GENERATED_ASSET_ROOT}/characters/felt/sprite/felt__pose-rival_table__expr-commanding__outfit-formal__adult_au.png`,
    },
    shaula: {
        'adult.doorway_invitation.teasing.travel_rest': `${GENERATED_ASSET_ROOT}/characters/shaula/sprite/shaula__pose-doorway_invitation__expr-teasing__outfit-travel_rest__adult_au.png`,
        'adult.hand_reach.longing.travel_rest': `${GENERATED_ASSET_ROOT}/characters/shaula/sprite/shaula__pose-hand_reach__expr-longing__outfit-travel_rest__adult_au.png`,
    },
    yorna: {
        'adult.mirror_turn.teasing.imperial_formal': `${GENERATED_ASSET_ROOT}/characters/yorna/sprite/yorna__pose-mirror_turn__expr-teasing__outfit-imperial_formal__adult.png`,
        'adult.mirror_turn.teasing.silk_lounge': `${GENERATED_ASSET_ROOT}/characters/yorna/sprite/yorna__pose-mirror_turn__expr-teasing__outfit-silk_lounge__adult.png`,
        'adult.tea_offer.commanding.imperial_formal': `${GENERATED_ASSET_ROOT}/characters/yorna/sprite/yorna__pose-tea_offer__expr-commanding__outfit-imperial_formal__adult.png`,
    },
    capella: {
        'adult.mirror_turn.cold_desire.formal_loosened': `${GENERATED_ASSET_ROOT}/characters/capella/sprite/capella__pose-mirror_turn__expr-cold_desire__outfit-formal_loosened__adult.png`,
        'adult.mirror_turn.dangerous_smile.formal_loosened': `${GENERATED_ASSET_ROOT}/characters/capella/sprite/capella__pose-mirror_turn__expr-dangerous_smile__outfit-formal_loosened__adult.png`,
        'adult.stage_command.cold_desire.formal_loosened': `${GENERATED_ASSET_ROOT}/characters/capella/sprite/capella__pose-stage_command__expr-cold_desire__outfit-formal_loosened__adult.png`,
    },
    daphne: {
        'adult.book_hold.guarded_desire.shadow_veil': `${GENERATED_ASSET_ROOT}/characters/daphne/sprite/daphne__pose-book_hold__expr-guarded_desire__outfit-shadow_veil__adult_au.png`,
        'adult.thread_reach.longing.shadow_veil': `${GENERATED_ASSET_ROOT}/characters/daphne/sprite/daphne__pose-thread_reach__expr-longing__outfit-shadow_veil__adult_au.png`,
    },
    carmilla: {
        'adult.close_whisper.flustered.silk_lounge': `${GENERATED_ASSET_ROOT}/characters/carmilla/sprite/carmilla__pose-close_whisper__expr-flustered__outfit-silk_lounge__adult.png`,
        'adult.hand_reach.vulnerable.robe_layered': `${GENERATED_ASSET_ROOT}/characters/carmilla/sprite/carmilla__pose-hand_reach__expr-vulnerable__outfit-robe_layered__adult.png`,
        'adult.turn_blush.hurt_softness.robe_layered': `${GENERATED_ASSET_ROOT}/characters/carmilla/sprite/carmilla__pose-turn_blush__expr-hurt_softness__outfit-robe_layered__adult.png`,
    },
    mimi: {
        'adult.cape_wrap.aftercare_soft.travel_cloak_loosened': `${GENERATED_ASSET_ROOT}/characters/mimi/sprite/mimi__pose-cape_wrap__expr-aftercare_soft__outfit-travel_cloak_loosened__adult_au.png`,
        'adult.service_tea.relieved.travel_rest': `${GENERATED_ASSET_ROOT}/characters/mimi/sprite/mimi__pose-service_tea__expr-relieved__outfit-travel_rest__adult_au.png`,
    },
    meili: {
        'adult.doorway_invitation.dangerous_smile.private_indoor': `${GENERATED_ASSET_ROOT}/characters/meili/sprite/meili__pose-doorway_invitation__expr-dangerous_smile__outfit-private_indoor__adult_au.png`,
        'adult.hair_touch.teasing.private_indoor': `${GENERATED_ASSET_ROOT}/characters/meili/sprite/meili__pose-hair_touch__expr-teasing__outfit-private_indoor__adult_au.png`,
    },
    minerva: {
        'adult.wounded_care.aftercare_soft.healer_wrap': `${GENERATED_ASSET_ROOT}/characters/minerva/sprite/minerva__pose-wounded_care__expr-aftercare_soft__outfit-healer_wrap__adult.png`,
        'adult.hand_reach.commanding.healer_wrap': `${GENERATED_ASSET_ROOT}/characters/minerva/sprite/minerva__pose-hand_reach__expr-commanding__outfit-healer_wrap__adult.png`,
        'adult.wounded_care.relieved.healer_wrap': `${GENERATED_ASSET_ROOT}/characters/minerva/sprite/minerva__pose-wounded_care__expr-relieved__outfit-healer_wrap__adult.png`,
    },
    pandora: {
        'adult.glove_remove.dangerous_smile.silk_lounge': `${GENERATED_ASSET_ROOT}/characters/pandora/sprite/pandora__pose-glove_remove__expr-dangerous_smile__outfit-silk_lounge__adult_au.png`,
        'adult.hand_reach.masked_longing.shadow_veil': `${GENERATED_ASSET_ROOT}/characters/pandora/sprite/pandora__pose-hand_reach__expr-masked_longing__outfit-shadow_veil__adult_au.png`,
        'adult.screen_shadow.masked_longing.shadow_veil': `${GENERATED_ASSET_ROOT}/characters/pandora/sprite/pandora__pose-screen_shadow__expr-masked_longing__outfit-shadow_veil__adult_au.png`,
    },
    ferris: {
        'adult.wounded_care.relieved.healer_wrap': `${GENERATED_ASSET_ROOT}/characters/ferris/sprite/ferris__pose-wounded_care__expr-relieved__outfit-healer_wrap__adult.png`,
    },
    fortuna: {
        'adult.cape_wrap.aftercare_soft.travel_rest': `${GENERATED_ASSET_ROOT}/characters/fortuna/sprite/fortuna__pose-cape_wrap__expr-aftercare_soft__outfit-travel_rest__adult.png`,
        'adult.protective_hold.relieved.travel_cloak_loosened': `${GENERATED_ASSET_ROOT}/characters/fortuna/sprite/fortuna__pose-protective_hold__expr-relieved__outfit-travel_cloak_loosened__adult.png`,
        'adult.rain_window_wait.vulnerable.night_robe': `${GENERATED_ASSET_ROOT}/characters/fortuna/sprite/fortuna__pose-rain_window_wait__expr-vulnerable__outfit-night_robe__adult.png`,
    },
    liliana: {
        'adult.mirror_turn.teasing.masked_party_formal': `${GENERATED_ASSET_ROOT}/characters/liliana/sprite/liliana__pose-mirror_turn__expr-teasing__outfit-masked_party_formal__adult.png`,
        'adult.stage_command.teasing.masked_party_formal': `${GENERATED_ASSET_ROOT}/characters/liliana/sprite/liliana__pose-stage_command__expr-teasing__outfit-masked_party_formal__adult.png`,
    },
    medium: {
        'adult.hand_reach.teasing.travel_rest': `${GENERATED_ASSET_ROOT}/characters/medium/sprite/medium__pose-hand_reach__expr-teasing__outfit-travel_rest__adult_au.png`,
        'adult.wounded_care.aftercare_soft.travel_cloak_loosened': `${GENERATED_ASSET_ROOT}/characters/medium/sprite/medium__pose-wounded_care__expr-aftercare_soft__outfit-travel_cloak_loosened__adult_au.png`,
    },
    narrator: {
        'base.system_avatar.neutral.ceremonial': `${GENERATED_ASSET_ROOT}/characters/narrator/sprite/narrator__pose-system_avatar__expr-neutral__outfit-ceremonial.png`,
    },
    world_will: {
        'base.system_avatar.neutral.ceremonial': `${GENERATED_ASSET_ROOT}/characters/world_will/sprite/world_will__pose-system_avatar__expr-neutral__outfit-ceremonial.png`,
    },
    bellringer: {
        'base.ritual.cold_laugh.cult_robe': `${GENERATED_ASSET_ROOT}/characters/bellringer/sprite/bellringer__pose-ritual__expr-cold_laugh__outfit-cult_robe.png`,
    },
    bell_stripper: {
        'base.ritual.cold_laugh.cult_robe': `${GENERATED_ASSET_ROOT}/characters/bell_stripper/sprite/bell_stripper__pose-ritual__expr-cold_laugh__outfit-cult_robe.png`,
    },
};

for (const [characterId, variants] of Object.entries(externalGrokAdultCharacterSpriteVariantMap || {})) {
    generatedCharacterSpriteVariantMap[characterId] = {
        ...(generatedCharacterSpriteVariantMap[characterId] || {}),
        ...(variants || {}),
    };
}

export {
    externalGrokAdultReferenceMap,
    externalGrokAdultRuntimeSummary,
    sourceNovelAssetSummary,
    sourceNovelAssets,
    sourceNovelCharacterImageMap,
    sourceNovelSceneImageMap,
};

export const generatedCharacterConceptMap = {
    protagonist: `${GENERATED_ASSET_ROOT}/characters/protagonist/concept/protagonist__concept.png`,
    narrator: `${GENERATED_ASSET_ROOT}/characters/narrator/concept/narrator__concept.png`,
    world_will: `${GENERATED_ASSET_ROOT}/characters/world_will/concept/world_will__concept.png`,
    lishelle: `${GENERATED_ASSET_ROOT}/characters/lishelle/concept/lishelle__concept.png`,
    rishel: `${GENERATED_ASSET_ROOT}/characters/rishel/concept/rishel__concept.png`,
    owen: `${GENERATED_ASSET_ROOT}/characters/owen/concept/owen__concept.png`,
    mia: `${GENERATED_ASSET_ROOT}/characters/mia/concept/mia__concept.png`,
    bellringer: `${GENERATED_ASSET_ROOT}/characters/bellringer/concept/bellringer__concept.png`,
    bell_stripper: `${GENERATED_ASSET_ROOT}/characters/bell_stripper/concept/bell_stripper__concept.png`,
};

export const remoteCharacterImageMap = {
    satella: 'https://static.wikia.nocookie.net/rezero/images/a/aa/Satella-bd.png/revision/latest?cb=20210204010138',
    pandora: 'https://static.wikia.nocookie.net/rezero/images/b/b6/Pandora_LN_character_design.png/revision/latest?cb=20230720040444',
    fortuna: 'https://static.wikia.nocookie.net/rezero/images/2/20/Fortuna_LN_character_design.png/revision/latest?cb=20230313184638',
    geuse: 'https://static.wikia.nocookie.net/rezero/images/f/f9/Geuse_Roman%C3%A9e-Conti_LN_character_design.png/revision/latest?cb=20230701161900',
    rom: 'https://static.wikia.nocookie.net/rezero/images/c/cd/Old_Man_Rom_LN_character_design.png/revision/latest?cb=20240203232018',
    volcanica: 'https://static.wikia.nocookie.net/rezero/images/a/aa/Re_Zero_Light_Novel_25_2.png/revision/latest?cb=20220621062710',
    chisha: 'https://static.wikia.nocookie.net/rezero/images/7/7c/Chisha_Gold_LN_character_design_clean.png/revision/latest?cb=20230415042836',
    cecilus: 'https://static.wikia.nocookie.net/rezero/images/c/c9/Cecilus_Segmunt_cutout.png/revision/latest?cb=20230527060240',
    flop: 'https://static.wikia.nocookie.net/rezero/images/1/18/Flop_O%27Connell_LN_character_design_%28finished%2C_png%29.png/revision/latest?cb=20230602091456',
    halibel: 'https://static.wikia.nocookie.net/rezero/images/9/9e/Halibel_LN_character_design_clean.png/revision/latest?cb=20230629054455',
    medium: 'https://static.wikia.nocookie.net/rezero/images/8/8f/Medium_character_design_%28finished%2C_png%29.png/revision/latest?cb=20230602091448',
    vincent: 'https://static.wikia.nocookie.net/rezero/images/9/99/Vincent_Vollachia_Without_Sample.jpg/revision/latest?cb=20191209170758',
    yorna: 'https://static.wikia.nocookie.net/rezero/images/1/1d/Yorna_Mishigure_character_sketch_clean.png/revision/latest?cb=20230609031234',
};

export const characterImageAliasMap = {
    louis: 'rui',
};
