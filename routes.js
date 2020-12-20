// Requirements
const nodeRequest    = require('request');
const promiseRequest = require('request-promise');
const fs             = require('fs');
const schedule       = require('node-schedule');
const Config         = require('./config').Config;

// Modules
let queries          = null;
let parser           = null;
let auth             = null;
let config           = null;
let configToken      = null;
let mailer           = null;
let enrichments      = null;

// Token validation
function validateToken(token) {

    // Get valid tokens
    let validTokens = ['arco', 'arco-things', 'sardegna', 'sardegna-luoghi', 'sardegna-contenitori'];

    // Check if token is valid
    return validTokens.includes(token);

}


let messages = {};

messages.messageAutoriCrowdSource = `
<p>
    OLAF (Open Linked Authority File) è un’<b>interfaccia di crowdsourcing</b>che consente di associare gli autori delle opere del Catalogo Generale dei Beni Culturali alle entità presenti su Wikidata e in altre fonti della <b>Linked Open Data cloud</b> connesse a Wikidata.  
</p>
<br>
<p>
    <b>Come funziona?</b>
</p>
<p>
    OLAF raccoglie in input i dati sugli autori dal database del Catalogo generale dei beni culturali, ed acquisisce in automatico le informazioni esposte sul Web da banche dati esterne (come Wikidata e VIAF).  
    <b>L’interfaccia propone agli utenti registrati di selezionare, tra un ventaglio di uno o più candidati, l’entità di Wikidata più idonea all’associazione,</b> in questo modo:
    <ul>
        <li>
            la scheda “Autore” (sulla sinistra dello schermo, con le etichette di color blu) visualizza i dati dell’ICCD.
            Le seguenti informazioni vengono reperite dall’endpoint SPARQL del progetto ArCo (dati.beniculturali.it/sparql): nome, date autore (il campo può indicare le date di nascita e morte o, più in generale, riferirsi al periodo di attività), numero, titolo, date, tecniche e materiali delle opere presenti nel Catalogo Generale
        </li>
        <li>
            le schede “Candidato”  (sulla parte destra dello schermo, con le etichette di color rosso) visualizzano i dati provenienti dalla Linked Open Data cloud. 
            Le seguenti informazioni sono reperite tramite una serie di interrogazioni alle banche dati di Wikidata e VIAF: nome, descrizione, date di nascita e morte, elenco opere, professione, link alla pagina dell’autore in altri authority file e progetti.
        </li>
    </ul>
</p>
<p>
    <b>Puoi suggerire un’associazione</b> rapidamente, confrontando i dati dei candidati sulla destra con quelli presenti nel Catalogo dell’ICCD (sulla sinistra). Per una ulteriore <b>verifica delle fonti</b>, puoi:
    <ul>
        <li>
            cliccare sul nome dell’autore nella scheda ICCD (sulla sinistra), e visualizzare i dati del Catalogo Generale dei Beni Culturali, secondo lo standard RDF
        </li>
        <li>
            cliccare sui tag azzurri della sezione “Esplora in”, e aprire le pagine dei candidati presenti in banche dati esterne (come Wikidata, VIAF, Wikipedia, Getty Research Institute e le categorie di immagini di Wikimedia Commons).
        </li>
    </ul>
    Se individui il candidato giusto clicca su “Seleziona il candidato”; se non ci sono candidati idonei, clicca su <b>“Salta”</b>.
</p>
<p>
    <b>Che cosa succede dopo?</b>
</p>
<p>
    OLAF è un’interfaccia di crowdsourcing: i dati generati dagli utenti vengono inviati all’ICCD e sottoposti a un processo di validazione scientifica. Dopo la validazione, le associazioni vengono salvate definitivamente nel database del Catalogo (tecnicamente, per ogni autore con un’associazione confermata viene creata una relazione di identità, tramite la property owl:sameAs, che lo collega alla corrispondente entità di Wikidata, indicando che si tratta dello stesso concetto).
</p>
<p>
    Queste associazioni ci consentono di arricchire il portale del Catalogo Generale dei Beni Culturali con le informazioni provenienti da fonti esterne interconnesse: la colonna destra delle pagine degli autori (“dalla rete”) è infatti alimentata da fonti esterne, e le risorse <b>recuperate in tempo reale sfruttando le tecnologie Linked Open Data</b>.
</p>`;

