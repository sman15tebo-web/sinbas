/**
 * =========================================================================================
 * SINBAS HYBRID — GOOGLE APPS SCRIPT (GAS) BACKEND & MULTI-TENANT DATABASE ENGINE
 * Versi: 1.0.0
 * Standar: Permendagri No. 108/2016 (7 Tingkat) & Permendagri No. 47/2021 (NIBAR, BMD)
 * Penulis: Pariyanto — SMAN 15 Tebo (SINBAS Hybrid)
 *
 * ARSITEKTUR MULTI-TENANT:
 * 1. Setiap Sekolah memiliki 1 Google Spreadsheet mandiri (Data Terisolasi & Aman).
 * 2. Script Web App GAS ini bertindak sebagai Central Router & API Gateway.
 * 3. Mendukung 3 Mode Resolusi Tenant:
 *    - Mode A (Master Registry): Lookup 'tenant' (NPSN/Slug) di sheet 'Master_Tenants'
 *    - Mode B (Direct Sheet ID): Menggunakan parameter 'sheetId' langsung
 *    - Mode C (Container-Bound): Menggunakan Spreadsheet aktif tempat script ini terpasang
 * 4. Otomatisasi: Fitur inisialisasi tabel, header, warna, & data awal sekali klik!
 * =========================================================================================
 */

// =========================================================================================
// 1. KONFIGURASI GLOBAL & MASTER SPREADSHEET
// =========================================================================================
var GLOBAL_CONFIG = {
  // Masukkan Spreadsheet ID Master Tenant di bawah jika Anda menggunakan 1 Master Spreadsheet Pusat.
  // Jika script ini dipasang langsung di Google Spreadsheet Master atau di Spreadsheet sekolah, biarkan kosong ("").
  MASTER_SPREADSHEET_ID: "",

  // Nama sheet untuk tabel pendaftaran multi-tenant
  TENANT_SHEET_NAME: "Master_Tenants",

  // Versi API Backend
  API_VERSION: "1.0.0",

  // Maksimum waktu tunggu LockService untuk transaksi aman (milidetik)
  LOCK_TIMEOUT_MS: 15000
};

// Skema Kolom Tabel-Tabel SINBAS
var TABLE_SCHEMAS = {
  config: ['key', 'value', 'keterangan'],
  ruangan: ['id', 'kode_ruangan', 'nama_ruangan', 'penanggung_jawab', 'nip_penanggung_jawab', 'lokasi_gedung', 'keterangan', 'created_at', 'updated_at'],
  aset: ['id', 'batch_id', 'kib_type', 'nibar', 'no_register', 'kode_barang', 'nama_barang', 'spesifikasi_nama', 'merk_tipe', 'no_pabrik_seri', 'bahan', 'asal_usul', 'tahun_perolehan', 'tanggal_perolehan', 'harga_satuan', 'nilai_total', 'kondisi', 'ruangan_id', 'ruangan_nama', 'jumlah', 'satuan', 'data_khusus', 'status_aset', 'keterangan', 'created_at', 'updated_at'],
  riwayat_penghapusan: ['id', 'aset_id', 'batch_id', 'nibar', 'no_register', 'kode_barang', 'nama_barang', 'spesifikasi_nama', 'merk_tipe', 'tahun_perolehan', 'nilai_satuan', 'ruangan_nama', 'kondisi_terakhir', 'tanggal_usulan', 'alasan', 'no_sk_ba', 'petugas', 'keterangan', 'status_penghapusan', 'created_at'],
  riwayat_mutasi: ['id', 'aset_id', 'nibar', 'nama_barang', 'tanggal_mutasi', 'ruangan_asal_id', 'ruangan_asal_nama', 'ruangan_tujuan_id', 'ruangan_tujuan_nama', 'petugas', 'alasan_mutasi', 'no_berita_acara', 'created_at'],
  riwayat_pemeliharaan: ['id', 'aset_id', 'nibar', 'nama_barang', 'tanggal', 'jenis_kegiatan', 'biaya', 'kondisi_sebelum', 'kondisi_sesudah', 'rekanan_bengkel', 'sumber_dana', 'keterangan', 'created_at'],
  sensus_log: ['id', 'periode_tahun', 'tanggal_scan', 'aset_id', 'nibar', 'ruangan_id', 'ruangan_nama', 'kondisi_terverifikasi', 'status_verifikasi', 'petugas_sensus', 'catatan', 'created_at'],
  master_bph: ['id', 'kode_bph', 'nama_barang', 'kategori', 'satuan', 'spesifikasi', 'keterangan', 'created_at', 'updated_at'],
  bph_masuk: ['id', 'master_bph_id', 'kode_bph', 'nama_barang', 'kategori', 'tanggal', 'tahun', 'bulan', 'jumlah', 'satuan', 'harga_satuan', 'total_nilai', 'sumber_dana', 'no_bukti', 'rekanan', 'keterangan', 'created_at', 'updated_at'],
  bph_keluar: ['id', 'master_bph_id', 'kode_bph', 'nama_barang', 'tanggal', 'tahun', 'bulan', 'jumlah', 'satuan', 'keperluan', 'penerima', 'ruangan_id', 'ruangan_nama', 'no_bukti', 'keterangan', 'created_at', 'updated_at'],
  master_kode_barang: ['id', 'kib', 'kategori', 'kode', 'nama', 'deskripsi']
};

// Lebar Kolom Standar Agar Tampilan Rapi & Nyaman Dibaca di Google Sheets
var TABLE_COLUMN_WIDTHS = {
  config: [190, 380, 280],
  ruangan: [160, 140, 220, 200, 180, 180, 220, 170, 170],
  aset: [160, 160, 80, 220, 100, 160, 240, 220, 180, 150, 120, 120, 110, 130, 130, 140, 100, 160, 180, 90, 90, 220, 120, 220, 170, 170],
  master_bph: [160, 140, 220, 160, 100, 200, 200, 170, 170],
  bph_masuk: [160, 160, 130, 220, 140, 120, 80, 80, 90, 90, 120, 140, 140, 140, 180, 200, 170, 170],
  bph_keluar: [160, 160, 130, 220, 120, 80, 80, 90, 90, 200, 180, 160, 180, 140, 200, 170, 170],
  master_kode_barang: [160, 80, 160, 170, 240, 260],
  riwayat_penghapusan: [160, 160, 160, 220, 100, 150, 220, 200, 160, 100, 130, 180, 120, 130, 200, 160, 160, 200, 140, 170],
  riwayat_mutasi: [160, 160, 220, 220, 130, 160, 180, 160, 180, 160, 200, 160, 170],
  riwayat_pemeliharaan: [160, 160, 220, 220, 130, 200, 130, 130, 130, 180, 140, 200, 170],
  sensus_log: [160, 110, 130, 160, 220, 160, 180, 140, 140, 160, 220, 170]
};

// =========================================================================================
// 🌟 TOMBOL RUNNER UTAMA: SETUP DATABASE OTOMATIS (1-KLIK DI APPS SCRIPT EDITOR)
// =========================================================================================
/**
 * FUNGSI UTAMA UNTUK DIJALANKAN DARI GOOGLE APPS SCRIPT EDITOR:
 * 1. Di dropdown toolbar editor di atas, pilih fungsi: "SETUP_DATABASE_OTOMATIS"
 * 2. Klik tombol "▶ Run" (Jalankan).
 * 3. Seluruh 11 sheet database SINBAS akan langsung dibuat, diwarnai, dan diformat otomatis!
 */
function SETUP_DATABASE_OTOMATIS() {
  return menuSetupDatabaseOtomatis();
}

// =========================================================================================
// 2. ENTRY POINTS WEB APP (doGet & doPost)
// =========================================================================================

/**
 * Handler HTTP GET: Menangani permintaan query, ping, dan pembacaan data
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'ping';

    // Jika ada payload data via query 'data' (JSON String)
    var payload = {};
    if (params.data) {
      try { payload = JSON.parse(params.data); } catch (_) {}
    }
    // Gabungkan query parameter ke payload
    for (var k in params) {
      if (params.hasOwnProperty(k) && k !== 'data') {
        payload[k] = params[k];
      }
    }

    return routeAction(action, payload);
  } catch (err) {
    return createJsonResponse({
      success: false,
      error: err.message || err.toString(),
      stack: err.stack
    });
  }
}

/**
 * Handler HTTP POST: Menangani mutasi data, login, dan bulk operations
 * Mencegah issue CORS preflight pada browser dengan membaca e.postData.contents
 */
function doPost(e) {
  try {
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        // Fallback jika dikirim via URL Encoded Form
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    var action = payload.action || (e && e.parameter && e.parameter.action) || 'ping';
    return routeAction(action, payload);
  } catch (err) {
    return createJsonResponse({
      success: false,
      error: err.message || err.toString(),
      stack: err.stack
    });
  }
}

