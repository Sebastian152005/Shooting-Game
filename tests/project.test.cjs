const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { browserArguments, browserDiagnostics, findBrowserExecutable } = require('./support/chromium.cjs')

const root = path.resolve(__dirname, '..')
function filesIn(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name)
        return entry.isDirectory() ? filesIn(file) : [file]
    })
}

test('browser runner uses an isolated profile and reports infrastructure failures', () => {
    const profile = path.resolve(root, '.cache', 'browser-profile')
    const args = browserArguments(profile, 800, 600)
    assert.ok(args.includes('--disable-skia-graphite'))
    assert.ok(args.includes('--disable-features=SkiaGraphiteUsePersistentCache,GpuPersistentCache'))
    assert.ok(args.includes('--user-data-dir=' + profile))
    assert.ok(args.includes('--window-size=800,600'))
    assert.equal(args.includes('--no-sandbox'), false)
    assert.equal(findBrowserExecutable({ CHROME_PATH: 'custom-browser' }, candidate => candidate === 'custom-browser'), 'custom-browser')
    assert.match(browserDiagnostics('DawnGraphiteCache\nGPU process isn\'t usable'), /before the game page loaded/)
})

test('every production JavaScript file parses, including scripts not loaded by a game fixture', () => {
    const files = filesIn(path.join(root, 'src', 'js'))
    for (const file of files.filter(file => file.endsWith('.js') && !file.endsWith('-entry.js'))) {
        assert.doesNotThrow(() => new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file }))
    }
})

test('both HTML pages and the resource catalogs reference existing local files', () => {
    for (const page of ['index.html', 'src/html/game.html']) {
        const html = fs.readFileSync(path.join(root, page), 'utf8')
        const base = /<base\b[^>]*href="([^"]+)"/.exec(html)?.[1] || '.'
        const resourceRoot = path.resolve(root, path.dirname(page), base)
        const scripts = []
        for (const [, resource] of html.matchAll(/<(?:script|link|video|a|img|source)\b[^>]*\b(?:src|href)="([^"]+)"/g)) {
            if (/^(?:https?:|data:|#)/.test(resource)) continue
            assert.ok(fs.existsSync(path.resolve(resourceRoot, resource)), page + ': ' + resource)
            if (resource.endsWith('.js')) scripts.push(resource)
        }
        assert.equal(new Set(scripts).size, scripts.length, 'scripts are loaded only once')
        const expectedEntry = page === 'index.html'
            ? 'src/js/bootstrap/menu-entry.js'
            : 'src/js/bootstrap/game-entry.js'
        assert.deepEqual(scripts, [expectedEntry])
        assert.match(html, new RegExp('<script\\s+type="module"\\s+src="' + expectedEntry.replaceAll('/', '\\/') + '"'))
    }
    for (const file of filesIn(path.join(root, 'src')).filter(file => file.endsWith('.js'))) {
        const source = fs.readFileSync(file, 'utf8')
        for (const [, resource] of source.matchAll(/['"](src\/assets\/(?:images|audio|video)\/[^'"]+)['"]/g)) {
            assert.ok(fs.existsSync(path.resolve(root, resource)), file + ': ' + resource)
        }
    }
})

test('every audiovisual asset inherited from the reference ZIP remains available', () => {
    const legacyAssets = [
        'src/assets/images/explosion.png', 'src/assets/images/menu.jpg',
        'src/assets/images/meteorito.png', 'src/assets/images/nave.png',
        'src/assets/images/ovni.png', 'src/assets/images/ovni2.png',
        'src/assets/audio/explosion.mp3', 'src/assets/audio/fondo.mp3',
        'src/assets/audio/laser.mp3', 'src/assets/video/espacio.mp4',
        'src/assets/video/menu.mp4'
    ]
    for (const asset of legacyAssets) assert.ok(fs.existsSync(path.join(root, asset)), asset)
})

