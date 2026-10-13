(function (app) {
    app.entityFactories.Enemy = function (Game) {
        const Enemy = function (position) {
            this.width  = Game.config.enemySize.width
            this.height = Game.config.enemySize.height
            this.x = position ? position.x : Game.random(0, Game.view.width - this.width)
            this.entering = true
            this.y = position ? position.y : -this.height - Game.config.progression.enemySeparation
            this.dead   = false
            this.index  = Game.enemyIndex
            Game.enemies[Game.enemyIndex] = this
            Game.enemyIndex++
            this.movingLeft = Game.randomFloat() < 0.5
            this.salvo = 0
            this.pendingAttack = null
            this.attackTurn = 0
            this.configure(Game.waveProfile)
            this.shootTimer = Game.random(0, Math.floor(this.shootInterval * 60)) / 60
            Game.refreshEnemyCount()
        }

        Enemy.prototype.configure = function (profile) {
            if (this.pendingAttack) {
                if (this.pendingAttack.kind === 'fan') Game.releaseFan(this)
                this.pendingAttack = null
                this.shootTimer = 0
                Game.enemyAttackCooldown = Game.config.progression.enemyAttackGap
            }
            this.profile = profile
            this.pattern = profile.patterns[this.index % profile.patterns.length]
            const preferred = profile.aimed && this.pattern === 'diver' ? 'hunter'
                : profile.spread && this.index % 2 === 0 ? 'controller' : 'pressure'
            const specialists = Object.values(Game.enemies).filter(enemy => enemy !== this && !enemy.dead && enemy.role === preferred).length
            this.role = preferred !== 'pressure' && specialists >= Game.config.progression.maxSpecialistsPerRole ? 'pressure' : preferred
            this.aggressive = this.role === 'hunter'
            this.speed = profile.enemySpeed + (this.aggressive ? 0.4 : 0)
            this.bulletSpeed = profile.bulletSpeed + (this.aggressive ? 0.4 : 0)
            // Specialists have exclusive attacks and leave time to react between charges.
            this.shootInterval = Math.max(1.2, profile.shootInterval + (this.role === 'controller' ? 1 : this.aggressive ? 0.25 : 0))
            this.minY = Game.config.progression.enemyTopMargin
            this.maxY = Game.enemyBounds(this.pattern === 'diver', profile.level).bottom - this.height
            Game.resetEnemyMotion(this)
            this.shootTimer = Math.min(this.shootTimer || 0, this.shootInterval)
            this.sprite = profile.level >= 3 || this.aggressive ? 'enemy' : 'scout'
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
                const nextY = Math.min(this.entryY, this.y + Game.dt * 240)
                if (Game.canMoveEnemy(this, this.x, nextY)) this.y = nextY
                if (this.y >= this.entryY) this.entering = false
                Game.resolvePlayerBulletHits(this)
                return
            }
            const charging = Boolean(this.pendingAttack)
            if (!charging) {
                Game.moveEnemy(this, Game.dt)

                this.shootTimer = Math.min(this.shootInterval, this.shootTimer + Game.dt)
                if (this.shootTimer >= this.shootInterval && this.shoot()) this.shootTimer = 0
            }

            Game.resolvePlayerBulletHits(this)
            // Hits resolve before a charged shot: destroying the attacker cancels it.
            if (!this.dead && charging && this.pendingAttack) {
                this.pendingAttack.remaining = Math.max(0, this.pendingAttack.remaining - Game.dt)
                if (this.pendingAttack.remaining === 0) {
                    const attack = this.pendingAttack
                    this.pendingAttack = null
                    const fan = attack.kind === 'fan'
                    const bullets = Game.fireEnemyVolley(attack.x, attack.y, this.bulletSpeed,
                        fan ? 'lime' : 'tomato', fan ? attack.angles : [attack.angle], fan ? this : null)
                    if (fan) {
                        if (bullets.length) Game.markFanFired(this)
                        else Game.releaseFan(this)
                    }
                    if (attack.kind === 'tracking' && bullets.length) {
                        bullets[0].homing = true
                        bullets[0].homingFor = 0.8
                        bullets[0].isTracking = true
                    }
                    Game.enemyAttackCooldown = Game.config.progression.enemyAttackGap
                    this.shootTimer = 0
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
            if (Game.waveStage === 'wave') Game.scheduleEnemy(2000)
        }

        Enemy.prototype.explode = function () {
            for (let i = 0; i < Game.maxParticles; i++) {
                new Game.entities.Particle(this.x + this.width / 2, this.y)
            }
        }

        Enemy.prototype.shoot = function () {
            if (Game.bossActive || Game.paused || Game.isGameOver || this.dead || this.entering || this.pendingAttack || Game.enemies[this.index] !== this) return false
            const color = this.aggressive ? 'tomato' : 'lime'
            const x = this.x + this.width / 2
            const y = this.y + this.height
            const salvo = this.salvo + 1
            if (this.role === 'hunter') {
                if (!Game.canPrepareEnemyAttack(this)) return false
                const targetX = Game.player.x + Game.player.width / 2
                const targetY = Game.player.y + Game.player.height / 2
                this.pendingAttack = {
                    x, y, targetX, targetY,
                    angle: Math.atan2(targetX - x, targetY - y),
                    kind: this.profile.homing && salvo % 3 === 0 ? 'tracking' : 'aimed',
                    remaining: Game.config.progression.enemyWarning
                }
                this.salvo = salvo
                return true
            }
            if (this.role === 'controller') {
                if (!Game.canPrepareEnemyAttack(this)) return false
                const fan = Game.reserveFan(this, x, y, this.bulletSpeed, 2,
                    Game.config.progression.fanWarning, salvo)
                if (!fan) return false
                this.pendingAttack = { x, y, angles: fan.angles, kind: 'fan', remaining: Game.config.progression.fanWarning }
                this.salvo = salvo
                return true
            }
            const bullets = Game.fireEnemyVolley(x, y, this.bulletSpeed, color, [0])
            if (!bullets.length) return false
            this.salvo = salvo
            return true
        }
        return Enemy
    }
}(globalThis.ShootingGame))
