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
    phone_numbers?: string | string[],
    [key: string]: any // fix small TS issue
}

const newFields: string[] = ['physical_addresses', 'phone_numbers', 'social_media_links'];

/**
 * Reads a CSV file and extracts all rows
 *
 * @param {string} filePath - the path to the CSV file to read
 * @returns {Promise<CsvRow[]>} - a promise that resolves to an array of CsvRow objects, one for each full row found
 *
 * @typedef {Object} CsvRow
 * @property {string} domain - the domain, always trimmed
 * @property {string | undefined} company_commercial_name - the commercial name of the company, trimmed or undefined
 * @property {string | undefined} company_legal_name - the legal name of the company, trimmed or undefined
 * @property {string[]} company_all_available_names - array of trimmed company names, split by "|" or an empty array if not present
 * @property {string[]} physical_addresses - array of trimmed physicial addresses, split by "|" or an empty array if not present
 * @property {string[]} social_media_links - array of trimmed social media links, split by "|" or an empty array if not present
 * @property {string[]} phone_numbers - array of phone numbers, split by "|" or an empty array if not present
 */
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

/**
 * Merges updated data into existing CSV based on the `domain` field as the primary key.
 * Only the fields listed in `newFields` are considered for updating.
 *
 * @param {CsvRow[]} existingData - array of original data rows
 * @param {CsvRow[]} updatesData - array of new/updated data rows
 * @returns {CsvRow[]} - the merged array of data rows
 */
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
            if (field in newRow && newRow[field] !== undefined && newRow !== null && (row && (!row[field] || row[field] === ''))) {
                mergedRow[field] = newRow[field];
            } 
        }
        domainsRowMap.set(domain, mergedRow as CsvRow);
    }

    return Array.from(domainsRowMap.values());
}

/**
 * Returns a list of all unique header names (field names) presented in a CSV file.
 *
 * @param {CsvRow[]} rowsList - array of objects representing rows of a CSV file
 * @returns {string[]} - an array of unique header names
 */
function getAllHeaders(rowsList: CsvRow[]): string[] {
    const headerSet = new Set<string>();
    
    for (const row of rowsList) {
        Object.keys(row).forEach(key => headerSet.add(key));
    }
    newFields.forEach(field => headerSet.add(field));

    return Array.from(headerSet);
}

/**
 * Writes an array of data rows to a CSV file.
 * Array fields are converted to a pipe-separated string for CSV compatibility.
 *
 * @param {string} filePath - the path where the CSV file will be written
 * @param {CsvRow[]} data - the array of row objects to write to the CSV file
 * @returns {Promise<void>} - a promise that resolves when writing is complete
 */
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

/**
 * Merges new data and an existing CSV file into a new file.
 * This function does not modify the original file; all changes are written to `outputPath`.
 *
 * @param {string} inputPath - the path to the original CSV file to read
 * @param {CsvRow[]} newData - the array of new or updated data rows
 * @param {string} outputPath - the path where the final CSV file will be written
 * @returns {Promise<void>} - a promise that resolves when the merged file has been written
 */
async function mergeCsvFiles(inputPath: string, newData: CsvRow[], outputPath: string): Promise<void> {
    const oldRows = await readFullRowsFromCSV(inputPath);
    const mergedRows = mergeData(oldRows, newData);
    await writeCsv(outputPath, mergedRows);
}

export default {
    readFullRowsFromCSV: readFullRowsFromCSV,
    mergeCsvFiles: mergeCsvFiles
}
