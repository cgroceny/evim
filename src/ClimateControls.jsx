import React, { useState } from "react";
import { Minus, Plus, Thermometer, SlidersHorizontal } from "lucide-react";
import { companionOptionLabel } from "./companions.js";
import { OPERATIONS, supportsOperation } from "./devices.js";
import {
  CLIMATE_OPTIONS,
  climateOptionLabel,
  climateTemperature,
  demoClimateEntity,
  isRoomThermostat,
  toCelsius,
} from "./climate.js";

function Choice({ device, operation, label, entity, disabled, onCommand }) {
  const [draft, setDraft] = useState(null),
    options = entity?.attributes?.[CLIMATE_OPTIONS[operation]] || [],
    current =
      operation === "hvac_mode"
        ? entity?.state
        : entity?.attributes?.[operation],
    selected = draft ?? (options.includes(current) ? current : "");
  return (
    <form
      className="device-value climate-choice"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!options.includes(selected)) return;
        if ((await onCommand(device, { operation, value: selected })) !== false)
          setDraft(null);
      }}
    >
      <label>
        {label}
        <select
          aria-label={device.name + " " + label}
          value={selected}
          required
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
        >
          <option value="" disabled>
            Seç
          </option>
          {options.map((value) => (
            <option key={value} value={value}>
              {climateOptionLabel(value)}
            </option>
          ))}
        </select>
      </label>
      <button
        className="secondary-button"
        type="submit"
        disabled={disabled || !options.includes(selected)}
        aria-label={device.name + " " + label + " uygula"}
      >
        Uygula
      </button>
    </form>
  );
}

function Target({ device, entity, unit, disabled, onCommand }) {
  const t = climateTemperature(entity, unit),
    [draft, setDraft] = useState(null),
    value = draft ?? (t.target == null ? "" : String(t.target));
  const nudge = (delta) => {
    const current = value === "" ? t.min : Number(value);
    setDraft(
      String(
        Number(
          Math.min(t.max, Math.max(t.min, current + delta * t.step)).toFixed(6),
        ),
      ),
    );
  };
  if (!t.valid)
    return (
      <p className="small-note">
        Sıcaklık birimi ve cihaz sınırları okununca hedef ayarı açılır.
      </p>
    );
  return (
    <form
      className="climate-target"
      onSubmit={async (event) => {
        event.preventDefault();
        if (value === "" || !Number.isFinite(Number(value))) return;
        if (
          (await onCommand(device, {
            operation: "temperature",
            value: toCelsius(Number(value), t.unit),
          })) !== false
        )
          setDraft(null);
      }}
    >
      <label
        className="climate-target-label"
        htmlFor={"climate-target-" + device.id}
      >
        Hedef sıcaklık{" "}
        <span>
          {t.min}–{t.max} {t.unit}
        </span>
      </label>
      <div className="climate-stepper">
        <button
          type="button"
          className="secondary-button"
          aria-label={device.name + " sıcaklığı azalt"}
          disabled={disabled || Number(value) <= t.min}
          onClick={() => nudge(-1)}
        >
          <Minus size={19} />
        </button>
        <div>
          <input
            id={"climate-target-" + device.id}
            type="number"
            inputMode="decimal"
            aria-label={device.name + " hedef sıcaklık"}
            value={value}
            min={t.min}
            max={t.max}
            step={t.step}
            required
            disabled={disabled}
            onChange={(event) => setDraft(event.target.value)}
          />
          <span>{t.unit}</span>
        </div>
        <button
          type="button"
          className="secondary-button"
          aria-label={device.name + " sıcaklığı artır"}
          disabled={disabled || Number(value) >= t.max}
          onClick={() => nudge(1)}
        >
          <Plus size={19} />
        </button>
      </div>
      <input
        className="climate-range"
        type="range"
        aria-label={device.name + " sıcaklık kaydırıcısı"}
        min={t.min}
        max={t.max}
        step={t.step}
        value={value === "" ? t.min : value}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button
        type="submit"
        className="primary-button"
        disabled={disabled || value === ""}
        aria-label={device.name + " sıcaklığı uygula"}
      >
        Sıcaklığı uygula
      </button>
    </form>
  );
}

