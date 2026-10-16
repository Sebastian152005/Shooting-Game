(function (app) {
    app.createGame = function (services) {
        const createSessionState = services.createSessionState || app.createSessionState
        const attachSessionState = services.attachSessionState || app.attachSessionState
        const Game = {
            ...services,
            init: function () {
                if (this.currentFrame) this.platform.cancelFrame(this.currentFrame)
                this.clearInput?.()
                this.resetRewardChoice?.()
                this.hidePause()
                this.pendingSpawns = []
                this.prepareViewport()
                attachSessionState(this, createSessionState({
                    config: this.config,
                    waveStages: this.rules.WAVE_STAGES,
                    highScore: this.readHighScore()
                }))
                this.applyWaveProfile()

                this.initAudio()
                Game.assets.preload()

                this.binding()
                this.player = new Game.entities.Player()
                this.initializeRewardProgress?.()
                this.initializeEnergyState?.()
                this.initializeWorldEvents?.()

                this.fillEnemySlots(Game.config.progression.introDuration)

                this.initVideo()
                this.playMedia()
                this.currentFrame = this.platform.requestFrame(this.loop)
            },

            random: function (min, max) { return Math.floor(this.randomFloat() * (max - min) + min) },

            invincibleMode: function (ms) {
                this.player.invincible      = true
                this.player.invincibleTimer = ms / 1000
            },

            collision: services.rules.geometry.collision,

            pause: function () {
                if (this.paused) return
                this.paused = true
                this.platform.cancelFrame(this.currentFrame)
                this.currentFrame = 0
                this.clearInput?.()
                this.pauseMedia()
                if (!this.isGameOver) {
                    this.drawPause()
                }
            },

            unPause: function () {
                if (!this.paused || this.isGameOver) return
                this.hidePause()
                this.paused = false
                this.lastTimestamp = 0
                this.playMedia()
                this.resumeAudioContext()
                this.currentFrame = this.platform.requestFrame(this.loop)
            },

            readHighScore: function () { return Game.storage.readHighScore(this.highScore || 0) },

            gameOver: function () {
                if (this.isGameOver) return
                this.hidePause()
                this.isGameOver = true
                this.releaseIncursion()
                this.safeCorridor = null
                this.pendingSpawns = []
                for (const enemy of Object.values(this.enemies)) enemy.pendingAttack = null
                this.refreshEnemyCount()
                this.levelUpTimer = 0
                this.levelFlash = 0
                this.bannerMessage = null
                this.pause()
                this.pauseMedia()

                const isNewRecord = this.score > 0 && this.score >= this.highScore
                this.isNewRecord = isNewRecord
                if (this.score > this.highScore) {
                    this.highScore = this.score
                    Game.storage.writeHighScore(this.highScore)
                }

                // Rebuild the frozen scene so an earlier wave banner is removed,
                // then draw the final overlay last.
                this.repaint()
            },

            loop: function (timestamp) {
                Game.currentFrame = 0
                if (!Game.paused) {
                    const dt = Game.lastTimestamp
                        ? Math.max(0, Math.min((timestamp - Game.lastTimestamp) / 1000, 0.05))
                        : 1 / 60
                    Game.lastTimestamp = timestamp || Game.platform.now()
                    Game.dt = dt

                    Game.updateWorld(dt)
                    if (Game.isGameOver) return
                    Game.drawScene()
                    if (!Game.paused) {
                        Game.currentFrame = Game.platform.requestFrame(Game.loop)
                    }
                }
            }
        }
        return Game
    }
}(globalThis.ShootingGame))
