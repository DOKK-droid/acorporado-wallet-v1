const mongoose = require('mongoose');

const CuentaSchema = new mongoose.Schema({
    cuenta: { type: String },
    descripcion: {
        type: String,
        required: true,
        default: 'CUENTA_NORMAL',
        emun: ['CUENTA_COMISIONES', 'CUENTA_NORMAL']
    },
    saldo: { type: Number, default: 0 },
    codigoEstado: { type: Number, default: 0 }, // Codigos para controlar estado de cuentas u operaciones
    estado: { type: Boolean, default: true }, // Se controla para bloquear o desbloquear al usuario
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        require: true
    },
    ultimaActualizacion: { type: Date, default: Date.now }
}, { timestamps: true });

CuentaSchema.methods.toJSON = function() {
    const { __v, _id, ...cuenta } = this.toObject();
    cuenta.uid = _id;
    return cuenta;
}

module.exports = mongoose.model('Cuenta', CuentaSchema)