(function (app) {
    app.createAudio = function (Game) {
        return {
            playLaser: function () {
                this.sfxLaser.currentTime = 0
                this.sfxLaser.play().catch(() => {})
            },
            playExplosion: function () {
                this.sfxExplosion.currentTime = 0
                this.sfxExplosion.play().catch(() => {})
            },
            initAudio: function () {
                // shared AudioContext — created once, reused for all synth sounds
                if (!this.audioCtx) {
                    try { this.audioCtx = new (window.AudioContext || window.webkitAudioContext)() } catch (e) {}
                }
                if (this.audioCtx && !this.effectsGain) {
                    this.effectsGain = this.audioCtx.createGain()
                    this.effectsGain.connect(this.audioCtx.destination)
                }

                this.audio = this.audio || new Audio('src/assets/audio/fondo.mp3')
                this.audio.loop   = true
                this.sfxLaser = this.sfxLaser || new Audio('src/assets/audio/laser.mp3')
                this.sfxExplosion = this.sfxExplosion || new Audio('src/assets/audio/explosion.mp3')
                for (const media of [this.audio, this.sfxLaser, this.sfxExplosion]) {
                    media.pause()
                    media.currentTime = 0
                }
                this.updateAudioSettings(Game.settings.get())
            },

            updateAudioSettings: function (settings) {
                this.audio.volume = settings.music
                this.sfxLaser.volume = settings.effects * 0.8
                this.sfxExplosion.volume = settings.effects
                for (const audio of [this.audio, this.sfxLaser, this.sfxExplosion]) audio.muted = settings.muted
                if (this.effectsGain) this.effectsGain.gain.value = settings.muted ? 0 : settings.effects
            },

            resumeAudioContext: function () {
                const ac = Game.audioCtx
                if (!ac) return null
                if (ac.state === 'suspended') ac.resume().catch(() => {})
                return ac
            },

            playLevelUpSound: function () {
                const ac = this.resumeAudioContext(); if (!ac) return
                const osc = ac.createOscillator(), gain = ac.createGain()
                osc.connect(gain); gain.connect(Game.effectsGain)
                osc.type = 'square'
                osc.frequency.setValueAtTime(523, ac.currentTime)
                osc.frequency.setValueAtTime(659, ac.currentTime + 0.1)
                osc.frequency.setValueAtTime(784, ac.currentTime + 0.2)
                gain.gain.setValueAtTime(0.12, ac.currentTime)
                gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5)
                osc.start(); osc.stop(ac.currentTime + 0.5)
            },

            playTripleShotSound: function () {
                const ac = this.resumeAudioContext(); if (!ac) return
                for (let i = 0; i < 3; i++) {
                    const osc = ac.createOscillator(), gain = ac.createGain()
                    osc.connect(gain); gain.connect(Game.effectsGain)
                    osc.type = 'sawtooth'
                    const t = ac.currentTime + i * 0.035
                    osc.frequency.setValueAtTime(1400 - i * 200, t)
                    osc.frequency.exponentialRampToValueAtTime(300, t + 0.1)
                    gain.gain.setValueAtTime(0.11, t)
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
                    osc.start(t); osc.stop(t + 0.15)
                }
            },

            playBombSound: function () {
                const ac = this.resumeAudioContext(); if (!ac) return
                // noise burst — louder and longer
                const dur = 1.1, bufSize = Math.floor(ac.sampleRate * dur)
                const buf = ac.createBuffer(1, bufSize, ac.sampleRate)
                const data = buf.getChannelData(0)
                for (let i = 0; i < bufSize; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 0.3)
                }
                const src = ac.createBufferSource()
                src.buffer = buf
                const filter = ac.createBiquadFilter()
                filter.type = 'lowpass'
                filter.frequency.setValueAtTime(700, ac.currentTime)
                filter.frequency.exponentialRampToValueAtTime(30, ac.currentTime + dur)
                const gain = ac.createGain()
                gain.gain.setValueAtTime(5.0, ac.currentTime)
                gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur)
                src.connect(filter); filter.connect(gain); gain.connect(Game.effectsGain)
                src.start()
                // sub-bass kick thump
                const kick = ac.createOscillator(), kickGain = ac.createGain()
                kick.connect(kickGain); kickGain.connect(Game.effectsGain)
                kick.type = 'sine'
                kick.frequency.setValueAtTime(130, ac.currentTime)
                kick.frequency.exponentialRampToValueAtTime(18, ac.currentTime + 0.35)
                kickGain.gain.setValueAtTime(4.0, ac.currentTime)
                kickGain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4)
                kick.start(); kick.stop(ac.currentTime + 0.4)
            },

            playHitSound: function () {
                const ac = this.resumeAudioContext(); if (!ac) return
                // tono descendente (impacto)
                const osc = ac.createOscillator(), gain = ac.createGain()
                osc.connect(gain); gain.connect(Game.effectsGain)
                osc.type = 'sawtooth'
                osc.frequency.setValueAtTime(260, ac.currentTime)
                osc.frequency.exponentialRampToValueAtTime(38, ac.currentTime + 0.32)
                gain.gain.setValueAtTime(0.38, ac.currentTime)
                gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.36)
                osc.start(); osc.stop(ac.currentTime + 0.36)
                // burst de ruido corto (crujido)
                const bufSize = Math.floor(ac.sampleRate * 0.12)
                const buf = ac.createBuffer(1, bufSize, ac.sampleRate)
                const data = buf.getChannelData(0)
                for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.8)
                const src = ac.createBufferSource()
                src.buffer = buf
                const filter = ac.createBiquadFilter()
                filter.type = 'bandpass'
                filter.frequency.setValueAtTime(500, ac.currentTime)
                const ng = ac.createGain()
                ng.gain.setValueAtTime(1.2, ac.currentTime)
                ng.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12)
                src.connect(filter); filter.connect(ng); ng.connect(Game.effectsGain)
                src.start()
            },

            playPowerUpSound: function (type) {
                const ac = this.resumeAudioContext(); if (!ac) return
                switch (type) {
                    case 'rapidfire': {
                        const o = ac.createOscillator(), g = ac.createGain()
                        o.connect(g); g.connect(Game.effectsGain); o.type = 'square'
                        o.frequency.setValueAtTime(440, ac.currentTime)
                        o.frequency.setValueAtTime(880, ac.currentTime + 0.06)
                        o.frequency.setValueAtTime(1320, ac.currentTime + 0.12)
                        g.gain.setValueAtTime(0.14, ac.currentTime)
                        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.22)
                        o.start(); o.stop(ac.currentTime + 0.22); break
                    }
                    case 'shield': {
                        const o = ac.createOscillator(), g = ac.createGain()
                        o.connect(g); g.connect(Game.effectsGain); o.type = 'sine'
                        o.frequency.setValueAtTime(220, ac.currentTime)
                        o.frequency.linearRampToValueAtTime(550, ac.currentTime + 0.35)
                        g.gain.setValueAtTime(0.18, ac.currentTime)
                        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4)
                        o.start(); o.stop(ac.currentTime + 0.4); break
                    }
                    case 'triple': {
                        for (let i = 0; i < 3; i++) {
                            const o = ac.createOscillator(), g = ac.createGain()
                            o.connect(g); g.connect(Game.effectsGain); o.type = 'triangle'
                            const t = ac.currentTime + i * 0.075
                            o.frequency.setValueAtTime(500 + i * 250, t)
                            g.gain.setValueAtTime(0.14, t)
                            g.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
                            o.start(t); o.stop(t + 0.1)
                        }
                        break
                    }
                    case 'bomb': {
                        const o = ac.createOscillator(), g = ac.createGain()
                        o.connect(g); g.connect(Game.effectsGain); o.type = 'sawtooth'
                        o.frequency.setValueAtTime(420, ac.currentTime)
                        o.frequency.exponentialRampToValueAtTime(35, ac.currentTime + 0.45)
                        g.gain.setValueAtTime(0.55, ac.currentTime)
                        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5)
                        o.start(); o.stop(ac.currentTime + 0.5); break
                    }
                }
            },

        }
    }
}(globalThis.ShootingGame))
