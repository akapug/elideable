import React, { useState, useEffect } from 'react';
import { analyzeText } from './api/textProcessor';
import { calculateMetrics } from './core/AnalyticsEngine';
import { formatData } from './utils/helpers';

interface AnalysisResult {
  sentiment: string;
  wordCount: number;
  readabilityScore: number;
  keywords: string[];
}

interface MetricsResult {
  score: number;
  category: string;
  recommendations: string[];
}

const App: React.FC = () => {
  const [text, setText] = useState<string>('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [metrics, setMetrics] = useState<MetricsResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    
    setLoading(true);
    try {
      // Call Python text analysis
      const analysisResult = await analyzeText(text);
      setAnalysis(analysisResult);
      
      // Call Kotlin metrics calculation
      const metricsResult = await calculateMetrics(analysisResult);
      setMetrics(metricsResult);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <h1>🔬 Elide Polyglot Text Analyzer</h1>
      <p className="subtitle">Python + Kotlin + TypeScript working together</p>
      
      <div className="input-section">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text to analyze..."
          rows={6}
          className="text-input"
        />
        <button 
          onClick={handleAnalyze}
          disabled={loading || !text.trim()}
          className="analyze-btn"
        >
          {loading ? '🔄 Analyzing...' : '🚀 Analyze Text'}
        </button>
      </div>

      {analysis && (
        <div className="results-section">
          <div className="analysis-card">
            <h3>📊 Python Analysis Results</h3>
            <div className="result-grid">
              <div className="result-item">
                <label>Sentiment:</label>
                <span className={`sentiment ${analysis.sentiment.toLowerCase()}`}>
                  {analysis.sentiment}
                </span>
              </div>
              <div className="result-item">
                <label>Word Count:</label>
                <span>{formatData(analysis.wordCount, 'number')}</span>
              </div>
              <div className="result-item">
                <label>Readability Score:</label>
                <span>{formatData(analysis.readabilityScore, 'percentage')}</span>
              </div>
              <div className="result-item keywords">
                <label>Keywords:</label>
                <div className="keyword-list">
                  {analysis.keywords.map((keyword, index) => (
                    <span key={index} className="keyword-tag">{keyword}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {metrics && (
            <div className="metrics-card">
              <h3>⚡ Kotlin Metrics Engine</h3>
              <div className="metrics-grid">
                <div className="metric-item">
                  <label>Overall Score:</label>
                  <div className="score-display">
                    <span className="score-value">{metrics.score}</span>
                    <span className="score-category">{metrics.category}</span>
                  </div>
                </div>
                <div className="recommendations">
                  <label>Recommendations:</label>
                  <ul>
                    {metrics.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .app-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        h1 {
          text-align: center;
          color: #2c3e50;
          margin-bottom: 0.5rem;
        }
        
        .subtitle {
          text-align: center;
          color: #7f8c8d;
          font-style: italic;
          margin-bottom: 2rem;
        }
        
        .input-section {
          background: #f8f9fa;
          padding: 2rem;
          border-radius: 12px;
          margin-bottom: 2rem;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .text-input {
          width: 100%;
          padding: 1rem;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 16px;
          resize: vertical;
          margin-bottom: 1rem;
        }
        
        .analyze-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 12px 24px;
          font-size: 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .analyze-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        
        .analyze-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .results-section {
          display: grid;
          gap: 2rem;
        }
        
        .analysis-card, .metrics-card {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          border-left: 4px solid #667eea;
        }
        
        .result-grid, .metrics-grid {
          display: grid;
          gap: 1rem;
          margin-top: 1rem;
        }
        
        .result-item, .metric-item {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .result-item label, .metric-item label {
          font-weight: 600;
          color: #2c3e50;
          min-width: 140px;
        }
        
        .sentiment {
          padding: 4px 12px;
          border-radius: 20px;
          font-weight: 600;
          text-transform: capitalize;
        }
        
        .sentiment.positive {
          background: #d4edda;
          color: #155724;
        }
        
        .sentiment.negative {
          background: #f8d7da;
          color: #721c24;
        }
        
        .sentiment.neutral {
          background: #e2e3e5;
          color: #383d41;
        }
        
        .keywords {
          flex-direction: column;
          align-items: flex-start;
        }
        
        .keyword-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }
        
        .keyword-tag {
          background: #667eea;
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 14px;
        }
        
        .score-display {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .score-value {
          font-size: 2rem;
          font-weight: 700;
          color: #667eea;
        }
        
        .score-category {
          background: #667eea;
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
        }
        
        .recommendations {
          flex-direction: column;
          align-items: flex-start;
        }
        
        .recommendations ul {
          margin: 0.5rem 0 0 0;
          padding-left: 1.5rem;
        }
        
        .recommendations li {
          margin-bottom: 0.5rem;
          color: #5a6c7d;
        }
      `}</style>
    </div>
  );
};

export default App;