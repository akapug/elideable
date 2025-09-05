package core

import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Kotlin-powered message formatting with type safety
 */
class MessageFormatter {
    companion object {
        private val EMOJI_MAP = mapOf(
            "hello" to "👋",
            "greetings" to "🎉",
            "welcome" to "🌟",
            "hi" to "😊",
            "good" to "☀️",
            "hola" to "🇪🇸",
            "bonjour" to "🇫🇷"
        )
        
        private val TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss")
    }
    
    fun formatMessage(greeting: String, timestamp: String): String {
        // Type-safe string operations in Kotlin
        val lowerGreeting = greeting.lowercase()
        
        // Find appropriate emoji
        val emoji = EMOJI_MAP.entries
            .find { (key, _) -> lowerGreeting.contains(key) }
            ?.value ?: "👋"
        
        // Add Kotlin-powered enhancements
        return buildString {
            append(emoji)
            append(" ")
            append(greeting)
            append(" ")
            append(getTimeBasedEmoji(timestamp))
        }
    }
    
    private fun getTimeBasedEmoji(timestamp: String): String {
        return try {
            val hour = timestamp.split(":")[0].toInt()
            when (hour) {
                in 6..11 -> "🌅"  // Morning
                in 12..17 -> "☀️" // Afternoon
                in 18..21 -> "🌆" // Evening
                else -> "🌙"      // Night
            }
        } catch (e: Exception) {
            "⏰"
        }
    }
}

// Extension function for easy access
fun formatMessage(greeting: String, timestamp: String): String {
    return MessageFormatter().formatMessage(greeting, timestamp)
}