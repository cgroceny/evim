import React, { useState } from "react";
import { Cloud, LogIn, KeyRound, Download } from "lucide-react";
import { Modal, download } from "./components.jsx";
import { Input } from "./Editor.jsx";
import { api } from "./cloud.js";
export default function Auth({ onClose, onAuth }) {
  const [tab, setTab] = useState("loginCode"),
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [recovery, setRecovery] = useState(""),
    [accessCode, setAccessCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (["register", "recover"].includes(tab) && password !== confirm)
      return setError("Parolalar eşleşmiyor.");
    setBusy(true);
    setError("");
    try {
      const r = await api(tab, "POST", {
        username: name.trim().toLowerCase(),
        ...(tab === "loginCode" ? { accessCode: accessCode.trim() } : { password }),
        ...(tab === "recover" ? { recoveryCode: recovery.trim() } : {}),
      });
      setAccessCode("");
      setPassword("");
      await onAuth(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Evin her cihazda seninle" onClose={onClose}>
      <div className="auth-symbol">
        <Cloud size={34} />
      </div>
      <p className="editor-intro">
        Aynı kullanıcı adıyla telefon ve bilgisayarda giriş yap. Ev düzenin
        hesabına özel olarak eşitlenir.
      </p>
      <div className="segmented auth-tabs">
        {[
          ["loginCode", "Kodla giriş"],
          ["login", "Parolayla giriş"],
          ["register", "Hesap oluştur"],
          ["recover", "Kurtar"],
        ].map(([id, label]) => (
          <button
            key={id}
            disabled={busy}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              setError("");
              setAccessCode("");
              setPassword("");
              setConfirm("");
              setRecovery("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <form className="editor-form" onSubmit={submit}>
        <Input
          label="Kullanıcı adı"
          value={name}
          onChange={setName}
          required
          minLength="3"
          maxLength="30"
          autoComplete="username"
          pattern="[a-z0-9][a-z0-9_.\-]{2,29}"
          hint="3–30 karakter: küçük harf, rakam, nokta, tire veya alt çizgi."
        />
        {tab === "recover" && (
          <Input
            label="Kurtarma anahtarı"
            value={recovery}
            onChange={setRecovery}
            required
            autoComplete="off"
          />
        )}
        {tab === "loginCode" ? <Input
          label="Erişim kodu"
          type="password"
          value={accessCode}
          onChange={setAccessCode}
          required
          maxLength="100"
          autoComplete="current-password"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="EVIM-…"
          hint="Sana verilen kodu yapıştır. Aynı kodla telefon ve bilgisayardan giriş yapabilirsin."
        /> : <Input
          label={tab === "recover" ? "Yeni parola" : "Parola"}
          type="password"
          value={password}
          onChange={setPassword}
          required
          minLength="12"
          maxLength="128"
          autoComplete={tab === "login" ? "current-password" : "new-password"}
          hint="En az 12 karakter kullan."
        />}
        {["register", "recover"].includes(tab) && (
          <Input
            label="Parola tekrarı"
            type="password"
            value={confirm}
            onChange={setConfirm}
            required
            minLength="12"
            autoComplete="new-password"
          />
        )}
        {tab === "register" && (
          <p className="small-note">
            Yeni hesabına bu tarayıcıdaki mevcut düzen aktarılır. Kayıttan sonra
            verilen kurtarma anahtarını sakla; e-posta ile parola sıfırlama
            kullanılmaz.
          </p>
        )}
        {tab === "recover" && (
          <p className="small-note">
            Kurtarma, diğer cihazlardaki tüm oturumları kapatır ve yeni bir
            kurtarma anahtarı üretir.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={busy} type="submit">
          <LogIn size={17} />
          {busy
            ? "İşlem yapılıyor…"
            : tab === "register"
              ? "Hesabımı oluştur"
              : tab === "recover"
                ? "Parolayı yenile"
                : tab === "loginCode" ? "Kodla giriş yap" : "Giriş yap"}
        </button>
      </form>
    </Modal>
  );
}
export function Recovery({ code, username, onClose }) {
  return (
    <Modal title="Kurtarma anahtarını sakla" onClose={onClose}>
      <div className="auth-symbol">
        <KeyRound size={32} />
      </div>
      <p className="modal-copy">
        Parolanı unutursan hesabını bu anahtarla kurtarabilirsin. Yalnızca bu
        ekranda gösterilir; güvenli bir yerde sakla.
      </p>
      <code className="recovery-code">{code}</code>
      <div className="button-row">
        <button
          className="secondary-button"
          onClick={() =>
            download(
              "evim-kurtarma.txt",
              `Kullanıcı adı: ${username}\nKurtarma anahtarı: ${code}\nBu dosyayı paylaşmayın.`,
              "text/plain",
            )
          }
        >
          <Download size={16} />
          Anahtarı indir
        </button>
        <button className="primary-button" onClick={onClose}>
          Kaydettim
        </button>
      </div>
    </Modal>
  );
}
