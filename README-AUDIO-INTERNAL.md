# CHORD SASY v2.6 — Mode Audio Internal (uji coba)

## Apa yang ditambahkan
- Tombol **Deteksi Lagu · 12 detik** pada halaman utama.
- Android native `AudioPlaybackCapture` (Android 10 / API 29+) untuk mengambil audio pemutaran aplikasi lain, bukan merekam suara sekitar melalui mikrofon.
- Identifikasi judul/artis melalui ACRCloud Identify API.
- Setelah lagu dikenali, judul/artis dicocokkan lagi ke Sonovault dan GetSongBPM untuk mengisi BPM, Key/Do, dan time signature bila datanya tersedia.
- Input link Spotify dan YouTube yang sudah ada tetap dipertahankan.

## Batasan penting
1. Ini adalah source ZIP, bukan APK siap instal. Mode audio internal hanya tersedia setelah dibuat menjadi aplikasi Android Capacitor dan plugin native didaftarkan.
2. Memerlukan Android 10 atau lebih baru. Browser biasa tidak bisa mengambil audio dari aplikasi lain.
3. Android menampilkan dialog izin **Start now** untuk MediaProjection. Setelah menekan, segera pindah ke YouTube/Spotify dan putar lagu; plugin memberi jeda sekitar 2,5 detik lalu merekam 12 detik.
4. Android hanya dapat menangkap audio aplikasi sumber yang mengizinkan playback capture. Aplikasi sumber dapat menolak capture; YouTube dan Spotify harus diuji pada perangkat dan versi aplikasi yang dipakai. DRM, kebijakan aplikasi, profil kerja, atau keluaran audio tertentu dapat membuat hasil kosong.
5. Izin `RECORD_AUDIO` diminta karena persyaratan API Android AudioPlaybackCapture. Kode mengambil audio playback internal, bukan input mikrofon.
6. ACRCloud hanya mengidentifikasi lagu. BPM, Key/Do, dan birama berasal dari database musik jika tersedia. Chord progression tidak dijanjikan oleh mode identifikasi ini dan akan tetap kosong jika database/provider tidak menyediakannya.
7. Cuplikan audio 12 detik dikirim ke ACRCloud untuk identifikasi. Jangan gunakan bila tidak nyaman mengirim cuplikan audio ke layanan pihak ketiga.
8. API ACRCloud membutuhkan akun dan kredensial milik pengguna. Kredensial tidak disertakan dalam ZIP.

## A. Siapkan ACRCloud
1. Buat akun/project Identify di ACRCloud dan pilih layanan Audio Recognition / Identify.
2. Ambil **Access Key**, **Access Secret**, dan host/region dari dashboard ACRCloud.
3. Atur secrets di Cloudflare Worker yang sama:

```bash
npx wrangler secret put ACRCLOUD_ACCESS_KEY
npx wrangler secret put ACRCLOUD_ACCESS_SECRET
```

Tambahkan variable biasa `ACRCLOUD_HOST` di Cloudflare Worker Settings → Variables and Secrets, sesuai hostname project ACRCloud.

4. Atur variable Worker `ACRCLOUD_HOST` dengan hostname region persis dari dashboard ACRCloud (tanpa `https://`). Host berbeda-beda menurut region/project.
5. Deploy ulang Worker:

```bash
npm run deploy
```

Secrets lama (Sonovault, GetSongBPM, dan YouTube bila digunakan) tetap seperti sebelumnya.

## B. Buat aplikasi Android native
Jalankan dari folder proyek:

```bash
npm install
npm run cap:add:android   # hanya jika folder android belum ada
npm run cap:sync
```

Salin file:

- `native/android/src/main/java/com/chordsasy/musiclab/InternalAudioCapturePlugin.kt` ke `android/app/src/main/java/com/chordsasy/musiclab/InternalAudioCapturePlugin.kt`.
- Ganti/ubah `android/app/src/main/java/com/chordsasy/musiclab/MainActivity.java` agar mendaftarkan plugin. Contoh tersedia di `native/android/examples/MainActivity.java`. Jika MainActivity proyekmu Kotlin, lakukan registrasi ekuivalen dengan `registerPlugin(InternalAudioCapturePlugin::class.java)` sebelum `super.onCreate(...)`.
- Tambahkan permission dari `native/android/AndroidManifest-permission.xml` ke `android/app/src/main/AndroidManifest.xml`, langsung di bawah tag `<manifest>`.

Pastikan `minSdkVersion` Android minimal 23 (proyek Capacitor umumnya sudah sesuai). Plugin akan menolak perangkat di bawah Android 10.

Kemudian:

```bash
npx cap sync android
npx cap open android
```

Build APK melalui Android Studio. Untuk pembaruan berikutnya, jalankan `npx cap sync android` lagi.

## C. Cara menguji
1. Instal APK di HP Android 10+.
2. Pastikan Worker sudah memiliki ACRCloud Access Key dan Secret.
3. Buka CHORD SASY dan tekan **Deteksi Lagu · 12 detik**.
4. Setujui dialog Android dengan **Start now**.
5. Segera pindah ke YouTube atau Spotify dan putar lagu selama proses capture.
6. Kembali ke CHORD SASY; hasil identifikasi dan data database akan muncul jika cocok.

Jika hasilnya “tidak ditemukan”, coba lagu lain dan pastikan volume tidak mute. Jika capture kosong, aplikasi sumber mungkin memblokir playback capture. Fitur link YouTube/Spotify lama tetap dapat digunakan.
