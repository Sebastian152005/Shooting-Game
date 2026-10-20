const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.join(__dirname, '..')

function load(files, extras = {}) {
    const sandbox = vm.createContext({ ...extras })
    for (const file of files) {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file })
    }
    return sandbox.ShootingGame
}

const domainFiles = [
    'src/js/config.js',
    'src/js/domain/energy.js',
    'src/js/domain/player-progress.js'
]

test('energy rules clamp invalid values and only include targets inside the pulse', () => {
    const app = load(domainFiles)
    assert.equal(app.domain.clampEnergy(-5), 0)
    assert.equal(app.domain.clampEnergy(135), 100)
    assert.equal(app.domain.clampEnergy('invalid'), 0)
    assert.equal(app.domain.isInsidePulse({ x: 0, y: 0 }, { x: 90, y: 0, width: 20, height: 20 }, 110), true)
    assert.equal(app.domain.isInsidePulse({ x: 0, y: 0 }, { x: 200, y: 0, width: 20, height: 20 }, 110), false)
})

test('progress migration accepts legacy data and normalizes corrupt or future schemas', () => {
    const app = load(domainFiles)
    const migrated = app.domain.migrateProgress({ version: 0, bossWins: 3,
        upgrades: { 'pulse-efficiency': 2, 'energy-harvest': 99 } }, 4)
    assert.equal(migrated.schemaVersion, 4)
    assert.equal(migrated.bossesDefeated, 3)
    assert.equal(migrated.rewards['pulse-efficiency'], 2)
    assert.equal(migrated.rewards['energy-harvest'], 4)
    assert.deepEqual(Object.keys(migrated.rewards),
        ['pulse-efficiency', 'energy-harvest', 'pulse-radius'])

    const migratedV2 = app.domain.migrateProgress({ schemaVersion: 2, bossesDefeated: 4,
        rewards: { 'initial-charge': 3, 'pulse-efficiency': 1 } }, 4)
    assert.equal(migratedV2.schemaVersion, 4)
    assert.equal(migratedV2.rewards['pulse-radius'], 3)
    assert.equal(migratedV2.rewards['pulse-efficiency'], 1)

    const migratedV3 = app.domain.migrateProgress({ schemaVersion: 3, bossesDefeated: 5,
        rewards: { 'pulse-capacitor': 2, 'pulse-radius': 1 } }, 4)
    assert.equal(migratedV3.schemaVersion, 4)
    assert.equal(migratedV3.rewards['pulse-radius'], 2)

    assert.equal(app.domain.migrateProgress({ schemaVersion: 99, bossesDefeated: 999 }).bossesDefeated, 0)
    assert.equal(app.domain.migrateProgress('broken').schemaVersion, 4)
})

test('reward choices contain two unique upgrades and effects derive from persisted levels', () => {
    const app = load(domainFiles)
    const initial = app.domain.createDefaultProgress()
    const choices = app.domain.rewardOptions(initial, 2, () => 0.5, app.config.rewards.maxLevel)
    assert.equal(choices.length, 2)
    assert.notEqual(choices[0].id, choices[1].id)

    let progress = app.domain.applyReward(initial, 'pulse-efficiency', app.config.rewards.maxLevel)
    progress = app.domain.applyReward(progress, 'energy-harvest', app.config.rewards.maxLevel)
    const effects = app.domain.rewardEffects(progress, app.config.energy, app.config.rewards)
    assert.equal(effects.pulseCost, 100)
    assert.equal(effects.pickupAmount, 20)
    assert.ok(Math.abs(effects.energySpawnIntervalMultiplier - 0.93) < 0.000001)
    assert.equal(effects.pickupAttractionRadius, 12)
    assert.equal(effects.pulseRadius, app.config.energy.pulseRadius)
})

test('defensive pulse activates instantly and destroys nearby projectiles and meteors', () => {
    const app = load([...domainFiles, 'src/js/application/energy.js'])
    let activations = 0
    const impacts = []
    let meteorDestroyed = 0
    const Game = {
        config: app.config,
        rules: app.domain,
        player: { x: 100, y: 100, width: 40, height: 40 },
        enemyBullets: {
            near: { x: 120, y: 80, width: 10, height: 10 },
            far: { x: 700, y: 80, width: 10, height: 10 }
        },
        meteors: {},
        paused: false,
        isGameOver: false,
        shakeTimer: 0,
        playPulseActivationSound: () => { activations++ },
        playPulseImpactSound: outcome => { impacts.push(outcome) }
    }
    Game.meteors.near = {
        x: 115, y: 105, width: 30, height: 30,
        destroy() { meteorDestroyed++; delete Game.meteors.near }
    }
    Game.meteors.far = { x: 650, y: 100, width: 30, height: 30, destroy() {} }
    Object.assign(Game, app.createEnergySystem(Game))
    Game.initializeEnergyState()
    assert.equal(Game.energy, 0)
    Game.collectEnergy(app.config.energy.maximum)
    assert.equal(Game.activateDefensivePulse(), true)
    assert.equal(Game.enemyBullets.near, undefined)
    assert.ok(Game.enemyBullets.far)
    assert.equal(Game.energy, 0)
    assert.equal(activations, 1)
    assert.equal(meteorDestroyed, 1)
    assert.ok(Game.meteors.far)
    assert.equal(impacts.length, 1)
    assert.equal(impacts[0].projectiles, 1)
    assert.equal(impacts[0].meteors, 1)
    assert.equal(Game.activateDefensivePulse(), false)
    Game.collectEnergy(999)
    assert.equal(Game.energy, 100)
    assert.equal(Game.activateDefensivePulse(), true)
    assert.equal(activations, 2)
    assert.equal(impacts.length, 1)
    Game.collectEnergy(100)
    Game.bossActive = true
    assert.equal(Game.activateDefensivePulse(), false, 'boss encounters reserve danger for the boss')
    assert.equal(Game.energy, 100)
})

