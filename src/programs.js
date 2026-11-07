import { liveCommands, validateState } from "./model.js";

export const canonical = (value) =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
export async function digest(value) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export function programSteps(state, p) {
  if (p.action === "mode") return [{ type: "mode", targetId: p.targetId }];
  const scene = state.scenes.find((s) => s.id === p.targetId);
  if (!scene) throw new Error("Programın senaryosu bulunamadı.");
  return scene.steps;
}
export function compileProgram(state, p, entities, metadata = {}) {
  state = validateState(state);
  p = state.programs.find((x) => x.id === p.id);
  if (!p) throw new Error("Program bulunamadı. Listeyi yenileyin.");
  if (!metadata.config?.time_zone)
    throw new Error(
      "Sunucunun saat dilimi okunamadı. Entegrasyonlar ekranından bağlantı bilgilerini yenileyin.",
    );
  if (
    metadata.config?.time_zone &&
    metadata.config.time_zone !== state.home.timeZone
  )
    throw new Error(
      "Ev saat dilimi ile Home Assistant saat dilimi farklı. Ev ayarlarında " +
        metadata.config.time_zone +
        " seçin.",
    );
  const plans = liveCommands(
    state,
    programSteps(state, p),
    entities,
    metadata.services,
    metadata.config?.unit_system?.temperature || null,
  );
  const t = p.trigger || { type: "time" };
  let trigger;
  if (t.type === "time") trigger = { trigger: "time", at: p.time + ":00" };
  else if (t.type === "sun")
    trigger = {
      trigger: "sun",
      event: t.event,
      offset: Math.round(t.offset * 60),
    };
  else {
    if (!entities[t.entityId])
      throw new Error("Tetikleyici sensör bulunamadı.");
    trigger =
      t.type === "state"
        ? { trigger: "state", entity_id: t.entityId, to: t.to }
        : {
            trigger: "numeric_state",
            entity_id: t.entityId,
            [t.comparison]: t.value,
          };
    if (t.seconds) trigger.for = { seconds: t.seconds };
  }
  const conditions = [
    {
      condition: "time",
      weekday: p.days.map(
        (i) => ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][i],
      ),
    },
    ...(p.conditions || []).map((c) => {
      if (!entities[c.entityId]) throw new Error("Koşul sensörü bulunamadı.");
      return { condition: "state", entity_id: c.entityId, state: c.state };
    }),
  ];
  return {
    alias: "evim · " + p.name,
    description: `[evim:${state.id}:${p.id}] Bu program evim tarafından yönetilir.`,
    triggers: [trigger],
    conditions,
    actions: plans.map(([domain, service, data, target]) => ({
      action: domain + "." + service,
      ...(target ? { target } : {}),
      ...(Object.keys(data || {}).length ? { data } : {}),
    })),
    mode: "single",
    initial_state: p.enabled,
  };
}
export async function deploymentPlan(state, p, entities, metadata) {
  const id = "evim_" + (await digest(state.id + ":" + p.id)).slice(0, 32);
  const config = { id, ...compileProgram(state, p, entities, metadata) };
  return { id, config, fingerprint: await digest(canonical(config)) };
}
export function isOwnedAutomation(config, state, p) {
  return (
    config?.description ===
    `[evim:${state.id}:${p.id}] Bu program evim tarafından yönetilir.`
  );
}
export function triggerLabel(p) {
  const t = p.trigger || { type: "time" };
  return t.type === "time"
    ? p.time
    : t.type === "sun"
      ? t.event === "sunrise"
        ? "Gün doğumu"
        : "Gün batımı"
      : t.type === "numeric"
        ? "Ölçüm eşiği"
        : "Durum değişimi";
}
export function programYaml(config) {
  // JSON is valid YAML 1.2 and can be pasted into Home Assistant's YAML editor.
  return JSON.stringify(config, null, 2);
}

// A bounded, testable publish transaction. No device action is executed here.
export async function publishAutomation(
  { state, program, plan, prior, pauseOnly = false, server },
  io,
) {
  let written = false;
  try {
    const latest = await io.read(plan.id);
    if (latest && !isOwnedAutomation(latest, state, program))
      throw new Error("Bu sunucu kaydı bu eve ait değil; üzerine yazılmadı.");
    if (canonical(latest) !== canonical(prior))
      throw new Error(
        "Program sunucuda değişmiş. Önizlemeyi yenileyip tekrar inceleyin.",
      );
    if (pauseOnly && !latest)
      throw new Error("Önce programı sunucuya aktarın.");
    const config = pauseOnly
      ? { ...latest, initial_state: false }
      : plan.config;
    if (!isOwnedAutomation(config, state, program) || config.id !== plan.id)
      throw new Error("Aktarım önizlemesi bu programa ait değil.");
    if (latest) await io.backup(latest);
    await io.write(plan.id, config);
    written = true;
    const states = await io.states(),
      automation = states.find(
        (e) =>
          e.entity_id.startsWith("automation.") && e.attributes?.id === plan.id,
      );
    if (!automation)
      throw new Error(
        "Program kaydı yazıldı; etkinleştirme henüz doğrulanamadı. Home Assistant otomasyonlarını kontrol edin.",
      );
    await io.activate(automation.entity_id, !!config.initial_state);
    const saved = await io.read(plan.id);
    if (
      !saved ||
      Object.keys(config).some(
        (key) => canonical(saved[key]) !== canonical(config[key]),
      )
    )
      throw new Error(
        "Sunucudaki yapılandırma önizlemeyle eşleşmiyor. Önizlemeyi yenileyin.",
      );
    const checked = (await io.states()).find(
      (e) => e.entity_id === automation.entity_id,
    );
    if (checked?.state !== (config.initial_state ? "on" : "off"))
      throw new Error(
        "Programın etkinlik durumu doğrulanamadı. Home Assistant ekranını kontrol edin.",
      );
    const fingerprint = await digest(canonical(config));
    return {
      saved,
      result: {
        id: program.id,
        enabled: !!config.initial_state,
        deployment: { id: plan.id, server, fingerprint, syncedAt: Date.now() },
        needsPublish:
          canonical({ ...plan.config, initial_state: config.initial_state }) !==
          canonical(config),
      },
    };
  } catch (error) {
    error.written = written;
    throw error;
  }
}
