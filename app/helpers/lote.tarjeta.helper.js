// Funcion para generar lotes y tarjetas

const generarLotes = (num) => {
    const characters = '0123456789';
    let result1 = ' ';
    const charactersLength = characters.length;
    for (let i = 0; i < num; i++) {
        result1 += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result1;
}


var lote = 0
while (lote < 10) {
    console.log(generarLotes(12));

    lote++;
}


module.exports = {
    generarLotes,
    soloTelefono,
    capitalizarPalabra

}