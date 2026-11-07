// Synthetic local test only; excluded from production by .vercelignore.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import DevicePanel from "../src/DevicePanel.jsx";
import { initialState, template, saveRecord } from "../src/model.js";
import { deviceCommand } from "../src/devices.js";
import { demoClimateEntity } from "../src/climate.js";
import "../src/styles.css";
import "../src/crud.css";
import "../src/features.css";
const base = initialState();
const ac = {
  ...template("devices", base),
  name: "Yatak odası Gree",
  roomId: "yatak",
  entityId: "climate.gree",
};
const fixture = saveRecord(
  {
    ...base,
    devices: [],
    rooms: base.rooms.map((r) => ({ ...r, sensorId: "" })),
  },
  "devices",
  ac,
);
const services = {
  climate: Object.fromEntries(
    [
      "turn_on",
      "turn_off",
      "set_temperature",
      "set_hvac_mode",
      "set_fan_mode",
      "set_swing_mode",
      "set_swing_horizontal_mode",
      "set_preset_mode",
    ].map((v) => [v, {}]),
  ),
};
function Fixture() {
  const [entity, setEntity] = useState(demoClimateEntity(ac)),
    [report, setReport] = useState("Henüz komut yok.");
  return (
    <main style={{ maxWidth: 1100, margin: "auto", padding: 24 }}>
      <p role="note">ÖRNEK CİHAZ · Gerçek klimaya bağlı değildir.</p>
      <button onClick={() => setEntity({ ...entity, state: "unavailable" })}>
        Bağlantıyı kes
      </button>
      <button onClick={() => setEntity(demoClimateEntity(ac))}>
        Bağlantıyı geri getir
      </button>
      <p role="status">{report}</p>
      <DevicePanel
        state={fixture}
        entities={{ [ac.entityId]: entity }}
        live
        temperatureUnit="°C"
        disabled={false}
        onFavorite={() => {}}
        onRoom={() => {}}
        onAdd={() => {}}
        onDiscover={() => {}}
        actions={() => null}
        onCommand={async (device, action) => {
          try {
            const [, service, data, target] = deviceCommand(
              device,
              action,
              entity,
              services,
              "°C",
            );
            setReport(
              service + " · " + JSON.stringify(data) + " · " + target.entity_id,
            );
            setEntity({
              ...entity,
              state:
                service === "turn_off"
                  ? "off"
                  : service === "turn_on"
                    ? "heat"
                    : data.hvac_mode || entity.state,
              attributes: { ...entity.attributes, ...data },
            });
            return true;
          } catch (e) {
            setReport(e.message);
            return false;
          }
        }}
      />
    </main>
  );
}
createRoot(document.getElementById("root")).render(<Fixture />);
