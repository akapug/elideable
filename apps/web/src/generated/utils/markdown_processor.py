
import markdown2
import readtime
from typing import Dict

class BlogProcessor:
    def process_markdown(self, content: str) -> Dict:
        """Process markdown content and return HTML with metadata"""
        html_content = markdown2.markdown(
            content,
            extras=['metadata', 'fenced-code-blocks']
        )
        
        reading_time = readtime.of_text(content)
        
        return {
            'html': html_content,
            'reading_time': str(reading_time),
            'word_count': len(content.split())
        }