(function (app) {
    app.createAttacks = function (Game) {
        const config = Game.config.progression
        return {
            threatensCorridor: function (bullet, gap, duration) {
                if (bullet.y > gap.bottom || bullet.vy <= 0) return false
                if (bullet.homing && bullet.homingFor > 0) return true
                const start = Math.max(0, (gap.top - bullet.y - bullet.height) / (bullet.vy * 60))
                const end = Math.min(duration, (gap.bottom - bullet.y) / (bullet.vy * 60), 8 - (bullet.age || 0))
                if (end < start) return false
                const center = bullet.x + bullet.width / 2
                const first = center + bullet.vx * 60 * start
                const last = center + bullet.vx * 60 * end
                const radius = bullet.width / 2 + (bullet.wobbleAmp || 0) * 16 + 2
                return Math.max(first, last) + radius >= gap.center - gap.width / 2
                    && Math.min(first, last) - radius <= gap.center + gap.width / 2
            },

            reserveFan: function (owner, x, y, speed, pairs, warning, variation) {
                if (this.safeCorridor || this.paused || this.isGameOver) return null
                if (Object.values(this.enemies).some(enemy => enemy.pendingAttack)) return null
                const level = owner.profile?.level || this.difficulty
                const width = Math.max(this.player.width + config.fanGapPadding * 2,
                    config.fanGapWidth - Math.min(4, Math.max(0, level - 6)) * 5)
                const shift = level >= 10 ? config.fanShift : Math.min(75, config.fanShift)
                const offset = level >= 6 ? (variation % 3 - 1) * shift : 0
                const center = Math.max(width / 2 + 16, Math.min(this.view.width - width / 2 - 16,
                    this.player.x + this.player.width / 2 + offset))
                const gap = {
                    owner, center, width, fired: false,
                    top: this.player.y - 8,
                    bottom: this.view.height + 20
                }
                const upperContact = gap.top - config.maxBulletHeight
                if (upperContact <= y) return null
                const spacing = Math.max(40, Math.min(90, this.view.width * 0.1))
                const angles = []
                for (const side of [-1, 1]) {
                    for (let i = 0; i < pairs; i++) {
                        const target = center + side * (width / 2 + config.fanEdgeMargin + i * spacing)
                        // Use the limiting end of the player's entire vertical band.
                        // Both the nose and tail of the projectile must stay outside the gap.
                        const anchor = side < 0 ? (target > x ? gap.bottom : upperContact)
                            : (target < x ? gap.bottom : upperContact)
                        angles.push(Math.atan2(target - x, anchor - y))
                    }
                }
                if (Object.keys(this.enemyBullets).length + angles.length > config.maxEnemyBullets) return null
                const velocity = Math.min(speed, config.maxBulletSpeed)
                gap.flightTime = Math.min(8, Math.max(...angles.map(angle =>
                    (gap.bottom - y) / (Math.cos(angle) * velocity * 60))))
                gap.remaining = warning + gap.flightTime + 0.15
                gap.angles = angles
                const playerCenter = this.player.x + this.player.width / 2
                gap.approach = {
                    center: (playerCenter + center) / 2,
                    width: Math.abs(playerCenter - center) + this.player.width + config.fanGapPadding * 2,
                    top: gap.top, bottom: gap.bottom
                }
                gap.approachRemaining = warning
                if (Object.values(this.enemyBullets).some(bullet =>
                    this.threatensCorridor(bullet, gap, gap.remaining)
                    || this.threatensCorridor(bullet, gap.approach, warning))) return null
                this.safeCorridor = gap
                return gap
            },

            markFanFired: function (owner) {
                if (this.safeCorridor?.owner !== owner) return
                this.safeCorridor.fired = true
                this.safeCorridor.approachRemaining = 0
                this.safeCorridor.remaining = this.safeCorridor.flightTime + 0.15
            },

            releaseFan: function (owner) {
                if (this.safeCorridor?.owner === owner && !this.safeCorridor.fired) this.safeCorridor = null
            },

            cancelFanOnResize: function () {
                if (!this.safeCorridor) return
                this.safeCorridor = null
                this.enemyAttackCooldown = config.enemyAttackGap
                for (const enemy of Object.values(this.enemies)) {
                    if (enemy.pendingAttack?.kind === 'fan') {
                        enemy.pendingAttack = null
                        enemy.shootTimer = 0
                        enemy.setAIState(this.rules.ENEMY_AI_STATES.RECOVERY)
                    }
                }
                if (this.boss?.warningFan) {
                    this.boss.warningFan = null
                    this.boss.warningTime = 0
                    this.boss.warningAngles = []
                    this.boss.shootTimer = 0
                }
            }
        }
    }
}(globalThis.ShootingGame))
