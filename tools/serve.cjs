const path = require('node:path')
const { createStaticServer } = require('./static-server.cjs')

const port = Number(process.env.PORT || 8080)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('PORT must be an integer between 1 and 65535')
const server = createStaticServer({ root: path.resolve(__dirname, '..'), onError: message => console.error(message) })
server.on('error', error => { console.error(error.message); process.exitCode = 1 })
server.listen(port, '127.0.0.1', () => console.log('WAR IN SPACE: http://127.0.0.1:' + port))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close())
