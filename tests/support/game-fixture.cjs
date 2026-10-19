const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')

// Load the same scripts, in the same order, as the browser entry page.
// Browser APIs are controlled; no video, audio or real-time timer is required.
function setup({ blockedStorage = false, storedScore = null, imageStatus = 'loading',
    width = 900, height = 540, pixelRatio = 1, audioPanel = false,
    storageValues = new Map(), synthAudio = false, page = 'src/html/game.html', readyEnemies = true, seed = 42 } = {}) {
    const frames = new Map()
    const listeners = new Map()
    let nextFrame = 1
    const images = []
    const drawnImages = []
    const videoDraws = []
    const transforms = []
    const drawnTexts = []
    let bounds = { width, height }
    let fallbackFills = 0
    class MockImage {
        constructor() {
            this.complete = imageStatus !== 'loading'
            this.naturalWidth = imageStatus === 'loaded' ? 100 : 0
            images.push(this)
        }
    }
    const listen = (type, callback) => {
        const callbacks = listeners.get(type) || []
        callbacks.push(callback)
        listeners.set(type, callbacks)
    }
    const gradient = { addColorStop() {} }
    const context = new Proxy({}, {
        get(target, key) {
            if (key === 'fillText') return text => { drawnTexts.push(text) }
            if (key === 'setTransform') return (...values) => { transforms.push(values) }
            if (key === 'drawImage') return (image, ...values) => {
                if (image instanceof MockImage) {
                    assert.ok(image.complete && image.naturalWidth > 0, 'never draw an unavailable image')
                    drawnImages.push(image)
                } else videoDraws.push(values)
            }
            if (key === 'fill') return () => { fallbackFills++ }
            if (key === 'measureText') return () => ({ width: 20 })
            if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => gradient
            return target[key] || (() => {})
        }
    })
    const canvas = { width: 900, height: 540, getContext: () => context, addEventListener: listen,
        focus() {},
        getBoundingClientRect: () => bounds }
    const controls = new Map()
    function control() {
        const handlers = new Map()
        return {
            value: '', textContent: '', attributes: {},
            addEventListener(type, handler) { handlers.set(type, handler) },
            setAttribute(name, value) { this.attributes[name] = value },
            dispatch(type, event = { preventDefault() {} }) { handlers.get(type)(event) },
            closest() { return this }
        }
    }
    const panel = {
        innerHTML: '',
        querySelector(selector) {
            if (!controls.has(selector)) controls.set(selector, control())
            return controls.get(selector)
        }
    }
    const record = control()
    const play = control()
    const resume = control()
    const pauseMenu = { ...control(), open: false,
        showModal() { this.open = true }, close() { this.open = false } }
    class Media {
        constructor() { this.style = {}; this.paused = true; this.readyState = 0 }
        play() { this.paused = false; return Promise.resolve() }
        pause() { this.paused = true }
        addEventListener() {}
    }
    const document = {
        hidden: false,
        getElementById: id => ({ game: canvas, audioSettings: audioPanel ? panel : null,
            pauseMenu, resumeGame: resume,
            highScore: record, btnPlay: play }[id] || null),
        createElement: () => new Media(),
        addEventListener: listen,
        body: {
            classList: { add() {}, remove() {} },
            appendChild(media) { media.parentNode = this },
            removeChild(media) { media.parentNode = null }
        }
    }
    const window = {
        devicePixelRatio: pixelRatio,
        addEventListener: listen,
        requestAnimationFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id },
        cancelAnimationFrame(id) { frames.delete(id) }
    }
    if (synthAudio) {
        const parameter = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} })
        window.AudioContext = class {
            constructor() { this.nodes = []; this.destination = {}; this.state = 'running'; this.currentTime = 1; this.sampleRate = 8000 }
            resume() { this.state = 'running'; return Promise.resolve() }
            node() {
                const node = { connections: [], gain: parameter(), frequency: parameter(),
                    connect(destination) { this.connections.push(destination) }, start() {}, stop() {} }
                this.nodes.push(node)
                return node
            }
            createGain() { return this.node() }
            createOscillator() { return this.node() }
            createBufferSource() { return this.node() }
            createBiquadFilter() { return this.node() }
            createBuffer(channels, size) { return { getChannelData: () => new Float32Array(size) } }
        }
    }
    if (storedScore !== null) storageValues.set('warInSpaceHS', storedScore)
    const seededMath = Object.create(Math)
    let randomState = seed >>> 0
    seededMath.random = () => {
        randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0
        return randomState / 4294967296
    }
    const sandbox = {
        Math: seededMath,
        window, document, Image: MockImage, Audio: Media,
        performance: { now: () => 1 },
        localStorage: {
            getItem(key) { if (blockedStorage) throw Error('blocked'); return storageValues.get(key) ?? null },
            setItem(key, value) { if (blockedStorage) throw Error('blocked'); storageValues.set(key, String(value)) }
        }
    }
    const root = path.join(__dirname, '..', '..')
    const html = fs.readFileSync(path.join(root, page), 'utf8')
    const contextSandbox = vm.createContext(sandbox)
    const runScript = file => {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), contextSandbox, { filename: file })
    }
    for (const [, attributes, file] of html.matchAll(/<script\b([^>]*)\bsrc="([^"]+)"[^>]*><\/script>/g)) {
        if (!/\btype="module"/.test(attributes)) {
            runScript(file)
            continue
        }
        const entry = path.join(root, file)
        const entryDirectory = path.dirname(entry)
        const source = fs.readFileSync(entry, 'utf8')
        for (const [, specifier] of source.matchAll(/^\s*import\s+['"]([^'"]+)['"]\s*;?\s*$/gm)) {
            const dependency = path.resolve(entryDirectory, specifier)
            runScript(path.relative(root, dependency))
        }
    }
    const app = contextSandbox.ShootingGame
    const Game = app.game
    if (page === 'index.html') return { app, controls, record, listeners, storageValues }
    const { Bullet, Enemy, Boss } = Game.entities
    Game.configureEnemiesForTest = function () {
        Game.applyWaveProfile()
        for (const enemy of Object.values(Game.enemies)) enemy.role = null
        for (const enemy of Object.values(Game.enemies)) enemy.configure(Game.waveProfile)
    }
    Game.spawnBossForTest = function () {
        // Boss-focused fixtures start with a deliberately cleared field.
        Game.waveStage = Game.rules.transitionWaveStage(Game.waveStage, Game.rules.WAVE_EVENTS.BOSS_REQUESTED)
        Game.enemies = {}
        return new Boss()
    }
    // Most combat tests need an established formation. Intro is tested separately.
    function prepareCombat() {
        Game.waveStage = 'wave'
        Game.introRemaining = 0
        Game.pendingSpawns = []
        for (let i = 0; i < Game.maxEnemies; i++) {
            const enemy = new Enemy()
            const occupied = Object.values(Game.enemies).filter(other => other !== enemy)
            const gap = app.config.progression.enemySeparation
            const columns = Math.floor((Game.view.width + gap) / (enemy.width + gap))
            const preferred = { x: (i % columns) * (enemy.width + gap),
                y: Game.enemyBounds().top + Math.floor(i / columns) * (enemy.height + gap) }
            const position = app.domain.formation.findPosition(enemy,
                Game.enemyBounds(), occupied, preferred, gap)
            assert.ok(position, 'combat fixture fits the viewport')
            enemy.x = position.x
            enemy.y = position.y
            enemy.homeY = enemy.y
            enemy.entering = false
            enemy.entryKind = null
            enemy.entryPathBounds = null
        }
        Game.refreshEnemyCount()
    }
    if (readyEnemies) prepareCombat()
    Game.advanceSpawnsForTest = function (seconds) {
        const previousDt = Game.dt
        Game.dt = 0.05
        for (let time = 0; time < seconds; time += Game.dt) {
            Game.updateSpawns(Game.dt)
            for (const enemy of Object.values(Game.enemies)) {
                enemy.shootTimer = 0
                enemy.update()
            }
        }
        Game.dt = previousDt
    }
    function frame(timestamp = 16) {
        assert.equal(frames.size, 1, 'exactly one active animation frame')
        const [id, callback] = frames.entries().next().value
        frames.delete(id)
        callback(timestamp)
    }
    return { Game, Bullet, Enemy, Boss, frames, listeners, document, frame,
        images, drawnImages, videoDraws, transforms, assets: app.assets,
        drawnTexts, prepareCombat,
        app, controls, storageValues,
        pauseMenu, resume,
        fallbackFills: () => fallbackFills,
        resize(width, height, ratio = window.devicePixelRatio) {
            bounds = { width, height }
            window.devicePixelRatio = ratio
            listeners.get('resize')[0]()
        } }
}

module.exports = { setup }
