import { useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import "./glassSelect.css";

/*
 * The project's select control, in place of the native one.
 *
 * A native <select> can be styled down to its closed box and no further: the
 * open list is drawn by the operating system, so it arrives opaque, square and
 * grey in the middle of a translucent interface. This is the ARIA combobox
 * pattern instead - a button that owns a listbox - so the open state is ours to
 * draw, and it reads as the same glass as the panels around it.
 *
 * Focus never leaves the button. The list is pointer-only; the active option is
 * announced through aria-activedescendant, which is why the options are not
 * focusable and why the list swallows mousedown rather than taking focus.
 */

const TYPEAHEAD_RESET = 700;

function isPrintableKey(event) {
  return (
    event.key.length === 1 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey
  );
}

function GlassSelect({
  value,
  onChange,
  options,
  label,
  hideLabel = false,
  icon,
  variant = "control",
  placeholder = "Select",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState("below");
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const typeaheadRef = useRef({ text: "", timer: 0 });
  const baseId = `glass-select-${useId().replace(/:/g, "")}`;
  const listId = `${baseId}-list`;
  const labelId = `${baseId}-label`;

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  function open(startAt = "selected") {
    if (options.length === 0) {
      return;
    }

    const start =
      startAt === "last"
        ? options.length - 1
        : selectedIndex >= 0
          ? selectedIndex
          : 0;

    setActiveIndex(start);
    setIsOpen(true);
  }

  function close({ returnFocus = true } = {}) {
    setIsOpen(false);
    setActiveIndex(-1);

    if (returnFocus) {
      triggerRef.current?.focus();
    }
  }

  function commit(index) {
    const option = options[index];

    if (option) {
      onChange(option.value);
    }

    close();
  }

  function moveActive(step) {
    setActiveIndex((current) => {
      const next = current + step;

      if (next < 0) {
        return options.length - 1;
      }

      if (next >= options.length) {
        return 0;
      }

      return next;
    });
  }

  function runTypeahead(key) {
    const typeahead = typeaheadRef.current;

    window.clearTimeout(typeahead.timer);
    typeahead.text += key.toLowerCase();
    typeahead.timer = window.setTimeout(() => {
      typeahead.text = "";
    }, TYPEAHEAD_RESET);

    const match = options.findIndex((option) =>
      option.label.toLowerCase().startsWith(typeahead.text),
    );

    return match;
  }

  function handleKeyDown(event) {
    if (!isOpen) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        open(event.key === "ArrowUp" ? "last" : "selected");
      } else if (isPrintableKey(event)) {
        const match = runTypeahead(event.key);

        if (match >= 0) {
          event.preventDefault();
          onChange(options[match].value);
        }
      }

      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(activeIndex);
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        // Let focus leave; only the list is dismissed.
        close({ returnFocus: false });
        break;
      default:
        if (isPrintableKey(event)) {
          const match = runTypeahead(event.key);

          if (match >= 0) {
            event.preventDefault();
            setActiveIndex(match);
          }
        }
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    /*
     * The list is anchored to the trigger, so it travels with the page and only
     * ever needs to be told which side to open on. Flipping is decided against
     * the viewport, not the scroll container, because the whole point is not
     * running off the bottom of the screen.
     */
    function updatePlacement() {
      const trigger = triggerRef.current;
      const list = listRef.current;

      if (!trigger || !list) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const needed = list.offsetHeight + 12;
      const roomBelow = window.innerHeight - rect.bottom;

      setPlacement(
        roomBelow < needed && rect.top > roomBelow ? "above" : "below",
      );
    }

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        close({ returnFocus: false });
      }
    }

    updatePlacement();
    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("resize", updatePlacement, { passive: true });
    window.addEventListener("scroll", updatePlacement, {
      capture: true,
      passive: true,
    });

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, { capture: true });
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeIndex < 0) {
      return;
    }

    listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [isOpen, activeIndex]);

  useEffect(() => {
    const typeahead = typeaheadRef.current;

    return () => window.clearTimeout(typeahead.timer);
  }, []);

  return (
    <div
      ref={rootRef}
      className={`glass-select glass-select-${variant}`}
      data-open={isOpen ? "true" : undefined}
    >
      <span id={labelId} className={hideLabel ? "sr-only" : "glass-select-label"}>
        {label}
      </span>

      <button
        ref={triggerRef}
        type="button"
        className="glass-select-trigger"
        role="combobox"
        aria-controls={listId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby={`${labelId} ${baseId}-value`}
        aria-activedescendant={
          isOpen && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
        }
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleKeyDown}
      >
        {icon ? <Icon name={icon} size={19} /> : null}
        <span id={`${baseId}-value`} className="glass-select-value">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <Icon name="chevron" size={16} className="glass-select-chevron" />
      </button>

      {isOpen ? (
        <ul
          ref={listRef}
          id={listId}
          className="glass-select-menu"
          data-placement={placement}
          role="listbox"
          aria-labelledby={labelId}
          // Keep the trigger focused: the combobox, not the list, owns the keys.
          onMouseDown={(event) => event.preventDefault()}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-option-${index}`}
              className="glass-select-option"
              role="option"
              aria-selected={option.value === value}
              data-active={index === activeIndex ? "true" : undefined}
              onClick={() => commit(index)}
              onPointerMove={() => setActiveIndex(index)}
            >
              <span>{option.label}</span>
              {option.value === value ? <Icon name="check" size={15} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default GlassSelect;
