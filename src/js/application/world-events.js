(function (app) {
    app.createWorldEvents = function (Game) {
        const energyConfig = Game.config.energy
        const meteorConfig = Game.config.meteors

        function activeStage(game) {
            return game.waveStage === game.rules.WAVE_STAGES.WAVE
        }

        return {
            initializeWorldEvents: function () {
                this.energySpawnRemaining = energyConfig.firstSpawnDelay
                    * (this.rewardEffects?.energySpawnIntervalMultiplier ?? 1)
                this.meteorSpawnRemaining = meteorConfig.firstSpawnDelay
                this.bossMeteorWarningRemaining = 0
                this.bossMeteorBurstRemaining = 0
                this.bossMeteorBurstGapRemaining = 0
            },

            prepareBossWorldEvents: function () {
                this.meteorSpawnRemaining = meteorConfig.boss.firstSpawnDelay
                this.bossMeteorWarningRemaining = 0
                this.bossMeteorBurstRemaining = 0
                this.bossMeteorBurstGapRemaining = 0
            },

            clearBossWorldEvents: function () {
                this.bossMeteorWarningRemaining = 0
                this.bossMeteorBurstRemaining = 0
                this.bossMeteorBurstGapRemaining = 0
            },

            spawnAmbientEnergy: function () {
                if (Object.values(this.powerUps).some(powerUp => powerUp.isEnergyPickup)) return false
                const x = this.rules.energySpawnX(this.randomFloat, this.view.width, 24)
                new this.entities.EnergyPickup(x, -12)
                return true
            },

            spawnMeteor: function (profile) {
                if (Object.keys(this.meteors).length >= profile.maximumConcurrent) return false
                const spec = this.rules.createMeteorSpec(this.randomFloat, this.view.width, profile)
                new this.entities.Meteor(spec)
                return true
            },

            updateBossMeteorEvents: function (elapsed) {
                const profile = this.rules.bossMeteorProfile(this.bossCount,
                    this.boss?.phase || 1, meteorConfig)
                if (!profile.enabled) return

                if (this.bossMeteorWarningRemaining > 0) {
                    this.bossMeteorWarningRemaining = Math.max(0,
                        this.bossMeteorWarningRemaining - elapsed)
                    if (this.bossMeteorWarningRemaining === 0) {
                        this.bossMeteorBurstRemaining = profile.burstSize
                        this.bossMeteorBurstGapRemaining = 0
                    }
                    return
                }

                if (this.bossMeteorBurstRemaining > 0) {
                    this.bossMeteorBurstGapRemaining = Math.max(0,
                        this.bossMeteorBurstGapRemaining - elapsed)
                    if (this.bossMeteorBurstGapRemaining === 0) {
                        this.spawnMeteor(profile)
                        this.bossMeteorBurstRemaining--
                        this.bossMeteorBurstGapRemaining = profile.burstGap
                    }
                    return
                }

                this.meteorSpawnRemaining = Math.max(0, this.meteorSpawnRemaining - elapsed)
                if (this.meteorSpawnRemaining > 0) return
                this.meteorSpawnRemaining = this.rules.nextMeteorSpawnDelay(this.randomFloat, profile)
                if (profile.finalPhase) {
                    this.bossMeteorWarningRemaining = profile.warningDuration
                    this.playOrbitalWarningSound?.()
                } else {
                    this.spawnMeteor(profile)
                }
            },

            updateWorldEvents: function (dt) {
                if (this.paused || this.isGameOver) return
                const elapsed = Math.max(0, Number(dt) || 0)

                if (this.waveStage === this.rules.WAVE_STAGES.BOSS) {
                    this.updateBossMeteorEvents(elapsed)
                    return
                }
                if (!activeStage(this)) return

                this.energySpawnRemaining = Math.max(0, this.energySpawnRemaining - elapsed)
                if (this.energySpawnRemaining === 0) {
                    this.spawnAmbientEnergy()
                    this.energySpawnRemaining = this.rules.nextEnergySpawnDelay(this.randomFloat, energyConfig)
                        * (this.rewardEffects?.energySpawnIntervalMultiplier ?? 1)
                }

                const profile = this.rules.meteorProfile(this.difficulty, meteorConfig)
                if (!profile.enabled) return
                this.meteorSpawnRemaining = Math.max(0, this.meteorSpawnRemaining - elapsed)
                if (this.meteorSpawnRemaining === 0) {
                    this.spawnMeteor(profile)
                    this.meteorSpawnRemaining = this.rules.nextMeteorSpawnDelay(this.randomFloat, profile)
                }
            }
        }
    }
}(globalThis.ShootingGame))
