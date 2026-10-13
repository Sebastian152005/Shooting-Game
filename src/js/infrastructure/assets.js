(function (app) {
    const sources = Object.freeze({
        player: 'src/assets/images/nave.png',
        enemy: 'src/assets/images/ovni.png',
        scout: 'src/assets/images/ovni2.png',
        explosion: 'src/assets/images/explosion.png'
    })
    const images = new Map()
    const names = new WeakMap()

    app.assets = {
        get: function (name) {
            if (!Object.prototype.hasOwnProperty.call(sources, name)) {
                throw new Error('Unknown image: ' + name)
            }
            if (!images.has(name)) {
                const image = new Image()
                names.set(image, name)
                images.set(name, image)
                image.src = sources[name]
            }
            return images.get(name)
        },

        preload: function () {
            for (const name of Object.keys(sources)) this.get(name)
        },

        draw: function (ctx, image, x, y, width, height) {
            if (image.complete && image.naturalWidth > 0) {
                ctx.drawImage(image, x, y, width, height)
                return
            }

            // Keep entities visible and playable while a sprite loads or fails.
            const name = names.get(image)
            ctx.save()
            ctx.fillStyle = name === 'explosion' ? '#FF8C00' : name === 'player' ? '#00E1FF' : '#9B30FF'
            ctx.beginPath()
            if (name === 'player') {
                ctx.moveTo(x + width / 2, y)
                ctx.lineTo(x + width, y + height)
                ctx.lineTo(x, y + height)
                ctx.closePath()
            } else {
                ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2)
            }
            ctx.fill()
            ctx.restore()
        }
    }
}(globalThis.ShootingGame))
