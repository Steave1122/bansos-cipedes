#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "=== SEED DATA SIMULASI BANSOS CIPEDES ==="

login() {
  local nik=$1
  local password=$2
  curl -s -X POST $BASE_URL/auth/warga/login \
    -H "Content-Type: application/json" \
    -d "{\"nik\":\"$nik\",\"password\":\"$password\"}" | \
    grep -o '"token":"[^"]*"' | cut -d'"' -f4
}

login_petugas() {
  local username=$1
  local password=$2
  curl -s -X POST $BASE_URL/auth/petugas/login \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$username\",\"password\":\"$password\"}" | \
    grep -o '"token":"[^"]*"' | cut -d'"' -f4
}

ajukan() {
  local token=$1
  local id_warga=$2
  local jenis=$3
  local keterangan=$4
  curl -s -X POST $BASE_URL/pengajuan \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $token" \
    -d "{\"id_warga\":$id_warga,\"jenis_bantuan\":\"$jenis\",\"keterangan\":\"$keterangan\"}" | \
    grep -o '"id_pengajuan":[0-9]*' | cut -d':' -f2
}

verifikasi() {
  local token=$1
  local id_pengajuan=$2
  local keputusan=$3
  local catatan=$4
  curl -s -X POST $BASE_URL/verifikasi \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $token" \
    -d "{\"id_pengajuan\":$id_pengajuan,\"keputusan\":\"$keputusan\",\"catatan\":\"$catatan\"}"
}

echo ""
echo ">>> Login semua petugas..."
TOKEN_RT=$(login_petugas "rt001" "password")
TOKEN_RW=$(login_petugas "rw001" "password")
TOKEN_IPSM=$(login_petugas "ipsm001" "password")
TOKEN_PUSKESOS=$(login_petugas "puskesos001" "password")
TOKEN_ADMIN=$(login_petugas "admin" "password")
echo "Semua token petugas berhasil"

echo ""
echo ">>> Warga 4 (Budi Santoso) — PKH — Disetujui penuh"
TOKEN_W4=$(login "3273010101990004" "password")
ID=$(ajukan "$TOKEN_W4" 4 "PKH" "Kepala keluarga tidak bekerja, memiliki 3 anak usia sekolah")
echo "Pengajuan ID: $ID"
sleep 1
verifikasi "$TOKEN_RT" $ID "Disetujui" "Kondisi ekonomi kurang, layak menerima PKH" > /dev/null
sleep 1
verifikasi "$TOKEN_RW" $ID "Disetujui" "Terverifikasi data lapangan" > /dev/null
sleep 1
verifikasi "$TOKEN_IPSM" $ID "Disetujui" "Sesuai kriteria IPSM" > /dev/null
sleep 1
verifikasi "$TOKEN_PUSKESOS" $ID "Disetujui" "Data kesehatan mendukung" > /dev/null
echo "Pengajuan Budi Santoso selesai verifikasi Puskesos"

echo ""
echo ">>> Warga 5 (Dewi Rahayu) — BPNT — Verifikasi IPSM"
TOKEN_W5=$(login "3273010101990005" "password")
ID=$(ajukan "$TOKEN_W5" 5 "BPNT" "Ibu rumah tangga dengan penghasilan suami di bawah UMR")
echo "Pengajuan ID: $ID"
sleep 1
verifikasi "$TOKEN_RT" $ID "Disetujui" "Layak menerima BPNT" > /dev/null
sleep 1
verifikasi "$TOKEN_RW" $ID "Disetujui" "Data valid" > /dev/null
echo "Pengajuan Dewi Rahayu sampai Verifikasi IPSM"

echo ""
echo ">>> Warga 6 (Hendra Gunawan) — BST — Ditolak RT"
TOKEN_W6=$(login "3273010101990006" "password")
ID=$(ajukan "$TOKEN_W6" 6 "BST" "Penghasilan tidak tetap sebagai buruh harian")
echo "Pengajuan ID: $ID"
sleep 1
verifikasi "$TOKEN_RT" $ID "Ditolak" "Data ekonomi tidak memenuhi syarat BST" > /dev/null
echo "Pengajuan Hendra Gunawan ditolak RT"

echo ""
echo ">>> Warga 7 (Fitri Handayani) — Bawaku Makmur — Verifikasi RW"
TOKEN_W7=$(login "3273010101990007" "password")
ID=$(ajukan "$TOKEN_W7" 7 "Bawaku Makmur" "Janda dengan 2 anak, tidak memiliki penghasilan tetap")
echo "Pengajuan ID: $ID"
sleep 1
verifikasi "$TOKEN_RT" $ID "Disetujui" "Kondisi sangat layak mendapat bantuan" > /dev/null
echo "Pengajuan Fitri Handayani sampai Verifikasi RW"

echo ""
echo ">>> Warga 8 (Rahmat Hidayat) — PKH — Diajukan"
TOKEN_W8=$(login "3273010101990008" "password")
ID=$(ajukan "$TOKEN_W8" 8 "PKH" "Petani kecil dengan lahan terbatas, penghasilan tidak mencukupi")
echo "Pengajuan ID: $ID"
echo "Pengajuan Rahmat Hidayat baru diajukan"

echo ""
echo "=== SEED DATA SELESAI ==="
echo "Cek di browser untuk melihat hasilnya"
