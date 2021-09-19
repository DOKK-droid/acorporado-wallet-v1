const mongoose = require('mongoose');

const QRSchema = new mongoose.Schema({
    sesion: { type: String },
    ultimaFecha: { type: Date, default: Date.now }
}, { timestamps: true });

QRSchema.methods.toJSON = function() {
    const { __v, _id, ...sesions } = this.toObject();
    return sesions;
}

module.exports = mongoose.model('Qrsesion', QRSchema)