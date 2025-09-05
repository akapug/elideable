package utils

fun formatAsciiArt(input: String): String {
    // Optimize the ASCII art formatting with Kotlin's string processing
    return input
        .trimIndent()
        .split("\\n")
        .map { line -> 
            // Add some styling like padding or alignment
            line.padStart(line.length + 2)
                .padEnd(line.length + 4)
        }
        .joinToString("\\n")
}

// Make it available to Elide runtime
@JvmName("formatAsciiArt")
fun export(input: String) = formatAsciiArt(input)