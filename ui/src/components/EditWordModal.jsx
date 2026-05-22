import { useState } from "react";
import LiquidGlassSurface from "../glass/LiquidGlassSurface.jsx";

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
    <div className="modal-overlay">
      <LiquidGlassSurface
        as="form"
        id="edit-word-modal"
        className="add-word-modal add-word-form-modal edit-word-modal"
        variant="panel"
        radius={30}
        intensity={1.18}
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Selected Entry</p>
            <h2>Edit Word</h2>
          </div>

          <button
            type="button"
            className="close-button"
            aria-label="Close edit word dialog"
            onClick={onCancel}
          >
            &times;
          </button>
        </div>

        <div className="add-word-form-grid">
          <label className="form-field">
            Word
            <input
              value={word}
              onChange={(event) => setWord(event.target.value)}
            />
          </label>

          <label className="form-field">
            Language
            <input
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            />
          </label>

          <label className="form-field">
            Synonyms
            <input
              value={synonymsText}
              onChange={(event) => setSynonymsText(event.target.value)}
            />
          </label>

          <label className="form-field">
            Translations
            <input
              value={translationsText}
              onChange={(event) => setTranslationsText(event.target.value)}
            />
          </label>

          <label className="form-field form-field-wide">
            Notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
          >
            Cancel
          </button>

          <LiquidGlassSurface
            as="button"
            type="submit"
            id="save-edit-word-button"
            className="add-button liquid-add-button submit-add-word-button"
            variant="button"
            radius={18}
            intensity={1.1}
          >
            Save Changes
          </LiquidGlassSurface>
        </div>
      </LiquidGlassSurface>
    </div>
  );
}

export default EditWordModal;
