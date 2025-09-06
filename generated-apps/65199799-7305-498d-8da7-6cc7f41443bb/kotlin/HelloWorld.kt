// Kotlin Hello World Module for Elide
// Demonstrates high-performance, type-safe operations in a polyglot environment

package com.elide.hello

import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Kotlin Hello World class showcasing type safety and performance
 */
class KotlinGreeter(private val appName: String = "Elide") {
    
    companion object {
        private val GREETINGS = listOf(
            "Hello from Kotlin in %s! ⚡",
            "Kotlin power unleashed in %s! 🚀",
            "High-performance greetings from %s Kotlin! 💪"
        )
        
        const val LANGUAGE = "Kotlin"
        const val VERSION = "1.8+"
    }
    
    /**
     * Generates a random greeting message
     */
    fun getGreeting(): String {
        return GREETINGS.random().format(appName)
    }
    
    /**
     * Returns system information as a data class
     */
    fun getSystemInfo(): SystemInfo {
        return SystemInfo(
            timestamp = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
            language = LANGUAGE,
            version = VERSION,
            runtime = "Elide Polyglot Runtime",
            capabilities = listOf(
                "High Performance",
                "Type Safety",
                "Null Safety",
                "Coroutines",
                "Business Logic"
            )
        )
    }
    
    /**
     * Demonstrates high-performance data processing
     */
    fun processNumbers(numbers: List<Int>): ProcessingResult {
        val startTime = System.nanoTime()
        
        val result = numbers
            .filter { it > 0 }
            .map { it * 2 }
            .sorted()
        
        val endTime = System.nanoTime()
        val duration = (endTime - startTime) / 1_000_000.0 // Convert to milliseconds
        
        return ProcessingResult(
            originalCount = numbers.size,
            processedCount = result.size,
            result = result,
            processingTimeMs = duration,
            summary = "Processed ${numbers.size} numbers in ${String.format("%.2f", duration)}ms with Kotlin"
        )
    }
    
    /**
     * Type-safe string processing
     */
    fun processText(text: String): TextProcessingResult {
        return TextProcessingResult(
            original = text,
            uppercase = text.uppercase(),
            lowercase = text.lowercase(),
            wordCount = text.split("\\s+".toRegex()).size,
            characterCount = text.length,
            reversed = text.reversed(),
            summary = "Text processed with Kotlin type safety"
        )
    }
}

/**
 * Data class for system information
 */
data class SystemInfo(
    val timestamp: String,
    val language: String,
    val version: String,
    val runtime: String,
    val capabilities: List<String>
)

/**
 * Data class for number processing results
 */
data class ProcessingResult(
    val originalCount: Int,
    val processedCount: Int,
    val result: List<Int>,
    val processingTimeMs: Double,
    val summary: String
)

/**
 * Data class for text processing results
 */
data class TextProcessingResult(
    val original: String,
    val uppercase: String,
    val lowercase: String,
    val wordCount: Int,
    val characterCount: Int,
    val reversed: String,
    val summary: String
)

/**
 * Main function demonstrating Kotlin functionality
 */
fun main() {
    println("=== Kotlin Hello World in Elide ===")
    
    val greeter = KotlinGreeter("Elide Hello World")
    
    // Basic greeting
    println(greeter.getGreeting())
    
    // System info
    println("\nSystem Info:")
    val sysInfo = greeter.getSystemInfo()
    println("Language: ${sysInfo.language} ${sysInfo.version}")
    println("Runtime: ${sysInfo.runtime}")
    println("Capabilities: ${sysInfo.capabilities.joinToString(", ")}")
    
    // Number processing demo
    val numbers = listOf(1, -2, 3, 4, -5, 6, 7, 8, 9, 10)
    val numberResult = greeter.processNumbers(numbers)
    println("\nNumber Processing:")
    println(numberResult.summary)
    println("Result: ${numberResult.result}")
    
    // Text processing demo
    val textResult = greeter.processText("Hello Elide Kotlin World")
    println("\nText Processing:")
    println(textResult.summary)
    println("Uppercase: ${textResult.uppercase}")
    println("Word count: ${textResult.wordCount}")
}