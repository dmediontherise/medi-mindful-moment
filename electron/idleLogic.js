/**
 * Decoupled Idle Detection & Retrigger Suppression Logic.
 */
export class IdleManager {
    constructor({ thresholdMinutes = 5, onTrigger, onDismiss } = {}) {
        this.setThresholdMinutes(thresholdMinutes);
        this.isScreensaverActive = false;
        this.dismissedAtIdleTime = null;
        this.onTrigger = onTrigger;
        this.onDismiss = onDismiss;
    }

    setThresholdMinutes(minutes) {
        const parsed = Number(minutes);
        const validMinutes = Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
        this.thresholdSeconds = Math.round(validMinutes * 60);
    }

    /**
     * Evaluates current system idle time (in seconds).
     * 
     * @param {number} currentIdleSeconds - System idle time in seconds
     * @returns {string} 'triggered' | 'idle' | 'suppressed'
     */
    evaluateIdleTime(currentIdleSeconds) {
        const idleSec = Math.max(0, Number(currentIdleSeconds) || 0);

        // Reset dismissal gate if system idle time resets (user interaction registered by OS)
        if (this.dismissedAtIdleTime !== null) {
            if (idleSec < this.dismissedAtIdleTime || idleSec < 5) {
                this.dismissedAtIdleTime = null;
            }
        }

        // If screensaver is currently active, no new trigger needed
        if (this.isScreensaverActive) {
            return 'active';
        }

        // If screensaver was recently dismissed and system idle time hasn't reset yet, suppress retrigger
        if (this.dismissedAtIdleTime !== null && idleSec >= this.thresholdSeconds) {
            return 'suppressed';
        }

        // Check if idle threshold reached
        if (idleSec >= this.thresholdSeconds && this.dismissedAtIdleTime === null) {
            this.isScreensaverActive = true;
            if (typeof this.onTrigger === 'function') {
                this.onTrigger();
            }
            return 'triggered';
        }

        return 'idle';
    }

    /**
     * Dismisses the screensaver and records the current system idle time to suppress immediate retriggering.
     * 
     * @param {number} currentIdleSeconds 
     * @returns {string} 'dismissed' | 'none'
     */
    recordDismissal(currentIdleSeconds = null) {
        if (this.isScreensaverActive) {
            this.isScreensaverActive = false;
            this.dismissedAtIdleTime = currentIdleSeconds !== null ? Math.max(0, Number(currentIdleSeconds) || 0) : 0;
            if (typeof this.onDismiss === 'function') {
                this.onDismiss();
            }
            return 'dismissed';
        }
        return 'none';
    }

    reset() {
        this.isScreensaverActive = false;
        this.dismissedAtIdleTime = null;
    }
}
