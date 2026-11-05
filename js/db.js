/**
 * =========================================================================================
 * SINBAS HYBRID — Client Data Access Layer & Multi-Tenant Engine
 * =========================================================================================
 * Mendukung Eksekusi Hybrid:
 * 1. Di dalam Electron Desktop (Offline Native):
 *    - Akses langsung ke SQLite3 Engine melalui window.sinbasAPI
 *    - Otentikasi login offline dari SQLite / config-offline.js tanpa perlu internet
 *
 * 2. Di dalam Web Browser (Online Cloud - GitHub Pages / Hosting Web):
 *    - Akses ke Google Apps Script (GAS) Web App & Google Sheets
 *    - Otentikasi login online langsung mengambil & memverifikasi password dari Google Spreadsheet
 *    - Mendukung Multi-Tenant (Bisa dijual ke banyak sekolah dengan spreadsheet masing-masing)
 *    - Caching lokal dengan Dexie.js (IndexedDB) agar UI tetap secepat kilat (instant responsiveness)
 * =========================================================================================
 */

class SinbasDatabase {
    constructor() {
        this.isElectron = typeof window !== 'undefined' && window.sinbasAPI && window.sinbasAPI.isElectron;
        this.dexieDb = null;
        this.ready = false;
        this.syncing = false;
        this.readyPromise = this.init();
    }

    async init() {
        if (this.isElectron) {
            console.log('[SinbasDB] Mode Aktif: Electron Desktop (Native SQLite3 Offline)');
            this.ready = true;
            return;
        }

        console.log('[SinbasDB] Mode Aktif: Browser Web Online (Google Sheets Cloud Backend)');
        if (typeof Dexie !== 'undefined') {
            this.dexieDb = new Dexie('SinbasWebDatabase');
            this.dexieDb.version(5).stores({
                config: 'key',
                ruangan: 'id, kode_ruangan, nama_ruangan',
                aset: 'id, kib_type, nibar, no_register, kode_barang, nama_barang, ruangan_id, kondisi, tahun_perolehan, batch_id',
                bph: 'id, kode_bph, nama_barang, kategori, satuan',
                master_bph: 'id, kode_bph, nama_barang, kategori, satuan',
                bph_masuk: 'id, master_bph_id, kode_bph, nama_barang, tanggal, tahun, bulan, sumber_dana',
                bph_keluar: 'id, master_bph_id, kode_bph, nama_barang, tanggal, tahun, bulan, ruangan_id',
                master_kode_barang: 'id, kib, kode, nama, kategori',
                riwayat_penghapusan: 'id, aset_id, nibar, no_register, kode_barang, tanggal_usulan, status_penghapusan, batch_id',
                riwayat_mutasi: 'id, aset_id, nibar, tanggal_mutasi',
                riwayat_pemeliharaan: 'id, aset_id, nibar, tanggal',
                sensus_log: 'id, aset_id, nibar, periode_tahun'
            });

            // Inisialisasi awal profil jika Dexie masih kosong
            const count = await this.dexieDb.config.count();
            if (count === 0) {
                await this.seedInitialLocalConfig();
            }
        }
        this.ready = true;
    }

    // =========================================================================
    // MULTI-TENANT & GOOGLE APPS SCRIPT CONFIGURATION
    // =========================================================================

    /**
     * Mendapatkan Kode Tenant / ID Sekolah Aktif.
     * Prioritas:
     * 1. URL Query Parameter: ?id=nama_sekolah (atau ?tenant=...)
     * 2. LocalStorage ('sinbas_active_tenant')
     * 3. Konfigurasi bawaan SINBAS_ONLINE_CONFIG.default_tenant
     */
    getActiveTenant() {
        if (typeof window === 'undefined') return 'sman15tebo';

        // 1. Cek parameter URL (?id=... diutamakan sesuai permintaan)
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const tFromUrl = urlParams.get('id') || urlParams.get('tenant') || urlParams.get('sekolah') || urlParams.get('school') || urlParams.get('npsn');
            if (tFromUrl) {
                const clean = tFromUrl.trim();
                localStorage.setItem('sinbas_active_tenant', clean);
                return clean;
            }
        } catch (_) {}

