var randomstring = require("randomstring");

const generador = (longitud) => {
    const codigo = randomstring.generate({
        length: longitud,
        charset: 'numeric'
    });
    return codigo
}



module.exports = {
    generador

}