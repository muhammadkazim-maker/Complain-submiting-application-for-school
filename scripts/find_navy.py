import re

with open('styles.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'var(--navy)' in line or 'var(--navy,' in line:
        print(f"{i+1}: {line.strip()}")
