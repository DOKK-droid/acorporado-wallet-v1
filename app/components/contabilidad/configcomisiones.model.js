const mongoose = require('mongoose');

const confcomisionesSchema = new mongoose.Schema({
    nombre: { type: String },
    tipo: { type: Number }, // 1-> Envio, 2-> Recibir, 3-> Empresa, 4-> Compras, 5-> Servicio, 6-> Pagos
    montoMin: { type: Number },
    montoMax: { type: Number },
    comision: { type: Number },
    porcentajeEmpresa: { type: Number },
    porcentajeRemitente: { type: Number },
    porcentajeReceptor: { type: Number },
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        require: true
    },
    ultimaActualizacion: { type: Date, default: Date.now }
}, { timestamps: true });

confcomisionesSchema.methods.toJSON = function() {
    const { __v, _id, ...comision } = this.toObject();
    comision.uid = _id;
    return comision;
}

module.exports = mongoose.model('Configcomisione', confcomisionesSchema)