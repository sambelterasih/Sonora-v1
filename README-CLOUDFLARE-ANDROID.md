# CHORD SASY / MUSIC LAB — Cloudflare + Android

Paket ini berisi source code web dan Cloudflare Worker, bukan APK jadi.

## Deploy
1. Ekstrak ZIP di komputer dengan Node.js 20+.
2. Jalankan `npm install`.
3. Jalankan `npx wrangler login`.
4. Opsional: `npx wrangler secret put YOUTUBE_API_KEY` untuk durasi YouTube.
5. Jalankan `npm run deploy`.
6. Tes `https://NAMA-WORKER.SUBDOMAIN.workers.dev/api/health`.

Nama Worker di `wrangler.jsonc` dipertahankan sebagai `sonora-v1` agar memperbarui deployment sebelumnya.

## Android
1. Atur URL Worker pada `public/config.js` jika diperlukan.
2. Jalankan `npm install`.
3. Jalankan `npm run cap:add:android` satu kali.
4. Jalankan `npm run cap:sync`.
5. Jalankan `npm run cap:open:android`, lalu build APK melalui Android Studio.

## Catatan
- `YOUTUBE_API_KEY` disimpan sebagai Cloudflare secret, bukan di file frontend.
- Analisis audio menggunakan layanan pihak ketiga Magic Chords; skema dan ketersediaannya dapat berubah.
- Key bagian awal hanya bisa dipilih jika hasil provider menyertakan key intro/section.
- Integrasi database musik alternatif belum dimasukkan karena API endpoint-nya belum diverifikasi.


## Spotify
Versi 2.3 menerima link lagu Spotify publik untuk menampilkan judul, cover, tautan, dan pemutar Spotify. Data artis/durasi mungkin tidak tersedia dari oEmbed. Untuk analisis BPM, Key, birama, dan chord, tetap masukkan link YouTube dari lagu yang sama. Tidak diperlukan Spotify API key.
