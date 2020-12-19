const nodeRequest   = require('request');
const enrichments   = require('./enrichments');
const crypto        = require('crypto');
const auth = require('../../auth');

function shasum(data) {
    return crypto.createHash("sha1").update(data, "binary").digest("hex");
}

let authorSearch = (name, classLabel) => {

    let fullName = ((name.split(/[(-]/)[0]).trim() + (classLabel ? ' ' + classLabel : ''));
    fullName = fullName.replace(/[^a-zA-Z\d\s:]/gmi, '').toLowerCase().trim();

    // Compose query
    return {
        method: 'GET',
        uri: 'https://www.wikidata.org/w/api.php',
        qs: {
            action: "query",
            list: "search",
            srsearch: fullName,
            format: "json"
        },
        json: true,
        proxy: 'http://10.138.181.7:3128/',
    }

};

let getThings = (index) => {
    return `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX foaf: <http://www.w3.org/2001/XMLSchema#>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    SELECT ?site 
           (GROUP_CONCAT(?label; separator="###") AS ?label)
           (GROUP_CONCAT(DISTINCT ?match; separator="###") AS ?matches) 
           (GROUP_CONCAT(DISTINCT ?skip; separator="###") AS ?skip)
    WHERE {
        GRAPH <https://w3id.org/arco/sardegna/data2> {
            ?site a cis:Site .
        }
        MINUS  {
          GRAPH <http://olaf.datipubblici.org/olaf/sameAs/Sardegna/Sites> {?site owl:sameAs ?wikidata}
        }
        OPTIONAL {
            ?thing skos:related ?statement .
            ?statement foaf:maker/foaf:mbox_sha1sum ?user .
            OPTIONAL {
              ?statement skos:relatedMatch ?target .
            }
            BIND(IF(BOUND(?target), ?user, "") AS ?match)
            BIND(IF(BOUND(?target), "", ?user) AS ?skip)
        }
        OPTIONAL {
          ?site rdfs:label ?label .
        }
    } GROUP BY ?site
      LIMIT 10000
      OFFSET ${index*10000}
`};

let authorSelect = (authorId) => {

    return `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    SELECT 
        ?thing
        (GROUP_CONCAT(DISTINCT(LCASE(?typeLabel)); separator="$$$") AS ?types)
        (GROUP_CONCAT(DISTINCT(LCASE(?materialLabel)); separator="$$$") AS ?materials)
        (GROUP_CONCAT(DISTINCT(LCASE(?subject)); separator="$$$") AS ?subject)
        (GROUP_CONCAT(DISTINCT(?description); separator="$$$") AS ?description)
        (SAMPLE(?placeLabel) AS ?place)
        (GROUP_CONCAT(DISTINCT(?classLabel); separator="$$$") AS ?classes)
        (GROUP_CONCAT(DISTINCT(LCASE(?contributorName)); separator="$$$") AS ?contributorNames)
        (GROUP_CONCAT(DISTINCT(LCASE(?thingName)); separator="$$$") AS ?thingName)
        (GROUP_CONCAT(DISTINCT(?thingStartingDate); separator="$$$") AS ?startingDates)
        (GROUP_CONCAT(DISTINCT(?thingEndingDate); separator="$$$") AS ?endingDates)
        (GROUP_CONCAT(DISTINCT(?role); separator="$$$") AS ?agentRoles)
        (SAMPLE(?image) AS ?image)
    WHERE {
      
        VALUES ?thing {
            <${authorId}>
        }
          
        ?thing a ?subclass .
        ?subclass rdfs:subClassOf <https://w3id.org/arco/ontology/arco/TangibleCulturalProperty> .
        ?subclass rdfs:label ?classLabel .

        # Get name of the produced things
        OPTIONAL {?thing <https://w3id.org/arco/ontology/context-description/title> ?thingTitle}
        OPTIONAL {?thing <https://w3id.org/arco/ontology/context-description/properTitle> ?thingProperTitle}
        OPTIONAL {?thing <https://w3id.org/arco/ontology/context-description/> ?thingContextDescription}
        OPTIONAL {?thing rdfs:label ?thingLabel}
        
        # Get image of the produced thing
        OPTIONAL {?thing foaf:depiction ?image}
    
        BIND(COALESCE(COALESCE(COALESCE(?thingTitle, ?thingContextDescription), ?thingProperTitle), ?thingLabel) AS ?thingName)
          
        OPTIONAL {
            ?thing <https://w3id.org/arco/ontology/context-description/hasAuthorshipAttribution>/<https://w3id.org/arco/ontology/context-description/hasCulturalScope>/rdfs:label ?attributionName 
        }

        OPTIONAL {
        
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
        
            # Try to associate each date to each produced thing
            BIND(COALESCE(?thingStartingDate, "") AS ?thingStartingDateParsed)
            BIND(COALESCE(?thingEndingDate, "") AS ?thingEndingDateParsed)
            BIND(CONCAT(?thingName, "|||", ?thingStartingDateParsed, "|||", ?thingEndingDateParsed) AS ?thingNameWithDates)
            
        }
        
        OPTIONAL {
            ?thing <https://w3id.org/arco/ontology/denotative-description/hasCulturalPropertyType>/<https://w3id.org/arco/ontology/denotative-description/hasCulturalPropertyDefinition> ?type .
            ?type rdfs:label ?typeLabel .
        }
          
        OPTIONAL {
            ?thing <https://w3id.org/arco/ontology/denotative-description/hasMaterialOrTechnique> ?material .
            ?material rdfs:label ?materialLabel .
        }
          
        OPTIONAL {
            ?thing <https://w3id.org/arco/ontology/arco/description> ?description .
        }
          
        OPTIONAL {
            ?thing <https://w3id.org/arco/ontology/context-description/subject> ?subject .
        }
          
        OPTIONAL {
            ?thing <https://w3id.org/arco/ontology/location/hasCulturalPropertyAddress> ?place .
            ?place rdfs:label ?placeLabel .
        }
          
        OPTIONAL {
        
            # Get producer agent
            ?person <https://w3id.org/arco/ontology/context-description/isAuthorOf> ?thing .
        
            # Get agent name or names
            OPTIONAL {
                ?person <https://w3id.org/italia/onto/l0/name> ?agentName .
            }
        
            # Get agent activity time range or ranges
            OPTIONAL {
                ?person <https://w3id.org/arco/ontology/context-description/agentDate> ?agentDate
            }
        
            # Get agent roles
            OPTIONAL {
                {?person <https://w3id.org/italia/onto/RO/holdsRoleInTime>/<https://w3id.org/italia/RO/withRole>/rdfs:label ?role}
                UNION 
                {?person <https://w3id.org/italia/RO/holdsRoleInTime>/<https://w3id.org/italia/RO/withRole>/rdfs:label ?role}
            }
        
        }
          
        BIND(COALESCE(?agentName, ?attributionName) as ?contributorName)
        FILTER (lang(?classLabel) = 'it')
        FILTER (lang(?thingName) = 'it')
    
    } GROUP BY ?thing`;
    
};

let wikidataQuery = (options) => {

    return `
    SELECT ?id 
           ?thing
           ?description
           ?classLabel
           (SAMPLE(DISTINCT ?thingStartingYear) AS ?thingStartingDates)
           (SAMPLE(DISTINCT ?thingEndingYear) AS ?thingEndingDates)
           (GROUP_CONCAT(DISTINCT ?agentLabel; separator="###") AS ?agents)
           (GROUP_CONCAT(DISTINCT ?materialLabel; separator="###") AS ?materials)
           (SAMPLE(?immagine) as ?immagine) 
           (SAMPLE(?itwikipedia) as ?itwikipedia) 
           (SAMPLE(?ULAN) as ?ULAN)
           (SAMPLE(?treccani) as ?treccani)
           (SAMPLE(?commonsCategory) as ?commonsCategory)
           (SAMPLE(DISTINCT ?locationLabel) AS ?locations)
    WHERE {
    
      VALUES ?id {
        ${options.join(" ")}
      }
      
      MINUS {?id wdt:P31 wd:Q13442814}
      MINUS {?id wdt:P31 wd:Q5633421}
      MINUS {?id wdt:P31 wd:Q4167410}

      # Setting up services
      SERVICE wikibase:label {
        bd:serviceParam wikibase:language "it,en".
        ?id rdfs:label ?thing .
        ?id schema:description ?description .
        #?class rdfs:label ?classLabel .
        #?agent rdfs:label ?agentLabel .
        #?location rdfs:label ?locationLabel .
      }
    
      # Get thing class
      OPTIONAL {
        ?id wdt:P31 ?class
        SERVICE wikibase:label {
          bd:serviceParam wikibase:language "it,en".
          ?class rdfs:label ?classLabel .
        }
      }
    
      # Get see also for creator property
      VALUES ?creatorBinded {
        wdt:P170
        wdt:P50
        wdt:P61
        wdt:P84
        wdt:P86
        wdt:P110
        wdt:P112
        wdt:P175
        wdt:P178
      }
    
      # Select all types of works produced by the given author
      OPTIONAL {
    
        ?id ?creatorBinded ?agent
    
        SERVICE wikibase:label {
          bd:serviceParam wikibase:language "it,en".
          ?agent rdfs:label ?agentLabel .
        }
    
        # Get see also for inception property
        VALUES ?inceptionBinded {
         wdt:P571
         wdt:P577
         wdt:P580
         wdt:P729
         wdt:P1071
         wdt:P1619
        }
        OPTIONAL {
          ?id ?inceptionBinded ?thingStartingDate
          BIND(YEAR(?thingStartingDate) AS ?thingStartingYear)
        }
    
        # Get see also for dissolved property
        VALUES ?dissolvedBinded {
          wdt:P576
          wdt:P582
          wdt:P730
          wdt:P2669
          wdt:P3999
        }
        # Get work inception
        OPTIONAL {
          ?id ?dissolvedBinded ?thingEndingDate
          BIND(YEAR(?thingEndingDate) AS ?thingEndingYear)
        }
    
      }
    
      # Get see also for material used
      VALUES ?materialBinded {
        wdt:P186
        wdt:P176
        wdt:P527
        wdt:P1056
        wdt:P1582
      }
      # Get material used
      OPTIONAL {
        ?id ?materialBinded ?material
      }
    
      # Get location
      OPTIONAL {
        ?id wdt:P276 ?location .
        SERVICE wikibase:label {
          bd:serviceParam wikibase:language "it,en".
          ?location rdfs:label ?locationLabel .
        }
      }
    
      OPTIONAL {
        ?id wdt:P18 ?immagine .
      }
    
      OPTIONAL {
        ?itwikipedia schema:about ?id .
        FILTER(CONTAINS(STR(?itwikipedia), 'it.wikipedia.org'))
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
    
    } GROUP BY ?id ?thing ?description ?classLabel`;

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

    return `INSERT INTO <${graph}> {
        <${item}> <http://www.w3.org/2004/02/skos/core#related> <${statementURI}> .
        <${statementURI}> a rdf:Statement .
        <${statementURI}> <http://schema.org/dateCreated> "${(new Date()).toISOString()}"^^xsd:dateTimeStamp .
        <${statementURI}> <http://xmlns.com/foaf/0.1/maker> <${userURI}> .
        <${userURI}> a <http://xmlns.com/foaf/0.1/Agent> .
        <${userURI}> <http://xmlns.com/foaf/0.1/mbox_sha1sum> "${shasum(user._id)}" .
    }`

}

function insertMatchValidation(item, target, graph) {

    return `INSERT  INTO <${graph}> {
            <${item}> owl:sameAs <${target}>
        }
    `;

}

function insertSkipValidation(item,graph) {

    return `INSERT INTO <${graph}>  {
            <${item}> owl:sameAs <http://nomatch.com>
        }
    `;

}

// Functions
function authorOptions(name, classLabel){

    // Compose queries
    return [makeWikidataQuery(name, classLabel)];

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
    return [enrichments.skipAgent(driver, user, agent), makeWriteQuery(composeWriteQuery(insertSkipStatement(agent, user, "http://olaf.datipubblici.org/olaf/statements")))];

}

function storeMatching(item, target) {
    return composeWriteQuery(insertMatchValidation(item, target, 'http://olaf.datipubblici.org/olaf/sameAs/Sardegna/Sites'));
}

function storeSkip(item) {
    return composeWriteQuery(insertSkipValidation(item, 'http://olaf.datipubblici.org/olaf/sameAs/Sardegna/Sites'));
}

// Query composer
function composeQuery(query) {

    return {
        url: 'https://dati.beniculturali.it/sparql',
        format: 'json',
        form: {
            query: query,
            format: 'json'
        },
        proxy: 'http://10.138.181.7:3128/',
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
        proxy: 'http://10.138.181.7:3128/'
    }
}

function composeQueryWikidata(query){

    // Compose query
    return {
        method: 'POST',
        url: 'https://query.wikidata.org/sparql',
        body: 'query=' + encodeURIComponent(query),
        proxy: 'http://10.138.181.7:3128/',
        headers: {
            'accept-language': 'it-IT,it;q=0.9',
            'accept-encoding': 'deflate, br',
            referer: 'https://query.wikidata.org/',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'user-agent': 'Pippo',
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

    // Find the author on wikidata
    return new Promise((resolve, reject) => {
        nodeRequest(requestOptions, (err, res, body) => {
            // Handle error
            if (err) {
                console.error(err);
                reject(err);
            }
            console.log(body)
            resolve(body);
        });
    });
}

function makeWikidataQuery(name, classLabel) {

    // Find the author on wikidata
    return new Promise((resolve, reject) => {
        nodeRequest(authorSearch(name, classLabel), (err, res, body) => {

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
exports.getThings = (index) => composeQuery(getThings(index));
exports.authorOptions = authorOptions;
exports.authorSkip = authorSkip;
exports.authorLink = authorLink;
exports.storeMatching = storeMatching;
exports.storeSkip = storeSkip;