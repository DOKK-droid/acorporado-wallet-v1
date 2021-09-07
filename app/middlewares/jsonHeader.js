
const jsonHeader = () => {
  return (req, res, next) => {
    if (req.headers['content-type'] !== 'application/json') {
      res.status(400).send('Server requires application/json')
    } else {
      next()
    }
  }
}

module.exports = jsonHeader 