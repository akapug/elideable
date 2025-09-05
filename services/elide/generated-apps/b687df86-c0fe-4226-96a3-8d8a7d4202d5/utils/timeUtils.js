/**
 * JavaScript utility functions for time handling
 */

/**
 * Get current time in HH:MM:SS format
 * @returns {string} Formatted time string
 */
export function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Get a human-readable timestamp
 * @returns {string} Full timestamp
 */
export function getFullTimestamp() {
    const now = new Date();
    return now.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Calculate time difference in milliseconds
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time (defaults to now)
 * @returns {number} Time difference in ms
 */
export function getTimeDifference(startTime, endTime = new Date()) {
    return endTime.getTime() - startTime.getTime();
}

/**
 * Format duration in a human-readable way
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}