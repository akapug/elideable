/**
 * JavaScript utility functions for number formatting and display logic.
 * Uses JavaScript's flexible type system and built-in number formatting.
 */

/**
 * Format calculation results for display with appropriate precision.
 * @param {number} result - The numerical result to format
 * @returns {string} Formatted result string
 */
export function formatResult(result) {
    try {
        // Handle special cases
        if (!isFinite(result)) {
            return 'Error';
        }
        
        if (result === 0) {
            return '0';
        }
        
        // For very large or very small numbers, use exponential notation
        if (Math.abs(result) >= 1e15 || (Math.abs(result) < 1e-6 && result !== 0)) {
            return result.toExponential(6);
        }
        
        // For integers or numbers with minimal decimal places
        if (Number.isInteger(result)) {
            return result.toString();
        }
        
        // Round to avoid floating point precision issues
        const rounded = Math.round(result * 1e10) / 1e10;
        
        // Format with appropriate decimal places
        if (Math.abs(rounded) >= 1000000) {
            return rounded.toLocaleString('en-US', {
                maximumFractionDigits: 2
            });
        }
        
        return rounded.toString();
        
    } catch (error) {
        return 'Error';
    }
}

/**
 * Validate user input for calculator operations.
 * @param {string} input - The input string to validate
 * @returns {boolean} True if input is valid
 */
export function validateInput(input) {
    if (typeof input !== 'string' || input.length === 0) {
        return false;
    }
    
    // Check for valid calculator characters
    const validPattern = /^[0-9+\-*/().\s×÷]+$/;
    return validPattern.test(input);
}

/**
 * Format numbers with thousands separators for better readability.
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
export function formatNumber(num) {
    if (typeof num !== 'number' || !isFinite(num)) {
        return '0';
    }
    
    return num.toLocaleString('en-US', {
        maximumFractionDigits: 10
    });
}

/**
 * Debounce function for performance optimization.
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Generate unique IDs for calculation entries.
 * @returns {string} Unique identifier
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Parse display string to extract numbers and operators.
 * @param {string} display - Calculator display string
 * @returns {Object} Parsed components
 */
export function parseExpression(display) {
    const tokens = display.match(/\d+\.?\d*|[+\-*/×÷()]/g) || [];
    
    return {
        tokens,
        hasOperator: tokens.some(token => /[+\-*/×÷]/.test(token)),
        lastToken: tokens[tokens.length - 1] || '',
        isComplete: tokens.length > 0 && !/[+\-*/×÷]$/.test(display.trim())
    };
}

/**
 * Calculate percentage of a number.
 * @param {number} value - The value
 * @param {number} percentage - Percentage to calculate
 * @returns {number} Calculated percentage
 */
export function calculatePercentage(value, percentage) {
    return (value * percentage) / 100;
}

/**
 * Round number to specified decimal places.
 * @param {number} num - Number to round
 * @param {number} decimals - Number of decimal places
 * @returns {number} Rounded number
 */
export function roundToDecimals(num, decimals = 2) {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
}

/**
 * Check if a string represents a valid number.
 * @param {string} str - String to check
 * @returns {boolean} True if valid number
 */
export function isValidNumber(str) {
    return !isNaN(str) && !isNaN(parseFloat(str)) && isFinite(str);
}

/**
 * Animation helper for smooth transitions.
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} duration - Animation duration in ms
 * @param {Function} callback - Callback function
 */
export function animate(start, end, duration, callback) {
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const value = start + (end - start) * progress;
        callback(value);
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}