function DeleteConfirmModal({ entry, onConfirm, onCancel }) {
  if (!entry) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="delete-confirm-modal">
        <p className="eyebrow">Confirm Delete</p>

        <h2>Delete this word?</h2>

        <div className="delete-word-preview">
          <span>{entry.word}</span>
        </div>

        <p className="delete-warning-text">
          Permanent deletion · This action cannot be undone
        </p>

        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            type="button"
            className="confirm-delete-button"
            onClick={onConfirm}
          >
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteConfirmModal;
