const Cuenta = require('../components/cuentas/cuenta.model')
const configcomisionesModel = require("../components/contabilidad/configcomisiones.model");
const qrsessionModel = require('../components/cuentas/qrsession.model');

// Funcion para cargar la session
const cargarSession = async() => {

    try {
        const res = await qrsessionModel.findOne().sort({ "ultimaFecha": -1 }); //  --- 1 for asc and -1 for desc
        if (res) return res.sesion;
        return '';
    } catch (error) {
        throw error
    }
}

// Funcion para guardar sesion
const guardarSession = async(sesion) => {


    const data = {
        sesion
    }
    const ses = new EnvireciModel(data);
    await ses.save()
        .then(item => {
            console.log("Sesion guardada!");
        })
        .catch(err => {
            console.log("Sesion no se pudo guardar", err);
        });

}



module.exports = {
    guardarSession,
    cargarSession
}