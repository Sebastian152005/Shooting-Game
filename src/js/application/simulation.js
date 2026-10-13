(function (app) {
    app.createSimulation = function (Game) {
        return {
            resolvePlayerBulletHits: function (target) {
                if (!target.canBeHit()) return
                for (const bullet of Object.values(this.bullets)) {
                    if (this.collision(bullet, target) && target.receiveHit()) {
                        delete this.bullets[bullet.index]
                        if (target.dead) break
                    }
                }
            },

            updateWorld: function (dt) {
                if (this.paused || this.isGameOver) return
                this.dt = dt
                this.elapsedTime += dt
                this.updateSpawns(dt)
                this.updateProgression(dt)
                this.comboTimer = Math.max(0, this.comboTimer - dt)
                if (this.comboTimer === 0) {
                    this.combo = 0
                    this.comboMultiplier = 1
                    this.comboScale = 1
                }
                this.comboScale = Math.max(1, this.comboScale - dt * 6)
                this.levelUpTimer = Math.max(0, this.levelUpTimer - dt)
                this.shakeTimer = Math.max(0, this.shakeTimer - dt)
                this.levelFlash = Math.max(0, this.levelFlash - dt * 2)

                for (const enemy of Object.values(this.enemies)) enemy.update()
                if (this.boss) this.boss.update()
                for (const collection of ['enemyBullets', 'bullets', 'powerUps', 'particles', 'floatingTexts']) {
                    for (const entity of Object.values(this[collection])) entity.update()
                }
                this.player.update()
                if (this.isGameOver) return
                if (this.player.invincible && this.player.shield <= 0) {
                    this.blinkTimer += dt
                    if (this.blinkTimer >= 0.1) {
                        this.blinkTimer = 0
                        this.blinkVisible = !this.blinkVisible
                    }
                } else {
                    this.blinkVisible = true
                    this.blinkTimer = 0
                }
            }
        }
    }
}(globalThis.ShootingGame))
