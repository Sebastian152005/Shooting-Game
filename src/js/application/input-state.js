(function (app) {
    const ACTIONS = Object.freeze({
        MOVE_LEFT: 'moveLeft',
        MOVE_RIGHT: 'moveRight',
        FIRE: 'fire',
        PAUSE: 'pause',
        PULSE: 'pulse'
    })
    const actionNames = Object.freeze(Object.values(ACTIONS))
    const commands = new Set([ACTIONS.PAUSE, ACTIONS.PULSE])

    app.INPUT_ACTIONS = ACTIONS
    app.createInputState = function () {
        const sources = new Map(actionNames.map(action => [action, new Set()]))
        const pending = new Map([...commands].map(action => [action, 0]))

        function assertAction(action) {
            if (!sources.has(action)) throw new TypeError('Unknown input action: ' + action)
        }

        return {
            press(action, source = 'default') {
                assertAction(action)
                const activeSources = sources.get(action)
                if (activeSources.has(source)) return false
                activeSources.add(source)
                if (commands.has(action)) pending.set(action, pending.get(action) + 1)
                return true
            },

            release(action, source = 'default') {
                assertAction(action)
                return sources.get(action).delete(source)
            },

            set(action, active, source = 'default') {
                return active ? this.press(action, source) : this.release(action, source)
            },

            isActive(action) {
                assertAction(action)
                return sources.get(action).size > 0
            },

            consume(action) {
                assertAction(action)
                const count = pending.get(action) || 0
                if (!count) return false
                pending.set(action, count - 1)
                return true
            },

            clear() {
                for (const activeSources of sources.values()) activeSources.clear()
                for (const action of pending.keys()) pending.set(action, 0)
            },

            snapshot() {
                return Object.freeze(Object.fromEntries(actionNames.map(action => [action, sources.get(action).size > 0])))
            }
        }
    }
}(globalThis.ShootingGame))
