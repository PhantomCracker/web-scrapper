import { Browser, chromium, Page } from 'playwright';

import urlHelper from './helpers/urlHelper';
import fileHelper from './helpers/fileHelper';
import collectDataHelper from './helpers/collectDataHelper';

// TODO: retry failed domains 
// TODO: concurent crawling (multiple domains at the same time)
// TODO: use the same browser but open multiple pages (i need to also check the performance regarding this)
// TODO: block unused resources from website (images (need to think more regarding this maybe some images contain useful data), ads, fonts, etc)
// TODO: avoid zombie processes by closing the browser using process signals
// TODO: correctly close all the processes to avoid memory leak
(async () => {
    const filePath: string = './data/sample-websites.csv';
    const domainsList = await fileHelper.readDomainsFromCSV(filePath);
    const browser: Browser = await chromium.launch();
    const page: Page = await browser.newPage();
    let websitesCrawled: number = 0;
    let phonesCrawled: number = 0;
    let socialMediaCrawled: number = 0;
    let physicalAddressesCrawled: number = 0;
    
    for (let domain of domainsList) {
        // let domain = 'https://timent.com/contact';
        // append https because 'new URL' fails otherwise as it is not a valid URL
        if (!/^https?:\/\//i.test(domain)) {
            domain = 'https://' + domain;
        }
        try {
            const isValidAndReachableURL: boolean = await urlHelper.urlIsReachable(domain);

            if (!isValidAndReachableURL) {
                console.log("Invalid URL: " + domain);
                continue;
            } else {
                // TODO: check if website could not be crawled from other reasons
                websitesCrawled++;
            }
            
            const origin: URL = new URL(domain);

            console.log("Visiting each link from the following website: ", domain);
            const physicalAddressesList = await collectDataHelper.getPhysicalAddress(page, domain);
            physicalAddressesCrawled += physicalAddressesList.length;

            console.log("Physical addresses for " + domain + " are: " + physicalAddressesList);            
            const domainLinks = await urlHelper.getDomainLinks(page, domain, origin);
            phonesCrawled += domainLinks.phoneNumbersList.length;
            socialMediaCrawled += domainLinks.socialMediaLinks.length;
            console.log("Finished with success!");
            console.log(domainLinks);
            
            if (websitesCrawled > 0) break;
        } catch(error) {
            console.error("Error processing the domain " + domain + " with the following error: " + error);
        }
    }

    console.log("Crawled a total of " + websitesCrawled + " websites");
    console.log("Additional details: ");
    console.log("Crawled a total of " + physicalAddressesCrawled + " physical addresses");
    console.log("Crawled a total of " + phonesCrawled + " phone numbers");
    console.log("Crawled a total of " + socialMediaCrawled + " social media links");

    await browser.close();
})();
