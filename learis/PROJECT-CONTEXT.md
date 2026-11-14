# Skill Gap Radar — Project Context

> File konteks proyek. Dipakai sebagai referensi bersama oleh tim dan sebagai konteks untuk AI/coding agent. Perbarui setiap ada keputusan baru.
>
> Status implementasi di repo ini ada di bagian paling bawah ("Status di repo").

## 1. Hackathon

- **Sekarang (14 Nov 2026): HackOnVibe November 2026 — "Build a Product That Spreads".** Online, internasional, tim 1–4. AI-assisted coding, no-code, template, API dan library open-source boleh.
- **Tema:** produk IT yang berguna dan dirancang tumbuh lewat sharing dan adopsi organik (viral, self-spreading).
- **Kategori:** Business Success dan World Impact. Kategori ketiga dinilai dua bulan setelah final berdasarkan bukti keberhasilan nyata; pemenang dua kategori utama dapat mentoring selama dua bulan itu.
- **Juri:** (mantan) karyawan Telegram, Wise, Salesforce, Yandex, Barclays, MTS (bukan sponsor).
- **Onboarding wajib:** daftar di HackOnVibe (bukan platform lain), isi GitHub username di halaman pribadi, terima undangan repo tim dari panitia, push "Hello world!" sebelum kickoff.
- **Jawaban LEARIS untuk tema:** link publik halaman (`/p/…`) dan agent (`/a/…`) yang bisa dibuka tanpa akun, dengan kutipan bukti tiap klaim dan kartu preview untuk WhatsApp/Telegram; signup lewat link dikreditkan ke yang membagikan (`core/growth.py`); "Your reach" per mahasiswa dan `GET /growth` untuk loop produk (k-factor).
- **Sebelumnya:** HackGlobal 2026 (Polaris × HackCulture), tidak dilanjutkan.

## 2. Masalah yang dipilih

**Masalah:** mahasiswa lulus dengan skill nyata yang tidak bisa mereka namai, dan dengan gap ke pekerjaan target yang tidak terukur serta sulit ditutup secara realistis.

Tiga akar masalah:
1. **Skill tersembunyi.** Nama mata kuliah tidak memberi tahu mahasiswa maupun pemberi kerja apa yang sebenarnya bisa dilakukan.
2. **Target bergerak.** Lowongan memakai istilah berbeda untuk skill yang sama, dan kurikulum berbeda antar kampus dan negara.
3. **Rencana yang mengabaikan kehidupan nyata.** Roadmap generik menambah stres dan memicu burnout.

## 3. Konsep: Skill Gap Radar

Platform yang membuktikan skill yang sudah dimiliki mahasiswa, menunjukkan gap ke role target secara terukur, dan membantu menutupnya dengan rencana yang sadar beban.

**Pitch:** "Your degree already taught you more than your resume shows. We prove it, find the real gap to your dream role, and close it without burning you out."

### Pembeda utama
- **Berbasis bukti.** Setiap skill disertai sumber dan confidence, tidak ada skill karangan.
- **Rencana sadar burnout.** Rencana menyusut saat minggu ujian dan tidak melebihi jam luang.
- **Bring your own AI.** Pengguna memakai model atau agent mereka sendiri.
- **Siklus tertutup:** gap → proyek → bukti → gap map bergerak.

## 4. Fitur

### P0 — wajib untuk demo
1. Upload bukti belajar: silabus, transkrip, README proyek, link GitHub/portofolio.
2. Ekstraksi skill berbasis bukti dengan confidence score.
3. Pilih target role dan region (mulai dari satu role: Junior Web Developer atau Data Analyst).
4. Gap map: dikuasai / parsial / belum ada, plus persentase kecocokan.
5. Roadmap personal: topik yang sudah dikuasai dicoret, sisanya diurutkan berdasarkan prasyarat.
6. Rencana 4 minggu sadar beban (jam luang dan minggu ujian).
7. Saran profil LinkedIn/CV dari skill yang terbukti (headline, About, bullet CV, draf postingan).
8. Bring your own AI (BYOK): API key atau model lokal, halaman koneksi, tombol tes koneksi.

