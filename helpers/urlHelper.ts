import { Page } from "playwright";
import * as cheerio from 'cheerio';
import fetch from "node-fetch";
import type { Response } from 'node-fetch';

import collectDataHelper from "./collectDataHelper";

// please note that this list will suffer updates continuously
const ROUTE_WHITELIST = [
    'contact',
    'about',
    'impressum',
    'company',
    'offices',
    'find-us',
    'team'
];

const visited = new Set<string>();

interface CollectedData {
    phoneNumbersList: string[];
    socialMediaLinks: string[];
}

// TOASK: what if the given domain is a subdomain? it should go through entire domain or check only the subdomain?
// TODO: need to work on redirect codes (300) too
// TODO: maybe issues with CORS? need to check that also

/**
 * Checks if a given URL is reachable over the network.
 * This function attempts to make an HTTP request (using the HEAD method, then GET as a fallback).
 *
 * @param {string} url - the URL to check for reachability
 * @returns {Promise<boolean>}
 */
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

/**
 * Determines whether a given path should be considered "blocked" based on blacklist patterns.
 * This is very helpful when you don't use a whitelist but a blacklist, but for this assesment it took way to long, but it have bigger precision
 *
 * @param {string} pathName - the URL path to check
 * @returns {boolean}
 */
function isBlockedRoute(pathName: string): boolean {
    const datePathRegex = /^\/\d{4}(\/\d{2}){1,2}(\/.*)?$/;
    const longDashSlugRegex = /\/(?:[a-zA-Z0-9]+-){5,}[a-zA-Z0-9]+/;

    return ROUTE_WHITELIST.some(pathWords => pathName.toLowerCase().includes(pathWords)) || 
            datePathRegex.test(pathName) ||
            longDashSlugRegex.test(pathName);
}

/**
 * Checks if a given path is considered whitelisted based on specific keywords
 *
 * @param {string} pathName - the URL path to check
 * @returns {boolean}
 */
function isWhitelistedRoute(pathName: string): boolean {
    if (pathName === '/' || pathName === '') return true;
    return ROUTE_WHITELIST.some(pathWords => pathName.toLowerCase().includes(pathWords));
}

/**
 * Normalizes a URL string to a canonical form for consistent comparison or storage.
 * Return string due to the fact that the Javascript object comparision does not work really well, so we compare two strings.
 * 
 * This function:
 * - converts the protocol and hostname to lowercase
 * - removes the hash (`#`) from the URL
 * - removes the default port if present (80 for http, 443 for https)
 * - removes a trailing slash from the pathname, except for the root path
 *
 * @param {string} fullURL - the URL string to normalize
 * @returns {string} - the normalized URL or the original string if invalid
 */
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

/**
 * Determines whether a given URL points to an HTML page by checking its Content-Type header.
 *
 * @param {string} url - the URL to check
 * @param {Page} page - The Chromium `Page` instance used to make the request
 * @returns {Promise<boolean>}
 */
async function isHtmlPage(url: string, page: Page): Promise<boolean> {
    try {
        // check the length also, a normal URL should not have more than 75 characters, but to be sure, let's double the value for the checks
        if (url.length > 200) return false;
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

/**
 * Recursively crawls all whitelisted, same-domain links on a website, collecting phone numbers and social media links
 *
 * @param {Page} page - the Chromium `Page` instance used for navigation and content extraction
 * @param {string} url - the URL to start crawling from
 * @param {URL} origin - the parsed URL object representing the origin domain for filtering
 * @returns {Promise<CollectedData>} - a promise that resolves to an object containing unique lists of phone numbers and social media links found
 *
 * @typedef {Object} CollectedData
 * @property {string[]} phoneNumbersList - all unique phone numbers found within the same domain
 * @property {string[]} socialMediaLinks - all unique social media links found within the same domain
 */
async function getDomainLinks(page: Page, url: string, origin: URL): Promise<CollectedData> {
    // TODO: display this log only on verbose mode
    // console.log("URL: ", url);
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

            if (!isWhitelistedRoute(linkUrl?.pathname)) return false;
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