test('energy pickup is visible, collectible and shares the existing power-up lifecycle', () => {
    const app = load([...domainFiles,
        'src/js/application/energy.js',
        'src/js/application/entities/energy-pickup.js'
    ])
    let drawn = false
    let message = null
    let pickupSounds = 0
    let collides = false
    const Game = {
        config: app.config,
        rules: app.domain,
        player: { x: 40, y: 40, width: 40, height: 40 },
        powerUps: {}, powerUpIndex: 0, dt: 0, view: { height: 540 },
        rewardEffects: { pickupAmount: 40, pickupAttractionRadius: 0 },
        collision: () => collides,
        drawEnergyPickup: () => { drawn = true },
        playEnergyPickupSound: () => { pickupSounds++ },
        entities: { FloatingText: function (...args) { message = args[2] } }
    }
    Object.assign(Game, app.createEnergySystem(Game))
    Game.initializeEnergyState()
    Game.energy = 70
    const EnergyPickup = app.entityFactories.EnergyPickup(Game)
    const pickup = new EnergyPickup(60, 60)
    pickup.draw()
    Game.dt = 0.5
    pickup.update()
    assert.equal(drawn, true)
    assert.ok(Math.abs(pickup.rotation - app.config.energy.capsuleRotationSpeed * 0.5) < 0.000001)
    pickup.rotation = Math.PI * 2 - 0.01
    Game.dt = 0.1
    pickup.update()
    assert.ok(pickup.rotation > Math.PI * 2, 'rotation phase remains continuous across a full turn')
    assert.equal(Game.energy, 70)
    collides = true
    Game.dt = 0
    pickup.update()
    assert.equal(Game.energy, 90)
    assert.equal(Object.keys(Game.powerUps).length, 0)
    assert.equal(message, '+20 ENERGIA')
    assert.equal(pickupSounds, 1)
})

test('boss reward flow owns pause, persists the selection and resumes safely', () => {
    const app = load([...domainFiles, 'src/js/application/rewards.js'])
    let stored = app.domain.createDefaultProgress()
    let selected
    const Game = {
        config: app.config,
        rules: app.domain,
        randomFloat: () => 0,
        storage: {
            readProgress: () => app.domain.migrateProgress(stored),
            writeProgress: progress => { stored = app.domain.migrateProgress(progress); return stored }
        },
        paused: false,
        isGameOver: false,
        canShowRewardChoice: () => true,
        showRewardChoice: (choices, onSelect) => { selected = { choices, onSelect }; return true },
        hideRewardChoice() {},
        hidePause() {},
        pause() { this.paused = true },
        unPause() { this.paused = false }
    }
    Object.assign(Game, app.createRewardSystem(Game))
    Game.initializeRewardProgress()
    Game.recordBossDefeat()
    assert.equal(Game.offerBossRewards(), true)
    assert.equal(Game.paused, true)
    assert.equal(selected.choices.length, 2)
    selected.onSelect(selected.choices[0].id)
    assert.equal(Game.paused, false)
    assert.equal(stored.bossesDefeated, 1)
    assert.equal(stored.rewards[selected.choices[0].id], 1)
})

test('storage persists the current schema and tolerates denied or malformed data', () => {
    const values = new Map([['warInSpaceProgress', '{broken']])
    const localStorage = {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value))
    }
    const app = load([...domainFiles, 'src/js/infrastructure/storage.js'], { localStorage })
    assert.equal(app.storage.readProgress().schemaVersion, 4)
    const progress = app.domain.createDefaultProgress()
    progress.bossesDefeated = 7
    app.storage.writeProgress(progress)
    assert.equal(JSON.parse(values.get(app.config.progressKey)).bossesDefeated, 7)

    const blocked = load([...domainFiles, 'src/js/infrastructure/storage.js'], {
        localStorage: { getItem() { throw Error('denied') }, setItem() { throw Error('denied') } }
    })
    assert.equal(blocked.storage.readProgress().bossesDefeated, 0)
    assert.equal(blocked.storage.writeProgress(progress).bossesDefeated, 7)
})
