const arcoUser = require('../arco/users');

Object.keys(arcoUser).forEach(method => {
    exports[method] = arcoUser[method];
});