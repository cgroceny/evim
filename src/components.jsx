import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Home,
  LayoutDashboard,
  DoorOpen,
  Lightbulb,
  CalendarDays,
  Settings2,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Plus,
  Minus,
  Sun,
  Moon,
  Luggage,
  LogOut,
  Sofa,
  BedDouble,
  Monitor,
  Coffee,
  Droplets,
  Thermometer,
  Radio,
  Check,
  X,
  Power,
  PlugZap,
  Wifi,
  WifiOff,
  Clock3,
  BookOpen,
  Clapperboard,
  Sparkles,
  Download,
  Upload,
  RotateCcw,
  Activity,
  CircleHelp,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Menu,
  Leaf,
  Laptop,
  ExternalLink,
  BatteryMedium,
} from "lucide-react";
import {
  MODES,
  DAYS,
  STORAGE_KEY,
  freshState,
  validateImport,
  temperature,
  formatTemp,
  setMode,
  targetFor,
  reconcileOverrides,
  sceneLights,
  hexToRgb,
  rgbToHex,
  available,
} from "./core.js";
import {
  connectHomeAssistant,
  disconnectHomeAssistant,
  command,
  rememberedUrl,
  hasSession,
  isCallback,
  connectionError,
} from "./ha.js";
import "./styles.css";
import TemperatureControl from "./TemperatureControl.jsx";

