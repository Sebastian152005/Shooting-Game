(function (app) {
    app.createEnergySystem = function (Game) {
        const config = Game.config.energy
        return {
            initializeEnergyState: function () {
                this.energy = this.rules.clampEnergy(config.initial, config.minimum, config.maximum)
                this.pulseVisualRemaining = 0
                this.pulseOrigin = null
                this.pulseDestroyedCount = 0
            },

            updateEnergy: function (dt) {
                const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0
                this.pulseVisualRemaining = Math.max(0, (this.pulseVisualRemaining || 0) - elapsed)
                this.energy = this.rules.clampEnergy(this.energy, config.minimum, config.maximum)
            },

            collectEnergy: function (amount) {
                const previous = this.rules.clampEnergy(this.energy, config.minimum, config.maximum)
                this.energy = this.rules.clampEnergy(previous + Math.max(0, Number(amount) || 0),
                    config.minimum, config.maximum)
                return this.energy - previous
            },

            activateDefensivePulse: function () {
                const cost = this.rewardEffects?.pulseCost ?? config.pulseCost
                const radius = this.rewardEffects?.pulseRadius ?? config.pulseRadius
                if (this.paused || this.isGameOver || this.bossActive || !this.player
                    || (this.energy || 0) < cost) return false

                const origin = {
                    x: this.player.x + this.player.width / 2,
                    y: this.player.y + this.player.height / 2
                }
                let destroyedProjectiles = 0
                for (const [id, bullet] of Object.entries(this.enemyBullets || {})) {
                    if (this.rules.isInsidePulse(origin, bullet, radius)) {
                        delete this.enemyBullets[id]
                        destroyedProjectiles++
                    }
                }
                let destroyedMeteors = 0
                for (const meteor of Object.values(this.meteors || {})) {
                    if (!this.rules.isInsidePulse(origin, meteor, radius)) continue
                    meteor.destroy(true, 'pulse')
                    destroyedMeteors++
                }
                this.energy = this.rules.clampEnergy(this.energy - cost, config.minimum, config.maximum)
                this.pulseVisualRemaining = config.pulseVisualDuration
                this.pulseOrigin = origin
                this.pulseDestroyedCount = destroyedProjectiles + destroyedMeteors
                this.shakeTimer = Math.max(this.shakeTimer || 0, 0.12)
                this.playPulseActivationSound?.()
                if (this.pulseDestroyedCount > 0) {
                    this.playPulseImpactSound?.({ projectiles: destroyedProjectiles, meteors: destroyedMeteors })
                }
                return true
            }
        }
    }
}(globalThis.ShootingGame))
