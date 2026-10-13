const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' }

function createStaticServer({ root, onError = () => {} }) {
    const workspace = path.resolve(root)
    const source = path.join(workspace, 'src') + path.sep
    return http.createServer((req, res) => {
        if (!['GET', 'HEAD'].includes(req.method)) {
            res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return
        }
        let requested
        try { requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname) }
        catch { res.writeHead(400); res.end(); return }
        if (requested.includes('\0')) { res.writeHead(400); res.end(); return }
        if (requested === '/favicon.ico') { res.writeHead(204); res.end(); return }
        const file = path.resolve(workspace, '.' + (requested === '/' ? '/index.html' : requested))
        // Serve only the application, not Git metadata, docs, tests or tooling.
        if (file !== path.join(workspace, 'index.html') && !file.startsWith(source)) {
            res.writeHead(404); res.end(); return
        }
        let stat
        try { stat = fs.statSync(file) } catch {}
        if (!stat?.isFile()) {
            onError('Missing local resource: ' + requested)
            res.writeHead(404); res.end(); return
        }
        const headers = { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
            'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff' }
        const size = stat.size
        let start = 0
        let end = size - 1
        const rangeHeader = req.headers.range
        if (rangeHeader) {
            const range = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader)
            if (!range || (!range[1] && !range[2])) {
                res.writeHead(416, { 'Content-Range': 'bytes */' + size }); res.end(); return
            }
            if (range[1]) {
                start = Number(range[1])
                if (range[2]) end = Math.min(Number(range[2]), size - 1)
            } else {
                start = Math.max(0, size - Number(range[2]))
            }
            if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
                res.writeHead(416, { 'Content-Range': 'bytes */' + size }); res.end(); return
            }
            headers['Content-Range'] = `bytes ${start}-${end}/${size}`
        }
        headers['Content-Length'] = Math.max(0, end - start + 1)
        res.writeHead(rangeHeader ? 206 : 200, headers)
        if (req.method === 'HEAD' || size === 0) { res.end(); return }
        const stream = fs.createReadStream(file, { start, end })
        stream.on('error', error => { onError(error.message); res.destroy() })
        res.on('close', () => stream.destroy())
        stream.pipe(res)
    })
}

module.exports = { createStaticServer }
