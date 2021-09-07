const bcrypt = require("bcrypt")


const genHash = async(pinUsuario) => {
    const salt = await bcrypt.genSalt(10)
    return await bcrypt.hash(pinUsuario, salt)
}
const verifyPin = async(pinReq, pinDB) => {
    return await bcrypt.compare(pinReq, pinDB)
}

module.exports = { genHash, verifyPin }