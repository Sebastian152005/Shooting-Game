(function (app) {
    app.createGame = function (services) {
        const Game = {
            ...services,
            init: function () {
                if (this.currentFrame) this.platform.cancelFrame(this.currentFrame)
                this.hidePause()
                this.pendingSpawns = []
                this.prepareViewport()
                this.color = "rgba(20,20,20,.7)"

                // collections
                this.bullets      = {}
                this.enemyBullets = {}
                this.enemies      = {}
                this.particles    = {}
                this.powerUps     = {}
                this.floatingTexts = {}

                // indices
                this.bulletIndex       = 0
                this.enemyBulletIndex  = 0
                this.enemyIndex        = 0
                this.particleIndex     = 0
                this.powerUpIndex      = 0
                this.floatingTextIndex = 0

                // state
                this.maxParticles  = Game.config.maxParticles
                this.maxEnemies    = Game.config.maxEnemies
                this.enemiesAlive  = 0
                this.currentFrame  = 0
                this.maxLives      = Game.config.maxLives
                this.life          = 0
                this.score         = 0
                this.highScore     = this.readHighScore()
                this.paused        = false
                this.shooting      = false
                this.isGameOver    = false
                this.isNewRecord   = false

                // difficulty
                this.difficulty       = 1
                this.levelUpTimer     = 0
                this.levelFlash       = 0
                this.lastTimestamp    = 0
                this.elapsedTime      = 0
                this.waveStage        = 'intro'
                this.introRemaining   = Game.config.progression.introDuration
                this.spawnCooldown    = 0
                this.recoveryTime     = 0
                this.enemyAttackCooldown = 0
                this.enemyAttackTurn = 0
                this.safeCorridor     = null
                this.incursion        = null
                this.progressionTime  = 0
                this.nextDifficultyAt = Game.config.difficultyInterval
                this.bannerMessage    = null
                this.bannerDuration   = 3

                // boss
                this.boss       = null
                this.bossActive = false
                this.bossCount  = 0
                this.nextBossAt = Game.config.firstBossLevel
                this.applyWaveProfile()

                // combo
                this.combo           = 0
                this.comboTimer      = 0
                this.comboMultiplier = 1
                this.comboScale      = 1.0

                // effects
                this.shakeTimer    = 0
                this.blinkTimer    = 0
                this.blinkVisible  = true
                this.dt            = 1 / 60


                this.initAudio()
                Game.assets.preload()

                this.binding()
                this.player = new Game.entities.Player()

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
                this.shooting = false
                this.player.movingLeft = false
                this.player.movingRight = false
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
