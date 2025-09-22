/**
 * JavaScript utility functions for the Elide polyglot app
 * Handles data formatting, UI helpers, and cross-language integration
 */

/**
 * Format different types of data for display
 * @param {any} value - The value to format
 * @param {string} type - The type of formatting to apply
 * @returns {string} Formatted string
 */
function formatData(value, type) {
  switch (type) {
    case 'number':
      return new Intl.NumberFormat('en-US').format(value);
    
    case 'percentage':
      return `${value}%`;
    
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(value);
    
    case 'decimal':
      return parseFloat(value).toFixed(2);
    
    case 'capitalize':
      return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    
    case 'title':
      return value.replace(/\b\w+/g, word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      );
    
    default:
      return String(value);
  }
}

/**
 * Debounce function to limit rapid function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
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
 * Throttle function to limit function execution frequency
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Generate a random ID for components
 * @param {number} length - Length of the ID
 * @returns {string} Random ID string
 */
function generateId(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Deep clone an object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  
  if (typeof obj === 'object') {
    const cloned = {};
    Object.keys(obj).forEach(key => {
      cloned[key] = deepClone(obj[key]);
    });
    return cloned;
  }
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get color based on sentiment or score
 * @param {string|number} value - Sentiment string or numeric score
 * @returns {string} CSS color value
 */
function getStatusColor(value) {
  if (typeof value === 'string') {
    const sentiment = value.toLowerCase();
    switch (sentiment) {
      case 'positive':
      case 'very positive':
        return '#28a745';
      case 'negative':
      case 'very negative':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  }
  
  if (typeof value === 'number') {
    if (value >= 80) return '#28a745';
    if (value >= 60) return '#ffc107';
    if (value >= 40) return '#fd7e14';
    return '#dc3545';
  }
  
  return '#6c757d';
}

/**
 * Convert text to URL-friendly slug
 * @param {string} text - Text to convert
 * @returns {string} URL slug
 */
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Calculate reading time estimate
 * @param {string} text - Text to analyze
 * @param {number} wpm - Words per minute (default: 200)
 * @returns {number} Reading time in minutes
 */
function calculateReadingTime(text, wpm = 200) {
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / wpm);
  return Math.max(1, minutes);
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Local storage helpers with error handling
 */
const storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn('Error reading from localStorage:', error);
      return defaultValue;
    }
  },
  
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('Error writing to localStorage:', error);
      return false;
    }
  },
  
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn('Error removing from localStorage:', error);
      return false;
    }
  },
  
  clear() {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.warn('Error clearing localStorage:', error);
      return false;
    }
  }
};

/**
 * Performance monitoring utilities
 */
const performance = {
  mark(name) {
    if (window.performance && window.performance.mark) {
      window.performance.mark(name);
    }
  },
  
  measure(name, startMark, endMark) {
    if (window.performance && window.performance.measure) {
      try {
        window.performance.measure(name, startMark, endMark);
        const measure = window.performance.getEntriesByName(name)[0];
        return measure ? measure.duration : null;
      } catch (error) {
        console.warn('Performance measurement failed:', error);
        return null;
      }
    }
    return null;
  },
  
  time(label) {
    console.time(label);
  },
  
  timeEnd(label) {
    console.timeEnd(label);
  }
};

/**
 * API call wrapper with error handling
 * @param {string} url - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise} API response
 */
async function apiCall(url, options = {}) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };
  
  try {
    const response = await fetch(url, defaultOptions);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return await response.text();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = {
    formatData,
    debounce,
    throttle,
    generateId,
    deepClone,
    isValidEmail,
    getStatusColor,
    slugify,
    calculateReadingTime,
    formatFileSize,
    storage,
    performance,
    apiCall
  };
} else if (typeof window !== 'undefined') {
  // Browser environment
  window.HelperUtils = {
    formatData,
    debounce,
    throttle,
    generateId,
    deepClone,
    isValidEmail,
    getStatusColor,
    slugify,
    calculateReadingTime,
    formatFileSize,
    storage,
    performance,
    apiCall
  };
}

// Example usage and testing
if (typeof require === 'function') {
  // Test the utilities
  console.log('Testing JavaScript utilities...');
  console.log('Formatted number:', formatData(1234567, 'number'));
  console.log('Generated ID:', generateId());
  console.log('Reading time for 500 words:', calculateReadingTime('word '.repeat(500)));
  console.log('File size format:', formatFileSize(1024 * 1024 * 2.5));
}