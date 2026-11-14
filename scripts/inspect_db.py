import sqlite3

conn = sqlite3.connect('hes_portal.db')
c = conn.cursor()
c.execute("SELECT id, name, father_name, current_class_id FROM students WHERE name LIKE '%Ali%'")
for r in c.fetchall():
    print(r)
conn.close()
