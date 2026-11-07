# evim v3.2 — ev kontrolü, klima, enerji ve kişisel erişim kodu

Yayın: https://home.cemgocen.com · Yedek adres: https://evim-control.vercel.app · Güncelleme: 1 Kasım 2026.
Vercel projesi: evim-control.

## Başlangıç

1. **Hesap & ayarlar → Giriş yap → Kodla giriş** bölümünde kullanıcı adı ve kişisel erişim kodunu kullan. Parolayla giriş ve yeni hesap oluşturma da desteklenir. Aynı hesap telefon ve bilgisayarda aynı ev düzenini kullanır. İlk girişte gösterilen kurtarma anahtarını sakla; e-posta ile parola sıfırlama yoktur.
2. **Entegrasyonlar** bölümünde Home Assistant'ın erişilebilir HTTPS adresine bağlan. Kimlik doğrulama Home Assistant'ın kendi ekranında yapılır.
3. Cihazları önce Home Assistant'a tanıt. Sonra **Cihazları keşfet** ile seçip evim'e aktar. Home Assistant oda kayıtları kullanılabilir; odasız cihazlara varsayılan oda atanabilir. Yeniden keşif aynı varlığı ikinci kez eklemez.
4. **Enerji → Kaynaklar & tarife** bölümünde ana enerji sayacını, anlık güç sensörünü, alt sayaçları ve kendi birim fiyatını seç.
5. **Senaryolar** üzerinden adımları birleştir; **Programlar** üzerinden tetikleyici ve koşul ekle. Kesintisiz çalışma için her programı **Sunucuya aktar** ile Home Assistant'a kaydet.

Fiziksel cihaz bağlantısı yapılıncaya kadar başlangıç görünümü açıkça etiketlenmiş demodur. Bu geliştirmede gerçek sayaç, vana veya lamba üzerinde komut testi yapılmadı. Zigbee koordinatörü, enerji ölçen donanım ve güvenli Home Assistant erişimi kullanıcı kurulumuna bağlıdır. Site bir Zigbee/Wi-Fi ağ geçidinin yerini almaz.

## Enerji merkezi

- Anlık güç W olarak gösterilir; kW/MW dönüşümü yapılır.
- Bugün, son 7 takvim günü ve bu ay için kayıtlı kWh, grafik, erişilebilir tablo ve CSV raporu.
- Ana sayaç evin toplamıdır. Alt sayaçlar ayrı karşılaştırılır; toplamın üzerine yeniden eklenmez.
- Kullanıcının birim fiyatıyla tahmini maliyet ve isteğe bağlı aylık kWh hedefi.
- Fiyat girilmediyse maliyet bilinmiyor olarak gösterilir. Eksik istatistik sıfır tüketim sayılmaz; negatif değerler ayrıca işaretlenir.
- Tarih aralıkları Home Assistant'ın saat dilimini kullanır. Kayıtlar görünür ekranda beş dakikada bir veya elle yenilenir.
- Sıfırlamaları düzeltilmiş Recorder “change” istatistikleri kWh biriminde istenir. Anlık güçten geçmiş tüketim üretilmez. Kayıt oluşması zaman alabilir; Recorder kapsamı, sensör sınıfı ve geçmiş saklama ayarları Home Assistant'ta yönetilir.

Enerji kaynağı Wh/kWh/MWh/GWh birimli birikimli tüketim sayacı olmalıdır. Yalnız W veren bir sensör için Home Assistant tarafında uygun enerji hesabı/Integration yardımcısı gerekir. “total” / “total_increasing” ve kayıt istatistikleri kontrol edilmelidir. Maliyet tüketim × girilen birim bedeldir; sabit ücret, kademeli tarife veya vergi hesabı değildir. Elektrik, gaz ve su birimleri karıştırılmaz. Mevcut SONOFF termostatik vanaların sıcaklık veya çalışma süresi verileri elektrik/doğalgaz tüketimi sayılmaz.

## Cihazlar ve düzenleme

Oda, cihaz, lamba, mod, senaryo ve programlar eklenebilir, düzenlenebilir, kopyalanabilir, sıralanabilir, silinebilir ve Silinenler'den geri alınabilir. Favoriler, arama ve oda/tür filtreleri bulunur. Fiziksel cihaz silinmez; odası silinen cihaz atanmamış olarak korunur. Silinen hedeflere ait senaryo adımları kaldırılır ve hedefsiz programlar duraklatılır. Geri yükleme sonrası ilişkiler tekrar seçilmelidir.

