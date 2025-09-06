# Python Hello World Module for Elide
# This demonstrates Python's capabilities within an Elide polyglot application

import datetime
import random
import json

class PythonGreeter:
    """A Python class to demonstrate object-oriented programming in Elide"""
    
    def __init__(self, app_name="Elide"):
        self.app_name = app_name
        self.greetings = [
            f"Hello from Python in {app_name}! 🐍",
            f"Python power activated in {app_name}! ⚡",
            f"Greetings from the Python engine of {app_name}! 🔥"
        ]
    
    def get_greeting(self):
        """Returns a random greeting message"""
        return random.choice(self.greetings)
    
    def get_system_info(self):
        """Returns system information"""
        return {
            "timestamp": datetime.datetime.now().isoformat(),
            "language": "Python",
            "version": "3.9+",
            "runtime": "Elide Polyglot Runtime",
            "capabilities": ["Data Processing", "ML/AI", "Scientific Computing"]
        }
    
    def process_data(self, data):
        """Demonstrates data processing capabilities"""
        if isinstance(data, list):
            return {
                "original_count": len(data),
                "processed_data": [item.upper() if isinstance(item, str) else item for item in data],
                "summary": f"Processed {len(data)} items with Python"
            }
        elif isinstance(data, str):
            return {
                "original": data,
                "processed": data.upper(),
                "length": len(data),
                "words": len(data.split()),
                "summary": "String processed with Python"
            }
        else:
            return {
                "error": "Unsupported data type",
                "type": str(type(data))
            }

def main():
    """Main function demonstrating Python functionality"""
    greeter = PythonGreeter("Elide Hello World")
    
    print("=== Python Hello World in Elide ===")
    print(greeter.get_greeting())
    print("\nSystem Info:")
    print(json.dumps(greeter.get_system_info(), indent=2))
    
    # Demonstrate data processing
    test_data = ["hello", "world", "elide", "python"]
    result = greeter.process_data(test_data)
    print("\nData Processing Demo:")
    print(json.dumps(result, indent=2))
    
    return greeter.get_greeting()

if __name__ == "__main__":
    main()