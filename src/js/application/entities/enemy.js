(function (app) {
    app.entityFactories.Enemy = function (Game) {
        const Enemy = function (position) {
            this.width  = Game.config.enemySize.width
            this.height = Game.config.enemySize.height
            this.x = position ? position.x : Game.random(0, Game.view.width - this.width)
            this.entryMotionSeed = position?.entryMotionSeed
            this.entrySway = position?.entrySway
            this.entryPathBounds = position?.entryPathBounds || null
            this.entering = true
            this.y = position ? position.y : -this.height - Game.config.progression.enemySeparation
            this.dead   = false
            this.index  = Game.enemyIndex
            Game.enemies[Game.enemyIndex] = this
            Game.enemyIndex++
            this.movingLeft = Game.randomFloat() < 0.5
            this.bank = 0
            this.entryVelocityX = 0
            this.entryVelocityY = 0
            this.salvo = 0
            this.pendingAttack = null
            this.attackTurn = 0
            this.ai = {
                state: Game.rules.ENEMY_AI_STATES.ENTERING,
                acquisitionRemaining: 0,
                lastKnownTarget: null
            }
            this.configure(Game.waveProfile)
            if (position && Number.isFinite(position.targetX) && Number.isFinite(position.targetY)) {
                this.entryTargetX = position.targetX
                this.entryY = position.targetY
                this.homeY = position.targetY
                this.motionOriginY = position.targetY
            }
            this.shootTimer = Game.random(0, Math.floor(this.shootInterval * 60)) / 60
            Game.refreshEnemyCount()
        }

        Enemy.prototype.configure = function (profile) {
            if (this.pendingAttack) {
                if (this.pendingAttack.kind === 'fan') Game.releaseFan(this)
                this.pendingAttack = null
                this.shootTimer = 0
                this.setAIState(Game.rules.ENEMY_AI_STATES.RECOVERY)
                Game.enemyAttackCooldown = Game.config.progression.enemyAttackGap
            }
            this.profile = profile
            this.pattern = profile.patterns[this.index % profile.patterns.length]
            const preferred = Game.rules.enemyRolePreference(profile, this.index)
            const specialists = Object.values(Game.enemies).filter(enemy => enemy !== this && !enemy.dead && enemy.role === preferred).length
            this.role = preferred !== 'pressure' && specialists >= Game.config.progression.maxSpecialistsPerRole ? 'pressure' : preferred
            this.isAggressor = this.role === 'aggressor'
            this.isMarksman = this.role === 'marksman'
            this.speed = profile.enemySpeed + (this.isAggressor ? 0.4 : this.isMarksman ? 0.15 : 0)
            this.bulletSpeed = profile.bulletSpeed + (this.isAggressor ? 0.4 : this.isMarksman ? 0.25 : 0)
            // Specialists have exclusive attacks and leave time to react between charges.
            this.shootInterval = this.role === 'controller'
                ? Math.max(1.2, profile.shootInterval + 1)
                : this.isAggressor ? Math.max(1, profile.shootInterval - 0.35)
                    : this.isMarksman ? Math.max(1.2, profile.shootInterval + 0.3)
                    : profile.shootInterval
            this.minY = Game.config.progression.enemyTopMargin
            this.maxY = Game.enemyBounds(this.pattern === 'diver' || this.isAggressor || this.isMarksman, profile.level).bottom - this.height
            Game.resetEnemyMotion(this)
            this.shootTimer = Math.min(this.shootTimer || 0, this.shootInterval)
            this.sprite = profile.level >= 3 || this.isAggressor || this.isMarksman ? 'enemy' : 'scout'
        }

        Enemy.prototype.draw = function () {
            Game.drawEntity(this, 'Enemy')
        }

        Enemy.prototype.drawRole = function () {
            Game.drawEntity(this, 'EnemyRole')
        }

        Enemy.prototype.update = function () {
            if (this.dead || Game.paused || Game.isGameOver || Game.bossActive || Game.enemies[this.index] !== this) return
            if (this.entering) {
                const nextElapsed = Math.min(Game.config.motion.entryDuration, this.entryElapsed + Game.dt)
                const entry = Game.rules.enemyEntryMotion(
                    { x: this.entryStartX, y: this.entryStartY },
                    { x: this.entryTargetX, y: this.entryY },
                    nextElapsed, Game.config.motion.entryDuration, this.entryMotionSeed ?? this.index,
                    this.entrySway ?? Game.config.motion.entrySway, Game.view.width - this.width)
                if (Game.canMoveEnemy(this, entry.x, entry.y)) {
                    const horizontalChange = entry.x - this.x
                    this.entryVelocityX = Game.dt > 0 ? horizontalChange / (Game.dt * 60) : 0
                    this.entryVelocityY = Game.dt > 0 ? (entry.y - this.y) / (Game.dt * 60) : 0
                    this.x = entry.x
                    this.y = entry.y
                    this.entryElapsed = nextElapsed
                    this.bank += (Math.max(-0.18, Math.min(0.18, horizontalChange * 0.018)) - this.bank)
                        * Math.min(1, Game.dt * Game.config.motion.bankResponse)
                }
                if (entry.done && Math.abs(this.x - this.entryTargetX) <= 0.01
                    && Math.abs(this.y - this.entryY) <= 0.01) {
                    this.entering = false
                    this.entryPathBounds = null
                    this.setAIState(Game.rules.ENEMY_AI_STATES.PATROL)
                }
                Game.resolvePlayerBulletHits(this)
                return
            }
            if (this.ai.state === Game.rules.ENEMY_AI_STATES.ENTERING) {
                this.setAIState(Game.rules.ENEMY_AI_STATES.PATROL)
            }
            if (!this.pendingAttack && this.ai.state === Game.rules.ENEMY_AI_STATES.WARNING) {
                this.setAIState(Game.rules.ENEMY_AI_STATES.RECOVERY)
            }
            const charging = Boolean(this.pendingAttack)
            if (!charging) {
                const previousX = this.x
                Game.moveEnemy(this, Game.dt)
                const horizontalChange = this.x - previousX
                const desiredBank = Math.max(-0.14, Math.min(0.14, horizontalChange * 0.025))
                this.bank += (desiredBank - this.bank) * Math.min(1, Game.dt * Game.config.motion.bankResponse)

                this.shootTimer = Math.min(this.shootInterval, this.shootTimer + Game.dt)
                if (this.role === 'pressure') {
                    if (this.ai.state === Game.rules.ENEMY_AI_STATES.RECOVERY
                        && this.shootTimer >= this.shootInterval) this.setAIState(Game.rules.ENEMY_AI_STATES.PATROL)
                    if (this.shootTimer >= this.shootInterval && this.shoot()) this.shootTimer = 0
                } else {
                    this.updateAI(Game.dt)
                }
            }

            Game.resolvePlayerBulletHits(this)
            // Hits resolve before a charged shot: destroying the attacker cancels it.
            if (!this.dead && charging && this.pendingAttack) {
                this.pendingAttack.remaining = Math.max(0, this.pendingAttack.remaining - Game.dt)
                if (this.pendingAttack.remaining === 0) {
                    const attack = this.pendingAttack
                    this.pendingAttack = null
                    const fan = attack.kind === 'fan'
                    const attackType = fan ? 'controller' : attack.kind === 'aimed' ? 'precision' : 'aggressor'
                    const bullets = Game.fireEnemyVolley(attack.x, attack.y, this.bulletSpeed,
                        Game.config.enemyAttackColors[attackType],
                        fan ? attack.angles : [attack.angle], fan ? this : null, attackType)
                    if (fan) {
                        if (bullets.length) Game.markFanFired(this)
                        else Game.releaseFan(this)
                    }
                    if (attack.kind === 'tracking' && bullets.length) {
                        bullets[0].homing = true
                        bullets[0].homingFor = Game.config.progression.homingDuration
                        bullets[0].isTracking = true
                    }
                    Game.enemyAttackCooldown = Game.config.progression.enemyAttackGap
                    this.shootTimer = 0
                    this.setAIState(Game.rules.ENEMY_AI_STATES.RECOVERY)
                }
            }
        }

        Enemy.prototype.canBeHit = function () {
            return !this.dead && !Game.paused && !Game.isGameOver && !Game.bossActive
                && Game.enemies[this.index] === this
                && this.y + this.height > 0 && this.y < Game.view.height
        }

        Enemy.prototype.receiveHit = function () {
            if (!this.canBeHit()) return false
            this.die()
            return true
        }

        Enemy.prototype.die = function () {
            if (this.dead) return
            Game.releaseIncursion(this)
            if (this.pendingAttack) Game.enemyAttackCooldown = Game.config.progression.enemyAttackGap
            if (this.pendingAttack?.kind === 'fan') Game.releaseFan(this)
            this.pendingAttack = null
            this.setAIState(Game.rules.ENEMY_AI_STATES.RECOVERY)
            this.dead = true
            this.explode()
            delete Game.enemies[this.index]

            Game.combo++
            Game.comboTimer      = 2.5
            Game.comboScale      = 2.0
            Game.comboMultiplier = 1 + Math.floor(Game.combo / 3) * 0.5
            const points         = Math.floor((15 + (this.profile.level - 1) * 5) * Game.comboMultiplier)
            Game.score          += points

            const ptColor = Game.combo >= 5 ? '#FF4500' : Game.combo >= 3 ? '#FFD700' : '#fff'
            new Game.entities.FloatingText(this.x + this.width / 2, this.y, '+' + points, ptColor)

            if (Game.randomFloat() < 0.2 && !Game.bossActive) new Game.entities.PowerUp(this.x + this.width / 2, this.y + this.height / 2)

            Game.playExplosion()

            Game.refreshEnemyCount()
            if (Game.waveStage === Game.rules.WAVE_STAGES.WAVE) Game.scheduleEnemy(2000)
        }

        Enemy.prototype.explode = function () {
            for (let i = 0; i < Game.maxParticles; i++) {
                new Game.entities.Particle(this.x + this.width / 2, this.y)
            }
        }

        Enemy.prototype.shoot = function (knownTarget = null) {
            if (Game.bossActive || Game.paused || Game.isGameOver || this.dead || this.entering || this.pendingAttack || Game.enemies[this.index] !== this) return false
            const x = this.x + this.width / 2
            const y = this.y + this.height
            const salvo = this.salvo + 1
            if (this.role === 'aggressor') {
                // Before homing unlocks, the fast tomato laser is still honest:
                // it only fires from a lane that its straight path can threaten.
                const radarRange = this.profile.tracking
                    ? this.profile.specialistDetectionRange : this.profile.detectionRange
                if (!this.canAcquireTarget(radarRange)) return false
                if (!Game.canPrepareEnemyAttack(this)) return false
                const targetX = knownTarget?.x ?? Game.player.x + Game.player.width / 2
                const targetY = knownTarget?.y ?? Game.player.y + Game.player.height / 2
                this.pendingAttack = {
                    x, y, targetX, targetY, angle: 0,
                    kind: this.profile.tracking ? 'tracking' : 'aggressive',
                    remaining: Game.config.progression.enemyWarning
                }
                this.salvo = salvo
                this.setAIState(Game.rules.ENEMY_AI_STATES.WARNING)
                return true
            }
            if (this.role === 'controller') {
                // Controllers scan the whole visible combat area, but still require
                // the player to be below them before reserving a fan corridor.
                if (!this.canAcquireTarget(Game.view.width)) return false
                if (!Game.canPrepareEnemyAttack(this)) return false
                const fan = Game.reserveFan(this, x, y, this.bulletSpeed, 2,
                    Game.config.progression.fanWarning, salvo)
                if (!fan) return false
                this.pendingAttack = { x, y, angles: fan.angles, kind: 'fan', remaining: Game.config.progression.fanWarning }
                this.salvo = salvo
                this.setAIState(Game.rules.ENEMY_AI_STATES.WARNING)
                return true
            }
            if (this.role === 'marksman') {
                if (!this.canAcquireTarget(this.profile.specialistDetectionRange)) return false
                if (!Game.canPrepareEnemyAttack(this)) return false
                const playerCenter = knownTarget?.x ?? Game.player.x + Game.player.width / 2
                const targetY = knownTarget?.y ?? Game.player.y + Game.player.height / 2
                const prediction = Game.rules.predictHorizontalIntercept({
                    targetX: playerCenter,
                    targetVelocity: knownTarget?.horizontalVelocity ?? Game.player.horizontalVelocity,
                    verticalDistance: targetY - y,
                    projectileSpeed: this.bulletSpeed,
                    minimumLead: Game.config.progression.precisionMinimumLead,
                    maximumLead: Game.config.progression.precisionMaximumLead,
                    minimumX: Game.player.width / 2,
                    maximumX: Game.view.width - Game.player.width / 2
                })
                const targetX = prediction.x
                this.pendingAttack = {
                    x, y, targetX, targetY,
                    angle: Math.atan2(targetX - x, targetY - y),
                    kind: 'aimed', leadTime: prediction.leadTime,
                    remaining: Game.config.progression.enemyWarning
                }
                this.salvo = salvo
                this.setAIState(Game.rules.ENEMY_AI_STATES.WARNING)
                return true
            }
            // The green UFO supplies the readable baseline pressure: one straight
            // laser per cadence. Specialists keep radar-gated, warned attacks.
            const bullets = Game.fireEnemyVolley(x, y, this.bulletSpeed,
                Game.config.enemyAttackColors.common, [0], null, 'common')
            if (!bullets.length) return false
            this.salvo = salvo
            this.setAIState(Game.rules.ENEMY_AI_STATES.RECOVERY)
            return true
        }

        Enemy.prototype.setAIState = function (state, acquisitionRemaining = 0) {
            this.ai.state = state
            this.ai.acquisitionRemaining = acquisitionRemaining
            if (state === Game.rules.ENEMY_AI_STATES.PATROL) this.ai.lastKnownTarget = null
        }

        Enemy.prototype.observeTarget = function () {
            this.ai.lastKnownTarget = Game.rules.rememberEnemyTarget(this.ai.lastKnownTarget, {
                x: Game.player.x + Game.player.width / 2,
                y: Game.player.y + Game.player.height / 2,
                horizontalVelocity: Game.player.horizontalVelocity
            })
        }

        Enemy.prototype.updateAI = function (dt) {
            const detected = this.canAcquireTarget()
            if (detected) this.observeTarget()
            const next = Game.rules.advanceEnemyAI(this.ai, {
                entering: this.entering,
                ready: this.shootTimer >= this.shootInterval,
                detected,
                dt,
                acquisitionDuration: Game.config.progression.enemyAcquisitionTime
            })
            this.ai.state = next.state
            this.ai.acquisitionRemaining = next.acquisitionRemaining
            if (next.action === 'cancel') this.ai.lastKnownTarget = null
            if (next.action === 'fire' && this.shoot(this.ai.lastKnownTarget)) this.shootTimer = 0
        }

        Enemy.prototype.canAcquireTarget = function (range) {
            if (this.dead || this.entering || Game.bossActive || Game.paused || Game.isGameOver
                || Game.enemies[this.index] !== this) return false
            if (this.role === 'pressure') return Game.player.y + Game.player.height / 2 > this.y + this.height
            const radarRange = range ?? (this.role === 'controller'
                ? Game.view.width
                : this.role === 'marksman'
                    ? this.profile.specialistDetectionRange
                    : this.profile.tracking
                        ? this.profile.specialistDetectionRange
                        : this.profile.detectionRange)
            return Game.rules.targetInFiringLane(
                { x: this.x + this.width / 2, y: this.y + this.height }, Game.player, radarRange)
        }
        return Enemy
    }
}(globalThis.ShootingGame))
