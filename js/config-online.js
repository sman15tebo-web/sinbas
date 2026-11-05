/**
 * =========================================================================================
 * SINBAS HYBRID — Konfigurasi Online Google Apps Script (GAS) Multi-Sekolah
 * =========================================================================================
 * Format mudah untuk banyak sekolah:
 * Cukup daftarkan "id_sekolah": "link_exec_google_apps_script" di dalam objek tenants di bawah.
 *
 * Contoh cara membagikan link ke sekolah pembeli:
 * https://domain-anda.github.io/sinbas/?id=sekolahA
 * https://domain-anda.github.io/sinbas/?id=sekolahB
 * https://domain-anda.github.io/sinbas/?id=sman15tebo
 */

const SINBAS_ONLINE_CONFIG = {
    // =====================================================================
    // DAFTAR SEKOLAH & LINK EXEC MASING-MASING:
    // Format: "id_sekolah": "link exec dari Google Apps Script"
    // =====================================================================
    tenants: {
        "sman15tebo": "https://script.google.com/macros/s/AKfycbypaSzz1-VT0PxnLznIaeKaBl6YmmHXa-7d1jyMkVe3EYRTz9RYi7uosE2cwaVzIPxHpw/exec",
        "sekolahA": "",
        "sekolahB": ""
        // Tambah sekolah baru di sini:
        // "sekolahC": "https://script.google.com/macros/s/AKfycb.../exec",
    },

    // ID Sekolah Bawaan (jika link dibuka langsung tanpa ?id=...)
    default_tenant: "sman15tebo",

    // Timeout koneksi fetch ke Google Apps Script (milidetik)
    timeout_ms: 25000,

    // Otomatis sinkronisasi data dari Google Sheets saat login berhasil
    auto_sync_on_login: true
};

if (typeof window !== 'undefined') {
    window.SINBAS_ONLINE_CONFIG = SINBAS_ONLINE_CONFIG;
}
