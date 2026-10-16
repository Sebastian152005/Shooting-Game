(function (app) {

    app.createWaves = function (Game) {
        const config = Game.config.progression
        const stages = Game.rules.WAVE_STAGES
        const events = Game.rules.WAVE_EVENTS
        return {
            applyWaveProfile: function () {
                this.waveProfile = this.rules.progressionProfile(this.difficulty, this.config)
                this.maxEnemies = this.waveProfile.maxEnemies
                // Only future arrivals use this profile. Survivors keep their birth profile.
            },

            updateProgression: function (dt) {
                if (this.paused || this.isGameOver) return
                this.updateEnergy?.(dt)
                if (this.waveStage === stages.INTRO) {
                    this.introRemaining = Math.max(0, this.introRemaining - dt)
                    if (this.introRemaining === 0) {
                        this.waveStage = this.rules.transitionWaveStage(this.waveStage, events.INTRO_COMPLETED)
                    }
                    return
                }
                this.enemyAttackCooldown = Math.max(0, this.enemyAttackCooldown - dt)
                if (this.safeCorridor) {
                    this.safeCorridor.remaining = Math.max(0, this.safeCorridor.remaining - dt)
                    this.safeCorridor.approachRemaining = Math.max(0, this.safeCorridor.approachRemaining - dt)
                    if (this.safeCorridor.remaining === 0) this.safeCorridor = null
                }
                if (this.waveStage === stages.BOSS) return
                if (this.waveStage === stages.BOSS_PENDING) {
                    this.tryStartBoss()
                    return
                }
                if (this.waveStage === stages.RECOVERY) {
                    this.recoveryTime = Math.max(0, this.recoveryTime - dt)
                    if (this.recoveryTime === 0) {
                        this.waveStage = this.rules.transitionWaveStage(this.waveStage, events.RECOVERY_COMPLETED)
                        this.levelUpTimer = 0
                        this.bannerMessage = null
                        this.fillEnemySlots()
                    }
                    return
                }
                this.progressionTime += dt
                if (this.progressionTime >= this.nextDifficultyAt) {
                    this.nextDifficultyAt += Game.config.difficultyInterval
                    this.increaseDifficulty()
                }
            },

            setBanner: function (message, duration) {
                this.bannerMessage = message
                this.bannerDuration = duration
                this.levelUpTimer = duration
            },

            increaseDifficulty: function () {
                if (this.waveStage !== stages.WAVE || this.isGameOver) return
                this.difficulty++
                this.levelFlash = 0.2
                this.applyWaveProfile()
                this.playLevelUpSound()
                if (this.difficulty === this.nextBossAt) {
                    this.waveStage = this.rules.transitionWaveStage(this.waveStage, events.BOSS_REQUESTED)
                    this.pendingSpawns = []
                    this.refreshEnemyCount()
                    this.tryStartBoss()
                } else {
                    this.setBanner('NIVEL ' + this.difficulty, 2.5)
                    this.fillEnemySlots()
                }
            },

            tryStartBoss: function () {
                if (this.waveStage !== stages.BOSS_PENDING || this.paused || this.isGameOver
                    || Object.keys(this.enemies).length || this.bossActive) return false
                this.bossCount++
                this.nextBossAt += Math.max(config.minimumBossGap, 5 - this.bossCount)
                new this.entities.Boss()
                return true
            },

            beginBossEncounter: function () {
                if (Object.keys(this.enemies).length) throw new Error('Boss entry requires a cleared field')
                this.releaseIncursion()
                // The final UFO was defeated; no old volley enters the encounter.
                this.waveStage = this.rules.transitionWaveStage(this.waveStage, events.BOSS_STARTED)
                this.safeCorridor = null
                this.enemyAttackCooldown = 0
                this.setBanner('¡JEFE!', 3)
                this.pendingSpawns = []
                this.enemyBullets = {}
                this.bullets = {}
                this.meteors = {}
                for (const [id, powerUp] of Object.entries(this.powerUps)) {
                    if (powerUp.isEnergyPickup) delete this.powerUps[id]
                }
                this.prepareBossWorldEvents?.()
                this.refreshEnemyCount()
            },

            endBossEncounter: function () {
                this.releaseIncursion()
                this.waveStage = this.rules.transitionWaveStage(this.waveStage, events.BOSS_DEFEATED)
                this.safeCorridor = null
                this.enemyAttackCooldown = 0
                this.recoveryTime = config.bossRecovery
                this.enemyBullets = {}
                this.clearBossWorldEvents?.()
                this.setBanner('ZONA DESPEJADA', config.bossRecovery)
                this.levelFlash = 0.25
                this.invincibleMode(config.bossRecovery * 1000)
                this.recordBossDefeat?.()
                this.offerBossRewards?.()
            },

            canPrepareEnemyAttack: function (actor) {
                const available = [stages.WAVE, stages.BOSS_PENDING].includes(this.waveStage) && !this.paused && !this.isGameOver
                    && !this.safeCorridor
                    && this.enemyAttackCooldown === 0
                    && Object.values(this.enemies).filter(enemy => enemy.pendingAttack && !enemy.dead).length < config.maxChargedAttacks
                if (!available || !actor) return available
                // Rotate among ready specialists, including unsuccessful fan attempts.
                // A controller whose geometry is blocked cannot monopolize the turn.
                const waiting = Object.values(this.enemies).some(enemy => enemy !== actor
                    && !enemy.dead && !enemy.entering && enemy.role !== 'pressure'
                    && enemy.shootTimer >= enemy.shootInterval
                    && enemy.canAcquireTarget()
                    && (enemy.attackTurn < actor.attackTurn
                        || (enemy.attackTurn === actor.attackTurn && enemy.index < actor.index)))
                if (waiting) return false
                actor.attackTurn = ++this.enemyAttackTurn
                return true
            },

            fireEnemyVolley: function (x, y, speed, color, angles, fanOwner = null, attackType = null) {
                const velocity = Math.min(speed, config.maxBulletSpeed)
                const gap = this.safeCorridor
                if (gap) {
                    angles = angles.filter(angle => {
                        const candidate = {
                            x: x - 8.5, y, width: 17, height: config.maxBulletHeight,
                            vx: Math.sin(angle) * velocity, vy: Math.cos(angle) * velocity,
                            wobbleAmp: fanOwner === null && angles.length === 1 && angle === 0 && color === 'lime' ? 0.7 : 0
                        }
                        return !this.threatensCorridor(candidate, gap, gap.remaining)
                            && (fanOwner === gap.owner || gap.approachRemaining === 0
                                || !this.threatensCorridor(candidate, gap.approach, gap.approachRemaining))
                    })
                }
                const reserved = gap && !gap.fired && fanOwner !== gap.owner ? gap.angles.length : 0
                if (Object.keys(this.enemyBullets).length + angles.length + reserved > config.maxEnemyBullets) return []
                return angles.map(angle => {
                    const bullet = new this.entities.EnemyBullet(x, y, velocity, color,
                        Math.sin(angle) * velocity, Math.cos(angle) * velocity, attackType)
                    bullet.homing = false
                    bullet.isFan = fanOwner !== null
                    // Gameplay projectiles keep their announced trajectory. The
                    // common green laser is straight; only aggressors may steer.
                    bullet.wobbleAmp = 0
                    return bullet
                })
            }
        }
    }
}(globalThis.ShootingGame))
