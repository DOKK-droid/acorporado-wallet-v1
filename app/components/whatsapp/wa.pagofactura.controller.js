const UsuarioDB = require("../users/user.db"); // Se llama las funciones de la base de datos
const bcrypt = require("../../utils/bcrypt");
const bot = require("../../utils/botDb"); // Se llama y se lee el bot.json para para controlar estados y Bingo
const Cuenta = require('../cuentas/cuenta.model')
const ConfigComis = require('../contabilidad/configcomisiones.model'); // Configiracion de comisiones
const configcomisionesModel = require("../contabilidad/configcomisiones.model");
const { validarTel } = require('../../helpers/usuarios.helper');
const { formatearNumeroComas, soloTelefono, verificarPDFadjunto, validoSaldoFACT } = require("../../helpers/cuenta.helper");
const { generador } = require("../../helpers/contabilidad.helper");
const EnvireciModel = require("../contabilidad/envireci.model");


// Realizar pedir pago factura, TIPO es ref de comision a tratar
const recibirPagoFactura = async(codigoEstado, clientMessage, telefono, userId, ope, nombreCompleto, mimetype) => {

    let base = bot.status_code[codigoEstado];
    var payload;


    switch (true) {

        // Identifica que tenga algun código 8000... en este caso el 8001, TElefono del pagador.
        case (codigoEstado == 8001):
            var msg = base['confirmation'];
            const tel = validarTel(clientMessage);
            if (tel) { // Validamos el numero introducido
                // Verificamos antes si este cliente pudo abandonar un envio sin completar
                const abandonado = await EnvireciModel.findOne({ cuentaEmi: telefono, sentido: 'C', estado: 'ENCURSO', referencia: /^FAC/, cuentaReci: { $ne: null } });

                if (abandonado) { // Si existe un registro abandonado lo reutilizamos
                    await EnvireciModel.findOneAndUpdate({ cuentaEmi: telefono, sentido: 'C', estado: 'ENCURSO', referencia: /^FAC/, cuentaReci: { $ne: null } }, { cuentaReci: tel });
                } else {

                    // Preparamos y registramos los datos de pago de factura.

                    const referencia = `FAC${generador(11)}`
                    const codigo = `FAC${generador(6)}`

                    const mensaje = `📝 Ha solicitado un pago de factura:

CLIENTE: *${soloTelefono(tel)}*
OBJETO:NEXT
CODIGO: *${codigo}*
REFERENCIA: *${referencia}*
                     
    💰 _Acorporado wallet_ 💰`;

                    // Registramos el numero tel receptor operacion en el model envireci
                    const data = {
                        referencia,
                        cuentaEmi: telefono,
                        cuentaReci: tel, // EL TELEFONO DE LA PERSONA QUE RECIBE LA FACTURA
                        ope,
                        mensaje,
                        codigo,
                        sentido: "C",
                    }
                    const envi = new EnvireciModel(data);
                    await envi.save();

                }

                payload = { code: 200, message: msg.message, encode: msg.encode_msg };
                await UsuarioDB.update(userId, { codigoEstado: msg.next_status });

            } else {
                payload = {
                    code: 400,
                    message: `❌ El numero de telefono no es válido, *Igrese otra vez*`,
                    encode: false
                };

            }

            break;
        case (codigoEstado == 8002): // Concepto

            var msg = base['confirmation'];

            // Tomamos el mensaje del registro en curso para añadir el Concepto donde esta NEXT
            const smsActivo = await EnvireciModel.findOne({ cuentaEmi: telefono, sentido: 'C', estado: 'ENCURSO', referencia: /^FAC/, cuentaReci: { $ne: null } });
            const mensajeMod = smsActivo.mensaje.replace('NEXT', `(_*${clientMessage}*_)`)

            // Actualizamos el texto CONCEPTO
            await EnvireciModel.findOneAndUpdate({ cuentaEmi: telefono, sentido: 'C', estado: 'ENCURSO', referencia: /^FAC/, cuentaReci: { $ne: null } }, { mensaje: mensajeMod });
            await UsuarioDB.update(userId, { codigoEstado: msg.next_status });
            payload = { code: 200, message: msg.message, encode: msg.encode_msg };
            break;

        case (codigoEstado == 8003): // ADJUNTAR FACTURA EN PDF
            var msg = base['confirmation'];

            const PDF = await verificarPDFadjunto(mimetype);

            if (PDF) { // Validamos si es PDF
                // Tomamos los datos del mensaje de detalles a responder
                const encursoSMS = await EnvireciModel.findOne({ cuentaEmi: telefono, sentido: 'C', estado: 'ENCURSO', referencia: /^FAC/, cuentaReci: { $ne: null } });
                const telRemitente = encursoSMS.cuentaEmi
                    // Detalles SMS adjuntado al PDF para el receptor
                const mensajeRece = `📝 Ha recibido una solicitud de pago de factura de:
👨‍💼 _${nombreCompleto}_
BENEFICIARIO: *${soloTelefono(telRemitente)}*
OBJETO:(_${encursoSMS.mensaje.split('_')[1]}_)
CODIGO: *${encursoSMS.codigo}*
REFERENCIA: *${encursoSMS.referencia}*
                                     
        💰 _Acorporado wallet_ 💰`;

                payload = { code: 200, message: msg.message, messageRemitente: encursoSMS.mensaje, messageReceptor: mensajeRece, encode: msg.encode_msg, tel: encursoSMS.cuentaReci };
                await UsuarioDB.update(userId, { codigoEstado: msg.next_status });

            } else {
                payload = {
                    code: 400,
                    message: `❌ No es un documento *PDF*,\n ⚠ *ADJUNTAR FACTURA EN PDF*`,
                    encode: false
                };

            }
            break;

        default:
            payload = { code: 404 };
    }


    return payload;

}

