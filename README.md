# CHORD SASY / MUSIC LAB v2.3

Aplikasi web analisis musik berbasis link YouTube / YouTube Music, dengan pratinjau metadata Spotify. Proyek ini memakai Cloudflare Worker untuk backend dan folder `public` untuk frontend.

## Perubahan versi ini
- Nama aplikasi menjadi **CHORD SASY / MUSIC LAB**.
- Nama artist dibersihkan dari akhiran `- Topic`.
- Nada dasar ditampilkan seperti `Key A Major / Do = A`.
- Jika hasil analisis menunjukkan modulasi/perubahan key dan menyediakan key bagian intro atau bagian pertama, aplikasi memakai key bagian awal yang stabil.
- Nilai yang tidak tersedia tetap ditampilkan sebagai tanda strip, bukan ditebak.

## Deploy ke Cloudflare
1. Ekstrak ZIP ini di komputer.
2. Install Node.js 20 atau lebih baru.
3. Buka terminal pada folder proyek, lalu jalankan `npm install`.
4. Jalankan `npx wrangler login`.
5. (Opsional) Atur YouTube API key untuk mengambil durasi video: `npx wrangler secret put YOUTUBE_API_KEY`.
6. Jalankan `npm run deploy`.
7. Tes URL Worker dengan menambahkan `/api/health`.

**Catatan:** Nama Worker di `wrangler.jsonc` tetap `sonora-v1` supaya deployment memperbarui Worker lama, bukan membuat Worker baru. Jika ingin nama Worker baru, ubah field `name` sebelum deploy.

## Konfigurasi Android
1. Isi `window.SONORA_API_BASE` di `public/config.js` dengan URL Worker jika aplikasi Android harus mengakses domain Worker yang berbeda.
2. Jalankan `npm install`.
3. Jalankan `npm run cap:add:android` satu kali, lalu `npm run cap:sync`.
4. Jalankan `npm run cap:open:android` dan build APK dari Android Studio.

## Batasan analisis
Backend masih memakai provider Magic Chords yang sudah digunakan versi sebelumnya. Kualitas dan ketersediaan hasil mengikuti layanan tersebut. Pemilihan key bagian awal hanya bisa dilakukan bila provider mengirimkan informasi section/intro atau key per bagian; bila tidak, aplikasi menampilkan key keseluruhan yang diberikan provider. Belum ada integrasi API database musik eksternal dalam paket ini karena endpoint dan akses API alternatif belum terverifikasi. Jangan menganggap birama atau key yang tidak diberikan provider sebagai hasil pasti.


## Spotify links (v2.3)
- Public Spotify track links (`https://open.spotify.com/track/...`) are supported for basic metadata preview using Spotify's official oEmbed endpoint.
- Spotify oEmbed provides a title and thumbnail; it does not provide the artist or duration in its documented response. The app shows those fields as unavailable rather than guessing.
- Spotify links can be embedded for playback. BPM, key, time signature and chord analysis still require a corresponding YouTube / YouTube Music URL because this Worker does not download or extract Spotify audio.
- Spotify content is not downloaded or submitted to an AI model. See Spotify developer policies before extending this integration.
