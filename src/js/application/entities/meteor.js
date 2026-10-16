(function (app) {
    app.entityFactories.Meteor = function (Game) {
        const Meteor = function (spec) {
            this.index = Game.meteorIndex++
            this.x = spec.x
            this.y = spec.y
            this.width = spec.size
            this.height = spec.size
            this.speed = spec.speed
            this.verticalSpeed = spec.speed
            this.horizontalSpeed = spec.drift
            this.gravity = spec.gravity
            this.terminalSpeed = spec.terminalSpeed
            this.angularVelocity = spec.angularVelocity
            this.rotation = Game.randomFloat() * Math.PI * 2
            this.tumblePhase = Game.randomFloat() * Math.PI * 2
            this.tumbleSpeed = 0.85 + Game.randomFloat() * 0.7
            this.impactFlash = 0
            this.hp = spec.hp
            this.maxHp = spec.hp
            this.points = spec.points
            this.dead = false
            this.sprite = 'meteor'
            Game.meteors[this.index] = this
        }

        Meteor.prototype.draw = function () {
            Game.drawEntity(this, 'Meteor')
        }

        Meteor.prototype.canBeHit = function () {
            return !this.dead && !Game.paused && !Game.isGameOver
                && Game.meteors[this.index] === this
        }

        Meteor.prototype.receiveHit = function () {
            if (!this.canBeHit()) return false
            this.hp--
            this.impactFlash = 0.11
            for (let index = 0; index < 2; index++) {
                new Game.entities.Particle(this.x + Game.random(0, this.width),
                    this.y + Game.random(0, this.height))
            }
            if (this.hp <= 0) this.destroy(true)
            return true
        }

        Meteor.prototype.destroy = function (shotDown, source = 'projectile') {
            if (this.dead) return
            this.dead = true
            delete Game.meteors[this.index]
            for (let i = 0; i < 7; i++) {
                new Game.entities.Particle(this.x + Game.random(0, this.width),
                    this.y + Game.random(0, this.height))
            }
            if (shotDown) {
                const points = this.points * this.maxHp
                Game.score += points
                new Game.entities.FloatingText(this.x + this.width / 2, this.y,
                    '+' + points + ' ORBITAL', '#FFB05A')
            }
            if (source !== 'pulse') Game.playExplosion()
        }

        Meteor.prototype.update = function () {
            if (this.dead || Game.paused || Game.isGameOver) return
            this.impactFlash = Math.max(0, this.impactFlash - Game.dt)
            this.rotation += this.angularVelocity * Game.dt
            this.verticalSpeed = Math.min(this.terminalSpeed,
                this.verticalSpeed + this.gravity * Game.dt)
            this.x += this.horizontalSpeed * Game.dt * 60
            if (this.x <= 0 || this.x + this.width >= Game.view.width) {
                this.x = Math.max(0, Math.min(Game.view.width - this.width, this.x))
                this.horizontalSpeed *= -0.65
            }
            this.y += this.verticalSpeed * Game.dt * 60
            Game.resolvePlayerBulletHits(this)
            if (this.dead) return
            if (Game.collision(this, Game.player)) {
                if (!Game.player.invincible) Game.player.die()
                this.destroy(false)
                return
            }
            if (this.y > Game.view.height + this.height) delete Game.meteors[this.index]
        }

        return Meteor
    }
}(globalThis.ShootingGame))
