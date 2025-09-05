
package core

import api.greeting_processor

class GreetingService {
    fun getGreeting(): Map<String, String> {
        // Call Python function from Kotlin
        val message = greeting_processor.get_formatted_greeting()
        return mapOf("message" to message)
    }
}
