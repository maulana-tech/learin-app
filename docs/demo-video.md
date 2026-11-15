# LEARIS: Rencana Video Demo

Untuk HackOnVibe November 2026, "Build a Product That Spreads".

- **Durasi:** ± 2:00 (ditambah versi pendek 60 detik untuk media sosial)
- **Bahasa:** narasi berbahasa Inggris, karena targetnya global, plus subtitle
- **Pesan utama:** AI study work you can check, and every shared page brings in the next user.

---

## 1. Alur cerita

| Waktu | Adegan | Yang tampil di layar | Narasi |
|---|---|---|---|
| 0:00–0:12 | Masalah | Folder berantakan: PDF, slide, brief dari 4 mata kuliah | "Students use AI every day. None of it can prove what it says." |
| 0:12–0:25 | Landing | learis.utdi.me, scroll hero (screen "berdiri" dan menyebar) | "LEARIS is an AI study workspace where every claim shows its source." |
| 0:25–0:45 | Upload | Drop file satu semester, berlabel per mata kuliah | "Drop in the whole semester: PDFs, slides, syllabi, briefs. PDFs are read in your browser." |
| 0:45–1:10 | Agent bekerja | Chat: satu pertanyaan, lalu Orchestrator mengirim agent per mata kuliah dengan tool call yang terlihat | "Ask once, in your own words. One agent per course works in parallel, and you see every file they open." |
| 1:10–1:30 | **Cek klaim** (momen utama) | Buka page, klik [n], kutipan di file asli tampil; klaim yang tidak didukung diperbaiki oleh Claim Auditor | "Click any number to see the exact line it came from. A quote that is not in the file is refused before the page is saved." |
| 1:30–1:40 | Tasks | Papan deadline yang terisi otomatis dari brief | "Every deadline, pulled from the files, with its date." |
| 1:40–1:55 | **Viral loop** | Share lalu WhatsApp; link dibuka di HP tanpa akun; tekan daftar; Reach card menunjukkan views +1 dan signups +1 | "Share the page, not a screenshot. Anyone can read it, every quote visible. Every page is a demo, and a sign-up link." |
| 1:55–2:00 | Penutup | Logo dan learis.utdi.me | "LEARIS. AI study work you can check." |

---

## 2. Naskah narasi lengkap

Bacakan pelan-pelan, sekitar 140 kata per menit. Jeda `[…]` artinya diam sekitar 1 detik.

> Students use AI every day. […] None of it can prove what it says.
>
> LEARIS is an AI study workspace where every claim shows its source.
>
> Drop in the whole semester: PDFs, slides, syllabi and briefs, labelled by course. PDFs are read right in your browser.
>
> Then ask once, in your own words. […] The Orchestrator sends one agent per course, in parallel, and you watch every file they open and every tool they call.
>
> Here is the page they wrote. Click any number […] and you see the exact line it came from. Claims are checked against the file in code, not on the model's word. This one says more than its source proves, so the Claim Auditor rewrites it to say only what the quote supports.
>
> Every deadline in those files lands on one board, with its date.
>
> And when it's done, share the page, not a screenshot. […] Your friend opens it without an account, every quote visible. One tap, and they're in. […] Every shared page is a demo, and a sign-up link.
>
> LEARIS. AI study work you can check.

---

## 3. Persiapan

### Akun dan data
- [ ] Akun demo yang bersih (bukan akun pribadi), tanpa chat lama yang gagal
- [ ] File mata kuliah yang nyata dari 3–4 kursus, misalnya modul normalisasi dan tugas besar basis data
- [ ] Satu page yang sudah jadi, dengan satu klaim "unsupported" untuk adegan Claim Auditor
- [ ] Akun kedua, atau browser HP dalam mode private, untuk adegan signup lewat link

### Browser
- [ ] Rekam di produksi: https://learis.utdi.me
- [ ] Jendela 1440×900, zoom 110–125%
- [ ] Bookmark bar disembunyikan, ekstensi dimatikan
- [ ] Do Not Disturb aktif di Mac dan HP

### Agent
- Respons Bedrock bisa makan 20–60 detik. Rekam apa adanya, lalu percepat 4–8× di editor dengan label kecil **"sped up"**.
- Jangan memalsukan hasil. Angka di Reach card harus angka asli.

---

## 4. Alat

| Kebutuhan | Pilihan |
|---|---|
| Rekam layar | Screen Studio (zoom otomatis ke kursor), atau OBS / QuickTime |
| Rekam HP | iPhone Mirroring, atau iPhone ke QuickTime lewat kabel |
| Edit | CapCut atau DaVinci Resolve (keduanya gratis) |
| Narasi | Suara sendiri di ruangan sunyi, atau TTS (ElevenLabs) |
| Subtitle | Auto-caption di CapCut, lalu periksa ejaannya |
| Musik | Instrumental pelan, sekitar −20 dB di bawah narasi |

---

## 5. Cara merekam

1. **Rekam per adegan**, jangan sekali jalan. Satu file per baris tabel di bagian 1.
2. Gerakkan kursor dengan tenang: tunjuk satu hal, lalu diam.
3. Rekam narasi terpisah, lalu sesuaikan potongan video dengan suaranya.
4. Adegan HP (link WhatsApp dibuka tanpa akun) wajib asli. Inilah bukti paling kuat untuk kategori "spreads".
5. Export 1080p 30fps, MP4 (H.264).

---

## 6. Versi pendek (60 detik, untuk media sosial)

| Waktu | Adegan |
|---|---|
| 0:00–0:08 | Masalah: "AI can't prove what it says." |
| 0:08–0:30 | Cek klaim: klik [n], kutipan muncul, klaim yang salah diperbaiki |
| 0:30–0:50 | Share: link dibuka di HP, lalu signup |
| 0:50–0:60 | Logo + learis.utdi.me |

Format vertikal 9:16 untuk Reels, TikTok dan Shorts. Subtitle besar di tengah.

---

## 7. Checklist akhir

- [ ] Durasi ≤ 2:00
- [ ] Subtitle benar dan terbaca tanpa suara
- [ ] URL learis.utdi.me terlihat minimal dua kali
- [ ] Momen cek klaim dan viral loop jelas terlihat
- [ ] Bagian yang dipercepat diberi label
- [ ] Tidak ada data pribadi, email, atau API key di layar
