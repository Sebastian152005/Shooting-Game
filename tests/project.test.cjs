const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')
function filesIn(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name)
        return entry.isDirectory() ? filesIn(file) : [file]
    })
}

test('every production JavaScript file parses, including scripts not loaded by a game fixture', () => {
    const files = filesIn(path.join(root, 'src', 'js'))
    for (const file of files.filter(file => file.endsWith('.js'))) {
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
        assert.equal(scripts[0], 'src/js/config.js')
    }
    for (const file of filesIn(path.join(root, 'src')).filter(file => file.endsWith('.js'))) {
        const source = fs.readFileSync(file, 'utf8')
        for (const [, resource] of source.matchAll(/['"](src\/assets\/(?:images|audio|video)\/[^'"]+)['"]/g)) {
            assert.ok(fs.existsSync(path.resolve(root, resource)), file + ': ' + resource)
        }
    }
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
    assert.equal(profile.homing, true)
    assert.equal(profile.maxEnemies, 9)
    assert.equal(JSON.stringify(config), configBefore)
    const occupied = [{ x: 0, y: 78, width: 100, height: 60 }]
    const before = JSON.stringify(occupied)
    const position = app.domain.formation.findPosition({ width: 100, height: 60 },
        { left: 0, right: 360, top: 78, bottom: 282 }, occupied, { x: 0, y: 78 }, 12)
    assert.ok(position)
    assert.equal(app.domain.formation.overlaps(position, occupied[0], 12), false)
    assert.equal(JSON.stringify(occupied), before)
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

test('motion policies produce curved waves and linear zigzag segments within the available height', () => {
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
    assert.ok(Math.abs((zigzag(0.4) - zigzag(0.2)) - (zigzag(0.6) - zigzag(0.4))) < 0.000001)
    assert.ok(Math.abs((wave(0.4) - wave(0.2)) - (wave(0.6) - wave(0.4))) > 1)
    for (let t = 0; t < 5; t += 0.02) {
        const narrow = app.domain.enemyMotion('sine', t, 0, 78, 98, config).y
        assert.ok(narrow >= 78 && narrow <= 98)
    }
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