        // 2. Cek LocalStorage
        const savedTenant = localStorage.getItem('sinbas_active_tenant');
        if (savedTenant) return savedTenant.trim();

        // 3. Fallback konfigurasi file config-online.js
        if (typeof SINBAS_ONLINE_CONFIG !== 'undefined' && SINBAS_ONLINE_CONFIG.default_tenant) {
            return SINBAS_ONLINE_CONFIG.default_tenant.trim();
        }

        return 'sman15tebo';
    }

    /**
     * Mengatur Kode Tenant / ID Sekolah Aktif
     */
    setActiveTenant(tenantCode) {
        if (!tenantCode) return;
        const clean = String(tenantCode).trim();
        localStorage.setItem('sinbas_active_tenant', clean);
    }

    /**
     * Mendapatkan URL GAS Exec bawaan dari config-offline.js (Desktop Native / File Config)
     */
    getOfflineConfigUrl() {
        if (typeof window !== 'undefined') {
            // 1. Dari preload Electron window.sinbasAPI.offlineConfig
            if (window.sinbasAPI && window.sinbasAPI.offlineConfig && window.sinbasAPI.offlineConfig.gas_exec_url) {
                return window.sinbasAPI.offlineConfig.gas_exec_url.trim();
            }
            // 2. Dari script global window.SINBAS_OFFLINE_CONFIG
            if (window.SINBAS_OFFLINE_CONFIG && window.SINBAS_OFFLINE_CONFIG.gas_exec_url) {
                return window.SINBAS_OFFLINE_CONFIG.gas_exec_url.trim();
            }
        }
        return '';
    }

    /**
     * Mendapatkan URL Web App Exec Google Apps Script berdasarkan Tenant / ID Sekolah
     */
    getGasExecUrl(tenantCode) {
        const tenant = (tenantCode || this.getActiveTenant() || '').trim();

        // 1. Cek di localStorage jika pengguna pernah mengedit / menyimpan URL khusus
        const tenantLocalUrl = localStorage.getItem('sinbas_gas_url_' + tenant.toLowerCase());
        if (tenantLocalUrl && tenantLocalUrl.trim()) return tenantLocalUrl.trim();

        const customUrl = localStorage.getItem('sinbas_gas_exec_url');
        if (customUrl && customUrl.trim()) return customUrl.trim();

        // 2. Cek di config-offline.js (Sumber utama offline desktop)
        const offlineUrl = this.getOfflineConfigUrl();
        if (offlineUrl) return offlineUrl;

        // 3. Cek di daftar mapping tenants di config-online.js ("id_sekolah": "https link exec")
        if (typeof SINBAS_ONLINE_CONFIG !== 'undefined' && SINBAS_ONLINE_CONFIG.tenants) {
            const list = SINBAS_ONLINE_CONFIG.tenants;
            // Cek pencocokan exact dan case-insensitive
            for (const key of Object.keys(list)) {
                if (key.toLowerCase() === tenant.toLowerCase()) {
                    const entry = list[key];
                    const url = typeof entry === 'string' ? entry : (entry && entry.exec_url ? entry.exec_url : '');
                    if (url && url.trim()) return url.trim();
                }
            }
        }

        // 4. Fallback jika ada gas_exec_url langsung di config-online.js
        if (typeof SINBAS_ONLINE_CONFIG !== 'undefined' && SINBAS_ONLINE_CONFIG.gas_exec_url) {
            return SINBAS_ONLINE_CONFIG.gas_exec_url.trim();
        }

        return '';
    }

    /**
     * Menyimpan URL Web App Exec Google Apps Script
     */
    setGasExecUrl(url, tenantCode) {
        const tenant = (tenantCode || this.getActiveTenant() || '').trim().toLowerCase();
        if (url) {
            const cleanUrl = String(url).trim();
            localStorage.setItem('sinbas_gas_exec_url', cleanUrl);
            if (tenant) {
                localStorage.setItem('sinbas_gas_url_' + tenant, cleanUrl);
            }
        } else {
            localStorage.removeItem('sinbas_gas_exec_url');
            if (tenant) {
                localStorage.removeItem('sinbas_gas_url_' + tenant);
            }
        }
    }

    // =========================================================================
    // API FETCHER GOOGLE APPS SCRIPT (CORS-SAFE)
    // =========================================================================

    /**
     * Memanggil Endpoint Backend GAS dengan format aman CORS preflight
     */
    async callGasApi(action, payload = {}) {
        const url = this.getGasExecUrl();
        if (!url) {
            throw new Error('URL Google Apps Script Exec belum disetel. Silakan atur di menu Pengaturan > Koneksi Online.');
        }

        const tenant = this.getActiveTenant();
        const requestBody = {
            action: action,
            tenant: tenant,
            ...payload
        };

        const timeoutMs = (typeof SINBAS_ONLINE_CONFIG !== 'undefined' && SINBAS_ONLINE_CONFIG.timeout_ms) || 25000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            // Catatan: Menggunakan Content-Type: 'text/plain;charset=utf-8' agar browser
            // tidak memicu CORS OPTIONS preflight yang sering gagal di Google Apps Script 302 Redirect.
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timer);

            if (!response.ok) {
                throw new Error(`HTTP Error dari Google Apps Script: ${response.status} ${response.statusText}`);
            }

            const json = await response.json();
            return json;
        } catch (err) {
            clearTimeout(timer);
            if (err.name === 'AbortError') {
                throw new Error('Koneksi ke Google Apps Script mengalami waktu tunggu habis (timeout). Periksa koneksi internet Anda.');
            }
            throw err;
        }
    }

    // =========================================================================
    // OTENTIKASI HYBRID (OFFLINE VS ONLINE CLOUD)
    // =========================================================================

    /**
     * Otentikasi Online: Memverifikasi username & password langsung dari Spreadsheet Google
     */
    async loginOnline(username, password, tenantCode) {
        if (this.isElectron) {
            // Mode Desktop Offline: Login dari lokal SQLite
            const auth = await this.getAuth();
            if (username === auth.username && password === auth.password) {
                return { success: true, message: 'Login Offline Berhasil' };
            }
            return { success: false, error: 'Username atau Password salah (Offline Desktop).' };
        }

        // Mode Online Browser: Verifikasi ke Spreadsheet via GAS
        if (tenantCode) {
            this.setActiveTenant(tenantCode);
        }

        try {
            const res = await this.callGasApi('login', {
                username: username,
                password: password,
                tenant: this.getActiveTenant()
            });

            if (res.success) {
                // Simpan profil sekolah hasil verifikasi Spreadsheet ke lokal
                if (res.profile) {
                    await this.saveProfileLocal(res.profile);
                }
                if (res.tenant && res.tenant.tenant_code) {
                    this.setActiveTenant(res.tenant.tenant_code);
                }

                // Jalankan sinkronisasi data penuh di latar belakang
                this.syncAllFromGas().catch(e => console.warn('[SinbasDB] Gagal auto-sync data saat login:', e));

                return {
                    success: true,
                    message: res.message || 'Login Online Berhasil!',
                    user: res.user,
                    tenant: res.tenant,
                    profile: res.profile
                };
            } else {
                return {
                    success: false,
                    error: res.error || 'Username atau password salah untuk sekolah ini.'
                };
            }
        } catch (err) {
            console.error('[SinbasDB] Gagal login online:', err);
            return {
                success: false,
                error: err.message || 'Gagal menghubungi server Google Sheets. Periksa URL GAS atau koneksi internet Anda.'
            };
        }
    }

    /**
     * Mengambil Kredensial Pengguna
     */
    async getAuth() {
        const profile = await this.getProfile();
        return {
            username: profile.admin_username || 'admin',
            password: profile.admin_password || 'admin123'
        };
    }

    /**
     * Menyimpan Perubahan Password
     * Desktop: Simpan ke SQLite
     * Online: Simpan ke SQLite / Dexie DAN kirim update ke Google Spreadsheet!
     */
    async saveAuth(username, password) {
        await this.put('config', { key: 'admin_username', value: String(username) });
        if (password) {
            await this.put('config', { key: 'admin_password', value: String(password) });
        }

        // Jika mode online, sinkronkan perubahan password ke Google Sheets
        if (!this.isElectron && this.getGasExecUrl()) {
            try {
                await this.callGasApi('saveAuth', {
                    username: username,
                    password: password
                });
                console.log('[SinbasDB] Kredensial baru berhasil disinkronkan ke Google Spreadsheet.');
            } catch (err) {
                console.warn('[SinbasDB] Gagal sinkronisasi kredensial ke Spreadsheet:', err);
            }
        }
        return true;
    }

    // =========================================================================
    // SINKRONISASI 2 ARAH LENGKAP (DESKTOP OFFLINE & ONLINE GOOGLE SHEETS)
    // =========================================================================

    async clearTable(tableName) {
        await this.readyPromise;
        if (this.isElectron) {
            return await window.sinbasAPI.dbClear(tableName);
        } else {
            if (this.dexieDb && this.dexieDb[tableName]) {
                return await this.dexieDb[tableName].clear();
            }
        }
    }

    getLastSyncTime() {
        const timeIso = localStorage.getItem('sinbas_last_sync_time');
        if (!timeIso) return 'Belum pernah disinkronkan';
        try {
            const d = new Date(timeIso);
            if (isNaN(d.getTime())) return timeIso;
            return d.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }) + ' WIB';
        } catch (_) {
            return timeIso;
        }
    }

    setLastSyncTime() {
        const nowIso = new Date().toISOString();
        localStorage.setItem('sinbas_last_sync_time', nowIso);
        return nowIso;
    }

    /**
     * SINKRONISASI 2 ARAH PINTAR (SMART TWO-WAY MERGE):
     * Bekerja di Electron Desktop (SQLite) dan Browser Web (Dexie)
     * - Menyelaraskan profil sekolah, alamat, dan kode lokasi.
     * - Data baru/diedit di offline diunggah ke Google Spreadsheet.
     * - Data baru/diedit di Google Spreadsheet diunduh ke SQLite/Dexie lokal.
     * - Konflik diselesaikan otomatis berdasarkan timestamp updated_at yang terbaru.
     */
    async syncTwoWay(onProgress = () => {}) {
        const url = this.getGasExecUrl();
        if (!url) {
            throw new Error('URL Google Apps Script Exec belum disetel. Silakan atur di menu Pengaturan > Koneksi Online.');
        }

        const tenant = this.getActiveTenant();
        this.syncing = true;

        try {
            onProgress('Menghubungi Google Apps Script & mengunduh data cloud...', 15);

            // 1. Ambil data cloud terbaru dari Google Spreadsheet
            const cloudData = await this.callGasApi('syncAll');
            if (!cloudData || !cloudData.success) {
                throw new Error(cloudData?.error || 'Gagal berkomunikasi dengan Google Spreadsheet.');
            }

            onProgress('Menganalisis dan menyelaraskan profil sekolah...', 30);

            // 2. Selaraskan Profil Sekolah & Kredensial (2 Arah)
            const localProfile = await this.getProfile();
            const cloudProfile = cloudData.profile || {};
            const mergedProfile = { ...cloudProfile, ...localProfile };

            // Pastikan field penting saling mengisi jika salah satu kosong
            for (const [k, v] of Object.entries(cloudProfile)) {
                if (v && (!mergedProfile[k] || mergedProfile[k] === '')) {
                    mergedProfile[k] = v;
                }
            }
            await this.saveProfileLocal(mergedProfile);

            // 3. Bandingkan dan Selaraskan Setiap Tabel Data
            const tables = [
                { key: 'ruangan', label: 'Ruangan' },
                { key: 'aset', label: 'Aset KIB' },
                { key: 'master_bph', label: 'Master BPH' },
                { key: 'bph_masuk', label: 'BPH Masuk' },
                { key: 'bph_keluar', label: 'BPH Keluar' },
                { key: 'master_kode_barang', label: 'Master Kode Barang' },
                { key: 'riwayat_penghapusan', label: 'Riwayat Penghapusan' },
                { key: 'riwayat_mutasi', label: 'Riwayat Mutasi' },
                { key: 'riwayat_pemeliharaan', label: 'Riwayat Pemeliharaan' },
                { key: 'sensus_log', label: 'Sensus Log' }
            ];

            const uploadPayload = {
                tenant: tenant,
                profile: mergedProfile
            };
            const stats = {
                uploadedCount: 0,
                downloadedCount: 0,
                details: {}
            };

            let currentProgress = 35;
            const progressStep = 45 / tables.length;

            for (const tbl of tables) {
                onProgress(`Menyelaraskan ${tbl.label}...`, Math.round(currentProgress));
                currentProgress += progressStep;

                const localRows = await this.getAll(tbl.key);
                const cloudRows = Array.isArray(cloudData[tbl.key]) ? cloudData[tbl.key] : [];

                const localMap = new Map();
                localRows.forEach(r => { if (r && r.id) localMap.set(String(r.id), r); });

                const cloudMap = new Map();
                cloudRows.forEach(r => { if (r && r.id) cloudMap.set(String(r.id), r); });

                const toDownload = [];
                const toUpload = [];

                // Cek data lokal terhadap cloud
                localMap.forEach((localItem, id) => {
                    if (!cloudMap.has(id)) {
                        // Data baru di lokal (belum ada di cloud) -> Upload ke cloud
                        toUpload.push(localItem);
                    } else {
                        // Ada di keduanya -> Bandingkan timestamp updated_at
                        const cloudItem = cloudMap.get(id);
                        const localTime = new Date(localItem.updated_at || localItem.created_at || 0).getTime();
                        const cloudTime = new Date(cloudItem.updated_at || cloudItem.created_at || 0).getTime();

                        if (localTime > cloudTime) {
                            toUpload.push(localItem);
                        } else if (cloudTime > localTime) {
                            toDownload.push(cloudItem);
                        }
                    }
                });

                // Cek data cloud yang belum ada di lokal
                cloudMap.forEach((cloudItem, id) => {
                    if (!localMap.has(id)) {
                        toDownload.push(cloudItem);
                    }
                });

                // Simpan item yang diunduh ke database lokal (SQLite atau Dexie)
                if (toDownload.length > 0) {
                    await this.bulkPut(tbl.key, toDownload);
                    stats.downloadedCount += toDownload.length;
                }

                // Masukkan item yang perlu diunggah ke payload
                if (toUpload.length > 0) {
                    uploadPayload[tbl.key] = toUpload;
                    stats.uploadedCount += toUpload.length;
                }

                stats.details[tbl.key] = {
                    toUpload: toUpload.length,
                    toDownload: toDownload.length,
                    total: localRows.length + toDownload.length
                };
            }

            // 4. Kirim seluruh data lokal yang lebih baru ke Google Spreadsheet
            onProgress('Mengirim pembaruan lokal ke Google Spreadsheet...', 85);
            await this.callGasApi('uploadAll', uploadPayload);

            // 5. Simpan waktu sinkronisasi terakhir
            const nowIso = this.setLastSyncTime();
            onProgress('Sinkronisasi 2 arah berhasil selesai!', 100);

            return {
                success: true,
                message: 'Sinkronisasi 2 arah berhasil!',
                timestamp: nowIso,
                stats: stats
            };
        } catch (err) {
            console.error('[SinbasDB] Gagal sinkronisasi 2 arah:', err);
            throw err;
        } finally {
            this.syncing = false;
        }
    }

    /**
     * UPLOAD PENUH: Mengirim seluruh data lokal (profil, aset, ruangan, BPH) ke Google Sheets
     */
    async uploadAllToGas(onProgress = () => {}) {
        const url = this.getGasExecUrl();
        if (!url) {
            throw new Error('URL Google Apps Script Exec belum disetel.');
        }

        const tenant = this.getActiveTenant();
        this.syncing = true;

        try {
            onProgress('Membaca seluruh database lokal...', 20);

            const payload = {
                tenant: tenant,
                profile: await this.getProfile(),
                ruangan: await this.getAll('ruangan'),
                aset: await this.getAll('aset'),
                master_bph: await this.getAll('master_bph'),
                bph_masuk: await this.getAll('bph_masuk'),
                bph_keluar: await this.getAll('bph_keluar'),
                master_kode_barang: await this.getAll('master_kode_barang'),
                riwayat_penghapusan: await this.getAll('riwayat_penghapusan'),
                riwayat_mutasi: await this.getAll('riwayat_mutasi'),
                riwayat_pemeliharaan: await this.getAll('riwayat_pemeliharaan'),
                sensus_log: await this.getAll('sensus_log')
            };

            onProgress('Mengunggah seluruh data ke Google Spreadsheet...', 60);
            const res = await this.callGasApi('uploadAll', payload);

            if (!res || !res.success) {
                throw new Error(res?.error || 'Gagal mengunggah data ke Google Spreadsheet.');
            }

            const nowIso = this.setLastSyncTime();
            onProgress('Upload penuh ke Google Spreadsheet selesai!', 100);

            return {
                success: true,
                message: 'Seluruh data lokal berhasil diunggah ke Google Spreadsheet.',
                timestamp: nowIso,
                counts: res.counts || {}
            };
        } catch (err) {
            console.error('[SinbasDB] Gagal upload penuh ke GAS:', err);
            throw err;
        } finally {
            this.syncing = false;
        }
    }

    /**
     * DOWNLOAD PENUH: Mengunduh seluruh data dari Google Spreadsheet dan menimpa database lokal
     */
    async downloadAllFromGas(onProgress = () => {}) {
        const url = this.getGasExecUrl();
        if (!url) {
            throw new Error('URL Google Apps Script Exec belum disetel.');
        }

        this.syncing = true;
        try {
            onProgress('Mengunduh seluruh data dari Google Spreadsheet...', 30);
            const res = await this.callGasApi('syncAll');

            if (!res || !res.success) {
                throw new Error(res?.error || 'Gagal mengambil data dari Google Spreadsheet.');
            }

            onProgress('Menyimpan data profil sekolah...', 50);
            if (res.profile) {
                await this.saveProfileLocal(res.profile);
            }

            const tables = [
                { key: 'ruangan', label: 'Ruangan' },
                { key: 'aset', label: 'Aset KIB' },
                { key: 'master_bph', label: 'Master BPH' },
                { key: 'bph_masuk', label: 'BPH Masuk' },
                { key: 'bph_keluar', label: 'BPH Keluar' },
                { key: 'master_kode_barang', label: 'Master Kode Barang' },
                { key: 'riwayat_penghapusan', label: 'Riwayat Penghapusan' },
                { key: 'riwayat_mutasi', label: 'Riwayat Mutasi' },
                { key: 'riwayat_pemeliharaan', label: 'Riwayat Pemeliharaan' },
                { key: 'sensus_log', label: 'Sensus Log' }
            ];

            let progressStep = 55;
            const inc = 40 / tables.length;

            for (const tbl of tables) {
                onProgress(`Memperbarui data ${tbl.label}...`, Math.round(progressStep));
                progressStep += inc;

                const remoteRows = Array.isArray(res[tbl.key]) ? res[tbl.key] : [];
                await this.clearTable(tbl.key);
                if (remoteRows.length > 0) {
                    await this.bulkPut(tbl.key, remoteRows);
                }
            }

            const nowIso = this.setLastSyncTime();
            onProgress('Download data Google Sheets ke lokal selesai!', 100);

            return {
                success: true,
                message: 'Seluruh data berhasil diunduh dari Google Spreadsheet ke database lokal.',
                timestamp: nowIso,
                countAset: Array.isArray(res.aset) ? res.aset.length : 0
            };
        } catch (err) {
            console.error('[SinbasDB] Gagal download dari GAS:', err);
            throw err;
        } finally {
            this.syncing = false;
        }
    }

    /**
     * Alias untuk downloadAllFromGas (kompatibilitas backward)
     */
    async syncAllFromGas() {
        return await this.downloadAllFromGas();
    }

    // =========================================================================
    // STANDARD CRUD INTERFACE
    // =========================================================================

    async getAll(tableName, whereClause = '', params = []) {
        await this.readyPromise;
        if (this.isElectron) {
            return await window.sinbasAPI.dbGetAll(tableName, whereClause, params);
        } else {
            if (!this.dexieDb[tableName]) return [];
            return await this.dexieDb[tableName].toArray();
        }
    }

    async get(tableName, id) {
        await this.readyPromise;
        if (this.isElectron) {
            return await window.sinbasAPI.dbGet(tableName, id);
        } else {
            if (!this.dexieDb[tableName]) return null;
            return await this.dexieDb[tableName].get(id);
        }
    }

    async put(tableName, obj) {
        await this.readyPromise;
        if (this.isElectron) {
            return await window.sinbasAPI.dbPut(tableName, obj);
        } else {
            if (!this.dexieDb[tableName]) return obj;
            await this.dexieDb[tableName].put(obj);

            // Background sync ke Google Sheets jika online
            if (this.getGasExecUrl() && tableName !== 'config') {
                this.callGasApi('put', { table: tableName, data: obj })
                    .catch(e => console.warn(`[SinbasDB] Gagal sync put ${tableName}:`, e));
            }
            return obj;
        }
    }

    async bulkPut(tableName, arr) {
        await this.readyPromise;
        if (this.isElectron) {
            return await window.sinbasAPI.dbBulkPut(tableName, arr);
        } else {
            if (!this.dexieDb[tableName]) return true;
            await this.dexieDb[tableName].bulkPut(arr);

            // Background bulk sync ke Google Sheets jika online
            if (this.getGasExecUrl() && tableName !== 'config') {
                this.callGasApi('bulkPut', { table: tableName, data: arr })
                    .catch(e => console.warn(`[SinbasDB] Gagal sync bulkPut ${tableName}:`, e));
            }
            return true;
        }
    }

    async update(tableName, id, updates) {
        await this.readyPromise;
        if (this.isElectron) {
            return await window.sinbasAPI.dbUpdate(tableName, id, updates);
        } else {
            if (!this.dexieDb[tableName]) return 0;
            const res = await this.dexieDb[tableName].update(id, updates);

            // Background sync update ke Google Sheets jika online
            if (this.getGasExecUrl() && tableName !== 'config') {
                this.callGasApi('update', { table: tableName, id: id, updates: updates })
                    .catch(e => console.warn(`[SinbasDB] Gagal sync update ${tableName}:`, e));
            }
            return res;
        }
    }

    async delete(tableName, id) {
        await this.readyPromise;
        if (this.isElectron) {
            return await window.sinbasAPI.dbDelete(tableName, id);
        } else {
            if (!this.dexieDb[tableName]) return 0;
            await this.dexieDb[tableName].delete(id);

            // Background sync delete ke Google Sheets jika online
            if (this.getGasExecUrl() && tableName !== 'config') {
                this.callGasApi('delete', { table: tableName, id: id })
                    .catch(e => console.warn(`[SinbasDB] Gagal sync delete ${tableName}:`, e));
            }
            return 1;
        }
    }

    async where(tableName, field, value) {
        await this.readyPromise;
        if (this.isElectron) {
            return await window.sinbasAPI.dbWhere(tableName, field, value);
        } else {
            if (!this.dexieDb[tableName]) return [];
            return await this.dexieDb[tableName].where(field).equals(value).toArray();
        }
    }

    async getStats() {
        await this.readyPromise;
        if (this.isElectron) {
            return await window.sinbasAPI.dbGetStats();
        } else {
            if (!this.dexieDb || !this.dexieDb.aset) {
                return { total_unit: 0, total_nilai: 0, total_ruangan: 0, per_kib: [], per_kondisi: [] };
            }
            const all = await this.dexieDb.aset.toArray();
            const totalNilai = all.reduce((sum, item) => sum + (Number(item.nilai_total) || 0), 0);
            const rCount = await this.dexieDb.ruangan.count();

            const kibMap = {};
            all.forEach(a => { kibMap[a.kib_type] = (kibMap[a.kib_type] || 0) + 1; });
            const perKib = Object.entries(kibMap).map(([kib_type, count]) => ({ kib_type, count }));

            const kondMap = {};
            all.forEach(a => { kondMap[a.kondisi] = (kondMap[a.kondisi] || 0) + 1; });
            const perKondisi = Object.entries(kondMap).map(([kondisi, count]) => ({ kondisi, count }));

            return {
                total_unit: all.length,
                total_nilai: totalNilai,
                total_ruangan: rCount,
                per_kib: perKib,
                per_kondisi: perKondisi
            };
        }
    }

    async getProfile() {
        const rows = await this.getAll('config');
        const profile = {};
        rows.forEach(r => profile[r.key] = r.value);
        return profile;
    }

    async saveProfile(profileObj) {
        for (const [key, value] of Object.entries(profileObj)) {
            await this.put('config', { key, value: String(value) });
        }

        // Sinkronkan ke Google Spreadsheet jika online
        if (!this.isElectron && this.getGasExecUrl()) {
            this.callGasApi('saveProfile', { profile: profileObj })
                .catch(e => console.warn('[SinbasDB] Gagal sync profile ke Spreadsheet:', e));
        }
        return true;
    }

    async saveProfileLocal(profileObj) {
        if (!profileObj || typeof profileObj !== 'object') return;
        const bulkArr = [];
        for (const [key, value] of Object.entries(profileObj)) {
            bulkArr.push({ key: key, value: String(value) });
        }
        if (this.isElectron) {
            await window.sinbasAPI.dbBulkPut('config', bulkArr);
        } else if (this.dexieDb && this.dexieDb.config) {
            await this.dexieDb.config.bulkPut(bulkArr);
        }
    }

    async seedInitialLocalConfig() {
        const defaultTenant = this.getActiveTenant();
        const defSchoolName = (typeof SINBAS_ONLINE_CONFIG !== 'undefined' && SINBAS_ONLINE_CONFIG.default_nama_sekolah) || 'SMAN 15 TEBO';

        await this.dexieDb.config.bulkPut([
            { key: 'nama_instansi', value: 'PEMERINTAH PROVINSI JAMBI' },
            { key: 'nama_opd', value: 'DINAS PENDIDIKAN DAN KEBUDAYAAN' },
            { key: 'nama_sekolah', value: defSchoolName },
            { key: 'npsn', value: '10505963' },
            { key: 'provinsi', value: 'Jambi' },
            { key: 'kabupaten_kota', value: 'Kabupaten Tebo' },
            { key: 'kecamatan', value: 'Rimbo Bujang' },
            { key: 'kode_lokasi', value: '11.15.09.04.01.001.10505963' },
            { key: 'kepala_sekolah', value: 'Pariyanto, S.Pd., M.Pd.' },
            { key: 'nip_kepala_sekolah', value: '19750512 200501 1 004' },
            { key: 'pengurus_barang', value: 'Pengurus Barang' },
            { key: 'nip_pengurus_barang', value: '19820315 200902 1 002' },
            { key: 'tahun_anggaran', value: '2026' },
            { key: 'admin_username', value: 'admin' },
            { key: 'admin_password', value: 'admin123' },
            { key: 'active_tenant', value: defaultTenant }
        ]);
    }
}

// Instance Tunggal
const db = new SinbasDatabase();
