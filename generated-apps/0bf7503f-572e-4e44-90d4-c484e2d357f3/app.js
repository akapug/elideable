// JavaScript frontend logic
import { generateGreeting } from './utils/helpers.js';
import { processGreeting } from './api/processor.py';
import { BusinessLogic } from './core/BusinessLogic.kt';

class HelloWorldApp {
    constructor() {
        this.greetingsContainer = document.getElementById('greetings');
        this.refreshBtn = document.getElementById('refresh-btn');
        this.businessLogic = new BusinessLogic();
        this.init();
    }

    init() {
        this.refreshBtn.addEventListener('click', () => this.loadGreetings());
        this.loadGreetings();
    }

    async loadGreetings() {
        try {
            // Generate greeting using JavaScript utility
            const baseGreeting = generateGreeting();
            
            // Process greeting using Python
            const processedGreeting = await processGreeting(baseGreeting);
            
            // Apply business logic using Kotlin
            const finalGreeting = this.businessLogic.formatGreeting(processedGreeting);
            
            this.displayGreetings({
                javascript: baseGreeting,
                python: processedGreeting,
                kotlin: finalGreeting
            });
        } catch (error) {
            console.error('Error loading greetings:', error);
        }
    }

    displayGreetings(greetings) {
        this.greetingsContainer.innerHTML = `
            <div class="greeting-card">
                <h3>🟡 JavaScript Says:</h3>
                <p>${greetings.javascript}</p>
            </div>
            <div class="greeting-card">
                <h3>🐍 Python Says:</h3>
                <p>${greetings.python}</p>
            </div>
            <div class="greeting-card">
                <h3>🟣 Kotlin Says:</h3>
                <p>${greetings.kotlin}</p>
            </div>
        `;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new HelloWorldApp();
});