import { chromium, Page, Browser } from "playwright";
import * as cheerio from 'cheerio';

interface LinkInfo {
    href: string,
    text: string | null | undefined
}

const SOCIAL_DOMAINS = [
    'facebook.com',
    'twitter.com',
    'instagram.com',
    'linkedin.com',
    'tiktok.com',
    'youtube.com',
    'pinterest.com',
    'wa.me',
    'whatsapp.com',
    'reddit.com',
    'snapchat.com',
    'threads.net'
];

/**
 * Extracts unique phone numbers from a website.
 * Phone numbers must have at least 8 digits (after removing non-digit characters) to be considered valid.
 *
 * @param {Page} page - a Chromium `Page` instance used to navigate and interact with the webpage
 * @param {string} url - the URL of the web page from which to extract phone numbers
 * @returns {Promise<string[]>} - a promise that resolves to an Array of unique phone numbers found on the page
 * 
 * TOASK: if I have found a phone number, should I continue looking for others or should I stop it?
 * TODO: improve the method in getting the phone numbers
 */
async function getPhoneNumbers(page: Page, url: string) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    const phoneRegex = /(?:(?:\+|00)?(\d{1,3}))?[\s\-\.]?\(?(?:\d{2,4})\)?[\s\-\.]?\d{2,4}[\s\-\.]?\d{2,4}[\s\-\.]?\d{0,6}/g;
    const html = await page.content();
    const $ = cheerio.load(html);
    let phoneNumbers: string[] = []

    try {
        const phoneMatches = $('body').text().match(phoneRegex) || [];
        phoneNumbers = Array.from(
            new Set(
                phoneMatches
                    .map(phone => {
                        phone = phone.trim();
                        if (phone.replace(/\D/g, '').length >= 8) {
                            return phone;
                        }
                    })
                    .filter((phone) => typeof phone === 'string') // be sure that I return string[]
                )
            );
    } catch(error) {
        console.error("Could not get the phone number")
    }

    return Array.from(new Set(phoneNumbers));
}

/**
 * Extracts unique social media links from a web page and from the iFrames too
 *
 * @param {Page} page - a Chromium `Page` instance used to navigate and interact with the webpage
 * @param {string} url - the URL of the web page to scrape for social media links
 * @returns {Promise<string[]>} - a promise that resolves to an array of unique social media link URLs
 *
 * Note: The code for extracting links from iFrames is commented out for now. To enable iFrame scraping, uncomment.
 */
async function getSocialMediaLinks(page: Page, url: string): Promise<string[]> {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    let mainPageLinksList: string[] = [];
    const html = await page.content();
    const $ = cheerio.load(html);
    try {
        mainPageLinksList = $('a')
        .map((_, element) => $(element).attr('href'))
        .get() // transform Cheerio object into JS Array
        .filter(isSocialLink);
    } catch(error) {
        console.error("Could not get the social media");
    }

    // down from this line it will check the iFrames too for specific links, but due to the fact that I need a lot of speed, I will comment this for the moment
    /*
    const iFramesSourcesList = await page.$$eval('iframe', iframes => iframes.map(iframe => iframe.getAttribute('src')).filter(Boolean)); // use Playwright instead of Cheerio because i don't need the entire HTML
    let iFrameLinksList: string[] = [];

    for (const iFrameSource of iFramesSourcesList) {
        try {
            if (!iFrameSource) continue;
            // navigate to iFrame source in a new context because it can handle CORS in a better manner
            const browser: Browser = await chromium.launch({ headless: true });
            const iFramePage = await browser.newPage();

            await iFramePage.goto(iFrameSource, { waitUntil: 'domcontentloaded' });

            const iFrameHtml = await iFramePage.content();
            const $iFrame = cheerio.load(iFrameHtml);
            const linksList = $iFrame('a').map((_, element) => $iFrame(element).attr('href')).get().filter(isSocialLink);

            iFrameLinksList = iFrameLinksList.concat(linksList);
            await iFramePage.close();
        } catch(error) {
            console.error("Could not access the iframe: ", error);
        }
    }
    return Array.from(new Set([...mainPageLinksList, ...iFrameLinksList]));
    */

    return Array.from(new Set(mainPageLinksList));
}

/**
 * Checks whether a given URL is a social media link.
 *
 * This function returns `true` if the URL contains any domain listed in the `SOCIAL_DOMAINS` array
 *
 * @param {string} url - the URL string to check
 * @returns {boolean}
 */
function isSocialLink(url: string): boolean {
  return SOCIAL_DOMAINS.some(domain => url.includes(domain));
}

/**
 * Attempts to extract physical addresses or location from a web page
 * The function may visit multiple subpages if they are labeled as "contact", "about", or "find us"
 * For additional checks please check the comments inside the function
 * 
 * @param {Page} page - A Chromium `Page` instance used for navigation and DOM extraction
 * @param {string} url - The URL of the starting web page
 * @returns {Promise<string[]>} A promise that resolves to an array of unique physical addresses found
 *
 * TODO: Instead of regex, maybe i should look for a npm package that might work with Google for addresses
 */
async function getPhysicalAddress(page: Page, url: string): Promise<string[]> {
    let addressesList: string[] = [];
    let addressRegex: RegExp = /\d{1,5}\s[\w\s.,'-]+,\s*[\w\s.'-]+,\s*[A-Z]{2}\s*\d{5}(-\d{4})?/gi; 

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    try {
        const linksList: LinkInfo[] = await page.$$eval('a', (anchorsList: Element[]) => {
            return anchorsList.map(anchor => ({ 
                href: (anchor as HTMLAnchorElement).href, 
                text: anchor.textContent?.toLowerCase() 
            }));
        });
        const contactLinksList: LinkInfo[] | undefined = linksList.filter((link: LinkInfo) => {
            return (link.text?.includes('contact') || link.text?.includes('about') || link.text?.includes('find us')) ||
                    link.href.includes('contact') ||
                    link.href.includes('about');
        });

        for (const link of contactLinksList) {
            if (!link.href) continue;

            await page.goto(link.href, { waitUntil: 'domcontentloaded' });
            
            const html = await page.content();
            const $ = cheerio.load(html);
            // check <address> element
            const addressText = $('address').text().trim();
            
            if (addressText.length > 0) {
                addressesList.push(addressText);
            }

            // check the name classes
            $('[class*="contact"], [id*="contact"], [class*="address"], [id*="address"]').each((_, element) => {
                const elementText: string = $(element).text();
                const matchWithRegex: RegExpMatchArray | null = elementText.match(addressRegex);

                if (matchWithRegex && matchWithRegex.length > 0) {
                    addressesList.push(matchWithRegex[0]);
                }
            })

            // check footer
            const footerText: string = $('footer').text().trim();
            const footerMatch: RegExpMatchArray | null = footerText.match(addressRegex);
            
            if (footerMatch && footerMatch.length > 0) {
                addressesList.push(footerMatch[0]);
            }
        }
    } catch(error) {
        console.error("Error on retrieving the anchor element");
    }
    
    return Array.from(new Set(addressesList));
}

export default {
    getPhoneNumbers: getPhoneNumbers,
    getSocialMediaLinks: getSocialMediaLinks,
    getPhysicalAddress: getPhysicalAddress
}
