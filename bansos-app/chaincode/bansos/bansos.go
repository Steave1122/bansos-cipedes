package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type BansosContract struct {
	contractapi.Contract
}

type Pengajuan struct {
	ID               string `json:"id_pengajuan"`
	IDWarga          string `json:"id_warga"`
	NamaWarga        string `json:"nama_warga"`
	NIK              string `json:"nik"`
	JenisBantuan     string `json:"jenis_bantuan"`
	TanggalPengajuan string `json:"tanggal_pengajuan"`
	Status           string `json:"status_pengajuan"`
	Keterangan       string `json:"keterangan"`
	HashData         string `json:"hash_data"`
	TxID             string `json:"tx_id"`
	Timestamp        string `json:"timestamp"`
}

type Verifikasi struct {
	ID                string `json:"id_verifikasi"`
	IDPengajuan       string `json:"id_pengajuan"`
	IDPetugas         string `json:"id_petugas"`
	NamaPetugas       string `json:"nama_petugas"`
	TahapVerifikasi   string `json:"tahap_verifikasi"`
	Keputusan         string `json:"keputusan"`
	Catatan           string `json:"catatan"`
	TanggalVerifikasi string `json:"tanggal_verifikasi"`
	TxID              string `json:"tx_id"`
	Timestamp         string `json:"timestamp"`
}

type Penerima struct {
	ID            string `json:"id_penerima"`
	IDWarga       string `json:"id_warga"`
	IDPengajuan   string `json:"id_pengajuan"`
	NamaWarga     string `json:"nama_warga"`
	NIK           string `json:"nik"`
	TanggalDaftar string `json:"tanggal_daftar"`
	StatusAktif   bool   `json:"status_aktif"`
	TxID          string `json:"tx_id"`
	Timestamp     string `json:"timestamp"`
}

type KonfirmasiPenerimaan struct {
	ID                string `json:"id_konfirmasi"`
	IDPenerima        string `json:"id_penerima"`
	TanggalAmbil      string `json:"tanggal_ambil"`
	PeriodeBantuan    string `json:"periode_bantuan"`
	StatusVerifikasi  string `json:"status_verifikasi"`
	PetugasVerifikasi string `json:"petugas_verifikasi"`
	TxID              string `json:"tx_id"`
	Timestamp         string `json:"timestamp"`
}

func (c *BansosContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	fmt.Println("Bansos Chaincode Initialized")
	return nil
}

func (c *BansosContract) CatatPengajuan(ctx contractapi.TransactionContextInterface,
	idPengajuan string, idWarga string, namaWarga string, nik string,
	jenisBantuan string, tanggalPengajuan string, keterangan string, hashData string) error {

	existing, _ := ctx.GetStub().GetState("PENGAJUAN_" + idPengajuan)
	if existing != nil {
		return fmt.Errorf("pengajuan %s sudah ada", idPengajuan)
	}

	pengajuan := Pengajuan{
		ID:               idPengajuan,
		IDWarga:          idWarga,
		NamaWarga:        namaWarga,
		NIK:              nik,
		JenisBantuan:     jenisBantuan,
		TanggalPengajuan: tanggalPengajuan,
		Status:           "Diajukan",
		Keterangan:       keterangan,
		HashData:         hashData,
		TxID:             ctx.GetStub().GetTxID(),
		Timestamp:        time.Now().Format(time.RFC3339),
	}

	pengajuanJSON, err := json.Marshal(pengajuan)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState("PENGAJUAN_"+idPengajuan, pengajuanJSON)
}

func (c *BansosContract) CatatVerifikasi(ctx contractapi.TransactionContextInterface,
	idVerifikasi string, idPengajuan string, idPetugas string, namaPetugas string,
	tahapVerifikasi string, keputusan string, catatan string, tanggalVerifikasi string) error {

	existingVerifikasi, _ := ctx.GetStub().GetState("VERIFIKASI_" + idVerifikasi)
	if existingVerifikasi != nil {
		return fmt.Errorf("verifikasi %s sudah ada", idVerifikasi)
	}

	pengajuanBytes, err := ctx.GetStub().GetState("PENGAJUAN_" + idPengajuan)
	if err != nil || pengajuanBytes == nil {
		return fmt.Errorf("pengajuan %s tidak ditemukan", idPengajuan)
	}

	var pengajuan Pengajuan
	json.Unmarshal(pengajuanBytes, &pengajuan)

	statusMap := map[string]string{
		"RT":        "Verifikasi RT",
		"RW":        "Verifikasi RW",
		"IPSM":      "Verifikasi IPSM",
		"Puskesos":  "Verifikasi Puskesos",
		"Kelurahan": keputusan,
	}

	if keputusan == "Ditolak" {
		pengajuan.Status = "Ditolak"
	} else if status, ok := statusMap[tahapVerifikasi]; ok {
		pengajuan.Status = status
	}

	pengajuanJSON, _ := json.Marshal(pengajuan)
	ctx.GetStub().PutState("PENGAJUAN_"+idPengajuan, pengajuanJSON)

	verifikasi := Verifikasi{
		ID:                idVerifikasi,
		IDPengajuan:       idPengajuan,
		IDPetugas:         idPetugas,
		NamaPetugas:       namaPetugas,
		TahapVerifikasi:   tahapVerifikasi,
		Keputusan:         keputusan,
		Catatan:           catatan,
		TanggalVerifikasi: tanggalVerifikasi,
		TxID:              ctx.GetStub().GetTxID(),
		Timestamp:         time.Now().Format(time.RFC3339),
	}

	verifikasiJSON, err := json.Marshal(verifikasi)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState("VERIFIKASI_"+idVerifikasi, verifikasiJSON)
}

