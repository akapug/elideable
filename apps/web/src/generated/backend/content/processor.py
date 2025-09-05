
from markdown import markdown
from bs4 import BeautifulSoup
import nltk

class ContentProcessor:
    def __init__(self):
        nltk.download('punkt')
    
    def process_markdown(self, content: str) -> dict:
        """Convert markdown to HTML and extract metadata"""
        html = markdown(content)
        soup = BeautifulSoup(html, 'html.parser')
        
        # Extract first paragraph as excerpt
        excerpt = soup.find('p').text if soup.find('p') else ''
        
        # Generate reading time estimate
        words = len(content.split())
        reading_time = round(words / 200)  # Assume 200 words per minute
        
        return {
            'html': html,
            'excerpt': excerpt[:150] + '...',
            'reading_time': reading_time
        }
    
    def generate_tags(self, content: str) -> list:
        """Extract key phrases as tags"""
        sentences = nltk.sent_tokenize(content)
        words = nltk.word_tokenize(content.lower())
        return list(set([word for word in words if len(word) > 5]))[:5]
