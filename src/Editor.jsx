import React, { useEffect, useRef, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Save } from "lucide-react";
import { Modal, Toggle } from "./components.jsx";
import { LABELS, uid } from "./model.js";
import { DAYS } from "./core.js";
import {
  DEVICE_TYPES,
  SENSOR_CLASSES,
  OPERATIONS,
  valueOperation,
  optionOperation,
  supportsOperation,
} from "./devices.js";
import {
  CLIMATE_OPTIONS,
  climateOptionLabel,
  demoClimateEntity,
  inferClimateRole,
} from "./climate.js";

const defaultActionValue = (operation) =>
  optionOperation(operation) ? "" : operation === "temperature" ? 22 : 50;
function DeviceActionValue({ action, index, device, entities, onChange }) {
  const entity =
    entities[device?.entityId] ||
    (device?.type === "climate" ? demoClimateEntity(device) : null);
  const options =
    entity?.attributes?.[CLIMATE_OPTIONS[action.operation] || "options"] || [];
  const label =
    `Adım ${index + 1} değeri` +
    (action.operation === "temperature" ? " (°C)" : "");
  if (optionOperation(action.operation) && options.length)
    return (
      <Select
        label={label}
        value={action.value ?? ""}
        onChange={onChange}
        required
        options={[
          ["", "Seçenek seç"],
          ...options.map((v) => [
            v,
            device?.type === "climate" ? climateOptionLabel(v) : v,
          ]),
          ...(typeof action.value === "string" &&
          action.value &&
          !options.includes(action.value)
            ? [
                [
                  action.value,
                  climateOptionLabel(action.value) +
                    " (kaydedilmiş; bağlantıda doğrulanır)",
                ],
              ]
            : []),
        ]}
      />
    );
  const percent = ["percentage", "position", "volume"].includes(
    action.operation,
  );
  return (
    <Input
      label={label}
      type={optionOperation(action.operation) ? "text" : "number"}
      step="any"
      min={percent ? 0 : undefined}
      max={percent ? 100 : undefined}
      value={action.value ?? ""}
      onChange={onChange}
      required
      hint={
        action.operation === "temperature"
          ? "Cihazın sınırları gönderim öncesi kontrol edilir; hedef desteklenen adıma yuvarlanır."
          : undefined
      }
    />
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="edit-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Input({
  label,
  value,
  onChange,
  type = "text",
  hint,
  ...props
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        className="text-input"
        aria-label={label}
        type={type}
        value={value ?? ""}
        onChange={(e) =>
          onChange(
            type === "number"
              ? e.target.value === ""
                ? ""
                : Number(e.target.value)
              : e.target.value,
          )
        }
        {...props}
      />
    </Field>
  );
}
export function Select({ label, value, onChange, options, hint, ...props }) {
  return (
    <Field label={label} hint={hint}>
      <select
        className="text-input"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      >
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </Field>
  );
}
const iconOptions = {
  rooms: [
    ["sofa", "Salon"],
    ["bed", "Yatak odası"],
    ["desk", "Çalışma alanı"],
    ["coffee", "Mutfak / Diğer"],
  ],
  modes: [
    ["home", "Ev"],
    ["moon", "Gece"],
    ["away", "Dışarıda"],
    ["holiday", "Tatil"],
    ["leaf", "Ekonomi"],
  ],
  scenes: [
    ["sparkles", "Yıldız"],
    ["book", "Okuma"],
    ["film", "Film"],
    ["moon", "Gece"],
    ["power", "Güç"],
    ["sun", "Gündüz"],
  ],
};
const protocol = ["Zigbee", "Wi-Fi", "Matter", "Bluetooth", "Diğer"].map(
  (x) => [x, x],
);
const targets = (state, type) =>
  (type === "device"
    ? state.devices.filter((d) => OPERATIONS[d.type])
    : type === "light"
      ? state.lights
      : type === "room"
        ? state.rooms
        : state.modes
  ).map((x) => [x.id, x.name]);
