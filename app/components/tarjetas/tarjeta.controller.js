const Cuenta = require("../cuentas/cuenta.model") // Mi modelo de cuentas

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
               
🏛 CUENTA CORRIENTE: *${cuenta.cuenta}*
💰 SALDO: *${cuenta.saldo} XAF*
               
    _Recárguela_
    _Usa una tarjeta_ `,
            };
            break;

            // Creacion de cuenta de comisiones si elije la franquicia, EN ESPERA ELEGIR LA FASE
        case (codigoEstado == 888):

            var msg = base['confirmation'];
            await UsuarioDB.update(userId, { pin: await bcrypt.genHash(clientMessage), codigoEstado: msg.next_status, estaRegistrado: true });
            payload = { code: 200, message: msg.message, encode: msg.encode_msg };
            break;

        default:
            payload = { code: 404 };
    }

    return payload;

}



module.exports = {
    crearCuenta
}