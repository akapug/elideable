import re
from elide import handler

@handler
def extractTags(text):
    # Simple tag extraction using regular expressions
    tags = re.findall(r'#(\w+)', text)
    return tags