| Home Assistant alanı | evim kontrolü |
| --- | --- |
| climate | Ayrı klima / termostat kontrolü, odaya bağlı vana hedefleri; desteklenen mod, fan, dikey/yatay kanat ve hazır ayarlar |
| light | Aç/kapat, desteklenen parlaklık, renk ve beyaz tonu |
| sensor, binary_sensor | Ölçüm/durum gösterimi |
| switch, input_boolean | Aç/kapat |
| fan | Aç/kapat ve destekleniyorsa hız |
| cover | Desteklenen aç/kapat/durdur/konum |
| media_player | Desteklenen oynat/duraklat/durdur/ses |
| scene, script, button | Çalıştır/bas |
| number, input_number | Cihaz sınır ve adımı içinde değer |
| select, input_select | Sunucunun sunduğu seçenekler |

Desteklenmeyen işlevler Home Assistant'ın kendi arayüzünde yönetilir. Wi-Fi bağlantısı veya marka tek başına uyumluluk garantisi değildir. Gree, ZHA, MQTT/Zigbee2MQTT, Shelly, Tapo/Kasa, Matter, Tuya, Xiaomi ve ESPHome için resmi rehber bağlantıları vardır; tam cihaz modeli ayrıca kontrol edilmelidir.

### Gree+ klima

Gree+ uyumlu klimayı önce kendi uygulamasıyla ev Wi-Fi ağına bağla. Home Assistant'ta **Ayarlar → Cihazlar ve hizmetler → Entegrasyon ekle → Gree Climate** yolunu kullan; Home Assistant cihazın yerel ağına erişebilmelidir. Ardından evim'de **Entegrasyonlar → Cihazları keşfet** üzerinden climate varlığını seçip **Yatak odası**na ata. Gree klimanın bu bağlantısı için Zigbee köprüsü gerekmez. Bu sürümde gerçek klima bağlantısı ve donanım testi yapılmadı.

Keşif soğutma modlarını ve Gree entegrasyonunu bağımsız klima olarak tanır. Manuel eklemede kullanım türü seçilebilir. Bağımsız klima evin **Evde / Gece / Dışarıda** petek modlarından ve oda sıcaklığı komutlarından etkilenmez. Eski veya yanlış sınıflanmış bir varlık soğutma yeteneği bildiriyorsa canlı petek komutlarının dışında tutulur. Yalnız klima olan odalar petek modunu engellemez. Mevcut beş SONOFF vana eski kayıtlar taşınırken oda ısıtması grubunda korunur.

**Cihazlar** kartında aç/kapat, manuel/±/kaydırıcıyla sıcaklık, çalışma modu ve açılır fan/kanat/hazır ayar kontrolleri bulunur. Sadece varlığın sunduğu seçenek ve yetenekler kullanılır; eski/yeni Gree kanat isimleri sabit kodlanmaz. Hedef yerel cihaz birimi ve adımıyla gösterilir; senaryolarda °C seçilir ve gerekirse °F'ye çevrilir. Alt/üst sınır ve adım gönderimden önce kontrol edilir. Tek sıcaklık yerine sıcaklık aralığı isteyen cihazlarda tek hedef komutu gösterilmez. Hazır ayarlar başka ayarları değiştirebilir; Gree'nin “Dışarıda” hazır ayarı 8°C koruma ısıtmasıdır.

Klima işlemleri senaryo adımlarına eklenip mevcut program sistemiyle zamanlanabilir. Kaydetmek fiziksel bağlantı kurmaz; kesintisiz zamanlama için programı Home Assistant'a aktarmak gerekir. Wi-Fi bağlantısı enerji ölçümü anlamına gelmez. Tüketim takibi için gerçek bir enerji sensörü/sayacı gerekir; tahmini klima kWh verisi üretilmez.

Sıcaklık kadranla, ±0,5°C veya elle girilerek seçilir ve **Uygula** ile gönderilir. Virgül/nokta, klavye okları, Home/End, Enter ve Escape desteklenir. Oda sınırları korunur. Harici sıcaklık sensörünün °F/K ölçümleri °C'ye çevrilir; Fahrenheit kullanan sunucuya hedef onun biriminde gönderilir. Sıcaklık dışındaki sensörler oda termometresi olarak seçilemez.

