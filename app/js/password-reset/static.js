$(document).ready(() => {

    const urlParams = new URLSearchParams(window.location.search);
    $('#reset-form-type').attr('action', '/api/v1/' + params.userToken + '/reset-password/?reset=' + urlParams.get('reset'));

    $('#reset-form-type').form({
        fields: {
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
            }
        }
    });

    $('#reset-form').submit((e) => {
        e.preventDefault();
        $.ajax({
            url: '/api/v1/' + params.userToken + '/reset-password',
            type: 'POST',
            data: $('#reset-form').serialize(),
            success: (response) => {

                let successMessage = `
                <div class="ui positive message">
                  <div class="header">
                    Controlla il tuo indirizzo e-mail per resettare la tua password
                  </div>
                </div>`;

                let errorMessage = `
                <div class="ui negative message">
                  <div class="header">
                    Questo utente non esiste. Pertanto non è stato possibile resettare la password.
                  </div>
                </div>`;

                if(response.success) $('.container').html(successMessage);
                else $('.container').html(errorMessage);

            }
        });
    })

});