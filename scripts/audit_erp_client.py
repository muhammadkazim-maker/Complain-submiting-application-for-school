import re

with open('erp-client.js', 'r', encoding='utf-8') as f:
    text = f.read()

print("File size:", len(text), "chars")
modules = re.findall(r'render([A-Z][a-zA-Z0-9]+Screen|View|Modal)', text)
print("Render functions:", list(dict.fromkeys(modules)))

nav_triggers = re.findall(r'data-screen="([^"]+)"', text)
print("Nav triggers in erp-client:", list(dict.fromkeys(nav_triggers)))

api_calls = re.findall(r'/api/([a-zA-Z0-9_/-]+)', text)
print("API endpoints used:", list(dict.fromkeys(api_calls)))
