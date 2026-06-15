#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const sourceFiles = [
    'data/default-user/re0-engine/storylines/ROYAL_CAPITAL_IF_BRANCH_RULES_2026-05-28.json',
    'data/default-user/re0-engine/storylines/MANSION_IF_BRANCH_RULES_2026-05-28.json',
    'data/default-user/re0-engine/storylines/if-rules/ARC3_ARC4_IF_BRANCH_RULES_2026-05-28.json',
    'data/default-user/re0-engine/storylines/if-rules/ARC5_ARC6_ARC7_IF_BRANCH_RULES_2026-05-28.json',
    'data/default-user/re0-engine/storylines/if-rules/ARC8_ARC11_IF_BRANCH_RULES_2026-05-28.json',
];
const softDivisionFile = 'data/default-user/re0-engine/storylines/IF_SOFT_DIVERGENCE_CONTINUITY_MATRIX_2026-05-29.json';
const choiceTagPatchFiles = [
    'data/default-user/re0-engine/collab/inbox/storylines/20260529-1624-storyline-if-worker-01-arc1-4-death-failure-choice-tags.json',
];
const outputFile = 'public/scripts/extensions/third-party/re0-adventure-engine/data/if-branch-rules.generated.js';

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readOptionalJson(relativePath) {
    const file = path.join(root, relativePath);
    if (!fs.existsSync(file)) {
        return null;
    }
    return readJson(relativePath);
}

function chineseTerms(text) {
    return [...String(text || '').matchAll(/[\u4e00-\u9fa5A-Za-z0-9-]{2,18}/g)]
        .map((match) => match[0])
        .filter((term) => !/^(玩家|角色|选择|世界线|原作|项目|当前|如果|可以|或者|以及|不是|直接|证据|死亡|失败|风险|适用|Arc)$/u.test(term));
}

function cleanChoiceText(value, limit = 96) {
    return String(value || '')
        .replace(/486\/Subaru/gi, '玩家继承因果')
        .replace(/\bSubaru\b/gi, '玩家继承因果')
        .replace(/\bNatsuki\b/gi, '玩家继承因果')
        .replace(/菜月昴/g, '玩家继承因果')
        .replace(/486/g, '旧流程')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, limit);
}

function keywordSet(rule) {
    const source = [
        rule.id,
        rule.title,
        rule.branchName,
        rule.arc,
        rule.canonicalAttractor,
        rule.playerDeviation,
        rule.divergencePoint,
        rule.playerActionPattern,
        rule.payoff,
        rule.cost,
        rule.routeReward?.summary,
        rule.answerBookLesson?.title,
        rule.answerBookLesson?.lesson,
        ...(rule.projectOriginalElements || []),
        ...(rule.deathOrFailureFlags || []),
        ...(rule.failureFlags || []),
        ...(rule.deathFlags || []),
        ...(rule.correctionEntrances || []),
        ...(rule.ifTendency || []),
        ...(rule.routeReward?.keys || []),
        ...(rule.routeReward?.unlocks || []),
    ].join(' ');
    return [...new Set(chineseTerms(source))].slice(0, 24);
}

function compactHints(hints = {}) {
    return {
        worldlineShift: hints.worldlineShift || {},
        routePressure: hints.routePressure || {},
        axisScores: hints.axisScores || {},
        keys: Array.isArray(hints.keys) ? hints.keys.slice(0, 6) : [],
        candidateEndings: Array.isArray(hints.candidateEndings) ? hints.candidateEndings.slice(0, 6) : [],
    };
}

function compactVnStaging(rule) {
    if (rule.vnStaging) {
        return rule.vnStaging;
    }
    const hints = rule.vnStageHints || {};
    const parts = [
        hints.background && `背景=${hints.background}`,
        Array.isArray(hints.characterFocus) && hints.characterFocus.length ? `焦点=${hints.characterFocus.slice(0, 5).join('/')}` : '',
        hints.choiceStyle && `选择=${hints.choiceStyle}`,
        hints.hudCue && `HUD=${hints.hudCue}`,
    ].filter(Boolean);
    return parts.join('；');
}

