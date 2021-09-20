const fs = require('fs');
const qrcode = require('qrcode');
var QRCode = require('qrcode')
const { Client, MessageMedia } = require('whatsapp-web.js')


const capitalizarPalabra = require('../helpers/usuarios.helper')
const WA_USER_Controller = require('../components/whatsapp/wa.user.controller')
const { crearCuenta, verCuenta, retirarEfectivo, pasarComisiones } = require('../components/whatsapp/wa.cuenta.controller')
const { recargarCuenta } = require('../components/whatsapp/wa.recarga.controller')
const bot = require("../../app/utils/botDb") // La lectura del .json
const UsuarioDB = require("../../app/components/users/user.db") // Resultados y funciones a MONGO de usuario
const { validarSESSION } = require('../middlewares/validar-session-jwt');
const { enviar, recibir } = require('../components/whatsapp/wa.envireci.controller');
const { pagarServicio } = require('../components/whatsapp/wa.servicio.controller');
const { recibirPagoFactura, pagarFactura } = require('../components/whatsapp/wa.pagofactura.controller');
const { guardarSession, cargarSession } = require('../helpers/db-session');

/*(async() => {
    var sessionData = await cargarSession();
    console.log('Ok var session', sessionData);
})();*/

// Controlams si existe una sesion en el archivo.
const SESSION_FILE_PATH = __dirname + '/sessions/wa-session.json'
let sessionData;
if (fs.existsSync(SESSION_FILE_PATH)) { sessionData = require(SESSION_FILE_PATH) }
const wa = new Client({
    restartOnAuthFail: true,
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // <- this one doesn't works in Windows: +573023714981
            '--disable-gpu',
            '--use-gl=egl'
        ],
    }, // Ya que algunas paginas de alojamiento nodejs etc, o no usan algunos packages o sucede como lo de heroku, lo que te recomendaria, seria continuar tu proyecto desde la computadora cuando lo finalices podrias comprar una vps o abrir puertos y alojarlo en tu computadora. voy a ver k hacer con este bloqueo, creo que heroku vende un plan que no reinicia tu proyecto, ok, si gustas te paso mi contacto de whatsapp ???? pasame, +57

    session: sessionData,

    //SE DEBE USAR ESTE VALOR AQUI. SE DEBE ESCANEAR UNA VEZ Y GUARDARLO EN MONGO, LA FUNCION DE GUARDAR EN MONGO FUNCIONA BIEN
    // PERO LA FUNCION DE CONSULTAR LO GUARDADO PARA REUTILIZARLO SOLO LLEGA HASTA
});

//console.log(wa.options.session)

