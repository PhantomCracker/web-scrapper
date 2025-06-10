import { chromium, Page, Browser } from "playwright";
import * as cheerio from 'cheerio';

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

// TOASK: if I have found a phone number, should I continue looking for others or should I stop it?
// TODO: improve the method in getting the phone numbers
// TODO: 415-626-4474 and (415) 626-4474 are the same, fix this
async function getPhoneNumbers(page: Page, url: string) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    const phoneRegex = /(\+?\d{1,4}[\s.-]?)?(\(?\d{2,5}\)?[\s.-]?)?(\d{3,5}[\s.-]?\d{3,5}|\d{7,12})/g;
    const html = await page.content();
    const $ = cheerio.load(html);
    const phoneMatches = $('body').text().match(phoneRegex) || [];
    const phoneNumbers = Array.from(
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

    return Array.from(new Set(phoneNumbers));
}

// get social media links from iFrames too
async function getSocialMediaLinks(page: Page, url: string): Promise<string[]> {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    const html = await page.content();
    const $ = cheerio.load(html);
    const mainPageLinksList: string[] = $('a')
        .map((_, element) => $(element).attr('href'))
        .get() // transform Cheerio object into JS Array
        .filter(isSocialLink);
    const iFramesSourcesList = await page.$$eval('iframe', iframes => iframes.map(iframe => iframe.getAttribute('src')).filter(Boolean)); // use Playwright instead of Cheerio because i don't need the entire HTML
    let iFrameLinksList: string[] = [];

    for (const iFrameSource of iFramesSourcesList) {
        try {
            if (!iFrameSource) continue;
            // navigate to iFrame source in a new context because it can handle CORS in a better manner
            const browser: Browser = await chromium.launch();
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
}

function isSocialLink(url: string): boolean {
  return SOCIAL_DOMAINS.some(domain => url.includes(domain));
}

// (async () => {
//     const url = 'https://timent.com/';
//     const browser: Browser = await chromium.launch();
//     const page: Page = await browser.newPage();
//     // const phoneNumbers = await getPhoneNumbers(page, url);
//     // console.log(phoneNumbers);

//     const socialMediaLinks = await getSocialMediaLinks(page, url, browser);
//     // console.log('Social Media Links:', socialMediaLinks);
// })();

export default {
    getPhoneNumbers: getPhoneNumbers,
    getSocialMediaLinks: getSocialMediaLinks
}
