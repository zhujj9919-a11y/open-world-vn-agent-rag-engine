/* global document, window */

export const testSetup = {
    /**
     * Navigates to the home page without waiting for SillyTavern to load.
     * @param {Object} params
     * @param {import('@playwright/test').Page} params.page
     */
    goST: async ({ page }) => {
        await page.goto('/');
    },

    /**
     * Waits for SillyTavern to fully load by navigating to the home page and waiting for the preloader to disappear.
     * @param {Object} params
     * @param {import('@playwright/test').Page} params.page
     */
    awaitST: async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => {
            return Boolean(document.querySelector('#userList .userSelect')
                || document.querySelector('#send_textarea')
                || window.SillyTavern?.getContext);
        }, null, { timeout: 60_000 });

        const userSelect = page.locator('#userList .userSelect').last();
        if (await userSelect.count()) {
            await userSelect.click();
        }

        await page.waitForFunction(() => {
            const preloaderGone = document.getElementById('preloader') === null;
            const mainUiReady = Boolean(document.querySelector('#send_textarea') || window.SillyTavern?.getContext);
            return preloaderGone && mainUiReady;
        }, null, { timeout: 60_000 });

        await page.waitForFunction(async () => {
            try {
                const { macros } = await import('./scripts/macros/macro-system.js');
                return Boolean(macros?.registry?.hasMacro?.('newline'));
            } catch {
                return false;
            }
        }, null, { timeout: 60_000 });
    },
};
