import { Page, Browser } from "playwright";

const DONE_SIGNALS: string[] = ['SIGINT', 'SIGTERM', 'exit'];

/**
 * Blocks loading of unnecessary resource types (images, stylesheets, fonts, media) on a web page.
 *
 * @param {Page} page - the Chromium `Page` instance on which to block resource loading
 * @returns {Promise<void>} - a promise that resolves when routing is set up
 */
async function blockUnusedResources(page: Page) {
    await page.route('**/*', async (route) => {
        const resourceType = route.request().resourceType();

        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
            await route.abort();
        } else {
            await route.continue();
        }
    })
}

/**
 * Safely shuts down a browser instance and exit the Node process.
 *
 * @param {Browser} [browser] - an Chromium `Browser` instance to close before exiting
 * @returns {Promise<void>} - a promise that resolves when the shutdown procedure is complete
 */
async function safeShutdown(browser?: Browser) {
    try {
        if (browser && browser.isConnected()) {
            await browser.close();
            console.log("Browser was succesfully closed");
        }
    } catch(error) {
        console.error("Error on closing the browser: ", error);
    }
    process.exit();
}

/**
 * Shut down the browser on process termination signals.
 *
 * @param {Browser} browser - a Chromium `Browser` instance to close on shutdown
 * @returns {void}
 */
async function shutdownOnSignals(browser: Browser) {
    DONE_SIGNALS.forEach(signal => {
        process.on(signal, () => safeShutdown(browser));
    });
}

export default {
    blockUnusedResources: blockUnusedResources,
    safeShutdown: safeShutdown,
    shutdownOnSignals: shutdownOnSignals
}
