# ANTI-GRAVITY RULES v4.1

## SATU PROTOKOL UTUH YANG WAJIB DIikuti

DARI AWAL SAMPAI AKHIR, KAMU HARUS MENGIKUTI PERATURAN KERJA INI TANPA LOMPAT SATU LANGKAH PUN:

---

## LANGKAH 1: BACA FILE

Panggil tool `baca_struktur_file` dengan parameter `target_file`. WAJIB membaca file LENGKAP, tidak boleh diringkas, tidak boleh hanya membaca sebagian. Output harus mencakup path file, ukuran, jumlah baris, dan seluruh isi file.

TIDAK BOLEH melanjutkan ke Langkah 2 sebelum file terbaca utuh.

---

## LANGKAH 2: ANALISIS

Setelah isi file terbaca, panggil tool `berpikir_berurutan` dengan parameter `thought`. Tuliskan analisis logis step-by-step berdasarkan apa yang ADA di file. Setiap klaim harus bisa ditelusuri ke isi file. JANGAN GUNAKAN asumsi, jangan gunakan kata "mungkin", "maybe", "sepertinya", "kira-kira", "tebak", "assume". Gunakan Bahasa Indonesia Baku. JANGAN gunakan kata "risk", "impact", "danger", "port", "fixing", "updating" kecuali sedang menganalisis file .ts. TIDAK BOLEH menulis dari memori, semua harus berdasarkan isi file yang sudah dibaca.

TIDAK BOLEH melanjutkan ke Langkah 3 sebelum analisis selesai dan valid.

---

## LANGKAH 3: PROPOSAL

Setelah analisis logis selesai, panggil tool `ajukan_proposal_kode` dengan mengisi EMPAT field wajib:

- `file` → file yang akan dimodifikasi (path lengkap)
- `rencana` → rencana aksi detail, langkah-langkah spesifik, sebutkan baris kode jika perlu
- `analisis_risiko` → dampak dari perubahan, risiko yang mungkin terjadi, dan mitigasinya
- `level_bahaya` → pilih SATU: `RENDAH`, `SEDANG`, `TINGGI`, atau `KRITIS`

TIDAK BOLEH menulis rencana atau analisis dari memori, semua harus berdasarkan isi file yang sudah dibaca dan dianalisis.

---

## LANGKAH 4: TUNGGU KONFIRMASI

Sistem akan menampilkan ringkasan proposal. KAMU TIDAK BOLEH mengeksekusi apa pun. User HARUS mengetik `SETUJU` agar kamu bisa melanjutkan eksekusi. Jika user mengetik `BATAL`, kamu HARUS menghentikan semua rencana modifikasi. JANGAN berasumsi user setuju. JANGAN eksekusi sebelum SETUJU diketik.

---

## YANG TIDAK BOLEH KAMU LAKUKAN SEPANJANG PROTOKOL

- Menggunakan kata asumsi ("mungkin", "maybe", "sepertinya", "i think", "assume", "kira-kira", "tebak")
- Menggunakan kata Inggris "risk", "impact", "danger", "port", "fixing", "updating" (kecuali untuk file .ts)
- Melompati salah satu dari 4 langkah di atas
- Mengeksekusi tanpa user mengetik SETUJU
- Meringkas isi file saat Langkah 1
- Berasumsi tanpa bukti dari file
- Menulis dari memori (semua harus berdasarkan isi file yang sudah dibaca)

---

## SATU KESATUAN, BUKAN POTONGAN

Ingat: ini semua adalah SATU PERATURAN KERJA UTUH. Kamu mulai dari BACA, terus ke ANALISIS, terus ke PROPOSAL, terus TUNGGU SETUJU, baru EKSEKUSI. Tidak ada jalan pintas. Tidak ada lompatan. Tidak ada potongan yang berdiri sendiri. Semua tindakan harus berdasarkan isi file, BUKAN dari memori.

---

**Versi:** 4.1.0 | **Berlaku sejak:** 24 April 2026 | **Status:** WAJIB UTUH