const Cuenta = require("./../cuentas/cuenta.model") // Mi modelo de cuentas
const { formatearNumeroComas, soloTelefono, verificarSaldoRetiro, verificarSaldoComisiones } = require('../../helpers/cuenta.helper') // 
const UsuarioDB = require("../users/user.db"); // Se llama las funciones de la base de datos
const bot = require("../../utils/botDb"); // Se llama y se lee el bot.json para para controlar estados y Bingo
const { generador } = require("../../helpers/contabilidad.helper");
const EnvireciModel = require("../contabilidad/envireci.model");


// Crea una cuenta
const crearCuenta = async(codigoEstado, telefono, userId) => {

    var payload;

    switch (true) {
        // Identifica que tenga algun código en el proceso de creacion del usuario 104 registro de PIN, cuenta normal
        case (codigoEstado == 104):

            // Generar nuestra data a guardar en cuentas, los que no aparecen tienen valores por defectos: ej estado:true
            const data = {
                cuenta: telefono,
                usuario: userId
            }

            const cuenta = new Cuenta(data);
            await cuenta.save();
            // payload es lo que se enviara en whatsapp.js usando sendMessage, aqui es imposible
            payload = {
                code: 200,
                message: `*Hemos creado su cuenta*
---------------------
               
🏛 CUENTA: *${cuenta.cuenta}*
💰 SALDO: *${formatearNumeroComas(cuenta.saldo)} XAF*
💵 ${cuenta.descripcion}
               
    _Recárguela_
 _Usa una tarjeta_ `,
            };
            break;

            // Creacion de cuenta de comisiones si elije la franquicia, EN ESPERA ELEGIR LA FASE
            // Con el codigo 6001 creamos la cuenta de comisiones 
        case (codigoEstado == 6001):
            // Generar nuestra data a guardar en cuentas, los que no aparecen tienen valores por defectos: ej estado:true
            const dataC = {
                cuenta: telefono,
                descripcion: 'CUENTA_COMISIONES',
                usuario: userId
            }

            const cuentaC = new Cuenta(dataC);
            await cuentaC.save();

            payload = {
                code: 200,
                message: `*Hemos creado su cuenta*
---------------------
               
🏛 CUENTA: *${soloTelefono(cuentaC.cuenta)}*
💰 SALDO: *${cuentaC.saldo} XAF*
💵 ${cuentaC.descripcion}
               
    _Recárguela_
_Realizando envios y pagos_ `,
            };

            break;

        default:
            payload = { code: 404 };
    }

    return payload;

}

// Ver estado de cuenta cada vez que se requiera
const verCuenta = async(telefono, userId, recarga, descargar) => {

    var payload;

    // Consulta de cuenta por telefono number
    var getSaldo = await Cuenta.findOne({ cuenta: telefono, descripcion: 'CUENTA_NORMAL' }); // Se envia como OBJETO

    // Si hemos recibido un valor de la variable recarga
    if (recarga) {
        const suma = getSaldo.saldo + recarga
        await Cuenta.findOneAndUpdate({ cuenta: telefono, descripcion: 'CUENTA_NORMAL' }, { saldo: suma })

    }

    // Estado de cuenta despues de las operaciones descripcion: 'CUENTA_NORMAL'
    var totalCuentas = await Cuenta.find({ cuenta: telefono }).countDocuments();
    var getSaldoRes = await Cuenta.find({ cuenta: telefono });

    // payload es lo que se enviara en whatsapp.js usando sendMessage, aqui es imposible
    console.log(totalCuentas)
    if (totalCuentas == 1) {


        payload = {
            code: 200,
            message: `*OPCIONES*
*Envia:*
+--------------🌐----------------+
  *101 ->* Retirar efectivo *QR* 💶
+--------------🌐----------------+

_*ESTADO DE SUS CUENTAS*_
----------------------------------
               
🏛 CORRIENTE: *${soloTelefono(getSaldoRes[0].cuenta)}*
💰 SALDO: *${formatearNumeroComas(getSaldoRes[0].saldo)} XAF*
---------------------------------

    _Recárguela más_
    _Usa una tarjeta_ `
        };

    } else {

        payload = {
            code: 200,
            message: `*OPCIONES*
*Envia:*
+--------------🌐----------------+
  *101 ->* Retirar efectivo *QR* 💶    
  *102 ->* Pasar comisiones 🏛    
+--------------🌐----------------+

_*ESTADO DE SUS CUENTAS*_
----------------------------------
               
🏛 CORRIENTE: *${soloTelefono(getSaldoRes[0].cuenta)}*
💰 SALDO: *${formatearNumeroComas(getSaldoRes[0].saldo)} XAF*
---------------------------------
👷 COMISIONES: *${soloTelefono(getSaldoRes[1].cuenta)}*
💙 SALDO: *${formatearNumeroComas(getSaldoRes[1].saldo)} XAF*

    _Recárguelas más_
    _Usa una tarjeta_ `
        };

    }
    return payload;

}


