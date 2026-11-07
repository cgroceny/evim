import React, { useState } from "react";
import { ShieldCheck, KeyRound, LogOut, Copy, Download } from "lucide-react";
import { api } from "./cloud.js";
import { Input } from "./Editor.jsx";
import { download } from "./components.jsx";
export default function AccountSecurity({ user, onUpdated }) {
  const [mode, setMode] = useState(""),
    [currentPassword, setCurrent] = useState(""),
    [currentCode, setCurrentCode] = useState(""),
    [accessReceipt, setAccessReceipt] = useState(null),
    [password, setPassword] = useState(""),
    [again, setAgain] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const hasPassword = user.hasPassword !== false;
  const accessActive = user.accessCodeExpiresAt > Date.now();
  function choose(next) {
    setMode(next);
    setCurrent("");
    setCurrentCode("");
    setPassword("");
    setAgain("");
    setError("");
    setMessage("");
  }
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setMessage("");
    if (mode === "password" && password !== again) {
      setError("Yeni parolalar eşleşmiyor.");
      return;
    }
    setBusy(true);
    try {
      const result = await api("security", "POST", {
        accountId: user.id,
        mode,
        currentPassword,
        currentCode,
        password,
      });
      setCurrent("");
      setCurrentCode("");
      setPassword("");
      setAgain("");
      setMode("");
      setMessage("Güvenlik ayarı güncellendi. Diğer oturumlar kapatıldı.");
      setAccessReceipt(result.accessCode ? { code: result.accessCode, expiresAt: result.user.accessCodeExpiresAt } : null);
      onUpdated(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-card">
      <div className="card-title">
        <ShieldCheck size={23} />
        <h2>Hesap güvenliği</h2>
      </div>
      <p>
        Kişisel erişim kodunla telefon ve bilgisayardan aynı hesabı açabilirsin.
        Kod hesabına tam erişim verir; yalnız kendin kullan.
      </p>
      <p className="small-note">
        {accessActive ? `Erişim kodun ${new Date(user.accessCodeExpiresAt).toLocaleDateString("tr-TR")} tarihine kadar geçerli.` : "Etkin erişim kodun yok. Yeni bir kod oluşturabilirsin."}
      </p>
      <div className="button-row">
        <button className="primary-button" disabled={busy} onClick={() => choose("access-create")}>
          <KeyRound size={16} />{accessActive ? "Erişim kodunu yenile" : "Erişim kodu oluştur"}
        </button>
        {user.accessCodeExpiresAt && <button className="text-button" disabled={busy || !hasPassword} onClick={() => choose("access-revoke")}>
          Erişim kodunu kaldır
        </button>}
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => choose("password")}
        >
          <KeyRound size={16} />
          {hasPassword ? "Parola değiştir" : "Parola ekle"}
        </button>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => choose("recovery")}
        >
          Kurtarma anahtarı yenile
        </button>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => choose("sessions")}
        >
          <LogOut size={16} />
          Diğer oturumları kapat
        </button>
      </div>
      {!hasPassword && <p className="small-note">Kodunu kaldırmak için önce bir parola ekle. Parola eklediğinde eski kodun kapanır; istersen yeni kod oluşturabilirsin.</p>}
      {accessReceipt && <div className="access-receipt" role="region" aria-label="Yeni erişim kodu">
        <h3>Erişim kodunu sakla</h3>
        <p>Bu kod yalnız bu kez gösterilir. {new Date(accessReceipt.expiresAt).toLocaleDateString("tr-TR")} tarihine kadar kullanabilirsin.</p>
        <code className="recovery-code">{accessReceipt.code}</code>
        <div className="button-row">
          <button className="secondary-button" onClick={async () => {
            try { await navigator.clipboard.writeText(accessReceipt.code); setMessage("Erişim kodu kopyalandı."); }
            catch { setError("Kopyalanamadı. Kodu seçip kopyalayabilir veya indirebilirsin."); }
          }}><Copy size={16} />Kopyala</button>
          <button className="secondary-button" onClick={() => download("evim-erisim-kodu.txt", `Adres: https://home.cemgocen.com\nKullanıcı adı: ${user.username}\nErişim kodu: ${accessReceipt.code}\nSon geçerlilik: ${new Date(accessReceipt.expiresAt).toISOString()}\nBu kodu paylaşmayın.`, "text/plain")}><Download size={16} />İndir</button>
          <button className="text-button" onClick={() => setAccessReceipt(null)}>Kaydettim, gizle</button>
        </div>
      </div>}
      {mode && (
        <form className="editor-form security-form" onSubmit={submit}>
          <p className="small-note">
            {mode === "sessions"
              ? "Diğer telefon ve bilgisayarlarda yeniden giriş gerekecek. Bu oturum açık kalır."
              : mode === "access-create" ? "Yeni kod 90 gün geçerlidir. Önceki erişim kodu ve diğer oturumlar kapanır. Mevcut hesabını doğrula."
                : mode === "access-revoke" ? "Erişim kodu ve diğer oturumlar kapanır. Bu oturum açık kalır; sonraki girişte parolanı kullan."
                  : "İşlem eski erişim kodunu ve diğer oturumları kapatır, yeni kurtarma anahtarı verir. Önceki kurtarma anahtarı geçersiz olur."}
          </p>
          {mode !== "sessions" && (
            <Input
              label={hasPassword ? "Mevcut parola" : "Mevcut erişim kodu"}
              type="password"
              autoComplete="current-password"
              value={hasPassword ? currentPassword : currentCode}
              onChange={hasPassword ? setCurrent : setCurrentCode}
              minLength={hasPassword ? 12 : 32}
              maxLength="128"
              required
            />
          )}
          {mode === "password" && (
            <>
              <Input
                label="Yeni parola"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={setPassword}
                minLength="12"
                maxLength="128"
                required
              />
              <Input
                label="Yeni parola tekrar"
                type="password"
                autoComplete="new-password"
                value={again}
                onChange={setAgain}
                minLength="12"
                maxLength="128"
                required
              />
            </>
          )}
          <div className="button-row">
            <button
              className="secondary-button"
              type="button"
              disabled={busy}
              onClick={() => choose("")}
            >
              Vazgeç
            </button>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? "Kaydediliyor…" : "Değişikliği uygula"}
            </button>
          </div>
        </form>
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
    </section>
  );
}
