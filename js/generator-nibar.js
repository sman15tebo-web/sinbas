/**
 * GENERATOR NIBAR (NOMOR INDUK BARANG) & NOMOR REGISTER
 * Berdasarkan Ketentuan Permendagri No. 47 Tahun 2021 (Pasal 1 angka 26 & Pasal 46)
 *
 * Rumus NIBAR:
 * [NPSN_Sekolah] - [Kodefikasi_7_Level] - [Tahun_Perolehan] - [Nomor_Register_5_Digit]
 * Contoh: 10505963-1.3.2.05.01.01.001-2026-00001
 */

const NibarGenerator = {
    /**
     * Membentuk String NIBAR Resmi
     */
    buildNibar: function(npsn, kodeBarang, tahun, noRegister) {
        const cleanNpsn = (npsn || '10505963').toString().trim();
        const cleanKode = (kodeBarang || '1.3.2.05.01.01.001').toString().trim();
        const cleanTahun = (tahun || new Date().getFullYear()).toString().trim();
        const cleanReg = this.formatRegister(noRegister);

        return `${cleanNpsn}-${cleanKode}-${cleanTahun}-${cleanReg}`;
    },

    /**
     * Format Nomor Register menjadi 5 Digit Angka (misal: 1 -> 00001)
     */
    formatRegister: function(num) {
        const n = parseInt(num, 10) || 1;
        return n.toString().padStart(5, '0');
    },

    /**
     * Cari Nomor Register Berikutnya dari Database Lokal
     */
    getNextRegisterNumber: async function(db, kodeBarang, tahun) {
        try {
            const allAssets = await db.getAll('aset');
            const filtered = allAssets.filter(a =>
                a.kode_barang === kodeBarang &&
                parseInt(a.tahun_perolehan, 10) === parseInt(tahun, 10)
            );

            if (filtered.length === 0) {
                return 1;
            }

            let maxReg = 0;
            filtered.forEach(a => {
                const regVal = parseInt(a.no_register, 10);
                if (!isNaN(regVal) && regVal > maxReg) {
                    maxReg = regVal;
                }
            });

            return maxReg + 1;
        } catch (e) {
            console.error('[NibarGenerator] Gagal menghitung nomor register:', e);
            return 1;
        }
    },

    /**
     * Bedah String NIBAR Menjadi Komponen
     */
    parseNibar: function(nibarStr) {
        if (!nibarStr || typeof nibarStr !== 'string') return null;
        const parts = nibarStr.split('-');
        if (parts.length < 4) return null;
        return {
            npsn: parts[0],
            kode_barang: parts[1],
            tahun_perolehan: parts[2],
            no_register: parts[3]
        };
    },

    /**
     * Buat Data QR Code untuk Dicetak Sebagai Stiker Fisik Aset
     */
    createQrPayload: function(aset, profilSekolah) {
        return JSON.stringify({
            app: 'SINBAS',
            sekolah: profilSekolah.nama_sekolah || 'SMAN 15 Tebo',
            npsn: profilSekolah.npsn || '10505963',
            nibar: aset.nibar,
            nama: aset.spesifikasi_nama || aset.nama_barang,
            kode: aset.kode_barang,
            reg: aset.no_register,
            ruang: aset.ruangan_nama,
            tahun: aset.tahun_perolehan,
            kondisi: aset.kondisi
        });
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NibarGenerator;
}
