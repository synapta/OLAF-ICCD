// Get author, render author card, options and author labels
$(document).ready(() => {
    // Load alternative scripts
    _loadAlternativeScripts(() => {

        // Render navbar
        renderNavbar(false);

        // Render redirect input
        renderRedirectInput();
        renderErrorMessage();

        // Set form behavior
        setFormBehavior();

    });
});