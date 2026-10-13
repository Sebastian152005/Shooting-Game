(function (app) {
    app.createBrowser = function () {
        return Object.freeze({
            requestFrame: callback => window.requestAnimationFrame(callback),
            cancelFrame: id => window.cancelAnimationFrame(id),
            now: () => performance.now()
        })
    }

    app.createMedia = function (Game) {
        return {
            initVideo: function () {
                // Reuse the loaded video across restarts instead of reloading it.
                if (!this.video) {
                    this.video = document.createElement('video')
                    this.video.id = 'gameVideo'
                    this.video.hidden = true
                    this.video.loop = true
                    this.video.muted = true
                    this.video.playsInline = true
                    this.video.src = 'src/assets/video/espacio.mp4'
                    document.body.appendChild(this.video)
                } else {
                    this.video.pause()
                    this.video.currentTime = 0
                }
                this.video.width = this.view.width
                this.video.height = this.view.height
            },
            playMedia: function () {
                this.video.play().catch(() => {})
                this.audio.play().catch(() => {})
            },
            pauseMedia: function () {
                this.audio.pause()
                this.video.pause()
            }
        }
    }
}(globalThis.ShootingGame))
