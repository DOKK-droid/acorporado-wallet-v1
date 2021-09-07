const Lote = require("../tarjetas/lote.model") // Mi modelo de Lotes
const Tarjeta = require("../tarjetas/tarjeta.model") // Mi modelo de tarjeta


// Crea un lote y tarjetas
const lotesTar = async() => {
    const lote = {
        numeroLote: 202020,
        unidades: 5,
        precioVenta: 20000,
        usuario: '60a83227908fe5599cbf73d0'

    }


    const lot = new Lote(lote);
    await lot.save();

    const tar = {
        numeroTarjeta: 12345678912345,
        valorUnidad: 50000,
        montoBenefit: 600,
        estado: 'vigente',
        lote: lot._id

    }
    const ta = new Tarjeta(tar);
    await ta.save();
}

module.exports = {
    lotesTar
}