const Cuenta = require('../components/cuentas/cuenta.model')
const configcomisionesModel = require("../components/contabilidad/configcomisiones.model");
// Funcion para formatesr losmontos con comas de miles  y puntos decimales
function formatearNumeroComas(x) {
    return x.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
}

const soloTelefono = (msg) => {
    let number = msg.slice(0, -5); // Omitir solo los tres últimos caracteres
    return number;
}


// Funcion para verificar el saldo suficiente
const verificarSaldo = async(telefono, monto, tipo) => {
    var payload;
    // Tomamos la linea sw comision antes, segun monto a enviar
    const lineaComision = await configcomisionesModel.findOne({ tipo: tipo, montoMin: { $lt: monto }, montoMax: { $gte: monto } })
        // Sumamos el monto a enviar + monto de comision obtenida para hacer la veificacion de saldo suficiente
    const margen = parseInt(monto) + parseInt(lineaComision.comision)
    console.log(margen)
        // Consulta de cuenta por telefono y monto margen a enviar
    const getSaldo = await Cuenta.findOne({ cuenta: telefono, descripcion: 'CUENTA_NORMAL', saldo: { $gte: margen } }); // Se envia como OBJETO
    // Si hemos recibido un valor de la variable getSaldo
    if (getSaldo) {
        // Antes obtenemos el monto aplicado a un porcentaje de comision de la linea de comision a cobrar al remitente
        const comisionEmpresa = lineaComision.comision * lineaComision.porcentajeEmpresa / 100;
        const comisionRemitente = lineaComision.comision * lineaComision.porcentajeRemitente / 100;
        const comisionReceptor = lineaComision.comision * lineaComision.porcentajeReceptor / 100;
        payload = {
            lineaComision,
            margen,
            monto,
            comisionEmpresa,
            comisionRemitente,
            comisionReceptor
        }


    }

    return payload;

}


// Funcion para verificar el saldo suficiente SI ES PAGO DE SERVICIO
const verificarSaldoServicio = async(telefono, monto, tipo) => {
    var payload;
    // Tomamos la linea sw comision antes, segun monto a enviar TIPO es configComision
    const porcentajeComision = await configcomisionesModel.findOne({ tipo: tipo })
        // Sumamos el monto a enviar + monto de comision obtenida para hacer la veificacion de saldo suficiente
    const margen = parseInt(monto) + parseInt((monto * porcentajeComision.comision / 100))
    console.log(margen)
        // Consulta de cuenta por telefono y monto margen a enviar
    const getSaldo = await Cuenta.findOne({ cuenta: telefono, descripcion: 'CUENTA_NORMAL', saldo: { $gte: margen } }); // Se envia como OBJETO
    // Si hemos recibido un valor de la variable getSaldo
    if (getSaldo) {
        // Antes obtenemos el monto de la comision restando margen el monto de pago recibido PARA EL QUE PAGA
        const comisionEmpresa = (margen - monto) * porcentajeComision.porcentajeEmpresa / 100;
        const comisionRemitente = (margen - monto) * porcentajeComision.porcentajeRemitente / 100;
        const comisionReceptor = (margen - monto) * porcentajeComision.porcentajeReceptor / 100;
        payload = {
            lineaComision: (margen - monto),
            margen,
            monto,
            comisionEmpresa,
            comisionRemitente,
            comisionReceptor
        }


    }

    return payload;

}


