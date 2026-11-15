import sqlite3

def inspect():
    conn = sqlite3.connect('hes_portal.db')
    cursor = conn.cursor()
    tables = [r[0] for r in cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;").fetchall()]
    print(f"Total tables: {len(tables)}")
    for t in tables:
        count = cursor.execute(f'SELECT COUNT(*) FROM "{t}";').fetchone()[0]
        print(f"{t}: {count} rows")
    conn.close()

if __name__ == '__main__':
    inspect()

