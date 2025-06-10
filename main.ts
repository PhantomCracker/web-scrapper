import { Browser, chromium, Page } from 'playwright';

import urlHelper from './helpers/urlHelper';
import fileHelper from './helpers/fileHelper';

// TODO: retry failed domains 
// TODO: concurent crawling (multiple domains at the same time)
// TODO: use the same browser but open multiple pages (i need to also check the performance regarding this)
// TODO: block unused resources from website (images (need to think more regarding this maybe some images contain useful data), ads, fonts, etc)
// TODO: avoid zombie processes by closing the browser using process signals
(async () => {
    const filePath: string = './data/sample-websites.csv';
    const domainsList = await fileHelper.readDomainsFromCSV(filePath);
    const browser: Browser = await chromium.launch();
    const page: Page = await browser.newPage();
    
    for (let domain of domainsList) {
        // append https because 'new URL' fails otherwise as it is not a valid URL
        if (!/^https?:\/\//i.test(domain)) {
            domain = 'https://' + domain;
        }
        try {
            const isValidAndReachableURL: boolean = await urlHelper.urlIsReachable(domain);

            if (!isValidAndReachableURL) {
                console.log("Invalid URL: " + domain);
                continue;
            }
            
            const origin: URL = new URL(domain);
        
            console.log("Visiting each link from the following website: ", domain);
            await urlHelper.getDomainLinks(page, domain, origin);
            console.log("Finished with success!");
        } catch(error) {
            console.error("Error processing the domain " + domain + " with the following error: " + error);
        }
    }

    await browser.close();
})();
