const MongoClient  = require('mongodb').MongoClient;
const nodeRequest  = require('request');
const promiseRequest = require('request-promise');
const fs            = require('fs');
const process       = require('process');

if (!fs.existsSync('./users/'+ process.argv[2] + '/queries.js')) {
    console.error('Task non trovato')
    process.exit(1)
}   

const Config        = require('./config').Config;
const queries       = require('./users/'+ process.argv[2] + '/queries');
const parser        = require('./users/'+ process.argv[2] + '/parser');
const enrichments   = require('./users/'+ process.argv[2] + '/enrichments');
const config        = new Config(JSON.parse(fs.readFileSync('./app/js/config/'+ process.argv[2] + '.json')));

parser.configInit(config);

const database = 'arco';
// Initialize recursive functions

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms))
};

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


function retrieveUsers(driver, users) {
    return Promise.all(users.map(user => Promise.all(user.map(hash => auth.getUserByHash(driver, hash)))))
}

function recursiveEnrichment(driver, count, total, errors) {

    enrichments.getNotEnrichedAgents(driver, 1, (agents) => {

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

function storeAgents(driver, index, callback) {
    nodeRequest(queries.getAgents(index), (err, res, body) => {

        // Store uris
        body = JSON.parse(body);

        let uris = body.results.bindings.map(el => el.person.value);

        if(uris.length > 0){

            // Store matches and skips
            let matches = body.results.bindings.map(el => el.matches.value).map(el => el.split('###'));
            let skips = body.results.bindings.map(el => el.skip.value).map(el => el.split('###'));

            matches = matches.map(match => match.filter(el => !!el));
            skips = skips.map(skip => skip.filter(el => !!el));

            retrieveUsers(driver, matches).then(matchUsers => {
                retrieveUsers(driver, skips).then(skipUsers => {

                    matchUsers = matchUsers.map(match => match.filter(el => !!el));
                    skipUsers = skipUsers.map(skip => skip.filter(el => !!el));

                    // Store uris/user map
                    let uriAndUsers = [];

                    uris.forEach((uri, index) => {
                        uriAndUsers.push({
                            uri: uri,
                            matches: matchUsers[index].map(user => user.username),
                            skip: skipUsers[index].map(user => user.username)
                        });
                    });

                    // Store things and callback
                    enrichments.insertAgents(driver, uriAndUsers, () => {
                        console.log('- Added ' + ((10000*(index)) + uris.length) + ' agents');
                        storeAgents(driver, index + 1, callback);
                    })

                });
            });
        } else callback();
    })
}

if(process.argv.length < 3) {
    console.log("Sono necessari più parametri da linea di comando.")
    process.exit(1);
}

// Setting up ArCo database
MongoClient.connect("mongodb://localhost:27017/", (err, client) => {

    // Handle errors
    if(err) throw err;

    // Connect to database
    let db = client.db(database);
    console.log('Connected to database');

    console.log('Dropped old collection');
    db.collection(process.argv[2]).drop();

    storeAgents(db, 0, () => {
        console.log('Agents stored');
        db.collection(process.argv[2]).find({enriched: false, error: {$ne: true}}).count((err, total) => {
            if(err) throw err;
            recursiveEnrichment(db, 0, total, 0);
        });
    });

});