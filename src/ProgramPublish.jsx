import React, { useEffect, useState } from "react";
import { Upload, Download, RefreshCw, Pause, ExternalLink } from "lucide-react";
import { Modal, download } from "./components.jsx";
import {
  deploymentPlan,
  isOwnedAutomation,
  programYaml,
  publishAutomation,
} from "./programs.js";
import { haRequest, haMessage, command } from "./ha.js";
import { hassLink } from "./IntegrationsPage.jsx";
async function read(id) {
  try {
    return await haRequest("config/automation/config/" + id);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}
export default function ProgramPublish({
  program,
  state,
  entities,
  metadata,
  connected,
  hassUrl,
  onSaved,
  onClose,
}) {
  const [plan, setPlan] = useState(null),
    [prior, setPrior] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const server = hassLink(hassUrl, "");
  async function prepare() {
    setBusy(true);
    setError("");
    setMessage("");
    setPlan(null);
    try {
      if (!connected)
        throw new Error(
          "Programı hazırlamak için Home Assistant’a bağlanın. Cihaz eşleştirmeleri ve desteklenen işlemler kontrol edilecek.",
        );
      const next = await deploymentPlan(state, program, entities, metadata),
        old = await read(next.id);
      if (old && !isOwnedAutomation(old, state, program))
        throw new Error(
          "Bu sunucu kaydı bu eve ait değil. Mevcut programın üzerine yazılmadı.",
        );
      setPrior(old);
      setPlan(next);
    } catch (e) {
      setError(e.message || "Program hazırlanamadı.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    prepare();
  }, []);
  async function publish(pauseOnly = false) {
    if (!plan || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const current = await deploymentPlan(state, program, entities, metadata);
      if (current.fingerprint !== plan.fingerprint)
        throw new Error(
          "Ev ayarları değişti. Aktarmadan önce önizlemeyi yenileyin.",
        );
      const { saved, result } = await publishAutomation(
        { state, program, plan, prior, pauseOnly, server },
        {
          read,
          write: (id, config) =>
            haRequest("config/automation/config/" + id, "POST", config),
          states: () => haMessage({ type: "get_states" }),
          activate: (id, enabled) =>
            command(
              "automation",
              enabled ? "turn_on" : "turn_off",
              {},
              { entity_id: id },
            ),
          backup: (config) =>
            download(
              "evim-otomasyon-onceki-" + plan.id + ".yaml",
              programYaml(config),
              "text/yaml",
            ),
        },
      );
      try {
        onSaved(result);
      } catch (e) {
        e.written = true;
        throw e;
      }
      setPrior(saved);
      setPlan(null);
      setMessage(
        result.enabled
          ? "Program ev sunucusuna kaydedildi ve etkinleştirildi. Tarayıcı kapalıyken de sunucu çalıştırır."
          : "Program ev sunucusunda kalıcı olarak duraklatıldı.",
      );
    } catch (e) {
      setError(
        (e.written ? "Sunucuya yazma gerçekleşti. " : "") +
          (e.message || "İşlem tamamlanamadı."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Programı ev sunucuna aktar"
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
    >
      <p className="modal-copy">
        <strong>{program.name}</strong> · {state.home.timeZone}. Aktarım bu
        programın tetikleyicisini ve eylemlerini Home Assistant’a kaydeder.
        Cihazlara hemen deneme komutu göndermez.
      </p>
      <p className="small-note">
        Bu uygulamada sonraki değişikliklerden sonra yeniden aktar. Diğer Home
        Assistant otomasyonları bağımsızdır; çakışan eski 07.00/23.00
        kurallarını sunucunda kontrol et. Mevcut evim kaydı güncellenmeden önce
        dosya olarak indirilir.
      </p>
      {program.deployment?.server && program.deployment.server !== server && (
        <p className="form-error">
          Bu program başka bir sunucuya da aktarılmıştı. Eski sunucudaki kopya
          bu işlemle kapanmaz.
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="success-note">
          {message}
        </p>
      )}
      {busy && !plan && (
        <p role="status">Cihazlar ve program kontrol ediliyor…</p>
      )}
      {plan && (
        <>
          <div className="publish-summary">
            <span>
              {prior
                ? "Mevcut evim programı güncellenecek"
                : "Yeni program oluşturulacak"}
            </span>
            <strong>
              {plan.config.actions.length} eylem ·{" "}
              {plan.config.initial_state ? "Etkin" : "Duraklatılmış"}
            </strong>
          </div>
          <details className="help-details">
            <summary>Aktarılacak yapılandırmayı göster</summary>
            <pre className="code-preview">{programYaml(plan.config)}</pre>
          </details>
          <div className="button-row">
            <button
              className="secondary-button"
              onClick={() =>
                download(
                  plan.id + ".yaml",
                  programYaml(plan.config),
                  "text/yaml",
                )
              }
            >
              <Download size={16} />
              YAML indir
            </button>
            {prior && (
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => publish(true)}
              >
                <Pause size={16} />
                Sunucuda duraklat
              </button>
            )}
          </div>
        </>
      )}
      <div className="editor-footer">
        <button className="secondary-button" disabled={busy} onClick={prepare}>
          <RefreshCw size={16} />
          Önizlemeyi yenile
        </button>
        <button
          className="primary-button"
          disabled={
            !plan || busy || !connected || metadata.user?.is_admin === false
          }
          onClick={() => publish()}
        >
          <Upload size={17} />
          {busy ? "Aktarılıyor…" : "Sunucuya kaydet"}
        </button>
      </div>
      {metadata.user?.is_admin === false && (
        <p className="form-error">
          Aktarım için Home Assistant yönetici hesabıyla bağlan.
        </p>
      )}
      {server && (
        <a
          className="text-button"
          href={server + "/config/automation/dashboard"}
          target="_blank"
          rel="noreferrer"
        >
          Home Assistant otomasyonları
          <ExternalLink size={16} />
        </a>
      )}
    </Modal>
  );
}
