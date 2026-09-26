import { useId, useState } from "react";
import MotionRegion from "../motion/MotionRegion.jsx";
import "../dailyNote.css";

function readTodayNote() {
  const today = new Date();
  const date = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  const storageKey = `ai-notebook:daily-note:${date}`;

  try {
    const saved = window.localStorage.getItem(storageKey);
    return { storageKey, text: saved ?? "", status: saved === null ? "empty" : "saved" };
  } catch {
    return { storageKey, text: "", status: "unavailable" };
  }
}

function DailyNote({ headingId }) {
  const id = useId();
  const [note, setNote] = useState(readTodayNote);
  const labelId = headingId ?? `${id}-heading`;
  const statusId = `${id}-status`;

  function updateNote(event) {
    const text = event.target.value;
    let status = "saved";

    try {
      window.localStorage.setItem(note.storageKey, text);
    } catch {
      status = "unavailable";
    }

    setNote({ ...note, text, status });
  }

  return (
    <MotionRegion as="section" reveal className="daily-note" aria-labelledby={labelId}>
      <h2 id={labelId} className="daily-note-heading">Today’s note</h2>
      <textarea
        className="daily-note-field"
        aria-labelledby={labelId}
        aria-describedby={statusId}
        placeholder="Anything you want to remember from today"
        rows={4}
        value={note.text}
        onChange={updateNote}
        spellCheck
      />
      <p
        id={statusId}
        className="daily-note-status"
        key={note.status}
        data-error={note.status === "unavailable" || undefined}
        role="status"
        aria-live="polite"
      >
        {note.status === "saved"
          ? "Saved"
          : note.status === "unavailable"
            ? "This browser is not saving. Copy the note before you leave."
            : "Saves as you type"}
      </p>
    </MotionRegion>
  );
}

export default DailyNote;
