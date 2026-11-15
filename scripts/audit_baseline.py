import re
import os

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

title = re.search(r'<title>(.*?)</title>', html)
print('TITLE:', title.group(1) if title else 'None')

brand_match = re.search(r'<div class="brand-block">([\s\S]*?)</div>', html)
if brand_match:
    print('\nBRAND BLOCK:\n', brand_match.group(0))

screens = re.findall(r'<div id="(screen-[^"]+)"', html)
print(f'\nSCREENS ({len(screens)}):')
for s in screens:
    print(' -', s)

nav_items = re.findall(r'data-screen="([^"]+)"', html)
unique_nav = list(dict.fromkeys(nav_items))
print(f'\nNAVIGATION TARGETS ({len(unique_nav)}):')
for n in unique_nav:
    print(' -', n)

print('\nTOPBAR / HEADER SNIPPET:')
topbar = re.search(r'<header class="top-nav-bar">([\s\S]*?)</header>', html)
if topbar:
    print(topbar.group(0)[:600])

print('\nSIDEBAR SNIPPET:')
sidebar = re.search(r'<aside class="sidebar" id="sidebar">([\s\S]*?)</aside>', html)
if sidebar:
    print(sidebar.group(0)[:800])
