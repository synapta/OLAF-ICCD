const nodeRequest = require('request-promise');

// Enrich not enriched authors
function storeEnrichment(driver, enrichment) {
    return driver.collection('lombardia-luoghi').findOneAndUpdate({_id: enrichment.author.uri, enriched: false}, {
        $set: {
            place: enrichment.author,
            options: enrichment.options,
            enriched: true,
            timestamp: new Date()
        },
    })
}

function getNotEnrichedAgents(driver, limit, callback) {
    driver.collection('lombardia-luoghi').find({enriched: false, error: {$ne: true}}, {limit: limit}).toArray((err, res) => {
        if(err) throw err;
        callback(res.map(el => {return {id: el._id, classLabel: el.class}}));
    })
}

function feedEnrichments(driver, callback, limit = 5) {
    driver.collection('lombardia-luoghi').find({enriched: false}, {fields: {_id: 1}, limit: limit}).toArray((err, res) => {

        console.log(err);

        // Generate requests for each enrichment uri
        let requests = res.map(el => nodeRequest('http://localhost:3646/api/v1/lombardia-luoghi/author/' + encodeURIComponent(el._id) + '/?cache=false'));
        Promise.all(requests).then((results) => {

            // Parse JSON result
            results = results.map(result => JSON.parse(result));
            // Store enrichment
            let queries = results.map(result => storeEnrichment(driver, result));

            Promise.all(queries).then(callback);

        })

    })
}

function getAndlockAgent(driver, user, place, lock, callback) {

    if(driver) {

        // Change behavior on uri existence
        let filter = {};

        if(place){
            filter._id = place;
        } else {
            filter = {
                $or: [
                    {options: {$not: {$size: 0}, $ne: null}, enriched: true},
                    {enriched: false}
                ],
                "place.rawName": { $not: { $in: [ /ambito/i, /bottega/i, /manifattura/i, /produzione/i]}},
                validated: false,
                matchedBy: {$nin: [user]},
                skippedBy: {$nin: [user]}
            }
        }

        // Take the lock on the selected document
        driver.collection('lombardia-luoghi').findOneAndUpdate(
            filter,
            {$set: {lock: lock ? new Date() : null}},
            {returnOriginal: true, sort: {enriched: -1}},
            (err, res) => {
                if (err) throw err;
                if (!res.value) {
                    console.log("agent not found")
                    getAndlockAgent(driver, user, null, lock, callback);
                } else {
                    callback(res.value, res.value.place, res.value.options);
                }
            }
        );

    } else
        callback(null);

}

function deleteValidated(driver, callback) {
    driver.collection('lombardia-luoghi').deleteMany({validated: true}, (err, res) => {
        if(err) throw err;
        callback();
    })
}

function resetLocks(driver, callback) {
    driver.collection('lombardia-luoghi').updateMany({}, {$set: {lock: null}}, (err, res) => {
        if(err) throw err;
        callback();
    });
}

function storeMatching(driver, user, option, place) {

    // Store document
    let document = {place: place, user: user.username, option: option};

    // Upsert document and store matching
    return driver.collection('matches').updateOne(document, {$set: Object.assign(document, {timestamp: new Date()})}, {upsert: true}, (err, res) => {
        if(err) throw err;
        driver.collection('lombardia-luoghi').updateOne({_id: place}, {$addToSet: {matchedBy: user.username}});
    });

}

function skipAgent(driver, user, place) {

    // Store document
    let document = {place: place, user: user.username};

    // Upsert document and store skip
    return driver.collection('skipped').updateOne(document, {$set: Object.assign(document, {timestamp: new Date()})}, {upsert: true}, (err, res) => {
        if(err) throw err;
        driver.collection('lombardia-luoghi').updateOne({_id: place}, {$addToSet: {skippedBy: user.username}});
    });

}

function getMatchingToValidate(driver, place, callback) {
        let filter = {}

    if (place)
        filter._id = place;
    else 
        filter = {validated: false, matchedBy: {$not: {$size: 0}}}
    // Get matches for the given place
    driver.collection('lombardia-luoghi').findOne(filter, (err, enrichment) => {
        if(err) throw err;
        if(!enrichment) callback(null);
        else {
            driver.collection('matches').find({place: enrichment._id}).project({option: 1}).toArray((err, matches) => {
                if (err) throw err;
                callback({
                    author: enrichment.place,
                    options: enrichment.options,
                    matches: matches
                });
            })
        }
    })
}

function validateMatching(driver, place, callback) {

    // Store document and do upsert
    let document = {place: place};

    // Set an place as validate
    driver.collection('lombardia-luoghi').findOneAndUpdate({_id: place}, {$set: {validated: true}}, (err, res) => {
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
            place: null,
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

    driver.collection('lombardia-luoghi').insertMany(documents, (err, res) => {
        if(err) throw err;
        callback();
    })

}

function skipEnrichment(driver, uri) {
    return driver.collection('lombardia-luoghi').updateOne({_id: uri.id}, {$set: {error: true}});
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