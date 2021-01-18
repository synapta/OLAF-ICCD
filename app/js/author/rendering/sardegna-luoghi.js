// Navbar
function renderNavbar(button = true) {
    $.get('/views/template/arco-places/navbar.html', (template) => {
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

// Render author card
function renderAuthorCard(author){
    $.get('/views/template/arco-places/place-card.html', (template) => {

        // Generate output
        let output = Mustache.render(template, author);
        // Change page title
        document.title = author.name + ' - OLAF';
        // Send output
        $('#author-card').html(output).promise().done(() => {
            $('.ui.accordion').accordion({exclusive:false});
            // Load alternative actions for admin user
            if(user.role === 'admin') {
                $('#send-button').remove();
                $('#skip-author').attr('onclick', 'validateAgent(this, false)')
            }
        });

    });
}

// Render author options
function renderAuthorOptions(options){
    $.get('/views/template/arco-places/place-option.html', (template) => {
        // Render output
        let output = Mustache.render(template, options);
        // Show output
        $('#author-options').html(output).promise().done(() => {
            $('.ui.accordion').accordion();
            $('#loader').fadeOut();
            if(user.role === 'admin'){
                $('.author-selection').attr({
                    onclick: 'validateAgent(this)',
                    id: 'agent-validation'
                }).html('Valida candidato');
            }
        });
    });
}

function renderNoMoreValidations() {
    $.get('/views/template/arco/no-more-validations.html', (template) => {
        $('.container').html(template);
    });
}

function renderNoMoreAgents() {
    $.get('/views/template/arco/no-more-agents.html', (template) => {
        $('.container').html(template);
    });
}