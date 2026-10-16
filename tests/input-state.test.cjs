const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')

const root = path.resolve(__dirname, '..')

function load(file, context) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file })
}

function inputState() {
    const context = vm.createContext({ ShootingGame: {} })
    load('src/js/application/input-state.js', context)
    return context.ShootingGame.createInputState()
}

function eventTarget(extra = {}) {
    const listeners = new Map()
    return {
        ...extra,
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || []
            handlers.push(handler)
            listeners.set(type, handlers)
        },
        dispatch(type, event = {}) {
            for (const handler of listeners.get(type) || []) handler({ preventDefault() {}, ...event })
        }
    }
}

function inputAdapter() {
    const windowTarget = eventTarget()
    const documentTarget = eventTarget({ hidden: false })
    const canvas = eventTarget({ focus() {} })
    const resume = eventTarget()
    const pauseMenu = eventTarget()
    const buttons = ['moveLeft', 'moveRight', 'fire', 'pause', 'pulse'].map(action => eventTarget({
        dataset: { inputAction: action },
        setPointerCapture() {}
    }))
    const touchControls = { querySelectorAll: () => buttons }
    documentTarget.getElementById = id => ({ touchControls, resumeGame: resume, pauseMenu }[id] || null)

    const context = vm.createContext({ ShootingGame: {}, window: windowTarget, document: documentTarget })
    load('src/js/application/input-state.js', context)
    load('src/js/infrastructure/input.js', context)
    const Game = {
        c: canvas,
        paused: false,
        isGameOver: false,
        audio: { play: () => Promise.resolve() },
        resumeAudioContext() {},
        pulses: 0,
        activateDefensivePulse() { this.pulses++ },
        resized() {},
        pause() { this.paused = true },
        unPause() { this.paused = false },
        invincibleMode() {},
        init() {}
    }
    Object.assign(Game, context.ShootingGame.createInput(Game))
    Game.binding()
    return { Game, buttons, windowTarget }
}

test('InputState keeps independent sources and exposes every gameplay action', () => {
    const input = inputState()
    assert.deepEqual(Object.keys(input.snapshot()), ['moveLeft', 'moveRight', 'fire', 'pause', 'pulse'])
    input.press('moveLeft', 'keyboard:a')
    input.press('moveLeft', 'pointer:1')
    input.release('moveLeft', 'pointer:1')
    assert.equal(input.isActive('moveLeft'), true)
    input.release('moveLeft', 'keyboard:a')
    assert.equal(input.isActive('moveLeft'), false)
    assert.throws(() => input.press('teleport'), /Unknown input action/)
})

test('command actions are edge-triggered and clear removes held and queued input', () => {
    const input = inputState()
    assert.equal(input.press('pulse', 'keyboard:e'), true)
    assert.equal(input.press('pulse', 'keyboard:e'), false)
    assert.equal(input.consume('pulse'), true)
    assert.equal(input.consume('pulse'), false)
    input.release('pulse', 'keyboard:e')
    input.press('pulse', 'keyboard:e')
    input.press('fire', 'pointer:2')
    input.clear()
    assert.equal(input.consume('pulse'), false)
    assert.equal(input.isActive('fire'), false)
})

test('pointer cancellation and window blur cannot leave movement or firing active', () => {
    const { Game, buttons, windowTarget } = inputAdapter()
    const left = buttons.find(button => button.dataset.inputAction === 'moveLeft')
    const fire = buttons.find(button => button.dataset.inputAction === 'fire')

    left.dispatch('pointerdown', { pointerId: 11 })
    fire.dispatch('pointerdown', { pointerId: 12 })
    assert.equal(Game.input.isActive('moveLeft'), true)
    assert.equal(Game.input.isActive('fire'), true)

    left.dispatch('pointercancel', { pointerId: 11 })
    assert.equal(Game.input.isActive('moveLeft'), false)
    assert.equal(Game.input.isActive('fire'), true)

    windowTarget.dispatch('blur')
    assert.equal(Game.input.isActive('fire'), false)
    assert.equal(Game.paused, true)
})

test('keyboard and touch share actions without releasing each other', () => {
    const { Game, buttons, windowTarget } = inputAdapter()
    const right = buttons.find(button => button.dataset.inputAction === 'moveRight')
    windowTarget.dispatch('keydown', { key: 'd' })
    right.dispatch('pointerdown', { pointerId: 21 })
    windowTarget.dispatch('keyup', { key: 'd' })
    assert.equal(Game.input.isActive('moveRight'), true)
    right.dispatch('pointerup', { pointerId: 21 })
    assert.equal(Game.input.isActive('moveRight'), false)
})

test('pulse and pause controls dispatch commands only once per press', () => {
    const { Game, buttons } = inputAdapter()
    const pulse = buttons.find(button => button.dataset.inputAction === 'pulse')
    const pause = buttons.find(button => button.dataset.inputAction === 'pause')
    pulse.dispatch('pointerdown', { pointerId: 31 })
    pulse.dispatch('pointerdown', { pointerId: 31 })
    assert.equal(Game.pulses, 1)
    pulse.dispatch('pointerup', { pointerId: 31 })
    pause.dispatch('pointerdown', { pointerId: 32 })
    assert.equal(Game.paused, true)
    assert.equal(Game.input.isActive('fire'), false)
})
