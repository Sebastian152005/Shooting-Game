(function (app) {
    app.createInput = function (Game) {
        return {
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
            },

            clicked: function () {
                if (!Game.paused) {
                    Game.pause()
                } else {
                    if (Game.isGameOver) {
                        Game.init()
                    }
                }
            },

            focusLost: function () {
                if (!Game.isGameOver) Game.pause()
            },

            continued: function () {
                if (!Game.paused || Game.isGameOver) return
                Game.unPause()
                Game.invincibleMode(1000)
                Game.c.focus({ preventScroll: true })
            },

            visibilityChanged: function () {
                if (document.hidden) Game.focusLost()
            },

            buttonUp: function (e) {
                if (e.key === ' ') { Game.shooting = false; e.preventDefault() }
                if (e.key === 'ArrowLeft'  || e.key.toLowerCase() === 'a') Game.player.movingLeft  = false
                if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') Game.player.movingRight = false
            },

            buttonDown: function (e) {
                if (e.target?.closest?.('input, button, summary, select, textarea')) {
                    Game.shooting = false
                    Game.player.movingLeft = false
                    Game.player.movingRight = false
                    return
                }
                if ([' ', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault()
                if (Game.isGameOver && e.key === 'Enter' && !e.repeat) {
                    e.preventDefault()
                    Game.init()
                    Game.c.focus({ preventScroll: true })
                    return
                }
                if ((e.key.toLowerCase() === 'p' || e.key === 'Escape') && !e.repeat) {
                    if (!Game.isGameOver && !Game.paused) Game.pause()
                    return
                }
                if (Game.paused || Game.isGameOver) return
                Game.audio.play().catch(() => {})
                Game.resumeAudioContext()
                if (e.key === ' ')                                           Game.shooting           = true
                if (e.key === 'ArrowLeft'  || e.key.toLowerCase() === 'a') Game.player.movingLeft  = true
                if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') Game.player.movingRight = true
            },

        }
    }
}(globalThis.ShootingGame))
