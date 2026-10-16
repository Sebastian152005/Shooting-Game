(function (app) {
    app.entityFactories.EnergyPickup = function (Game) {
        const EnergyPickup = function (x, y) {
            this.x = x
            this.y = y
            this.width = 26
            this.height = 42
            this.vy = Game.config.energy.fallSpeed
            this.pulse = 0
            this.rotation = 0
            this.sprite = 'energyCapsule'
            this.isEnergyPickup = true
            this.id = Game.powerUpIndex++
            Game.powerUps[this.id] = this
        }

        EnergyPickup.prototype.draw = function () {
            Game.drawEnergyPickup(this)
        }

        EnergyPickup.prototype.update = function () {
            this.pulse += Game.dt * 5
            this.rotation = (this.rotation + Game.dt * Game.config.energy.capsuleRotationSpeed)
                % (Math.PI * 2)
            this.y += this.vy * Game.dt * 60
            if (this.y > Game.view.height + this.height) {
                delete Game.powerUps[this.id]
                return
            }
            const attraction = Game.rewardEffects?.pickupAttractionRadius ?? 0
            const hitbox = {
                x: this.x - this.width / 2 - attraction,
                y: this.y - this.height / 2 - attraction,
                width: this.width + attraction * 2,
                height: this.height + attraction * 2
            }
            if (!Game.collision(hitbox, Game.player)) return
            const amount = Game.config.energy.pickupAmount
            const collected = Game.collectEnergy(amount)
            Game.playEnergyPickupSound?.()
            if (collected > 0) {
                new Game.entities.FloatingText(Game.player.x + Game.player.width / 2,
                    Game.player.y - 10, '+' + collected + ' ENERGIA', '#61F5FF')
            } else {
                new Game.entities.FloatingText(Game.player.x + Game.player.width / 2,
                    Game.player.y - 10, 'ENERGIA LLENA', '#B8FAFF')
            }
            delete Game.powerUps[this.id]
        }
        return EnergyPickup
    }
}(globalThis.ShootingGame))
