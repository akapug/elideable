// JavaScript/TypeScript Hello World Functions

function runJavaScript() {
    const output = document.getElementById('js-output');
    const message = generateJSGreeting('Elide');
    output.innerHTML = `<strong>JavaScript says:</strong> ${message}`;
    console.log('JavaScript execution completed');
}

function generateJSGreeting(name) {
    const greetings = [
        `Hello, ${name}! 👋`,
        `Welcome to ${name}! 🎉`,
        `Greetings from JavaScript in ${name}! ⚡`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
}

function runPython() {
    const output = document.getElementById('python-output');
    // Simulate calling Python code (in a real Elide app, this would call actual Python)
    const pythonResult = simulatePythonCall();
    output.innerHTML = `<strong>Python says:</strong> ${pythonResult}`;
}

function simulatePythonCall() {
    // This simulates what would be actual Python execution in Elide
    return 'Hello from Python! 🐍 Data processed successfully!';
}

function runKotlin() {
    const output = document.getElementById('kotlin-output');
    // Simulate calling Kotlin code (in a real Elide app, this would call actual Kotlin)
    const kotlinResult = simulateKotlinCall();
    output.innerHTML = `<strong>Kotlin says:</strong> ${kotlinResult}`;
}

function simulateKotlinCall() {
    // This simulates what would be actual Kotlin execution in Elide
    return 'Hello from Kotlin! ⚡ High-performance greeting delivered!';
}

function runPolyglot() {
    const output = document.getElementById('polyglot-output');
    
    // Simulate polyglot execution
    const jsMessage = generateJSGreeting('World');
    const pythonMessage = 'Python: Data analysis complete! 📊';
    const kotlinMessage = 'Kotlin: Business logic executed successfully! 🏢';
    
    output.innerHTML = `
        <div style="margin: 5px 0;"><strong>🌐 Polyglot Result:</strong></div>
        <div style="margin: 5px 0;">• JS: ${jsMessage}</div>
        <div style="margin: 5px 0;">• Python: ${pythonMessage}</div>
        <div style="margin: 5px 0;">• Kotlin: ${kotlinMessage}</div>
        <div style="margin: 10px 0; color: #4CAF50;"><strong>✅ All languages executed in harmony!</strong></div>
    `;
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    console.log('Elide Polyglot Hello World App initialized!');
    
    // Show a welcome message
    setTimeout(() => {
        alert('Welcome to Elide Polyglot Hello World! Click the buttons to see different languages in action.');
    }, 500);
});