messages.messageAutoriValidazione = `
<p>
    Stai utilizzando il profilo per la <b>validazione scientifica</b> di OLAF (Open Linked Authority File), l’interfaccia di crowdsourcing che consente di associare gli autori delle opere del Catalogo Generale dei Beni Culturali alle entità presenti su Wikidata e in altre fonti della <b>Linked Open Data cloud</b> connesse a Wikidata.  
</p>
<p>
    <b>Come funziona?</b>
</p>
OLAF ti propone, prima, i risultati del crowdsourcing effettuato dagli utenti del portale.
Per ogni autore del database dell’ICCD (scheda “Autore” sulla sinistra dello schermo, con le etichette di color blu), OLAF ti propone di selezionare l’entità di Wikidata più idonea all’associazione. I candidati già selezionati dagli utenti sono contraddistinti da un’etichetta blu con la scritta “Selezionato da TOT utenti”.
<b>Per validare definitivamente l’associazione</b> tra ICCD e Wikidata, clicca su “<b>Valida il candidato</b>”; se non ci sono candidati idonei, clicca su “Salta”. Puoi decidere di validare i candidati suggeriti dagli utenti, oppure altri candidati suggeriti da OLAF.
Una volta terminati i suggerimenti degli utenti, <b>puoi proseguire a usare OLAF</b> con il profilo di validazione scientifica su nuovi candidati, e <b>validare direttamente le associazioni</b> con i candidati che ritieni idonei. (Leggi il paragrafo successivo!)  
</p>
<p>
    <b>Che cosa succede dopo?</b>
</p>
<p>
    Dopo la validazione, le associazioni <b>vengono salvate nel database dell’ICCD</b> (tecnicamente, per ogni autore con un’associazione confermata viene creata una relazione di identità, tramite la property owl:sameAs, che lo collega alla corrispondente entità di Wikidata, indicando che si tratta dello stesso concetto).
    Queste associazioni ci consentono di <b>arricchire il portale del Catalogo Generale dei Beni Culturali con le informazioni provenienti da fonti esterne interconnesse</b>: la colonna destra delle pagine degli autori (“dalla rete”) è infatti alimentata da fonti esterne, e le risorse <b>recuperate in tempo reale sfruttando le tecnologie Linked Open Data</b>.
</p>
<p>`;