function CompanionValue({ item, disabled, onCompanion }) {
  const a = item.entity.attributes || {},
    [draft, setDraft] = useState(null),
    off = disabled || ["unavailable", "unknown"].includes(item.entity.state);
  if (item.domain === "switch") {
    const on = item.entity.state === "on";
    return (
      <button
        type="button"
        className={"companion-toggle " + (on ? "on" : "")}
        role="switch"
        aria-checked={on}
        aria-label={item.label}
        disabled={off}
        onClick={() => onCompanion(item, { operation: on ? "off" : "on" })}
      >
        <span aria-hidden="true" />
        {on ? "Açık" : "Kapalı"}
      </button>
    );
  }
  if (item.domain === "select" || item.domain === "number") {
    const select = item.domain === "select",
      value = draft ?? item.entity.state,
      validNumber =
        String(value).trim() !== "" && Number.isFinite(Number(value));
    return (
      <form
        className="companion-form"
        onSubmit={async (event) => {
          event.preventDefault();
          // An emptied number field must not be sent as 0.
          if (!select && !validNumber) return;
          const ok = await onCompanion(
            item,
            select
              ? { operation: "option", value }
              : { operation: "value", value: Number(value) },
          );
          if (ok !== false) setDraft(null);
        }}
      >
        {select ? (
          <select
            aria-label={item.label}
            value={value}
            disabled={off}
            onChange={(e) => setDraft(e.target.value)}
          >
            {(a.options || []).map((o) => (
              <option key={o} value={o}>
                {companionOptionLabel(o)}
              </option>
            ))}
          </select>
        ) : (
          <span className="companion-number">
            <input
              type="number"
              inputMode="decimal"
              aria-label={item.label}
              value={value}
              min={a.min}
              max={a.max}
              step={a.step || 1}
              disabled={off}
              required
              onChange={(e) => setDraft(e.target.value)}
            />
            {a.unit_of_measurement && <small>{a.unit_of_measurement}</small>}
          </span>
        )}
        <button
          className="secondary-button"
          type="submit"
          disabled={
            off ||
            draft === null ||
            draft === item.entity.state ||
            (!select && !validNumber)
          }
          aria-label={item.label + " uygula"}
        >
          Uygula
        </button>
      </form>
    );
  }
  const state = item.entity.state,
    text =
      item.domain === "binary_sensor"
        ? state === "on"
          ? "Açık"
          : state === "off"
            ? "Kapalı"
            : "—"
        : ["unavailable", "unknown"].includes(state)
          ? "—"
          : companionOptionLabel(state) +
            (a.unit_of_measurement ? " " + a.unit_of_measurement : "");
  return <strong className="companion-reading">{text}</strong>;
}

export function CompanionControls({ items, disabled, onCompanion, demo }) {
  if (!items?.length) return null;
  const main = items.filter((i) => !i.diagnostic),
    diagnostic = items.filter((i) => i.diagnostic);
  const row = (item) => (
    <li key={item.entityId} className="companion-row">
      <div>
        <span>{item.label}</span>
        {item.hint && <small>{item.hint}</small>}
      </div>
      <CompanionValue
        item={item}
        disabled={disabled}
        onCompanion={onCompanion}
      />
    </li>
  );
  return (
    <details className="climate-extra companion-controls" open>
      <summary>
        <SlidersHorizontal size={15} /> Cihaz özellikleri
      </summary>
      <ul>{main.map(row)}</ul>
      {diagnostic.length > 0 && (
        <details className="companion-diagnostic">
          <summary>Teknik bilgiler ({diagnostic.length})</summary>
          <ul>{diagnostic.map(row)}</ul>
        </details>
      )}
      <p className="small-note">
        {demo
          ? "Örnek Gree özellikleri. Gerçek klimada Home Assistant’ın açtığı anahtarlar gösterilir."
          : "Aynı cihaza ait Home Assistant ayarları. Modelin desteklemediği özellikler cihazda etkisiz kalabilir."}
      </p>
    </details>
  );
}

export default function ClimateControls({
  device,
  entity,
  live,
  disabled,
  temperatureUnit,
  onCommand,
  companions = [],
  onCompanion,
}) {
  const e = live ? entity : demoClimateEntity(device),
    t = climateTemperature(e, live ? temperatureUnit : "°C"),
    independent = !isRoomThermostat(device, e),
    choices = OPERATIONS.climate.filter(
      ([op]) => CLIMATE_OPTIONS[op] && supportsOperation("climate", op, e),
    );
  return (
    <div className="climate-controls">
      {t.current !== null && ["°C", "°F"].includes(t.unit) && (
        <p className="climate-current">
          <Thermometer size={17} /> Cihaz ölçümü{" "}
          <strong>
            {t.current.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
            {t.unit}
          </strong>
        </p>
      )}
      <p className="small-note">
        {independent
          ? "Bağımsız klima / termostat · petek modlarından etkilenmez."
          : "Oda ısıtmasına bağlı vana / termostat."}
      </p>
      {supportsOperation("climate", "temperature", e) && (
        <Target
          key={(e?.entity_id || device.id) + t.unit}
          device={device}
          entity={e}
          unit={t.unit}
          disabled={disabled}
          onCommand={onCommand}
        />
      )}
      {choices
        .filter(([op]) => op === "hvac_mode")
        .map(([op, label]) => (
          <Choice
            key={op}
            device={device}
            operation={op}
            label={label}
            entity={e}
            disabled={disabled}
            onCommand={onCommand}
          />
        ))}
      {choices.some(([op]) => op !== "hvac_mode") && (
        <details className="climate-extra">
          <summary>Fan, kanat ve hazır ayarlar</summary>
          {choices
            .filter(([op]) => op !== "hvac_mode")
            .map(([op, label]) => (
              <Choice
                key={op}
                device={device}
                operation={op}
                label={label}
                entity={e}
                disabled={disabled}
                onCommand={onCommand}
              />
            ))}
          <p className="small-note">
            Seçenekler cihazdan gelir. Hazır ayarlar sıcaklığı veya fanı da
            değiştirebilir. Gree’de Ekonomi enerji tasarrufu, Turbo hızlı
            soğutma/ısıtma, Uyku gece için yavaş değişim, 8°C koruma ise evde
            yokken donmayı önleyen ısıtmadır.
          </p>
        </details>
      )}
      {onCompanion && (
        <CompanionControls
          items={companions}
          disabled={disabled}
          onCompanion={onCompanion}
          demo={!live}
        />
      )}
      {!live && (
        <p className="small-note">
          Örnek kontroller. Gerçek cihaz bağlandığında desteklediği seçenekler
          gösterilir.
        </p>
      )}
    </div>
  );
}
