const Cuenta = require('../components/cuentas/cuenta.model')
const configcomisionesModel = require("../components/contabilidad/configcomisiones.model");

const twilio = require('twilio')
const accountSid = 'AC251135d13064c8c9acf7f9d0aac75a84'
const authToken = 'f7b1cdd1bb25858c662cc48b228ef837'

const client = new twilio(accountSid, authToken)

const createSMS = () => {

    client.messages.create({
            to: '+240222512842',
            from: '+15092959211',
            body: `Ha recicibo un envio de parte de Test:
REMITENTE: 240222512842
MONTO: 5,000 XAF
CODIGO: COD638898
REFERENCIA: REF12864458671
        
💰 Acorporado wallet 💰`,
        })
        .then(message => console.log(message.sid))
        .catch(err => {
            console.log('ALGO SUCEDE ==> ', err)
        });

}


module.exports = {
    createSMS
}