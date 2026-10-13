(function (app) {
    app.entityFactories.Boss = function (Game) {
        const Boss = function () {
            const d  = Game.difficulty
            const config = Game.config.progression
            Game.beginBossEncounter()
            this.width    = 180
            this.height   = 110
            this.x        = Game.view.width / 2 - this.width / 2
            this.y        = -this.height
            this.entering = true
            this.dead     = false
            this.hp       = Math.min(config.bossMaxHp, config.bossBaseHp + Math.max(0, Game.bossCount - 1) * 4)
            this.maxHp    = this.hp
            this.speed    = Math.min(3.5, 1.8 + d * 0.08)
            this.bulletSpeed   = Math.min(config.maxBulletSpeed, 3.2 + d * 0.12)
            this.shootInterval = Math.max(1.6, 3.2 - d * 0.06)
            this.shootTimer    = 0
            this.phase = 1
            this.attackStep = 0
            this.warningTime = 0
            this.warningAngles = []
            this.warningFan = null
            this.movingLeft    = Game.randomFloat() < 0.5
            this.sprite        = 'enemy'
            Game.bossActive    = true
            Game.boss          = this
        }

        Boss.prototype.draw = function () {
            Game.drawEntity(this, 'Boss')
        }

        Boss.prototype.update = function () {
            if (this.dead || Game.paused || Game.isGameOver || Game.boss !== this) return
            if (this.entering) {
                this.y += 2.5 * Game.dt * 60
                if (this.y >= 15) { this.y = 15; this.entering = false }
                Game.resolvePlayerBulletHits(this)
                return
            }

            const move = this.warningTime > 0 ? 0 : this.speed * Game.dt * 60
            if (this.movingLeft) {
                this.x -= move
                if (this.x <= 0) this.movingLeft = false
            } else {
                this.x += move
                if (this.x + this.width >= Game.view.width) this.movingLeft = true
            }
            this.x = Math.max(0, Math.min(Game.view.width - this.width, this.x))

            this.updatePhase()
            if (this.warningTime > 0) {
                this.warningTime = Math.max(0, this.warningTime - Game.dt)
                if (this.warningTime === 0) this.shoot()
            } else {
                this.shootTimer += Game.dt
                const interval = Math.max(1.1, this.shootInterval - (this.phase - 1) * 0.35)
                if (this.shootTimer >= interval && this.prepareAttack()) {
                    this.shootTimer = 0
                }
            }

            Game.resolvePlayerBulletHits(this)
        }

        Boss.prototype.canBeHit = function () {
            return !this.dead && !Game.paused && !Game.isGameOver && Game.boss === this
                && this.y + this.height > 0 && this.y < Game.view.height
        }

        Boss.prototype.receiveHit = function () {
            if (!this.canBeHit()) return false
            this.hp--
            if (this.hp <= 0) this.die()
            return true
        }

        Boss.prototype.updatePhase = function () {
            const ratio = this.hp / this.maxHp
            const phase = ratio > 0.65 ? 1 : ratio > 0.3 ? 2 : 3
            if (phase === this.phase) return
            this.phase = phase
            if (this.warningFan) Game.releaseFan(this)
            this.warningFan = null
            this.shootTimer = 0
            this.warningTime = 0
            this.warningAngles = []
        }

        Boss.prototype.prepareAttack = function () {
            if (this.warningTime > 0 || Game.safeCorridor || Game.paused || Game.isGameOver) return false
            const aimed = this.phase >= 2 && this.attackStep % 2 === 1
            const x = this.x + this.width / 2
            const y = this.y + this.height
            const aim = aimed ? Math.max(-0.55, Math.min(0.55,
                Math.atan2(Game.player.x + Game.player.width / 2 - x, Game.player.y - y))) : 0
            if (aimed) {
                const offsets = this.phase === 3 ? [-0.24, -0.12, 0, 0.12, 0.24] : [-0.16, 0, 0.16]
                this.warningAngles = offsets.map(offset => offset + aim)
            } else {
                this.warningFan = Game.reserveFan(this, x, y, this.bulletSpeed,
                    this.phase === 3 ? 3 : 2, Game.config.progression.bossWarning, this.attackStep)
                if (!this.warningFan) return false
                this.warningAngles = this.warningFan.angles
            }
            this.warningTime = Game.config.progression.bossWarning
            // Lock the origin while telegraphing so the announced lanes stay accurate.
            this.attackX = x
            this.attackY = y
            this.attackStep++
            return true
        }

        Boss.prototype.shoot = function () {
            const bullets = Game.fireEnemyVolley(this.attackX, this.attackY, this.bulletSpeed,
                '#FF3300', this.warningAngles, this.warningFan ? this : null)
            if (this.warningFan) {
                if (bullets.length) Game.markFanFired(this)
                else Game.releaseFan(this)
            }
            this.warningFan = null
            this.warningAngles = []
        }

        Boss.prototype.die = function () {
            if (this.dead) return
            this.dead       = true
            Game.boss       = null
            Game.bossActive = false

            for (let i = 0; i < 20; i++) {
                new Game.entities.Particle(this.x + Game.random(0, this.width), this.y + Game.random(0, this.height))
            }

            const points  = 300 + (Game.difficulty - 1) * 25
            Game.score   += points
            Game.combo   += 3
            Game.comboTimer = 3

            new Game.entities.FloatingText(this.x + this.width / 2, this.y + this.height / 2, "BOSS +" + points, '#FFD700')

            Game.playExplosion()

            Game.endBossEncounter()
        }
        return Boss
    }
}(globalThis.ShootingGame))
