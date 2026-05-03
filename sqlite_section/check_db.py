import sqlite3

conn = sqlite3.connect("notebook.db")
cur = conn.cursor()


print("Tables: ")
cur.execute("""
SELECT name
FROM sqlite_master
WHERE TYPE = 'table';
""")

for row in cur.fetchall():
    print(row)

print("\nentries table structures:")

cur.execute("PRAGMA table_info(entries_new)")

for row in cur.fetchall():
    print(row)

print("\nentries data:")

cur.execute("SELECT * FROM entries_new;")

for row in cur.fetchall():
    print(row)
    
conn.close()