Demo geçici hedefleri seçilen süre sonunda geri alınır. Canlı hedef cihazda kalıcıdır; süreli geri dönüşün sunucuda otomatik oluşturulması bu sürümün kapsamında değildir. Bağlantısız cihazlara komut gönderilmez; sonradan çalışmak üzere komut kuyruğu tutulmaz.

## Senaryolar ve programların gerçek çalışması

Senaryolar lamba, oda hedefi, ev modu, cihaz işlemi ve bildirim adımlarını birleştirir. Bildirim için Home Assistant'taki uygun notify hizmeti veya persistent_notification.create seçilir. Telefona bildirim, Home Assistant Companion uygulamasının ilgili kanalını gerektirir; evim kendi başına SMS/e-posta/push göndermez.

Program tetikleyicileri: belirli saat, gün doğumu/batımı ve dakika farkı, varlık durumu, sayısal ölçüm eşiği. Haftanın günleri, eşikte/durumda bekleme süresi ve en fazla sekiz ek durum koşulu seçilebilir. Koşulların hepsi sağlanmalıdır. Eşik sensörün bildirdiği birimdedir; bekleme süresi sunucu yeniden başlarsa sıfırlanabilir. Demo zamanlayıcısı yalnızca sekme açıkken, saatli ve ek koşulsuz programları yürütür.

**Kaydet** ev düzenini saklar. **Sunucuya aktar** programı Home Assistant'ın otomasyon yapılandırmasına yazar, etkinliğini ayarlar ve sonucu yeniden okuyarak doğrular. Sonradan düzenlenen program, mod, senaryo veya ilgili cihaz ayarları için yeniden aktarım gerekir; bekleyen değişiklikler işaretlenir.

Aktarım HTTPS bağlantısı ve Home Assistant yönetici yetkisi gerektirir. Önizlemede bütün eylemlerin cihaz eşlemesi, erişilebilirliği ve desteklenen işlemleri denetlenir. Yalnız bu ev/program için oluşturulan evim kaydı güncellenir. Önceki yapılandırma YAML dosyası olarak yedeklenir; arada başka değişiklik saptanırsa işlem durur. JSON biçimindeki dışa aktarım geçerli YAML 1.2'dir. Home Assistant API'si bu yapılandırma yazması için atomik sürüm kilidi sunmadığından, eşzamanlı başka düzenleyicilerle aynı otomasyonu değiştirmemek gerekir.

**Sunucuda duraklat** otomasyonu şimdi ve yeniden başlatma sonrasında kapalı tutar. Yerel programı silmek, taslaktaki etkinlik anahtarını kapatmak, yedek yüklemek veya ev düzenini sıfırlamak aktarılmış otomasyonu kendiliğinden durdurmaz. Önce ilgili programı sunucuda duraklat. Daha önce hazırlanmış 07.00/23.00 kuralları ve diğer Home Assistant otomasyonları bağımsızdır. **Eylemleri dene** tetikleyici/koşulları beklemeden çalıştırır ve canlı modda açıkça onay ister.

Birden fazla fiziksel komut atomik değildir. Ön kontrol hatasında hiçbir komut gönderilmez. Gönderim ortasında hata olursa kabul edilen komut sayısı ve durdurulan kalan işlem bildirilir. Zaman aşımı başarı sayılmaz; tekrar denemeden önce durum kontrol edilir.

## Eşitleme, güvenlik ve yedekler

Kişisel erişim kodu 128 bit rastgele üretilir; büyük/küçük harf, tire ve boşluk farkları kabul edilir. 90 gün geçerlidir, kullanıcı adıyla birlikte kullanılır ve sunucuda yalnız SHA-256 özeti tutulur. Kod hesaba tam erişim verir; davet/rol sistemi değildir. Giriş denemeleri parola girişiyle ortak IP ve kullanıcı sınırlarını kullanır. Kod, Home Assistant kimlik doğrulamasının yerini almaz.