test('domain policies run without a browser, Game session, renderer or storage', () => {
    const app = {}
    const context = vm.createContext({ ShootingGame: app })
    for (const file of filesIn(path.join(root, 'src', 'js', 'domain'))) {
        const source = fs.readFileSync(file, 'utf8')
        assert.ok(!/\b(?:document|localStorage|Audio|Image|Game|requestAnimationFrame)\b/.test(source.replace(/\/\/[^\n]*/g, '')),
            'domain must not depend on runtime adapters')
        vm.runInContext(source, context)
    }
    const config = { maxEnemies: 6, progression: { maxEnemies: 10 } }
    const configBefore = JSON.stringify(config)
    const profile = app.domain.progressionProfile(8, config)
    assert.equal(profile.aggressors, true)
    assert.equal(profile.tracking, true)
    assert.equal(profile.precision, true)
    assert.equal(profile.maxEnemies, 9)
    assert.equal(app.domain.enemyRolePreference(app.domain.progressionProfile(1, config), 3), 'pressure')
    assert.equal(app.domain.enemyRolePreference(app.domain.progressionProfile(2, config), 3), 'aggressor')
    assert.equal(app.domain.enemyRolePreference(app.domain.progressionProfile(4, config), 5), 'marksman')
    assert.equal(app.domain.enemyRolePreference(app.domain.progressionProfile(6, config), 0), 'controller')
    const aiState = app.domain.ENEMY_AI_STATES
    let awareness = app.domain.advanceEnemyAI({ state: aiState.PATROL }, {
        entering: false, ready: true, detected: true, dt: 0.1, acquisitionDuration: 0.24
    })
    assert.equal(awareness.state, aiState.ACQUIRING)
    assert.equal(awareness.action, null)
    awareness = app.domain.advanceEnemyAI(awareness, {
        entering: false, ready: true, detected: false, dt: 0.1, acquisitionDuration: 0.24
    })
    assert.equal(awareness.state, aiState.PATROL)
    assert.equal(awareness.action, 'cancel')
    const firstMemory = app.domain.rememberEnemyTarget(null, { x: 10, y: 20, horizontalVelocity: 60 })
    const stableMemory = app.domain.rememberEnemyTarget(firstMemory, { x: 14, y: 20, horizontalVelocity: -60 })
    assert.equal(stableMemory.x, 14)
    assert.ok(stableMemory.horizontalVelocity > -60 && stableMemory.horizontalVelocity < 60)
    assert.equal(JSON.stringify(config), configBefore)
    const occupied = [{ x: 0, y: 78, width: 100, height: 60 }]
    const before = JSON.stringify(occupied)
    const position = app.domain.formation.findPosition({ width: 100, height: 60 },
        { left: 0, right: 360, top: 78, bottom: 282 }, occupied, { x: 0, y: 78 }, 12)
    assert.ok(position)
    assert.equal(app.domain.formation.overlaps(position, occupied[0], 12), false)
    assert.equal(JSON.stringify(occupied), before)
})

test('wave lifecycle accepts only explicit domain transitions', () => {
    const app = { domain: {} }
    const context = vm.createContext({ ShootingGame: app })
    vm.runInContext(fs.readFileSync(path.join(root, 'src/js/domain/wave-state.js'), 'utf8'), context)
    const { WAVE_EVENTS: event, WAVE_STAGES: stage, transitionWaveStage } = app.domain
    let current = stage.INTRO
    for (const nextEvent of [event.INTRO_COMPLETED, event.BOSS_REQUESTED, event.BOSS_STARTED,
        event.BOSS_DEFEATED, event.RECOVERY_COMPLETED]) {
        current = transitionWaveStage(current, nextEvent)
    }
    assert.equal(current, stage.WAVE)
    assert.throws(() => transitionWaveStage(stage.INTRO, event.BOSS_STARTED), /Invalid wave transition/)
})

