const Tarjeta = require("./../tarjetas/tarjeta.model") // Mi modelo de tarjetas
const Recarga = require("./../tarjetas/recarga.model"); // Mi modelo de tarjetas
const { generador } = require("../../helpers/contabilidad.helper");
const { formatearNumeroComas } = require("../../helpers/cuenta.helper");
const EnvireciModel = require("../contabilidad/envireci.model");
const Cuenta = require("../cuentas/cuenta.model");



// Recargar cuenta
const recargarCuenta = async(codigoEstado, clientMessage, telefono, userId, tipo, ope, telEmpresa) => {

    var payload;

    // Formateando el mensaje recibido para pago con cadena de datos
    const cadena = clientMessage
    const modulo = cadena.split('@')[0]
    const codigoTarjeta = cadena.split('@')[1]

    // Buscamos antes el numero de la tarjeta introducido
    var getTarjeta = await Tarjeta.findOne({ numeroTarjeta: codigoTarjeta, estado: 'vigente' }); // Se envia como OBJETO
    // Si existe registramos la recarga y cambiamos estado de la tarjeta
    if (getTarjeta) {
        // Generar nuestra data (recarga) a guardar
        const dataRecarga = {
            telUsuario: telefono,
            montoRecarga: getTarjeta.valorUnidad,
            codigoTarjeta: getTarjeta.id_tajeta
        }

        const recarga = new Recarga(dataRecarga);
        await recarga.save();
        // Preparamos y registramos los datos del retiro

        const referencia = `REF${generador(11)}`
        const codigo = `COD${generador(6)}`
        const descripcion = `RECARGA DE TARJETA ${codigoTarjeta}`

        const mensaje = `♻ ↗ *Proceda con sus operaciones* 💰\n_Ha recargado una tarjeta de *${formatearNumeroComas(getTarjeta.valorUnidad)} XAF*_:*

TARJETA: *${codigoTarjeta}*
CODIGO: *${codigo}*
REFERENCIA: *${referencia}*
                     
    💰 _Acorporado wallet_ 💰`;

        // Registramos el debito del que retira
        const data = {
            referencia,
            cuentaEmi: telEmpresa, // La cuenta del sistema para tarjetas
            cuentaReci: telefono,
            ope,
            monto: getTarjeta.valorUnidad,
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
            cuentaEmi: telEmpresa, // El mismo
            cuentaReci: telefono,
            ope,
            monto: getTarjeta.valorUnidad,
            descripcion,
            mensaje,
            codigo,
            sentido: "C",
            estado: 'DEPO'
        }
        const envi2 = new EnvireciModel(data2);
        await envi2.save();


        // Actualizamos el estado de la tarjeta
        await Tarjeta.findOneAndUpdate({ numeroTarjeta: codigoTarjeta }, { estado: 'usada' });

        // Solo vamos debitar la cuenta interna del monto global de tarjetas aqui.
        var getSaldoGlobTar = await Cuenta.findOne({ descripcion: 'CUENTA_IN_GLOBAL_TARJETAS' });
        const resta = parseInt(getSaldoGlobTar.saldo) + parseInt(getTarjeta.valorUnidad) // Restar monto tarjeta
        await Cuenta.findOneAndUpdate({ descripcion: 'CUENTA_IN_GLOBAL_TARJETAS' }, { saldo: resta })

        // Enviamos la respuesta de exito, mandamos a recargar al cliente
        payload = {
            code: 200,
            valorRecarga: getTarjeta.valorUnidad, // Este valor se ira a acreditar al cliente su saldo
            messageDetalle: mensaje
        };

        // Si no existe el numero de tarjeta o se ha usado
    } else {
        payload = {
            code: 400,
            message: `❌ El codigo es incorrecto o tarjeta usada 🤦`
        };
    };

    return payload;

}



module.exports = {
    recargarCuenta
}