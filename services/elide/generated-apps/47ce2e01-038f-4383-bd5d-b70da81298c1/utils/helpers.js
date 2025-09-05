/**
 * JavaScript utility functions for the polyglot app
 */

/**
 * Format timestamp for display
 * @param {Date} date - The date to format
 * @returns {string} Formatted timestamp
 */
function formatTimestamp(date) {
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    
    return date.toLocaleDateString('en-US', options);
}

/**
 * Generate a random color for styling
 * @returns {string} CSS color value
 */
function getRandomColor() {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', 
        '#96CEB4', '#FFEAA7', '#DDA0DD'
    ];
    
    return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Simple logging utility
 * @param {string} message - Message to log
 * @param {string} level - Log level (info, warn, error)
 */
function log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    console[level](`[${timestamp}] ${message}`);
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatTimestamp,
        getRandomColor,
        log
    };
}