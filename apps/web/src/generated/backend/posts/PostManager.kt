
import kotlinx.serialization.*
import java.time.LocalDateTime

@Serializable
data class Post(
    val id: String,
    val title: String,
    val content: String,
    val excerpt: String,
    val author: String,
    val publishedAt: LocalDateTime,
    val tags: List<String>
)

class PostManager {
    private val posts = mutableListOf<Post>()
    
    fun createPost(title: String, content: String, author: String): Post {
        val processor = ContentProcessor()
        val processed = processor.process_markdown(content)
        val tags = processor.generate_tags(content)
        
        val post = Post(
            id = generateUUID(),
            title = title,
            content = content,
            excerpt = processed.excerpt,
            author = author,
            publishedAt = LocalDateTime.now(),
            tags = tags
        )
        
        posts.add(post)
        return post
    }
    
    fun getPosts(page: Int = 1, pageSize: Int = 10): List<Post> {
        return posts
            .sortedByDescending { it.publishedAt }
            .drop((page - 1) * pageSize)
            .take(pageSize)
    }
    
    fun searchPosts(query: String): List<Post> {
        return posts.filter { post ->
            post.title.contains(query, ignoreCase = true) ||
            post.content.contains(query, ignoreCase = true) ||
            post.tags.any { it.contains(query, ignoreCase = true) }
        }
    }
}