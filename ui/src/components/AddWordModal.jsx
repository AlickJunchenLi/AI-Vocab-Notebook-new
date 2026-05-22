import { useState } from "react";
import LiquidGlassSurface from "../glass/LiquidGlassSurface.jsx";

function AddWordModal({ onClose, onAdd }) {
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
      alert("Word and language are required.");
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
    <div className="modal-overlay">
      <LiquidGlassSurface
        as="form"
        id="add-word-modal"
        className="add-word-modal add-word-form-modal"
        variant="panel"
        radius={30}
        intensity={1.18}
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">New Entry</p>
            <h2>Add Word</h2>
          </div>

          <button
            type="button"
            className="close-button"
            onClick={onClose}
          >
            ×
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
