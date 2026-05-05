import sqlite3
import json
from pathlib import Path

conn = sqlite3.connect("notebook.db")
cur = conn.cursor()


cur.execute("""
CREATE TABLE IF NOT EXISTS entries_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            language TEXT NOT NULL, 
            word TEXT NOT NULL, 
            synonym TEXT,
            translation TEXT, 
            notes TEXT
            );
            
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS entries_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language TEXT NOT NULL,
    word TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(language, word)
);
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS relations_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_entry_id INTEGER NOT NULL,
    to_entry_id INTEGER NOT NULL,
    relation_type TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (from_entry_id) REFERENCES entries_v2(id),
    FOREIGN KEY (to_entry_id) REFERENCES entries_v2(id),

    UNIQUE(from_entry_id, to_entry_id, relation_type)
);
""")


def add_entry_v2(language, word, notes = ""):
    conn = sqlite3.connect("notebook.db")
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()
    try:
        cur.execute("""
        INSERT INTO entries_v2 (language, word, notes)
        VALUES (?, ?, ?);
        """, (language, word, notes))

        conn.commit()
        print("Entry added successfully.")
    except sqlite3.IntegrityError:
        print("This word already exists in this language.")
    conn.close()
    

def find_entry_v2(language, word):
    conn = sqlite3.connect("notebook.db")
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()

    cur.execute("""
    SELECT id, language, word, notes, created_at
    FROM entries_v2
    WHERE language = ? AND word = ?;
    """, (language, word))

    row = cur.fetchone()
    conn.close()

    if row:
        return row
    else:
        return None
    
def list_entries_v2():
    conn = sqlite3.connect("notebook.db")
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()
    
    cur.execute("PRAGMA table_info(entries_v2)")
    
    for row in cur.fetchall():
        print(row)
    
    print("entries data:")
    
    cur.execute("""
    SELECT id, language, word, notes, created_at
    FROM entries_v2
    ORDER BY id;
    """)
    
    rows = cur.fetchall()
    
    for row in rows:
        print(f"id: {row[0]} | language: {row[1]} | word: {row[2]} | notes: {row[3]} | created at: {row[4]}")
        
    conn.close()
    return rows

def add_relation_v2(from_language, from_word, to_language, to_word, relation_type):
    conn = sqlite3.connect("notebook.db")
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()
    
    from_entry = find_entry_v2(from_language, from_word)
    to_entry = find_entry_v2(to_language, to_word)
    
    if from_entry == None:
        print("Starting word does not exist.")
        conn.close()
        return
    
    if to_entry == None:
        print("Starting word does not exist.")
        conn.close()
        return
    
    from_entry_id = from_entry[0]
    to_entry_id = to_entry[0]
    
    try:
        cur.execute("""
        INSERT INTO relations_v2 (from_entry_id, to_entry_id, relation_type)
        VALUES (?, ?, ?);
        """, (from_entry_id, to_entry_id, relation_type))
        
        conn.commit()
        print("Relation added successfully.")
    
    except sqlite3.IntegrityError:
        print("This relation already exists.")

    conn.close()
    
def list_relations_v2(language, word):
    conn = sqlite3.connect("notebook.db")
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()

    entry = find_entry_v2(language, word)
    
    if entry is None:
        print("Entry does not exist.")
        conn.close()
        return []
    
    entry_id = entry[0]
    
    cur.execute("""
    SELECT
        e1.language,
        e1.word,
        r.relation_type,
        e2.language,
        e2.word
    FROM
        relations_v2 r
        JOIN entries_v2 e1 ON r.from_entry_id = e1.id
        JOIN entries_v2 e2 ON r.to_entry_id = e2.id
        WHERE r.from_entry_id = ?;
    """, (entry_id,))
    
    rows = cur.fetchall()
    conn.close()
    
    for row in rows:
        from_language = row[0]
        from_word = row[1]
        relation_type = row[2]
        to_language = row[3]
        to_word = row[4]

        print(f"{from_language}: {from_word} → {to_language}: {to_word} ({relation_type})")

    return rows

