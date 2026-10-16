const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')

function load(files) {
    const context = vm.createContext({})
    for (const file of files) {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file })
    }
    return context.ShootingGame
}

test('meteor profile increases pressure gradually and remains bounded', () => {
    const app = load(['src/js/config.js', 'src/js/domain/hazards.js'])
    const early = app.domain.meteorProfile(1, app.config.meteors)
    const mid = app.domain.meteorProfile(5, app.config.meteors)
    const late = app.domain.meteorProfile(9, app.config.meteors)

    assert.equal(early.enabled, true)
    assert.equal(mid.enabled, true)
    assert.ok(late.delayMin < mid.delayMin)
    assert.ok(late.speed > mid.speed)
    assert.ok(late.speed <= app.config.meteors.maximumSpeed)
    assert.ok(late.maximumConcurrent <= app.config.meteors.maximumConcurrent)
    assert.ok(early.maximumConcurrent >= 2)

    const firstBoss = app.domain.bossMeteorProfile(1, 3, app.config.meteors)
    const thirdBoss = app.domain.bossMeteorProfile(3, 1, app.config.meteors)
    const lateFinal = app.domain.bossMeteorProfile(5, 3, app.config.meteors)
    assert.equal(firstBoss.enabled, false)
    assert.equal(thirdBoss.enabled, true)
    assert.equal(thirdBoss.maximumConcurrent, 1)
    assert.equal(lateFinal.finalPhase, true)
    assert.equal(lateFinal.maximumConcurrent, 2)
    assert.ok(lateFinal.delayMin < thirdBoss.delayMin)
})

test('ambient scheduler creates energy independently from enemies and adds meteor pressure', () => {
    const app = load([
        'src/js/config.js',
        'src/js/domain/wave-state.js',
        'src/js/domain/hazards.js',
        'src/js/application/world-events.js'
    ])
    const spawned = { energy: [], meteors: [] }
    const Game = {
        config: app.config,
        rules: app.domain,
        randomFloat: () => 0.5,
        waveStage: app.domain.WAVE_STAGES.WAVE,
        difficulty: 5,
        bossActive: false,
        boss: null,
        paused: false,
        isGameOver: false,
        powerUps: {},
        meteors: {},
        view: { width: 900 },
        entities: {
            EnergyPickup: function (x, y) { spawned.energy.push({ x, y }) },
            Meteor: function (spec) { spawned.meteors.push(spec) }
        }
    }
    Object.assign(Game, app.createWorldEvents(Game))
    Game.initializeWorldEvents()
    Game.energySpawnRemaining = 0
    Game.meteorSpawnRemaining = 0
    Game.updateWorldEvents(1 / 60)

    assert.equal(spawned.energy.length, 1)
    assert.equal(spawned.energy[0].y, -12)
    assert.equal(spawned.meteors.length, 1)
    assert.ok(Game.energySpawnRemaining >= app.config.energy.spawnDelayMin)
    assert.ok(Game.meteorSpawnRemaining >= app.config.meteors.minimumSpawnDelay)

    Game.waveStage = app.domain.WAVE_STAGES.BOSS
    Game.bossActive = true
    Game.energySpawnRemaining = 0
    Game.meteorSpawnRemaining = 0
    Game.updateWorldEvents(1)
    assert.equal(spawned.energy.length, 1)
    assert.equal(spawned.meteors.length, 1)

    let warnings = 0
    Game.bossCount = 3
    Game.boss = { phase: 3 }
    Game.playOrbitalWarningSound = () => { warnings++ }
    Game.meteorSpawnRemaining = 0
    Game.updateWorldEvents(1 / 60)
    assert.equal(warnings, 1)
    assert.ok(Game.bossMeteorWarningRemaining > 0)
    assert.equal(spawned.meteors.length, 1)
    Game.updateWorldEvents(app.config.meteors.boss.warningDuration)
    assert.equal(Game.bossMeteorBurstRemaining, app.config.meteors.boss.earlyBurstSize)
    Game.updateWorldEvents(1 / 60)
    assert.equal(spawned.meteors.length, 2)

    const enemySource = fs.readFileSync(path.join(root, 'src/js/application/entities/enemy.js'), 'utf8')
    assert.equal(enemySource.includes('EnergyPickup'), false)
})

test('meteor specifications stay on screen and scale durability with size', () => {
    const app = load(['src/js/config.js', 'src/js/domain/hazards.js'])
    const profile = app.domain.meteorProfile(8, app.config.meteors)
    const values = [0.999, 0.999, 0.5, 0.1, 0.5]
    const spec = app.domain.createMeteorSpec(() => values.shift() ?? 0.5, 360, profile)

    assert.ok(spec.x >= 0)
    assert.ok(spec.x + spec.size <= 360)
    assert.equal(spec.hp, 3)
    assert.ok(spec.speed <= app.config.meteors.maximumSpeed * 1.12)
    assert.ok(Math.abs(spec.drift) <= app.config.meteors.maximumDrift)
    assert.ok(spec.gravity > 0)
    assert.equal('warningDuration' in spec, false)
})

test('meteor entity can be shot down, awards points and leaves its collection', () => {
    const app = load(['src/js/config.js', 'src/js/application/entities/meteor.js'])
    let explosions = 0
    let message = null
    const Game = {
        meteorIndex: 0,
        meteors: {},
        paused: false,
        isGameOver: false,
        score: 0,
        dt: 1 / 60,
        randomFloat: () => 0,
        random: minimum => minimum,
        entities: {
            Particle: function () {},
            FloatingText: function (x, y, text) { message = text }
        },
        playExplosion: () => { explosions++ },
        drawEntity() {},
        resolvePlayerBulletHits() {},
        collision: () => false,
        player: {},
        view: { height: 540 }
    }
    const Meteor = app.entityFactories.Meteor(Game)
    const meteor = new Meteor({ x: 10, y: 20, size: 70, speed: 2,
        angularVelocity: 0.5, drift: 0.1, gravity: 0.38, terminalSpeed: 5,
        hp: 3, points: 35 })

    assert.equal(meteor.receiveHit(), true)
    assert.equal(meteor.receiveHit(), true)
    assert.equal(meteor.receiveHit(), true)
    assert.equal(Game.meteors[meteor.index], undefined)
    assert.equal(Game.score, 105)
    assert.equal(message, '+105 ORBITAL')
    assert.equal(explosions, 1)

    let damage = 0
    Game.collision = () => true
    Game.player = { invincible: false, die: () => { damage++ } }
    const impact = new Meteor({ x: 20, y: 40, size: 44, speed: 2,
        angularVelocity: -0.4, drift: -0.1, gravity: 0.38, terminalSpeed: 5,
        hp: 1, points: 35 })
    impact.update()
    assert.equal(damage, 1)
    assert.equal(Game.meteors[impact.index], undefined)
})
