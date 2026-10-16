const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')

function loadApplication() {
    const app = {}
    const context = vm.createContext({ ShootingGame: app })
    for (const file of ['session-state.js', 'game.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, 'src/js/application', file), 'utf8'), context)
    }
    return app
}

function config() {
    return {
        maxParticles: 10,
        maxEnemies: 6,
        maxLives: 5,
        difficultyInterval: 20,
        firstBossLevel: 5,
        progression: { introDuration: 3 }
    }
}

test('session state factory is pure and creates independent mutable sessions', () => {
    const app = loadApplication()
    const gameConfig = config()
    const before = JSON.stringify(gameConfig)
    const input = { config: gameConfig, waveStages: { INTRO: 'intro' }, highScore: 123 }
    const first = app.createSessionState(input)
    const second = app.createSessionState(input)

    assert.equal(JSON.stringify(gameConfig), before)
    assert.equal(first.lifecycle.highScore, 123)
    assert.equal(first.lifecycle.maxLives, 5)
    assert.equal(first.progression.waveStage, 'intro')
    assert.equal(first.progression.introRemaining, 3)
    assert.equal(first.bossEncounter.nextAt, 5)
    assert.equal(first.effects.deltaTime, 1 / 60)
    assert.notEqual(first, second)
    assert.notEqual(first.collections, second.collections)
    assert.notEqual(first.collections.pendingSpawns, second.collections.pendingSpawns)
    first.collections.bullets.one = {}
    assert.equal(second.collections.bullets.one, undefined)
})

test('flat compatibility properties and grouped session state stay synchronized', () => {
    const app = loadApplication()
    const target = {}
    const first = app.createSessionState({ config: config(), waveStages: { INTRO: 'intro' } })
    app.attachSessionState(target, first)

    target.score = 75
    assert.equal(first.lifecycle.score, 75)
    first.progression.difficulty = 4
    assert.equal(target.difficulty, 4)
    target.enemies.enemy = { id: 1 }
    assert.equal(first.collections.enemies.enemy.id, 1)

    const second = app.createSessionState({ config: config(), waveStages: { INTRO: 'intro' }, highScore: 75 })
    app.attachSessionState(target, second)
    assert.equal(target.score, 0)
    assert.equal(target.highScore, 75)
    assert.equal(first.lifecycle.score, 75, 'restarting does not mutate the retired session')
})

test('Game init replaces its session while preserving the stored record and one frame', () => {
    const app = loadApplication()
    let requestedFrames = 0
    const cancelled = []
    const services = {
        config: config(),
        rules: { WAVE_STAGES: { INTRO: 'intro' }, geometry: { collision: () => false } },
        storage: { readHighScore: fallback => Math.max(fallback, 40), writeHighScore() {} },
        assets: { preload() {} },
        randomFloat: () => 0.5,
        platform: {
            cancelFrame: frame => cancelled.push(frame),
            requestFrame: () => ++requestedFrames,
            now: () => 0
        }
    }
    const game = app.createGame(services)
    Object.assign(game, {
        hidePause() {}, prepareViewport() {}, applyWaveProfile() {}, initAudio() {}, binding() {},
        fillEnemySlots() {}, initVideo() {}, playMedia() {},
        entities: { Player: class {} }
    })

    game.init()
    const first = game.sessionState
    game.score = 99
    game.highScore = 99
    game.init()

    assert.notEqual(game.sessionState, first)
    assert.equal(game.score, 0)
    assert.equal(game.highScore, 99)
    assert.equal(game.currentFrame, 2)
    assert.deepEqual(cancelled, [1])
    assert.equal(requestedFrames, 2)
})
