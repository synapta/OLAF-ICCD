// Author object
let author = null;
let options = [];

// Load configuration
let config = null;

// Extract and store params from url
let params = parseUrl(window.location.href, {'userToken': 4, 'authorId': 6});

// Store logged user
let user = null;

// Selection and matching
let selectedOptions = {};
let selectedFields = {};

function _fileExists(url) {

    let http = new XMLHttpRequest();

    http.open('HEAD', url, false);
    http.send();

    return http.status !== 404;

}

function _loadAlternativeScripts(callback) {

    [`/js/author/rendering/${params.userToken}.js`,
        `/js/author/${params.userToken}.js`].forEach(url => {

        // Generate new <script> and populate it with user alternative scripts
        let s = document.createElement("script");

        if(_fileExists(url)){
            s.type = "text/javascript";
            s.src = url;
            $("head").append(s);
        }

    });

    callback();

}

function _getAllSelectableFields() {
    return Object.keys(config.fields).filter(el => config.fields[el].select && !config.fields[el].composite);
}

function authorSelect(el){

    let dataset = el.parentElement.dataset;
    let optionString = dataset.item;
    let optionHash = dataset.hash;

    // Parse item
    let option = JSON.parse(optionString);
    let selected = null;

    // Toggle option selection
    if(optionHash in selectedOptions){

        // Toggle selection flag
        selected = true;
        // Delete current selected option
        delete selectedOptions[optionHash];

    } else {

        // Check selection limit
        if(config.limit && Object.keys(selectedOptions).length >= config.limit) {
            alert('Sono stati selezionati troppi autori.');
            return;
        }

        // Toggle selection flag
        selected = false;
        // Store current selected option
        selectedOptions[optionHash] = option;

    }

    // Match author
    authorMatch();

}

function authorMatch(){

    if(config.interlinking){

        // Store matching
        $.ajax({
            type: 'POST',
            url: '/api/v1/' + params.userToken + '/enrich-author/',
            async: true,
            data: {
                option: JSON.stringify(Object.values(selectedOptions)[0]),
                agent: author.uri
            },
            success: (data) => {
                window.location = '/get/' + params.userToken + '/author'
            }
        })

    } else {

        // Initial field selection
        if (config.selection) {

            // Get selection fields from config
            let fieldsConfig = config.fields;
            let selectionFields = _getAllSelectableFields();
            let targets = null;

            // Select targets from which import the data
            if (config.selection === 'left')
                targets = [author];
            else
                targets = Object.values(selectedOptions);

            // Populate selection with selection fields
            targets.forEach(target => {
                selectionFields.forEach(field => {

                    // Check if field is empty and initialize it
                    if (!selectedFields[field])
                        selectedFields[field] = [];

                    // Append current field to selected fields collection
                    if (target[field] && !selectedFields[field].includes(target[field])) {
                        if (Array.isArray(target[field]))
                            selectedFields[field] = selectedFields[field].concat(target[field]);
                        else
                            selectedFields[field].push(target[field]);
                    }

                    // Slice limited fields
                    if (fieldsConfig[field].limit)
                        selectedFields[field] = selectedFields[field].slice(0, fieldsConfig[field].limit);

                })
            })

        }

        // Render author matching container
        renderAuthorMatchesContainer(author, params.userToken, Object.values(selectedOptions), () => {
            renderAuthorMatches();
        });

    }
}

function groupSelectionLabels(){

    // Initialize grouping object
    let groupedFields = {};

    _getAllSelectableFields().forEach((key) => {

        // Store group for each field
        let field = key;
        let group = config.fields[key].group;

        // Group available fields
        if(group) {
            if (!groupedFields[group])
                groupedFields[group] = [field];
            else
                groupedFields[group].push(field);
        }

    });

    return groupedFields;

}

function groupSelectionFields(){

    // Initialize grouping objects
    let groupedLabels = groupSelectionLabels();
    let groupedFields = {};

    // Concat options
    let choices = [author].concat(Object.values(selectedOptions));

    // Initialize grouping
    Object.keys(groupedLabels).forEach((group) => {

        // Initialize grouping objects
        groupedFields[group] = [];
        // Iterate over grouped fields
        groupedLabels[group].forEach((field) => {

            // Check if field is composite
            let dictionaryLabel = config.fields[field].label;

            // Generate field object
            let fieldObject = {'label': field, 'dictionary': dictionaryLabel, 'values': []};

            // Iterate over options
            choices.forEach((choice) => {
                fieldObject.values.push({
                    'field': field,
                    'value': choice[field],
                    'parseLink': () => {
                        return (text, render) => {
                            return _renderLinkIcon(render, text);
                        }
                    },
                    'parseImage': () => {
                        return (text, render) => {
                            return _renderImage(render, text)
                        }
                    }
                });
            });

            // Append field object
            groupedFields[group].push(fieldObject);

        });

    });

    return groupedFields;

}

