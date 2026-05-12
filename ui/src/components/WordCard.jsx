function WordCard( { entry }) {
    return (
        <article className="word-card">
            <div className="word-card-header">
                <div>
                    <h2>{entry.word}</h2>
                    <p className="word-subtitle"> Vocabulary entry</p>
                </div>

                <span className="language-tag">{entry.language}</span>

            </div>

            <div className="word-card-body">
                <p>
                    <strong>Translations: </strong> {entry.translations.join(", ")}
                </p>

                <p>
                    <strong>Synonyms: </strong> {entry.synonyms.join(", ")}
                </p>

                <p>
                    <strong>Notes: </strong> {entry.notes}
                </p>
            </div>

            <div className="word-card-actions">
                <button>Edit</button>
                <button>Delete</button>
            </div>
                
        </article>);

}

export default WordCard;