function LightFields({ value, set, prefix = "" }) {
  return (
    <>
      <div className="edit-toggle">
        <span>{prefix}Açık</span>
        <Toggle
          label={prefix + "Açık"}
          checked={value.on}
          onChange={(on) => set({ on })}
        />
      </div>
      <Input
        label={prefix + "Parlaklık (%)"}
        type="number"
        min="1"
        max="100"
        required
        value={value.brightness}
        onChange={(brightness) => set({ brightness })}
      />
      <Select
        label={prefix + "Renk türü"}
        value={value.colorMode}
        onChange={(colorMode) => set({ colorMode })}
        options={[
          ["white", "Beyaz ışık"],
          ["color", "Renkli ışık"],
        ]}
      />
      {value.colorMode === "white" ? (
        <Input
          label={prefix + "Beyaz tonu (K)"}
          type="number"
          min="2000"
          max="6500"
          step="100"
          required
          value={value.kelvin}
          onChange={(kelvin) => set({ kelvin })}
        />
      ) : (
        <Input
          label={prefix + "Renk"}
          type="color"
          value={value.color}
          onChange={(color) => set({ color })}
        />
      )}
    </>
  );
}
export default function Editor({
  kind,
  record,
  state,
  entities,
  onSave,
  onClose,
  isNew,
  services,
}) {
  const [draft, setDraft] = useState(() => structuredClone(record));
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const keepEditing = useRef(null);
  // The editor may be scrolled down when "Vazgeç" is pressed; bring the
  // unsaved-changes prompt into view and put focus on its safe choice.
  useEffect(() => {
    if (!discard) return;
    keepEditing.current?.scrollIntoView({ block: "nearest" });
    keepEditing.current?.focus();
  }, [discard]);
  function close() {
    if (JSON.stringify(draft) !== JSON.stringify(record)) setDiscard(true);
    else onClose();
  }
  const set = (patch) => setDraft((s) => ({ ...s, ...patch }));
  const rooms = [["", "Atanmamış"], ...state.rooms.map((r) => [r.id, r.name])];
  function patchStep(id, patch) {
    setDraft((s) => ({
      ...s,
      steps: s.steps.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  }
  function addStep() {
    setDraft((s) => ({
      ...s,
      steps: [
        ...s.steps,
        {
          id: uid(),
          type: "light",
          targetId: state.lights[0]?.id || "",
          on: true,
          brightness: 75,
          color: "#f4ce8a",
          kelvin: 2700,
          colorMode: "white",
          temperature: 22,
        },
      ],
    }));
  }
  function moveStep(i, d) {
    setDraft((s) => {
      const steps = [...s.steps];
      [steps[i], steps[i + d]] = [steps[i + d], steps[i]];
      return { ...s, steps };
    });
  }
  function submit(e) {
    e.preventDefault();
    try {
      onSave(draft);
    } catch (e) {
      setError(e.message);
    }
  }
  const entityDomain = kind === "lights" ? "light" : draft.type;
  const liveOptions = Object.values(entities || {}).filter((e) =>
    e.entity_id.startsWith(entityDomain + "."),
  );
  return (
    <Modal
      title={
        (isNew ? "Yeni " : "") + LABELS[kind] + (isNew ? " ekle" : " düzenle")
      }
      onClose={close}
      wide={kind === "scenes"}
    >
      {discard && (
        <div role="alert" className="feature-banner">
          <div>
            <strong>Kaydedilmemiş değişiklikler var.</strong>
            <p>Düzenlemeye devam edebilir veya taslağı bırakabilirsin.</p>
          </div>
          <button
            type="button"
            ref={keepEditing}
            onClick={() => setDiscard(false)}
          >
            Devam et
          </button>
          <button type="button" onClick={onClose}>
            Taslağı bırak
          </button>
        </div>
      )}
      <form onSubmit={submit} className="editor-form">
        <p className="editor-intro">
          {kind === "devices"
            ? "Fiziksel cihazı burada adlandır ve odasına ata. Eşleştirme kimliğini Home Assistant’tan seçebilirsin."
            : "Kayıtlar kişisel ev düzenine aittir. Kaydetmek fiziksel cihazlara komut göndermez."}
        </p>
        <Input
          label="Ad"
          value={draft.name}
          onChange={(name) => set({ name })}
          maxLength="60"
          required
          data-autofocus={isNew ? "" : undefined}
        />
        {iconOptions[kind] && (
          <Select
            label="Simge"
            value={draft.icon}
            onChange={(icon) => set({ icon })}
            options={iconOptions[kind]}
          />
        )}
        {["rooms", "devices", "lights"].includes(kind) && (
          <div className="edit-toggle">
            <span>Favorilerde göster</span>
            <Toggle
              label="Favorilerde göster"
              checked={!!draft.favorite}
              onChange={(favorite) => set({ favorite })}
            />
          </div>
        )}
        {kind === "rooms" && (
          <>
            <div className="edit-grid">
              <Input
                label="Hedef sıcaklık (°C)"
                type="number"
                step="0.5"
                min={draft.min}
                max={draft.max}
                value={draft.target}
                onChange={(target) => set({ target, overrideUntil: null })}
                required
              />
              <Input
                label="Alt sıcaklık sınırı"
                type="number"
                step="0.5"
                min="5"
                max="35"
                value={draft.min}
                onChange={(min) => set({ min })}
                required
              />
              <Input
                label="Üst sıcaklık sınırı"
                type="number"
                step="0.5"
                min="5"
                max="35"
                value={draft.max}
                onChange={(max) => set({ max })}
                required
              />
            </div>
            <Select
              label="Oda sıcaklığını ölçen sensör"
              value={draft.sensorId}
              onChange={(sensorId) => set({ sensorId })}
              options={[
                ["", "Vana ölçümlerinin ortalaması"],
                ...state.devices
                  .filter(
                    (d) =>
                      d.type === "sensor" &&
                      d.sensorClass === "temperature" &&
                      d.roomId === draft.id,
                  )
                  .map((d) => [d.id, d.name]),
              ]}
              hint="Önce Cihazlar bölümünden sensörü bu odaya ata."
            />
            <Field label="Not">
              <textarea
                className="text-input"
                value={draft.notes}
                maxLength="500"
                onChange={(e) => set({ notes: e.target.value })}
              />
            </Field>
          </>
        )}
        {(kind === "devices" || kind === "lights") && (
          <>
            <Select
              label="Oda"
              value={draft.roomId}
              onChange={(roomId) => set({ roomId })}
              options={rooms}
            />
            {kind === "devices" && (
              <Select
                label="Cihaz türü"
                value={draft.type}
                onChange={(type) =>
                  set({
                    type,
                    entityId: "",
                    climateRole: "independent",
                    sensorClass: type === "sensor" ? "temperature" : "generic",
                  })
                }
                options={Object.entries(DEVICE_TYPES)}
              />
            )}
            {kind === "devices" && draft.type === "climate" && (
              <Select
                label="Klima / termostat kullanımı"
                value={draft.climateRole || "independent"}
                onChange={(climateRole) => set({ climateRole })}
                options={[
                  ["independent", "Bağımsız klima / termostat"],
                  ["radiator", "Oda ısıtmasına bağlı vana / termostat"],
                ]}
                hint="Klima için bağımsız seç. Evde / Gece / Dışarıda petek sıcaklıkları klimaya uygulanmaz. Soğutma destekli cihazlar daima ayrı tutulur."
              />
            )}
            <Select
              label="Bağlantı türü"
              value={draft.protocol}
              onChange={(protocol) => set({ protocol })}
              options={protocol}
            />
            <Input
              label="Home Assistant varlık kimliği"
              value={draft.entityId}
              onChange={(entityId) =>
                set({
                  entityId,
                  ...(draft.type === "climate" && entities[entityId]
                    ? { climateRole: inferClimateRole(entities[entityId]) }
                    : {}),
                })
              }
              placeholder={entityDomain + ".ornek_cihaz"}
              maxLength="150"
              list="ha-entity-options"
              hint="Boş bırakabilirsin. Bu alan fiziksel cihaz eşleştirmesidir; örnek verilerden ayrıdır."
            />
            <datalist id="ha-entity-options">
              {liveOptions.map((e) => (
                <option key={e.entity_id} value={e.entity_id}>
                  {e.attributes.friendly_name}
                </option>
              ))}
            </datalist>
            <div className="edit-toggle">
              <span>Kontrollere dahil et</span>
              <Toggle
                label="Kontrollere dahil et"
                checked={draft.enabled}
                onChange={(enabled) => set({ enabled })}
              />
            </div>
          </>
        )}
        {kind === "devices" && draft.type === "sensor" && (
          <div className="edit-grid">
            <Select
              label="Ölçüm türü"
              value={draft.sensorClass}
              onChange={(sensorClass) => set({ sensorClass })}
              options={Object.entries(SENSOR_CLASSES).concat(
                draft.sensorClass && !SENSOR_CLASSES[draft.sensorClass]
                  ? [[draft.sensorClass, draft.sensorClass]]
                  : [],
              )}
            />
            <Input
              label="Ölçüm birimi"
              value={draft.unit || ""}
              onChange={(unit) => set({ unit })}
              maxLength="20"
              placeholder="kWh, W, °C…"
            />
          </div>
        )}
        {kind === "devices" && (
          <Input
            label="Cihaz notu"
            value={draft.notes || ""}
            onChange={(notes) => set({ notes })}
            maxLength="500"
          />
        )}
        {kind === "devices" && (
          <fieldset>
            <legend>Örnek ölçümler · yalnızca demo</legend>
            <div className="edit-grid">
              {!["climate"].includes(draft.type) &&
                draft.sensorClass !== "temperature" && (
                  <>
                    <Input
                      label="Örnek durum"
                      value={draft.demoState || "off"}
                      onChange={(demoState) => set({ demoState })}
                      hint="Örneğin on, off veya open."
                    />
                    <Input
                      label="Örnek değer"
                      value={draft.demoValue ?? "0"}
                      onChange={(demoValue) => set({ demoValue })}
                      hint="Yalnız demo görünümünde kullanılır."
                    />
                  </>
                )}
              {(draft.type === "climate" ||
                draft.sensorClass === "temperature") && (
                <>
                  <Input
                    label="Örnek sıcaklık"
                    type="number"
                    min="-20"
                    max="60"
                    step="0.1"
                    required
                    value={draft.temperature}
                    onChange={(temperature) => set({ temperature })}
                  />
                  <Input
                    label="Örnek nem (%)"
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={draft.humidity}
                    onChange={(humidity) => set({ humidity })}
                  />
                  <Input
                    label="Örnek pil (%)"
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={draft.battery}
                    onChange={(battery) => set({ battery })}
                  />
                </>
              )}
            </div>
          </fieldset>
        )}
        {kind === "lights" && (
          <fieldset>
            <legend>Başlangıç / demo görünümü</legend>
            <div className="edit-grid">
              <LightFields value={draft} set={set} />
            </div>
          </fieldset>
        )}
        {kind === "modes" && (
          <Input
            label="Mod hedefi (°C)"
            type="number"
            min="5"
            max="35"
            step="0.5"
            required
            value={draft.target}
            onChange={(target) => set({ target })}
            hint="Odaların kendi alt ve üst sınırları korunur."
          />
        )}
        {kind === "scenes" && (
          <>
            <Input
              label="Açıklama"
              value={draft.description}
              onChange={(description) => set({ description })}
              maxLength="180"
            />
            <div className="section-title-row">
              <h3>Senaryo adımları</h3>
              <button
                className="secondary-button"
                type="button"
                onClick={addStep}
              >
                <Plus size={16} />
                Adım ekle
              </button>
            </div>
            {!draft.steps.length && (
              <p className="empty-inline">
                Henüz adım yok. Cihaz, ışık, sıcaklık veya bildirim ekle.
              </p>
            )}
            {draft.steps.map((a, i) => (
              <fieldset className="scene-step" key={a.id}>
                <legend>Adım {i + 1}</legend>
                <div className="record-actions">
                  <button
                    type="button"
                    aria-label={`Adım ${i + 1} yukarı`}
                    disabled={i === 0}
                    onClick={() => moveStep(i, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Adım ${i + 1} aşağı`}
                    disabled={i === draft.steps.length - 1}
                    onClick={() => moveStep(i, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Adım ${i + 1} sil`}
                    onClick={() =>
                      set({ steps: draft.steps.filter((x) => x.id !== a.id) })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="edit-grid">
                  <Select
                    label={`Adım ${i + 1} türü`}
                    value={a.type}
                    onChange={(type) =>
                      patchStep(a.id, {
                        type,
                        targetId: targets(state, type)[0]?.[0] || "",
                        temperature: 22,
                        on: true,
                        brightness: 75,
                        color: "#f4ce8a",
                        kelvin: 2700,
                        colorMode: "white",
                        operation:
                          OPERATIONS[
                            state.devices.find(
                              (d) => d.id === targets(state, type)[0]?.[0],
                            )?.type
                          ]?.[0]?.[0] || "on",
                        value: defaultActionValue(
                          OPERATIONS[
                            state.devices.find(
                              (d) => d.id === targets(state, type)[0]?.[0],
                            )?.type
                          ]?.[0]?.[0],
                        ),
                        service: "persistent_notification.create",
                        title: "evim",
                        message: "",
                      })
                    }
                    options={[
                      ["light", "Lamba"],
                      ["room", "Oda hedefi"],
                      ["mode", "Ev modu"],
                      ["device", "Cihaz işlemi"],
                      ["notify", "Bildirim"],
                    ]}
                  />
                  {a.type !== "notify" && (
                    <Select
                      label={`Adım ${i + 1} hedefi`}
                      value={a.targetId}
                      onChange={(targetId) =>
                        patchStep(a.id, {
                          targetId,
                          ...(a.type === "device"
                            ? {
                                operation:
                                  OPERATIONS[
                                    state.devices.find((d) => d.id === targetId)
                                      ?.type
                                  ]?.[0]?.[0] || "on",
                                value: defaultActionValue(
                                  OPERATIONS[
                                    state.devices.find((d) => d.id === targetId)
                                      ?.type
                                  ]?.[0]?.[0],
                                ),
                              }
                            : {}),
                        })
                      }
                      required
                      options={[["", "Hedef seç"], ...targets(state, a.type)]}
                    />
                  )}
                  {a.type === "device" && (
                    <>
                      <Select
                        label={`Adım ${i + 1} işlemi`}
                        value={a.operation}
                        onChange={(operation) =>
                          patchStep(a.id, {
                            operation,
                            value: defaultActionValue(operation),
                          })
                        }
                        options={(
                          OPERATIONS[
                            state.devices.find((d) => d.id === a.targetId)?.type
                          ] || []
                        ).filter(([op]) => {
                          const d = state.devices.find(
                            (d) => d.id === a.targetId,
                          );
                          return supportsOperation(
                            d?.type,
                            op,
                            entities[d?.entityId],
                          );
                        })}
                      />
                      {valueOperation(a.operation) && (
                        <DeviceActionValue
                          action={a}
                          index={i}
                          device={state.devices.find(
                            (d) => d.id === a.targetId,
                          )}
                          entities={entities}
                          onChange={(value) => patchStep(a.id, { value })}
                        />
                      )}
                    </>
                  )}
                  {a.type === "notify" && (
                    <>
                      <Input
                        label={`Adım ${i + 1} bildirim kanalı`}
                        value={a.service || ""}
                        onChange={(service) => patchStep(a.id, { service })}
                        list="notification-services"
                        placeholder="notify.mobile_app_telefon"
                        required
                      />
                      <Input
                        label={`Adım ${i + 1} bildirim başlığı`}
                        value={a.title || ""}
                        onChange={(title) => patchStep(a.id, { title })}
                        maxLength="100"
                        required
                      />
                      <Input
                        label={`Adım ${i + 1} bildirim metni`}
                        value={a.message || ""}
                        onChange={(message) => patchStep(a.id, { message })}
                        maxLength="500"
                        required
                      />
                    </>
                  )}
                  {a.type === "light" && (
                    <LightFields
                      value={a}
                      set={(p) => patchStep(a.id, p)}
                      prefix={`Adım ${i + 1} `}
                    />
                  )}{" "}
                  {a.type === "room" && (
                    <Input
                      label={`Adım ${i + 1} sıcaklığı`}
                      type="number"
                      min={
                        state.rooms.find((r) => r.id === a.targetId)?.min ?? 5
                      }
                      max={
                        state.rooms.find((r) => r.id === a.targetId)?.max ?? 35
                      }
                      step="0.5"
                      required
                      value={a.temperature}
                      onChange={(temperature) =>
                        patchStep(a.id, { temperature })
                      }
                    />
                  )}
                </div>
              </fieldset>
            ))}
          </>
        )}
        {kind === "programs" && (
          <>
            <Select
              label="Ne zaman çalışsın?"
              value={draft.trigger?.type || "time"}
              onChange={(type) =>
                set({
                  trigger: {
                    type,
                    event: "sunset",
                    offset: 0,
                    entityId: "",
                    seconds: 0,
                    to: "on",
                    comparison: "above",
                    value: 100,
                  },
                })
              }
              options={[
                ["time", "Belirli saatte"],
                ["sun", "Gün doğumu / gün batımı"],
                ["state", "Cihazın durumu değişince"],
                ["numeric", "Ölçüm bir eşiği geçince"],
              ]}
            />
            {draft.trigger?.type === "sun" && (
              <div className="edit-grid">
                <Select
                  label="Güneş olayı"
                  value={draft.trigger.event}
                  onChange={(event) =>
                    set({ trigger: { ...draft.trigger, event } })
                  }
                  options={[
                    ["sunrise", "Gün doğumu"],
                    ["sunset", "Gün batımı"],
                  ]}
                />
                <Input
                  label="Dakika farkı"
                  type="number"
                  min="-120"
                  max="120"
                  value={draft.trigger.offset}
                  onChange={(offset) =>
                    set({ trigger: { ...draft.trigger, offset } })
                  }
                  hint="Önce için eksi, sonra için artı. 0 olay anıdır."
                />
              </div>
            )}
            {["state", "numeric"].includes(draft.trigger?.type) && (
              <div className="edit-grid">
                <Input
                  label="İzlenecek sensör / cihaz"
                  list="all-ha-entities"
                  required
                  value={draft.trigger.entityId}
                  onChange={(entityId) =>
                    set({ trigger: { ...draft.trigger, entityId } })
                  }
                  placeholder="sensor.priz_guc"
                />
                {draft.trigger.type === "state" ? (
                  <Input
                    label="Yeni durum"
                    value={draft.trigger.to}
                    onChange={(to) =>
                      set({ trigger: { ...draft.trigger, to } })
                    }
                    required
                    hint="Örneğin: hareket için on, evde için home."
                  />
                ) : (
                  <>
                    <Select
                      label="Eşik yönü"
                      value={draft.trigger.comparison}
                      onChange={(comparison) =>
                        set({ trigger: { ...draft.trigger, comparison } })
                      }
                      options={[
                        ["above", "Üzerine çıktığında"],
                        ["below", "Altına indiğinde"],
                      ]}
                    />
                    <Input
                      label="Eşik değeri"
                      type="number"
                      step="any"
                      value={draft.trigger.value}
                      onChange={(value) =>
                        set({ trigger: { ...draft.trigger, value } })
                      }
                      required
                      hint={
                        "Sensörün bildirdiği birimde: " +
                        (entities[draft.trigger.entityId]?.attributes
                          .unit_of_measurement || "sensör birimi")
                      }
                    />
                  </>
                )}
                <Input
                  label="Bu durumda bekleme (saniye)"
                  type="number"
                  min="0"
                  max="3600"
                  value={draft.trigger.seconds}
                  onChange={(seconds) =>
                    set({ trigger: { ...draft.trigger, seconds } })
                  }
                  hint="0 anında çalıştırır. Bekleme sunucu yeniden başlarsa sıfırlanır."
                />
              </div>
            )}
            <fieldset>
              <legend>Çalışacağı günler</legend>
              <div className="day-picker">
                {DAYS.map((day, i) => (
                  <label key={day}>
                    <input
                      type="checkbox"
                      aria-label={day}
                      checked={draft.days.includes(i)}
                      onChange={(e) =>
                        set({
                          days: e.target.checked
                            ? [...draft.days, i]
                            : draft.days.filter((d) => d !== i),
                        })
                      }
                    />
                    <span>
                      {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][i]}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="edit-grid">
              {(!draft.trigger || draft.trigger.type === "time") && (
                <Input
                  label="Başlangıç saati"
                  type="time"
                  required
                  value={draft.time}
                  onChange={(time) => set({ time })}
                />
              )}
              <Select
                label="Çalıştırılacak işlem"
                value={draft.action}
                onChange={(action) => set({ action, targetId: "" })}
                options={[
                  ["mode", "Ev modu"],
                  ["scene", "Senaryo"],
                ]}
              />
              <Select
                label="Program hedefi"
                value={draft.targetId}
                onChange={(targetId) => set({ targetId })}
                options={[
                  ["", "Hedef seç"],
                  ...(draft.action === "mode" ? state.modes : state.scenes).map(
                    (x) => [x.id, x.name],
                  ),
                ]}
              />
            </div>
            <fieldset>
              <legend>Ek koşullar · hepsi sağlanmalı</legend>
              {(draft.conditions || []).map((c, i) => (
                <div className="condition-row" key={i}>
                  <Input
                    label={`Koşul ${i + 1} cihazı`}
                    list="all-ha-entities"
                    value={c.entityId}
                    onChange={(entityId) =>
                      set({
                        conditions: draft.conditions.map((x, j) =>
                          j === i ? { ...x, entityId } : x,
                        ),
                      })
                    }
                    required
                  />
                  <Input
                    label={`Koşul ${i + 1} durumu`}
                    value={c.state}
                    onChange={(value) =>
                      set({
                        conditions: draft.conditions.map((x, j) =>
                          j === i ? { ...x, state: value } : x,
                        ),
                      })
                    }
                    required
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Koşul ${i + 1} sil`}
                    onClick={() =>
                      set({
                        conditions: draft.conditions.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="secondary-button"
                disabled={(draft.conditions || []).length >= 8}
                onClick={() =>
                  set({
                    conditions: [
                      ...(draft.conditions || []),
                      { entityId: "", state: "on" },
                    ],
                  })
                }
              >
                <Plus size={16} />
                Koşul ekle
              </button>
            </fieldset>
            <div className="edit-toggle">
              <span>Program etkin</span>
              <Toggle
                label="Program etkin"
                checked={draft.enabled}
                onChange={(enabled) => set({ enabled })}
              />
            </div>
            <p className="small-note">
              Kaydettikten sonra Programlar ekranından “Sunucuya aktar” seç.
              Sonraki düzenlemeleri de yeniden aktar. Demo yalnız saatli ve
              koşulsuz programları bu sekme açıkken çalıştırır. Saat dilimi:{" "}
              {state.home.timeZone}.
            </p>
          </>
        )}
        <datalist id="all-ha-entities">
          {Object.values(entities || {}).map((e) => (
            <option key={e.entity_id} value={e.entity_id}>
              {e.attributes.friendly_name}
            </option>
          ))}
        </datalist>
        <datalist id="notification-services">
          <option value="persistent_notification.create">
            Home Assistant bildirim kutusu
          </option>
          {Object.keys(services?.notify || {}).map((s) => (
            <option key={s} value={"notify." + s}>
              {s}
            </option>
          ))}
        </datalist>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="editor-footer">
          <button className="secondary-button" type="button" onClick={close}>
            Vazgeç
          </button>
          <button className="primary-button" type="submit">
            <Save size={17} />
            Kaydet
          </button>
        </div>
      </form>
    </Modal>
  );
}
