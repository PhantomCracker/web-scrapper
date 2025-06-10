// import phoneNumberHelper from './helpers/phoneNumberHelper';

// phoneNumberHelper.getPhoneNumbers('https://locksmithoncall247.co.uk/')
//     .then(data => console.log(data));

import fs from 'fs';
import csvParser from 'csv-parser';

interface DomainRow {
    domain?: string;
}

const domainsList = new Set<string>();

fs.createReadStream('./data/sample-websites.csv')
    .pipe(csvParser())
    .on('data', (row: DomainRow) => {
        if (row.domain) {
            domainsList.add(row.domain.trim());
        }
    })
    .on('end', () => {
        domainsList.forEach((domain) => {
            console.log(domain);
        })
    })