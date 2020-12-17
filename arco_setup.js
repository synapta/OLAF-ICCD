const MongoClient  = require('mongodb').MongoClient;
const nodeRequest  = require('request');
const auth         = require('./users/arco/users');

let queries = {};
let enrichments = {};

// Set constants
const database = process.argv[2];
const toggleImport = process.argv.length > 3 ? process.argv[3] : true;
const collectionsToEnrich = (toggleImport === true) ? ['agents', 'things'] : [toggleImport];
const collections = ['agents', 'things', 'matches', 'skipped', 'users', 'validations'];

// Set modules
queries.arco       = require('./users/arco/queries');
queries.arcothings = require('./users/arco-things/queries');

enrichments.arco       = require('./users/arco/enrichments');
enrichments.arcothings = require('./users/arco-things/enrichments');

// Enrichment queries
function storeThings(driver, index, callback) {
    nodeRequest(queries.arcothings.getThings(index), (err, res, body) => {

        // Store uris
        body = JSON.parse(body);

        let uris = body.results.bindings.map(el => el.thing.value);
        let classes = body.results.bindings.map(el => el.class ? el.class.value : null);

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
                    let uriClassUsers = [];

                    uris.forEach((uri, index) => {
                        uriClassUsers.push({
                            uri: uri,
                            class: classes[index],
                            matches: matchUsers[index].map(user => user.username),
                            skip: skipUsers[index].map(user => user.username)
                        });
                    });

                    // Store things and callback
                    enrichments.arcothings.insertThings(driver, uriClassUsers, () => {
                        console.log('- Added ' + ((10000*(index)) + uris.length) + ' things');
                        storeThings(driver, index + 1, callback);
                    })

                });
            });
        } else callback();

    })
}

function retrieveUsers(driver, users) {
    return Promise.all(users.map(user => Promise.all(user.map(hash => auth.getUserByHash(driver, hash)))))
}

function storeAgents(driver, index, callback) {
    nodeRequest(queries.arco.getAgents(index), (err, res, body) => {

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
                    enrichments.arco.insertAgents(driver, uriAndUsers, () => {
                        console.log('- Added ' + ((10000*(index)) + uris.length) + ' agents');
                        storeAgents(driver, index + 1, callback);
                    })

                });
            });
        } else callback();

        /*if(uris.length > 0){
            // Store things and callback
            enrichments.arco.insertAgents(driver, uris, () => {
                console.log('- Added ' + ((10000*(index)) + uris.length) + ' agents');
                storeAgents(driver, index + 1, callback);
            })
        } else callback();*/

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

    // Drop collections
    db.listCollections().toArray((err, collectionsListDetails) => {

        let collectionsList = collectionsListDetails.map(el => el.name);
        let collectionsDrop = [];

        collectionsDrop = collectionsToEnrich.map(collection => {
            if (collectionsList.includes(collection)) {
                return db.collection(collection).drop();
            }
        });

        Promise.all(collectionsDrop).then((res) => {

            console.log('Drop collection');

            // Create collections
            let collectionCreation = collections.map(collection => {
                if(!collectionsList.includes(collection))
                    db.createCollection(collection);
            });
            Promise.all(collectionCreation).then((res) => {

                // Once created collection populate them
                console.log('Create collections');

                if(collectionsToEnrich.includes('agents')){
                    console.log('Storing agents...');
                    storeAgents(db, 0, () => {
                        console.log('Agents stored');
                        if(collectionsToEnrich.includes('things')) {
                            console.log('Storing things...');
                            storeThings(db, 0, () => {

                                console.log('Things stored');
                                process.exit(0);

                            })
                        } else process.exit(0);
                    })
                } else if(collectionsToEnrich.includes('things')){
                    console.log('Storing things...');
                    storeThings(db, 0, () => {
                        console.log('Things stored');
                        process.exit(0);
                    })
                }

            });

        });

    });

});