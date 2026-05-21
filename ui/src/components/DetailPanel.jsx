function getListText(arrayValue, singleValue, emptyText) {
  if (Array.isArray(arrayValue) && arrayValue.length > 0) {
    return arrayValue.join(", ");
  }

  if (typeof singleValue === "string" && singleValue.trim() !== "") {
    return singleValue;
  }

  return emptyText;
}

function DetailPanel({ entry, onDelete, onEdit }) {
  if (!entry) {
    return (
      <aside className="detail-panel">
        <p>Select a word to view details.</p>
      </aside>
    );
  }

  return (
    <aside className="detail-panel">
      <p className="eyebrow">Selected Entry</p>

      <h2>{entry.word}</h2>
      <p className="detail-language">{entry.language}</p>

      <div className="detail-block">
        <strong>Synonyms</strong>
        <p>{getListText(entry.synonyms, entry.synonym, "No synonyms yet")}</p>
      </div>

      <div className="detail-block">
        <strong>Translations</strong>
        <p>
          {getListText(
            entry.translations,
            entry.translation,
            "No translations yet"
          )}
        </p>
      </div>

      <div className="detail-block">
        <strong>Notes</strong>
        <p>{entry.notes || "No notes yet"}</p>
      </div>

      <button
        className="edit-button"
        onClick={() => onEdit(entry)}
      >
        Edit Word
      </button>
      <button
        className="delete-button"
        onClick={() => onDelete(entry)}
      >
        Delete Word
      </button>
    </aside>
  );
}

export default DetailPanel;
