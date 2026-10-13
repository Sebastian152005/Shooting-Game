(function (app) {
    app.createHud = function (Game) {
        return {
            drawPause: function () {
                const dialog = document.getElementById('pauseMenu')
                if (!dialog.open) dialog.showModal()
            },

            hidePause: function () {
                const sound = document.getElementById('audioSettings')
                if (sound) sound.open = false
                const dialog = document.getElementById('pauseMenu')
                if (dialog.open) dialog.close()
            },

            drawGameOver: function (isNewRecord) {
                const ctx = this.ctx
                const W   = this.view.width
                const H   = this.view.height
                const cx  = W / 2
                const cy  = H / 2

                // dark overlay
                ctx.fillStyle = 'rgba(0,0,0,0.75)'
                ctx.fillRect(0, 0, W, H)

                // vignette — dark space feel
                const vig = ctx.createRadialGradient(cx, cy, H * 0.1, cx, cy, H * 0.85)
                vig.addColorStop(0, 'rgba(0,10,20,0)')
                vig.addColorStop(1, 'rgba(0,0,0,0.62)')
                ctx.fillStyle = vig
                ctx.fillRect(0, 0, W, H)

                // panel — misma estética que el HUD
                const pw = Math.min(400, W - 60)
                const ph = 278
                const px = cx - pw / 2
                const py = cy - ph / 2 - 10

                this._roundRect(px, py, pw, ph, 14)
                ctx.fillStyle   = 'rgba(0,0,0,0.82)'
                ctx.fill()
                ctx.strokeStyle = isNewRecord ? 'rgba(255,215,0,0.45)' : 'rgba(0,225,255,0.35)'
                ctx.lineWidth   = 1.5
                ctx.stroke()

                // top accent line — cian como el panel PUNTAJE
                ctx.save()
                ctx.strokeStyle = isNewRecord ? '#FFD700' : 'rgba(0,225,255,0.85)'
                ctx.lineWidth   = 2
                ctx.shadowColor = ctx.strokeStyle
                ctx.shadowBlur  = 10
                ctx.beginPath()
                ctx.moveTo(px + 22, py + 1)
                ctx.lineTo(px + pw - 22, py + 1)
                ctx.stroke()
                ctx.restore()

                // "GAME OVER" title — blanco con glow cian
                ctx.save()
                ctx.textAlign   = 'center'
                ctx.font        = 'bold 58px Lato, sans-serif'
                ctx.fillStyle   = '#ffffff'
                ctx.shadowColor = 'rgba(0,225,255,0.75)'
                ctx.shadowBlur  = 32
                ctx.fillText('GAME OVER', cx, py + 73)
                ctx.restore()

                // divider — cian tenue
                ctx.save()
                ctx.strokeStyle = 'rgba(0,225,255,0.12)'
                ctx.lineWidth   = 1
                ctx.beginPath(); ctx.moveTo(px + 28, py + 92); ctx.lineTo(px + pw - 28, py + 92); ctx.stroke()
                ctx.restore()

                // score label — mismo estilo que etiqueta HUD
                ctx.save()
                ctx.textAlign = 'center'
                ctx.font      = 'bold 8px Lato, sans-serif'
                ctx.fillStyle = 'rgba(0,225,255,0.55)'
                ctx.fillText('S C O R E', cx, py + 117)
                ctx.restore()

                // score value — igual al HUD
                ctx.save()
                ctx.textAlign   = 'center'
                ctx.font        = 'bold 46px Lato, sans-serif'
                ctx.fillStyle   = '#ffffff'
                ctx.shadowColor = 'rgba(0,225,255,0.45)'
                ctx.shadowBlur  = 10
                ctx.fillText(this.score.toLocaleString(), cx, py + 163)
                ctx.restore()

                // record — igual al panel MEJOR PUNTAJE
                ctx.save()
                ctx.textAlign = 'center'
                if (isNewRecord) {
                    ctx.font        = 'bold 20px Lato, sans-serif'
                    ctx.fillStyle   = '#FFD700'
                    ctx.shadowColor = '#FFD700'
                    ctx.shadowBlur  = 22
                    ctx.fillText('★   ¡NUEVO RÉCORD!   ★', cx, py + 199)
                } else {
                    ctx.font        = 'bold 12px Lato, sans-serif'
                    ctx.fillStyle   = 'rgba(255,215,0,0.55)'
                    ctx.fillText('RÉCORD  ' + this.highScore.toLocaleString(), cx, py + 199)
                }
                ctx.restore()

                // divider
                ctx.save()
                ctx.strokeStyle = 'rgba(0,225,255,0.12)'
                ctx.lineWidth   = 1
                ctx.beginPath(); ctx.moveTo(px + 28, py + 217); ctx.lineTo(px + pw - 28, py + 217); ctx.stroke()
                ctx.restore()

                // botón de reinicio — cian igual al HUD
                const bw = pw - 64
                const bh = 38
                const bx = cx - bw / 2
                const by = py + ph - 52
                this._roundRect(bx, by, bw, bh, 8)
                ctx.fillStyle   = 'rgba(0,225,255,0.07)'
                ctx.fill()
                ctx.strokeStyle = 'rgba(0,225,255,0.35)'
                ctx.lineWidth   = 1
                ctx.stroke()
                ctx.save()
                ctx.textAlign    = 'center'
                ctx.textBaseline = 'middle'
                ctx.font         = 'bold 12px Lato, sans-serif'
                ctx.fillStyle    = 'rgba(255,255,255,0.75)'
                ctx.fillText('CLIC O ENTER PARA VOLVER A JUGAR', cx, by + bh / 2)
                ctx.restore()
            },

            _roundRect: function (x, y, w, h, r) {
                r = Math.min(r, w / 2, h / 2)
                const ctx = this.ctx
                ctx.beginPath()
                ctx.moveTo(x + r, y)
                ctx.lineTo(x + w - r, y)
                ctx.quadraticCurveTo(x + w, y,     x + w, y + r)
                ctx.lineTo(x + w, y + h - r)
                ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
                ctx.lineTo(x + r, y + h)
                ctx.quadraticCurveTo(x, y + h,     x, y + h - r)
                ctx.lineTo(x, y + r)
                ctx.quadraticCurveTo(x, y,         x + r, y)
                ctx.closePath()
            },

            hudPanel: function (x, y, w, h, borderColor) {
                const ctx = this.ctx
                ctx.save()
                this._roundRect(x, y, w, h, 8)
                ctx.fillStyle   = 'rgba(0,0,0,0.62)'
                ctx.fill()
                ctx.strokeStyle = borderColor || 'rgba(255,255,255,0.15)'
                ctx.lineWidth   = 1
                ctx.stroke()
                ctx.restore()
            },

            hudRoundRect: function (x, y, w, h, r, fillStyle) {
                if (w <= 0) return
                const ctx = this.ctx
                ctx.save()
                this._roundRect(x, y, w, h, r)
                ctx.fillStyle = fillStyle
                ctx.fill()
                ctx.restore()
            },

            drawPowerUpHUD: function (x, y, icon, label, time, maxTime, color) {
                const ctx = this.ctx
                const w   = 138
                const h   = 22
                this.hudPanel(x, y, w, h, 'rgba(255,255,255,0.1)')
                ctx.save()
                ctx.fillStyle = color
                ctx.fillRect(x, y + 4, 3, h - 8)
                ctx.font        = 'bold 11px Lato, sans-serif'
                ctx.fillStyle   = color
                ctx.shadowColor = color
                ctx.shadowBlur  = 6
                ctx.fillText(icon, x + 8, y + 15)
                ctx.shadowBlur  = 0
                ctx.font        = 'bold 7px Lato, sans-serif'
                ctx.fillStyle   = 'rgba(255,255,255,0.6)'
                ctx.fillText(label, x + 24, y + 11)
                const bx = x + 24, by = y + 14, bw = 78, bh = 3
                ctx.fillStyle = 'rgba(255,255,255,0.1)'
                ctx.fillRect(bx, by, bw, bh)
                ctx.fillStyle = color
                ctx.fillRect(bx, by, bw * Math.max(0, Math.min(1, time / maxTime)), bh)
                ctx.textAlign   = 'right'
                ctx.font        = 'bold 9px Lato, sans-serif'
                ctx.fillStyle   = color
                ctx.fillText(time.toFixed(1) + 's', x + w - 4, y + 15)
                ctx.restore()
                return y + h + 3
            },

            drawSafeCorridor: function () {
                const gap = this.safeCorridor
                if (!gap) return
                const ctx = this.ctx
                const x = gap.center - gap.width / 2
                const y = this.player.y - 12
                const height = this.player.height + 12
                ctx.save()
                ctx.fillStyle = 'rgba(0,225,255,0.035)'
                ctx.fillRect(x, y, gap.width, height)
                ctx.strokeStyle = 'rgba(0,225,255,0.5)'
                ctx.lineWidth = 1.5
                for (const side of [x, x + gap.width]) {
                    const direction = side === x ? 1 : -1
                    ctx.beginPath()
                    ctx.moveTo(side + direction * 12, y)
                    ctx.lineTo(side, y)
                    ctx.lineTo(side, y + height)
                    ctx.lineTo(side + direction * 12, y + height)
                    ctx.stroke()
                }
                ctx.restore()
            },

            updateScore: function () {
                if (this.isGameOver) return
                this.drawSafeCorridor()
                const ctx = this.ctx
                const W   = this.view.width
                const H   = this.view.height

                // ── Panel PUNTAJE (left: 10,10 → 158,68) ─────────────────
                this.hudPanel(10, 10, 148, 58, 'rgba(0,225,255,0.35)')
                ctx.save()
                ctx.font      = 'bold 8px Lato, sans-serif'
                ctx.fillStyle = 'rgba(0,225,255,0.55)'
                ctx.fillText('SCORE', 18, 22)
                ctx.font        = 'bold 20px Lato, sans-serif'
                ctx.fillStyle   = '#ffffff'
                ctx.shadowColor = 'rgba(0,225,255,0.5)'
                ctx.shadowBlur  = 8
                ctx.fillText(this.score.toLocaleString(), 18, 42)
                ctx.restore()

                // lives as small ship icons below score
                const lives = this.maxLives - this.life
                for (let i = 0; i < this.maxLives; i++) {
                    ctx.save()
                    ctx.globalAlpha = i < lives ? 1 : 0.18
                    if (i < lives) { ctx.shadowColor = '#00E1FF'; ctx.shadowBlur = 8 }
                    Game.assets.draw(ctx, Game.assets.get(this.player.sprite), 18 + i * 22, 46, 16, 16)
                    ctx.restore()
                }

                // ── Panel MEJOR (right: W-158,10 → W-10,68) ──────────────
                this.hudPanel(W - 158, 10, 148, 58, 'rgba(255,215,0,0.25)')
                ctx.save()
                ctx.textAlign   = 'right'
                ctx.font        = 'bold 8px Lato, sans-serif'
                ctx.fillStyle   = 'rgba(255,215,0,0.55)'
                ctx.fillText('RÉCORD', W - 18, 24)
                ctx.font        = 'bold 18px Lato, sans-serif'
                ctx.fillStyle   = '#FFD700'
                ctx.shadowColor = 'rgba(255,215,0,0.45)'
                ctx.shadowBlur  = 8
                ctx.fillText(this.highScore.toLocaleString(), W - 18, 48)
                ctx.restore()

                // ── Power-ups (below left panel) ──────────────────────────
                let puY = 74
                const pl = this.player
                if (pl.rapidFire  > 0) puY = this.drawPowerUpHUD(10, puY, '⚡', 'RAPIDFIRE', pl.rapidFire,  6,   '#FF8C00')
                if (pl.tripleShot > 0) puY = this.drawPowerUpHUD(10, puY, '⊕', 'TRIPLE',    pl.tripleShot, 6,   '#9B30FF')
                if (pl.shield     > 0) puY = this.drawPowerUpHUD(10, puY, '◈', 'ESCUDO',    pl.shield,     5,   '#00BFFF')
                if (pl.bombFlash  > 0) puY = this.drawPowerUpHUD(10, puY, '✸', 'BOMBA',     pl.bombFlash,  1,   '#FF2222')

                // ── Combo (right, below panel MEJOR, pop animation) ──────────
                if (this.combo >= 2 && this.comboTimer > 0) {
                    const baseSz  = Math.min(26, 14 + this.combo * 1.2)  // max 26px at combo 10+
                    const color   = this.combo >= 8 ? '#FF4500' : this.combo >= 5 ? '#FF8C00' : '#FFD700'
                    const anchorX = W - 14
                    const anchorY = 82 + baseSz
                    ctx.save()
                    ctx.globalAlpha = Math.min(1, this.comboTimer)
                    ctx.translate(anchorX, anchorY)
                    ctx.scale(this.comboScale, this.comboScale)
                    ctx.textAlign   = 'right'
                    ctx.font        = 'bold ' + baseSz + 'px Lato, sans-serif'
                    ctx.fillStyle   = color
                    ctx.shadowColor = color
                    ctx.shadowBlur  = 20
                    ctx.fillText('x' + this.combo + ' COMBO', 0, 0)
                    ctx.restore()
                }

                // ── Banner de nivel (centrado perfectamente) ──────────────
                if (this.levelUpTimer > 0) {
                    const elapsed = this.bannerDuration - this.levelUpTimer
                    const alpha   = Math.max(0, Math.min(elapsed * 4, 1, this.levelUpTimer * 4))
                    const isBoss  = this.bossActive
                    const recovering = this.waveStage === 'recovery'
                    const accent = isBoss ? '#FF4D25' : recovering ? '#00E1FF' : '#FFD700'
                    const panelY = H / 2 - 44
                    ctx.save()
                    ctx.globalAlpha = alpha
                    const background = ctx.createLinearGradient(0, 0, W, 0)
                    background.addColorStop(0, 'rgba(0,15,26,0.02)')
                    background.addColorStop(0.5, 'rgba(0,15,26,0.14)')
                    background.addColorStop(1, 'rgba(0,15,26,0.02)')
                    ctx.fillStyle = background
                    ctx.fillRect(0, panelY, W, 88)
                    ctx.strokeStyle = isBoss ? 'rgba(255,77,37,0.35)' : 'rgba(0,225,255,0.28)'
                    ctx.lineWidth = 1
                    ctx.beginPath()
                    ctx.moveTo(0, panelY)
                    ctx.lineTo(W, panelY)
                    ctx.moveTo(0, panelY + 88)
                    ctx.lineTo(W, panelY + 88)
                    ctx.stroke()
                    ctx.textAlign    = 'center'
                    ctx.textBaseline = 'middle'
                    ctx.font         = 'bold ' + Math.min(48, (W - 60) / 10) + 'px Lato, sans-serif'
                    ctx.fillStyle    = accent
                    ctx.shadowColor  = accent
                    ctx.shadowBlur   = 26
                    ctx.fillText(this.bannerMessage || (isBoss ? '¡JEFE!' : recovering ? 'ZONA DESPEJADA' : 'NIVEL ' + this.difficulty), W / 2, H / 2)
                    ctx.restore()
                }
            },

        }
    }
}(globalThis.ShootingGame))
