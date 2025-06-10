import fs, { read } from 'fs';
import csvParser from 'csv-parser';

interface DomainRow {
    domain?: string;
}

function readDomainsFromCSV(filePath: string): Promise<Set<string>> {
    return new Promise ((resolve, reject) => {
        const domainsList = new Set<string>();

        fs.createReadStream(filePath)
            .pipe(csvParser())
            .on('data', (row: DomainRow) => {
                if (row.domain) {
                    domainsList.add(row.domain.trim());
                }
            })
            .on('end', () => resolve(domainsList))
            .on('error', reject)
    })
}

export default {
    readDomainsFromCSV: readDomainsFromCSV
}
