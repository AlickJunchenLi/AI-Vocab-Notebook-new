import LiquidGlassSurface from "../motion/MotionSurface.jsx";
import MotionRegion from "../motion/MotionRegion.jsx";
import Icon from "./Icon.jsx";
import { useDialogFocus } from "../hooks/useDialogFocus.js";

function DeleteConfirmModal({ entry, onConfirm, onCancel }) {
  const dialogRef = useDialogFocus(onCancel);

  if (!entry) {
    return null;
  }

  return (
    <MotionRegion
      motionPreset="scrim"
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <LiquidGlassSurface
        motionPreset="dialog"
        as="section"
        ref={dialogRef}
        id="delete-confirm-modal"
        className="delete-confirm-modal"
        variant="panel"
        radius={20}
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

        <p className="delete-word-preview hand">{entry.word}</p>

        <p id="delete-word-description" className="delete-warning-text">
          This removes the word and its review history. You can undo it from the
          message that appears next.
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
            Delete word
          </button>
        </div>
      </LiquidGlassSurface>
    </MotionRegion>
  );
}

export default DeleteConfirmModal;
