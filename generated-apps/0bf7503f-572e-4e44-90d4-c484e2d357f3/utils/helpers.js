// JavaScript utility functions
const greetings = [
    "Hello, World!",
    "Welcome to Elide!",
    "Greetings from JavaScript!",
    "Hey there, developer!",
    "Hello from the polyglot world!"
];

const emojis = ["👋", "🌍", "🚀", "✨", "🎉", "💫"];

export function generateGreeting() {
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    return `${randomEmoji} ${randomGreeting}`;
}

export function getCurrentTimestamp() {
    return new Date().toISOString();
}

export function formatTime(timestamp) {
    return new Date(timestamp).toLocaleString();
}