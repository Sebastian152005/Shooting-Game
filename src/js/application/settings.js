(function (app) {
    app.createSettings = function (storage, defaults) {
        const volume = (value, fallback) => typeof value === 'number' && Number.isFinite(value)
            ? Math.max(0, Math.min(1, value)) : fallback
        const normalize = settings => ({
            music: volume(settings?.music, defaults.music),
            effects: volume(settings?.effects, defaults.effects),
            muted: typeof settings?.muted === 'boolean' ? settings.muted : defaults.muted
        })
        let current = normalize(storage.readAudioSettings())

        return {
            get: function () { return { ...current } },
            refresh: function () {
                const persisted = storage.readAudioSettings()
                if (persisted && typeof persisted === 'object' && !Array.isArray(persisted)) current = normalize(persisted)
                return this.get()
            },
            update: function (changes) {
                current = normalize({ ...current, ...changes })
                storage.writeAudioSettings(current)
                return this.get()
            }
        }
    }
}(globalThis.ShootingGame))
