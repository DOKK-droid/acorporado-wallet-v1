const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
    telefono: { type: String, unique: true },
    nombreCompleto: String,
    ciudad: String,
    correo: { type: String },
    pin: String,
    rol: {
        type: String,
        required: true,
        default: 'NORMAL_CLIENTE',
        emun: ['SUPER_ADMIN', 'ADMIN', 'FRANQUICIA_CLIENTE', 'NORMAL_CLIENTE']
    },
    codigoEstado: { type: Number, default: 0 },
    estaRegistrado: { type: Boolean, default: false },
    estado: { type: Boolean, default: true }, // Se controla para bloquear o desbloquear al usuario
    ultimaConexion: { type: Date, default: Date.now }
}, { timestamps: true });

UsuarioSchema.methods.toJSON = function() {
    const { __v, pin, _id, ...usuario } = this.toObject();
    usuario.uid = _id;
    return usuario;
}

module.exports = mongoose.model('Usuario', UsuarioSchema)