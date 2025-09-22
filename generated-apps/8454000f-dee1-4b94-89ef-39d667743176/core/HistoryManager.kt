package core

import kotlin.collections.mutableListOf

/**
 * High-performance calculation history management using Kotlin's type safety
 * and efficient collections.
 */
class CalculationHistory {
    private val calculations: MutableList<String> = mutableListOf()
    private val maxHistorySize: Int = 50
    
    /**
     * Add a new calculation to the history with automatic size management.
     */
    fun addCalculation(calculation: String) {
        if (calculation.isNotBlank()) {
            calculations.add(0, calculation) // Add to beginning for recent-first order
            
            // Maintain maximum history size for optimal performance
            if (calculations.size > maxHistorySize) {
                calculations.removeAt(calculations.size - 1)
            }
        }
    }
    
    /**
     * Get the complete calculation history as an immutable list.
     */
    fun getHistory(): List<String> {
        return calculations.toList()
    }
    
    /**
     * Clear all calculation history.
     */
    fun clearHistory() {
        calculations.clear()
    }
    
    /**
     * Get the most recent calculation.
     */
    fun getLastCalculation(): String? {
        return calculations.firstOrNull()
    }
    
    /**
     * Get a specific number of recent calculations.
     */
    fun getRecentCalculations(count: Int): List<String> {
        return calculations.take(count.coerceAtMost(calculations.size))
    }
    
    /**
     * Search history for calculations containing a specific term.
     */
    fun searchHistory(searchTerm: String): List<String> {
        return calculations.filter { 
            it.contains(searchTerm, ignoreCase = true) 
        }
    }
    
    /**
     * Get statistics about calculation history.
     */
    fun getHistoryStats(): HistoryStats {
        val totalCalculations = calculations.size
        val uniqueOperations = calculations
            .map { extractOperation(it) }
            .distinct()
            .size
            
        return HistoryStats(totalCalculations, uniqueOperations)
    }
    
    /**
     * Extract the operation type from a calculation string.
     */
    private fun extractOperation(calculation: String): String {
        return when {
            calculation.contains("+") -> "addition"
            calculation.contains("-") -> "subtraction"
            calculation.contains("×") || calculation.contains("*") -> "multiplication"
            calculation.contains("÷") || calculation.contains("/") -> "division"
            else -> "unknown"
        }
    }
}

/**
 * Data class for history statistics using Kotlin's data classes for
 * automatic equals, hashCode, and toString implementations.
 */
data class HistoryStats(
    val totalCalculations: Int,
    val uniqueOperations: Int
)

/**
 * Extension function for String to check if it represents a valid number.
 */
fun String.isNumeric(): Boolean {
    return this.toDoubleOrNull() != null
}

/**
 * Utility object for calculation validation using Kotlin's object declaration.
 */
object CalculationValidator {
    
    /**
     * Validate if a calculation string has proper format.
     */
    fun isValidCalculationFormat(calculation: String): Boolean {
        val parts = calculation.split("=")
        return parts.size == 2 && 
               parts[0].trim().isNotEmpty() && 
               parts[1].trim().isNumeric()
    }
    
    /**
     * Extract the result from a calculation string.
     */
    fun extractResult(calculation: String): Double? {
        val parts = calculation.split("=")
        return if (parts.size == 2) {
            parts[1].trim().toDoubleOrNull()
        } else {
            null
        }
    }
}