#related_synonyms = ["joyful", "pleased", "cheerful"]
#cur.execute("""
#INSERT INTO entries_new (language, word, synonym, translation, notes)
#VALUES (?, ?, ?, ?, ?);
#""", ("English", "happy", json.dumps(related_synonyms), "开心", "positive emotion"))

conn.commit()

conn.close()

def split_words(a_string):
    new_string = a_string.strip()

    if new_string == "":
        return []
    new_string = new_string.replace("，", ",")
    words = new_string.split(",")
    clean_words = []

    for word in words:
        clean_word = word.strip()

        if clean_word != "":
            clean_words.append(clean_word)

    return clean_words

def find_entry_with_cursor(cur, word):
    cur.execute("""
    SELECT * FROM entries_new
    WHERE word = ?;
    """, (word,))

    return cur.fetchone()

def add_entry(language, word, synonym, translation, notes):
    conn = sqlite3.connect("notebook.db")
    cur = conn.cursor()
    row = find_entry_with_cursor(cur, word)
    if row is not None:
        print(f"Already have the word {word}, can update or delete instead")
        conn.close()
        return "duplicate"
    add_related_synonyms = split_words(synonym)
    add_related_translations = split_words(translation)
    cur.execute("""
    INSERT INTO entries_new (language, word, synonym, translation, notes)
    VALUES (?, ?, ?, ?, ?);
    """, (language, word, json.dumps(add_related_synonyms, ensure_ascii = False), json.dumps(add_related_translations, ensure_ascii = False), notes))
    conn.commit()
    conn.close()
    return "added"

def list_entries():
    conn = sqlite3.connect("notebook.db")
    cur = conn.cursor()
    print("\nentries table structures:")

    cur.execute("PRAGMA table_info(entries_new)")

    for row in cur.fetchall():
        print(row)

    print("\nentries data:")

    cur.execute("SELECT * FROM entries_new;")

    for row in cur.fetchall():
        print(row)
    conn.close()
    return

def find_entry(target_word):
    conn = sqlite3.connect("notebook.db")
    cur = conn.cursor()
    row = find_entry_with_cursor(cur, target_word)
    if row is None:
        print("There is no word found named", target_word)
    conn.close()
    return row
    
    

def delete_entry(target_word):
    conn = sqlite3.connect("notebook.db")
    cur = conn.cursor()
    cur.execute("""
        DELETE FROM entries_new
        WHERE word = ?;
    """, (target_word,))

    if cur.rowcount == 0:
        print("No entries called", target_word, "is found")
    else:
        print("Entry deleted:", target_word)
    conn.commit()
    conn.close()
    

def update_entry(word, kind, update):
    conn = sqlite3.connect("notebook.db")
    cur = conn.cursor()
    allowed_kinds = ["language", "word", "synonym", "translation", "notes"]
    
    if kind not in allowed_kinds:
        print("Invalid update kind:", kind)
        conn.close()
        return


    cur.execute("""
        SELECT * FROM entries_new
        WHERE word = ?;
    """, (word,))
    row = cur.fetchone()
    if row == None:
        print("No entries called", word, "is found")
        conn.close()
        return
    sql = f"""
        UPDATE entries_new
        SET {kind} = ?
        WHERE word = ?;
    """
    if (kind == "synonym" or kind == "translation"):
        new_update = split_words(update)
        print("new_word: ", new_update)
        cur.execute(sql, (json.dumps(new_update, ensure_ascii = False), word,))
    else:
        cur.execute(sql, (update, word))
    print("Successfully updated:)")
    conn.commit()
    conn.close()

if __name__ == "__main__":
    print("Testing add_entry...")

    result = add_entry(
        "English",
        "happy",
        "joyful, pleased, cheerful",
        "开心",
        "positive emotion"
    )

    print(result)

    print("Testing list_entries...")
    list_entries()

    print("Testing find_entry...")
    find_entry("happy")

    print("Testing update_entry...")
    update_entry("happy", "notes", "updated positive emotion")

    print("Testing list_entries after update...")
    list_entries()

    print("Testing delete_entry...")
    delete_entry("happy")

    print("Testing list_entries after delete...")
    list_entries()