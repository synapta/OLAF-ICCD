const express      = require('express');
const morgan       = require('morgan');
const bodyParser   = require('body-parser');
const session      = require('express-session');
const MongoClient  = require('mongodb').MongoClient;
const MongoStore   = require('connect-mongo')(session);
const passport     = require('passport');
const flash        = require('connect-flash');
const Sentry = require('@sentry/node');

Sentry.init({ dsn: 'https://7aa83fb8ca8f4916ade0edc158040113@debug.synapta.io/23' });

// Setting up express
const app = express();

// The request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());

// Get routes
MongoClient.connect("mongodb://localhost:27017/", (err, client) => {

    let driver = client.db('arco');

    // Require passport serialization rules
    require('./users/arco/passport')(passport, driver);

    // Setting up additional components
    app.use(morgan('common'));
    app.use('/', express.static('./app'));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: false}));
    app.use(session({
        secret: 'synapta',
        resave: true,
        saveUninitialized: true,
        store: new MongoStore({ url: 'mongodb://localhost:27017/arco' }),
    }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(flash());

    if(err)
        require('./routes.js')(app, passport);
    else
        require('./routes.js')(app, passport, driver);

    // Notify server uptime
    let server = app.listen(3646, () => {
        console.log('Server listening at http://localhost:%s', 3646);
    });

});