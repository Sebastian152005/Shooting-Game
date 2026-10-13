(function (app) {
    app.createSpawning = function (Game) {
        const config = Game.config.progression
        const formation = Game.rules.formation
        return {
            enemyBounds: function (aggressive = false, level = this.difficulty) {
                const top = config.enemyTopMargin
                const height = Game.config.enemySize.height
                const playerY = this.player ? this.player.y : this.view.height - 70
                const depth = aggressive ? config.incursionEnemyDepth
                    : level === 1 ? config.initialEnemyDepth : config.normalEnemyDepth
                // Bound the whole ship, not just its origin. Crowding must not
                // push the introductory formation into the middle of the screen.
                const bottomY = Math.max(top, Math.min(playerY - config.enemyPlayerClearance,
                    this.view.height * depth - height))
                return { left: 0, right: this.view.width, top, bottom: bottomY + height }
            },

            canMoveEnemy: function (actor, x, y) {
                const proposed = { x, y, width: actor.width, height: actor.height }
                if (this.incursion && this.incursion.owner !== actor
                    && formation.overlaps(proposed, this.incursion.path, config.enemySeparation)) return false
                return !Object.values(this.enemies).some(other => other !== actor && !other.dead
                    && formation.overlaps(proposed, other, config.enemySeparation))
            },

            refreshEnemyCount: function () {
                this.enemiesAlive = Object.keys(this.enemies).length + this.pendingSpawns.length
            },

            scheduleEnemy: function (delay) {
                this.refreshEnemyCount()
                if (!['intro', 'wave'].includes(this.waveStage) || this.isGameOver || this.enemiesAlive >= this.maxEnemies) return false
                this.pendingSpawns.push(delay / 1000)
                this.refreshEnemyCount()
                return true
            },

            fillEnemySlots: function (delay = 0.5) {
                this.refreshEnemyCount()
                const slots = this.maxEnemies - this.enemiesAlive
                for (let i = 0; i < slots; i++) this.scheduleEnemy((delay + i * config.spawnSpacing) * 1000)
            },

            updateSpawns: function (dt) {
                if (this.paused || this.isGameOver) return
                if (this.bossActive) {
                    this.pendingSpawns = []
                    this.refreshEnemyCount()
                    return
                }
                this.spawnCooldown = Math.max(0, this.spawnCooldown - dt)
                this.pendingSpawns = this.pendingSpawns.map(delay => Math.max(0, delay - dt))
                if (this.waveStage !== 'wave' || this.spawnCooldown > 0) return
                const index = this.pendingSpawns.findIndex(delay => delay === 0)
                if (index < 0) return
                const size = Game.config.enemySize
                const y = -size.height - config.enemySeparation
                const position = formation.findPosition(size,
                    { left: 0, right: this.view.width, top: y, bottom: y + size.height },
                    Object.values(this.enemies), { x: this.random(0, this.view.width - size.width), y }, config.enemySeparation)
                // Keep the reservation if the entrance is occupied; never force a stack.
                if (!position) return
                this.pendingSpawns.splice(index, 1)
                new this.entities.Enemy(position)
                this.spawnCooldown = config.spawnSpacing
                this.refreshEnemyCount()
            },

            separateEnemiesAfterResize: function () {
                const placed = []
                for (const enemy of Object.values(this.enemies)) {
                    let position = null
                    if (!enemy.entering) {
                        position = formation.findPosition(enemy, this.enemyBounds(enemy.pattern === 'diver', enemy.profile.level), placed, enemy, config.enemySeparation)
                    }
                    if (!position) {
                        enemy.entering = true
                        let y = -enemy.height - config.enemySeparation
                        do {
                            position = formation.findPosition(enemy,
                                { left: 0, right: this.view.width, top: y, bottom: y + enemy.height },
                                placed, { x: enemy.x, y }, config.enemySeparation)
                            y -= enemy.height + config.enemySeparation
                        } while (!position)
                    }
                    const displaced = enemy.x !== position.x || enemy.y !== position.y
                    enemy.x = position.x
                    enemy.y = position.y
                    if (enemy.pendingAttack && displaced) {
                        this.releaseFan(enemy)
                        enemy.pendingAttack = null
                        enemy.shootTimer = 0
                        this.enemyAttackCooldown = config.enemyAttackGap
                    }
                    placed.push(enemy)
                    this.resetEnemyMotion(enemy)
                }
            }
        }
    }
}(globalThis.ShootingGame))
