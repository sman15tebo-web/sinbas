/**
 * ============================================================
 * SINBAS EXCEL EXPORTER & DOKUMEN RESMI PERMENDAGRI
 * Format Baku Laporan Aset Berdasarkan:
 * 1. VERSI 2021: PERMENDAGRI NO. 47 TAHUN 2021 (Format Baru: DAFTAR BMD)
 * 2. VERSI 2016: PERMENDAGRI NO. 108 TAHUN 2016 (Format Klasik: KIB A - F)
 *
 * Fitur Utama:
 * - 7 Kolom Mandiri untuk Kodefikasi Barang (Akun s/d Sub-Sub Rincian)
 * - Garis Tabel Penuh (Borders), Cell Merges Rapi, Header Warna, Format Angka Akuntansi
 * - Terintegrasi dengan Pratinjau Dokumen Interaktif (Zoom, Cetak, Unduh)
 * ============================================================
 */

const SinbasExcelExporter = {
    /**
     * Memecah kode barang menjadi 7 tingkat kolom resmi Permendagri:
     * 1: Akun
     * 2: Kelompok
     * 3: Jenis
     * 4: Objek
     * 5: Rincian Objek
     * 6: Sub Rincian Objek
     * 7: Sub-Sub Rincian Objek
     */
    splitKode7Tingkat: function(kodeStr) {
        if (!kodeStr) return ['', '', '', '', '', '', ''];
        const clean = String(kodeStr).trim();
        const parts = clean.split('.');
        return [
            parts[0] || '',
            parts[1] || '',
            parts[2] || '',
            parts[3] || '',
            parts[4] || '',
            parts[5] || '',
            parts[6] || ''
        ];
    },

    /**
     * Parse data_khusus JSON string dengan aman
     */
    parseKhusus: function(dataKhususStr) {
        if (!dataKhususStr) return {};
        try {
            return typeof dataKhususStr === 'object' ? dataKhususStr : JSON.parse(dataKhususStr);
        } catch (_) {
            return {};
        }
    },

    /**
     * Format angka mata uang rupiah untuk display preview
     */
    formatCurrency: function(num) {
        return 'Rp ' + (Number(num) || 0).toLocaleString('id-ID');
    },

    /**
     * Membersihkan nama Kabupaten/Kota untuk titi mangsa tanda tangan laporan:
     * Menyembunyikan kata 'Kabupaten' / 'Kota' / 'Kab.'
     * Contoh: 'Kabupaten Pandeglang' -> 'Pandeglang', 'Kabupaten Tebo' -> 'Tebo'
     */
    cleanKotaNama: function(kabKotaStr) {
        if (!kabKotaStr) return 'Tebo';
        let s = String(kabKotaStr).trim();
        s = s.replace(/^(kabupaten|kota|kab\.?)\s+/i, '').trim();
        if (!s) return 'Tebo';
        return s.split(/\s+/).map(word => {
            if (!word) return '';
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(' ');
    },

    /**
     * Pencarian nama resmi kodefikasi Permendagri berdasarkan tingkat hirarki:
     * - Tingkat 3 (Jenis, misal 1.3.2)
     * - Tingkat 4 (Objek, misal 1.3.2.05)
     * - Tingkat 5 (Rincian Objek, misal 1.3.2.05.02)
     * - Tingkat 6 (Sub Rincian Objek, misal 1.3.2.05.02.01)
     */
    lookupHierarchyName: function(kode) {
        if (!kode) return '';
        const clean = String(kode).trim();
        const parts = clean.split('.');

        if (parts.length === 3) {
            if (typeof PERMENDAGRI_JENIS !== 'undefined') {
                const found = PERMENDAGRI_JENIS.find(j => j.kode === clean);
                if (found && found.nama) return found.nama;
            }
            const jenisMap = {
                '1.3.1': 'TANAH',
                '1.3.2': 'PERALATAN DAN MESIN',
                '1.3.3': 'GEDUNG DAN BANGUNAN',
                '1.3.4': 'JALAN, JARINGAN DAN IRIGASI',
                '1.3.5': 'ASET TETAP LAINNYA',
                '1.3.6': 'KONSTRUKSI DALAM PENGERJAAN'
            };
            return jenisMap[clean] || 'JENIS BARANG';
        }

        if (parts.length === 4) {
            if (typeof PERMENDAGRI_OBJEK !== 'undefined') {
                const found = PERMENDAGRI_OBJEK.find(o => o.k === clean);
                if (found && found.n) return found.n;
                const norm = `${parts[0]}.${parts[1]}.${parts[2]}.${parts[3].padStart(2, '0')}`;
                const foundNorm = PERMENDAGRI_OBJEK.find(o => o.k === norm);
                if (foundNorm && foundNorm.n) return foundNorm.n;
            }
            return 'OBJEK BARANG';
        }

        if (parts.length === 5) {
            if (typeof PERMENDAGRI_RINCIAN !== 'undefined') {
                const found = PERMENDAGRI_RINCIAN.find(r => r.k === clean);
                if (found && found.n) return found.n;
                const norm = `${parts[0]}.${parts[1]}.${parts[2]}.${parts[3].padStart(2, '0')}.${parts[4].padStart(2, '0')}`;
                const foundNorm = PERMENDAGRI_RINCIAN.find(r => r.k === norm);
                if (foundNorm && foundNorm.n) return foundNorm.n;
            }
            return 'RINCIAN OBJEK';
        }

        if (parts.length === 6) {
            if (typeof PERMENDAGRI_SUB_RINCIAN !== 'undefined') {
                const found = PERMENDAGRI_SUB_RINCIAN.find(s => s.k === clean);
                if (found && found.n) return found.n;
                const norm = `${parts[0]}.${parts[1]}.${parts[2]}.${parts[3].padStart(2, '0')}.${parts[4].padStart(2, '0')}.${parts[5].padStart(2, '0')}`;
                const foundNorm = PERMENDAGRI_SUB_RINCIAN.find(s => s.k === norm);
                if (foundNorm && foundNorm.n) return foundNorm.n;
            }
            return 'SUB RINCIAN OBJEK';
        }

        return '';
    },

    /**
     * Memastikan semua aset di Versi 2021 tampil persatuan barang fisik (1 baris per unit fisik).
     * Jika ada aset dengan jumlah > 1 dalam 1 record, diekspansi menjadi record persatuan unit.
     */
    expandToSingleUnits: function(assets) {
        const units = [];
        (assets || []).forEach(ast => {
            const qty = Math.max(1, parseInt(ast.jumlah, 10) || 1);
            if (qty === 1) {
                // Pastikan jika no_register ada, nibar juga sinkron dengan no_register (ujung NIBAR = no_register)
                let cleanNibar = ast.nibar || '-';
                if (cleanNibar && cleanNibar !== '-' && ast.no_register) {
                    const regStr = String(ast.no_register).padStart(5, '0');
                    if (cleanNibar.includes('-')) {
                        const parts = cleanNibar.split('-');
                        if (parts.length >= 4) {
                            parts[parts.length - 1] = regStr;
                            cleanNibar = parts.join('-');
                        }
                    }
                }
                units.push({ ...ast, nibar: cleanNibar });
            } else {
                const baseReg = parseInt(ast.no_register, 10) || 1;
                const baseSpek = (ast.spesifikasi_nama || ast.nama_barang || '').replace(/\s*\(Unit\s*#?\d+\)$/i, '');
                const hargaSatuan = Number(ast.harga_satuan) || (Number(ast.nilai_total) / qty) || 0;

                // Ambil NPSN, Kode, Tahun untuk membangun NIBAR resmi
                let npsn = (typeof appProfile !== 'undefined' && appProfile.npsn) || '10505963';
                let kode = ast.kode_barang || '1.3.2.05.01.01.001';
                let tahun = ast.tahun_perolehan || new Date().getFullYear();

                if (ast.nibar && typeof ast.nibar === 'string' && ast.nibar.includes('-')) {
                    const p = ast.nibar.split('-');
                    if (p.length >= 4) {
                        npsn = p[0] || npsn;
                        kode = p[1] || kode;
                        tahun = p[2] || tahun;
                    }
                }

                for (let i = 0; i < qty; i++) {
                    const regNum = baseReg + i;
                    const regStr = String(regNum).padStart(5, '0');

                    // Struktur baku NIBAR resmi: NPSN-kode barang-tahun perolehan-register
                    // Contoh: 10505963-1.3.5.01.01.01.001-2025-00003
                    let nibarUnit = '';
                    if (typeof NibarGenerator !== 'undefined' && typeof NibarGenerator.buildNibar === 'function') {
                        nibarUnit = NibarGenerator.buildNibar(npsn, kode, tahun, regStr);
                    } else {
                        nibarUnit = `${npsn}-${kode}-${tahun}-${regStr}`;
                    }

                    units.push({
                        ...ast,
                        base_asset_id: ast.id,
                        id: `${ast.id || 'AST'}-unit-${i + 1}`,
                        no_register: regStr,
                        nibar: nibarUnit,
                        spesifikasi_nama: `${baseSpek} (Unit #${i + 1})`,
                        jumlah: 1,
                        harga_satuan: hargaSatuan,
                        nilai_total: hargaSatuan
                    });
                }
            }
        });
        return units;
    },

    /**
     * Mengelompokkan aset untuk Versi 2016 (Permendagri 108/2016):
     * Pengadaan multi-unit (misal 5 barang) digabung menjadi 1 baris akumulatif:
     * - Nomor Register: '00001 s/d 00005'
     * - Jumlah: akumulasi total unit (misal 5)
     * - Harga: akumulasi total nilai (misal 5 x harga satuan)
     * - Tanpa kolom NIBAR
     */
    groupAssetsFor2016: function(assets) {
        const batchMap = new Map();
        (assets || []).forEach(ast => {
            let key = ast.batch_id;
            if (!key) {
                key = `${ast.kode_barang}__${ast.nama_barang}__${ast.tahun_perolehan}__${ast.harga_satuan}__${ast.tanggal_perolehan || ''}`;
            }
            if (!batchMap.has(key)) {
                batchMap.set(key, []);
            }
            batchMap.get(key).push(ast);
        });

        const aggregated = [];
        batchMap.forEach(group => {
            group.sort((a, b) => (parseInt(a.no_register, 10) || 0) - (parseInt(b.no_register, 10) || 0));
            const first = group[0];
            const last = group[group.length - 1];
            const totalQty = group.reduce((sum, u) => sum + (Number(u.jumlah) || 1), 0);
            const totalNilai = group.reduce((sum, u) => sum + (Number(u.nilai_total || u.harga_satuan) || 0), 0);

            let regDisplay = first.no_register || '00001';
            if (group.length > 1 && last.no_register && last.no_register !== first.no_register) {
                regDisplay = `${first.no_register} s/d ${last.no_register}`;
            }

            let seriDisplay = first.no_pabrik_seri || '-';
            if (group.length > 1 && last.no_pabrik_seri && last.no_pabrik_seri !== first.no_pabrik_seri && first.no_pabrik_seri !== '-') {
                seriDisplay = `${first.no_pabrik_seri} s/d ${last.no_pabrik_seri}`;
            }

            const cleanSpek = (first.spesifikasi_nama || first.nama_barang || '').replace(/\s*\(Unit\s*#?\d+\)$/i, '');

            aggregated.push({
                ...first,
                spesifikasi_nama: cleanSpek,
                no_register_display: regDisplay,
                no_pabrik_seri_display: seriDisplay,
                jumlah_kumulatif: totalQty,
                nilai_kumulatif: totalNilai,
                unit_count: group.length
            });
        });

        return aggregated;
    },

    /**
     * Membentuk baris hirarki tingkatan kodefikasi Permendagri 47/2021:
     * - Level 3 (Jenis): Warna A (Soft Blue)
     * - Level 4 (Objek): Warna B (Soft Indigo)
     * - Level 5 (Rincian): Warna C (Soft Mint)
     * - Level 6 (Sub Rincian): Warna D (Soft Amber)
     */
    createHierarchyRow: function(level, codeParts, name, subtotalQty, subtotalNilai, totalColsCount, jumlahCol0Based, hargaCol0Based) {
        const row = new Array(totalColsCount).fill('');
        for (let c = 0; c < level; c++) {
            row[c] = codeParts[c] || '';
        }
        row[7] = name;
        row[8] = '';
        row[9] = '';

        if (jumlahCol0Based >= 0 && jumlahCol0Based < totalColsCount) {
            row[jumlahCol0Based] = subtotalQty;
        }
        if (hargaCol0Based >= 0 && hargaCol0Based < totalColsCount) {
            row[hargaCol0Based] = subtotalNilai;
        }

        if (level === 3) row.rowType = 'jenis';
        else if (level === 4) row.rowType = 'objek';
        else if (level === 5) row.rowType = 'rincian';
        else if (level === 6) row.rowType = 'subrincian';

        return row;
    },

    /**
     * Membentuk baris fisik persatuan barang (Tingkat 7) di Versi 2021:
     * Menampilkan NIBAR unik, Nomor Register unik, spesifikasi fisik, dan harga satuan
     */
    createItemRow2021: function(ast, idx, type, profile) {
        const k = this.parseKhusus(ast.data_khusus);
        const hargaSatuan = Number(ast.harga_satuan) || 0;
        const nilai = Number(ast.nilai_total || ast.harga_satuan) || 0;
        const qty = Number(ast.jumlah) || 1;
        const kd = this.splitKode7Tingkat(ast.kode_barang);
        let rowCols = [kd[0], kd[1], kd[2], kd[3], kd[4], kd[5], kd[6]];

        if (type === 'A') {
            rowCols.push(
                ast.nama_barang || 'Tanah',
                ast.nibar || '-',
                ast.no_register || String(idx + 1).padStart(5, '0'),
                ast.spesifikasi_nama || ast.nama_barang,
                ast.bahan || k.spesifikasi_lain || '-',
                Number(k.luas_m2 || ast.jumlah || 0),
                'm²',
                k.alamat_letak || profile.alamat || '-',
                k.titik_koordinat || k.koordinat || '-',
                k.status_hak || 'Sertifikat Hak Pakai',
                k.no_sertifikat || ast.no_pabrik_seri || '-',
                k.tgl_sertifikat || ast.tanggal_perolehan || '-',
                profile.nama_sekolah || 'Pemerintah Provinsi',
                hargaSatuan,
                nilai,
                ast.asal_usul || 'Pemerintah Daerah',
                ast.tanggal_perolehan || `${ast.tahun_perolehan}-01-01`,
                'Digunakan Sendiri oleh Kuasa Pengguna Barang',
                ast.keterangan || `Kondisi: ${ast.kondisi || 'Baik'}`
            );
        } else if (type === 'B') {
            rowCols.push(
                ast.nama_barang || 'Peralatan dan Mesin',
                ast.nibar || '-',
                ast.no_register || String(idx + 1).padStart(5, '0'),
                ast.spesifikasi_nama || ast.nama_barang,
                ast.merk_tipe || '-',
                `${ast.bahan ? 'Bahan: ' + ast.bahan : ''} ${k.cc_ukuran ? '| CC/Uk: ' + k.cc_ukuran : ''}`.trim() || '-',
                ast.ruangan_nama || 'SMAN 15 TEBO',
                k.no_polisi || '-',
                k.no_rangka || ast.no_pabrik_seri || '-',
                k.no_bpkb || k.no_mesin || '-',
                qty,
                ast.satuan || 'Unit',
                hargaSatuan,
                nilai,
                ast.asal_usul || 'BOS Reguler',
                ast.tanggal_perolehan || `${ast.tahun_perolehan}-01-01`,
                'Digunakan Sendiri oleh Kuasa Pengguna Barang',
                `Kondisi: ${ast.kondisi || 'Baik'} ${ast.keterangan ? '| ' + ast.keterangan : ''}`
            );
        } else if (type === 'C') {
            const jmlLantai = k.jumlah_lantai || (k.konstruksi_bertingkat === 'Ya' || k.konstruksi_bertingkat === 'Bertingkat' ? 2 : 1);
            const spekLain = k.spesifikasi_lain || `${k.konstruksi_bertingkat ? k.konstruksi_bertingkat + ' / ' : ''}${k.konstruksi_beton || 'Beton'}`.trim();
            const statusTanah = k.status_hak_tanah || k.status_hak || 'Milik Pemerintah Daerah';
            rowCols.push(
                ast.nama_barang || 'Gedung dan Bangunan',
                ast.nibar || '-',
                ast.no_register || String(idx + 1).padStart(5, '0'),
                ast.spesifikasi_nama || ast.nama_barang,
                spekLain,
                jmlLantai,
                k.alamat_letak || profile.alamat || 'Komplek SMAN 15 Tebo',
                k.titik_koordinat || k.koordinat || '-',
                statusTanah,
                Number(k.luas_lantai || ast.jumlah || 0),
                ast.satuan || 'm²',
                hargaSatuan,
                nilai,
                ast.asal_usul || 'Pemerintah Daerah',
                ast.tanggal_perolehan || `${ast.tahun_perolehan}-01-01`,
                profile.nama_sekolah ? `Digunakan oleh ${profile.nama_sekolah}` : 'Digunakan Sendiri oleh Kuasa Pengguna Barang',
                ast.keterangan || `Kondisi: ${ast.kondisi || 'Baik'}`
            );
        } else if (type === 'D') {
            const spekLain = k.spesifikasi_lain || k.konstruksi || `${k.panjang_km ? 'P:' + k.panjang_km + 'km' : ''} ${k.lebar_m ? 'L:' + k.lebar_m + 'm' : ''}`.trim() || '-';
            const noRuas = k.nomor_ruas || k.no_dokumen || ast.no_pabrik_seri || '-';
            const statusTanah = k.status_tanah || k.status_hak_tanah || 'Milik Pemerintah Daerah';
            rowCols.push(
                ast.nama_barang || 'Jalan, Irigasi dan Jaringan',
                ast.nibar || '-',
                ast.no_register || String(idx + 1).padStart(5, '0'),
                ast.spesifikasi_nama || ast.nama_barang,
                spekLain,
                noRuas,
                k.lokasi || k.alamat_letak || profile.alamat || 'Komplek SMAN 15 Tebo',
                k.titik_koordinat || k.koordinat || '-',
                statusTanah,
                Number(k.panjang_km || k.luas_m2 || ast.jumlah || 1),
                ast.satuan || k.satuan || 'm',
                hargaSatuan,
                nilai,
                ast.asal_usul || 'BOS Reguler',
                ast.tanggal_perolehan || `${ast.tahun_perolehan}-01-01`,
                profile.nama_sekolah ? `Digunakan oleh ${profile.nama_sekolah}` : 'Digunakan Sendiri oleh Kuasa Pengguna Barang',
                ast.keterangan || `Kondisi: ${ast.kondisi || 'Baik'}`
            );
        } else if (type === 'E') {
            const spekNama = k.judul_pengarang || ast.spesifikasi_nama || ast.nama_barang;
            const spekLain = `${k.spesifikasi_buku || ast.merk_tipe || '-'} ${k.asal_daerah ? '| Asal: ' + k.asal_daerah : ''}`.trim() || '-';
            const lokasi = ast.ruangan_nama || 'Perpustakaan SMAN 15 TEBO';
            rowCols.push(
                ast.nama_barang || 'Aset Tetap Lainnya',
                ast.nibar || '-',
                ast.no_register || String(idx + 1).padStart(5, '0'),
                spekNama,
                spekLain,
                lokasi,
                qty,
                ast.satuan || 'Eks / Buah',
                hargaSatuan,
                nilai,
                ast.asal_usul || 'BOS Reguler',
                ast.tanggal_perolehan || `${ast.tahun_perolehan}-01-01`,
                profile.nama_sekolah ? `Digunakan oleh ${profile.nama_sekolah}` : 'Digunakan Sendiri oleh Kuasa Pengguna Barang',
                `Kondisi: ${ast.kondisi || 'Baik'} ${ast.keterangan ? '| ' + ast.keterangan : ''}`.trim()
            );
        } else if (type === 'F') {
            const spekNama = ast.spesifikasi_nama || ast.nama_barang;
            const spekLain = `${k.konstruksi_bangunan || 'Bertingkat / Beton'} ${k.no_kontrak ? '| Kontrak: ' + k.no_kontrak : ''}`.trim() || '-';
            const lokasi = k.lokasi || profile.alamat || 'Komplek SMAN 15 Tebo';
            const luasRencana = Number(k.luas_rencana_m2 || ast.jumlah || 1);
            rowCols.push(
                ast.nama_barang || 'Konstruksi dalam Pengerjaan',
                ast.nibar || '-',
                ast.no_register || String(idx + 1).padStart(5, '0'),
                spekNama,
                spekLain,
                lokasi,
                luasRencana,
                ast.satuan || 'm²',
                hargaSatuan,
                nilai,
                ast.asal_usul || 'APBD',
                k.tgl_mulai || ast.tanggal_perolehan || `${ast.tahun_perolehan}-01-01`,
                profile.nama_sekolah ? `Dalam Pengerjaan oleh ${profile.nama_sekolah}` : 'Dalam Pengerjaan oleh Kuasa Pengguna Barang',
                `${k.status_tanah ? 'Status Tanah: ' + k.status_tanah : ''} ${ast.keterangan ? '| ' + ast.keterangan : ''}`.trim() || 'KDP Aktif'
            );
        }

        rowCols.rowType = 'item';
        return rowCols;
    },

    /**
     * Membentuk baris fisik persatuan barang (Tingkat 7) untuk Buku Inventaris BMD Lengkap:
     * Menampung seluruh data spesifik KIB A s/d F ke dalam kolom standar Permendagri 47/2021
     */
    createItemRowUnified2021: function(ast, idx, profile) {
        const type = (ast.kib_type || 'B').toUpperCase();
        const k = this.parseKhusus(ast.data_khusus);
        const hargaSatuan = Number(ast.harga_satuan) || 0;
        const nilai = Number(ast.nilai_total || ast.harga_satuan) || 0;
        const qty = Number(ast.jumlah) || 1;
        const kd = this.splitKode7Tingkat(ast.kode_barang);
        const defaultJenis = (type === 'A' ? ['1','3','1'] : type === 'B' ? ['1','3','2'] : type === 'C' ? ['1','3','3'] : type === 'D' ? ['1','3','4'] : type === 'E' ? ['1','3','5'] : ['1','3','6']);

        const c0 = (kd[0] === '1' && kd[1] === '3') ? kd[0] : defaultJenis[0];
        const c1 = (kd[0] === '1' && kd[1] === '3') ? kd[1] : defaultJenis[1];
        const c2 = (kd[0] === '1' && kd[1] === '3') ? kd[2] : defaultJenis[2];
        const c3 = (kd[0] === '1' && kd[1] === '3') ? kd[3] : (kd[0] || '01');
        const c4 = (kd[0] === '1' && kd[1] === '3') ? kd[4] : (kd[1] || '01');
        const c5 = (kd[0] === '1' && kd[1] === '3') ? kd[5] : (kd[2] || '01');
        const c6 = (kd[0] === '1' && kd[1] === '3') ? kd[6] : (kd[3] || String(idx + 1).padStart(3, '0'));

        let rowCols = [c0, c1, c2, c3, c4, c5, c6];

        let spekNama = ast.spesifikasi_nama || ast.nama_barang || '-';
        let spekLain = '-';
        let lokasiRuang = ast.ruangan_nama || '-';
        let satuan = ast.satuan || 'Unit';
        let keterangan = ast.keterangan || 'Digunakan Sendiri';

        if (type === 'A') {
            spekLain = [
                k.luas_m2 ? `Luas: ${k.luas_m2} m²` : '',
                k.status_hak ? `Hak: ${k.status_hak}` : '',
                k.no_sertifikat ? `Sertifikat: ${k.no_sertifikat}` : '',
                k.tgl_sertifikat ? `Tgl: ${k.tgl_sertifikat}` : '',
                k.titik_koordinat ? `Koord: ${k.titik_koordinat}` : ''
            ].filter(Boolean).join(' | ') || '-';
            lokasiRuang = k.alamat_letak || profile.alamat || 'SMAN 15 TEBO';
            satuan = 'm²';
            keterangan = k.penggunaan || 'Pendidikan / Gedung Sekolah';
        } else if (type === 'B') {
            spekLain = [
                ast.merk_tipe ? `Merk: ${ast.merk_tipe}` : '',
                ast.no_pabrik_seri ? `No. Pabrik: ${ast.no_pabrik_seri}` : '',
                k.no_polisi ? `Nopol: ${k.no_polisi}` : '',
                k.no_rangka ? `Rangka: ${k.no_rangka}` : '',
                k.no_mesin ? `Mesin: ${k.no_mesin}` : '',
                k.no_bpkb ? `BPKB: ${k.no_bpkb}` : '',
                ast.bahan ? `Bahan: ${ast.bahan}` : '',
                k.cc_ukuran ? `Uk/CC: ${k.cc_ukuran}` : ''
            ].filter(Boolean).join(' | ') || '-';
            satuan = ast.satuan || 'Unit';
        } else if (type === 'C') {
            spekLain = [
                k.luas_lantai ? `Luas Lantai: ${k.luas_lantai} m²` : '',
                k.jumlah_lantai ? `Jml Lantai: ${k.jumlah_lantai}` : '',
                k.konstruksi_bertingkat ? `Tingkat: ${k.konstruksi_bertingkat}` : '',
                k.konstruksi_beton ? `Beton: ${k.konstruksi_beton}` : '',
                k.status_hak_tanah ? `Status Tanah: ${k.status_hak_tanah}` : '',
                k.titik_koordinat ? `Koord: ${k.titik_koordinat}` : ''
            ].filter(Boolean).join(' | ') || '-';
            lokasiRuang = k.alamat_letak || profile.alamat || 'SMAN 15 TEBO';
            satuan = 'm²';
        } else if (type === 'D') {
            spekLain = [
                k.konstruksi ? `Konstruksi: ${k.konstruksi}` : '',
                k.panjang_km ? `Panjang: ${k.panjang_km} km` : '',
                k.lebar_m ? `Lebar: ${k.lebar_m} m` : '',
                k.nomor_ruas ? `No. Ruas: ${k.nomor_ruas}` : '',
                k.no_dokumen ? `Dok: ${k.no_dokumen}` : '',
                k.status_tanah ? `Status Tanah: ${k.status_tanah}` : ''
            ].filter(Boolean).join(' | ') || '-';
            lokasiRuang = k.lokasi || profile.alamat || 'SMAN 15 TEBO';
            satuan = ast.satuan || 'm';
        } else if (type === 'E') {
            spekNama = k.judul_pengarang || ast.spesifikasi_nama || ast.nama_barang || '-';
            spekLain = [
                k.penerbit ? `Penerbit: ${k.penerbit}` : '',
                k.tahun_terbit ? `Th Terbit: ${k.tahun_terbit}` : '',
                k.asal_daerah ? `Asal: ${k.asal_daerah}` : '',
                k.spesifikasi_buku ? `Spek: ${k.spesifikasi_buku}` : '',
                ast.bahan ? `Bahan: ${ast.bahan}` : ''
            ].filter(Boolean).join(' | ') || '-';
            lokasiRuang = ast.ruangan_nama || 'Perpustakaan';
            satuan = ast.satuan || 'Eks';
        } else if (type === 'F') {
            spekLain = [
                k.no_kontrak ? `SPK: ${k.no_kontrak}` : '',
                k.luas_rencana_m2 ? `Rencana Luas: ${k.luas_rencana_m2} m²` : '',
                k.konstruksi_bangunan ? `Konstruksi: ${k.konstruksi_bangunan}` : '',
                k.status_tanah ? `Status Tanah: ${k.status_tanah}` : ''
            ].filter(Boolean).join(' | ') || '-';
            lokasiRuang = k.lokasi || profile.alamat || 'SMAN 15 TEBO';
            satuan = 'm²';
            keterangan = 'KDP (Dalam Pengerjaan)';
        }

        rowCols.push(
            ast.nama_barang || 'Barang Milik Daerah', // (8) Nama Barang
            type,                                     // (9) KIB
            ast.nibar || '-',                         // (10) NIBAR
            ast.no_register || String(idx + 1).padStart(5, '0'), // (11) Register
            spekNama,                                 // (12) Spesifikasi Nama / Merk
            spekLain,                                 // (13) Spesifikasi Tambahan & Dokumen
            lokasiRuang,                              // (14) Ruangan / Lokasi
            qty,                                      // (15) Jumlah (Qty)
            satuan,                                   // (16) Satuan
            ast.tahun_perolehan || '-',               // (17) Tahun
            ast.kondisi || 'Baik',                    // (18) Kondisi
            hargaSatuan,                              // (19) Harga Satuan (Rp)
            nilai,                                    // (20) Nilai Perolehan (Rp)
            ast.asal_usul || 'Pemerintah Daerah',     // (21) Asal-Usul
            keterangan                                // (22) Penggunaan / Keterangan
        );

        rowCols.rowType = 'item';
        rowCols.astId = ast.base_asset_id || ast.id;
        return rowCols;
    },

    /**
     * -------------------------------------------------------------------------
     * MODEL VERSI 2: PERMENDAGRI NO. 47 TAHUN 2021 (DAFTAR BMD)
     * Format resmi Lampiran III Permendagri No. 47 Tahun 2021:
     * Sesuai dengan petunjuk pengisian angka (3) s/d (22)
     * -------------------------------------------------------------------------
     */
    getKibModel2021: function(kibType, assets, profile) {
        const type = (kibType || 'B').toUpperCase();
        const filtered = (assets || []).filter(a => a.kib_type === type);
        const p = profile || {};

        let namaKelompok = 'Peralatan dan Mesin';
        let headersL1 = [];
        let headersL2 = [];
        let colIndices = [];
        let colWidths = [];
        let hargaColIndex = 18; // 1-based index kolom Nilai Perolehan
        let hargaSatuanColIndex = 17;

        if (type === 'A') {
            namaKelompok = 'Tanah';
            headersL1 = [
                { label: 'Kode Barang', colspan: 7 },
                { label: 'Nama Barang', rowspan: 2 },
                { label: 'NIBAR', rowspan: 2 },
                { label: 'Nomor Register', rowspan: 2 },
                { label: 'Spesifikasi Nama Barang', rowspan: 2 },
                { label: 'Spesifikasi Lainnya', rowspan: 2 },
                { label: 'Jumlah (Luas)', rowspan: 2 },
                { label: 'Satuan', rowspan: 2 },
                { label: 'Lokasi / Alamat', rowspan: 2 },
                { label: 'Titik Koordinat', rowspan: 2 },
                { label: 'Bukti Kepemilikan', colspan: 4 },
                { label: 'Harga Satuan Perolehan (Rp)', rowspan: 2 },
                { label: 'Nilai Perolehan (Rp)', rowspan: 2 },
                { label: 'Cara Perolehan', rowspan: 2 },
                { label: 'Tanggal Perolehan', rowspan: 2 },
                { label: 'Status Penggunaan', rowspan: 2 },
                { label: 'Keterangan', rowspan: 2 }
            ];
            headersL2 = [
                { label: '1', title: 'Akun' }, { label: '2', title: 'Kelompok' }, { label: '3', title: 'Jenis' },
                { label: '4', title: 'Objek' }, { label: '5', title: 'Rincian Objek' }, { label: '6', title: 'Sub Rincian' },
                { label: '7', title: 'Sub-Sub Rincian' },
                { label: 'Nama Dokumen' }, { label: 'Nomor' }, { label: 'Tanggal' }, { label: 'Nama Pemilik Dokumen' }
            ];
            colIndices = [
                '(3a)', '(3b)', '(3c)', '(3d)', '(3e)', '(3f)', '(3g)',
                '(4)', '(5)', '(6)', '(7)', '(8)', '(9)', '(10)', '(11)', '(12)',
                '(13)', '(14)', '(15)', '(16)', '(17)', '(18)', '(19)', '(20)', '(21)', '(22)'
            ];
            colWidths = [
                { width: 4.5 }, { width: 4.5 }, { width: 4.5 }, { width: 5.5 }, { width: 5.5 }, { width: 5.5 }, { width: 6.5 },
                { width: 28 }, { width: 28 }, { width: 12 }, { width: 26 }, { width: 18 }, { width: 12 }, { width: 8 },
                { width: 24 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 12 }, { width: 20 },
                { width: 16 }, { width: 18 }, { width: 16 }, { width: 12 }, { width: 22 }, { width: 20 }
            ];
            hargaSatuanColIndex = 21;
            hargaColIndex = 22;
        } else if (type === 'B') {
            namaKelompok = 'Peralatan dan Mesin';
            headersL1 = [
                { label: 'Kode Barang', colspan: 7 },
                { label: 'Nama Barang', rowspan: 2 },
                { label: 'NIBAR', rowspan: 2 },
                { label: 'Nomor Register', rowspan: 2 },
                { label: 'Spesifikasi Nama Barang', rowspan: 2 },
                { label: 'Merek / Tipe', rowspan: 2 },
                { label: 'Spesifikasi Lainnya', rowspan: 2 },
                { label: 'Lokasi (Ruangan)', rowspan: 2 },
                { label: 'Kendaraan Dinas *)', colspan: 3 },
                { label: 'Jumlah', rowspan: 2 },
                { label: 'Satuan', rowspan: 2 },
                { label: 'Harga Satuan Perolehan (Rp)', rowspan: 2 },
                { label: 'Nilai Perolehan (Rp)', rowspan: 2 },
                { label: 'Cara Perolehan', rowspan: 2 },
                { label: 'Tanggal Perolehan', rowspan: 2 },
                { label: 'Status Penggunaan', rowspan: 2 },
                { label: 'Keterangan', rowspan: 2 }
            ];
            headersL2 = [
                { label: '1', title: 'Akun' }, { label: '2', title: 'Kelompok' }, { label: '3', title: 'Jenis' },
                { label: '4', title: 'Objek' }, { label: '5', title: 'Rincian Objek' }, { label: '6', title: 'Sub Rincian' },
                { label: '7', title: 'Sub-Sub Rincian' },
                { label: 'Nomor Polisi' }, { label: 'Nomor Rangka' }, { label: 'Nomor BPKB / Pabrik' }
            ];
            colIndices = [
                '(4a)', '(4b)', '(4c)', '(4d)', '(4e)', '(4f)', '(4g)',
                '(5)', '(6)', '(7)', '(8)', '(9)', '(10)', '(11)',
                '(12)', '(13)', '(14)', '(15)', '(16)', '(17)', '(18)', '(19)', '(20)', '(21)', '(22)'
            ];
            colWidths = [
                { width: 4.5 }, { width: 4.5 }, { width: 4.5 }, { width: 5.5 }, { width: 5.5 }, { width: 5.5 }, { width: 6.5 },
                { width: 28 }, { width: 28 }, { width: 12 }, { width: 26 }, { width: 18 }, { width: 18 }, { width: 20 },
                { width: 14 }, { width: 16 }, { width: 18 }, { width: 10 }, { width: 10 }, { width: 16 }, { width: 18 },
                { width: 16 }, { width: 12 }, { width: 22 }, { width: 20 }
            ];
            hargaSatuanColIndex = 20;
            hargaColIndex = 21;
        } else if (type === 'C') {
            namaKelompok = 'Gedung dan Bangunan';
            headersL1 = [
                { label: 'Kode Barang', colspan: 7 },
                { label: 'Nama Barang', rowspan: 2 },
                { label: 'NIBAR', rowspan: 2 },
                { label: 'Nomor Register', rowspan: 2 },
                { label: 'Spesifikasi Nama Barang', rowspan: 2 },
                { label: 'Spesifikasi Lainnya', rowspan: 2 },
                { label: 'Jumlah Lantai', rowspan: 2 },
                { label: 'Lokasi', rowspan: 2 },
                { label: 'Titik Koordinat', rowspan: 2 },
                { label: 'Status Kepemilikan Tanah', rowspan: 2 },
                { label: 'Jumlah', rowspan: 2 },
                { label: 'Satuan', rowspan: 2 },
                { label: 'Harga Satuan Perolehan (Rp)', rowspan: 2 },
                { label: 'Nilai Perolehan (Rp)', rowspan: 2 },
                { label: 'Cara Perolehan', rowspan: 2 },
                { label: 'Tanggal Perolehan', rowspan: 2 },
                { label: 'Status Penggunaan', rowspan: 2 },
                { label: 'Keterangan', rowspan: 2 }
            ];
            headersL2 = [
                { label: '1', title: 'Akun' }, { label: '2', title: 'Kelompok' }, { label: '3', title: 'Jenis' },
                { label: '4', title: 'Objek' }, { label: '5', title: 'Rincian Objek' }, { label: '6', title: 'Sub Rincian' },
                { label: '7', title: 'Sub-Sub Rincian' }
            ];
            colIndices = [
                '(4a)', '(4b)', '(4c)', '(4d)', '(4e)', '(4f)', '(4g)',
                '(5)', '(6)', '(7)', '(8)', '(9)', '(10)', '(11)', '(12)', '(13)',
                '(14)', '(15)', '(16)', '(17)', '(18)', '(19)', '(20)', '(21)'
            ];
            colWidths = [
                { width: 4.5 }, { width: 4.5 }, { width: 4.5 }, { width: 5.5 }, { width: 5.5 }, { width: 5.5 }, { width: 6.5 },
                { width: 28 }, { width: 28 }, { width: 12 }, { width: 26 }, { width: 18 }, { width: 14 },
                { width: 24 }, { width: 16 }, { width: 22 }, { width: 12 }, { width: 8 },
                { width: 18 }, { width: 18 }, { width: 16 }, { width: 12 }, { width: 24 }, { width: 20 }
            ];
            hargaSatuanColIndex = 19;
            hargaColIndex = 20;
        } else if (type === 'D') {
            namaKelompok = 'Jalan, Irigasi dan Jaringan';
            headersL1 = [
                { label: 'Kode Barang', colspan: 7 },
                { label: 'Nama Barang', rowspan: 2 },
                { label: 'NIBAR', rowspan: 2 },
                { label: 'Nomor Register', rowspan: 2 },
                { label: 'Spesifikasi Nama Barang', rowspan: 2 },
                { label: 'Spesifikasi Lainnya', rowspan: 2 },
                { label: 'Nomor Ruas Jalan / Jembatan / Jaringan Irigasi', rowspan: 2 },
                { label: 'Lokasi', rowspan: 2 },
                { label: 'Titik Koordinat', rowspan: 2 },
                { label: 'Status Kepemilikan Tanah', rowspan: 2 },
                { label: 'Jumlah', rowspan: 2 },
                { label: 'Satuan', rowspan: 2 },
                { label: 'Harga Satuan Perolehan (Rp)', rowspan: 2 },
                { label: 'Nilai Perolehan (Rp)', rowspan: 2 },
                { label: 'Cara Perolehan', rowspan: 2 },
                { label: 'Tanggal Perolehan', rowspan: 2 },
                { label: 'Status Penggunaan', rowspan: 2 },
                { label: 'Keterangan', rowspan: 2 }
            ];
            headersL2 = [
                { label: '1', title: 'Akun' }, { label: '2', title: 'Kelompok' }, { label: '3', title: 'Jenis' },
                { label: '4', title: 'Objek' }, { label: '5', title: 'Rincian Objek' }, { label: '6', title: 'Sub Rincian' },
                { label: '7', title: 'Sub-Sub Rincian' }
            ];
            colIndices = [
                '(4a)', '(4b)', '(4c)', '(4d)', '(4e)', '(4f)', '(4g)',
                '(5)', '(6)', '(7)', '(8)', '(9)', '(10)', '(11)', '(12)', '(13)',
                '(14)', '(15)', '(16)', '(17)', '(18)', '(19)', '(20)', '(21)'
            ];
            colWidths = [
                { width: 4.5 }, { width: 4.5 }, { width: 4.5 }, { width: 5.5 }, { width: 5.5 }, { width: 5.5 }, { width: 6.5 },
                { width: 28 }, { width: 28 }, { width: 12 }, { width: 26 }, { width: 18 }, { width: 24 },
                { width: 24 }, { width: 16 }, { width: 22 }, { width: 12 }, { width: 8 },
                { width: 18 }, { width: 18 }, { width: 16 }, { width: 12 }, { width: 24 }, { width: 20 }
            ];
            hargaSatuanColIndex = 19;
            hargaColIndex = 20;
        } else if (type === 'E') {
            namaKelompok = 'Aset Tetap Lainnya';
            headersL1 = [
                { label: 'Kode Barang', colspan: 7 },
                { label: 'Nama Barang', rowspan: 2 },
                { label: 'NIBAR', rowspan: 2 },
                { label: 'Nomor Register', rowspan: 2 },
                { label: 'Spesifikasi Nama Barang', rowspan: 2 },
                { label: 'Spesifikasi Lainnya', rowspan: 2 },
                { label: 'Lokasi', rowspan: 2 },
                { label: 'Jumlah', rowspan: 2 },
                { label: 'Satuan', rowspan: 2 },
                { label: 'Harga Satuan Perolehan (Rp)', rowspan: 2 },
                { label: 'Nilai Perolehan (Rp)', rowspan: 2 },
                { label: 'Cara Perolehan', rowspan: 2 },
                { label: 'Tanggal Perolehan', rowspan: 2 },
                { label: 'Status Penggunaan', rowspan: 2 },
                { label: 'Keterangan', rowspan: 2 }
            ];
            headersL2 = [
                { label: '1', title: 'Akun' }, { label: '2', title: 'Kelompok' }, { label: '3', title: 'Jenis' },
                { label: '4', title: 'Objek' }, { label: '5', title: 'Rincian Objek' }, { label: '6', title: 'Sub Rincian' },
                { label: '7', title: 'Sub-Sub Rincian' }
            ];
            colIndices = [
                '(4a)', '(4b)', '(4c)', '(4d)', '(4e)', '(4f)', '(4g)',
                '(5)', '(6)', '(7)', '(8)', '(9)', '(10)',
                '(11)', '(12)', '(13)', '(14)', '(15)', '(16)', '(17)', '(18)'
            ];
            colWidths = [
                { width: 4.5 }, { width: 4.5 }, { width: 4.5 }, { width: 5.5 }, { width: 5.5 }, { width: 5.5 }, { width: 6.5 },
                { width: 28 }, { width: 28 }, { width: 12 }, { width: 26 }, { width: 22 }, { width: 24 },
                { width: 10 }, { width: 10 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 14 }, { width: 24 }, { width: 20 }
            ];
            hargaSatuanColIndex = 16;
            hargaColIndex = 17;
        } else if (type === 'F') {
            namaKelompok = 'Konstruksi Dalam Pengerjaan';
            headersL1 = [
                { label: 'Kode Barang', colspan: 7 },
                { label: 'Nama Barang', rowspan: 2 },
                { label: 'NIBAR', rowspan: 2 },
                { label: 'Nomor Register', rowspan: 2 },
                { label: 'Spesifikasi Nama Barang', rowspan: 2 },
                { label: 'Spesifikasi Lainnya', rowspan: 2 },
                { label: 'Lokasi', rowspan: 2 },
                { label: 'Jumlah', rowspan: 2 },
                { label: 'Satuan', rowspan: 2 },
                { label: 'Harga Satuan Perolehan (Rp)', rowspan: 2 },
                { label: 'Nilai Perolehan (Rp)', rowspan: 2 },
                { label: 'Cara Perolehan', rowspan: 2 },
                { label: 'Tanggal Perolehan', rowspan: 2 },
                { label: 'Status Penggunaan', rowspan: 2 },
                { label: 'Keterangan', rowspan: 2 }
            ];
            headersL2 = [
                { label: '1', title: 'Akun' }, { label: '2', title: 'Kelompok' }, { label: '3', title: 'Jenis' },
                { label: '4', title: 'Objek' }, { label: '5', title: 'Rincian Objek' }, { label: '6', title: 'Sub Rincian' },
                { label: '7', title: 'Sub-Sub Rincian' }
            ];
            colIndices = [
                '(4a)', '(4b)', '(4c)', '(4d)', '(4e)', '(4f)', '(4g)',
                '(5)', '(6)', '(7)', '(8)', '(9)', '(10)',
                '(11)', '(12)', '(13)', '(14)', '(15)', '(16)', '(17)', '(18)'
            ];
            colWidths = [
                { width: 4.5 }, { width: 4.5 }, { width: 4.5 }, { width: 5.5 }, { width: 5.5 }, { width: 5.5 }, { width: 6.5 },
                { width: 28 }, { width: 28 }, { width: 12 }, { width: 26 }, { width: 22 }, { width: 24 },
                { width: 10 }, { width: 10 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 14 }, { width: 24 }, { width: 20 }
            ];
            hargaSatuanColIndex = 16;
            hargaColIndex = 17;
        }

        // Indeks kolom Jumlah dan Nilai Perolehan (0-based) untuk subtotal hirarki
        let jumlahCol0Based = 17; // default KIB B
        let hargaCol0Based = 20;  // default KIB B

        if (type === 'A') {
            jumlahCol0Based = 12;
            hargaCol0Based = 21;
        } else if (type === 'B') {
            jumlahCol0Based = 17;
            hargaCol0Based = 20;
        } else if (type === 'C') {
            jumlahCol0Based = 16;
            hargaCol0Based = 19;
        } else if (type === 'D') {
            jumlahCol0Based = 16;
            hargaCol0Based = 19;
        } else if (type === 'E') {
            jumlahCol0Based = 13;
            hargaCol0Based = 16;
        } else if (type === 'F') {
            jumlahCol0Based = 13;
            hargaCol0Based = 16;
        }

        // 1. Pastikan setiap fisik aset tampil persatuan barang (Qty = 1) berurutan
        const unitItems = this.expandToSingleUnits(filtered);
        unitItems.sort((a, b) => {
            const ka = String(a.kode_barang || '');
            const kb = String(b.kode_barang || '');
            if (ka !== kb) return ka.localeCompare(kb);
            return (parseInt(a.no_register, 10) || 0) - (parseInt(b.no_register, 10) || 0);
        });

        // 2. Bangun Pohon Hirarki Bertingkat:
        // Tingkat 3 (Jenis) -> Tingkat 4 (Objek) -> Tingkat 5 (Rincian) -> Tingkat 6 (Sub Rincian) -> Tingkat 7 (Item Fisik)
        const tree = new Map();

        unitItems.forEach(item => {
            const kd = this.splitKode7Tingkat(item.kode_barang);
            const defaultJenis = (type === 'A' ? ['1','3','1'] : type === 'B' ? ['1','3','2'] : type === 'C' ? ['1','3','3'] : type === 'D' ? ['1','3','4'] : type === 'E' ? ['1','3','5'] : ['1','3','6']);
            const c0 = kd[0] || defaultJenis[0];
            const c1 = kd[1] || defaultJenis[1];
            const c2 = kd[2] || defaultJenis[2];
            const c3 = kd[3] || '01';
            const c4 = kd[4] || '01';
            const c5 = kd[5] || '01';

            const keyL3 = `${c0}.${c1}.${c2}`;
            const keyL4 = `${keyL3}.${c3}`;
            const keyL5 = `${keyL4}.${c4}`;
            const keyL6 = `${keyL5}.${c5}`;

            const itemQty = Number(item.jumlah) || 1;
            const itemNilai = Number(item.nilai_total || item.harga_satuan) || 0;

            if (!tree.has(keyL3)) {
                tree.set(keyL3, {
                    codeParts: [c0, c1, c2],
                    name: this.lookupHierarchyName(keyL3) || namaKelompok.toUpperCase(),
                    qty: 0,
                    nilai: 0,
                    objekMap: new Map()
                });
            }
            const nodeL3 = tree.get(keyL3);
            nodeL3.qty += itemQty;
            nodeL3.nilai += itemNilai;

            if (!nodeL3.objekMap.has(keyL4)) {
                nodeL3.objekMap.set(keyL4, {
                    codeParts: [c0, c1, c2, c3],
                    name: this.lookupHierarchyName(keyL4) || 'OBJEK ' + keyL4,
                    qty: 0,
                    nilai: 0,
                    rincianMap: new Map()
                });
            }
            const nodeL4 = nodeL3.objekMap.get(keyL4);
            nodeL4.qty += itemQty;
            nodeL4.nilai += itemNilai;

            if (!nodeL4.rincianMap.has(keyL5)) {
                nodeL4.rincianMap.set(keyL5, {
                    codeParts: [c0, c1, c2, c3, c4],
                    name: this.lookupHierarchyName(keyL5) || 'RINCIAN ' + keyL5,
                    qty: 0,
                    nilai: 0,
                    subRincianMap: new Map()
                });
            }
            const nodeL5 = nodeL4.rincianMap.get(keyL5);
            nodeL5.qty += itemQty;
            nodeL5.nilai += itemNilai;

            if (!nodeL5.subRincianMap.has(keyL6)) {
                nodeL5.subRincianMap.set(keyL6, {
                    codeParts: [c0, c1, c2, c3, c4, c5],
                    name: this.lookupHierarchyName(keyL6) || 'SUB RINCIAN ' + keyL6,
                    qty: 0,
                    nilai: 0,
                    items: []
                });
            }
            const nodeL6 = nodeL5.subRincianMap.get(keyL6);
            nodeL6.qty += itemQty;
            nodeL6.nilai += itemNilai;

            nodeL6.items.push(item);
        });

        // 3. Susun Baris Terstruktur dengan Warna Berbeda Tiap Tingkatan
        let totalNilai = 0;
        let totalJumlah = 0;
        const rows = [];
        let itemIndex = 0;
        const totalCols = colWidths.length;

        tree.forEach(n3 => {
            totalNilai += n3.nilai;
            totalJumlah += n3.qty;

            // Tingkat 3 (Jenis, misal 1.3.2) - Warna A (Soft Blue)
            rows.push(this.createHierarchyRow(3, n3.codeParts, n3.name, n3.qty, n3.nilai, totalCols, jumlahCol0Based, hargaCol0Based));

            n3.objekMap.forEach(n4 => {
                // Tingkat 4 (Objek, misal 1.3.2.05) - Warna B (Soft Indigo)
                rows.push(this.createHierarchyRow(4, n4.codeParts, n4.name, n4.qty, n4.nilai, totalCols, jumlahCol0Based, hargaCol0Based));

                n4.rincianMap.forEach(n5 => {
                    // Tingkat 5 (Rincian Objek, misal 1.3.2.05.02) - Warna C (Soft Mint)
                    rows.push(this.createHierarchyRow(5, n5.codeParts, n5.name, n5.qty, n5.nilai, totalCols, jumlahCol0Based, hargaCol0Based));

                    n5.subRincianMap.forEach(n6 => {
                        // Tingkat 6 (Sub Rincian, misal 1.3.2.05.02.01) - Warna D (Soft Amber)
                        rows.push(this.createHierarchyRow(6, n6.codeParts, n6.name, n6.qty, n6.nilai, totalCols, jumlahCol0Based, hargaCol0Based));

                        // Tingkat 7 (Item Fisik Satuan dengan NIBAR & No Register) - Warna Putih
                        n6.items.forEach(itm => {
                            rows.push(this.createItemRow2021(itm, itemIndex++, type, p));
                        });
                    });
                });
            });
        });

        return {
            version: '2021',
            regulasi: 'PERMENDAGRI NOMOR 47 TAHUN 2021',
            kibType: type,
            namaKelompok: namaKelompok,
            title: `DAFTAR BMD\n${namaKelompok.toUpperCase()}`,
            subTitleIntra: ['B', 'C', 'D', 'E', 'F'].includes(type) ? 'INTRAKOMPTABEL/EKSTRAKOMPTABEL/GABUNGAN INTRAKOMPTABEL DAN EKSTRAKOMPTABEL' : '',
            profile: p,
            headersL1: headersL1,
            headersL2: headersL2,
            colIndices: colIndices,
            colWidths: colWidths,
            rows: rows,
            totalNilai: totalNilai,
            totalJumlah: totalJumlah,
            hargaSatuanColIndex: hargaSatuanColIndex,
            hargaColIndex: hargaColIndex,
            totalColsCount: colWidths.length
        };
    },

    /**
     * -------------------------------------------------------------------------
     * MODEL VERSI 1: PERMENDAGRI NO. 108 TAHUN 2016 (KIB KLASIK A - F)
     * Format standar KIB A s/d F dengan 7 kolom kodefikasi barang
     * -------------------------------------------------------------------------
     */
    getKibModel2016: function(kibType, assets, profile) {
        const type = (kibType || 'B').toUpperCase();
        const filtered = (assets || []).filter(a => a.kib_type === type);
        const p = profile || {};

        let namaKelompok = 'Peralatan dan Mesin';
        let headersL1 = [];
        let headersL2 = [];
        let colWidths = [];
        let hargaColIndex = 14;

        if (type === 'A') {
            namaKelompok = 'Tanah';
            headersL1 = [
                { label: 'No.', rowspan: 2 },
                { label: 'NOMOR KODE BARANG', colspan: 7 },
                { label: 'Jenis Barang / Nama Barang', rowspan: 2 },
                { label: 'Nomor Register', rowspan: 2 },
                { label: 'Luas (m²)', rowspan: 2 },
                { label: 'Tahun Pengadaan', rowspan: 2 },
                { label: 'Letak / Alamat', rowspan: 2 },
                { label: 'Status Hak Tanah', rowspan: 2 },
                { label: 'Sertifikat Tanah', colspan: 2 },
                { label: 'Penggunaan', rowspan: 2 },
                { label: 'Asal-Usul Perolehan', rowspan: 2 },
                { label: 'Harga (Rp)', rowspan: 2 },
                { label: 'Keterangan', rowspan: 2 }
            ];
            headersL2 = [
                { label: '1', title: 'Akun' }, { label: '2', title: 'Kelompok' }, { label: '3', title: 'Jenis' },
                { label: '4', title: 'Objek' }, { label: '5', title: 'Rincian Objek' }, { label: '6', title: 'Sub Rincian' },
                { label: '7', title: 'Sub-Sub Rincian' },
                { label: 'Tanggal' }, { label: 'Nomor' }
            ];
            colWidths = [
                { width: 5 },
                { width: 4.5 }, { width: 4.5 }, { width: 4.5 }, { width: 5.5 }, { width: 5.5 }, { width: 5.5 }, { width: 6.5 },
                { width: 30 }, { width: 28 }, { width: 12 }, { width: 10 }, { width: 26 }, { width: 16 },
                { width: 12 }, { width: 20 }, { width: 22 }, { width: 18 }, { width: 18 }, { width: 20 }
            ];
            hargaColIndex = 19;
        } else if (type === 'B') {
            namaKelompok = 'Peralatan dan Mesin';
            headersL1 = [
                { label: 'No.', rowspan: 2 },
                { label: 'NOMOR KODE BARANG', colspan: 7 },
                { label: 'Nama Barang / Jenis Barang', rowspan: 2 },
                { label: 'Nomor Register', rowspan: 2 },
                { label: 'Merk / Type', rowspan: 2 },
                { label: 'Ukuran / CC', rowspan: 2 },
                { label: 'Bahan', rowspan: 2 },
                { label: 'Tahun Perolehan', rowspan: 2 },
                { label: 'Nomor Identitas Barang', colspan: 5 },
                { label: 'Asal-Usul Perolehan', rowspan: 2 },
                { label: 'Harga (Rp)', rowspan: 2 },
                { label: 'Keterangan (Kondisi / Ruang)', rowspan: 2 }
            ];
            headersL2 = [
                { label: '1', title: 'Akun' }, { label: '2', title: 'Kelompok' }, { label: '3', title: 'Jenis' },
                { label: '4', title: 'Objek' }, { label: '5', title: 'Rincian Objek' }, { label: '6', title: 'Sub Rincian' },
                { label: '7', title: 'Sub-Sub Rincian' },
                { label: 'Pabrik' }, { label: 'Rangka' }, { label: 'Mesin' }, { label: 'Polisi' }, { label: 'BPKB' }
            ];
            colWidths = [
                { width: 5 },
                { width: 4.5 }, { width: 4.5 }, { width: 4.5 }, { width: 5.5 }, { width: 5.5 }, { width: 5.5 }, { width: 6.5 },
                { width: 30 }, { width: 28 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 10 },
                { width: 16 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 24 }
            ];
            hargaColIndex = 21;
        } else if (type === 'C') {
            namaKelompok = 'Gedung dan Bangunan';
            headersL1 = [
                { label: 'No.', rowspan: 2 },
                { label: 'NOMOR KODE BARANG', colspan: 7 },
                { label: 'Nama Barang / Jenis Barang', rowspan: 2 },
                { label: 'Nomor Register', rowspan: 2 },
                { label: 'Kondisi Bangunan (B/RR/RB)', rowspan: 2 },
                { label: 'Konstruksi Bangunan', colspan: 2 },
                { label: 'Luas Lantai (m²)', rowspan: 2 },
                { label: 'Letak / Lokasi Alamat', rowspan: 2 },
                { label: 'Dokumen Gedung', colspan: 2 },
                { label: 'Luas Tanah (m²)', rowspan: 2 },
                { label: 'Status Hak Tanah', rowspan: 2 },
                { label: 'Nomor Kode Tanah', rowspan: 2 },
                { label: 'Asal-Usul Perolehan', rowspan: 2 },
                { label: 'Harga (Rp)', rowspan: 2 },
                { label: 'Keterangan', rowspan: 2 }
            ];
            headersL2 = [
                { label: '1', title: 'Akun' }, { label: '2', title: 'Kelompok' }, { label: '3', title: 'Jenis' },
                { label: '4', title: 'Objek' }, { label: '5', title: 'Rincian Objek' }, { label: '6', title: 'Sub Rincian' },
                { label: '7', title: 'Sub-Sub Rincian' },
                { label: 'Bertingkat' }, { label: 'Beton' },
                { label: 'Tanggal' }, { label: 'Nomor' }
            ];
            colWidths = [
                { width: 5 },
                { width: 4.5 }, { width: 4.5 }, { width: 4.5 }, { width: 5.5 }, { width: 5.5 }, { width: 5.5 }, { width: 6.5 },
                { width: 30 }, { width: 28 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 26 },
                { width: 12 }, { width: 20 }, { width: 12 }, { width: 16 }, { width: 20 }, { width: 18 }, { width: 18 }, { width: 22 }
            ];
            hargaColIndex = 22;
        } else if (type === 'D') {
            namaKelompok = 'Jalan, Irigasi, dan Jaringan';
            headersL1 = [
                { label: 'No.', rowspan: 2 },
                { label: 'NOMOR KODE BARANG', colspan: 7 },
                { label: 'Nama Barang / Jenis Barang', rowspan: 2 },
                { label: 'Nomor Register', rowspan: 2 },
                { label: 'Konstruksi', rowspan: 2 },
                { label: 'Panjang (Km/M)', rowspan: 2 },
                { label: 'Lebar (M)', rowspan: 2 },
                { label: 'Luas (m²)', rowspan: 2 },
                { label: 'Letak / Lokasi Alamat', rowspan: 2 },
                { label: 'Dokumen Kepemilikan', colspan: 2 },
                { label: 'Status Tanah', rowspan: 2 },
                { label: 'Nomor Kode Tanah', rowspan: 2 },
                { label: 'Asal-Usul Perolehan', rowspan: 2 },
                { label: 'Kondisi (B/RR/RB)', rowspan: 2 },
                { label: 'Harga (Rp)', rowspan: 2 },
                { label: 'Keterangan', rowspan: 2 }
            ];
            headersL2 = [
                { label: '1', title: 'Akun' }, { label: '2', title: 'Kelompok' }, { label: '3', title: 'Jenis' },
                { label: '4', title: 'Objek' }, { label: '5', title: 'Rincian Objek' }, { label: '6', title: 'Sub Rincian' },
                { label: '7', title: 'Sub-Sub Rincian' },
                { label: 'Tanggal' }, { label: 'Nomor' }
            ];
            colWidths = [
                { width: 5 },
                { width: 4.5 }, { width: 4.5 }, { width: 4.5 }, { width: 5.5 }, { width: 5.5 }, { width: 5.5 }, { width: 6.5 },
                { width: 30 }, { width: 28 }, { width: 18 }, { width: 12 }, { width: 10 }, { width: 12 }, { width: 26 },
                { width: 12 }, { width: 20 }, { width: 16 }, { width: 20 }, { width: 18 }, { width: 12 }, { width: 18 }, { width: 22 }
            ];
            hargaColIndex = 22;
        } else if (type === 'E') {
            namaKelompok = 'Aset Tetap Lainnya (Buku & Kesenian)';
            headersL1 = [
                { label: 'No.', rowspan: 2 },
                { label: 'NOMOR KODE BARANG', colspan: 7 },
                { label: 'Nama Barang / Jenis Barang', rowspan: 2 },
                { label: 'Nomor Register', rowspan: 2 },
                { label: 'Buku Perpustakaan', colspan: 2 },
                { label: 'Barang Bercorak Kesenian', colspan: 2 },
                { label: 'Hewan Ternak / Tanaman', colspan: 2 },
                { label: 'Jumlah (Qty)', rowspan: 2 },
                { label: 'Tahun Perolehan', rowspan: 2 },
                { label: 'Asal-Usul Perolehan', rowspan: 2 },
                { label: 'Kondisi (B/RR/RB)', rowspan: 2 },
                { label: 'Harga (Rp)', rowspan: 2 },
                { label: 'Keterangan', rowspan: 2 }
            ];
            headersL2 = [
                { label: '1', title: 'Akun' }, { label: '2', title: 'Kelompok' }, { label: '3', title: 'Jenis' },
                { label: '4', title: 'Objek' }, { label: '5', title: 'Rincian Objek' }, { label: '6', title: 'Sub Rincian' },
                { label: '7', title: 'Sub-Sub Rincian' },
                { label: 'Judul / Pengarang' }, { label: 'Spesifikasi' },
                { label: 'Asal Daerah' }, { label: 'Pencipta / Bahan' },
                { label: 'Jenis' }, { label: 'Ukuran' }
            ];
            colWidths = [
                { width: 5 },
                { width: 4.5 }, { width: 4.5 }, { width: 4.5 }, { width: 5.5 }, { width: 5.5 }, { width: 5.5 }, { width: 6.5 },
                { width: 30 }, { width: 28 }, { width: 22 }, { width: 18 }, { width: 16 }, { width: 18 },
                { width: 14 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 18 }, { width: 12 }, { width: 18 }, { width: 22 }
            ];
            hargaColIndex = 21;
        } else if (type === 'F') {
            namaKelompok = 'Konstruksi dalam Pengerjaan (KDP)';
            headersL1 = [
                { label: 'No.', rowspan: 2 },
                { label: 'NOMOR KODE BARANG', colspan: 7 },
                { label: 'Nama Barang / Bangunan', rowspan: 2 },
                { label: 'Bangunan (Bertingkat / Beton)', rowspan: 2 },
                { label: 'Luas Rencana (m²)', rowspan: 2 },
                { label: 'Letak / Lokasi Alamat', rowspan: 2 },
                { label: 'Dokumen Kontrak', colspan: 2 },
                { label: 'Tgl. Mulai Pengerjaan', rowspan: 2 },
                { label: 'Status Tanah', rowspan: 2 },
                { label: 'Nomor Kode Tanah', rowspan: 2 },
                { label: 'Asal-Usul Pembiayaan', rowspan: 2 },
                { label: 'Nilai Kontrak (Rp)', rowspan: 2 },
                { label: 'Keterangan', rowspan: 2 }
            ];
            headersL2 = [
                { label: '1', title: 'Akun' }, { label: '2', title: 'Kelompok' }, { label: '3', title: 'Jenis' },
                { label: '4', title: 'Objek' }, { label: '5', title: 'Rincian Objek' }, { label: '6', title: 'Sub Rincian' },
                { label: '7', title: 'Sub-Sub Rincian' },
                { label: 'Tanggal' }, { label: 'Nomor' }
            ];
            colWidths = [
                { width: 5 },
                { width: 4.5 }, { width: 4.5 }, { width: 4.5 }, { width: 5.5 }, { width: 5.5 }, { width: 5.5 }, { width: 6.5 },
                { width: 30 }, { width: 18 }, { width: 14 }, { width: 26 }, { width: 12 }, { width: 20 },
                { width: 14 }, { width: 16 }, { width: 20 }, { width: 18 }, { width: 18 }, { width: 22 }
            ];
            hargaColIndex = 19;
        }

        // Pengelompokan Data Akumulatif untuk Versi 2016 (Tanpa NIBAR, 5 barang = 1 baris akumulasi)
        const aggregated = this.groupAssetsFor2016(filtered);
        let totalNilai = 0;
        const rows = [];

        aggregated.forEach((ast, idx) => {
            const k = this.parseKhusus(ast.data_khusus);
            const nilai = Number(ast.nilai_kumulatif || ast.nilai_total || ast.harga_satuan) || 0;
            totalNilai += nilai;

            const kd = this.splitKode7Tingkat(ast.kode_barang);
            let rowCols = [idx + 1, kd[0], kd[1], kd[2], kd[3], kd[4], kd[5], kd[6]];

            if (type === 'A') {
                rowCols.push(
                    ast.spesifikasi_nama || ast.nama_barang,
                    ast.no_register_display || ast.no_register || '-',
                    k.luas_m2 || '-',
                    ast.tahun_perolehan || '-',
                    k.alamat_letak || p.alamat || '-',
                    k.status_hak || 'Hak Pakai',
                    k.tgl_sertifikat || '-',
                    k.no_sertifikat || ast.no_pabrik_seri_display || ast.no_pabrik_seri || '-',
                    k.penggunaan || 'Pendidikan / Gedung Sekolah',
                    ast.asal_usul || 'Pemerintah Daerah',
                    nilai,
                    ast.keterangan || '-'
                );
            } else if (type === 'B') {
                const infoUnit = (ast.unit_count > 1 || ast.jumlah_kumulatif > 1) ? ` (${ast.unit_count || ast.jumlah_kumulatif} Unit)` : '';
                rowCols.push(
                    (ast.spesifikasi_nama || ast.nama_barang) + infoUnit,
                    ast.no_register_display || ast.no_register || '-',
                    ast.merk_tipe || '-',
                    k.cc_ukuran || '-',
                    ast.bahan || '-',
                    ast.tahun_perolehan || '-',
                    ast.no_pabrik_seri_display || ast.no_pabrik_seri || '-',
                    k.no_rangka || '-',
                    k.no_mesin || '-',
                    k.no_polisi || '-',
                    k.no_bpkb || '-',
                    ast.asal_usul || 'BOS Reguler',
                    nilai,
                    `Kondisi: ${ast.kondisi || 'Baik'} | Ruang: ${ast.ruangan_nama || '-'}`
                );
            } else if (type === 'C') {
                rowCols.push(
                    ast.spesifikasi_nama || ast.nama_barang,
                    ast.no_register_display || ast.no_register || '-',
                    ast.kondisi || 'Baik',
                    k.konstruksi_bertingkat || 'Tidak',
                    k.konstruksi_beton || 'Beton',
                    k.luas_lantai || '-',
                    p.alamat || '-',
                    k.tgl_dokumen_gedung || ast.tanggal_perolehan || '-',
                    k.no_dokumen_gedung || ast.no_pabrik_seri_display || ast.no_pabrik_seri || '-',
                    k.luas_tanah_m2 || '-',
                    k.status_hak_tanah || 'Hak Pakai',
                    k.kode_tanah || '1.3.1.01.01.01.001',
                    ast.asal_usul || 'Pemerintah Daerah',
                    nilai,
                    ast.keterangan || '-'
                );
            } else if (type === 'D') {
                rowCols.push(
                    ast.spesifikasi_nama || ast.nama_barang,
                    ast.no_register_display || ast.no_register || '-',
                    k.konstruksi || 'Jaringan / Instalasi Terpadu',
                    k.panjang_km || '-',
                    k.lebar_m || '-',
                    k.luas_m2 || '-',
                    k.lokasi || p.alamat || '-',
                    k.tgl_dokumen || ast.tanggal_perolehan || '-',
                    k.no_dokumen || ast.no_pabrik_seri_display || ast.no_pabrik_seri || '-',
                    k.status_tanah || 'Milik Sekolah',
                    k.kode_tanah || '1.3.1.01.01.01.001',
                    ast.asal_usul || 'BOS Reguler',
                    ast.kondisi || 'Baik',
                    nilai,
                    ast.keterangan || '-'
                );
            } else if (type === 'E') {
                rowCols.push(
                    ast.spesifikasi_nama || ast.nama_barang,
                    ast.no_register_display || ast.no_register || '-',
                    k.judul_pengarang || ast.spesifikasi_nama || '-',
                    k.spesifikasi_buku || '-',
                    k.asal_daerah || '-',
                    k.pencipta_bahan || '-',
                    k.jenis_hewan_tumbuhan || '-',
                    k.ukuran_volume || '-',
                    ast.jumlah_kumulatif || ast.jumlah || 1,
                    ast.tahun_perolehan || '-',
                    ast.asal_usul || 'BOS Reguler',
                    ast.kondisi || 'Baik',
                    nilai,
                    ast.keterangan || '-'
                );
            } else if (type === 'F') {
                rowCols.push(
                    ast.spesifikasi_nama || ast.nama_barang,
                    k.konstruksi_bangunan || 'Bertingkat / Beton',
                    k.luas_rencana_m2 || '-',
                    k.lokasi || p.alamat || '-',
                    k.tgl_kontrak || ast.tanggal_perolehan || '-',
                    k.no_kontrak || ast.no_pabrik_seri || '-',
                    k.tgl_mulai || '-',
                    k.status_tanah || 'Milik Daerah',
                    k.kode_tanah || '1.3.1.01.01.01.001',
                    ast.asal_usul || 'APBD',
                    nilai,
                    ast.keterangan || '-'
                );
            }

            rows.push(rowCols);
        });

        const totalColsCount = colWidths.length;
        const colIndices = [];
        for (let i = 1; i <= totalColsCount; i++) {
            colIndices.push(`(${i})`);
        }

        return {
            version: '2016',
            regulasi: 'PERMENDAGRI NOMOR 108 TAHUN 2016',
            kibType: type,
            namaKelompok: namaKelompok,
            title: `KARTU INVENTARIS BARANG (KIB ${type}) - ${namaKelompok.toUpperCase()}`,
            subtitle: `BERDASARKAN PERMENDAGRI NOMOR 108 TAHUN 2016 (KODEFIKASI 7 TINGKAT)`,
            profile: p,
            headersL1: headersL1,
            headersL2: headersL2,
            colIndices: colIndices,
            colWidths: colWidths,
            rows: rows,
            totalNilai: totalNilai,
            hargaColIndex: hargaColIndex,
            totalColsCount: totalColsCount
        };
    },

    /**
     * Dispatcher model berdasarkan versi yang dipilih
     */
    getKibModel: function(kibType, assets, profile, version = '2021') {
        if (String(version) === '2016') {
            return this.getKibModel2016(kibType, assets, profile);
        }
        return this.getKibModel2021(kibType, assets, profile);
    },

    /**
     * -------------------------------------------------------------------------
     * RENDER HTML PRATINJAU DOKUMEN RESMI (VERSI 2021 ATAU VERSI 2016)
     * -------------------------------------------------------------------------
     */
    renderKibPreviewHtml: function(kibType, assets, profile, version = '2021', filterTahun = 'Semua', customTtd = null) {
        const model = this.getKibModel(kibType, assets, profile, version);
        const p = model.profile;
        const isAllYears = !filterTahun || filterTahun === 'Semua';
        const tahunDisplay = isAllYears ? 'SEMUA TAHUN' : String(filterTahun);
        const tahunTtd = (!isAllYears && filterTahun) ? String(filterTahun) : String(p.tahun_anggaran || new Date().getFullYear());
        const kotaSekolah = (customTtd && customTtd.tempat) ? customTtd.tempat : this.cleanKotaNama(p.kabupaten_kota);
        const ttdTanggal = (customTtd && customTtd.tanggal) ? customTtd.tanggal : `31 Desember ${tahunTtd}`;

        // Susun Header Baris 1
        let thL1Html = '';
        model.headersL1.forEach(h => {
            const rowspanAttr = h.rowspan ? `rowspan="${h.rowspan}"` : '';
            const colspanAttr = h.colspan ? `colspan="${h.colspan}"` : '';
            thL1Html += `<th ${rowspanAttr} ${colspanAttr}>${h.label}</th>`;
        });

        // Susun Header Baris 2
        let thL2Html = '';
        model.headersL2.forEach(h => {
            const isSubkode = !isNaN(parseInt(h.label, 10)) && parseInt(h.label, 10) >= 1 && parseInt(h.label, 10) <= 7;
            const cls = isSubkode ? 'th-subkode' : '';
            const titleAttr = h.title ? `title="${h.title}"` : '';
            thL2Html += `<th class="${cls}" ${titleAttr}>${h.label}</th>`;
        });

        // Susun Baris Nomor Indeks Kolom (3), (4)... atau (1), (2)...
        let thIndicesHtml = '';
        model.colIndices.forEach(idxStr => {
            thIndicesHtml += `<th>${idxStr}</th>`;
        });

        // Susun Baris Data Body
        let trBodyHtml = '';
        if (model.rows.length === 0) {
            trBodyHtml = `<tr><td colspan="${model.totalColsCount}" class="text-center py-4 text-muted fst-italic">Belum ada aset terdaftar pada kelompok KIB ${model.kibType} (${model.namaKelompok}).</td></tr>`;
        } else {
            model.rows.forEach(r => {
                let tds = '';
                const isHierarchyRow = r.rowType && r.rowType !== 'item';
                let trCls = '';
                if (r.rowType === 'jenis') trCls = 'kib-row-jenis';
                else if (r.rowType === 'objek') trCls = 'kib-row-objek';
                else if (r.rowType === 'rincian') trCls = 'kib-row-rincian';
                else if (r.rowType === 'subrincian') trCls = 'kib-row-subrincian';
                else trCls = 'kib-row-item';

                r.forEach((val, colIdx) => {
                    let cellCls = '';
                    let displayVal = val !== undefined && val !== null ? val : '';

                    if (model.version === '2021') {
                        // Di 2021: Kolom 0 s/d 6 adalah 7 jenjang kode barang
                        if (colIdx >= 0 && colIdx <= 6) {
                            cellCls = 'td-kode-col font-monospace text-center';
                            if (isHierarchyRow && val) cellCls += ' fw-bold';
                        } else if (colIdx === 7 && isHierarchyRow) {
                            // Nama Barang pada baris hirarki: styling indentasi visual & ikon
                            let indent = '0px';
                            let prefix = '';
                            if (r.rowType === 'jenis') {
                                prefix = '<i class="fas fa-folder me-1 text-primary"></i> ';
                            } else if (r.rowType === 'objek') {
                                indent = '12px';
                                prefix = '<span class="text-indigo fw-bold">↳</span> ';
                            } else if (r.rowType === 'rincian') {
                                indent = '24px';
                                prefix = '<span class="text-success fw-bold">↳</span> ';
                            } else if (r.rowType === 'subrincian') {
                                indent = '36px';
                                prefix = '<span class="text-warning fw-bold">↳</span> ';
                            }
                            displayVal = `<div style="padding-left: ${indent};">${prefix}<b>${val}</b></div>`;
                            cellCls = 'text-start';
                        } else if (colIdx === model.hargaColIndex - 1 || (model.hargaSatuanColIndex && colIdx === model.hargaSatuanColIndex - 1)) {
                            cellCls = 'text-end font-monospace fw-bold text-nowrap';
                            displayVal = (typeof val === 'number' && val > 0) ? 'Rp ' + Number(val || 0).toLocaleString('id-ID') : (isHierarchyRow ? '' : (val || '-'));
                        } else if (typeof val === 'number') {
                            cellCls = 'text-center font-monospace fw-bold';
                            displayVal = val > 0 ? val : (isHierarchyRow ? '' : val);
                        } else if (['Baik', 'Rusak Ringan', 'Rusak Berat'].includes(val)) {
                            cellCls = 'text-center fw-bold';
                        } else {
                            if (!val && isHierarchyRow) displayVal = '';
                        }
                    } else {
                        // Di 2016: Kolom 0 adalah No, Kolom 1 s/d 7 adalah 7 jenjang kode barang
                        if (colIdx === 0) {
                            cellCls = 'text-center font-monospace';
                        } else if (colIdx >= 1 && colIdx <= 7) {
                            cellCls = 'td-kode-col font-monospace text-center';
                        } else if (colIdx === model.hargaColIndex - 1) {
                            cellCls = 'text-end font-monospace fw-bold text-nowrap';
                            displayVal = 'Rp ' + Number(val || 0).toLocaleString('id-ID');
                        } else if (typeof val === 'number') {
                            cellCls = 'text-center font-monospace';
                        } else if (['Baik', 'Rusak Ringan', 'Rusak Berat'].includes(val)) {
                            cellCls = 'text-center fw-bold';
                        }
                    }

                    tds += `<td class="${cellCls}">${displayVal}</td>`;
                });
                trBodyHtml += `<tr class="${trCls}">${tds}</tr>`;
            });
        }

        // Tampilan Kop Dokumen (Khas 2021 vs 2016)
        let kopHtml = '';
        if (model.version === '2021') {
            kopHtml = `
                <div class="d-flex justify-content-between align-items-start mb-2 small text-muted">
                    <div>
                        <b>1. Pengguna Barang</b> : <span class="text-dark fw-bold">${(p.nama_sekolah || 'SMAN 15 TEBO').toUpperCase()}</span><br>
                        <b>&nbsp;&nbsp;&nbsp;Kode Lokasi</b> : <span class="font-monospace text-dark fw-bold">${p.kode_lokasi || '11.15.09.04.01.001.10505963'}</span>
                    </div>
                    <div class="text-end font-monospace">
                        <b>Lampiran : Daftar BMD</b><br>
                        <b>Tahun : ${tahunDisplay}</b>
                    </div>
                </div>

                <div class="kib-preview-header mb-3">
                    <div class="kib-preview-title fs-5">DAFTAR BMD<br>${model.namaKelompok.toUpperCase()}</div>
                    <div class="small fw-bold text-primary mb-1">TAHUN ANGGARAN: ${tahunDisplay}</div>
                    ${model.subTitleIntra ? `<div class="small fw-bold text-secondary mb-1">${model.subTitleIntra}</div>` : ''}
                    <div class="kib-preview-subtitle fs-6 mb-1 text-primary">PROVINSI ${(p.provinsi || 'Jambi').toUpperCase()}, ${(p.kabupaten_kota || 'Kabupaten Tebo').toUpperCase()}</div>
                </div>
            `;
        } else {
            kopHtml = `
                <div class="kib-preview-header">
                    <div class="kib-preview-title">${model.title}</div>
                    <div class="kib-preview-subtitle">${model.subtitle} • TAHUN ANGGARAN: ${tahunDisplay}</div>
                </div>

                <div class="kib-preview-meta">
                    <table>
                        <tr><td style="width: 170px;">PROVINSI</td><td style="width: 10px;">:</td><td><b>${(p.provinsi || 'Jambi').toUpperCase()}</b></td></tr>
                        <tr><td>KABUPATEN / KOTA</td><td>:</td><td><b>${(p.kabupaten_kota || 'Kabupaten Tebo').toUpperCase()}</b></td></tr>
                        <tr><td>SATUAN KERJA (SKPD)</td><td>:</td><td><b>${(p.nama_sekolah || 'SMAN 15 TEBO').toUpperCase()}</b></td></tr>
                        <tr><td>KODE LOKASI SEKOLAH</td><td>:</td><td><span class="font-monospace">${p.kode_lokasi || '11.15.09.04.01.001.10505963'}</span></td></tr>
                        <tr><td>TAHUN ANGGARAN</td><td>:</td><td><b>${tahunDisplay}</b></td></tr>
                    </table>
                </div>
            `;
        }

        const html = `
            ${kopHtml}

            <div style="overflow-x: auto;">
                <table class="kib-table-permendagri">
                    <thead>
                        <tr>${thL1Html}</tr>
                        <tr>${thL2Html}</tr>
                        <tr class="tr-kolom-index">${thIndicesHtml}</tr>
                    </thead>
                    <tbody>
                        ${trBodyHtml}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="${model.hargaColIndex - 1}" class="text-end fw-bold px-3">
                                ${model.version === '2021' ? 'TOTAL NILAI PEROLEHAN BMD' : `JUMLAH TOTAL KIB ${model.kibType}`}
                            </td>
                            <td class="text-end fw-bold font-monospace text-nowrap">${this.formatCurrency(model.totalNilai)}</td>
                            <td colspan="${model.totalColsCount - model.hargaColIndex}"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="kib-signatures-box">
                <div class="kib-sig-col">
                    <div>Mengetahui,</div>
                    <div class="fw-bold">${model.version === '2021' ? 'Pengguna Barang' : 'Kepala Sekolah'}</div>
                    <div class="kib-sig-space"></div>
                    <div class="kib-sig-name">${p.kepala_sekolah || 'Pariyanto, S.Pd., M.Pd.'}</div>
                    <div>NIP. ${p.nip_kepala_sekolah || '-'}</div>
                </div>

                <div class="kib-sig-col">
                    <div class="kib-sig-date-line">${kotaSekolah}, ${ttdTanggal}</div>
                    <div class="fw-bold">${model.version === '2021' ? 'Pengurus Barang Pengguna' : 'Pengurus Barang Pembantu'}</div>
                    <div class="kib-sig-space"></div>
                    <div class="kib-sig-name">${p.pengurus_barang || 'Pengurus Barang SMAN 15 Tebo'}</div>
                    <div>NIP. ${p.nip_pengurus_barang || '-'}</div>
                </div>
            </div>
        `;

        return html;
    },

    /**
     * -------------------------------------------------------------------------
     * EKSPOR EXCEL PROFESIONAL DENGAN EXCELJS
     * Mendukung Versi 2021 (Daftar BMD) & Versi 2016 (KIB Klasik)
     * -------------------------------------------------------------------------
     */
    exportKibExcelJS: async function(kibType, assets, profile, version = '2021', filterTahun = 'Semua', customTtd = null) {
        const ExcelLib = window.ExcelJS || (typeof ExcelJS !== 'undefined' ? ExcelJS : null);
        if (!ExcelLib) {
            alert('Pustaka ExcelJS belum dimuat di peramban.');
            return;
        }

        const model = this.getKibModel(kibType, assets, profile, version);
        const p = model.profile;
        const isAllYears = !filterTahun || filterTahun === 'Semua';
        const tahunDisplay = isAllYears ? 'SEMUA TAHUN' : String(filterTahun);
        const tahunTtd = (!isAllYears && filterTahun) ? String(filterTahun) : String(p.tahun_anggaran || new Date().getFullYear());
        const tahunFile = isAllYears ? 'Semua_Tahun' : String(filterTahun);
        const kota = (customTtd && customTtd.tempat) ? customTtd.tempat : this.cleanKotaNama(p.kabupaten_kota);
        const ttdTanggal = (customTtd && customTtd.tanggal) ? customTtd.tanggal : `31 Desember ${tahunTtd}`;

        const wb = new ExcelLib.Workbook();
        wb.creator = 'SINBAS Hybrid - Sistem Inventarisasi Barang dan Aset Sekolah';
        wb.lastModifiedBy = p.nama_sekolah || 'SMAN 15 TEBO';
        wb.created = new Date();

        const sheetName = model.version === '2021' ? `Daftar BMD - ${model.kibType}` : `KIB ${model.kibType}`;
        const ws = wb.addWorksheet(sheetName, {
            pageSetup: {
                orientation: 'landscape',
                paperSize: 9, // A4
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0
            },
            views: [{ showGridLines: true }]
        });

        // 1. Set Lebar Kolom
        ws.columns = model.colWidths.map(cw => ({ width: cw.width }));

        // 2. KOP LEMBAR JUDUL RESMI
        let startTableLine = 10;

        const totalCols = model.totalColsCount || (model.colWidths ? model.colWidths.length : 15);

        if (model.version === '2021') {
            // Header Kiri & Kanan Khas 2021 (Kolom A-E untuk Label, Kolom F untuk Nilai)
            try { ws.mergeCells(1, 1, 1, 5); } catch (_) {}
            const p1 = ws.getCell('A1');
            p1.value = '1. Pengguna Barang';
            p1.font = { name: 'Arial', size: 9, bold: true };
            p1.alignment = { vertical: 'middle', horizontal: 'left' };

            try { ws.mergeCells(1, 6, 1, Math.min(14, totalCols - 4)); } catch (_) {}
            const v1 = ws.getCell('F1');
            v1.value = `: ${(p.nama_sekolah || 'SMAN 15 TEBO').toUpperCase()}`;
            v1.font = { name: 'Arial', size: 9, bold: true };
            v1.alignment = { vertical: 'middle', horizontal: 'left' };

            const colRight = Math.max(16, totalCols - 3);
            ws.getCell(1, colRight).value = 'Lampiran : Daftar BMD';
            ws.getCell(1, colRight).font = { name: 'Arial', size: 9, bold: true };
            ws.getCell(2, colRight).value = `Tahun : ${tahunDisplay}`;
            ws.getCell(2, colRight).font = { name: 'Arial', size: 9, bold: true };

            try { ws.mergeCells(2, 1, 2, 5); } catch (_) {}
            const p2 = ws.getCell('A2');
            p2.value = '   Kode Lokasi';
            p2.font = { name: 'Arial', size: 9, bold: true };
            p2.alignment = { vertical: 'middle', horizontal: 'left' };

            try { ws.mergeCells(2, 6, 2, Math.min(14, totalCols - 4)); } catch (_) {}
            const v2 = ws.getCell('F2');
            v2.value = `: ${p.kode_lokasi || '11.15.09.04.01.001.10505963'}`;
            v2.font = { name: 'Arial', size: 9, bold: true };
            v2.alignment = { vertical: 'middle', horizontal: 'left' };

            // Title Tengah MERGED & CENTERED
            try {
                ws.mergeCells(4, 1, 4, totalCols);
            } catch (_) {}
            const titleCell = ws.getCell('A4');
            titleCell.value = `DAFTAR BARANG MILIK DAERAH (BMD) — ${model.namaKelompok.toUpperCase()}`;
            titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF0F172A' } };
            for (let c = 1; c <= totalCols; c++) {
                ws.getCell(4, c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            ws.getRow(4).height = 24;

            if (model.subTitleIntra) {
                try {
                    ws.mergeCells(5, 1, 5, totalCols);
                } catch (_) {}
                const subCell = ws.getCell('A5');
                subCell.value = model.subTitleIntra;
                subCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF475569' } };
                for (let c = 1; c <= totalCols; c++) {
                    ws.getCell(5, c).alignment = { horizontal: 'center', vertical: 'middle' };
                }
                ws.getRow(5).height = 18;
            }

            try {
                ws.mergeCells(6, 1, 6, totalCols);
            } catch (_) {}
            const provCell = ws.getCell('A6');
            provCell.value = `PEMERINTAH PROVINSI ${(p.provinsi || 'Jambi').toUpperCase()} • ${(p.kabupaten_kota || 'Kabupaten Tebo').toUpperCase()} | TAHUN ANGGARAN: ${tahunDisplay}`;
            provCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0284C7' } };
            for (let c = 1; c <= totalCols; c++) {
                ws.getCell(6, c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            ws.getRow(6).height = 20;

            startTableLine = 8;
        } else {
            // Header Klasik 2016 MERGED & CENTERED
            try {
                ws.mergeCells(1, 1, 1, totalCols);
            } catch (_) {}
            const t1 = ws.getCell('A1');
            t1.value = `${model.title} - TAHUN ANGGARAN ${tahunDisplay}`;
            t1.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0F172A' } };
            for (let c = 1; c <= totalCols; c++) {
                ws.getCell(1, c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            ws.getRow(1).height = 26;

            try {
                ws.mergeCells(2, 1, 2, totalCols);
            } catch (_) {}
            const t2 = ws.getCell('A2');
            t2.value = `${model.subtitle} • TAHUN ANGGARAN: ${tahunDisplay}`;
            t2.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF475569' } };
            for (let c = 1; c <= totalCols; c++) {
                ws.getCell(2, c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            ws.getRow(2).height = 20;

            const metaList = [
                ['PROVINSI', `: ${(p.provinsi || 'Jambi').toUpperCase()}`],
                ['KABUPATEN / KOTA', `: ${(p.kabupaten_kota || 'Kabupaten Tebo').toUpperCase()}`],
                ['SATUAN KERJA (SKPD)', `: ${(p.nama_sekolah || 'SMAN 15 TEBO').toUpperCase()}`],
                ['KODE LOKASI', `: ${p.kode_lokasi || '11.15.09.04.01.001.10505963'}`],
                ['TAHUN ANGGARAN', `: ${tahunDisplay}`]
            ];

            metaList.forEach((m, idx) => {
                const rNum = 4 + idx;
                try {
                    ws.mergeCells(rNum, 1, rNum, 5); // Kolom A s/d E untuk Label
                } catch (_) {}
                const labelCell = ws.getCell(rNum, 1);
                labelCell.value = m[0];
                labelCell.font = { name: 'Arial', size: 9.5, bold: true };
                labelCell.alignment = { vertical: 'middle', horizontal: 'left' };

                try {
                    ws.mergeCells(rNum, 6, rNum, Math.max(12, Math.min(totalCols, 16))); // Kolom F ke kanan untuk Nilai
                } catch (_) {}
                const valCell = ws.getCell(rNum, 6);
                valCell.value = m[1];
                valCell.font = { name: 'Arial', size: 9.5, bold: true };
                valCell.alignment = { vertical: 'middle', horizontal: 'left' };
                ws.getRow(rNum).height = 18;
            });

            startTableLine = 10;
        }

        // 3. TABLE HEADERS (3 Baris: Baris 1, Baris 2, Baris 3 Indeks)
        const rowH1 = ws.getRow(startTableLine);
        const rowH2 = ws.getRow(startTableLine + 1);
        const rowH3 = ws.getRow(startTableLine + 2);

        rowH1.height = 24;
        rowH2.height = 22;
        rowH3.height = 16;

        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        };

        const headerFill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE2E8F0' }
        };

        const subkodeFill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF1F5F9' }
        };

        // Pasang Header Tingkat 1 & Lakukan Merge
        let currentCol = 1;
        model.headersL1.forEach(h => {
            const cell = ws.getCell(startTableLine, currentCol);
            cell.value = h.label;

            if (h.rowspan === 2) {
                ws.mergeCells(startTableLine, currentCol, startTableLine + 1, currentCol);
                currentCol += 1;
            } else if (h.colspan) {
                ws.mergeCells(startTableLine, currentCol, startTableLine, currentCol + h.colspan - 1);
                currentCol += h.colspan;
            } else {
                currentCol += 1;
            }
        });

        // Pasang Header Tingkat 2 (Sub-headers)
        let subColIdx = 1;
        model.headersL2.forEach(sh => {
            while (subColIdx <= model.totalColsCount) {
                const cellCheck = ws.getCell(startTableLine + 1, subColIdx);
                if (!cellCheck.value) {
                    cellCheck.value = sh.label;
                    subColIdx++;
                    break;
                }
                subColIdx++;
            }
        });

        // Pasang Header Tingkat 3 (Indeks Kolom)
        for (let c = 1; c <= model.totalColsCount; c++) {
            const cell = ws.getCell(startTableLine + 2, c);
            cell.value = model.colIndices[c - 1] || `(${c})`;
        }

        // Terapkan Styling Header
        for (let r = startTableLine; r <= startTableLine + 2; r++) {
            for (let c = 1; c <= model.totalColsCount; c++) {
                const cell = ws.getCell(r, c);
                cell.border = thinBorder;
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.fill = (r === startTableLine + 2) ? subkodeFill : headerFill;
                cell.font = { name: 'Arial', size: (r === startTableLine + 2) ? 8 : 9, bold: true, color: { argb: 'FF0F172A' } };
            }
        }

        // 4. DATA ROWS DENGAN PEWARNAAN HIRARKI & GARIS TABEL PENUH
        const fillJenis = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };     // Warna A: Soft Sky Blue (#dbeafe)
        const fillObjek = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };     // Warna B: Soft Indigo (#e0e7ff)
        const fillRincian = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };   // Warna C: Soft Mint (#ecfdf5)
        const fillSubRincian = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };// Warna D: Soft Amber (#fef3c7)
        const fillItem = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };      // Warna Item: Putih

        let currentRow = startTableLine + 3;
        model.rows.forEach(rowData => {
            const row = ws.getRow(currentRow);
            row.height = 20;

            let rowFill = fillItem;
            let rowFont = { name: 'Arial', size: 9 };
            const isHierarchy = rowData.rowType && rowData.rowType !== 'item';

            if (rowData.rowType === 'jenis') {
                rowFill = fillJenis;
                rowFont = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E3A8A' } };
            } else if (rowData.rowType === 'objek') {
                rowFill = fillObjek;
                rowFont = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF312E81' } };
            } else if (rowData.rowType === 'rincian') {
                rowFill = fillRincian;
                rowFont = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } };
            } else if (rowData.rowType === 'subrincian') {
                rowFill = fillSubRincian;
                rowFont = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF92400E' } };
            }

            rowData.forEach((val, colIdx) => {
                const cell = row.getCell(colIdx + 1);
                cell.border = thinBorder;
                cell.fill = rowFill;
                cell.font = { ...rowFont };

                if (model.version === '2021') {
                    // Kodefikasi 7 Kolom (Index 0 s/d 6)
                    if (colIdx >= 0 && colIdx <= 6) {
                        cell.value = String(val || '');
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if (colIdx === 7 && isHierarchy) {
                        // Nama Barang pada baris hirarki: indentasi visual di Excel
                        let prefix = '';
                        if (rowData.rowType === 'objek') prefix = '   ↳ ';
                        else if (rowData.rowType === 'rincian') prefix = '      ↳ ';
                        else if (rowData.rowType === 'subrincian') prefix = '         ↳ ';
                        cell.value = prefix + String(val || '');
                        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                    } else if (colIdx === model.hargaColIndex - 1 || (model.hargaSatuanColIndex && colIdx === model.hargaSatuanColIndex - 1)) {
                        if (typeof val === 'number' && val > 0) {
                            cell.value = val;
                            cell.numFmt = '#,##0';
                        } else {
                            cell.value = isHierarchy ? '' : (val || '-');
                        }
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        if (colIdx === model.hargaColIndex - 1) cell.font.bold = true;
                    } else if (typeof val === 'number') {
                        cell.value = val > 0 ? val : (isHierarchy ? '' : val);
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else {
                        cell.value = (!val && isHierarchy) ? '' : (val !== undefined && val !== null ? String(val) : '-');
                        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                    }
                } else {
                    // Versi 2016 Klasik
                    if (colIdx === 0) {
                        cell.value = val;
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if (colIdx >= 1 && colIdx <= 7) {
                        cell.value = String(val || '');
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if (colIdx === model.hargaColIndex - 1) {
                        cell.value = Number(val) || 0;
                        cell.numFmt = '#,##0';
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.font.bold = true;
                    } else if (typeof val === 'number') {
                        cell.value = val;
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else {
                        cell.value = val !== undefined && val !== null ? String(val) : '-';
                        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                    }
                }
            });

            currentRow++;
        });

        // 5. BARIS TOTAL AKUMULASI
        const totalRow = ws.getRow(currentRow);
        totalRow.height = 22;

        ws.mergeCells(currentRow, 1, currentRow, model.hargaColIndex - 1);
        const totalLabelCell = ws.getCell(currentRow, 1);
        totalLabelCell.value = model.version === '2021' ? 'TOTAL NILAI PEROLEHAN BMD' : `JUMLAH TOTAL KIB ${model.kibType}`;
        totalLabelCell.font = { name: 'Arial', size: 9, bold: true };
        totalLabelCell.alignment = { vertical: 'middle', horizontal: 'right' };
        totalLabelCell.fill = headerFill;

        const totalValueCell = ws.getCell(currentRow, model.hargaColIndex);
        totalValueCell.value = model.totalNilai;
        totalValueCell.numFmt = '#,##0';
        totalValueCell.font = { name: 'Arial', size: 10, bold: true };
        totalValueCell.alignment = { vertical: 'middle', horizontal: 'right' };
        totalValueCell.fill = headerFill;

        for (let c = 1; c <= model.totalColsCount; c++) {
            const cell = ws.getCell(currentRow, c);
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'double', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };
        }

        currentRow += 2;

        // 6. BLOK TANDA TANGAN RESMI
        const colLeft = 2;
        const colRight = Math.max(12, model.totalColsCount - 5);

        ws.getCell(currentRow, colLeft).value = 'Mengetahui,';
        ws.getCell(currentRow, colRight).value = `${kota}, ${ttdTanggal}`;
        ws.getCell(currentRow, colLeft).font = { name: 'Arial', size: 9 };
        ws.getCell(currentRow, colRight).font = { name: 'Arial', size: 9 };

        currentRow += 1;
        ws.getCell(currentRow, colLeft).value = model.version === '2021' ? 'Pengguna Barang' : 'Kepala Sekolah';
        ws.getCell(currentRow, colRight).value = model.version === '2021' ? 'Pengurus Barang Pengguna' : 'Pengurus Barang Pembantu';
        ws.getCell(currentRow, colLeft).font = { name: 'Arial', size: 9, bold: true };
        ws.getCell(currentRow, colRight).font = { name: 'Arial', size: 9, bold: true };

        currentRow += 4;
        ws.getCell(currentRow, colLeft).value = p.kepala_sekolah || 'Pariyanto, S.Pd., M.Pd.';
        ws.getCell(currentRow, colRight).value = p.pengurus_barang || 'Pengurus Barang SMAN 15 Tebo';
        ws.getCell(currentRow, colLeft).font = { name: 'Arial', size: 9, bold: true, underline: true };
        ws.getCell(currentRow, colRight).font = { name: 'Arial', size: 9, bold: true, underline: true };

        currentRow += 1;
        ws.getCell(currentRow, colLeft).value = `NIP. ${p.nip_kepala_sekolah || '-'}`;
        ws.getCell(currentRow, colRight).value = `NIP. ${p.nip_pengurus_barang || '-'}`;
        ws.getCell(currentRow, colLeft).font = { name: 'Arial', size: 9 };
        ws.getCell(currentRow, colRight).font = { name: 'Arial', size: 9 };

        // 7. SIMPAN DAN UNDUH FILE
        const prefix = model.version === '2021' ? `Daftar_BMD_2021_${model.kibType}` : `KIB_${model.kibType}_Permendagri_108`;
        const fileName = `${prefix}_${model.namaKelompok.replace(/\s+/g, '_')}_${p.npsn || '10505963'}_${tahunFile}.xlsx`;
        const buffer = await wb.xlsx.writeBuffer();

        // Electron Native Save Dialog
        if (window.sinbasAPI && window.sinbasAPI.isElectron) {
            try {
                let base64Data = '';
                const bytes = new Uint8Array(buffer);
                for (let i = 0; i < bytes.byteLength; i++) {
                    base64Data += String.fromCharCode(bytes[i]);
                }
                const base64Str = window.btoa(base64Data);

                const saveDialogRes = await window.sinbasAPI.showSaveDialog({
                    title: `Simpan Laporan Excel (${model.regulasi})`,
                    defaultPath: fileName,
                    filters: [{ name: 'Excel Spreadsheet (*.xlsx)', extensions: ['xlsx'] }]
                });

                if (!saveDialogRes.canceled && saveDialogRes.filePath) {
                    const saveRes = await window.sinbasAPI.saveFile(saveDialogRes.filePath, base64Str);
                    if (saveRes.success) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Laporan Excel Berhasil Disimpan!',
                            html: `File resmi <b>${model.regulasi}</b> telah tersimpan rapi dengan garis tabel & 7 kolom kodefikasi:<br><b class="font-monospace text-cyan small">${saveDialogRes.filePath}</b>`,
                            showCancelButton: true,
                            confirmButtonText: '<i class="fas fa-folder-open me-1"></i> Buka Folder Lokasi',
                            cancelButtonText: 'Selesai'
                        }).then(sw => {
                            if (sw.isConfirmed) {
                                window.sinbasAPI.openPath(saveDialogRes.filePath);
                            }
                        });
                        return;
                    }
                }
                return;
            } catch (err) {
                console.warn('[ExcelExporter] Electron save error, falling back to browser download:', err);
            }
        }

        // Web Browser Download Fallback
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        if (typeof saveAs !== 'undefined') {
            saveAs(blob, fileName);
        } else {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        }

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Unduh Excel Berhasil',
                text: `File ${fileName} telah diunduh dengan format resmi ${model.regulasi} (7 kolom kodefikasi & garis tabel rapi).`
            });
        }
    },

    /**
     * Intercept ekspor KIB agar menampilkan Modal Pratinjau Terlebih Dahulu
     */
    exportKibA: function(assets, profile) {
        if (typeof previewKibReport === 'function') previewKibReport('A');
        else this.exportKibExcelJS('A', assets, profile, '2021');
    },
    exportKibB: function(assets, profile) {
        if (typeof previewKibReport === 'function') previewKibReport('B');
        else this.exportKibExcelJS('B', assets, profile, '2021');
    },
    exportKibC: function(assets, profile) {
        if (typeof previewKibReport === 'function') previewKibReport('C');
        else this.exportKibExcelJS('C', assets, profile, '2021');
    },
    exportKibD: function(assets, profile) {
        if (typeof previewKibReport === 'function') previewKibReport('D');
        else this.exportKibExcelJS('D', assets, profile, '2021');
    },
    exportKibE: function(assets, profile) {
        if (typeof previewKibReport === 'function') previewKibReport('E');
        else this.exportKibExcelJS('E', assets, profile, '2021');
    },
    exportKibF: function(assets, profile) {
        if (typeof previewKibReport === 'function') previewKibReport('F');
        else this.exportKibExcelJS('F', assets, profile, '2021');
    },

    /**
     * EKSPOR KARTU INVENTARIS RUANGAN (KIR)
     */
    exportKir: function(ruangan, assets, profile, customTtd = null) {
        const filtered = assets.filter(a => a.ruangan_id === ruangan.id);
        const rows = [
            ['KARTU INVENTARIS RUANGAN (KIR)'],
            ['BERDASARKAN PERMENDAGRI NOMOR 47 TAHUN 2021'],
            [],
            ['PROVINSI', `: ${profile.provinsi || 'Jambi'}`],
            ['KABUPATEN/KOTA', `: ${profile.kabupaten_kota || 'Kabupaten Tebo'}`],
            ['SATUAN KERJA (SKPD)', `: ${profile.nama_sekolah || 'SMAN 15 TEBO'}`],
            ['RUANGAN', `: [${ruangan.kode_ruangan}] ${ruangan.nama_ruangan}`],
            ['PENANGGUNG JAWAB', `: ${ruangan.penanggung_jawab || '-'}`],
            ['TAHUN ANGGARAN', `: ${profile.tahun_anggaran || new Date().getFullYear()}`],
            [],
            ['No.', 'Kode Barang', 'Nama Barang / Jenis Barang', 'Merk / Model', 'No. Seri Pabrik', 'Bahan', 'Tahun Perolehan', 'Jumlah Barang', 'Harga Satuan (Rp)', 'Total Nilai (Rp)', 'Kondisi Barang', 'Keterangan']
        ];

        let grandTotal = 0;
        let grandQty = 0;
        filtered.forEach((ast, idx) => {
            const total = Number(ast.nilai_total || ast.harga_satuan) || 0;
            const qty = Number(ast.jumlah) || 1;
            grandTotal += total;
            grandQty += qty;

            rows.push([
                idx + 1,
                ast.kode_barang,
                ast.spesifikasi_nama || ast.nama_barang,
                ast.merk_tipe || '-',
                ast.no_pabrik_seri || '-',
                ast.bahan || '-',
                ast.tahun_perolehan,
                qty,
                Number(ast.harga_satuan) || 0,
                total,
                ast.kondisi || 'Baik',
                ast.keterangan || '-'
            ]);
        });

        rows.push(['', '', 'TOTAL INVENTARIS RUANGAN', '', '', '', '', grandQty, '', grandTotal, '', '']);
        rows.push([]);
        this.appendSignatures(rows, profile, profile.tahun_anggaran, customTtd);

        this.generateFile(rows, `KIR_${ruangan.kode_ruangan}_${profile.tahun_anggaran || '2026'}.xlsx`, `KIR - ${ruangan.kode_ruangan}`, [
            { wch: 5 }, { wch: 22 }, { wch: 32 }, { wch: 20 }, { wch: 18 }, { wch: 14 },
            { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 15 }, { wch: 25 }
        ]);
    },

    /**
     * -------------------------------------------------------------------------
     * MODEL BUKU INVENTARIS LENGKAP: PERMENDAGRI NO. 47 TAHUN 2021
     * Menggabungkan seluruh kelompok KIB (1.3.1 s/d 1.3.6) ke dalam pohon hirarki
     * bertingkat Permendagri 47/2021 dengan 22 kolom komprehensif.
     * -------------------------------------------------------------------------
     */
    getBukuInventarisModel2021: function(assets, profile) {
        const p = profile || {};
        const namaKelompok = 'Seluruh Kelompok Barang Milik Daerah (KIB A s/d F)';

        const headersL1 = [
            { label: 'Nomor Kode Barang', colspan: 7 },
            { label: 'Nama Barang / Jenis Aset', rowspan: 2 },
            { label: 'KIB', rowspan: 2 },
            { label: 'NIBAR', rowspan: 2 },
            { label: 'Nomor Register', rowspan: 2 },
            { label: 'Spesifikasi Nama / Merek / Tipe', rowspan: 2 },
            { label: 'Spesifikasi Tambahan & Dokumen', rowspan: 2 },
            { label: 'Ruangan / Lokasi', rowspan: 2 },
            { label: 'Jumlah', rowspan: 2 },
            { label: 'Satuan', rowspan: 2 },
            { label: 'Tahun', rowspan: 2 },
            { label: 'Kondisi', rowspan: 2 },
            { label: 'Harga Satuan (Rp)', rowspan: 2 },
            { label: 'Nilai Perolehan (Rp)', rowspan: 2 },
            { label: 'Asal-Usul', rowspan: 2 },
            { label: 'Penggunaan / Keterangan', rowspan: 2 }
        ];

        const headersL2 = [
            { label: '1', title: 'Akun' },
            { label: '2', title: 'Kelompok' },
            { label: '3', title: 'Jenis' },
            { label: '4', title: 'Objek' },
            { label: '5', title: 'Rincian Objek' },
            { label: '6', title: 'Sub Rincian' },
            { label: '7', title: 'Sub-Sub Rincian' }
        ];

        const colIndices = [
            '(1a)', '(1b)', '(1c)', '(1d)', '(1e)', '(1f)', '(1g)',
            '(2)', '(3)', '(4)', '(5)', '(6)', '(7)', '(8)',
            '(9)', '(10)', '(11)', '(12)', '(13)', '(14)', '(15)', '(16)'
        ];

        const colWidths = [
            { width: 4.5 }, { width: 4.5 }, { width: 4.5 }, { width: 5.5 }, { width: 5.5 }, { width: 5.5 }, { width: 6.5 },
            { width: 28 }, { width: 6 }, { width: 20 }, { width: 10 }, { width: 24 }, { width: 28 }, { width: 18 },
            { width: 8 }, { width: 8 }, { width: 8 }, { width: 12 }, { width: 16 }, { width: 18 }, { width: 16 }, { width: 20 }
        ];

        const jumlahCol0Based = 14;      // Index ke-14 (Kolom 15) = Jumlah (Qty)
        const hargaSatuanColIndex = 19;  // Kolom 19 (1-based) = Harga Satuan
        const hargaColIndex = 20;        // Kolom 20 (1-based) = Nilai Perolehan
        const totalCols = colWidths.length; // 22 Kolom

        // 1. Ekspan aset ke fisik tunggal (1 record per fisik aset)
        const unitItems = this.expandToSingleUnits(assets || []);

        // 2. Sortir secara teratur berdasarkan kode 7 tingkat (c0.c1.c2.c3.c4.c5.c6)
        // c2 adalah jenis: 1 (Tanah/KIB A), 2 (Peralatan/KIB B), 3 (Gedung/KIB C), 4 (Jalan/KIB D), 5 (Aset Lain/KIB E), 6 (KDP/KIB F)
        unitItems.sort((a, b) => {
            const typeA = (a.kib_type || 'B').toUpperCase();
            const typeB = (b.kib_type || 'B').toUpperCase();
            const kdA = this.splitKode7Tingkat(a.kode_barang);
            const kdB = this.splitKode7Tingkat(b.kode_barang);
            const defA = (typeA === 'A' ? ['1','3','1'] : typeA === 'B' ? ['1','3','2'] : typeA === 'C' ? ['1','3','3'] : typeA === 'D' ? ['1','3','4'] : typeA === 'E' ? ['1','3','5'] : ['1','3','6']);
            const defB = (typeB === 'A' ? ['1','3','1'] : typeB === 'B' ? ['1','3','2'] : typeB === 'C' ? ['1','3','3'] : typeB === 'D' ? ['1','3','4'] : typeB === 'E' ? ['1','3','5'] : ['1','3','6']);

            const cA0 = (kdA[0] === '1' && kdA[1] === '3') ? kdA[0] : defA[0];
            const cA1 = (kdA[0] === '1' && kdA[1] === '3') ? kdA[1] : defA[1];
            const cA2 = (kdA[0] === '1' && kdA[1] === '3') ? kdA[2] : defA[2];
            const cA3 = (kdA[0] === '1' && kdA[1] === '3') ? kdA[3] : (kdA[0] || '01');
            const cA4 = (kdA[0] === '1' && kdA[1] === '3') ? kdA[4] : (kdA[1] || '01');
            const cA5 = (kdA[0] === '1' && kdA[1] === '3') ? kdA[5] : (kdA[2] || '01');
            const cA6 = (kdA[0] === '1' && kdA[1] === '3') ? kdA[6] : (kdA[3] || '001');

            const cB0 = (kdB[0] === '1' && kdB[1] === '3') ? kdB[0] : defB[0];
            const cB1 = (kdB[0] === '1' && kdB[1] === '3') ? kdB[1] : defB[1];
            const cB2 = (kdB[0] === '1' && kdB[1] === '3') ? kdB[2] : defB[2];
            const cB3 = (kdB[0] === '1' && kdB[1] === '3') ? kdB[3] : (kdB[0] || '01');
            const cB4 = (kdB[0] === '1' && kdB[1] === '3') ? kdB[4] : (kdB[1] || '01');
            const cB5 = (kdB[0] === '1' && kdB[1] === '3') ? kdB[5] : (kdB[2] || '01');
            const cB6 = (kdB[0] === '1' && kdB[1] === '3') ? kdB[6] : (kdB[3] || '001');

            const fullCodeA = `${cA0}.${cA1}.${cA2}.${cA3}.${cA4}.${cA5}.${cA6}`;
            const fullCodeB = `${cB0}.${cB1}.${cB2}.${cB3}.${cB4}.${cB5}.${cB6}`;

            if (fullCodeA !== fullCodeB) return fullCodeA.localeCompare(fullCodeB);
            return (parseInt(a.no_register, 10) || 0) - (parseInt(b.no_register, 10) || 0);
        });

        // 3. Bangun Pohon Hirarki Bertingkat Multi-KIB (1.3.1 s/d 1.3.6)
        const tree = new Map();

        unitItems.forEach(item => {
            const type = (item.kib_type || 'B').toUpperCase();
            const kd = this.splitKode7Tingkat(item.kode_barang);
            const defJenis = (type === 'A' ? ['1','3','1'] : type === 'B' ? ['1','3','2'] : type === 'C' ? ['1','3','3'] : type === 'D' ? ['1','3','4'] : type === 'E' ? ['1','3','5'] : ['1','3','6']);
            const c0 = (kd[0] === '1' && kd[1] === '3') ? kd[0] : defJenis[0];
            const c1 = (kd[0] === '1' && kd[1] === '3') ? kd[1] : defJenis[1];
            const c2 = (kd[0] === '1' && kd[1] === '3') ? kd[2] : defJenis[2];
            const c3 = (kd[0] === '1' && kd[1] === '3') ? kd[3] : (kd[0] || '01');
            const c4 = (kd[0] === '1' && kd[1] === '3') ? kd[4] : (kd[1] || '01');
            const c5 = (kd[0] === '1' && kd[1] === '3') ? kd[5] : (kd[2] || '01');

            const keyL3 = `${c0}.${c1}.${c2}`;
            const keyL4 = `${keyL3}.${c3}`;
            const keyL5 = `${keyL4}.${c4}`;
            const keyL6 = `${keyL5}.${c5}`;

            const itemQty = Number(item.jumlah) || 1;
            const itemNilai = Number(item.nilai_total || item.harga_satuan) || 0;

            if (!tree.has(keyL3)) {
                tree.set(keyL3, {
                    codeParts: [c0, c1, c2],
                    name: this.lookupHierarchyName(keyL3) || (type === 'A' ? 'TANAH' : type === 'B' ? 'PERALATAN DAN MESIN' : type === 'C' ? 'GEDUNG DAN BANGUNAN' : type === 'D' ? 'JALAN, IRIGASI DAN JARINGAN' : type === 'E' ? 'ASET TETAP LAINNYA' : 'KONSTRUKSI DALAM PENGERJAAN'),
                    qty: 0,
                    nilai: 0,
                    objekMap: new Map()
                });
            }
            const nodeL3 = tree.get(keyL3);
            nodeL3.qty += itemQty;
            nodeL3.nilai += itemNilai;

            if (!nodeL3.objekMap.has(keyL4)) {
                nodeL3.objekMap.set(keyL4, {
                    codeParts: [c0, c1, c2, c3],
                    name: this.lookupHierarchyName(keyL4) || 'OBJEK ' + keyL4,
                    qty: 0,
                    nilai: 0,
                    rincianMap: new Map()
                });
            }
            const nodeL4 = nodeL3.objekMap.get(keyL4);
            nodeL4.qty += itemQty;
            nodeL4.nilai += itemNilai;

            if (!nodeL4.rincianMap.has(keyL5)) {
                nodeL4.rincianMap.set(keyL5, {
                    codeParts: [c0, c1, c2, c3, c4],
                    name: this.lookupHierarchyName(keyL5) || 'RINCIAN ' + keyL5,
                    qty: 0,
                    nilai: 0,
                    subRincianMap: new Map()
                });
            }
            const nodeL5 = nodeL4.rincianMap.get(keyL5);
            nodeL5.qty += itemQty;
            nodeL5.nilai += itemNilai;

            if (!nodeL5.subRincianMap.has(keyL6)) {
                nodeL5.subRincianMap.set(keyL6, {
                    codeParts: [c0, c1, c2, c3, c4, c5],
                    name: this.lookupHierarchyName(keyL6) || 'SUB RINCIAN ' + keyL6,
                    qty: 0,
                    nilai: 0,
                    items: []
                });
            }
            const nodeL6 = nodeL5.subRincianMap.get(keyL6);
            nodeL6.qty += itemQty;
            nodeL6.nilai += itemNilai;

            nodeL6.items.push(item);
        });

        // 4. Susun Baris Terstruktur dengan Warna Berbeda Tiap Tingkatan
        let totalNilai = 0;
        let totalJumlah = 0;
        const rows = [];
        let itemIndex = 0;

        tree.forEach(n3 => {
            totalNilai += n3.nilai;
            totalJumlah += n3.qty;

            // Tingkat 3 (Jenis: 1.3.1, 1.3.2, ...) - Soft Blue
            rows.push(this.createHierarchyRow(3, n3.codeParts, n3.name, n3.qty, n3.nilai, totalCols, jumlahCol0Based, hargaColIndex - 1));

            n3.objekMap.forEach(n4 => {
                // Tingkat 4 (Objek) - Soft Indigo
                rows.push(this.createHierarchyRow(4, n4.codeParts, n4.name, n4.qty, n4.nilai, totalCols, jumlahCol0Based, hargaColIndex - 1));

                n4.rincianMap.forEach(n5 => {
                    // Tingkat 5 (Rincian Objek) - Soft Mint
                    rows.push(this.createHierarchyRow(5, n5.codeParts, n5.name, n5.qty, n5.nilai, totalCols, jumlahCol0Based, hargaColIndex - 1));

                    n5.subRincianMap.forEach(n6 => {
                        // Tingkat 6 (Sub Rincian) - Soft Amber
                        rows.push(this.createHierarchyRow(6, n6.codeParts, n6.name, n6.qty, n6.nilai, totalCols, jumlahCol0Based, hargaColIndex - 1));

                        // Tingkat 7 (Item Fisik Satuan KIB A - F)
                        n6.items.forEach(itm => {
                            rows.push(this.createItemRowUnified2021(itm, itemIndex++, p));
                        });
                    });
                });
            });
        });

        return {
            version: '2021',
            regulasi: 'PERMENDAGRI NOMOR 47 TAHUN 2021',
            kibType: 'GABUNGAN',
            namaKelompok: namaKelompok,
            title: 'BUKU INVENTARIS BARANG MILIK DAERAH (BMD) LENGKAP\nREKAPITULASI SELURUH KIB A, B, C, D, E, DAN F',
            profile: p,
            headersL1: headersL1,
            headersL2: headersL2,
            colIndices: colIndices,
            colWidths: colWidths,
            rows: rows,
            totalNilai: totalNilai,
            totalJumlah: totalJumlah,
            jumlahCol0Based: jumlahCol0Based,
            hargaSatuanColIndex: hargaSatuanColIndex,
            hargaColIndex: hargaColIndex,
            totalColsCount: totalCols
        };
    },

    /**
     * EKSPOR RESMI BUKU INVENTARIS BMD LENGKAP BERBASIS EXCELJS (PERMENDAGRI 47/2021)
     * - 22 Kolom Komprehensif menampung seluruh atribut spesifik KIB A s/d F
     * - Hirarki kodefikasi warna (Jenis 1.3.1 s/d 1.3.6, Objek, Rincian, Sub-Rincian, Item)
     * - Border rapi, format angka Rupiah, dan tanda tangan resmi
     */
    exportBukuInventarisSemua: async function(assets, profile, filterTahun = 'Semua', customTtd = null) {
        const p = profile || {};
        const isAllYears = !filterTahun || filterTahun === 'Semua';
        const tahunDisplay = isAllYears ? 'SEMUA TAHUN' : String(filterTahun);
        const tahunTtd = (!isAllYears && filterTahun) ? String(filterTahun) : String(p.tahun_anggaran || new Date().getFullYear());
        const tahunFile = isAllYears ? 'Semua_Tahun' : String(filterTahun);
        const kota = (customTtd && customTtd.tempat) ? customTtd.tempat : this.cleanKotaNama(p.kabupaten_kota);
        const ttdTanggal = (customTtd && customTtd.tanggal) ? customTtd.tanggal : `31 Desember ${tahunTtd}`;

        const model = this.getBukuInventarisModel2021(assets, profile);

        const ExcelLib = window.ExcelJS || (typeof ExcelJS !== 'undefined' ? ExcelJS : null);

        // Fallback jika ExcelJS belum tersedia
        if (!ExcelLib) {
            console.warn('[ExcelExporter] ExcelJS tidak ditemukan, beralih ke Fallback SheetJS.');
            const fallbackRows = [
                ['BUKU INVENTARIS BARANG MILIK DAERAH (BMD) LENGKAP'],
                [`Satuan Kerja: ${p.nama_sekolah || 'SMAN 15 TEBO'} | Tahun Anggaran: ${tahunDisplay}`],
                [],
                ['Akun', 'Kelompok', 'Jenis', 'Objek', 'Rincian', 'Sub Rincian', 'Sub-Sub Rincian', 'Nama Barang / Jenis Aset', 'KIB', 'NIBAR', 'Register', 'Spesifikasi / Merek', 'Spesifikasi Tambahan & Dokumen', 'Ruangan / Lokasi', 'Jumlah', 'Satuan', 'Tahun', 'Kondisi', 'Harga Satuan (Rp)', 'Nilai Perolehan (Rp)', 'Asal-Usul', 'Penggunaan / Keterangan']
            ];
            model.rows.forEach(r => {
                fallbackRows.push(r.slice());
            });
            fallbackRows.push([]);
            this.appendSignatures(fallbackRows, profile, tahunTtd);
            this.generateFile(fallbackRows, `Buku_Inventaris_BMD_Lengkap_${tahunFile}.xlsx`, 'Buku Inventaris BMD', model.colWidths.map(w => ({ wch: Math.round(w.width * 1.2) })));
            return;
        }

        const wb = new ExcelLib.Workbook();
        wb.creator = 'SINBAS BMD';
        wb.created = new Date();

        const ws = wb.addWorksheet('Buku Inventaris BMD', {
            pageSetup: {
                paperSize: 9, // A4
                orientation: 'landscape',
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
            },
            views: [{ showGridLines: true }]
        });

        // Set Lebar Kolom
        ws.columns = model.colWidths.map(w => ({ width: w.width }));

        // Palet Warna & Styling
        const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Navy Blue
        const headerFont = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        const subIndexFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172554' } }; // Darker Navy
        const subIndexFont = { name: 'Arial', size: 8, italic: true, color: { argb: 'FFBFDBFE' } };
        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };

        // 1. KOP LAPORAN RESMI
        ws.mergeCells(1, 1, 1, 22);
        const titleCell1 = ws.getCell(1, 1);
        titleCell1.value = 'BUKU INVENTARIS BARANG MILIK DAERAH (BMD) LENGKAP';
        titleCell1.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF1E3A8A' } };
        titleCell1.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(1).height = 24;

        ws.mergeCells(2, 1, 2, 22);
        const titleCell2 = ws.getCell(2, 1);
        titleCell2.value = 'REKAPITULASI SELURUH KIB A, B, C, D, E, DAN F — PERMENDAGRI NOMOR 47 TAHUN 2021';
        titleCell2.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF475569' } };
        titleCell2.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(2).height = 20;

        ws.mergeCells(3, 1, 3, 12);
        const metaLeft = ws.getCell(3, 1);
        metaLeft.value = `Pengguna Barang : ${(p.nama_sekolah || 'SMAN 15 TEBO').toUpperCase()}   |   Kode Lokasi : ${p.kode_lokasi || '11.15.09.04.01.001.10505963'}`;
        metaLeft.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF334155' } };
        metaLeft.alignment = { horizontal: 'left', vertical: 'middle' };

        ws.mergeCells(3, 13, 3, 22);
        const metaRight = ws.getCell(3, 13);
        metaRight.value = `TAHUN ANGGARAN : ${tahunDisplay}`;
        metaRight.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E3A8A' } };
        metaRight.alignment = { horizontal: 'right', vertical: 'middle' };
        ws.getRow(3).height = 18;

        // 2. HEADER TABEL (Baris 5: Level 1, Baris 6: Subkode 1-7, Baris 7: Indeks Kolom)
        const rowH1 = ws.getRow(5);
        const rowH2 = ws.getRow(6);
        const rowH3 = ws.getRow(7);
        rowH1.height = 24;
        rowH2.height = 20;
        rowH3.height = 18;

        // Merge Kode Barang (Cols 1 s/d 7)
        ws.mergeCells(5, 1, 5, 7);
        ws.getCell(5, 1).value = 'Nomor Kode Barang';

        // Kolom 8 s/d 22 Rowspan 2
        const singleHeaders = [
            'Nama Barang / Jenis Aset',
            'KIB',
            'NIBAR',
            'Nomor Register',
            'Spesifikasi Nama / Merek / Tipe',
            'Spesifikasi Tambahan & Dokumen',
            'Ruangan / Lokasi',
            'Jumlah',
            'Satuan',
            'Tahun',
            'Kondisi',
            'Harga Satuan (Rp)',
            'Nilai Perolehan (Rp)',
            'Asal-Usul',
            'Penggunaan / Keterangan'
        ];

        singleHeaders.forEach((lbl, sIdx) => {
            const colNum = 8 + sIdx;
            ws.mergeCells(5, colNum, 6, colNum);
            ws.getCell(5, colNum).value = lbl;
        });

        // Baris 6: Subkode 1 s/d 7
        for (let c = 1; c <= 7; c++) {
            ws.getCell(6, c).value = String(c);
        }

        // Baris 7: Indeks Kolom (1a) s/d (16)
        model.colIndices.forEach((idxLabel, i) => {
            ws.getCell(7, i + 1).value = idxLabel;
        });

        // Format styling header baris 5, 6, 7
        for (let r = 5; r <= 7; r++) {
            const rowTarget = ws.getRow(r);
            for (let c = 1; c <= 22; c++) {
                const cell = rowTarget.getCell(c);
                cell.border = thinBorder;
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                if (r === 7) {
                    cell.fill = subIndexFill;
                    cell.font = subIndexFont;
                } else {
                    cell.fill = headerFill;
                    cell.font = headerFont;
                }
            }
        }

        // 3. SUSUN DATA BODY
        let currentRow = 8;
        model.rows.forEach(rowData => {
            const row = ws.getRow(currentRow);
            const isHierarchy = rowData.rowType && rowData.rowType !== 'item';

            let rowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            let rowFont = { name: 'Arial', size: 9, bold: false, color: { argb: 'FF1F2937' } };

            if (rowData.rowType === 'jenis') {
                rowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; // Soft Blue
                rowFont = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF1E40AF' } };
            } else if (rowData.rowType === 'objek') {
                rowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }; // Soft Indigo
                rowFont = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF3730A3' } };
            } else if (rowData.rowType === 'rincian') {
                rowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }; // Soft Mint
                rowFont = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } };
            } else if (rowData.rowType === 'subrincian') {
                rowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Soft Amber
                rowFont = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF92400E' } };
            }

            rowData.forEach((val, colIdx) => {
                const cell = row.getCell(colIdx + 1);
                cell.border = thinBorder;
                cell.fill = rowFill;
                cell.font = { ...rowFont };

                if (colIdx >= 0 && colIdx <= 6) {
                    // Kodefikasi 7 Kolom
                    cell.value = String(val || '');
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else if (colIdx === 7 && isHierarchy) {
                    // Nama Barang pada baris hirarki: Indentasi visual di Excel
                    let prefix = '';
                    if (rowData.rowType === 'objek') prefix = '   ↳ ';
                    else if (rowData.rowType === 'rincian') prefix = '      ↳ ';
                    else if (rowData.rowType === 'subrincian') prefix = '         ↳ ';
                    cell.value = prefix + String(val || '');
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                } else if (colIdx === 8) {
                    // KIB badge (A, B, C, D, E, F)
                    cell.value = isHierarchy ? '' : String(val || '');
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    if (!isHierarchy) cell.font.bold = true;
                } else if (colIdx === 9 || colIdx === 10) {
                    // NIBAR & Register
                    cell.value = isHierarchy ? '' : String(val || '');
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else if (colIdx === 14) {
                    // Kolom Jumlah (Qty)
                    const numVal = Number(val) || 0;
                    cell.value = numVal > 0 ? numVal : (isHierarchy ? '' : '-');
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    if (isHierarchy) cell.font.bold = true;
                } else if (colIdx === 18 || colIdx === 19) {
                    // Kolom 18: Harga Satuan, Kolom 19: Nilai Perolehan
                    if (typeof val === 'number' && val > 0) {
                        cell.value = val;
                        cell.numFmt = '#,##0';
                    } else {
                        cell.value = isHierarchy ? '' : (val || '-');
                    }
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    if (colIdx === 19) cell.font.bold = true;
                } else {
                    cell.value = (!val && isHierarchy) ? '' : (val !== undefined && val !== null ? String(val) : '-');
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                }
            });

            currentRow++;
        });

        // 4. BARIS TOTAL AKUMULASI (DOUBLE BORDER BAWAH)
        const totalRow = ws.getRow(currentRow);
        totalRow.height = 22;

        ws.mergeCells(currentRow, 1, currentRow, 14);
        const totalLabelCell = ws.getCell(currentRow, 1);
        totalLabelCell.value = 'TOTAL SELURUH INVENTARIS BMD (KIB A s/d F)';
        totalLabelCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
        totalLabelCell.alignment = { vertical: 'middle', horizontal: 'right' };
        totalLabelCell.fill = headerFill;

        const totalQtyCell = ws.getCell(currentRow, 15);
        totalQtyCell.value = model.totalJumlah;
        totalQtyCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        totalQtyCell.alignment = { vertical: 'middle', horizontal: 'center' };
        totalQtyCell.fill = headerFill;

        ws.mergeCells(currentRow, 16, currentRow, 19);
        const blankMidCell = ws.getCell(currentRow, 16);
        blankMidCell.fill = headerFill;

        const totalValueCell = ws.getCell(currentRow, 20);
        totalValueCell.value = model.totalNilai;
        totalValueCell.numFmt = '#,##0';
        totalValueCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        totalValueCell.alignment = { vertical: 'middle', horizontal: 'right' };
        totalValueCell.fill = headerFill;

        ws.mergeCells(currentRow, 21, currentRow, 22);
        const blankEndCell = ws.getCell(currentRow, 21);
        blankEndCell.fill = headerFill;

        for (let c = 1; c <= 22; c++) {
            const cell = ws.getCell(currentRow, c);
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'double', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };
        }

        currentRow += 2;

        // 5. BLOK TANDA TANGAN RESMI
        const colLeft = 2;
        const colRight = 17;

        ws.getCell(currentRow, colLeft).value = 'Mengetahui,';
        ws.getCell(currentRow, colRight).value = `${kota}, ${ttdTanggal}`;
        ws.getCell(currentRow, colLeft).font = { name: 'Arial', size: 9 };
        ws.getCell(currentRow, colRight).font = { name: 'Arial', size: 9 };

        currentRow += 1;
        ws.getCell(currentRow, colLeft).value = 'Kepala Sekolah Selaku Kuasa Pengguna Barang';
        ws.getCell(currentRow, colRight).value = 'Pengurus Barang Pembantu,';
        ws.getCell(currentRow, colLeft).font = { name: 'Arial', size: 9, bold: true };
        ws.getCell(currentRow, colRight).font = { name: 'Arial', size: 9, bold: true };

        currentRow += 4;
        ws.getCell(currentRow, colLeft).value = p.kepala_sekolah || 'Pariyanto, S.Pd., M.Pd.';
        ws.getCell(currentRow, colRight).value = p.pengurus_barang || 'Pengurus Barang SMAN 15 Tebo';
        ws.getCell(currentRow, colLeft).font = { name: 'Arial', size: 9, bold: true, underline: true };
        ws.getCell(currentRow, colRight).font = { name: 'Arial', size: 9, bold: true, underline: true };

        currentRow += 1;
        ws.getCell(currentRow, colLeft).value = `NIP. ${p.nip_kepala_sekolah || '-'}`;
        ws.getCell(currentRow, colRight).value = `NIP. ${p.nip_pengurus_barang || '-'}`;
        ws.getCell(currentRow, colLeft).font = { name: 'Arial', size: 9 };
        ws.getCell(currentRow, colRight).font = { name: 'Arial', size: 9 };

        // 6. SIMPAN FILE EXCEL
        const schoolClean = (p.nama_sekolah || 'SMAN_15_TEBO').replace(/\s+/g, '_');
        const fileName = `Buku_Inventaris_BMD_Lengkap_Permendagri47_${schoolClean}_${tahunFile}.xlsx`;
        const buffer = await wb.xlsx.writeBuffer();

        // Mode Electron Save Dialog
        if (window.sinbasAPI && window.sinbasAPI.isElectron) {
            try {
                let base64Data = '';
                const bytes = new Uint8Array(buffer);
                for (let i = 0; i < bytes.byteLength; i++) {
                    base64Data += String.fromCharCode(bytes[i]);
                }
                const base64Str = window.btoa(base64Data);

                const saveDialogRes = await window.sinbasAPI.showSaveDialog({
                    title: 'Simpan Buku Inventaris BMD Lengkap (Permendagri 47/2021)',
                    defaultPath: fileName,
                    filters: [{ name: 'Excel Spreadsheet (*.xlsx)', extensions: ['xlsx'] }]
                });

                if (!saveDialogRes.canceled && saveDialogRes.filePath) {
                    const saveRes = await window.sinbasAPI.saveFile(saveDialogRes.filePath, base64Str);
                    if (saveRes.success) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Buku Inventaris Lengkap Berhasil Disimpan!',
                            html: `File resmi <b>Permendagri 47/2021</b> (KIB A s/d F) tersimpan rapi dengan pohon hirarki kodefikasi:<br><b class="font-monospace text-cyan small">${saveDialogRes.filePath}</b>`,
                            showCancelButton: true,
                            confirmButtonText: '<i class="fas fa-folder-open me-1"></i> Buka Folder',
                            cancelButtonText: 'Tutup'
                        }).then((result) => {
                            if (result.isConfirmed) {
                                window.sinbasAPI.openItem(saveDialogRes.filePath);
                            }
                        });
                    } else {
                        throw new Error(saveRes.error || 'Gagal menyimpan file di sistem lokal.');
                    }
                }
            } catch (err) {
                console.error('[SINBAS EXCEL] Electron save gagal:', err);
                this.downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
            }
        } else {
            // Mode Web Browser
            this.downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
            Swal.fire({
                icon: 'success',
                title: 'Unduh Excel Berhasil!',
                html: `Buku Inventaris Lengkap <b>Permendagri 47/2021</b> telah diunduh:<br><b>${fileName}</b>`,
                timer: 2500,
                showConfirmButton: false
            });
        }
    },

    /**
     * RENDER HTML PRATINJAU KARTU INVENTARIS RUANGAN (KIR)
     */
    renderKirPreviewHtml: function(ruangan, assets, profile, customTtd = null) {
        const filtered = assets.filter(a => a.ruangan_id === ruangan.id);
        const p = profile || {};
        const tahun = p.tahun_anggaran || new Date().getFullYear();
        const kota = (customTtd && customTtd.tempat) ? customTtd.tempat : this.cleanKotaNama(p.kabupaten_kota);
        const ttdTanggal = (customTtd && customTtd.tanggal) ? customTtd.tanggal : `31 Desember ${tahun}`;

        let rowsHtml = '';
        let grandTotal = 0;
        let grandQty = 0;

        if (filtered.length === 0) {
            rowsHtml = `<tr><td colspan="12" class="text-center py-4 text-muted fst-italic">Belum ada barang inventaris yang ditempatkan pada ruangan ini.</td></tr>`;
        } else {
            filtered.forEach((ast, idx) => {
                const total = Number(ast.nilai_total || ast.harga_satuan) || 0;
                const qty = Number(ast.jumlah) || 1;
                grandTotal += total;
                grandQty += qty;

                rowsHtml += `
                    <tr class="kib-row-item">
                        <td class="text-center">${idx + 1}</td>
                        <td class="text-center font-monospace small">${ast.kode_barang || '-'}</td>
                        <td><b>${ast.spesifikasi_nama || ast.nama_barang}</b></td>
                        <td>${ast.merk_tipe || '-'}</td>
                        <td class="text-center font-monospace small">${ast.no_pabrik_seri || '-'}</td>
                        <td class="text-center">${ast.bahan || '-'}</td>
                        <td class="text-center">${ast.tahun_perolehan || '-'}</td>
                        <td class="text-center fw-bold">${qty}</td>
                        <td class="text-end font-monospace">${this.formatCurrency(ast.harga_satuan || 0)}</td>
                        <td class="text-end font-monospace fw-bold">${this.formatCurrency(total)}</td>
                        <td class="text-center"><span class="badge ${ast.kondisi === 'Baik' ? 'bg-success' : ast.kondisi === 'Rusak Ringan' ? 'bg-warning text-dark' : 'bg-danger'}">${ast.kondisi || 'Baik'}</span></td>
                        <td><small class="text-muted">${ast.keterangan || '-'}</small></td>
                    </tr>
                `;
            });
        }

        return `
            <div class="kib-preview-header text-center mb-4">
                <div class="kib-preview-title fs-5 fw-bold text-dark text-uppercase">KARTU INVENTARIS RUANGAN (KIR)</div>
                <div class="text-secondary small fw-bold">BERDASARKAN PERMENDAGRI NOMOR 47 TAHUN 2021</div>
            </div>

            <div class="row g-2 mb-3 small" style="border-bottom: 2px solid #0f172a; padding-bottom: 12px;">
                <div class="col-md-6">
                    <table class="table-borderless w-100" style="line-height: 1.6;">
                        <tr><td style="width: 170px;" class="fw-bold">PROVINSI</td><td>: ${(p.provinsi || 'Jambi').toUpperCase()}</td></tr>
                        <tr><td class="fw-bold">KABUPATEN / KOTA</td><td>: ${(p.kabupaten_kota || 'Kabupaten Tebo').toUpperCase()}</td></tr>
                        <tr><td class="fw-bold">SATUAN KERJA (SKPD)</td><td>: ${(p.nama_sekolah || 'SMAN 15 TEBO').toUpperCase()}</td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <table class="table-borderless w-100" style="line-height: 1.6;">
                        <tr><td style="width: 170px;" class="fw-bold">RUANGAN</td><td>: <span class="badge bg-primary">[${ruangan.kode_ruangan}] ${ruangan.nama_ruangan}</span></td></tr>
                        <tr><td class="fw-bold">PENANGGUNG JAWAB</td><td>: ${ruangan.penanggung_jawab || '-'}</td></tr>
                        <tr><td class="fw-bold">TAHUN ANGGARAN</td><td>: ${tahun}</td></tr>
                    </table>
                </div>
            </div>

            <div style="overflow-x: auto;">
                <table class="kib-table-permendagri">
                    <thead>
                        <tr>
                            <th style="width: 35px;">No.</th>
                            <th style="width: 130px;">Kode Barang</th>
                            <th>Nama Barang / Jenis Barang</th>
                            <th style="width: 120px;">Merk / Model</th>
                            <th style="width: 110px;">No. Seri Pabrik</th>
                            <th style="width: 80px;">Bahan</th>
                            <th style="width: 60px;">Tahun</th>
                            <th style="width: 60px;">Jumlah</th>
                            <th style="width: 110px;">Harga Satuan</th>
                            <th style="width: 120px;">Total Nilai</th>
                            <th style="width: 90px;">Kondisi</th>
                            <th style="width: 120px;">Keterangan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="7" class="text-end fw-bold px-3">TOTAL INVENTARIS RUANGAN</td>
                            <td class="text-center fw-bold">${grandQty}</td>
                            <td></td>
                            <td class="text-end fw-bold font-monospace text-nowrap">${this.formatCurrency(grandTotal)}</td>
                            <td colspan="2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="kib-signatures-box mt-4">
                <div class="kib-sig-col">
                    <div>Mengetahui,</div>
                    <div class="fw-bold">Kepala Sekolah Selaku Kuasa Pengguna Barang</div>
                    <div class="kib-sig-space" style="height: 60px;"></div>
                    <div class="kib-sig-name fw-bold text-decoration-underline">${p.kepala_sekolah || 'Pariyanto, S.Pd., M.Pd.'}</div>
                    <div>NIP. ${p.nip_kepala_sekolah || '-'}</div>
                </div>

                <div class="kib-sig-col">
                    <div class="kib-sig-date-line">${kota}, ${ttdTanggal}</div>
                    <div class="fw-bold">Penanggung Jawab Ruangan,</div>
                    <div class="kib-sig-space" style="height: 60px;"></div>
                    <div class="kib-sig-name fw-bold text-decoration-underline">${ruangan.penanggung_jawab || 'Penanggung Jawab'}</div>
                    <div>NIP. ${ruangan.nip_penanggung_jawab || '-'}</div>
                </div>
            </div>
        `;
    },

    /**
     * RENDER HTML PRATINJAU BUKU INVENTARIS LENGKAP (BUKU INDUK BARANG)
     * Format Baku Permendagri No. 47 Tahun 2021 (22 Kolom Komprehensif KIB A s/d F)
     * Lengkap dengan Pohon Hirarki Bertingkat (1.3.1 s/d 1.3.6) dan baris item interaktif
     */
    renderBukuIndukPreviewHtml: function(assets, profile, filterTahun = 'Semua', customTtd = null) {
        const p = profile || {};
        const isAllYears = !filterTahun || filterTahun === 'Semua';
        const tahunDisplay = isAllYears ? 'SEMUA TAHUN' : String(filterTahun);
        const tahunTtd = (!isAllYears && filterTahun) ? String(filterTahun) : String(p.tahun_anggaran || new Date().getFullYear());
        const kota = (customTtd && customTtd.tempat) ? customTtd.tempat : this.cleanKotaNama(p.kabupaten_kota);
        const ttdTanggal = (customTtd && customTtd.tanggal) ? customTtd.tanggal : `31 Desember ${tahunTtd}`;

        const model = this.getBukuInventarisModel2021(assets, profile);

        let trBodyHtml = '';
        if (!model.rows || model.rows.length === 0) {
            trBodyHtml = `<tr><td colspan="22" class="text-center py-4 text-muted fst-italic">Belum ada barang inventaris terdaftar di Buku Induk BMD.</td></tr>`;
        } else {
            model.rows.forEach(r => {
                const isHierarchyRow = r.rowType && r.rowType !== 'item';
                let trCls = '';
                let clickAttr = '';

                if (r.rowType === 'jenis') trCls = 'kib-row-jenis';
                else if (r.rowType === 'objek') trCls = 'kib-row-objek';
                else if (r.rowType === 'rincian') trCls = 'kib-row-rincian';
                else if (r.rowType === 'subrincian') trCls = 'kib-row-subrincian';
                else {
                    trCls = 'kib-row-item kib-row-clickable';
                    if (r.astId) {
                        clickAttr = ` onclick="openModalViewAset('${r.astId}')" title="Klik untuk melihat rincian barang (Read-Only)" style="cursor: pointer;"`;
                    }
                }

                let tds = '';
                r.forEach((val, colIdx) => {
                    let cellCls = '';
                    let displayVal = val !== undefined && val !== null ? val : '';

                    if (colIdx >= 0 && colIdx <= 6) {
                        // Kolom 0 s/d 6: 7 Jenjang Kodefikasi Barang
                        cellCls = 'td-kode-col font-monospace text-center';
                        if (isHierarchyRow && val) cellCls += ' fw-bold';
                    } else if (colIdx === 7 && isHierarchyRow) {
                        // Nama Barang pada baris hirarki: Indentasi visual & ikon bertingkat
                        let indent = '0px';
                        let prefix = '';
                        if (r.rowType === 'jenis') {
                            prefix = '<i class="fas fa-folder me-1 text-primary"></i> ';
                        } else if (r.rowType === 'objek') {
                            indent = '12px';
                            prefix = '<span class="text-indigo fw-bold">↳</span> ';
                        } else if (r.rowType === 'rincian') {
                            indent = '24px';
                            prefix = '<span class="text-success fw-bold">↳</span> ';
                        } else if (r.rowType === 'subrincian') {
                            indent = '36px';
                            prefix = '<span class="text-warning fw-bold">↳</span> ';
                        }
                        displayVal = `<div style="padding-left: ${indent};">${prefix}<b>${val}</b></div>`;
                        cellCls = 'text-start';
                    } else if (colIdx === 8) {
                        // Badge KIB (A, B, C, D, E, F)
                        cellCls = 'text-center';
                        displayVal = isHierarchyRow ? '' : `<span class="badge bg-secondary font-monospace">${val}</span>`;
                    } else if (colIdx === 9) {
                        // NIBAR (Nomor Induk Barang)
                        cellCls = 'text-center font-monospace small';
                        displayVal = isHierarchyRow ? '' : `<span class="badge-nibar">${val}</span>`;
                    } else if (colIdx === 10) {
                        // Nomor Register
                        cellCls = 'text-center font-monospace small';
                        displayVal = isHierarchyRow ? '' : val;
                    } else if (colIdx === 14) {
                        // Jumlah (Qty)
                        cellCls = 'text-center font-monospace fw-bold';
                        const num = Number(val) || 0;
                        displayVal = num > 0 ? num : (isHierarchyRow ? '' : '-');
                    } else if (colIdx === 17) {
                        // Kondisi (Baik, Rusak Ringan, Rusak Berat)
                        cellCls = 'text-center';
                        if (isHierarchyRow) {
                            displayVal = '';
                        } else {
                            displayVal = `<span class="badge ${val === 'Baik' ? 'bg-success' : val === 'Rusak Ringan' ? 'bg-warning text-dark' : 'bg-danger'}">${val || 'Baik'}</span>`;
                        }
                    } else if (colIdx === 18) {
                        // Harga Satuan (Rp)
                        cellCls = 'text-end font-monospace';
                        displayVal = (typeof val === 'number' && val > 0) ? this.formatCurrency(val) : (isHierarchyRow ? '' : '-');
                    } else if (colIdx === 19) {
                        // Nilai Perolehan (Rp)
                        cellCls = 'text-end font-monospace fw-bold text-nowrap';
                        displayVal = (typeof val === 'number' && val > 0) ? this.formatCurrency(val) : (isHierarchyRow ? '' : '-');
                    } else if (colIdx === 12 || colIdx === 13 || colIdx === 20 || colIdx === 21) {
                        // Teks spesifikasi tambahan, lokasi, asal-usul, keterangan
                        cellCls = 'text-start';
                        displayVal = isHierarchyRow ? '' : `<small>${val}</small>`;
                    } else {
                        if (isHierarchyRow && !val) displayVal = '';
                    }

                    tds += `<td class="${cellCls}">${displayVal}</td>`;
                });

                trBodyHtml += `<tr class="${trCls}"${clickAttr}>${tds}</tr>`;
            });
        }

        return `
            <div class="kib-preview-header text-center mb-4">
                <div class="kib-preview-title fs-5 fw-bold text-dark text-uppercase">BUKU INVENTARIS BARANG MILIK DAERAH (BMD) LENGKAP</div>
                <div class="text-secondary small fw-bold">REKAPITULASI SELURUH KIB A, B, C, D, E, DAN F • PERMENDAGRI NOMOR 47 TAHUN 2021</div>
                <div class="text-primary small mt-1"><b>${(p.nama_sekolah || 'SMAN 15 TEBO').toUpperCase()}</b> • TAHUN ANGGARAN: <b>${tahunDisplay}</b></div>
            </div>

            <div class="d-flex justify-content-between align-items-start mb-2 small text-muted">
                <div>
                    <b>1. Pengguna Barang</b> : <span class="text-dark fw-bold">${(p.nama_sekolah || 'SMAN 15 TEBO').toUpperCase()}</span><br>
                    <b>&nbsp;&nbsp;&nbsp;Kode Lokasi</b> : <span class="font-monospace text-dark fw-bold">${p.kode_lokasi || '11.15.09.04.01.001.10505963'}</span>
                </div>
                <div class="text-end font-monospace">
                    <b>Lampiran : Buku Inventaris BMD</b><br>
                    <b>Tahun Anggaran : ${tahunDisplay}</b>
                </div>
            </div>

            <div style="overflow-x: auto;">
                <table class="kib-table-permendagri">
                    <thead>
                        <tr>
                            <th colspan="7">Nomor Kode Barang</th>
                            <th rowspan="2" style="min-width: 200px;">Nama Barang / Jenis Aset</th>
                            <th rowspan="2" style="width: 50px;">KIB</th>
                            <th rowspan="2" style="width: 135px;">NIBAR</th>
                            <th rowspan="2" style="width: 70px;">Register</th>
                            <th rowspan="2" style="min-width: 160px;">Spesifikasi Nama / Merek</th>
                            <th rowspan="2" style="min-width: 200px;">Spesifikasi Tambahan &amp; Dokumen</th>
                            <th rowspan="2" style="width: 125px;">Ruangan / Lokasi</th>
                            <th rowspan="2" style="width: 55px;">Jumlah</th>
                            <th rowspan="2" style="width: 55px;">Satuan</th>
                            <th rowspan="2" style="width: 55px;">Thn</th>
                            <th rowspan="2" style="width: 80px;">Kondisi</th>
                            <th rowspan="2" style="width: 120px;">Harga Satuan (Rp)</th>
                            <th rowspan="2" style="width: 130px;">Nilai Perolehan (Rp)</th>
                            <th rowspan="2" style="width: 110px;">Asal-Usul</th>
                            <th rowspan="2" style="width: 130px;">Penggunaan / Keterangan</th>
                        </tr>
                        <tr>
                            <th class="th-subkode" title="Akun">1</th>
                            <th class="th-subkode" title="Kelompok">2</th>
                            <th class="th-subkode" title="Jenis">3</th>
                            <th class="th-subkode" title="Objek">4</th>
                            <th class="th-subkode" title="Rincian Objek">5</th>
                            <th class="th-subkode" title="Sub Rincian">6</th>
                            <th class="th-subkode" title="Sub-Sub Rincian">7</th>
                        </tr>
                        <tr>
                            <th>(1a)</th><th>(1b)</th><th>(1c)</th><th>(1d)</th><th>(1e)</th><th>(1f)</th><th>(1g)</th>
                            <th>(2)</th><th>(3)</th><th>(4)</th><th>(5)</th><th>(6)</th><th>(7)</th><th>(8)</th>
                            <th>(9)</th><th>(10)</th><th>(11)</th><th>(12)</th><th>(13)</th><th>(14)</th><th>(15)</th><th>(16)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${trBodyHtml}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="14" class="text-end fw-bold px-3">TOTAL SELURUH INVENTARIS BMD (KIB A s/d F)</td>
                            <td class="text-center fw-bold">${model.totalJumlah}</td>
                            <td colspan="4"></td>
                            <td class="text-end fw-bold font-monospace text-nowrap">${this.formatCurrency(model.totalNilai)}</td>
                            <td colspan="2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="kib-signatures-box mt-4">
                <div class="kib-sig-col">
                    <div>Mengetahui,</div>
                    <div class="fw-bold">Kepala Sekolah Selaku Kuasa Pengguna Barang</div>
                    <div class="kib-sig-space" style="height: 60px;"></div>
                    <div class="kib-sig-name fw-bold text-decoration-underline">${p.kepala_sekolah || 'Pariyanto, S.Pd., M.Pd.'}</div>
                    <div>NIP. ${p.nip_kepala_sekolah || '-'}</div>
                </div>

                <div class="kib-sig-col">
                    <div class="kib-sig-date-line">${kota}, ${ttdTanggal}</div>
                    <div class="fw-bold">Pengurus Barang Pembantu,</div>
                    <div class="kib-sig-space" style="height: 60px;"></div>
                    <div class="kib-sig-name fw-bold text-decoration-underline">${p.pengurus_barang || 'Pengurus Barang SMAN 15 Tebo'}</div>
                    <div>NIP. ${p.nip_pengurus_barang || '-'}</div>
                </div>
            </div>
        `;
    },

    /**
     * RENDER HTML PRATINJAU BPH (KATALOG, MASUK, KELUAR, PERSEDIAAN)
     */
    renderBphPreviewHtml: function(bphType, profile, bphData = {}, customTtd = null) {
        const p = profile || {};
        const tahun = p.tahun_anggaran || new Date().getFullYear();
        const kota = (customTtd && customTtd.tempat) ? customTtd.tempat : this.cleanKotaNama(p.kabupaten_kota);
        const ttdTanggal = (customTtd && customTtd.tanggal) ? customTtd.tanggal : `31 Desember ${tahun}`;

        let title = 'LAPORAN BARANG PAKAI HABIS (BPH)';
        let subtitle = `Satuan Kerja: ${p.nama_sekolah || 'SMAN 15 TEBO'} • Tahun: ${tahun}`;
        let thHtml = '';
        let tbodyHtml = '';
        let tfootHtml = '';

        if (bphType === 'masuk') {
            title = 'DAFTAR PENERIMAAN / PENGADAAN BARANG PAKAI HABIS (BPH MASUK)';
            thHtml = `
                <tr>
                    <th style="width: 35px;">No.</th>
                    <th style="width: 90px;">Tanggal</th>
                    <th style="width: 120px;">No. Faktur/BAST</th>
                    <th style="width: 100px;">Kode BPH</th>
                    <th>Nama Barang BPH</th>
                    <th style="width: 65px;">Satuan</th>
                    <th style="width: 95px;">Sumber Dana</th>
                    <th style="width: 60px;">Qty</th>
                    <th style="width: 110px;">Harga Satuan</th>
                    <th style="width: 120px;">Total Biaya (Rp)</th>
                    <th style="width: 110px;">Keterangan</th>
                </tr>
            `;

            const list = bphData.list || [];
            let totalQty = 0;
            let totalBiaya = 0;

            if (list.length === 0) {
                tbodyHtml = `<tr><td colspan="11" class="text-center py-4 text-muted fst-italic">Belum ada transaksi BPH Masuk untuk periode ini.</td></tr>`;
            } else {
                list.forEach((m, idx) => {
                    const qty = Number(m.jumlah) || 0;
                    const total = Number(m.total_harga) || (qty * (Number(m.harga_satuan) || 0));
                    totalQty += qty;
                    totalBiaya += total;

                    tbodyHtml += `
                        <tr class="kib-row-item">
                            <td class="text-center">${idx + 1}</td>
                            <td class="text-center">${m.tanggal || '-'}</td>
                            <td class="text-center font-monospace small">${m.no_dokumen || '-'}</td>
                            <td class="text-center font-monospace small">${m.kode_bph || '-'}</td>
                            <td><b>${m.nama_barang}</b></td>
                            <td class="text-center">${m.satuan || 'Pcs'}</td>
                            <td class="text-center">${m.sumber_dana || 'BOS Reguler'}</td>
                            <td class="text-center fw-bold">${qty}</td>
                            <td class="text-end font-monospace">${this.formatCurrency(m.harga_satuan || 0)}</td>
                            <td class="text-end font-monospace fw-bold">${this.formatCurrency(total)}</td>
                            <td><small class="text-muted">${m.keterangan || '-'}</small></td>
                        </tr>
                    `;
                });
            }

            tfootHtml = `
                <tr>
                    <td colspan="7" class="text-end fw-bold px-3">TOTAL PENERIMAAN BPH</td>
                    <td class="text-center fw-bold">${totalQty}</td>
                    <td></td>
                    <td class="text-end fw-bold font-monospace text-nowrap">${this.formatCurrency(totalBiaya)}</td>
                    <td></td>
                </tr>
            `;
        } else if (bphType === 'keluar') {
            title = 'DAFTAR PENDISTRIBUSIAN & PENGELUARAN BARANG PAKAI HABIS (BPH KELUAR)';
            thHtml = `
                <tr>
                    <th style="width: 35px;">No.</th>
                    <th style="width: 90px;">Tanggal</th>
                    <th style="width: 120px;">No. Bukti / Bon</th>
                    <th style="width: 100px;">Kode BPH</th>
                    <th>Nama Barang BPH</th>
                    <th style="width: 65px;">Satuan</th>
                    <th>Unit / Ruangan Penerima</th>
                    <th style="width: 60px;">Qty</th>
                    <th style="width: 120px;">Petugas / Penyerah</th>
                    <th style="width: 110px;">Keterangan</th>
                </tr>
            `;

            const list = bphData.list || [];
            let totalQty = 0;

            if (list.length === 0) {
                tbodyHtml = `<tr><td colspan="10" class="text-center py-4 text-muted fst-italic">Belum ada transaksi BPH Keluar untuk periode ini.</td></tr>`;
            } else {
                list.forEach((k, idx) => {
                    const qty = Number(k.jumlah) || 0;
                    totalQty += qty;

                    tbodyHtml += `
                        <tr class="kib-row-item">
                            <td class="text-center">${idx + 1}</td>
                            <td class="text-center">${k.tanggal || '-'}</td>
                            <td class="text-center font-monospace small">${k.no_dokumen || '-'}</td>
                            <td class="text-center font-monospace small">${k.kode_bph || '-'}</td>
                            <td><b>${k.nama_barang}</b></td>
                            <td class="text-center">${k.satuan || 'Pcs'}</td>
                            <td>${k.tujuan_penggunaan || k.nama_penerima || '-'}</td>
                            <td class="text-center fw-bold">${qty}</td>
                            <td>${k.petugas_penyerah || p.pengurus_barang || '-'}</td>
                            <td><small class="text-muted">${k.keterangan || '-'}</small></td>
                        </tr>
                    `;
                });
            }

            tfootHtml = `
                <tr>
                    <td colspan="7" class="text-end fw-bold px-3">TOTAL PENGELUARAN BPH</td>
                    <td class="text-center fw-bold">${totalQty}</td>
                    <td colspan="2"></td>
                </tr>
            `;
        } else if (bphType === 'saldo' || bphType === 'persediaan') {
            title = 'BUKU PERSEDIAAN BARANG PAKAI HABIS (BPH)';
            thHtml = `
                <tr>
                    <th style="width: 35px;">No.</th>
                    <th style="width: 100px;">Kode BPH</th>
                    <th>Nama Barang BPH</th>
                    <th style="width: 65px;">Satuan</th>
                    <th style="width: 75px;">Saldo Awal</th>
                    <th style="width: 75px;">Masuk</th>
                    <th style="width: 75px;">Keluar</th>
                    <th style="width: 80px;">Sisa Saldo</th>
                    <th style="width: 110px;">Harga Satuan</th>
                    <th style="width: 130px;">Total Persediaan (Rp)</th>
                </tr>
            `;

            const list = bphData.list || [];
            let totalSaldoNilai = 0;

            if (list.length === 0) {
                tbodyHtml = `<tr><td colspan="10" class="text-center py-4 text-muted fst-italic">Belum ada data kartu persediaan BPH.</td></tr>`;
            } else {
                list.forEach((s, idx) => {
                    const totalNilai = Number(s.total_nilai) || 0;
                    totalSaldoNilai += totalNilai;

                    tbodyHtml += `
                        <tr class="kib-row-item">
                            <td class="text-center">${idx + 1}</td>
                            <td class="text-center font-monospace small">${s.kode_bph || '-'}</td>
                            <td><b>${s.nama_barang}</b></td>
                            <td class="text-center">${s.satuan || 'Pcs'}</td>
                            <td class="text-center">${s.saldo_awal || 0}</td>
                            <td class="text-center text-success fw-bold">+${s.masuk || 0}</td>
                            <td class="text-center text-danger fw-bold">-${s.keluar || 0}</td>
                            <td class="text-center fw-bold bg-light">${s.sisa || 0}</td>
                            <td class="text-end font-monospace">${this.formatCurrency(s.harga_satuan || 0)}</td>
                            <td class="text-end font-monospace fw-bold">${this.formatCurrency(totalNilai)}</td>
                        </tr>
                    `;
                });
            }

            tfootHtml = `
                <tr>
                    <td colspan="9" class="text-end fw-bold px-3">TOTAL NILAI SALDO PERSEDIAAN BPH</td>
                    <td class="text-end fw-bold font-monospace text-nowrap">${this.formatCurrency(totalSaldoNilai)}</td>
                </tr>
            `;
        }

        return `
            <div class="kib-preview-header text-center mb-4">
                <div class="kib-preview-title fs-5 fw-bold text-dark text-uppercase">${title}</div>
                <div class="text-secondary small fw-bold">${subtitle}</div>
            </div>

            <div style="overflow-x: auto;">
                <table class="kib-table-permendagri">
                    <thead>
                        ${thHtml}
                    </thead>
                    <tbody>
                        ${tbodyHtml}
                    </tbody>
                    <tfoot>
                        ${tfootHtml}
                    </tfoot>
                </table>
            </div>

            <div class="kib-signatures-box mt-4">
                <div class="kib-sig-col">
                    <div>Mengetahui,</div>
                    <div class="fw-bold">Kepala Sekolah Selaku Kuasa Pengguna Barang</div>
                    <div class="kib-sig-space" style="height: 60px;"></div>
                    <div class="kib-sig-name fw-bold text-decoration-underline">${p.kepala_sekolah || 'Pariyanto, S.Pd., M.Pd.'}</div>
                    <div>NIP. ${p.nip_kepala_sekolah || '-'}</div>
                </div>

                <div class="kib-sig-col">
                    <div class="kib-sig-date-line">${kota}, ${ttdTanggal}</div>
                    <div class="fw-bold">Pengurus Barang Pembantu,</div>
                    <div class="kib-sig-space" style="height: 60px;"></div>
                    <div class="kib-sig-name fw-bold text-decoration-underline">${p.pengurus_barang || 'Pengurus Barang SMAN 15 Tebo'}</div>
                    <div>NIP. ${p.nip_pengurus_barang || '-'}</div>
                </div>
            </div>
        `;
    },

    /**
     * RENDER HTML PRATINJAU USULAN PENGHAPUSAN BARANG (BMD)
     */
    renderPenghapusanPreviewHtml: function(list, profile, customTtd = null) {
        const p = profile || {};
        const tahun = p.tahun_anggaran || new Date().getFullYear();
        const kota = (customTtd && customTtd.tempat) ? customTtd.tempat : this.cleanKotaNama(p.kabupaten_kota);
        const ttdTanggal = (customTtd && customTtd.tanggal) ? customTtd.tanggal : `31 Desember ${tahun}`;
        const instansi = (p.nama_instansi || `PEMERINTAH PROVINSI ${(p.provinsi || 'Jambi').toUpperCase()}`).toUpperCase();
        const opd = (p.nama_opd !== undefined ? p.nama_opd : 'DINAS PENDIDIKAN DAN KEBUDAYAAN').trim();
        const sekolah = (p.nama_sekolah || 'SMAN 15 TEBO').toUpperCase();

        let rowsHtml = '';
        let totalNilai = 0;

        if (!list || list.length === 0) {
            rowsHtml = `<tr><td colspan="12" class="text-center py-4 text-muted fst-italic">Belum ada usulan penghapusan barang yang tercatat atau cocok dengan pencarian.</td></tr>`;
        } else {
            list.forEach((h, idx) => {
                const val = Number(h.nilai_satuan) || 0;
                totalNilai += val;
                let badgeKondisi = `<span class="badge bg-danger">Rusak Berat</span>`;
                if (h.kondisi_terakhir === 'Baik') badgeKondisi = `<span class="badge bg-success">Baik</span>`;
                else if (h.kondisi_terakhir === 'Rusak Ringan') badgeKondisi = `<span class="badge bg-warning text-dark">Rusak Ringan</span>`;

                rowsHtml += `
                    <tr class="kib-row-item">
                        <td class="text-center">${idx + 1}</td>
                        <td class="text-center text-nowrap"><small class="badge bg-light text-dark border px-2 py-1">${h.tanggal_usulan || '-'}</small></td>
                        <td class="text-center font-monospace small"><span class="badge-nibar">${h.nibar}</span><br><small class="text-muted">Reg. ${h.no_register || '-'}</small></td>
                        <td class="text-center font-monospace small">${h.kode_barang || '-'}</td>
                        <td><b>${h.spesifikasi_nama || h.nama_barang}</b></td>
                        <td>${h.merk_tipe || '-'}</td>
                        <td class="text-center">${h.tahun_perolehan || '-'}</td>
                        <td><small>${h.asal_usul || 'BOS Reguler'}</small></td>
                        <td class="text-end font-monospace fw-bold text-nowrap">${this.formatCurrency(val)}</td>
                        <td class="text-center">${badgeKondisi}</td>
                        <td><span class="badge bg-danger bg-opacity-75">${h.alasan || 'Rusak Berat'}</span></td>
                        <td><small>${h.keterangan || '-'}</small></td>
                    </tr>
                `;
            });
        }

        return `
            <div class="kib-preview-header text-center mb-4">
                <div class="kib-preview-title fs-5 fw-bold text-dark text-uppercase">DAFTAR REKAPITULASI USULAN PENGHAPUSAN BARANG MILIK DAERAH (BMD)</div>
                <div class="text-secondary small fw-bold">${instansi}${opd ? ` • ${opd.toUpperCase()}` : ''}</div>
                <div class="text-primary small mt-1"><b>${sekolah}</b> • TAHUN ANGGARAN ${tahun}</div>
            </div>

            <div style="overflow-x: auto;">
                <table class="kib-table-permendagri">
                    <thead>
                        <tr>
                            <th style="width: 35px;">No.</th>
                            <th style="width: 105px;">Tgl Usulan</th>
                            <th style="width: 135px;">NIBAR / Reg</th>
                            <th style="width: 125px;">Kodefikasi</th>
                            <th>Nama &amp; Spesifikasi Barang</th>
                            <th style="width: 110px;">Merk / Tipe</th>
                            <th style="width: 55px;">Thn</th>
                            <th style="width: 100px;">Sumber Dana</th>
                            <th style="width: 125px;">Nilai Perolehan</th>
                            <th style="width: 90px;">Kondisi</th>
                            <th style="width: 120px;">Alasan</th>
                            <th style="width: 130px;">Keterangan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="8" class="text-end fw-bold px-3">TOTAL NILAI BARANG DIUSULKAN HAPUS (${list ? list.length : 0} UNIT)</td>
                            <td class="text-end fw-bold font-monospace text-nowrap">${this.formatCurrency(totalNilai)}</td>
                            <td colspan="3"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="kib-signatures-box mt-4">
                <div class="kib-sig-col">
                    <div>Mengetahui,</div>
                    <div class="fw-bold">Kepala Sekolah Selaku Kuasa Pengguna Barang</div>
                    <div class="kib-sig-space" style="height: 60px;"></div>
                    <div class="kib-sig-name fw-bold text-decoration-underline">${p.kepala_sekolah || 'Pariyanto, S.Pd., M.Pd.'}</div>
                    <div>NIP. ${p.nip_kepala_sekolah || '-'}</div>
                </div>

                <div class="kib-sig-col">
                    <div class="kib-sig-date-line">${kota}, ${ttdTanggal}</div>
                    <div class="fw-bold">Pengurus Barang Pembantu,</div>
                    <div class="kib-sig-space" style="height: 60px;"></div>
                    <div class="kib-sig-name fw-bold text-decoration-underline">${p.pengurus_barang || 'Pengurus Barang SMAN 15 Tebo'}</div>
                    <div>NIP. ${p.nip_pengurus_barang || '-'}</div>
                </div>
            </div>
        `;
    },

    /**
     * RENDER HTML PRATINJAU RIWAYAT MUTASI & PERPINDAHAN RUANGAN BARANG
     */
    renderMutasiPreviewHtml: function(list, profile, customTtd = null) {
        const p = profile || {};
        const tahun = p.tahun_anggaran || new Date().getFullYear();
        const kota = (customTtd && customTtd.tempat) ? customTtd.tempat : this.cleanKotaNama(p.kabupaten_kota);
        const ttdTanggal = (customTtd && customTtd.tanggal) ? customTtd.tanggal : `31 Desember ${tahun}`;
        const instansi = (p.nama_instansi || `PEMERINTAH PROVINSI ${(p.provinsi || 'Jambi').toUpperCase()}`).toUpperCase();
        const opd = (p.nama_opd !== undefined ? p.nama_opd : 'DINAS PENDIDIKAN DAN KEBUDAYAAN').trim();
        const sekolah = (p.nama_sekolah || 'SMAN 15 TEBO').toUpperCase();

        let rowsHtml = '';

        if (!list || list.length === 0) {
            rowsHtml = `<tr><td colspan="9" class="text-center py-4 text-muted fst-italic">Belum ada riwayat pergerakan/mutasi aset antar ruangan.</td></tr>`;
        } else {
            list.forEach((m, idx) => {
                rowsHtml += `
                    <tr class="kib-row-item">
                        <td class="text-center">${idx + 1}</td>
                        <td class="text-center text-nowrap"><small class="badge bg-light text-dark border px-2 py-1">${m.tanggal_mutasi || '-'}</small></td>
                        <td class="text-center font-monospace small"><span class="badge-nibar">${m.nibar}</span></td>
                        <td><b>${m.nama_barang}</b></td>
                        <td class="text-center"><span class="badge bg-secondary">${m.ruangan_asal_nama || '-'}</span></td>
                        <td class="text-center"><span class="badge bg-success">${m.ruangan_tujuan_nama || '-'}</span></td>
                        <td><small>${m.alasan_mutasi || '-'}</small></td>
                        <td class="text-center font-monospace small"><span class="badge bg-light text-dark border">${m.no_berita_acara || '-'}</span></td>
                        <td><small>${m.petugas || '-'}</small></td>
                    </tr>
                `;
            });
        }

        return `
            <div class="kib-preview-header text-center mb-4">
                <div class="kib-preview-title fs-5 fw-bold text-dark text-uppercase">BUKU CATATAN MUTASI &amp; PERPINDAHAN RUANGAN BARANG MILIK DAERAH (BMD)</div>
                <div class="text-secondary small fw-bold">${instansi}${opd ? ` • ${opd.toUpperCase()}` : ''}</div>
                <div class="text-primary small mt-1"><b>${sekolah}</b> • TAHUN ANGGARAN ${tahun}</div>
            </div>

            <div style="overflow-x: auto;">
                <table class="kib-table-permendagri">
                    <thead>
                        <tr>
                            <th style="width: 35px;">No.</th>
                            <th style="width: 110px;">Tgl Mutasi</th>
                            <th style="width: 140px;">NIBAR</th>
                            <th>Nama &amp; Spesifikasi Barang</th>
                            <th style="width: 120px;">Ruangan Asal</th>
                            <th style="width: 120px;">Ruangan Tujuan</th>
                            <th>Alasan Mutasi</th>
                            <th style="width: 130px;">No. Berita Acara</th>
                            <th style="width: 110px;">Petugas</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="7" class="text-end fw-bold px-3">TOTAL MUTASI / PERPINDAHAN RUANGAN BARANG</td>
                            <td colspan="2" class="text-center fw-bold text-primary">${list ? list.length : 0} Pergerakan</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="kib-signatures-box mt-4">
                <div class="kib-sig-col">
                    <div>Mengetahui,</div>
                    <div class="fw-bold">Kepala Sekolah Selaku Kuasa Pengguna Barang</div>
                    <div class="kib-sig-space" style="height: 60px;"></div>
                    <div class="kib-sig-name fw-bold text-decoration-underline">${p.kepala_sekolah || 'Pariyanto, S.Pd., M.Pd.'}</div>
                    <div>NIP. ${p.nip_kepala_sekolah || '-'}</div>
                </div>

                <div class="kib-sig-col">
                    <div class="kib-sig-date-line">${kota}, ${ttdTanggal}</div>
                    <div class="fw-bold">Pengurus Barang Pembantu,</div>
                    <div class="kib-sig-space" style="height: 60px;"></div>
                    <div class="kib-sig-name fw-bold text-decoration-underline">${p.pengurus_barang || 'Pengurus Barang SMAN 15 Tebo'}</div>
                    <div>NIP. ${p.nip_pengurus_barang || '-'}</div>
                </div>
            </div>
        `;
    },

    /**
     * Tanda Tangan Resmi
     */
    appendSignatures: function(rows, profile, tahunOverride, customTtd = null) {
        const p = profile || {};
        const kota = (customTtd && customTtd.tempat) ? customTtd.tempat : this.cleanKotaNama(p.kabupaten_kota);
        const tahun = tahunOverride || p.tahun_anggaran || new Date().getFullYear();
        const ttdTanggal = (customTtd && customTtd.tanggal) ? customTtd.tanggal : `31 Desember ${tahun}`;

        rows.push([]);
        rows.push(['Mengetahui,', '', '', '', '', '', '', '', '', `${kota}, ${ttdTanggal}`]);
        rows.push(['Kepala Sekolah,', '', '', '', '', '', '', '', '', 'Pengurus Barang Pembantu,']);
        rows.push([]);
        rows.push([]);
        rows.push([]);
        rows.push([`${p.kepala_sekolah || 'Pariyanto, S.Pd., M.Pd.'}`, '', '', '', '', '', '', '', '', `${p.pengurus_barang || 'Pengurus Barang'}`]);
        rows.push([`NIP. ${p.nip_kepala_sekolah || '-'}`, '', '', '', '', '', '', '', '', `NIP. ${p.nip_pengurus_barang || '-'}`]);
    },

    /**
     * Fallback XLSX SheetJS Generator untuk tabel sederhana (KIR, Buku Induk, dll)
     */
    /**
     * Mesin Ekspor Excel Resmi Berbasis ExcelJS:
     * - Auto Merge Judul & Metadata Laporan
     * - Header Navy Bergaris Rapi & Elegan
     * - Border Tipis (Thin) di Seluruh Sel Data
     * - Format Angka Akuntansi / Rupiah (#,##0)
     * - Auto Merge & Double Border Baris Total
     * - Layout Tanda Tangan Rapi
     * - Page Setup Otomatis A4 (Portrait/Landscape)
     * - Mendukung Electron Save Dialog & Browser Download
     */
    generateFile: async function(rowsAoa, fileName, sheetTitle, colWidths) {
        if (!rowsAoa || rowsAoa.length === 0) return;

        const ExcelLib = window.ExcelJS || (typeof ExcelJS !== 'undefined' ? ExcelJS : null);

        // Jika ExcelJS tidak tersedia, gunakan fallback SheetJS
        if (!ExcelLib) {
            console.warn('[ExcelExporter] ExcelJS belum siap, menggunakan fallback SheetJS.');
            this.generateFileFallbackSheetJS(rowsAoa, fileName, sheetTitle, colWidths);
            return;
        }

        const wb = new ExcelLib.Workbook();
        wb.creator = 'SINBAS BMD';
        wb.created = new Date();

        // Cari jumlah kolom tabel maksimum
        let maxCols = 1;
        rowsAoa.forEach(r => {
            if (Array.isArray(r) && r.length > maxCols) {
                maxCols = r.length;
            }
        });

        const isLandscape = maxCols > 8;

        const ws = wb.addWorksheet(sheetTitle || 'Laporan BMD', {
            pageSetup: {
                paperSize: 9, // A4
                orientation: isLandscape ? 'landscape' : 'portrait',
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                margins: {
                    left: 0.5,
                    right: 0.5,
                    top: 0.6,
                    bottom: 0.6,
                    header: 0.3,
                    footer: 0.3
                }
            },
            views: [{ showGridLines: true }]
        });

        // Deteksi baris header tabel (baris pertama yang berisi 'No.' atau 'No' atau 'Kode Barang' dsb)
        let headerRowIdx = -1;
        for (let i = 0; i < rowsAoa.length; i++) {
            const row = rowsAoa[i];
            if (Array.isArray(row) && row.length > 0) {
                const firstCell = String(row[0] || '').trim().toLowerCase();
                const secondCell = String(row[1] || '').trim().toLowerCase();
                if (firstCell === 'no.' || firstCell === 'no' || firstCell === 'kib' || firstCell === 'nibar' || secondCell === 'kode barang' || secondCell === 'kib') {
                    headerRowIdx = i;
                    break;
                }
            }
        }

        // Tulis dan format setiap baris
        for (let rIdx = 0; rIdx < rowsAoa.length; rIdx++) {
            const rowData = rowsAoa[rIdx] || [];
            const excelRow = ws.getRow(rIdx + 1);

            for (let cIdx = 0; cIdx < rowData.length; cIdx++) {
                excelRow.getCell(cIdx + 1).value = rowData[cIdx];
            }

            // =================================================================
            // 1. BARIS SEBELUM HEADER TABEL: JUDUL LAPORAN & METADATA INSTANSI
            // =================================================================
            if (headerRowIdx !== -1 && rIdx < headerRowIdx) {
                const filledCells = rowData.filter(v => v !== null && v !== undefined && String(v).trim() !== '');

                // A. Baris Judul Utama (1 cell terisi) -> Merge A1 s/d LastCol, Bold, Center
                if (filledCells.length === 1 && rowData[0]) {
                    try {
                        ws.mergeCells(rIdx + 1, 1, rIdx + 1, maxCols);
                    } catch (_) {}
                    const cell = excelRow.getCell(1);
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    if (rIdx === 0) {
                        cell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF0F172A' } };
                        excelRow.height = 24;
                    } else if (rIdx === 1) {
                        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF334155' } };
                        excelRow.height = 20;
                    } else {
                        cell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
                        excelRow.height = 18;
                    }
                }
                // B. Baris Metadata (Label & Value, misal: PROVINSI : Jambi)
                else if (filledCells.length >= 2 && rowData[0] && rowData[1]) {
                    if (maxCols >= 8) {
                        // Merge Kolom A s/d E (1 s/d 5) untuk Label agar tidak terpotong
                        try {
                            ws.mergeCells(rIdx + 1, 1, rIdx + 1, 5);
                        } catch (_) {}
                        const labelCell = excelRow.getCell(1);
                        labelCell.value = rowData[0];
                        labelCell.font = { name: 'Arial', size: 10, bold: true };
                        labelCell.alignment = { vertical: 'middle', horizontal: 'left' };

                        // Kolom F (6) ke kanan untuk Nilai (: Jambi, dll)
                        try {
                            ws.mergeCells(rIdx + 1, 6, rIdx + 1, Math.min(maxCols, 14));
                        } catch (_) {}
                        const valCell = excelRow.getCell(6);
                        valCell.value = rowData[1];
                        valCell.font = { name: 'Arial', size: 10, bold: true };
                        valCell.alignment = { vertical: 'middle', horizontal: 'left' };

                        // Kosongkan sel 2 s/d 5 agar tidak bentrok
                        for (let c = 2; c <= 5; c++) {
                            excelRow.getCell(c).value = null;
                        }
                    } else if (maxCols >= 5) {
                        try {
                            ws.mergeCells(rIdx + 1, 1, rIdx + 1, 3);
                        } catch (_) {}
                        const labelCell = excelRow.getCell(1);
                        labelCell.value = rowData[0];
                        labelCell.font = { name: 'Arial', size: 10, bold: true };
                        labelCell.alignment = { vertical: 'middle', horizontal: 'left' };

                        try {
                            ws.mergeCells(rIdx + 1, 4, rIdx + 1, maxCols);
                        } catch (_) {}
                        const valCell = excelRow.getCell(4);
                        valCell.value = rowData[1];
                        valCell.font = { name: 'Arial', size: 10, bold: true };
                        valCell.alignment = { vertical: 'middle', horizontal: 'left' };

                        excelRow.getCell(2).value = null;
                        excelRow.getCell(3).value = null;
                    } else {
                        const labelCell = excelRow.getCell(1);
                        labelCell.font = { name: 'Arial', size: 10, bold: true };
                        const valCell = excelRow.getCell(2);
                        valCell.font = { name: 'Arial', size: 10 };
                    }
                    excelRow.height = 20;
                }
            }

            // =================================================================
            // 2. BARIS HEADER TABEL: BIRU NAVY ELEGAN, TEKS PUTIH BOLD, BORDER
            // =================================================================
            else if (rIdx === headerRowIdx) {
                excelRow.height = 28;
                for (let cIdx = 1; cIdx <= maxCols; cIdx++) {
                    const cell = excelRow.getCell(cIdx);
                    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FF1E3A8A' } // Navy Blue formal
                    };
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
                        left: { style: 'thin', color: { argb: 'FF3B82F6' } },
                        right: { style: 'thin', color: { argb: 'FF3B82F6' } }
                    };
                }
            }

            // =================================================================
            // 3. BARIS DATA TABEL, TOTAL, & TANDA TANGAN
            // =================================================================
            else if (headerRowIdx !== -1 && rIdx > headerRowIdx) {
                const rowStr = rowData.map(v => String(v || '')).join(' ');
                const isTotalRow = rowStr.toUpperCase().includes('TOTAL');
                const isSignRow = rowStr.includes('Mengetahui') || rowStr.includes('Kepala Sekolah') || rowStr.includes('Pengurus Barang') || rowStr.includes('NIP.');

                // A. BARIS TOTAL
                if (isTotalRow) {
                    excelRow.height = 24;
                    let totalLabelCol = -1;
                    for (let cIdx = 0; cIdx < rowData.length; cIdx++) {
                        if (String(rowData[cIdx] || '').toUpperCase().includes('TOTAL')) {
                            totalLabelCol = cIdx + 1;
                            break;
                        }
                    }

                    if (totalLabelCol > 1) {
                        try {
                            ws.mergeCells(rIdx + 1, 1, rIdx + 1, totalLabelCol);
                        } catch (_) {}
                    }

                    for (let cIdx = 1; cIdx <= maxCols; cIdx++) {
                        const cell = excelRow.getCell(cIdx);
                        cell.font = { name: 'Arial', size: 10, bold: true };
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF1F5F9' }
                        };
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'FF000000' } },
                            bottom: { style: 'double', color: { argb: 'FF000000' } },
                            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                        };
                        if (typeof cell.value === 'number') {
                            cell.numFmt = '#,##0';
                            cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        } else {
                            if (cIdx <= totalLabelCol) {
                                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                            }
                        }
                    }
                }

                // B. BARIS TANDA TANGAN RESMI
                else if (isSignRow) {
                    excelRow.height = 20;
                    const leftCol = 2; // Kolom B
                    const rightCol = Math.max(leftCol + 3, maxCols - 3);

                    const c1 = excelRow.getCell(leftCol);
                    if (c1.value) {
                        try {
                            ws.mergeCells(rIdx + 1, leftCol, rIdx + 1, leftCol + 2);
                        } catch (_) {}
                        c1.alignment = { horizontal: 'center', vertical: 'middle' };
                        const isBossTitle = String(c1.value).includes('Kepala') || String(c1.value).includes('Kuasa');
                        const isNip = String(c1.value).includes('NIP.');
                        const isName = !isBossTitle && !isNip && !String(c1.value).includes('Mengetahui') && String(c1.value).trim().length > 3;

                        c1.font = { name: 'Arial', size: 10, bold: isBossTitle || isName, underline: isName };
                    }

                    const c2 = excelRow.getCell(rightCol);
                    if (c2.value) {
                        try {
                            ws.mergeCells(rIdx + 1, rightCol, rIdx + 1, maxCols);
                        } catch (_) {}
                        c2.alignment = { horizontal: 'center', vertical: 'middle' };
                        const isStaffTitle = String(c2.value).includes('Pengurus') || String(c2.value).includes('Petugas');
                        const isNip = String(c2.value).includes('NIP.');
                        const isName = !isStaffTitle && !isNip && !String(c2.value).includes('Desember') && !String(c2.value).includes('202') && String(c2.value).trim().length > 3;

                        c2.font = { name: 'Arial', size: 10, bold: isStaffTitle || isName, underline: isName };
                    }
                }

                // C. BARIS DATA TABEL BIASA
                else {
                    const isBlankRow = rowData.every(v => v === null || v === undefined || String(v).trim() === '');
                    if (!isBlankRow) {
                        excelRow.height = 21;
                        for (let cIdx = 1; cIdx <= maxCols; cIdx++) {
                            const cell = excelRow.getCell(cIdx);
                            cell.font = { name: 'Arial', size: 9.5 };
                            cell.border = {
                                top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                                right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                            };

                            const val = cell.value;
                            if (typeof val === 'number') {
                                if (val >= 1000) {
                                    cell.numFmt = '#,##0';
                                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                                } else {
                                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                                }
                            } else {
                                const str = String(val || '').trim();
                                if (cIdx === 1 || str.length <= 4 || /^\d+$/.test(str) || /^\d{4}$/.test(str)) {
                                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                                } else if (str.startsWith('1.') || str.startsWith('0') || /^\d+(\.\d+)+$/.test(str)) {
                                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                                } else {
                                    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
                                }
                            }
                        }
                    }
                }
            }
        }

        // Terapkan Lebar Kolom Proporsional (Anti-Teks Terpotong / Anti-###)
        if (colWidths && Array.isArray(colWidths)) {
            ws.columns = colWidths.map((w, idx) => ({
                key: 'col_' + idx,
                width: Math.max(w.wch || w.width || 12, 10)
            }));
        } else {
            for (let c = 1; c <= maxCols; c++) {
                let maxLen = 10;
                for (let r = 1; r <= ws.rowCount; r++) {
                    const v = ws.getRow(r).getCell(c).value;
                    if (v && r > (headerRowIdx >= 0 ? headerRowIdx : 0)) {
                        const len = String(v).length;
                        if (len > maxLen && len < 60) maxLen = len;
                    }
                }
                ws.getColumn(c).width = Math.min(Math.max(maxLen + 3, 10), 45);
            }
        }

        // SIMPAN WORKBOOK (Mendukung Electron Desktop & Web Browser)
        const buffer = await wb.xlsx.writeBuffer();

        if (window.sinbasAPI && window.sinbasAPI.isElectron) {
            try {
                const uint8 = new Uint8Array(buffer);
                let binary = '';
                for (let i = 0; i < uint8.byteLength; i++) {
                    binary += String.fromCharCode(uint8[i]);
                }
                const base64Data = btoa(binary);

                const result = await window.sinbasAPI.showSaveDialog({
                    title: 'Simpan Laporan Excel',
                    defaultPath: fileName,
                    filters: [{ name: 'Excel Spreadsheet', extensions: ['xlsx'] }]
                });

                if (!result.canceled && result.filePath) {
                    const res = await window.sinbasAPI.saveFile(result.filePath, base64Data);
                    if (res.success) {
                        if (typeof Swal !== 'undefined') {
                            Swal.fire({
                                icon: 'success',
                                title: 'Berhasil Diekspor!',
                                html: `Laporan Excel rapi berhasil disimpan ke:<br><small class="text-primary font-monospace">${result.filePath}</small>`,
                                confirmButtonText: 'Buka Folder'
                            }).then(sw => {
                                if (sw.isConfirmed) {
                                    window.sinbasAPI.openPath(result.filePath);
                                }
                            });
                        } else {
                            alert(`File berhasil disimpan di: ${result.filePath}`);
                        }
                    } else {
                        alert(`Gagal menyimpan file: ${res.error}`);
                    }
                }
                return;
            } catch (err) {
                console.warn('[ExcelExporter] Electron save dialog fallback:', err);
            }
        }

        // Fallback Web Browser Blob
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Unduh Excel Berhasil',
                text: `File ${fileName} telah diunduh.`
            });
        }
    },

    /**
     * Fallback XLSX SheetJS dasar jika ExcelJS tidak ada
     */
    generateFileFallbackSheetJS: function(rowsAoa, fileName, sheetTitle, colWidths) {
        if (typeof XLSX === 'undefined') {
            alert('Pustaka Excel belum dimuat.');
            return;
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rowsAoa);
        if (colWidths) ws['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(wb, ws, sheetTitle || 'Inventaris');
        XLSX.writeFile(wb, fileName);
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SinbasExcelExporter;
}
