(function (app) {
    app.entityFactories.EnemyBullet = function (Game) {
        const EnemyBullet = function (x, y, speed, color, vx, vy) {
            const d      = Game.difficulty
            const isBoss = color === '#FF3300'
            const isAggr = color === 'tomato'
            this.diff    = d
            this.isBoss  = isBoss
            this.isAggr  = isAggr
            this.width   = Math.round(isBoss ? 10 + Math.min(7, d * 0.65) : isAggr ? 6 + Math.min(4, d * 0.38) : 4 + Math.min(3, d * 0.28))
            this.height  = Math.round(isBoss ? 28 + Math.min(18, d * 1.8) : 18 + Math.min(14, d * 1.3))
            this.x       = x - this.width / 2
            this.y       = y
            this.vx      = vx || 0
            this.vy      = vy === undefined ? speed || 3 : vy
            this.age     = 0
            this.color   = color || 'lime'
            this.phase   = Game.randomFloat() * Math.PI * 2
            // normal bullets: subtle sinusoidal side drift
            this.wobbleAmp   = (!isBoss && !isAggr) ? 0.4 + Game.randomFloat() * 0.3 : 0
            this.wobbleFreq  = 4.5 + Game.randomFloat() * 2
            this.wobblePhase = Game.randomFloat() * Math.PI * 2
            // Only selected late-wave shots get a brief steering window.
            this.homing = false
            this.homingFor = 0
            this.index  = Game.enemyBulletIndex
            Game.enemyBullets[Game.enemyBulletIndex] = this
            Game.enemyBulletIndex++
        }

        EnemyBullet.prototype.draw = function () {
            Game.drawEntity(this, 'EnemyBullet')
        }

        EnemyBullet.prototype.update = function () {
            this.age += Game.dt
            // sinusoidal drift for normal bullets
            if (this.wobbleAmp > 0) {
                const prev = this.wobblePhase
                this.wobblePhase += this.wobbleFreq * Game.dt
                this.x += (Math.sin(this.wobblePhase) - Math.sin(prev)) * this.wobbleAmp * 8
            }

            // Steering expires so the player can dodge after the initial turn.
            if (this.homing && this.homingFor > 0) {
                this.homingFor = Math.max(0, this.homingFor - Game.dt)
                const px  = Game.player.x + Game.player.width / 2
                const bx  = this.x + this.width / 2
                const dir = px > bx ? 1 : -1
                this.vx  += dir * 1.5 * Game.dt
                this.vx   = Math.max(-1.8, Math.min(1.8, this.vx))
            }

            this.x += this.vx * Game.dt * 60
            this.y += this.vy * Game.dt * 60
            if (this.age >= 8 || this.y > Game.view.height + 20 || this.x < -20 || this.x > Game.view.width + 20) {
                delete Game.enemyBullets[this.index]
            }
        }
        return EnemyBullet
    }
}(globalThis.ShootingGame))
