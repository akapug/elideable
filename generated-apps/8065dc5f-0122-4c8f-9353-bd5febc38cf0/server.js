const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Mock API endpoints for development
app.post('/api/analyze', async (req, res) => {
  try {
    const { text } = req.body;
    
    // In a real Elide app, this would call the Python function directly
    // For now, we'll mock the response
    const mockAnalysis = {
      sentiment: text.includes('good') || text.includes('great') ? 'Positive' : 
                text.includes('bad') || text.includes('terrible') ? 'Negative' : 'Neutral',
      wordCount: text.split(' ').length,
      readabilityScore: Math.random() * 40 + 60, // Random score between 60-100
      keywords: ['sample', 'text', 'analysis', 'demo']
    };
    
    res.json(mockAnalysis);
  } catch (error) {
    res.status(500).json({ error: 'Analysis failed' });
  }
});

app.post('/api/metrics', async (req, res) => {
  try {
    const analysis = req.body;
    
    // Mock Kotlin metrics calculation
    const score = Math.floor(Math.random() * 40 + 60); // Random score 60-100
    const categories = ['Excellent', 'Very Good', 'Good', 'Fair'];
    const category = categories[Math.floor(score / 25)];
    
    const mockMetrics = {
      score,
      category,
      recommendations: [
        '🚀 Great content structure detected',
        '💡 Consider adding more examples',
        '✨ Good use of keywords throughout'
      ]
    };
    
    res.json(mockMetrics);
  } catch (error) {
    res.status(500).json({ error: 'Metrics calculation failed' });
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Elide Polyglot Text Analyzer</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                padding: 2rem;
            }
            
            .container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                overflow: hidden;
            }
            
            .header {
                background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                color: white;
                padding: 3rem 2rem;
                text-align: center;
            }
            
            .header h1 {
                font-size: 2.5rem;
                margin-bottom: 0.5rem;
            }
            
            .header p {
                font-size: 1.2rem;
                opacity: 0.9;
            }
            
            .content {
                padding: 3rem 2rem;
            }
            
            .demo-section {
                background: #f8f9fa;
                border-radius: 12px;
                padding: 2rem;
                margin-bottom: 2rem;
            }
            
            .demo-section h3 {
                color: #2c3e50;
                margin-bottom: 1rem;
                font-size: 1.5rem;
            }
            
            .feature-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 2rem;
                margin-top: 2rem;
            }
            
            .feature-card {
                background: white;
                border-radius: 12px;
                padding: 2rem;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                border-left: 4px solid #667eea;
                transition: transform 0.3s ease;
            }
            
            .feature-card:hover {
                transform: translateY(-5px);
            }
            
            .feature-card h4 {
                color: #2c3e50;
                margin-bottom: 1rem;
                font-size: 1.3rem;
            }
            
            .feature-card p {
                color: #5a6c7d;
                line-height: 1.6;
            }
            
            .language-tag {
                display: inline-block;
                background: #667eea;
                color: white;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 0.9rem;
                font-weight: 600;
                margin: 0.5rem 0.5rem 0 0;
            }
            
            .tech-stack {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
                border-radius: 12px;
                padding: 2rem;
                margin-top: 2rem;
            }
            
            .tech-stack h3 {
                margin-bottom: 1rem;
                font-size: 1.5rem;
            }
            
            .tech-list {
                display: flex;
                flex-wrap: wrap;
                gap: 1rem;
                margin-top: 1rem;
            }
            
            .tech-item {
                background: rgba(255,255,255,0.2);
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: 500;
            }
            
            .cta-section {
                text-align: center;
                margin-top: 3rem;
                padding: 2rem;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 12px;
                color: white;
            }
            
            .cta-button {
                background: white;
                color: #667eea;
                border: none;
                padding: 15px 30px;
                font-size: 1.2rem;
                font-weight: 600;
                border-radius: 50px;
                cursor: pointer;
                transition: all 0.3s ease;
                margin-top: 1rem;
            }
            
            .cta-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0,0,0,0.2);
            }
            
            .footer {
                text-align: center;
                padding: 2rem;
                color: #7f8c8d;
                border-top: 1px solid #ecf0f1;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <header class="header">
                <h1>🔬 Elide Polyglot Text Analyzer</h1>
                <p>Demonstrating JavaScript + Python + Kotlin integration</p>
            </header>
            
            <main class="content">
                <div class="demo-section">
                    <h3>🚀 Polyglot Architecture Demo</h3>
                    <p>This application showcases Elide's powerful polyglot runtime capabilities by combining multiple programming languages in a single, cohesive application:</p>
                    
                    <div class="feature-grid">
                        <div class="feature-card">
                            <h4>🎨 TypeScript Frontend</h4>
                            <span class="language-tag">TypeScript</span>
                            <span class="language-tag">React</span>
                            <p>Modern React components with TypeScript for type safety and excellent developer experience. Handles user interactions and real-time data visualization.</p>
                        </div>
                        
                        <div class="feature-card">
                            <h4>🐍 Python Text Analysis</h4>
                            <span class="language-tag">Python</span>
                            <span class="language-tag">NLP</span>
                            <p>Sophisticated text processing engine leveraging Python's rich ecosystem for sentiment analysis, keyword extraction, and readability scoring.</p>
                        </div>
                        
                        <div class="feature-card">
                            <h4>⚡ Kotlin Analytics Engine</h4>
                            <span class="language-tag">Kotlin</span>
                            <span class="language-tag">Performance</span>
                            <p>High-performance metrics calculation and business logic implementation using Kotlin's concise syntax and powerful type system.</p>
                        </div>
                        
                        <div class="feature-card">
                            <h4>🛠️ JavaScript Utilities</h4>
                            <span class="language-tag">JavaScript</span>
                            <span class="language-tag">Utilities</span>
                            <p>Cross-browser compatible helper functions for data formatting, performance monitoring, and seamless language integration.</p>
                        </div>
                    </div>
                </div>
                
                <div class="tech-stack">
                    <h3>🏗️ Technology Stack</h3>
                    <p>Built with cutting-edge technologies for optimal performance and developer experience:</p>
                    <div class="tech-list">
                        <span class="tech-item">Elide Runtime</span>
                        <span class="tech-item">TypeScript/React</span>
                        <span class="tech-item">Python 3.11+</span>
                        <span class="tech-item">Kotlin JVM</span>
                        <span class="tech-item">Node.js</span>
                        <span class="tech-item">Express.js</span>
                        <span class="tech-item">CSS Grid</span>
                        <span class="tech-item">ES6+ Modules</span>
                    </div>
                </div>
                
                <div class="cta-section">
                    <h3>🎯 Ready to Experience Polyglot Power?</h3>
                    <p>This demo shows the power of Elide's polyglot runtime - combine the best of each language in a single application!</p>
                    <button class="cta-button" onclick="alert('In a real Elide environment, this would load the full interactive app!')">Launch Interactive Demo</button>
                </div>
            </main>
            
            <footer class="footer">
                <p>🌟 Built with Elide Polyglot Runtime - JavaScript + Python + Kotlin + TypeScript</p>
                <p>Demonstrating cross-language integration and optimal performance</p>
            </footer>
        </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 Elide Polyglot Text Analyzer running on http://localhost:${PORT}`);
  console.log('📊 Features: TypeScript + Python + Kotlin + JavaScript');
  console.log('🔬 Polyglot runtime simulation active');
});