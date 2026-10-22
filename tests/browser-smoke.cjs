// Real Chromium smoke check. Node 24+, no third-party packages.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { spawn } = require('node:child_process')
const { browserArguments, browserDiagnostics, findBrowserExecutable } = require('./support/chromium.cjs')

const root = path.resolve(__dirname, '..')
const executable = findBrowserExecutable()
if (!executable) throw Error('Set CHROME_PATH to a Chromium executable to run browser smoke checks.')
const errors = []
const { createStaticServer } = require('../tools/static-server.cjs')
const server = createStaticServer({ root, onError: message => errors.push(message) })
const artifacts = path.join(root, 'tests', 'artifacts')
const reportPath = path.join(artifacts, 'browser-smoke-report.json')

function writeReport(status, details = {}) {
    fs.mkdirSync(artifacts, { recursive: true })
    fs.writeFileSync(reportPath, JSON.stringify({
        status,
        updatedAt: new Date().toISOString(),
        executable,
        ...details
    }, null, 2))
}

async function main() {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const origin = 'http://127.0.0.1:' + server.address().port
    const temporaryRoot = path.resolve(os.tmpdir())
    const profile = fs.mkdtempSync(path.join(temporaryRoot, 'shooting-game-browser-'))
    const browser = spawn(executable, browserArguments(profile, 1280, 720,
        { disableSandbox: true, softwareCanvas: true }), { windowsHide: true })
    const screenshots = new Map()
    writeReport('running')
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
        browser.once('exit', code => {
            for (const request of pending.values()) {
                clearTimeout(request.timer)
                request.reject(Error(`Chromium exited with code ${code} during ${request.method}`))
            }
            pending.clear()
        })
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
            pending.set(id, { resolve, reject, timer, method })
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
            intro: g.waveStage, energy: g.energy, volume: g.audio.volume,
            introDuration: g.config.progression.introDuration,
            entryDuration: g.config.motion.entryDuration,
            levelThreeCharges: g.rules.progressionProfile(3, g.config).maxChargedAttacks,
            width: g.c.width, cssWidth: g.c.getBoundingClientRect().width } })()`)
        assert.equal(initial.enemies, 0)
        assert.equal(initial.intro, 'intro')
        assert.equal(initial.energy, 0)
        assert.equal(initial.volume, 0.27)
        assert.equal(initial.introDuration, 1.2)
        assert.equal(initial.entryDuration, 1)
        assert.equal(initial.levelThreeCharges, 2)
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
        const pauseScreenshot = await command('Page.captureScreenshot', { format: 'png' })
        screenshots.set('browser-pause.png', Buffer.from(pauseScreenshot.data, 'base64'))
        await evaluate("document.getElementById('resumeGame').click()")
        assert.equal(await evaluate('window.ShootingGame.game.paused'), false)
        assert.equal(await evaluate("document.getElementById('audioSettings').getClientRects().length"), 0)
        await waitFor('Object.values(window.ShootingGame.game.enemies).some(e => !e.entering)')
        await waitFor('Object.values(window.ShootingGame.game.enemies).some(e => e.entering && e.y + e.height > 0)')
        const entryState = await evaluate(`(() => { const g = window.ShootingGame.game;
            const e = Object.values(g.enemies).find(e => e.entering && e.y + e.height > 0);
            return { progress: e.entryElapsed / g.config.motion.entryDuration,
                startedOutside: e.entryStartY + e.height < 0,
                approaching: e.y < e.entryY,
                bank: e.bank };
        })()`)
        assert.ok(entryState.progress > 0 && entryState.progress < 1)
        assert.equal(entryState.startedOutside, true)
        assert.equal(entryState.approaching, true)
        assert.ok(Number.isFinite(entryState.bank))
        const entryScreenshot = await command('Page.captureScreenshot', { format: 'png' })
        screenshots.set('browser-ufo-entry.png', Buffer.from(entryScreenshot.data, 'base64'))
        assert.equal(await evaluate(`(() => { const g = window.ShootingGame.game;
            const e = Object.values(g.enemies).find(e => e.entering && e.y + e.height > 0);
            const bullet = new g.entities.Bullet(e.x + e.width / 2, 0);
            bullet.y = e.y + e.height / 2; e.update();
            return e.dead && !g.bullets[bullet.index]; })()`), true, 'visible entrants receive player damage')
        assert.equal(await evaluate(`(() => { const g = window.ShootingGame.game;
            const e = Object.values(g.enemies).find(e => !e.entering && e.role === 'pressure');
            g.enemyBullets = {}; g.safeCorridor = null;
            e.x = 0; g.player.x = g.view.width / 2;
            const fired = e.shoot(); const bullet = Object.values(g.enemyBullets)[0];
            return fired && bullet.vx === 0 && !bullet.homing
                && bullet.attackType === 'common' && bullet.color === g.config.enemyAttackColors.common;
        })()`), true, 'common UFOs keep periodic straight green pressure without a radar gate')
        const precisionState = await evaluate(`(() => { const g = window.ShootingGame.game;
            g.difficulty = 4; g.applyWaveProfile(); g.safeCorridor = null; g.enemyAttackCooldown = 0;
            for (const e of Object.values(g.enemies)) { e.pendingAttack = null; e.shootTimer = 0; }
            const nextMarksman = Math.max(5, Math.ceil(g.enemyIndex / 5) * 5);
            g.enemyIndex = nextMarksman;
            const e = new g.entities.Enemy({ x: g.player.x - 100, y: 90 });
            e.entering = false; e.x = g.player.x - 100; e.y = 90; e.shootTimer = e.shootInterval;
            g.player.horizontalVelocity = g.player.speed * 60;
            const playerCenter = g.player.x + g.player.width / 2;
            e.setAIState(g.rules.ENEMY_AI_STATES.PATROL);
            const perceived = e.updatePerception(0.01);
            e.updateAI(0.01, perceived);
            const acquired = e.ai.state === g.rules.ENEMY_AI_STATES.ACQUIRING
                && e.ai.lastKnownTarget !== null;
            const fired = e.role === 'marksman' && e.shoot();
            return { fired, acquired, index: e.index, kind: e.pendingAttack?.kind,
                predicted: e.pendingAttack?.targetX > playerCenter,
                leadTime: e.pendingAttack?.leadTime,
                color: g.config.enemyAttackColors.precision, safe: g.safeCorridor !== null };
        })()`)
        assert.deepEqual(precisionState, {
            fired: true, acquired: true, index: precisionState.index, kind: 'aimed', predicted: true,
            leadTime: precisionState.leadTime, color: '#FFB347', safe: false
        })
        assert.ok(precisionState.leadTime >= 0.25 && precisionState.leadTime <= 0.45)
        const precisionScreenshot = await command('Page.captureScreenshot', { format: 'png' })
        screenshots.set('browser-ufo-precision.png', Buffer.from(precisionScreenshot.data, 'base64'))
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
        screenshots.set('browser-combat.png', Buffer.from(combatScreenshot.data, 'base64'))
        const bossState = await evaluate(`(() => { const g = window.ShootingGame.game;
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
            const previousDt = g.dt;
            g.boss.entering = false;
            g.boss.y = g.config.progression.bossTopMargin;
            g.boss.hp = Math.ceil(g.boss.maxHp * 0.6); g.boss.updatePhase();
            g.boss.attackStep = 1; g.safeCorridor = null;
            const aimed = g.boss.prepareAttack();
            const lockedAngles = [...g.boss.warningAngles];
            const lockedRemaining = g.boss.warningTime;
            g.boss.hp = Math.ceil(g.boss.maxHp * 0.2); g.boss.updatePhase();
            const committedAfterPhase = aimed && g.boss.warningTime === lockedRemaining
                && JSON.stringify(g.boss.warningAngles) === JSON.stringify(lockedAngles);
            g.dt = lockedRemaining; g.boss.update(); g.enemyBullets = {};
            g.boss.attackStep = 2; g.safeCorridor = null;
            const combined = g.boss.prepareAttack();
            const result = { phase: g.boss.phase, combined,
                pattern: g.boss.warningPattern, angleCount: g.boss.warningAngles.length,
                safe: g.safeCorridor === null, committedAfterPhase,
                hiddenPhaseLabel: !Object.values(g.floatingTexts).some(t => t.text.includes('FASE')) };
            g.dt = previousDt;
            return result;
        })()`)
        assert.deepEqual(bossState, { phase: 3, combined: true, pattern: 'crossfire', angleCount: 7,
            safe: true, committedAfterPhase: true, hiddenPhaseLabel: true },
        'boss transition preserves the classic encounter and unlocks warned crossfire')
        const worldEvents = await evaluate(`(() => { const g = window.ShootingGame.game;
            const sounds = [];
            g.__smokeSounds = sounds;
            g.playEnergyPickupSound = () => sounds.push('energy');
            g.playPulseActivationSound = () => sounds.push('pulse');
            g.playPulseImpactSound = outcome => sounds.push('impact:' + outcome.projectiles + ':' + outcome.meteors);
            const meteorsBefore = Object.keys(g.meteors).length;
            const capsulesBefore = Object.values(g.powerUps).filter(item => item.isEnergyPickup).length;
            g.energy = 20; g.energySpawnRemaining = 0; g.meteorSpawnRemaining = 0;
            g.updateWorldEvents(1 / 60);
            const bossSuppressed = Object.keys(g.meteors).length === meteorsBefore
                && Object.values(g.powerUps).filter(item => item.isEnergyPickup).length === capsulesBefore;
            const pickup = new g.entities.EnergyPickup(g.player.x, g.player.y);
            const previousDt = g.dt;
            pickup.x = g.view.width + 100;
            g.dt = 0.5;
            pickup.update();
            const capsuleRotated = Math.abs(pickup.rotation
                - g.config.energy.capsuleRotationSpeed * 0.5) < 0.000001;
            pickup.rotation = Math.PI * 2 - 0.01;
            g.dt = 0.1;
            pickup.update();
            const capsuleRotationContinuous = pickup.rotation > Math.PI * 2;
            pickup.x = g.player.x + g.player.width / 2;
            pickup.y = g.player.y + g.player.height / 2;
            g.dt = 0;
            pickup.update();
            g.dt = previousDt;
            return { energy: g.energy, pickupSound: sounds.includes('energy'),
                configuredPickup: g.rewardEffects.pickupAmount,
                configuredCost: g.rewardEffects.pulseCost,
                energyPickups: Object.values(g.powerUps).filter(item => item.isEnergyPickup).length,
                meteorsAdded: Object.keys(g.meteors).length - meteorsBefore,
                bossSuppressed, capsuleRotated, capsuleRotationContinuous };
        })()`)
        assert.deepEqual(worldEvents, { energy: 40, pickupSound: true,
            configuredPickup: 20, configuredCost: 100, energyPickups: 0,
            meteorsAdded: 0, bossSuppressed: true, capsuleRotated: true,
            capsuleRotationContinuous: true })
        await evaluate(`(() => { const g = window.ShootingGame.game;
            g.bossCount = 3;
            g.meteorSpawnRemaining = 0;
            g.updateWorldEvents(1 / 60);
            if (g.bossMeteorWarningRemaining <= 0) throw new Error('third boss did not announce orbital burst');
            g.boss.entering = false; g.boss.y = g.config.progression.bossTopMargin;
            g.drawScene();
        })()`)
        const bossScreenshot = await command('Page.captureScreenshot', { format: 'png' })
        screenshots.set('browser-boss-meteor.png', Buffer.from(bossScreenshot.data, 'base64'))
        await evaluate('window.ShootingGame.game.meteors = {}')
        const touchControls = await evaluate(`(() => { const buttons = [...document.querySelectorAll('#touchControls button')];
            return { count: buttons.length, labelled: buttons.every(button => button.getAttribute('aria-label')),
                sized: buttons.every(button => parseFloat(getComputedStyle(button).minWidth) >= 56
                    && parseFloat(getComputedStyle(button).minHeight) >= 56) }; })()`)
        assert.deepEqual(touchControls, { count: 5, labelled: true, sized: true })
        const pulseHud = await evaluate(`(() => { const g = window.ShootingGame.game;
            const button = document.querySelector('[data-input-action="pulse"]');
            g.energy = 100; g.drawScene();
            const locked = !g.activateDefensivePulse() && g.energy === 100;
            g.bossActive = false; g.waveStage = g.rules.WAVE_STAGES.WAVE;
            g.drawScene();
            return { locked, ready: g.energy === 100,
                label: button.getAttribute('aria-label') };
        })()`)
        assert.deepEqual(pulseHud, { locked: true, ready: true,
            label: 'Activar pulso defensivo' })
        const pulseHudScreenshot = await command('Page.captureScreenshot', { format: 'png' })
        screenshots.set('browser-pulse-hud.png', Buffer.from(pulseHudScreenshot.data, 'base64'))
        const pulse = await evaluate(`(() => { const g = window.ShootingGame.game;
            g.energy = 100;
            g.enemyBullets = {
                near: { x: g.player.x + g.player.width / 2, y: g.player.y + g.player.height / 2,
                    width: 4, height: 4, update() {}, draw() {} },
                far: { x: g.view.width - 4, y: 0, width: 4, height: 4, update() {}, draw() {} }
            };
            g.meteors = { pulseTarget: {
                x: g.player.x, y: g.player.y, width: 24, height: 24,
                destroy() { delete g.meteors.pulseTarget; }
            } };
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
            window.dispatchEvent(new KeyboardEvent('keyup', { key: 'e' }));
            const first = { energy: g.energy, near: !!g.enemyBullets.near,
                meteor: !!g.meteors.pulseTarget };
            g.energy = 100;
            g.enemyBullets.second = { x: g.player.x, y: g.player.y, width: 4, height: 4 };
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
            window.dispatchEvent(new KeyboardEvent('keyup', { key: 'e' }));
            const result = { first, far: !!g.enemyBullets.far, second: !!g.enemyBullets.second,
                energy: g.energy, activationSounds: g.__smokeSounds.filter(sound => sound === 'pulse').length,
                projectileImpact: g.__smokeSounds.includes('impact:1:0'),
                meteorImpact: g.__smokeSounds.includes('impact:1:1') };
            g.bossActive = true; g.waveStage = g.rules.WAVE_STAGES.BOSS;
            return result;
        })()`)
        assert.deepEqual(pulse, { first: { energy: 0, near: false, meteor: false },
            far: true, second: false, energy: 0, activationSounds: 2,
            projectileImpact: true, meteorImpact: true })
        await evaluate('window.ShootingGame.game.boss.die()')
        await waitFor('document.getElementById("bossRewardDialog")?.open === true')
        const rewardGeometry = await evaluate(`(() => {
            const rect = document.getElementById('bossRewardDialog').getBoundingClientRect();
            return { centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2,
                viewportX: innerWidth / 2, viewportY: innerHeight / 2,
                fits: rect.top >= 0 && rect.bottom <= innerHeight };
        })()`)
        assert.ok(Math.abs(rewardGeometry.centerX - rewardGeometry.viewportX) < 1)
        assert.ok(Math.abs(rewardGeometry.centerY - rewardGeometry.viewportY) < 1)
        assert.equal(rewardGeometry.fits, true)
        const rewardScreenshot = await command('Page.captureScreenshot', { format: 'png' })
        screenshots.set('browser-mission-reward.png', Buffer.from(rewardScreenshot.data, 'base64'))
        const reward = await evaluate(`(() => { const g = window.ShootingGame.game;
            const dialog = document.getElementById('bossRewardDialog');
            const buttons = [...dialog.querySelectorAll('button')];
            const selected = g.activeRewardChoices[0].id;
            buttons[0].click();
            const progress = JSON.parse(localStorage.getItem('warInSpaceProgress'));
            return { options: buttons.length, selected, level: progress.rewards[selected],
                bosses: progress.bossesDefeated, resumed: !g.paused, closed: !dialog.open };
        })()`)
        assert.equal(reward.options, 2)
        assert.equal(reward.level, 1)
        assert.equal(reward.bosses, 1)
        assert.equal(reward.resumed, true)
        assert.equal(reward.closed, true)
        await evaluate(`(() => { const g = window.ShootingGame.game; g.score = 12345; g.gameOver(); })()`)
        assert.equal(await evaluate('window.ShootingGame.game.isGameOver'), true)
        assert.equal(await evaluate("localStorage.getItem('warInSpaceHS')"), '12345')
        await evaluate("document.getElementById('game').click()")
        assert.equal(await evaluate('window.ShootingGame.game.waveStage'), 'intro')
        assert.equal(await evaluate('Object.keys(window.ShootingGame.game.enemies).length'), 0)
        const screenshot = await command('Page.captureScreenshot', { format: 'png' })
        screenshots.set('browser-start.png', Buffer.from(screenshot.data, 'base64'))
        const history = await command('Page.getNavigationHistory')
        const menuEntry = history.entries.find(entry => entry.url === origin + '/index.html')
        assert.ok(menuEntry)
        await command('Page.navigateToHistoryEntry', { entryId: menuEntry.id })
        await waitFor('!!document.getElementById("highScore") && !!window.ShootingGame?.settings')
        assert.equal(await evaluate("document.getElementById('highScore').textContent"), '12,345')
        assert.equal(await evaluate('window.ShootingGame.settings.get().music'), 0.42)
        assert.equal(await evaluate("document.body.classList.contains('fade-out')"), false,
            'back navigation restores a visible, usable menu')
        assert.deepEqual(errors, [], 'no uncaught JavaScript exceptions or missing local resources')
        for (const [name, image] of screenshots) fs.writeFileSync(path.join(artifacts, name), image)
        writeReport('passed', { screenshots: [...screenshots.keys()] })
        console.log('Browser smoke passed: ESM over HTTP, menu, accessible touch controls, ambient energy, instant pulse impacts, meteor disintegration, dynamic boss crossfire, progressive boss orbital attacks, upgraded boss rendering, combat, resize, reward persistence, Game Over, restart and record.')
    } catch (error) {
        const diagnostic = browserDiagnostics(stderr)
        writeReport('failed', { error: error.message, diagnostic })
        console.error('Chromium diagnostics:', diagnostic)
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
