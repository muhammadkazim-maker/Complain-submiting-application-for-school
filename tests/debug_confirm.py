import json, socket, subprocess, time, urllib.request, websocket

CHROME_PATH = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
user_data_dir = r'C:\Users\user\.gemini\antigravity\brain\74811d7a-2cf1-4e02-8424-7ad6dd637088\.temp_debug_click'
s = socket.socket(); s.bind(('127.0.0.1', 0)); cdp_port = s.getsockname()[1]; s.close()

proc = subprocess.Popen([
    CHROME_PATH, '--headless=new', f'--remote-debugging-port={cdp_port}', f'--user-data-dir={user_data_dir}', 'about:blank'
])
time.sleep(2)

tabs = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{cdp_port}/json').read().decode())
ws = websocket.create_connection(tabs[0]['webSocketDebuggerUrl'], timeout=20)

req_id = 0
def cdp(method, params=None):
    global req_id
    req_id += 1
    ws.send(json.dumps({'id': req_id, 'method': method, 'params': params or {}}))
    while True:
        resp = json.loads(ws.recv())
        if resp.get('id') == req_id:
            return resp.get('result', {})

cdp('Page.navigate', {'url': 'http://127.0.0.1:8000'})
time.sleep(2)

cdp('Runtime.evaluate', {'expression': 'window.PortalAssistant.open()'})
time.sleep(1)

prompt = '9th ki physics attendance lagao sab present sirf Ali Abbas absent'
cdp('Runtime.evaluate', {'expression': f"""
    const input = document.getElementById("hesai-input");
    const btn = document.getElementById("hesai-btn-send");
    input.value = {json.dumps(prompt)};
    input.dispatchEvent(new Event("input", {{ bubbles: true }}));
    btn.click();
"""})

time.sleep(3)
card = cdp('Runtime.evaluate', {'expression': '!!document.querySelector(".hesai-confirm-card")', 'returnByValue': True})
print('Card present:', card.get('result', {}).get('value'))

print('Clicking confirm button (.hesai-confirm-ok)...')
cdp('Runtime.evaluate', {'expression': 'document.querySelector(".hesai-confirm-ok").click()'})

time.sleep(4)

# Print all messages text
msgs = cdp('Runtime.evaluate', {'expression': '''
    Array.from(document.querySelectorAll(".hesai-msg-row")).map(e => e.className + " ===> " + e.innerText)
''', 'returnByValue': True})

print("MESSAGES IN CHAT:")
for m in msgs.get('result', {}).get('value', []):
    print(m)
    print('---')

storage = cdp('Runtime.evaluate', {'expression': '''
    (async () => {
        const today = window.AppStorage.getLocalTodayDate();
        const list = await window.AppStorage.getClassAttendance({ classId: '9th', date: today });
        return list;
    })()
''', 'awaitPromise': True, 'returnByValue': True})

list_records = storage.get('result', {}).get('value', [])
print('Storage list length:', len(list_records))
if list_records:
    session = list_records[0]
    print('Session classId:', session.get('classId'))
    print('Session subject:', session.get('subject'))
    print('Total student records in session:', len(session.get('records', {})))
    print('Ali Abbas (hes_56) status:', session.get('records', {}).get('hes_56'))

ws.close()
proc.terminate()
