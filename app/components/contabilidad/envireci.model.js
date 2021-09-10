const mongoose = require('mongoose');

const envireciSchema = new mongoose.Schema({
    referencia: { type: String }, // Referencia del envio o rec
    cuentaEmi: String,
    cuentaReci: String,
    ope: { type: String },
    monto: { type: Number, default: 0 },
    comisionEmpresa: { type: Number, default: 0 },
    comisionRemitente: { type: Number, default: 0 },
    comisionReceptor: { type: Number, default: 0 },
    descripcion: String,
    mensaje: String,
    codigo: String, // codigo del envio
    sentido: String, // C-> Credito, D-> Debito
    estado: {
        type: String,
        required: true,
        default: 'ENCURSO',
        emun: ['DEPO', 'PAGADO', 'ENCURSO']
    },
    cn: { type: Number, default: 1 },
    pagadoPor: String,
    ultimaActualizacion: { type: Date, default: Date.now }
}, { timestamps: true });

envireciSchema.methods.toJSON = function() {
    const { __v, codigo, _id, ...envireci } = this.toObject();
    envireci.uid = _id;
    return envireci;
}

module.exports = mongoose.model('Envireci', envireciSchema)