const nodeRequest = require('request-promise');

let getNotEnrichedAgents = `
    SELECT arco_uri 
    FROM enrichments
    WHERE enriched is false 
    ORDER BY RANDOM() 
    LIMIT $1
`;

let updateEnrichedAgents = `
    UPDATE enrichments 
    SET author = $1, 
        options = $2, 
        enriched = true 
    WHERE arco_uri = $3
`;

let getAvailableAgentAndLock = (uri) => {

    return `
        WITH available_agent AS (
            SELECT arco_uri, author, "options"
            FROM enrichments
            WHERE "lock" IS NULL
            AND enriched IS TRUE
            ${uri ? `AND arco_uri = '${uri}'` : ''}
            LIMIT 1
        ), lock_agent AS (
            UPDATE enrichments
            SET "lock" = NOW()
            WHERE arco_uri = (
                SELECT arco_uri
                FROM available_agent
            )
        ) SELECT author, options
          FROM available_agent
    `;

};

// Enrich not enriched authors
function feedEnrichments(driver, callback, limit = 5) {
    driver.query(getNotEnrichedAgents, [limit]).then((data) => {

        // Generate requests
        let requests = data.map(el => nodeRequest('http://localhost:3646/api/v1/arco/author/' + encodeURIComponent(el.arco_uri) + '/?cache=false'));

        Promise.all(requests).then((results) => {

            results = results.map(result => JSON.parse(result));

            driver.tx(t => {
                return t.batch(results.map(r => t.none(updateEnrichedAgents, [
                        r.author,
                        {fields: r.options},
                        r.author.uri
                    ])
                ))
            }).then(callback)
              .catch(error => {
                  console.error(error)
              });

        })

    });
}



function getAndlockAgent(driver, uri, callback) {
    driver.query(getAvailableAgentAndLock(uri)).then((data) => {
        callback(data);
    });
}

exports.feedEnrichments = feedEnrichments;
exports.getAndLockAgent = getAndlockAgent;
