# SONORA 2.1 — Cloudflare + Android wrapper (deployment fix)

Paket ini mengadaptasi backend Express menjadi Cloudflare Worker dan menyiapkan konfigurasi Capacitor. Ini **belum merupakan APK** dan belum dideploy ke akun Cloudflare.

## A. Deploy ke Cloudflare (butuh komputer/laptop dengan Node.js)

**Penting:** ZIP ini harus dideploy sebagai proyek Worker lengkap, bukan hanya folder `public`. Folder `src/index.js` adalah backend API. Konfigurasi `wrangler.jsonc` sudah memakai nama Worker `sonora-v1` agar deployment memperbarui Worker yang sama.

1. Install Node.js 20+ di komputer, lalu ekstrak ZIP ini.
2. Jalankan `npm install`.
3. Login: `npx wrangler login`.
4. (Opsional) Tambahkan kunci API sebagai secret, jangan ditulis di file publik:
   - `npx wrangler secret put YOUTUBE_API_KEY`
   - `npx wrangler secret put OPENAI_API_KEY`
   - Jika perlu: `npx wrangler secret put MAGIC_CHORDS_BASE` (biasanya tidak perlu).
5. Jalankan `npm run deploy`. Pastikan Wrangler menampilkan Worker `sonora-v1` dan URL `https://sonora-v1.<subdomain-anda>.workers.dev`. Wrangler akan menampilkan URL `https://sonora-ai-music-analyzer.<akun>.workers.dev`.
6. Tes `https://sonora-v1.<subdomain-anda>.workers.dev/api/health`. Hasil yang diharapkan: `{"ok":true,...}`. Buka URL Worker untuk melihat SONORA.

Alternatifnya, hubungkan repository GitHub ke Cloudflare Workers Builds dan deploy dari repository.

## B. Siapkan aplikasi Android

APK harus dibangun menggunakan Android Studio/Android SDK di komputer (atau layanan build Android). HP tidak dapat langsung menginstal source ZIP sebagai APK.

1. Setelah deploy berhasil, edit `public/config.js`, isi `window.SONORA_API_BASE` dengan URL Worker, misalnya `https://sonora-ai-music-analyzer.username.workers.dev` (tanpa garis miring di akhir).
2. Jalankan `npm install`.
3. Jalankan `npm run cap:add:android` (hanya sekali).
4. Jalankan `npm run cap:sync`.
5. Jalankan `npm run cap:open:android`, lalu di Android Studio pilih Build > Build Bundle(s) / APK(s) > Build APK(s).
6. Salin APK hasil build ke HP Android dan instal. Untuk distribusi publik, siapkan signing/release build.

## Catatan penting
- Browser/Android app memanggil API Worker. Kunci OpenAI dan YouTube disimpan sebagai Cloudflare secrets, bukan di aplikasi Android.
- Magic Chords adalah layanan pihak ketiga eksperimental. Ketersediaan, batas pemakaian, biaya, skema hasil, dan ketentuan layanannya dapat berubah.
- Analisis audio bukan dilakukan oleh OpenAI. OpenAI hanya dipakai untuk menjelaskan fitur yang sudah diukur, jika endpoint penjelasan dipakai.
- Durasi YouTube hanya tersedia jika `YOUTUBE_API_KEY` disetel dan video dapat diakses oleh API.
- Jangan mengunggah atau memproses konten yang tidak Anda punya hak untuk gunakan.
