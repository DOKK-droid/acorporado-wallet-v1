const play = require('audio-play');
const load = require('audio-loader');

load('sweet_servicio.mp3').then(play);