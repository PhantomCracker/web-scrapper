import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { algoliasearch, SearchClient } from 'algoliasearch';
import dotenv from 'dotenv';
dotenv.config();

const appID: string = process.env.APP_ID;
const apiKey: string = process.env.API_KEY;
const indexName: string = process.env.INDEX_NAME;
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

function buildQuery({ name, phone, website, facebook }: QueryInput): string {
}

// because we have generated the CSV file, I will not send the indexes and records to Algolia via code, just upload the generated file to have records on it
app.post('/search-company', async(request: Request, response: Response) => {
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