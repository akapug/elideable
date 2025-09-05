
import math
from typing import Union

def perform_advanced_math(number: float, operation: str) -> Union[float, str]:
    """
    Performs advanced mathematical operations
    """
    try:
        if operation == 'sqrt':
            if number < 0:
                return 'Error: Cannot calculate square root of negative number'
            return math.sqrt(number)
        else:
            return 'Error: Unknown operation'
    except Exception as e:
        return f'Error: {str(e)}'