**Hesap güvenliği** üzerinden kod üretilebilir, yenilenebilir veya parola mevcutsa kaldırılabilir. İşlem mevcut parola ya da yalnız kodla açılan hesaplarda mevcut kodla doğrulanır. Yenileme eski kodu ve eski oturumları iptal eder. Parola/kurtarma anahtarı değişikliği veya hesap kurtarma da kodu iptal eder. Yalnız kod kullanan kullanıcı önce parola ekleyebilir. Yeni kod bir kez gösterilir; kopyalama/indirme kullanıcının seçimine bağlıdır. Kodlar yedeğe, tarayıcı depolamasına, URL'ye veya herkese açık istemci dosyalarına yazılmaz.

Yönetici için `scripts/account-access.mjs` yalnız yerel CLI'dır ve Vercel yüklemelerinden dışlanır. Üretim ortamı Vercel CLI tarafından işlem belleğine alınır. `list` yalnız kullanıcı adlarını/tarihlerini okur; `create` mevcut hesabı ezmez, `renew` olmayan hesabı oluşturmaz. Oluşan erişim belgesi yayımlanan proje dışına yazılır. Yeni hesabın kurtarma anahtarı ilk başarılı girişte üretilir. Önceki sitede misafir olarak yapılan düzenlemeler eski adreste hesaba girişle buluta kaydedilip yeni adreste aynı hesapla alınabilir; alan adları arasında tarayıcı depolaması kendiliğinden taşınmaz.

Misafir düzeni tarayıcıda kalır. Kişisel hesap düzeni mevcut private Vercel Blob deposunda saklanır. Kaydetme yaklaşık 900 ms gecikmeli yapılır; diğer cihazlar görünür ekranda yaklaşık 30 saniyede, odaklanınca veya elle yenilenince değişiklikleri alır. Açık düzenleyici ve diyaloglar sırasında otomatik yenileme duraklar. Ağ hatalarında aralığı artan yeniden deneme yapılır. Yerel taslak korunur; ETag çakışması sessizce başka cihazın verisini ezmez. Bulut sürümünü almak önce yerel taslağı yedekler.

Hesap güvenliği ekranında parola değişikliği, kurtarma anahtarını yenileme ve diğer oturumları kapatma bulunur. Parola/anahtar değişikliği mevcut parolayı doğrular ve eski oturumları iptal eder. Parolalar ayrı salt ile scrypt özetidir; kurtarma anahtarı da özetlenir. Cookie HttpOnly/Secure/SameSite=Strict'tir; isteklerin kökeni, hesap kimliği ve sunucu oturumu doğrulanır. Kimlik doğrulama denemeleri sınırlandırılır. Kimlik bilgileri uygulama yedeklerine girmez.

Home Assistant belirteci yalnız mevcut tarayıcı sekmesi oturumunda tutulur; bulut ev düzenine gönderilmez. EVIM_AUTH_SECRET ve Blob sırları yalnız sunucu ortamındadır. .env dosyaları ve .vercel klasörü yayıma/kaynak arşivine eklenmez. Mevcut private deponun/hosting planının kullanım kotaları geçerlidir; ücretli plan değişikliği yapılmadı.

v1/v2/v3 kayıtlar veri şeması v4'e taşınır; tarayıcı depolama anahtarı korunur. Klima kullanım türünün ve yeni alanların eski istemci tarafından silinmesini önlemek için v2/v3 verisiyle yazma reddedilir ve sayfa yenilemesi istenir. JSON yedekleri odalar, cihazlar, enerji ayarları, programlar ve silinenleri taşır. Koleksiyon başına 250 kayıt, senaryo başına 100 adım, 500 KB yedek ve son 100 silinen kayıt sınırı vardır.

## Telefon, çevrimdışı durum ve yardım

Alt menüde enerjiye doğrudan erişim, geniş dokunma alanları ve küçük ekranlara uyarlanan formlar vardır. Destekleyen tarayıcıda yükleme düğmesi; diğerlerinde ana ekrana ekleme yönergesi sunulur. Yeni sürüm hazır olduğunda kullanıcı güncellemeyi seçer.

Service worker yalnız uygulamanın herkese açık HTML/CSS/JS/simge dosyalarını saklar. API cevaplarını, oturum dönüşlerini veya Home Assistant verilerini önbelleğe almaz; fiziksel komutları daha sonra tekrar oynatmaz. İlk çevrimiçi yüklemeden sonra uygulama kabuğu çevrimdışı açılabilir. Bulut hesabının çevrimdışı yeniden doğrulanması ve gerçek uzaktan kontrol yoktur. Açık oturumda yerel değişiklikler bağlantı gelene kadar bekleyebilir; durum üst bantta gösterilir.