func (c *BansosContract) CatatPenerima(ctx contractapi.TransactionContextInterface,
	idPenerima string, idWarga string, idPengajuan string, namaWarga string,
	nik string, tanggalDaftar string) error {

	penerima := Penerima{
		ID:            idPenerima,
		IDWarga:       idWarga,
		IDPengajuan:   idPengajuan,
		NamaWarga:     namaWarga,
		NIK:           nik,
		TanggalDaftar: tanggalDaftar,
		StatusAktif:   true,
		TxID:          ctx.GetStub().GetTxID(),
		Timestamp:     time.Now().Format(time.RFC3339),
	}

	penerimaJSON, err := json.Marshal(penerima)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState("PENERIMA_"+idPenerima, penerimaJSON)
}

func (c *BansosContract) CatatKonfirmasi(ctx contractapi.TransactionContextInterface,
	idKonfirmasi string, idPenerima string, tanggalAmbil string,
	periodeBantuan string, petugasVerifikasi string) error {

	konfirmasi := KonfirmasiPenerimaan{
		ID:                idKonfirmasi,
		IDPenerima:        idPenerima,
		TanggalAmbil:      tanggalAmbil,
		PeriodeBantuan:    periodeBantuan,
		StatusVerifikasi:  "Berhasil",
		PetugasVerifikasi: petugasVerifikasi,
		TxID:              ctx.GetStub().GetTxID(),
		Timestamp:         time.Now().Format(time.RFC3339),
	}

	konfirmasiJSON, err := json.Marshal(konfirmasi)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState("KONFIRMASI_"+idKonfirmasi, konfirmasiJSON)
}

func (c *BansosContract) QueryPengajuan(ctx contractapi.TransactionContextInterface,
	idPengajuan string) (*Pengajuan, error) {

	pengajuanBytes, err := ctx.GetStub().GetState("PENGAJUAN_" + idPengajuan)
	if err != nil || pengajuanBytes == nil {
		return nil, fmt.Errorf("pengajuan %s tidak ditemukan", idPengajuan)
	}

	var pengajuan Pengajuan
	json.Unmarshal(pengajuanBytes, &pengajuan)
	return &pengajuan, nil
}

func (c *BansosContract) QueryPenerima(ctx contractapi.TransactionContextInterface,
	idPenerima string) (*Penerima, error) {

	penerimaBytes, err := ctx.GetStub().GetState("PENERIMA_" + idPenerima)
	if err != nil || penerimaBytes == nil {
		return nil, fmt.Errorf("penerima %s tidak ditemukan", idPenerima)
	}

	var penerima Penerima
	json.Unmarshal(penerimaBytes, &penerima)
	return &penerima, nil
}

func (c *BansosContract) QueryRiwayatPengajuan(ctx contractapi.TransactionContextInterface,
	idPengajuan string) ([]byte, error) {

	historyIterator, err := ctx.GetStub().GetHistoryForKey("PENGAJUAN_" + idPengajuan)
	if err != nil {
		return nil, err
	}
	defer historyIterator.Close()

	var history []map[string]interface{}
	for historyIterator.HasNext() {
		response, err := historyIterator.Next()
		if err != nil {
			return nil, err
		}

		record := map[string]interface{}{
			"tx_id":     response.TxId,
			"timestamp": response.Timestamp,
			"is_delete": response.IsDelete,
			"value":     string(response.Value),
		}
		history = append(history, record)
	}

	return json.Marshal(history)
}

func main() {
	chaincode, err := contractapi.NewChaincode(&BansosContract{})
	if err != nil {
		fmt.Printf("Error creating bansos chaincode: %s", err.Error())
		return
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("Error starting bansos chaincode: %s", err.Error())
	}
}