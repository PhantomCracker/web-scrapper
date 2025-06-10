import { chromium } from "playwright";
import * as cheerio from 'cheerio';

async function getPhoneNumbers(url: string) {
    const phoneRegex = /(\+?\d{1,4}[\s.-]?)?(\(?\d{2,5}\)?[\s.-]?)?(\d{3,5}[\s.-]?\d{3,5}|\d{7,12})/g;
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle' });

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
                .filter(Boolean)
            )
        );

    return phoneNumbers;
}

export default {
    getPhoneNumbers: getPhoneNumbers
}
