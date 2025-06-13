
# Web scrapper 

A web scrapper created in NodeJS using Playwright, Cheerio, Express and AlgoliaSearch that crawl multiple websites at the same time for phone numbers, physical addresses and social media links.




## Features

- read multiple URLs from a CSV file
- scrape for phone number(s), social media link(s) and physical address(es)
- write the data found in the websites to a new CSV file based on the domain (domain being the primary key)
- provide analyst data (number of crawled websites and founded fields)
- scalable solution
- endpoint to search for specific data using a query like phone, address, domain etc
- strong validation for the URLs to be sure that they are indeed reachable and valid
- crawl the iFrames too, not only the website itself
- block specific paths that are of no interest for this task
- the crawl is done in a conccurency way
- block website resources that are not needed for the crawl
- safe shutdown of the processes when everything is done
- check every path from a provided URL


## Environment Variables

To run this project, you will need to add the following environment variables to your .env file from Algolia.

`APP_ID`

`API_KEY`

`INDEX_NAME`


## Run Locally

- Clone the project

```bash
  git clone https://github.com/PhantomCracker/web-scrapper.git
```

- Go to the project directory

```bash
  cd web-scrapper
```

- Install dependencies

```bash
  yarn
```

- Compile the TypeScript files to JavaScript files

```bash
  npx tsc -w
```

- Add CSV file (`sample-websites.csv`) with domains to `/data` folder
- Add the CSV file(`sample-websites-company-names.csv`) with additional information to `/data` folder

- Run the generated `main.js` file in order to generate the new CSV file

```bash
  node main.js
```

- Upload the generated file (`finished.csv`) to Algolia Dashboard 

- Start the server

```bash
  node server.js
```

- Use Postman in order to access the endpoint and search for a company as it can be seen in the screenshot `post-method.png` from the `/demo` folder


## API Reference

#### GET the company searched

```http
  POST /search-company
```

| Parameter | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `name` | `string` | Name of the company |
| `phone` | `string` | Phone of the company |
| `website` | `string` | Website (aka domain) of the company |
| `facebook` | `string` | Facebook link |

Receive all the fields available for the found company


## Roadmap

- retry failed domains a number of times (1-3 times)
- add config file for concurency and other global variables like social media
- try HTTP and WWW variations too
- improve the method in getting the phone numbers
- improve the method in getting the physical addresses
- add a NPM package that might work with Google for addresses
- work on redirect codes (300) too
- check CORS issues
- add verbose feature
## Authors

- [@PhantomCracker](https://github.com/PhantomCracker)

