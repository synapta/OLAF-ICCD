// Require modules
const nodeRequest   = require('request');
const promiseRequest = require('request-promise');
const MongoClient   = require('mongodb').MongoClient;
const fs            = require('fs');
const Config        = require('./config').Config;

const user          = process.argv[2];
const queries       = require('./users/' + user + '/queries');
const parser        = require('./users/' + user + '/parser');
const enrichments   = require('./users/' + user + '/enrichments');
const config        = new Config(JSON.parse(fs.readFileSync(`./app/js/config/${user}.json`)));

// Sleep definition
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms))
};

// Store query limit
const limit = (process.argv.length > 3) ? parseInt(process.argv[3]) : 1;

// Initialize configuration
parser.configInit(config);

// Initialize recursive functions
function enrichAgent(id, classLabel, driver) {

    // Log enrichment
    console.log('Enrich: ' + id);

    // Compose author query
    let queryAuthor = queries.authorSelect(id);

    // Make request
    return new Promise((resolve, reject) => {

        promiseRequest(queryAuthor, (err, res, body) => {

            let author;
            try {author = parser.parseAuthor(JSON.parse(body))}
            catch(e) {return reject(e)}

            // Query options
            let requests = queries.authorOptions((author.name || '').trim(), classLabel);

            // Make options queries
            Promise.all(requests).then((bodies) => {

                bodies = bodies.map(body => {
                    try {JSON.parse(body)}
                    catch {return {}}
                    return JSON.parse(body);
                });

                // Parse result
                parser.parseAuthorOptions(author, bodies, (options) => {

                    let responseObject = {
                        author: author,
                        options: options
                    };

                    return resolve(responseObject);

                });

            }).catch((error) => reject(error));

        })
    });

}

function recursiveEnrichment(driver, count, total, errors) {

    enrichments.getNotEnrichedAgents(driver, limit, (agents) => {

        if (agents) {

            // Promise enrichments in order to make multiple requests at time
            let requests = agents.map(agent => enrichAgent(agent.id, agent.classLabel, driver));

            Promise.all(requests).then((responses) => {

                // Update counter
                let enrichment = responses.map(response => enrichments.storeEnrichment(driver, response));

                // Store enrichments
                Promise.all(enrichment).then((responses) => {
                    console.log((count + responses.length) + '/' + total + ' agents enriched');
                    recursiveEnrichment(driver, count + responses.length, total, 0);
                })

            }).catch((err) => {

                // Log error
                console.error(err);

                // Handle
                if(errors > 2) {

                    console.log('Too much errors occurred! Skipping enrichment...');

                    // Skip enrichment
                    let skip = agents.map(agent => enrichments.skipEnrichment(driver, agent));
                    Promise.all(skip).then((responses) => {
                        console.log('Done!');
                        recursiveEnrichment(driver, count + responses.length, total, 0);
                    })

                } else {

                    console.log('An error occurred! Retrying enrichment after ' + ((errors + 1)*10) + ' seconds.');

                    // Retry after (errors + 1)*10 seconds
                    sleep((errors + 1)*10000).then(() => {
                        recursiveEnrichment(driver, count, total, errors + 1);
                    });

                }
            });

        } else process.exit(0);
    })

}

if(process.argv.length < 3) {
    console.log("Sono necessari più parametri da linea di comando.");
    process.exit(1);
}

// Setting up ArCo enrichment
MongoClient.connect("mongodb://localhost:27017/", (err, client) => {

    // Handle errors
    if(err) throw err;

    // Connect to database
    let driver = client.db('arco');
    console.log('Connected to database');

    let collection = null;
    if(user === 'arco') collection = 'agents';
    if(user === 'arco-things') collection = 'things';

    driver.collection(collection).find({enriched: false, error: {$ne: true}}).count((err, total) => {
        if(err) throw err;
        recursiveEnrichment(driver, 0, total, 0);
    });

});