// =========================================================================================
// 3. ROUTER AKSI API
// =========================================================================================
function routeAction(action, payload) {
  // Aksi Publik Tanpa Memerlukan Spreadsheet Sekolah
  if (action === 'ping') {
    return createJsonResponse({
      success: true,
      app_name: 'SINBAS Hybrid GAS Gateway',
      version: GLOBAL_CONFIG.API_VERSION,
      timestamp: new Date().toISOString(),
      message: 'Layanan backend SINBAS Google Apps Script aktif dan siap melayani multi-sekolah.'
    });
  }

  // Aksi Master Tenant (Pendaftaran & List Sekolah)
  if (action === 'registerTenant') {
    return handleRegisterTenant(payload);
  }
  if (action === 'listTenants') {
    return handleListTenants(payload);
  }
  if (action === 'updateTenantStatus') {
    return handleUpdateTenantStatus(payload);
  }

  // Resolusi Database Spreadsheet Sekolah (Tenant)
  var tenantCode = payload.tenant || payload.tenant_code || payload.npsn || '';
  var explicitSheetId = payload.sheetId || payload.spreadsheet_id || '';
  var tenantResolution = resolveTenantSpreadsheet(tenantCode, explicitSheetId);

  if (!tenantResolution.success) {
    return createJsonResponse({
      success: false,
      error: tenantResolution.error || 'Gagal menemukan database sekolah untuk tenant yang ditentukan.'
    });
  }

  var ss = tenantResolution.spreadsheet;
  var tenantInfo = tenantResolution.tenantInfo;

  // Cek Status Lisensi Sekolah
  if (tenantInfo && tenantInfo.status) {
    var st = String(tenantInfo.status).toUpperCase();
    if (st === 'SUSPENDED' || st === 'NONAKTIF' || st === 'BLOCKED') {
      return createJsonResponse({
        success: false,
        error: 'Akses untuk sekolah ini sedang dinonaktifkan oleh Administrator Pusat SINBAS. Silakan hubungi tim layanan.'
      });
    }
    if (tenantInfo.expired_date) {
      var exp = new Date(tenantInfo.expired_date);
      if (!isNaN(exp.getTime()) && exp < new Date()) {
        return createJsonResponse({
          success: false,
          error: 'Masa aktif lisensi sekolah telah berakhir pada ' + tenantInfo.expired_date + '. Silakan lakukan perpanjangan lisensi.'
        });
      }
    }
  }

  // Routing Aksi Database Sekolah
  switch (action) {
    case 'login':
      return handleLogin(ss, payload, tenantInfo);

    case 'getAuth':
      return handleGetAuth(ss);

    case 'saveAuth':
      return handleSaveAuth(ss, payload);

    case 'getProfile':
      return handleGetProfile(ss);

    case 'saveProfile':
      return handleSaveProfile(ss, payload);

    case 'syncAll':
      return handleSyncAll(ss, tenantInfo);

    case 'getAll':
      return handleGetAll(ss, payload);

    case 'get':
      return handleGet(ss, payload);

    case 'put':
      return handlePut(ss, payload);

    case 'bulkPut':
      return handleBulkPut(ss, payload);

    case 'update':
      return handleUpdate(ss, payload);

    case 'delete':
      return handleDelete(ss, payload);

    case 'initSchool':
    case 'setupTenant':
      return handleSetupSchool(ss, payload);

    case 'uploadAll':
      return handleUploadAll(ss, payload);

    default:
      return createJsonResponse({
        success: false,
        error: 'Aksi API "' + action + '" tidak dikenali.'
      });
  }
}

// =========================================================================================
// 4. RESOLUSI MULTI-TENANT (SISTEM MULTI-SEKOLAH)
// =========================================================================================

/**
 * Menemukan Spreadsheet Sekolah berdasarkan Kode Tenant atau Sheet ID
 */
function resolveTenantSpreadsheet(tenantCode, explicitSheetId) {
  // 1. Jika Sheet ID diberikan secara eksplisit
  if (explicitSheetId) {
    try {
      var targetSs = SpreadsheetApp.openById(explicitSheetId);
      return {
        success: true,
        spreadsheet: targetSs,
        tenantInfo: { tenant_code: tenantCode || 'CUSTOM', spreadsheet_id: explicitSheetId, status: 'ACTIVE' }
      };
    } catch (e) {
      return { success: false, error: 'Spreadsheet ID tidak valid atau tidak memiliki izin akses: ' + e.message };
    }
  }

  // 2. Jika Kode Tenant diberikan (Cari di Master Sheet / Script Properties)
  if (tenantCode) {
    var cleanCode = String(tenantCode).trim().toUpperCase();

    // 2a. Cek di Script Properties (Cache cepat)
    var scriptProps = PropertiesService.getScriptProperties();
    var cachedSheetId = scriptProps.getProperty('TENANT_' + cleanCode);
    if (cachedSheetId) {
      try {
        var cachedSs = SpreadsheetApp.openById(cachedSheetId);
        return {
          success: true,
          spreadsheet: cachedSs,
          tenantInfo: { tenant_code: cleanCode, spreadsheet_id: cachedSheetId, status: 'ACTIVE' }
        };
      } catch (_) {}
    }

    // 2b. Cek di Master Spreadsheet
    var masterSs = getMasterSpreadsheet();
    if (masterSs) {
      var tenantSheet = masterSs.getSheetByName(GLOBAL_CONFIG.TENANT_SHEET_NAME);
      if (tenantSheet) {
        var data = tenantSheet.getDataRange().getValues();
        if (data.length > 1) {
          var headers = data[0].map(function(h) { return String(h).trim().toLowerCase(); });
          var idxCode = headers.indexOf('tenant_code');
          var idxNpsn = headers.indexOf('npsn');
          var idxSheetId = headers.indexOf('spreadsheet_id');
          var idxStatus = headers.indexOf('status');
          var idxExp = headers.indexOf('expired_date');
          var idxNama = headers.indexOf('nama_sekolah');

          for (var i = 1; i < data.length; i++) {
            var row = data[i];
            var codeVal = idxCode !== -1 ? String(row[idxCode]).trim().toUpperCase() : '';
            var npsnVal = idxNpsn !== -1 ? String(row[idxNpsn]).trim().toUpperCase() : '';

            if (codeVal === cleanCode || npsnVal === cleanCode) {
              var sId = idxSheetId !== -1 ? String(row[idxSheetId]).trim() : '';
              if (!sId) {
                return { success: false, error: 'Tenant ' + tenantCode + ' belum memiliki Spreadsheet ID yang terdaftar.' };
              }

              try {
                var foundSs = SpreadsheetApp.openById(sId);
                // Simpan ke script properties untuk akses berikutnya yang lebih cepat
                try { scriptProps.setProperty('TENANT_' + cleanCode, sId); } catch (_) {}

                return {
                  success: true,
                  spreadsheet: foundSs,
                  tenantInfo: {
                    tenant_code: codeVal,
                    nama_sekolah: idxNama !== -1 ? row[idxNama] : '',
                    spreadsheet_id: sId,
                    status: idxStatus !== -1 ? row[idxStatus] : 'ACTIVE',
                    expired_date: idxExp !== -1 ? formatDateCell(row[idxExp]) : ''
                  }
                };
              } catch (openErr) {
                return { success: false, error: 'Gagal membuka Spreadsheet ID (' + sId + ') milik sekolah ' + tenantCode + ': ' + openErr.message };
              }
            }
          }
        }
      }
    }
  }

  // 3. Fallback: Gunakan Active Spreadsheet (Jika script dipasang langsung di Spreadsheet)
  try {
    var activeSs = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSs) {
      return {
        success: true,
        spreadsheet: activeSs,
        tenantInfo: { tenant_code: tenantCode || 'DEFAULT', spreadsheet_id: activeSs.getId(), status: 'ACTIVE' }
      };
    }
  } catch (_) {}

  return {
    success: false,
    error: 'Kode Tenant / Sekolah "' + (tenantCode || 'KOSONG') + '" tidak ditemukan dalam Master Database SINBAS. Pastikan kode tenant benar atau telah didaftarkan.'
  };
}

/**
 * Mendapatkan Spreadsheet Master
 */
function getMasterSpreadsheet() {
  if (GLOBAL_CONFIG.MASTER_SPREADSHEET_ID) {
    try {
      return SpreadsheetApp.openById(GLOBAL_CONFIG.MASTER_SPREADSHEET_ID);
    } catch (_) {}
  }
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (_) {
    return null;
  }
}

// =========================================================================
// 5. HANDLER OTENTIKASI & KEAMANAN (LOGIN DARI SPREADSHEET)
// =========================================================================

/**
 * Login Online: Verifikasi Username & Password langsung terhadap sheet 'Config' / 'Users' sekolah
 */
function handleLogin(ss, payload, tenantInfo) {
  var username = String(payload.username || '').trim();
  var password = String(payload.password || '').trim();

  if (!username || !password) {
    return createJsonResponse({
      success: false,
      error: 'Username dan Password wajib diisi.'
    });
  }

  // 1. Ambil Kredensial Administrator dari sheet 'Config'
  var config = getSheetKeyValueMap(ss, 'Config');
  var dbUser = config.admin_username || 'admin';
  var dbPass = config.admin_password || 'admin123';

  // 2. Verifikasi Password Administrator
  var isMatch = (username === dbUser && password === dbPass);

  // Jika belum cocok, cek sheet 'Users' (opsional jika memiliki multi-pengguna)
  var userRole = 'Administrator';
  var userFullName = config.pengurus_barang || 'Administrator Sekolah';

  if (!isMatch) {
    var usersSheet = ss.getSheetByName('Users');
    if (usersSheet && usersSheet.getLastRow() > 1) {
      var uData = usersSheet.getDataRange().getValues();
      var uHeaders = uData[0].map(function(h) { return String(h).trim().toLowerCase(); });
      var idxU = uHeaders.indexOf('username');
      var idxP = uHeaders.indexOf('password');
      var idxR = uHeaders.indexOf('role');
      var idxN = uHeaders.indexOf('nama_lengkap');
      var idxS = uHeaders.indexOf('status');

      for (var i = 1; i < uData.length; i++) {
        var rUser = idxU !== -1 ? String(uData[i][idxU]).trim() : '';
        var rPass = idxP !== -1 ? String(uData[i][idxP]).trim() : '';
        var rStat = idxS !== -1 ? String(uData[i][idxS]).trim().toUpperCase() : 'ACTIVE';

        if (rUser === username && rPass === password) {
          if (rStat === 'BLOCKED' || rStat === 'NONAKTIF') {
            return createJsonResponse({
              success: false,
              error: 'Akun Anda sedang dinonaktifkan oleh pengurus sekolah.'
            });
          }
          isMatch = true;
          userRole = idxR !== -1 ? uData[i][idxR] : 'Operator';
          userFullName = idxN !== -1 ? uData[i][idxN] : username;
          break;
        }
      }
    }
  }

  if (!isMatch) {
    return createJsonResponse({
      success: false,
      error: 'Username atau Password salah untuk sekolah ' + (config.nama_sekolah || (tenantInfo ? tenantInfo.tenant_code : '')) + '. Periksa kembali kredensial Anda.'
    });
  }

  // Login Berhasil: Kembalikan Profil Lengkap Sekolah
  return createJsonResponse({
    success: true,
    message: 'Login berhasil! Terhubung ke database online sekolah.',
    user: {
      username: username,
      full_name: userFullName,
      role: userRole
    },
    tenant: tenantInfo || { tenant_code: config.npsn || 'DEFAULT', nama_sekolah: config.nama_sekolah },
    profile: config
  });
}

