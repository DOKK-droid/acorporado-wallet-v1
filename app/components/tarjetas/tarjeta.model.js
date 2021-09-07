const mongoose = require('mongoose');

const TarjetaSchema = new mongoose.Schema({
    numeroTarjeta: { type: Number },
    valorUnidad: { type: Number, default: 0 },
    montoBenefit: { type: Number, default: 0 },
    estado: {
        type: String,
        required: true,
        default: 'vigente',
        emun: ['vigente', 'usada']
    }, // Se controla si se uso ya o no
    lote: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lote',
        require: true
    },
}, { timestamps: true });

TarjetaSchema.methods.toJSON = function() {
    const { __v, _id, ...tarjeta } = this.toObject();
    tarjeta.id_tajeta = _id;
    return tarjeta;
}

module.exports = mongoose.model('Tarjeta', TarjetaSchema)