messages.messageOpereCrowdSource = `
<p>
    OLAF (Open Linked Authority File) è un’<b>interfaccia di crowdsourcing</b> che consente di associare le opere del Catalogo Generale dei Beni Culturali alle entità presenti su Wikidata e in altre fonti della <b>Linked Open Data cloud</b> connesse a Wikidata.  
</p>
<p>
    <b>Come funziona?</b>
</p>
<p>
    OLAF raccoglie in input i dati sulle opere dal database dell’ICCD, ed acquisisce in automatico le informazioni esposte da Wikidata.
    Data l’eterogeneità di titoli e soggetti delle opere, per migliorare l’efficacia del tool e trovare candidati idonei OLAF raccoglie dall’ICCD solo i dati del seguente sottoinsieme di opere: schede OA e, più in generale, schede di beni immobili.
    L’interfaccia propone agli utenti di selezionare, tra un ventaglio di uno o più candidati, l’entità di Wikidata più idonea all’associazione. In questo modo:
    <ul>
        <li>
            la scheda “Dettagli opera” (sulla sinistra dello schermo, con le etichette di color blu) visualizza i dati dell’ICCD. Le seguenti informazioni vengono reperite dall’endpoint SPARQL del progetto ArCo (dati.beniculturali.it/sparql): titolo, descrizione, tipologia, date, materiali e luogo di conservazione
        </li>
        <li>
            le schede “Candidato”  (sulla parte destra dello schermo, con le etichette di color rosso) visualizzano le medesime informazioni dei candidati provenienti da Wikidata.
        </li>
    </ul>
</p>
<p>
<b>Puoi suggerire un’associazione</b> confrontando i dati dei candidati sulla destra con quelli presenti nel Catalogo dell’ICCD (sulla sinistra). Per una ulteriore <b>verifica delle fonti</b>, puoi:
    <ul>
        <li>
            cliccare sul titolo dell’opera nella scheda ICCD (sulla sinistra), e visualizzare i dati del <b>Catalogo Generale dei Beni Culturali</b> secondo lo standard RDF
        </li>
        <li>
            cliccare sui tag azzurri della sezione “Esplora in”, e aprire le pagine su Wikidata dei candidati o la relativa categoria di immagini di Wikimedia Commons
        </li>
    </ul>
</p>
<p>
    Se individui il candidato giusto clicca su “<b>Seleziona il candidato</b>”; se non ci sono candidati idonei, clicca su “<b>Salta</b>”.
</p>
<p>
    <b>Che cosa succede dopo?</b>
</p>
<p>
    OLAF è un’interfaccia di crowdsourcing: i dati generati dagli utenti vengono inviati all’ICCD e sottoposti a un processo di <b>validazione scientifica</b>. Dopo la validazione, le associazioni vengono salvate definitivamente nel database dell’ICCD (tecnicamente, per ogni opera con un’associazione confermata viene creata una relazione di identità, tramite la property owl:sameAs, che la collega alla corrispondente entità di Wikidata, indicando che si tratta dello stesso concetto).
</p>
<p>
    Queste associazioni ci consentono di <b>arricchire il portale del Catalogo Generale dei Beni Culturali con le informazioni provenienti da fonti esterne interconnesse</b>: la colonna destra delle pagine delle opere (“dalla rete”) è infatti alimentata da fonti esterne, e le risorse <b>recuperate in tempo reale sfruttando le tecnologie Linked Open Data</b>.
</p>`;

messages.messageOpereValidazione = `
<p>
    Stai utilizzando il <b>profilo per la validazione scientifica</b> di OLAF (Open Linked Authority File), l’interfaccia di crowdsourcing che consente di associare le opere del Catalogo Generale dei Beni Culturali alle entità presenti su Wikidata e in altre fonti della <b>Linked Open Data cloud</b> connesse a Wikidata.  
</p>
<p>
    <b>Come funziona?</b>
</p>
<p>
    OLAF ti propone, prima, i risultati del crowdsourcing effettuato dagli utenti del portale.
    Per ogni opera del database dell’ICCD (scheda “Autore” sulla sinistra dello schermo, con le etichette di color blu), OLAF ti propone di selezionare l’entità di Wikidata più idonea all’associazione. I candidati già selezionati dagli utenti sono contraddistinti da un’etichetta blu con la scritta “Selezionato da TOT utenti”.
</p>
<p>
<b>Per validare definitivamente l’associazione tra ICCD e Wikidata</b>, clicca su “<b>Valida il candidato</b>”; se non ci sono candidati idonei, clicca su “<b>Salta</b>”. Puoi decidere di validare i candidati suggeriti dagli utenti, oppure altri candidati suggeriti da OLAF.
    Una volta terminati i suggerimenti degli utenti, <b>puoi proseguire a usare OLAF con il profilo di validazione scientifica su nuovi candidati</b>, e <b>validare direttamente le associazioni</b> con i candidati che ritieni idonei. (Leggi il paragrafo successivo!)  
</p>
<p>
    <b>Che cosa succede dopo?</b>
</p>
<p>
    Dopo la validazione, le associazioni <b>vengono salvate nel database dell’ICCD</b> (tecnicamente, per ogni opera con un’associazione confermata viene creata una relazione di identità, tramite la property owl:sameAs, che lo collega alla corrispondente entità di Wikidata, indicando che si tratta dello stesso concetto).
    Queste associazioni ci consentono di <b>arricchire il portale del Catalogo Generale dei Beni Culturali con le informazioni provenienti da fonti esterne interconnesse</b>: la colonna destra delle pagine delle opere (“<b>dalla rete</b>”) è infatti alimentata da fonti esterne, e le risorse <b>recuperate in tempo reale sfruttando le tecnologie Linked Open Data</b>.
</p>`;