/**
 * Mengambil Kredensial Admin Saat Ini
 */
function handleGetAuth(ss) {
  var config = getSheetKeyValueMap(ss, 'Config');
  return createJsonResponse({
    success: true,
    auth: {
      username: config.admin_username || 'admin',
      password: config.admin_password || 'admin123'
    }
  });
}

/**
 * Menyimpan / Mengubah Username & Password Administrator di Spreadsheet
 */
function handleSaveAuth(ss, payload) {
  var newUsername = payload.username;
  var newPassword = payload.password;

  if (!newUsername) {
    return createJsonResponse({ success: false, error: 'Username baru tidak boleh kosong.' });
  }

  var updates = { admin_username: String(newUsername).trim() };
  if (newPassword) {
    updates.admin_password = String(newPassword).trim();
  }

  saveSheetKeyValueMap(ss, 'Config', updates);

  return createJsonResponse({
    success: true,
    message: 'Kredensial login admin berhasil diperbarui di Google Spreadsheet sekolah.'
  });
}

/**
 * Mengambil Profil Lengkap Sekolah
 */
function handleGetProfile(ss) {
  var config = getSheetKeyValueMap(ss, 'Config');
  return createJsonResponse({
    success: true,
    profile: config
  });
}

/**
 * Menyimpan Profil Sekolah ke Spreadsheet
 */
function handleSaveProfile(ss, payload) {
  var profileObj = payload.profile || payload;
  if (typeof profileObj !== 'object') {
    return createJsonResponse({ success: false, error: 'Data profil tidak valid.' });
  }

  saveSheetKeyValueMap(ss, 'Config', profileObj);

  return createJsonResponse({
    success: true,
    message: 'Profil sekolah berhasil disimpan ke Google Spreadsheet.',
    profile: getSheetKeyValueMap(ss, 'Config')
  });
}

// =========================================================================================
// 6. SYNC ALL DATA (SUPER FAST SINGLE-TRIP INITIAL LOAD)
// =========================================================================================

/**
 * Sinkronisasi Penuh: Mengambil seluruh tabel data sekolah dalam 1 payload HTTP
 * Mengurangi waktu muat aplikasi online dari 10 detik menjadi kurang dari 1 detik!
 */
function handleSyncAll(ss, tenantInfo) {
  var result = {
    success: true,
    timestamp: new Date().toISOString(),
    tenant: tenantInfo || {},
    profile: getSheetKeyValueMap(ss, 'Config'),
    ruangan: readTableRows(ss, 'Ruangan'),
    aset: readTableRows(ss, 'Aset'),
    master_bph: readTableRows(ss, 'Master_BPH'),
    bph_masuk: readTableRows(ss, 'BPH_Masuk'),
    bph_keluar: readTableRows(ss, 'BPH_Keluar'),
    master_kode_barang: readTableRows(ss, 'Master_Kode_Barang'),
    riwayat_penghapusan: readTableRows(ss, 'Riwayat_Penghapusan'),
    riwayat_mutasi: readTableRows(ss, 'Riwayat_Mutasi'),
    riwayat_pemeliharaan: readTableRows(ss, 'Riwayat_Pemeliharaan'),
    sensus_log: readTableRows(ss, 'Sensus_Log')
  };

  return createJsonResponse(result);
}

/**
 * Upload Penuh / Sinkronisasi 2 Arah: Menerima data dari offline (profil, aset, ruangan, BPH, dll.)
 * dan menyimpannya secara batch ke Google Spreadsheet sekolah.
 */
function handleUploadAll(ss, payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(GLOBAL_CONFIG.LOCK_TIMEOUT_MS * 3);

    var counts = {};

    // 1. Simpan Profil / Config
    if (payload.profile && typeof payload.profile === 'object') {
      saveSheetKeyValueMap(ss, 'Config', payload.profile);
      counts.profile = Object.keys(payload.profile).length;
    }

    // 2. Daftar Tabel Batch
    var tablesToProcess = [
      { key: 'ruangan', sheet: 'Ruangan' },
      { key: 'aset', sheet: 'Aset' },
      { key: 'master_bph', sheet: 'Master_BPH' },
      { key: 'bph_masuk', sheet: 'BPH_Masuk' },
      { key: 'bph_keluar', sheet: 'BPH_Keluar' },
      { key: 'master_kode_barang', sheet: 'Master_Kode_Barang' },
      { key: 'riwayat_penghapusan', sheet: 'Riwayat_Penghapusan' },
      { key: 'riwayat_mutasi', sheet: 'Riwayat_Mutasi' },
      { key: 'riwayat_pemeliharaan', sheet: 'Riwayat_Pemeliharaan' },
      { key: 'sensus_log', sheet: 'Sensus_Log' }
    ];

    for (var i = 0; i < tablesToProcess.length; i++) {
      var item = tablesToProcess[i];
      var records = payload[item.key];
      if (Array.isArray(records) && records.length > 0) {
        var sheet = getOrCreateTableSheet(ss, item.sheet);
        var headers = getOrInitHeaders(sheet, item.sheet);
        var idIndex = headers.indexOf('id');

        var existingData = sheet.getDataRange().getValues();
        var existingIdMap = {};
        if (existingData.length > 1 && idIndex !== -1) {
          for (var r = 1; r < existingData.length; r++) {
            var rowId = String(existingData[r][idIndex]).trim();
            if (rowId) existingIdMap[rowId] = r + 1;
          }
        }

        var newRows = [];
        var nowIso = new Date().toISOString();

        for (var k = 0; k < records.length; k++) {
          var rec = records[k];
          if (!rec.id) rec.id = Utilities.getUuid();
          if (!rec.created_at) rec.created_at = nowIso;
          rec.updated_at = rec.updated_at || nowIso;

          var rowValues = headers.map(function(h) {
            var val = rec[h];
            if (val === undefined || val === null) return '';
            if (typeof val === 'object') return JSON.stringify(val);
            return val;
          });

          var targetRow = existingIdMap[String(rec.id).trim()];
          if (targetRow) {
            sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowValues]);
          } else {
            newRows.push(rowValues);
          }
        }

        if (newRows.length > 0) {
          var nextStartRow = sheet.getLastRow() + 1;
          sheet.getRange(nextStartRow, 1, newRows.length, headers.length).setValues(newRows);
        }

        counts[item.key] = records.length;
      }
    }

    return createJsonResponse({
      success: true,
      message: 'Seluruh data berhasil disinkronkan ke Google Spreadsheet sekolah.',
      timestamp: new Date().toISOString(),
      counts: counts
    });
  } catch (err) {
    return createJsonResponse({
      success: false,
      error: 'Gagal sinkronisasi data ke Google Spreadsheet: ' + err.message
    });
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================================
// 7. OPERASI CRUD TABEL (GET, PUT, BULK PUT, UPDATE, DELETE)
// =========================================================================================

/**
 * Mengambil Seluruh Baris dari Sebuah Tabel
 */
function handleGetAll(ss, payload) {
  var tableName = normalizeSheetName(payload.table || payload.tableName);
  var rows = readTableRows(ss, tableName);
  return createJsonResponse({
    success: true,
    table: tableName,
    count: rows.length,
    data: rows
  });
}

/**
 * Mengambil Satu Baris Berdasarkan ID
 */
function handleGet(ss, payload) {
  var tableName = normalizeSheetName(payload.table || payload.tableName);
  var id = String(payload.id || '').trim();

  if (!id) return createJsonResponse({ success: false, error: 'ID wajib diisi.' });

  var rows = readTableRows(ss, tableName);
  var found = null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id).trim() === id) {
      found = rows[i];
      break;
    }
  }

  return createJsonResponse({
    success: true,
    found: !!found,
    data: found
  });
}

/**
 * Menyimpan / Memperbarui Satu Baris Data (Upsert)
 */
