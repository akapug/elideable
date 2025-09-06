package core

import kotlin.math.roundToInt
import kotlin.math.sqrt
import kotlin.random.Random

/**
 * High-performance analytics engine built in Kotlin for Elide polyglot app
 * Processes text analysis results and generates actionable metrics
 */
data class AnalysisResult(
    val sentiment: String,
    val wordCount: Int,
    val readabilityScore: Double,
    val keywords: List<String>
)

data class MetricsResult(
    val score: Int,
    val category: String,
    val recommendations: List<String>
)

class AnalyticsEngine {
    
    companion object {
        private const val WEIGHT_SENTIMENT = 0.3
        private const val WEIGHT_READABILITY = 0.4
        private const val WEIGHT_WORD_COUNT = 0.2
        private const val WEIGHT_KEYWORDS = 0.1
        
        private val POSITIVE_SENTIMENTS = setOf("positive", "very positive", "excellent")
        private val NEGATIVE_SENTIMENTS = setOf("negative", "very negative", "poor")
    }
    
    /**
     * Calculate comprehensive metrics from text analysis results
     */
    fun calculateMetrics(analysis: AnalysisResult): MetricsResult {
        val sentimentScore = calculateSentimentScore(analysis.sentiment)
        val readabilityScore = normalizeReadabilityScore(analysis.readabilityScore)
        val wordCountScore = calculateWordCountScore(analysis.wordCount)
        val keywordScore = calculateKeywordScore(analysis.keywords)
        
        // Weighted composite score
        val compositeScore = (
            sentimentScore * WEIGHT_SENTIMENT +
            readabilityScore * WEIGHT_READABILITY +
            wordCountScore * WEIGHT_WORD_COUNT +
            keywordScore * WEIGHT_KEYWORDS
        ).roundToInt()
        
        val category = determineCategory(compositeScore)
        val recommendations = generateRecommendations(analysis, compositeScore)
        
        return MetricsResult(
            score = compositeScore,
            category = category,
            recommendations = recommendations
        )
    }
    
    /**
     * Calculate sentiment score (0-100)
     */
    private fun calculateSentimentScore(sentiment: String): Double {
        return when (sentiment.lowercase()) {
            "positive" -> 85.0
            "very positive" -> 95.0
            "negative" -> 25.0
            "very negative" -> 15.0
            else -> 50.0 // neutral
        }
    }
    
    /**
     * Normalize readability score to 0-100 scale
     */
    private fun normalizeReadabilityScore(readability: Double): Double {
        // Clamp between 0 and 100
        return when {
            readability < 0 -> 0.0
            readability > 100 -> 100.0
            else -> readability
        }
    }
    
    /**
     * Calculate word count score based on optimal range
     */
    private fun calculateWordCountScore(wordCount: Int): Double {
        return when {
            wordCount < 10 -> 20.0 // Too short
            wordCount in 10..50 -> 60.0 // Short but acceptable
            wordCount in 51..200 -> 85.0 // Good length
            wordCount in 201..500 -> 90.0 // Optimal length
            wordCount in 501..1000 -> 75.0 // Long but manageable
            else -> 50.0 // Very long
        }
    }
    
    /**
     * Calculate keyword diversity score
     */
    private fun calculateKeywordScore(keywords: List<String>): Double {
        val keywordCount = keywords.size
        return when {
            keywordCount == 0 -> 20.0
            keywordCount in 1..2 -> 40.0
            keywordCount in 3..5 -> 80.0
            keywordCount in 6..8 -> 90.0
            else -> 70.0 // Too many keywords might indicate lack of focus
        }
    }
    
    /**
     * Determine performance category based on composite score
     */
    private fun determineCategory(score: Int): String {
        return when {
            score >= 90 -> "Excellent"
            score >= 80 -> "Very Good"
            score >= 70 -> "Good"
            score >= 60 -> "Fair"
            score >= 50 -> "Needs Improvement"
            else -> "Poor"
        }
    }
    
