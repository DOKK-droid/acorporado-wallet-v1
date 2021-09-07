const { response, request } = require('express');
const jwt = require('jsonwebtoken');

const Usuario = require('../components/users/user.model');


// Esta es únicamente para controlar si el usuario inicio sesion para tener permios de sus operaciones
const validarSESSION = async(numeroMovil) => {
    var session
        // Buscamos usuario en la BD por medio del movil, estado resgistrado y estado sesion abierta codigo 500
        // Filtramos a que codigoEstado sea mayor que 399 ({ $gt: 399 }), es decir 400 es codigo de actualizar datos usuario
    const inicioSession = await Usuario.findOne({ 'telefono': numeroMovil, 'estaRegistrado': true, 'codigoEstado': { $gt: 399 } });
    if (!inicioSession) {
        session = {
            code: 401,
            message: '❌ Debes iniciar sesion primero, ingresa *S* para continuar o *Bingo*'
        };
    } else {
        session = { code: 200 };
    }

    return session;
}

const validarJWT = async(req = request, res = response, next) => {

    const token = req.header('x-token');

    if (!token) {
        return res.status(401).json({
            msg: 'No hay token en la petición'
        });
    }

    try {

        const { uid } = jwt.verify(token, process.env.SECRETORPRIVATEKEY);

        // leer el usuario que corresponde al uid
        const usuario = await Usuario.findById(uid);

        if (!usuario) {
            return res.status(401).json({
                msg: 'Token no válido - usuario no existe DB'
            })
        }

        // Verificar si el uid tiene estado true
        if (!usuario.estado) {
            return res.status(401).json({
                msg: 'Token no válido - usuario con estado: false'
            })
        }


        req.usuario = usuario;
        next();

    } catch (error) {

        console.log(error);
        res.status(401).json({
            msg: 'Token no válido'
        })
    }

}




module.exports = {
    validarJWT,
    validarSESSION
}