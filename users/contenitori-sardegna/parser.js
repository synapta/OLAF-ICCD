// Requirements
const fuzz           = require('fuzzball');

const Option         = require('../../option').Option;
const Thing         = require('../../thing').Thing;

// Configuration
let config           = null;

/**
 * Initialize module with user configuration
 * **/
function configInit(configObj) {
    config = configObj;
}

/**
 * Parse author response in order to obtain OLAF author object
 * **/
function parseAuthor(body){

    // Map Cobis result to standard format
    let binding = body.results.bindings[0];
    let parsedBody = {};

    Object.keys(binding).map((key) => {

        if(binding[key].value.includes('$$$'))
            binding[key].value = binding[key].value.split('$$$');

        parsedBody[key] = binding[key].value

    });

    return new Thing(parsedBody, config);
}

function getAuthorSimilarOptions(author, options, callback){

    // Parse all options
    options.forEach((option) => {
        if(author.titles && author.titles.length > 0 && option.titles) {

            // Handle non-array titles
            if (!Array.isArray(author.titles))
                author.titles = [author.titles];

            // Similar authors collection and count
            let similarTitles = [];
            let similarCount = 0;

            // Match with author titles
            option.titles.forEach((title) => {
                if(title.length > 0){

                    // Clean title and make a 0.8 cutoff comparison between titles
                    let results = fuzz.extract(title.replace(/[0-9]+ \~ /, ''), author.titles, {
                        scorer: fuzz.token_set_ratio,
                        cutoff: 80
                    });

                    // Count similar results
                    let isSimilar = results.map((result) => result.length > 0).some(() => true);
                    similarTitles.push(isSimilar);
                    similarCount = similarCount + isSimilar;

                }
            });

            if(similarCount > 0) {

                // Set current option as suggest
                option.setOptionAsSuggested(similarCount);

                // Highlight similar titles
                option.titles.forEach((title, index) => {
                    if(similarTitles[index])
                        option.titles[index] = '<b>' + title + '</b>';
                });

                // Order title by highlighting
                option.titles = option.titles.sort((a, b) => b.includes('<b>') - a.includes('<b>'));

            }

        }
    });

    options = options.sort((a, b) => (b.suggested - a.suggested));
    // Callback suggested options
    callback(options);

}

/**
 * Extract feasible options for current author.
 * Compare Wikidata results and VIAF results in order to remove duplicates.
 * **/
function parseAuthorOptions(author, bodies, callback) {

    // Store bodies
    let wikidataBody = bodies[0];
    let viafBody = bodies[1];

    let wikidataOptions = [];
    let viafOptions = [];

    // Get wikidata options
    if('results' in wikidataBody)
        wikidataOptions = parseWikidataOptions(wikidataBody);

    let options = wikidataOptions.concat(viafOptions);

    // Enrich all options with VIAF and return them
    Promise.all(options.map(el => el.enrichObjectWithViaf())).then(() => {
        options.map(el => el.getString());
        // Suggested author must be set here
        callback(options);
    });

}

function parseWikidataOptions(body) {

    // Parse results
    let results = body.results.bindings;

    // Construct options from query results
    return results.map(el => new Option(el, 'wikidata', config));

}

function mergeOptionsAndMatches(options, matches) {

    let hashOptionMap = {};

    // Count each option match
    if (options) {
        options.map((option) => {
            option.matches = 0;
            hashOptionMap[option.hash] = option
        });

        for (let match of matches) {

            if (hashOptionMap.hasOwnProperty(match.option))
                hashOptionMap[match.option].matches = hashOptionMap[match.option].matches + 1;
        }
        //console.log(JSON.stringify(hashOptionMap, null, 2)
        // Sort options by match
        options.sort((a, b) => b.matches - a.matches);
    }

}

// Exports
exports.parseAuthor             = parseAuthor;
exports.parseAuthorOptions      = parseAuthorOptions;
exports.configInit              = configInit;
exports.mergeOptionsAndMatches  = mergeOptionsAndMatches;
exports.config                  = config;