function handlePut(ss, payload) {
  var tableName = normalizeSheetName(payload.table || payload.tableName);
  var record = payload.data || payload.record || payload.obj;

  if (!record || typeof record !== 'object') {
    return createJsonResponse({ success: false, error: 'Objek data wajib disertakan.' });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(GLOBAL_CONFIG.LOCK_TIMEOUT_MS);
    var savedRecord = upsertTableRow(ss, tableName, record);
    return createJsonResponse({
      success: true,
      message: 'Data berhasil disimpan ke tabel ' + tableName,
      data: savedRecord
    });
  } catch (err) {
    return createJsonResponse({ success: false, error: 'Gagal menyimpan data: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Menyimpan Banyak Baris Data Sekaligus (Batch Upsert Berkecepatan Tinggi)
 */
function handleBulkPut(ss, payload) {
  var tableName = normalizeSheetName(payload.table || payload.tableName);
  var records = payload.data || payload.records || payload.arr;

  if (!records || !Array.isArray(records)) {
    return createJsonResponse({ success: false, error: 'Array data wajib disertakan.' });
  }

  if (records.length === 0) {
    return createJsonResponse({ success: true, count: 0, message: 'Tidak ada data untuk disimpan.' });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(GLOBAL_CONFIG.LOCK_TIMEOUT_MS * 2);

    var sheet = getOrCreateTableSheet(ss, tableName);
    var headers = getOrInitHeaders(sheet, tableName);

    // Baca data yang ada saat ini untuk mencari index ID
    var existingData = sheet.getDataRange().getValues();
    var idIndex = headers.indexOf('id');
    var existingIdMap = {}; // { 'ID_VALUE': rowIndex (1-indexed) }

    if (existingData.length > 1 && idIndex !== -1) {
      for (var r = 1; r < existingData.length; r++) {
        var rowId = String(existingData[r][idIndex]).trim();
        if (rowId) existingIdMap[rowId] = r + 1; // baris di spreadsheet (1-indexed)
      }
    }

    var newRows = [];
    var nowIso = new Date().toISOString();

    for (var k = 0; k < records.length; k++) {
      var item = records[k];
      if (!item.id) item.id = Utilities.getUuid();
      if (!item.created_at) item.created_at = nowIso;
      item.updated_at = nowIso;

      var rowValues = headers.map(function(h) {
        var val = item[h];
        if (val === undefined || val === null) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return val;
      });

      var targetRow = existingIdMap[String(item.id).trim()];
      if (targetRow) {
        // Update baris yang sudah ada
        sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowValues]);
      } else {
        // Kumpulkan untuk append serentak
        newRows.push(rowValues);
      }
    }

    if (newRows.length > 0) {
      var nextStartRow = sheet.getLastRow() + 1;
      sheet.getRange(nextStartRow, 1, newRows.length, headers.length).setValues(newRows);
    }

    return createJsonResponse({
      success: true,
      message: 'Berhasil memproses bulk ' + records.length + ' data pada tabel ' + tableName,
      count: records.length
    });
  } catch (err) {
    return createJsonResponse({ success: false, error: 'Gagal bulk insert: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Memperbarui Sebagian Properti Kolom pada Satu Baris
 */
function handleUpdate(ss, payload) {
  var tableName = normalizeSheetName(payload.table || payload.tableName);
  var id = String(payload.id || '').trim();
  var updates = payload.updates || payload.data;

  if (!id || !updates || typeof updates !== 'object') {
    return createJsonResponse({ success: false, error: 'ID dan objek updates wajib disertakan.' });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(GLOBAL_CONFIG.LOCK_TIMEOUT_MS);

    var sheet = getOrCreateTableSheet(ss, tableName);
    var headers = getOrInitHeaders(sheet, tableName);
    var idIndex = headers.indexOf('id');

    var data = sheet.getDataRange().getValues();
    var targetRowIndex = -1;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idIndex]).trim() === id) {
        targetRowIndex = i + 1; // 1-indexed
        break;
      }
    }

    if (targetRowIndex === -1) {
      return createJsonResponse({ success: false, error: 'Data dengan ID ' + id + ' tidak ditemukan di tabel ' + tableName });
    }

    updates.updated_at = new Date().toISOString();

    for (var colKey in updates) {
      if (updates.hasOwnProperty(colKey)) {
        var colIndex = headers.indexOf(colKey);
        if (colIndex !== -1) {
          var cellVal = updates[colKey];
          if (typeof cellVal === 'object' && cellVal !== null) cellVal = JSON.stringify(cellVal);
          sheet.getRange(targetRowIndex, colIndex + 1).setValue(cellVal);
        }
      }
    }

    return createJsonResponse({
      success: true,
      message: 'Data ID ' + id + ' pada tabel ' + tableName + ' berhasil diperbarui.'
    });
  } catch (err) {
    return createJsonResponse({ success: false, error: 'Gagal update data: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Menghapus Satu Baris Berdasarkan ID
 */
function handleDelete(ss, payload) {
  var tableName = normalizeSheetName(payload.table || payload.tableName);
  var id = String(payload.id || '').trim();

  if (!id) return createJsonResponse({ success: false, error: 'ID wajib disertakan.' });

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(GLOBAL_CONFIG.LOCK_TIMEOUT_MS);

    var sheet = getOrCreateTableSheet(ss, tableName);
    var headers = getOrInitHeaders(sheet, tableName);
    var idIndex = headers.indexOf('id');

    var data = sheet.getDataRange().getValues();
    var deleted = false;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idIndex]).trim() === id) {
        sheet.deleteRow(i + 1);
        deleted = true;
        break;
      }
    }

    if (!deleted) {
      return createJsonResponse({ success: false, error: 'Data dengan ID ' + id + ' tidak ditemukan di tabel ' + tableName });
    }

    return createJsonResponse({
      success: true,
      message: 'Data dengan ID ' + id + ' berhasil dihapus dari tabel ' + tableName
    });
  } catch (err) {
    return createJsonResponse({ success: false, error: 'Gagal hapus data: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
// 8. MASTER TENANT MANAGEMENT (PENDAFTARAN & KONTROL LISENSI SEKOLAH)
// =========================================================================

/**
 * Mendaftarkan Sekolah Baru ke Sheet 'Master_Tenants'
 */
function handleRegisterTenant(payload) {
  var masterSs = getMasterSpreadsheet();
  if (!masterSs) {
    return createJsonResponse({ success: false, error: 'Master Spreadsheet belum terkonfigurasi di backend.' });
  }

  var tenantCode = String(payload.tenant_code || payload.tenant || payload.npsn || '').trim().toUpperCase();
  var namaSekolah = String(payload.nama_sekolah || '').trim();
  var npsn = String(payload.npsn || tenantCode).trim();
  var spreadsheetId = String(payload.spreadsheet_id || '').trim();
  var status = String(payload.status || 'ACTIVE').trim().toUpperCase();
  var expiredDate = String(payload.expired_date || '2030-12-31').trim();
  var kontakAdmin = String(payload.kontak_admin || '').trim();
  var paket = String(payload.paket_langganan || 'Lisensi Standar 1 Tahun').trim();
  var keterangan = String(payload.keterangan || '').trim();

  if (!tenantCode || !spreadsheetId) {
    return createJsonResponse({ success: false, error: 'Kode Tenant dan Spreadsheet ID wajib diisi.' });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(GLOBAL_CONFIG.LOCK_TIMEOUT_MS);

    var tenantSheet = masterSs.getSheetByName(GLOBAL_CONFIG.TENANT_SHEET_NAME);
    if (!tenantSheet) {
      tenantSheet = masterSs.insertSheet(GLOBAL_CONFIG.TENANT_SHEET_NAME);
      var mHeaders = ['tenant_code', 'nama_sekolah', 'npsn', 'spreadsheet_id', 'status', 'expired_date', 'kontak_admin', 'paket_langganan', 'keterangan', 'created_at', 'updated_at'];
      tenantSheet.getRange(1, 1, 1, mHeaders.length).setValues([mHeaders]);
      formatSheetHeader(tenantSheet, mHeaders.length, '#1e3a8a');
    }

    var data = tenantSheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim().toLowerCase(); });
    var idxCode = headers.indexOf('tenant_code');
    var targetRow = -1;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idxCode]).trim().toUpperCase() === tenantCode) {
        targetRow = i + 1;
        break;
      }
    }

    var nowIso = new Date().toISOString();
    var rowData = [tenantCode, namaSekolah, npsn, spreadsheetId, status, expiredDate, kontakAdmin, paket, keterangan, (targetRow === -1 ? nowIso : data[targetRow - 1][9]), nowIso];

    if (targetRow !== -1) {
      tenantSheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    } else {
      tenantSheet.appendRow(rowData);
    }

    // Update Script Properties Cache
    try {
      PropertiesService.getScriptProperties().setProperty('TENANT_' + tenantCode, spreadsheetId);
    } catch (_) {}

    return createJsonResponse({
      success: true,
      message: 'Sekolah ' + namaSekolah + ' (' + tenantCode + ') berhasil didaftarkan sebagai tenant aktif!',
      tenant: {
        tenant_code: tenantCode,
        nama_sekolah: namaSekolah,
        npsn: npsn,
        spreadsheet_id: spreadsheetId,
        status: status,
        expired_date: expiredDate
      }
    });
  } catch (err) {
    return createJsonResponse({ success: false, error: 'Gagal mendaftarkan tenant: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Menampilkan Daftar Seluruh Sekolah Tenant
 */
function handleListTenants(payload) {
  var masterSs = getMasterSpreadsheet();
  if (!masterSs) return createJsonResponse({ success: false, error: 'Master Spreadsheet tidak ditemukan.' });

  var sheet = masterSs.getSheetByName(GLOBAL_CONFIG.TENANT_SHEET_NAME);
  if (!sheet || sheet.getLastRow() <= 1) {
    return createJsonResponse({ success: true, count: 0, data: [] });
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var result = [];

  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = formatDateCell(data[i][j]);
    }
    result.push(obj);
  }

  return createJsonResponse({ success: true, count: result.length, data: result });
}

/**
 * Mengubah Status Lisensi Tenant (ACTIVE, SUSPENDED, EXPIRED)
 */
function handleUpdateTenantStatus(payload) {
  var masterSs = getMasterSpreadsheet();
  if (!masterSs) return createJsonResponse({ success: false, error: 'Master Spreadsheet tidak ditemukan.' });

  var tenantCode = String(payload.tenant_code || payload.tenant || '').trim().toUpperCase();
  var newStatus = String(payload.status || 'ACTIVE').trim().toUpperCase();
  var newExpDate = payload.expired_date;

  if (!tenantCode) return createJsonResponse({ success: false, error: 'Kode Tenant wajib diisi.' });

  var sheet = masterSs.getSheetByName(GLOBAL_CONFIG.TENANT_SHEET_NAME);
  if (!sheet) return createJsonResponse({ success: false, error: 'Sheet Master_Tenants belum dibuat.' });

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim().toLowerCase(); });
  var idxCode = headers.indexOf('tenant_code');
  var idxStat = headers.indexOf('status');
  var idxExp = headers.indexOf('expired_date');
  var idxUpd = headers.indexOf('updated_at');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxCode]).trim().toUpperCase() === tenantCode) {
      if (idxStat !== -1) sheet.getRange(i + 1, idxStat + 1).setValue(newStatus);
      if (newExpDate && idxExp !== -1) sheet.getRange(i + 1, idxExp + 1).setValue(newExpDate);
      if (idxUpd !== -1) sheet.getRange(i + 1, idxUpd + 1).setValue(new Date().toISOString());

      return createJsonResponse({
        success: true,
        message: 'Status lisensi sekolah ' + tenantCode + ' berhasil diubah menjadi: ' + newStatus
      });
    }
  }

  return createJsonResponse({ success: false, error: 'Tenant ' + tenantCode + ' tidak ditemukan.' });
}

