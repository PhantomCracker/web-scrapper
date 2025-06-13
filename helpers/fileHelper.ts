import fs, { read } from 'fs';
import csvParser from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';

export interface CsvRow {
    domain: string,
    company_commercial_name?: string,
    company_legal_name?: string,
    company_all_available_names?: string[],
    physical_addresses?: string | string[],
    social_media_links?: string | string[],
    phone_numbers?: string | string[]
}

const newFields: string[] = ['physical_addresses', 'phone_numbers', 'social_media_links'];

function readFullRowsFromCSV(filePath: string): Promise<CsvRow[]> {
    return new Promise((resolve, reject) => {
        const rows: CsvRow[] = [];

        fs.createReadStream(filePath)
            .pipe(csvParser())
            .on('data', (row: any) => {
                if (row.domain) {
                    rows.push({
                        domain: row.domain.trim(),
                        company_commercial_name: row.company_commercial_name?.trim(),
                        company_legal_name: row.company_legal_name?.trim(),
                        company_all_available_names: row.company_all_available_names ? 
                            row.company_all_available_names.split('|').map((companyName: string) => companyName.trim()) : []
                    });
                }
            })
            .on('end', () => resolve(rows))
            .on('error', reject);
    });
}

function mergeData(existingData: CsvRow[], updatesData: CsvRow[]): CsvRow[] {
    const domainsRowMap = new Map<string, CsvRow>();

    for (const oldRow of existingData) {
        domainsRowMap.set(oldRow.domain.toLowerCase(), { ...oldRow });
    }

    for (const newRow of updatesData) {
        const domain = newRow.domain.toLowerCase();

        if (!domainsRowMap.has(domain)) continue;

        const row = domainsRowMap.get(domain);
        const mergedRow = { ...row };

        for (const field of newFields) {
            if (field in newRow && newRow[field] !== undefined && newRow !== null && (!row[field] || row[field] === '')) {
                mergedRow[field] = newRow[field];
            } 
        }
        domainsRowMap.set(domain, mergedRow);
    }

    return Array.from(domainsRowMap.values());
}

function getAllHeaders(rowsList: CsvRow[]): string[] {
    const headerSet = new Set<string>();
    
    for (const row of rowsList) {
        Object.keys(row).forEach(key => headerSet.add(key));
    }
    newFields.forEach(field => headerSet.add(field));

    return Array.from(headerSet);
}

async function writeCsv(filePath: string, data: CsvRow[]): Promise<void> {
    const headersList = getAllHeaders(data);
    const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: headersList.map(header => ({ id: header, title: header }))
    });

    await csvWriter.writeRecords(
        data.map(row => {
            const newRow: any = { ...row };

            for (const key of headersList) {
                if (Array.isArray(newRow[key])) {
                    newRow[key] = newRow[key].join("|");
                }
            }
            
            return newRow;
        })
    )
}

// i will use output path too so i don't alter the original document
async function mergeCsvFiles(inputPath: string, newData: CsvRow[], outputPath: string): Promise<void> {
    const oldRows = await readFullRowsFromCSV(inputPath);
    const mergedRows = mergeData(oldRows, newData);
    await writeCsv(outputPath, mergedRows);
}

export default {
    readFullRowsFromCSV: readFullRowsFromCSV,
    mergeCsvFiles: mergeCsvFiles
}