**Sistem durumu** eksik eşleştirmeleri, erişilemeyen cihazları, bilinen düşük pili, enerji istatistik sorunlarını ve aktarılmayı bekleyen programları listeler. Tanı raporu parola, belirteç ve konum koordinatı içermez. **Yardım** kurulumu, markalar arası bağlantıyı, enerji ve telefon kullanımını açıklar.

## Çalıştırma ve alan adına taşıma

Geliştirme sırası: npm ci → npm test → npm run dev.
Üretim derlemesi: npm run build.
Yayın: vercel deploy --prod (klasör `vercel link` ile projeye bağlıyken).

Node 22.12 veya üstü gerekir. Vite yerelde istemciyi sunar; bulut API Vercel'de çalışır. tests/feature-ui.html ve tests/climate-ui.html yalnız yerel, sentetik Home Assistant verili UI testleridir; tests/ klasörü Vercel yüklemesine dahil edilmez. Üretim derlemesi dist/sw.js uygulama kabuğunu da üretir.

Alan adını aynı Vercel projesine ekleyip DNS kayıtlarını uygulamak yeterlidir; sunucu deposu aynı kalır. Yeni adreste hesaba/Home Assistant'a yeniden giriş ve gerekirse Home Assistant CORS kökenini güncelleme gerekir. Yerel HTTP adresi HTTPS Vercel sayfasından kullanılamaz; erişilebilir, geçerli HTTPS adresi gerekir.

## Doğrulama ve kaynaklar

62 otomatik test: eski kayıtları taşıma, CRUD ve ilişkiler, enerji birimleri/tarih aralıkları/yaz saati, eksik ve sıfır tüketim ayrımı, CSV güvenliği, cihaz yetenekleri, bildirim ön kontrolü, program derleme/aktarım/duraklatma/çakışma/kısmi hata, hesap yalıtımı, parola/anahtar/oturum yenileme, eski istemci reddi, sıcaklık kontrolü ve çevrimdışı önbellek sınırları. Klima testleri ayrıca keşif sınıflaması, peteklerden ayrım, yanlış eski sınıflama, gerçek seçenek/yetenek doğrulaması, °C/°F dönüşümü, sınır/adım kontrolü, senaryo derleme ve demo ayarlarının korunmasını kapsar.

Yerel tarayıcı doğrulaması: tarife/maliyet/aylık hedef ve yenileme sonrası kayıt, 320/390 px enerji grafiği/tablosu, mobil menü, priz aç/kapat ve favori, taslak uyarısı, sayısal program+koşul, bağlantısız aktarım engeli, cihaz+bildirim senaryosu. Sentetik sunucu verisiyle 10 kWh ana + 3 kWh alt sayaçta ana toplamın 10 kalması ve dört cihazın odasıyla tek seferde keşfi doğrulandı. Klima için 320/390 px düzen, cihaz ekleme, soğutma modu, elle ve düğmeyle hedef, fan, iki kanat yönü, uyku ayarı, kapatma, bağlantısız kontrol engeli, iki adımlı senaryo ve yenileme sonrası kayıt doğrulandı. Fiziksel cihaz ve kullanıcı hesabıyla uçtan uca canlı deneme yapılmadı.

- [Home Assistant enerji yönetimi](https://www.home-assistant.io/docs/energy/)
- [Home Assistant Gree Climate](https://www.home-assistant.io/integrations/gree/)
- [Climate işlemleri](https://www.home-assistant.io/integrations/climate/)
- [Sensör sınıfları ve istatistikler](https://www.home-assistant.io/integrations/sensor/)
- [Recorder istatistik istemcisi](https://github.com/home-assistant/frontend/blob/dev/src/data/recorder.ts)
- [Otomasyon yapılandırma istemcisi](https://github.com/home-assistant/frontend/blob/dev/src/data/automation.ts)
- [Otomasyon tetikleyicileri](https://www.home-assistant.io/docs/automation/trigger/)
- [HTTP ve CORS](https://www.home-assistant.io/integrations/http/)