const init = async(socket) => { //Esto es lo primero que se ejecuta al iniciar la app?

    wa.on('authenticated', async(session) => {
        socket.emit('authenticated', 'Whatsapp se ha iniciado sesion!');
        socket.emit('message', 'Whatsapp ha iniciado sesion!')
            // Funcion para guardar sesion
            // await guardarSession(JSON.stringify(session));

        sessionData = session;
        fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(session), function(err) {
            if (err) {
                console.error(err);
            }
        });

    })

    wa.on('qr', qr => {
        console.log(qr)
        socket.emit('init', qr)
        qrcode.toDataURL(qr, (err, url) => {
            socket.emit('qr', url);
            socket.emit('message', 'Codigo QR recibido, escanea por favor!');

        })
    })
    wa.on('ready', () => {
        socket.emit('listo', 'Whatsapp esta listo!');
        socket.emit('message', 'Whatsapp esta listo!');
        console.log('Whatsapp Client is ready!');
    })


    // Funcion de verificacion si el numero que recibe el envio esta registrado en Whatssapp


    const checkNumeroRegistrado = async function(number) {
            const isRegistered = await wa.isRegisteredUser(number);
            return isRegistered;
        }
        // Es el que lee los mensajes entrantes
    wa.on('message', async message => {
        // Notifica vía socket.io que entro un nuevo mensaje
        socket.emit('message', `Entro un nuevo mensaje de ${message.from}: ${message.body}`)

        // Capitalizamos toda palabra recibida
        //let message.body = capitalizarPalabra(message.body);
        //console.log(message.body);
        // Aquí llamo el controlador (app/components/whatsapp/wa.controller.js)
        // Del controlador llamo la función webhook del anterior archivo
        // Se envia como parametro el message.from que contiene el número de donde se escribe
        // message.body identifica que escribio el cliente
        // Modulo usuarios
        WA_USER_Controller.webhook(message.from, message.body).then(async data => {
            //console.log(data);
            console.log(message.body);
            // console.log(message)

            // Una vez el webhook del controlador se le envia el mensaje este responde
            // Se crea un switch y se guarda estos datos en (data)
            switch (true) {

                // Si el mensaje que envio el cliente en whatsapp es BINGO
                case (message.body == 'Bingo'):

                    // Validamos aqui diferente, debe funcionar solo si no esta logueado
                    // Validamos primero la sesion que haya iniciado
                    validarSESSION(message.from).then(async(ok) => {
                        if (ok.code == 200) {

                            sendMessage(message.from, '⚠ Tienes la sesión abierta, no puedes usar *Bingo*.\nIngresa *C* para cerrarla\n⚠ _Envia *CM* para modificar su INFO_')
                                // En este caso le mandamos el MENU principal
                            const menu = bot.status_code[500]['confirmation'];
                            sendMessage(message.from, (menu.encode_msg ? decodeURI(menu.message) : menu.message))
                                // Actualizamos el codigo del menu:500
                            UsuarioDB.update(data._id, { codigoEstado: 500 })

                        } else if (ok.code == 401) {
                            // Lanzamos el Inicio de Sesion o registrarse               
                            // bot.init llama el archivo bot.json // message.body es el mensaje que el cliente envio
                            // si el mensaje es Bingo entonces buscara en el archivo bot.json: bot.json buscara init.bingo
                            var msg = bot.init[message.body]
                                // msg.message es igual a bot.json llama init.bingo.message
                            const mediaInit = await MessageMedia.fromFilePath(__dirname + `/images/logo-wallet-inicio.png`);
                            sendMessage(message.from, mediaInit);
                            sendMessage(message.from, (msg.encode_msg ? decodeURI(msg.message) : msg.message))

                        }
                    })

                    break;

                    // Aquí se comprueba lo siguiente, data contiene la busqueda de la base de datos
                    // En la base de datos se pregunta si el usuario esta estaRegistrado "estaRegistrado"
                    // estaRegistrado se definio en el modelo en /app/componentes/users/user.model.js
                    // Si no esta estaRegistrado y además envio el mensaje R en whatsapp activa este código
                case (!data.estaRegistrado && message.body == 'R' || message.body == 'R'):

                    var msg = bot.init[message.body]
                        // Actualiza de código status 0 a 101 en la base de datos
                        // El código ayudara a entender en que fase esta el cliente, si se esta registrando o en que
                    UsuarioDB.update(data._id, { codigoEstado: 101 })
                        // Aquí se envia el mensaje
                    sendMessage(message.from, (msg.encode_msg ? decodeURI(msg.message) : msg.message))
                    break;

                    // Si esta estaRegistrado y solicita R para registrarse
                case (data.estaRegistrado && message.body == 'R' || message.body == 'r'):
                    // https://es.piliapp.com/emoji/list/ PARA LOS EMOJITOS ICONOS
                    sendMessage(message.from, ' ✅ _En la app ya esta registrado tu número, ingresa *S* para continuar_')
                    break;


                    // REGISTRANDO EL USUARIO: El código 1 representa el status registrando
                case (data.codigoEstado.toString().charAt(0).includes('1') && data.codigoEstado.toString().length === 3):

                    WA_USER_Controller.createUser(data.codigoEstado.toString(), message.body, data._id, data.estaRegistrado).then(response => {
                        console.log(response)
                        if (response.code == 200) {
                            sendMessage(message.from, (response.encode ? decodeURI(response.message) : response.message))
                        }
                        // Aqui ejecutamos por primera vez la creacion de cuenta en la fase 104 PIN
                        if (data.codigoEstado == 104) {
                            crearCuenta(data.codigoEstado, data.telefono, data._id).then(payload => {
                                    sendMessage(message.from, payload.message)
                                }

                            )
                        }
                    })
                    break;

                    // Si no esta Registrado y desea iniciar sesión con S
                case (!data.estaRegistrado && message.body == 'S'):
                    sendMessage(message.from, '❌ En la app aún no estas registrado, ingresa *R* para continuar')
                    break;

                    // Si esta Registrado, desea iniciar sesión
                    // Además comprueba si el usuario tiene el código de status que empiece por 2 (201, 202)
                    // Los códigos 2 es el estado "usuario iniciando sesion"
                    // Si ya esta registrado, le pide ingrese el correo
                case (data.estaRegistrado && message.body == 'S'):

                    sendMessage(message.from, '📧 _Ingresa tu correo *electrónico*_ 📧')
                    UsuarioDB.update(data._id, { codigoEstado: 201 })
                    break;

                    // El código 2 representa el status ya iniciando sesion 
                case (data.codigoEstado.toString().charAt(0).includes('2') && data.codigoEstado.toString().length === 3):

                    WA_USER_Controller.login(data.codigoEstado.toString(), message.body, data._id, message.from).then(response => {
                        console.log(response)
                        if (response.code == 200) {
                            sendMessage(message.from, (response.encode ? decodeURI(response.message) : response.message))
                                // Con sesion abierta enviamos el menu de operaciones
                            if (response.menu) {
                                let base = bot.status_code[response.menu];
                                var menu = base['confirmation']; // Mandamos el menu principal
                                sendMessage(message.from, (menu.encode_msg ? decodeURI(menu.message) : menu.message))

                            }
                        }
                    })
                    break;

                    // Si no esta Registrado y desea cambiar sus Datos
                case (!data.estaRegistrado && message.body == 'CM'):
                    sendMessage(message.from, '❌ _En la app aún no estas registrado, ingresa *R* para continuar_')
                    break;

                    // El CM representa cambiar datos de usuario Nombre, Ciudad correo y PIN
                case (data.estaRegistrado && message.body == 'CM' || message.body == 'Cm'):
                    // Validamos primero la sesion que haya iniciado
                    validarSESSION(message.from).then(() => {

                            var msg = bot.init[message.body]
                                // Actualiza de código status 0 a 401 en la base de datos
                                // El código ayudara a entender en que fase esta el cliente, si se esta actualizando o en que
                            UsuarioDB.update(data._id, { codigoEstado: 401 })
                                // Aquí se envia el mensaje
                            sendMessage(message.from, (msg.encode_msg ? decodeURI(msg.message) : msg.message))

                        })
                        .catch(e => {
                            sendMessage(message.from, '❌ Debe iniciar sesion primero para cambiar sus datos, ingresa *S* para continuar o *Bingo*')
                        })
                    break;

                    // El código 4 representa el status ya actualizando ya los datos
                case (data.codigoEstado.toString().charAt(0).includes('4') && data.codigoEstado.toString().length === 3):
                    WA_USER_Controller.actualizarUsuario(data.codigoEstado.toString(), message.body, data._id, data.estaRegistrado).then(response => {
                        console.log(response)
                        if (response.code == 200) {
                            sendMessage(message.from, (response.encode ? decodeURI(response.message) : response.message))
                                // Con sesion abierta enviamos el menu de operaciones
                            if (response.menu) {
                                let base = bot.status_code[response.menu];
                                var menu = base['confirmation']; // Mandamos el menu principal
                                sendMessage(message.from, (menu.encode ? decodeURI(menu.message) : menu.message))

                            }
                        }
                    })

                    break;


                    // El código 5 representa el status ya inicio sesión pero que tambien desea cerrarla
                case (data.codigoEstado.toString().charAt(0).includes('5') && message.body == 'C' && data.codigoEstado.toString().length === 3):

                    UsuarioDB.update(data._id, { codigoEstado: 0 })
                    sendMessage(message.from, '🔐 *Cerraste correctamente la sessión comienza cuando desees nuevamente con* ♻ _Bingo_')

                    break;

                    ///////////////////// INICIO El 1 representa recargar saldo con la tarjeta  //////////////////////////////////////
                case (data.estaRegistrado && message.body.split('@')[0] == '1'):
                    // Validamos primero la sesion que haya iniciado
                    validarSESSION(message.from).then((ok) => {
                        if (ok.code == 200) {
                            var msg = bot.init[message.body.split('@')[0]]
                                // Funcion de Pago en efectivo, false es la posicion de comision
                            recargarCuenta(data.codigoEstado.toString(), message.body, data.telefono, data._id, false, 111, wa.info.wid.user).then(async response => {

                                console.log(response)
                                if (response.code == 200) {
                                    // Mensaje de exito
                                    sendMessage(message.from, (msg.encode_msg ? decodeURI(msg.message) : msg.message))
                                    sendMessage(message.from, response.messageDetalle)

                                    // Acreditamos la cuenta normal del cliente con el monto de la tarjeta
                                    verCuenta(data.telefono, data._id, response.valorRecarga, null).then(payloadCuenta => {
                                        sendMessage(message.from, payloadCuenta.message)
                                    })

                                } else if (response.code == 400) { // Sin exitos, todo mensaje incorrecto cae aqui
                                    sendMessage(message.from, response.message)
                                }
                            })
                        } else if (ok.code == 401) {
                            // Lanzamos no inicio session
                            sendMessage(message.from, ok.message)

                        }
                    })

                    break;
                    //////////////////// FIN El 1 representa recargar saldo con la tarjeta  /////////////////////////////////////////////////

                    /////////////////// INICIO El 2001 representa ENVIAR DINERO   //////////////////////////////////////
                case (data.estaRegistrado && message.body == '2'):

                    // Validamos primero la sesion que haya iniciado
                    validarSESSION(message.from).then((ok) => {
                        if (ok.code == 200) {
                            var msg = bot.init[message.body]
                            sendMessage(message.from, (msg.encode_msg ? decodeURI(msg.message) : msg.message))
                            UsuarioDB.update(data._id, { codigoEstado: msg.next_status })

                        } else if (ok.code == 401) {
                            // Lanzamos no inicio session
                            sendMessage(message.from, ok.message)

                        }
                    })

                    break;

                    ///////////////////// El código 2001 representa el status ya esta enviando
                case (data.codigoEstado.toString().charAt(0).includes('2') && data.codigoEstado.toString().length === 4):
                    // Tipo de comision de envio=1
                    enviar(data.codigoEstado.toString(), message.body, data.telefono, data._id, 1, 20, data.nombreCompleto).then(async response => {
                        console.log(response)
                        if (response.code == 200) {

                            // Mensaje json CON EXITO
                            sendMessage(message.from, (response.encode ? decodeURI(response.message) : response.message))
                                // Mensaje al Remitente del informe de la operacion
                            sendMessage(message.from, (response.encode ? decodeURI(response.messageRemitente) : response.messageRemitente))
                                // Enviamos mensaje al receptor del envio si y chequeamos antes el numero
                                // No debemos enviar whatsapp a un numero que no tiene whatsapp, si no se bloquera.
                            if (response.tel) {
                                const numeroRegistrado = await checkNumeroRegistrado(response.tel);
                                if (numeroRegistrado) {
                                    sendMessage(response.tel, (response.encode ? decodeURI(response.messageReceptor) : response.messageReceptor))
                                } else {
                                    sendMessage(message.from, '⚠ El beneficiario no tiene WhatsApp.\n_*Su cobro es por medio de un pagador*_')
                                }
                            }


                        } else if (response.code == 400) { // Sin exitos
                            sendMessage(message.from, response.message)
                        }
                    })

                    break;
                    //////////////////// FIN El 2001 representa ENVIAR DINERO  /////////////////////////////////////////////////


                    /////////////////// INICIO El 3001 representa RECIBIR DINERO   //////////////////////////////////////
                case (data.estaRegistrado && message.body == '3'):

                    // Validamos primero la sesion que haya iniciado
                    validarSESSION(message.from).then((ok) => {
                        if (ok.code == 200) {
                            var msg = bot.init[message.body]
                            sendMessage(message.from, (msg.encode_msg ? decodeURI(msg.message) : msg.message))
                            UsuarioDB.update(data._id, { codigoEstado: msg.next_status })

                        } else if (ok.code == 401) {
                            // Lanzamos no inicio session
                            sendMessage(message.from, ok.message)

                        }
                    })

                    break;
                    ///////////////////// El código 3001 representa el status ya esta RECIBIENDO
                case (data.codigoEstado.toString().charAt(0).includes('3') && data.codigoEstado.toString().length === 4):
                    // Tipo de comision es del receptor, codigo operacion:40
                    recibir(data.codigoEstado.toString(), message.body, data.telefono, data._id, 40, data.nombreCompleto).then(async response => {
                        console.log(response)
                        if (response.code == 200) {

                            // Mensaje json CON EXITO
                            sendMessage(message.from, (response.encode ? decodeURI(response.message) : response.message))
                                // Mensaje al Remitente del informe de la operacion
                            sendMessage(message.from, (response.encode ? decodeURI(response.messageDetalle) : response.messageDetalle))
                                // Enviamos mensaje al receptor del envio si y chequeamos antes el numero
                                // No debemos enviar whatsapp a un numero que no tiene whatsapp, si no se bloqueara.
                            if (response.tel) {
                                const numeroRegistrado = await checkNumeroRegistrado(response.tel);
                                if (numeroRegistrado) {
                                    sendMessage(response.tel, (response.encode ? decodeURI(response.messageDetalle) : response.messageDetalle))
                                    sendMessage(response.tel, response.messageNotif);

                                } else {
                                    sendMessage(message.from, '⚠ El remitente de dicha operacion no tiene WhatsApp.\n_*Su cobro es por medio de un pagador*_')
                                }
                            }


                        } else if (response.code == 400) { // Sin exitos
                            sendMessage(message.from, response.message)
                        }
                    })

                    break;
                    //////////////////// FIN El 3001 representa RECIBIR DINERO  /////////////////////////////////////////////////



                    /////////////////// INICIO El 4001 representa ENVIAR PAGO SERVICIO   //////////////////////////////////////
                case (data.estaRegistrado && message.body.split('@')[0] == '4'):

                    // Validamos primero la sesion que haya iniciado
                    validarSESSION(message.from).then((ok) => {
                        if (ok.code == 200) {
                            var msg = bot.init[message.body]
                                // Funcion de Pago
                            pagarServicio(data.codigoEstado.toString(), message.body, data.telefono, data._id, 5, 140, data.nombreCompleto).then(async response => {
                                console.log(response)
                                if (response.code == 200) {

                                    // Mensaje json CON EXITO
                                    sendMessage(message.from, (response.encode ? decodeURI(response.message) : response.message))
                                        // Mensaje al Remitente del informe de la operacion
                                    sendMessage(message.from, (response.encode ? decodeURI(response.messageRemitente) : response.messageRemitente))
                                        // Enviamos mensaje al receptor del pago si y chequeamos antes el numero
                                        // No debemos enviar whatsapp a un numero que no tiene whatsapp, si no se bloquera.
                                    if (response.tel) {
                                        const numeroRegistrado = await checkNumeroRegistrado(response.tel);
                                        if (numeroRegistrado) {
                                            sendMessage(response.tel, (response.encode ? decodeURI(response.messageReceptor) : response.messageReceptor))
                                        } else {
                                            sendMessage(message.from, '⚠ El beneficiario no tiene WhatsApp.\n*_Su cobro es por medio de un pagador_*')
                                        }
                                    }


                                } else if (response.code == 400) { // Sin exitos, todo mensaje incorrecto cae aqui
                                    sendMessage(message.from, response.message)
                                }
                            })


                        } else if (ok.code == 401) {
                            // Lanzamos no inicio session
                            sendMessage(message.from, ok.message)

                        }
                    })

                    break;
                    //////////////////// FIN El 4001 representa ENVIAR PAGO DE UN SERVICIO  /////////////////////////////////////////////////



                    /////////////////// INICIO 5001 representa RECIBIR PAGO DE SERVICIO   //////////////////////////////////////
                case (data.estaRegistrado && message.body == '5'):

                    // Validamos primero la sesion que haya iniciado
                    validarSESSION(message.from).then((ok) => {
                        if (ok.code == 200) {
                            // Generamos el code QR para pagos de movil a movil con camara al instante escaneando.

                            //QRCode.toDataURL(`https://wa.me/${wa.info.wid.user}/?text=240222512842@PRECIO`, function(err, url) {
                            QRCode.toDataURL(`https://wa.me/${wa.info.wid.user}/?text=4@${data.telefono}@${data.nombreCompleto.split(',')[0]}@PRECIO:`, function(err, url) {

                                // Create a base64 string from an image => ztso+Mfuej2mPmLQxgD ...
                                // Convert base64 to buffer => <Buffer ff d8 ff db 00 43 00 ...
                                const buffer = Buffer.from(url.split(',')[1], "base64");
                                // Pipes an image with "new-path.jpg" as the name.
                                fs.writeFileSync(__dirname + `\\qr\\${message.from}-4.jpg`, buffer);
                                const media = MessageMedia.fromFilePath(__dirname + `\\qr\\${message.from}-4.jpg`);
                                sendMessage(message.from, media);
                                message.reply('*CODIGO QR PARA RECIBIR PAGOS*\nSu cliente lo debe escanear');
                            })

                            var msg = bot.init[message.body]
                            sendMessage(message.from, (msg.encode_msg ? decodeURI(msg.message) : msg.message))
                            UsuarioDB.update(data._id, { codigoEstado: msg.next_status })

                        } else if (ok.code == 401) {
                            // Lanzamos no inicio session
                            sendMessage(message.from, ok.message)

                        }
                    })

                    break;
                    //////////////////// FIN El 5001 representa RECIBIR PAGO DE SERVICIO  /////////////////////////////////////////////////


                    /////////////////// INICIO El 7001 representa PAGAR FACTURA    //////////////////////////////////////
                case (data.estaRegistrado && message.body == '7'):

                    // Validamos primero la sesion que haya iniciado
                    validarSESSION(message.from).then((ok) => {
                        if (ok.code == 200) {
                            var msg = bot.init[message.body]
                            sendMessage(message.from, (msg.encode_msg ? decodeURI(msg.message) : msg.message))
                            UsuarioDB.update(data._id, { codigoEstado: msg.next_status })

                        } else if (ok.code == 401) {
                            // Lanzamos no inicio session
                            sendMessage(message.from, ok.message)

                        }
                    })

                    break;
                    ///////////////////// El código 7001 representa el status PAGANDO FACTURA
                case (data.codigoEstado.toString().charAt(0).includes('7') && data.codigoEstado.toString().length === 4):

                    // Tipo de comision es del receptor, codigo operacion:180
                    pagarFactura(data.codigoEstado.toString(), message.body, data.telefono, data._id, 6, 181, data.nombreCompleto).then(async response => {
                        console.log(response)
                        if (response.code == 200) {

                            // Mensaje json CON EXITO
                            sendMessage(message.from, (response.encode ? decodeURI(response.message) : response.message))
                                // Mensaje al pagador de ver detalles de lo que paga del informe de la operacion
                            sendMessage(message.from, (response.encode ? decodeURI(response.messageDetalle) : response.messageDetalle))
                                // Enviamos mensaje al receptor del  pago  y chequeamos antes el numero
                                // No debemos enviar whatsapp a un numero que no tiene whatsapp, si no se bloqueara.
                            if (response.tel) {
                                const numeroRegistrado = await checkNumeroRegistrado(response.tel);
                                if (numeroRegistrado) {
                                    sendMessage(response.tel, (response.encode ? decodeURI(response.messageNotif) : response.messageNotif))

                                } else {
                                    sendMessage(message.from, '⚠ El remitente de dicha operacion no tiene WhatsApp.\n*_Su cobro es por medio de un pagador_*')
                                }
                            }


                        } else if (response.code == 400) { // Sin exitos
                            sendMessage(message.from, response.message)
                        }
                    })

                    break;
                    //////////////////// FIN El 7001 representa PAGAR FACTURA  /////////////////////////////////////////////////


                    /////////////////// INICIO El 8001 representa RECIBIR PAG0 FACTURA   //////////////////////////////////////
                case (data.estaRegistrado && message.body == '8'):

                    // Validamos primero la sesion que haya iniciado
                    validarSESSION(message.from).then((ok) => {
                        if (ok.code == 200) {
                            var msg = bot.init[message.body]
                            sendMessage(message.from, (msg.encode_msg ? decodeURI(msg.message) : msg.message))
                            UsuarioDB.update(data._id, { codigoEstado: msg.next_status })

                        } else if (ok.code == 401) {
                            // Lanzamos no inicio session
                            sendMessage(message.from, ok.message)

                        }
                    })

                    break;
                    ///////////////////// El código 8001 representa el status RECIBIENDO PAGO FACTURA
                case (data.codigoEstado.toString().charAt(0).includes('8') && data.codigoEstado.toString().length === 4):

                    // Una funcion para controlar el status de enviar adjunto PDF
                    var mimetype = ''
                    if (message.hasMedia) {
                        var attachmentData = await message.downloadMedia();
                        mimetype = attachmentData.mimetype
                    }

                    // Tipo de comision es del receptor, codigo operacion:180
                    recibirPagoFactura(data.codigoEstado.toString(), message.body, data.telefono, data._id, 180, data.nombreCompleto, mimetype).then(async response => {
                        console.log(response)
                        if (response.code == 200) {

                            // Mensaje json CON EXITO
                            sendMessage(message.from, (response.encode ? decodeURI(response.message) : response.message))

                            // Enviamos mensaje al receptor del envio si y chequeamos antes el numero
                            // No debemos enviar whatsapp a un numero que no tiene whatsapp, si no se bloqueara.
                            if (response.tel) {
                                const numeroRegistrado = await checkNumeroRegistrado(response.tel);
                                if (numeroRegistrado) {
                                    sendMessage(response.tel, (response.encode ? decodeURI(response.messageReceptor) : response.messageReceptor))
                                        //message.reply(response.messageReceptor);
                                        // Mensaje al Remitente del informe de la operacion
                                    sendMessage(response.tel, attachmentData, { caption: response.messageReceptor })

                                    // Enviamos la descripcion del evento a remitente que pide pago
                                    sendMessage(message.from, (response.encode ? decodeURI(response.messageRemitente) : response.messageRemitente))
                                } else {
                                    sendMessage(message.from, '⚠ El remitente de dicha operacion no tiene WhatsApp.\n*_Su cobro es por medio de un pagador_*')
                                }
                            }


                        } else if (response.code == 400) { // Sin exitos
                            sendMessage(message.from, response.message)
                        }
                    })

                    break;
                    //////////////////// FIN El 8001 representa RECIBIR PAG0 FACTURA  /////////////////////////////////////////////////



                    /////////////////// INICIO 10001 representa VER CUENTA Y GENERAR CODIGO QR  //////////////////////////////////////
                case (data.estaRegistrado && message.body == '10'):

                    // Validamos primero la sesion que haya iniciado
                    validarSESSION(message.from).then(async(ok) => {
                        if (ok.code == 200) {
                            // Generamos el code QR para retirar fondos de movil a movil con camara al instante escaneando.

                            //QRCode.toDataURL(`https://wa.me/${wa.info.wid.user}/?text=1@999222333`, function(err, url) {
                            QRCode.toDataURL(`https://wa.me/${wa.info.wid.user}/?text=101@${data.telefono}@${data.nombreCompleto.split(',')[0]}@EFECTIVO:`, function(err, url) {

                                // Create a base64 string from an image => ztso+Mfuej2mPmLQxgD ...
                                // Convert base64 to buffer => <Buffer ff d8 ff db 00 43 00 ...
                                const buffer = Buffer.from(url.split(',')[1], "base64");
                                // Pipes an image with "new-path.jpg" as the name.
                                fs.writeFileSync(__dirname + `\\qr\\${message.from}-10.jpg`, buffer);
                                const media = MessageMedia.fromFilePath(__dirname + `\\qr\\${message.from}-10.jpg`);
                                sendMessage(message.from, media);
                                message.reply('*CODIGO QR PARA PAGAR EFECTIVO*\n_Su cliente lo debe escanear_');
                            })

                            const ver = await verCuenta(message.from, data._id, false, false)
                            sendMessage(message.from, ver.message)

                        } else if (ok.code == 401) {
                            // Lanzamos no inicio session
                            sendMessage(message.from, ok.message)

                        }
                    })

                    break;
                    //////////////////// FIN El 10001 representa VER CUENTA Y GENERAR CODIGO QR  /////////////////////////////////////////////////


                    /////////////////// INICIO El 101 representa ENVIAR RETIRO EFECTIVO  //////////////////////////////////////
                case (data.estaRegistrado && message.body.split('@')[0] == '101'):

                    // Validamos primero la sesion que haya iniciado
                    validarSESSION(message.from).then((ok) => {
                        if (ok.code == 200) {
                            var msg = bot.init[message.body.split('@')[0]]
                                // Funcion de Pago en efectivo
                            retirarEfectivo(data.codigoEstado.toString(), message.body, data.telefono, data._id, 7, 101, data.nombreCompleto).then(async response => {
                                console.log(response)
                                if (response.code == 200) {

                                    // Mensaje json CON EXITO
                                    sendMessage(message.from, (msg.encode_msg ? decodeURI(msg.message) : msg.message))
                                        // Mensaje al Remitente del informe de la operacion
                                    sendMessage(message.from, (response.encode ? decodeURI(response.messageReceptor) : response.messageReceptor))
                                        // Enviamos mensaje al receptor del pago si y chequeamos antes el numero
                                        // No debemos enviar whatsapp a un numero que no tiene whatsapp, si no se bloquera.
                                    if (response.tel) {
                                        const numeroRegistrado = await checkNumeroRegistrado(response.tel);
                                        if (numeroRegistrado) {
                                            sendMessage(response.tel, (response.encode ? decodeURI(response.messageRemitente) : response.messageRemitente))
                                        } else {
                                            sendMessage(message.from, '⚠ El beneficiario no tiene WhatsApp.\n*_Su cobro es por medio de un pagador_*')
                                        }
                                    }


                                } else if (response.code == 400) { // Sin exitos, todo mensaje incorrecto cae aqui
                                    sendMessage(message.from, response.message)
                                }
                            })


                        } else if (ok.code == 401) {
                            // Lanzamos no inicio session
                            sendMessage(message.from, ok.message)

                        }
                    })

                    break;
                    //////////////////// FIN El 101 representa ENVIAR RETIRO EFECTIVO   /////////////////////////////////////////////////


                    /////////////////// INICIO El 102 representa RETIRO COMISIONES   //////////////////////////////////////
                case (data.estaRegistrado && message.body == '102'):

                    // Validamos primero la sesion que haya iniciado
                    validarSESSION(message.from).then((ok) => {
                        if (ok.code == 200) {
                            var msg = bot.init[message.body]
                                // Funcion de Pago en efectivo
                            pasarComisiones(data.codigoEstado.toString(), message.body, data.telefono, data._id, 7, 100).then(async response => {
                                console.log(response)
                                if (response.code == 200) {

                                    // Mensaje json CON EXITO
                                    sendMessage(message.from, (msg.encode_msg ? decodeURI(msg.message) : msg.message))
                                        // Mensaje al Remitente del informe de la operacion
                                    sendMessage(message.from, (response.encode ? decodeURI(response.messageReceptor) : response.messageReceptor))
                                        // Enviamos mensaje MENU PRINCIPAL SI TODO OK
                                    sendMessage(message.from, (response.encode ? decodeURI(response.message) : response.message))

                                } else if (response.code == 400) { // Sin exitos, todo mensaje incorrecto cae aqui
                                    sendMessage(message.from, response.message)
                                }
                            })


                        } else if (ok.code == 401) {
                            // Lanzamos no inicio session
                            sendMessage(message.from, ok.message)

                        }
                    })

                    break;
                    //////////////////// FIN El 102 representa RETIRO COMISIONES   /////////////////////////////////////////////////


                    /////////////////// INICIO El 11 representa EXTRACTOS OPERACIONALES   //////////////////////////////////////
                case (data.estaRegistrado && message.body == '11'):

                    // Validamos primero la sesion que haya iniciado
                    validarSESSION(message.from).then((ok) => {
                        if (ok.code == 200) {
                            var msg = bot.init[message.body]
                                // Funcion de Pago en efectivo
                            pasarComisiones(data.codigoEstado.toString(), message.body, data.telefono, data._id, 7, 100).then(async response => {
                                console.log(response)
                                if (response.code == 200) {

                                    // Mensaje json CON EXITO
                                    sendMessage(message.from, (msg.encode_msg ? decodeURI(msg.message) : msg.message))
                                        // Mensaje al Remitente del informe de la operacion
                                    sendMessage(message.from, (response.encode ? decodeURI(response.messageReceptor) : response.messageReceptor))
                                        // Enviamos mensaje MENU PRINCIPAL SI TODO OK
                                    sendMessage(message.from, (response.encode ? decodeURI(response.message) : response.message))

                                } else if (response.code == 400) { // Sin exitos, todo mensaje incorrecto cae aqui
                                    sendMessage(message.from, response.message)
                                }
                            })


                        } else if (ok.code == 401) {
                            // Lanzamos no inicio session
                            sendMessage(message.from, ok.message)

                        }
                    })

                    break;
                    //////////////////// FIN El 11 representa EXTRACTOS OPERACIONALES    /////////////////////////////////////////////////


                    /////////////////// INICIO El 12 representa AYUDA   //////////////////////////////////////
                case (data.estaRegistrado && message.body == '12'):

                    // Validamos primero la sesion que haya iniciado
                    validarSESSION(message.from).then((ok) => {
                        if (ok.code == 200) {
                            var ayuda = `*ACORPORADO ES UN GRUPO*
    Una de las partes de ACORPORADO es la _*Wallet*_
    Una vez registrado en la aplicacion puede iniciar sus operaciones con seguridad y persistencia, no es como cualquier chat, interactuas con ChatBot Wallet
    observando los mensajes de ayuda en cada etapa, lea detalladamente, la apliaccion es muy facil de usar de modo que ofrece buena accesibilidad, 
    _*todo su historial puede borrarse pero su cuenta y sus transaccion estan guardas con seguridad*_ tan solo seguir el menu contextual puedes usar la app.
    
    *OPCION #1*
    Envia 1@ para recargar saldo, lleva la composicion *1@codigotarjeta* si es que su movil no puede escanear el codigo QR
    en este caso si puede, recargar es facil, raspar tarjeta y escanear el codio QR, luego envia lo presente en el campo de
    texto.
    
    *OPCION #2*
    Es la parte de envio de dinero a cualquier persona, dispone de notificacion SMS normal y codigo de la transaccion,
    es necesario tener saldo suficiente para cubrir los costes del envio.
    
    *Para tener asistencia*
    Telefono: +240222512842
    Correo: _acorporado.wallet@acor.com_
    
    _Desarrollado por Miguel Angel MITUY_
    © 🇬🇶 2021 Todos los derechos reservados || *ACORPORADO*` // Aqui sale el texto de ayuda
                                // Mensaje json CON EXITO
                            sendMessage(message.from, ayuda)

                        } else if (ok.code == 401) {
                            // Lanzamos no inicio session
                            sendMessage(message.from, ok.message)

                        }
                    })

                    break;
                    //////////////////// FIN El 12 representa AYUDA   /////////////////////////////////////////////////

                    /////////////////// INICIO El 13 SOBRE NOSOTROS   //////////////////////////////////////
                case (data.estaRegistrado && message.body == '13'):

                    // Validamos primero la sesion que haya iniciado
                    validarSESSION(message.from).then((ok) => {
                        if (ok.code == 200) {
                            var sobreNos = `*ACORPORADO WALLET*
    _ACO. WHATSAPP WALLET_
    
    ACORPORADO es una empresa grupal, bajo el desarollo de ACORPORADO WALLET una tecnologia moderna que facilita al usuario realizar sus transacciones, compras y pagos con mucha faci,
    bajo el concepto de TU GANAS YO GANO, todo usuario usando
    la app, tiene sus ganacias de una forma directa o indirecta, una empresa basada en las nuevas tecnologias demandadas,
    La Wallet traducido en español *BILLETERA* es mas que portable y ligero, no necesitas una otra app externa, simplemente
    tener la app Whatsapp lider mundial, te simplificamos la vida.
    
    La empresa fue fundada en el año 2021, motorizada por Lic, Obispo Miguel Angel MITUY NZANG uniendose con el Economista Ambrosio ESONO ANGUE fundador de la empresa ECUATUR
    e INMOSER, lanzandose con una Star Up Wallet con una tecnologia desafiante.
                                `;

                            // Mensaje json CON EXITO
                            sendMessage(message.from, sobreNos)


                        } else if (ok.code == 401) {
                            // Lanzamos no inicio session
                            sendMessage(message.from, ok.message)

                        }
                    })

                    break;
                    //////////////////// FIN El 13 SOBRE NOSOTROS    /////////////////////////////////////////////////




                    /////////////////// INICIO EL 6001 representa AFILIARSE PARA GANAR  //////////////////////////////////////
                case (data.estaRegistrado && message.body == '6'):
                    // Validamos primero la sesion que haya iniciado
                    validarSESSION(message.from).then(() => {

                            var msg = bot.init[message.body]
                            UsuarioDB.update(data._id, { codigoEstado: msg.next_status })
                            sendMessage(message.from, (msg.encode_msg ? decodeURI(msg.message) : msg.message))

                        })
                        .catch(e => {
                            sendMessage(message.from, '❌ Debes iniciar sesion primero para cambiar sus datos, ingresa *S* para continuar o *Bingo*')
                        })

                    break;

                    // El código 6001 representa el status ya esta afiliandose
                case (data.codigoEstado.toString().charAt(0).includes('6') && data.codigoEstado.toString().length === 4):

                    WA_USER_Controller.afiliarse(data.codigoEstado.toString(), message.body, data.telefono, data._id).then(response => {
                        console.log(response)
                        if (response.code == 200) {

                            sendMessage(message.from, (response.encode ? decodeURI(response.message) : response.message))

                            // Creamos la cuenta de comisiones para el cliente con esta funcion mandamos parametros
                            crearCuenta(data.codigoEstado, data.telefono, data._id).then(payloadCue => {
                                sendMessage(message.from, payloadCue.message)
                                UsuarioDB.update(data._id, { codigoEstado: 500 })
                            });

                        } else if (response.code == 400) { // No hemos afiliado su cuenta
                            sendMessage(message.from, response.message)
                        }
                    })

                    break;
                    //////////////////// FIN El 6001 representa AFILIARSE PARA GANAR  /////////////////////////////////////////////////



                default:

            }

        })

    })

    return wa.initialize()
}

// Esta función envia mensaje de respuesta al cliente
function sendMessage(client, message) {

    wa.sendMessage(client, message)
}



module.exports = { init, sendMessage }