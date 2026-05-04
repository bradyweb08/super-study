"use client";

import { useId, useRef } from "react";

const SPANISH_MARKS = ["á", "é", "í", "ó", "ú", "ü", "ñ", "¿", "¡"];

export default function SpanishTextField({
  textarea = false,
  className = "",
  disabled = false,
  onChange,
  value,
  ...props
}) {
  const fieldRef = useRef(null);
  const toolbarId = useId();
  const Element = textarea ? "textarea" : "input";

  function insertMark(mark) {
    const field = fieldRef.current;
    if (!field || disabled) return;

    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? field.value.length;
    const currentValue = field.value;
    const nextValue = `${currentValue.slice(0, start)}${mark}${currentValue.slice(end)}`;

    field.focus();

    if (onChange) {
      onChange({ target: { value: nextValue } });
    } else {
      field.value = nextValue;
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }

    window.requestAnimationFrame(() => {
      const cursor = start + mark.length;
      field.selectionStart = cursor;
      field.selectionEnd = cursor;
    });
  }

  return (
    <div className="accent-field">
      <Element
        {...props}
        aria-describedby={toolbarId}
        className={className}
        disabled={disabled}
        onChange={onChange}
        ref={fieldRef}
        value={value}
      />
      <div className="accent-toolbar" id={toolbarId}>
        <span>Spanish accents</span>
        <div className="accent-buttons">
          {SPANISH_MARKS.map((mark) => (
            <button
              className="accent-button"
              disabled={disabled}
              key={mark}
              onClick={() => insertMark(mark)}
              type="button"
            >
              {mark}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
