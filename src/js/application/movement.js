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
                enemy.trafficRemaining = 0
                enemy.trafficDirection = 0
                enemy.trafficVerticalDirection = 0
                enemy.trafficYielding = false
                enemy.trafficLaneOffset = 0
                enemy.trafficLaneTarget = 0
                const start = sample(enemy, 0)
                enemy.entryY = start.y
                enemy.homeY = start.home === undefined ? start.y : start.home
                enemy.motionOriginY = enemy.entering ? start.y : Math.max(enemy.minY, Math.min(enemy.maxY, enemy.y))
                if (enemy.entering) {
                    enemy.entryDuration = Game.rules.enemyEntryDuration(
                        enemy.entryKind, enemy.index, config.entryDuration,
                        config.lateralFastEntryMultiplier, config.lateralSmoothEntryMultiplier)
                        * (enemy.archetype?.entryDurationScale || 1)
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
                enemy.trafficRemaining = Math.max(0, (enemy.trafficRemaining || 0) - dt)
                if (enemy.trafficRemaining === 0) {
                    enemy.trafficLaneTarget = 0
                    enemy.trafficYielding = false
                }
                const laneResponse = 1 - Math.exp(-config.trafficLaneResponse * dt)
                enemy.trafficLaneOffset += ((enemy.trafficLaneTarget || 0)
                    - (enemy.trafficLaneOffset || 0)) * laneResponse
                if (enemy.trafficRemaining === 0 && enemy.intent) enemy.movingLeft = enemy.intent.movingLeft
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
                const direction = enemy.trafficRemaining > 0 && enemy.trafficDirection
                    ? enemy.trafficDirection : enemy.movingLeft ? -1 : 1
                let x = enemy.x
                if (this.incursion?.owner !== enemy) {
                    const lateralScale = enemy.pattern === 'zigzag' ? 1.08
                        : enemy.pattern === 'sine' ? 0.88
                            : enemy.pattern === 'diver' && nextSample.diving ? 0.7 : 1
                    const tacticalScale = Math.max(1, enemy.intent?.movementMultiplier || 1)
                    const archetypeScale = enemy.archetype?.movementScale || 1
                    x += direction * enemy.speed * lateralScale * tacticalScale
                        * archetypeScale * dt * 60
                    if (x < 0 || x > this.view.width - enemy.width) {
                        enemy.movingLeft = !enemy.movingLeft
                        x = Math.max(0, Math.min(this.view.width - enemy.width, x))
                    }
                }
                const blend = Math.min(1, nextTime / config.transitionTime)
                const baseY = enemy.motionOriginY * (1 - blend) + nextSample.y * blend
                const y = Math.max(enemy.minY, Math.min(enemy.maxY,
                    baseY + (enemy.trafficLaneOffset || 0)))
                if (this.canMoveEnemy(enemy, x, y)) {
                    enemy.x = x
                    enemy.y = y
                    enemy.motionTime = nextTime
                    enemy.blockedTime = 0
                } else {
                    const blocker = Object.values(this.enemies).find(other => other !== enemy && !other.dead
                        && Game.rules.formation.overlaps(
                            { x, y, width: enemy.width, height: enemy.height }, other, separation))
                    if (blocker) {
                        let yielding = enemy.trafficRemaining > 0 && enemy.trafficYielding
                        if (enemy.trafficRemaining === 0) {
                            const plan = Game.rules.enemyTrafficPlan({
                                actorIndex: enemy.index,
                                blockerIndex: blocker.index,
                                actorX: enemy.x,
                                actorCenter: enemy.x + enemy.width / 2,
                                blockerCenter: blocker.x + blocker.width / 2,
                                maximumX: this.view.width - enemy.width,
                                clearance: enemy.width + separation
                            })
                            const deadlockLimit = config.trafficDeadlockDuration
                                + (enemy.index % 3) * config.trafficDeadlockStagger
                            yielding = plan.yields || enemy.blockedTime >= deadlockLimit
                            if (yielding) {
                                enemy.trafficRemaining = config.trafficCommitDuration
                                enemy.trafficDirection = plan.horizontalDirection
                                enemy.trafficVerticalDirection = plan.verticalDirection
                                enemy.trafficYielding = true
                                enemy.movingLeft = plan.horizontalDirection < 0
                                enemy.blockedTime = 0
                            }
                        }
                        if (yielding) {
                            const avoidanceX = Math.max(0, Math.min(this.view.width - enemy.width,
                                enemy.x + enemy.trafficDirection * enemy.speed * dt * 60))
                            if (avoidanceX !== enemy.x && this.canMoveEnemy(enemy, avoidanceX, enemy.y)) {
                                enemy.x = avoidanceX
                                enemy.blockedTime = 0
                                return
                            }
                            const laneDistance = Math.min(enemy.height + separation,
                                Math.max(0, enemy.maxY - enemy.minY) * config.trafficLaneOffsetRatio)
                            for (const verticalDirection of [enemy.trafficVerticalDirection,
                                -enemy.trafficVerticalDirection]) {
                                const targetOffset = verticalDirection * laneDistance
                                const avoidanceY = Math.max(enemy.minY, Math.min(enemy.maxY,
                                    enemy.y + verticalDirection * enemy.speed * dt * 42))
                                if (avoidanceY !== enemy.y && this.canMoveEnemy(enemy, enemy.x, avoidanceY)) {
                                    enemy.trafficLaneTarget = targetOffset
                                    enemy.trafficLaneOffset = avoidanceY - baseY
                                    enemy.y = avoidanceY
                                    enemy.blockedTime = 0
                                    return
                                }
                            }
                        }
                    }
                    // Seek a clear lane laterally while holding the curve at its
                    // current phase. Once free, resume without skipping its bend.
                    if (x !== enemy.x && this.canMoveEnemy(enemy, x, enemy.y)) {
                        enemy.x = x
                        enemy.blockedTime = 0
                    } else {
                        enemy.blockedTime += dt
                        if (!blocker && enemy.blockedTime >= config.blockedTurnDelay
                            && this.incursion?.owner !== enemy) {
                            enemy.movingLeft = !enemy.movingLeft
                            enemy.trafficDirection = enemy.movingLeft ? -1 : 1
                            enemy.trafficRemaining = config.trafficCommitDuration
                            enemy.trafficYielding = false
                            enemy.blockedTime = 0
                        }
                    }
                }
            }
        }
    }
}(globalThis.ShootingGame))
