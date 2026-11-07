// Local-only synthetic fixture. tests/ is excluded from every Vercel upload.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import EnergyPage from "../src/EnergyPage.jsx";
import IntegrationsPage from "../src/IntegrationsPage.jsx";
import { initialState, importEntities } from "../src/model.js";
import "../src/styles.css";
import "../src/crud.css";
import "../src/features.css";
const e = (id, state, attrs) => ({ entity_id: id, state, attributes: attrs });
const entities = {
  "sensor.main": e("sensor.main", "1000", {
    friendly_name: "Ana sayaç",
    unit_of_measurement: "kWh",
    device_class: "energy",
    state_class: "total_increasing",
  }),
  "sensor.plug": e("sensor.plug", "15", {
    friendly_name: "Çalışma prizi",
    unit_of_measurement: "kWh",
    device_class: "energy",
    state_class: "total_increasing",
  }),
  "sensor.power": e("sensor.power", "1.25", {
    friendly_name: "Anlık güç",
    unit_of_measurement: "kW",
    device_class: "power",
  }),
  "switch.plug": e("switch.plug", "on", {
    friendly_name: "Çalışma prizi aç/kapat",
  }),
};
const metadata = {
  config: { time_zone: "Europe/Istanbul" },
  entities: Object.keys(entities).map((entity_id) => ({
    entity_id,
    device_id: "meter",
  })),
  devices: [{ id: "meter", area_id: "office", manufacturer: "Test markası" }],
  areas: [{ area_id: "office", name: "Test ofisi" }],
};
const readStatistics = async (ids, range) =>
  Object.fromEntries(
    ids.map((id) => [
      id,
      [
        {
          start: +range.start,
          end: +range.start + 3600000,
          change: id === "sensor.main" ? 10 : 3,
        },
      ],
    ]),
  );
function Fixture() {
  const [page, setPage] = useState("energy"),
    [state, setState] = useState(() => ({
      ...initialState(),
      energy: {
        meter: "sensor.main",
        power: "sensor.power",
        submeters: ["sensor.plug"],
        tariff: 3.5,
        currency: "TRY",
        monthlyBudget: 250,
      },
    })),
    [report, setReport] = useState("");
  return (
    <main style={{ maxWidth: 1100, margin: "auto", padding: 24 }}>
      <p role="note">
        YALNIZ YEREL TEST · Gerçek cihaz veya hesap bağlantısı yok.
      </p>
      <div className="button-row">
        <button onClick={() => setPage("energy")}>Enerji testi</button>
        <button onClick={() => setPage("discovery")}>Keşif testi</button>
      </div>
      <p role="status">{report}</p>
      {page === "energy" ? (
        <EnergyPage
          state={state}
          entities={entities}
          metadata={metadata}
          live
          ready
          onSettings={() => {}}
          onConnect={() => {}}
          readStatistics={readStatistics}
        />
      ) : (
        <IntegrationsPage
          state={state}
          entities={entities}
          metadata={metadata}
          connected
          busy={false}
          hassUrl="https://example.invalid"
          onConnect={() => {}}
          onRefresh={() => {}}
          onAdd={() => {}}
          onEnergy={() => setPage("energy")}
          onImport={(c, options) => {
            const next = importEntities(state, c, options);
            setState(next);
            setReport(c.length + " cihaz eklendi · " + next.rooms.at(-1).name);
          }}
        />
      )}
    </main>
  );
}
createRoot(document.getElementById("root")).render(<Fixture />);
