import { chromium, Page } from "playwright";
import * as cheerio from 'cheerio';

const visited = new Set<string>();

// TODO: check if the server is online (to much time consuming with fetch, for the moment I accept the isValidUrl solution)
// TODO: check if the site is redirecting to another URL (I do something similar in normalizeUrl using the hostname)
// TODO: verify only specific routes for the data that needs to be scrapped (gotta think on a method here...)

function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

// return string due to the fact that the Javascript object comparision does not work really well, so we compare two strings
function normalizeUrl(fullURL: string): string {
    try {
        const url: URL = new URL(fullURL);

        url.protocol = url.protocol.toLowerCase();
        url.hostname = url.hostname.toLowerCase();
        url.hash = '';
        if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) {
            url.port = '';
        }
        if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
            url.pathname = url.pathname.slice(0, -1); // remove slashes until it's root
        }

        return url.toString();
    } catch {
        return fullURL;
    }
}

async function isHtmlPage(url: string, page: Page): Promise<boolean> {
    try {
        const response = await page.request.head(url);
        const contentType = response.headers()['content-type'];

        if (!contentType) {
            return false;
        }
        return contentType.startsWith('text/html');
    } catch {
        return false;
    }
}

async function getDomainLinks(page: Page, url: string, origin: URL): Promise<void> {
    const normalizedUrl: string = normalizeUrl(url);

    if (visited.has(normalizedUrl)) return;
    if (!(await isHtmlPage(normalizedUrl, page))) return;

    visited.add(normalizedUrl);
    console.log("Visiting ", normalizedUrl);
    await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded' });

    const html: string = await page.content();
    const $: cheerio.CheerioAPI = cheerio.load(html);

    // get all the links 
    const linksList = new Set<string>();

    $('a[href]').each((_, element) => {
        const link: string | undefined = $(element).attr('href');

        if (link) {
            try {
                const linkUrl: string = new URL(link, normalizedUrl).toString();

                linksList.add(linkUrl);
            } catch(error) {
                console.log("Error occured when trying to obtain the href attribute from the links: ", error);
            }
        }
    });

    // filter the same domain links
    const sameDomainLinks = Array.from(linksList).filter(link => {
        try {
            const linkUrl: URL = new URL(link);

            return ((linkUrl.hostname === origin.hostname) &&
                    (linkUrl.protocol === 'http:' || linkUrl.protocol === 'https:'));
        } catch {
            return false;
        }
    });

    // iterate through each link from the same domain
    for (const link of sameDomainLinks) {
        const normalizedLink: string = normalizeUrl(link);

        if (!visited.has(normalizedLink)) {
            await getDomainLinks(page, link, origin);
        }
    }
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const url = 'https://kkcger.com';

    if (!isValidUrl(url)) {
        console.log("Invalid URL: " + url);
        return;
    }
    const origin = new URL(url);
    
    await getDomainLinks(page, url, origin);
    await browser.close();
})();