// =========================================================================
// 9. OTOMASI INISIALISASI DATABASE SPREADSHEET SEKOLAH
// =========================================================================

/**
 * Otomatisasi: Membuat dan memformat seluruh 11 tabel SINBAS pada Spreadsheet Baru
 */
function handleSetupSchool(ss, payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(GLOBAL_CONFIG.LOCK_TIMEOUT_MS * 2);

    var initProfile = (payload && payload.profile) ? payload.profile : {};
    var namaSekolah = initProfile.nama_sekolah || 'SMAN 15 TEBO';
    var npsn = initProfile.npsn || '10505963';

    // 1. Inisialisasi Sheet Config
    var configSheet = ss.getSheetByName('Config') || ss.insertSheet('Config', 0);
    var existingConfig = getSheetKeyValueMap(ss, 'Config');
    var isConfigEmpty = Object.keys(existingConfig).length === 0;

    var configRows = [
      ['key', 'value', 'keterangan'],
      ['nama_instansi', existingConfig.nama_instansi || initProfile.nama_instansi || 'PEMERINTAH PROVINSI JAMBI', 'Nama Instansi Pemerintah / Induk'],
      ['nama_opd', existingConfig.nama_opd || initProfile.nama_opd || 'DINAS PENDIDIKAN DAN KEBUDAYAAN', 'Nama Satuan Kerja Perangkat Daerah'],
      ['nama_sekolah', existingConfig.nama_sekolah || namaSekolah, 'Nama Resmi Satuan Pendidikan / Sekolah'],
      ['npsn', existingConfig.npsn || npsn, 'Nomor Pokok Sekolah Nasional'],
      ['jenjang', existingConfig.jenjang || initProfile.jenjang || 'SMA', 'Jenjang Satuan Pendidikan (SD/SMP/SMA/SMK)'],
      ['status_sekolah', existingConfig.status_sekolah || initProfile.status_sekolah || 'Negeri', 'Status Satuan Pendidikan (Negeri/Swasta)'],
      ['provinsi', existingConfig.provinsi || initProfile.provinsi || 'Jambi', 'Provinsi Lokasi BMD'],
      ['kabupaten_kota', existingConfig.kabupaten_kota || initProfile.kabupaten_kota || 'Kabupaten Tebo', 'Kabupaten / Kota'],
      ['kecamatan', existingConfig.kecamatan || initProfile.kecamatan || 'Rimbo Bujang', 'Kecamatan'],
      ['alamat', existingConfig.alamat || initProfile.alamat || 'Jl. Padang Lamo, Wirotho Agung, Rimbo Bujang, Tebo, Jambi', 'Alamat Lengkap Sekolah'],
      ['kode_pemilik', existingConfig.kode_pemilik || initProfile.kode_pemilik || '11', 'Kode Kepemilikan BMD (Permendagri 108/2016)'],
      ['kode_bidang', existingConfig.kode_bidang || initProfile.kode_bidang || '01', 'Kode Bidang Urusan Pendidikan'],
      ['kode_skpd', existingConfig.kode_skpd || initProfile.kode_skpd || '001', 'Kode SKPD Dinas Pendidikan'],
      ['kode_lokasi', existingConfig.kode_lokasi || initProfile.kode_lokasi || ('11.15.09.04.01.001.' + (existingConfig.npsn || npsn)), 'Kodefikasi Lokasi Lengkap Sesuai Permendagri'],
      ['kepala_sekolah', existingConfig.kepala_sekolah || initProfile.kepala_sekolah || 'Pariyanto, S.Pd., M.Pd.', 'Nama Kepala Sekolah'],
      ['nip_kepala_sekolah', existingConfig.nip_kepala_sekolah || initProfile.nip_kepala_sekolah || '19750512 200501 1 004', 'NIP Kepala Sekolah'],
      ['pengurus_barang', existingConfig.pengurus_barang || initProfile.pengurus_barang || 'Pengurus Barang SMAN 15 Tebo', 'Nama Pengurus / Pengelola BMD'],
      ['nip_pengurus_barang', existingConfig.nip_pengurus_barang || initProfile.nip_pengurus_barang || '19820315 200902 1 002', 'NIP Pengurus Barang'],
      ['tahun_anggaran', existingConfig.tahun_anggaran || initProfile.tahun_anggaran || '2026', 'Tahun Anggaran Pembukuan Berjalan'],
      ['admin_username', existingConfig.admin_username || initProfile.admin_username || 'admin', 'Username Administrator Online'],
      ['admin_password', existingConfig.admin_password || initProfile.admin_password || 'admin123', 'Password Administrator Online'],
      ['logo_sekolah', existingConfig.logo_sekolah || '', 'URL / Base64 Logo Satuan Pendidikan'],
      ['logo_daerah', existingConfig.logo_daerah || '', 'URL / Base64 Logo Pemerintah Daerah'],
      ['theme_colors', existingConfig.theme_colors || '{"c1":"#1e3a8a","c2":"#0284c7","c3":"#0d9488"}', 'Tema Tampilan Gradien 3 Warna']
    ];

    if (isConfigEmpty || configSheet.getLastRow() === 0) {
      configSheet.clear();
      configSheet.getRange(1, 1, configRows.length, 3).setValues(configRows);
    }
    formatSheetHeader(configSheet, 3, '#0f172a');
    applyTableColumnWidths(configSheet, 'config');

    // 2. Inisialisasi Seluruh Tabel Data Lainnya
    var tables = [
      { name: 'Ruangan', color: '#1e3a8a', schema: TABLE_SCHEMAS.ruangan },
      { name: 'Aset', color: '#047857', schema: TABLE_SCHEMAS.aset },
      { name: 'Master_BPH', color: '#b45309', schema: TABLE_SCHEMAS.master_bph },
      { name: 'BPH_Masuk', color: '#1d4ed8', schema: TABLE_SCHEMAS.bph_masuk },
      { name: 'BPH_Keluar', color: '#be123c', schema: TABLE_SCHEMAS.bph_keluar },
      { name: 'Master_Kode_Barang', color: '#4338ca', schema: TABLE_SCHEMAS.master_kode_barang },
      { name: 'Riwayat_Penghapusan', color: '#991b1b', schema: TABLE_SCHEMAS.riwayat_penghapusan },
      { name: 'Riwayat_Mutasi', color: '#6d28d9', schema: TABLE_SCHEMAS.riwayat_mutasi },
      { name: 'Riwayat_Pemeliharaan', color: '#0369a1', schema: TABLE_SCHEMAS.riwayat_pemeliharaan },
      { name: 'Sensus_Log', color: '#0f766e', schema: TABLE_SCHEMAS.sensus_log }
    ];

    tables.forEach(function(t) {
      var s = ss.getSheetByName(t.name) || ss.insertSheet(t.name);
      if (s.getLastRow() === 0) {
        s.getRange(1, 1, 1, t.schema.length).setValues([t.schema]);
      }
      formatSheetHeader(s, t.schema.length, t.color);
      applyTableColumnWidths(s, t.name);
    });

    // 3. Isi Data Awal Referensi Kode Barang (Permendagri 108/2016) jika masih kosong
    var mkbSheet = ss.getSheetByName('Master_Kode_Barang');
    if (mkbSheet && mkbSheet.getLastRow() <= 1) {
      var defaultKodeRows = [
        ['mkb-001', 'A', 'Tanah', '1.3.1.01.01.01.001', 'Tanah Bangunan Tempat Kerja', 'Tanah persil untuk bangunan sekolah/kantor'],
        ['mkb-002', 'A', 'Tanah', '1.3.1.01.01.02.001', 'Tanah Lapangan Olahraga', 'Tanah lapangan upacara dan olahraga siswa'],
        ['mkb-003', 'B', 'Peralatan & Mesin', '1.3.2.05.01.01.001', 'Personal Computer (PC)', 'Komputer PC unit untuk Lab & Tata Usaha'],
        ['mkb-004', 'B', 'Peralatan & Mesin', '1.3.2.05.02.01.002', 'Laptop / Notebook', 'Laptop inventaris operasional sekolah'],
        ['mkb-005', 'B', 'Peralatan & Mesin', '1.3.2.05.03.01.001', 'Printer Inkjet / Laser', 'Alat cetak dokumen tata usaha & administrasi'],
        ['mkb-006', 'B', 'Peralatan & Mesin', '1.3.2.07.01.01.001', 'LCD Proyektor Multimedia', 'Proyektor presentasi pembelajaran'],
        ['mkb-007', 'B', 'Peralatan & Mesin', '1.3.2.08.01.01.001', 'Meja Kerja Guru / Pegawai', 'Meja kerja kayu / besi untuk ruang guru'],
        ['mkb-008', 'B', 'Peralatan & Mesin', '1.3.2.08.01.01.002', 'Kursi Kerja Guru / Pegawai', 'Kursi putar / busa staf pengajar'],
        ['mkb-009', 'B', 'Peralatan & Mesin', '1.3.2.08.01.02.001', 'Meja Belajar Siswa', 'Meja belajar peserta didik di kelas'],
        ['mkb-010', 'B', 'Peralatan & Mesin', '1.3.2.08.01.02.002', 'Kursi Belajar Siswa', 'Kursi belajar peserta didik di kelas'],
        ['mkb-011', 'B', 'Peralatan & Mesin', '1.3.2.08.01.03.001', 'Lemari Arsip Dokumen', 'Lemari arsip berkas & dokumen sekolah'],
        ['mkb-012', 'B', 'Peralatan & Mesin', '1.3.2.08.01.04.001', 'Air Conditioner (AC)', 'Pendingin ruangan kantor / laboratorium'],
        ['mkb-013', 'C', 'Gedung & Bangunan', '1.3.3.01.01.01.001', 'Bangunan Gedung Kantor', 'Gedung ruang kepala sekolah, guru & staf'],
        ['mkb-014', 'C', 'Gedung & Bangunan', '1.3.3.01.01.02.001', 'Bangunan Ruang Teori / Kelas', 'Gedung ruang proses belajar mengajar'],
        ['mkb-015', 'C', 'Gedung & Bangunan', '1.3.3.01.01.03.001', 'Bangunan Laboratorium', 'Gedung lab komputer / IPA / multimedia'],
        ['mkb-016', 'D', 'Jalan, Irigasi & Jaringan', '1.3.4.01.01.01.001', 'Jalan Rabat / Paving Lingkungan', 'Akses jalan & paving block halaman sekolah'],
        ['mkb-017', 'D', 'Jalan, Irigasi & Jaringan', '1.3.4.03.01.01.001', 'Instalasi Jaringan Listrik & Air', 'Jaringan kabel listrik dan instalasi pipa air'],
        ['mkb-018', 'E', 'Aset Tetap Lainnya', '1.3.5.01.01.01.001', 'Buku Pelajaran & Kepustakaan', 'Koleksi buku teks dan bahan pustaka perpustakaan']
      ];
      mkbSheet.getRange(2, 1, defaultKodeRows.length, defaultKodeRows[0].length).setValues(defaultKodeRows);
    }

    // 4. Hapus sheet bawaan 'Sheet1' / 'Sheet 1' jika ada
    try {
      var defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1');
      if (defaultSheet && ss.getSheets().length > 1) {
        ss.deleteSheet(defaultSheet);
      }
    } catch (_) {}

    return createJsonResponse({
      success: true,
      message: 'Database Google Spreadsheet untuk sekolah ' + (existingConfig.nama_sekolah || namaSekolah) + ' berhasil diinisialisasi secara sempurna (11 sheet)!',
      spreadsheet_id: ss.getId(),
      spreadsheet_url: ss.getUrl()
    });
  } catch (err) {
    return createJsonResponse({ success: false, error: 'Gagal inisialisasi database sekolah: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
// 10. FUNGSI PEMBANTU (HELPERS & FORMATTING)
// =========================================================================

function normalizeSheetName(rawName) {
  if (!rawName) return 'Aset';
  var clean = String(rawName).trim().toLowerCase();
  var map = {
    'config': 'Config',
    'ruangan': 'Ruangan',
    'aset': 'Aset',
    'riwayat_penghapusan': 'Riwayat_Penghapusan',
    'riwayat_mutasi': 'Riwayat_Mutasi',
    'riwayat_pemeliharaan': 'Riwayat_Pemeliharaan',
    'sensus_log': 'Sensus_Log',
    'master_bph': 'Master_BPH',
    'bph': 'Master_BPH',
    'bph_masuk': 'BPH_Masuk',
    'bph_keluar': 'BPH_Keluar',
    'master_kode_barang': 'Master_Kode_Barang',
    'users': 'Users'
  };
  return map[clean] || rawName;
}

function getOrCreateTableSheet(ss, sheetName) {
  var s = ss.getSheetByName(sheetName);
  if (!s) {
    s = ss.insertSheet(sheetName);
    var schemaKey = sheetName.toLowerCase();
    var schema = TABLE_SCHEMAS[schemaKey] || ['id', 'created_at', 'updated_at'];
    s.getRange(1, 1, 1, schema.length).setValues([schema]);
    formatSheetHeader(s, schema.length, '#1e3a8a');
  }
  return s;
}

function getOrInitHeaders(sheet, sheetName) {
  var lastCol = sheet.getLastColumn();
  if (lastCol > 0 && sheet.getLastRow() > 0) {
    return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h).trim(); });
  }
  var schemaKey = sheetName.toLowerCase();
  var schema = TABLE_SCHEMAS[schemaKey] || ['id', 'created_at', 'updated_at'];
  sheet.getRange(1, 1, 1, schema.length).setValues([schema]);
  formatSheetHeader(sheet, schema.length, '#1e3a8a');
  return schema;
}

