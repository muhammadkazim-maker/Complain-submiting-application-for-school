import re

with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

matches = re.findall(r'style="[^"]*background[^"]*"', text, re.I)
print(f'Inline background count: {len(matches)}')
for m in matches:
    print('-', m)
