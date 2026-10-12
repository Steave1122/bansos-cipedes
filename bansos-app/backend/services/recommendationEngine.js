/**
 * Klasifikasi Bantuan Sosial berbasis Regulasi Pemerintah
 * Dasar hukum:
 *   PKH          — Permensos No.1 Tahun 2018
 *   BPNT         — Permensos No.20 Tahun 2019
 *   BST          — Kebijakan Kemensos (kondisi darurat)
 *   Bawaku Makmur— Program Pemkot Bandung
 *   Desil 1-4    — Kebijakan Kemensos Triwulan I 2026
 *
 * Urutan prioritas:
 *   1. PKH          (miskin + komponen kesehatan/pendidikan/kesejahteraan)
 *   2. BST          (miskin + kondisi darurat ekonomi)
 *   3. Bawaku Makmur(miskin + usaha mikro)
 *   4. BPNT         (miskin / DTKS / KKS — kategori umum)
 *   5. Tidak Memenuhi Kriteria
 */

const BATAS_PENGHASILAN_PER_KAPITA = 600000;

const DASAR_HUKUM = {
  PKH:          'Permensos No.1 Tahun 2018 tentang Program Keluarga Harapan',
  BPNT:         'Permensos No.20 Tahun 2019 tentang Bantuan Pangan Non Tunai',
  BST:          'Kebijakan Kemensos tentang Bantuan Sosial Tunai (kondisi situasional)',
  BawakuMakmur: 'Program Bawaku Makmur Pemerintah Kota Bandung',
  EKSKLUSI:     'Permensos No.1 Tahun 2018 Pasal 5 tentang syarat penerima bansos',
};

const PRIORITAS = {
  PKH:                     5,
  BST:                     4,
  'Bawaku Makmur':         3,
  BPNT:                    2,
  'Tidak Memenuhi Kriteria': 1,
  'Tidak Memenuhi Syarat Dasar': 0,
};

