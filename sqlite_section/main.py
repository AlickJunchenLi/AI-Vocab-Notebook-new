from database import add_entry, list_entries, find_entry, delete_entry, update_entry, split_words

def show_menu():
    print()
    print("AI note book")
    print("1. Add entry")
    print("2. List entries")
    print("3. Find entry")
    print("4. Update entry")
    print("5. Delete entry")
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


def main():
    while True:
        show_menu()
        choice = input("Choose an option: ").strip()

        if choice == "1":
            handle_add_entry()

        elif choice == "2":
            handle_list_entries()

        elif choice == "3":
            handle_find_entry()

        elif choice == "4":
            handle_update_entry()

        elif choice == "5":
            handle_delete_entry()

        elif choice == "6":
            print("Goodbye!")
            break

        else:
            print("Invalid choice. Please choose 1-6.")

if __name__ == "__main__":
    main()
    

