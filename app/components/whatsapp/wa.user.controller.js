const UsuarioDB = require("../users/user.db"); // Se llama las funciones de la base de datos
const bcrypt = require("../../utils/bcrypt");
const bot = require("../../utils/botDb"); // Se llama y se lee el bot.json para para controlar estados y Bingo

// Función webhook registra 1 vez a todo usuario que escribe por whatsapp
const webhook = async(from, message) => {


    // Es el telefono de la BD
    let payload = { "telefono": from };
    console.log(payload)
        // Se crea el usuario que escribio en labase de datos
    const getUsuario = await UsuarioDB.findOrCreate(payload);
    return getUsuario;

}

// Crea un usuario
const createUser = async(codigoEstado, clientMessage, userId) => {

    let base = bot.status_code[codigoEstado];
    var payload;

    switch (true) {
        // Identifica que tenga algun código 100... en este caso el 101
        case (codigoEstado == 101):
            var msg = base['confirmation'];
            // Si el usuario tiene el código 101 y envio un texto, significa que es su nombre
            // Aquí UsuarioDB.update(Envia el userID es el _id o uid)
            await UsuarioDB.update(userId, { nombreCompleto: clientMessage, codigoEstado: msg.next_status });
            // payload es lo que se enviara
            payload = {
                code: 200,
                message: `*${clientMessage}*, ${msg.message}`,
                encode: msg.encode_msg
            };
            break;
            // 102 signiica que que le esta solicitando el ciudad, verificar en bot.json
        case (codigoEstado == 102):

            var msg = base['confirmation'];
            await UsuarioDB.update(userId, { ciudad: clientMessage, codigoEstado: msg.next_status });
            payload = { code: 200, message: msg.message, encode: msg.encode_msg };
            break;

            // Solicita email
        case (codigoEstado == 103):

            var msg = base['confirmation'];
            await UsuarioDB.update(userId, { correo: clientMessage, codigoEstado: msg.next_status });
            payload = { code: 200, message: msg.message, encode: msg.encode_msg };
            break;
            // Solicita codigo PIN que usara para iniciar sesion.
            // password o PIN y lo encripta
        case (codigoEstado == 104):

            var msg = base['confirmation'];
            await UsuarioDB.update(userId, { pin: await bcrypt.genHash(clientMessage), codigoEstado: msg.next_status, estaRegistrado: true });
            payload = { code: 200, message: msg.message, encode: msg.encode_msg };
            break;

        default:
            payload = { code: 404 };
    }

    return payload;

}


// Esta es únicamente para iniciar sesión
const login = async(codigoEstado, clientMessage, userId, telefonoId) => {

    let base = bot.status_code[codigoEstado];
    var payload;

    switch (true) {
        // Busca si existe el usuario
        case (codigoEstado == 201):
            var msg = base['confirmation'];
            var getUsuario = await UsuarioDB.findOne({ correo: clientMessage }); // Se envia como OBJETO
            console.log(getUsuario);
            // Si existe actualiza el código
            if (getUsuario) {
                await UsuarioDB.update(userId, { codigoEstado: msg.next_status });
                payload = {
                    code: 200,
                    message: `*💚${getUsuario.nombreCompleto}*, ${msg.message}`,
                    encode: msg.encode_msg
                };
                // Si no existe el email ingresado
            } else {
                payload = {
                    code: 200,
                    message: `❌ El email ingresado no se encuentra registrado`,
                    encode: msg.encode_msg
                };
            };

            break;
            // Busca al usuario que esta escribiendo por medio del telefono en BD
        case (codigoEstado == 202):
            {
                var msg = base['confirmation'];
                // Busca el usuario
                var getUsuarioWhatsapp = await UsuarioDB.findTelefono(telefonoId) // Se envia el dato en si
                if (getUsuarioWhatsapp) {
                    // Si existe, lee el PIN enviado
                    var validPassword = await bcrypt.verifyPin(clientMessage, getUsuarioWhatsapp.pin);
                    // Si es password es correcto inicia sesión
                    if (validPassword) {

                        await UsuarioDB.update(userId, { codigoEstado: msg.next_status })
                        payload = {
                                code: 200,
                                message: `🤹 *${getUsuarioWhatsapp.nombreCompleto} ${getUsuarioWhatsapp.rol}*,
Iniciaste sesión correctamente 🎉✅
Puedes escribir *C* para cerrar sesión. 
⚠ Envía *CD* para cambiar sus datos 
_(Por tu seguridad elimina el mensaje que incluye tu PIN 🔒)_`,
                                encode: msg.encode_msg,
                                menu: 500
                            }
                            // Si es incorrecto el PIN, envia mensaje
                    } else {
                        payload = {
                            code: 200,
                            message: `❌ El código PIN ingresado no es válido`,
                            encode: msg.encode_msg

                        }
                    }

                }

                break;
            }

        default:
            payload = { code: 404 }
    }

    return payload

}


