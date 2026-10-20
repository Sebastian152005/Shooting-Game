(function (app) {
    app.entityFactories.Boss = function (Game) {
        const config = Game.config.progression
        const Boss = function () {
            const d  = Game.difficulty
            Game.beginBossEncounter()
            this.width    = 180
            this.height   = 110
            this.x        = Game.view.width / 2 - this.width / 2
            this.y        = -this.height
            this.entering = true
            this.dead     = false
            this.hp       = Game.rules.bossHealth(d, Game.bossCount, Game.config)
            this.maxHp    = this.hp
            this.speed    = Math.min(3.5, 1.8 + d * 0.08)
            this.bulletSpeed   = Math.min(config.maxBulletSpeed, 3.2 + d * 0.12)
            this.shootInterval = Math.max(config.bossMinimumShootInterval + 0.4,
                config.bossShootInterval - d * 0.06)
            // The flagship enters ready to pressure, as in the more energetic
            // reference build, without firing during the entrance itself.
            this.shootTimer    = this.shootInterval * 0.72
            this.phase = 1
            this.attackStep = 0
            this.warningTime = 0
            this.warningAngles = []
            this.warningFan = null
            this.warningPattern = null
            this.visualTime = 0
            this.damageFlash = 0
            this.entryElapsed = 0
            this.entryStartY = -this.height
            this.movementStep = 0
            this.movementTargetX = this.x
            this.movementRetarget = 0
            this.horizontalVelocity = 0
            this.movingLeft    = Game.randomFloat() < 0.5
            this.sprite        = 'enemy'
            Game.bossActive    = true
            Game.boss          = this
        }

        Boss.prototype.draw = function () {
            Game.drawEntity(this, 'Boss')
        }

        Boss.prototype.update = function () {
            if (this.dead || Game.paused || Game.isGameOver || Game.boss !== this) return
            this.visualTime += Game.dt
            this.damageFlash = Math.max(0, this.damageFlash - Game.dt)
            if (this.entering) {
                if (this.entryElapsed === 0) this.entryStartY = this.y
                this.entryElapsed = Math.min(config.bossEntryDuration, this.entryElapsed + Game.dt)
                const progress = this.entryElapsed / config.bossEntryDuration
                const eased = progress * progress * (3 - 2 * progress)
                this.y = this.entryStartY + (config.bossTopMargin - this.entryStartY) * eased
                if (progress === 1) {
                    this.entering = false
                    this.chooseMovementTarget()
                }
                Game.resolvePlayerBulletHits(this)
                return
            }

            if (this.warningTime > 0) this.horizontalVelocity = 0
            else this.updateMovement(Game.dt)

            this.updatePhase()
            if (this.warningTime > 0) {
                this.warningTime = Math.max(0, this.warningTime - Game.dt)
                if (this.warningTime === 0) this.shoot()
            } else {
                this.shootTimer += Game.dt
                const interval = Math.max(config.bossMinimumShootInterval,
                    this.shootInterval - (this.phase - 1) * config.bossPhaseIntervalReduction)
                if (this.shootTimer >= interval && this.prepareAttack()) {
                    this.shootTimer = 0
                }
            }

            Game.resolvePlayerBulletHits(this)
        }

        Boss.prototype.chooseMovementTarget = function () {
            const plan = Game.rules.bossMovementPlan({
                phase: this.phase,
                step: this.movementStep++,
                playerX: Game.player.x + Game.player.width / 2,
                playerVelocity: Game.player.horizontalVelocity,
                viewportWidth: Game.view.width,
                bossWidth: this.width
            })
            this.movementTargetX = plan.targetX
            this.movementSpeedMultiplier = plan.speedMultiplier
            this.movementRetarget = config.bossRepositionInterval
        }

        Boss.prototype.updateMovement = function (dt) {
            this.movementRetarget = Math.max(0, this.movementRetarget - dt)
            const distance = this.movementTargetX - this.x
            if (this.movementRetarget === 0 && Math.abs(distance) <= config.bossMovementDeadzone) {
                this.chooseMovementTarget()
            }
            const remaining = this.movementTargetX - this.x
            const desiredVelocity = Math.abs(remaining) <= config.bossMovementDeadzone
                ? 0 : Math.sign(remaining) * this.speed * 60 * (this.movementSpeedMultiplier || 1)
            const velocityChange = Math.max(-config.bossAcceleration * dt,
                Math.min(config.bossAcceleration * dt, desiredVelocity - this.horizontalVelocity))
            this.horizontalVelocity += velocityChange
            let nextX = this.x + this.horizontalVelocity * dt
            if ((remaining > 0 && nextX > this.movementTargetX)
                || (remaining < 0 && nextX < this.movementTargetX)) {
                nextX = this.movementTargetX
                this.horizontalVelocity = 0
            }
            this.x = Math.max(0, Math.min(Game.view.width - this.width, nextX))
            this.movingLeft = this.horizontalVelocity < 0
        }

        Boss.prototype.canBeHit = function () {
            return !this.dead && !Game.paused && !Game.isGameOver && Game.boss === this
                && this.y + this.height > 0 && this.y < Game.view.height
        }

        Boss.prototype.receiveHit = function () {
            if (!this.canBeHit()) return false
            this.hp--
            this.damageFlash = 0.12
            if (this.hp <= 0) this.die()
            return true
        }

        Boss.prototype.updatePhase = function () {
            const ratio = this.hp / this.maxHp
            const phase = ratio > 0.65 ? 1 : ratio > 0.3 ? 2 : 3
            if (phase === this.phase) return
            this.phase = phase
            this.shootTimer = 0
            this.movementRetarget = 0
            this.movementTargetX = this.x
            // An announced attack remains committed when damage changes phase.
            // Cancelling here made the boss appear to lose its target and misfire.
        }

        Boss.prototype.prepareAttack = function () {
            if (this.warningTime > 0 || Game.safeCorridor || Game.paused || Game.isGameOver) return false
            const pattern = Game.rules.bossAttackPattern(this.phase, this.attackStep)
            const aimed = pattern === Game.rules.BOSS_ATTACK_PATTERNS.AIMED
                || pattern === Game.rules.BOSS_ATTACK_PATTERNS.CROSSFIRE
            const x = this.x + this.width / 2
            const y = this.y + this.height
            const prediction = aimed ? Game.rules.predictHorizontalIntercept({
                targetX: Game.player.x + Game.player.width / 2,
                targetVelocity: Game.player.horizontalVelocity,
                verticalDistance: Game.player.y + Game.player.height / 2 - y,
                projectileSpeed: this.bulletSpeed,
                minimumLead: config.bossMinimumLead,
                maximumLead: config.bossMaximumLead,
                minimumX: Game.player.width / 2,
                maximumX: Game.view.width - Game.player.width / 2
            }) : null
            const aim = prediction ? Math.max(-0.55, Math.min(0.55,
                Math.atan2(prediction.x - x, Game.player.y + Game.player.height / 2 - y))) : 0
            if (pattern === Game.rules.BOSS_ATTACK_PATTERNS.FAN) {
                this.warningFan = Game.reserveFan(this, x, y, this.bulletSpeed,
                    this.phase === 3 ? 3 : 2, Game.config.progression.bossWarning, this.attackStep)
                if (!this.warningFan) return false
                this.warningAngles = this.warningFan.angles
            } else {
                this.warningAngles = Game.rules.bossAttackAngles(pattern, aim, this.phase)
            }
            this.warningPattern = pattern
            // Lock the origin while telegraphing so the announced lanes stay accurate.
            this.attackX = x
            this.attackY = y
            this.attackStep++
            if (!Game.rules.bossAttackRequiresWarning(pattern)) {
                this.warningTime = 0
                this.shoot()
                return true
            }
            this.horizontalVelocity = 0
            this.warningTime = Game.config.progression.bossWarning
            return true
        }

        Boss.prototype.shoot = function () {
            const attackType = 'boss-' + (this.warningPattern || 'classic')
            const bullets = Game.fireEnemyVolley(this.attackX, this.attackY, this.bulletSpeed,
                '#FF3300', this.warningAngles, this.warningFan ? this : null, attackType)
            if (this.warningFan) {
                if (bullets.length) Game.markFanFired(this)
                else Game.releaseFan(this)
            }
            this.warningFan = null
            this.warningAngles = []
            this.warningPattern = null
        }

        Boss.prototype.die = function () {
            if (this.dead) return
            this.dead       = true
            Game.boss       = null
            Game.bossActive = false

            for (let i = 0; i < 20; i++) {
                new Game.entities.Particle(this.x + Game.random(0, this.width), this.y + Game.random(0, this.height))
            }

            const points  = 300 + (Game.difficulty - 1) * 25
            Game.score   += points
            Game.combo   += 3
            Game.comboTimer = 3

            new Game.entities.FloatingText(this.x + this.width / 2, this.y + this.height / 2, "BOSS +" + points, '#FFD700')

            Game.playExplosion()

            Game.endBossEncounter()
        }
        return Boss
    }
}(globalThis.ShootingGame))
