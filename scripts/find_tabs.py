with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.findall(r'<button[^>]*data-screen=[^>]*>', text)
for m in matches:
    print(m)
