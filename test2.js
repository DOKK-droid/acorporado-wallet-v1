//Importing jimp module
var Jimp = require("jimp");
// Importing filesystem module
var fs = require('fs')
    // Importing qrcode-reader module
var qrCode = require('qrcode-reader');

// Read the image and create a buffer
// (Here image.png is our QR code)
var buffer = fs.readFileSync(__dirname + '\\new-pa2.png');

// Parse the image using Jimp.read() method
Jimp.read(buffer, function(err, image) {
    if (err) {
        console.error(err);
    }
    // Creating an instance of qrcode-reader module
    let qrcode = new qrCode();
    qrcode.callback = function(err, value) {
        if (err) {
            console.error(err);
        }
        // Printing the decrypted value
        console.log(value.result);
    };
    // Decoding the QR code
    qrcode.decode(image.bitmap);
});