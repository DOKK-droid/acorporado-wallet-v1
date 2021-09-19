const fs = require('fs-extra');
const path = require('path');
const qrsessionModel = require('../components/cuentas/qrsession.model');

// Funcion para cargar la session
const SESSION_FILE_PATH = path.join('./app/services/sessions/wa-session.json')

const cargarSession = async() => { // Mira antes como lo tenia con .json


    const res = await qrsessionModel.findOne();
    let objeto;
    if (res) { objeto = JSON.stringify(res.sesion) } //  --- 1 for asc and -1 for desc

    //console.log('Cargo session', objeto)

    if (res) fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(res.sesion));
    if (res) return objeto;
    //console.log('Session cargada', res.sesion)
    return '';

}

// Funcion para guardar sesion
const guardarSession = async(sesion) => { // Primera funcion que guarda una sola vez


    const data = {
        sesion
    }
    const ses = new qrsessionModel(data);
    await ses.save()
        .then(item => {
            console.log("Session guardada!");
        })
        .catch(err => {
            console.log("Sesion no se pudo guardar", err);
        });

}


module.exports = {
    guardarSession,
    cargarSession
}