    /**
     * Generate contextual recommendations based on analysis
     */
    private fun generateRecommendations(
        analysis: AnalysisResult,
        score: Int
    ): List<String> {
        val recommendations = mutableListOf<String>()
        
        // Sentiment-based recommendations
        when (analysis.sentiment.lowercase()) {
            "negative", "very negative" -> {
                recommendations.add("🔄 Consider revising tone to be more positive or neutral")
                recommendations.add("💡 Add more solution-oriented language")
            }
            "neutral" -> {
                recommendations.add("✨ Consider adding more engaging, positive language")
            }
        }
        
        // Word count recommendations
        when {
            analysis.wordCount < 10 -> {
                recommendations.add("📝 Content is very brief - consider expanding with more details")
            }
            analysis.wordCount < 50 -> {
                recommendations.add("📚 Add more context and examples to improve comprehension")
            }
            analysis.wordCount > 500 -> {
                recommendations.add("✂️ Consider breaking into smaller, more digestible sections")
            }
        }
        
        // Readability recommendations
        if (analysis.readabilityScore < 50) {
            recommendations.add("🎯 Simplify sentence structure for better readability")
            recommendations.add("💭 Use shorter sentences and common vocabulary")
        }
        
        // Keyword recommendations
        when {
            analysis.keywords.isEmpty() -> {
                recommendations.add("🔑 Add more specific, relevant keywords")
            }
            analysis.keywords.size < 3 -> {
                recommendations.add("🌟 Include more diverse vocabulary and key terms")
            }
            analysis.keywords.size > 8 -> {
                recommendations.add("🎪 Focus on fewer, more impactful keywords")
            }
        }
        
        // Overall score recommendations
        if (score < 60) {
            recommendations.add("🚀 Overall content quality needs significant improvement")
        } else if (score > 85) {
            recommendations.add("🏆 Excellent content quality - maintain this standard!")
        }
        
        // Ensure we always have at least one recommendation
        if (recommendations.isEmpty()) {
            recommendations.add("✅ Content analysis complete - good baseline quality")
        }
        
        return recommendations.take(4) // Limit to 4 recommendations
    }
}

// Elide-compatible singleton instance
val analyticsEngine = AnalyticsEngine()

/**
 * Main entry point for metrics calculation
 * Compatible with Elide polyglot runtime
 */
fun calculateMetrics(analysisData: Map<String, Any>): MetricsResult {
    return try {
        val analysis = AnalysisResult(
            sentiment = analysisData["sentiment"] as? String ?: "Neutral",
            wordCount = (analysisData["wordCount"] as? Number)?.toInt() ?: 0,
            readabilityScore = (analysisData["readabilityScore"] as? Number)?.toDouble() ?: 0.0,
            keywords = (analysisData["keywords"] as? List<*>)?.filterIsInstance<String>() ?: emptyList()
        )
        
        analyticsEngine.calculateMetrics(analysis)
    } catch (e: Exception) {
        println("Error in metrics calculation: ${e.message}")
        MetricsResult(
            score = 0,
            category = "Error",
            recommendations = listOf("⚠️ Unable to calculate metrics - please try again")
        )
    }
}

/**
 * Performance benchmark function
 */
fun benchmarkCalculation(iterations: Int = 1000): Long {
    val sampleAnalysis = AnalysisResult(
        sentiment = "Positive",
        wordCount = 150,
        readabilityScore = 75.5,
        keywords = listOf("kotlin", "performance", "analytics", "metrics")
    )
    
    val startTime = System.currentTimeMillis()
    
    repeat(iterations) {
        analyticsEngine.calculateMetrics(sampleAnalysis)
    }
    
    val endTime = System.currentTimeMillis()
    return endTime - startTime
}

// Example usage
fun main() {
    val sampleData = mapOf(
        "sentiment" to "Positive",
        "wordCount" to 127,
        "readabilityScore" to 78.5,
        "keywords" to listOf("elide", "polyglot", "kotlin", "performance")
    )
    
    val result = calculateMetrics(sampleData)
    println("Metrics Result:")
    println("Score: ${result.score}")
    println("Category: ${result.category}")
    println("Recommendations:")
    result.recommendations.forEach { println("  - $it") }
    
    // Performance test
    val benchmarkTime = benchmarkCalculation()
    println("\nBenchmark: $benchmarkTime ms for 1000 iterations")
}