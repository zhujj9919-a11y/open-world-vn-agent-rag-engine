Original prompt: 继续，按照审计方法，全方位的对现有游戏进行改进升级。

## 2026-05-23 Audit Loop Notes

- Scope: Re:0 dark visual novel / adventure engine in `public/scripts/extensions/third-party/re0-adventure-engine`.
- Current priority: product-grade reliability and playability, especially command routing, review-mode escape, HUD/status consistency, and automated release guards.
- This project is not a canvas game, but the web-game iteration discipline applies: small change -> static/release checks -> lint/unit tests -> browser/service smoke.
- Added before this note: product diagnosis commands, narrative QA, background clock/mainline clock decoupling, HUD policy text, narrative QA auto-correction, release-check product guards.
- Next loose ends:
  - Add browser-readable debug state for Playwright/Codex inspection. Done: `window.re0AdventureDebug()` and `window.render_game_to_text()`.
  - Fix review-mode sticking when the user resumes normal first-person play. Done: review mode auto-returns to main for non-meta player actions.
  - Keep release checks guarding product behavior, not only syntax/assets. Done: release check now guards review escape, debug hook, background/mainline policy, and QA correction.

## 2026-05-23 Continued Audit Loop

- Added browser-readable debug snapshot with current mode, story layer, objective, presence, world clock policy, mainline clock, backdrop, narrative QA, flags, save count, and HUD visibility/status.
- Added `render_game_to_text()` so future Playwright/Codex browser smoke tests can inspect state without relying only on screenshots.
- Fixed review-mode trapping: if the player reads a diagnostic/review panel and then types a normal action, the engine automatically returns to the main viewpoint and continues the story instead of staying in review mode.
- Updated `scripts/re0-release-check.mjs` product guards and served-extension checks for the new debug hook and review escape behavior.
- Validation passed: node syntax, release check, eslint, unit tests. Service log tail did not show current Re:0 runtime errors.

Next suggestions:
- Install or wire a Playwright package for this workspace so `render_game_to_text()` can be exercised in a full browser E2E script.
- Add dedicated pure-function tests for `processUserCommands()` review escape and background/mainline clock policy once the extension is split into modules.

## 2026-05-25 Audit Loop

- Corrected prompt-level policy conflict: narrative defaults, storyFlow, worldClock summary, and rule 3 now all say the same thing about mainline progression. Daily/adult automatic background clock only creates rumors/time-drift/revealable signals; mainline clock advances only in mainline mode, manual time advance/cross-day, fast-forward, or explicit world simulation.
- Added release-check guard for the aligned state-prompt policy string.
- Ran Playwright MCP page smoke against `http://127.0.0.1:8000`: HUD exists, `re0AdventureDebug()` and `render_game_to_text()` are available, debug snapshot reports `storyMode=daily` and `worldClock.policy=mainline-pulse-paused`.
- Browser console check: 0 errors, 0 warnings.
- Fixed volatile notice lifecycle: `appendSystemNotice()` now prioritizes new notices; `systemNoticeForPrompt()` compresses normal notices; `shouldDropStaleSystemNotice()` drops derived HUD/worldline notices that should not remain prompt instructions.
- Browser re-smoke confirmed stale `systemNotice` cleared from debug output (`lastSystemNoticeChars=0→0`), with HUD and world clock policy intact.
- UI collapse hotfix: root cause was the new mobile overlay rule hiding HUD when `re0-character-panel-open` remained on `body`. Added `syncCharacterPanelOpenClass()`, `recoverAdventureUi()`, `window.re0AdventureRecoverUi()`, `?re0_recover=1`, and Escape recovery. Release check now guards these mechanisms. Verified syntax, release check, lint, and mobile browser recovery at 390x844.
- Continued 2026-05-26 audit: fixed answer-book return state drift and stale scene presence. Closed answer-book objectives now become actionable “use the retained death lesson” objectives; anchor-return windows suppress failed-branch scene cache and stale outcome-derived names; scene presence now uses strict concrete-location matching so parent regions such as `王都贫民区` populate area/world layers instead of current scene. Browser debug now shows current scene `王都卫兵、街市小贩` while Lishelle/Bellringer remain in area/world context. Validation passed: release check, lint, unit tests 6/315, Playwright console 0 warnings/errors.
- Continued speaker split audit: added cast-director dialogue separation policy and hard prompt rule `1d`. The engine/world will act as narrator only; NPCs must directly speak with attributed dialogue such as `王都卫兵压低声音：「……」`. Narrative QA now flags `角色台词未分离` when named characters appear without attributed direct speech. Release check guards this behavior. Validation passed: node checks, release check, lint, browser source/debug smoke, console 0 warnings/errors.