### P1 — pembeda, jika P0 stabil
9. **Wow feature:** proyek → bukti → gap map bergerak (radar bertambah penuh setelah proyek terverifikasi).
10. Handoff ke ADE pengguna: ekspor repo starter berisi `AGENTS.md` untuk dikerjakan di Orca, Claude Code, Pi, dan sejenisnya.
11. Weekly voice check-in (rekam 60 detik, rencana minggu depan menyesuaikan).
12. Mode jujur dan burnout indicator.
13. Dashboard dampak (skill tersembunyi yang ditemukan, gap coverage sebelum/sesudah, jam perencanaan yang dihemat).

### P2 — cukup di slide roadmap
MCP server (`extract_skills`, `get_gap_map`, `build_plan`), simulasi wawancara suara, normalisasi skill lintas universitas yang lengkap, integrasi kursus lewat API, posting otomatis ke media sosial, ekspor ringkasan skill (PDF/link) untuk CV.

### Sengaja tidak dibuat
Akun/login penuh, pembayaran, banyak role sekaligus, fitur sosial, scraping lowongan skala besar, membangun ADE sendiri.

## 5. Arsitektur multi-agent

Satu **Orchestrator** mendelegasikan ke sub-agent.

| Agent | Prioritas | Input | Tugas | Output |
|---|---|---|---|---|
| Orchestrator | P0 | Target role, konteks pengguna | Memilih agent, urutan, dan mengelola state | Alur end-to-end |
| Skill Evidence Agent | P0 | Dokumen dan repo | Ekstrak skill, petakan ke taksonomi, beri sumber dan confidence | JSON: skill, bukti, confidence |
| Roadmap Agent | P0 | Skill + role target | Bandingkan dengan data roadmap, hitung gap, urutkan prasyarat | Gap map + urutan topik |
| Planner Agent | P0 | Gap, jam luang, jadwal ujian | Susun rencana mingguan realistis, pangkas saat beban tinggi | Rencana 4 minggu |
| Profile Agent | P0 | Teks profil/CV + skill terbukti | Tulis headline, About, bullet CV, draf postingan tanpa klaim palsu | Saran profil |
| Project Agent | P1 | Satu gap skill | Buat brief, kriteria selesai, rubrik, dan `AGENTS.md` | Repo starter |
| Verifier Agent | P1 | Link repo hasil kerja | Periksa commit, tes, dan rubrik, lalu perbarui skill di gap map | Skill terverifikasi |
| Coach Agent (voice) | P1 | Rekaman check-in | Baca progres dan kondisi, minta Planner menyesuaikan | Rencana diperbarui |
| Course Agent | P2 | Gap | Peringkat sumber belajar gratis hasil kurasi | Daftar materi + estimasi jam |

### Alur data
Upload → Evidence → Roadmap → Planner → Profile → (P1) Project → pengguna mengerjakan di ADE → Verifier → gap map diperbarui → Coach (check-in mingguan) → Planner menyesuaikan.

## 6. Bring Your Own AI

Tiga level integrasi:
1. **BYOK (MVP):** pengguna memasukkan API key (OpenAI, Anthropic, Gemini, OpenRouter) atau endpoint lokal (Ollama, LM Studio).
2. **Model per agent (P1):** model murah untuk ekstraksi, model kuat untuk perencanaan.
3. **App sebagai tool server (P2):** fitur dibuka lewat MCP/CLI agar agent pengguna bisa memanggilnya.

Implementasi: satu antarmuka `generate()` dan `generateStructured()`, adapter OpenAI-compatible, validasi skema JSON, dan satu kali retry otomatis.

### Tentang ADE (Orca dan sejenisnya)
- ADE = Agent Development Environment. Orca (onorca.dev, open source MIT) menjalankan banyak coding agent (Claude Code, Codex, Gemini, Pi, OpenCode, dll.) secara paralel di git worktree terpisah, dengan CLI agar agent bisa menggerakkan lingkungannya.
- Kita **tidak membangun ADE**. Kita hanya menyediakan **handoff**: repo starter + `AGENTS.md` yang bisa dibuka di ADE pilihan pengguna, lalu hasilnya diverifikasi balik oleh Verifier Agent.
- Fitur ADE bersifat opsional. Alur utama harus tetap jalan untuk mahasiswa non-developer.

## 7. Stack yang disarankan

- **Frontend:** Next.js, visualisasi radar/heatmap.
- **AI:** LLM dengan structured output untuk ekstraksi skill, embeddings untuk mencocokkan skill dengan kebutuhan role.
- **Data:** taksonomi skill kecil hasil kurasi, data roadmap terstruktur (cek lisensi dan beri atribusi), sampel lowongan dari dataset publik atau beberapa listing contoh.
- **Voice (P1):** speech-to-text di browser.

