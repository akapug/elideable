
def get_greeting(name: str = "World") -> str:
    """Generate a personalized greeting"""
    return f"Hello, {name}! Welcome to Elide polyglot runtime."

def get_current_time():
    """Get current time formatted"""
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
