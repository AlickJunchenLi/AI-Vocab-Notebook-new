import database as db


# -----------------------------
# Helper functions
# -----------------------------

def function_exists(function_name):
    return hasattr(db, function_name)


def call_function(function_name, *args):
    if not function_exists(function_name):
        print(f"{function_name}() is not implemented yet.")
        return None

    func = getattr(db, function_name)

    try:
        result = func(*args)

        if result is not None:
            print_result(result)

        return result

    except Exception as e:
        print(f"Error while running {function_name}():")
        print(type(e).__name__, "-", e)
        return None


def print_result(result):
    if isinstance(result, list):
        if len(result) == 0:
            print("No results found.")
        else:
            for item in result:
                print(item)

    elif isinstance(result, dict):
        for key, value in result.items():
            print(f"{key}: {value}")

    else:
        print(result)


def ask_required(prompt):
    value = input(prompt).strip()

    while value == "":
        print("This field cannot be empty.")
        value = input(prompt).strip()

    return value


def ask_optional(prompt):
    value = input(prompt).strip()

    if value == "":
        return None

    return value


# -----------------------------
# Menu
# -----------------------------

def show_menu():
    print()
    print("========== AI Vocabulary Notebook Test Menu ==========")
    print("1.  Add entry v2")
    print("2.  List entries v2")
    print("3.  Find entry v2")
    print("4.  Update entry v2")
    print("5.  Delete entry v2")
    print("6.  Search entries v2")
    print("7.  Get entry id v2")
    print("8.  Add relation v2")
    print("9.  List relations v2")
    print("10. Delete relation v2")
    print("11. Check relation exists")
    print("12. Get related words v2")
    print("13. Add record v2")
    print("14. List records v2")
    print("15. Delete record v2")
    print("16. Count records v2")
    print("17. Quit")
    print("======================================================")


# -----------------------------
# Entry handlers
# -----------------------------

def handle_add_entry_v2():
    language = ask_required("Enter language: ")
    word = ask_required("Enter word: ")
    translation = ask_optional("Enter translation, or press Enter to skip: ")
    notes = ask_optional("Enter notes, or press Enter to skip: ")

    # Expected newer signature:
    # add_entry_v2(language, word, translation=None, notes=None)
    if not function_exists("add_entry_v2"):
        print("add_entry_v2() is not implemented yet.")
        return

    try:
        result = db.add_entry_v2(language, word, translation, notes)
        if result is not None:
            print_result(result)

    except TypeError:
        # Fallback if your current function only has:
        # add_entry_v2(language, word, notes)
        print("Your add_entry_v2() may not support translation yet.")
        print("Trying fallback version: add_entry_v2(language, word, notes)")
        result = db.add_entry_v2(language, word, notes)
        if result is not None:
            print_result(result)


def handle_list_entries_v2():
    language = ask_optional("Enter language filter, or press Enter to list all: ")

    if language is None:
        call_function("list_entries_v2")
    else:
        call_function("list_entries_v2", language)


def handle_find_entry_v2():
    language = ask_required("Enter language: ")
    word = ask_required("Enter word: ")

    call_function("find_entry_v2", language, word)


def handle_update_entry_v2():
    language = ask_required("Enter current language: ")
    word = ask_required("Enter current word: ")

    print()
    print("Which field do you want to update?")
    print("1. language")
    print("2. word")
    print("3. synonym")
    print("4. translation")
    print("5. notes")

    field_choice = input("Choose a field: ").strip()

    if field_choice == "1":
        column = "language"
    elif field_choice == "2":
        column = "word"
    elif field_choice == "3":
        column = "synonym"
    elif field_choice == "4":
        column = "translation"
    elif field_choice == "5":
        column = "notes"
    else:
        print("Invalid field choice.")
        return

    print()
    print("Which operation do you want?")
    print("1. replace")
    print("2. add")
    print("3. delete")

    operation_choice = input("Choose an operation: ").strip()

    if operation_choice == "1":
        operation = "replace"
    elif operation_choice == "2":
        operation = "add"
    elif operation_choice == "3":
        operation = "delete"
    else:
        print("Invalid operation choice.")
        return

    new_value = ask_required("Enter value: ")

    if not function_exists("update_entry_v2"):
        print("update_entry_v2() is not implemented yet.")
        return

    try:
        result = db.update_entry_v2(language, word, column, new_value, operation)
        if result is not None:
            print_result(result)

    except TypeError:
        print("Your update_entry_v2() may not support operation yet.")
        print("Trying fallback version: update_entry_v2(language, word, column, new_value)")
        result = db.update_entry_v2(language, word, column, new_value)
        if result is not None:
            print_result(result)


def handle_delete_entry_v2():
    language = ask_required("Enter language: ")
    word = ask_required("Enter word to delete: ")

    call_function("delete_entry_v2", language, word)


def handle_search_entries_v2():
    query = ask_required("Enter search query: ")
    language = ask_optional("Enter language filter, or press Enter to search all: ")

    call_function("search_entries_v2", query, language)


