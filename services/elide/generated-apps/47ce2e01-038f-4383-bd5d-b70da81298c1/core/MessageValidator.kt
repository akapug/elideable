package core

/**
 * Kotlin-based message validator for type-safe operations
 */
class MessageValidator {
    companion object {
        private const val MIN_LENGTH = 3
        private const val MAX_LENGTH = 200
        
        fun isValidLength(message: String): Boolean {
            return message.length in MIN_LENGTH..MAX_LENGTH
        }
        
        fun containsValidChars(message: String): Boolean {
            // Allow letters, numbers, spaces, and common punctuation
            val validPattern = Regex("^[\\w\\s\\p{Punct}]+$")
            return validPattern.matches(message)
        }
    }
}

/**
 * Validate a message using Kotlin's type safety
 */
fun validateMessage(message: String?): Boolean {
    if (message.isNullOrBlank()) {
        return false
    }
    
    return MessageValidator.isValidLength(message) && 
           MessageValidator.containsValidChars(message)
}

/**
 * Get validation rules as a data class
 */
data class ValidationRules(
    val minLength: Int = 3,
    val maxLength: Int = 200,
    val allowEmojis: Boolean = true
)

fun getValidationRules(): ValidationRules {
    return ValidationRules()
}