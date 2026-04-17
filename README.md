# Discord Selfbot Yönetim Sistemi

Bu proje, birden fazla Discord hesabı üzerinde otomatik işlemler gerçekleştirmek ve bu işlemleri merkezi bir kontrol botu (Notifier) üzerinden yönetmek için tasarlanmış bir altyapıdır.

## Özellikler

- Çoklu Hesap Desteği: Her token için ayrı bir worker süreci başlatılarak yük dengelemesi ve izolasyon sağlanır.
- Merkezi Kontrol: İşlemler, standart bir Discord botu üzerinden slash komutları ile yönetilebilir.
- Otomatik Farm Sistemi: Belirlenen kanallarda geçici veya kalıcı farm işlemleri yapılabilir.
- Captcha Bildirimi: Selfbot hesaplarında captcha tespiti yapıldığında kontrol botu üzerinden DM yoluyla bildirim gönderilir.
- Kanal İzleme: Belirlenen kanallardaki mesajlar takip edilerek kritik durumlarda uyarı mekanizması çalıştırılır.

## Mimari Yapı

Sistem iki temel bileşenden oluşur:

1. **Notifier (Kontrol Paneli):** Standart bir Discord botudur. Kullanıcıdan gelen komutları alır, worker süreçlerine iletir ve sistem durumunu raporlar.
2. **Worker (Selfbot):** Her bir kullanıcı tokeni için oluşturulan alt süreçlerdir. Gerçek zamanlı işlemleri (farm, izleme vb.) bu süreçler yürütür.

## Kurulum

Projenin çalışması için sisteminizde Node.js 18 veya üzeri bir sürümün yüklü olması gerekmektedir.

1. Depoyu yerel makinenize indirin.
2. Gerekli bağımlılıkları yükleyin:
   ```bash
   npm install
   ```
3. `.env` dosyasını oluşturun ve gerekli alanları doldurun (aşağıdaki konfigürasyon bölümüne bakınız).
4. Uygulamayi baslatin:
   ```bash
   npm start
   ```

## Konfigürasyon

Proje kök dizininde bulunan `.env` dosyası üzerinden yapılandırılır. Aşağıdaki parametrelerin tanımlanması zorunludur:

- `DISCORD_BOT_TOKEN`: Kontrol panelini yönetecek olan ana botun tokeni.
- `TOKENS`: İşlemleri yapacak selfbot hesaplarının tokenları (virgülle ayrılmış).
- `CHANNEL_IDS`: Varsayilan farm kanallari.
- `OWO_PREFIX`: Kullanılacak komut ön eki (Örneğin: Owo).

## Komutlar

Kontrol botu üzerinden aşağıdaki slash komutları kullanılabilir:

- `/selfbot farm`: Farm kontrol panelini açar.
- `/channels add/clear`: Kalıcı kanal listesini yönetir.
- `/setch set/default`: Geçici kanal listesi ayarlarını yapar.
- `!sil`: DM kanalındaki bot mesajlarını temizlemek için kullanılır.

## Güvenlik ve Uyarı

Bu yazılım sadece eğitim ve kişisel kullanım amaçlıdır. Discord Terim ve Koşulları'na (ToS) aykırı kullanımlardan doğabilecek hesap kapatılma gibi sorumluluklar tamamen kullanıcıya aittir.

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için `LICENSE` dosyasına bakabilirsiniz.
