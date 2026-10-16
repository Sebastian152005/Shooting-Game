(function (app) {
    app.createInput = function (Game) {
        const actions = app.INPUT_ACTIONS
        const input = Game.input || app.createInputState()
        const keyboardAction = key => ({
            a: actions.MOVE_LEFT,
            arrowleft: actions.MOVE_LEFT,
            d: actions.MOVE_RIGHT,
            arrowright: actions.MOVE_RIGHT,
            ' ': actions.FIRE,
            e: actions.PULSE,
            p: actions.PAUSE,
            escape: actions.PAUSE
        }[String(key || '').toLowerCase()])
        const keyboardSource = key => 'keyboard:' + String(key || '').toLowerCase()
        let touchControls = null

        Game.input = input
        Object.defineProperty(Game, 'shooting', {
            configurable: true,
            enumerable: true,
            get: () => input.isActive(actions.FIRE),
            set: active => input.set(actions.FIRE, Boolean(active), 'legacy:shooting')
        })

        function engageAudio() {
            Game.audio.play().catch(() => {})
            Game.resumeAudioContext()
        }

        function handleCommand(action) {
            if (action === actions.PAUSE && input.consume(action)) {
                Game.clearInput()
                if (!Game.isGameOver && !Game.paused) Game.pause()
                return
            }
            // The energy feature consumes this command in the application layer.
            const activatePulse = Game.activateDefensivePulse || Game.activatePulse
            if (action === actions.PULSE && typeof activatePulse === 'function' && input.consume(action)) {
                activatePulse.call(Game)
            }
        }

        function bindTouchControls() {
            const root = document.getElementById('touchControls')
            if (!root?.querySelectorAll) return null
            const activePointers = new Map()

            function releasePointer(pointerId) {
                const active = activePointers.get(pointerId)
                if (!active) return
                input.release(active.action, active.source)
                activePointers.delete(pointerId)
            }

            for (const button of root.querySelectorAll('[data-input-action]')) {
                const action = button.dataset.inputAction
                if (!Object.values(actions).includes(action)) continue
                button.addEventListener('pointerdown', event => {
                    if (Game.isGameOver || (Game.paused && action !== actions.PAUSE)) return
                    event.preventDefault()
                    if (activePointers.has(event.pointerId)) return
                    const source = 'pointer:' + event.pointerId
                    activePointers.set(event.pointerId, { action, source })
                    input.press(action, source)
                    try { button.setPointerCapture(event.pointerId) } catch (_) {}
                    if (action !== actions.PAUSE) engageAudio()
                    handleCommand(action)
                })
                for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
                    button.addEventListener(type, event => releasePointer(event.pointerId))
                }
                button.addEventListener('contextmenu', event => event.preventDefault())
            }

            return {
                clear() {
                    for (const pointerId of [...activePointers.keys()]) releasePointer(pointerId)
                }
            }
        }

        return {
            input,
            clearInput: function () {
                touchControls?.clear()
                input.clear()
            },

            binding: function () {
                if (this.eventsBound) return
                this.eventsBound = true
                window.addEventListener("keydown",  this.buttonDown)
                window.addEventListener("keyup",    this.buttonUp)
                window.addEventListener("blur", this.focusLost)
                window.addEventListener("resize", this.resized)
                document.addEventListener("visibilitychange", this.visibilityChanged)
                this.c.addEventListener("click",    this.clicked)
                document.getElementById('resumeGame').addEventListener('click', this.continued)
                document.getElementById('pauseMenu').addEventListener('cancel', event => event.preventDefault())
                touchControls = bindTouchControls()
            },

            clicked: function () {
                if (!Game.paused) {
                    Game.clearInput()
                    Game.pause()
                } else {
                    if (Game.isGameOver) {
                        Game.clearInput()
                        Game.init()
                    }
                }
            },

            focusLost: function () {
                Game.clearInput()
                if (!Game.isGameOver) Game.pause()
            },

            continued: function () {
                if (!Game.paused || Game.isGameOver) return
                Game.clearInput()
                Game.unPause()
                Game.invincibleMode(1000)
                Game.c.focus({ preventScroll: true })
            },

            visibilityChanged: function () {
                if (document.hidden) Game.focusLost()
            },

            buttonUp: function (e) {
                const action = keyboardAction(e.key)
                if (!action) return
                input.release(action, keyboardSource(e.key))
                if ([' ', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault()
            },

            buttonDown: function (e) {
                if (e.target?.closest?.('input, button, summary, select, textarea')) {
                    Game.clearInput()
                    return
                }
                const action = keyboardAction(e.key)
                if ([' ', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault()
                if (Game.isGameOver && e.key === 'Enter' && !e.repeat) {
                    e.preventDefault()
                    Game.clearInput()
                    Game.init()
                    Game.c.focus({ preventScroll: true })
                    return
                }
                if (!action || e.repeat || Game.paused || Game.isGameOver) return
                input.press(action, keyboardSource(e.key))
                if (action !== actions.PAUSE) engageAudio()
                handleCommand(action)
            },

        }
    }
}(globalThis.ShootingGame))
