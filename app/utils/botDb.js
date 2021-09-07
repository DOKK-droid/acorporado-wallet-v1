const fs = require('fs')
const rawdata = fs.readFileSync('./bot.json');
const bot = JSON.parse(rawdata)


module.exports = bot