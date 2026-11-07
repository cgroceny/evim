import React, { useEffect, useId, useRef, useState } from "react";
import { Minus, Plus, Check, RotateCcw } from "lucide-react";
import { formatTemp } from "./core.js";
import {
  boundTemperature,
  temperatureProgress,
  temperatureAtPoint,
  dialPoint,
  parseTemperature,
} from "./temperature.js";

export default function TemperatureControl({
  name,
  value,
  min,
  max,
  disabled,
  onApply,
  compact = false,
  live = false,
  children,
}) {
  const id = useId();
  const initial = boundTemperature(value, min, max);
  const [raw, setRaw] = useState(formatTemp(initial));
  const [preview, setPreview] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  // Success notes fade after a few seconds; warnings stay until the next action.
  const [messageFades, setMessageFades] = useState(false);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null),
    dirtyRef = useRef(false),
    selectedRef = useRef(initial),
    applying = useRef(false);
  const previousSource = useRef(value);
  const blocked = disabled || sending || min === max;
  const parsed = parseTemperature(raw, min, max);
  const progress = temperatureProgress(preview, min, max),
    knob = dialPoint(progress);
  const start = dialPoint(0),
    end = dialPoint(1);
  const track = `M ${start.x} ${start.y} A 90 90 0 1 1 ${end.x} ${end.y}`;

  useEffect(() => {
    if (!message || !messageFades) return;
    const timer = setTimeout(() => {
      setMessage("");
      setMessageFades(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [message, messageFades]);

  useEffect(() => {
    if (
      dirtyRef.current &&
      !applying.current &&
      selectedRef.current !== value &&
      previousSource.current !== value
    ) {
      setMessageFades(false);
      setMessage(
        "Kayıtlı hedef başka bir yerde değişti. Seçimin henüz uygulanmadı.",
      );
    } else if (
      !dirtyRef.current ||
      selectedRef.current === value ||
      applying.current
    ) {
      const next = boundTemperature(value, min, max);
      setRaw(formatTemp(next));
      setPreview(next);
      selectedRef.current = next;
      setDirty(false);
      dirtyRef.current = false;
      setError("");
    }
    previousSource.current = value;
  }, [value, min, max]);

  function select(next) {
    next = boundTemperature(next, min, max);
    selectedRef.current = next;
    dirtyRef.current = true;
    setRaw(formatTemp(next));
    setPreview(next);
    setDirty(true);
    setError("");
    setMessage("");
  }
  function reset() {
    const next = boundTemperature(value, min, max);
    selectedRef.current = next;
    dirtyRef.current = false;
    setRaw(formatTemp(next));
    setPreview(next);
    setDirty(false);
    setError("");
    setMessage("");
  }
  function pointerValue(event, previous) {
    const box = event.currentTarget.getBoundingClientRect();
    return temperatureAtPoint(
      event.clientX - box.left - box.width / 2,
      event.clientY - box.top - box.height / 2,
      min,
      max,
      previous,
    );
  }
  function pointerDown(event) {
    if (blocked || !event.isPrimary || event.button !== 0) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (
      Math.hypot(
        event.clientX - box.left - box.width / 2,
        event.clientY - box.top - box.height / 2,
      ) <
      box.width * 0.23
    )
      return;
    event.preventDefault();
    event.currentTarget.focus();
    drag.current = {
      pointerId: event.pointerId,
      start: selectedRef.current,
      raw,
      dirty: dirtyRef.current,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    select(pointerValue(event));
  }
  function pointerMove(event) {
    if (blocked || drag.current?.pointerId !== event.pointerId) return;
    select(pointerValue(event, selectedRef.current));
  }
  function pointerEnd(event, cancelled = false) {
    if (drag.current?.pointerId !== event.pointerId) return;
    if (cancelled || blocked) {
      const previous = drag.current;
      selectedRef.current = previous.start;
      dirtyRef.current = previous.dirty;
      setPreview(previous.start);
      setRaw(previous.raw);
      setDirty(previous.dirty);
    } else select(pointerValue(event, selectedRef.current));
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  async function apply(event) {
    event?.preventDefault();
    if (blocked || applying.current || !dirtyRef.current) return;
    const result = parseTemperature(raw, min, max);
    if (result.error) {
      setError(result.error);
      return;
    }
    applying.current = true;
    setSending(true);
    setError("");
    setMessage("");
    try {
      const accepted = await onApply(result.value);
      if (accepted === false) {
        setError("Hedef uygulanamadı. Bağlantıyı veya bildirimi kontrol edin.");
        return;
      }
      dirtyRef.current = false;
      setDirty(false);
      setMessageFades(true);
      setMessage(
        live
          ? "Hedef komutu iletildi. Oda ölçümü ayrıca güncellenir."
          : "Hedef kaydedildi.",
      );
    } catch {
      setError("Hedef uygulanamadı. Tekrar deneyin.");
    } finally {
      applying.current = false;
      setSending(false);
    }
  }
  function keyDown(event) {
    if (blocked) return;
    const delta = {
      ArrowUp: 0.5,
      ArrowRight: 0.5,
      ArrowDown: -0.5,
      ArrowLeft: -0.5,
      PageUp: 2,
      PageDown: -2,
    }[event.key];
    if (delta !== undefined) {
      event.preventDefault();
      select(selectedRef.current + delta);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      select(event.key === "Home" ? min : max);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      reset();
    } else if (event.key === "Enter") apply(event);
  }
  return (
    <form
      className={
        "temperature-control " +
        (compact ? "compact " : "") +
        (dirty ? "has-draft" : "")
      }
      noValidate
      onSubmit={apply}
    >
      <div className="dial-layout">
        <div
          className={"temperature-dial " + (dragging ? "dragging" : "")}
          role="slider"
          aria-label={`${name} sıcaklık kadranı`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={preview}
          aria-valuetext={`${formatTemp(preview)} derece hedef`}
          aria-disabled={blocked}
          aria-describedby={id + "-hint"}
          tabIndex={blocked ? -1 : 0}
          onKeyDown={keyDown}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={(event) => pointerEnd(event)}
          onPointerCancel={(event) => pointerEnd(event, true)}
          onLostPointerCapture={() => {
            drag.current = null;
            setDragging(false);
          }}
        >
          <svg viewBox="0 0 240 240" aria-hidden="true" focusable="false">
            {Array.from({ length: 37 }, (_, i) => {
              const a = dialPoint(i / 36, 108),
                b = dialPoint(i / 36, i % 6 === 0 ? 115 : 111);
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={
                    "dial-tick " + (i / 36 <= progress ? "filled" : "")
                  }
                />
              );
            })}
            <path d={track} className="dial-track" />
            <path
              d={track}
              className="dial-progress"
              pathLength="100"
              strokeDasharray={`${progress * 100} 100`}
            />
            <circle cx={knob.x} cy={knob.y} r="11" className="dial-knob" />
            <circle
              cx={knob.x}
              cy={knob.y}
              r="3.5"
              className="dial-knob-center"
            />
            <text x="120" y="87" className="dial-eyebrow">
              {dirty ? "YENİ HEDEF" : "HEDEF SICAKLIK"}
            </text>
            <text x="120" y="131" className="dial-value">
              {formatTemp(preview)}
              <tspan className="dial-unit" dx="2">
                °
              </tspan>
            </text>
            <text x="120" y="155" className="dial-caption">
              {dragging ? "Seçiliyor…" : "Kadranı çevir"}
            </text>
            <text x="43" y="216" className="dial-limit">
              {formatTemp(min)}°
            </text>
            <text x="197" y="216" className="dial-limit">
              {formatTemp(max)}°
            </text>
            <text x="120" y="212" className="dial-step">
              0,5° adım
            </text>
          </svg>
        </div>
        <div className="temperature-entry">
          <label htmlFor={id + "-input"}>veya dereceyi yaz</label>
          <div className="temperature-input-row">
            <button
              type="button"
              className="temperature-nudge"
              aria-label={`${name} sıcaklığını azalt`}
              disabled={blocked || preview <= min}
              onClick={() => select(selectedRef.current - 0.5)}
            >
              <Minus size={20} />
            </button>
            <div className="temperature-input-wrap">
              <input
                id={id + "-input"}
                aria-label={`${name} elle sıcaklık`}
                aria-invalid={!!error}
                aria-describedby={
                  id + "-hint" + (error ? " " + id + "-error" : "")
                }
                type="text"
                inputMode="decimal"
                autoComplete="off"
                maxLength="8"
                enterKeyHint="done"
                disabled={blocked}
                value={raw}
                onChange={(event) => {
                  const next = event.target.value;
                  setRaw(next);
                  setDirty(true);
                  dirtyRef.current = true;
                  setError("");
                  setMessage("");
                  const p = parseTemperature(next, min, max);
                  if (p.value !== undefined) {
                    selectedRef.current = p.value;
                    setPreview(p.value);
                  }
                }}
                onBlur={() => {
                  if (dirtyRef.current) {
                    const p = parseTemperature(raw, min, max);
                    setError(p.error || "");
                  }
                }}
              />
              <span aria-hidden="true">°C</span>
            </div>
            <button
              type="button"
              className="temperature-nudge"
              aria-label={`${name} sıcaklığını artır`}
              disabled={blocked || preview >= max}
              onClick={() => select(selectedRef.current + 0.5)}
            >
              <Plus size={20} />
            </button>
          </div>
          <p id={id + "-hint"} className="temperature-hint">
            {live ? "Cihaz hedefi" : "Kayıtlı hedef"}:{" "}
            <strong>{formatTemp(value)}°C</strong>
          </p>
          {children}
          <div className="temperature-submit-row">
            <button
              className="temperature-apply"
              type="submit"
              aria-label={`${name} hedefini uygula`}
              disabled={blocked || !dirty || !!parsed.error}
            >
              {sending ? (
                "Gönderiliyor…"
              ) : (
                <>
                  <Check size={18} />
                  {dirty ? `${formatTemp(preview)}° uygula` : "Uygula"}
                </>
              )}
            </button>
            <button
              type="button"
              className="temperature-reset"
              aria-label={`${name} sıcaklık seçimini geri al`}
              title="Seçimi geri al"
              disabled={blocked || !dirty}
              onClick={reset}
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
      </div>
      {error && (
        <p id={id + "-error"} className="temperature-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="temperature-message" role="status">
          {message}
        </p>
      )}
      {disabled && !sending && (
        <p className="temperature-hint">
          Bağlantı veya cihaz hazır olduğunda sıcaklığı değiştirebilirsin.
        </p>
      )}
    </form>
  );
}
