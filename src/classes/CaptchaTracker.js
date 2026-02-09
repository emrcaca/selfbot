/**
 * CaptchaTracker Class
 * Tracks sent CAPTCHA notifications to avoid spam
 */
class CaptchaTracker {
    constructor() {
        this.notifications = new Map();
    }

    /**
     * Mark a CAPTCHA notification as sent for a user
     * @param {string} userId - User ID
     * @param {boolean} success - Whether notification was successful
     */
    markSent(userId, success = true) {
        this.notifications.set(userId, {
            sent: success,
            timestamp: Date.now()
        });
    }

    /**
     * Check if a CAPTCHA notification has been sent for a user
     * @param {string} userId - User ID
     * @returns {boolean} Whether notification was marked as sent
     */
    wasSent(userId) {
        const record = this.notifications.get(userId);
        return record?.sent || false;
    }

    /**
     * Get notification record for a user
     * @param {string} userId - User ID
     * @returns {Object|null} Notification record or null
     */
    getRecord(userId) {
        return this.notifications.get(userId) || null;
    }

    /**
     * Clear all notification records
     */
    clearAll() {
        this.notifications.clear();
    }

    /**
     * Get count of stored notifications
     * @returns {number}
     */
    get size() {
        return this.notifications.size;
    }
}

module.exports = CaptchaTracker;
