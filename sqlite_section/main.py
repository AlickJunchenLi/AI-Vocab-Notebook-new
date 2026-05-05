from database import add_entry, list_entries, find_entry, delete_entry, update_entry, add_relation_v2, list_relations_v2
from database import add_entry_v2, find_entry_v2, list_entries_v2

def show_menu():
    print("1. Add entry v2")
    print("2. List entries v2")
    print("3. Find entry v2")
    print("4. Add relation")
    print("5. List relations")
    print("6. Quit")
    print("Please type in the correspond number of the operation :)")
    
def handle_add_entry():
    language = input("Language: ").strip()
    word = input("Word: ").strip()
    synonym = input("Synonyms, separated by commas: ").strip()
    translation = input("Translation: ").strip()
    notes = input("Notes: ").strip()
    add_entry(language, word, synonym, translation, notes)
    print("Entry added.")
    

def handle_list_entries():
    list_entries()
    

def handle_find_entry():
    word = input("Word to find: ").strip()

    row = find_entry(word)

    if row:
        print(row)
    else:
        print("No entry found.")
        


def handle_delete_entry():
    word = input("Word to delete: ").strip()

    delete_entry(word)

    print("Delete process finished.")
    

def handle_update_entry():
    word = input("Word to update: ").strip()
    
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
        print("Invalid field choice lol lol")
        return
    new_value = input("New value: ").strip()
    update_entry(word, column, new_value)
    print("Update process finished")

def handle_add_relation():
    from_language = input("Enter starting word language: ")
    from_word = input("Enter starting word: ")

    to_language = input("Enter target word language: ")
    to_word = input("Enter target word: ")

    relation_type = input("Enter relation type, such as synonym or translation: ")

    add_relation_v2(from_language, from_word, to_language, to_word, relation_type)
    
def handle_list_relations():
    language = input("Enter language: ")
    word = input("Enter word: ")

    list_relations_v2(language, word)
    

def handle_add_entry_v2():
    language = input("Enter language: ")
    word = input("Enter word: ")
    notes = input("Enter notes: ")

    add_entry_v2(language, word, notes)
    
def handle_list_entries_v2():
    list_entries_v2()
    
def handle_find_entry_v2():
    language = input("Enter language: ")
    word = input("Enter word: ")

    entry = find_entry_v2(language, word)

    if entry:
        print(entry)
    else:
        print("Entry not found.")

def main():
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
            handle_add_relation()

        elif choice == "5":
            handle_list_relations()

        elif choice == "6":
            print("Goodbye!")
            break

        else:
            print("Invalid choice. Please choose 1-6.")

if __name__ == "__main__":
    main()
    
