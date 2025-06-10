import { chromium, Page, Browser } from "playwright";
import * as cheerio from 'cheerio';

// TOASK: if I have found a phone number, should I continue looking for others or should I stop it?
async function getPhoneNumbers(page: Page, url: string) {
    const phoneRegex = /(\+?\d{1,4}[\s.-]?)?(\(?\d{2,5}\)?[\s.-]?)?(\d{3,5}[\s.-]?\d{3,5}|\d{7,12})/g;

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const html = await page.content();
    const $ = cheerio.load(html);
    const phoneMatches = $('body').text().match(phoneRegex) || [];
    const phoneNumbers = Array.from(
        new Set(
            phoneMatches
                .map(phone => {
                    console.log("phone: " + phone)
                    phone = phone.trim();
                    if (phone.replace(/\D/g, '').length >= 8) {
                        return phone;
                    }
                })
                .filter(Boolean)
            )
        );

    return phoneNumbers;
}

(async () => {
    const url = 'https://timent.com/';
    const browser: Browser = await chromium.launch();
    const page: Page = await browser.newPage();
    const test = await getPhoneNumbers(page, url);
    console.log(test);
})();

export default {
    getPhoneNumbers: getPhoneNumbers
}
