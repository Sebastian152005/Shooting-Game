(function (app) {
    app.entityFactories.Bullet = function (Game) {
        const Bullet = function (x, vx) {
            this.width  = 6
            this.height = 24
            this.x      = x - this.width / 2
            this.y      = Game.player.y - this.height
            this.vx     = vx || 0
            this.vy     = 7
            this.triple = Game.player.tripleShot > 0
            this.index  = Game.bulletIndex++
            Game.bullets[this.index] = this
            this.phase  = Game.randomFloat() * Math.PI * 2
        }

        Bullet.prototype.draw = function () {
            Game.drawEntity(this, 'Bullet')
        }

        Bullet.prototype.update = function () {
            if (Game.paused || Game.isGameOver || Game.bullets[this.index] !== this) return
            const movement = { x: this.vx * Game.dt * 60, y: -this.vy * Game.dt * 60 }
            const targets = Game.bossActive ? (Game.boss ? [Game.boss] : []) : Object.values(Game.enemies)
            let first = null
            let contact = Infinity
            for (const target of targets) {
                if (!target.canBeHit()) continue
                const time = Game.rules.projectileContact(this, movement, target)
                if (time !== null && time < contact) {
                    first = target
                    contact = time
                }
            }
            if (first && first.receiveHit()) {
                this.x += movement.x * contact
                this.y += movement.y * contact
                delete Game.bullets[this.index]
                return
            }
            this.x += movement.x
            this.y += movement.y
            if (this.y + this.height < 0 || this.x + this.width < -10 || this.x > Game.view.width + 10) {
                delete Game.bullets[this.index]
            }
        }
        return Bullet
    }
}(globalThis.ShootingGame))
