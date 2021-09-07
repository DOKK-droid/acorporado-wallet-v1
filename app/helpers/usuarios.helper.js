var PhoneNumber = require('awesome-phonenumber');
// funcion para validar el telefono entroducido por el remitente del ques tiene su receptor
const validarTel = (tel) => {
    const paises = ['GQ', 'CM', 'GA', 'GH', 'CG', 'TD'];
    let valido;
    for (let pais of paises) {
        var pn = new PhoneNumber(tel, pais);
        let cm = pn.isMobile(); // -> true
        if (cm && cm === true) {
            cm = pn.getNumber().substr(1) + '@c.us';
            valido = cm;
            break
        }
    }

    if (valido) { return valido } else { valido = false }
    return valido
}



const formatearNumero = function(number) {
    // 1. Menghilangkan karakter selain angka
    let formatted = number.replace(/\D/g, '');

    // 2. Menghilangkan angka 0 di depan (prefix)
    //    Kemudian diganti dengan 62
    if (formatted.startsWith('0')) {
        formatted = '240' + formatted.substr(1);
    }

    if (!formatted.endsWith('@c.us')) {
        formatted += '@c.us';
    }

    return formatted;
}


const capitalizarPalabra = (mensaje) => {
    return mensaje.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

function formatearNumeroComas(x) {
    return x.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
}


module.exports = {
    formatearNumero,
    capitalizarPalabra,
    validarTel

}