function readTableRows(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var isEmpty = row.every(function(cell) { return cell === '' || cell === null; });
    if (isEmpty) continue;

    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j];
      var val = row[j];
      obj[key] = formatDateCell(val);
    }
    rows.push(obj);
  }
  return rows;
}

function upsertTableRow(ss, sheetName, item) {
  var sheet = getOrCreateTableSheet(ss, sheetName);
  var headers = getOrInitHeaders(sheet, sheetName);
  var idIndex = headers.indexOf('id');

  if (!item.id) item.id = Utilities.getUuid();
  var nowIso = new Date().toISOString();
  if (!item.created_at) item.created_at = nowIso;
  item.updated_at = nowIso;

  var rowValues = headers.map(function(h) {
    var val = item[h];
    if (val === undefined || val === null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return val;
  });

  var data = sheet.getDataRange().getValues();
  var targetRow = -1;

  if (data.length > 1 && idIndex !== -1) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idIndex]).trim() === String(item.id).trim()) {
        targetRow = i + 1;
        break;
      }
    }
  }

  if (targetRow !== -1) {
    sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return item;
}

function getSheetKeyValueMap(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  var result = {};
  if (!sheet || sheet.getLastRow() <= 1) return result;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var k = String(data[i][0]).trim();
    if (k) {
      result[k] = formatDateCell(data[i][1]);
    }
  }
  return result;
}

function saveSheetKeyValueMap(ss, sheetName, kvMap) {
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 3).setValues([['key', 'value', 'keterangan']]);
    formatSheetHeader(sheet, 3, '#0f172a');
  }

  var data = sheet.getDataRange().getValues();
  var existingKeys = {};
  for (var i = 1; i < data.length; i++) {
    var k = String(data[i][0]).trim();
    if (k) existingKeys[k] = i + 1; // row number (1-indexed)
  }

  for (var key in kvMap) {
    if (kvMap.hasOwnProperty(key)) {
      var val = kvMap[key];
      if (typeof val === 'object' && val !== null) val = JSON.stringify(val);

      if (existingKeys[key]) {
        sheet.getRange(existingKeys[key], 2).setValue(val);
      } else {
        sheet.appendRow([key, val, 'Diperbarui via SINBAS Client']);
      }
    }
  }
}

function formatDateCell(val) {
  if (val instanceof Date) {
    try {
      var y = val.getFullYear();
      var m = String(val.getMonth() + 1).padStart(2, '0');
      var d = String(val.getDate()).padStart(2, '0');
      // Jika jam menit detik bernilai 00:00:00 kembalikan format YYYY-MM-DD
      if (val.getHours() === 0 && val.getMinutes() === 0 && val.getSeconds() === 0) {
        return y + '-' + m + '-' + d;
      }
      return val.toISOString();
    } catch (_) {}
  }
  return val;
}

function formatSheetHeader(sheet, colCount, hexColor) {
  try {
    sheet.setFrozenRows(1);
    var range = sheet.getRange(1, 1, 1, colCount);
    range.setBackground(hexColor || '#1e3a8a');
    range.setFontColor('#ffffff');
    range.setFontWeight('bold');
    range.setHorizontalAlignment('center');
    range.setVerticalAlignment('middle');
    range.setWrap(true);
    sheet.setRowHeight(1, 35);
  } catch (_) {}
}

