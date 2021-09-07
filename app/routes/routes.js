const router = require('express').Router()
const common = require('../components/common/index')
const user = require('../components/users/user.controller') // Para los Endpoint usando POSTMAN
const jsonHeaderMiddleware = require('../middlewares/jsonHeader')


router.get('/', common.index)
router.get('/api/signup', jsonHeaderMiddleware(), user.signup)
router.get('/api/login', jsonHeaderMiddleware(), user.login)


module.exports = router;