function compactChoiceOverlayHints(rule, choiceTagPatch = null) {
    const hints = rule.choiceOverlayHints || {};
    const taggedChoices = Array.isArray(choiceTagPatch?.choiceOverlayHints?.choices)
        ? choiceTagPatch.choiceOverlayHints.choices
            .map((choice) => ({
                tag: String(choice?.tag || '').trim(),
                text: cleanChoiceText(choice?.text),
            }))
            .filter((choice) => choice.text)
            .slice(0, 5)
        : [];
    const choices = taggedChoices.length
        ? taggedChoices.map((choice) => choice.text)
        : (Array.isArray(hints.playerFacingChoices)
            ? hints.playerFacingChoices.map((choice) => cleanChoiceText(choice)).filter(Boolean).slice(0, 5)
            : []);
    const patchedHints = choiceTagPatch?.choiceOverlayHints || {};
    return {
        playerFacingChoices: choices,
        choices: taggedChoices,
        riskChoice: cleanChoiceText(patchedHints.riskChoice || hints.riskChoice || taggedChoices.find((choice) => choice.tag === 'risk')?.text || ''),
        keepInformationChoice: cleanChoiceText(patchedHints.keepInformationChoice || hints.keepInformationChoice || taggedChoices.find((choice) => choice.tag === 'keep')?.text || ''),
        pseudoSafeChoice: cleanChoiceText(patchedHints.pseudoSafeChoice || hints.pseudoSafeChoice || taggedChoices.find((choice) => choice.tag === 'pseudo')?.text || ''),
        normalChoice: cleanChoiceText(patchedHints.normalChoice || hints.normalChoice || taggedChoices.find((choice) => choice.tag === 'normal')?.text || ''),
        recommendedStoryMode: /^(daily|mainline|adult)$/u.test(String(patchedHints.recommendedStoryMode || hints.recommendedStoryMode || ''))
            ? String(patchedHints.recommendedStoryMode || hints.recommendedStoryMode)
            : '',
    };
}

function compactSoftDivision(node = null) {
    if (!node) {
        return null;
    }
    const deathProfile = node.deathBranchProfile || {};
    const attractor = node.continuityAttractorDomain || {};
    return {
        ruleId: node.ruleId,
        branchName: node.branchName || '',
        dominantAxis: node.dominantAxis || '',
        divergenceSign: node.divergenceSign || '',
        divergenceScore: Number(node.divergenceScore || 0),
        continuityRisk: Number(node.continuityRisk || 0),
        continuityRiskBand: node.continuityRiskBand || '',
        softLocks: {
            soft: Number(node.softLocks?.soft || 0),
            hard: Number(node.softLocks?.hard || 0),
        },
        suggestedDivergenceDelta: Number(node.suggestedDivergenceDelta || 0),
        routePressureDelta: node.routePressureDelta || {},
        routeRewardType: node.routeRewardType || '',
        deathFlags: Array.isArray(deathProfile.deathFlags) ? deathProfile.deathFlags.slice(0, 8) : [],
        failureFlags: Array.isArray(deathProfile.failureFlags) ? deathProfile.failureFlags.slice(0, 8) : [],
        correctionEntrances: Array.isArray(deathProfile.correctionEntrances) ? deathProfile.correctionEntrances.slice(0, 8) : [],
        playerFacingChoices: Array.isArray(node.playerFacingChoices) ? node.playerFacingChoices.slice(0, 5) : [],
        recommendedStoryMode: /^(daily|mainline|adult)$/u.test(String(node.recommendedStoryMode || ''))
            ? node.recommendedStoryMode
            : '',
        routeNarrativeHint: node.routeNarrativeHint || '',
        continuityAttractorDomain: {
            activeCast: Array.isArray(attractor.activeCast) ? attractor.activeCast.slice(0, 8) : [],
            areaCast: Array.isArray(attractor.areaCast) ? attractor.areaCast.slice(0, 8) : [],
            worldActiveCast: Array.isArray(attractor.worldActiveCast) ? attractor.worldActiveCast.slice(0, 8) : [],
        },
    };
}

function normalizeStateHints(rule, softDivision = null) {
    if (rule.stateHints) {
        const hints = compactHints(rule.stateHints);
        if (softDivision?.routePressureDelta) {
            hints.routePressure = { ...softDivision.routePressureDelta, ...hints.routePressure };
        }
        if (softDivision?.suggestedDivergenceDelta && !Number.isFinite(Number(hints.worldlineShift?.divergence))) {
            hints.worldlineShift = {
                ...hints.worldlineShift,
                divergence: softDivision.suggestedDivergenceDelta,
            };
        }
        return hints;
    }
    const offset = rule.worldlineOffsetDelta || {};
    return compactHints({
        worldlineShift: {
            domain: offset.domain,
            tendency: offset.tendency,
            divergence: Number.isFinite(Number(offset.divergence))
                ? offset.divergence
                : softDivision?.suggestedDivergenceDelta,
            stability: offset.stability,
        },
        routePressure: {
            ...(softDivision?.routePressureDelta || {}),
            ...(offset.routePressures || {}),
        },
        axisScores: rule.pressureAxes || {},
        keys: [
            ...(Array.isArray(rule.routeReward?.keys) ? rule.routeReward.keys : []),
            ...(Array.isArray(rule.routeReward?.unlocks) ? rule.routeReward.unlocks : []),
        ],
        candidateEndings: Array.isArray(rule.routeReward?.candidateEndings) ? rule.routeReward.candidateEndings : [],
    });
}

