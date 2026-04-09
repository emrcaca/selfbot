# 🤖 Discord Automation Suite (Selfbot)

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg) ![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-green.svg) ![License](https://img.shields.io/badge/license-MIT-orange.svg)

Profesyonel düzeyde geliştirilmiş, çoklu hesap destekli ve güvenlik odaklı Discord otomasyon aracı. **OWO**, **WHWB** ve diğer komut döngülerini doğal insan davranışlarını taklit ederek yönetir.

---

## 🔥 Temel Özellikler

- **🌌 Multi-Account Desteği**: Sınırsız sayıda hesabı aynı anda, izole süreçlerde (worker threads) yönetin.
- **🛡️ Gelişmiş Güvenlik**:
  - **CAPTCHA Algılama**: CAPTCHA tespit edildiğinde botu anında durdurur.
  - **DM Bildirimleri**: Tespit durumunda ana hesabınıza (Notifier Bot aracılığıyla) detaylı bilgi verir.
  - **Telegram Entegrasyonu**: Kritik durumları Telegram üzerinden cebinize bildirir.
- **🌾 Akıllı Farming**:
  - Rastgele gecikmeler (Random Delays) ile doğal davranış.
  - Kanal döngüsü (Channel Cycling) ile sürekli aynı kanalda spam yapmaz.
  - `typing` indikatorü simülasyonu.
- **💬 Etkileşimli Kontrol**:
  - Bot DM'sinden `!sil` komutu ile geçmiş bildirimleri temizleme.
  - `setch` komutu ile kanal listelerini dinamik yönetme.
- **📊 Merkezi Loglama**: `ENABLE_CONSOLE_LOG=true` ile detaylı işlem takibi.

---

## ⚠️ Yasal Uyarı (Disclaimer)

**Bu yazılım sadece eğitim ve test amaçlıdır.** Discord API Terms of Service (ToS), "selfbot" (kullanıcı hesabı otomasyonu) kullanımını yasaklar. Bu yazılımı kullanmak hesabınızın yasaklanmasına (ban) neden olabilir. Sorumluluk tamamen kullanıcıya aittir.

---

## 🚀 Kurulum

### 1. Gereksinimler

- [Node.js](https://nodejs.org/) (v16.11.0 veya üzeri)
- Bir Discord Bot Tokeni (Notifier olarak kullanılacak, [Discord Developer Portal](https://discord.com/developers/applications)'dan alınabilir)

### 2. İndirme ve Hazırlık

Projeyi bilgisayarınıza indirin ve gerekli paketleri yükleyin:

```bash
git clone https://github.com/kullaniciadi/selfbot-main.git
cd selfbot-main
npm install
```

### 3. Konfigürasyon (.env)

Proje ana dizininde `.env` dosyası oluşturun ve aşağıdaki şablonu kullanın:

```env
# Hesap Tokenları (Virgülle ayrılmış)
TOKENS="TOKEN_1,TOKEN_2,TOKEN_3"

# Notifier Bot (Bildirimleri yapacak bot)
DISCORD_BOT_TOKEN="BOT_TOKENINIZ"

# Farming Yapılacak Kanal ID'leri
CHANNEL_IDS="KANAL_ID_1,KANAL_ID_2"

# OWO Bot ID (Varsayılan: 408785106942164992)
OWO_ID="408785106942164992"

# Telegram Entegrasyonu (Opsiyonel)
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""

# Detaylı Loglama (true/false)
ENABLE_CONSOLE_LOG=true
```

## 🎮 Kullanım

Botu başlatmak için terminalde şu komutu çalıştırın:

```bash
npm start
```

Veya geliştirme modunda (dosya değişiminde otomatik restart):

```bash
npm run dev
```

### DM Komutları (Notifier Bot)

Notifier botunuza (oluşturduğunuz Discord uygulaması) DM üzerinden şu komutları gönderebilirsiniz:

| Komut | Açıklama |
|-------|----------|
| `!sil` | Botun size gönderdiği son 100 mesajı temizler. |

> **Not:** `!sil` komutu sadece yetkilendirilmiş kullanıcılar (token sahipleri) tarafından kullanılabilir.

### Slash Komutları

Sunucuda Notifier botunuzu kullanarak şu komutları verebilirsiniz:

| Komut | Açıklama |
|-------|----------|
| `/selfbot` | Botların durumunu görüntüler ve farming başlat/durdur işlemlerini yapar. |
| `/setch` | Kullanıcıya özel kanal listesi atar. |

---

## 🛠️ Proje Yapısı

```
src/
├── config/       # Konfigürasyon yönetimi
├── core/         # Bot durumu ve farming mantığı
├── handlers/     # Mesaj ve olay işleyicileri
├── process/      # Worker ve Notifier süreçleri
├── services/     # Discord ve Telegram servisleri
└── utils/        # Yardımcı fonksiyonlar ve Logger
```

---

## 🤝 Katkıda Bulunma

Pull request'ler kabul edilir. Büyük değişiklikler için önce tartışma başlatınız.

## 📄 Lisans

[MIT](https://choosealicense.com/licenses/mit/)
