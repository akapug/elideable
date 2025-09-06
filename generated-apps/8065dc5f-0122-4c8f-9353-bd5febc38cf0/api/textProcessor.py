import re
import json
from typing import Dict, List, Any
from collections import Counter
import statistics

class TextAnalyzer:
    """Python-powered text analysis engine for Elide polyglot app"""
    
    def __init__(self):
        # Common stop words for keyword extraction
        self.stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
        }
    
    def analyze_sentiment(self, text: str) -> str:
        """Analyze sentiment using keyword-based approach"""
        positive_words = {
            'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
            'love', 'like', 'enjoy', 'happy', 'pleased', 'satisfied', 'awesome',
            'brilliant', 'perfect', 'outstanding', 'superb', 'magnificent'
        }
        
        negative_words = {
            'bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'angry',
            'disappointed', 'frustrated', 'annoyed', 'poor', 'worst', 'useless',
            'boring', 'stupid', 'ridiculous', 'pathetic', 'disgusting'
        }
        
        words = re.findall(r'\b\w+\b', text.lower())
        
        positive_count = sum(1 for word in words if word in positive_words)
        negative_count = sum(1 for word in words if word in negative_words)
        
        if positive_count > negative_count:
            return "Positive"
        elif negative_count > positive_count:
            return "Negative"
        else:
            return "Neutral"
    
    def count_words(self, text: str) -> int:
        """Count words in text"""
        words = re.findall(r'\b\w+\b', text)
        return len(words)
    
    def calculate_readability(self, text: str) -> float:
        """Simple readability score based on sentence and word length"""
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        if not sentences:
            return 0.0
        
        words = re.findall(r'\b\w+\b', text)
        if not words:
            return 0.0
        
        avg_sentence_length = len(words) / len(sentences)
        avg_word_length = statistics.mean(len(word) for word in words)
        
        # Simple readability formula (higher score = more readable)
        readability = max(0, 100 - (avg_sentence_length * 1.5) - (avg_word_length * 2))
        return round(readability, 1)
    
    def extract_keywords(self, text: str, top_n: int = 5) -> List[str]:
        """Extract top keywords from text"""
        words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
        
        # Filter out stop words and short words
        filtered_words = [word for word in words if word not in self.stop_words]
        
        if not filtered_words:
            return []
        
        # Count word frequencies
        word_counts = Counter(filtered_words)
        
        # Get top keywords
        top_keywords = [word for word, count in word_counts.most_common(top_n)]
        return top_keywords
    
    def analyze_text(self, text: str) -> Dict[str, Any]:
        """Main analysis function combining all features"""
        if not text or not text.strip():
            return {
                'sentiment': 'Neutral',
                'wordCount': 0,
                'readabilityScore': 0.0,
                'keywords': []
            }
        
        return {
            'sentiment': self.analyze_sentiment(text),
            'wordCount': self.count_words(text),
            'readabilityScore': self.calculate_readability(text),
            'keywords': self.extract_keywords(text)
        }

# Global analyzer instance
analyzer = TextAnalyzer()

# Elide-compatible function export
def analyze_text(text: str) -> Dict[str, Any]:
    """Main entry point for text analysis"""
    try:
        result = analyzer.analyze_text(text)
        return result
    except Exception as e:
        print(f"Error in text analysis: {str(e)}")
        return {
            'sentiment': 'Neutral',
            'wordCount': 0,
            'readabilityScore': 0.0,
            'keywords': []
        }

# Example usage and testing
if __name__ == "__main__":
    # Test the analyzer
    sample_text = """
    This is an amazing product that I absolutely love! 
    The quality is excellent and the customer service is fantastic. 
    I would definitely recommend this to anyone looking for a great solution.
    """
    
    result = analyze_text(sample_text)
    print("Sample Analysis Result:")
    print(json.dumps(result, indent=2))