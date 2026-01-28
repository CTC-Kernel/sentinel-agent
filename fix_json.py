
import json
import re

filepath = '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/public/locales/fr/translation.json'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix common syntax errors that prevent json.loads
content = re.sub(r',\s*}', '}', content)
content = re.sub(r',\s*\]', ']', content)

# Remove the accidental nesting of modules starting at compliance
# We look for the point where "compliance" starts and ensure it is at top level.
# Finding "audits": { ... "checklist": { ... } ... "compliance": {
# We want to close "audits" before "compliance".

# Actually, the easiest is to just fix the closing braces.
# I'll try to find where "audits" starts and where it should end.

# Let's try to load it first, fixing only the trailing commas and missing braces.
if not content.strip().endswith('}'):
    content = content.strip() + '\n}'

try:
    # We might need to manually fix the nesting if it's too broken for json.loads
    # Let's try to detect the double-nesting and fix it.
    
    # Module list that should be at root
    modules = ["compliance", "requirements", "controls", "mapping", "actions", "continuity", "threats", "incidents", "documents", "suppliers", "privacy"]
    
    for mod in modules:
        # If any of these are indented by 4 spaces and preceded by others, they might be nested.
        pattern = rf'^\s+("{mod}":\s*{{)'
        content = re.sub(pattern, rf'  \1', content, flags=re.MULTILINE)

    # Re-check syntax
    content = re.sub(r',\s*}', '}', content)
    
    data = json.loads(content)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("SUCCESS: JSON fixed and formatted.")
except Exception as e:
    print(f"STILL ERROR: {e}")
    # Fallback: simpler regex fix for common issues
    content = re.sub(r'}\s*"compliance"', '},\n  "compliance"', content)
    # This is getting complex, let's try to just output the content and look at it.
