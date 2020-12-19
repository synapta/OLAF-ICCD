const arcoMailer = require('../arco/mailer');

Object.keys(arcoMailer).forEach(method => {
    exports[method] = arcoMailer[method];
});