function loginToken(token) {

    // Get tokens that need login
    let loginTokens = ['arco', 'arco-things', 'sardegna', 'sardegna-luoghi','sardegna-contenitori'];

    // Check if current token need login
    return loginTokens.includes(token);

}

function loggingFlow(url) {

    // Get allowed login url
    let allowedUrl = [

        /* API */
        '/api/v1/:token/login',
        '/api/v1/:token/signup',
        '/api/v1/:token/verify-user',
        '/api/v1/:token/username-existence',
        '/api/v1/:token/email-existence',
        '/api/v1/:token/logged-user',
        '/api/v1/:token/feed-enrichments',
        '/api/v1/:token/author',
        '/api/v1/:token/get-agents',
        '/api/v1/:token/update-documents',
        '/api/v1/:token/logged-user',
        '/api/v1/:token/blank-documents',
        '/api/v1/:token/store-things',
        '/api/v1/:token/reset-password',

        /* Frontend */
        '/get/:token/login',
        '/get/:token/user-verification',
        '/get/:token/reset-password'

    ];

    // Replace placeholder with current token
    allowedUrl = allowedUrl.map((el) => el.replace(':token', configToken));

    return allowedUrl.map((el) => url.includes(el)).some((el) => el);

}

/* Routines setup */
let routines = false;
function setupRoutines(driver) {
    if(driver) {
        schedule.scheduleJob('*/1 * * * *', (fireDate) => {
            enrichments.deleteValidated(driver, () => {
                console.log(fireDate, "Removed validated elements");
                enrichments.resetLocks(driver, () => {
                    console.log(fireDate, "Reset locks");
                });
            });
        });
    }
}

