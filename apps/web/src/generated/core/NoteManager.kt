package core

import elide.server.controller.ElideController
import elide.annotations.Controller
import java.util.* // UUID
import com.google.gson.Gson;
import java.io.File

data class Note(val id: String, val content: String, val tags: List<String>)

@Controller
class NoteManager : ElideController() {
  private val gson = Gson()
  private val notesFile = File("notes.json")

  init {
    if (!notesFile.exists()) {
      notesFile.createNewFile()
      notesFile.writeText("[]")
    }
  }

  fun saveNote(note: Note) {
    val notes = loadNotes().toMutableList()
    if (notes.any { it.id == note.id }) {
        notes.removeIf { it.id == note.id }
    } else {
       val newNote = Note(id = UUID.randomUUID().toString(), content = note.content, tags = note.tags)
       notes.add(newNote)
    }
    
    notesFile.writeText(gson.toJson(notes))
  }

  fun loadNotes(): List<Note> {
    val json = notesFile.readText()
    return try {
      gson.fromJson(json, Array<Note>::class.java).toList()
    } catch (e: Exception) {
      emptyList()
    }
  }

  // Example of a more complex search (not directly used in the UI, but demonstrates Kotlin capabilities)
  fun searchNotes(query: String): List<Note> {
    return loadNotes().filter { it.content.contains(query, ignoreCase = true) }
  }
}
