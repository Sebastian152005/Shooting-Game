(function (app) {
    app.entityFactories.Particle = function (Game) {

        const Particle = function (x, y) {
            this.x       = x
            this.y       = y
            this.vx      = Game.random(-5, 5)
            this.vy      = Game.random(-5, 5)
            this.sprite  = 'explosion'
            this.id      = Game.particleIndex
            Game.particles[Game.particleIndex] = this
            Game.particleIndex++
            this.life    = 0
            this.gravity = 0.05
            this.size    = 40
            this.maxlife = 1.67
        }

        Particle.prototype.draw = function () {
            Game.drawEntity(this, 'Particle')
        }

        Particle.prototype.update = function () {
            const s   = Game.dt * 60
            this.x   += this.vx * s
            this.y   += this.vy * s
            this.vy  += this.gravity * s
            this.size *= Math.pow(0.89, s)
            this.life += Game.dt
            if (this.life >= this.maxlife) delete Game.particles[this.id]
        }
        return Particle
    }
}(globalThis.ShootingGame))
