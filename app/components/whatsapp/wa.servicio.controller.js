const UsuarioDB = require("../users/user.db"); // Se llama las funciones de la base de datos
const bcrypt = require("../../utils/bcrypt");
const bot = require("../../utils/botDb"); // Se llama y se lee el bot.json para para controlar estados y Bingo
const Cuenta = require('../cuentas/cuenta.model')
const { validarTel } = require('../../helpers/usuarios.helper');
const { verificarSaldo, formatearNumeroComas, soloTelefono, verificarSaldoServicio } = require("../../helpers/cuenta.helper");
const { generador } = require("../../helpers/contabilidad.helper");
const EnvireciModel = require("../contabilidad/envireci.model");


//PAGAR UN SERVICIO servicio, TIPO es ref de comision a tratar
const pagarServicio = async(codigoEstado, clientMessage, telefono, userId, tipo, ope, nombreCompleto) => {

    let base = bot.status_code[codigoEstado];
    var payload;

    // Formateando el mensaje recibido para pago con cadena de datos
    const cadena = clientMessage
    const modulo = cadena.split('@')[0]
    const telBeneficiario = cadena.split('@')[1] + '@c.us'
    const precio = parseInt(cadena.split(':')[1])

    // Verificamos de inmediato si ya esta afiliado para aplicar un tipo de comisiones
    const getFranquicia = await UsuarioDB.buscarFranquicia(telefono);

    if (getFranquicia) { // SI EL CIENTE ESTA AFILIADO SE HACE CON LAS COMISIONES

        var msg = base['confirmation'];
        var msg = bot.init[modulo]

        const validoSaldo = await verificarSaldoServicio(telefono, precio, tipo);
        if (validoSaldo) { // Validamos el saldo si es suficiente

            // Preparamos y registramos los datos de pago de servicio, aqui el que paga es como Remitente

            const referencia = `REF${generador(11)}`
            const codigo = `COD${generador(6)}`

            const mensaje = `♻ Ha realizado un pago de *${formatearNumeroComas(precio)}:*

BENEFICIARIO: *${soloTelefono(telBeneficiario)}*
COMISION RETENIDA: *${formatearNumeroComas(validoSaldo.comisionEmpresa+validoSaldo.comisionRemitente+validoSaldo.comisionReceptor)} XAF*
COMISION GANADA: *${formatearNumeroComas(validoSaldo.comisionRemitente)} XAF*
CODIGO: *${codigo}*
REFERENCIA: *${referencia}*
                     
    💰 _Acorporado wallet_ 💰`;
            // Registramos el debito del que paga
            const data = {
                referencia,
                cuentaEmi: telefono,
                cuentaReci: telBeneficiario,
                ope,
                monto: precio,
                comisionEmpresa: validoSaldo.comisionEmpresa,
                comisionRemitente: validoSaldo.comisionRemitente,
                comisionReceptor: validoSaldo.comisionReceptor,
                mensaje,
                codigo,
                sentido: "D",
                estado: 'PAGADO'
            }
            const envi = new EnvireciModel(data);
            await envi.save();

            // Registramos el credito del que es pagado
            const mensajeB = `💙 Ha recicibo un pago de parte de *${nombreCompleto}:*

REMITENTE: *${soloTelefono(telefono)}*
MONTO: *${formatearNumeroComas(precio)} XAF*
COMISION GANADA: *${formatearNumeroComas(validoSaldo.comisionReceptor)} XAF*
CODIGO: *${codigo}*
REFERENCIA: _${referencia}_
            
    💰 _Acorporado wallet_ 💰`
            const data2 = {
                referencia,
                cuentaEmi: telefono,
                cuentaReci: telBeneficiario,
                ope: 160,
                monto: precio,
                comisionEmpresa: validoSaldo.comisionEmpresa,
                comisionRemitente: validoSaldo.comisionRemitente,
                comisionReceptor: validoSaldo.comisionReceptor,
                mensaje: mensajeB,
                codigo,
                sentido: "C",
                estado: 'PAGADO'
            }
            const envi2 = new EnvireciModel(data2);
            await envi2.save();


            // Actualizamos las cuentas y ajustamos la contabiidad
            // Debitamos la cuenta del cliente
            let getSaldo = await Cuenta.findOne({ cuenta: telefono, descripcion: 'CUENTA_NORMAL' });
            let getSaldoComisCliente = await Cuenta.findOne({ cuenta: telefono, descripcion: 'CUENTA_COMISIONES' });
            let getSaldoComisEmpresa = await Cuenta.findOne({ descripcion: 'CUENTA_IN_COMISION_PAGOS_SERVICIOS' });
            const resta = parseInt(getSaldo.saldo) - parseInt(precio + validoSaldo.comisionEmpresa + validoSaldo.comisionRemitente + validoSaldo.comisionReceptor)
            await Cuenta.findOneAndUpdate({ cuenta: telefono, descripcion: 'CUENTA_NORMAL' }, { saldo: resta })
                // Comisiones cliente que paga
            await Cuenta.findOneAndUpdate({ cuenta: telefono, descripcion: 'CUENTA_COMISIONES' }, { saldo: getSaldoComisCliente.saldo + validoSaldo.comisionRemitente })
                // Comisiones cliente que recibe pago
            let getSaldoComisBeneficiario = await Cuenta.findOne({ cuenta: telBeneficiario, descripcion: 'CUENTA_COMISIONES' });
            await Cuenta.findOneAndUpdate({ cuenta: telBeneficiario, descripcion: 'CUENTA_COMISIONES' }, { saldo: getSaldoComisBeneficiario.saldo + validoSaldo.comisionReceptor })

            // VENTILAR CUENTAS INTERNAS DE LA EMPRESA MANDANDO SUS COMISIONES
            await Cuenta.findOneAndUpdate({ descripcion: 'CUENTA_IN_COMISION_PAGOS_SERVICIOS' }, { saldo: getSaldoComisEmpresa.saldo + validoSaldo.comisionEmpresa })
                // Ahora registramos la operacion como C= Credito disponible para el retiro del Beneficiario

            await UsuarioDB.update(userId, { codigoEstado: msg.next_status })
                // Mandamos este tel: data.cuentaReci para que reciba el beneficiario este sms si tiene whatsapp
                // EN EL FUTURO SE DEBE MANDARLE SMS NORMAL AL MOVIL SI NO TIENE WHATSAPP O INCLUSIVE
                // Pasamos en el payload todos los mensajes a recibir segun proceso, tel aqui es del beneficiario del pago
            payload = { code: 200, message: msg.message, messageRemitente: mensaje, messageReceptor: mensajeB, encode: msg.encode_msg, tel: telBeneficiario };


        } else {
            payload = {
                code: 400,
                message: `❌ Saldo insuficiente para pagar 👁,\n*🚩 Escanea más e igrese otro monto*`,
                encode: false
            };

        }


    } else {
        // SI EL CLIENTE NO ESTA AFILIADO PIERDE LAS COMISIONES DEL ENVIO

        switch (true) {

            // Identifica que tenga algun código 2000... en este caso el 2001, ES IGUAL A SI.
            case (codigoEstado == 2001 && clientMessage !== 'NO' || 'No' || 'no' || 'n'):
                var msg = base['confirmation'];
                await UsuarioDB.update(userId, { codigoEstado: msg.next_status });
                payload = { code: 200, message: msg.message, encode: msg.encode_msg };

                break;
            case (codigoEstado == 2001 && clientMessage == 'NO' || 'No' || 'no' || 'n'):

                // Si manda NO devolvemos el estadoCodigo a 500 menu o inicio de sesion
                await UsuarioDB.update(userId, { codigoEstado: 500 });
                payload = {
                    code: 400,
                    message: `❎ _Proceso anulado de envio_`,
                    encode: false
                };
                break;
            case (codigoEstado == 2002): // Si se ha ingresado el telefono
                var msg = base['confirmation'];
                const tel = validarTel(clientMessage);
                if (tel) { // Validamos el numero introducido

                    // Registramos el numero tel receptor operacion en el model envireci
                    const data = {
                        referencia: `REF${generador(11)}`,
                        cuentaEmi: telefono,
                        cuentaReci: tel,
                        ope,
                        mensaje: "",
                        codigo: `COD${generador(6)}`,
                        sentido: "D",
                    }
                    const envi = new EnvireciModel(data);
                    await envi.save();

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

            case (codigoEstado == 2003): // Si el usuario a ingresado el monto
                var msg = base['confirmation'];

                const validoSaldo = await verificarSaldo(telefono, clientMessage, tipo);
                if (validoSaldo) { // Validamos el saldo si es suficiente

                    // Actualizamos el monto introducido debitando la cuenta del Remitente
                    await EnvireciModel.findOneAndUpdate({ cuentaEmi: telefono, sentido: 'D', estado: 'ENCURSO' }, { monto: validoSaldo.monto, comisionEmpresa: validoSaldo.comisionEmpresa, comisionRemitente: -(validoSaldo.comisionRemitente), comisionReceptor: validoSaldo.comisionReceptor });

                    payload = { code: 200, message: msg.message, encode: msg.encode_msg };
                    await UsuarioDB.update(userId, { codigoEstado: msg.next_status });

                } else {
                    payload = {
                        code: 400,
                        message: `❌ Saldo insuficiente por ${clientMessage} 👁, *Igrese otro monto*`,
                        encode: false
                    };

                }

                break;
            case (codigoEstado == 2004): // Si el usuario a ingresado su PIN

                var msg = base['confirmation'];
                // Busca el usuario
                var getUsuarioWhatsapp = await UsuarioDB.findTelefono(telefono) // Se envia el dato en si
                if (getUsuarioWhatsapp) {
                    // Si existe, lee el PIN enviado
                    var validPassword = await bcrypt.verifyPin(clientMessage, getUsuarioWhatsapp.pin);
                    // Si es password es correcto inicia sesión
                    if (validPassword) {

                        // Si confirmo el PIN valido, aseguramos toda la operacion con estado=DEPO
                        const depositado = await EnvireciModel.findOneAndUpdate({ cuentaEmi: telefono, sentido: 'D', estado: 'ENCURSO' }, { estado: 'DEPO' });
                        // Actualizamos el mensaje de la transaccion
                        // Si confirmo el PIN valido, aseguramos toda la operacion con estado=DEPO

                        const smsRemitente = `♻ Ha realizado un envio de *${formatearNumeroComas(depositado.monto)}:*
BENEFICIARIO: *${soloTelefono(depositado.cuentaReci)}*
COMISION RETENIDA: *${formatearNumeroComas(depositado.comisionEmpresa+depositado.comisionRemitente+depositado.comisionReceptor)} XAF*
COMISION DE AFILIADO: *${formatearNumeroComas(depositado.comisionRemitente)} XAF*
CODIGO: *${depositado.codigo}*
REFERENCIA: *${depositado.referencia}*
                        
💰 _Acorporado wallet_ 💰`;
                        const depositadoSMS = await EnvireciModel.findOneAndUpdate({ cuentaEmi: telefono, sentido: 'D', estado: 'DEPO' }, { mensaje: smsRemitente });
                        // Buscamos ya la operacion en si para proceder a debitar y acreditar otras cuentas
                        const dataEnvio = await EnvireciModel.findOne({ referencia: depositadoSMS.referencia, cuentaEmi: telefono, });
                        // Debitamos la cuenta del cliente
                        let getSaldo = await Cuenta.findOne({ cuenta: telefono, descripcion: 'CUENTA_NORMAL' });
                        let getSaldoComisCliente = await Cuenta.findOne({ cuenta: telefono, descripcion: 'CUENTA_COMISIONES' });
                        let getSaldoComisEmpresa = await Cuenta.findOne({ descripcion: 'CUENTA_IN_COMISION_ENVIOS' });
                        const resta = parseInt(getSaldo.saldo) - parseInt(dataEnvio.monto + dataEnvio.comisionEmpresa + dataEnvio.comisionRemitente + dataEnvio.comisionReceptor)
                        await Cuenta.findOneAndUpdate({ cuenta: telefono, descripcion: 'CUENTA_NORMAL' }, { saldo: resta })

                        // VENTILAR CUENTAS INTERNAS DE LA EMPRESA MANDANDO SUS COMISIONES
                        await Cuenta.findOneAndUpdate({ descripcion: 'CUENTA_IN_COMISION_ENVIOS' }, { saldo: getSaldoComisEmpresa.saldo + dataEnvio.comisionEmpresa + dataEnvio.comisionReceptor })
                            // Ahora registramos la operacion como C= Credito disponible para el retiro del Beneficiario

                        const data = {
                            referencia: dataEnvio.referencia,
                            cuentaEmi: telefono,
                            cuentaReci: dataEnvio.cuentaReci,
                            ope: dataEnvio.ope,
                            monto: dataEnvio.monto,
                            comisionReceptor: dataEnvio.comisionReceptor,
                            mensaje: `Ha recicibo un envio de parte de *${nombreCompleto}:*
REMITENTE: *${soloTelefono(dataEnvio.cuentaEmi)}*
MONTO: *${formatearNumeroComas(dataEnvio.monto)} XAF*
COMISION A GANAR: *${formatearNumeroComas(depositado.comisionRemitente)} XAF*
CODIGO: *${dataEnvio.codigo}*
REFERENCIA: _${dataEnvio.referencia}_

💰 _Acorporado wallet_ 💰`,
                            codigo: dataEnvio.codigo,
                            sentido: "C",
                        }
                        const reci = new EnvireciModel(data);
                        await reci.save();

                        await UsuarioDB.update(userId, { codigoEstado: msg.next_status })
                            // Mandamos este tel: data.cuentaReci para que reciba el beneficiario este sms si tiene whatsapp
                            // EN EL FUTURO SE DEBE MANDARLE SMS NORMAL AL MOVIL SI NO TIENE WHATSAPP O INCLUSIVE
                            // Pasamos en el payload todos los mensajes a recibir segun proceso
                        payload = { code: 200, message: msg.message, messageRemitente: smsRemitente, messageReceptor: data.mensaje, encode: msg.encode_msg, tel: data.cuentaReci };

                    } else { // Si es incorrecto el PIN, envia mensaje
                        payload = {
                            code: 200,
                            message: `❌ El código PIN ingresado no es válido, *Intentalo más*`,
                            encode: false

                        }
                    }

                }

                break;

            default:
                payload = { code: 404 };
        }



    }


    return payload;

}



module.exports = {
    pagarServicio
}