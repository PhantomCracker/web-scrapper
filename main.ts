import { Browser, chromium, Page } from 'playwright';
import pMap from 'p-map';

import urlHelper from './helpers/urlHelper';
import fileHelper from './helpers/fileHelper';
import collectDataHelper from './helpers/collectDataHelper';

// TODO: retry failed domains a number of times (1-3 times)
// TODO: concurent crawling (multiple domains at the same time)
// TODO: use the same browser but open multiple pages (i need to also check the performance regarding this)
// TODO: block unused resources from website (images (need to think more regarding this maybe some images contain useful data), ads, fonts, etc)
// TODO: avoid zombie processes by closing the browser using process signals
// TODO: correctly close all the processes to avoid memory leak
// TODO: add config file for concurency and other global variables like social media
(async () => {
    interface AnalystData {
        websitesCrawled: number,
        phonesCrawled: number,
        socialMediaCrawled: number,
        physicalAddressesCrawled: number
    }
    const filePath: string = './data/sample-websites.csv';
    // const domainsList = await fileHelper.readDomainsFromCSV(filePath);
    const domainsList = ['https://timent.com/'];
    const browser: Browser = await chromium.launch();
    const page: Page = await browser.newPage();

    let analystData: AnalystData = {
        websitesCrawled: 0,
        phonesCrawled: 0,
        socialMediaCrawled: 0,
        physicalAddressesCrawled: 0
    }

    async function crawlDomain(domain: string): Promise<void> {
        // append https because 'new URL' fails otherwise as it is not a valid URL
        if (!/^https?:\/\//i.test(domain)) {
            domain = 'https://' + domain;
        }

        try {
            const isValidAndReachableURL: boolean = await urlHelper.urlIsReachable(domain);

            if (!isValidAndReachableURL) {
                console.log("Invalid URL: " + domain);
                return;
            }

            const page: Page = await browser.newPage();
            const origin: URL = new URL(domain);
            
            // TODO: check if website could not be crawled from other reasons
            analystData.websitesCrawled++;
            console.log("Visiting each link from the following website: ", domain);

            const physicalAddressesList = await collectDataHelper.getPhysicalAddress(page, domain);
            analystData.physicalAddressesCrawled += physicalAddressesList.length;
            console.log("Physical addresses for " + domain + " are: " + physicalAddressesList);
            
            const domainLinks = await urlHelper.getDomainLinks(page, domain, origin);
            analystData.phonesCrawled += domainLinks.phoneNumbersList.length;
            analystData.socialMediaCrawled += domainLinks.socialMediaLinks.length;

            await page.close();
            console.log(domainLinks);
        } catch(error) {
            console.error("Error processing the domain " + domain + " with the following error: " + error);
        }
    }

    await pMap(domainsList, crawlDomain, { concurrency: 5 });

    console.log("Crawled a total of " + analystData.websitesCrawled + " websites");
    console.log("Additional details: ");
    console.log("Crawled a total of " + analystData.physicalAddressesCrawled + " physical addresses");
    console.log("Crawled a total of " + analystData.phonesCrawled + " phone numbers");
    console.log("Crawled a total of " + analystData.socialMediaCrawled + " social media links");

    await browser.close();
})();
