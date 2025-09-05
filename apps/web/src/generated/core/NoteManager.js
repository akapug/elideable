// Mock implementation of Kotlin NoteManager for browser preview
let notesStorage = [];

export function saveNote(note) {
  const existingIndex = notesStorage.findIndex(n => n.id === note.id);
  if (existingIndex >= 0) {
    notesStorage[existingIndex] = note;
  } else {
    notesStorage.push({ ...note, id: note.id || Date.now().toString() });
  }
  // In a real Elide app, this would persist to database
  console.log('Note saved:', note);
  return 'Note saved successfully';
}

export function loadNotes() {
  // In a real Elide app, this would load from database
  return notesStorage;
}

export default { saveNote, loadNotes };
