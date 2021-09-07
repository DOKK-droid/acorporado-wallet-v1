require('dotenv').config() // Este sirve para leer el archivo .env
const express = require('express') // Se llama express
const app = express()
const server = require('http').Server(app) // Se crea el servidor
const { Server } = require("socket.io")
const io = new Server(server) // Se envia el servidor a socket.io
const WhatsApp = require('../app/services/whatsapp') // Llamamos el "servicio" whatsapp
const routes = require('../app/routes/routes.js') // Llamamos las rutas de express
require('./db') // Llamamos la conexión a la base de datos

// Inicia whatsapp y le enviamos socket.io para que emita los eventos como escanear código
WhatsApp.init(io)
app.set("socketio", io)
    // lLamamos las rutas
app.use('/', routes)

const port = process.env.PORT || 8000;
// Función de iniciar servidor
function runServer() {
    server.listen(port, () => {
        console.log(`listening on PORT*: ${port} `);
    });
}

module.exports = runServer;