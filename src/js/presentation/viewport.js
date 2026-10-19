(function (app) {
    app.createViewport = function (Game) {
        return {
            prepareViewport: function () {
                this.c = document.getElementById('game')
                this.ctx = this.c.getContext('2d')
                this.view = null
                this.resize(false)
            },
            resize: function (redraw = true) {
                const rect = this.c.getBoundingClientRect()
                const cssWidth = Math.max(1, rect.width)
                const cssHeight = Math.max(1, rect.height)
                const aspect = cssWidth / cssHeight
                const config = app.config.viewport
                const height = Math.max(config.baseHeight, config.minWidth / aspect)
                const previous = this.view
                this.view = { width: height * aspect, height }

                // Physical pixels are independent from gameplay coordinates.
                // Use one scale for both axes so ships and text keep their shape.
                const ratio = Math.min(window.devicePixelRatio || 1, config.maxPixelRatio)
                this.c.width = Math.max(1, Math.round(cssWidth * ratio))
                this.c.height = Math.max(1, Math.round(cssHeight * ratio))
                const scale = this.c.height / height
                this.ctx.setTransform(scale, 0, 0, scale, 0, 0)
                this.ctx.imageSmoothingEnabled = true
                this.ctx.imageSmoothingQuality = 'high'

                if (!previous || !this.player) return
                this.cancelFanOnResize()
                this.releaseIncursion()
                const scaleX = this.view.width / previous.width
                const scaleY = this.view.height / previous.height
                this.player.x = Math.max(0, Math.min(this.view.width - this.player.width,
                    (this.player.x + this.player.width / 2) * scaleX - this.player.width / 2))
                this.player.y = this.view.height - this.player.height
                this.player.trail = []
                const relocate = entity => {
                    entity.x *= scaleX
                    entity.y *= scaleY
                }
                for (const collection of ['enemies', 'bullets', 'enemyBullets', 'meteors', 'particles', 'powerUps', 'floatingTexts']) {
                    for (const entity of Object.values(this[collection])) relocate(entity)
                }
                for (const meteor of Object.values(this.meteors)) {
                    meteor.x = Math.max(0, Math.min(this.view.width - meteor.width, meteor.x))
                }
                for (const powerUp of Object.values(this.powerUps)) {
                    const halfWidth = powerUp.width / 2
                    powerUp.x = Math.max(halfWidth, Math.min(this.view.width - halfWidth, powerUp.x))
                }
                for (const enemy of Object.values(this.enemies)) {
                    enemy.maxY = this.enemyBounds(enemy.pattern === 'diver' || enemy.isAggressor || enemy.isMarksman,
                        enemy.profile.level).bottom - enemy.height
                    enemy.x = Math.max(0, Math.min(this.view.width - enemy.width, enemy.x))
                    if (enemy.pendingAttack) {
                        const attack = enemy.pendingAttack
                        attack.x = enemy.x + enemy.width / 2
                        attack.y = enemy.y + enemy.height
                        attack.targetX *= scaleX
                        attack.targetY *= scaleY
                        // Only the marksman's locked trajectory is diagonal.
                        // Aggressor rounds must still launch vertically before
                        // their short steering window, even after a resize.
                        if (attack.kind === 'aimed') {
                            attack.angle = Math.atan2(attack.targetX - attack.x,
                                attack.targetY - attack.y)
                        }
                    }
                }
                this.separateEnemiesAfterResize()
                if (this.boss) {
                    relocate(this.boss)
                    this.boss.x = Math.max(0, Math.min(this.view.width - this.boss.width, this.boss.x))
                    if (this.boss.warningTime > 0) {
                        this.boss.attackX = this.boss.x + this.boss.width / 2
                        this.boss.attackY = this.boss.y + this.boss.height
                    }
                }

                // Resizing clears the bitmap. Restore a paused/finished scene
                // without advancing gameplay or scheduling another frame.
                if (redraw && this.paused) this.repaint()
            },

            resized: function () { Game.resize() },

            repaint: function () {
                this.drawScene()
                if (this.isGameOver) this.drawGameOver(this.isNewRecord)
                else this.drawPause()
            }
        }
    }
}(globalThis.ShootingGame))
