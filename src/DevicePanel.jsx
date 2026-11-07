import React, { useState } from "react";
import {
  Radio,
  Star,
  Power,
  Play,
  Pause,
  Square,
  ArrowUp,
  ArrowDown,
  Settings2,
  Search,
  Plus,
  PlugZap,
} from "lucide-react";
import {
  DEVICE_TYPES,
  OPERATIONS,
  valueOperation,
  deviceReading,
  stateLabel,
  supportsOperation,
} from "./devices.js";
import ClimateControls from "./ClimateControls.jsx";
import { companionEntities, greeDemoCompanions } from "./companions.js";
import {
  climateOptionLabel,
  demoClimateEntity,
  isRoomThermostat,
} from "./climate.js";
function currentValue(op, reading, attrs = {}) {
  const num = (v) => (Number.isFinite(Number(v)) && v !== "" && v != null ? Number(v) : null);
  const v =
    op === "percentage"
      ? num(attrs.percentage)
      : op === "position"
        ? num(attrs.current_position)
        : op === "volume"
          ? num(attrs.volume_level) === null
            ? null
            : Math.round(num(attrs.volume_level) * 100)
          : op === "value"
            ? num(reading?.state)
            : op === "temperature"
              ? num(attrs.temperature)
              : null;
  if (v !== null) return String(v);
  if (op === "value") return String(num(attrs.min) ?? "");
  return "";
}
function DeviceCard({
  device: d,
  entities,
  live,
  temperatureUnit,
  disabled,
  onCommand,
  onFavorite,
  onRoom,
  registry,
  onCompanion,
}) {
  const reading = deviceReading(d, entities, live),
    [value, setValue] = useState(null),
    [option, setOption] = useState("");
  const controls = OPERATIONS[d.type] || [],
    e = live
      ? entities[d.entityId]
      : d.type === "climate"
        ? demoClimateEntity(d)
        : null,
    attrs = reading.attributes;
  const valueOp =
    d.type === "climate" ? null : controls.find(([op]) => valueOperation(op));
  // Start the number field from the device's current value, never a fixed 50:
  // pressing "Uygula" unchanged must not move a cover or volume elsewhere.
  const shownValue = value ?? currentValue(valueOp?.[0], reading, attrs);
  const icons = {
    on: Power,
    off: Power,
    open: ArrowUp,
    close: ArrowDown,
    stop: Square,
    play: Play,
    pause: Pause,
    run: Play,
    press: Play,
  };
  return (
    <article className="device-card">
      <div className="device-card-head">
        <span className="record-icon">
          <Radio size={21} />
        </span>
        <div>
          <h3>{d.name}</h3>
          <p>
            {d.type === "climate"
              ? isRoomThermostat(d, e)
                ? "Vana / termostat"
                : "Klima / bağımsız termostat"
              : DEVICE_TYPES[d.type]}{" "}
            · {live ? "Canlı" : "Demo"}
          </p>
        </div>
        <button
          className={
            "icon-button favorite-button " + (d.favorite ? "selected" : "")
          }
          aria-label={d.name + " favori"}
          aria-pressed={d.favorite}
          onClick={() => onFavorite(d)}
        >
          <Star size={19} />
        </button>
      </div>
      <div
        className={
          "device-reading " + (!reading.available ? "unavailable" : "")
        }
      >
        <strong>
          {reading.available
            ? d.type === "climate"
              ? climateOptionLabel(reading.state)
              : stateLabel(reading.state)
            : d.enabled
              ? "Erişilemiyor"
              : "Devre dışı"}
        </strong>
        {reading.unit && d.type !== "climate" && <span>{reading.unit}</span>}
      </div>
      {reading.updated && (
        <p className="small-note">
          Son değişim: {new Date(reading.updated).toLocaleString("tr-TR")}
        </p>
      )}
      <div className="device-controls">
        {controls
          .filter(([op]) => !valueOperation(op))
          .map(([op, label]) => {
            const Icon = icons[op] || Play;
            return (
              <button
                key={op}
                className="secondary-button"
                disabled={
                  disabled ||
                  !reading.available ||
                  !supportsOperation(d.type, op, e)
                }
                onClick={() => onCommand(d, { operation: op })}
              >
                <Icon size={16} />
                {label}
              </button>
            );
          })}
      </div>
      {valueOp && supportsOperation(d.type, valueOp[0], live ? e : null) && (
        <form
          className="device-value"
          onSubmit={(event) => {
            event.preventDefault();
            onCommand(d, {
              operation: valueOp[0],
              value: valueOp[0] === "option" ? option : Number(shownValue),
            });
            setValue(null);
          }}
        >
          <label>
            {valueOp[1]}
            {valueOp[0] === "option" ? (
              <select
                aria-label={d.name + " seçeneği"}
                value={option}
                onChange={(e) => setOption(e.target.value)}
                required
                disabled={disabled || !reading.available}
              >
                <option value="">Seçenek seç</option>
                {(attrs.options || []).map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                aria-label={d.name + " " + valueOp[1]}
                type="number"
                value={shownValue}
                onChange={(e) => setValue(e.target.value)}
                min={valueOp[0] === "value" ? attrs.min : 0}
                max={valueOp[0] === "value" ? attrs.max : 100}
                step={valueOp[0] === "value" ? attrs.step || 1 : 1}
                required
                disabled={disabled || !reading.available}
              />
            )}
          </label>
          <button
            className="primary-button"
            type="submit"
            disabled={disabled || !reading.available}
          >
            Uygula
          </button>
        </form>
      )}
      {d.type === "climate" && (
        <ClimateControls
          device={d}
          entity={e}
          live={live}
          disabled={disabled || !reading.available}
          temperatureUnit={temperatureUnit}
          onCommand={onCommand}
          companions={
            live
              ? companionEntities(d.entityId, registry, entities)
              : d.climateRole === "independent"
                ? greeDemoCompanions(d.climateDemo?.features)
                : []
          }
          onCompanion={
            onCompanion ? (item, action) => onCompanion(d, item, action) : null
          }
        />
      )}
      {isRoomThermostat(d, e) && (
        <button
          className="text-button"
          disabled={!d.roomId}
          onClick={() => onRoom(d.roomId)}
        >
          Odanın sıcaklığını ayarla
        </button>
      )}
      {d.notes && <p className="small-note">{d.notes}</p>}
    </article>
  );
}
export default function DevicePanel({
  state,
  entities,
  live,
  temperatureUnit,
  disabled,
  onCommand,
  onFavorite,
  onRoom,
  onAdd,
  onDiscover,
  actions,
  registry,
  onCompanion,
  children,
}) {
  const [query, setQuery] = useState(""),
    [room, setRoom] = useState(""),
    [type, setType] = useState(""),
    [favorites, setFavorites] = useState(false);
  const list = state.devices.filter(
    (d) =>
      (!room || d.roomId === room) &&
      (!type || d.type === type) &&
      (!favorites || d.favorite) &&
      (d.name + " " + d.entityId)
        .toLocaleLowerCase("tr")
        .includes(query.toLocaleLowerCase("tr")),
  );
  return (
    <>
      <header className="feature-heading">
        <div>
          <p className="eyebrow">BÜTÜN CİHAZLARIN BİR ARADA</p>
          <h1>Evinle bağlantıda kal.</h1>
          <p>Prizden sensöre, farklı markalar tek ekranda.</p>
        </div>
        <button className="primary-button" onClick={onDiscover}>
          <PlugZap size={18} />
          Cihazları keşfet
        </button>
      </header>
      {children}
      <div className="device-filter">
        <label className="search-box">
          <Search size={18} />
          <input
            aria-label="Cihazlarda ara"
            placeholder="Cihaz adı veya kimliği…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Odaya göre filtrele"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
        >
          <option value="">Bütün odalar</option>
          {state.rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Cihaz türüne göre filtrele"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">Bütün türler</option>
          {Object.entries(DEVICE_TYPES).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <button
          className={"secondary-button " + (favorites ? "selected" : "")}
          aria-pressed={favorites}
          onClick={() => setFavorites(!favorites)}
        >
          <Star size={16} />
          Favoriler
        </button>
        <button className="text-button" onClick={onAdd}>
          <Plus size={16} />
          Elle ekle
        </button>
      </div>
      <div className="device-grid">
        {list.map((d) => (
          <div className="editable-card" key={d.id}>
            <DeviceCard
              device={d}
              entities={entities}
              live={live}
              temperatureUnit={temperatureUnit}
              disabled={disabled}
              onCommand={onCommand}
              onFavorite={onFavorite}
              onRoom={onRoom}
              registry={registry}
              onCompanion={onCompanion}
            />
            {actions(
              "devices",
              d,
              state.devices.findIndex((x) => x.id === d.id),
            )}
          </div>
        ))}
      </div>
      {!list.length && (
        <div className="feature-panel feature-empty">
          <Radio size={38} />
          <h3>Bu filtreye uygun cihaz yok.</h3>
          <p>
            Filtrelerini değiştir veya Home Assistant’tan cihazları içe aktar.
          </p>
          <button className="primary-button" onClick={onDiscover}>
            Cihazları keşfet
          </button>
        </div>
      )}
    </>
  );
}
