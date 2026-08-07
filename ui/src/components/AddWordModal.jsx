import { useState } from "react";
import LiquidGlassSurface from "../glass/LiquidGlassSurface.jsx";
import Icon from "./Icon.jsx";
import { useDialogFocus } from "../hooks/useDialogFocus.js";

function AddWordModal({ onClose, onAdd }) {
  const dialogRef = useDialogFocus(onClose);
  const [formError, setFormError] = useState("");
  const [formData, setFormData] = useState({
    word: "",
    language: "English",
    synonyms: "",
    translations: "",
    notes: "",
  });

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));
  }

  function splitList(text) {
    return text
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter((item) => item !== "");
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (formData.word.trim() === "" || formData.language.trim() === "") {
      setFormError("Add a word and choose its language before saving.");
      return;
    }

    const newEntry = {
      id: Date.now(),
      word: formData.word.trim(),
      language: formData.language,
      synonyms: splitList(formData.synonyms),
      translations: splitList(formData.translations),
      notes: formData.notes.trim(),
    };

    onAdd(newEntry);
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <LiquidGlassSurface
        as="form"
        ref={dialogRef}
        id="add-word-modal"
        className="add-word-modal add-word-form-modal"
        variant="panel"
        radius={30}
        intensity={1.18}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-word-title"
        tabIndex={-1}
      >
        <div className="modal-header">
          <div>
            <h2 id="add-word-title">Add a new word</h2>
            <p>Capture it now, then strengthen it through practice.</p>
          </div>

          <button
            type="button"
            className="close-button"
            aria-label="Close add word dialog"
            onClick={onClose}
          >
            <Icon name="plus" size={18} />
          </button>
        </div>

        <div className="add-word-form-grid">
          <label className="form-field">
            Word
            <input
              name="word"
              value={formData.word}
              onChange={handleChange}
              placeholder="Example: happy"
              data-autofocus
            />
          </label>

          <label className="form-field">
            Language
            <select
              name="language"
              value={formData.language}
              onChange={handleChange}
            >
              <option value="English">English</option>
              <option value="Chinese">Chinese</option>
            </select>
          </label>

          <label className="form-field">
            Synonyms
            <input
              name="synonyms"
              value={formData.synonyms}
              onChange={handleChange}
              placeholder="Example: joyful, cheerful"
            />
          </label>

          <label className="form-field">
            Translations
            <input
              name="translations"
              value={formData.translations}
              onChange={handleChange}
              placeholder="Example: 开心, 快乐"
            />
          </label>

          <label className="form-field form-field-wide">
            Notes
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Write a short note..."
            />
          </label>
        </div>

        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
          >
            Cancel
          </button>

          <LiquidGlassSurface
            as="button"
            type="submit"
            id="submit-add-word-button"
            className="add-button liquid-add-button submit-add-word-button"
            variant="button"
            radius={18}
            intensity={1.1}
          >
            Save Word
          </LiquidGlassSurface>
        </div>
      </LiquidGlassSurface>
    </div>
  );
}

export default AddWordModal;
