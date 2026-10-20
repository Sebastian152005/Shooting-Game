(function (app) {
    app.createSpawning = function (Game) {
        const config = Game.config.progression
        const formation = Game.rules.formation
        const stages = Game.rules.WAVE_STAGES
        const entryPath = (landing, size, occupied, allowedKinds, lateralSide, routeSway) => {
            const margin = config.enemySeparation
            const sway = Math.max(0, Number(routeSway) || 0)
            const lateralEntryActive = occupied.some(other => other.entering && other.entryKind === 'side')
            const routes = [
                {
                    kind: 'top', start: { x: landing.x, y: -size.height - margin }, seed: 0, sway,
                    path: {
                        x: landing.x, y: -size.height - margin,
                        width: size.width + sway,
                        height: landing.y + size.height * 2 + margin
                    }
                },
                {
                    kind: 'top', start: { x: landing.x, y: -size.height - margin }, seed: 1, sway,
                    path: {
                        x: landing.x - sway, y: -size.height - margin,
                        width: size.width + sway,
                        height: landing.y + size.height * 2 + margin
                    }
                },
                {
                    kind: 'top', start: { x: landing.x, y: -size.height - margin }, seed: 0, sway: 0,
                    path: {
                        x: landing.x, y: -size.height - margin,
                        width: size.width,
                        height: landing.y + size.height * 2 + margin
                    }
                },
                {
                    kind: 'side', side: 'left', start: { x: -size.width - margin, y: landing.y }, seed: 0, sway,
                    path: {
                        x: -size.width - margin, y: landing.y,
                        width: landing.x + size.width * 2 + margin + sway,
                        height: size.height
                    }
                },
                {
                    kind: 'side', side: 'right', start: { x: Game.view.width + margin, y: landing.y }, seed: 1, sway,
                    path: {
                        x: landing.x - sway,
                        y: landing.y,
                        width: Game.view.width - landing.x + size.width + margin + sway,
                        height: size.height
                    }
                }
            ]
            const availableRoutes = routes.filter(route => allowedKinds.includes(route.kind)
                && (route.kind !== 'side' || !lateralSide || route.side === lateralSide))
            return formation.findEntryRoute(availableRoutes, occupied, margin, lateralEntryActive)
        }
        return {
            enemyBounds: function (aggressive = false, level = this.difficulty) {
                const top = config.enemyTopMargin
                const height = Game.config.enemySize.height
                const playerY = this.player ? this.player.y : this.view.height - 70
                const depth = aggressive ? Math.min(config.maximumIncursionDepth,
                    config.incursionEnemyDepth + Math.max(0, level - 2) * config.incursionDepthPerLevel)
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
                return !Object.values(this.enemies).some(other => {
                    if (other === actor || other.dead) return false
                    if (formation.overlaps(proposed, other, config.enemySeparation)) return true
                    if (!actor.entering && other.entering && other.entryPathBounds
                        && formation.overlaps(proposed, other.entryPathBounds, config.enemySeparation)) return true
                    // An arriving UFO owns its landing slot before it becomes
                    // visible. Patrols cannot drift into that reserved lane.
                    const landing = !actor.entering && other.entering && Number.isFinite(other.entryTargetX)
                        && Number.isFinite(other.entryY)
                        ? { x: other.entryTargetX, y: other.entryY, width: other.width, height: other.height }
                        : null
                    return landing ? formation.overlaps(proposed, landing, config.enemySeparation) : false
                })
            },

            enemyLandingReservations: function () {
                return Object.values(this.enemies).filter(enemy => !enemy.dead).map(enemy => {
                    if (!enemy.entering || !Number.isFinite(enemy.entryTargetX) || !Number.isFinite(enemy.entryY)) return enemy
                    return { x: enemy.entryTargetX, y: enemy.entryY, width: enemy.width, height: enemy.height }
                })
            },

            refreshEnemyCount: function () {
                this.enemiesAlive = Object.keys(this.enemies).length + this.pendingSpawns.length
            },

            scheduleEnemy: function (delay) {
                this.refreshEnemyCount()
                if (![stages.INTRO, stages.WAVE].includes(this.waveStage) || this.isGameOver || this.enemiesAlive >= this.maxEnemies) return false
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
                if (this.waveStage !== stages.WAVE || this.spawnCooldown > 0) return
                const index = this.pendingSpawns.findIndex(delay => delay === 0)
                if (index < 0) return
                const size = Game.config.enemySize
                const preferredRole = this.rules.variedEnemyRolePreference(
                    this.waveProfile, this.enemyIndex, this.bossCount)
                const activeRoles = Object.values(this.enemies)
                    .filter(enemy => !enemy.dead)
                    .map(enemy => enemy.role)
                const entryRole = this.rules.canAssignEnemyRole(preferredRole, activeRoles,
                    this.maxEnemies, config.maxSpecialistsPerRole, config.minimumCommonEnemies)
                    ? preferredRole : 'pressure'
                const allowedEntryKinds = this.rules.enemyEntryKindsForRole(this.waveProfile, entryRole)
                const lateralSide = entryRole === 'aggressor' ? this.nextLateralEntrySide : null
                const signature = this.rules.enemyArchetypeSignature(entryRole)
                const routeSway = Game.config.motion.entrySway * signature.entrySwayScale
                // Preserve the proven formation geometry even when the visible
                // archetype order is shuffled. Role variety must never consume
                // or deadlock a landing slot.
                const placementRole = this.rules.enemyRolePreference(this.waveProfile, this.enemyIndex)
                const pattern = this.waveProfile.patterns[this.enemyIndex % this.waveProfile.patterns.length]
                const bounds = this.enemyBounds(['aggressor', 'marksman'].includes(placementRole) || pattern === 'diver', this.waveProfile.level)
                const lateralTravel = Math.min((bounds.right - bounds.left - size.width) / 2,
                    Math.max(size.width + config.enemySeparation,
                        this.view.width * Game.config.motion.lateralEntryDepthRatio))
                const sideLandingX = lateralSide === 'left'
                    ? bounds.left + lateralTravel
                    : bounds.right - size.width - lateralTravel
                const preferred = {
                    x: entryRole === 'aggressor'
                        ? sideLandingX
                        : this.random(0, Math.max(1, this.view.width - size.width)),
                    y: this.random(bounds.top, Math.max(bounds.top + 1, bounds.bottom - size.height + 1))
                }
                const occupied = Object.values(this.enemies).filter(enemy => !enemy.dead)
                const reservations = this.enemyLandingReservations()
                let route = null
                const landing = formation.findPosition(size, bounds, reservations, preferred,
                    config.enemySeparation, candidate => {
                        route = entryPath(candidate, size, occupied, allowedEntryKinds, lateralSide, routeSway)
                        return route !== null
                    })
                // Keep the reservation until a complete landing slot exists.
                // This prevents two ships from descending into the same place
                // and leaving the later one visibly suspended at the top.
                if (!landing) return
                route = entryPath(landing, size, occupied, allowedEntryKinds, lateralSide, routeSway)
                if (!route) return
                const entrance = { x: route.start.x, y: route.start.y, width: size.width, height: size.height }
                const entranceOccupied = Object.values(this.enemies).some(enemy => enemy.entering && !enemy.dead
                    && formation.overlaps(entrance, enemy, config.enemySeparation))
                // Vertically separated landing slots may share a column, but
                // their ships must still enter that column one after another.
                if (entranceOccupied) return
                this.pendingSpawns.splice(index, 1)
                new this.entities.Enemy({
                    x: route.start.x,
                    y: route.start.y,
                    targetX: landing.x,
                    targetY: landing.y,
                    entryMotionSeed: route.seed,
                    entrySway: route.sway,
                    entryKind: route.kind,
                    entryPathBounds: route.path,
                    roleHint: entryRole
                })
                if (route.kind === 'side') {
                    this.nextLateralEntrySide = route.side === 'left' ? 'right' : 'left'
                }
                this.spawnCooldown = config.spawnSpacing
                this.refreshEnemyCount()
            },

            separateEnemiesAfterResize: function () {
                const placed = []
                for (const enemy of Object.values(this.enemies)) {
                    let position = null
                    if (!enemy.entering) {
                        position = formation.findPosition(enemy,
                            this.enemyBounds(enemy.pattern === 'diver' || enemy.isAggressor || enemy.isMarksman,
                                enemy.profile.level), placed, enemy, config.enemySeparation)
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
                    if (enemy.entering) {
                        enemy.entryPathBounds = null
                        enemy.entrySway = 0
                        enemy.entryKind = 'top'
                    }
                    if (enemy.pendingAttack && displaced) {
                        this.releaseFan(enemy)
                        enemy.pendingAttack = null
                        enemy.shootTimer = 0
                        enemy.setAIState(this.rules.ENEMY_AI_STATES.RECOVERY)
                        this.enemyAttackCooldown = config.enemyAttackGap
                    }
                    placed.push(enemy)
                    this.resetEnemyMotion(enemy)
                }
            }
        }
    }
}(globalThis.ShootingGame))
