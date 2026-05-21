import { useState } from "react";

function EditWordModal({ entry, onSave, onCancel }) {
  const [word, setWord] = useState(entry.word);
  const [language, setLanguage] = useState(entry.language);

  const [synonymsText, setSynonymsText] = useState(
    Array.isArray(entry.synonyms)
      ? entry.synonyms.join(", ")
      : entry.synonym || ""
  );

  const [translationsText, setTranslationsText] = useState(
    Array.isArray(entry.translations)
      ? entry.translations.join(", ")
      : entry.translation || ""
  );

  const [notes, setNotes] = useState(entry.notes || "");

  function splitText(text) {
    return text
      .replaceAll("，", ",")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item !== "");
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (word.trim() === "" || language.trim() === "") {
      alert("Word and language are required.");
      return;
    }

    const updatedEntry = {
      ...entry,
      word: word.trim(),
      language: language.trim(),
      synonyms: splitText(synonymsText),
      translations: splitText(translationsText),
      notes: notes.trim(),
    };

    onSave(updatedEntry);
  }

  return (
    <div className="modal-backdrop">
      <form className="add-word-modal" onSubmit={handleSubmit}>
        <h2>Edit Word</h2>

        <label>
          Word
          <input
            value={word}
            onChange={(event) => setWord(event.target.value)}
          />
        </label>

        <label>
          Language
          <input
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          />
        </label>

        <label>
          Synonyms
          <input
            value={synonymsText}
            onChange={(event) => setSynonymsText(event.target.value)}
          />
        </label>

        <label>
          Translations
          <input
            value={translationsText}
            onChange={(event) => setTranslationsText(event.target.value)}
          />
        </label>

        <label>
          Notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
            <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={onCancel}>
                  Cancel
                </button>

                <button type="submit" className="add-button">
                  Save Changes
                </button>
            </div>
      </form>
    </div>
  );
}

export default EditWordModal;