(function (app) {
    app.createRewardDialog = function () {
        let dialog = null
        let selectionHandler = null

        function createDialog() {
            if (dialog || typeof document === 'undefined' || typeof document.createElement !== 'function') return dialog
            const candidate = document.createElement('dialog')
            if (!candidate || typeof candidate.showModal !== 'function'
                || typeof candidate.appendChild !== 'function' || typeof candidate.replaceChildren !== 'function') return null

            candidate.id = 'bossRewardDialog'
            candidate.className = 'boss-reward-dialog'
            candidate.setAttribute('aria-labelledby', 'bossRewardTitle')
            candidate.setAttribute('aria-describedby', 'bossRewardDescription')
            candidate.addEventListener('cancel', event => event.preventDefault())
            document.body.appendChild(candidate)
            dialog = candidate
            return dialog
        }

        function rewardButton(choice, position) {
            const button = document.createElement('button')
            button.type = 'button'
            button.className = 'boss-reward-option'
            button.setAttribute('aria-label', choice.title + '. ' + choice.description)
            const title = document.createElement('strong')
            title.textContent = position + '. ' + choice.title + '  NIVEL ' + Math.min(choice.maxLevel, choice.level + 1)
            const description = document.createElement('span')
            description.textContent = choice.description
            button.appendChild(title)
            button.appendChild(description)
            button.addEventListener('click', () => selectionHandler?.(choice.id))
            return button
        }

        return {
            canShowRewardChoice: function () { return Boolean(createDialog()) },
            showRewardChoice: function (choices, onSelect) {
                const target = createDialog()
                if (!target || target.open) return false
                selectionHandler = onSelect
                const title = document.createElement('h2')
                title.id = 'bossRewardTitle'
                title.textContent = 'Mejora de misión'
                const description = document.createElement('p')
                description.id = 'bossRewardDescription'
                description.textContent = 'Jefe derrotado. Elige una mejora para continuar.'
                target.replaceChildren(title, description,
                    ...choices.map((choice, index) => rewardButton(choice, index + 1)))
                target.showModal()
                const firstButton = target.querySelector('button')
                firstButton?.focus()
                return true
            },
            hideRewardChoice: function () {
                selectionHandler = null
                if (dialog?.open) dialog.close()
            }
        }
    }
}(globalThis.ShootingGame))
