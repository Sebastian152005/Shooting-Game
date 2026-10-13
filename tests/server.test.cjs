const assert = require('node:assert/strict')
const { test } = require('node:test')
const path = require('node:path')
const fs = require('node:fs')
const { createStaticServer } = require('../tools/static-server.cjs')
const root = path.resolve(__dirname, '..')

async function withServer(run) {
    const server = createStaticServer({ root })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    try { await run('http://127.0.0.1:' + server.address().port) }
    finally { await new Promise(resolve => server.close(resolve)) }
}

test('local server opens the root entry and serves nested HTML, CSS and JavaScript with valid MIME types', async () => {
    await withServer(async origin => {
        for (const [resource, type] of [['/', 'text/html'], ['/src/html/game.html', 'text/html'],
            ['/src/css/game.css', 'text/css'], ['/src/js/bootstrap/game.js', 'text/javascript']]) {
            const response = await fetch(origin + resource)
            assert.equal(response.status, 200)
            assert.ok(response.headers.get('content-type').startsWith(type))
            assert.ok((await response.text()).length > 0)
        }
    })
})

test('media range requests return exact bytes, support suffixes and reject invalid or out-of-bounds ranges', async () => {
    await withServer(async origin => {
        const resource = '/src/assets/audio/laser.mp3'
        const actual = fs.readFileSync(path.join(root, resource))
        for (const [range, expected] of [['bytes=0-9', actual.subarray(0, 10)], ['bytes=-10', actual.subarray(-10)]]) {
            const response = await fetch(origin + resource, { headers: { Range: range } })
            assert.equal(response.status, 206)
            assert.ok(response.headers.get('content-range').startsWith('bytes '))
            assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected)
        }
        for (const range of ['bytes=999999999-', 'bytes=10-0', 'bytes=-0', 'bytes=wrong']) {
            const response = await fetch(origin + resource, { headers: { Range: range } })
            assert.equal(response.status, 416)
        }
    })
})

test('local server rejects malformed paths, unsupported methods and non-public workspace files', async () => {
    await withServer(async origin => {
        for (const resource of ['/package.json', '/.git/config', '/tests/game.test.cjs', '/src/../README.md']) {
            assert.equal((await fetch(origin + resource)).status, 404)
        }
        assert.equal((await fetch(origin + '/%E0%A4%A')).status, 400)
        assert.equal((await fetch(origin + '/index.html', { method: 'POST' })).status, 405)
        const head = await fetch(origin + '/src/assets/audio/laser.mp3', { method: 'HEAD' })
        assert.equal(head.status, 200)
        assert.ok(Number(head.headers.get('content-length')) > 0)
        assert.equal((await head.text()).length, 0)
    })
})
