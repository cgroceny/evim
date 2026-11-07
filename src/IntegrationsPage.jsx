import React, { useMemo, useState } from "react";
import {
  PlugZap,
  Radio,
  Wifi,
  CheckCircle2,
  ArrowRight,
  Search,
  RefreshCw,
  ExternalLink,
  Plus,
  Cloud,
  Zap,
  CalendarDays,
} from "lucide-react";
import { entityCandidates, DEVICE_TYPES } from "./devices.js";
import { safeHassUrl } from "./core.js";
const CATALOG = [
  [
    "gree",
    "Gree klima",
    "Gree+ uyumlu klimalar · yerel Wi-Fi",
    "Klimayı önce Gree+ uygulamasıyla ev Wi-Fi’ına bağla; Home Assistant’ta Gree Climate entegrasyonunu ekle (aynı ağda kendini bulur). Burada içe aktarıp odaya ata. Mod, fan (6 kademe), dikey/yatay kanat, Ekonomi/Turbo/Uyku/8°C ve panel ışığı, sessiz, X-Fan, taze hava anahtarları cihaz kartında görünür. Sağlık modu anahtarını Home Assistant’ta etkinleştirmen gerekir. Enerji takibi ayrıca ölçümlü priz veya sayaç ister.",
    "https://www.home-assistant.io/integrations/gree/",
  ],
  [
    "zha",
    "Zigbee",
    "SONOFF, Aqara ve diğer Zigbee cihazları",
    "Zigbee koordinatörünü ev sunucuna bağla; ZHA üzerinden cihazı eşleştir.",
    "https://www.home-assistant.io/integrations/zha/",
  ],
  [
    "sonoff_trvzb",
    "SONOFF TRVZB vana",
    "Zigbee termostatik radyatör vanası",
    "Zigbee USB alıcı (ör. SONOFF ZBDongle-E) gerekir. Tüm ayarları (çocuk kilidi, açık pencere, vana açılma oranı, harici sensör) için Zigbee2MQTT önerilir. M30×1,5 vanaya doğrudan takılır; Danfoss RA için kutudaki adaptör kullanılır. 3 adet AA pil.",
    "https://www.zigbee2mqtt.io/devices/TRVZB.html",
  ],
  [
    "mqtt",
    "MQTT / Zigbee2MQTT",
    "Yerel ve esnek bağlantılar",
    "Zigbee2MQTT veya MQTT cihazını Home Assistant MQTT entegrasyonuna tanıt.",
    "https://www.home-assistant.io/integrations/mqtt/",
  ],
  [
    "shelly",
    "Shelly",
    "Ölçümlü priz, röle ve sayaçlar",
    "Desteklenen cihazların anahtar, güç ve enerji sensörlerini birlikte keşfet.",
    "https://www.home-assistant.io/integrations/shelly/",
  ],
  [
    "tplink",
    "TP-Link / Tapo / Kasa",
    "Aydınlatma ve akıllı prizler",
    "Tam modelin desteğini resmi listeden kontrol et; enerji ölçümü donanıma bağlıdır.",
    "https://www.home-assistant.io/integrations/tplink/",
  ],
  [
    "matter",
    "Matter",
    "Uyumlu cihazlar, ortak protokol",
    "Matter destekleyen cihazı Home Assistant’a ekle. Thread cihazlarında uygun sınır yönlendiricisi gerekir.",
    "https://www.home-assistant.io/integrations/matter/",
  ],
  [
    "tuya",
    "Tuya / Smart Life",
    "Farklı üreticilerin cihazları",
    "Home Assistant’ın resmi Tuya bağlantısıyla hesabındaki desteklenen cihazları getir.",
    "https://www.home-assistant.io/integrations/tuya/",
  ],
  [
    "xiaomi_miio",
    "Xiaomi",
    "Modele göre farklı bağlantılar",
    "Wi-Fi veya Xiaomi markası tek başına uyumluluk garantisi değildir. Tam modelin entegrasyonunu seç.",
    "https://www.home-assistant.io/integrations/xiaomi_miio/",
  ],
  [
    "esphome",
    "ESPHome",
    "Kendi sensörünü ve cihazını kur",
    "ESPHome ile hazırlanan uyumlu donanımı Home Assistant’a ekle.",
    "https://www.home-assistant.io/integrations/esphome/",
  ],
];
export function hassLink(url, path) {
  try {
    return safeHassUrl(url, true) + path;
  } catch {
    return null;
  }
}
export function SetupChecklist({
  state,
  connected,
  user,
  navigate,
  onConnect,
  onAccount,
}) {
  const mapped = [...state.devices, ...state.lights].filter(
    (d) => d.entityId,
  ).length;
  const items = [
    {
      title: "Hesabını eşitle",
      text: "Telefon ve bilgisayarda aynı ev.",
      done: !!user,
      icon: Cloud,
      action: onAccount,
    },
    {
      title: "Ev sunucuna bağlan",
      text: "Home Assistant güvenli bağlantısı.",
      done: connected,
      icon: Wifi,
      action: onConnect,
    },
    {
      title: "Cihazlarını keşfet",
      text: "Markaları tek düzende buluştur.",
      done: mapped > 0,
      icon: Radio,
      action: () => navigate("integrations"),
    },
    {
      title: "Enerjini izle",
      text: "Ana sayaç, alt sayaç ve tarife.",
      done: !!state.energy.meter,
      icon: Zap,
      action: () => navigate("energy"),
    },
  ];
  return (
    <section className="setup-checklist">
      <div className="panel-heading">
        <div>
          <h2>Evini adım adım tamamla</h2>
          <p>
            {items.filter((i) => i.done).length} / {items.length} adım hazır
          </p>
        </div>
        <PlugZap size={24} />
      </div>
      <div className="setup-grid">
        {items.map((i, index) => (
          <button key={i.title} onClick={i.action}>
            <span className={"setup-step " + (i.done ? "done" : "")}>
              {i.done ? <CheckCircle2 size={22} /> : index + 1}
            </span>
            <strong>{i.title}</strong>
            <small>{i.text}</small>
            <ArrowRight size={17} />
          </button>
        ))}
      </div>
    </section>
  );
}
export default function IntegrationsPage({
  state,
  entities,
  metadata,
  connected,
  busy,
  hassUrl,
  onConnect,
  onRefresh,
  onImport,
  onAdd,
  onEnergy,
}) {
  const [query, setQuery] = useState(""),
    [domain, setDomain] = useState(""),
    [selected, setSelected] = useState([]),
    [roomId, setRoomId] = useState(""),
    [useAreas, setUseAreas] = useState(true),
    [error, setError] = useState("");
  const all = useMemo(
    () => entityCandidates(entities, state, metadata),
    [entities, state, metadata],
  );
  const list = all.filter(
    (e) =>
      (!domain || e.domain === domain) &&
      (e.name + " " + e.id + " " + e.area + " " + e.manufacturer)
        .toLocaleLowerCase("tr")
        .includes(query.toLocaleLowerCase("tr")),
  );
  const chosen = all.filter(
    (c) => selected.includes(c.id) && !c.bound && !c.disabled,
  );
  const link = hassLink(hassUrl, "/config/integrations");
  return (
    <>
      <header className="feature-heading">
        <div>
          <p className="eyebrow">MARKADAN BAĞIMSIZ BİR EV</p>
          <h1>Her bağlantı burada başlar.</h1>
          <p>Cihaz Home Assistant’a, Home Assistant evim’e bağlanır.</p>
        </div>
        <button className="primary-button" onClick={onConnect}>
          <Wifi size={18} />
          {connected ? "Bağlantıyı yönet" : "Ev sunucuna bağlan"}
        </button>
      </header>
      <section className="integration-flow">
        <span>
          <Radio size={25} />
          Zigbee · Wi-Fi · Matter
        </span>
        <ArrowRight size={20} />
        <span>
          <PlugZap size={25} />
          Home Assistant
        </span>
        <ArrowRight size={20} />
        <span>
          <CheckCircle2 size={25} />
          evim
        </span>
      </section>
      <div className="feature-banner">
        <PlugZap size={22} />
        <div>
          <strong>
            Önce cihazı Home Assistant’a ekle, sonra buraya getir.
          </strong>
          <p>
            Yeni bir marka için aşağıdaki kurulum rehberini kullan. Cihazlarını
            buraya almak eşleşmiş cihazlara komut göndermez. Desteklenmeyen
            işlevler Home Assistant’ın kendi ekranından kullanılabilir.
          </p>
        </div>
        {link && (
          <a href={link} target="_blank" rel="noreferrer">
            Entegrasyonları aç
            <ExternalLink size={16} />
          </a>
        )}
      </div>
      <section className="feature-panel">
        <div className="panel-heading">
          <div>
            <h2>Bulunan cihazlar</h2>
            <p>
              {connected
                ? all.length +
                  " desteklenen varlık · " +
                  all.filter((c) => c.bound).length +
                  " tanesi evim’de"
                : "Güvenli bağlantı kurulduğunda evindeki cihazlar burada görünür."}
            </p>
          </div>
          <button
            className="secondary-button"
            disabled={!connected || busy}
            onClick={onRefresh}
          >
            <RefreshCw size={16} />
            {busy ? "Taranıyor…" : "Yenile"}
          </button>
        </div>
        {!connected ? (
          <div className="feature-empty">
            <Wifi size={36} />
            <h3>Ev sunucunu bağlamaya hazırız.</h3>
            <p>
              Vercel sitesi için erişilebilir HTTPS Home Assistant adresi
              gerekir. Yerel HTTP adresi doğrudan bağlanamaz.
            </p>
            <button className="primary-button" onClick={onConnect}>
              Bağlantıyı kur
            </button>
            <button className="text-button" onClick={onAdd}>
              Şimdilik elle cihaz ekle
            </button>
          </div>
        ) : (
          <>
            <div className="device-filter">
              <label className="search-box">
                <Search size={17} />
                <input
                  aria-label="Keşfedilen cihazlarda ara"
                  placeholder="Ad, marka veya oda ara…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <select
                aria-label="Keşif türü"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              >
                <option value="">Bütün türler</option>
                {Object.entries({ ...DEVICE_TYPES, light: "Lamba" }).map(
                  ([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ),
                )}
              </select>
              <button
                className="text-button"
                onClick={() =>
                  setSelected([
                    ...new Set([
                      ...selected,
                      ...list
                        .slice(0, 300)
                        .filter((e) => !e.bound && !e.disabled)
                        .map((e) => e.id),
                    ]),
                  ])
                }
              >
                Görünenleri seç
              </button>
              <button className="text-button" onClick={() => setSelected([])}>
                Seçimi temizle
              </button>
            </div>
            {metadata.warnings?.length > 0 && (
              <p className="small-note">
                Bazı sunucu kayıtları okunamadı. Cihazlar listelenebilir; oda ve
                üretici bilgisi eksik olabilir.
              </p>
            )}
            <div className="discovery-list">
              {list.slice(0, 300).map((c) => (
                <label key={c.id} className={c.bound ? "imported" : ""}>
                  <input
                    type="checkbox"
                    disabled={c.bound || c.disabled}
                    checked={c.bound || selected.includes(c.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, c.id]
                          : selected.filter((id) => id !== c.id),
                      )
                    }
                  />
                  <span>
                    <strong>{c.name}</strong>
                    <small>
                      {c.domain === "light" ? "Lamba" : DEVICE_TYPES[c.domain]}
                      {c.area ? " · " + c.area : ""}
                      {c.manufacturer ? " · " + c.manufacturer : ""}
                    </small>
                    <code>{c.id}</code>
                  </span>
                  <span className="status-pill">
                    {c.bound ? "Ekli" : c.disabled ? "Devre dışı" : "Yeni"}
                  </span>
                </label>
              ))}
              {!list.length && (
                <p className="empty-inline">
                  Bu aramaya uygun cihaz bulunamadı.
                </p>
              )}
            </div>
            {list.length > 300 && (
              <p className="small-note">
                İlk 300 sonuç gösteriliyor. Arama ile listeyi daralt.
              </p>
            )}
            <div className="import-toolbar">
              <label>
                <input
                  type="checkbox"
                  checked={useAreas}
                  onChange={(e) => setUseAreas(e.target.checked)}
                />
                Home Assistant odalarını kullan / oluştur
              </label>
              <select
                aria-label="Keşfedilen cihazların varsayılan odası"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
              >
                <option value="">Odasız cihazlar: atanmamış</option>
                {state.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button
                className="primary-button"
                disabled={!chosen.length}
                onClick={() => {
                  try {
                    onImport(chosen, { roomId, useAreas });
                    setSelected([]);
                    setError("");
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                <Plus size={17} />
                {chosen.length} cihazı ekle
              </button>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </section>
      <section className="feature-panel integration-energy">
        <Zap size={30} />
        <div>
          <h2>Önceliğin enerji mi?</h2>
          <p>
            Enerji ölçen priz veya sayacın kWh ve W sensörlerini seç. Tüketim,
            birim fiyat ve cihaz karşılaştırması hazır.
          </p>
        </div>
        <button className="primary-button" onClick={onEnergy}>
          Enerji merkezini aç
          <ArrowRight size={16} />
        </button>
      </section>
      <div className="panel-heading">
        <div>
          <h2>Bağlantı rehberleri</h2>
          <p>
            Tam modelinin desteklendiğini resmi entegrasyon sayfasından kontrol
            et.
          </p>
        </div>
        <a
          className="text-button"
          href="https://www.home-assistant.io/integrations/"
          target="_blank"
          rel="noreferrer"
        >
          Bütün entegrasyonlar
          <ExternalLink size={16} />
        </a>
      </div>
      <div className="integration-catalog">
        {CATALOG.map(([id, name, subtitle, desc, url]) => (
          <article className="feature-panel" key={id}>
            <span className="integration-monogram">{name.slice(0, 1)}</span>
            <h3>{name}</h3>
            <strong>{subtitle}</strong>
            <p>{desc}</p>
            <a href={url} target="_blank" rel="noreferrer">
              Kurulum rehberi
              <ExternalLink size={15} />
            </a>
          </article>
        ))}
      </div>
    </>
  );
}
