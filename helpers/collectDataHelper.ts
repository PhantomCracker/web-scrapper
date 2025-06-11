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
}

function isSocialLink(url: string): boolean {
  return SOCIAL_DOMAINS.some(domain => url.includes(domain));
}

// TODO: Instead of regex, maybe i should look for a npm package that might work with Google for addresses
async function getPhysicalAddress(page: Page, url: string): Promise<string[]> {
    let addressesList: string[] = [];
    let addressRegex: RegExp = /\d{1,5}\s[\w\s.,'-]+,\s*[\w\s.'-]+,\s*[A-Z]{2}\s*\d{5}(-\d{4})?/gi; 

    await page.goto(url, { waitUntil: 'domcontentloaded' });

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
    
    return Array.from(new Set(addressesList));
}

export default {
    getPhoneNumbers: getPhoneNumbers,
    getSocialMediaLinks: getSocialMediaLinks,
    getPhysicalAddress: getPhysicalAddress
}
