// Local synthetic UI fixture; never deployed. Backend behavior is tested in access.test.js.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import Auth from "../src/Auth.jsx";
import AccountSecurity from "../src/AccountSecurity.jsx";
import "../src/styles.css";
import "../src/crud.css";
import "../src/features.css";
import "../src/temperature.css";
const originalFetch = window.fetch;
const testCode = "EVIM-1234-5678-90AB-CDEF-1234-5678-90AB-CDEF";
const user = { id: "synthetic", username: "test_owner", hasPassword: false, accessCodeExpiresAt: Date.now() + 90 * 86400000 };
window.fetch = async (url, options) => {
  if (typeof url !== "string" || !url.startsWith("/api/cloud?")) return originalFetch(url, options);
  const body = JSON.parse(options.body || "{}");
  const ok = body.accessCode === testCode || body.currentCode === testCode;
  return new Response(JSON.stringify(ok ? { user, ...(body.mode === "access-create" ? { accessCode: testCode } : {}) } : { error: "Test kodu geçersiz." }), { status: ok ? 200 : 401, headers: { "content-type": "application/json" } });
};
function Fixture() {
  const [auth, setAuth] = useState(true), [status, setStatus] = useState("");
  return <main style={{ padding: 20, maxWidth: 800, margin: "auto" }}>
    <p>YALNIZ YEREL TEST · Gerçek hesap veya cihaz bağlantısı yok.</p>
    <button className="secondary-button" onClick={() => setAuth(true)}>Giriş ekranını aç</button>
    <p role="status">{status}</p>
    <AccountSecurity user={user} onUpdated={() => setStatus("Güvenlik ekranı test güncellemesi tamamlandı.")} />
    {auth && <Auth onClose={() => setAuth(false)} onAuth={r => { setStatus("Test hesabına giriş: " + r.user.username); setAuth(false); }} />}
  </main>;
}
createRoot(document.getElementById("root")).render(<Fixture />);