test('boss attack policy preserves the classic spread and adds a deterministic combined cycle', () => {
    const app = { domain: {} }
    const context = vm.createContext({ ShootingGame: app })
    vm.runInContext(fs.readFileSync(path.join(root, 'src/js/domain/boss-attacks.js'), 'utf8'), context)
    const pattern = app.domain.BOSS_ATTACK_PATTERNS
    assert.equal(app.domain.bossAttackPattern(1, 99), pattern.CLASSIC)
    assert.equal(app.domain.bossAttackPattern(2, 0), pattern.FAN)
    assert.equal(app.domain.bossAttackPattern(2, 1), pattern.AIMED)
    assert.deepEqual(Array.from([0, 1, 2], step => app.domain.bossAttackPattern(3, step)),
        [pattern.FAN, pattern.AIMED, pattern.CROSSFIRE])
    assert.deepEqual(Array.from(app.domain.bossAttackAngles(pattern.CLASSIC)),
        [-0.35, -0.15, 0, 0.15, 0.35])
    const combined = app.domain.bossAttackAngles(pattern.CROSSFIRE, 0.2, 3)
    assert.equal(combined.length, 7)
    assert.ok(combined.includes(0.2))
})

test('runtime entities delegate drawing instead of embedding canvas operations', () => {
    for (const file of filesIn(path.join(root, 'src', 'js', 'application', 'entities'))) {
        const source = fs.readFileSync(file, 'utf8')
        assert.ok(!/\b(?:ctx|fillText|drawImage|shadowBlur|strokeStyle|fillStyle)\b/.test(source.replace(/\/\/[^\n]*/g, '')),
            'drawing belongs in presentation: ' + path.basename(file))
    }
})

test('projectile sweeps follow the actual segment instead of filling its diagonal bounding box', () => {
    const app = {}
    const context = vm.createContext({ ShootingGame: app })
    vm.runInContext(fs.readFileSync(path.join(root, 'src/js/domain/collision.js'), 'utf8'), context)
    const projectile = { x: 0, y: 100, width: 6, height: 24 }
    const movement = { x: 100, y: -100 }
    assert.equal(app.domain.projectileContact(projectile, movement, { x: 80, y: 100, width: 10, height: 10 }), null)
    const time = app.domain.projectileContact(projectile, movement, { x: 50, y: 50, width: 10, height: 10 })
    assert.ok(Math.abs(time - 0.44) < 0.000001)
    assert.equal(app.domain.projectileContact(projectile, { x: 0, y: -100 }, { x: 50, y: 50, width: 10, height: 10 }), null)
})

test('motion policies produce smooth, bounded patrol paths and off-screen arrivals', () => {
    const app = {}
    const context = vm.createContext({ ShootingGame: app })
    vm.runInContext(fs.readFileSync(path.join(root, 'src/js/domain/motion.js'), 'utf8'), context)
    const config = { waveAmplitude: 35, wavePeriod: 3.2, zigzagPeriod: 2.8 }
    const wave = t => app.domain.enemyMotion('sine', t, 0, 78, 156, config).y
    const zigzag = t => app.domain.enemyMotion('zigzag', t, 0, 78, 156, config).y
    assert.ok(Math.abs(wave(0.8) - 152) < 0.000001)
    assert.ok(Math.abs(wave(2.4) - 82) < 0.000001)
    assert.ok(Math.abs(zigzag(1.4) - 156) < 0.000001)
    assert.ok(Math.abs(zigzag(2.8) - 78) < 0.000001)
    assert.ok(Math.abs((zigzag(0.4) - zigzag(0.2)) - (zigzag(0.6) - zigzag(0.4))) > 0.1)
    assert.ok(Math.abs((wave(0.4) - wave(0.2)) - (wave(0.6) - wave(0.4))) > 1)
    for (let t = 0; t < 5; t += 0.02) {
        const narrow = app.domain.enemyMotion('sine', t, 0, 78, 98, config).y
        assert.ok(narrow >= 78 && narrow <= 98)
    }
    const start = app.domain.enemyEntryMotion({ x: 100, y: -72 }, { x: 100, y: 90 }, 0, 1.25, 0, 18, 800)
    const middle = app.domain.enemyEntryMotion({ x: 100, y: -72 }, { x: 100, y: 90 }, 0.625, 1.25, 0, 18, 800)
    const end = app.domain.enemyEntryMotion({ x: 100, y: -72 }, { x: 100, y: 90 }, 1.25, 1.25, 0, 18, 800)
    assert.equal(JSON.stringify(start), JSON.stringify({ x: 100, y: -72, progress: 0, done: false }))
    assert.ok(middle.x > 100 && middle.y > -72 && middle.y < 90)
    assert.equal(JSON.stringify(end), JSON.stringify({ x: 100, y: 90, progress: 1, done: true }))
})