function applyTableColumnWidths(sheet, tableName) {
  try {
    var key = String(tableName).toLowerCase();
    var widths = TABLE_COLUMN_WIDTHS[key];
    if (widths && widths.length) {
      for (var i = 0; i < widths.length; i++) {
        sheet.setColumnWidth(i + 1, widths[i]);
      }
    }
  } catch (_) {}
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// =========================================================================
// 11. MENU KHUSUS SPREADSHEET (APPS SCRIPT UI & RUNNER)
// =========================================================================
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('⚡ SINBAS Hybrid')
      .addItem('🚀 1. Setup Database Otomatis (1-Klik)', 'menuSetupDatabaseOtomatis')
      .addItem('🏫 2. Isi Profil Sekolah via Dialog', 'menuAturProfilSekolah')
      .addItem('📦 3. Isi Data Contoh / Demo (Uji Coba)', 'menuIsiDataContoh')
      .addSeparator()
      .addItem('🏢 4. Buat Tabel Master Tenants (Multi-Sekolah)', 'menuInitMasterTenants')
      .addItem('🔑 5. Info Spreadsheet ID & Kredensial Login', 'menuShowAdminAuth')
      .addItem('📖 6. Petunjuk Lengkap Deploy & Koneksi SINBAS', 'menuShowPanduan')
      .addToUi();
  } catch (_) {}
}

/**
 * Menu 1: Inisialisasi Database Otomatis
 */
function menuSetupDatabaseOtomatis() {
  var ss;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (_) {
    ss = null;
  }

  if (!ss) {
    if (GLOBAL_CONFIG.MASTER_SPREADSHEET_ID) {
      try {
        ss = SpreadsheetApp.openById(GLOBAL_CONFIG.MASTER_SPREADSHEET_ID);
      } catch (err) {
        throw new Error('Gagal membuka spreadsheet MASTER_SPREADSHEET_ID: ' + err.message);
      }
    } else {
      throw new Error(
        'TIDAK DITEMUKAN SPREADSHEET AKTIF!\n' +
        'Pastikan script ini dibuka dari dalam Google Spreadsheet (menu Ekstensi > Apps Script),\n' +
        'atau isikan GLOBAL_CONFIG.MASTER_SPREADSHEET_ID dengan ID Spreadsheet Anda.'
      );
    }
  }

  var res = handleSetupSchool(ss, {});

  Logger.log('==================================================================');
  Logger.log('🎉 SETUP DATABASE SINBAS BERHASIL DIJALANKAN!');
  Logger.log('ID Spreadsheet : ' + ss.getId());
  Logger.log('URL Spreadsheet: ' + ss.getUrl());
  Logger.log('11 Sheet Berhasil Dibuat & Diformat Secara Lengkap!');
  Logger.log('==================================================================');

  try {
    var ui = SpreadsheetApp.getUi();
    ui.alert(
      '🎉 SETUP DATABASE BERHASIL!',
      'Seluruh 11 sheet database SINBAS telah dibuat dan diformat secara otomatis sesuai standar Permendagri 108/2016 & Permendagri 47/2021:\n\n' +
      '• Config\n' +
      '• Ruangan\n' +
      '• Aset (KIB A-F, NIBAR, Register)\n' +
      '• Master_BPH\n' +
      '• BPH_Masuk\n' +
      '• BPH_Keluar\n' +
      '• Master_Kode_Barang (18 Kode Standar)\n' +
      '• Riwayat_Penghapusan\n' +
      '• Riwayat_Mutasi\n' +
      '• Riwayat_Pemeliharaan\n' +
      '• Sensus_Log\n\n' +
      'ID Spreadsheet: ' + ss.getId() + '\n\n' +
      'Tips: Anda dapat melanjutkan dengan menu "🏫 2. Isi Profil Sekolah via Dialog" untuk menyesuaikan data sekolah Anda.',
      ui.ButtonSet.OK
    );
  } catch (_) {}

  return res;
}

// Alias fungsi untuk kompatibilitas lama
function menuInitCurrentSpreadsheet() {
  return menuSetupDatabaseOtomatis();
}

/**
 * Menu 2: Dialog Pengaturan Profil & Identitas Sekolah
 */
function menuAturProfilSekolah() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var currentConfig = getSheetKeyValueMap(ss, 'Config');

  var pNama = ui.prompt('Profil Sekolah (Langkah 1/5)', 'Masukkan Nama Resmi Satuan Pendidikan:\n(Contoh: SMAN 15 TEBO / SMPN 1 BANDUNG)', ui.ButtonSet.OK_CANCEL);
  if (pNama.getSelectedButton() !== ui.Button.OK) return;
  var namaSekolah = pNama.getResponseText().trim() || currentConfig.nama_sekolah || 'SMAN 15 TEBO';

  var pNpsn = ui.prompt('Profil Sekolah (Langkah 2/5)', 'Masukkan Nomor Pokok Sekolah Nasional (NPSN):\n(Contoh: 10505963)', ui.ButtonSet.OK_CANCEL);
  if (pNpsn.getSelectedButton() !== ui.Button.OK) return;
  var npsn = pNpsn.getResponseText().trim() || currentConfig.npsn || '10505963';

  var pKab = ui.prompt('Profil Sekolah (Langkah 3/5)', 'Masukkan Kabupaten / Kota:\n(Contoh: Kabupaten Tebo / Kota Bandung)', ui.ButtonSet.OK_CANCEL);
  if (pKab.getSelectedButton() !== ui.Button.OK) return;
  var kabKota = pKab.getResponseText().trim() || currentConfig.kabupaten_kota || 'Kabupaten Tebo';

  var pProv = ui.prompt('Profil Sekolah (Langkah 4/5)', 'Masukkan Provinsi:\n(Contoh: Jambi / Jawa Barat)', ui.ButtonSet.OK_CANCEL);
  if (pProv.getSelectedButton() !== ui.Button.OK) return;
  var provinsi = pProv.getResponseText().trim() || currentConfig.provinsi || 'Jambi';

  var pKepsek = ui.prompt('Profil Sekolah (Langkah 5/5)', 'Masukkan Nama Kepala Sekolah & Gelar:\n(Contoh: Pariyanto, S.Pd., M.Pd.)', ui.ButtonSet.OK_CANCEL);
  if (pKepsek.getSelectedButton() !== ui.Button.OK) return;
  var kepsek = pKepsek.getResponseText().trim() || currentConfig.kepala_sekolah || 'Kepala Sekolah';

  var updates = {
    nama_sekolah: namaSekolah,
    npsn: npsn,
    kabupaten_kota: kabKota,
    provinsi: provinsi,
    kepala_sekolah: kepsek,
    kode_lokasi: (currentConfig.kode_pemilik || '11') + '.' + (currentConfig.kode_bidang || '01') + '.' + npsn
  };

  saveSheetKeyValueMap(ss, 'Config', updates);

  ui.alert(
    'Profil Sekolah Berhasil Disimpan!',
    'Data identitas sekolah Anda telah tersimpan di sheet "Config":\n\n' +
    '• Nama Sekolah : ' + namaSekolah + '\n' +
    '• NPSN         : ' + npsn + '\n' +
    '• Kab / Kota   : ' + kabKota + '\n' +
    '• Provinsi     : ' + provinsi + '\n' +
    '• Kepala Sekolah: ' + kepsek + '\n\n' +
    'Data ini akan langsung tersinkron ke aplikasi SINBAS saat dihubungkan.',
    ui.ButtonSet.OK
  );
}

/**
 * Menu 3: Masukkan Data Sampel / Demo untuk Uji Coba
 */