// Crea un usuario
const actualizarUsuario = async(codigoEstado, clientMessage, userId) => {

    let base = bot.status_code[codigoEstado];
    var payload;

    switch (true) {
        // Identifica que tenga algun código 400... en este caso el 401
        case (codigoEstado == 401):
            var msg = base['confirmation'];
            // Si el usuario tiene el código 401 y envio un texto, significa que actualiza su nombre
            await UsuarioDB.update(userId, { nombreCompleto: clientMessage, codigoEstado: msg.next_status });
            // payload es lo que se enviara
            payload = {
                code: 200,
                message: `*${clientMessage}*, ${msg.message}`,
                encode: msg.encode_msg
            };
            break;
            // 402 signiica que que le esta solicitando el ciudad, verificar en bot.json
        case (codigoEstado == 402):

            var msg = base['confirmation'];
            await UsuarioDB.update(userId, { ciudad: clientMessage, codigoEstado: msg.next_status });
            payload = { code: 200, message: msg.message, encode: msg.encode_msg };
            break;

            // Solicita email
        case (codigoEstado == 403):

            var msg = base['confirmation'];
            await UsuarioDB.update(userId, { correo: clientMessage, codigoEstado: msg.next_status });
            payload = { code: 200, message: msg.message, encode: msg.encode_msg };
            break;
            // Solicita codigo PIN que usara para iniciar sesion.
            // password o PIN y lo encripta
            // No pudimos usar 404 aqui, por que es el por defecto pagina no encontrada
        case (codigoEstado == 405):

            var msg = base['confirmation'];
            await UsuarioDB.update(userId, { pin: await bcrypt.genHash(clientMessage), codigoEstado: msg.next_status, estaRegistrado: true });
            payload = { code: 200, message: msg.message, encode: msg.encode_msg, menu: 500 };
            break;

        default:
            payload = { code: 404 };
    }

    return payload;

}

// Usuario afiliandose para ganar sus comisiones
const afiliarse = async(codigoEstado, clientMessage, telefono, userId) => {

    let base = bot.status_code[codigoEstado];
    var payload;
    // Verificamos de inmediato si ya esta afiliado y lanzamos que ya esta aqui rapido
    const getFranquicia = await UsuarioDB.buscarFranquicia(telefono);
    //await Tarjeta.findOne({ numeroTarjeta: mensajeCliente, estado: 'vigente' });
    if (getFranquicia) {
        await UsuarioDB.update(userId, { codigoEstado: 500 });
        payload = {
            code: 200,
            message: ` ✅ Ya estas afiliado bajo franquicia`,
            encode: false
        }
    } else {
        // Ahora si vamos a tratar el caso

        switch (true) {
            // Identifica que tenga algun código 6000... en este caso el 6001, ES IGUAL A SI.
            case (codigoEstado == 6001 && clientMessage == 'SI' || 'Si' || 'si' || 's'):
                var msg = base['confirmation'];
                // Si el usuario tiene el SI
                await UsuarioDB.update(userId, { rol: 'FRANQUICIA_CLIENTE' });

                payload = { code: 200, message: msg.message, encode: msg.encode_msg };
                break;
            case (codigoEstado == 6001 && clientMessage == 'NO' || 'No' || 'no' || 'n'):
                // Si manda NO devolvemos el estadoCodigo a 500 menu o inicio de sesion
                await UsuarioDB.update(userId, { codigoEstado: 500 });
                payload = {
                    code: 400,
                    message: `♥ _No hemos afiliado su cuenta_`,
                };

                break;


            default:
                payload = { code: 404 };
        }



    }


    return payload;

}



module.exports = {
    webhook,
    createUser,
    login,
    actualizarUsuario,
    afiliarse
}