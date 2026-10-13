(function (app) {
    app.bindAudioSettings = function (container, onChange = () => {}, settingsStore) {
        if (!container) return
        container.innerHTML = `
            <summary>SONIDO</summary>
            <div class="audio-settings-body">
                <label for="musicVolume">Música <output data-music-value for="musicVolume"></output></label>
                <input id="musicVolume" data-music-volume type="range" min="0" max="100" step="1">
                <label for="effectsVolume">Efectos <output data-effects-value for="effectsVolume"></output></label>
                <input id="effectsVolume" data-effects-volume type="range" min="0" max="100" step="1">
                <button data-mute type="button" aria-pressed="false">Silenciar todo</button>
            </div>`
        const music = container.querySelector('[data-music-volume]')
        const effects = container.querySelector('[data-effects-volume]')
        const mute = container.querySelector('[data-mute]')
        const render = settings => {
            music.value = Math.round(settings.music * 100)
            effects.value = Math.round(settings.effects * 100)
            container.querySelector('[data-music-value]').textContent = music.value + '%'
            container.querySelector('[data-effects-value]').textContent = effects.value + '%'
            mute.textContent = settings.muted ? 'Activar sonido' : 'Silenciar todo'
            mute.setAttribute('aria-pressed', String(settings.muted))
        }
        const update = changes => {
            const settings = settingsStore.update(changes)
            render(settings)
            onChange(settings)
        }
        music.addEventListener('input', () => update({ music: Number(music.value) / 100 }))
        effects.addEventListener('input', () => update({ effects: Number(effects.value) / 100 }))
        mute.addEventListener('click', () => update({ muted: !app.settings.get().muted }))
        render(settingsStore.get())
        // A cached menu can return after settings changed on the game page.
        window.addEventListener('pageshow', () => {
            const settings = settingsStore.refresh()
            render(settings)
            onChange(settings)
        })
    }
}(globalThis.ShootingGame))
