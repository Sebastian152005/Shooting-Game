// Real Chromium smoke check. Node 24+, no third-party packages.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { pathToFileURL } = require('node:url')
const { spawn } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const candidates = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
const executable = candidates.find(candidate => candidate && fs.existsSync(candidate))
if (!executable) throw Error('Set CHROME_PATH to a Chromium executable to run browser smoke checks.')
const errors = []
const { createStaticServer } = require('../tools/static-server.cjs')
const server = createStaticServer({ root, onError: message => errors.push(message) })

async function main() {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const origin = 'http://127.0.0.1:' + server.address().port
    const temporaryRoot = path.resolve(os.tmpdir())
    const profile = fs.mkdtempSync(path.join(temporaryRoot, 'shooting-game-browser-'))
    const browser = spawn(executable, ['--headless=new', '--disable-background-networking',
        '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
        '--user-data-dir=' + profile, '--window-size=1280,720', 'about:blank'], { windowsHide: true })
    let socket
    let stderr = ''
    try {
        const endpoint = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(Error('Chromium startup timed out: ' + stderr.slice(-1000))), 15000)
            browser.once('error', reject)
            browser.once('exit', code => reject(Error('Chromium exited during startup: ' + code)))
            browser.stderr.on('data', chunk => {
                stderr += chunk
                const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(stderr)
                if (match) { clearTimeout(timer); resolve(match[1]) }
            })
        })
        socket = new WebSocket(endpoint)
        await new Promise((resolve, reject) => {
            socket.addEventListener('open', resolve, { once: true })
            socket.addEventListener('error', reject, { once: true })
        })
        const pending = new Map()
        let sequence = 0
        socket.addEventListener('message', event => {
            const message = JSON.parse(event.data)
            if (message.id) {
                const callback = pending.get(message.id)
                if (!callback) return
                pending.delete(message.id)
                clearTimeout(callback.timer)
                if (message.error) callback.reject(Error(JSON.stringify(message.error)))
                else callback.resolve(message.result)
            }
            if (message.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(message.params.exceptionDetails))
            if (message.method === 'Network.responseReceived') {
                const response = message.params.response
                if (response.url.startsWith(origin) && response.status >= 400) errors.push(response.status + ' ' + response.url)
            }
        })
        const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
            const id = ++sequence
            const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)) }, 10000)
            pending.set(id, { resolve, reject, timer })
            socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
        })
        const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
        const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
        const command = (method, params) => send(method, params, sessionId)
        await command('Runtime.enable')
        await command('Network.enable')
        await command('Page.enable')
        const evaluate = async expression => {
            const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true })
            if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails))
            return result.result.value
        }
        const waitFor = async expression => {
            for (let attempt = 0; attempt < 80; attempt++) {
                try { if (await evaluate(expression)) return } catch (error) {
                    if (!/context|Cannot read properties/.test(error.message)) throw error
                }
                await new Promise(resolve => setTimeout(resolve, 100))
            }
            throw Error('Browser condition timed out: ' + expression)
        }
        await command('Page.navigate', { url: origin + '/index.html' })
        await waitFor('!!window.ShootingGame?.settings')
        const menuSoundSize = await evaluate("(() => { const r = document.getElementById('audioSettings').getBoundingClientRect(); return { width: r.width, height: r.height }; })()")
        await evaluate("document.querySelector('[data-music-volume]').value = '27'; document.querySelector('[data-music-volume]').dispatchEvent(new Event('input')); document.getElementById('btnPlay').click()")
        await waitFor('!!window.ShootingGame?.game')
        const initial = await evaluate(`(() => { const g = window.ShootingGame.game; return { enemies: Object.keys(g.enemies).length,
            intro: g.waveStage, volume: g.audio.volume, width: g.c.width, cssWidth: g.c.getBoundingClientRect().width } })()`)
        assert.equal(initial.enemies, 0)
        assert.equal(initial.intro, 'intro')
        assert.equal(initial.volume, 0.27)
        assert.ok(initial.width >= initial.cssWidth)
        assert.equal(await evaluate("document.getElementById('audioSettings').getClientRects().length"), 0,
            'sound controls are unavailable during play')
        await evaluate('window.ShootingGame.game.pause()')
        assert.equal(await evaluate("document.getElementById('pauseMenu').open"), true)
        assert.equal(await evaluate("document.getElementById('audioSettings').closest('dialog').open"), true)
        const pauseSound = await evaluate("(() => { const r = document.getElementById('audioSettings').getBoundingClientRect(); return { right: innerWidth - r.right, bottom: innerHeight - r.bottom, width: r.width, height: r.height }; })()")
        assert.equal(pauseSound.right, 16)
        assert.equal(pauseSound.bottom, 16)
        assert.equal(await evaluate("!!document.elementFromPoint(innerWidth - 30, innerHeight - 30)?.closest('#audioSettings')"), true,
            'the corner sound control remains clickable while the center pause dialog is modal')
        assert.ok(Math.abs(pauseSound.width - menuSoundSize.width) < 1)
        assert.ok(Math.abs(pauseSound.height - menuSoundSize.height) < 1)
        await evaluate("document.getElementById('audioSettings').open = true; document.querySelector('[data-music-volume]').value = '42'; document.querySelector('[data-music-volume]').dispatchEvent(new Event('input'))")
        assert.equal(await evaluate('window.ShootingGame.game.audio.volume'), 0.42)
        assert.equal(await evaluate('window.ShootingGame.game.audio.paused'), true)
        const artifacts = path.join(root, 'tests', 'artifacts')
        fs.mkdirSync(artifacts, { recursive: true })
        const pauseScreenshot = await command('Page.captureScreenshot', { format: 'png' })
        fs.writeFileSync(path.join(artifacts, 'browser-pause.png'), Buffer.from(pauseScreenshot.data, 'base64'))
        await evaluate("document.getElementById('resumeGame').click()")
        assert.equal(await evaluate('window.ShootingGame.game.paused'), false)
        assert.equal(await evaluate("document.getElementById('audioSettings').getClientRects().length"), 0)
        await waitFor('Object.values(window.ShootingGame.game.enemies).some(e => !e.entering)')
        await waitFor('Object.values(window.ShootingGame.game.enemies).some(e => e.entering && e.y + e.height > 0)')
        assert.equal(await evaluate(`(() => { const g = window.ShootingGame.game;
            const e = Object.values(g.enemies).find(e => e.entering && e.y + e.height > 0);
            const bullet = new g.entities.Bullet(e.x + e.width / 2, 0);
            bullet.y = e.y + e.height / 2; e.update();
            return e.dead && !g.bullets[bullet.index]; })()`), true, 'visible entrants receive player damage')
        await evaluate(`(() => { const g = window.ShootingGame.game;
            g.difficulty = 8; g.applyWaveProfile(); g.fillEnemySlots(); g.player.shield = 1000; g.shooting = true;
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' })); })()`)
        await new Promise(resolve => setTimeout(resolve, 1200))
        await evaluate("window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft' }))")
        await command('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 2, mobile: false })
        await new Promise(resolve => setTimeout(resolve, 150))
        assert.equal(await evaluate(`(() => { const g = window.ShootingGame.game, f = window.ShootingGame.domain.formation;
            const enemies = Object.values(g.enemies); return enemies.every((a,i) => enemies.slice(i+1).every(b => !f.overlaps(a,b,11.99))); })()`), true)
        const combatScreenshot = await command('Page.captureScreenshot', { format: 'png' })
        fs.writeFileSync(path.join(artifacts, 'browser-combat.png'), Buffer.from(combatScreenshot.data, 'base64'))
        assert.equal(await evaluate(`(() => { const g = window.ShootingGame.game;
            if (g.paused) g.continued();
            g.shooting = false; g.nextBossAt = g.difficulty + 1;
            if (!Object.keys(g.enemies).length) new g.entities.Enemy({ x: 100, y: 80 });
            const survivors = Object.values(g.enemies);
            const profiles = survivors.map(e => e.profile);
            g.increaseDifficulty();
            if (g.waveStage !== 'boss-pending' || g.boss || g.pendingSpawns.length) return 'unexpected preparation: ' + g.waveStage;
            if (!survivors.every((e,i) => g.enemies[e.index] === e && e.profile === profiles[i])) return 'survivor changed';
            const time = g.progressionTime; g.updateProgression(10);
            if (g.progressionTime !== time) return 'progression was not frozen';
            for (const e of survivors) e.die();
            g.updateProgression(0);
            if (!g.boss || g.waveStage !== 'boss') return 'boss did not enter: paused=' + g.paused;
            g.boss.hp = Math.ceil(g.boss.maxHp * 0.2); g.boss.updatePhase();
            return g.boss.phase === 3 && !Object.values(g.floatingTexts).some(t => t.text.includes('FASE'));
        })()`), true, 'boss transition waits for surviving UFOs and has no phase announcements')
        await evaluate(`(() => { const g = window.ShootingGame.game; g.score = 12345; g.gameOver(); })()`)
        assert.equal(await evaluate('window.ShootingGame.game.isGameOver'), true)
        assert.equal(await evaluate("localStorage.getItem('warInSpaceHS')"), '12345')
        await evaluate("document.getElementById('game').click()")
        assert.equal(await evaluate('window.ShootingGame.game.waveStage'), 'intro')
        assert.equal(await evaluate('Object.keys(window.ShootingGame.game.enemies).length'), 0)
        const screenshot = await command('Page.captureScreenshot', { format: 'png' })
        fs.writeFileSync(path.join(artifacts, 'browser-start.png'), Buffer.from(screenshot.data, 'base64'))
        const history = await command('Page.getNavigationHistory')
        const menuEntry = history.entries.find(entry => entry.url === origin + '/index.html')
        assert.ok(menuEntry)
        await command('Page.navigateToHistoryEntry', { entryId: menuEntry.id })
        await waitFor('!!document.getElementById("highScore") && !!window.ShootingGame?.settings')
        assert.equal(await evaluate("document.getElementById('highScore').textContent"), '12,345')
        assert.equal(await evaluate('window.ShootingGame.settings.get().music'), 0.42)
        assert.equal(await evaluate("document.body.classList.contains('fade-out')"), false,
            'back navigation restores a visible, usable menu')
        await command('Page.navigate', { url: pathToFileURL(path.join(root, 'index.html')).href })
        await waitFor('location.protocol === "file:" && !!document.getElementById("btnPlay") && !!window.ShootingGame?.settings')
        await evaluate("document.getElementById('btnPlay').click()")
        await waitFor('location.protocol === "file:" && !!window.ShootingGame?.game?.player')
        await waitFor('window.ShootingGame.game.assets.get("player").naturalWidth > 0')
        assert.equal(await evaluate('window.ShootingGame.game.waveStage'), 'intro')
        await evaluate('window.ShootingGame.game.gameOver(); window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))')
        assert.equal(await evaluate('window.ShootingGame.game.isGameOver'), false)
        assert.deepEqual(errors, [], 'no uncaught JavaScript exceptions or missing local resources')
        console.log('Browser smoke passed: HTTP and file entry, menu, pause-only sound, audio persistence, intro, entry damage, combat, resize, survivor-preserving boss transition, hidden phase labels, Game Over, restart and record.')
    } catch (error) {
        console.error('Chromium diagnostics:', stderr.slice(-1800))
        throw error
    } finally {
        if (socket) socket.close()
        browser.kill()
        await new Promise(resolve => {
            if (browser.exitCode !== null) return resolve()
            browser.once('exit', resolve)
            setTimeout(resolve, 3000).unref()
        })
        await new Promise(resolve => server.close(resolve))
        // The only recursive cleanup target is the scratch profile we created.
        const resolved = path.resolve(profile)
        if (path.dirname(resolved) !== temporaryRoot || !path.basename(resolved).startsWith('shooting-game-browser-')) {
            throw Error('Unexpected temporary profile path; refusing cleanup')
        }
        fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