//RETIRAR EFECTIVO , TIPO es ref de comision a tratar
const retirarEfectivo = async(codigoEstado, clientMessage, telefono, userId, tipo, ope, nombreCompleto) => {

    let base = bot.status_code[codigoEstado];
    var payload;

    // Formateando el mensaje recibido para pago con cadena de datos
    const cadena = clientMessage
    const modulo = cadena.split('@')[0]
    const telBeneficiario = cadena.split('@')[1] + '@c.us'
    const precio = parseInt(cadena.split(':')[1])

    var msg = base['confirmation'];
    var msg = bot.init[modulo]

    const validoSaldo = await verificarSaldoRetiro(telefono, precio, tipo);
    if (validoSaldo) { // Validamos el saldo si es suficiente

        // Preparamos y registramos los datos de pago de servicio, aqui el que paga es como Remitente

        const referencia = `REF${generador(11)}`
        const codigo = `COD${generador(6)}`

        const mensaje = `♻ Ha realizado un retiro de *${formatearNumeroComas(precio)}:*

BENEFICIARIO: *${soloTelefono(telBeneficiario)}*
COMISION RETENIDA: *${formatearNumeroComas(validoSaldo.lineaComision)} XAF*
COMISION GANADA: *${formatearNumeroComas(validoSaldo.comisionReceptor)} XAF*
CODIGO: *${codigo}*
REFERENCIA: *${referencia}*
                     
    💰 _Acorporado wallet_ 💰`;
        // Registramos el debito del que paga
        const data = {
            referencia,
            cuentaEmi: telBeneficiario, // El que le da el efectivo
            cuentaReci: telefono,
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
        const mensajeB = `💙 Ha recicibo un ingreso de parte de *${nombreCompleto} por pago de efectivo:*

REMITENTE: *${soloTelefono(telefono)}*
MONTO: *${formatearNumeroComas(precio)} XAF*
COMISION GANADA: *${formatearNumeroComas(validoSaldo.comisionRemitente)} XAF*
CODIGO: *${codigo}*
REFERENCIA: _${referencia}_
            
    💰 _Acorporado wallet_ 💰`
        const data2 = {
            referencia,
            cuentaEmi: telBeneficiario,
            cuentaReci: telefono,
            ope: 102, // Codigo por recibir o pagarle a alguien un efectivo
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
        const resta = parseInt(getSaldo.saldo) - parseInt(validoSaldo.margen)
        await Cuenta.findOneAndUpdate({ cuenta: telefono, descripcion: 'CUENTA_NORMAL' }, { saldo: resta })
            // Pasamos el monto al haber del que le da efectivo
        let getSaldoP = await Cuenta.findOne({ cuenta: telBeneficiario, descripcion: 'CUENTA_NORMAL' });
        const suma = parseInt(getSaldoP.saldo) + parseInt(validoSaldo.monto)
        await Cuenta.findOneAndUpdate({ cuenta: telBeneficiario, descripcion: 'CUENTA_NORMAL' }, { saldo: suma })
        let getSaldoPC = await Cuenta.findOne({ cuenta: telBeneficiario, descripcion: 'CUENTA_COMISIONES' });
        const sumaPC = parseInt(getSaldoPC.saldo) + parseInt(validoSaldo.comisionRemitente)
        await Cuenta.findOneAndUpdate({ cuenta: telBeneficiario, descripcion: 'CUENTA_COMISIONES' }, { saldo: sumaPC })
            // Ventilamos ganancias de la empresa
        let getSaldoComisEmpresa = await Cuenta.findOne({ descripcion: 'CUENTA_IN_COMISION_EFECTIVOS' });
        // VENTILAR CUENTAS INTERNAS DE LA EMPRESA MANDANDO SUS COMISIONES
        await Cuenta.findOneAndUpdate({ descripcion: 'CUENTA_IN_COMISION_EFECTIVOS' }, { saldo: getSaldoComisEmpresa.saldo + validoSaldo.comisionEmpresa })

        await UsuarioDB.update(userId, { codigoEstado: msg.next_status })
            // Mandamos este tel: data.cuentaReci para que reciba el beneficiario este sms si tiene whatsapp
            // EN EL FUTURO SE DEBE MANDARLE SMS NORMAL AL MOVIL SI NO TIENE WHATSAPP O INCLUSIVE
            // Pasamos en el payload todos los mensajes a recibir segun proceso, tel aqui es del beneficiario del pago
        payload = { code: 200, message: msg.message, messageRemitente: mensajeB, messageReceptor: mensaje, encode: msg.encode_msg, tel: telBeneficiario };


    } else {
        payload = {
            code: 400,
            message: `❌ Saldo insuficiente para retirar 👁,\n*🚩 Escanea más e igrese otro monto*`,
            encode: false
        };

    }


    return payload;

}

///
const pasarComisiones = async(codigoEstado, clientMessage, telefono, userId, tipo, ope) => {
    let base = bot.status_code[codigoEstado];
    var payload;
    var msg = base['confirmation'];

    const validoSaldo = await verificarSaldoComisiones(telefono);
    if (validoSaldo) { // Validamos el saldo si es suficiente

        // Preparamos y registramos los datos del retiro

        const referencia = `REF${generador(11)}`
        const codigo = `COD${generador(6)}`
        const descripcion = 'PASO DE COMISIONES'

        const mensaje = `♻ Ha realizado un paso de comisiones de *${formatearNumeroComas(validoSaldo.saldo)} XAF:*

BENEFICIARIO: *EL MISMO*
CODIGO: *${codigo}*
REFERENCIA: *${referencia}*
                     
    💰 _Acorporado wallet_ 💰`;
        // Registramos el debito del que retira
        const data = {
            referencia,
            cuentaEmi: telefono, // El que le da el efectivo
            cuentaReci: telefono,
            ope,
            monto: validoSaldo.saldo,
            descripcion,
            mensaje,
            codigo,
            sentido: "D",
            estado: 'PAGADO'
        }
        const envi = new EnvireciModel(data);
        await envi.save();

        // Registramos el credito del que es pagado
        const data2 = {
            referencia,
            cuentaEmi: telefono, // El mismo
            cuentaReci: telefono,
            ope,
            monto: validoSaldo.saldo,
            descripcion,
            mensaje,
            codigo,
            sentido: "C",
            estado: 'DEPO'
        }
        const envi2 = new EnvireciModel(data2);
        await envi2.save();


        // Actualizamos las cuentas y ajustamos la contabiidad
        // Debitamos la cuenta DE COMISIONES del cliente
        let getSaldo = await Cuenta.findOne({ cuenta: telefono, descripcion: 'CUENTA_COMISIONES' });
        const resta = parseInt(getSaldo.saldo) - parseInt(validoSaldo.saldo)
        await Cuenta.findOneAndUpdate({ cuenta: telefono, descripcion: 'CUENTA_COMISIONES' }, { saldo: resta })
            // Pasamos el monto al haber del mismo
        let getSaldoP = await Cuenta.findOne({ cuenta: telefono, descripcion: 'CUENTA_NORMAL' });
        const suma = parseInt(getSaldoP.saldo) + parseInt(validoSaldo.saldo)
        await Cuenta.findOneAndUpdate({ cuenta: telefono, descripcion: 'CUENTA_NORMAL' }, { saldo: suma })

        // Mandamos este tel: data.cuentaReci para que reciba el beneficiario este sms si tiene whatsapp
        // EN EL FUTURO SE DEBE MANDARLE SMS NORMAL AL MOVIL SI NO TIENE WHATSAPP O INCLUSIVE
        // Pasamos en el payload todos los mensajes a recibir segun proceso, tel aqui es del beneficiario del pago
        payload = { code: 200, message: msg.message, messageReceptor: mensaje, encode: msg.encode_msg };


    } else {
        payload = {
            code: 400,
            message: `❌ Saldo insuficiente de comisiones 👁,\n*🚩 Haga más envios*`,
            encode: false
        };

    }

    return payload;
}





module.exports = {
    crearCuenta,
    verCuenta,
    retirarEfectivo,
    pasarComisiones
}