import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
import school_nlu

queries = [
    "9th ki phisics attendance lagao sab present sirf Ali Abbas absent",
    "iss class 10th kay chemistry kay tamam students ko present mark kar do",
    "Prep 1 8th class: sab present",
    "Aaj kaun kaun absent hai?",
    "attendance screen kholo",
    "pending homework list dikhao"
]

for q in queries:
    res = school_nlu.parse_user_intent_and_plan(q)
    print(f"\nQuery: '{q}'")
    print("Result:", res)
