
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.Serializable

@Serializable
data class BlogPost(
    val id: String,
    val title: String,
    val content: String,
    val createdAt: Long,
    val tags: List<String>
)

class BlogManager {
    private val cache = mutableMapOf<String, BlogPost>()
    
    suspend fun getPosts(): Flow<List<BlogPost>> {
        return blogRepository.getAllPosts()
            .cachedIn(viewModelScope)
    }
    
    fun getPost(id: String): BlogPost? {
        return cache[id] ?: blogRepository.getPost(id)?.also {
            cache[id] = it
        }
    }
    
    suspend fun createPost(post: BlogPost) {
        blogRepository.savePost(post)
        cache[post.id] = post
    }
}