function rekomendasikanBantuan(data) {
  const {
    penghasilan_bulanan       = 0,
    jumlah_anggota_keluarga   = 1,
    ada_balita                = false,
    ada_ibu_hamil             = false,
    ada_anak_sekolah          = false,
    ada_lansia                = false,
    ada_disabilitas           = false,
    terdaftar_dtks            = false,
    punya_kks                 = false,
    punya_usaha_mikro         = false,
    kondisi_darurat           = false,
    keterangan_kondisi_darurat = '',
    status_asn_tni_polri      = false,
    status_pensiunan          = false,
    penerima_bansos_lain      = false,
  } = data;

  const jml = Math.max(jumlah_anggota_keluarga, 1);
  const penghasilan_per_kapita = Math.round(penghasilan_bulanan / jml);
  const miskin = penghasilan_per_kapita <= BATAS_PENGHASILAN_PER_KAPITA;
  const ada_komponen_pkh = ada_balita || ada_ibu_hamil || ada_anak_sekolah || ada_lansia || ada_disabilitas;
  const rp = (n) => `Rp${n.toLocaleString('id-ID')}/bulan`;
  const batas = rp(BATAS_PENGHASILAN_PER_KAPITA);

  // ── 1. PEMERIKSAAN EKSKLUSI DASAR ──────────────────────────────────────────
  const eksklusi = [];
  if (status_asn_tni_polri)  eksklusi.push('Berstatus aktif sebagai ASN, anggota TNI, atau Polri');
  if (status_pensiunan)      eksklusi.push('Menerima pensiun bulanan dari pemerintah');
  if (penerima_bansos_lain)  eksklusi.push('Sudah terdaftar sebagai penerima program bantuan sosial lain');

  if (eksklusi.length > 0) {
    return hasil('Tidak Memenuhi Syarat Dasar', eksklusi, DASAR_HUKUM.EKSKLUSI, null, penghasilan_per_kapita);
  }

  // ── 2. KLASIFIKASI PKH ─────────────────────────────────────────────────────
  // Syarat: miskin (≤600rb/kapita) DAN memiliki komponen PKH
  if (miskin && ada_komponen_pkh) {
    const komponen = [];
    if (ada_ibu_hamil)    komponen.push('ibu hamil/nifas');
    if (ada_balita)       komponen.push('balita usia 0–6 tahun');
    if (ada_anak_sekolah) komponen.push('anak usia sekolah SD/SMP/SMA');
    if (ada_lansia)       komponen.push('lansia usia 70 tahun ke atas');
    if (ada_disabilitas)  komponen.push('anggota keluarga penyandang disabilitas');

    return hasil('PKH', [
      `Penghasilan per kapita ${rp(penghasilan_per_kapita)} memenuhi batas maksimum ${batas} (desil 1–4 Kemensos 2026)`,
      `Memiliki komponen PKH: ${komponen.join(', ')} — sesuai Pasal 3 Permensos No.1/2018`,
      'Tidak berstatus ASN/TNI/Polri dan tidak menerima pensiun negara',
    ], DASAR_HUKUM.PKH, null, penghasilan_per_kapita);
  }

  // ── 3. KLASIFIKASI BST ─────────────────────────────────────────────────────
  // Syarat: miskin DAN kondisi darurat (lebih prioritas dari BPNT karena situasional mendesak)
  if (miskin && kondisi_darurat) {
    return hasil('BST', [
      `Penghasilan per kapita ${rp(penghasilan_per_kapita)} memenuhi batas maksimum ${batas}`,
      `Dalam kondisi darurat ekonomi: ${keterangan_kondisi_darurat || 'sebagaimana diinput dalam formulir pengajuan'}`,
      'Tidak memiliki komponen PKH; BST diberikan sebagai bantuan situasional mendesak',
    ], DASAR_HUKUM.BST, null, penghasilan_per_kapita);
  }

  // ── 4. KLASIFIKASI BAWAKU MAKMUR ───────────────────────────────────────────
  // Syarat: miskin DAN punya usaha mikro
  if (miskin && punya_usaha_mikro) {
    return hasil('Bawaku Makmur', [
      `Penghasilan per kapita ${rp(penghasilan_per_kapita)} memenuhi batas maksimum ${batas}`,
      'Memiliki usaha mikro atau usaha kecil yang aktif',
      'Bawaku Makmur mendorong kemandirian ekonomi warga miskin melalui pengembangan usaha (Pemkot Bandung)',
    ], DASAR_HUKUM.BawakuMakmur, null, penghasilan_per_kapita);
  }

  // ── 5. KLASIFIKASI BPNT ────────────────────────────────────────────────────
  // Syarat: miskin ATAU terdaftar DTKS ATAU punya KKS
  if (miskin || terdaftar_dtks || punya_kks) {
    const alasan = [];
    if (miskin)         alasan.push(`Penghasilan per kapita ${rp(penghasilan_per_kapita)} memenuhi batas maksimum ${batas}`);
    if (terdaftar_dtks) alasan.push('Terdaftar dalam Data Terpadu Kesejahteraan Sosial (DTKS/DTSEN) Kemensos');
    if (punya_kks)      alasan.push('Memiliki Kartu Keluarga Sejahtera (KKS) aktif');
    if (!ada_komponen_pkh) alasan.push('Tidak memiliki komponen PKH, sehingga diklasifikasikan ke BPNT');

    return hasil('BPNT', alasan, DASAR_HUKUM.BPNT, null, penghasilan_per_kapita);
  }

  // ── 6. TIDAK MEMENUHI KRITERIA ─────────────────────────────────────────────
  // Tampilkan alasan spesifik per program agar warga memahami kenapa tidak bisa
  const detail = { PKH: [], BPNT: [], BST: [], 'Bawaku Makmur': [] };

  if (!miskin) {
    const pesanPenghasilan = `Penghasilan per kapita ${rp(penghasilan_per_kapita)} melebihi batas maksimum ${batas}`;
    detail.PKH.push(pesanPenghasilan);
    detail.BPNT.push(pesanPenghasilan);
    detail.BST.push(pesanPenghasilan);
    detail['Bawaku Makmur'].push(pesanPenghasilan);
  }
  if (!ada_komponen_pkh) detail.PKH.push('Tidak memiliki anggota keluarga yang termasuk komponen PKH (ibu hamil, balita, anak sekolah, lansia, atau disabilitas)');
  if (!terdaftar_dtks)   detail.BPNT.push('Tidak terdaftar dalam DTKS/DTSEN Kemensos');
  if (!punya_kks)        detail.BPNT.push('Tidak memiliki Kartu Keluarga Sejahtera (KKS) aktif');
  if (!kondisi_darurat)  detail.BST.push('Tidak dalam kondisi darurat ekonomi (PHK mendadak, bencana, atau situasi mendesak)');
  if (!punya_usaha_mikro) detail['Bawaku Makmur'].push('Tidak memiliki usaha mikro atau usaha kecil yang aktif');

  const alasanUtama = !miskin
    ? `Penghasilan per kapita ${rp(penghasilan_per_kapita)} melebihi batas maksimum ${batas} yang ditetapkan Kemensos untuk seluruh program bantuan sosial`
    : 'Tidak memenuhi persyaratan spesifik dari keempat program bantuan sosial yang tersedia';

  return hasil('Tidak Memenuhi Kriteria', [alasanUtama], null, detail, penghasilan_per_kapita);
}

function hasil(kategori, alasan, dasarHukum, klasifikasiDetail, penghasilan_per_kapita) {
  return {
    kategori,
    alasan,
    dasarHukum: dasarHukum || null,
    klasifikasiDetail: klasifikasiDetail || null,
    penghasilan_per_kapita,
    rekomendasiUtama: kategori,
    skorPrioritas: PRIORITAS[kategori] || 0,
  };
}

module.exports = { rekomendasikanBantuan };