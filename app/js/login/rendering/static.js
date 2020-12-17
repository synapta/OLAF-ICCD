// Append a redirect path to each login form if needed
function renderRedirectInput(){

    // Get queries from url
    let queries = getQueriesFromUrl(window.location.href);

    if('redirect' in queries)
        $('#login-form, #signup-form').append(`<input type="hidden" name="redirect" value="${queries.redirect}" />`)

}

// Display error message during login
function renderErrorMessage(){

    // Get queries from url
    let queries = getQueriesFromUrl(window.location.href);

    if('message' in queries) {
        $('#login-error').find('.header').html(queries.message);
        $('#login-error').show();
    }

}

// Set up form behavior

// New rule for already existing users
$.fn.form.settings.rules.userAlreadyExists = (username) => {

    let exists = false;

    $.ajax({
        async : false,
        url: '/api/v1/arco/username-existence/' + username,
        type: 'GET',
        success: (result) => {
             exists = result.exists;
        }
    });

    return !exists;

};

$.fn.form.settings.rules.emailAlreadyExists = (email) => {

    let exists = false;

    $.ajax({
        async : false,
        url: '/api/v1/arco/email-existence/' + email,
        type: 'GET',
        success: (result) => {
            exists = result.exists;
        }
    });

    return !exists;

};

function setFormBehavior(){

    $('#signup-form').form({
        fields: {
            email: {
                identifier: 'email',
                rules: [{
                    type: 'email',
                    prompt: 'Please enter a valid email address.'
                }, {
                    type: 'emailAlreadyExists[email]',
                    prompt: 'This email address already exists.'
                }]
            },
            password: {
                identifier: 'password',
                rules: [{
                    type: 'empty',
                    prompt: 'Please enter a valid password.'
                }, {
                    type: 'match[retype-password]',
                    prompt: 'Passwords must match.'
                }]
            },
            "retype-password": {
                identifier: 'retype-password',
                rules: [{
                    type: 'empty',
                    prompt: 'Please re-enter a valid password.'
                }]
            },
            username: {
                identifier: 'username',
                rules: [{
                    type: 'empty',
                    prompt: 'Please enter a valid username.'
                }, {
                    type: 'userAlreadyExists[username]',
                    prompt: 'This username is already taken'
                }]
            }
        }
    })

}