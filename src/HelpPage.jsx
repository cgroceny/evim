import React from "react";
import {
  Wifi,
  Cloud,
  Radio,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Download,
  ArrowRight,
  Smartphone,
  PlugZap,
} from "lucide-react";
import { healthIssues } from "./health.js";
import { download } from "./components.jsx";
export function HealthPage({
  state,
  entities,
  connected,
  user,
  online,
  syncError,
  onEdit,
  navigate,
}) {
  const issues = healthIssues(state, entities, connected);
  return (
    <>
      <header className="feature-heading">
        <div>
          <p className="eyebrow">EVİNİN DURUMU</p>
          <h1>Her şey yolunda mı?</h1>
          <p>Bağlantılar, pil seviyeleri ve tamamlanacak adımlar.</p>
        </div>
        <button
          className="secondary-button"
          onClick={() =>
            download(
              "evim-durum-raporu.json",
              JSON.stringify(
                {
                  date: new Date().toISOString(),
                  online,
                  connected,
                  cloud: !!user,
                  issues: issues.map(({ title, message, level }) => ({
                    title,
                    message,
                    level,
                  })),
                },
                null,
                2,
              ),
            )
          }
        >
          <Download size={17} />
          Durum raporu
        </button>
      </header>
      <div className="status-grid">
        {[
          [Wifi, "İnternet", online ? "Bağlı" : "Çevrimdışı"],
          [PlugZap, "Ev sunucusu", connected ? "Bağlı" : "Bağlantı bekliyor"],
          [
            Cloud,
            "Hesap",
            user
              ? syncError
                ? "Eşitleme dikkat istiyor"
                : "Hesap açık"
              : "Misafir düzeni",
          ],
        ].map(([Icon, title, value]) => (
          <article className="feature-panel" key={title}>
            <Icon size={23} />
            <h3>{title}</h3>
            <p>{value}</p>
          </article>
        ))}
      </div>
      <section className="feature-panel">
        <div className="panel-heading">
          <h2>
            {issues.length
              ? "Tamamlanacak " + issues.length + " konu"
              : "Kontroller tamam"}
          </h2>
          <ShieldCheck size={23} />
        </div>
        {!issues.length ? (
          <p className="success-note">
            Kayıtlı cihazlar ve programlarda eksik bulunmadı.
            {!connected
              ? " Canlı cihaz durumu bağlantı kurulduğunda kontrol edilir."
              : ""}
          </p>
        ) : (
          <div className="health-list">
            {issues.map((i) => (
              <div key={i.id}>
                {i.level === "warning" ? (
                  <AlertCircle size={21} />
                ) : (
                  <Radio size={21} />
                )}
                <span>
                  <strong>{i.title}</strong>
                  <p>{i.message}</p>
                </span>
                <button
                  className="text-button"
                  onClick={() =>
                    i.record ? onEdit(i.kind, i.record) : navigate(i.page)
                  }
                >
                  İncele
                  <ArrowRight size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
export function InstallCard({ onInstall, installable }) {
  return (
    <section className="feature-panel install-card">
      <Smartphone size={28} />
      <div>
        <h3>Telefonunda bir uygulama gibi</h3>
        <p>
          {installable
            ? "evim’i ana ekranına ekleyebilirsin."
            : "iPhone: Safari → Paylaş → Ana Ekrana Ekle. Android: tarayıcı menüsü → Uygulamayı yükle / Ana ekrana ekle."}
        </p>
      </div>
      {installable && (
        <button className="primary-button" onClick={onInstall}>
          Uygulamayı yükle
        </button>
      )}
    </section>
  );
}
export default function HelpPage({
  navigate,
  onConnect,
  onInstall,
  installable,
}) {
  const guides = [
    [
      "Nereden başlamalıyım?",
      "Önce hesabınla giriş yap. Ev sunucunun HTTPS adresiyle bağlan, Entegrasyonlar bölümünde cihazlarını seçerek içe aktar. Oda eşlemesini ve Enerji kaynaklarını tamamla.",
      "integrations",
    ],
    [
      "Her Wi-Fi cihazını ekleyebilir miyim?",
      "Bağlantı türü tek başına yeterli değildir. Tam marka/model için bir Home Assistant entegrasyonu gerekir. Desteklenen cihazın varlıkları evim’de keşfedilir. Özel işlevler Home Assistant üzerinden kullanılabilir.",
      "integrations",
    ],
    [
      "Enerji ve güç arasındaki fark nedir?",
      "W o andaki gücü, kWh zaman içindeki tüketimi gösterir. Güç ölçen her priz kWh sayacı sağlamaz. Gerekirse Home Assistant’ta İntegral yardımcısı oluştur. Vanalar elektrik veya doğalgaz sayacı yerine geçmez.",
      "energy",
    ],
    [
      "Programlar ben sayfayı kapatınca çalışır mı?",
      "Home Assistant’a aktardığın programlar ev sunucusunda çalışır. Programı düzenledikten sonra yeniden aktar. Yalnız demo zamanlayıcısı bu sekme açıkken çalışır; sensör ve güneş tetikleyicileri Home Assistant gerektirir.",
      "programs",
    ],
    [
      "Bildirim nasıl eklerim?",
      "Home Assistant mobil uygulamasını telefonuna kurup sunucuna bağla. Senaryoya Bildirim adımı ekle ve notify.mobile_app… kanalını seç. Ev sunucusunda bildirim için persistent_notification.create kullanılabilir.",
      "scenes",
    ],
    [
      "İnternet kesilirse ne olur?",
      "evim bulut eşitlemesini ve uzaktan kontrolü bekletir; fiziksel komutları sonradan kendiliğinden tekrarlamaz. Ev sunucusuna aktarılmış yerel otomasyonlar, donanım ve entegrasyonları erişilebilir kaldığı sürece sunucuda çalışır.",
      "health",
    ],
    [
      "Başka bilgisayara veya alan adına nasıl taşınırım?",
      "Aynı hesapla giriş yaparak ev düzenini al. Yedeğini ayrıca indir. Home Assistant oturumu her cihazda ayrı açılır. Yeni alan adına geçtiğinde Home Assistant’ın izin verdiği site adresini güncelle.",
      "settings",
    ],
    [
      "Raspberry Pi’yi ev sunucusuna nasıl dönüştürürüm?",
      "Pi 4 için Raspberry Pi Imager ile “Home Assistant OS” kur; mümkünse SD kart yerine USB SSD kullan ve resmi 5 V 3 A adaptör tak. Pi’yi modeme kabloyla bağla, tarayıcıda homeassistant.local:8123 adresini aç. Zigbee alıcıyı kısa bir USB uzatmayla, Pi’den ve USB 3 portlarından uzağa tak. Bu siteden bağlanmak için Home Assistant Cloud ya da Cloudflare Tunnel ile HTTPS adres ve izinli site (CORS) olarak https://home.cemgocen.com gerekir.",
      "integrations",
    ],
    [
      "Gree klimanın bütün ayarları nerede?",
      "Cihazlar ekranında klima kartında: hedef sıcaklık (1° adım), mod, fan, dikey ve yatay kanat, hazır ayarlar (Ekonomi, Turbo, Uyku, 8°C koruma) ve Cihaz özellikleri bölümünde panel ışığı, sessiz mod, X-Fan, taze hava. Bu anahtarlar Home Assistant’tan geldiği için önce sunucuya bağlanıp Entegrasyonlar’da bağlantı bilgilerini yenile.",
      "devices",
    ],
    [
      "SONOFF vana odanın sıcaklığını yanlış ölçüyor",
      "Vana peteğin dibinde olduğu için odadan sıcak ölçer. Vanayı Zigbee2MQTT ile ekleyip Cihaz özellikleri’nden Sıcaklık kaynağını Harici sensör yap. Oda sensörünün değerini vanaya düzenli yazan bir Home Assistant otomasyonu gerekir (number.…_external_temperature_input). Alternatif: Sıcaklık düzeltmesi ile ölçümü kaydır.",
      "devices",
    ],
    [
      "Yerel sunucum neden bağlanmıyor?",
      "HTTPS Vercel sayfası HTTP yerel sunucuya bağlanamaz. Home Assistant Cloud veya kendi güvenli HTTPS erişimin kullanılabilir. Bağlantıda izinli site adresi (CORS) gerekebilir. Parolanı yalnız Home Assistant’ın kendi ekranına yaz.",
      "integrations",
    ],
  ];
  return (
    <>
      <header className="feature-heading">
        <div>
          <p className="eyebrow">KONTROL SENDE</p>
          <h1>Biraz rehber, çok kolaylık.</h1>
          <p>Kurulumdan günlük kullanıma, ihtiyaç duyduğun kısa cevaplar.</p>
        </div>
      </header>
      <InstallCard onInstall={onInstall} installable={installable} />
      <div className="help-grid">
        {guides.map(([title, text, page]) => (
          <details className="feature-panel help-details" key={title}>
            <summary>{title}</summary>
            <p>{text}</p>
            <button className="text-button" onClick={() => navigate(page)}>
              İlgili ekranı aç
              <ArrowRight size={16} />
            </button>
          </details>
        ))}
      </div>
      <section className="feature-panel">
        <h2>İlk bağlantı için</h2>
        <p className="modal-copy">
          Home Assistant sunucun, Zigbee vanalar için bir koordinatör ve enerji
          ölçümü için uygun sensör gerekir. Uygulama bu donanımların yerini
          almaz; hepsini aynı ekrandan yönetmeni sağlar.
        </p>
        <button className="primary-button" onClick={onConnect}>
          Ev sunucuma bağlan
        </button>
      </section>
    </>
  );
}
