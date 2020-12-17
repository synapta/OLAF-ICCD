const nodeRequest   = require('request');
const enrichments   = require('./enrichments');
const crypto        = require('crypto');
const auth = require('../../auth');


function shasum(data) {
    return crypto.createHash("sha1").update(data, "binary").digest("hex");
}

let authorSearch = (name) => {

    // Compose query
    return {
        method: 'GET',
        uri: 'https://www.wikidata.org/w/api.php',
        qs: {
            action: "query",
            list: "search",
            srsearch: (name.split(/[(-]/)[0]).trim(),
            format: "json"
        },
        //proxy: 'http://10.138.181.7:3128/',
        json: true
    }

};

let getAgents = (index) => {
    return `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX foaf: <http://www.w3.org/2001/XMLSchema#>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    SELECT ?person
           (GROUP_CONCAT(DISTINCT ?match; separator="###") AS ?matches) 
           (GROUP_CONCAT(DISTINCT ?skip; separator="###") AS ?skip)
    WHERE {
      GRAPH <https://w3id.org/arco/sardegna/data2> {
        ?person a <https://w3id.org/italia/onto/CPV/Person> .
      }
      MINUS  {
        graph <http://olaf.datipubblici.org/olaf/sameAs/agents> {?person owl:sameAs ?wikidata}
      }
      OPTIONAL {
        GRAPH ?g {
          ?person skos:related ?statement .
          ?statement foaf:maker/foaf:mbox_sha1sum ?user .
          OPTIONAL {
            ?statement skos:relatedMatch ?target .
          }
          BIND(IF(BOUND(?target), ?user, "") AS ?match)
          BIND(IF(BOUND(?target), "", ?user) AS ?skip)
        } filter (str(?g)="http://olaf.datipubblici.org/olaf/statements")
      }
    } GROUP BY ?person
      LIMIT 10000
      OFFSET ${index*10000}
`};

let authorSelect = (authorId) => {
    
    return `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?person
           (SAMPLE(?localIDs) AS ?localIDs)
           (SAMPLE(?agentNames) AS ?agentNames)
           (SAMPLE(?description) AS ?description)
           (SAMPLE(?agentDates) AS ?agentDates)
           (GROUP_CONCAT(?thingNameWithDates; separator="$$$") AS ?producedThings)
           (GROUP_CONCAT(DISTINCT REPLACE(?thingStartingDate, "###", "$$$"); separator="$$$") AS ?thingStartingDate)
           (GROUP_CONCAT(DISTINCT REPLACE(?thingEndingDate, "###", "$$$"); separator="$$$") AS ?thingEndingDate)
           (SAMPLE(?producedThingsCount) AS ?producedThingsCount)
           (SAMPLE(?agentRoles) AS ?agentRoles)
           (GROUP_CONCAT(DISTINCT(?materialOrTechniques); separator="$$$") as ?materialsAndTechniques)
    WHERE {
    
      {
        SELECT ?person
               (SAMPLE(?localIDs) AS ?localIDs)
               (SAMPLE(?agentNames) AS ?agentNames)
               (SAMPLE(?agentDates) AS ?agentDates)
               ?thing
               (SAMPLE(?thingName) AS ?thingName)
               (SAMPLE(?thingStartingDate) AS ?thingStartingDate)
               (SAMPLE(?thingEndingDate) AS ?thingEndingDate)
               (SAMPLE(?producedThingsCount) AS ?producedThingsCount)
               (SAMPLE(?agentRoles) AS ?agentRoles)
               (SAMPLE(LCASE(?materialOrTechnique)) AS ?materialOrTechniques)
               (SAMPLE(?description) AS ?description)
        WHERE {
    
          {
            SELECT ?person
                   (GROUP_CONCAT(DISTINCT(?localID); separator="$$$") AS ?localIDs)
                   (GROUP_CONCAT(DISTINCT(?agentName); separator="$$$") AS ?agentNames)
                   (GROUP_CONCAT(DISTINCT(?agentDate); separator="$$$") AS ?agentDates)
                   (GROUP_CONCAT(DISTINCT(?role); separator="$$$") AS ?agentRoles)
                   (COUNT(DISTINCT(?thing)) AS ?producedThingsCount)
                   (SAMPLE(?description) AS ?description)
            WHERE {
    
              # Get only some agents in order to explore the graph
              VALUES ?person {
                <${authorId}>
              }
    
              # Get only agents that are also people
              ?person a <https://w3id.org/italia/onto/CPV/Person> .
    
              # Get agent name or names
              OPTIONAL {
                ?person <https://w3id.org/italia/onto/l0/name> ?agentName .
              }
              
              # Get agent description 
              OPTIONAL {
                ?person <https://w3id.org/arco/ontology/context-description/historicalBiographicalInformation> ?description .
              }
              
              # Get agent activity time range or ranges
              OPTIONAL {
                ?person <https://w3id.org/arco/ontology/context-description/agentDate> ?agentDate
              }
              
              # Get agent local ids
              OPTIONAL {
                ?person <https://w3id.org/arco/ontology/context-description/agentLocalIdentifier> ?localID
              }
    
              # Get agent production
              OPTIONAL {
                # Get produced things
                ?person <https://w3id.org/arco/ontology/context-description/isAuthorOf> ?thing .
              }
    
              # Get agent roles
              OPTIONAL {
                {OPTIONAL {?person <https://w3id.org/italia/onto/RO/holdsRoleInTime>/<https://w3id.org/italia/RO/withRole>/rdfs:label ?role}}
                UNION
                {OPTIONAL{?person <https://w3id.org/italia/RO/holdsRoleInTime>/<https://w3id.org/italia/RO/withRole>/rdfs:label ?role}}
              }
            } GROUP BY ?person
              LIMIT 1
          }
    
          # Get agent production
          OPTIONAL {
    
            # Get produced things
            ?person <https://w3id.org/arco/ontology/context-description/isAuthorOf> ?thing .
    
            # Get name of the produced things
            OPTIONAL {?thing <https://w3id.org/arco/ontology/context-description/title> ?thingTitle}
            OPTIONAL {?thing <https://w3id.org/arco/ontology/context-description/properTitle> ?thingProperTitle}
            OPTIONAL {?thing <https://w3id.org/arco/ontology/context-description/> ?thingContextDescription}
            OPTIONAL {?thing rdfs:label ?thingLabel}
    
            BIND(COALESCE(COALESCE(COALESCE(?thingTitle, ?thingContextDescription), ?thingProperTitle), ?thingLabel) AS ?thingName)
            
            # Get thing materials
            OPTIONAL {
              {
                ?thing <https://w3id.org/arco/ontology/denotative-description/hasCulturalPropertyType>/<https://w3id.org/arco/ontology/denotative-description/hasCulturalPropertySpecification>/rdfs:label ?specification .
                ?thing <https://w3id.org/arco/ontology/denotative-description/hasCulturalPropertyType>/<https://w3id.org/arco/ontology/denotative-description/hasCulturalPropertyDefinition>/rdfs:label ?definition .
                BIND(CONCAT(?definition, " ", ?specification) AS ?materialOrTechnique)
              }
              UNION
              {?thing <https://w3id.org/arco/ontology/denotative-description/hasMaterialOrTechnique>/rdfs:label ?materialOrTechnique}
            }
    
            # Get start date for a certain produced thing
            ?thing <https://w3id.org/arco/ontology/context-description/hasDating>/<https://w3id.org/arco/ontology/context-description/hasDatingEvent> ?thingTiming .
            # Get thing starting date
            OPTIONAL {
              {?thingTiming <https://w3id.org/italia/onto/TI/atTime>/<https://w3id.org/arco/ontology/arco/startTime> ?thingStartingDate .}
              UNION
              {?thingTiming <https://w3id.org/arco/ontology/context-description/specificTime>/<https://w3id.org/arco/ontology/arco/startTime> ?thingStartingDate .}
            }
            # Get thing ending date
            OPTIONAL {
              {?thingTiming <https://w3id.org/italia/onto/TI/atTime>/<https://w3id.org/arco/ontology/arco/endTime> ?thingEndingDate .}
              UNION
              {?thingTiming <https://w3id.org/arco/ontology/context-description/specificTime>/<https://w3id.org/arco/ontology/arco/endTime> ?thingEndingDate .}
            }
    
          }
    
        } GROUP BY ?person ?thing
          LIMIT 30
    
      }
    
      # Try to associate each date to each produced thing
      BIND(COALESCE(STR(?thingStartingDate), "") AS ?thingStartingDateParsed)
      BIND(COALESCE(STR(?thingEndingDate), "") AS ?thingEndingDateParsed)
      BIND(IF(BOUND(?thingName), CONCAT(?thingStartingDateParsed, " - ", ?thingEndingDateParsed, ", ", STR(?thingName)), "") AS ?thingNameWithDates)
    
    } GROUP BY ?person`;

};

let wikidataQuery = (options) => {

    return `
    PREFIX wdt: <http://www.wikidata.org/prop/direct/>
    
    SELECT ?id
           (SAMPLE(?author) AS ?author)
           (SAMPLE(?description) AS ?description)
           (SAMPLE(?birthDate) AS ?birthDate)
           (SAMPLE(?deathDate) AS ?deathDate)
           (SAMPLE(?occupations) AS ?occupations)
           (SAMPLE(?immagine) AS ?immagine)
           (SAMPLE(?itwikipedia) AS ?itwikipedia)
           (SAMPLE(?viafurl) AS ?viafurl)           
           (SAMPLE(?ULAN) AS ?ULAN)
           (SAMPLE(?treccani) as ?treccani)
           (SAMPLE(?commonsCategory) as ?commonsCategory)
           (MAX(?workStartingYear) AS ?minThingDate)
           (MAX(?workEndingYear) AS ?maxThingDate)
           (GROUP_CONCAT(DISTINCT ?work; separator="###") AS ?works)
           (SAMPLE(?worksCount) AS ?worksCount)
    WHERE {
        
      {
        SELECT ?id
               ?author
               ?description
               ?worksCount
               ?birthDate
               ?deathDate
               ?occupations
               ?immagine
               ?itwikipedia
               ?viafurl
               ?ULAN
               ?treccani
               ?commonsCategory
               ?work
        WHERE {
    
          {
    
            SELECT ?id
                  ?author
                  ?description
                  (COUNT(DISTINCT ?workID) AS ?worksCount)
                  (SAMPLE(?birthDate) AS ?birthDate)
                  (SAMPLE(?deathDate) AS ?deathDate)
                  (GROUP_CONCAT(DISTINCT ?occupation; separator="###") AS ?occupations)
                  (SAMPLE(?immagine) as ?immagine)
                  (SAMPLE(?itwikipedia) as ?itwikipedia)
                  (SAMPLE(?viafurl) as ?viafurl)
                  (SAMPLE(?ULAN) as ?ULAN)
                  (SAMPLE(?treccani) as ?treccani)
                  (SAMPLE(?commonsCategory) as ?commonsCategory)
            WHERE {
    
              # Setting up services
              SERVICE wikibase:label {
                bd:serviceParam wikibase:language "it,en".
                ?id rdfs:label ?author .
                ?id schema:description ?description .
                ?occupationID rdfs:label ?occupation
              }
    
              # Select a single agent
              VALUES ?id {
                ${options.join(' ')}
              }
    
              # Get only people as Agent
              ?id wdt:P31 wd:Q5 .
    
              # Get see also for creator property
              wd:P170 wdt:P1659 ?seeAlsoCreator .
              BIND(URI(REPLACE(STR(?seeAlsoCreator), "entity", "prop/direct")) AS ?creatorBinded)
    
              # Select all types of works produced by the given author
              OPTIONAL {
                {?workID ?creatorBinded ?id}
                UNION
                {?workID wdt:P170 ?id}
              }
    
              # Get agent dates
              OPTIONAL {
                ?id wdt:P569 ?birthDate
              }
              OPTIONAL {
                ?id wdt:P570 ?deathDate
              }
    
              # Get agent occupations
              OPTIONAL {
                ?id wdt:P106 ?occupationID
              }
    
              OPTIONAL {
                ?id wdt:P18 ?immagine .
              }
    
              OPTIONAL {
                ?itwikipedia schema:about ?id .
                FILTER(CONTAINS(STR(?itwikipedia), 'it.wikipedia.org'))
              }
    
              OPTIONAL {
                ?id wdt:P214 ?viaf
                BIND(concat('https://viaf.org/viaf/', ?viaf) as ?viafurl)
              }
              
              OPTIONAL {
                ?id wdt:P245 ?ULANr
                BIND(concat('https://www.getty.edu/vow/ULANFullDisplay?find=&role=&nation=&subjectid=', STR(?ULANr)) as ?ULAN)
              }
              
              OPTIONAL {
                ?id wdt:P3365 ?trecRaw .
                BIND(concat('http://www.treccani.it/enciclopedia/', ?trecRaw ) as ?treccani)
              }
              
              OPTIONAL {
                ?id wdt:P373 ?commonsCategory
              }
    
            } GROUP BY ?id ?author ?description
    
          }
    
          # Get see also for creator property
          wd:P170 wdt:P1659 ?seeAlsoCreator .
          BIND(URI(REPLACE(STR(?seeAlsoCreator), "entity", "prop/direct")) AS ?creatorBinded)
    
          # Select all types of works produced by the given author
          OPTIONAL {
            {?workID ?creatorBinded ?id}
            UNION
            {?workID wdt:P170 ?id}
            SERVICE wikibase:label {
              bd:serviceParam wikibase:language "it,en".
              ?workID rdfs:label ?work .
            }
          }
    
        } LIMIT 30
      }
    
    } GROUP BY ?id`;

};

function insertMatchStatement(item, user, target, graph) {

    let statementURI = "http://olaf.datipubblici.org/"+ encodeURIComponent(item) + "/" + shasum(user._id) + "/" + Math.floor(new Date() / 1000);
    let userURI = "http://olaf.datipubblici.org/users/" + shasum(user._id);

    return `INSERT INTO <${graph}> {
        <${item}> <http://www.w3.org/2004/02/skos/core#related> <${statementURI}> .
        <${statementURI}> a rdf:Statement .
        <${statementURI}> schema:dateCreated "${(new Date()).toISOString()}"^^xsd:dateTimeStamp .
        <${statementURI}> <http://www.w3.org/2004/02/skos/core#relatedMatch> <${target}> .
        <${statementURI}> <http://xmlns.com/foaf/0.1/maker> <${userURI}> .
        <${userURI}> a <http://xmlns.com/foaf/0.1/Agent> .
        <${userURI}> <http://xmlns.com/foaf/0.1/mbox_sha1sum> "${shasum(user._id)}" .
    }`

}

function insertSkipStatement(item, user, graph) {

    let statementURI = "http://olaf.datipubblici.org/"+ encodeURIComponent(item) + "/" + shasum(user._id) + "/" + Math.floor(new Date() / 1000);
    let userURI = "http://olaf.datipubblici.org/users/" + shasum(user._id);

    return `INSERT  INTO <${graph}> {
        <${item}> <http://www.w3.org/2004/02/skos/core#related> <${statementURI}> .
        <${statementURI}> a rdf:Statement .
        <${statementURI}> <http://schema.org/dateCreated> "${(new Date()).toISOString()}"^^xsd:dateTimeStamp .
        <${statementURI}> <http://xmlns.com/foaf/0.1/maker> <${userURI}> .
        <${userURI}> a <http://xmlns.com/foaf/0.1/Agent> .
        <${userURI}> <http://xmlns.com/foaf/0.1/mbox_sha1sum> "${shasum(user._id)}" .
    }
    `
}

function insertMatchValidation(item, target, graph) {

    return `INSERT  INTO <${graph}> {
            <${item}> owl:sameAs <${target}>
        }
    `;

}

function insertSkipValidation(item, graph) {

    return `
        INSERT  INTO <${graph}> {
            <${item}> owl:sameAs <http://nomatch.com>
        }
    `;

}


// Functions
function authorOptions(name){

    // Compose queries
    return [makeWikidataQuery(name)];

}

function authorLink(request, driver) {

    let body = request.body;
    let user = request.user;
    let option = JSON.parse(body.option);
    let agent = body.agent;

    return [enrichments.storeMatching(driver, user, option.hash, agent), makeWriteQuery(composeWriteQuery(insertMatchStatement(agent, user, option.wikidata, "http://olaf.datipubblici.org/olaf/statements")))];

}

function authorSkip(request, driver) {

    // Get body params
    let body = request.body;
    let user = request.user;
    let agent = body.authorId;

    // Return query
    return [enrichments.skipAgent(driver, user, agent),  makeWriteQuery(composeWriteQuery(insertSkipStatement(agent, user, "http://olaf.datipubblici.org/olaf/statements")))];

}

function storeMatching(item, target) {
    return composeWriteQuery(insertMatchValidation(item, target, 'http://olaf.datipubblici.org/olaf/sameAs/agents-sardegna'));
}

function storeSkip(item) {
    return composeWriteQuery(insertSkipValidation(item, 'http://olaf.datipubblici.org/olaf/sameAs/agents-sardegna'));
}

// Query composer
function composeQuery(query) {

    return {
        url: 'https://arco.datipubblici.org/sparql',
        format: 'json',
        form: {
            query: query,
            format: 'json'
        },
        //proxy: 'http://10.138.181.7:3128/',
        method: 'POST',
        headers: {
            'Content-Type' : 'application/x-www-form-urlencoded'
        }
    };

}

function composeWriteQuery(query) {
    return {	
        'url': 'https://dati.beniculturali.it/sparql-auth?default-graph-uri=&query=' + encodeURIComponent(query),
        'auth': auth.virtuosoAuth,
        'proxy': 'http://10.138.181.7:3128/'
    }
}

function composeQueryWikidata(query){

    // Compose query
    return {
        method: 'POST',
        //proxy: 'http://10.138.181.7:3128/',
        url: 'https://query.wikidata.org/sparql',
        body: 'query=' + encodeURIComponent(query),
        headers: {
            'accept-language': 'it-IT,it;q=0.9',
            'accept-encoding': 'deflate, br',
            referer: 'https://query.wikidata.org/',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36',
            'x-requested-with': 'XMLHttpRequest',
            origin: 'https://query.wikidata.org',
            accept: 'application/sparql-results+json',
            'Cache-Control': 'no-cache',
            pragma: 'no-cache',
            authority: 'query.wikidata.org'
        }
    }

}

function makeWriteQuery(requestOptions) {

console.log("making query")
    // Find the author on wikidata
    return new Promise((resolve, reject) => {
        nodeRequest(requestOptions, (err, res, body) => {
            // Handle error
            if (err) {
                console.error(err);
                reject(err);
            }
console.log("made query")
	    console.log("body", body)
            resolve(body);
        });
    });
}

function makeWikidataQuery(name) {

    // Find the author on wikidata
    return new Promise((resolve, reject) => {
        nodeRequest(authorSearch(name), (err, res, body) => {

            // Handle error
            if (err) {
                console.error(err);
                reject(err);
            }

            try{

                // Extract agents ID
                let agents = [];
                if (body.query)
                    agents = body.query.search.map(result => 'wd:' + result.title);

                if(agents.length > 0) {
                    nodeRequest(composeQueryWikidata(wikidataQuery(agents)), (err, res, body) => {
                        if (err) {
                            console.error(err);
                            reject();
                        }
                        resolve(body);
                    });
                } else
                    resolve(JSON.stringify({results: {bindings: []}}))

            } catch(err) {
                reject(err);
            }

        })
    });

}

// Exports
exports.authorSelect = (params) => composeQuery(authorSelect(params));
exports.getAgents = (index) => composeQuery(getAgents(index));
exports.authorOptions = authorOptions;
exports.authorSkip = authorSkip;
exports.insertMatchStatement = insertMatchStatement;
exports.composeWriteQuery = composeWriteQuery;
exports.makeWriteQuery = makeWriteQuery;
exports.authorLink = authorLink;
exports.storeMatching = storeMatching;
exports.storeSkip = storeSkip;