const softDivisionDocument = readOptionalJson(softDivisionFile);
const softDivisionByRuleId = new Map((softDivisionDocument?.softDivisionNodes || [])
    .map((node) => [node.ruleId, compactSoftDivision(node)]));
const choiceTagPatchDocuments = choiceTagPatchFiles
    .map((relativePath) => ({ relativePath, document: readOptionalJson(relativePath) }))
    .filter((item) => item.document);
const choiceTagPatchByRuleId = new Map(choiceTagPatchDocuments
    .flatMap(({ relativePath, document }) => (Array.isArray(document.entries) ? document.entries : [])
        .map((entry) => [entry.sourceRuleId, {
            ...entry,
            sourcePatchFile: relativePath,
        }])));

function normalizeIfRule(rule, relativePath) {
    const softDivision = softDivisionByRuleId.get(rule.id) || null;
    const choiceTagPatch = choiceTagPatchByRuleId.get(rule.id) || null;
    const choiceOverlayHints = compactChoiceOverlayHints(rule, choiceTagPatch);
    if (softDivision?.playerFacingChoices?.length && !choiceOverlayHints.playerFacingChoices.length) {
        choiceOverlayHints.playerFacingChoices = softDivision.playerFacingChoices;
    }
    if (softDivision?.recommendedStoryMode && !choiceOverlayHints.recommendedStoryMode) {
        choiceOverlayHints.recommendedStoryMode = softDivision.recommendedStoryMode;
    }
    const correctionEntrances = [
        ...(rule.correctionEntrances || []),
        ...(softDivision?.correctionEntrances || []),
    ];
    const deathOrFailureFlags = [
        ...(rule.deathOrFailureFlags || []),
        ...(rule.failureFlags || []),
        ...(rule.deathFlags || []),
        ...(softDivision?.deathFlags || []),
        ...(softDivision?.failureFlags || []),
    ];
    const ifTendency = [
        ...(rule.ifTendency || [rule.worldlineOffsetDelta?.tendency].filter(Boolean)),
        softDivision?.dominantAxis,
    ].filter(Boolean);
    return {
        id: rule.id,
        arc: rule.arc,
        title: rule.title || rule.branchName || softDivision?.branchName || rule.id,
        sourceTypes: rule.sourceTypes || [],
        ifTendency: [...new Set(ifTendency)],
        payoff: rule.payoff || rule.routeReward?.summary || '',
        cost: rule.cost || (Array.isArray(rule.failureFlags) ? rule.failureFlags.slice(0, 2).join('；') : ''),
        deathOrFailureFlags: [...new Set(deathOrFailureFlags)].slice(0, 12),
        correctionEntrances: [...new Set(correctionEntrances)].slice(0, 12),
        vnStaging: compactVnStaging(rule),
        choiceOverlayHints,
        keywords: keywordSet(rule),
        stateHints: normalizeStateHints(rule, softDivision),
        answerBookLesson: rule.answerBookLesson || null,
        deathChangesPlayerStrategy: choiceTagPatch?.deathChangesPlayerStrategy || '',
        softDivision,
        choiceTagPatchSource: choiceTagPatch?.sourcePatchFile || '',
        sourceFile: relativePath,
    };
}

const rules = sourceFiles.flatMap((relativePath) => {
    const document = readJson(relativePath);
    return (document.rules || []).map((rule) => normalizeIfRule(rule, relativePath));
});

const output = `/* eslint-disable */
// Generated by scripts/build-re0-if-branch-rules.mjs. Do not edit by hand.
export const generatedIfBranchRuleMetadata = ${JSON.stringify({
    generatedAt: new Date().toISOString(),
    sourceFiles: [
        ...sourceFiles,
        ...(softDivisionDocument ? [softDivisionFile] : []),
        ...choiceTagPatchDocuments.map((item) => item.relativePath),
    ],
    count: rules.length,
    softDivisionCount: softDivisionByRuleId.size,
    choiceTagPatchCount: choiceTagPatchByRuleId.size,
}, null, 4)};

export const generatedIfBranchRules = ${JSON.stringify(rules, null, 4)};
`;

fs.writeFileSync(path.join(root, outputFile), output);
console.log(JSON.stringify({ outputFile, count: rules.length }, null, 2));