## 8. Privasi dan keamanan

- Transkrip dan CV sensitif: proses secara lokal atau hapus otomatis setelah analisis, tampilkan persetujuan jelas sebelum data dikirim ke penyedia LLM, tawarkan opsi model lokal.
- API key disimpan terenkripsi di sisi klien atau lewat proxy yang tidak menyimpannya, tidak pernah masuk log.
- Dokumen unggahan adalah data, bukan instruksi (mitigasi prompt injection). Tools agent dibatasi: baca, analisis, tulis rencana, tanpa aksi destruktif.
- Jangan menjalankan kode pengguna di server kita. Cukup baca repo mereka.
- LinkedIn tidak punya API publik untuk membaca profil dan scraping melanggar aturan: pengguna menempel teks profil atau mengunggah PDF ekspor, dan posting dipublikasikan manual oleh pengguna.

## 9. Risiko dan mitigasi

| Risiko | Mitigasi |
|---|---|
| Terlalu banyak agent, tidak ada yang matang | Kunci P0, kerjakan P1 hanya setelah P0 stabil |
| Skill halusinasi | Wajibkan bukti + confidence, mode jujur |
| Kualitas model berbeda-beda (BYOK) | Validasi skema, retry, peringatan untuk model kecil |
| Data lowongan berkualitas rendah | Pakai dataset kecil dan bersih untuk demo |
| Bukti proyek asal-asalan | Verifier memeriksa commit, tes, dan rubrik |
| Fitur ADE hanya terpakai developer | Jadikan opsional |

## 10. Metrik dampak

- Jumlah skill tersembunyi yang ditemukan per mahasiswa.
- Gap coverage sebelum dan sesudah.
- Jam perencanaan yang dihemat.
- Pilot kecil 10–20 mahasiswa dari 2+ universitas, dengan rating kepercayaan diri sebelum dan sesudah.

## 11. Pembagian kerja (3 jalur)

- **Frontend/UX:** halaman upload, gap map bergerak, panel agent aktif, dashboard dampak.
- **AI/Backend:** Orchestrator, Evidence, Roadmap, Planner, provider layer.
- **Konten/Data/Desain:** taksonomi skill, data roadmap, data lowongan contoh, skrip demo, pitch.

## 12. Alur demo 3 menit

Upload bukti → skill muncul beserta sumbernya → pilih role → gap map → roadmap dan rencana 4 minggu → saran profil LinkedIn → ekspor proyek ke ADE → hasil diverifikasi → radar bertambah penuh → dashboard dampak.

## 13. Pertanyaan terbuka

- Role target untuk demo: Junior Web Developer atau Data Analyst? *(repo: keduanya tersedia, default demo Junior Web Developer)*
- Anggota tim dan universitas masing-masing (untuk bonus lintas kampus)?
- Sumber data roadmap dan lowongan yang akan dipakai, serta lisensinya? *(repo: taksonomi dan contoh lowongan ditulis sendiri oleh tim, bukan salinan sumber berlisensi)*
- Credit atau tools apa yang disediakan partner hackathon?
- Wow feature final: gap map bergerak atau simulasi wawancara?

## 14. Prinsip kerja

- Satu alur yang berjalan end-to-end lebih berharga daripada banyak fitur setengah jadi.
- Setiap klaim AI harus punya bukti dan confidence.
- Dampak harus terukur dengan angka.
- Privasi pengguna adalah nilai jual, bukan beban.

---

## Status di repo