function matchField(label, value){

    // Store fields configuration
    let fieldsConfig = config.fields;

    // Toggle field selection
    if(selectedFields[label]) {
        if (selectedFields[label].map(item => item.toLowerCase()).includes(value.toLowerCase())) {
            if(config.matching === 'toggle')
                selectedFields[label] = selectedFields[label].filter(item => item.toLowerCase() !== value.toLowerCase());
            else
                sendFeedback(label, value);
        }else
            selectedFields[label].unshift(value);
    } else {
        selectedFields[label] = [];
        selectedFields[label].unshift(value);
    }

    // Evaluate current array limit
    Object.keys(selectedFields).forEach((field) => {

        // Get parent field limit
        let parentField = Object.keys(config.fields).filter(el => field.indexOf(el) === 0)[0];

        // Parse field limit
        if (fieldsConfig[field] && fieldsConfig[parentField].limit)
            selectedFields[field] = selectedFields[field].slice(0, fieldsConfig[parentField].limit);

    });

    // Render author matches
    renderAuthorMatches();

}

function addNewField(field){

    // Store fields configuration
    let fieldsConfig = config.fields;

    // Add new input to selection list
    if(!selectedFields[field])
        selectedFields[field] = [];

    // Store current collection in field selection
    selectedFields[field] = getSelectionValues(field);
    // Append empty selection
    selectedFields[field].unshift("");

    // Slice current collection
    // Evaluate array limit
    Object.keys(selectedFields).forEach((field) => {
        if(fieldsConfig[field] && fieldsConfig[field].limit)
            selectedFields[field] = selectedFields[field].slice(0, fieldsConfig[field].limit);
    });

    renderAuthorMatches();

}

function removeField(label, field){

    if(label) {
        if (selectedFields[label].map(field => field.toLowerCase()).includes(field.toLowerCase())) {
            selectedFields[label] = selectedFields[label].filter((item) => {
                return item.toLowerCase() !== field.toLowerCase();
            })
        }
    }

}

function authorSkip() {

    // API call
    $.ajax({
        url: '/api/v1/' + params.userToken + '/author-skip/',
        method: 'POST',
        data: {'authorId': $('#skip-author').data('identifier')},
        dataType: 'json',
        success: response => {
            if(response.status === 'success') {
                // Store last action in session
                sessionStorage.setItem("action", "skip");
                // Reload page
                location.href = '/get/' + params.userToken + '/author';
            } else
                alert("Errore");
        }
    });

}

function authorSend(){

    // Store last action in session
    sessionStorage.setItem("action", "match");
    // Send form
    document.getElementById('matches-form').submit();

}

// Get author, render author card, options and author labels
$(document).ready(() => {

    let href = window.location.href;
    if(!(href.includes('login') || href.includes('user') || href.includes('reset-password'))) {
        // Load alternative scripts
        _loadAlternativeScripts(() => {
            $.get('/api/v1/' + params.userToken + '/logged-user', (loggedUser) => {

                // Store logged user
                if (loggedUser)
                    user = loggedUser.user;

                // Render navbar
                renderNavbar();
                renderVerificationMessage();

                // Load configuration
                $.get(`/api/v1/${params.userToken}/config/`, (json) => {

                    // Store config
                    config = json;

                    // Store cache toggle parameter
                    let urlParams = new URLSearchParams(window.location.search);
                    let cache = urlParams.get('cache');

                    let authorUrl = '/api/v1/' + params.userToken + '/author/' + (params.authorId ? params.authorId : '');
                    if(cache) authorUrl += ('?cache=' + cache);

                    // Get current author and its options
                    $.ajax({

                        url: authorUrl,
                        method: 'GET',
                        dataType: 'json',
                        success: response => {

                            if (response.error) {
                                renderNoMoreAgents()
                                return;
                            }

                            if(!response.author && !response.options && user.role === 'admin'){
                                $.ajax({
                                    url: authorUrl.includes('?') ? authorUrl + '&role=user' : authorUrl + '?role=user',
                                    method: 'GET',
                                    dataType: 'json',
                                    async: false,
                                    success: newResponse => {
                                        response = newResponse;
                                    }
                                });
                            }

                            // Store author response
                            author = response.author;
                            options = response.options;

                            // Rewrite url based on agent uri in order to improve sharing

                            window.history.pushState("", "", '/get/' + params.userToken + '/' + window.location.href.split('/')[5] + '/' + encodeURIComponent(author.uri));

                            //set skip button
                            $('#skip-author').data('identifier', author.uri);

                            // Render author card
                            renderAuthorCard(author);
                            // Render author options
                            renderAuthorOptions({'options': options});

                            // Check empty response
                            if (options.length === 0) {
                                alert('Non sono presenti match per questo elemento.');
                                authorSkip(author.uri);
                            }

                        }
                    });
                });

            });

        });
    }

});