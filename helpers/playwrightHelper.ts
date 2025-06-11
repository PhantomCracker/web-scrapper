import { Page, Browser } from "playwright";

const DONE_SIGNALS: string[] = ['SIGINT', 'SIGTERM', 'exit'];

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
