const nodemailer = require('nodemailer');
const auth = require('../../auth');

// Initializer transporter
let transporter = nodemailer.createTransport(auth.emailConf);

// Verification email configuration
let welcomeEmail = (destination, verification, redirect) => {
    return {
        from: 'sigecweb.hdesk@beniculturali.it',
        to: destination,
        subject: 'Conferma la tua email',
        html: `<p>Benvenuto in OLAF,</p>
        <p>Dopo aver verificato il tuo account potrai iniziare a collegare le entità di ArCo, il Knowledge Graph del patrimonio culturale italiano, con la Linked Data Cloud. Clicca sul bottone sottostante per verificare la mail:</p>
        <p>
            <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                    <td>
                        <a href="http://olaf.beniculturali.it/api/v1/arco/verify-user/${verification}${redirect ? '?redirect=' + redirect : ''}" target="_blank" style="font-size: 16px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 3px; background-color: #4285f4; border-top: 12px solid #4285f4; border-bottom: 12px solid #4285f4; border-right: 18px solid #4285f4; border-left: 18px solid #4285f4; display: inline-block;">Clicca QUI</a>
                    </td>
                </tr>
            </table>
        </p>
        <p>Collaborare a OLAF è semplice. Controlla cegli il candidato migliore tra le proposte, se non lo trovi clicca su salta.</p>
        <p>Buon divertimento,</p>
        <br>
        <p>Il Team di OLAF</p>`
    }
};

let resetEmail = (destination, verification, redirect) => {
    return {
        from: 'sigecweb.hdesk@beniculturali.it',
        to: destination,
        subject: 'Reset della password',
        html: `<p>Ciao!</p>
        <p>Clicca sul bottone sottostante per resettare la tua mail:</p>
        <p>
            <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                    <td>
                        <a href="http://olaf.beniculturali.it/get/arco/reset-password/?reset=${verification}" target="_blank" style="font-size: 16px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 3px; background-color: #4285f4; border-top: 12px solid #4285f4; border-bottom: 12px solid #4285f4; border-right: 18px solid #4285f4; border-left: 18px solid #4285f4; display: inline-block;">Reset Password</a>
                    </td>
                </tr>
            </table>
        </p>
        <br>
        <p>Il Team di OLAF</p>`
    }
};

// Mailing functions
function sendVerificationEmail(destination, verification, redirect, callback) {
    // Send verification mail
    transporter.sendMail(welcomeEmail(destination, verification, redirect), (err, info) => {
        if(err) console.error(err);
        callback(err, info);
    });
}

function sendResetEmail(destination, verification, callback) {
    // Send reset mail
    transporter.sendMail(resetEmail(destination, verification), (err, info) => {
        if(err) console.error(err);
        callback(err, info);
    });
}

exports.sendVerificationEmail = sendVerificationEmail;
exports.sendResetEmail = sendResetEmail;