import re
import math
from typing import Union

def evaluateExpression(expression: str) -> float:
    """
    Safely evaluate mathematical expressions using Python's powerful math capabilities.
    Supports basic arithmetic, parentheses, and common mathematical functions.
    """
    try:
        # Clean the expression
        cleaned_expr = cleanExpression(expression)
        
        # Replace display operators with Python operators
        cleaned_expr = cleaned_expr.replace('×', '*').replace('÷', '/')
        
        # Validate expression for safety
        if not isValidExpression(cleaned_expr):
            raise ValueError("Invalid expression")
        
        # Use Python's eval with restricted globals for mathematical evaluation
        allowed_names = {
            "__builtins__": {},
            "abs": abs,
            "round": round,
            "pow": pow,
            "sqrt": math.sqrt,
            "sin": math.sin,
            "cos": math.cos,
            "tan": math.tan,
            "log": math.log,
            "pi": math.pi,
            "e": math.e
        }
        
        result = eval(cleaned_expr, allowed_names, {})
        
        # Handle special cases
        if math.isnan(result) or math.isinf(result):
            raise ValueError("Mathematical error")
            
        return float(result)
        
    except Exception as e:
        raise ValueError(f"Calculation error: {str(e)}")

def cleanExpression(expression: str) -> str:
    """
    Clean and normalize the mathematical expression.
    """
    # Remove extra spaces
    cleaned = re.sub(r'\s+', '', expression)
    
    # Handle implicit multiplication (e.g., 2(3) -> 2*(3))
    cleaned = re.sub(r'(\d)\(', r'\1*(', cleaned)
    cleaned = re.sub(r'\)(\d)', r')*\1', cleaned)
    
    return cleaned

def isValidExpression(expression: str) -> bool:
    """
    Validate that the expression contains only allowed characters and patterns.
    """
    # Allow digits, operators, parentheses, and decimal points
    allowed_pattern = r'^[0-9+\-*/().\s]+$'
    
    if not re.match(allowed_pattern, expression):
        return False
    
    # Check for balanced parentheses
    return isBalancedParentheses(expression)

def isBalancedParentheses(expression: str) -> bool:
    """
    Check if parentheses are properly balanced.
    """
    count = 0
    for char in expression:
        if char == '(':
            count += 1
        elif char == ')':
            count -= 1
            if count < 0:
                return False
    return count == 0

def calculateAdvanced(operation: str, operand1: float, operand2: float = None) -> float:
    """
    Advanced mathematical operations using Python's math library.
    """
    operations = {
        'sqrt': lambda x: math.sqrt(x),
        'pow': lambda x, y: pow(x, y),
        'sin': lambda x: math.sin(math.radians(x)),
        'cos': lambda x: math.cos(math.radians(x)),
        'tan': lambda x: math.tan(math.radians(x)),
        'log': lambda x: math.log10(x),
        'ln': lambda x: math.log(x)
    }
    
    if operation in operations:
        if operand2 is not None:
            return operations[operation](operand1, operand2)
        else:
            return operations[operation](operand1)
    else:
        raise ValueError(f"Unknown operation: {operation}")