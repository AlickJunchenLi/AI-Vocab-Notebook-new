import LiquidGlassSurface from "../glass/LiquidGlassSurface.jsx";
import Icon from "./Icon.jsx";
import { useDialogFocus } from "../hooks/useDialogFocus.js";

function DeleteConfirmModal({ entry, onConfirm, onCancel }) {
  const dialogRef = useDialogFocus(onCancel);

  if (!entry) {
    return null;
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <LiquidGlassSurface
        as="section"
        ref={dialogRef}
        id="delete-confirm-modal"
        className="delete-confirm-modal"
        variant="panel"
        radius={28}
        intensity={1.08}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-word-title"
        aria-describedby="delete-word-description"
        tabIndex={-1}
      >
        <span className="delete-modal-icon" aria-hidden="true">
          <Icon name="trash" size={22} />
        </span>

        <h2 id="delete-word-title">Delete this word?</h2>

        <div className="delete-word-preview">
          <span>{entry.word}</span>
        </div>

        <p id="delete-word-description" className="delete-warning-text">
          This removes the word and its review history. You can restore it from the
          confirmation message immediately afterward.
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
      </LiquidGlassSurface>
    </div>
  );
}

export default DeleteConfirmModal;
