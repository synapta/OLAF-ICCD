const nodeRequest = require('request-promise');

// Enrich not enriched authors
function storeEnrichment(driver, enrichment) {
    return driver.collection('things').findOneAndUpdate({_id: enrichment.author.uri, enriched: false}, {
        $set: {
            thing: enrichment.author,
            options: enrichment.options,
            enriched: true,
            timestamp: new Date()
        },
    })
}

function getNotEnrichedAgents(driver, limit, callback) {
    driver.collection('things').find({enriched: false, error: {$ne: true}}, {limit: limit}).toArray((err, res) => {
        if(err) throw err;
        callback(res.map(el => {return {id: el._id, classLabel: el.class}}));
    })
}

function feedEnrichments(driver, callback, limit = 5) {
    driver.collection('things').find({enriched: false}, {fields: {_id: 1}, limit: limit}).toArray((err, res) => {

        console.log(err);

        // Generate requests for each enrichment uri
        let requests = res.map(el => nodeRequest('http://localhost:3646/api/v1/arco/author/' + encodeURIComponent(el._id) + '/?cache=false'));
        Promise.all(requests).then((results) => {

            // Parse JSON result
            results = results.map(result => JSON.parse(result));
            // Store enrichment
            let queries = results.map(result => storeEnrichment(driver, result));

            Promise.all(queries).then(callback);

        })

    })
}

function getAndlockAgent(driver, user, thing, lock, callback) {

    if(driver) {

        // Change behavior on uri existence
        let filter = {};

        if(thing){
            filter._id = thing;
        } else {
            filter = {
                $or: [
                    {options: {$not: {$size: 0}, $ne: null}, enriched: true},
                    {enriched: false}
                ],
                "thing.rawName": { $not: { $in: [ /ambito/i, /bottega/i, /manifattura/i, /produzione/i]}},
                validated: false,
                matchedBy: {$nin: [user]},
                skippedBy: {$nin: [user]}
            }
        }

        // Take the lock on the selected document
        driver.collection('things').findOneAndUpdate(
            filter,
            {$set: {lock: lock ? new Date() : null}},
            {returnOriginal: true, sort: {enriched: -1}},
            (err, res) => {
                if (err) throw err;
                if (!res.value) {
                    console.log("agent not found")
                    getAndlockAgent(driver, user, null, lock, callback);
                } else {
                    callback(res.value, res.value.thing, res.value.options);
                }
            }
        );

    } else
        callback(null);

}

function deleteValidated(driver, callback) {
    driver.collection('things').deleteMany({validated: true}, (err, res) => {
        if(err) throw err;
        callback();
    })
}

function resetLocks(driver, callback) {
    driver.collection('things').updateMany({}, {$set: {lock: null}}, (err, res) => {
        if(err) throw err;
        callback();
    });
}

function storeMatching(driver, user, option, thing) {

    // Store document
    let document = {thing: thing, user: user.username, option: option};

    // Upsert document and store matching
    return driver.collection('matches').updateOne(document, {$set: Object.assign(document, {timestamp: new Date()})}, {upsert: true}, (err, res) => {
        if(err) throw err;
        driver.collection('things').updateOne({_id: thing}, {$addToSet: {matchedBy: user.username}});
    });

}

function skipAgent(driver, user, thing) {

    // Store document
    let document = {thing: thing, user: user.username};

    // Upsert document and store skip
    return driver.collection('skipped').updateOne(document, {$set: Object.assign(document, {timestamp: new Date()})}, {upsert: true}, (err, res) => {
        if(err) throw err;
        driver.collection('things').updateOne({_id: thing}, {$addToSet: {skippedBy: user.username}});
    });

}

function getMatchingToValidate(driver, thing, callback) {
        let filter = {}

    if (thing)
        filter._id = thing;
    else 
        filter = {validated: false, matchedBy: {$not: {$size: 0}}}
    // Get matches for the given thing
    driver.collection('things').findOne(filter, (err, enrichment) => {
        if(err) throw err;
        if(!enrichment) callback(null);
        else {
            driver.collection('matches').find({thing: enrichment._id}).project({option: 1}).toArray((err, matches) => {
                if (err) throw err;
                callback({
                    author: enrichment.thing,
                    options: enrichment.options,
                    matches: matches
                });
            })
        }
    })
}

function validateMatching(driver, thing, callback) {

    // Store document and do upsert
    let document = {thing: thing};

    // Set an thing as validate
    driver.collection('things').findOneAndUpdate({_id: thing}, {$set: {validated: true}}, (err, res) => {
        if(err) throw err;
        driver.collection('validations').updateOne(document, {$set: Object.assign(document, {timestamp: new Date()})}, {upsert: true}, (err, res) => {
            if(err) throw err;
            callback();
        });
    })

}

function insertThings(driver, urisClassUsers, callback) {

    let documents = urisClassUsers.map(uriClassUsers => {
        return {
            _id: uriClassUsers.uri,
            thing: null,
            options: null,
            enriched: false,
            timestamp: null,
            lock: null,
            matchedBy: uriClassUsers.matches,
            skippedBy: uriClassUsers.skip,
            validated: false,
            class: uriClassUsers.class
        }
    });

    driver.collection('things').insertMany(documents, (err, res) => {
        if(err) throw err;
        callback();
    })

}

function skipEnrichment(driver, uri) {
    return driver.collection('things').updateOne({_id: uri.id}, {$set: {error: true}});
}

// Exports
exports.storeEnrichment         = storeEnrichment;
exports.getNotEnrichedAgents    = getNotEnrichedAgents;
exports.feedEnrichments         = feedEnrichments;
exports.getAndLockAgent         = getAndlockAgent;
exports.resetLocks              = resetLocks;
exports.deleteValidated         = deleteValidated;
exports.storeMatching           = storeMatching;
exports.skipAgent               = skipAgent;
exports.getMatchingToValidate   = getMatchingToValidate;
exports.validateMatching        = validateMatching;
exports.insertThings            = insertThings;
exports.skipEnrichment          = skipEnrichment;