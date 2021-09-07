const mongoose = require('mongoose');

const LoteSchema = new mongoose.Schema({
    numeroLote: { type: Number },
    unidades: { type: Number, default: 0 },
    precioVenta: { type: Number, default: 0 },
    estado: { type: Boolean, default: true }, // Se controla para bloquear o desbloquear el lote si robado
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        require: true
    },
}, { timestamps: true });

LoteSchema.methods.toJSON = function() {
    const { __v, _id, ...lote } = this.toObject();
    lote.id_lote = _id;
    return lote;
}

module.exports = mongoose.model('Lote', LoteSchema)