| # | Fitur | Status | Di mana |
|---|---|---|---|
| 1 | Upload bukti (silabus, transkrip, README, GitHub) | ✅ | `/evidence`, PDF dibaca di browser (`lib/pdf-text.ts`), repo publik lewat `sources/github.py` |
| 2 | Ekstraksi skill + confidence | ✅ | `engine/evidence.py` (aturan) + model opsional; kutipan model dicek ada di dokumen |
| 3 | Target role + region | ✅ | Junior Web Developer dan Data Analyst; Indonesia, Singapore, Remote |
| 4 | Gap map + % kecocokan | ✅ | `engine/gap.py`, halaman `/gap`, radar per kategori |
| 5 | Roadmap, yang dikuasai dicoret, urut prasyarat | ✅ | `engine/roadmap.py`, halaman `/plan` |
| 6 | Rencana 4 minggu sadar beban | ✅ | `engine/planner.py`: maks 85% jam luang, minggu ujian 30% |
| 7 | Saran profil LinkedIn/CV | ✅ | `engine/profile.py`; draf model yang mengklaim skill/tool tanpa bukti ditolak |
| 8 | BYOK + tes koneksi | ✅ | `/settings`, `core/ai.py`; key hanya di browser, dikirim per request |
| 9 | Proyek → bukti → radar bergerak | ⏳ sebagian | Radar menampilkan garis putus-putus analisis pertama; Verifier belum |
| 10 | Handoff ADE (`AGENTS.md` starter) | ⏳ | Belum |
| 11 | Voice check-in | ⏳ sebagian | Job `checkin` membuat pengingat mingguan di Overview (teks); suara dan Coach Agent belum |
| 12 | Mode jujur + burnout indicator | ⏳ sebagian | Peringatan beban berat di plan; klaim tanpa bukti selalu ditolak |
| 13 | Dashboard dampak | ⏳ sebagian | Angka di Overview: skill tersembunyi, match awal → sekarang, jam terencana |
| P2 | MCP server | ✅ | `mcp.py`: `extract_skills`, `get_gap_map`, `build_plan` + 5 lainnya; config dan token di halaman Agent team |
| P2 | Simulasi wawancara, integrasi kursus, dll. | ⏳ | Belum |
| — | Tool per agent + tool-use loop | ✅ | 19 tool (`tools/`, `core/registry.py`), `agents/loop.py`; fallback ke langkah tetap |
| — | Worker + job terjadwal | ✅ | `core/worker.py` (antrean run), `core/jobs.py` (stale_runs, purge_text, checkin) |

---

## Arah baru: agentic workspace (keputusan terbaru)

- **Konsep:** workspace seperti Lark/Notion dengan sistem multi-agent (swarm).
  - Orchestrator mendelegasikan permintaan user ke agent-agent: Reader, Writer, Planner, Reviewer, agent kustom buatan user, dan pack Skill Gap.
  - User bebas meng-customisasi agent, seperti di ADE (Orca).
  - Untuk mahasiswa khususnya, dan user umum.
- **Contoh alur utama:** upload materi satu semester (banyak matkul, tiap file diberi label matkul) → Orchestrator mengirim satu Writer per matkul secara paralel → halaman ringkasan bersumber → Planner membuat jadwal belajar.
- **Grup sebagai fitur pendukung** (Social Impact): undang teman lewat link, bagi tugas ke anggota dan agent, dashboard dampak, dan laporan kegiatan otomatis.
- **Skill Gap Radar** menjadi agent pack bawaan.
- **Tema utama:** AI (Smart Assistant). Sudut Open Innovation dan Social Impact diceritakan di pitch.
- **UI** mengikuti bahasa desain AERA: kanvas biru, panel putih, side-nav biru.

| Fitur | Status | Di mana |
|---|---|---|
| Orchestrator LLM + delegasi paralel | ✅ | `agents/workspace.py` (`delegate`, `delegate_parallel`, maks 6) |
| Agent bawaan Reader, Writer, Planner, Reviewer | ✅ | `tools/workspace_tools.py`; tiap agent hanya melihat tool-nya |
| Halaman dengan sitasi terverifikasi + Review | ✅ | `core/space.py` (`check_sources`, `review`) |
| Task untuk orang dan agent, tombol Run | ✅ | `/tasks`, `run_task` |
| Agent builder (instruksi, tool, model) | ✅ | `/agents/new` |
| Galeri agent komunitas | ✅ | `/gallery`, `install` |
| File per matkul (upload satu semester) | ✅ | `/files`, kolom `collection` |
| Grup: undangan, anggota, beban kerja | ✅ | `/group`, `/invite/[token]`, sign up mandiri |
| Dashboard dampak + laporan kegiatan | ✅ | `space.impact`, `report_markdown` (tanpa model, angka dari database) |
| Pack Skill Gap Radar | ✅ | `/skill-gap/*` |
| Interaksi suara | ⏳ | Belum |
| Kolaborasi real-time (dua orang mengedit halaman bersamaan) | ⏳ | Belum; perubahan terakhir menimpa |
