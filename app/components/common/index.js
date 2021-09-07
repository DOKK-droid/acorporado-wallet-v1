const path = require('path')

const index = (req, res) => {
    var socket = req.app.get('socketio')
    setTimeout(function() { socket.emit('message', 'Conectando...') }, 500)
    res.sendFile(path.join(__dirname + '../../../../public/' + '/index.html'))
}


module.exports = { index }