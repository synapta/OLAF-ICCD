// Render navbar
function renderNavbar(button = true) {
    $.get('/views/template/author/navbar.html', (template) => {
        let output = Mustache.render(template, {button: button});
        $('.navbar').html(output).promise().done(() => {
            // Show user token
            showUserToken(params.userToken);
            // Append username
            if(user) {
                let username = `<span style="color: black"> - Benvenuto ${user.username}! ${user.role === 'admin' ? '(admin)' : ''}</span>`;
                $('.navbar .header').append(username);
            }
        });
    })
}

// Render modal
function renderModal(){

    $.ajax({
        url: '/get/' + params.userToken + '/modal-text',
        method: 'GET',
        dataType: 'json',
        async: false,
        success: response => {

            let content = `
                <p>${response.message}</p>
            `;

            $('.modal .content').html(content);
            $('.ui.modal').modal('show');

        }
    });
}

// Render verification message
function renderVerificationMessage(){

    // Get queries from url
    let queries = getQueriesFromUrl(window.location.href);

    // Store message
    let message =
        `<div class="ui positive message">
            <i onclick="$(this).parent().remove()" class="close icon"></i>
            <div class="header">
                Hai verificato il tuo account con successo
            </div>
        </div>`;

    if('verified' in queries)
        $('.container').prepend(message);

}

// Render user token
function showUserToken(userToken){
    $('#user-token').html(userToken);
}

// Render author card
function renderAuthorCard(author){
    $.get('/views/template/author/author-card.html', (template) => {

        // Generate output
        let output = Mustache.render(template, author);
        // Change page title
        document.title = author.name + ' - OLAF';
        // Send output
        $('#author-card').html(output).promise().done(() => {
            $('.ui.accordion').accordion({exclusive:false});
        });

    });
}

// Render author options
function renderAuthorOptions(options){
    $.get('/views/template/author/author-options.html', (template) => {
        // Render output
        let output = Mustache.render(template, options);
        // Show output
        $('#author-options').html(output);
        $('.ui.accordion').accordion();
        $('#loader').fadeOut();
    });
}

// Render selected authors
function renderSelectedOptions(el, selected, length){

    // Get class list
    let classList = el.classList;

    // Select or deselect element
    if(!selected) {
        classList.remove('green');
        classList.add('red');
        el.innerHTML = 'Deseleziona elemento';
    } else {
        classList.remove('red');
        classList.add('green');
        el.innerHTML = 'Seleziona elemento';
    }

    // Set count label
    let button = document.getElementById('selected-options-send');
    document.getElementById('selected-options-counter').innerHTML = length;

    // Set button behavior
    if(length > 0) {
        button.classList.add('primary');
        button.classList.remove('disabled');
    } else {
        button.classList.remove('primary');
        button.classList.add('disabled');
    }

}

function renderAuthorMatchesContainer(author, token, selectedOptions, callback){
    $.get('/views/template/author/matches.html', (template) => {

        // Generate container
        let output = Mustache.render(template, {'action': '/api/v1/' + token + '/enrich-author/', 'authorUri': author.uri});
        $('#author-container').html(output);

        // Populate matches options
        $.get('/views/template/author/matches-option.html', (template) => {
            output = Mustache.render(template, {'options': selectedOptions});
            $('#matches-options').html(output);
        });

        // Callback
        callback();

    });
}

function renderAuthorMatches(){

    // Empty object
    let emptyInput = Object.values(selectedFields).every(el => !el.length);

    // Set new button
    $('#send-button').html('<button onclick="authorSend()" id="send-author-matches" class="ui fluid primary button">Conferma assegnazione</button>');
    // Populate matches container
    if(emptyInput) {
        $.get('/views/template/author/matches-selection-empty.html', (template) => {

            // Set button behavior
            $('#send-author-matches').removeClass('primary').addClass('disabled');
            // Set empty template
            let output = Mustache.render(template);
            $('#matches-selection').html(output).promise().done(updateLabelTicks());

        });
    } else {
        $.get('/views/template/author/matches-selection.html', (template) => {

            // Set button behavior
            $('#send-author-matches').addClass('primary').removeClass('disabled');

            // Generate selection map
            let selectionMap = {'selectedFields': []};
            Object.keys(selectedFields).map(key => {
                selectionMap['selectedFields'].push({'label': config.fields[key].label, 'field': key, 'values': selectedFields[key]});
            });

            // Set matches template
            let output = Mustache.render(template, selectionMap);
            $('#matches-selection').html(output).promise().done(updateLabelTicks());

        })
    }

}

function updateLabelTicks() {

    $('.field_selection')
        .removeClass('green')
        .find('i')
        .removeClass('fa-check')
        .addClass('fa-plus');

    // Iterate over each input to toggle check
    Object.keys(selectedFields).forEach((field) => {
        selectedFields[field].map((value) => {
            $('.field_selection[data-field="' + field + '"][data-value="' + value + '" i]')
                .addClass('green')
                .find('i')
                .removeClass('fa-plus')
                .addClass('fa-check');
        })
    });

}

function getSelectionValues(field){

    // Values collection
    let values = [];

    // Extract values from all inputs in the given field
    $('#' + field).find('input').each((index, el) => {
        values.push($(el).val());
    });

    return values;

}

function deleteInput(el, label, value){

    // Remove field
    removeField(label, value);

}

// Lamdas for Mustache rendering

function _decodeHtmlEntities(text) {

    // Decode entities using a fake textarea
    let txt = document.createElement("textarea");
    txt.innerHTML = text;

    return txt.value;

}

function _renderLinkIcon(render, text) {

    // Store rendered text
    let renderedText = render(text);

    // Render link icon in case of link
    if(renderedText.includes('http'))
        return `<a class="wrapper_link" target="_blank" href="${render(text)}"><i class="fas fa-external-link-alt"></i></a>`;

    return ''
}

function _renderImage(render, text) {

    // Store rendered text
    let renderedText = _decodeHtmlEntities(render(text));

    // Render link icon in case of link
    if(renderedText.includes('http') && renderedText.includes('jpg', 'png')) {
        // Parse commons images
        renderedText = renderedText.replace('https://commons.wikimedia.org/wiki/File:', 'https://upload.wikimedia.org/wikipedia/commons/f/fa/');
        // Return styles to render image circle in second page
        return `width: 60px; height: 60px; border-radius: 100%; background-image: url(${renderedText}); background-size: cover; overflow: hidden; color: transparent !important; margin: 0 auto;`;
    }

    return ''

}