// Funcion para verificar el saldo suficiente SI ES PAGO DE SERVICIO
const validoSaldoFACT = async(telefono, monto, tipo) => {
    var payload;
    // Tomamos la linea sw comision antes, segun monto a enviar TIPO es configComision
    const porcentajeComision = await configcomisionesModel.findOne({ tipo: tipo })
        // Sumamos el monto a enviar + monto de comision obtenida para hacer la veificacion de saldo suficiente
    const margen = parseInt(monto) + parseInt((porcentajeComision.comision))
    console.log(margen)
        // Consulta de cuenta por telefono y monto margen a enviar
    const getSaldo = await Cuenta.findOne({ cuenta: telefono, descripcion: 'CUENTA_NORMAL', saldo: { $gte: margen } }); // Se envia como OBJETO
    // Si hemos recibido un valor de la variable getSaldo
    if (getSaldo) {
        // Antes obtenemos el monto de la comision restando margen el monto de pago recibido PARA EL QUE PAGA
        const comisionEmpresa = porcentajeComision.comision * porcentajeComision.porcentajeEmpresa / 100;
        const comisionRemitente = porcentajeComision.comision * porcentajeComision.porcentajeRemitente / 100;
        const comisionReceptor = porcentajeComision.comision * porcentajeComision.porcentajeReceptor / 100;
        payload = {
            lineaComision: (margen - monto),
            comisionST: porcentajeComision.comision,
            margen,
            monto,
            comisionEmpresa,
            comisionRemitente,
            comisionReceptor
        }


    }

    return payload;

}


// Funcion para verificar el saldo suficiente SI ES RETIRO DE EFECTIVO
const verificarSaldoRetiro = async(telefono, monto, tipo) => {
    var payload;
    // Tomamos la linea sw comision antes, segun monto a enviar
    const lineaComisionR = await configcomisionesModel.findOne({ tipo, montoMin: { $lte: monto }, montoMax: { $gte: monto } });
    //const porcentajeComision = await configcomisionesModel.findOne({ tipo: tipo })
    // Sumamos el monto a enviar + monto de comision obtenida para hacer la veificacion de saldo suficiente
    const margen = parseInt(monto) + parseInt((lineaComisionR.comision))
    console.log(margen)
        // Consulta de cuenta por telefono y monto margen a enviar
    const getSaldo = await Cuenta.findOne({ cuenta: telefono, descripcion: 'CUENTA_NORMAL', saldo: { $gte: margen } }); // Se envia como OBJETO
    // Si hemos recibido un valor de la variable getSaldo
    if (getSaldo) {
        // Antes obtenemos el monto de la comision restando margen el monto de pago recibido PARA EL QUE PAGA
        const comisionEmpresa = lineaComisionR.comision * lineaComisionR.porcentajeEmpresa / 100;
        // La persona que entrega el efectivo
        const comisionRemitente = lineaComisionR.comision * lineaComisionR.porcentajeRemitente / 100;
        const comisionReceptor = lineaComisionR.comision * lineaComisionR.porcentajeReceptor / 100;
        payload = {
            lineaComision: (margen - monto),
            comisionST: lineaComisionR.comision,
            margen,
            monto,
            comisionEmpresa,
            comisionRemitente,
            comisionReceptor
        }


    }

    return payload;

}

// Funcion para verificar el saldo suficiente RETIRA COMISIONES
const verificarSaldoComisiones = async(telefono) => {
    var payload;
    // Tomamos la consulta de su cuenta de comisiones
    const getSaldo = await Cuenta.findOne({ cuenta: telefono, descripcion: 'CUENTA_COMISIONES', saldo: { $gte: 0 } });
    // Si hemos recibido un valor de la variable getSaldo
    if (getSaldo) {

        payload = {
            saldo: getSaldo.saldo
        }

    }

    return payload;

}

// Funcion para verificar el saldo suficiente SI ES PAGO DE SERVICIO
const verificarPDFadjunto = async(mimetype) => {
    var payloa;
    // Tomamos el tipo que debe ser
    if (mimetype != 'application/pdf') {
        payloa = false
    } else { payloa = true }

    return payloa;

}



module.exports = {
    formatearNumeroComas,
    soloTelefono,
    verificarSaldo,
    verificarSaldoServicio,
    verificarPDFadjunto,
    validoSaldoFACT,
    verificarSaldoRetiro,
    verificarSaldoComisiones
}