def handle_get_entry_id_v2():
    language = ask_required("Enter language: ")
    word = ask_required("Enter word: ")

    call_function("get_entry_id_v2", language, word)


# -----------------------------
# Relation handlers
# -----------------------------

def handle_add_relation_v2():
    source_language = ask_required("Enter source language: ")
    source_word = ask_required("Enter source word: ")

    target_language = ask_required("Enter target language: ")
    target_word = ask_required("Enter target word: ")

    relation_type = ask_required("Enter relation type, such as synonym or translation: ")

    call_function(
        "add_relation_v2",
        source_language,
        source_word,
        target_language,
        target_word,
        relation_type
    )


def handle_list_relations_v2():
    language = ask_required("Enter language: ")
    word = ask_required("Enter word: ")

    call_function("list_relations_v2", language, word)


def handle_delete_relation_v2():
    source_language = ask_required("Enter source language: ")
    source_word = ask_required("Enter source word: ")

    target_language = ask_required("Enter target language: ")
    target_word = ask_required("Enter target word: ")

    relation_type = ask_required("Enter relation type: ")

    call_function(
        "delete_relation_v2",
        source_language,
        source_word,
        target_language,
        target_word,
        relation_type
    )


def handle_relation_exists():
    source_id_text = ask_required("Enter source entry id: ")
    target_id_text = ask_required("Enter target entry id: ")
    relation_type = ask_required("Enter relation type: ")

    try:
        source_id = int(source_id_text)
        target_id = int(target_id_text)
    except ValueError:
        print("source_id and target_id must be integers.")
        return

    call_function("relation_exists", source_id, target_id, relation_type)


def handle_get_related_words_v2():
    language = ask_required("Enter language: ")
    word = ask_required("Enter word: ")
    relation_type = ask_optional("Enter relation type filter, or press Enter for all: ")

    call_function("get_related_words_v2", language, word, relation_type)


# -----------------------------
# Record handlers
# -----------------------------

def handle_add_record_v2():
    language = ask_required("Enter language: ")
    word = ask_required("Enter word: ")

    print()
    print("Record type options:")
    print("1. learn")
    print("2. review")
    print("3. quiz_correct")
    print("4. quiz_wrong")
    print("5. note")

    choice = input("Choose record type: ").strip()

    if choice == "1":
        record_type = "learn"
    elif choice == "2":
        record_type = "review"
    elif choice == "3":
        record_type = "quiz_correct"
    elif choice == "4":
        record_type = "quiz_wrong"
    elif choice == "5":
        record_type = "note"
    else:
        print("Invalid record type choice.")
        return

    detail = ask_optional("Enter detail, or press Enter to skip: ")

    if detail is None:
        detail = ""

    call_function("add_record_v2", language, word, record_type, detail)


def handle_list_records_v2():
    print()
    print("List records options:")
    print("1. List all records")
    print("2. List records by language")
    print("3. List records for one word")

    choice = input("Choose an option: ").strip()

    if choice == "1":
        call_function("list_records_v2")

    elif choice == "2":
        language = ask_required("Enter language: ")
        call_function("list_records_v2", language)

    elif choice == "3":
        language = ask_required("Enter language: ")
        word = ask_required("Enter word: ")
        call_function("list_records_v2", language, word)

    else:
        print("Invalid choice.")


def handle_delete_record_v2():
    record_id_text = ask_required("Enter record id to delete: ")

    try:
        record_id = int(record_id_text)
    except ValueError:
        print("record_id must be an integer.")
        return

    call_function("delete_record_v2", record_id)


def handle_count_records_v2():
    language = ask_required("Enter language: ")
    word = ask_required("Enter word: ")

    call_function("count_records_v2", language, word)


# -----------------------------
# Main program
# -----------------------------

def main():
    if function_exists("create_tables"):
        print("Running create_tables()...")
        call_function("create_tables")
    else:
        print("create_tables() is not implemented or not imported.")

    while True:
        show_menu()
        choice = input("Choose an option: ").strip()

        if choice == "1":
            handle_add_entry_v2()

        elif choice == "2":
            handle_list_entries_v2()

        elif choice == "3":
            handle_find_entry_v2()

        elif choice == "4":
            handle_update_entry_v2()

        elif choice == "5":
            handle_delete_entry_v2()

        elif choice == "6":
            handle_search_entries_v2()

        elif choice == "7":
            handle_get_entry_id_v2()

        elif choice == "8":
            handle_add_relation_v2()

        elif choice == "9":
            handle_list_relations_v2()

        elif choice == "10":
            handle_delete_relation_v2()

        elif choice == "11":
            handle_relation_exists()

        elif choice == "12":
            handle_get_related_words_v2()

        elif choice == "13":
            handle_add_record_v2()

        elif choice == "14":
            handle_list_records_v2()

        elif choice == "15":
            handle_delete_record_v2()

        elif choice == "16":
            handle_count_records_v2()

        elif choice == "17":
            print("Goodbye!")
            break

        else:
            print("Invalid choice. Please choose 1-17.")


if __name__ == "__main__":
    main()