////////////////////////////////////////--------////////////////////////////////////
///////////////////////////////////// INICIO PAGAR FACTURA ////////////////////////

// Realizar pago de  factura, TIPO es ref de comision a tratar
const pagarFactura = async(codigoEstado, clientMessage, telefono, userId, tipo, ope, nombreCompleto) => {

    let base = bot.status_code[codigoEstado];
    var payload;


    switch (true) {

        // Identifica que tenga algun código 7000... en este caso el 8001, referencia del pago.
        case (codigoEstado == 7001):

            var msg = base['confirmation'];
            // Filtramos incluso a que el mismo que pide pago no lo reciba cuentaEmi $ne telefono , cuentaEmi: { $ne: telefono }
            var getfactuCOD = await EnvireciModel.findOne({ codigo: clientMessage, sentido: 'C', estado: 'ENCURSO' });

            if (getfactuCOD) { // Validamos el codigo introducido

                payload = { code: 200, message: msg.message, encode: msg.encode_msg, messageDetalle: getfactuCOD.mensaje };
                await UsuarioDB.update(userId, { codigoEstado: msg.next_status });
                // Actualizamos el campo pagado por para dar referencia de pago al introducir solo monto en 7002
                await EnvireciModel.findOneAndUpdate({ cuentaReci: telefono, codigo: /^FAC/, sentido: 'C', estado: 'ENCURSO', }, { pagadoPor: telefono });


            } else {
                payload = {
                    code: 400,
                    message: `❌ El código no es válido, *Igrese otra vez*`,
                    encode: false
                };

            }
            break;

        case (codigoEstado == 7002): // Confirmando el monto

            var msg = base['confirmation'];
            // Busca el codigo
            const validoSaldo = await validoSaldoFACT(telefono, clientMessage, tipo);
            if (validoSaldo) { // Validamos el saldo si es suficiente
                // Actualizamos el recibo estado y ope
                const pagado = await EnvireciModel.findOneAndUpdate({ cuentaReci: telefono, codigo: /^FAC/, sentido: 'C', estado: 'ENCURSO', pagadoPor: telefono }, { monto: validoSaldo.monto, comisionEmpresa: validoSaldo.comisionST, estado: 'PAGADO', pagadoPor: `${telefono}:${nombreCompleto}` });

                const mensaje = `📝 Ha realizado un pago de factura:

BENEFICIARIO: *${soloTelefono(pagado.cuentaEmi)}*
CODIGO: *${pagado.codigo}*
REFERENCIA: *${pagado.referencia}*
                     
    💰 _Acorporado wallet_ 💰`;

                // Registramos el debito del que paga
                const data = {
                    referencia: pagado.referencia,
                    cuentaEmi: pagado.cuentaEmi,
                    cuentaReci: telefono, // EL TELEFONO DE LA PERSONA QUE RECIBE LA FACTURA
                    ope,
                    monto: pagado.monto,
                    comisionEmpresa: pagado.comisionEmpresa,
                    mensaje,
                    codigo: pagado.codigo,
                    sentido: "D",
                    estado: 'PAGADO',
                }
                const factu = new EnvireciModel(data);
                await factu.save();

                // Abonamos sus cuentas: monto enviado y monto comisiones a ganar o pagar
                var getSaldo = await Cuenta.findOne({ cuenta: telefono, descripcion: 'CUENTA_NORMAL' });
                const resta = parseInt(getSaldo.saldo) - parseInt(validoSaldo.margen) // Restamos su saldo
                await Cuenta.findOneAndUpdate({ cuenta: telefono, descripcion: 'CUENTA_NORMAL' }, { saldo: resta })

                var getSaldoEmis = await Cuenta.findOne({ cuenta: pagado.cuentaEmi, descripcion: 'CUENTA_NORMAL' });
                const sumaEmis = parseInt(getSaldoEmis.saldo) + parseInt(pagado.monto) // Sumar monto que le pagan
                await Cuenta.findOneAndUpdate({ cuenta: pagado.cuentaEmi, descripcion: 'CUENTA_NORMAL' }, { saldo: sumaEmis })

                var getSaldoComisEmpresa = await Cuenta.findOne({ descripcion: 'CUENTA_IN_COMISION_PAGOS_FACTURAS' });
                const sumaCom = parseInt(getSaldoComisEmpresa.saldo) + parseInt(validoSaldo.comisionST) // Sumar monto comision
                await Cuenta.findOneAndUpdate({ descripcion: 'CUENTA_IN_COMISION_PAGOS_FACTURAS' }, { saldo: sumaCom })

                let notificacion = `🏛↙ _Hemos abonado su cuenta normal_\n_por pago de factura *${pagado.codigo}*_\n_monto *${formatearNumeroComas(pagado.monto)}*_ 💰`
                payload = { code: 200, message: msg.message, encode: msg.encode_msg, messageDetalle: mensaje, messageNotif: notificacion, tel: pagado.cuentaEmi };
                await UsuarioDB.update(userId, { codigoEstado: msg.next_status });
            } else {
                payload = {
                    code: 400,
                    message: `❌ Saldo insuficiente por ${clientMessage} 👁,\n💶 *Igrese otro monto*`,
                    encode: false
                };

            }

            break;

        default:
            payload = { code: 404 };
    }


    return payload;

}



module.exports = {
    recibirPagoFactura,
    pagarFactura
}