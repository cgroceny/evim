import React, { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { api } from "./cloud.js";

const REFRESH_INTERVAL = 30000;
const labels = { sensor: "Sensör", binary_sensor: "Sensör", switch: "Priz / anahtar" };
const stateLabels = { on: "Açık", off: "Kapalı", unavailable: "Erişilemiyor", unknown: "Bilinmiyor" };
const localTime = new Intl.DateTimeFormat("tr-TR", { timeStyle: "short" });

function readingValue(reading) {
  const label = Object.hasOwn(stateLabels, reading.value) && stateLabels[reading.value];
  return label || [reading.value, reading.unit].filter(Boolean).join(" ");
}

export default function HomeAssistantReadings({ online, signedIn, onSignIn }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!online || !signedIn) return;
    let active = true;
    let pending = false;
    let timer;

    async function load() {
      if (document.hidden || pending) return;
      clearTimeout(timer);
      pending = true;
      setBusy(true);
      let poll = true;
      try {
        const next = await api("ha-states");
        if (active) setResult(next);
        poll = next.status === "connected";
      } catch (error) {
        if (active) setResult({ status: "error", message: error.message });
        poll = error.status !== 401 && error.status !== 403;
      } finally {
        pending = false;
        if (active) {
          setBusy(false);
          if (poll && !document.hidden) timer = setTimeout(load, REFRESH_INTERVAL);
        }
      }
    }

    function visibilityChanged() {
      if (document.hidden) clearTimeout(timer);
      else load();
    }

    load();
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [online, signedIn, refresh]);

  const connected = signedIn && online && result?.status === "connected";
  let message;
  if (!signedIn) message = "Ev sunucusundaki ölçümleri görmek için giriş yap.";
  else if (!online) message = "İnternet bağlantısı kesildi.";
  else if (result?.status === "unconfigured")
    message = "Ev sunucusu bağlantısı henüz kurulmadı.";
  else if (result?.status === "error") message = result.message;
  else if (!result) message = "Ev sunucusuna bağlanılıyor…";
  else if (!result.readings.length)
    message = "Bağlantı hazır. Home Assistant’ta okunabilecek bir sensör veya priz bulunamadı.";

  return (
    <section className="settings-card ha-readings" aria-label="Canlı sensör ve priz verileri">
      <div className="card-title">
        <Activity size={22} aria-hidden="true" />
        <h2>Canlı sensör ve priz verileri</h2>
      </div>
      <p>Home Assistant’tan gelen ölçümler ve cihaz durumları.</p>
      {message && <p className="small-note" role="status">{message}</p>}
      {connected && result.readings.length > 0 && (
        <ul className="ha-reading-list">
          {result.readings.map((reading) => (
            <li key={reading.id} className="ha-reading">
              <div>
                <strong>{reading.name}</strong>
                <small>{labels[reading.domain]}</small>
              </div>
              <span>{readingValue(reading)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="ha-reading-actions">
        {signedIn ? (
          <button className="secondary-button" disabled={!online || busy}
            onClick={() => setRefresh((count) => count + 1)}>
            <RefreshCw size={16} aria-hidden="true" />
            {online && busy ? "Okunuyor…" : "Yenile"}
          </button>
        ) : (
          <button className="secondary-button" onClick={onSignIn}>Giriş yap</button>
        )}
        {connected && (
          <small>
            Son okuma <time dateTime={result.readAt}>{localTime.format(new Date(result.readAt))}</time>
          </small>
        )}
      </div>
    </section>
  );
}
