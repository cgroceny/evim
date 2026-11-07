import React, { useState, useRef, useEffect } from "react";
import { SCHEMES, readScheme, saveScheme } from "./scheme.js";
import {
  Home,
  LayoutDashboard,
  DoorOpen,
  Lightbulb,
  CalendarDays,
  Settings2,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  Search,
  Pencil,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
  Leaf,
  Moon,
  Sun,
  Luggage,
  BookOpen,
  Clapperboard,
  Sparkles,
  Power,
  Radio,
  Thermometer,
  Wifi,
  WifiOff,
  Activity,
  Download,
  Upload,
  Check,
  CheckCircle2,
  AlertCircle,
  X,
  Play,
  SlidersHorizontal,
  RotateCcw,
  Save,
  UserRound,
  PlugZap,
  Zap,
  MoreHorizontal,
  ShieldCheck,
  CircleHelp,
  Star,
} from "lucide-react";
import {
  Toggle,
  Modal,
  Empty,
  RoomCard,
  LightCard,
  download,
  RoomArt,
} from "./components.jsx";
import { formatTemp, available, rgbToHex, DAYS } from "./core.js";
import {
  KEY,
  LABELS,
  COLLECTIONS,
  initialState,
  validateState,
  template,
  saveRecord,
  deleteRecord,
  restoreRecord,
  duplicateRecord,
  reorder,
  applyMode,
  applyScene,
  expireOverrides,
  liveCommands,
  importEntities,
} from "./model.js";
import Editor, { Input, Select, Field } from "./Editor.jsx";
import Auth, { Recovery } from "./Auth.jsx";
import TemperatureControl from "./TemperatureControl.jsx";
import EnergyPage, { EnergySettings } from "./EnergyPage.jsx";
import DevicePanel from "./DevicePanel.jsx";
import IntegrationsPage, { SetupChecklist } from "./IntegrationsPage.jsx";
import ProgramPublish from "./ProgramPublish.jsx";
import HelpPage, { HealthPage, InstallCard } from "./HelpPage.jsx";
import { DEVICE_TYPES, applyDeviceAction, temperatureC } from "./devices.js";
import { isRoomThermostat } from "./climate.js";
import { applyRoomTarget } from "./model.js";
import { triggerLabel } from "./programs.js";
import { useAppLifecycle } from "./lifecycle.js";
import { energyUnit } from "./energy.js";
import AccountSecurity from "./AccountSecurity.jsx";
import { api, requireUser } from "./cloud.js";
import { companionCommand } from "./companions.js";
import {
  connectHomeAssistant,
  disconnectHomeAssistant,
  command,
  rememberedUrl,
  hasSession,
  isCallback,
  connectionError,
  loadMetadata,
} from "./ha.js";

