import sqlite3
import json
from pathlib import Path


conn = sqlite3.connect("notebook.db")
conn.execute("PRAGMA foreign_keys = ON;")
cur = conn.cursor()


cur.execute("""
CREATE TABLE IF NOT EXISTS entries_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language TEXT NOT NULL,
    word TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

#related_synonyms = ["joyful", "pleased", "cheerful"]
#cur.execute("""
#INSERT INTO entries_new (language, word, synonym, translation, notes)
#VALUES (?, ?, ?, ?, ?);
#""", ("English", "happy", json.dumps(related_synonyms), "开心", "positive emotion"))

conn.commit()

conn.close()



def normalize_word(word):
    if word is None:
        return ""
    
    word = word.strip()
    
    word = word.lower()
    
    return word



def split_words(text):
    if text is None:
        return []

    if isinstance(text, list):
        clean_words = []
        for item in text:
            item = str(item).strip()
            if item != "":
                clean_words.append(item)
        return clean_words

    text = str(text).strip()

    if text == "":
        return []

    # If the text is already JSON, try to read it first.
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            clean_words = []
            for item in parsed:
                item = str(item).strip()
                if item != "":
                    clean_words.append(item)
            return clean_words
    except json.JSONDecodeError:
        pass

    # Support both English comma and Chinese comma.
    text = text.replace("，", ",")
    parts = text.split(",")

    clean_words = []
    for part in parts:
        part = part.strip()
        if part != "":
            clean_words.append(part)

    return clean_words

def entry_exists(cur, language, word):
    conn = sqlite3.connect("notebook.db")
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()
    
    cur.execute("""
    SELECT 1 FROM entries_v2
    WHERE language = ? AND word = ?
    """, (language, word,))
    
    row = cur.fetchone()
    conn.close()
    if row is None:
        print(f"The word {word} in {language} does not exist")
        return False
    print(f"The word {word} in {language} exists")
    return True



def get_entry_id(language, word):
    conn = sqlite3.connect("notebook.db")
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()
    
    cur.execute("""
    SELECT id FROM entries_v2
    WHERE language = ? AND word = ?
    """, (language, word))
    
    id = cur.fetchone()
    conn.close()
    if id is None:
        print(f"Didn't find the word {word} in {language}")
        return None
    else:
        print(f"The id of {word} in {language} is: {id}")
        return id



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
    SELECT id, language, word, notes, created_at, updated_at
    FROM entries_v2
    ORDER BY id;
    """)
    
    rows = cur.fetchall()
    
    for row in rows:
        print(f"id: {row[0]} | language: {row[1]} | word: {row[2]} | notes: {row[3]} | created at: {row[4]} | updated at: {row[5]}")
        
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


def update_entry_v2(language, word, column, old_value=None, new_value=None, operation="replace"):
    allowed_columns = ["language", "word", "synonym", "translation", "notes"]
    list_columns = ["synonym", "translation"]
    allowed_operations = ["replace", "add", "delete"]

    if column not in allowed_columns:
        print(f"Invalid column: {column}")
        return False

    if operation not in allowed_operations:
        print(f"Invalid operation: {operation}")
        return False

    language = str(language).strip()
    word = normalize_word(word)

    conn = sqlite3.connect("notebook.db")
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()

    # Case 1: normal columns
    # For language, word, and notes, only replace is allowed.
    if column not in list_columns:
        if operation != "replace":
            print(f"You can only use replace for {column}.")
            conn.close()
            return False

        if new_value is None:
            print("new_value cannot be empty.")
            conn.close()
            return False

        stored_value = str(new_value).strip()

        if column == "word":
            stored_value = normalize_word(stored_value)

        sql = f"""
        UPDATE entries_v2
        SET {column} = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE language = ? AND word = ?;
        """

        cur.execute(sql, (stored_value, language, word))
        changed_rows = cur.rowcount

        conn.commit()
        conn.close()

        if changed_rows == 0:
            print(f"No entry found for {word} in {language}.")
            return False

        print(f"Successfully updated {column}.")
        return True

    # Case 2: list columns: synonym / translation
    cur.execute(f"""
    SELECT {column}
    FROM entries_v2
    WHERE language = ? AND word = ?;
    """, (language, word))

    row = cur.fetchone()

    if row is None:
        print(f"No entry found for {word} in {language}.")
        conn.close()
        return False

    current_value = row[0]
    current_list = split_words(current_value)

    # Add one item
    if operation == "add":
        if new_value is None:
            print("new_value cannot be empty.")
            conn.close()
            return False

        item = str(new_value).strip()

        if item == "":
            print("new_value cannot be empty.")
            conn.close()
            return False

        if item in current_list:
            print(f"{item} already exists in {column}.")
            conn.close()
            return False

        current_list.append(item)

    # Delete one item
    elif operation == "delete":
        if old_value is None:
            print("old_value cannot be empty for delete operation.")
            conn.close()
            return False

        item = str(old_value).strip()

        if item not in current_list:
            print(f"{item} does not exist in {column}.")
            conn.close()
            return False

        current_list.remove(item)

    # Replace one item
    elif operation == "replace":
        if old_value is None or new_value is None:
            print("old_value and new_value are both required for replace operation.")
            conn.close()
            return False

        old_item = str(old_value).strip()
        new_item = str(new_value).strip()

        if old_item == "" or new_item == "":
            print("old_value and new_value cannot be empty.")
            conn.close()
            return False

        if old_item not in current_list:
            print(f"{old_item} does not exist in {column}.")
            conn.close()
            return False

        if new_item in current_list:
            print(f"{new_item} already exists in {column}.")
            conn.close()
            return False

        index = current_list.index(old_item)
        current_list[index] = new_item

    updated_json = json.dumps(current_list, ensure_ascii=False)

    cur.execute(f"""
    UPDATE entries_v2
    SET {column} = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE language = ? AND word = ?;
    """, (updated_json, language, word))

    conn.commit()
    conn.close()

    print(f"Successfully performed {operation} on {column}.")
    return True

def delete_entry(language, word):
    conn = sqlite3.connect("notebook.db")
    cur = conn.cursor()
    cur.execute("""
        DELETE FROM entries_new
        WHERE word = ?;
    """, (language, word))

    if cur.rowcount == 0:
        print("No entries called ", word, " is found")
    else:
        print("Entry deleted:", word)
    conn.commit()
    conn.close()
    
def relation_exists(source_id, target_id, relation_type):
    conn = sqlite3.connect("notebook.db")
    cur = conn.cursor()
    cur.execute()