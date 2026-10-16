(function (app) {
    app.createMovement = function (Game) {
        const config = Game.config.motion
        const separation = Game.config.progression.enemySeparation
        const sample = (enemy, time) => Game.rules.enemyMotion(enemy.pattern, time, enemy.index, enemy.minY, enemy.maxY, config)
        return {
            releaseIncursion: function (enemy) {
                if (!enemy || this.incursion?.owner === enemy) this.incursion = null
            },

            resetEnemyMotion: function (enemy) {
                this.releaseIncursion(enemy)
                enemy.motionTime = 0
                enemy.blockedTime = 0
                const start = sample(enemy, 0)
                enemy.entryY = start.y
                enemy.homeY = start.home === undefined ? start.y : start.home
                enemy.motionOriginY = enemy.entering ? start.y : Math.max(enemy.minY, Math.min(enemy.maxY, enemy.y))
                if (enemy.entering) {
                    enemy.entryElapsed = 0
                    enemy.entryStartX = enemy.x
                    enemy.entryStartY = enemy.y
                    enemy.entryTargetX = enemy.x
                    if (!enemy.entryPathBounds) {
                        enemy.entryPathBounds = {
                            x: enemy.x,
                            y: Math.min(enemy.y, enemy.entryY),
                            width: enemy.width,
                            height: Math.abs(enemy.entryY - enemy.y) + enemy.height
                        }
                    }
                }
            },

            reserveIncursion: function (enemy) {
                if (this.incursion) return this.incursion.owner === enemy
                const path = { x: enemy.x, y: enemy.minY, width: enemy.width,
                    height: enemy.maxY - enemy.minY + enemy.height }
                if (Object.values(this.enemies).some(other => other !== enemy && !other.dead
                    && Game.rules.formation.overlaps(path, other, separation))) return false
                this.incursion = { owner: enemy, path }
                return true
            },

            moveEnemy: function (enemy, dt) {
                const previousSample = sample(enemy, enemy.motionTime)
                let nextTime = enemy.motionTime + dt
                let nextSample = sample(enemy, nextTime)
                if (enemy.pattern === 'diver') {
                    if (previousSample.diving && !nextSample.diving) this.releaseIncursion(enemy)
                    if (nextSample.diving && !this.reserveIncursion(enemy)) {
                        // Patrol above the formation until the entire descent is clear.
                        nextTime = enemy.motionTime
                        nextSample = previousSample
                    }
                }
                const direction = enemy.movingLeft ? -1 : 1
                let x = enemy.x
                if (this.incursion?.owner !== enemy) {
                    const lateralScale = enemy.pattern === 'zigzag' ? 1.08
                        : enemy.pattern === 'sine' ? 0.88
                            : enemy.pattern === 'diver' && nextSample.diving ? 0.7 : 1
                    x += direction * enemy.speed * lateralScale * dt * 60
                    if (x < 0 || x > this.view.width - enemy.width) {
                        enemy.movingLeft = !enemy.movingLeft
                        x = Math.max(0, Math.min(this.view.width - enemy.width, x))
                    }
                }
                const blend = Math.min(1, nextTime / config.transitionTime)
                const y = enemy.motionOriginY * (1 - blend) + nextSample.y * blend
                if (this.canMoveEnemy(enemy, x, y)) {
                    enemy.x = x
                    enemy.y = y
                    enemy.motionTime = nextTime
                    enemy.blockedTime = 0
                } else {
                    // Seek a clear lane laterally while holding the curve at its
                    // current phase. Once free, resume without skipping its bend.
                    if (x !== enemy.x && this.canMoveEnemy(enemy, x, enemy.y)) {
                        enemy.x = x
                        enemy.blockedTime = 0
                    } else {
                        enemy.blockedTime += dt
                        if (enemy.blockedTime >= config.blockedTurnDelay && this.incursion?.owner !== enemy) {
                            enemy.movingLeft = !enemy.movingLeft
                            enemy.blockedTime = 0
                        }
                    }
                }
            }
        }
    }
}(globalThis.ShootingGame))
