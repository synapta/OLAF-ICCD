# OLAF: Open Linked Authority Files

Una piattaforma di crowdsourcing per allineare in modo semiautomatico basi di dati diverse.

## Installazione e avvio

Per installare: `npm install`   
Per avviare: `node server.js`   

Il server di OLAF sarà disponibile sulla porta 3646

### Generare database e importare agent e thing

L'unico vincolo relativo all'installazione del database di enrichment è la presenza
di un'istanza MongoDB alla porta 27017 (standard) locale.

Per installare: `node arco_setup.js arco *import_collection*`
  
Il parametro da linea di comando:

- **import_collection**: opzionale. Valori ammessi [agents, things, false]. Se non specificato importerà entrambe
le collections. Se specificata una delle due (agents, things) verrà importata solo quella specificata. Se specificato
false non importerà nessuna delle due collections.

### Arricchire collection agents e things

Consente di arricchire in maniera asincrona le collezioni agents e things.

Per arricchire: `node arco_enrichment.js *collection* *limit*`

I parametri da linea di comando:

- **collection**: obbligatorio. Può assumere valori tra [arco, arco-things], e imposta la collection per la quale
avviare l'enrichment mediante Wikidata.

- **limit**: opzionale. Imposta il limite dei processi di enrichment, ovvero il numero di agenti che vengono arricchiti
simultaneamente. NB. un numero minore diminuisce la possibilità di incorrere in errori con Wikidata.

### Generare ed arricchire gli item provenienti dai portali regionali

#### Autori

Per generare ed arricchire gli autori delle opere presenti nei portali regionali è necessario lanciare il comando (al momenti i valori ammessi come regione sono `sardegna` e `lombardia`): 

```BASH
node arco_setup_autori_portali_regionali.js *regione*
```

#### Luoghi

Per generare i match relativi ai luoghi provenienti dai portali regionali è necessario lanciare il comando: 

```BASH
node arco_setup_autori_portali_regionali.js *task*
```
I valori ammessi al posto di `*task*` sono:

* `sardegna-luoghi` per generare i possibili match tra i luoghi della cultura e i luoghi provenienti dal portale della sardegna.
* `lombardia-luoghi` per generare i possibili match tra i luoghi della cultura e i luoghi provenienti dal portale della lombardia.
* `sardegna-contenitori` per generare i possibili match tra i contenitori fisici e i luoghi provenienti dal portale della sardegna.
* `lombardia-contenitori` per generare i possibili match tra i contenitori fisici e i luoghi provenienti dal portale della lombardia.

## Flusso di configurazione

La configurazione di Olaf avviene mediante la creazione di directory e file associati
a un certo nome utente che determinano il comportamento dell'applicazione.   
Questi vengono importati automaticamente nella view finale durante il rendering.   

Il meccanismo si basa sulla sovrascrittura delle funzioni in base all'ordine dei 
file importati durante il flusso di esecuzione.

### Directory app/config

Struttura del file .json di configurazione:

```
{

  "limit" : [int or null],
  "selection": ["left" or "right"],
  "matching": ["toggle" or "import"],
  "fields": {

    "*Nome campo*": {
      "input": "*Identificativo campo custom in ingresso*",
      "wikidata": ["*Identificativo wikidata in ingresso*" or null],
      "viaf": ["*Identificativo VIAF in ingresso*" or null],
      "group": ["*Gruppo a cui il campo appartiene*" or null],
      "limit": [int or null],
      "label": ["*Label del campo*" or null],
      "select": [true or false],
      "format": {
        ...
      }
    },

    ...

}
```

Di seguito una legenda dei campi di configurazione:

* **limit**: Numero massimo di autori selezionabili.
* **selection**: Lato deafault della selezione. Se "left" preseleziona 
                 tutti i campi in arrivo dall'esterno. Se "right" preseleziona
                 i campi in arrivo da Wikidata e VIAF
* **matching**: Comportamento del bottone di selezione di un campo. Se "toggle"
                è possibile selezionare e deselezionare un dato campo se cliccato
                ripetutamente. Altrimenti no.

Il campo fields ospita una mappa che associa a ogni informazione proveniente
dall'esterno un identificativo interno.   

Mappa **Nome campo** a **Identificativo custom**, **Identificativo Wikidata** 
e **Identificativo VIAF**.   

I campi successivi:

* **group**: È una stringa che identifica il gruppo a cui appartiene il dato campo.
* **limit**: Il numero massimo di istanze che un campo può avere
* **label**: La label del dato campo
* **select**: Codifica se un campo deve essere selezionabile in fase, appunto, di
              selezione.
              
Il campo **format** è più complesso.
Contiene una regex per parsificare il dato in ingresso e un formato per tradurlo.
Rispettivamente *in* e *out*.   
Check contiene un vettore di regex che consentono il controllo della validità di
un campo.

```
"format": {
    "in": "regex",
    "out": "regex",
    "check": ["regex", "regex" ...]
}
```

Un esempio di questo campo è (per Beweb):

```
"format": {
    "in": "^(\\d{4})-(\\d{2})-(\\d{2})$",
    "out": "$3/$2/$1",
    "check": ["^\\d{2}/\\d{2}/\\d{4}$", "^\\d{4}$"]
}
```

### Directory users

La struttura di questa directory è la seguente:

```
users > *Nome utente*
```

Ogni sottodirectory di users è dedicata a un utente distinto e deve contenere
obbligatoriamente due file **parsers** e **queries**.   

La definizione di un nuovo utente prevede la scrittura di due nuovi file nei quali
all'interno sono definite le medesime funzioni degli altri file, richiamate dal file
**routes** nella directory principale.

### Directory app/js/author

La struttura di questa directory è la seguente:

```
author > rendering > *Nome utente*
author > *Nome utente*
```

Ogni file di author può essere dedicato a un utente distinto e può contenere
eventualmente un file con lo stesso nome dell'utente al quale è associato.   

Ognuno di questi file può sovrascrivere una funzione definita in **author/static** e di
**author/rendering/static**
