import React, { useEffect, useState } from "react";
import {
  Zap,
  TrendingUp,
  Wallet,
  Settings2,
  RefreshCw,
  Download,
  ArrowRight,
  Info,
  Gauge,
} from "lucide-react";
import { Modal, download } from "./components.jsx";
import { Input, Select } from "./Editor.jsx";
import {
  energyRange,
  energyUnit,
  powerWatts,
  summarizeStatistics,
  estimatedCost,
  energyCsv,
} from "./energy.js";
import { loadEnergyStatistics } from "./ha.js";
const number = (n, d = 2) =>
  n == null ? "—" : n.toLocaleString("tr-TR", { maximumFractionDigits: d });
export function EnergySettings({ value, entities, onSave, onClose }) {
  const [draft, setDraft] = useState(structuredClone(value)),
    [error, setError] = useState("");
  const set = (patch) => setDraft((s) => ({ ...s, ...patch }));
  const sensors = Object.values(entities).filter((e) =>
    e.entity_id.startsWith("sensor."),
  );
  const meters = sensors.filter(
      (e) => energyUnit(e.attributes.unit_of_measurement) != null,
    ),
    powers = sensors.filter((e) =>
      ["W", "kW", "MW"].includes(e.attributes.unit_of_measurement),
    );
  const meterOptions = [
    ["", "Henüz seçilmedi"],
    ...meters.map((e) => [
      e.entity_id,
      e.attributes.friendly_name || e.entity_id,
    ]),
  ];
  return (
    <Modal title="Enerji kaynaklarım" onClose={onClose}>
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onSave(draft);
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        <p className="modal-copy">
          Bir ana sayaç evin toplamını gösterir. Priz ve cihaz sayaçlarını alt
          sayaç olarak ekle; bunlar ana toplama yeniden eklenmez.
        </p>
        {meters.length > 0 && (
          <Select
            label="Ana tüketim sayacı"
            value={draft.meter}
            options={meterOptions}
            onChange={(meter) =>
              set({
                meter,
                submeters: draft.submeters.filter((id) => id !== meter),
              })
            }
          />
        )}
        {powers.length > 0 && (
          <Select
            label="Anlık güç sensörü"
            value={draft.power}
            options={[
              ["", "Seçilmedi"],
              ...powers.map((e) => [
                e.entity_id,
                e.attributes.friendly_name || e.entity_id,
              ]),
            ]}
            onChange={(power) => set({ power })}
          />
        )}
        <details className="help-details" open={!meters.length}>
          <summary>Sensör kimliklerini elle gir</summary>
          <Input
            label="Ana enerji sensörü"
            value={draft.meter}
            onChange={(meter) =>
              set({
                meter,
                submeters: draft.submeters.filter((id) => id !== meter),
              })
            }
            placeholder="sensor.ev_toplam_enerji"
            hint="Wh / kWh / MWh birimli toplam tüketim sayacı. W ölçen güç sensörü bu alana uygun değildir."
          />
          <Input
            label="Anlık güç sensörü kimliği"
            value={draft.power}
            onChange={(power) => set({ power })}
            placeholder="sensor.ev_anlik_guc"
          />
        </details>
        <div className="edit-grid">
          <Input
            label="Birim fiyat / kWh"
            type="number"
            min="0"
            max="1000000"
            step="0.0001"
            required
            value={draft.tariff}
            onChange={(tariff) => set({ tariff })}
          />
          <Select
            label="Para birimi"
            value={draft.currency}
            onChange={(currency) => set({ currency })}
            options={[
              ["TRY", "Türk lirası"],
              ["EUR", "Euro"],
              ["USD", "ABD doları"],
            ]}
          />
          <Input
            label="Aylık tüketim hedefi (kWh)"
            type="number"
            min="0"
            max="10000000"
            step="0.1"
            value={draft.monthlyBudget}
            onChange={(monthlyBudget) => set({ monthlyBudget })}
            hint="0 bırakırsan hedef gösterilmez."
          />
        </div>
        <fieldset>
          <legend>Alt sayaçlar · en fazla 20</legend>
          <p className="small-note">
            Toplamı yeniden toplamayız; cihazları ayrı karşılaştırırız.
          </p>
          <div className="selection-list">
            {[
              ...new Set([
                ...meters.map((e) => e.entity_id),
                ...draft.submeters,
              ]),
            ]
              .filter((id) => id !== draft.meter)
              .map((id) => (
                <label key={id}>
                  <input
                    type="checkbox"
                    checked={draft.submeters.includes(id)}
                    onChange={(e) =>
                      set({
                        submeters: e.target.checked
                          ? [...draft.submeters, id]
                          : draft.submeters.filter((x) => x !== id),
                      })
                    }
                  />
                  <span>{entities[id]?.attributes.friendly_name || id}</span>
                </label>
              ))}
            {!meters.length && !draft.submeters.length && (
              <p className="small-note">
                Home Assistant bağlanınca uygun sayaçlar burada listelenir.
              </p>
            )}
          </div>
        </fieldset>
        <p className="small-note">
          Faturandaki birim bedeli sen girersin. Hesap tüketim × birim fiyat
          üzerinden tahminidir; sabit ücretler ve kademeli tarife hesaplanmaz.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="editor-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Vazgeç
          </button>
          <button className="primary-button" type="submit">
            Kaynakları kaydet
          </button>
        </div>
      </form>
    </Modal>
  );
}
function demoSeries(range) {
  const step = range.period === "hour" ? 3600000 : 86400000,
    n = Math.max(1, Math.ceil((+range.end - +range.start) / step));
  const points = Array.from({ length: n }, (_, i) => ({
    start: +range.start + i * step,
    end: Math.min(+range.start + (i + 1) * step, +range.end),
    change:
      range.period === "hour"
        ? [
            0.19, 0.14, 0.13, 0.12, 0.11, 0.17, 0.46, 0.63, 0.3, 0.24, 0.27,
            0.41, 0.38, 0.29, 0.25, 0.32, 0.47, 0.81, 0.92, 0.76, 0.58, 0.39,
            0.28, 0.22,
          ][i % 24]
        : [6.4, 5.8, 7.2, 6.1, 8.3, 5.7, 6.8][i % 7],
  }));
  return summarizeStatistics(points, range.start, range.end);
}
export default function EnergyPage({
  state,
  entities,
  metadata,
  live,
  ready,
  onSettings,
  onConnect,
  readStatistics = loadEnergyStatistics,
}) {
  const [period, setPeriod] = useState("today"),
    [refresh, setRefresh] = useState(0),
    [report, setReport] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const tz = metadata.config?.time_zone || state.home.timeZone,
    settings = state.energy,
    ids = [settings.meter, ...settings.submeters].filter(Boolean),
    key = ids.join(",");
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) setRefresh((x) => x + 1);
    }, 300000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const range = energyRange(period, tz);
    setReport(null);
    setError("");
    if (!live) {
      setLoading(false);
      setReport({
        range,
        series: { demo: demoSeries(range) },
        loadedAt: Date.now(),
      });
      return;
    }
    if (!ready || !ids.length) {
      setLoading(false);
      return;
    }
    setLoading(true);
    readStatistics(ids, range)
      .then((raw) => {
        if (!cancelled)
          setReport({
            range,
            series: Object.fromEntries(
              ids.map((id) => [
                id,
                summarizeStatistics(raw[id], range.start, range.end),
              ]),
            ),
            loadedAt: Date.now(),
          });
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e.message ||
              "Enerji geçmişi alınamadı. Recorder ve sensör istatistiklerini kontrol edin.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key, period, tz, live, ready, refresh, readStatistics]);
  const main = report?.series[live ? settings.meter : "demo"],
    points = main?.points || [],
    total = main?.total ?? null,
    power = live ? (ready ? powerWatts(entities[settings.power]) : null) : 416,
    cost = estimatedCost(total, settings.tariff);
  const names = Object.fromEntries(
    ids.map((id) => [id, entities[id]?.attributes.friendly_name || id]),
  );
  const max = Math.max(0.1, ...points.map((p) => Math.abs(p.kwh || 0)));
  return (
    <>
      <header className="feature-heading">
        <div>
          <p className="eyebrow">EVİNİN ENERJİSİ</p>
          <h1>Tüketimini görünür kıl.</h1>
          <p>Ne kadar, ne zaman, hangi cihazda.</p>
        </div>
        <button className="primary-button" onClick={onSettings}>
          <Settings2 size={18} />
          Kaynaklar & tarife
        </button>
      </header>
      {!live && (
        <div className="feature-banner">
          <Info size={20} />
          <div>
            <strong>Örnek enerji raporu</strong>
            <p>
              Grafik ve güç değerleri tanıtım verisidir. Gerçek ölçüm için
              enerji ölçebilen sayaç/priz ve Home Assistant bağlantısı gerekir.
              Vanaların sıcaklık verisi elektrik veya gaz tüketimi değildir.
            </p>
          </div>
          <button onClick={onConnect}>
            Evime bağlan
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      {live && !settings.meter && (
        <div className="feature-banner">
          <Gauge size={24} />
          <div>
            <strong>Ana tüketim sayacını seç</strong>
            <p>
              Kaynaklar & tarife bölümünden kWh ölçen sensörü seç. Yalnız W
              sensörün varsa Home Assistant’taki İntegral yardımcısı ile kWh
              sayacı oluşturabilirsin.
            </p>
          </div>
          <a
            href="https://www.home-assistant.io/integrations/integration/"
            target="_blank"
            rel="noreferrer"
          >
            Kurulum rehberi
          </a>
        </div>
      )}
      <div className="stat-grid">
        <article>
          <span>
            <Zap size={17} />
            Anlık güç
          </span>
          <strong>
            {number(power, 0)}
            <small> W</small>
          </strong>
          <p>
            {live
              ? ready
                ? "Seçili güç sensörünün son ölçümü"
                : "Bağlantı bekleniyor"
              : "Örnek anlık değer"}
          </p>
        </article>
        <article>
          <span>
            <TrendingUp size={17} />
            {period === "today"
              ? "Bugün"
              : period === "week"
                ? "Son 7 gün"
                : "Bu ay"}
          </span>
          <strong>
            {number(total)}
            <small> kWh</small>
          </strong>
          <p>{live ? "Kaydedilmiş sayaç istatistikleri" : "Örnek tüketim"}</p>
        </article>
        <article>
          <span>
            <Wallet size={17} />
            Tahmini maliyet
          </span>
          <strong>
            {cost == null
              ? "—"
              : new Intl.NumberFormat("tr-TR", {
                  style: "currency",
                  currency: settings.currency,
                  maximumFractionDigits: 2,
                }).format(cost)}
          </strong>
          <p>
            {settings.tariff
              ? number(settings.tariff, 4) + " " + settings.currency + " / kWh"
              : "Birim fiyatı tarife bölümünden gir"}
          </p>
        </article>
      </div>
      <section className="feature-panel energy-chart-panel">
        <div className="panel-heading">
          <div>
            <h2>Tüketimin ritmi</h2>
            <p>
              {live
                ? names[settings.meter] || "Ana sayaç seçilmedi"
                : "Örnek ev sayacı"}{" "}
              · {tz}
            </p>
          </div>
          <div className="segmented" aria-label="Enerji dönemi">
            {[
              ["today", "Bugün"],
              ["week", "7 gün"],
              ["month", "Bu ay"],
            ].map(([id, name]) => (
              <button
                key={id}
                aria-pressed={period === id}
                className={period === id ? "active" : ""}
                onClick={() => setPeriod(id)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <p role="status" className="empty-inline">
            Sayaç geçmişi alınıyor…
          </p>
        ) : error ? (
          <div role="alert" className="form-error">
            {error}
            <button
              className="text-button"
              onClick={() => setRefresh((n) => n + 1)}
            >
              Tekrar dene
            </button>
          </div>
        ) : total === null ? (
          <div className="feature-empty">
            <Gauge size={36} />
            <h3>Henüz kullanılabilir tüketim kaydı yok.</h3>
            <p>
              Home Assistant’ta Recorder etkin olmalı; sensör energy türünde ve
              total / total_increasing sınıfında olmalı. İlk saatlik kayıt
              oluşana kadar veri beklenir.
            </p>
            <button className="secondary-button" onClick={onSettings}>
              Kaynakları kontrol et
            </button>
          </div>
        ) : (
          <>
            <div
              className="energy-bars"
              role="img"
              aria-label={`${period === "today" ? "Saatlik" : "Günlük"} tüketim, toplam ${number(total)} kWh`}
            >
              {points.map((p, i) => {
                const label = new Intl.DateTimeFormat("tr-TR", {
                  timeZone: tz,
                  ...(period === "today"
                    ? { hour: "2-digit" }
                    : { day: "numeric", month: "short" }),
                }).format(p.start);
                return (
                  <div className="energy-bar-column" key={p.start}>
                    <div className="energy-bar-track">
                      <div
                        className="energy-bar"
                        style={{
                          height:
                            p.kwh == null
                              ? "0%"
                              : Math.max(2, (Math.abs(p.kwh) / max) * 100) +
                                "%",
                        }}
                        title={`${label}: ${number(p.kwh)} kWh`}
                      />
                    </div>
                    <span>
                      {points.length > 16 && i % 3 !== 0 ? "" : label}
                    </span>
                  </div>
                );
              })}
            </div>
            <details className="help-details">
              <summary>Grafiği tablo olarak göster</summary>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Dönem başlangıcı</th>
                      <th>Tüketim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((p) => (
                      <tr key={p.start}>
                        <td>
                          {new Date(p.start).toLocaleString("tr-TR", {
                            timeZone: tz,
                          })}
                        </td>
                        <td>{number(p.kwh)} kWh</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            {main?.negative && (
              <p className="form-error">
                Sayaç negatif fark içeriyor. Net üretim/ihracat sayacı seçilmiş
                olabilir; maliyet değerini tüketim faturası olarak kullanma.
              </p>
            )}
          </>
        )}
        <div className="panel-footer">
          <p>
            Son tamamlanan saatler gösterilir; güncel saat ve eksik kayıtlar
            toplamda bulunmayabilir.
            {main?.missing ? " " + main.missing + " dönem ölçümü eksik." : ""}
          </p>
          <button
            className="text-button"
            disabled={loading || (live && !ready)}
            onClick={() => setRefresh((n) => n + 1)}
          >
            <RefreshCw size={16} />
            Yenile
          </button>
          <button
            className="text-button"
            disabled={!report || total === null}
            onClick={() =>
              download(
                "evim-enerji-" + period + ".csv",
                energyCsv(
                  report.series,
                  { ...names, demo: "Örnek ev sayacı" },
                  tz,
                ),
                "text/csv;charset=utf-8",
              )
            }
          >
            <Download size={16} />
            CSV indir
          </button>
        </div>
      </section>
      {settings.monthlyBudget > 0 && period === "month" && total !== null && (
        <section className="feature-panel">
          <div className="panel-heading">
            <h2>Aylık tüketim hedefi</h2>
            <strong>
              {number(total)} / {number(settings.monthlyBudget)} kWh
            </strong>
          </div>
          <progress
            className="budget-progress"
            max={settings.monthlyBudget}
            value={Math.min(settings.monthlyBudget, Math.max(0, total))}
          />
          <p className="small-note">
            Hedefin %{number((total / settings.monthlyBudget) * 100, 0)} kadarı
            kullanıldı.{!live ? " Bu hesap örnek veridir." : ""}
          </p>
        </section>
      )}
      <section className="feature-panel">
        <div className="panel-heading">
          <div>
            <h2>Cihazlara yakından bak</h2>
            <p>Alt sayaçlar karşılaştırılır; ana sayaç toplamına eklenmez.</p>
          </div>
        </div>
        {!live ? (
          <p className="small-note">
            Akıllı priz veya ayrı devre sayaçlarını bağlayınca cihaz bazında kWh
            ve maliyet burada görünür.
          </p>
        ) : !settings.submeters.length ? (
          <button className="secondary-button" onClick={onSettings}>
            Alt sayaç ekle
          </button>
        ) : (
          <div className="meter-list">
            {settings.submeters.map((id) => {
              const s = report?.series[id],
                amount = estimatedCost(s?.total, settings.tariff);
              return (
                <div key={id}>
                  <span>
                    <strong>{names[id]}</strong>
                    <small>{id}</small>
                  </span>
                  <strong>{number(s?.total)} kWh</strong>
                  <span>
                    {amount == null
                      ? "—"
                      : number(amount) + " " + settings.currency}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <p className="feature-footnote">
        Maliyet tahminidir. Veriler Home Assistant’ın kayıtlı sayaç farklarından
        alınır; yalnız anlık güç değerinden geçmiş tüketim uydurulmaz. Isıtma
        süresi doğrudan doğalgaz tüketimi değildir.
      </p>
    </>
  );
}
