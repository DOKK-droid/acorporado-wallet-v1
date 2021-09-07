const mongoose = require('mongoose')

// Conexión con mongo por medio de la libreria mongoose
// process.env lee la variable del archivo .env
mongoose.connect(process.env.MONGO_DB, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true,
    })
    .then(() => console.log("Conectado a la BD")) // Envia un console.log cuando esta conectada la base de datos
    .catch(console.error)
mongoose.set('useFindAndModify', false)

module.exports = mongoose