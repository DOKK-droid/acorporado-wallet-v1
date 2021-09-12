const UsuarioDB = require("../users/user.db"); // Se llama las funciones de la base de datos
const bcrypt = require("../../utils/bcrypt");
const bot = require("../../utils/botDb"); // Se llama y se lee el bot.json para para controlar estados y Bingo
const Cuenta = require('../cuentas/cuenta.model')
const ConfigComis = require('../contabilidad/configcomisiones.model'); // Configiracion de comisiones
const configcomisionesModel = require("../contabilidad/configcomisiones.model");
const { validarTel } = require('../../helpers/usuarios.helper');
const { verificarSaldo, formatearNumeroComas, soloTelefono } = require("../../helpers/cuenta.helper");
const { generador } = require("../../helpers/contabilidad.helper");
const EnvireciModel = require("../contabilidad/envireci.model");


// Realizar envio de dinero, TIPO es ref de comision a tratar
const enviar = async(codigoEstado, clientMessage, telefono, userId, tipo, ope, nombreCompleto) => {

    let base = bot.status_code[codigoEstado];
    var payload;

    // Tomamos el porcentaje de comisiones antes
    const { porcentaje } = await configcomisionesModel.findOne({ tipo: tipo })
        // Verificamos de inmediato si ya esta afiliado para aplicar un tipo de comisiones
    const getFranquicia = await UsuarioDB.buscarFranquicia(telefono);

    if (getFranquicia) { // SI EL CIENTE ESTA AFILIADO SE HACE CON LAS COMISIONES

        switch (true) {

            // Identifica que tenga algun código 2000... en este caso el 2001, ES IGUAL A SI.
            case (codigoEstado == 2001 && clientMessage !== 'NO' || 'No' || 'no' || 'n'):
                var msg = base['confirmation'];
                await UsuarioDB.update(userId, { codigoEstado: msg.next_status });
                // Limpiamos cualquier envio abandonado
                await EnvireciModel.findOneAndDelete({ cuentaEmi: telefono, ope, sentido: 'D', estado: 'ENCURSO', $or: [{ cuentaReci: { $ne: null } }, { cuentaReci: { $eq: null } }] });

                payload = { code: 200, message: msg.message, encode: msg.encode_msg };

                break;
            case (codigoEstado == 2001 && clientMessage == 'NO' || 'No' || 'no' || 'n'):

                // Si manda NO devolvemos el estadoCodigo a 500 menu o inicio de sesion
                await UsuarioDB.update(userId, { codigoEstado: 500 });
                payload = {
                    code: 400,
                    message: `❎ _Proceso de envio anulado_`,
                    encode: false
                };
                break;
            case (codigoEstado == 2002): // Si se ha ingresado el telefono
                var msg = base['confirmation'];
                const tel = validarTel(clientMessage);
                if (tel) { // Validamos el numero introducido
                    // Verificamos antes si este cliente pudo abandonar un envio sin completar
                    const abandonado = await EnvireciModel.findOne({ cuentaEmi: telefono, ope, sentido: 'D', estado: 'ENCURSO', $or: [{ cuentaReci: { $ne: null } }, { cuentaReci: { $eq: null } }] });

                    if (abandonado) { // Si existe un registro abandonado lo reutilizamos
                        await EnvireciModel.findOneAndUpdate({ cuentaEmi: telefono, ope, sentido: 'D', estado: 'ENCURSO', $or: [{ cuentaReci: { $ne: null } }, { cuentaReci: { $eq: null } }] }, { cuentaReci: tel });
                    } else {

                        // Registramos el numero tel receptor operacion en el model envireci
                        const descripcion = "ENVIO DE DINERO FRANQ."
                        const data = {
                            referencia: `REF${generador(11)}`,
                            cuentaEmi: telefono,
                            cuentaReci: tel,
                            ope,
                            descripcion,
                            mensaje: "",
                            codigo: `COD${generador(6)}`,
                            sentido: "D",
                        }
                        const envi = new EnvireciModel(data);
                        await envi.save();

                        payload = { code: 200, message: msg.message, encode: msg.encode_msg };
                        await UsuarioDB.update(userId, { codigoEstado: msg.next_status });

                    }


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
                    await EnvireciModel.findOneAndUpdate({ cuentaEmi: telefono, sentido: 'D', estado: 'ENCURSO' }, { monto: validoSaldo.monto, comisionEmpresa: validoSaldo.comisionEmpresa, comisionRemitente: validoSaldo.comisionRemitente, comisionReceptor: validoSaldo.comisionReceptor });

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
COMISION GANADA: *${formatearNumeroComas(depositado.comisionRemitente)} XAF*
CODIGO: *${depositado.codigo}*
REFERENCIA: *${depositado.referencia}*
                        
💰 _Acorporado wallet_ 💰`;
                        const depositadoSMS = await EnvireciModel.findOneAndUpdate({ cuentaEmi: telefono, sentido: 'D', estado: 'DEPO', cn: 1 }, { mensaje: smsRemitente, cn: 0 });
                        // Buscamos ya la operacion en si para proceder a debitar y acreditar otras cuentas
                        const dataEnvio = await EnvireciModel.findOne({ referencia: depositadoSMS.referencia, cuentaEmi: telefono, });
                        // Debitamos la cuenta del cliente
                        let getSaldo = await Cuenta.findOne({ cuenta: telefono, descripcion: 'CUENTA_NORMAL' });
                        let getSaldoComisCliente = await Cuenta.findOne({ cuenta: telefono, descripcion: 'CUENTA_COMISIONES' });
                        let getSaldoComisEmpresa = await Cuenta.findOne({ descripcion: 'CUENTA_IN_COMISION_ENVIOS' });
                        const resta = parseInt(getSaldo.saldo) - parseInt(dataEnvio.monto + dataEnvio.comisionEmpresa + dataEnvio.comisionRemitente + dataEnvio.comisionReceptor)
                        await Cuenta.findOneAndUpdate({ cuenta: telefono, descripcion: 'CUENTA_NORMAL' }, { saldo: resta })
                        await Cuenta.findOneAndUpdate({ cuenta: telefono, descripcion: 'CUENTA_COMISIONES' }, { saldo: getSaldoComisCliente.saldo + dataEnvio.comisionRemitente })
                            // VENTILAR CUENTAS INTERNAS DE LA EMPRESA MANDANDO SUS COMISIONES
                        await Cuenta.findOneAndUpdate({ descripcion: 'CUENTA_IN_COMISION_ENVIOS' }, { saldo: getSaldoComisEmpresa.saldo + dataEnvio.comisionEmpresa })
                            // Ahora registramos la operacion como C= Credito disponible para el retiro del Beneficiario
                        const descripcion = "ENVIO DE DINERO FRANQ."
                        const data = {
                            referencia: dataEnvio.referencia,
                            cuentaEmi: telefono,
                            cuentaReci: dataEnvio.cuentaReci,
                            ope: dataEnvio.ope,
                            monto: dataEnvio.monto,
                            comisionReceptor: dataEnvio.comisionReceptor,
                            descripcion,
                            mensaje: `Ha recicibo un envio de parte de *${nombreCompleto}:*
REMITENTE: *${soloTelefono(dataEnvio.cuentaEmi)}*
MONTO: *${formatearNumeroComas(dataEnvio.monto)} XAF*
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


    } else {
        // SI EL CLIENTE NO ESTA AFILIADO PIERDE LAS COMISIONES DEL ENVIO

        switch (true) {

            // Identifica que tenga algun código 2000... en este caso el 2001, ES IGUAL A SI.
            case (codigoEstado == 2001 && clientMessage !== 'NO' || 'No' || 'no' || 'n'):
                var msg = base['confirmation'];
                await UsuarioDB.update(userId, { codigoEstado: msg.next_status });
                // Limpiamos cualquier envio abandonado
                await EnvireciModel.findOneAndDelete({ cuentaEmi: telefono, ope, sentido: 'D', estado: 'ENCURSO', $or: [{ cuentaReci: { $ne: null } }, { cuentaReci: { $eq: null } }] });

                payload = { code: 200, message: msg.message, encode: msg.encode_msg };

                break;
            case (codigoEstado == 2001 && clientMessage == 'NO' || 'No' || 'no' || 'n'):

                // Si manda NO devolvemos el estadoCodigo a 500 menu o inicio de sesion
                await UsuarioDB.update(userId, { codigoEstado: 500 });
                payload = {
                    code: 400,
                    message: `❎ _Proceso de envio anulado_`,
                    encode: false
                };
                break;
            case (codigoEstado == 2002): // Si se ha ingresado el telefono
                var msg = base['confirmation'];
                const tel = validarTel(clientMessage);
                if (tel) { // Validamos el numero introducido

                    // Verificamos antes si este cliente pudo abandonar un envio sin completar
                    const abandonado = await EnvireciModel.findOne({ cuentaEmi: telefono, ope, sentido: 'D', estado: 'ENCURSO', $or: [{ cuentaReci: { $ne: null } }, { cuentaReci: { $eq: null } }] });

                    if (abandonado) { // Si existe un registro abandonado lo reutilizamos
                        await EnvireciModel.findOneAndUpdate({ cuentaEmi: telefono, ope, sentido: 'D', estado: 'ENCURSO', $or: [{ cuentaReci: { $ne: null } }, { cuentaReci: { $eq: null } }] }, { cuentaReci: tel });
                    } else {

                        // Registramos el numero tel receptor operacion en el model envireci
                        const descripcion = "ENVIO DE DINERO NOFRANQ."
                        const data = {
                            referencia: `REF${generador(11)}`,
                            cuentaEmi: telefono,
                            cuentaReci: tel,
                            ope,
                            descripcion,
                            mensaje: "",
                            codigo: `COD${generador(6)}`,
                            sentido: "D",
                        }
                        const envi = new EnvireciModel(data);
                        await envi.save();

                        payload = { code: 200, message: msg.message, encode: msg.encode_msg };
                        await UsuarioDB.update(userId, { codigoEstado: msg.next_status });

                    }
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

                        const depositadoSMS = await EnvireciModel.findOneAndUpdate({ cuentaEmi: telefono, sentido: 'D', estado: 'DEPO', cn: 1 }, { mensaje: smsRemitente, cn: 0 });
                        // Buscamos ya la operacion en si para proceder a debitar y acreditar otras cuentas
                        const dataEnvio = await EnvireciModel.findOne({ referencia: depositadoSMS.referencia, cuentaEmi: telefono });
                        // Debitamos la cuenta del cliente
                        let getSaldo = await Cuenta.findOne({ cuenta: telefono, descripcion: 'CUENTA_NORMAL' });
                        let getSaldoComisEmpresa = await Cuenta.findOne({ descripcion: 'CUENTA_IN_COMISION_ENVIOS' });
                        const resta = parseInt(getSaldo.saldo) - parseInt(dataEnvio.monto + dataEnvio.comisionEmpresa + dataEnvio.comisionRemitente + dataEnvio.comisionReceptor)
                        await Cuenta.findOneAndUpdate({ cuenta: telefono, descripcion: 'CUENTA_NORMAL' }, { saldo: resta })

                        // VENTILAR CUENTAS INTERNAS DE LA EMPRESA MANDANDO SUS COMISIONES
                        await Cuenta.findOneAndUpdate({ descripcion: 'CUENTA_IN_COMISION_ENVIOS' }, { saldo: getSaldoComisEmpresa.saldo + dataEnvio.comisionEmpresa + dataEnvio.comisionReceptor })
                            // Ahora registramos la operacion como C= Credito disponible para el retiro del Beneficiario
                        const descripcion = "ENVIO DE DINERO NORM."
                        const data = {
                            referencia: dataEnvio.referencia,
                            cuentaEmi: telefono,
                            cuentaReci: dataEnvio.cuentaReci,
                            ope: dataEnvio.ope,
                            monto: dataEnvio.monto,
                            comisionReceptor: dataEnvio.comisionReceptor,
                            descripcion,
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

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////   RECIBIR EL DINERO INICIO     /////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Recibir un dinero o pagar alguien TIPO es ref de comision a tratar
const recibir = async(codigoEstado, clientMessage, telefono, userId, ope, nombreCompleto) => {

    let base = bot.status_code[codigoEstado];
    var payload;

    // Verificamos de inmediato si ya esta afiliado para aplicar un tipo de comisiones
    const getFranquicia = await UsuarioDB.buscarFranquicia(telefono);

    if (getFranquicia) { //// SI ES CLIENTE CON FRANQUICIA GANA EN RECIBIR/////////

        switch (true) {

            // Identifica que tenga algun código 3000... en este caso el 3001, ES IGUAL A SI.
            case (codigoEstado == 3001 && clientMessage !== 'NO' || 'No' || 'no' || 'n'):
                var msg = base['confirmation'];
                await UsuarioDB.update(userId, { codigoEstado: msg.next_status });
                payload = { code: 200, message: msg.message, encode: msg.encode_msg };

                break;
            case (codigoEstado == 3001 && clientMessage == 'NO' || 'No' || 'no' || 'n'):

                // Si manda NO devolvemos el estadoCodigo a 500 menu o inicio de sesion
                await UsuarioDB.update(userId, { codigoEstado: 500 });
                payload = {
                    code: 400,
                    message: `❎ _Proceso de pago anulado_`,
                    encode: false
                };
                break;
            case (codigoEstado == 3002): // Si se ha ingresado el CODIGO DE ENVIO
                var msg = base['confirmation'];
                // Filtramos incluso a que el mismo que envia no reciba cuentaEmi $ne telefono
                var getenvioCOD = await EnvireciModel.findOne({ codigo: clientMessage, sentido: 'C', estado: 'ENCURSO', cuentaEmi: { $ne: telefono } });

                if (getenvioCOD) { // Validamos el codigo introducido

                    payload = { code: 200, message: msg.message, encode: msg.encode_msg, messageDetalle: getenvioCOD.mensaje };
                    await UsuarioDB.update(userId, { codigoEstado: msg.next_status });

                } else {
                    payload = {
                        code: 400,
                        message: `❌ El código no es válido, *Igrese otra vez*`,
                        encode: false
                    };

                }
                break;

            case (codigoEstado == 3003): // Si el usuario ha confirmao el codigo del ENVIO

                var msg = base['confirmation'];
                // Busca el codigo
                var getenvioCOD = await EnvireciModel.findOne({ codigo: clientMessage, sentido: 'C', estado: 'ENCURSO' });
                if (getenvioCOD) { // Validamos el codigo introducido
                    // Actualizamos el recibo estado y ope
                    const pagado = await EnvireciModel.findOneAndUpdate({ codigo: clientMessage, sentido: 'C', estado: 'ENCURSO' }, { ope, estado: 'PAGADO', pagadoPor: `${telefono}:${nombreCompleto}` });

                    // Abonamos sus cuentas: monto enviado y monto comisiones a ganar
                    var getSaldo = await Cuenta.findOne({ cuenta: telefono, descripcion: 'CUENTA_NORMAL' });
                    var getSaldoComisCliente = await Cuenta.findOne({ cuenta: telefono, descripcion: 'CUENTA_COMISIONES' });
                    const suma = parseInt(getSaldo.saldo) + parseInt(pagado.monto) // Sumar monto envio
                    const sumaCom = parseInt(getSaldoComisCliente.saldo) + parseInt(pagado.comisionReceptor) // Sumar monto comision
                    await Cuenta.findOneAndUpdate({ cuenta: telefono, descripcion: 'CUENTA_NORMAL' }, { saldo: suma })
                    await Cuenta.findOneAndUpdate({ cuenta: telefono, descripcion: 'CUENTA_COMISIONES' }, { saldo: sumaCom })

                    let notificacion = '🏛↙ _Hemos abonado su cuenta normal y de comisiones_ 💰'
                    payload = { code: 200, message: msg.message, encode: msg.encode_msg, messageDetalle: notificacion };
                    await UsuarioDB.update(userId, { codigoEstado: msg.next_status });

                    // Tambien incluimos enviar acuse de recibo
                    notificacion = '🚩 _*El envio referente se ha cobrado*_ 👆'
                    payload = { code: 200, message: msg.message, encode: msg.encode_msg, messageDetalle: getenvioCOD.mensaje, messageNotif: notificacion, tel: pagado.cuentaEmi };
                    await UsuarioDB.update(userId, { codigoEstado: msg.next_status });

                } else {
                    payload = {
                        code: 400,
                        message: `❌ El código no es válido\n*Confirma otra vez*`,
                        encode: false
                    };

                }

                break;

            default:
                payload = { code: 404 };
        }


    } else {
        // SI EL CLIENTE NO ESTA AFILIADO Y QUIERE PAGAR ALGUIEN O COBRAR SU DIENRO PIERDE
        switch (true) {

            // Identifica que tenga algun código 3000... en este caso el 3001, ES IGUAL A SI.
            case (codigoEstado == 3001 && clientMessage !== 'NO' || 'No' || 'no' || 'n'):
                var msg = base['confirmation'];
                await UsuarioDB.update(userId, { codigoEstado: msg.next_status });
                payload = { code: 200, message: msg.message, encode: msg.encode_msg };

                break;
            case (codigoEstado == 3001 && clientMessage == 'NO' || 'No' || 'no' || 'n'):

                // Si manda NO devolvemos el estadoCodigo a 500 menu o inicio de sesion
                await UsuarioDB.update(userId, { codigoEstado: 500 });
                payload = {
                    code: 400,
                    message: `❎ _Proceso de pago anulado_`,
                    encode: false
                };
                break;
            case (codigoEstado == 3002): // Si se ha ingresado el CODIGO DE ENVIO
                var msg = base['confirmation'];
                // Filtramos incluso a que el mismo que envia no reciba cuentaEmi $ne telefono
                var getenvioCOD = await EnvireciModel.findOne({ codigo: clientMessage, sentido: 'C', estado: 'ENCURSO', cuentaEmi: { $ne: telefono } });

                if (getenvioCOD) { // Validamos el codigo introducido

                    payload = { code: 200, message: msg.message, encode: msg.encode_msg, messageDetalle: getenvioCOD.mensaje };
                    await UsuarioDB.update(userId, { codigoEstado: msg.next_status });

                } else {
                    payload = {
                        code: 400,
                        message: `❌ El código no es válido, *Igrese otra vez*`,
                        encode: false
                    };

                }
                break;

            case (codigoEstado == 3003): // Si el usuario ha confirmao el codigo del ENVIO

                var msg = base['confirmation'];
                // Busca el codigo
                var getenvioCOD = await EnvireciModel.findOne({ codigo: clientMessage, sentido: 'C', estado: 'ENCURSO', cuentaEmi: { $ne: telefono } });
                if (getenvioCOD) { // Validamos el codigo introducido
                    // Actualizamos el recibo estado y ope
                    const pagado = await EnvireciModel.findOneAndUpdate({ codigo: clientMessage, sentido: 'C', estado: 'ENCURSO', cuentaEmi: { $ne: telefono } }, { ope, estado: 'PAGADO', pagadoPor: `${telefono}:${nombreCompleto}` });

                    // Abonamos sus cuentas: monto enviado y monto comisiones a ganar
                    var getSaldo = await Cuenta.findOne({ cuenta: telefono, descripcion: 'CUENTA_NORMAL' });
                    // Si no estan afiliados las comisiones van a la cuenta INterna de Comisiones de envios de la empresa
                    let getSaldoComisEmpresa = await Cuenta.findOne({ descripcion: 'CUENTA_IN_COMISION_ENVIOS' });

                    const suma = parseInt(getSaldo.saldo) + parseInt(pagado.monto) // Sumar monto envio
                    const sumaCom = parseInt(getSaldoComisEmpresa.saldo) + parseInt(pagado.comisionReceptor) // Sumar monto comision
                    await Cuenta.findOneAndUpdate({ cuenta: telefono, descripcion: 'CUENTA_NORMAL' }, { saldo: suma })
                    await Cuenta.findOneAndUpdate({ descripcion: 'CUENTA_IN_COMISION_ENVIOS' }, { saldo: sumaCom })

                    // Ponemos comisionesReceptor en negativo del monto perdido
                    await EnvireciModel.findOneAndUpdate({ codigo: clientMessage, sentido: 'C', estado: 'PAGADO', cuentaEmi: { $ne: telefono } }, { comisionReceptor: -(pagado.comisionReceptor) });

                    let notificacion = '🏛↙ _Hemos abonado su cuenta normal_ 💰\n🔔 _Perdio las comisiones por no afiliarse_'
                    payload = { code: 200, message: msg.message, encode: msg.encode_msg, messageDetalle: notificacion };
                    await UsuarioDB.update(userId, { codigoEstado: msg.next_status });

                    // Tambien incluimos enviar acuse de recibo
                    notificacion = '🚩 _*El envio referente se ha cobrado*_ 👆'
                    payload = { code: 200, message: msg.message, encode: msg.encode_msg, messageDetalle: getenvioCOD.mensaje, messageNotif: notificacion, tel: pagado.cuentaEmi };
                    await UsuarioDB.update(userId, { codigoEstado: msg.next_status });

                } else {
                    payload = {
                        code: 400,
                        message: `❌ El código no es válido\n*Confirma otra vez*`,
                        encode: false
                    };

                }

                break;

            default:
                payload = { code: 404 };
        }



    }


    return payload;

}



module.exports = {
    enviar,
    recibir
}