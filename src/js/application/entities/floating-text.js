(function (app) {
    app.entityFactories.FloatingText = function (Game) {
        const FloatingText = function (x, y, text, color, fontSize) {
            this.x        = x
            this.y        = y
            this.text     = text
            this.color    = color || 'white'
            this.fontSize = fontSize || 16
            this.life     = 0
            this.maxLife  = 1.5
            this.vy       = -1.2
            this.id      = Game.floatingTextIndex
            Game.floatingTexts[Game.floatingTextIndex] = this
            Game.floatingTextIndex++
        }

        FloatingText.prototype.draw = function () {
            Game.drawEntity(this, 'FloatingText')
        }

        FloatingText.prototype.update = function () {
            this.y    += this.vy * Game.dt * 60
            this.life += Game.dt
            if (this.life >= this.maxLife) delete Game.floatingTexts[this.id]
        }
        return FloatingText
    }
}(globalThis.ShootingGame))
