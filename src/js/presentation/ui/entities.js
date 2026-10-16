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
            const ctx = Game.ctx
            const centerX = this.x + this.width / 2
            const centerY = this.y + this.height / 2
            ctx.save()
            ctx.translate(centerX, centerY)
            ctx.rotate(this.bank || 0)
            if (this.entering) {
                const arrival = Math.max(0, Math.min(1, this.entryElapsed / Game.config.motion.entryDuration))
                const depthScale = 0.82 + arrival * 0.18
                ctx.shadowColor = '#66E8FF'
                ctx.shadowBlur = 12 + (1 - arrival) * 16
                const trail = ctx.createLinearGradient(0, -this.height * 0.2, 0, -this.height * 0.9)
                trail.addColorStop(0, 'rgba(97,245,255,0.42)')
                trail.addColorStop(0.45, 'rgba(55,157,194,0.14)')
                trail.addColorStop(1, 'rgba(97,245,255,0)')
                ctx.save()
                ctx.globalCompositeOperation = 'screen'
                ctx.globalAlpha = 0.7
                ctx.filter = 'blur(2px)'
                ctx.strokeStyle = trail
                ctx.lineWidth = Math.max(5, this.width * 0.12)
                ctx.lineCap = 'round'
                ctx.beginPath()
                ctx.moveTo(0, -this.height * 0.18)
                ctx.lineTo(-this.entryVelocityX * 5,
                    -this.height * (0.58 + (1 - arrival) * 0.2))
                ctx.stroke()
                ctx.restore()
                for (const delay of [2.2, 4]) {
                    ctx.save()
                    ctx.globalAlpha = delay === 2.2 ? 0.13 : 0.06
                    ctx.filter = `blur(${delay === 2.2 ? 1.2 : 2.4}px)`
                    Game.assets.draw(ctx, Game.assets.get(this.sprite),
                        -this.width * depthScale / 2 - this.entryVelocityX * delay,
                        -this.height * depthScale / 2 - this.entryVelocityY * delay,
                        this.width * depthScale, this.height * depthScale)
                    ctx.restore()
                }
                ctx.globalAlpha = 0.72 + arrival * 0.28
                ctx.scale(depthScale, depthScale)
            }
            Game.assets.draw(ctx, Game.assets.get(this.sprite), -this.width / 2, -this.height / 2, this.width, this.height)
            // Identification is part of the hull transform, so its lamps bank,
            // scale and arrive with the ship instead of floating over the sprite.
            this.drawRole()
            ctx.restore()
            if (this.ai?.state === 'acquiring') {
                const duration = Math.max(0.001, Game.config.progression.enemyAcquisitionTime)
                const progress = 1 - this.ai.acquisitionRemaining / duration
                const color = this.role === 'aggressor' ? Game.config.enemyAttackColors.aggressor
                    : this.role === 'marksman' ? Game.config.enemyAttackColors.precision
                        : Game.config.enemyAttackColors.controller
                ctx.save()
                ctx.globalAlpha = 0.35 + progress * 0.35
                ctx.strokeStyle = color
                ctx.shadowColor = color
                ctx.shadowBlur = 6
                ctx.lineWidth = 1.4
                ctx.setLineDash([4, 7])
                ctx.beginPath()
                ctx.arc(centerX, centerY, this.width * (0.48 + progress * 0.08),
                    -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress)
                ctx.stroke()
                ctx.restore()
            }
            const attack = this.pendingAttack
            if (!attack) return
            const tracking = attack.kind === 'tracking'
            const aggressive = tracking || attack.kind === 'aggressive'
            const aimed = attack.kind === 'aimed'
            const fan = attack.kind === 'fan'
            const color = aggressive ? Game.config.enemyAttackColors.aggressor
                : aimed ? Game.config.enemyAttackColors.precision
                : fan ? Game.config.enemyAttackColors.controller : Game.config.enemyAttackColors.common
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
            } else if (aimed) {
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
            const pulse = 0.82 + Math.sin(Game.elapsedTime * 4.2 + this.index * 0.7) * 0.12
            const offsets = this.role === 'aggressor' ? [-0.14, 0.14]
                : this.role === 'marksman' ? [-0.12, 0.12]
                : this.role === 'controller' ? [-0.22, 0, 0.22] : [0]
            const palette = this.role === 'aggressor'
                ? ['#FFF0D0', '#FF6347', '#6B2418']
                : this.role === 'marksman'
                    ? ['#FFF5CF', '#FFB347', '#6B4214']
                : this.role === 'controller'
                    ? ['#E6FBFF', '#32D5FF', '#14536B']
                    : ['#E4FFE9', '#59FF78', '#1B6030']
            ctx.save()
            ctx.globalAlpha = this.entering
                ? Math.max(0.35, Math.min(1, this.entryElapsed / Game.config.motion.entryDuration))
                : 1
            // A restrained underbody wash ties each color to propulsion and
            // weapon hardware without recoloring the original UFO artwork.
            const washY = this.height * (scout ? 0.12 : 0.31)
            const washColor = this.role === 'aggressor' ? 'rgba(255,76,48,0.18)'
                : this.role === 'marksman' ? 'rgba(255,179,71,0.16)'
                : this.role === 'controller' ? 'rgba(50,213,255,0.16)' : 'rgba(89,255,120,0.13)'
            const wash = ctx.createRadialGradient(0, washY, 0, 0, washY, this.width * 0.38)
            wash.addColorStop(0, washColor)
            wash.addColorStop(1, 'rgba(0,0,0,0)')
            ctx.fillStyle = wash
            ctx.beginPath()
            ctx.ellipse(0, washY, this.width * 0.38, this.height * 0.13, 0, 0, Math.PI * 2)
            ctx.fill()

            // Recessed running lights follow the hull's curvature.
            for (const offset of offsets) {
                const x = this.width * offset
                const y = this.height * ((scout ? -0.1 : 0.32) - Math.abs(offset) * 0.18)
                const radius = this.width * 0.035
                const depth = this.height * 0.025
                ctx.fillStyle = 'rgba(7, 17, 20, 0.8)'
                ctx.beginPath()
                ctx.ellipse(x, y, radius + 1, depth + 1, 0, 0, Math.PI * 2)
                ctx.fill()
                const lens = ctx.createRadialGradient(x - radius * 0.3, y - depth * 0.3, 0, x, y, radius)
                lens.addColorStop(0, palette[0])
                lens.addColorStop(0.4, palette[1])
                lens.addColorStop(1, palette[2])
                ctx.fillStyle = lens
                ctx.shadowColor = palette[1]
                ctx.shadowBlur = 5 * pulse
                ctx.beginPath()
                ctx.ellipse(x, y, radius, depth, 0, 0, Math.PI * 2)
                ctx.fill()
            }

            // Aggressors keep the original hot identity through twin exhaust
            // vents; controllers use a segmented cyan sensor rail.
            ctx.lineCap = 'round'
            if (this.role === 'aggressor') {
                ctx.strokeStyle = 'rgba(255,99,71,0.72)'
                ctx.shadowColor = '#FF6347'
                ctx.shadowBlur = 7 * pulse
                ctx.lineWidth = Math.max(1.2, this.height * 0.025)
                for (const side of [-1, 1]) {
                    ctx.beginPath()
                    ctx.moveTo(side * this.width * 0.19, this.height * 0.18)
                    ctx.lineTo(side * this.width * 0.29, this.height * 0.27)
                    ctx.stroke()
                }
            } else if (this.role === 'controller') {
                ctx.strokeStyle = 'rgba(50,213,255,0.68)'
                ctx.shadowColor = '#32D5FF'
                ctx.shadowBlur = 6 * pulse
                ctx.lineWidth = Math.max(1, this.height * 0.02)
                for (const side of [-1, 1]) {
                    ctx.beginPath()
                    ctx.arc(0, this.height * 0.06, this.width * 0.25,
                        side < 0 ? Math.PI * 0.62 : Math.PI * 1.62,
                        side < 0 ? Math.PI * 1.38 : Math.PI * 0.38, side > 0)
                    ctx.stroke()
                }
            } else if (this.role === 'marksman') {
                ctx.strokeStyle = 'rgba(255,179,71,0.78)'
                ctx.shadowColor = '#FFB347'
                ctx.shadowBlur = 7 * pulse
                ctx.lineWidth = Math.max(1.1, this.height * 0.022)
                ctx.beginPath()
                ctx.moveTo(-this.width * 0.08, this.height * 0.08)
                ctx.lineTo(0, this.height * 0.14)
                ctx.lineTo(this.width * 0.08, this.height * 0.08)
                ctx.stroke()
            }
            ctx.restore()
            },
            Boss: function () {
            const ctx = Game.ctx
            const centerX = this.x + this.width / 2
            const centerY = this.y + this.height / 2
            const phaseColor = this.phase === 3 ? '#FF3158' : this.phase === 2 ? '#FF8A34' : '#7C5CFF'

            // Rotating orbital frame makes the flagship read as a unique encounter.
            ctx.save()
            ctx.translate(centerX, centerY)
            ctx.rotate(this.visualTime * 0.18)
            ctx.strokeStyle = phaseColor
            ctx.globalAlpha = 0.34
            ctx.shadowColor = phaseColor
            ctx.shadowBlur = 18
            ctx.lineWidth = 2
            ctx.setLineDash([10, 16])
            ctx.beginPath()
            ctx.ellipse(0, 0, this.width * 0.58, this.height * 0.58, 0, 0, Math.PI * 2)
            ctx.stroke()
            ctx.rotate(-this.visualTime * 0.45)
            ctx.globalAlpha = 0.18
            ctx.setLineDash([3, 13])
            ctx.beginPath()
            ctx.ellipse(0, 0, this.width * 0.68, this.height * 0.72, 0, 0, Math.PI * 2)
            ctx.stroke()
            ctx.restore()

            ctx.save()
            if (this.warningTime > 0) {
                const x = this.attackX
                const y = this.attackY
                ctx.strokeStyle = 'rgba(255,110,40,0.4)'
                ctx.lineWidth = 2
                ctx.setLineDash([8, 12])
                for (const angle of this.warningAngles) {
                    ctx.beginPath()
                    ctx.moveTo(x, y)
                    ctx.lineTo(x + Math.tan(angle) * (Game.view.height - y), Game.view.height)
                    ctx.stroke()
                }
                ctx.setLineDash([])
            }
            ctx.shadowColor = phaseColor
            ctx.shadowBlur = 38
            if (this.damageFlash > 0) ctx.globalAlpha = 0.55
            Game.assets.draw(ctx, Game.assets.get(this.sprite), this.x, this.y, this.width, this.height)
            ctx.restore()

            // Armored side pods and a pulsing reactor distinguish the boss silhouette.
            ctx.save()
            ctx.fillStyle = 'rgba(10,18,31,0.9)'
            ctx.strokeStyle = phaseColor
            ctx.lineWidth = 2
            for (const direction of [-1, 1]) {
                const podX = centerX + direction * this.width * 0.39
                const podY = centerY + this.height * 0.12
                ctx.beginPath()
                ctx.ellipse(podX, podY, this.width * 0.1, this.height * 0.22,
                    direction * 0.18, 0, Math.PI * 2)
                ctx.fill(); ctx.stroke()
                ctx.fillStyle = phaseColor
                ctx.fillRect(podX - 3, podY + this.height * 0.13, 6, this.height * 0.16)
                ctx.fillStyle = 'rgba(10,18,31,0.9)'
            }
            const reactorRadius = 10 + Math.sin(this.visualTime * 6) * 2 + this.phase * 2
            const reactor = ctx.createRadialGradient(centerX - 2, centerY - 2, 1,
                centerX, centerY, reactorRadius)
            reactor.addColorStop(0, '#FFFFFF')
            reactor.addColorStop(0.35, phaseColor)
            reactor.addColorStop(1, 'rgba(5,8,20,0)')
            ctx.fillStyle = reactor
            ctx.shadowColor = phaseColor
            ctx.shadowBlur = 24
            ctx.beginPath()
            ctx.arc(centerX, centerY, reactorRadius, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()

            // Segmented reactor integrity bar.
            const barX = this.x
            const barY = this.y + this.height + 5
            const barW = this.width
            const barH = 12
            const hp   = this.hp / this.maxHp
            ctx.fillStyle = 'rgba(0,0,0,0.72)'
            ctx.fillRect(barX, barY, barW, barH)
            ctx.fillStyle = phaseColor
            ctx.fillRect(barX + 2, barY + 2, Math.max(0, (barW - 4) * hp), barH - 4)
            ctx.strokeStyle = 'rgba(255,255,255,0.45)'
            ctx.lineWidth = 1
            ctx.strokeRect(barX, barY, barW, barH)
            for (let segment = 1; segment < 10; segment++) {
                const x = barX + barW * segment / 10
                ctx.fillStyle = 'rgba(0,0,0,0.42)'
                ctx.fillRect(x, barY + 1, 1, barH - 2)
            }

            ctx.save()
            ctx.fillStyle = phaseColor
            ctx.font = 'bold 11px Lato, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText('JEFE', centerX, this.y - 8)
            ctx.restore()
            },
            Meteor: function () {
            const ctx = Game.ctx
            const centerX = this.x + this.width / 2
            const centerY = this.y + this.height / 2
            const image = Game.assets.get(this.sprite)
            const flicker = 0.88 + Math.sin(Game.elapsedTime * 18 + this.index * 2.7) * 0.12
            const trailLength = Math.min(96, (30 + this.verticalSpeed * 11) * flicker)
            const trailLean = -this.horizontalSpeed * 30

            // A soft local light makes the body affect the scene instead of reading
            // as an unlit bitmap placed above the background.
            ctx.save()
            ctx.globalCompositeOperation = 'screen'
            const ambientGlow = ctx.createRadialGradient(centerX, centerY, this.width * 0.15,
                centerX, centerY, this.width * 1.15)
            ambientGlow.addColorStop(0, 'rgba(255,119,42,0.2)')
            ambientGlow.addColorStop(0.45, 'rgba(255,74,26,0.07)')
            ambientGlow.addColorStop(1, 'rgba(255,74,26,0)')
            ctx.fillStyle = ambientGlow
            ctx.beginPath()
            ctx.arc(centerX, centerY, this.width * 1.15, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()

            const trail = ctx.createLinearGradient(centerX, centerY,
                centerX + trailLean, centerY - trailLength)
            trail.addColorStop(0, 'rgba(255,226,156,0.95)')
            trail.addColorStop(0.2, 'rgba(255,102,28,0.76)')
            trail.addColorStop(0.58, 'rgba(116,42,30,0.3)')
            trail.addColorStop(1, 'rgba(28,25,31,0)')
            ctx.save()
            ctx.strokeStyle = trail
            ctx.lineWidth = Math.max(8, this.width * 0.38)
            ctx.lineCap = 'round'
            ctx.beginPath()
            ctx.moveTo(centerX, centerY - this.height * 0.18)
            ctx.lineTo(centerX + trailLean, centerY - trailLength)
            ctx.stroke()

            const hotCore = ctx.createLinearGradient(centerX, centerY,
                centerX + trailLean * 0.75, centerY - trailLength * 0.7)
            hotCore.addColorStop(0, 'rgba(255,248,210,0.95)')
            hotCore.addColorStop(0.25, 'rgba(255,143,37,0.86)')
            hotCore.addColorStop(1, 'rgba(255,68,20,0)')
            ctx.strokeStyle = hotCore
            ctx.lineWidth = Math.max(2, this.width * 0.1)
            ctx.beginPath()
            ctx.moveTo(centerX, centerY - this.height * 0.23)
            ctx.lineTo(centerX + trailLean * 0.75, centerY - trailLength * 0.7)
            ctx.stroke()
            ctx.restore()

            const tumbleTime = Game.elapsedTime * this.tumbleSpeed + this.tumblePhase
            const tumble = Math.sin(tumbleTime)
            const depthScale = 0.82 + Math.abs(Math.cos(tumbleTime)) * 0.18
            const drawBody = (offsetX, offsetY, alpha, motionBlur) => {
                ctx.save()
                ctx.translate(centerX + offsetX, centerY + offsetY)
                ctx.rotate(this.rotation)
                ctx.transform(depthScale, tumble * 0.045, -tumble * 0.035, 1, 0, 0)
                ctx.globalAlpha = alpha
                if (motionBlur) {
                    ctx.globalCompositeOperation = 'screen'
                    ctx.filter = `blur(${motionBlur}px)`
                }
                Game.assets.draw(ctx, image, -this.width / 2, -this.height / 2,
                    this.width, this.height)
                ctx.restore()
            }

            // Faint delayed silhouettes sell downward velocity without obscuring
            // the irregular alpha edge of the main sprite.
            drawBody(-this.horizontalSpeed * 5, -this.verticalSpeed * 3.2, 0.08, 2.2)
            drawBody(-this.horizontalSpeed * 2.5, -this.verticalSpeed * 1.6, 0.12, 1.2)

            ctx.save()
            ctx.translate(centerX, centerY)
            ctx.rotate(this.rotation)
            ctx.transform(depthScale, tumble * 0.045, -tumble * 0.035, 1, 0, 0)
            ctx.shadowColor = 'rgba(255,91,24,0.8)'
            ctx.shadowBlur = 8 + this.verticalSpeed * 1.5
            Game.assets.draw(ctx, image, -this.width / 2, -this.height / 2, this.width, this.height)
            if (this.impactFlash > 0) {
                ctx.globalAlpha = this.impactFlash / 0.11 * 0.7
                ctx.globalCompositeOperation = 'screen'
                ctx.filter = 'brightness(3) saturate(0.3)'
                Game.assets.draw(ctx, image, -this.width / 2, -this.height / 2,
                    this.width, this.height)
            }
            ctx.restore()

            // Small fragments burn off the rear edge. Their deterministic phases
            // avoid adding mutable presentation state to the simulation.
            ctx.save()
            ctx.globalCompositeOperation = 'screen'
            for (let index = 0; index < 4; index++) {
                const phase = Game.elapsedTime * (7 + index) + this.index * 1.7 + index * 2.1
                const travel = (Math.sin(phase * 0.53) + 1) * 0.5
                const emberX = centerX + trailLean * travel * 0.55 + Math.sin(phase) * this.width * 0.18
                const emberY = centerY - this.height * 0.2 - travel * trailLength * 0.72
                const emberSize = 0.8 + (index % 2) * 0.7
                ctx.fillStyle = index % 2 ? 'rgba(255,206,116,0.8)' : 'rgba(255,91,28,0.72)'
                ctx.beginPath()
                ctx.arc(emberX, emberY, emberSize, 0, Math.PI * 2)
                ctx.fill()
            }
            ctx.restore()

            ctx.save()
            const heat = ctx.createRadialGradient(centerX, centerY + this.height * 0.3, 0,
                centerX, centerY + this.height * 0.3, this.width * 0.48)
            heat.addColorStop(0, 'rgba(255,190,75,0.28)')
            heat.addColorStop(0.45, 'rgba(255,72,20,0.12)')
            heat.addColorStop(1, 'rgba(255,72,20,0)')
            ctx.globalCompositeOperation = 'screen'
            ctx.fillStyle = heat
            ctx.beginPath()
            ctx.ellipse(centerX, centerY + this.height * 0.3,
                this.width * 0.48, this.height * 0.25, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
            },
            EnemyBullet: function () {
            const ctx    = Game.ctx
            const d      = this.diff
            const isBoss = this.isBoss
            const isAggressor = this.isAggressor
            const isPrecision = this.isPrecision
            const cx     = this.x + this.width / 2
            const y      = this.y
            const h      = this.height
            const w      = this.width

            let glowColor, bodyColor, coreColor
            if (this.isTracking || this.attackType === 'aggressor') {
                glowColor = '#FF6347'
                bodyColor = 'rgba(255,99,71,0.95)'
                coreColor = '#FFF0D0'
            } else if (isPrecision) {
                glowColor = '#FFB347'
                bodyColor = 'rgba(255,168,58,0.94)'
                coreColor = '#FFF6D8'
            } else if (this.attackType === 'controller') {
                glowColor = '#32D5FF'
                bodyColor = 'rgba(25,177,226,0.94)'
                coreColor = '#E6FBFF'
            } else if (isBoss) {
                glowColor = '#FF2200'
                bodyColor = `rgba(255,${Math.min(255, 40 + d * 8)},0,0.95)`
                coreColor = '#FFFAE0'
            } else if (isAggressor) {
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
            const glowBase = isBoss ? Math.min(42, 22 + d * 2.2) : isAggressor ? Math.min(28, 10 + d * 1.8) : Math.min(22, 6 + d * 1.6)
            const glowBlur = glowBase + pulse * (isBoss ? 6 : 2.5)

            ctx.save()

            // Preserve the ZIP's unstable green energy as a visual shimmer.
            // The projectile position and collision path remain fully straight.
            if (this.attackType === 'common') {
                ctx.translate(Math.sin(Game.elapsedTime * 17 + this.phase) * 0.7, 0)
            }

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