const NAV = [
  ["overview", "Genel bakış", LayoutDashboard],
  ["rooms", "Odalar", DoorOpen],
  ["lights", "Aydınlatma", Lightbulb],
  ["schedule", "Program", CalendarDays],
  ["settings", "Bağlantı & ayarlar", Settings2],
];
const MODE_ICONS = { Evde: Home, Gece: Moon, Dışarıda: LogOut, Tatil: Luggage };
const ROOM_ICONS = {
  sofa: Sofa,
  bed: BedDouble,
  desk: Monitor,
  coffee: Coffee,
};
const SCENES = [
  ["Okuma", BookOpen, "Daha iyi odaklan"],
  ["Film", Clapperboard, "Biraz atmosfer"],
  ["Gece ışığı", Moon, "Yumuşak bir geçiş"],
  ["Kapat", Power, "Işıklara mola"],
];
const H = {
  mode: "input_select.ev_modu",
  heat: "input_boolean.isitma_otomasyonu",
  comfort: "input_number.konfor_sicakligi",
  night: "input_number.gece_sicakligi",
  away: "input_number.ekonomi_sicakligi",
  lights: "script.ev_isik_senaryosu",
};
function readDemo() {
  try {
    return reconcileOverrides(
      validateImport(JSON.parse(localStorage.getItem(STORAGE_KEY))),
    );
  } catch {
    return freshState();
  }
}
function download(name, data, type = "application/json") {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={"toggle " + (checked ? "on" : "")}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}
function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const before = document.activeElement;
    const dialog = ref.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    // showModal() moves focus to the first focusable element (the close
    // button). React's autoFocus runs before that, so content marks the field
    // it wants with data-autofocus and we focus it after opening.
    dialog.querySelector("[data-autofocus]")?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      before?.focus();
    };
  }, []);
  // Close on a real backdrop click only: the press and the release must both
  // land outside the dialog box. Clicks in the padding, or a text selection
  // dragged past the edge, keep the dialog open.
  const outside = (e) => {
    const r = ref.current.getBoundingClientRect();
    return (
      e.target === ref.current &&
      (e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom)
    );
  };
  const pressedOutside = useRef(false);
  return (
    <dialog
      ref={ref}
      className={"modal " + (wide ? "wide" : "")}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        pressedOutside.current = outside(e);
      }}
      onClick={(e) => {
        if (pressedOutside.current && outside(e)) onClose();
        pressedOutside.current = false;
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Pencereyi kapat"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Empty({ icon: Icon = PlugZap, title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={32} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function RoomArt({ kind }) {
  return (
    <svg viewBox="0 0 170 85" aria-hidden="true" className="room-art">
      <path d="M8 76H161" stroke="currentColor" strokeOpacity=".15" />
      {kind === "bed" ? (
        <>
          <rect x="34" y="25" width="103" height="48" rx="5" fill="#d5c8af" />
          <rect x="40" y="30" width="42" height="16" rx="4" fill="#f6f0e5" />
          <rect x="88" y="30" width="42" height="16" rx="4" fill="#f6f0e5" />
          <path d="M34 50h103v21H34z" fill="#a5b4a2" />
          <path d="M38 70v7m94-7v7" stroke="#766f60" strokeWidth="4" />
          <path d="M16 36h13l-3-15h-7z" fill="#c5ac7d" />
          <path d="M22 36v27" stroke="#a6977c" strokeWidth="2" />
        </>
      ) : kind === "desk" ? (
        <>
          <rect x="31" y="45" width="113" height="7" rx="3" fill="#c8b18b" />
          <path d="M39 52v25m95-25v25" stroke="#a08b6c" strokeWidth="4" />
          <rect x="59" y="11" width="52" height="32" rx="4" fill="#8caaa1" />
          <rect x="63" y="15" width="44" height="24" rx="2" fill="#bcd0c4" />
          <path d="M85 43v4" stroke="#738f82" strokeWidth="5" />
          <path
            d="M19 42v-9m-5 3 5-6 6 6"
            fill="none"
            stroke="#7d9a7c"
            strokeWidth="3"
          />
          <path d="M14 40h11l-2 9h-7z" fill="#d1b692" />
        </>
      ) : kind === "coffee" ? (
        <>
          <rect x="27" y="34" width="116" height="39" rx="3" fill="#d7ccb7" />
          <path d="M26 34h118" stroke="#aeb8a1" strokeWidth="6" />
          <path d="M66 38v33m39-33v33" stroke="#f6f0e5" strokeWidth="2" />
          <rect x="29" y="9" width="49" height="17" rx="2" fill="#c1cbb8" />
          <path d="M53 9v17" stroke="#e6e9df" strokeWidth="2" />
          <path
            d="M102 31V17q0-8 9-8t9 8"
            fill="none"
            stroke="#8b9e8a"
            strokeWidth="3"
          />
          <path d="M83 34h41" stroke="#8b9e8a" strokeWidth="3" />
        </>
      ) : (
        <>
          <rect x="40" y="29" width="92" height="39" rx="10" fill="#b8c4ab" />
          <rect x="29" y="44" width="116" height="28" rx="8" fill="#96aa8b" />
          <rect x="40" y="46" width="46" height="19" rx="5" fill="#c7d0b9" />
          <rect x="88" y="46" width="46" height="19" rx="5" fill="#c7d0b9" />
          <path d="M37 69v9m99-9v9" stroke="#847860" strokeWidth="4" />
          <path d="M13 32h22l-6-20H19z" fill="#dbbc83" />
          <path d="M24 32v44m-9 0h18" stroke="#b79b6f" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}
function Chart({ period }) {
  const week = period === "week";
  const points = week
    ? "0,69 30,60 60,66 90,41 120,49 150,35 180,45 210,30 240,43 270,24 300,29 330,19 360,27"
    : "0,67 30,70 60,59 90,62 120,46 150,49 180,25 210,30 240,38 270,23 300,27 330,18 360,21";
  return (
    <div className="chart">
      <svg
        viewBox="0 0 360 100"
        role="img"
        aria-label={
          week
            ? "Haftalık örnek sıcaklık grafiği"
            : "Günlük örnek sıcaklık grafiği"
        }
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#a9bd91" stopOpacity=".32" />
            <stop offset="1" stopColor="#a9bd91" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 50, 80].map((y) => (
          <path
            key={y}
            d={`M0 ${y}H360`}
            stroke="#e6e7df"
            strokeDasharray="3 5"
          />
        ))}
        <path
          d="M0 34H360"
          stroke="#c8a879"
          strokeDasharray="5 5"
          strokeWidth="1.5"
        />
        <polygon points={`0,100 ${points} 360,100`} fill="url(#chart-fill)" />
        <polyline
          points={points}
          stroke="#6d9477"
          strokeWidth="2.5"
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="360" cy={week ? 27 : 21} r="4" fill="#477b5c" />
      </svg>
      <div className="chart-times">
        {(week
          ? ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]
          : ["00.00", "04.00", "08.00", "12.00", "16.00", "20.00"]
        ).map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  );
}
function RoomCard({ room, onTarget, onOpen, disabled, live }) {
  const Icon = ROOM_ICONS[room.icon] || DoorOpen;
  const warming = room.current !== null && room.current < room.target;
  return (
    <article
      className={"room-card thermostat-card " + (warming ? "warming" : "")}
    >
      <div className="room-top">
        <span className="room-icon">
          <Icon size={20} />
        </span>
        <button className="room-title" onClick={() => onOpen(room.id)}>
          <strong>{room.name}</strong>
          <span>
            {live
              ? room.available
                ? "Bağlı"
                : "Erişilemiyor"
              : `${room.valves} vana · Örnek oda`}
          </span>
        </button>
        <button
          className="icon-button small"
          aria-label={`${room.name} ayrıntıları`}
          onClick={() => onOpen(room.id)}
        >
          <ArrowUpRight size={19} />
        </button>
      </div>
      <div className="room-reading-row">
        <span>
          {live ? "Oda şu an" : "Örnek ölçüm"}{" "}
          <strong>{formatTemp(room.current)}°C</strong>
        </span>
        {room.humidity != null && (
          <span>
            <Droplets size={14} /> %{room.humidity}
          </span>
        )}
      </div>
      <TemperatureControl
        compact
        name={room.name}
        value={room.target}
        min={room.min}
        max={room.max}
        disabled={disabled}
        live={live}
        onApply={(value) => onTarget(room.id, value)}
      />
      <div className="room-bottom">
        <div className="room-state">
          <span className={"dot " + (warming ? "orange" : "green")} />
          {room.current === null
            ? "Ölçüm bekleniyor"
            : room.overrideUntil
              ? "Geçici ayar"
              : live
                ? room.action === "heating"
                  ? "Isıtıyor"
                  : "Hedef sıcaklık"
                : warming
                  ? "Hedefin altında"
                  : "Konfor aralığında"}
        </div>
        {!live && (
          <span className="room-target-duration">Hızlı ayar · 1 saat</span>
        )}
      </div>
    </article>
  );
}
function LightCard({ light, onChange, disabled }) {
  const [level, setLevel] = useState(light.brightness);
  const [tone, setTone] = useState(light.kelvin);
  useEffect(() => setLevel(light.brightness), [light.brightness]);
  useEffect(() => setTone(light.kelvin), [light.kelvin]);
  // Sliders commit shortly after the last change, whatever moved them (mouse,
  // touch, any key). If the lamp did not take the value (command failed or
  // the lamp is disabled), the slider returns to the lamp's real state.
  const latest = useRef(light);
  latest.current = light;
  const timers = useRef({});
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  const schedule = (key, patch) => {
    clearTimeout(timers.current[key]);
    clearTimeout(timers.current[key + "-sync"]);
    timers.current[key] = setTimeout(() => {
      onChange(light.id, patch);
      timers.current[key + "-sync"] = setTimeout(() => {
        if (key === "level") setLevel(latest.current.brightness);
        else setTone(latest.current.kelvin);
      }, 4000);
    }, 350);
  };
  const colors = [
    "#f4ce8a",
    "#fff1d4",
    "#d4e6ff",
    "#8e7dff",
    "#ef9abc",
    "#88c9ae",
  ];
  return (
    <article
      className={"light-card " + (light.on ? "lit" : "")}
      style={{ "--lamp-color": light.color }}
    >
      <div className="light-card-head">
        <span className="light-glyph">
          <Lightbulb size={26} />
        </span>
        <div>
          <h3>{light.name}</h3>
          <p>
            {light.room}
            {!light.available ? " · Bağlantı yok" : ""}
          </p>
        </div>
        <Toggle
          checked={light.on}
          disabled={disabled}
          label={`${light.name} aç/kapat`}
          onChange={(on) => onChange(light.id, { on })}
        />
      </div>
      <div className="range-label">
        <label htmlFor={"brightness-" + light.id}>Parlaklık</label>
        <strong>%{Math.round(level)}</strong>
      </div>
      <input
        id={"brightness-" + light.id}
        type="range"
        min="1"
        max="100"
        value={level}
        disabled={disabled || !light.brightnessSupported}
        onChange={(e) => {
          const v = +e.target.value;
          setLevel(v);
          schedule("level", { brightness: v, on: true });
        }}
      />
      <div className="swatches" aria-label={`${light.name} renkleri`}>
        {colors.map((c, i) => (
          <button
            key={c}
            aria-label={`${light.name}: ${["Sıcak beyaz", "Doğal beyaz", "Soğuk beyaz", "Mor", "Pembe", "Yeşil"][i]}`}
            title={
              [
                "Sıcak beyaz",
                "Doğal beyaz",
                "Soğuk beyaz",
                "Mor",
                "Pembe",
                "Yeşil",
              ][i]
            }
            style={{ background: c }}
            disabled={
              disabled || (i < 3 ? !light.tempSupported : !light.colorSupported)
            }
            className={light.color === c ? "selected" : ""}
            onClick={() =>
              onChange(
                light.id,
                i < 3
                  ? {
                      kelvin: [2700, 4000, 6000][i],
                      color: c,
                      white: true,
                      on: true,
                    }
                  : { color: c, on: true },
              )
            }
          >
            {light.color === c && <Check size={15} />}
          </button>
        ))}
        <label
          className={
            "custom-color " + (!light.colorSupported ? "disabled" : "")
          }
          title="Özel renk"
        >
          <Plus size={17} />
          <input
            type="color"
            aria-label={`${light.name} özel renk`}
            value={light.color}
            disabled={disabled || !light.colorSupported}
            onChange={(e) =>
              onChange(light.id, { color: e.target.value, on: true })
            }
          />
        </label>
      </div>
      <div className="range-label tone-label">
        <label htmlFor={"tone-" + light.id}>Beyaz tonu</label>
        <span>{tone} K</span>
      </div>
      <input
        id={"tone-" + light.id}
        className="tone-range"
        type="range"
        min={light.minKelvin || 2500}
        max={light.maxKelvin || 6500}
        step="100"
        value={tone}
        disabled={disabled || !light.tempSupported}
        onChange={(e) => {
          const v = +e.target.value;
          setTone(v);
          schedule("tone", { kelvin: v, white: true, on: true });
        }}
      />
    </article>
  );
}

function TemperatureInput({ label, value, disabled, onCommit }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const next = temperature(draft);
    setDraft(String(next));
    onCommit(next);
  };
  return (
    <input
      aria-label={label}
      type="number"
      min="10"
      max="28"
      step="0.5"
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

export {
  Toggle,
  Modal,
  Empty,
  RoomArt,
  Chart,
  RoomCard,
  LightCard,
  TemperatureInput,
  download,
};
