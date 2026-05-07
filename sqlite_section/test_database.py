"""
pytest tests for AI Vocabulary Notebook database.py

How to use:
1. Save this file as test_database.py in the same folder as database.py.
2. Install pytest if needed:
       pip install pytest
3. Run:
       pytest -q

Important:
- These tests use a temporary folder, so they should NOT modify your real notebook.db.
- The tests check the SQLite database state directly, so they still work if your functions only print messages.
"""

import importlib
import sqlite3
import sys
from pathlib import Path

import pytest


# -----------------------------
# Test setup helpers
# -----------------------------

@pytest.fixture()
def db(tmp_path, monkeypatch):
    """
    Load database.py inside a temporary working directory.

    This is important because your database.py probably uses:
        sqlite3.connect("notebook.db")

    By changing the working directory to tmp_path, each test gets its own clean notebook.db.
    """
    monkeypatch.chdir(tmp_path)

    project_root = Path(__file__).resolve().parent
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    if "database" in sys.modules:
        del sys.modules["database"]

    database = importlib.import_module("database")

    if hasattr(database, "create_tables"):
        database.create_tables()

    return database


def connect_test_db():
    conn = sqlite3.connect("notebook.db")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def table_exists(table_name):
    conn = connect_test_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?;",
        (table_name,),
    )
    row = cur.fetchone()
    conn.close()
    return row is not None


def get_columns(table_name):
    conn = connect_test_db()
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table_name});")
    columns = [row[1] for row in cur.fetchall()]
    conn.close()
    return columns


