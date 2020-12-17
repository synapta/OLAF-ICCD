# Guida installazione OLAF

In questa guida si dettaglia l'installazione di OLAF sui server nivola app-db1-iccd.site02.nivolapiemonte.it. L'utente utilizzato è `root`.


Creazione cartella
```BASH
mkdir /opt/synapta
cd /opt/synapta/
mkdir olaf
```

Installazione node

```BASH
# configurazione proxy
export http_proxy=http://10.138.181.7:3128/
export https_proxy=https://10.138.181.7:3128/

# test proxy
curl google.com
curl https://google.com


# installazione node di sistema
yum install node npm

#installazione n (gestore di versione di node)
npm config set proxy http://10.138.181.7:3128
npm config set https-proxy http://10.138.181.7:3128
npm install -g n

# installazione versione specifica di node
n install 12
node -v
```

Installazione corkscrew per usare SSH tramite il proxy http
```BASH
git config --global http.proxy http://10.138.181.7:3128
git config --global https.proxy https://10.138.181.7:3128
cd
git clone https://github.com/bryanpkc/corkscrew
cd corkscrew/
sudo yum groupinstall 'Development tools'
autoreconf --install
./configure
make install
# controllo il path del tool
which corkscrew
```

Scarico il repository e lo installo. Dopo aver inserito la chiave RSA di deploy del repository nella cartella specifica: `/root/.ssh/arco_rsa`. Inoltre cambio i permessi della chiave con `chmod 400 /root/.ssh/arco_rsa`.

Per utilizzare il tool è necessario modificare (o creare se non esiste) il file `/root/.ssh/config` e aggiungere le seguenti righe:

```
Host github.com
  User git
  ProxyCommand /usr/local/bin/corkscrew 10.138.181.7 3128 %h %p
```


A questo punto è possibile scaricare il repository tramite la chiave di deploy.
```BASH
# Creo un agent SSH
eval $(ssh-agent)
# aggiungo la chiave di deploy
ssh-add ~/.ssh/arco_rsa

# Clone del repository
cd /opt/synapta/
git clone git@github.com:synapta/Catalogo-Generale-dei-Beni-Culturali
cd Catalogo-Generale-dei-Beni-Culturali/
cd OLAF
# scarico i pachcetti necessari al funzionamento di OLAF
/usr/local/bin/npm  install
```

Per poter tenere acceso il server node.js è necessario installare `supervisord` un servizio che si occupi di raccogliere i log e riavviare il progamma in caso di crash

```BASH
yum -y install supervisor
systemctl start supervisord
systemctl enable supervisord
```

Per configurare supervisor è necessario aggiungere le seguenti righe al file `/etc/supervisord.conf`

```
[program:olaf]
command=node server.js              ; the program (relative uses PATH, can take args)
process_name=%(program_name)s ; process_name expr (default %(program_name)s)
numprocs=1                    ; number of processes copies to start (def 1)
directory=/opt/synapta/Catalogo-Generale-dei-Beni-Culturali/OLAF                ; directory to cwd to before exec (def no cwd)
umask=022                     ; umask for process (default None)
priority=999                  ; the relative start priority (default 999)
autostart=true                ; start at supervisord start (default: true)
autorestart=true              ; retstart at unexpected quit (default: true)
startsecs=10                  ; number of secs prog must stay running (def. 1)
startretries=3                ; max # of serial start failures (default 3)
exitcodes=0,2                 ; 'expected' exit codes for process (default 0,2)
stopsignal=QUIT               ; signal used to kill process (default TERM)
stopwaitsecs=10               ; max num secs to wait b4 SIGKILL (default 10)
user=root                   ; setuid to this UNIX account to run the program
redirect_stderr=true          ; redirect proc stderr to stdout (default false)
stdout_logfile=/var/log/supervisorctl-olaf.log        ; stdout log path, NONE for none; default AUTO
stdout_logfile_maxbytes=1MB   ; max # logfile bytes b4 rotation (default 50MB)
stdout_logfile_backups=10     ; # of stdout logfile backups (default 10)
stdout_capture_maxbytes=1MB   ; number of bytes in 'capturemode' (default 0)
stdout_events_enabled=false   ; emit events on stdout writes (default false)
stderr_logfile=/var/log/supervisorctl-olaf-err.log ; stderr log path, NONE for none; default AUTO
stderr_logfile_maxbytes=1MB   ; max # logfile bytes b4 rotation (default 50MB)
stderr_logfile_backups=10     ; # of stderr logfile backups (default 10)
stderr_capture_maxbytes=1MB   ; number of bytes in 'capturemode' (default 0)
stderr_events_enabled=false   ; emit events on stderr writes (default false)
environment=A=1,B=2           ; process environment additions (def no adds)
serverurl=AUTO                ; override serverurl computation (childutils)
```

Faccio rileggere il file di configurazione a `supervisord`

```BASH
supervisorctl reread
supervisorctl reload
# verifico che il servizio sia attivo
supervisorctl status olaf
#verifico che ci sia una risposta sulla porta  sulla quale è esposto OLAF
curl localhost:3654
```

# Creazione database di potenziali match

Per creare il database con i potenziali match bisogna dapprima construirne la struttura tramite (in questo e nei comandi successivi assumo che mongodb sia esposto sulla porta 27017 sulla stessa macchina e che la directory da cui lancio i comandi sia la root del progetto git): 
```BASH
# assumendo di essere nella direcotry del progetto:
cd OLAF
node arco_setup.js arco
```

Ora posso andare a chiedere gli arricchimenti per tutti gli autori tramite:
```BASH
cd OLAF
node arco_enrichments.js agents
```

E chiedere gli arricchimenti per le opere tramite:
```BASH
cd OLAF
node arco_enrichments.js things
```

Gli ultimi due comandi richiedo molto tempo (potenzialmente giorni) e si consiglia di lanciarli in un terminale indipendente dalla sessione SSH con cui ci si connette al server (ad esempio tramite TMUX)
