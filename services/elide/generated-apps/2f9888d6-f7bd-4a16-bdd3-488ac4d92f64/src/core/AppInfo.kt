
package core

data class AppInfo(
    val name: String,
    val version: String,
    val description: String
)

object AppManager {
    fun getAppInfo(): AppInfo {
        return AppInfo(
            name = "Hello Elide App",
            version = "1.0.0",
            description = "A simple polyglot application demonstrating Elide capabilities"
        )
    }
}
