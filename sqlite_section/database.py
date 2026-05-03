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


#related_synonyms = ["joyful", "pleased", "cheerful"]
#cur.execute("""
#INSERT INTO entries_new (language, word, synonym, translation, notes)
#VALUES (?, ?, ?, ?, ?);
#""", ("English", "happy", json.dumps(related_synonyms), "开心", "positive emotion"))

conn.commit()

conn.close()

def split_words(a_string):
    new_string = a_string.strip()
    words = new_string.split(",")
    clean_words = []

    for word in words:
        clean_words.append(word.strip())

    return clean_words

def add_entry(language, word, synonym, translation, notes):
    conn = sqlite3.connect("notebook.db")
    cur = conn.cursor()
    row = find_entry(word)
    if row is not None:
        print(f"Already have the word {word}, can update or delete instead")
        conn.close()
        return
    add_related_synonyms = split_words(synonym)
    add_related_translations = split_words(translation)
    cur.execute("""
    INSERT INTO entries_new (language, word, synonym, translation, notes)
    VALUES (?, ?, ?, ?, ?);
    """, (language, word, json.dumps(add_related_synonyms), json.dumps(add_related_translations), notes))
    conn.commit()
    conn.close()
    return

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
    cur.execute("""
        SELECT * FROM entries_new
        WHERE word = ?;
    """, (target_word,))
    row = cur.fetchone()
    if row is None:
        print("There is no word found named", target_word);
    else:
        print("Entry found", row);
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
    cur.execute(sql, (update, word,))
    print("Successfully updated:)")
    conn.commit()
    conn.close()

if __name__ == "__main__":
    add_entry(
        "English",
        "sad",
        "unhappy, sorrowful, depressed",
        "难过, 伤心",
        "negative emotion"
    )

    list_entries()

    find_entry("sad")
    
    list_entries()
    
    find_entry("sad")
    
    update_entry("sad", "notes", "updated negative emotion")
    
    list_entries()

    delete_entry("sad")

    list_entries()