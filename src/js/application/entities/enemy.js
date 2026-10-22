(function (app) {
    app.entityFactories.Enemy = function (Game) {
        const Enemy = function (position) {
            this.width  = Game.config.enemySize.width
            this.height = Game.config.enemySize.height
            this.x = position ? position.x : Game.random(0, Game.view.width - this.width)
            this.entryMotionSeed = position?.entryMotionSeed
            this.entrySway = position?.entrySway
            this.entryKind = position?.entryKind || 'top'
            this.entryPathBounds = position?.entryPathBounds || null
            this.roleHint = position?.roleHint || null
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
            this.trafficRemaining = 0
            this.trafficDirection = 0
            this.trafficVerticalDirection = 0
            this.trafficYielding = false
            this.trafficLaneOffset = 0
            this.trafficLaneTarget = 0
            this.salvo = 0
            this.pendingAttack = null
            this.attackTurn = 0
            this.cadenceTrait = Game.rules.enemyCadenceTrait(
                this.index, Game.config.progression.cadenceVariation)
            this.movementTrait = Game.rules.enemyMovementTrait(
                this.index, Game.config.progression.movementVariation)
            this.ai = {
                state: Game.rules.ENEMY_AI_STATES.ENTERING,
                acquisitionRemaining: 0,
                lastKnownTarget: null,
                memoryRemaining: 0
            }
            this.intent = Object.freeze({ mode: 'patrol', desiredX: null, movingLeft: this.movingLeft })
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
            const preferred = this.roleHint || Game.rules.enemyRolePreference(profile, this.index)
            this.roleHint = null
            const activeRoles = Object.values(Game.enemies)
                .filter(enemy => enemy !== this && !enemy.dead)
                .map(enemy => enemy.role)
            const entryRequiresSpecialist = Game.rules.enemyEntryRequiresSpecialist(profile, this.entryKind)
            this.role = entryRequiresSpecialist || Game.rules.canAssignEnemyRole(preferred, activeRoles, Game.maxEnemies,
                Game.config.progression.maxSpecialistsPerRole,
                Game.config.progression.minimumCommonEnemies) ? preferred : 'pressure'
            this.archetype = Game.rules.enemyArchetypeSignature(this.role)
            this.isAggressor = this.role === 'aggressor'
            this.isMarksman = this.role === 'marksman'
            this.speed = (profile.enemySpeed + (this.isAggressor ? 0.4 : this.isMarksman ? 0.15 : 0))
                * this.movementTrait
            this.bulletSpeed = profile.bulletSpeed + (this.isAggressor ? 0.4 : this.isMarksman ? 0.25 : 0)
            // Specialists have exclusive attacks and leave time to react between charges.
            const baseShootInterval = this.role === 'controller'
                ? Math.max(1.2, profile.shootInterval + 1)
                : this.isAggressor ? Math.max(1, profile.shootInterval - 0.35)
                    : this.isMarksman ? Math.max(1.2, profile.shootInterval + 0.3)
                    : profile.shootInterval
            this.shootInterval = baseShootInterval * this.cadenceTrait
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
                const entryDuration = this.entryDuration || Game.config.motion.entryDuration
                const nextElapsed = Math.min(entryDuration, this.entryElapsed + Game.dt)
                const entry = Game.rules.enemyEntryMotion(
                    { x: this.entryStartX, y: this.entryStartY },
                    { x: this.entryTargetX, y: this.entryY },
                    nextElapsed, entryDuration, this.entryMotionSeed ?? this.index,
                    this.entrySway ?? Game.config.motion.entrySway, Game.view.width - this.width)
                if (Game.canMoveEnemy(this, entry.x, entry.y)) {
                    const horizontalChange = entry.x - this.x
                    this.entryVelocityX = Game.dt > 0 ? horizontalChange / (Game.dt * 60) : 0
                    this.entryVelocityY = Game.dt > 0 ? (entry.y - this.y) / (Game.dt * 60) : 0
                    this.x = entry.x
                    this.y = entry.y
                    this.entryElapsed = nextElapsed
                    const bankScale = this.archetype?.bankScale || 1
                    this.bank += (Math.max(-0.2, Math.min(0.2,
                        horizontalChange * 0.018 * bankScale)) - this.bank)
                        * Math.min(1, Game.dt * Game.config.motion.bankResponse)
                }
                if (entry.done && Math.abs(this.x - this.entryTargetX) <= 0.01
                    && Math.abs(this.y - this.entryY) <= 0.01) {
                    this.entering = false
                    this.entryKind = null
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
                const perceivedTarget = this.updatePerception(Game.dt)
                const intensity = Game.currentCombatIntensity()
                const fireInterval = this.role === 'pressure'
                    ? this.shootInterval * intensity.commonFireMultiplier
                    : this.shootInterval
                this.updateTacticalIntent(intensity, fireInterval)
                const previousX = this.x
                Game.moveEnemy(this, Game.dt)
                const horizontalChange = this.x - previousX
                const bankScale = this.archetype?.bankScale || 1
                const desiredBank = Math.max(-0.16, Math.min(0.16,
                    horizontalChange * 0.025 * bankScale))
                this.bank += (desiredBank - this.bank) * Math.min(1, Game.dt * Game.config.motion.bankResponse)

                this.shootTimer = Math.min(fireInterval, this.shootTimer + Game.dt)
                if (this.role === 'pressure') {
                    if (this.ai.state === Game.rules.ENEMY_AI_STATES.RECOVERY
                        && this.shootTimer >= fireInterval) this.setAIState(Game.rules.ENEMY_AI_STATES.PATROL)
                    if (this.shootTimer >= fireInterval && this.shoot()) this.shootTimer = 0
                } else {
                    this.updateAI(Game.dt, perceivedTarget)
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
            if (!knownTarget && !this.ai.lastKnownTarget && this.canAcquireTarget()) this.observeTarget()
            const rememberedTarget = knownTarget || this.ai.lastKnownTarget
            if (this.role === 'aggressor') {
                if (!rememberedTarget) return false
                // Before homing unlocks, memory predicts when the player will
                // cross the straight tomato laser instead of requiring a lane.
                if (!this.profile.tracking && !this.canFireStraightShot(rememberedTarget)) return false
                const kind = this.profile.tracking ? 'tracking' : 'aggressive'
                if (!Game.canPrepareEnemyAttack(this, kind)) return false
                const targetX = rememberedTarget.x
                const targetY = rememberedTarget.y
                this.pendingAttack = {
                    x, y, targetX, targetY, angle: 0,
                    kind,
                    remaining: Game.config.progression.enemyWarning
                }
                this.salvo = salvo
                this.setAIState(Game.rules.ENEMY_AI_STATES.WARNING)
                return true
            }
            if (this.role === 'controller') {
                // Controllers scan the whole visible combat area, but still require
                // the player to be below them before reserving a fan corridor.
                if (!rememberedTarget) return false
                if (!Game.canPrepareEnemyAttack(this, 'fan')) return false
                const fan = Game.reserveFan(this, x, y, this.bulletSpeed, 2,
                    Game.config.progression.fanWarning, salvo, rememberedTarget)
                if (!fan) return false
                this.pendingAttack = { x, y, angles: fan.angles, kind: 'fan', remaining: Game.config.progression.fanWarning }
                this.salvo = salvo
                this.setAIState(Game.rules.ENEMY_AI_STATES.WARNING)
                return true
            }
            if (this.role === 'marksman') {
                if (!rememberedTarget) return false
                if (!Game.canPrepareEnemyAttack(this, 'aimed')) return false
                const playerCenter = rememberedTarget.x
                const targetY = rememberedTarget.y
                const prediction = Game.rules.predictHorizontalIntercept({
                    targetX: playerCenter,
                    targetVelocity: rememberedTarget.horizontalVelocity,
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
            // Common UFOs provide the steady arcade rhythm: they fire a clear,
            // vertical laser on cooldown instead of silently waiting for a
            // predicted crossing. Prediction remains reserved for specialists,
            // where the warning makes the intent legible to the player.
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
        }

        Enemy.prototype.observeTarget = function () {
            this.ai.lastKnownTarget = Game.rules.rememberEnemyTarget(this.ai.lastKnownTarget, {
                x: Game.player.x + Game.player.width / 2,
                y: Game.player.y + Game.player.height / 2,
                horizontalVelocity: Game.player.horizontalVelocity
            })
            this.ai.memoryRemaining = Game.config.progression.targetMemoryDuration
        }

        Enemy.prototype.updateTacticalIntent = function (intensity, fireInterval) {
            const originX = this.x + this.width / 2
            const target = this.ai.lastKnownTarget
            this.intent = Game.rules.decideEnemyIntent({
                role: this.role,
                aiState: this.ai.state,
                directive: Game.rules.combatDirective(intensity),
                originX,
                targetX: target?.x,
                targetVelocity: target?.horizontalVelocity,
                tracking: this.profile.tracking,
                readiness: this.shootTimer / Math.max(0.001, fireInterval),
                readinessThreshold: Game.config.progression.commonSteeringReadiness,
                positioningReadiness: Game.config.progression.specialistPositioningReadiness,
                movingLeft: this.movingLeft,
                index: this.index,
                viewportWidth: Game.view.width,
                enemyWidth: this.width,
                deadzone: Game.config.progression.tacticalDeadzone,
                flankOffset: Game.config.progression.aggressorFlankOffset,
                marksmanOffset: Game.config.progression.marksmanPositionOffset,
                controllerOffset: Game.config.progression.controllerPositionOffset,
                controllerLead: Game.config.progression.controllerAimLead,
                pressMovementMultiplier: Game.config.progression.commonLaneSeekMultiplier
            })
        }

        Enemy.prototype.updatePerception = function (dt) {
            this.ai.memoryRemaining = Math.max(0, this.ai.memoryRemaining - dt)
            if (this.ai.memoryRemaining === 0) this.ai.lastKnownTarget = null
            const liveDetection = this.canAcquireTarget()
            if (liveDetection) this.observeTarget()
            return liveDetection || Boolean(this.ai.lastKnownTarget && this.ai.memoryRemaining > 0)
        }

        Enemy.prototype.updateAI = function (dt, perceivedTarget) {
            const next = Game.rules.advanceEnemyAI(this.ai, {
                entering: this.entering,
                ready: this.shootTimer >= this.shootInterval,
                detected: perceivedTarget,
                dt,
                acquisitionDuration: Game.config.progression.enemyAcquisitionTime
            })
            this.ai.state = next.state
            this.ai.acquisitionRemaining = next.acquisitionRemaining
            if (next.action === 'fire' && this.shoot(this.ai.lastKnownTarget)) this.shootTimer = 0
        }

        Enemy.prototype.canAcquireTarget = function (minimumConfidence) {
            if (this.dead || this.entering || Game.bossActive || Game.paused || Game.isGameOver
                || Game.enemies[this.index] !== this) return false
            const awareness = Game.rules.targetAwareness(
                { x: this.x + this.width / 2, y: this.y + this.height },
                Game.player, Game.view.width, Game.view.height)
            const threshold = minimumConfidence ?? (this.role === 'pressure'
                ? Game.config.progression.commonSensorConfidence
                : Game.config.progression.specialistSensorConfidence)
            return awareness.detected && awareness.confidence >= threshold
        }

        Enemy.prototype.canFireStraightShot = function (target) {
            if (!target || this.dead || this.entering) return false
            const originY = this.y + this.height
            const targetY = Number(target.y) || Game.player.y + Game.player.height / 2
            return Game.rules.straightShotOpportunity({
                originX: this.x + this.width / 2,
                targetX: target.x,
                targetVelocity: target.horizontalVelocity,
                stability: target.stability,
                observations: target.observations,
                verticalDistance: targetY - originY,
                projectileSpeed: this.bulletSpeed,
                targetWidth: Game.player.width,
                viewportWidth: Game.view.width,
                toleranceRatio: Game.config.progression.straightShotToleranceRatio,
                engagementRatio: Game.config.progression.straightShotEngagementRatio,
                maximumLead: Game.config.progression.straightShotMaximumLead
            }).canFire
        }
        return Enemy
    }
}(globalThis.ShootingGame))
