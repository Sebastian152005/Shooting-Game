(function (app) {
    app.createScene = function (Game) {
        return {
            clear: function () {
                this.ctx.fillStyle = this.color
                this.ctx.fillRect(0, 0, this.view.width, this.view.height)
            },

            drawVideo: function () {
                if (this.video.readyState < 2) return
                const width = this.video.videoWidth
                const height = this.video.videoHeight
                if (!width || !height) return
                const scale = Math.max(this.view.width / width, this.view.height / height)
                const cropWidth = this.view.width / scale
                const cropHeight = this.view.height / scale
                this.ctx.drawImage(this.video,
                    (width - cropWidth) / 2, (height - cropHeight) / 2, cropWidth, cropHeight,
                    0, 0, this.view.width, this.view.height)
            },

            drawScene: function () {
                const ctx = this.ctx
                this.clear()
                this.drawVideo()
                this.drawBossMeteorWarning?.()
                ctx.save()
                if (this.shakeTimer > 0 && !this.paused) {
                    const intensity = 8 * (this.shakeTimer / 0.3)
                    ctx.translate((Math.random() - 0.5) * intensity * 2,
                        (Math.random() - 0.5) * intensity * 2)
                }
                for (const collection of ['enemies', 'enemyBullets', 'bullets', 'meteors', 'powerUps', 'particles']) {
                    for (const entity of Object.values(this[collection])) entity.draw()
                }
                if (this.boss) this.boss.draw()
                const player = this.player
                if (player.shield > 0) {
                    ctx.save()
                    ctx.strokeStyle = 'rgba(0,200,255,0.85)'
                    ctx.shadowColor = 'cyan'
                    ctx.shadowBlur = 22
                    ctx.lineWidth = 2.5
                    ctx.beginPath()
                    ctx.arc(player.x + player.width / 2, player.y + player.height / 2,
                        player.width / 2 + 13, 0, Math.PI * 2)
                    ctx.stroke()
                    ctx.restore()
                }
                if (!player.invincible || player.shield > 0 || this.blinkVisible) {
                    ctx.save()
                    if (player.invincible && player.shield <= 0) ctx.globalAlpha = 0.35
                    player.draw()
                    ctx.restore()
                }
                ctx.restore()
                if (this.levelFlash > 0) {
                    ctx.save()
                    ctx.globalAlpha = this.levelFlash * 0.3
                    ctx.fillStyle = this.bossActive ? '#FF9A3D' : '#00E1FF'
                    ctx.fillRect(0, 0, this.view.width, this.view.height)
                    ctx.restore()
                }
                for (const text of Object.values(this.floatingTexts)) text.draw()
                this.updateScore()
            }
        }
    }
}(globalThis.ShootingGame))