function menuIsiDataContoh() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var confirm = ui.alert(
    'Isi Data Contoh / Demo?',
    'Fitur ini akan menambahkan data sampel ke spreadsheet:\n' +
    '• 3 Ruangan (Ruang Guru, Ruang Kelas VII-A, Lab Komputer)\n' +
    '• 3 Aset Inventaris KIB B (Laptop ASUS, Meja Siswa, Proyektor EPSON)\n' +
    '• 2 Master Barang Persediaan (Kertas HVS A4, Spidol Whiteboard)\n' +
    '• 1 Transaksi BPH Masuk & 1 BPH Keluar\n\n' +
    'Data contoh ini sangat berguna untuk menguji sinkronisasi, cetak laporan & label QR. Lanjutkan?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  var today = new Date().toISOString().split('T')[0];

  // 1. Ruangan
  upsertTableRow(ss, 'Ruangan', { id: 'R-GURU', kode_ruangan: '01', nama_ruangan: 'Ruang Guru & TU', penanggung_jawab: 'Wakasek Sarpras', nip_penanggung_jawab: '-', lokasi_gedung: 'Gedung Utama', keterangan: 'Ruang kerja guru dan tata usaha' });
  upsertTableRow(ss, 'Ruangan', { id: 'R-KLS-7A', kode_ruangan: '02', nama_ruangan: 'Ruang Kelas VII-A', penanggung_jawab: 'Wali Kelas VII-A', nip_penanggung_jawab: '-', lokasi_gedung: 'Gedung Barat', keterangan: 'Ruang teori pembelajaran' });
  upsertTableRow(ss, 'Ruangan', { id: 'R-LAB-KOMP', kode_ruangan: '03', nama_ruangan: 'Laboratorium Komputer', penanggung_jawab: 'Koordinator Lab', nip_penanggung_jawab: '-', lokasi_gedung: 'Gedung Timur', keterangan: 'Ruang praktik komputer dan ANBK' });

  // 2. Aset
  upsertTableRow(ss, 'Aset', {
    id: 'AST-DEMO-001',
    batch_id: 'BATCH-001',
    kib_type: 'B',
    nibar: '11.15.09.04.01.001.10505963.2026.02.05.02.01.002.00001',
    no_register: '00001',
    kode_barang: '1.3.2.05.02.01.002',
    nama_barang: 'Laptop / Notebook',
    spesifikasi_nama: 'ASUS Vivobook 14 A416MA Intel N4020 RAM 8GB SSD 256GB',
    merk_tipe: 'ASUS Vivobook 14',
    no_pabrik_seri: 'ASUS-SN-2026-001',
    bahan: 'Plastik / Logam',
    asal_usul: 'Pembelian',
    tahun_perolehan: 2026,
    tanggal_perolehan: today,
    harga_satuan: 6500000,
    nilai_total: 6500000,
    kondisi: 'Baik',
    ruangan_id: 'R-LAB-KOMP',
    ruangan_nama: 'Laboratorium Komputer',
    jumlah: 1,
    satuan: 'Unit',
    data_khusus: '{}',
    status_aset: 'Aktif',
    keterangan: 'Aset pengadaan BOS Reguler 2026'
  });

  upsertTableRow(ss, 'Aset', {
    id: 'AST-DEMO-002',
    batch_id: 'BATCH-002',
    kib_type: 'B',
    nibar: '11.15.09.04.01.001.10505963.2026.02.08.01.02.001.00001',
    no_register: '00001',
    kode_barang: '1.3.2.08.01.02.001',
    nama_barang: 'Meja Siswa',
    spesifikasi_nama: 'Meja Belajar Siswa Kayu Solid Mahoni Rangka Besi Hollow',
    merk_tipe: 'Lokal Presisi',
    no_pabrik_seri: '-',
    bahan: 'Kayu / Besi',
    asal_usul: 'Pembelian',
    tahun_perolehan: 2026,
    tanggal_perolehan: today,
    harga_satuan: 450000,
    nilai_total: 9000000,
    kondisi: 'Baik',
    ruangan_id: 'R-KLS-7A',
    ruangan_nama: 'Ruang Kelas VII-A',
    jumlah: 20,
    satuan: 'Unit',
    data_khusus: '{}',
    status_aset: 'Aktif',
    keterangan: '20 set meja belajar siswa'
  });

  upsertTableRow(ss, 'Aset', {
    id: 'AST-DEMO-003',
    batch_id: 'BATCH-003',
    kib_type: 'B',
    nibar: '11.15.09.04.01.001.10505963.2026.02.07.01.01.001.00001',
    no_register: '00001',
    kode_barang: '1.3.2.07.01.01.001',
    nama_barang: 'LCD Proyektor Multimedia',
    spesifikasi_nama: 'Epson EB-E500 3300 Lumens XGA 3LCD',
    merk_tipe: 'Epson EB-E500',
    no_pabrik_seri: 'EPS-2026-X88',
    bahan: 'Elektronik / Logam',
    asal_usul: 'Pembelian',
    tahun_perolehan: 2026,
    tanggal_perolehan: today,
    harga_satuan: 5500000,
    nilai_total: 5500000,
    kondisi: 'Baik',
    ruangan_id: 'R-GURU',
    ruangan_nama: 'Ruang Guru & TU',
    jumlah: 1,
    satuan: 'Unit',
    data_khusus: '{}',
    status_aset: 'Aktif',
    keterangan: 'Proyektor mobilitas rapat guru'
  });

  // 3. Master BPH
  upsertTableRow(ss, 'Master_BPH', {
    id: 'BPH-001',
    kode_bph: 'BPH-ATK-001',
    nama_barang: 'Kertas HVS A4 75 GSM',
    kategori: 'Alat Tulis Kantor',
    satuan: 'Rim',
    spesifikasi: 'PaperOne A4 75 Gram Putih',
    keterangan: 'Kebutuhan administrasi dan ujian'
  });

  upsertTableRow(ss, 'Master_BPH', {
    id: 'BPH-002',
    kode_bph: 'BPH-ATK-002',
    nama_barang: 'Spidol Whiteboard Snowman Hitam',
    kategori: 'Alat Tulis Kantor',
    satuan: 'Pcs',
    spesifikasi: 'Snowman Boardmarker BG-12 Black',
    keterangan: 'Spidol pembelajaran kelas'
  });

  // 4. BPH Masuk
  upsertTableRow(ss, 'BPH_Masuk', {
    id: 'IN-001',
    master_bph_id: 'BPH-001',
    kode_bph: 'BPH-ATK-001',
    nama_barang: 'Kertas HVS A4 75 GSM',
    kategori: 'Alat Tulis Kantor',
    tanggal: today,
    tahun: 2026,
    bulan: 'Januari',
    jumlah: 25,
    satuan: 'Rim',
    harga_satuan: 55000,
    total_nilai: 1375000,
    sumber_dana: 'Dana BOS',
    no_bukti: 'KW-01/BOS/2026',
    rekanan: 'Toko Buku & ATK Sejahtera',
    keterangan: 'Pengadaan awal semester'
  });

  // 5. BPH Keluar
  upsertTableRow(ss, 'BPH_Keluar', {
    id: 'OUT-001',
    master_bph_id: 'BPH-001',
    kode_bph: 'BPH-ATK-001',
    nama_barang: 'Kertas HVS A4 75 GSM',
    tanggal: today,
    tahun: 2026,
    bulan: 'Januari',
    jumlah: 5,
    satuan: 'Rim',
    keperluan: 'Cetak Administrasi Pembelajaran Guru',
    penerima: 'Staf Tata Usaha',
    ruangan_id: 'R-GURU',
    ruangan_nama: 'Ruang Guru & TU',
    no_bukti: 'BON-01/TU/2026',
    keterangan: 'Distribusi ATK'
  });

  ui.alert(
    'Data Contoh Berhasil Dimasukkan!',
    'Data sampel ruangan, aset inventaris, dan persediaan BPH telah dimasukkan.\n\n' +
    'Silakan buka aplikasi SINBAS dan lakukan Sinkronisasi untuk mengunduh seluruh data ini ke aplikasi!',
    ui.ButtonSet.OK
  );
}

/**
 * Menu 4: Inisialisasi Master Tenants (Pusat Multi-Sekolah)
 */
function menuInitMasterTenants() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(GLOBAL_CONFIG.TENANT_SHEET_NAME) || ss.insertSheet(GLOBAL_CONFIG.TENANT_SHEET_NAME);
  var mHeaders = ['tenant_code', 'nama_sekolah', 'npsn', 'spreadsheet_id', 'status', 'expired_date', 'kontak_admin', 'paket_langganan', 'keterangan', 'created_at', 'updated_at'];
  sheet.getRange(1, 1, 1, mHeaders.length).setValues([mHeaders]);
  formatSheetHeader(sheet, mHeaders.length, '#1e3a8a');
  SpreadsheetApp.getUi().alert('Sukses', 'Tabel Master_Tenants berhasil dibuat! Anda dapat mendaftarkan sekolah-sekolah pelanggan di sini.', SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Menu 5: Info Spreadsheet ID & Kredensial Administrator
 */
function menuShowAdminAuth() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = getSheetKeyValueMap(ss, 'Config');
  var msg = 'INFORMASI SPREADSHEET & KREDENSIAL SINBAS:\n\n' +
            '• Nama Sekolah : ' + (config.nama_sekolah || '-') + '\n' +
            '• NPSN         : ' + (config.npsn || '-') + '\n' +
            '• ID Spreadsheet: ' + ss.getId() + '\n\n' +
            'KREDENSIAL LOGIN ADMIN:\n' +
            '• Username : ' + (config.admin_username || 'admin') + '\n' +
            '• Password : ' + (config.admin_password || 'admin123') + '\n\n' +
            'Gunakan username & password di atas saat login di SINBAS versi Online Web.';
  SpreadsheetApp.getUi().alert('Informasi Kredensial', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Menu 6: Petunjuk Lengkap Deploy & Koneksi SINBAS
 */
function menuShowPanduan() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var msg = 'PANDUAN LENGKAP KONEKSI SINBAS DENGAN GOOGLE SPREADSHEET:\n\n' +
            '1. DEPLOYMENT GOOGLE APPS SCRIPT:\n' +
            '   a. Klik tombol biru "Terapkan" (Deploy) di kanan atas editor Apps Script.\n' +
            '   b. Pilih "Deployment baru" (New deployment).\n' +
            '   c. Klik ikon roda gigi di samping "Pilih jenis", pilih "Aplikasi Web" (Web App).\n' +
            '   d. Pengaturan:\n' +
            '      - Jalankan sebagai: "Saya" (Akun Google Anda)\n' +
            '      - Yang memiliki akses: "Siapa saja" (Anyone)\n' +
            '   e. Klik "Terapkan" (Deploy) dan berikan izin otorisasi Akun Google Anda.\n' +
            '   f. Salin URL Aplikasi Web yang berakhiran "/exec".\n\n' +
            '2. MENYAMBUNGKAN KE APLIKASI SINBAS:\n' +
            '   a. Buka aplikasi SINBAS di browser atau aplikasi desktop.\n' +
            '   b. Klik tombol "Cloud / Sinkronisasi" di bar atas.\n' +
            '   c. Tempelkan Link Exec yang telah disalin ke kolom yang tersedia.\n' +
            '   d. Klik "Uji Koneksi Cloud" lalu klik "Mulai Sinkronkan".\n\n' +
            'ID Spreadsheet Anda: ' + ss.getId();
  SpreadsheetApp.getUi().alert('Petunjuk Koneksi SINBAS', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}
