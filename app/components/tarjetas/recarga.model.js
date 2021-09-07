const mongoose = require('mongoose');

const RecargaSchema = new mongoose.Schema({
    telUsuario: { type: String },
    montoRecarga: { type: Number, default: 0 },
    //codigoEstado: { type: Number, default: 0 }, // Codigos para controlar estado en el que esta la recarga
    codigoTarjeta: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tarjeta',
        require: true,
        unique: true
    },
}, { timestamps: true });

RecargaSchema.methods.toJSON = function() {
    const { __v, _id, ...recarga } = this.toObject();
    recarga.id_recarga = _id;
    return recarga;
}

module.exports = mongoose.model('Recarga', RecargaSchema)