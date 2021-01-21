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

let getPlace = (index) => {return `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX arco: <https://w3id.org/arco/ontology/arco/>
PREFIX cis: <http://dati.beniculturali.it/cis/>
PREFIX arco-loc: <https://w3id.org/arco/ontology/location/>
PREFIX clvapit: <https://w3id.org/italia/onto/CLV/>
select ?site
(GROUP_CONCAT(DISTINCT ?match; separator="###") AS ?matches) 
(GROUP_CONCAT(DISTINCT ?skip; separator="###") AS ?skip)
where {
    graph <https://w3id.org/arco/sardegna/data2> {
        ?site a cis:Site .
    }
    MINUS  {
        graph <http://olaf.datipubblici.org/olaf/sameAs/Sardegna/Sites> {?site skos:closeMatch ?anothersite}
      }
      MINUS  {
        graph <http://olaf.datipubblici.org/olaf/sameAs/Sardegna/Sites> {?site a <https://olaf.datipubblici.org/olaf/SkippedEntity>}
      }
      OPTIONAL {
        GRAPH ?g {
          ?site skos:related ?statement .
          ?statement foaf:maker/foaf:mbox_sha1sum ?user .
          OPTIONAL {
            ?statement skos:relatedMatch ?target .
          }
          BIND(IF(BOUND(?target), ?user, "") AS ?match)
          BIND(IF(BOUND(?target), "", ?user) AS ?skip)
        } filter (str(?g)="http://olaf.datipubblici.org/olaf/statements")
    }
} 
GROUP BY ?site
LIMIT 10000
OFFSET ${index*10000}
`};

let authorSelect = (authorId) => {
    return `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX arco: <https://w3id.org/arco/ontology/arco/>
PREFIX cis: <http://dati.beniculturali.it/cis/>
PREFIX arco-loc: <https://w3id.org/arco/ontology/location/>
PREFIX clvapit: <https://w3id.org/italia/onto/CLV/>

select 
    ?site 
    (SAMPLE(?sitelabel) as ?sitelabel ) 
    (SAMPLE(?addr) as ?addr ) 
    (SAMPLE(?prov) as ?prov ) 
    (SAMPLE(?region) as ?regione ) 
    (SAMPLE(?city) as ?city )
    (GROUP_CONCAT(DISTINCT(?thingName); separator="$$$") as ?thingsName ) 
where {
    graph <https://w3id.org/arco/sardegna/data2> {
        VALUES ?site {
            <${authorId}>
        }
        ?site a cis:Site ;
            rdfs:label ?sitelabel .
        OPTIONAL { 
            ?site       cis:siteAddress ?add.
            ?add  	clvapit:fullAddress ?addr.
            OPTIONAL { ?add clvapit:hasCity/rdfs:label ?city.}
            OPTIONAL { ?add clvapit:hasProvince/rdfs:label ?prov .}
        }
        OPTIONAL {
            ?thing arco-loc:hasTimeIndexedTypedLocation/arco-loc:atSite ?site .
            ?thing rdfs:label ?thingName .
        }
        BIND("Sardegna" as ?region)
    }
    FILTER (STR(?sitelabel) != "Contenitore fisico") 
}
GROUP BY ?site
LIMIT 20`;
    
};

let getICCDplaces = () => {
    return `PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX arco: <https://w3id.org/arco/ontology/arco/>
    PREFIX cis: <http://dati.beniculturali.it/cis/>
    PREFIX arco-loc: <https://w3id.org/arco/ontology/location/>
    PREFIX clvapit: <https://w3id.org/italia/onto/CLV/>
    PREFIX l0: <https://w3id.org/italia/onto/l0/>
    select ?place 
    (SAMPLE(?siteLabel) as ?siteLabel) 
    (SAMPLE(?desc) as ?desc) 
    (SAMPLE(?tipo) as ?tipo) 
    (SAMPLE(?image) as ?image) 
    (SAMPLE(?addr) as ?addr) 
    (SAMPLE(?comune) as ?comune) 
    (SAMPLE(?region) as ?regione) 
    (SAMPLE(?provincia) as ?provincia) 
    where {
        graph <http://dati.beniculturali.it/mibact/luoghi> {
            ?place a cis:CulturalInstituteOrSite .
            ?place rdfs:label ?siteLabel  .
            OPTIONAL {?place dc:type ?tipo .}
            OPTIONAL { ?place l0:description ?desc .}
            ?place cis:hasSite ?site .
            ?site cis:siteAddress ?add .
            ?add clvapit:fullAddress ?addr.
            ?add clvapit:hasCity/rdfs:label ?comune .
            ?add clvapit:hasProvince/rdfs:label ?provincia .
            ?add clvapit:hasRegion <http://dati.beniculturali.it/mibact/luoghi/resource/Region/Sardegna> .
            FILTER (lang(?siteLabel) = 'it')
            FILTER (lang(?desc) = 'it')
            OPTIONAL { ?place foaf:depiction ?image }
            BIND("Sardegna" as ?region)
      }
    } 
    GROUP BY ?place`;

};

function insertMatchStatement(item, user, target, graph) {

    let statementURI = "http://olaf.datipubblici.org/"+ encodeURIComponent(item) + "/" + shasum(user._id) + "/" + Math.floor(new Date() / 1000);
    let userURI = "http://olaf.datipubblici.org/users/" + shasum(user._id);

    return `INSERT INTO <${graph}> {
        <${item}> <http://www.w3.org/2004/02/skos/core#related> <${statementURI}> .
        <${statementURI}> a rdf:Statement .
        <${statementURI}> <http://schema.org/dateCreated> "${(new Date()).toISOString()}"^^xsd:dateTimeStamp .
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
            <${item}> skos:closeMatch <${target}>
        }
    `;

}

function insertSkipValidation(item,graph) {

    return `INSERT INTO <${graph}>  {
            <${item}> a <https://olaf.datipubblici.org/olaf/SkippedEntity>
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

    return [enrichments.storeMatching(driver, user, option.hash, agent), makeWriteQuery(composeWriteQuery(insertMatchStatement(agent, user, option.uri, "http://olaf.datipubblici.org/olaf/statements")))];

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
        url: 'https://arco.datipubblici.org/sparql',
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
exports.getPlaces = (index) => composeQuery(getPlace(index));
exports.getICCDplaces = () => composeQuery(getICCDplaces());
exports.authorOptions = authorOptions;
exports.authorSkip = authorSkip;
exports.authorLink = authorLink;
exports.storeMatching = storeMatching;
exports.storeSkip = storeSkip;