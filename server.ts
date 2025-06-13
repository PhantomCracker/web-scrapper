import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { algoliasearch, SearchClient, SearchResponse } from 'algoliasearch';
import dotenv from 'dotenv';
dotenv.config();

const appID: string = process.env.APP_ID!;
const apiKey: string = process.env.API_KEY!;
const indexName: string = process.env.INDEX_NAME!;
const PORT: number = 3000;

if (!appID || !apiKey || !indexName) {
    throw new Error('Missing required Algolia environment variables!');
}

const client: SearchClient = algoliasearch(appID, apiKey);
const app = express();
app.use(bodyParser.json());

interface QueryInput {
    name?: string,
    phone?: string,
    website?: string,
    facebook?: string
}

/**
 * Builds a search query string by concatenating non-empty fields from a given input object (please check params for object details)
 *
 * @param {QueryInput} params - an object containing any subset of the fields: name, phone, website, facebook
 * @param {string} [params.name] - the name to include in the query
 * @param {string} [params.phone] - the phone number to include in the query
 * @param {string} [params.website] - the website to include in the query
 * @param {string} [params.facebook] - the Facebook profile or page to include in the query
 * @returns {string} - a space-separated string containing only the non-empty fields
 */
function buildQuery({ name, phone, website, facebook }: QueryInput): string {
    return [name, phone, website, facebook].filter(Boolean).join(' ');
}

/**
 * POST /search-company
 * Searches for a company using Algolia based on provided query fields.
 * Because we have generated the CSV file, I will not send the indexes and records to Algolia via code, just upload the generated file to have records on it.
 *
 * @param {Request} request
 * @param {Response} response
 * @returns {Promise<Response>}
 */
// @ts-ignore
app.post('/search-company', async (request: Request, response: Response) => {
    const { name, phone, website, facebook } = request.body as QueryInput;

    if (!name && !phone && !website && !facebook) {
        return response.status(400).json({ error: "Need to have at least one field provided." });
    }

    const query: string = buildQuery({ name, phone, website, facebook });

    try {
        // based on Algolia v5
        const algoliaResult = await client.search({
            requests: [
                {
                    indexName,
                    query: query,
                    hitsPerPage: 5
                }
            ]
        });
        // @ts-ignore
        const bestMatch = algoliaResult?.results[0]?.hits[0] || null;
        
        return response.json({ match: bestMatch });
    } catch(error) {
        console.error("An error occured: ", error);
        return response.status(500).json({ error: 'Search failed' });
    }
})

app.listen(PORT, () => {
    console.log("Listening on localhost:", PORT);
})