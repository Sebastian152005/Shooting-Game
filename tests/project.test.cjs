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
    assert.ok(browserArguments(profile, 800, 600, { disableSandbox: true }).includes('--no-sandbox'))
    assert.ok(browserArguments(profile, 800, 600, { softwareCanvas: true }).includes('--disable-gpu'))
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
    const config = { maxEnemies: 6, firstBossLevel: 5, progression: {
        maxEnemies: 10, maxChargedAttacks: 2,
        bossBaseHp: 28, bossHpPerLevel: 2, bossHpPerDefeat: 6, bossMaxHp: 120
    } }
    const configBefore = JSON.stringify(config)
    const profile = app.domain.progressionProfile(8, config)
    assert.equal(profile.aggressors, true)
    assert.equal(profile.tracking, true)
    assert.equal(profile.precision, true)
    assert.equal(profile.maxEnemies, 9)
    assert.equal(app.domain.progressionProfile(2, config).maxChargedAttacks, 1)
    assert.equal(app.domain.progressionProfile(3, config).maxChargedAttacks, 2)
    assert.equal(app.domain.bossHealth(5, 1, config), 28)
    assert.equal(app.domain.bossHealth(9, 2, config), 42)
    const intensityConfig = {
        cycleDuration: 18, buildupEnd: 0.3, assaultEnd: 0.72,
        buildupFireMultiplier: 1, assaultFireMultiplier: 0.78,
        recoveryFireMultiplier: 1.22
    }
    assert.deepEqual(JSON.parse(JSON.stringify(app.domain.combatIntensityProfile(1, intensityConfig, 2))),
        { phase: 'buildup', commonFireMultiplier: 1, specialAttackLimit: 1 })
    assert.deepEqual(JSON.parse(JSON.stringify(app.domain.combatIntensityProfile(8, intensityConfig, 2))),
        { phase: 'assault', commonFireMultiplier: 0.78, specialAttackLimit: 2 })
    assert.deepEqual(JSON.parse(JSON.stringify(app.domain.combatIntensityProfile(16, intensityConfig, 2))),
        { phase: 'recovery', commonFireMultiplier: 1.22, specialAttackLimit: 1 })
    const adaptiveIntensity = {
        ...intensityConfig, adaptive: true, overwhelmedThreshold: 0.58, dominantThreshold: 0.2,
        dominanceDelay: 10, maximumCadenceRelief: 0.15, maximumCadencePressure: 0.1,
        maximumBuildupExtension: 0.06, maximumBuildupReduction: 0.04,
        maximumRecoveryExtension: 0.1, maximumAssaultExtension: 0.06
    }
    const relief = app.domain.combatIntensityProfile(12.5, adaptiveIntensity, 2, {
        smoothedPressure: 0.9, timeSincePlayerHit: 0
    })
    assert.equal(relief.phase, 'recovery', 'high pressure brings the recovery window forward')
    assert.equal(relief.adaptation, 'relief')
    assert.equal(relief.specialAttackLimit, 1)
    assert.ok(relief.commonFireMultiplier > intensityConfig.recoveryFireMultiplier)
    const pressure = app.domain.combatIntensityProfile(5, adaptiveIntensity, 2, {
        smoothedPressure: 0.05, timeSincePlayerHit: 14
    })
    assert.equal(pressure.phase, 'assault', 'sustained control advances the next pressure window')
    assert.equal(pressure.adaptation, 'pressure')
    assert.ok(pressure.commonFireMultiplier < intensityConfig.assaultFireMultiplier)
    const telemetryTarget = app.domain.combatPressureTarget({
        hostileProjectiles: 18, meteors: 4, enemies: 6, enemyCapacity: 6,
        damageTaken: 3, maximumDamage: 5, recentDamageRemaining: 2
    }, { projectileCapacity: 18, meteorCapacity: 4 })
    assert.ok(telemetryTarget > 0.8 && telemetryTarget <= 1)
    const smoothed = app.domain.smoothCombatPressure(0, telemetryTarget, 0.1, 1.8)
    assert.ok(smoothed > 0 && smoothed < telemetryTarget, 'adaptation changes gradually instead of snapping')
    assert.equal(app.domain.enemyRolePreference(app.domain.progressionProfile(1, config), 3), 'pressure')
    assert.equal(app.domain.enemyRolePreference(app.domain.progressionProfile(2, config), 3), 'aggressor')
    assert.equal(app.domain.enemyRolePreference(app.domain.progressionProfile(4, config), 5), 'marksman')
    assert.equal(app.domain.enemyRolePreference(app.domain.progressionProfile(6, config), 0), 'controller')
    assert.equal(app.domain.variedEnemyRolePreference(app.domain.progressionProfile(6, config), 0, 0), 'aggressor')
    const levelOneProfile = app.domain.progressionProfile(1, config)
    const levelTwoProfile = app.domain.progressionProfile(2, config)
    assert.equal(app.domain.enemyEntryAllowsSide(levelOneProfile), false)
    assert.equal(app.domain.enemyEntryAllowsSide(levelTwoProfile), true)
    assert.equal(app.domain.enemyEntryRequiresSpecialist(levelOneProfile, 'side'), false)
    assert.equal(app.domain.enemyEntryRequiresSpecialist(levelTwoProfile, 'side'), true)
    assert.deepEqual(Array.from(app.domain.enemyEntryKindsForRole(levelTwoProfile, 'aggressor')), ['side'])
    assert.deepEqual(Array.from(app.domain.enemyEntryKindsForRole(levelTwoProfile, 'pressure')), ['top'])
    assert.deepEqual(Array.from(app.domain.enemyEntryKindsForRole(levelTwoProfile, 'marksman')), ['top'])
    assert.equal(app.domain.enemyEntryDuration('top', 1, 1, 0.65, 0.95), 1)
    assert.equal(app.domain.enemyEntryDuration('side', 1, 1, 0.65, 0.95), 0.65)
    assert.equal(app.domain.enemyEntryDuration('side', 2, 1, 0.65, 0.95), 0.95)
    assert.equal(app.domain.canUseEnemyEntry(levelOneProfile, 'side', [], 6, 2, 2), false)
    assert.equal(app.domain.canUseEnemyEntry(levelTwoProfile, 'side', ['pressure'], 6, 2, 2), true)
    assert.equal(app.domain.canUseEnemyEntry(levelTwoProfile, 'side',
        ['aggressor', 'aggressor', 'pressure'], 6, 2, 2), false)
    assert.equal(app.domain.enemyEntryRolePreference(levelOneProfile, 'pressure', 'side'), 'pressure')
    assert.equal(app.domain.enemyEntryRolePreference(levelTwoProfile, 'pressure', 'top'), 'pressure')
    assert.equal(app.domain.enemyEntryRolePreference(levelTwoProfile, 'pressure', 'side'), 'aggressor')
    assert.equal(app.domain.canAssignEnemyRole('aggressor', ['pressure'], 6, 2, 2), true)
    assert.equal(app.domain.canAssignEnemyRole('aggressor', ['aggressor', 'aggressor'], 6, 2, 2), false)
    const cadenceTraits = Array.from({ length: 8 }, (_, index) => app.domain.enemyCadenceTrait(index, 0.12))
    assert.ok(new Set(cadenceTraits).size > 1)
    assert.ok(cadenceTraits.every(value => value >= 0.88 && value <= 1.12))
    const movementTraits = Array.from({ length: 8 }, (_, index) => app.domain.enemyMovementTrait(index, 0.18))
    assert.ok(new Set(movementTraits).size > 4)
    assert.ok(movementTraits.every(value => value >= 0.82 && value <= 1.18))
    const commonSignature = app.domain.enemyArchetypeSignature('pressure')
    const aggressorSignature = app.domain.enemyArchetypeSignature('aggressor')
    const marksmanSignature = app.domain.enemyArchetypeSignature('marksman')
    const controllerSignature = app.domain.enemyArchetypeSignature('controller')
    assert.ok(aggressorSignature.movementScale > commonSignature.movementScale)
    assert.ok(marksmanSignature.entrySwayScale < commonSignature.entrySwayScale)
    assert.ok(controllerSignature.entrySwayScale > commonSignature.entrySwayScale)
    assert.equal(new Set([commonSignature.bankScale, aggressorSignature.bankScale,
        marksmanSignature.bankScale, controllerSignature.bankScale]).size, 4)
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
    assert.equal(app.domain.combatDirective({ phase: 'assault', adaptation: 'neutral' }), 'press')
    assert.equal(app.domain.combatDirective({ phase: 'assault', adaptation: 'relief' }), 'recover')
    const unawareIntent = app.domain.decideEnemyIntent({
        role: 'pressure', directive: 'position', originX: 200, movingLeft: false,
        index: 0, viewportWidth: 900, enemyWidth: 100
    })
    assert.deepEqual(JSON.parse(JSON.stringify(unawareIntent)),
        { mode: 'patrol', desiredX: null, movingLeft: false, movementMultiplier: 1 })
    const commonIntent = app.domain.decideEnemyIntent({
        role: 'pressure', directive: 'press', originX: 200, targetX: 300,
        targetVelocity: 100, readiness: 0.8, readinessThreshold: 0.68,
        pressMovementMultiplier: 1.22,
        movingLeft: true, index: 0, viewportWidth: 900, enemyWidth: 100
    })
    assert.equal(commonIntent.mode, 'press')
    assert.equal(commonIntent.desiredX, null)
    assert.equal(commonIntent.movingLeft, true)
    assert.equal(commonIntent.movementMultiplier, 1.22)
    const settledIntent = app.domain.decideEnemyIntent({
        role: 'pressure', directive: 'press', originX: 300, targetX: 300,
        movingLeft: true, index: 1, viewportWidth: 900, enemyWidth: 100,
        deadzone: 12, readiness: 1, readinessThreshold: 0.68
    })
    assert.equal(settledIntent.desiredX, null)
    assert.equal(settledIntent.movingLeft, true)
    const waitingSpecialist = app.domain.decideEnemyIntent({
        role: 'controller', directive: 'press', originX: 300, targetX: 500,
        readiness: 0.2, positioningReadiness: 0.58,
        movingLeft: false, index: 2, viewportWidth: 900, enemyWidth: 100
    })
    assert.equal(waitingSpecialist.mode, 'patrol')
    assert.equal(waitingSpecialist.desiredX, null)
    const aggressorIntent = app.domain.decideEnemyIntent({
        role: 'aggressor', aiState: aiState.RECOVERY, directive: 'press',
        originX: 400, targetX: 450, movingLeft: false, index: 2,
        viewportWidth: 900, enemyWidth: 100
    })
    assert.equal(aggressorIntent.mode, 'recover')
    assert.equal(aggressorIntent.movingLeft, true)
    assert.equal(app.domain.hasSpecialAttackConflict({ kind: 'tracking', x: 200 },
        [{ kind: 'tracking', x: 300 }, { kind: 'aimed', x: 210 }], 170), true)
    assert.equal(app.domain.hasSpecialAttackConflict({ kind: 'tracking', x: 200 },
        [{ kind: 'tracking', x: 400 }, { kind: 'aimed', x: 210 }], 170), false)
    assert.deepEqual(JSON.parse(JSON.stringify(app.domain.enemyTrafficPlan({
        actorIndex: 4, blockerIndex: 2, actorX: 250, actorCenter: 300,
        blockerCenter: 360, maximumX: 800, clearance: 112
    }))), { yields: true, horizontalDirection: -1, verticalDirection: -1 })
    assert.equal(app.domain.enemyTrafficPlan({
        actorIndex: 1, blockerIndex: 5, actorX: 250, actorCenter: 300,
        blockerCenter: 360, maximumX: 800, clearance: 112
    }).yields, false)
    assert.equal(JSON.stringify(config), configBefore)
    const occupied = [{ x: 0, y: 78, width: 100, height: 60 }]
    const before = JSON.stringify(occupied)
    const position = app.domain.formation.findPosition({ width: 100, height: 60 },
        { left: 0, right: 360, top: 78, bottom: 282 }, occupied, { x: 0, y: 78 }, 12)
    assert.ok(position)
    assert.equal(app.domain.formation.overlaps(position, occupied[0], 12), false)
    const routes = [
        { kind: 'top', path: { x: 0, y: 0, width: 100, height: 200 } },
        { kind: 'side', path: { x: 220, y: 80, width: 200, height: 60 } }
    ]
    assert.equal(app.domain.formation.findEntryRoute(routes,
        [{ x: 0, y: 0, width: 100, height: 200 }], 0, true), null)
    assert.equal(app.domain.formation.findEntryRoute(routes,
        [{ x: 0, y: 0, width: 100, height: 200 }], 0, false).kind, 'side')
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
    assert.equal(app.domain.bossAttackPattern(1, 0), pattern.CLASSIC)
    assert.equal(app.domain.bossAttackPattern(1, 1), pattern.AIMED)
    assert.equal(app.domain.bossAttackPattern(1, 99), pattern.CLASSIC)
    assert.equal(app.domain.bossAttackPattern(2, 0), pattern.FAN)
    assert.equal(app.domain.bossAttackPattern(2, 1), pattern.AIMED)
    assert.equal(app.domain.bossAttackPattern(2, 2), pattern.CLASSIC)
    assert.equal(app.domain.bossAttackRequiresWarning(pattern.CLASSIC), false)
    assert.equal(app.domain.bossAttackRequiresWarning(pattern.AIMED), true)
    const openingMovement = app.domain.bossMovementPlan({
        phase: 1, step: 0, playerX: 450, viewportWidth: 900, bossWidth: 180
    })
    const enragedMovement = app.domain.bossMovementPlan({
        phase: 3, step: 1, playerX: 450, playerVelocity: 120,
        viewportWidth: 900, bossWidth: 180
    })
    assert.ok(openingMovement.targetX < 180)
    assert.ok(enragedMovement.targetX > 450)
    assert.ok(enragedMovement.speedMultiplier > openingMovement.speedMultiplier)
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
    const lateralStart = app.domain.enemyEntryMotion({ x: -112, y: 100 }, { x: 80, y: 100 }, 0, 1, 0, 28, 800)
    const lateralMiddle = app.domain.enemyEntryMotion({ x: -112, y: 100 }, { x: 80, y: 100 }, 0.5, 1, 0, 28, 800)
    const lateralEnd = app.domain.enemyEntryMotion({ x: -112, y: 100 }, { x: 80, y: 100 }, 1, 1, 0, 28, 800)
    assert.equal(lateralStart.x, -112, 'lateral arrivals remain off screen at the start')
    assert.ok(lateralMiddle.x > lateralStart.x && lateralMiddle.x < lateralEnd.x)
    assert.equal(lateralEnd.x, 80)
})

