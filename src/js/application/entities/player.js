(function (app) {
    app.entityFactories.Player = function (Game) {
        const Player = function () {
            this.width        = 70
            this.height       = 70
            this.x            = Game.view.width / 2 - this.width / 2
            this.y            = Game.view.height - this.height
            // Transitional aliases keep old integrations working while all input
            // producers migrate to the application InputState port.
            for (const [property, action] of [['movingLeft', 'moveLeft'], ['movingRight', 'moveRight']]) {
                Object.defineProperty(this, property, {
                    configurable: true,
                    enumerable: true,
                    get: () => Game.input?.isActive(action) || false,
                    set: active => Game.input?.set(action, Boolean(active), 'legacy:' + property)
                })
            }
            this.speed        = 5
            this.horizontalVelocity = 0
            this.shootCooldown = 0
            this.invincible      = false
            this.invincibleTimer = 0
            this.rapidFire       = 0
            this.tripleShot      = 0
            this.shield          = 0
            this.bombFlash       = 0
            this.trail        = []
            this.sprite       = 'player'
        }

        Player.prototype.die = function () {
            if (Game.isGameOver) return
            if (Game.life < Game.maxLives) {
                Game.playHitSound()
                Game.invincibleMode(2000)
                Game.life++
                Game.shakeTimer = 0.3
            }
            if (Game.life >= Game.maxLives) Game.gameOver()
        }

        Player.prototype.draw = function () {
            Game.drawEntity(this, 'Player')
        }

        Player.prototype.update = function () {
            if (Game.paused || Game.isGameOver) return
            const move   = this.speed * Game.dt * 60
            const movingLeft = Game.input?.isActive('moveLeft') || false
            const movingRight = Game.input?.isActive('moveRight') || false
            const moving = movingLeft || movingRight

            const direction = Number(movingRight) - Number(movingLeft)
            this.horizontalVelocity = direction * this.speed * 60
            this.x += direction * move
            this.x = Math.max(0, Math.min(Game.view.width - this.width, this.x))

            // trail
            if (moving) {
                this.trail.unshift({ x: this.x + this.width / 2, y: this.y + this.height * 0.75 })
                if (this.trail.length > 8) this.trail.pop()
            } else if (this.trail.length > 0) {
                this.trail.pop()
            }

            // power-up timers
            for (const timer of ['rapidFire', 'tripleShot', 'shield', 'bombFlash']) {
                this[timer] = Math.max(0, this[timer] - Game.dt)
            }

            // invincibility: shield takes priority; damage/unpause use invincibleTimer
            if (this.shield > 0) {
                this.invincible      = true
                this.invincibleTimer = 0
            } else if (this.invincibleTimer > 0) {
                this.invincibleTimer -= Game.dt
                if (this.invincibleTimer <= 0) { this.invincibleTimer = 0; this.invincible = false }
            } else {
                this.invincible = false
            }

            this.shootCooldown -= Game.dt
            if (Game.input?.isActive('fire') && this.shootCooldown <= 0 && (!this.invincible || this.shield > 0)) this.shoot()

            for (let i in Game.enemyBullets) {
                if (Game.collision(Game.enemyBullets[i], this) && !this.invincible) {
                    this.die()
                    delete Game.enemyBullets[i]
                    if (Game.isGameOver) break
                }
            }
        }

        Player.prototype.shoot = function () {
            const cx       = this.x + this.width / 2
            const cooldown = (this.rapidFire > 0 ? 4 : 10) / 60
            if (this.tripleShot > 0) {
                new Game.entities.Bullet(cx, -2.5)
                new Game.entities.Bullet(cx,  0)
                new Game.entities.Bullet(cx,  2.5)
            } else {
                new Game.entities.Bullet(cx, 0)
            }
            this.shootCooldown = cooldown
            if (this.tripleShot > 0) {
                Game.playTripleShotSound()
            } else {
                Game.playLaser()
            }
        }
        return Player
    }
}(globalThis.ShootingGame))
