const nodeRequest = require('request-promise');

// Enrich not enriched authors
function storeEnrichment(driver, enrichment) {
    return driver.collection('lombardia').findOneAndUpdate({_id: enrichment.author.uri, enriched: false}, {
        $set: {
            author: enrichment.author,
            options: enrichment.options,
            enriched: true,
            timestamp: new Date()
        },
    })
}

function getNotEnrichedAgents(driver, limit, callback) {
    driver.collection('lombardia').find({enriched: false, error: {$ne: true}}, {limit: limit}).toArray((err, res) => {
        if(err) throw err;
        callback(res.map(el => {return {id: el._id}}));
    })
}

function feedEnrichments(driver, callback, limit = 5) {
    driver.collection('lombardia').find({enriched: false}, {fields: {_id: 1}, limit: limit}).toArray((err, res) => {

        // Generate requests for each enrichment uri
        let requests = res.map(el => nodeRequest('http://localhost:3646/api/v1/lombardia/author/' + encodeURIComponent(el._id) + '/?cache=false'));
        Promise.all(requests).then((results) => {

            // Parse JSON result
            results = results.map(result => JSON.parse(result));
            // Store enrichment
            let queries = results.map(result => storeEnrichment(driver, result));

            Promise.all(queries).then(callback);

        })

    })
}

function getAndlockAgent(driver, user, agent, lock, callback) {

    if(driver) {

        // Change behavior on uri existence
        let filter = {};

        if(agent){
            filter._id = agent;
        } else {
            filter = {
                $or: [
                    {options: {$not: {$size: 0}, $ne: null}, "author.titlesCount": {$ne: "0"}, enriched: true},
                    {enriched: false}
                ],
                validated: false,
                matchedBy: {$nin: [user]},
                skippedBy: {$nin: [user]}
            }
        }

        // Take the lock on the selected document
        driver.collection('lombardia').findOneAndUpdate(
            filter,
            {$set: {lock: lock ? new Date() : null}},
            {returnOriginal: true, sort: {enriched: -1}},
            (err, res) => {
                if (err) throw err;
                if (!res.value) {
                    console.log("agent not found")
                    getAndlockAgent(driver, user, null, lock, callback);
                } else {
                    callback(res.value, res.value.author, res.value.options);
                }
            }
        );

    } else
        callback(null);

}

function deleteValidated(driver, callback) {
    driver.collection('lombardia').deleteMany({validated: true}, (err, res) => {
        if(err) throw err;
        callback();
    })
}

function resetLocks(driver, callback) {
    driver.collection('lombardia').updateMany({}, {$set: {lock: null}}, (err, res) => {
        if(err) throw err;
        callback();
    });
}

function storeMatching(driver, user, option, agent) {

    // Store document
    let document = {agent: agent, user: user.username, option: option};

    // Upsert document and store matching
    return driver.collection('matches').updateOne(document, {$set: Object.assign(document, {timestamp: new Date()})}, {upsert: true}, (err, res) => {
        if(err) throw err;
        driver.collection('lombardia').updateOne({_id: agent}, {$addToSet: {matchedBy: user.username}});
    });

}

function skipAgent(driver, user, agent) {

    // Store document
    let document = {agent: agent, user: user.username};

    // Upsert document and store skip
    return driver.collection('skipped').updateOne(document, {$set: Object.assign(document, {timestamp: new Date()})}, {upsert: true}, (err, res) => {
        if(err) throw err;
        driver.collection('lombardia').updateOne({_id: agent}, {$addToSet: {skippedBy: user.username}});
    });

}

function getMatchingToValidate(driver, agent, callback) {
    let filter = {}

    if (agent)
        filter._id = agent;
    else 
        filter = {validated: false, matchedBy: {$not: {$size: 0}}}
    // Get matches for the given agent
    driver.collection('lombardia').findOne(filter, (err, enrichment) => {
        if(err) throw err;
        if(!enrichment) callback(null);
        else {
            driver.collection('matches').find({agent: enrichment._id}).project({option: 1}).toArray((err, matches) => {
                if (err) throw err;
                callback({
                    author: enrichment.author,
                    options: enrichment.options,
                    matches: matches
                });
            })
        }
    })
}

function validateMatching(driver, agent, callback) {

    // Store document and do upsert
    let document = {agent: agent};

    // Set an agent as validate
    driver.collection('lombardia').findOneAndUpdate({_id: agent}, {$set: {validated: true}}, (err, res) => {
        if(err) throw err;
        driver.collection('validations').updateOne(document, {$set: Object.assign(document, {timestamp: new Date()})}, {upsert: true}, (err, res) => {
            if(err) throw err;
            callback();
        });
    })

}

function insertAgents(driver, urisAndUsers, callback) {

    let documents = urisAndUsers.map(uriAndUsers => {
        return {
            _id: uriAndUsers.uri,
            author: null,
            options: null,
            enriched: false,
            timestamp: null,
            lock: null,
            matchedBy: uriAndUsers.matches,
            skippedBy: uriAndUsers.skip,
            validated: false
        }
    });

    driver.collection('lombardia').insertMany(documents, (err, res) => {
        if(err) throw err;
        callback();
    })

}

function skipEnrichment(driver, uri) {
    return driver.collection('lombardia').updateOne({_id: uri.id}, {$set: {error: true}});
}

// Exports
exports.storeEnrichment         = storeEnrichment;
exports.getNotEnrichedAgents     = getNotEnrichedAgents;
exports.feedEnrichments         = feedEnrichments;
exports.getAndLockAgent         = getAndlockAgent;
exports.resetLocks              = resetLocks;
exports.deleteValidated         = deleteValidated;
exports.storeMatching           = storeMatching;
exports.skipAgent               = skipAgent;
exports.getMatchingToValidate   = getMatchingToValidate;
exports.validateMatching        = validateMatching;
exports.insertAgents            = insertAgents;
exports.skipEnrichment          = skipEnrichment;