def get_entry_id_from_db(language, word):
    conn = connect_test_db()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id
        FROM entries_v2
        WHERE language = ? AND word = ?;
        """,
        (language, word),
    )
    row = cur.fetchone()
    conn.close()

    if row is None:
        return None

    return row[0]


def count_rows(table_name):
    conn = connect_test_db()
    cur = conn.cursor()
    cur.execute(f"SELECT COUNT(*) FROM {table_name};")
    count = cur.fetchone()[0]
    conn.close()
    return count


def add_entry_flexible(db, language, word, translation=None, notes=None):
    """
    Supports both possible versions:

        add_entry_v2(language, word, translation, notes)

    and older/simple version:

        add_entry_v2(language, word, notes)
    """
    assert hasattr(db, "add_entry_v2"), "add_entry_v2() is missing."

    try:
        return db.add_entry_v2(language, word, translation, notes)
    except TypeError:
        try:
            return db.add_entry_v2(language, word, notes)
        except TypeError:
            return db.add_entry_v2(language, word)


def get_relation_columns():
    """
    Supports both naming styles:

        source_entry_id / target_entry_id

    and:

        from_entry_id / to_entry_id
    """
    columns = get_columns("relations_v2")

    if "source_entry_id" in columns and "target_entry_id" in columns:
        return "source_entry_id", "target_entry_id"

    if "from_entry_id" in columns and "to_entry_id" in columns:
        return "from_entry_id", "to_entry_id"

    raise AssertionError(
        "relations_v2 must contain either "
        "source_entry_id/target_entry_id or from_entry_id/to_entry_id."
    )


# -----------------------------
# Table tests
# -----------------------------

def test_create_tables_creates_expected_tables(db):
    assert table_exists("entries_v2")
    assert table_exists("relations_v2")

    # records_v2 may be new. This test expects it for the current version.
    assert table_exists("records_v2")


# -----------------------------
# Entry function tests
# -----------------------------

def test_add_entry_v2_adds_entry(db):
    add_entry_flexible(db, "English", "happy", "开心", "positive emotion")

    entry_id = get_entry_id_from_db("English", "happy")

    assert entry_id is not None


def test_find_entry_v2_finds_existing_entry(db):
    add_entry_flexible(db, "English", "happy", "开心", "positive emotion")

    assert hasattr(db, "find_entry_v2"), "find_entry_v2() is missing."

    result = db.find_entry_v2("English", "happy")

    assert result is not None


def test_list_entries_v2_lists_entries(db):
    add_entry_flexible(db, "English", "happy", "开心", "positive emotion")
    add_entry_flexible(db, "Chinese", "开心", "happy", "positive emotion")

    assert hasattr(db, "list_entries_v2"), "list_entries_v2() is missing."

    result = db.list_entries_v2()

    # If your function returns a list, test the list.
    # If it only prints, verify by database row count.
    if result is not None:
        assert isinstance(result, list)
        assert len(result) >= 2
    else:
        assert count_rows("entries_v2") >= 2


def test_get_entry_id_v2_returns_id(db):
    add_entry_flexible(db, "English", "happy", "开心", "positive emotion")

    assert hasattr(db, "get_entry_id_v2"), "get_entry_id_v2() is missing."

    entry_id = db.get_entry_id_v2("English", "happy")

    assert isinstance(entry_id, int)


def test_search_entries_v2_finds_partial_match(db):
    add_entry_flexible(db, "English", "happy", "开心", "positive emotion")
    add_entry_flexible(db, "English", "happiness", "幸福", "noun form")

    if not hasattr(db, "search_entries_v2"):
        pytest.skip("search_entries_v2() is not implemented yet.")

    result = db.search_entries_v2("hap")

    if result is not None:
        assert isinstance(result, list)
        assert len(result) >= 1


def test_delete_entry_v2_deletes_entry(db):
    add_entry_flexible(db, "English", "happy", "开心", "positive emotion")

    if not hasattr(db, "delete_entry_v2"):
        pytest.skip("delete_entry_v2() is not implemented yet.")

    db.delete_entry_v2("English", "happy")

    entry_id = get_entry_id_from_db("English", "happy")

    assert entry_id is None


# -----------------------------
# Update function tests
# -----------------------------

def test_update_entry_v2_updates_notes(db):
    add_entry_flexible(db, "English", "happy", "开心", "old notes")

    if not hasattr(db, "update_entry_v2"):
        pytest.skip("update_entry_v2() is not implemented yet.")

    try:
        db.update_entry_v2("English", "happy", "notes", "new notes", "replace")
    except TypeError:
        db.update_entry_v2("English", "happy", "notes", "new notes")

    conn = connect_test_db()
    cur = conn.cursor()

    columns = get_columns("entries_v2")
    if "notes" not in columns:
        pytest.skip("entries_v2 has no notes column.")

    cur.execute(
        """
        SELECT notes
        FROM entries_v2
        WHERE language = ? AND word = ?;
        """,
        ("English", "happy"),
    )
    row = cur.fetchone()
    conn.close()

    assert row is not None
    assert row[0] == "new notes"


# -----------------------------
# Relation function tests
# -----------------------------

def test_add_relation_v2_adds_relation(db):
    add_entry_flexible(db, "English", "happy", "开心", "positive emotion")
    add_entry_flexible(db, "Chinese", "开心", "happy", "positive emotion")

    if not hasattr(db, "add_relation_v2"):
        pytest.skip("add_relation_v2() is not implemented yet.")

    db.add_relation_v2("English", "happy", "Chinese", "开心", "translation")

    source_col, target_col = get_relation_columns()

    source_id = get_entry_id_from_db("English", "happy")
    target_id = get_entry_id_from_db("Chinese", "开心")

    conn = connect_test_db()
    cur = conn.cursor()
    cur.execute(
        f"""
        SELECT id
        FROM relations_v2
        WHERE {source_col} = ?
          AND {target_col} = ?
          AND relation_type = ?;
        """,
        (source_id, target_id, "translation"),
    )
    row = cur.fetchone()
    conn.close()

    assert row is not None


def test_relation_exists_returns_true_for_existing_relation(db):
    add_entry_flexible(db, "English", "happy", "开心", "positive emotion")
    add_entry_flexible(db, "Chinese", "开心", "happy", "positive emotion")

    if not hasattr(db, "add_relation_v2") or not hasattr(db, "relation_exists"):
        pytest.skip("Relation functions are not implemented yet.")

    db.add_relation_v2("English", "happy", "Chinese", "开心", "translation")

    source_id = get_entry_id_from_db("English", "happy")
    target_id = get_entry_id_from_db("Chinese", "开心")

    result = db.relation_exists(source_id, target_id, "translation")

    assert result is True


def test_list_relations_v2_returns_or_prints_relations(db):
    add_entry_flexible(db, "English", "happy", "开心", "positive emotion")
    add_entry_flexible(db, "Chinese", "开心", "happy", "positive emotion")

    if not hasattr(db, "add_relation_v2") or not hasattr(db, "list_relations_v2"):
        pytest.skip("Relation functions are not implemented yet.")

    db.add_relation_v2("English", "happy", "Chinese", "开心", "translation")

    result = db.list_relations_v2("English", "happy")

    if result is not None:
        assert isinstance(result, list)
        assert len(result) >= 1
    else:
        assert count_rows("relations_v2") >= 1


def test_get_related_words_v2_returns_related_words(db):
    add_entry_flexible(db, "English", "happy", "开心", "positive emotion")
    add_entry_flexible(db, "Chinese", "开心", "happy", "positive emotion")

    if not hasattr(db, "add_relation_v2") or not hasattr(db, "get_related_words_v2"):
        pytest.skip("get_related_words_v2() is not implemented yet.")

    db.add_relation_v2("English", "happy", "Chinese", "开心", "translation")

    result = db.get_related_words_v2("English", "happy")

    if result is not None:
        assert isinstance(result, list)
        assert len(result) >= 1


def test_delete_relation_v2_deletes_relation(db):
    add_entry_flexible(db, "English", "happy", "开心", "positive emotion")
    add_entry_flexible(db, "Chinese", "开心", "happy", "positive emotion")

    if not hasattr(db, "add_relation_v2") or not hasattr(db, "delete_relation_v2"):
        pytest.skip("delete_relation_v2() is not implemented yet.")

    db.add_relation_v2("English", "happy", "Chinese", "开心", "translation")
    db.delete_relation_v2("English", "happy", "Chinese", "开心", "translation")

    assert count_rows("relations_v2") == 0


# -----------------------------
# Record function tests
# -----------------------------

def test_add_record_v2_adds_record(db):
    add_entry_flexible(db, "English", "happy", "开心", "positive emotion")

    if not hasattr(db, "add_record_v2"):
        pytest.skip("add_record_v2() is not implemented yet.")

    db.add_record_v2("English", "happy", "review", "Reviewed today")

    assert count_rows("records_v2") == 1


def test_list_records_v2_returns_or_prints_records(db):
    add_entry_flexible(db, "English", "happy", "开心", "positive emotion")

    if not hasattr(db, "add_record_v2") or not hasattr(db, "list_records_v2"):
        pytest.skip("Record functions are not implemented yet.")

    db.add_record_v2("English", "happy", "review", "Reviewed today")

    result = db.list_records_v2("English", "happy")

    if result is not None:
        assert isinstance(result, list)
        assert len(result) >= 1
    else:
        assert count_rows("records_v2") == 1


def test_count_records_v2_counts_records(db):
    add_entry_flexible(db, "English", "happy", "开心", "positive emotion")

    if not hasattr(db, "add_record_v2") or not hasattr(db, "count_records_v2"):
        pytest.skip("Record functions are not implemented yet.")

    db.add_record_v2("English", "happy", "review", "Reviewed once")
    db.add_record_v2("English", "happy", "review", "Reviewed twice")
    db.add_record_v2("English", "happy", "quiz_correct", "Correct answer")

    result = db.count_records_v2("English", "happy")

    if isinstance(result, dict):
        assert result.get("review", 0) == 2
        assert result.get("quiz_correct", 0) == 1
    else:
        # If your function only prints, verify raw database rows instead.
        assert count_rows("records_v2") == 3


def test_delete_record_v2_deletes_record(db):
    add_entry_flexible(db, "English", "happy", "开心", "positive emotion")

    if not hasattr(db, "add_record_v2") or not hasattr(db, "delete_record_v2"):
        pytest.skip("Record functions are not implemented yet.")

    db.add_record_v2("English", "happy", "review", "Reviewed today")

    conn = connect_test_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM records_v2 LIMIT 1;")
    record_id = cur.fetchone()[0]
    conn.close()

    db.delete_record_v2(record_id)

    assert count_rows("records_v2") == 0
