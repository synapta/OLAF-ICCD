// Validate agent
function validateAgent(el, matching = true) {

    $.ajax({
        type: 'POST',
        url: '/api/v1/' + params.userToken + '/validate-matching/' + encodeURIComponent(author.uri),
        data: {
            option: JSON.stringify(matching ? $(el).closest('.author-option').data().item : null)
        },
        async: true,
        success: (data) => {
            window.location = '/get/' + params.userToken + '/work';
        }
    })

}