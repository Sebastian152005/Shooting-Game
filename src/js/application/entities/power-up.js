(function (app) {
    app.entityFactories.PowerUp = function (Game) {
        const { POWERUP_TYPES, POWERUP_COLORS, POWERUP_LABELS, POWERUP_ICONS } = Game.config
        const PowerUp = function (x, y) {
            this.type   = POWERUP_TYPES[Game.random(0, POWERUP_TYPES.length)]
            this.x      = x
            this.y      = y
            this.width  = 28
            this.height = 28
            this.vy     = 1.5
            this.color  = POWERUP_COLORS[this.type]
            this.id     = Game.powerUpIndex
            Game.powerUps[Game.powerUpIndex] = this
            Game.powerUpIndex++
            this.pulse  = 0
        }

        PowerUp.prototype.draw = function () {
            Game.drawEntity(this, 'PowerUp')
        }

        PowerUp.prototype.update = function () {
            this.pulse += Game.dt * 4
            this.y += this.vy * Game.dt * 60
            if (this.y > Game.view.height + 20) { delete Game.powerUps[this.id]; return }
            const hitbox = { x: this.x - this.width / 2, y: this.y - this.height / 2, width: this.width, height: this.height }
            if (Game.collision(hitbox, Game.player)) {
                this.activate()
                delete Game.powerUps[this.id]
            }
        }

        PowerUp.prototype.activate = function () {
            const p = Game.player
            switch (this.type) {
                case 'rapidfire': p.rapidFire  = 6; break
                case 'shield':    p.shield = 5; p.invincible = true; break
                case 'triple':    p.tripleShot = 6; break
                case 'bomb':
                    p.bombFlash = 1
                    Game.playBombSound()
                    for (let i in Game.enemies) Game.enemies[i].die()
                    if (Game.boss) Game.boss.hp = Math.max(1, Math.ceil(Game.boss.hp / 2))
                    break
            }
            Game.playPowerUpSound(this.type)
            new Game.entities.FloatingText(p.x + p.width / 2, p.y - 10, POWERUP_LABELS[this.type], this.color)
        }
        return PowerUp
    }
}(globalThis.ShootingGame))
