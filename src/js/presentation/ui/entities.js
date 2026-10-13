(function (app) {
    app.createEntityRenderer = function (Game) {
        const { POWERUP_ICONS } = app.config
        const renderers = {
            Player: function () {
            // engine trail
            for (let i = 0; i < this.trail.length; i++) {
                const alpha = (1 - i / this.trail.length) * 0.35
                Game.ctx.save()
                Game.ctx.globalAlpha  = alpha
                Game.ctx.fillStyle    = '#4af'
                Game.ctx.shadowColor  = '#4af'
                Game.ctx.shadowBlur   = 6
                Game.ctx.beginPath()
                Game.ctx.arc(this.trail[i].x, this.trail[i].y, Math.max(1, 5 - i * 0.6), 0, Math.PI * 2)
                Game.ctx.fill()
                Game.ctx.restore()
            }
            Game.assets.draw(Game.ctx, Game.assets.get(this.sprite), this.x, this.y, this.width, this.height)
            },
            Bullet: function () {
            const ctx  = Game.ctx
            const cx   = this.x + this.width / 2
            const y    = this.y
            const h    = this.height
            const w    = this.width

            // triple shot: slightly purple-white tint; single: orange-yellow
            const glowColor = this.triple ? '#CC88FF' : '#FFA020'
            const bodyColor = this.triple ? 'rgba(180,80,255,0.92)' : 'rgba(255,140,0,0.92)'
            const coreColor = this.triple ? '#F0E0FF' : '#FFF0A0'

            const pulse    = Math.sin(Game.elapsedTime * 16 + this.phase)
            const glowBlur = 12 + pulse * 2.5

            ctx.save()

            // rotate triple shot bullets to face their diagonal travel direction
            if (this.vx !== 0) {
                const angle = Math.atan2(-this.vy, this.vx) + Math.PI / 2
                ctx.translate(cx, y + h / 2)
                ctx.rotate(angle)
                ctx.translate(-cx, -(y + h / 2))
            }

            ctx.shadowColor = glowColor
            ctx.shadowBlur  = glowBlur

            // teardrop: tip at top (direction of travel = up), wide tail at bottom
            const tailW = w * 0.85
            const tipW  = w * 0.07
            ctx.beginPath()
            ctx.moveTo(cx,              y)
            ctx.lineTo(cx + tipW,       y + h * 0.12)
            ctx.lineTo(cx + tailW / 2,  y + h)
            ctx.lineTo(cx - tailW / 2,  y + h)
            ctx.lineTo(cx - tipW,       y + h * 0.12)
            ctx.closePath()
            ctx.fillStyle = bodyColor
            ctx.fill()

            // bright core streak
            ctx.shadowBlur  = glowBlur * 0.4
            ctx.strokeStyle = coreColor
            ctx.lineWidth   = Math.max(1, w * 0.18)
            ctx.lineCap     = 'round'
            ctx.beginPath()
            ctx.moveTo(cx, y + h * 0.07)
            ctx.lineTo(cx, y + h * 0.83)
            ctx.stroke()

            ctx.restore()
            },
            Enemy: function () {
            Game.assets.draw(Game.ctx, Game.assets.get(this.sprite), this.x, this.y, this.width, this.height)
            this.drawRole()
            const attack = this.pendingAttack
            if (!attack) return
            const ctx = Game.ctx
            const tracking = attack.kind === 'tracking'
            const fan = attack.kind === 'fan'
            const color = tracking ? '#FF3864' : fan ? '#6BFF9C' : '#FFAA44'
            const duration = fan ? app.config.progression.fanWarning : app.config.progression.enemyWarning
            const progress = 1 - attack.remaining / duration
            ctx.save()
            ctx.strokeStyle = color
            ctx.fillStyle = color
            ctx.shadowColor = color
            ctx.shadowBlur = 12
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(attack.x, attack.y, 8 + progress * 5, 0, Math.PI * 2)
            ctx.stroke()
            ctx.beginPath()
            ctx.arc(attack.x, attack.y, 3 + progress * 3, 0, Math.PI * 2)
            ctx.fill()
            if (fan) {
                ctx.globalAlpha = 0.3
                ctx.shadowBlur = 0
                ctx.lineWidth = 1
                ctx.setLineDash([5, 9])
                for (const angle of attack.angles) {
                    ctx.beginPath()
                    ctx.moveTo(attack.x, attack.y)
                    ctx.lineTo(attack.x + Math.tan(angle) * (Game.view.height - attack.y), Game.view.height)
                    ctx.stroke()
                }
            } else if (!tracking) {
                ctx.globalAlpha = 0.45
                ctx.shadowBlur = 0
                ctx.lineWidth = 1
                ctx.setLineDash([5, 9])
                ctx.beginPath()
                ctx.moveTo(attack.x, attack.y)
                ctx.lineTo(attack.targetX, attack.targetY)
                ctx.stroke()
                ctx.setLineDash([])
                ctx.strokeRect(attack.targetX - 8, attack.targetY - 8, 16, 16)
            }
            ctx.restore()
            },
            EnemyRole: function () {
            const ctx = Game.ctx
            const scout = this.sprite === 'scout'
            const offsets = this.role === 'hunter' ? [-0.14, 0.14]
                : this.role === 'controller' ? [-0.22, 0, 0.22] : [0]
            const amber = this.role === 'hunter'
            ctx.save()
            // Recessed running lights follow the hull's curve, rather than covering it.
            ctx.shadowBlur = 0
            for (const offset of offsets) {
                const x = this.x + this.width * (0.5 + offset)
                const y = this.y + this.height * ((scout ? 0.4 : 0.82) - Math.abs(offset) * 0.18)
                const radius = this.width * 0.035
                const depth = this.height * 0.025
                ctx.fillStyle = 'rgba(7, 17, 20, 0.8)'
                ctx.beginPath()
                ctx.ellipse(x, y, radius + 1, depth + 1, 0, 0, Math.PI * 2)
                ctx.fill()
                const lens = ctx.createRadialGradient(x - radius * 0.3, y - depth * 0.3, 0, x, y, radius)
                lens.addColorStop(0, amber ? '#FFE7B5' : '#C4F2D3')
                lens.addColorStop(0.4, amber ? '#CE8C3B' : '#4B9B72')
                lens.addColorStop(1, amber ? '#56331B' : '#183D31')
                ctx.fillStyle = lens
                ctx.beginPath()
                ctx.ellipse(x, y, radius, depth, 0, 0, Math.PI * 2)
                ctx.fill()
            }
            ctx.restore()
            },
            Boss: function () {
            Game.ctx.save()
            if (this.warningTime > 0) {
                const x = this.attackX
                const y = this.attackY
                Game.ctx.strokeStyle = 'rgba(255,110,40,0.4)'
                Game.ctx.lineWidth = 2
                Game.ctx.setLineDash([8, 12])
                for (const angle of this.warningAngles) {
                    Game.ctx.beginPath()
                    Game.ctx.moveTo(x, y)
                    Game.ctx.lineTo(x + Math.tan(angle) * (Game.view.height - y), Game.view.height)
                    Game.ctx.stroke()
                }
                Game.ctx.setLineDash([])
            }
            Game.ctx.shadowColor = '#FF3300'
            Game.ctx.shadowBlur  = 35
            Game.assets.draw(Game.ctx, Game.assets.get(this.sprite), this.x, this.y, this.width, this.height)
            Game.ctx.restore()

            // health bar
            const barX = this.x
            const barY = this.y + this.height + 5
            const barW = this.width
            const barH = 10
            const hp   = this.hp / this.maxHp
            Game.ctx.fillStyle = 'rgba(0,0,0,0.6)'
            Game.ctx.fillRect(barX, barY, barW, barH)
            Game.ctx.fillStyle = hp > 0.5 ? '#4f4' : hp > 0.25 ? '#FF8C00' : '#f44'
            Game.ctx.fillRect(barX, barY, barW * hp, barH)
            Game.ctx.strokeStyle = 'rgba(255,255,255,0.35)'
            Game.ctx.lineWidth   = 1
            Game.ctx.strokeRect(barX, barY, barW, barH)

            // label
            Game.ctx.fillStyle = '#FF3300'
            Game.ctx.font      = 'bold 12px Lato, sans-serif'
            Game.ctx.save()
            Game.ctx.textAlign = 'center'
            Game.ctx.fillText('JEFE', this.x + this.width / 2, this.y - 6)
            Game.ctx.restore()
            },
            EnemyBullet: function () {
            const ctx    = Game.ctx
            const d      = this.diff
            const isBoss = this.isBoss
            const isAggr = this.isAggr
            const cx     = this.x + this.width / 2
            const y      = this.y
            const h      = this.height
            const w      = this.width

            let glowColor, bodyColor, coreColor
            if (this.isTracking) {
                glowColor = '#FF3864'
                bodyColor = 'rgba(255,40,90,0.95)'
                coreColor = '#FFE4EB'
            } else if (isBoss) {
                glowColor = '#FF2200'
                bodyColor = `rgba(255,${Math.min(255, 40 + d * 8)},0,0.95)`
                coreColor = '#FFFAE0'
            } else if (isAggr) {
                glowColor = '#FF7020'
                bodyColor = `rgba(255,${Math.min(255, 75 + d * 7)},15,0.9)`
                coreColor = d >= 4 ? '#FFF0D0' : '#FFCCA0'
            } else {
                const g   = Math.min(255, 155 + d * 11)
                glowColor = `rgb(0,${g},80)`
                bodyColor = `rgba(0,${g},55,0.9)`
                coreColor = d >= 5 ? '#DFFFDF' : '#A8FFB0'
            }

            const pulse    = Math.sin(Game.elapsedTime * 13 + this.phase)
            const glowBase = isBoss ? Math.min(42, 22 + d * 2.2) : isAggr ? Math.min(28, 10 + d * 1.8) : Math.min(22, 6 + d * 1.6)
            const glowBlur = glowBase + pulse * (isBoss ? 6 : 2.5)

            ctx.save()

            // rotate diagonal boss bullets to face travel direction
            if (this.vx !== 0) {
                const angle = Math.atan2(this.vy, this.vx) - Math.PI / 2
                ctx.translate(cx, y + h / 2)
                ctx.rotate(angle)
                ctx.translate(-cx, -(y + h / 2))
            }

            ctx.shadowColor = glowColor
            ctx.shadowBlur  = glowBlur

            // teardrop: wide tail at top, pointed tip at bottom (direction of travel)
            const tailW = w * 0.88
            const tipW  = w * 0.07
            ctx.beginPath()
            ctx.moveTo(cx - tailW / 2, y)
            ctx.lineTo(cx + tailW / 2, y)
            ctx.lineTo(cx + tipW,      y + h * 0.88)
            ctx.lineTo(cx,             y + h)
            ctx.lineTo(cx - tipW,      y + h * 0.88)
            ctx.closePath()
            ctx.fillStyle = bodyColor
            ctx.fill()

            // bright core streak
            ctx.shadowBlur  = glowBlur * 0.4
            ctx.strokeStyle = coreColor
            ctx.lineWidth   = Math.max(1, w * 0.18)
            ctx.lineCap     = 'round'
            ctx.beginPath()
            ctx.moveTo(cx, y + h * 0.07)
            ctx.lineTo(cx, y + h * 0.83)
            ctx.stroke()

            ctx.restore()
            },
            PowerUp: function () {
            const r      = (this.width / 2) * (1 + Math.sin(this.pulse) * 0.12)
            Game.ctx.save()
            Game.ctx.shadowColor  = this.color
            Game.ctx.shadowBlur   = 18
            Game.ctx.globalAlpha  = 0.92
            Game.ctx.fillStyle    = this.color
            Game.ctx.beginPath()
            Game.ctx.arc(this.x, this.y, r, 0, Math.PI * 2)
            Game.ctx.fill()
            Game.ctx.globalAlpha  = 1
            Game.ctx.fillStyle    = 'white'
            Game.ctx.font         = 'bold 13px Lato, sans-serif'
            const icon = POWERUP_ICONS[this.type]
            Game.ctx.fillText(icon, this.x - Game.ctx.measureText(icon).width / 2, this.y + 4)
            Game.ctx.restore()
            },
            Particle: function () {
            Game.assets.draw(Game.ctx, Game.assets.get(this.sprite), this.x, this.y, this.size, this.size)
            },
            FloatingText: function () {
            const progress = this.life / this.maxLife
            const fontSize = Math.max(10, this.fontSize - progress * 4)
            Game.ctx.save()
            Game.ctx.globalAlpha = 1 - progress
            Game.ctx.fillStyle   = this.color
            Game.ctx.font        = "bold " + fontSize + "px Lato, sans-serif"
            Game.ctx.shadowColor = this.color
            Game.ctx.shadowBlur  = 8
            Game.ctx.fillText(this.text, this.x - Game.ctx.measureText(this.text).width / 2, this.y)
            Game.ctx.restore()
            }
        }
        return {
            drawEntity: function (entity, kind) { renderers[kind].call(entity) }
        }
    }
}(globalThis.ShootingGame))