const NAV = [
  ["overview", "Genel bakış", LayoutDashboard],
  ["rooms", "Odalar", DoorOpen],
  ["lights", "Aydınlatma", Lightbulb],
  ["energy", "Enerji", Zap],
  ["devices", "Cihazlar", Radio],
  ["integrations", "Entegrasyonlar", PlugZap],
  ["scenes", "Senaryolar", Sparkles],
  ["programs", "Programlar", CalendarDays],
  ["manage", "Yönetim", SlidersHorizontal],
  ["settings", "Hesap & ayarlar", Settings2],
  ["health", "Sistem durumu", ShieldCheck],
  ["help", "Yardım", CircleHelp],
];
const NAMES = {
  rooms: "Odalar",
  devices: "Cihazlar",
  lights: "Lambalar",
  modes: "Ev modları",
  scenes: "Senaryolar",
  programs: "Programlar",
};
const ICONS = {
  rooms: DoorOpen,
  devices: Radio,
  lights: Lightbulb,
  modes: Home,
  scenes: Sparkles,
  programs: CalendarDays,
  home: Home,
  moon: Moon,
  away: LogOut,
  holiday: Luggage,
  leaf: Leaf,
  book: BookOpen,
  film: Clapperboard,
  sparkles: Sparkles,
  power: Power,
  sun: Sun,
};
function loadLocal() {
  try {
    const raw =
      localStorage.getItem(KEY) || localStorage.getItem("evim.demo.v1");
    return raw ? validateState(JSON.parse(raw)) : initialState();
  } catch {
    return initialState();
  }
}
function SchemePicker() {
  const [scheme, setScheme] = useState(readScheme);
  return (
    <div className="scheme-picker">
      <Select
        label="Açık / koyu görünüm"
        value={scheme}
        onChange={(v) => {
          saveScheme(v);
          setScheme(v);
        }}
        options={SCHEMES}
        hint="Yalnız bu cihazda geçerlidir; ev düzeniyle eşitlenmez."
      />
    </div>
  );
}
function HomeForm({ value, onSave }) {
  const [d, set] = useState(value),
    [error, err] = useState(""),
    base = useRef(value);
  // A cloud refresh can change the saved settings while this form is open.
  // Follow it only when the user has not started editing, so typed text is
  // never wiped.
  useEffect(() => {
    if (JSON.stringify(value) === JSON.stringify(base.current)) return;
    if (JSON.stringify(value) === JSON.stringify(d)) {
      base.current = value; // our own save came back
      return;
    }
    const untouched = JSON.stringify(d) === JSON.stringify(base.current);
    base.current = value;
    if (untouched) set(value);
    else err("Bu ayarlar başka bir cihazda değişti. Kaydedersen buradaki değerler geçerli olur.");
  }, [value]);
  return (
    <form
      className="editor-form"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          onSave(d);
          err("");
        } catch (e) {
          err(e.message);
        }
      }}
    >
      <Input
        label="Ev adı"
        value={d.name}
        onChange={(name) => set({ ...d, name })}
        maxLength="60"
        required
      />
      <Input
        label="Ana ekran başlığı"
        value={d.title}
        onChange={(title) => set({ ...d, title })}
        maxLength="100"
        required
      />
      <Input
        label="Ana ekran açıklaması"
        value={d.subtitle}
        onChange={(subtitle) => set({ ...d, subtitle })}
        maxLength="200"
      />
      <Select
        label="Renk teması"
        value={d.theme}
        onChange={(theme) => set({ ...d, theme })}
        options={[
          ["forest", "Orman yeşili"],
          ["blue", "Gece mavisi"],
          ["earth", "Toprak"],
        ]}
      />
      <Input
        label="Saat dilimi"
        value={d.timeZone || "Europe/Istanbul"}
        onChange={(timeZone) => set({ ...d, timeZone })}
        required
        list="time-zones"
        hint="Home Assistant’taki saat dilimiyle aynı olmalı."
      />
      <datalist id="time-zones">
        {[
          "Europe/Istanbul",
          "Europe/Berlin",
          "Europe/London",
          "UTC",
          "America/New_York",
        ].map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-button" type="submit">
        <Save size={16} />
        Ev ayarlarını kaydet
      </button>
    </form>
  );
}
function Actions({
  kind,
  record,
  index,
  total,
  onEdit,
  onDelete,
  onCopy,
  onMove,
}) {
  return (
    <div className="record-actions">
      <button
        aria-label={`${record.name} düzenle`}
        title="Düzenle"
        onClick={() => onEdit(kind, record)}
      >
        <Pencil size={16} />
      </button>
      <button
        aria-label={`${record.name} kopyala`}
        title="Kopyala"
        onClick={() => onCopy(kind, record.id)}
      >
        <Copy size={16} />
      </button>
      <button
        aria-label={`${record.name} yukarı`}
        title="Yukarı taşı"
        disabled={index === 0}
        onClick={() => onMove(kind, record.id, -1)}
      >
        <ArrowUp size={16} />
      </button>
      <button
        aria-label={`${record.name} aşağı`}
        title="Aşağı taşı"
        disabled={index === total - 1}
        onClick={() => onMove(kind, record.id, 1)}
      >
        <ArrowDown size={16} />
      </button>
      <button
        className="danger-text"
        aria-label={`${record.name} sil`}
        title="Sil"
        onClick={() => onDelete(kind, record)}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
export default function App() {
  const { online, installable, install, updateReady, updateApp } =
    useAppLifecycle();
  const [data, setData] = useState(loadLocal),
    dataRef = useRef(data);
  const [page, setPage] = useState(() =>
      NAV.some((n) => n[0] === location.hash.slice(1))
        ? location.hash.slice(1)
        : "overview",
    ),
    [kind, setKind] = useState("rooms"),
    [query, setQuery] = useState(""),
    [modal, setModal] = useState(null),
    [editor, setEditor] = useState(null),
    [toast, setToast] = useState(null);
  const [user, setUser] = useState(null),
    userRef = useRef(null),
    [cloudReady, setCloudReady] = useState(false),
    [syncBusy, setSyncBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    dirtyRef = useRef(false),
    [revision, setRevision] = useState(null),
    revRef = useRef(null),
    [syncError, setSyncError] = useState(""),
    [conflict, setConflict] = useState(false),
    [recovery, setRecovery] = useState(null);
  const [entities, setEntities] = useState({}),
    [live, setLive] = useState(false),
    [haStatus, setHaStatus] = useState("idle"),
    [hassUrl, setHassUrl] = useState(rememberedUrl),
    [haError, setHaError] = useState(""),
    [commandBusy, setCommandBusy] = useState(false),
    [duration, setDuration] = useState(60);
  const [metadata, setMetadata] = useState({}),
    [metadataBusy, setMetadataBusy] = useState(false),
    [favoriteRooms, setFavoriteRooms] = useState(false),
    [favoriteLights, setFavoriteLights] = useState(false);
  const metadataGeneration = useRef(0),
    commandLock = useRef(false),
    retryAt = useRef(0),
    retryCount = useRef(0);
  const booted = useRef(false),
    importRef = useRef(null),
    runKeys = useRef(new Set()),
    [pendingImport, setPendingImport] = useState(null);
  const notify = (text, error = false) =>
    setToast({ text, error, id: Date.now() });
  async function refreshMetadata() {
    const generation = ++metadataGeneration.current;
    setMetadataBusy(true);
    try {
      const next = await loadMetadata();
      if (generation === metadataGeneration.current) setMetadata(next);
    } catch (e) {
      notify(connectionError(e), true);
    } finally {
      if (generation === metadataGeneration.current) setMetadataBusy(false);
    }
  }
  useEffect(() => {
    if (haStatus === "connected") refreshMetadata();
    else {
      metadataGeneration.current++;
      setMetadata({});
      setMetadataBusy(false);
    }
  }, [haStatus]);
  useEffect(() => {
    const changed = () => {
      const p = location.hash.slice(1);
      if (NAV.some((n) => n[0] === p)) {
        setPage(p);
        setQuery("");
      }
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  useEffect(() => {
    const prevent = (e) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const cacheKey = () =>
    userRef.current ? KEY + ".account." + userRef.current.id : KEY;
  function cache(next, isDirty, rev = revRef.current) {
    localStorage.setItem(
      cacheKey(),
      JSON.stringify(
        userRef.current ? { state: next, revision: rev, dirty: isDirty } : next,
      ),
    );
  }
  function replace(next, rev, isDirty = false) {
    dataRef.current = next;
    revRef.current = rev;
    dirtyRef.current = isDirty;
    setData(next);
    setRevision(rev);
    setDirty(isDirty);
    cache(next, isDirty, rev);
  }
  function commit(updater, label) {
    if (!cloudReady)
      throw new Error("Hesap yükleniyor, birkaç saniye sonra tekrar deneyin.");
    const current = dataRef.current;
    let next = validateState(
      typeof updater === "function" ? updater(current) : updater,
    );
    next.updatedAt = Date.now();
    if (label)
      next.events = [{ text: label, time: Date.now() }, ...next.events].slice(
        0,
        60,
      );
    cache(next, !!userRef.current);
    dataRef.current = next;
    setData(next);
    if (userRef.current) {
      dirtyRef.current = true;
      setDirty(true);
    }
    return next;
  }
  function change(updater, label) {
    try {
      commit(updater, label);
      notify(label);
    } catch (e) {
      notify(e.message, true);
    }
  }
  async function enterCloud(auth) {
    const result = requireUser(await api("state"));
    userRef.current = result.user;
    setUser(result.user);
    setConflict(false);
    setSyncError("");
    let cached;
    try {
      cached = JSON.parse(
        localStorage.getItem(KEY + ".account." + result.user.id) || "null",
      );
    } catch {}
    if (cached?.dirty) {
      const local = validateState(cached.state);
      replace(local, cached.revision, true);
      if (cached.revision !== result.revision) {
        setConflict(true);
        setSyncError(
          "Başka bir cihazda yeni değişiklikler var. Yerel taslak korunuyor.",
        );
      }
    } else if (result.state)
      replace(validateState(result.state), result.revision);
    else replace(dataRef.current, null, true);
    setCloudReady(true);
    setModal(null);
    if (auth?.recoveryCode)
      setRecovery({ code: auth.recoveryCode, username: result.user.username });
    notify("Hesabınıza giriş yapıldı.");
  }
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    api("state")
      .then(async (r) => {
        if (!r.user) return; // guest: stay on the local layout
        userRef.current = r.user;
        setUser(r.user);
        let cached;
        try {
          cached = JSON.parse(
            localStorage.getItem(KEY + ".account." + r.user.id) || "null",
          );
        } catch {}
        if (cached?.dirty) {
          replace(validateState(cached.state), cached.revision, true);
          if (cached.revision !== r.revision) {
            setConflict(true);
            setSyncError("Yerel taslak ve buluttaki kayıt farklı.");
          }
        } else
          replace(
            r.state ? validateState(r.state) : dataRef.current,
            r.revision,
            !r.state,
          );
      })
      .catch((e) => {
        if (e.status !== 401) setSyncError(e.message);
      })
      .finally(() => setCloudReady(true));
    if (isCallback() || hasSession()) {
      setLive(true);
      connectHomeAssistant(rememberedUrl(), setEntities, setHaStatus).catch(
        (e) => {
          setHaStatus("disconnected");
          setHaError(connectionError(e));
        },
      );
    }
  }, []);
  useEffect(() => {
    if (!user || !dirty || syncBusy || conflict || !cloudReady || !online)
      return;
    const timer = setTimeout(
      async () => {
        const snapshot = dataRef.current,
          base = revRef.current;
        setSyncBusy(true);
        setSyncError("");
        try {
          const r = await api("state", "PUT", {
            state: snapshot,
            revision: base,
            accountId: userRef.current.id,
          });
          revRef.current = r.revision;
          setRevision(r.revision);
          const stillDirty = dataRef.current !== snapshot;
          dirtyRef.current = stillDirty;
          setDirty(stillDirty);
          cache(dataRef.current, stillDirty, r.revision);
          retryCount.current = 0;
          retryAt.current = 0;
        } catch (e) {
          setSyncError(e.message);
          if (e.status === 401) sessionLost();
          else if (e.status === 409) await settleConflict(snapshot);
          else if ([403, 426].includes(e.status)) setConflict(true);
          else {
            retryCount.current++;
            retryAt.current =
              Date.now() + Math.min(60000, 2000 * 2 ** retryCount.current);
          }
        } finally {
          setSyncBusy(false);
        }
      },
      Math.max(900, retryAt.current - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [data, user, dirty, syncBusy, conflict, cloudReady, online]);
  // The session expired (7 days) or was closed from another device. Keep the
  // draft in this browser and ask for a new sign-in; enterCloud restores it.
  function sessionLost() {
    cache(dataRef.current, true, revRef.current);
    setConflict(true);
    setSyncError(
      "Oturumun sona erdi. Değişikliklerin bu cihazda korunuyor; eşitlemek için yeniden giriş yap.",
    );
    setModal("auth");
  }
  // A save can time out on the client after the server already stored it.
  // If the cloud copy is exactly what we sent, adopt its revision silently.
  async function settleConflict(snapshot) {
    try {
      const r = requireUser(await api("state"));
      const same = (a, b) =>
        JSON.stringify({ ...a, updatedAt: 0 }) ===
        JSON.stringify({ ...b, updatedAt: 0 });
      if (r.user.id === userRef.current?.id && r.state && same(r.state, snapshot)) {
        revRef.current = r.revision;
        setRevision(r.revision);
        const stillDirty = dataRef.current !== snapshot;
        dirtyRef.current = stillDirty;
        setDirty(stillDirty);
        cache(dataRef.current, stillDirty, r.revision);
        setSyncError("");
        return;
      }
    } catch (e) {
      if (e.status === 401) return sessionLost();
    }
    setConflict(true);
  }
  async function refreshCloud(replaceLocal = false) {
    if (!user) return;
    try {
      const r = requireUser(await api("state"));
      if (r.user.id !== userRef.current.id) {
        setSyncError("Başka bir hesapta giriş yapıldı. Sayfayı yenileyin.");
        setConflict(true);
        return;
      }
      if (!r.state) {
        // Nothing stored in the cloud: there is nothing to conflict with, so
        // the local layout becomes the first cloud version.
        if (replaceLocal || conflict) {
          revRef.current = null;
          setRevision(null);
          cache(dataRef.current, true, null);
          setConflict(false);
          setSyncError("");
          setModal(null);
        }
        return;
      }
      if (replaceLocal) {
        download(
          "evim-yerel-taslak.json",
          JSON.stringify(dataRef.current, null, 2),
        );
        replace(validateState(r.state), r.revision);
        setConflict(false);
        setSyncError("");
        setModal(null);
        notify("Buluttaki sürüm yüklendi; önceki taslak indirildi.");
      } else if (!dirtyRef.current && r.revision !== revRef.current) {
        replace(validateState(r.state), r.revision);
        notify("Diğer cihazdaki değişiklikler alındı.");
      }
    } catch (e) {
      if (e.status === 401) sessionLost();
      else setSyncError(e.message);
    }
  }
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      if (
        !document.hidden &&
        !dirtyRef.current &&
        !syncBusy &&
        !editor &&
        !modal
      )
        refreshCloud();
    }, 30000);
    const onFocus = () => {
      if (!dirtyRef.current && !syncBusy && !editor && !modal) refreshCloud();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [user, syncBusy, editor, modal]);
  useEffect(() => {
    if (live) return;
    const timer = setInterval(() => {
      let next = expireOverrides(dataRef.current);
      if (next.heating) {
        const p = new Intl.DateTimeFormat("tr-TR", {
          timeZone: dataRef.current.home.timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          weekday: "long",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).formatToParts(new Date());
        const v = (t) => p.find((x) => x.type === t)?.value;
        const day = DAYS.indexOf(v("weekday")),
          time = v("hour") + ":" + v("minute"),
          date = v("year") + v("month") + v("day");
        for (const program of next.programs.filter(
          (p) =>
            p.enabled &&
            (!p.trigger || p.trigger.type === "time") &&
            !p.conditions?.length &&
            p.days.includes(day) &&
            p.time === time,
        )) {
          const key = date + program.id + time;
          if (runKeys.current.has(key)) continue;
          runKeys.current.add(key);
          try {
            next =
              program.action === "mode"
                ? applyMode(next, program.targetId)
                : applyScene(
                    next,
                    next.scenes.find((s) => s.id === program.targetId),
                  );
            next.events = [
              { time: Date.now(), text: "Demo programı: " + program.name },
              ...next.events,
            ].slice(0, 60);
          } catch {}
        }
      }
      if (next !== dataRef.current)
        try {
          commit(next);
        } catch (e) {
          notify(e.message, true);
        }
    }, 15000);
    return () => clearInterval(timer);
  }, [live, cloudReady]);
  function navigate(p) {
    if (p === "more") {
      setModal("more");
      return;
    }
    setPage(p);
    history.pushState({}, "", location.pathname + location.search + "#" + p);
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const ready = !live || (online && haStatus === "connected");
  const knownTemperatureUnit = ["°C", "°F"].includes(
    metadata.config?.unit_system?.temperature,
  );
  const rooms = data.rooms.map((r) => {
    const ds = data.devices.filter((d) => d.roomId === r.id && d.enabled),
      sensor = ds.find((d) => d.id === r.sensorId),
      valves = ds.filter((d) =>
        isRoomThermostat(d, live ? entities[d.entityId] : null),
      );
    let values,
      humidity,
      battery,
      target = r.target;
    if (live) {
      const measure = (d) => {
        const e = entities[d.entityId];
        if (!available(e)) return null;
        if (d.type === "climate" && !knownTemperatureUnit) return null;
        const n =
          d.type === "sensor"
            ? temperatureC(e)
            : metadata.config?.unit_system?.temperature === "°F"
              ? ((e.attributes.current_temperature - 32) * 5) / 9
              : e.attributes.current_temperature;
        return Number.isFinite(n) ? n : null;
      };
      values = (sensor ? [measure(sensor)] : valves.map(measure)).filter(
        (x) => x !== null,
      );
      humidity = sensor ? entities[sensor.entityId]?.attributes.humidity : null;
      battery = null;
      const ts = valves.map((d) => entities[d.entityId]).filter(available);
      if (
        knownTemperatureUnit &&
        ts.length &&
        Number.isFinite(ts[0].attributes.temperature)
      )
        target =
          metadata.config?.unit_system?.temperature === "°F"
            ? ((ts[0].attributes.temperature - 32) * 5) / 9
            : ts[0].attributes.temperature;
    } else {
      values = (sensor ? [sensor] : valves).map((d) => d.temperature);
      humidity = sensor?.humidity;
      battery = valves.length
        ? Math.min(...valves.map((d) => d.battery))
        : null;
    }
    return {
      ...r,
      current: values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null,
      target,
      humidity: humidity ?? null,
      battery,
      valves: valves.length,
      available:
        !live ||
        (knownTemperatureUnit &&
          valves.some((d) => available(entities[d.entityId]))),
    };
  });
  const lights = data.lights.map((l) => {
    const e = entities[l.entityId],
      m = e?.attributes.supported_color_modes || [];
    return {
      ...l,
      room: data.rooms.find((r) => r.id === l.roomId)?.name || "Atanmamış",
      ...(live
        ? {
            on: e?.state === "on",
            brightness: Math.round(
              ((e?.attributes.brightness ?? 255) / 255) * 100,
            ),
            color: rgbToHex(e?.attributes.rgb_color),
            kelvin: e?.attributes.color_temp_kelvin || l.kelvin,
            available: available(e) && l.enabled,
            colorSupported: m.some((x) =>
              ["rgb", "rgbw", "rgbww", "hs", "xy"].includes(x),
            ),
            tempSupported: m.includes("color_temp"),
            brightnessSupported: m.some((x) => x !== "onoff"),
            minKelvin: e?.attributes.min_color_temp_kelvin,
            maxKelvin: e?.attributes.max_color_temp_kelvin,
          }
        : {
            available: l.enabled,
            colorSupported: true,
            tempSupported: true,
            brightnessSupported: true,
          }),
    };
  });
  const measures = rooms.map((r) => r.current).filter((x) => x !== null),
    average = measures.length
      ? measures.reduce((a, b) => a + b, 0) / measures.length
      : null,
    mode = data.modes.find((m) => m.id === data.activeModeId);
  async function runSteps(steps, label, apply) {
    if (commandLock.current || !cloudReady) return false;
    if (!live) {
      try {
        commit(apply, label + " · demo");
        notify(label + " · demo");
        return true;
      } catch (e) {
        notify(e.message, true);
        return false;
      }
    }
    if (!ready) {
      notify("Home Assistant bağlantısı yok.", true);
      return false;
    }
    let completed = 0;
    commandLock.current = true;
    setCommandBusy(true);
    try {
      const plans = liveCommands(
        dataRef.current,
        steps,
        entities,
        metadata.services,
        metadata.config?.unit_system?.temperature || null,
      );
      for (const p of plans) {
        await command(...p);
        completed++;
      }
      commit(apply, label + " · komut iletildi");
      notify(completed + " komut Home Assistant’a iletildi.");
      return true;
    } catch (e) {
      notify(
        (completed
          ? completed + " komut iletildi; kalan işlem durduruldu. "
          : "") + connectionError(e),
        true,
      );
      return false;
    } finally {
      commandLock.current = false;
      setCommandBusy(false);
    }
  }
  const runMode = (id) =>
    runSteps(
      [{ type: "mode", targetId: id }],
      data.modes.find((m) => m.id === id)?.name || "Ev modu",
      (s) => applyMode(s, id),
    );
  const runScene = (s) =>
    runSteps(s.steps, s.name, (state) =>
      applyScene(state, s, { simulateDevices: !live }),
    );
  function runProgram(p) {
    if (!p.targetId) return notify("Program hedefi eksik.", true);
    p.action === "mode"
      ? runMode(p.targetId)
      : runScene(data.scenes.find((s) => s.id === p.targetId));
  }
  function roomTarget(id, target, minutes = 60) {
    const r = data.rooms.find((r) => r.id === id);
    if (!r || !Number.isFinite(target)) return false;
    target = Math.min(r.max, Math.max(r.min, target));
    return runSteps(
      [{ type: "room", targetId: id, temperature: target }],
      r.name + " hedefi " + formatTemp(target) + "°C",
      (s) =>
        applyRoomTarget(
          s,
          id,
          target,
          live ? null : Date.now() + minutes * 60000,
        ),
    );
  }
  function lightChange(id, patch) {
    const l = data.lights.find((l) => l.id === id);
    if (!l.enabled) return;
    const { white, ...values } = patch;
    const next = {
      ...l,
      ...values,
      colorMode: white ? "white" : patch.color ? "color" : l.colorMode,
    };
    runSteps(
      [{ ...next, type: "light", targetId: id }],
      l.name + " ayarı",
      (s) => ({ ...s, lights: s.lights.map((x) => (x.id === id ? next : x)) }),
    );
  }
  function runDevice(d, action) {
    return runSteps(
      [{ type: "device", targetId: d.id, ...action }],
      d.name + " · cihaz işlemi",
      (s) => ({
        ...s,
        devices: s.devices.map((x) =>
          x.id === d.id && !live ? applyDeviceAction(x, action) : x,
        ),
      }),
    );
  }
  // Gree switches, valve settings and other entities of the same HA device.
  async function companionAction(d, item, action) {
    if (commandLock.current || !cloudReady) return false;
    if (!live) {
      if (item.domain !== "switch" || !item.key) return false;
      const on = action.operation === "on";
      try {
        commit(
          (s) => ({
            ...s,
            devices: s.devices.map((x) =>
              x.id === d.id
                ? {
                    ...x,
                    climateDemo: {
                      ...x.climateDemo,
                      features: {
                        ...x.climateDemo?.features,
                        [item.key]: on,
                      },
                    },
                  }
                : x,
            ),
          }),
          item.label + " · demo",
        );
        notify(item.label + (on ? " açıldı" : " kapandı") + " · demo");
        return true;
      } catch (e) {
        notify(e.message, true);
        return false;
      }
    }
    if (!ready) {
      notify("Home Assistant bağlantısı yok.", true);
      return false;
    }
    commandLock.current = true;
    setCommandBusy(true);
    try {
      const plan = companionCommand(
        d.entityId,
        item.entityId,
        action,
        metadata.entities,
        entities,
        metadata.services,
      );
      await command(...plan);
      notify(item.label + " · komut iletildi.");
      return true;
    } catch (e) {
      notify(connectionError(e), true);
      return false;
    } finally {
      commandLock.current = false;
      setCommandBusy(false);
    }
  }
  function deviceAction(d, action) {
    if (live && ["script", "scene", "button", "cover"].includes(d.type))
      setModal({ deviceAction: { device: d, action } });
    else return runDevice(d, action);
  }
  function edit(k, r) {
    setModal(null);
    setEditor({ kind: k, record: structuredClone(r), isNew: false });
  }
  function add(k) {
    setEditor({ kind: k, record: template(k, data), isNew: true });
  }
  const actions = (k, r, i) => (
    <Actions
      kind={k}
      record={r}
      index={i}
      total={data[k].length}
      onEdit={edit}
      onDelete={(kind, record) => setModal({ delete: true, kind, record })}
      onCopy={(k, id) =>
        change((s) => duplicateRecord(s, k, id), LABELS[k] + " kopyalandı.")
      }
      onMove={(k, id, d) =>
        change((s) => reorder(s, k, id, d), "Sıralama kaydedildi.")
      }
    />
  );
  const filtered = (list) =>
    list.filter((r) =>
      (r.name + " " + (r.entityId || ""))
        .toLocaleLowerCase("tr")
        .includes(query.toLocaleLowerCase("tr")),
    );
  function heading(title, subtitle, k) {
    return (
      <div className="page-heading">
        <div>
          <p className="eyebrow">EVİN, SENİN KURALLARIN</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {k && (
          <button className="primary-button" onClick={() => add(k)}>
            <Plus size={18} />
            {LABELS[k]} ekle
          </button>
        )}
      </div>
    );
  }
  const search = (
    <div className="search-box">
      <Search size={17} />
      <input
        aria-label="Kayıtlarda ara"
        placeholder="Ad veya cihaz kimliğiyle ara…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query && (
        <button aria-label="Aramayı temizle" onClick={() => setQuery("")}>
          <X size={16} />
        </button>
      )}
    </div>
  );
  const modeStrip = (
    <div className="mode-strip dynamic-modes">
      {data.modes.map((m) => {
        const Icon = ICONS[m.icon];
        return (
          <button
            key={m.id}
            aria-pressed={data.activeModeId === m.id}
            className={data.activeModeId === m.id ? "active" : ""}
            disabled={!ready || commandBusy}
            onClick={() => runMode(m.id)}
          >
            <Icon size={18} />
            <span>
              {m.name}
              <small>{formatTemp(m.target)}°</small>
            </span>
          </button>
        );
      })}
      {!data.modes.length && (
        <button onClick={() => add("modes")}>
          <Plus size={18} />
          Ev modu ekle
        </button>
      )}
    </div>
  );
  const roomGrid = (
    <div className="room-grid">
      {filtered(rooms)
        .filter((r) => page !== "rooms" || !favoriteRooms || r.favorite)
        .map((r) => (
          <div className="editable-card" key={r.id}>
            <RoomCard
              room={r}
              live={live}
              disabled={!cloudReady || !ready || commandBusy || !r.available}
              onTarget={roomTarget}
              onOpen={(id) => {
                setDuration(60);
                setModal({ room: id });
              }}
            />
            {actions(
              "rooms",
              r,
              data.rooms.findIndex((x) => x.id === r.id),
            )}
          </div>
        ))}
    </div>
  );
  const sceneCards = (
    <div className="scene-grid editable-scenes">
      {filtered(data.scenes).map((s) => {
        const Icon = ICONS[s.icon];
        return (
          <article className="scene-record" key={s.id}>
            <button
              className="scene-button"
              disabled={!ready || commandBusy || !s.steps.length}
              onClick={() => runScene(s)}
            >
              <span className="scene-icon">
                <Icon size={22} />
              </span>
              <strong>{s.name}</strong>
              <small>{s.description || s.steps.length + " adım"}</small>
              <Play size={16} className="scene-arrow" />
            </button>
            {actions(
              "scenes",
              s,
              data.scenes.findIndex((x) => x.id === s.id),
            )}
          </article>
        );
      })}
    </div>
  );
  async function connect() {
    setHaError("");
    try {
      await connectHomeAssistant(hassUrl, setEntities, setHaStatus);
      setLive(true);
      setModal(null);
      notify("Home Assistant bağlandı.");
    } catch (e) {
      setHaStatus("disconnected");
      setHaError(connectionError(e));
    }
  }
  async function disconnect() {
    try {
      await disconnectHomeAssistant();
    } catch {}
    setLive(false);
    setEntities({});
    setHaStatus("idle");
    notify("Home Assistant oturumu kapandı.");
  }
  async function logout() {
    try {
      await api("logout", "POST", {});
      await disconnectHomeAssistant().catch(() => {});
      localStorage.removeItem(KEY + ".account." + user.id);
      userRef.current = null;
      setUser(null);
      setLive(false);
      setEntities({});
      setHaStatus("idle");
      setDirty(false);
      dirtyRef.current = false;
      revRef.current = null;
      setRevision(null);
      setConflict(false);
      setSyncError("");
      const guest = loadLocal();
      dataRef.current = guest;
      setData(guest);
      notify("Hesap oturumu kapatıldı.");
    } catch (e) {
      notify(e.message, true);
    }
  }
  async function importFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 512000)
        throw new Error("Dosya en fazla 500 KB olabilir.");
      setPendingImport(validateState(JSON.parse(await file.text())));
      setModal("import");
    } catch (e) {
      notify(e.message, true);
    }
  }
  const selectedRoom = rooms.find((r) => r.id === modal?.room);
  function detail(k, r) {
    if (k === "rooms")
      return `${data.devices.filter((d) => d.roomId === r.id).length} cihaz · ${formatTemp(r.target)}°C`;
    if (k === "devices")
      return `${DEVICE_TYPES[r.type]} · ${data.rooms.find((x) => x.id === r.roomId)?.name || "Atanmamış"} · ${r.protocol}`;
    if (k === "lights")
      return `${data.rooms.find((x) => x.id === r.roomId)?.name || "Atanmamış"} · ${r.protocol}`;
    if (k === "modes") return `${formatTemp(r.target)}°C hedef`;
    if (k === "scenes") return r.steps.length + " adım";
    return (
      r.time +
      " · " +
      r.days
        .map((i) => ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][i])
        .join(", ")
    );
  }
  return (
    <div className={"app-shell theme-" + data.home.theme}>
      <a href="#main" className="skip">
        İçeriğe geç
      </a>
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("overview")}>
          <span className="brand-icon">
            <Home size={25} />
          </span>
          <span>
            evim<span className="brand-dot">.</span>
          </span>
        </button>
        <p className="brand-sub">EVİN, SENİN KURALLARIN.</p>
        <div className="home-label">
          <Home size={20} />
          <div>
            <strong>{data.home.name}</strong>
            <small>{user ? "@" + user.username : "Misafir düzeni"}</small>
          </div>
          <button
            aria-label="Ev ayarlarını aç"
            onClick={() => navigate("settings")}
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <span className="nav-label">KONTROL MERKEZİ</span>
        <nav aria-label="Ana menü">
          {NAV.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={page === id ? "active" : ""}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-mini">
            <span className={"dot " + (user && !dirty ? "green" : "orange")} />
            <div>
              <strong>
                {user
                  ? syncBusy
                    ? "Eşitleniyor…"
                    : dirty
                      ? "Değişiklik bekliyor"
                      : "Bulutta kayıtlı"
                  : "Cihazlar arasında eşitle"}
              </strong>
              <small>
                {user ? "@" + user.username : "Hesabınla giriş yap"}
              </small>
            </div>
          </div>
          <button
            className="sidebar-connect"
            onClick={() => (user ? navigate("settings") : setModal("auth"))}
          >
            {user ? "Hesabımı yönet" : "Giriş yap / Hesap oluştur"}
            <ArrowUpRight size={17} />
          </button>
          <div className="sidebar-foot">
            <Leaf size={14} />
            <span>Evin, senin ritminde.</span>
            <span>v3.2</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <Home size={16} />
            <span>{data.home.name}</span>
            <ChevronRight size={14} />
            <strong>{NAV.find((x) => x[0] === page)?.[1]}</strong>
          </div>
          <div className="topbar-right">
            <button
              className="cloud-indicator"
              title="Hesap eşitleme durumu"
              onClick={() => (user ? navigate("settings") : setModal("auth"))}
            >
              {user ? <Cloud size={19} /> : <CloudOff size={19} />}
              <span>
                {user
                  ? syncBusy
                    ? "Kaydediliyor"
                    : dirty
                      ? "Taslak"
                      : "Eşitlendi"
                  : "Giriş yap"}
              </span>
            </button>
            <button
              className={"connection-badge " + (live ? "live" : "")}
              onClick={() => setModal("connect")}
            >
              <span className="dot" />
              {live ? (ready ? "Canlı" : "Çevrimdışı") : "Demo"}
            </button>
            <button
              className="icon-button"
              aria-label="Etkinlik geçmişini aç"
              onClick={() => setModal("activity")}
            >
              <Activity size={20} />
            </button>
          </div>
        </header>
        <main id="main">
          {!online && (
            <div role="status" className="offline-banner">
              <WifiOff size={20} />
              <span>
                Çevrimdışısın. Bulut eşitlemesi ve uzaktan cihaz kontrolü
                bağlantıyı bekliyor. Fiziksel komutlar sıraya alınmaz.
              </span>
            </div>
          )}
          {updateReady && (
            <div className="feature-banner">
              <RefreshCw size={20} />
              <span>evim’in yeni sürümü hazır.</span>
              <button
                disabled={
                  dirty || syncBusy || commandBusy || !!editor || !!modal
                }
                onClick={updateApp}
              >
                Güncellemeyi aç
              </button>
            </div>
          )}
          <div className={"demo-banner " + (live ? "live-banner" : "")}>
            <span className="banner-symbol">
              {live ? (
                ready ? (
                  <Wifi size={16} />
                ) : (
                  <WifiOff size={16} />
                )
              ) : (
                <Sparkles size={16} />
              )}
            </span>
            <p>
              {live ? (
                ready ? (
                  "Home Assistant bağlı. Yalnızca eşleştirdiğin cihazlar kontrol edilir."
                ) : (
                  "Bağlantı kesildi; son ölçümler güncel olmayabilir."
                )
              ) : (
                <>
                  {" "}
                  <strong>Demo kontrolü açık.</strong> Düzenin kaydedilir; örnek
                  cihazlara yaptığın ayarlar gerçek evini etkilemez.
                </>
              )}
            </p>
            <button onClick={() => setModal("connect")}>
              {live ? "Bağlantı" : "Evime bağlan"}
              <ArrowRight size={15} />
            </button>
          </div>
          {user && syncError && (
            <div className="sync-alert" role="alert">
              <CloudOff size={20} />
              <div>
                <strong>
                  {conflict ? "Eşitleme duraklatıldı" : "Bulut bağlantısı"}
                </strong>
                <p>{syncError}</p>
              </div>
              <button
                className="secondary-button"
                onClick={() => setModal("conflict")}
              >
                Çözüm seçenekleri
              </button>
            </div>
          )}
          {page === "overview" && (
            <>
              {heading(data.home.title, data.home.subtitle)}
              <div className="quick-links">
                <button onClick={() => navigate("energy")}>
                  <Zap size={24} />
                  <span>
                    <strong>Enerji merkezim</strong>
                    <small>Tüketim, sayaçlar ve maliyet</small>
                  </span>
                  <ArrowRight size={19} />
                </button>
                <button onClick={() => navigate("integrations")}>
                  <PlugZap size={24} />
                  <span>
                    <strong>Yeni cihaz bağla</strong>
                    <small>Markaları tek evde buluştur</small>
                  </span>
                  <ArrowRight size={19} />
                </button>
              </div>
              <SetupChecklist
                state={data}
                connected={live && ready}
                user={user}
                navigate={navigate}
                onConnect={() => setModal("connect")}
                onAccount={() =>
                  user ? navigate("settings") : setModal("auth")
                }
              />
              <section className="comfort-panel">
                <div className="comfort-main">
                  <div className="panel-kicker">
                    <span>
                      <Thermometer size={17} />
                      EVİN SICAKLIĞI
                    </span>
                    <span className="soft-badge">
                      {live ? "Canlı ölçüm" : "Örnek ölçüm"}
                    </span>
                  </div>
                  <div className="comfort-reading">
                    <strong>
                      {formatTemp(average)}
                      <sup>°C</sup>
                    </strong>
                    <div>
                      <h2>{mode?.name || "Kendi düzenini kur."}</h2>
                      <p>{measures.length} odanın ölçüm ortalaması</p>
                    </div>
                  </div>
                  {modeStrip}
                  <div className="heat-toggle">
                    <div>
                      <CalendarDays size={18} />
                      <strong>Demo zamanlayıcısı</strong>
                      <small>{data.heating ? "Etkin" : "Duraklatıldı"}</small>
                    </div>
                    <Toggle
                      label="Demo zamanlayıcısı"
                      checked={data.heating}
                      disabled={live}
                      onChange={(heating) =>
                        change(
                          (s) => ({ ...s, heating }),
                          "Demo zamanlayıcısı " +
                            (heating ? "açıldı." : "kapatıldı."),
                        )
                      }
                    />
                  </div>
                </div>
                <div className="comfort-chart">
                  <div className="chart-heading">
                    <div>
                      <h3>Her şey sana göre.</h3>
                      <p>Yeni ekle, düzenle, yeniden sırala.</p>
                    </div>
                    <SlidersHorizontal size={22} />
                  </div>
                  <div className="house-stats">
                    {[
                      ["rooms", "Oda", data.rooms.length],
                      [
                        "devices",
                        "Vana",
                        data.devices.filter((d) =>
                          isRoomThermostat(
                            d,
                            live ? entities[d.entityId] : null,
                          ),
                        ).length,
                      ],
                      [
                        "devices",
                        "Sensör",
                        data.devices.filter((d) => d.type === "sensor").length,
                      ],
                      ["lights", "Lamba", data.lights.length],
                    ].map(([k, label, count]) => (
                      <button
                        key={label}
                        onClick={() => {
                          setKind(k);
                          navigate("manage");
                        }}
                      >
                        <strong>{count}</strong>
                        <span>
                          {label}
                          <ArrowUpRight size={14} />
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="small-note">
                    Demo programları bu sekme açıkken, evin saat dilimine göre
                    çalışır. Kesintisiz gerçek programlar ev sunucusunda
                    çalışmalıdır.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => navigate("manage")}
                  >
                    Ev düzenini yönet <ArrowRight size={16} />
                  </button>
                </div>
              </section>
              <div className="section-heading">
                <div>
                  <h2>
                    Odalar <span>{data.rooms.length}</span>
                  </h2>
                  <p>Sıcaklık ve cihaz eşleştirmeleri senin kontrolünde.</p>
                </div>
                <button className="text-button" onClick={() => add("rooms")}>
                  <Plus size={16} />
                  Oda ekle
                </button>
              </div>
              {data.rooms.length ? (
                roomGrid
              ) : (
                <Empty
                  title="İlk odanı ekle"
                  action={
                    <button
                      className="primary-button"
                      onClick={() => add("rooms")}
                    >
                      Oda ekle
                    </button>
                  }
                >
                  Her oda kendi hedefi ve cihazlarıyla yönetilir.
                </Empty>
              )}
              <div className="section-heading">
                <div>
                  <h2>Bir dokunuşla atmosfer</h2>
                  <p>Birden fazla cihaz için kendi adımlarını oluştur.</p>
                </div>
                <button className="text-button" onClick={() => add("scenes")}>
                  <Plus size={16} />
                  Senaryo ekle
                </button>
              </div>
              {sceneCards}
            </>
          )}
          {page === "rooms" && (
            <>
              {heading(
                "Her odanın bir ritmi var.",
                "Oda ekle, hedefini ayarla ve sensörlerini eşleştir.",
                "rooms",
              )}
              {search}
              <button
                className="text-button favorite-filter"
                aria-pressed={favoriteRooms}
                onClick={() => setFavoriteRooms(!favoriteRooms)}
              >
                <Star size={17} />
                {favoriteRooms
                  ? "Bütün odaları göster"
                  : "Yalnız favori odalar"}
              </button>
              {modeStrip}
              {roomGrid}
              {!filtered(rooms).filter((r) => !favoriteRooms || r.favorite)
                .length && (
                <Empty
                  title="Oda bulunamadı"
                  action={
                    <button
                      className="primary-button"
                      onClick={() => add("rooms")}
                    >
                      Oda ekle
                    </button>
                  }
                >
                  Aramayı değiştir veya yeni bir oda oluştur.
                </Empty>
              )}
            </>
          )}
          {page === "lights" && (
            <>
              {heading(
                "Işık, ruh haline uysun.",
                "Her lamba için renk, parlaklık ve oda seçimi.",
                "lights",
              )}
              {search}
              <button
                className="text-button favorite-filter"
                aria-pressed={favoriteLights}
                onClick={() => setFavoriteLights(!favoriteLights)}
              >
                <Star size={17} />
                {favoriteLights
                  ? "Bütün lambaları göster"
                  : "Yalnız favori lambalar"}
              </button>
              <div className="light-grid">
                {filtered(lights)
                  .filter((l) => !favoriteLights || l.favorite)
                  .map((l) => (
                    <div className="editable-card" key={l.id}>
                      <LightCard
                        light={l}
                        disabled={
                          !cloudReady || !ready || commandBusy || !l.available
                        }
                        onChange={lightChange}
                      />
                      {actions(
                        "lights",
                        l,
                        data.lights.findIndex((x) => x.id === l.id),
                      )}
                    </div>
                  ))}
              </div>
              {!filtered(lights).filter((l) => !favoriteLights || l.favorite)
                .length && (
                <Empty
                  title={lights.length ? "Lamba bulunamadı" : "Henüz lamba yok"}
                  action={
                    <button
                      className="primary-button"
                      onClick={() => add("lights")}
                    >
                      Lamba ekle
                    </button>
                  }
                >
                  {lights.length
                    ? "Aramayı veya favori filtresini değiştir."
                    : "İstediğin sayıda lamba ekleyebilirsin."}
                </Empty>
              )}
            </>
          )}
          {page === "scenes" && (
            <>
              {heading(
                "Sen yaz, evin uygulasın.",
                "Cihaz, ışık, sıcaklık ve bildirim adımlarını birleştir.",
                "scenes",
              )}
              {search}
              {sceneCards}
              {!filtered(data.scenes).length && (
                <Empty
                  title="Senaryo bulunamadı"
                  action={
                    <button
                      className="primary-button"
                      onClick={() => add("scenes")}
                    >
                      Senaryo ekle
                    </button>
                  }
                >
                  Tek dokunuş için kendi adımlarını tanımla.
                </Empty>
              )}
            </>
          )}
          {page === "energy" && (
            <EnergyPage
              state={data}
              entities={entities}
              metadata={metadata}
              live={live}
              ready={ready}
              onSettings={() => setModal("energy-settings")}
              onConnect={() => setModal("connect")}
            />
          )}
          {page === "devices" && (
            <DevicePanel
              state={data}
              entities={entities}
              live={live}
              disabled={!cloudReady || !ready || commandBusy}
              temperatureUnit={metadata.config?.unit_system?.temperature}
              onCommand={deviceAction}
              registry={metadata.entities}
              onCompanion={companionAction}
              onFavorite={(d) =>
                change(
                  (s) =>
                    saveRecord(s, "devices", { ...d, favorite: !d.favorite }),
                  "Favori tercihi kaydedildi.",
                )
              }
              onRoom={(id) => {
                setDuration(60);
                setModal({ room: id });
              }}
              onAdd={() => add("devices")}
              onDiscover={() => navigate("integrations")}
              actions={actions}
            />
          )}
          {page === "integrations" && (
            <IntegrationsPage
              state={data}
              entities={entities}
              metadata={metadata}
              connected={live && ready}
              busy={metadataBusy}
              hassUrl={hassUrl}
              onConnect={() => setModal("connect")}
              onRefresh={refreshMetadata}
              onImport={(list, options) => {
                commit(
                  (s) => importEntities(s, list, options),
                  "Home Assistant cihazları içe aktarıldı.",
                );
                notify(list.length + " cihaz eklendi.");
              }}
              onAdd={() => add("devices")}
              onEnergy={() => navigate("energy")}
            />
          )}
          {page === "health" && (
            <HealthPage
              state={data}
              entities={entities}
              connected={live && ready}
              user={user}
              online={online}
              syncError={syncError}
              onEdit={edit}
              navigate={navigate}
            />
          )}
          {page === "help" && (
            <HelpPage
              navigate={navigate}
              onConnect={() => setModal("connect")}
              onInstall={install}
              installable={installable}
            />
          )}
          {page === "programs" && (
            <>
              {heading(
                "Konforun bir düzeni olsun.",
                "Saat, güneş, cihaz durumu veya ölçüm eşiğiyle kendi düzenini kur.",
                "programs",
              )}
              <div className="schedule-notice">
                <CalendarDays size={22} />
                <div>
                  <strong>
                    {live
                      ? "Programlarını ev sunucuna aktar; tarayıcı kapalıyken de çalışsın."
                      : "Demo programları yalnızca sekme açıkken çalışır."}
                  </strong>
                  <p>
                    Kaydetmek ev düzenini günceller. “Sunucuya aktar” Home
                    Assistant’ı günceller. Sonraki değişiklikleri tekrar aktar.
                    Önceden kurulmuş diğer otomasyonlar bağımsızdır.
                  </p>
                </div>
              </div>
              {search}
              <div className="program-list">
                {filtered(data.programs).map((p) => (
                  <article className="program-card" key={p.id}>
                    <div className="program-time">
                      {triggerLabel(p)}
                      <small>{data.home.timeZone}</small>
                    </div>
                    <div className="program-info">
                      <h3>{p.name}</h3>
                      <p
                        className={
                          "publish-badge " + (p.needsPublish ? "pending" : "")
                        }
                      >
                        {p.deployment
                          ? p.needsPublish
                            ? "Değişiklikler aktarılmayı bekliyor"
                            : "Son aktarım: " +
                              new Date(p.deployment.syncedAt).toLocaleString(
                                "tr-TR",
                              )
                          : "Henüz sunucuya aktarılmadı"}
                      </p>
                      <p>
                        {p.action === "mode" ? "Ev modu" : "Senaryo"}:{" "}
                        {(p.action === "mode" ? data.modes : data.scenes).find(
                          (x) => x.id === p.targetId,
                        )?.name || "Hedef seçilmedi"}
                      </p>
                      <div className="program-days">
                        {DAYS.map((d, i) => (
                          <span
                            key={d}
                            className={p.days.includes(i) ? "selected" : ""}
                          >
                            {
                              ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][
                                i
                              ]
                            }
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="program-buttons">
                      <button
                        className="secondary-button"
                        onClick={() => setModal({ publish: p })}
                      >
                        <Upload size={15} />
                        Sunucuya aktar
                      </button>
                      <Toggle
                        label={p.name + " etkin"}
                        checked={p.enabled}
                        onChange={(enabled) =>
                          change(
                            (s) => saveRecord(s, "programs", { ...p, enabled }),
                            "Program güncellendi.",
                          )
                        }
                      />
                      <button
                        className="text-button"
                        disabled={
                          !p.targetId || commandBusy || !ready || !cloudReady
                        }
                        onClick={() =>
                          live ? setModal({ runProgram: p }) : runProgram(p)
                        }
                      >
                        <Play size={16} />
                        Eylemleri dene
                      </button>
                    </div>
                    {actions(
                      "programs",
                      p,
                      data.programs.findIndex((x) => x.id === p.id),
                    )}
                  </article>
                ))}
              </div>
              {!filtered(data.programs).length && (
                <Empty
                  title="Henüz program yok"
                  action={
                    <button
                      className="primary-button"
                      onClick={() => add("programs")}
                    >
                      Program ekle
                    </button>
                  }
                >
                  İstediğin gün ve saat için yeni bir kural ekle.
                </Empty>
              )}
            </>
          )}
          {page === "manage" && (
            <>
              {heading(
                "Ev düzeninin tamamı burada.",
                "Kayıtları ekle, değiştir, kopyala, sırala veya geri alınabilir biçimde sil.",
                kind === "trash" ? null : kind,
              )}
              {["rooms", "lights", "scenes", "programs"].includes(kind) && (
                <button
                  className="text-button manager-open"
                  onClick={() => navigate(kind)}
                >
                  Kontrol ekranını aç <ArrowUpRight size={16} />
                </button>
              )}
              <div
                className="management-tabs"
                role="tablist"
                aria-label="Kayıt türleri"
              >
                {[...COLLECTIONS, "trash"].map((k) => (
                  <button
                    role="tab"
                    aria-selected={kind === k}
                    className={kind === k ? "active" : ""}
                    key={k}
                    onClick={() => {
                      setKind(k);
                      setQuery("");
                    }}
                  >
                    {k === "trash" ? "Silinenler" : NAMES[k]}
                    <span>{data[k].length}</span>
                  </button>
                ))}
              </div>
              {search}
              {kind === "trash" ? (
                <>
                  <p className="small-note">
                    Geri yüklemek kaydı getirir. Silme sırasında kaldırılan
                    eşleştirmeleri ve senaryo adımlarını yeniden seçebilirsin.
                  </p>
                  <div className="record-list">
                    {filtered(
                      data.trash.map((x) => ({ ...x, name: x.record.name })),
                    ).map((x) => (
                      <article className="record-row" key={x.id}>
                        <Trash2 size={20} />
                        <div className="record-info">
                          <h3>{x.name}</h3>
                          <p>
                            {LABELS[x.kind]} ·{" "}
                            {new Date(x.deletedAt).toLocaleString("tr-TR", {
                              timeZone: data.home.timeZone || "Europe/Istanbul",
                            })}
                          </p>
                        </div>
                        <button
                          className="secondary-button"
                          onClick={() =>
                            change(
                              (s) => restoreRecord(s, x.id),
                              "Kayıt geri yüklendi.",
                            )
                          }
                        >
                          <RotateCcw size={16} />
                          Geri yükle
                        </button>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="record-list">
                  {filtered(data[kind]).map((r) => {
                    const Icon = ICONS[kind];
                    return (
                      <article className="record-row" key={r.id}>
                        <span className="record-icon">
                          <Icon size={22} />
                        </span>
                        <div className="record-info">
                          <h3>{r.name}</h3>
                          <p>{detail(kind, r)}</p>
                          {r.entityId && <code>{r.entityId}</code>}
                          {(kind === "lights" || kind === "devices") && (
                            <span
                              className={
                                "record-status " + (r.enabled ? "" : "muted")
                              }
                            >
                              {r.enabled ? "Etkin" : "Devre dışı"} ·{" "}
                              {r.entityId
                                ? "Eşleştirme tanımlı"
                                : "Eşleştirme bekliyor"}
                            </span>
                          )}
                        </div>
                        {actions(
                          kind,
                          r,
                          data[kind].findIndex((x) => x.id === r.id),
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
              {!(kind === "trash"
                ? filtered(data.trash.map((x) => ({ ...x, name: x.record.name })))
                : filtered(data[kind])
              ).length && (
                <Empty
                  title={
                    kind === "trash"
                      ? data.trash.length
                        ? "Eşleşen silinen kayıt yok"
                        : "Silinen kayıt yok"
                      : "Kayıt bulunamadı"
                  }
                  action={
                    kind !== "trash" && (
                      <button
                        className="primary-button"
                        onClick={() => add(kind)}
                      >
                        <Plus size={16} />
                        {LABELS[kind]} ekle
                      </button>
                    )
                  }
                >
                  Kayıtların burada listelenir.
                </Empty>
              )}
            </>
          )}
          {page === "settings" && (
            <>
              {heading(
                "Her şey sana göre.",
                "Hesabın, evin, bağlantın ve yedeklerin.",
              )}
              <div className="settings-grid">
                {user && (
                  <AccountSecurity
                    user={user}
                    onUpdated={(r) => {
                      userRef.current = r.user;
                      setUser(r.user);
                      if (r.recoveryCode)
                        setRecovery({
                          code: r.recoveryCode,
                          username: user.username,
                        });
                      notify("Hesap güvenliği güncellendi.");
                    }}
                  />
                )}
                <section className="settings-card">
                  <div className="card-title">
                    <Cloud size={23} />
                    <h2>Hesap ve eşitleme</h2>
                  </div>
                  {user ? (
                    <>
                      <p>
                        <strong>@{user.username}</strong> ile giriş yapıldı.
                      </p>
                      <div className="sync-status">
                        {syncBusy
                          ? "Değişiklikler kaydediliyor…"
                          : dirty
                            ? "Yerel değişiklikler eşitleme bekliyor."
                            : "Ev düzenin bulutta kayıtlı."}
                      </div>
                      <p className="small-note">
                        Diğer cihazlar yeni düzeni yaklaşık 30 saniyede veya
                        yenilediğinde alır.
                      </p>
                      <div className="button-row">
                        <button
                          className="secondary-button"
                          onClick={() => refreshCloud()}
                          disabled={dirty || syncBusy}
                        >
                          <RefreshCw size={16} />
                          Şimdi yenile
                        </button>
                        <button
                          className="secondary-button"
                          disabled={dirty || syncBusy}
                          onClick={logout}
                        >
                          <LogOut size={16} />
                          Çıkış yap
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>Telefon ve bilgisayarda aynı ev düzenini kullan.</p>
                      <button
                        className="primary-button"
                        onClick={() => setModal("auth")}
                      >
                        <UserRound size={17} />
                        Giriş yap / Hesap oluştur
                      </button>
                    </>
                  )}
                  {!user && (
                    <p className="small-note">
                      Misafir değişiklikleri yalnızca bu tarayıcıda saklanır.
                    </p>
                  )}
                </section>
                <section className="settings-card">
                  <div className="card-title">
                    <Wifi size={23} />
                    <h2>Home Assistant</h2>
                  </div>
                  <p>
                    {live
                      ? ready
                        ? "Canlı cihaz bağlantısı açık."
                        : "Cihaz bağlantısı kesildi."
                      : "Gerçek vanalar ve lambalar henüz bağlı değil."}
                  </p>
                  <p className="small-note">
                    Hesap eşitlemesi ve fiziksel ev bağlantısı ayrı çalışır.
                    Entegrasyonlar bölümünden cihazları keşfedip topluca içe
                    aktarabilirsin.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => setModal("connect")}
                  >
                    <PlugZap size={17} />
                    Bağlantıyı yönet
                  </button>
                  <button
                    className="text-button"
                    onClick={() => navigate("integrations")}
                  >
                    Cihaz keşfini aç
                    <ArrowRight size={16} />
                  </button>
                </section>
                <section className="settings-card">
                  <div className="card-title">
                    <Home size={23} />
                    <h2>Ev ve görünüm</h2>
                  </div>
                  <HomeForm
                    value={data.home}
                    onSave={(home) => {
                      commit(
                        (s) => ({
                          ...s,
                          home,
                          programs: s.programs.map((p) =>
                            p.deployment && s.home.timeZone !== home.timeZone
                              ? { ...p, needsPublish: true }
                              : p,
                          ),
                        }),
                        "Ev ayarları güncellendi.",
                      );
                      notify("Ev ayarları kaydedildi.");
                    }}
                  />
                  <SchemePicker />
                </section>
                <section className="settings-card">
                  <div className="card-title">
                    <Download size={23} />
                    <h2>Yedekler ve taşıma</h2>
                  </div>
                  <p>
                    Odalar, cihazlar, modlar, senaryolar, programlar ve silinen
                    kayıtlar tek dosyada.
                  </p>
                  <div className="button-row">
                    <button
                      className="secondary-button"
                      onClick={() =>
                        download(
                          "evim-yedek.json",
                          JSON.stringify(data, null, 2),
                        )
                      }
                    >
                      <Download size={16} />
                      Dışa aktar
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => importRef.current.click()}
                    >
                      <Upload size={16} />
                      İçe aktar
                    </button>
                  </div>
                  <input
                    ref={importRef}
                    className="visually-hidden"
                    type="file"
                    accept="application/json,.json"
                    aria-label="Yedek dosyası seç"
                    onChange={importFile}
                  />
                  <p className="small-note">
                    Parola, kurtarma anahtarı ve Home Assistant erişim
                    belirteçleri yedeğe dahil edilmez. Alan adı değişince aynı
                    hesapla giriş yapabilirsin.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setModal("reset")}
                  >
                    <RotateCcw size={16} />
                    Örnek düzene dön
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setModal("emptyhome")}
                  >
                    Boş ev düzeniyle başla
                  </button>
                </section>
              </div>
              <InstallCard onInstall={install} installable={installable} />
            </>
          )}
          <footer className="main-footer">
            <Home size={14} />
            <span>evim · {data.home.name}</span>
            <span>
              {user
                ? "Hesabına özel · Bulut eşitleme"
                : "Misafir · Bu tarayıcıda kayıtlı"}
              {live ? " · Canlı cihazlar" : " · Demo cihazlar"}
            </span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobil menü">
        {[
          ["overview", "Genel", Home],
          ["rooms", "Odalar", DoorOpen],
          ["lights", "Işıklar", Lightbulb],
          ["energy", "Enerji", Zap],
          ["more", "Diğer", MoreHorizontal],
        ].map(([id, name, Icon]) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            onClick={() => navigate(id)}
          >
            <Icon size={20} />
            <span>{name}</span>
          </button>
        ))}
      </nav>
      {toast && (
        <div className={"toast " + (toast.error ? "error" : "")} role="status">
          {toast.error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{toast.text}</span>
          <button aria-label="Bildirimi kapat" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      {editor && (
        <Editor
          key={editor.kind + editor.record.id}
          {...editor}
          state={data}
          entities={entities}
          services={metadata.services}
          onClose={() => setEditor(null)}
          onSave={(r) => {
            commit(
              (s) => saveRecord(s, editor.kind, r),
              r.name + " kaydedildi.",
            );
            setEditor(null);
            notify(r.name + " kaydedildi.");
          }}
        />
      )}
      {modal === "auth" && (
        <Auth onClose={() => setModal(null)} onAuth={enterCloud} />
      )}{" "}
      {modal === "more" && (
        <Modal title="Evinin bütün kontrolleri" onClose={() => setModal(null)}>
          <div className="more-menu">
            {NAV.map(([id, name, Icon]) => (
              <button
                key={id}
                onClick={() => {
                  setModal(null);
                  navigate(id);
                }}
              >
                <Icon size={22} />
                {name}
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {modal === "energy-settings" && (
        <EnergySettings
          value={data.energy}
          entities={entities}
          onClose={() => setModal(null)}
          onSave={(energy) => {
            if (live && ready) {
              for (const id of energy.submeters)
                if (
                  energyUnit(entities[id]?.attributes.unit_of_measurement) ==
                  null
                )
                  throw new Error(
                    "Alt sayaçlar için enerji birimli sensörler seçin.",
                  );
              if (
                energy.power &&
                !["W", "kW", "MW"].includes(
                  entities[energy.power]?.attributes.unit_of_measurement,
                )
              )
                throw new Error(
                  "Anlık güç için W / kW / MW birimli sensör seçin.",
                );
            }
            if (
              live &&
              ready &&
              energy.meter &&
              energyUnit(
                entities[energy.meter]?.attributes.unit_of_measurement,
              ) == null
            )
              throw new Error(
                "Ana sayaç için enerji birimli bir sensör seçin.",
              );
            commit(
              (s) => ({ ...s, energy }),
              "Enerji kaynakları ve tarife güncellendi.",
            );
            setModal(null);
            notify("Enerji ayarları kaydedildi.");
          }}
        />
      )}
      {modal?.publish && (
        <ProgramPublish
          program={
            data.programs.find((p) => p.id === modal.publish.id) ||
            modal.publish
          }
          state={data}
          entities={entities}
          metadata={metadata}
          connected={live && ready}
          hassUrl={hassUrl}
          onClose={() => setModal(null)}
          onSaved={(program) => {
            commit((s) => {
              if (s !== data)
                throw new Error(
                  "Yerel ayarlar değişti. Sunucudaki kayıt tamamlandı; önizlemeyi yenileyerek eşleşmeyi kontrol edin.",
                );
              return {
                ...s,
                programs: s.programs.map((p) =>
                  p.id === program.id ? { ...p, ...program } : p,
                ),
              };
            }, "Program ev sunucusuna aktarıldı.");
            notify("Sunucu kaydı doğrulandı.");
          }}
        />
      )}
      {modal?.deviceAction && (
        <Modal
          title={modal.deviceAction.device.name}
          onClose={() => setModal(null)}
        >
          <p className="modal-copy">
            Bu işlem gerçek cihazda çalışacak. Devam etmek için işlemi onayla.
          </p>
          <div className="button-row">
            <button className="secondary-button" onClick={() => setModal(null)}>
              Vazgeç
            </button>
            <button
              className="primary-button"
              disabled={commandBusy || !ready}
              onClick={async () => {
                const d = modal.deviceAction;
                if (await runDevice(d.device, d.action)) setModal(null);
              }}
            >
              Cihazda çalıştır
            </button>
          </div>
        </Modal>
      )}
      {modal?.runProgram && (
        <Modal title="Program eylemlerini dene" onClose={() => setModal(null)}>
          <p className="modal-copy">
            {modal.runProgram.name} programının eylemleri şimdi gerçek
            cihazlarda çalıştırılacak. Saat, tetikleyici ve ek koşullar bu
            denemede beklenmez.
          </p>
          <div className="button-row">
            <button className="secondary-button" onClick={() => setModal(null)}>
              Vazgeç
            </button>
            <button
              className="primary-button"
              disabled={commandBusy || !ready}
              onClick={() => {
                runProgram(modal.runProgram);
                setModal(null);
              }}
            >
              Şimdi çalıştır
            </button>
          </div>
        </Modal>
      )}
      {recovery && <Recovery {...recovery} onClose={() => setRecovery(null)} />}
      {modal === "connect" && (
        <Modal title="Evine bağlan" onClose={() => setModal(null)}>
          <p className="modal-copy">
            Home Assistant HTTPS adresini gir. Kendi sunucunda giriş yaptıktan
            sonra Yönetim bölümündeki varlık eşleştirmeleri kullanılacak.
          </p>
          <Input
            label="Home Assistant HTTPS adresi"
            type="url"
            value={hassUrl}
            onChange={setHassUrl}
            placeholder="https://ev.example.com"
          />
          <p className="small-note">
            Yerel HTTP adresi Vercel’in HTTPS sayfasından kullanılamaz. Gerçek
            cihazlar için erişilebilir bir HTTPS sunucusu gerekir.
          </p>
          {haError && (
            <p role="alert" className="form-error">
              {haError}
            </p>
          )}
          <div className="button-row">
            <button
              className="primary-button"
              onClick={connect}
              disabled={haStatus === "connecting"}
            >
              {haStatus === "connecting"
                ? "Bağlanıyor…"
                : "Home Assistant’a bağlan"}
            </button>
            {live && (
              <button className="secondary-button" onClick={disconnect}>
                Bağlantıyı kes
              </button>
            )}
          </div>
        </Modal>
      )}
      {modal?.delete && (
        <Modal
          title={modal.record.name + " silinsin mi?"}
          onClose={() => setModal(null)}
        >
          <p className="modal-copy">
            Kayıt Silinenler bölümüne taşınır ve geri alınabilir. İlgili senaryo
            adımları kaldırılır, hedefsiz programlar duraklatılır. Oda
            silindiğinde cihazlar ve lambalar “Atanmamış” olarak korunur.
            Fiziksel cihaz Home Assistant’tan silinmez.
          </p>
          {data.programs.some((p) => p.deployment) && (
            <p className="form-error">
              Home Assistant’a aktarılmış programlar bu silme işlemiyle durmaz.
              İlgili programı önce Programlar → Sunucuya aktar → Sunucuda
              duraklat yoluyla durdur; kalan programlardaki değişiklikleri
              yeniden aktar.
            </p>
          )}
          <div className="button-row">
            <button className="secondary-button" onClick={() => setModal(null)}>
              Vazgeç
            </button>
            <button
              className="danger-button"
              onClick={() => {
                change(
                  (s) => deleteRecord(s, modal.kind, modal.record.id),
                  modal.record.name + " silinenlere taşındı.",
                );
                setModal(null);
              }}
            >
              <Trash2 size={16} />
              Silinenlere taşı
            </button>
          </div>
        </Modal>
      )}
      {selectedRoom && (
        <Modal title={selectedRoom.name} onClose={() => setModal(null)}>
          <div className="room-target-detail">
            <span>{live ? "Oda şu an" : "Örnek oda ölçümü"}</span>
            <strong>{formatTemp(selectedRoom.current)}°C</strong>
          </div>
          <TemperatureControl
            key={selectedRoom.id}
            name={selectedRoom.name}
            value={selectedRoom.target}
            min={selectedRoom.min}
            max={selectedRoom.max}
            disabled={
              !cloudReady || !ready || commandBusy || !selectedRoom.available
            }
            live={live}
            onApply={(value) => roomTarget(selectedRoom.id, value, duration)}
          >
            {!live && (
              <Select
                label="Geçici hedef süresi"
                value={duration}
                onChange={(v) => setDuration(Number(v))}
                options={[
                  [30, "30 dakika"],
                  [60, "1 saat"],
                  [120, "2 saat"],
                ]}
              />
            )}
          </TemperatureControl>
          {selectedRoom.notes && (
            <p className="modal-copy">{selectedRoom.notes}</p>
          )}
          <p className="small-note">
            {live
              ? "Komut yalnızca bu odaya atanmış etkin vanalara gönderilir."
              : "Süre bitince etkin modun hedefine dönülür; demo sekmesi açık olmalıdır."}
          </p>
          <button
            className="primary-button room-thermostat-edit"
            onClick={() =>
              edit(
                "rooms",
                data.rooms.find((r) => r.id === selectedRoom.id),
              )
            }
          >
            <Pencil size={17} />
            Odayı düzenle
          </button>
        </Modal>
      )}
      {modal === "activity" && (
        <Modal title="Etkinlik geçmişi" onClose={() => setModal(null)}>
          {data.events.length ? (
            <div className="activity-list">
              {data.events.map((e, i) => (
                <div key={i}>
                  <CheckCircle2 size={17} />
                  <p>
                    {e.text}
                    <small>
                      {new Date(e.time).toLocaleString("tr-TR", {
                        timeZone: data.home.timeZone || "Europe/Istanbul",
                      })}
                    </small>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="modal-copy">Henüz işlem yok.</p>
          )}
        </Modal>
      )}
      {modal === "conflict" && (
        <Modal title="Eşitlemeyi tamamla" onClose={() => setModal(null)}>
          <p className="modal-copy">
            Yerel değişiklikler korunuyor. Yeniden deneme, aynı sürüm kontrolünü
            kullanır. Buluttaki sürümü yüklemek önce bu cihazın taslağını yedek
            olarak indirir.
          </p>
          {syncError && <p className="form-error">{syncError}</p>}
          <div className="button-row">
            <button
              className="secondary-button"
              onClick={() => setModal("auth")}
            >
              Yeniden giriş yap
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                setConflict(false);
                setSyncError("");
                setModal(null);
              }}
            >
              Yeniden dene
            </button>
            <button
              className="primary-button"
              onClick={() => refreshCloud(true)}
            >
              Buluttaki sürümü yükle
            </button>
          </div>
          <button
            className="text-button"
            onClick={() =>
              download("evim-yerel-taslak.json", JSON.stringify(data, null, 2))
            }
          >
            Yerel taslağı dışa aktar
          </button>
        </Modal>
      )}
      {((modal === "import" && pendingImport) ||
        modal === "reset" ||
        modal === "emptyhome") && (
        <Modal
          title={
            modal === "import"
              ? "Yedeği yükle"
              : modal === "emptyhome"
                ? "Boş ev düzeniyle başla"
                : "Örnek düzene dön"
          }
          onClose={() => {
            setModal(null);
            setPendingImport(null);
          }}
        >
          <p className="modal-copy">
            Mevcut düzen önce yedek olarak indirilecek.{" "}
            {user ? "Yeni düzen hesabına da eşitlenecek." : ""}{" "}
            {modal === "import"
              ? `${pendingImport.rooms.length} oda, ${pendingImport.devices.length} cihaz, ${pendingImport.lights.length} lamba yüklenecek.`
              : modal === "emptyhome"
                ? "Oda, cihaz ve senaryo listeleri temiz bir başlangıç için boşaltılacak."
                : "Başlangıçtaki örnek odalar ve senaryolar yüklenecek."}{" "}
            Fiziksel cihazlara komut gönderilmez.
          </p>
          {data.programs.some((p) => p.deployment) && (
            <p className="form-error">
              Aktarılmış Home Assistant programları çalışmaya devam eder. Düzeni
              değiştirmeden önce ilgili programları sunucuda duraklat.
            </p>
          )}
          <div className="button-row">
            <button className="secondary-button" onClick={() => setModal(null)}>
              Vazgeç
            </button>
            <button
              className="primary-button"
              onClick={() => {
                download(
                  "evim-onceki-duzen.json",
                  JSON.stringify(data, null, 2),
                );
                change(
                  modal === "import"
                    ? pendingImport
                    : modal === "emptyhome"
                      ? {
                          ...initialState(),
                          id: data.id,
                          home: data.home,
                          ...Object.fromEntries(
                            COLLECTIONS.map((k) => [k, []]),
                          ),
                          activeModeId: "",
                          heating: false,
                        }
                      : initialState(),
                  "Ev düzeni yüklendi.",
                );
                setPendingImport(null);
                setModal(null);
              }}
            >
              Yedekle ve uygula
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
