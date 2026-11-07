import { available } from "./core.js";
import { energyUnit } from "./energy.js";
export function healthIssues(state, entities, connected) {
  const issues = [];
  for (const [kind, records] of [
    ["devices", state.devices],
    ["lights", state.lights],
  ])
    for (const d of records.filter((d) => d.enabled)) {
      const add = (level, message) =>
        issues.push({
          id: d.id + message,
          level,
          title: d.name,
          message,
          kind,
          record: d,
        });
      if (!d.entityId) add("setup", "Gerçek cihaz eşleştirmesi yapılmadı.");
      else if (connected && !available(entities[d.entityId]))
        add("warning", "Cihaza ulaşılamıyor veya ölçümü bilinmiyor.");
      if (!d.roomId) add("setup", "Bir odaya atanmadı.");
      const e = entities[d.entityId],
        rawBattery =
          d.sensorClass === "battery" ? e?.state : e?.attributes?.battery,
        battery =
          rawBattery == null || rawBattery === "" ? NaN : Number(rawBattery);
      if (
        connected &&
        available(e) &&
        Number.isFinite(battery) &&
        battery <= 20
      )
        add("warning", "Pil seviyesi %" + battery + ".");
    }
  if (state.energy.meter && connected) {
    const e = entities[state.energy.meter];
    if (!available(e) || energyUnit(e?.attributes.unit_of_measurement) == null)
      issues.push({
        id: "meter",
        level: "warning",
        title: "Ana enerji sayacı",
        message: "Erişilebilir ve enerji birimli bir sayaç seçin.",
        page: "energy",
      });
    else if (!["total", "total_increasing"].includes(e.attributes.state_class))
      issues.push({
        id: "statistics",
        level: "warning",
        title: "Enerji istatistikleri",
        message:
          "Ana sayacın total / total_increasing sınıfı kontrol edilmeli.",
        page: "energy",
      });
  }
  for (const p of state.programs) {
    if (p.enabled && !p.deployment)
      issues.push({
        id: p.id,
        level: "setup",
        title: p.name,
        message: "Sunucuya aktarılmadı; tarayıcı kapalıyken çalışmaz.",
        page: "programs",
      });
    else if (p.deployment && p.needsPublish)
      issues.push({
        id: p.id,
        level: "warning",
        title: p.name,
        message: "Yerel değişiklikler henüz sunucuya aktarılmadı.",
        page: "programs",
      });
  }
  return issues;
}
