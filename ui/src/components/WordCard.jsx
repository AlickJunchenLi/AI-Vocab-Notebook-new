import LiquidGlassSurface from "./LiquidGlassSurface";

function getListText(arrayValue, singleValue, emptyText) {
  if (Array.isArray(arrayValue) && arrayValue.length > 0) {
    return arrayValue.join(", ");
  }

  if (typeof singleValue === "string" && singleValue.trim() !== "") {
    return singleValue;
  }

  return emptyText;
}

function WordCard({ entry, onSelect, isSelected }) {
  const synonymsText = getListText(
    entry.synonyms,
    entry.synonym,
    "No synonyms yet"
  );
  const translationsText = getListText(
    entry.translations,
    entry.translation,
    "No translations yet"
  );

  return (
    <LiquidGlassSurface
      as="article"
      className={`word-card ${isSelected ? "selected-card" : ""}`}
      variant="card"
      radius={28}
      intensity={isSelected ? 1.28 : 1.12}
    >
      <div className="word-card-header">
        <div>
          <h2>{entry.word}</h2>
          <p className="word-subtitle">{entry.notes || "No notes yet"}</p>
        </div>

        <span className="language-tag">{entry.language}</span>
      </div>

      <div className="word-card-body">
        <p>
          <strong>Synonyms:</strong> {synonymsText}
        </p>
        <p>
          <strong>Translations:</strong> {translationsText}
        </p>
      </div>

      <div className="word-card-actions">
        <button type="button" onClick={() => onSelect(entry)}>
          View Details
        </button>
      </div>
    </LiquidGlassSurface>
  );
}

export default WordCard;