test('targeting gates straight fire by lane and bounded homing converges without snapping', () => {
    const app = {}
    const context = vm.createContext({ ShootingGame: app })
    vm.runInContext(fs.readFileSync(path.join(root, 'src/js/domain/targeting.js'), 'utf8'), context)
    const player = { x: 300, y: 400, width: 70, height: 70 }
    assert.equal(app.domain.targetInFiringLane({ x: 335, y: 100 }, player, 48), true)
    assert.equal(app.domain.targetInFiringLane({ x: 200, y: 100 }, player, 48), false)
    assert.equal(app.domain.targetInFiringLane({ x: 335, y: 500 }, player, 48), false)
    assert.ok(Math.abs(app.domain.steerLateral(0, 100, 500, 0.1, 4.2, 2.25) - 0.42) < 0.000001)
    assert.equal(app.domain.steerLateral(2.2, 100, 500, 1, 4.2, 2.25), 2.25)
    assert.deepEqual(JSON.parse(JSON.stringify(app.domain.predictHorizontalIntercept({
        targetX: 335, targetVelocity: 300, verticalDistance: 400, projectileSpeed: 4,
        minimumLead: 0.25, maximumLead: 0.45, minimumX: 35, maximumX: 865
    }))), { x: 470, leadTime: 0.45 })
    assert.deepEqual(JSON.parse(JSON.stringify(app.domain.predictHorizontalIntercept({
        targetX: 850, targetVelocity: 300, verticalDistance: 10, projectileSpeed: 4,
        minimumLead: 0.25, maximumLead: 0.45, minimumX: 35, maximumX: 865
    }))), { x: 865, leadTime: 0.25 })
})

test('production files stay in their assigned source folders and index is the only root HTML entry', () => {
    const rootCode = fs.readdirSync(root).filter(file => /\.(?:html|css|js)$/.test(file))
    assert.deepEqual(rootCode, ['index.html'])
    for (const file of filesIn(path.join(root, 'src'))) {
        const relative = path.relative(path.join(root, 'src'), file).replaceAll('\\', '/')
        if (file.endsWith('.js')) assert.ok(relative.startsWith('js/'), relative)
        if (file.endsWith('.css')) assert.ok(relative.startsWith('css/'), relative)
        if (file.endsWith('.html')) assert.ok(relative.startsWith('html/'), relative)
        if (/\.(?:png|jpg|mp3|mp4)$/.test(file)) assert.ok(relative.startsWith('assets/'), relative)
    }
})

test('application code uses injected ports rather than browser APIs or concrete adapter singletons', () => {
    for (const file of filesIn(path.join(root, 'src/js/application'))) {
        const source = fs.readFileSync(file, 'utf8').replace(/\/\/[^\n]*/g, '').replaceAll('window.ShootingGame', 'namespace')
        assert.ok(!/\b(?:document|window|localStorage|Audio|Image|performance|requestAnimationFrame)\b/.test(source), path.basename(file))
        assert.ok(!/app\.(?:assets|storage|settings|config|domain|utils)\b/.test(source), path.basename(file))
    }
})

test('application settings and session services can be constructed with fake ports without DOM or media', () => {
    const app = {}
    const context = vm.createContext({ ShootingGame: app })
    for (const file of ['settings.js', 'game.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, 'src/js/application', file), 'utf8'), context)
    }
    let saved = null
    const storage = { readAudioSettings: () => saved, writeAudioSettings: settings => { saved = settings }, readHighScore: () => 12 }
    const settings = app.createSettings(storage, { music: 0.3, effects: 0.5, muted: false })
    settings.update({ music: 2, effects: -1 })
    assert.equal(saved.music, 1)
    assert.equal(saved.effects, 0)
    const session = app.createGame({ storage, randomFloat: () => 0.25, rules: { geometry: { collision: () => true } } })
    assert.equal(session.random(0, 100), 25)
    assert.equal(session.readHighScore(), 12)
    assert.equal(session.collision({}, {}), true)
})
