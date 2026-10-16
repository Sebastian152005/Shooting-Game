(function (app) {
    app.createRewardSystem = function (Game) {
        const config = Game.config.rewards
        return {
            initializeRewardProgress: function () {
                this.playerProgress = this.storage.readProgress()
                this.rewardEffects = this.rules.rewardEffects(this.playerProgress, this.config.energy, config)
                this.activeRewardChoices = []
                this.rewardPauseOwned = false
                this.hideRewardChoice?.()
            },

            recordBossDefeat: function () {
                if (!this.playerProgress) this.initializeRewardProgress()
                this.playerProgress.bossesDefeated++
                this.playerProgress = this.storage.writeProgress(this.playerProgress)
            },

            offerBossRewards: function () {
                if (!this.playerProgress || this.isGameOver || this.activeRewardChoices?.length) return false
                const choices = this.rules.rewardOptions(this.playerProgress, config.optionCount,
                    this.randomFloat, config.maxLevel)
                if (choices.length !== config.optionCount || !this.canShowRewardChoice?.()) return false

                this.activeRewardChoices = choices
                this.rewardPauseOwned = !this.paused
                if (this.rewardPauseOwned) {
                    this.pause()
                    this.hidePause()
                }
                const shown = this.showRewardChoice(choices, rewardId => this.selectBossReward(rewardId))
                if (!shown) {
                    this.activeRewardChoices = []
                    if (this.rewardPauseOwned) this.unPause()
                    this.rewardPauseOwned = false
                }
                return shown
            },

            selectBossReward: function (rewardId) {
                if (!this.activeRewardChoices?.some(choice => choice.id === rewardId)) return false
                this.playerProgress = this.rules.applyReward(this.playerProgress, rewardId, config.maxLevel)
                this.playerProgress = this.storage.writeProgress(this.playerProgress)
                this.rewardEffects = this.rules.rewardEffects(this.playerProgress, this.config.energy, config)
                this.activeRewardChoices = []
                this.hideRewardChoice?.()
                const shouldResume = this.rewardPauseOwned
                this.rewardPauseOwned = false
                if (shouldResume && !this.isGameOver) this.unPause()
                return true
            },

            resetRewardChoice: function () {
                this.activeRewardChoices = []
                this.rewardPauseOwned = false
                this.hideRewardChoice?.()
            }
        }
    }
}(globalThis.ShootingGame))
