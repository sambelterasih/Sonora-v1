# CHORD SASY / MUSIC LAB v2.6

Aplikasi web pencarian data musik berbasis link Spotify dan YouTube / YouTube Music. YouTube tetap mendukung jalur analisis audio. Proyek ini memakai Cloudflare Worker untuk backend dan folder `public` untuk frontend.

## Perubahan versi ini
- Input Spotify dan YouTube sama-sama menjalankan pencarian database musik.
- Integrasi opsional Sonovault (BPM dan Key) serta GetSongBPM (BPM, Key, dan Time Signature).
- Hasil dari database hanya ditampilkan jika judul/artis cocok dengan tingkat keyakinan minimum; nilai yang tidak tersedia tetap kosong.
- Spotify mengambil metadata publik untuk judul, artis (jika tersedia), cover, dan tautan; tidak mengunduh atau menganalisis audio Spotify.
- Hasil database melengkapi parameter yang belum tersedia dari analisis audio YouTube.
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
6. Untuk mengaktifkan pencarian BPM/Key otomatis, buat API key gratis Sonovault (kuota gratis 1.000 request/bulan), lalu jalankan `npx wrangler secret put SONOVAULT_API_KEY` dan masukkan key saat diminta.
7. Opsional: GetSongBPM menyediakan API gratis dengan syarat backlink wajib. Daftarkan aplikasi di `https://getsongbpm.com/api`, lalu jalankan `npx wrangler secret put GETSONGBPM_API_KEY`.
8. Jalankan `npm run deploy`.
9. Tes URL Worker dengan menambahkan `/api/health`.

**Catatan:** Nama Worker di `wrangler.jsonc` tetap `sonora-v1` supaya deployment memperbarui Worker lama, bukan membuat Worker baru. Jika ingin nama Worker baru, ubah field `name` sebelum deploy.

## Konfigurasi Android
1. Isi `window.SONORA_API_BASE` di `public/config.js` dengan URL Worker jika aplikasi Android harus mengakses domain Worker yang berbeda.
2. Jalankan `npm install`.
3. Jalankan `npm run cap:add:android` satu kali, lalu `npm run cap:sync`.
4. Jalankan `npm run cap:open:android` dan build APK dari Android Studio.

## Batasan analisis
- Sonovault menyediakan pencarian katalog beserta BPM dan Key. GetSongBPM menyediakan BPM, Key, dan Time Signature. Kedua layanan memerlukan API key yang disimpan sebagai Cloudflare Worker secrets, bukan di frontend.
- Tanpa API key database, input Spotify tetap dikenali dan pemutar Spotify ditampilkan, tetapi nilai musik dari database akan kosong. Metadata Spotify oEmbed tidak selalu memberikan nama artis atau durasi.
- Chord Progression belum diambil dari sumber database yang terverifikasi; tetap ditampilkan kosong kecuali provider analisis audio YouTube mengirimkannya.
- Jalur YouTube tetap memakai provider Magic Chords. Jika hasil audio tidak lengkap, database yang dikonfigurasi akan melengkapi parameter yang kosong.
- Pemilihan Key bagian awal hanya bisa dilakukan bila provider mengirim informasi section/intro atau key per bagian; jika tidak, aplikasi memakai key keseluruhan yang tersedia.
- Jangan menganggap nilai yang tidak tersedia sebagai hasil pasti atau mengarangnya.

## Sumber & dokumentasi
- Sonovault API: `https://sonovault.now/` — paket gratis 1.000 permintaan/bulan; BPM dan Key tersedia pada hasil yang sudah dianalisis.
- GetSongBPM API: `https://getsongbpm.com/api` — API gratis, API key diperlukan, backlink ke GetSongBPM wajib.
- Spotify Web API tidak lagi menyediakan Audio Features/Audio Analysis untuk aplikasi baru; aplikasi ini tidak mengakses atau mengekstrak audio Spotify.


## Spotify links (v2.4)
- Public Spotify track links (`https://open.spotify.com/track/...`) are supported for basic metadata preview using Spotify's official oEmbed endpoint.
- Spotify oEmbed provides a title and thumbnail; it does not provide the artist or duration in its documented response. The app shows those fields as unavailable rather than guessing.
- Spotify links can be embedded for playback. BPM, key, time signature and chord analysis still require a corresponding YouTube / YouTube Music URL because this Worker does not download or extract Spotify audio.
- Spotify content is not downloaded or submitted to an AI model. See Spotify developer policies before extending this integration.


## v2.6 — Audio Internal Android (uji coba)
Lihat `README-AUDIO-INTERNAL.md` untuk pemasangan plugin Android native dan konfigurasi ACRCloud. Mode ini hanya aktif di APK Android Capacitor (Android 10+), bukan browser biasa. Link YouTube/Spotify tetap tersedia.
