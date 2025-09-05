import random
from typing import Dict, List

# Greeting templates in different styles
GREETING_TEMPLATES: Dict[str, List[str]] = {
    'en': [
        'Hello, {name}!',
        'Greetings, {name}!',
        'Welcome, {name}!',
        'Hi there, {name}!',
        'Good day, {name}!'
    ],
    'es': [
        '¡Hola, {name}!',
        '¡Saludos, {name}!',
        '¡Bienvenido, {name}!'
    ],
    'fr': [
        'Bonjour, {name}!',
        'Salut, {name}!',
        'Bienvenue, {name}!'
    ]
}

def generate_greeting(name: str, language: str = 'en') -> str:
    """
    Generate a randomized greeting message.
    
    Args:
        name: The name to greet
        language: Language code (en, es, fr)
        
    Returns:
        Formatted greeting string
    """
    if language not in GREETING_TEMPLATES:
        language = 'en'  # fallback to English
    
    templates = GREETING_TEMPLATES[language]
    selected_template = random.choice(templates)
    
    # Add some Python-powered text processing
    processed_name = name.strip().title()
    
    return selected_template.format(name=processed_name)

def get_greeting_stats() -> Dict[str, int]:
    """
    Return statistics about available greetings.
    """
    return {
        language: len(templates) 
        for language, templates in GREETING_TEMPLATES.items()
    }