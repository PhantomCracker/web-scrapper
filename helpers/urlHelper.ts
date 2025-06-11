import { Page } from "playwright";
import * as cheerio from 'cheerio';
import fetch from "node-fetch";
import type { Response } from 'node-fetch';

import collectDataHelper from "./collectDataHelper";

// please note that this list will suffer updates continuously
const ROUTE_BLOCKLIST = [
    'blog',
    'terms',
    'terms-and-conditions',
    'privacy',
    'review',
    'disclaimer',
    'legal',
    'cookie',
    'policy',
    'faq',
    'other',
    'pdf',
    'images',
    'product',
    'downloads',
    'log',
    'sitemap',
    'wp-content',
    'podcast',
    'tag',
    'news',
    'comment',
    'page',
    'feed',
    'author',
    'search',
    'category',
    'archive',
    'admin',
    'dashboard',
    'login',
    'register',
    'signup',
    'cart',
    'checkout',
    'account',
    'profile',
    'settings',
    'password',
    'edit',
    'update',
    'delete',
    'static',
    'assets',
    'media',
    'uploads',
    'rss',
    'xml',
    'json',
    'api',
    'pdf',
    'help',
    'support',
    'press',
    'calendar',
    'store',
    'shop',
    'basket',
    'order',
    'invoice',
    'bestsellers',
    'category',
    'collections',
    'error',
    '404',
    'maintenance',
    'tmp',
    'temp',
    'item',
    'photo'
];

const visited = new Set<string>();

interface CollectedData {
  phoneNumbersList: string[];
  socialMediaLinks: string[];
}

// TODO: verify only specific routes for the data that needs to be scrapped (gotta think on a method here...)
// TOASK: what if the given domain is a subdomain? it should go through entire domain or check only the subdomain?
// TODO: need to work on redirect codes (300) too
// TODO: maybe issues with CORS? need to check that also
// TODO: remove routes like blog or other or similarities, terms and conditions, reviews, disclaimer
// TODO: discover blog routes and remove them

async function urlIsReachable(url: string): Promise<boolean> {
    try {
        new URL(url);
        let response: Response = await fetch(url, { method: 'HEAD' });
    
        // in case that the server does not accept HEAD method
        if (response.status === 405) {
            response = await fetch(url, { method: 'GET' });
        }

        return response.ok;
    } catch(error) {
        return false;
    }
}

function isBlockedRoute(pathName: string): boolean {
    const datePathRegex = /^\/\d{4}(\/\d{2}){1,2}(\/.*)?$/;
    const longDashSlugRegex = /\/(?:[a-zA-Z0-9]+-){5,}[a-zA-Z0-9]+/;

    return ROUTE_BLOCKLIST.some(pathWords => pathName.toLowerCase().includes(pathWords)) || 
            datePathRegex.test(pathName) ||
            longDashSlugRegex.test(pathName);
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

async function getDomainLinks(page: Page, url: string, origin: URL): Promise<CollectedData> {
    // TODO: display this log only on verbose mode
    console.log("URL: ", url);
    const normalizedUrl: string = normalizeUrl(url);

    if (visited.has(normalizedUrl)) return { phoneNumbersList: [], socialMediaLinks: [] };
    if (!(await isHtmlPage(normalizedUrl, page))) return { phoneNumbersList: [], socialMediaLinks: [] };

    visited.add(normalizedUrl);
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
                console.error("Error occured when trying to obtain the href attribute from the links: ", error);
            }
        }
    });

    // filter the same domain links
    const sameDomainLinks = Array.from(linksList).filter(link => {
        try {
            const linkUrl: URL = new URL(link);

            if (isBlockedRoute(linkUrl?.pathname)) return false;
            return ((linkUrl.hostname === origin.hostname) &&
                    (linkUrl.protocol === 'http:' || linkUrl.protocol === 'https:'));
        } catch {
            return false;
        }
    });

    const phoneNumbersList = await collectDataHelper.getPhoneNumbers(page, normalizedUrl);
    const socialMediaLinks = await collectDataHelper.getSocialMediaLinks(page, normalizedUrl);

    // iterate through each link from the same domain
    for (const link of sameDomainLinks) {
        const normalizedLink: string = normalizeUrl(link);

        if (!visited.has(normalizedLink)) {
            const newUrlResult = await getDomainLinks(page, link, origin);
            
            phoneNumbersList.push(...newUrlResult.phoneNumbersList);
            socialMediaLinks.push(...newUrlResult.socialMediaLinks);
        }
    }

    return {
        phoneNumbersList: Array.from(new Set(phoneNumbersList)),
        socialMediaLinks: Array.from(new Set(socialMediaLinks)),
    };
}

export default {
    getDomainLinks: getDomainLinks,
    urlIsReachable: urlIsReachable
}
