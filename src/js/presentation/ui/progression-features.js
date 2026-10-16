(function (app) {
    app.createProgressionFeatureRenderer = function (Game) {
        return {
            drawEnergyPickup: function (pickup) {
                const ctx = this.ctx
                const image = Game.assets.get(pickup.sprite)
                const pulse = 0.92 + Math.sin(pickup.pulse) * 0.08
                const bob = Math.sin(pickup.pulse * 0.7 + pickup.id) * 2
                ctx.save()
                ctx.translate(pickup.x, pickup.y + bob)
                ctx.globalCompositeOperation = 'screen'
                const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, pickup.height * 0.72)
                glow.addColorStop(0, 'rgba(214,252,255,0.42)')
                glow.addColorStop(0.36, 'rgba(0,225,255,0.2)')
                glow.addColorStop(1, 'rgba(0,115,180,0)')
                ctx.fillStyle = glow
                ctx.beginPath()
                ctx.arc(0, 0, pickup.height * 0.72, 0, Math.PI * 2)
                ctx.fill()
                ctx.restore()

                ctx.save()
                ctx.translate(pickup.x, pickup.y + bob)
                ctx.rotate(pickup.rotation)
                const perspective = 0.95 + Math.cos(pickup.rotation * 2) * 0.05
                ctx.scale(pulse * perspective, 1 / perspective)
                ctx.shadowColor = '#00E1FF'
                ctx.shadowBlur = 12
                Game.assets.draw(ctx, image, -pickup.width / 2, -pickup.height / 2,
                    pickup.width, pickup.height)
                ctx.restore()

                ctx.save()
                ctx.translate(pickup.x, pickup.y + bob)
                ctx.rotate(-pickup.rotation * 0.65)
                ctx.strokeStyle = 'rgba(126,244,255,0.55)'
                ctx.lineWidth = 1
                ctx.beginPath()
                ctx.ellipse(0, 0, pickup.width * 0.72, pickup.height * 0.23, 0, 0, Math.PI * 2)
                ctx.stroke()
                ctx.restore()
            },

            drawDefensivePulse: function () {
                if (!this.pulseOrigin || this.pulseVisualRemaining <= 0) return
                const duration = Game.config.energy.pulseVisualDuration
                const progress = 1 - this.pulseVisualRemaining / duration
                const eased = 1 - Math.pow(1 - progress, 3)
                const maximumRadius = this.rewardEffects?.pulseRadius ?? Game.config.energy.pulseRadius
                const radius = maximumRadius * eased
                const alpha = Math.max(0, 1 - progress)
                const ctx = this.ctx

                ctx.save()
                ctx.globalCompositeOperation = 'screen'
                const field = ctx.createRadialGradient(this.pulseOrigin.x, this.pulseOrigin.y, 0,
                    this.pulseOrigin.x, this.pulseOrigin.y, Math.max(1, radius))
                field.addColorStop(0, `rgba(220,255,255,${0.2 * alpha})`)
                field.addColorStop(0.55, `rgba(0,225,255,${0.12 * alpha})`)
                field.addColorStop(0.9, `rgba(83,116,255,${0.08 * alpha})`)
                field.addColorStop(1, 'rgba(0,225,255,0)')
                ctx.fillStyle = field
                ctx.beginPath()
                ctx.arc(this.pulseOrigin.x, this.pulseOrigin.y, radius, 0, Math.PI * 2)
                ctx.fill()

                for (const offset of [0, 0.08]) {
                    const ringRadius = Math.max(0, maximumRadius * Math.min(1, eased + offset))
                    ctx.globalAlpha = alpha * (offset === 0 ? 1 : 0.35)
                    ctx.strokeStyle = offset === 0 ? '#C8FFFF' : '#557DFF'
                    ctx.shadowColor = offset === 0 ? '#00E1FF' : '#6C4DFF'
                    ctx.shadowBlur = 24
                    ctx.lineWidth = Math.max(1.2, 6 - progress * 4)
                    ctx.beginPath()
                    ctx.arc(this.pulseOrigin.x, this.pulseOrigin.y, ringRadius, 0, Math.PI * 2)
                    ctx.stroke()
                }

                const rays = Math.min(12, 6 + (this.pulseDestroyedCount || 0))
                ctx.globalAlpha = alpha * 0.55
                ctx.strokeStyle = '#BFFFFF'
                ctx.lineWidth = 1
                for (let index = 0; index < rays; index++) {
                    const angle = Math.PI * 2 * index / rays + progress * 0.35
                    const inner = radius * 0.72
                    ctx.beginPath()
                    ctx.moveTo(this.pulseOrigin.x + Math.cos(angle) * inner,
                        this.pulseOrigin.y + Math.sin(angle) * inner)
                    ctx.lineTo(this.pulseOrigin.x + Math.cos(angle) * radius,
                        this.pulseOrigin.y + Math.sin(angle) * radius)
                    ctx.stroke()
                }
                ctx.restore()
            },

            drawBossMeteorWarning: function () {
                if (!this.bossActive || (this.bossMeteorWarningRemaining || 0) <= 0) return
                const ctx = this.ctx
                const duration = Game.config.meteors.boss.warningDuration
                const progress = 1 - this.bossMeteorWarningRemaining / duration
                const pulse = 0.55 + Math.sin(progress * Math.PI * 8) * 0.2
                const centerX = this.view.width / 2
                const y = Math.max(150, this.view.height * 0.34)
                ctx.save()
                ctx.globalAlpha = Math.max(0.35, pulse)
                const band = ctx.createLinearGradient(0, 0, this.view.width, 0)
                band.addColorStop(0, 'rgba(255,72,24,0)')
                band.addColorStop(0.5, 'rgba(255,72,24,0.2)')
                band.addColorStop(1, 'rgba(255,72,24,0)')
                ctx.fillStyle = band
                ctx.fillRect(0, y - 24, this.view.width, 48)
                ctx.textAlign = 'center'
                ctx.font = 'bold 11px Lato, sans-serif'
                ctx.fillStyle = '#FFB05A'
                ctx.shadowColor = '#FF4D18'
                ctx.shadowBlur = 14
                ctx.fillText('ANOMALÍA ORBITAL', centerX, y + 4)
                ctx.strokeStyle = 'rgba(255,176,90,0.72)'
                ctx.lineWidth = 1.5
                for (const direction of [-1, 1]) {
                    ctx.beginPath()
                    ctx.moveTo(centerX + direction * 72, y)
                    ctx.lineTo(centerX + direction * 118, y)
                    ctx.stroke()
                }
                ctx.restore()
            }
        }
    }
}(globalThis.ShootingGame))
