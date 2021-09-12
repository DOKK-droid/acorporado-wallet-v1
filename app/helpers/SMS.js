const Cuenta = require('../components/cuentas/cuenta.model')
const configcomisionesModel = require("../components/contabilidad/configcomisiones.model");

const twilio = require('twilio')
const accountSid = 'AC251135d13064c8c9acf7f9d0aac75a84'
const authToken = 'f7b1cdd1bb25858c662cc48b228ef837'

const client = new twilio(accountSid, authToken)

const crearSMSNormal = (para, sms) => {

    client.messages.create({
            to: `+${para}`,
            from: '+15092959211',
            body: sms,
        })
        .then(message => console.log(message.sid))
        .catch(err => {
            console.log('ALGO SUCEDE MAL ==> ', err)
        });

}


module.exports = {
    crearSMSNormal
}