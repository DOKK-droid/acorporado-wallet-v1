const UserDb = require("./user.db")
const bcrypt = require("../../utils/bcrypt")

// ESTE ARCHIVO SE USA  Para los Endpoint usando POSTMAN
// Registrarse
const signup = async(req, res) => {
    let payload = {
        "email": req.body.email,
        "password": req.body.password
    }
    UserDb.create(payload).then((result) =>
        res.status(201).send(result)
    ).catch((err) => {
        res.status(401).send(err)
    })
}

// Iniciar sesion
const login = async(req, res) => {

    let payload = {
        "email": req.body.email,
        "password": req.body.password
    }

    const getUser = await UserDb.findOne(payload)

    if (getUser) {
        const validPassword = await bcrypt.verifyPass(payload.password, getUser.password);
        if (validPassword) {
            res.status(200).json({ message: "Contraseña correcta" })
        } else {
            res.status(400).json({ error: "Contraseña incorrecta" })
        }
    } else {
        res.status(401).json({ error: "Este usuario no existe" })
    }
}


module.exports = { signup, login }