module.exports = function(app, passport = null, driver = null) {

    /* Token middleware */
    app.all(['/api/v1/:token/*', '/get/:token/*'], (request, response, next) => {

        // Get token
        let token = request.params.token;

        // Validate token
        if (validateToken(token)) {

            // Load user config and routines once
            if(!config || token !== configToken) {
                config = new Config(JSON.parse(fs.readFileSync(`./app/js/config/${token}.json`)));
                configToken = token;
                if(!routines) {
                    routines = true;
                    setupRoutines(driver);
                }
            }

            // Load modules
            queries = require('./users/' + token + '/queries');
            parser = require('./users/' + token + '/parser');
            if(loginToken(token)) {
                require('./users/' + token + '/passport')(passport, driver);
                auth = require('./users/' + token + '/users');
                mailer = require('./users/' + token + '/mailer');
                enrichments = require('./users/' + token + '/enrichments');
            }

            // Initialize configuration
            parser.configInit(config);

            // Next route
            if(loginToken(token) && !request.user && !loggingFlow(request.originalUrl))
                response.redirect('/get/' + token + '/login?redirect=' + request.originalUrl);
            else
                next();

        } else {

            // Set not allowed response
            response.status(403);
            response.send('Not allowed to read this resource.');

        }

    });

    /* Serve app frontend */
    app.get(['/get/:token/author/', '/get/:token/authorityfile/', '/get/:token/author/:authorId', '/get/:token/authorityfile/:authorId',  '/get/:token/work/', '/get/:token/work/:authorId', '/get/:token/place/', '/get/:token/place/:authorId'], (request, response) => {
        response.sendFile('author.html', {root: __dirname + '/app/views'});
    });

    app.get('/get/:token/login', (request, response) => {
        response.sendFile('login.html', {root: __dirname + '/app/views'});
    });

    app.get('/get/:token/reset-password', (request, response) => {
        if(request.query.reset) response.sendFile('reset-password.html', {root: __dirname + '/app/views'});
        else response.sendFile('reset-password-email.html', {root: __dirname + '/app/views'})
    });

    app.get('/get/:token/user-verification', (request, response) => {
        response.sendFile('user-verification.html', {root: __dirname + '/app/views'});
    });

    app.get('/get/:token/author-list/', (request, response) => {
        if (request.params.token === 'beweb') {
            response.sendFile('author-list.html', {root: __dirname + '/app/views'});
        }
    });

    app.get('/get/:token/modal-text', (request, response) => {

        let messageName = "message";
        if (request.params.token === 'arco' || request.params.token === 'sardegna' ) {
            messageName += 'Autori';
        } else if (request.params.token === 'arco-things'  ) { 
            messageName += 'Opere';
        } else {
            messageName += 'Luoghi';
        }

        if (request.user.role === 'user'){
            messageName += 'CrowdSource';
        } else {
            messageName += 'Validazione';
        }
        response.json({message: messages[messageName]});

    });

    /* Login API */
    app.post('/api/v1/:token/signup', (request, response) => {
        auth.insertUser(driver, request.body.email, request.body.password, request.body.username, (email, token, err) => {
            if(!err)
                mailer.sendVerificationEmail(email, token, request.body.redirect, () => {
                    response.redirect('/get/' + configToken + '/user-verification')
                });
            else
                response.redirect('/get/' + configToken + '/login?message=genericError');
        });
    });

    app.post('/api/v1/:token/login', (request, response, next) => {
        passport.authenticate('local', (err, user, info) => {

            if (err)
                return next(err);
            if (!user)
                return response.redirect('/get/' + configToken + '/login?message=' + info.message);

            request.logIn(user, (err) => {
                if (err) {
                    next(err);
                } else {
                    console.log(request.body.redirect)
                    return response.redirect(request.body.redirect ? request.body.redirect : '/get/'+ configToken + '/author');
                }
            });

        })(request, response, next);
    });
    
    app.get('/api/v1/logout', (request, response) => {
        request.logout();
        response.redirect('/get/' + configToken + '/login');
    });

    app.post('/api/v1/:token/reset-password', (request, response) => {

        if(request.query.reset){
            auth.updatePassword(driver, request.query.reset, request.body.password, (err, res) => {
                if(err) throw err;
                response.redirect('/get/' + configToken + '/login');
            })
        } else {
            auth.setupPasswordReset(driver, request.body.email, (err, res) => {
                if(err) throw err;
                if(res.value){
                    mailer.sendResetEmail(res.value._id, res.value.reset, (err, res) => {
                        if(err) throw err;
                        response.json({success: true});
                    });
                } else response.json({success: false});
            })
        }

    });

    app.get('/api/v1/:token/verify-user/:token', passport.authenticate('authtoken', {params: 'token'}), (request, response) => {
        response.redirect(request.query.redirect ? request.query.redirect + '?verified=true' : '/get/' + configToken + '/author?verified=true');
    });

    app.get('/api/v1/:token/email-existence/:email', (request, response) => {
        auth.findUserById(driver, request.params.email, (err, res) => {
            response.json({'exists': !!(!err && res)});
        })
    });

    app.get('/api/v1/:token/username-existence/:username', (request, response) => {
       auth.findUserByUsername(driver, request.params.username, (err, res) => {
           response.json({'exists': !!(!err && res)});
       })
    });

    app.get('/api/v1/:token/logged-user', (request, response) => {
        response.json({user: request.user ? request.user : null});
    });

    /* Enrichment API */
    app.get('/api/v1/:token/feed-enrichments', (request, response) => {
        enrichments.feedEnrichments(driver, () => {
            response.json({status: 'enriched'});
        });
    });

    app.get('/api/v1/:token/store-things', (request, response) => {
        nodeRequest(queries.getThings, (err, res, body) => {

            // Store uris
            body = JSON.parse(body);
            let uris = body.results.bindings.map(el => el.thing.value);

            enrichments.insertThings(driver, uris, () => {
                response.json({stored: true});
            })

        })
    });

    app.get(['/api/v1/:token/author/', '/api/v1/:token/author/:authorId', '/api/v1/:token/work/', '/api/v1/:token/work/:authorId', '/api/v1/:token/place/', '/api/v1/:token/place/:authorId'], (request, response) => {
        let cache = (request.query.cache !== 'false');
        let user = (!request.query.enrichment && request.user) ? request.user.username : null;
        let agent = request.params.authorId;

        if((request.user && request.user.role === 'user') || !request.user || request.query.role === 'user') {
            enrichments.getAndLockAgent(driver, user, agent, cache, (result, author, options) => {

                if (result && cache && result.enriched) {
                    // Send stored options and author
                    response.json({author: author, options: options});
                } else {

                    // Compose author query
                    let queryAuthor = queries.authorSelect(request.params.authorId ? request.params.authorId : result._id);

                    // Make request
                    nodeRequest(queryAuthor, (err, res, body) => {

                        // Handle and send author
                        let author = parser.parseAuthor(JSON.parse(body));
                        // Query options
                        let requests = queries.authorOptions((author.name || '').trim(), result.class);

                        // Make options queries
                        Promise.all(requests).then((bodies) => {

                            bodies = bodies.map(body => {
                                try {JSON.parse(body)}
                                catch {return {}}
                                return JSON.parse(body);
                            });

                            // Parse result
                            parser.parseAuthorOptions(author, bodies, (options) => {

                                let responseObject = {
                                    author: author,
                                    options: options
                                };

                                if (driver)
                                    // Store current result
                                    enrichments.storeEnrichment(driver, responseObject).then(response.json(responseObject));
                                else
                                    // Send back options and author response
                                    response.json(responseObject);

                            });

                        }).catch((error) => console.error(error));

                    });

                }

            });
        } else if(request.user && request.user.role === 'admin') {
            enrichments.getMatchingToValidate(driver, agent, (validationFields) => {
                if(!validationFields) response.json({author: null, options: null});
                else {
                    parser.mergeOptionsAndMatches(validationFields.options, validationFields.matches);
                    response.json({author: validationFields.author, options: validationFields.options});
                }
            });
        }


    });

    app.get('/api/v1/:token/config/', (request, response) => {

        // Send configuration object
        response.json(config.getConfig())

    });

    /* Interlink API */
    app.post('/api/v1/:token/enrich-author/', (request, response) => {

        // Get requests
        let requests = queries.authorLink(request, driver);

        // Send requests
        Promise.all(requests).then((data) => {
            // Send response
            response.redirect('/get/' + request.params.token + '/author');
        })

    });

    app.post('/api/v1/:token/author-skip/', (request, response) => {

        // Compose query
        let requests = queries.authorSkip(request, driver);
        if(!(configToken === 'arco' ||  configToken === 'arco-things' ||  configToken === 'sardegna' || configToken === 'sardegna-luoghi' || configToken === 'sardegna-contenitori'   ))
            requests = requests.map(req => promiseRequest(req));

        // Send requests
        nodeRequest(requests, (err, res, body) => {
            // Send response
            response.json({'status': 'success'});
        });

    });

    app.post('/api/v1/:token/validate-matching/:agent', (request, response) => {

        let option = request.body.option === 'null' ? null : JSON.parse(request.body.option);

        enrichments.validateMatching(driver, request.params.agent, () => {
            if(option) {
                nodeRequest(queries.storeMatching(request.params.agent, option.wikidata), (err, res, body) => {
                    if(err) throw err;
                    response.json(option);
                });
            } else {
                nodeRequest(queries.storeSkip(request.params.agent), (err, res, body) => {
                    if (err) throw err;
                    response.json({skipped: true});
                });
            }
        });

    });

};
