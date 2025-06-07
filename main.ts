import { chromium } from "playwright";
import * as cheerio from 'cheerio';

async function scrapeWebsite(url) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle' });

    const html = await page.content();
    console.log(html);

    return html;
}

scrapeWebsite('https://example.com/')
    .then(data => console.log(data));
