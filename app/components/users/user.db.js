const Usuario = require("./user.model")
const bcrypt = require("../../utils/bcrypt")

const create = async(data) => {
    // Se crea un nuevo usuario en la base de datos
    const usuario = new Usuario(data)
        // Si envian un password lo encripta
    if (usuario.pin) {
        usuario.pin = await bcrypt.genHash(usuario.pin);
    }
    // Guarda el usuario que se envio
    return usuario.save()
}

const findOne = async(data) => {
    // Busca usuario por medio del email que se envio SE RECIBIO UN OBJETO
    return await Usuario.findOne({ correo: data.correo })
}

const findTelefono = async(data) => {
    // Busca usuario por medio del whatsappID // Telefono es lo que se recibio como dato simple parametro
    return await Usuario.findOne({ telefono: data })
}

const buscarFranquicia = async(data) => {
        // Busca usuario por medio del whatsappID // Telefono es lo que se recibio como dato simple parametro
        return await Usuario.findOne({ telefono: data, rol: 'FRANQUICIA_CLIENTE' })
    }
    // Buscar o crear
const findOrCreate = async(data) => {
    // Buscar primero el usuario por medio del whatsapp id// telefono
    let getUsuario = await Usuario.findOne({ telefono: data.telefono })
        // Si encontro el usuario, retorna los datos del usuario
    if (getUsuario) {
        return getUsuario
    } else {
        // Si no encontro el usuario, significa que es nuevo y hay que crearlo
        let nuevoUsuario = new Usuario(data)
        return nuevoUsuario.save()
    }
}

const update = async(id, newData) => {
    // Actualiza los datos del usuario
    return await Usuario.findOneAndUpdate({ _id: id }, newData)

}

const destroy = async(id) => {
    // Elimina el usuario
    return await Usuario.findByIdAndRemove({ _id: id })
}


// Exporta las funciones creadas para que puedan ser llamadas en otras partes de la app
module.exports = {
    create,
    findOne,
    findTelefono,
    findOrCreate,
    update,
    buscarFranquicia,
    destroy
}