test('targeting uses normalized awareness, predictive straight fire and bounded homing', () => {
    const app = {}
    const context = vm.createContext({ ShootingGame: app })
    vm.runInContext(fs.readFileSync(path.join(root, 'src/js/domain/targeting.js'), 'utf8'), context)
    const player = { x: 300, y: 400, width: 70, height: 70 }
    const awareness = app.domain.targetAwareness({ x: 100, y: 100 }, player, 500, 600)
    const scaledAwareness = app.domain.targetAwareness({ x: 200, y: 200 },
        { x: 600, y: 800, width: 140, height: 140 }, 1000, 1200)
    assert.equal(awareness.detected, true)
    assert.ok(Math.abs(awareness.confidence - scaledAwareness.confidence) < 0.000001,
        'sensor confidence is independent from physical pixel dimensions')
    const crossing = app.domain.straightShotOpportunity({
        originX: 378, targetX: 335, targetVelocity: 180, stability: 0.8, observations: 3,
        verticalDistance: 300, projectileSpeed: 4, targetWidth: 70,
        viewportWidth: 900, toleranceRatio: 0.045, engagementRatio: 0.1, maximumLead: 0.32
    })
    const escaping = app.domain.straightShotOpportunity({
        originX: 100, targetX: 600, targetVelocity: 180, stability: 0.8, observations: 3,
        verticalDistance: 300, projectileSpeed: 4, targetWidth: 70,
        viewportWidth: 900, toleranceRatio: 0.045, engagementRatio: 0.1, maximumLead: 0.32
    })
    const unstable = app.domain.straightShotOpportunity({
        originX: 378, targetX: 335, targetVelocity: -180, stability: 0.2, observations: 1,
        verticalDistance: 300, projectileSpeed: 4, targetWidth: 70,
        viewportWidth: 900, toleranceRatio: 0.045, engagementRatio: 0.1, maximumLead: 0.32
    })
    assert.equal(crossing.canFire, true)
    assert.equal(escaping.canFire, false)
    assert.equal(unstable.canFire, false, 'a direction change must be observed before trusting it')
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
