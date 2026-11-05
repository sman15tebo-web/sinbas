/**
 * ============================================================
 * SINBAS HYBRID DESKTOP — Main Application Controller
 * Sistem Inventarisasi Barang dan Aset Sekolah
 * ============================================================
 */

let appProfile = {};
let allAssets = [];
let allRooms = [];
let allBph = [];
let allMasterBph = [];
let allBphMasuk = [];
let allBphKeluar = [];
let currentBphFilterTahun = 2026;
let currentBphFilterBulan = 0; // 0 = Semua Bulan
let currentBphSubTab = 'masuk';
let customKodeBarang = [];
let allRiwayatPenghapusan = [];
let currentBatchViewingId = null;
let currentKibFilter = 'B';
let currentPreviewKibType = 'B';
let currentPreviewZoom = 1.0;
let currentKibFormatVersion = '2021';
let currentKirRoomId = 'R-01';
let currentMasterDataSubTab = 'ruangan';
let html5QrScanner = null;
let kibChart = null;
let kondisiChart = null;
let currentPreviewReportType = 'kib'; // 'kib' | 'kir' | 'buku_induk' | 'bph_masuk' | 'bph_keluar' | 'bph_saldo'
let currentPreviewKirRoom = null;
let currentPreviewBphType = 'masuk';

let cachedDefaultLogoDaerahBase64 = '';
let cachedDefaultLogoSekolahBase64 = '';
let cachedLogoSinbasBase64 = '';

function preloadBase64Logos() {
    const toBase64 = (url) => new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            try {
                resolve(canvas.toDataURL('image/png'));
            } catch (e) {
                resolve('');
            }
        };
        img.onerror = () => resolve('');
        img.src = url;
    });

    toBase64('assets/img/logo_sinbas.png').then(b => { if (b) cachedLogoSinbasBase64 = b; });
    toBase64('assets/img/logo_daerah.png').then(b => { if (b) cachedDefaultLogoDaerahBase64 = b; });
    toBase64('assets/img/logo_sekolah.png').then(b => { if (b) cachedDefaultLogoSekolahBase64 = b; });
}

// =========================================================================
// SISTEM PAGINASI UNIVERSAL TABEL SINBAS (10, 25, 50, 100 PER HALAMAN)
// =========================================================================
const tablePagination = {
    buku_induk: { page: 1, perPage: 10 },
    ruangan: { page: 1, perPage: 10 },
    kode_barang: { page: 1, perPage: 10 },
    master_bph: { page: 1, perPage: 10 },
    bph_masuk: { page: 1, perPage: 10 },
    bph_keluar: { page: 1, perPage: 10 },
    bph_saldo: { page: 1, perPage: 10 },
    kib: { page: 1, perPage: 10 },
    kir: { page: 1, perPage: 10 },
    mutasi: { page: 1, perPage: 10 },
    penghapusan: { page: 1, perPage: 10 }
};

function resetTablePage(tableKey) {
    if (tablePagination[tableKey]) {
        tablePagination[tableKey].page = 1;
    }
}

function setTablePage(tableKey, pageNum) {
    if (!tablePagination[tableKey]) tablePagination[tableKey] = { page: 1, perPage: 10 };
    tablePagination[tableKey].page = pageNum;
    triggerTableRerender(tableKey);
}

function setTablePerPage(tableKey, perPageVal) {
    if (!tablePagination[tableKey]) tablePagination[tableKey] = { page: 1, perPage: 10 };
    tablePagination[tableKey].perPage = parseInt(perPageVal, 10) || 10;
    tablePagination[tableKey].page = 1;
    triggerTableRerender(tableKey);
}

function triggerTableRerender(tableKey) {
    switch (tableKey) {
        case 'buku_induk': renderBukuIndukTable(); break;
        case 'ruangan': renderMasterRuanganTable(); break;
        case 'kode_barang': renderMasterKodeBarangTable(); break;
        case 'master_bph': renderMasterBphTable(); break;
        case 'bph_masuk': renderBphMasukTable(); break;
        case 'bph_keluar': renderBphKeluarTable(); break;
        case 'bph_saldo': renderBphBukuPersediaanTable(); break;
        case 'kib': renderKibTable(); break;
        case 'kir': renderKirView(); break;
        case 'mutasi': renderMutasiHistory(); break;
        case 'penghapusan': renderRiwayatPenghapusan(); break;
    }
}

function renderTablePagination(tableKey, totalItems) {
    const container = document.getElementById('pagination_' + tableKey);
    if (!container) return;

    const state = tablePagination[tableKey] || { page: 1, perPage: 10 };
    const perPage = state.perPage;
    const totalPages = Math.max(1, Math.ceil(totalItems / perPage));

    if (state.page > totalPages) {
        state.page = totalPages;
    }
    if (state.page < 1) {
        state.page = 1;
    }

    if (totalItems === 0) {
        container.innerHTML = '';
        container.classList.add('d-none');
        return;
    }
    container.classList.remove('d-none');

    const startItem = (state.page - 1) * perPage + 1;
    const endItem = Math.min(state.page * perPage, totalItems);

    let pages = [];
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        pages.push(1);
        if (state.page > 3) pages.push('...');
        const start = Math.max(2, state.page - 1);
        const end = Math.min(totalPages - 1, state.page + 1);
        for (let i = start; i <= end; i++) {
            if (!pages.includes(i)) pages.push(i);
        }
        if (state.page < totalPages - 2) pages.push('...');
        if (!pages.includes(totalPages)) pages.push(totalPages);
    }

    let pageBtnsHtml = `
        <li class="page-item ${state.page === 1 ? 'disabled' : ''}">
            <button type="button" class="page-link" onclick="setTablePage('${tableKey}', 1)" title="Halaman Pertama"><i class="fas fa-angle-double-left"></i></button>
        </li>
        <li class="page-item ${state.page === 1 ? 'disabled' : ''}">
            <button type="button" class="page-link" onclick="setTablePage('${tableKey}', ${state.page - 1})" title="Halaman Sebelumnya"><i class="fas fa-angle-left"></i></button>
        </li>
    `;

    pages.forEach(p => {
        if (p === '...') {
            pageBtnsHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        } else {
            pageBtnsHtml += `
                <li class="page-item ${state.page === p ? 'active' : ''}">
                    <button type="button" class="page-link" onclick="setTablePage('${tableKey}', ${p})">${p}</button>
                </li>
            `;
        }
    });

    pageBtnsHtml += `
        <li class="page-item ${state.page === totalPages ? 'disabled' : ''}">
            <button type="button" class="page-link" onclick="setTablePage('${tableKey}', ${state.page + 1})" title="Halaman Selanjutnya"><i class="fas fa-angle-right"></i></button>
        </li>
        <li class="page-item ${state.page === totalPages ? 'disabled' : ''}">
            <button type="button" class="page-link" onclick="setTablePage('${tableKey}', ${totalPages})" title="Halaman Terakhir"><i class="fas fa-angle-double-right"></i></button>
        </li>
    `;

    container.innerHTML = `
        <div class="table-pagination-info">
            <span>Menampilkan <strong>${startItem}</strong> - <strong>${endItem}</strong> dari <strong>${totalItems}</strong> data</span>
        </div>
        <div class="table-pagination-controls">
            <div class="table-pagination-pagesize">
                <span>Tampilkan:</span>
                <select class="form-select form-select-sm" onchange="setTablePerPage('${tableKey}', this.value)">
                    <option value="10" ${perPage === 10 ? 'selected' : ''}>10</option>
                    <option value="25" ${perPage === 25 ? 'selected' : ''}>25</option>
                    <option value="50" ${perPage === 50 ? 'selected' : ''}>50</option>
                    <option value="100" ${perPage === 100 ? 'selected' : ''}>100</option>
                </select>
                <span>per halaman</span>
            </div>
            <nav class="table-pagination-nav">
                <ul class="pagination pagination-sm mb-0">
                    ${pageBtnsHtml}
                </ul>
            </nav>
        </div>
    `;
}


// =========================================================================
// INISIALISASI APLIKASI
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[SINBAS] Memulai aplikasi...');

    // Global Modal Backdrop Cleanup: Menghapus backdrop yang tertinggal dan membuka kembali interaksi layar
    document.addEventListener('hidden.bs.modal', () => {
        const openModals = document.querySelectorAll('.modal.show');
        if (openModals.length === 0) {
            document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('padding-right');
        } else {
            const backdrops = document.querySelectorAll('.modal-backdrop');
            if (backdrops.length > openModals.length) {
                for (let i = openModals.length; i < backdrops.length; i++) {
                    backdrops[i].remove();
                }
            }
        }
    });

    initNavigation();
    loadThemeSettings();
    applyLogosToDOM();
    initSettingsWilayahSelectors();
    initCropperListeners();
    await initApp();
});

function initPlatformAndLoginUI() {
    const badge = document.getElementById('loginModeBadge');
    const groupTenant = document.getElementById('group_tenant_select');
    const inputTenant = document.getElementById('login_tenant');
    const hintBadge = document.getElementById('loginHintBadge');

    if (db.isElectron) {
        if (badge) {
            badge.className = 'badge px-3 py-2 bg-primary bg-opacity-25 text-primary border border-primary border-opacity-50';
            badge.innerHTML = '<i class="fas fa-desktop me-1"></i> Mode Offline: Desktop Native (SQLite)';
        }
        if (groupTenant) groupTenant.classList.add('d-none');
        if (hintBadge) hintBadge.classList.remove('d-none');
    } else {
        const activeTenant = db.getActiveTenant();
        if (badge) {
            badge.className = 'badge px-3 py-2 bg-success bg-opacity-25 text-success border border-success border-opacity-50';
            badge.innerHTML = `<i class="fas fa-cloud me-1"></i> Mode Online: Google Sheets (?id=${activeTenant})`;
        }
        if (groupTenant) {
            groupTenant.classList.remove('d-none');
            if (inputTenant) inputTenant.value = activeTenant;
        }
        if (hintBadge) hintBadge.classList.add('d-none');
    }
}

async function initApp() {
    try {
        await db.readyPromise;
        initPlatformAndLoginUI();
        preloadBase64Logos();
        await loadProfile();
        await loadRooms();
        await loadAssets();
        await loadBph();
        await loadMasterBph();
        await loadBphMasuk();
        await loadBphKeluar();
        await loadCustomKodeBarang();
        await loadRiwayatPenghapusan();
        initNavigation();
        initFormListeners();
        initCloudSettingsUI();
        initMasterKode5LevelFilters();
        updateDashboardStats();
        renderBukuIndukTable();
        renderMasterRuanganTable();
        renderMasterKodeBarangTable();
        renderMasterBphTable();
        renderKibTable();
        renderKirView();

        // Cek status sesi login (Mendukung persistent session anti-logout tak terduga)
        const isAuth = sessionStorage.getItem('sinbas_auth') === 'true' || localStorage.getItem('sinbas_auth') === 'true';
        if (isAuth) {
            sessionStorage.setItem('sinbas_auth', 'true');
            localStorage.setItem('sinbas_auth', 'true');
            showView('app');
            const target = currentTab || 'dashboard';
            switchTab(target);
        } else {
            showView('landing');
        }

        console.log('[SINBAS] Aplikasi siap digunakan!');
    } catch (err) {
        console.error('[SINBAS] Gagal inisialisasi aplikasi:', err);
    }
}

// 1. Profil Sekolah & Kredensial
async function loadProfile() {
    appProfile = await db.getProfile();
    if (!appProfile.nama_sekolah) {
        appProfile = {
            nama_instansi: 'PEMERINTAH PROVINSI JAMBI',
            nama_opd: 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
            nama_sekolah: 'SMAN 15 TEBO',
            npsn: '10505963',
            provinsi: 'Jambi',
            kabupaten_kota: 'Kabupaten Tebo',
            kecamatan: 'Rimbo Bujang',
            alamat: 'Jl. Padang Lamo, Wirotho Agung, Rimbo Bujang, Tebo, Jambi',
            kode_pemilik: '11',
            kode_bidang: '01',
            kode_skpd: '001',
            kode_lokasi: '11.15.09.04.01.001.10505963',
            kepala_sekolah: 'Pariyanto, S.Pd., M.Pd.',
            nip_kepala_sekolah: '19750512 200501 1 004',
            pengurus_barang: 'Pengurus Barang SMAN 15 Tebo',
            nip_pengurus_barang: '19820315 200902 1 002',
            tahun_anggaran: '2026',
            admin_username: 'admin',
            admin_password: 'admin123'
        };
        await db.saveProfile(appProfile);
    }

    const auth = await db.getAuth();
    document.querySelectorAll('#secDisplayUsername, #sidebarDisplayUsername').forEach(el => {
        if (el) el.textContent = auth.username || 'admin';
    });
    const secUserInp = document.getElementById('sec_username');
    if (secUserInp) secUserInp.value = auth.username || 'admin';
    const loginUserInp = document.getElementById('login_username');
    if (loginUserInp && !loginUserInp.value) loginUserInp.value = auth.username || 'admin';

    const defaultInstansi = `PEMERINTAH PROVINSI ${(appProfile.provinsi || 'Jambi').toUpperCase()}`;
    const curInstansi = appProfile.nama_instansi !== undefined ? appProfile.nama_instansi : defaultInstansi;
    const curOpd = appProfile.nama_opd !== undefined ? appProfile.nama_opd : 'DINAS PENDIDIKAN DAN KEBUDAYAAN';

    document.querySelectorAll('.display-nama-instansi').forEach(el => el.textContent = curInstansi || defaultInstansi);
    document.querySelectorAll('.display-nama-opd').forEach(el => {
        el.textContent = curOpd || '';
        el.style.display = curOpd ? '' : 'none';
    });
    document.querySelectorAll('.display-nama-sekolah').forEach(el => el.textContent = appProfile.nama_sekolah);
    document.querySelectorAll('.display-npsn').forEach(el => el.textContent = appProfile.npsn);
    document.querySelectorAll('.display-tahun').forEach(el => el.textContent = appProfile.tahun_anggaran || '2026');

    const inpInstansi = document.getElementById('set_nama_instansi');
    if (inpInstansi) inpInstansi.value = curInstansi;
    const inpOpd = document.getElementById('set_nama_opd');
    if (inpOpd) inpOpd.value = curOpd;

    if (!appProfile.kode_pemilik) appProfile.kode_pemilik = '11';
    if (!appProfile.kode_bidang) appProfile.kode_bidang = '01';
    if (!appProfile.kode_skpd) appProfile.kode_skpd = '001';
    if (!appProfile.kecamatan) appProfile.kecamatan = 'Rimbo Bujang';
    if (appProfile.kode_lokasi === '14.08.01.001.0001' || appProfile.kode_lokasi === '15.09.04.01.001.0001') {
        appProfile.kode_lokasi = `11.15.09.04.01.001.${appProfile.npsn || '10505963'}`;
        await db.saveProfile(appProfile);
    }

    for (const [k, v] of Object.entries(appProfile)) {
        const inp = document.getElementById(`set_${k}`);
        if (inp) inp.value = v;
    }
    loadThemeSettings();
    applyLogosToDOM();
    initSettingsWilayahSelectors();
    if (typeof loadBackupGasUrl === 'function') {
        loadBackupGasUrl();
    }
}

// 2. Ruangan
async function loadRooms() {
    allRooms = await db.getAll('ruangan');
    const selectModalRuang = document.getElementById('modal_ruangan_id');
    const selectKirFilter = document.getElementById('select_kir_ruang');
    const selectMutasiTujuan = document.getElementById('mutasi_tujuan_id');

    if (selectModalRuang) selectModalRuang.innerHTML = '';
    if (selectKirFilter) selectKirFilter.innerHTML = '';
    if (selectMutasiTujuan) selectMutasiTujuan.innerHTML = '';

    allRooms.forEach(r => {
        const opt = `<option value="${r.id}">${r.nama_ruangan} (${r.kode_ruangan})</option>`;
        if (selectModalRuang) selectModalRuang.insertAdjacentHTML('beforeend', opt);
        if (selectKirFilter) selectKirFilter.insertAdjacentHTML('beforeend', opt);
        if (selectMutasiTujuan) selectMutasiTujuan.insertAdjacentHTML('beforeend', opt);
    });

    if (allRooms.length > 0 && !currentKirRoomId) {
        currentKirRoomId = allRooms[0].id;
    }
}

// 3. Aset
async function loadAssets() {
    allAssets = await db.getAll('aset');
    populateYearFilters();
}

function populateYearFilters() {
    const yearsSet = new Set();
    const currentYear = new Date().getFullYear();
    yearsSet.add(currentYear);

    (allAssets || []).forEach(a => {
        if (a.tahun_perolehan) {
            const yr = parseInt(a.tahun_perolehan, 10);
            if (!isNaN(yr) && yr > 1900 && yr < 2100) {
                yearsSet.add(yr);
            }
        }
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

    // 1. Dropdown Filter Buku Induk
    const selBi = document.getElementById('filter_bi_tahun');
    if (selBi) {
        const curVal = selBi.value || 'Semua';
        selBi.innerHTML = '<option value="Semua">Semua Tahun</option>';
        sortedYears.forEach(yr => {
            const opt = document.createElement('option');
            opt.value = yr;
            opt.textContent = `Tahun ${yr}`;
            selBi.appendChild(opt);
        });
        if (curVal && (curVal === 'Semua' || sortedYears.includes(parseInt(curVal, 10)))) {
            selBi.value = curVal;
        }
    }

    // 2. Dropdown Filter KIB
    const selKib = document.getElementById('filter_kib_tahun');
    if (selKib) {
        const curVal = selKib.value || 'Semua';
        selKib.innerHTML = '<option value="Semua">Semua Tahun</option>';
        sortedYears.forEach(yr => {
            const opt = document.createElement('option');
            opt.value = yr;
            opt.textContent = `Tahun ${yr}`;
            selKib.appendChild(opt);
        });
        if (curVal && (curVal === 'Semua' || sortedYears.includes(parseInt(curVal, 10)))) {
            selKib.value = curVal;
        }
    }

    // 3. Dropdown Filter Laporan KIB
    const selKibLap = document.getElementById('filter_kib_laporan_tahun');
    if (selKibLap) {
        const curVal = selKibLap.value || 'Semua';
        selKibLap.innerHTML = '<option value="Semua">Semua Tahun</option>';
        sortedYears.forEach(yr => {
            const opt = document.createElement('option');
            opt.value = yr;
            opt.textContent = `Tahun ${yr}`;
            selKibLap.appendChild(opt);
        });
        if (curVal && (curVal === 'Semua' || sortedYears.includes(parseInt(curVal, 10)))) {
            selKibLap.value = curVal;
        }
    }
}

function syncKibReportFilter() {
    const selLapTahun = document.getElementById('filter_kib_laporan_tahun');
    const selLapKondisi = document.getElementById('filter_kib_laporan_kondisi');
    const inpLapSearch = document.getElementById('filter_kib_laporan_search');

    const selKibTahun = document.getElementById('filter_kib_tahun');
    const selKibKondisi = document.getElementById('filter_kib_kondisi');
    const inpKibSearch = document.getElementById('search_kib_table');

    if (selLapTahun && selKibTahun) selKibTahun.value = selLapTahun.value;
    if (selLapKondisi && selKibKondisi) selKibKondisi.value = selLapKondisi.value;
    if (inpLapSearch && inpKibSearch) inpKibSearch.value = inpLapSearch.value;

    resetTablePage('kib');
    renderKibTable();
}

function syncKibFilterToReport() {
    const selLapTahun = document.getElementById('filter_kib_laporan_tahun');
    const selLapKondisi = document.getElementById('filter_kib_laporan_kondisi');
    const inpLapSearch = document.getElementById('filter_kib_laporan_search');

    const selKibTahun = document.getElementById('filter_kib_tahun');
    const selKibKondisi = document.getElementById('filter_kib_kondisi');
    const inpKibSearch = document.getElementById('search_kib_table');

    if (selLapTahun && selKibTahun) selLapTahun.value = selKibTahun.value;
    if (selLapKondisi && selKibKondisi) selLapKondisi.value = selKibKondisi.value;
    if (inpLapSearch && inpKibSearch) inpLapSearch.value = inpKibSearch.value;

    resetTablePage('kib');
    renderKibTable();
}

// 4. BPH (Barang Pakai Habis)
async function loadBph() {
    allBph = await db.getAll('bph');
}

// 4b. Master Katalog BPH, Transaksi Masuk & Keluar
async function loadMasterBph() {
    try {
        allMasterBph = await db.getAll('master_bph');
    } catch (_) {
        allMasterBph = [];
    }
}

async function loadBphMasuk() {
    try {
        allBphMasuk = await db.getAll('bph_masuk');
    } catch (_) {
        allBphMasuk = [];
    }
}

async function loadBphKeluar() {
    try {
        allBphKeluar = await db.getAll('bph_keluar');
    } catch (_) {
        allBphKeluar = [];
    }
}

// 5. Custom Kode Barang
async function loadCustomKodeBarang() {
    try {
        customKodeBarang = await db.getAll('master_kode_barang');
    } catch (_) {
        customKodeBarang = [];
    }
}

// 6. Riwayat Usulan Penghapusan
async function loadRiwayatPenghapusan() {
    try {
        allRiwayatPenghapusan = await db.getAll('riwayat_penghapusan');
    } catch (_) {
        allRiwayatPenghapusan = [];
    }
}

function getAllKodeBarangCombined() {
    const list = [...PERMENDAGRI_KODE_BARANG];
    if (Array.isArray(customKodeBarang)) {
        customKodeBarang.forEach(c => {
            if (!list.some(x => x.kode === c.kode)) {
                list.push({ ...c, is_custom: true });
            }
        });
    }
    return list;
}

// =========================================================================
// NAVIGASI ANTAR SCREEN (LANDING, LOGIN, APP) & SIDEBAR
// =========================================================================
function showView(viewName) {
    document.querySelectorAll('.app-view').forEach(v => v.classList.add('d-none'));
    const target = document.getElementById(`view_${viewName}`);
    if (target) {
        target.classList.remove('d-none');
    }
    if (viewName === 'app') {
        updateDashboardStats();
    }
}
window.showView = showView;

function initNavigation() {
    // 1. Landing to Login
    const btnLanding = document.getElementById('btnLandingToLogin');
    if (btnLanding) {
        btnLanding.addEventListener('click', () => showView('login'));
    }

    // 2. Login Back to Landing
    const btnBack = document.getElementById('btnBackToLanding');
    if (btnBack) {
        btnBack.addEventListener('click', () => showView('landing'));
    }

    // 3. Toggle Password on Login Form
    const btnToggle = document.getElementById('btnToggleLoginPwd');
    if (btnToggle) {
        btnToggle.addEventListener('click', () => {
            const pwdInput = document.getElementById('login_password');
            const icon = document.getElementById('loginPwdEyeIcon');
            if (pwdInput.type === 'password') {
                pwdInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                pwdInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    }

    // 4. Form Login Submission (Hybrid: SQLite Offline vs Google Sheets Online)
    const formLogin = document.getElementById('formLogin');
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const u = document.getElementById('login_username').value.trim();
            const p = document.getElementById('login_password').value;
            const btnSubmit = document.getElementById('btnLoginSubmit');

            if (db.isElectron) {
                // Mode Desktop Offline: Cek kredensial dari SQLite lokal
                const auth = await db.getAuth();

                if (u === auth.username && p === auth.password) {
                    sessionStorage.setItem('sinbas_auth', 'true');
                    localStorage.setItem('sinbas_auth', 'true');
                    showView('app');
                    switchTab('dashboard');

                    Swal.fire({
                        icon: 'success',
                        title: 'Login Berhasil!',
                        text: `Selamat datang di SINBAS Hybrid Desktop (Offline), ${u}.`,
                        timer: 1600,
                        showConfirmButton: false,
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Login Gagal',
                        text: 'Username atau Password salah! Periksa kembali kredensial Anda (Bawaan: admin / admin123).',
                        confirmButtonColor: '#2563eb'
                    });
                }
            } else {
                // Mode Online Browser: Verifikasi kredensial langsung ke Google Spreadsheet via GAS
                const tenantInput = document.getElementById('login_tenant')?.value.trim() || db.getActiveTenant();

                if (btnSubmit) {
                    btnSubmit.disabled = true;
                    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Memverifikasi ke Google Sheets...';
                }

                try {
                    const loginRes = await db.loginOnline(u, p, tenantInput);

                    if (btnSubmit) {
                        btnSubmit.disabled = false;
                        btnSubmit.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i> Masuk ke Sistem';
                    }

                    if (loginRes.success) {
                        sessionStorage.setItem('sinbas_auth', 'true');
                        localStorage.setItem('sinbas_auth', 'true');

                        // Muat ulang seluruh tabel data sekolah dari cache / sync
                        await loadProfile();
                        await loadRooms();
                        await loadAssets();
                        await loadBph();
                        await loadMasterBph();
                        await loadBphMasuk();
                        await loadBphKeluar();
                        await loadCustomKodeBarang();
                        await loadRiwayatPenghapusan();
                        updateDashboardStats();
                        renderBukuIndukTable();
                        renderMasterRuanganTable();
                        renderMasterKodeBarangTable();
                        renderMasterBphTable();
                        renderKibTable();
                        renderKirView();

                        showView('app');
                        switchTab('dashboard');

                        Swal.fire({
                            icon: 'success',
                            title: 'Login Online Berhasil!',
                            text: `Terhubung ke Google Spreadsheet sekolah (${loginRes.tenant?.nama_sekolah || tenantInput}). Selamat bertugas!`,
                            timer: 2000,
                            showConfirmButton: false,
                        });
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Login Online Gagal',
                            text: loginRes.error || 'Username atau Password tidak cocok dengan data di Spreadsheet sekolah ini.',
                            confirmButtonColor: '#2563eb'
                        });
                    }
                } catch (err) {
                    if (btnSubmit) {
                        btnSubmit.disabled = false;
                        btnSubmit.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i> Masuk ke Sistem';
                    }
                    Swal.fire({
                        icon: 'error',
                        title: 'Koneksi Terganggu',
                        text: err.message || 'Gagal menghubungi server Google Apps Script. Periksa URL GAS atau koneksi internet Anda.',
                        confirmButtonColor: '#2563eb'
                    });
                }
            }
        });
    }

    // 5. Sidebar Navigation Items
    const sidebarLinks = document.querySelectorAll('.sidebar-nav-item');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = link.getAttribute('data-target');
            switchTab(targetTab);
            if (window.innerWidth <= 768) {
                toggleMobileSidebar(false);
            }
        });
    });

    // 6. Sidebar Logout
    const btnLogout = document.getElementById('btnSidebarLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            Swal.fire({
                title: 'Konfirmasi Keluar',
                text: 'Apakah Anda yakin ingin keluar dari sistem inventarisasi?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#f43f5e',
                cancelButtonColor: '#334155',
                confirmButtonText: '<i class="fas fa-sign-out-alt me-1"></i> Ya, Keluar',
                cancelButtonText: 'Batal',
                background: '#0f172a',
                color: '#ffffff'
            }).then((res) => {
                if (res.isConfirmed) {
                    sessionStorage.removeItem('sinbas_auth');
                    localStorage.removeItem('sinbas_auth');
                    showView('landing');
                    Swal.fire({
                        icon: 'info',
                        title: 'Anda telah keluar',
                        timer: 1200,
                        showConfirmButton: false,
                        background: '#0f172a',
                        color: '#ffffff'
                    });
                }
            });
        });
    }

    // 7. Sub-tab Master Data
    const masterSubLinks = document.querySelectorAll('.subtab-btn');
    masterSubLinks.forEach(btn => {
        btn.addEventListener('click', () => {
            const sub = btn.getAttribute('data-subtab');
            switchMasterSubTab(sub);
        });
    });

    // 8. Form Keamanan Akun
    const formSec = document.getElementById('formSecuritySettings');
    if (formSec) {
        formSec.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newU = document.getElementById('sec_username').value.trim();
            const curP = document.getElementById('sec_current_password').value;
            const newP = document.getElementById('sec_new_password').value;
            const confP = document.getElementById('sec_confirm_password').value;

            const auth = await db.getAuth();
            if (curP !== auth.password) {
                Swal.fire({
                    icon: 'error',
                    title: 'Password Lama Salah!',
                    text: 'Password lama yang Anda masukkan tidak cocok dengan sistem.',
                    background: '#0f172a',
                    color: '#ffffff',
                    confirmButtonColor: '#2563eb'
                });
                return;
            }

            if (newP.length < 6) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Password Terlalu Pendek',
                    text: 'Password baru minimal harus 6 karakter.',
                    background: '#0f172a',
                    color: '#ffffff',
                    confirmButtonColor: '#2563eb'
                });
                return;
            }

            if (newP !== confP) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Konfirmasi Password Tidak Cocok',
                    text: 'Password baru dan konfirmasi password harus sama.',
                    background: '#0f172a',
                    color: '#ffffff',
                    confirmButtonColor: '#2563eb'
                });
                return;
            }

            await db.saveAuth(newU, newP);

            // Update UI
            document.querySelectorAll('#secDisplayUsername, #sidebarDisplayUsername').forEach(el => el.textContent = newU);
            const loginU = document.getElementById('login_username');
            const loginP = document.getElementById('login_password');
            if (loginU) loginU.value = newU;
            if (loginP) loginP.value = newP;
            document.getElementById('sec_current_password').value = '';
            document.getElementById('sec_new_password').value = '';
            document.getElementById('sec_confirm_password').value = '';

            Swal.fire({
                icon: 'success',
                title: 'Kredensial Berhasil Diperbarui!',
                text: `Username (${newU}) dan Password baru Anda telah tersimpan secara aman di database SQLite3.`,
                background: '#0f172a',
                color: '#ffffff',
                confirmButtonColor: '#2563eb'
            });
        });
    }

    startRealtimeClock();
}


// =========================================================================
// RESPONSIVE MOBILE SIDEBAR TOGGLE
// =========================================================================
window.toggleMobileSidebar = function(force) {
    const sidebar = document.querySelector('.app-sidebar');
    const backdrop = document.getElementById('sidebarMobileBackdrop');
    if (!sidebar) return;
    const shouldOpen = typeof force === 'boolean' ? force : !sidebar.classList.contains('sidebar-mobile-open');
    if (shouldOpen) {
        sidebar.classList.add('sidebar-mobile-open');
        if (backdrop) backdrop.classList.add('show');
        document.body.style.overflow = 'hidden';
    } else {
        sidebar.classList.remove('sidebar-mobile-open');
        if (backdrop) backdrop.classList.remove('show');
        document.body.style.overflow = '';
    }
};

function switchTab(tabId) {
    // Tentukan menu sidebar utama yang aktif
    let sidebarTarget = tabId;
    if (['kir', 'label', 'laporan'].includes(tabId)) {
        sidebarTarget = 'kib';
    } else if (['sensus', 'penghapusan'].includes(tabId)) {
        sidebarTarget = 'mutasi';
    }

    document.querySelectorAll('.sidebar-nav-item').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.tab-content-pane').forEach(p => p.classList.add('d-none'));

    const activeSidebarLink = document.querySelector(`.sidebar-nav-item[data-target="${sidebarTarget}"]`);
    if (activeSidebarLink) activeSidebarLink.classList.add('active');

    const activePane = document.getElementById(`pane_${tabId}`);
    if (activePane) activePane.classList.remove('d-none');

    // Update Header Title
    const headerTitleEl = document.getElementById('pageHeaderTitle');
    const titles = {
        dashboard: 'Dashboard Aset',
        master_data: 'Master Data & Kodefikasi',
        buku_induk: 'Buku Induk Barang (NIBAR)',
        bph: 'Buku Persediaan & Riwayat Mutasi BPH',
        kib: 'Laporan KIB (A s/d F)',
        kir: 'Kartu Inventaris Ruangan (KIR)',
        label: 'Cetak Stiker Label QR Code',
        laporan: 'Pusat Unduh Inventaris Lengkap (Permendagri 47/2021)',
        mutasi: 'Riwayat Perpindahan & Mutasi Aset',
        penghapusan: 'Riwayat Usulan Penghapusan Barang Milik Daerah',
        sensus: 'Sensus Fisik / Stock Opname QR',
        settings: 'Pengaturan Sistem & Profil Sekolah'
    };
    if (headerTitleEl && titles[tabId]) {
        headerTitleEl.textContent = titles[tabId];
    }

    // Trigger specific renderers
    if (html5QrScanner && tabId !== 'sensus') {
        html5QrScanner.stop().then(() => {
            html5QrScanner.clear();
            html5QrScanner = null;
            const btn = document.getElementById('btnToggleScanner');
            if (btn) {
                btn.className = 'btn btn-sm btn-primary-custom';
                btn.innerHTML = '<i class="fas fa-camera me-1"></i> Buka Kamera Scanner';
            }
        }).catch(() => { html5QrScanner = null; });
    }

    if (tabId === 'dashboard') {
        updateDashboardStats();
    } else if (tabId === 'buku_induk') {
        renderBukuIndukTable();
    } else if (tabId === 'master_data') {
        switchMasterSubTab(currentMasterDataSubTab);
    } else if (tabId === 'bph') {
        switchBphSubTab(currentBphSubTab || 'masuk');
    } else if (tabId === 'kib') {
        renderKibTable();
    } else if (tabId === 'kir') {
        renderKirView();
    } else if (tabId === 'label') {
        renderStickersGrid();
    } else if (tabId === 'mutasi') {
        renderMutasiHistory();
    } else if (tabId === 'penghapusan') {
        renderRiwayatPenghapusan();
    }
}

function switchKibSubSection(sectionId) {
    switchTab(sectionId);
}

function switchRiwayatSubSection(sectionId) {
    switchTab(sectionId);
}

// =========================================================================
// SISTEM LOGO & TEMA GRADIEN 3 WARNA
// =========================================================================
const THEME_PRESETS = [
    {
        id: 'ocean_sapphire',
        name: 'Ocean Sapphire',
        desc: 'Biru Samudra, Langit & Toska (Bawaan)',
        c1: '#1e3a8a',
        c2: '#0284c7',
        c3: '#0d9488'
    },
    {
        id: 'emerald_aurora',
        name: 'Emerald Aurora',
        desc: 'Hijau Hutan, Zamrud & Mint Segar',
        c1: '#064e3b',
        c2: '#059669',
        c3: '#10b981'
    },
    {
        id: 'royal_violet',
        name: 'Royal Violet',
        desc: 'Indigo, Ungu Elegan & Lavender Modern',
        c1: '#312e81',
        c2: '#6366f1',
        c3: '#8b5cf6'
    },
    {
        id: 'sunset_crimson',
        name: 'Sunset Crimson',
        desc: 'Merah Marun, Rose & Jingga Senja',
        c1: '#881337',
        c2: '#e11d48',
        c3: '#f97316'
    },
    {
        id: 'twilight_slate',
        name: 'Twilight Slate',
        desc: 'Midnight Slate, Steel & Karbon Maskulin',
        c1: '#0f172a',
        c2: '#1e293b',
        c3: '#334155'
    },
    {
        id: 'marine_teal',
        name: 'Marine Teal',
        desc: 'Toska Dalam, Biru Bahari & Langit Cerah',
        c1: '#134e4a',
        c2: '#0891b2',
        c3: '#38bdf8'
    }
];

let currentThemeSettings = {
    presetId: 'ocean_sapphire',
    c1: '#1e3a8a',
    c2: '#0284c7',
    c3: '#0d9488'
};

function switchSettingsSub(sub) {
    const btnProfil = document.getElementById('btnTabSettingsProfil');
    const btnKeamanan = document.getElementById('btnTabSettingsKeamanan');
    const btnTema = document.getElementById('btnTabSettingsTema');
    const btnBackup = document.getElementById('btnTabSettingsBackup');

    const paneProfil = document.getElementById('subpane_settings_profil');
    const paneKeamanan = document.getElementById('subpane_settings_keamanan');
    const paneTema = document.getElementById('subpane_settings_tema');
    const paneBackup = document.getElementById('subpane_settings_backup');

    if (btnProfil) btnProfil.classList.toggle('active', sub === 'profil');
    if (btnKeamanan) btnKeamanan.classList.toggle('active', sub === 'keamanan');
    if (btnTema) btnTema.classList.toggle('active', sub === 'tema');
    if (btnBackup) btnBackup.classList.toggle('active', sub === 'backup');

    if (paneProfil) paneProfil.classList.toggle('d-none', sub !== 'profil');
    if (paneKeamanan) paneKeamanan.classList.toggle('d-none', sub !== 'keamanan');
    if (paneTema) paneTema.classList.toggle('d-none', sub !== 'tema');
    if (paneBackup) paneBackup.classList.toggle('d-none', sub !== 'backup');

    if (sub === 'tema') {
        initThemeSettingsUI();
    } else if (sub === 'backup') {
        loadBackupGasUrl();
    }
}

// =========================================================================
// PENGATURAN BACKUP & RESTORE DATA (LINK EXEC READONLY & COPAS)
// =========================================================================

function loadBackupGasUrl() {
    const inp = document.getElementById('backup_readonly_gas_url');
    if (!inp) return;
    const url = db.getOfflineConfigUrl() || db.getGasExecUrl() || '';
    inp.value = url;
}

function copyBackupGasUrl() {
    const inp = document.getElementById('backup_readonly_gas_url');
    const url = (inp ? inp.value.trim() : '') || db.getOfflineConfigUrl() || db.getGasExecUrl() || '';
    if (!url) {
        Swal.fire({
            icon: 'info',
            title: 'Link Belum Disetel',
            text: 'Link Google Apps Script Exec belum disetel di berkas desktop_offline/config-offline.js.'
        });
        return;
    }

    if (inp) inp.value = url;
    navigator.clipboard.writeText(url).then(() => {
        Swal.fire({
            icon: 'success',
            title: 'Link Exec Berhasil Disalin!',
            text: 'Link Google Apps Script Exec telah disalin ke papan klip.',
            timer: 1600,
            showConfirmButton: false
        });
    }).catch(() => {
        if (inp) inp.select();
        document.execCommand('copy');
        Swal.fire({
            icon: 'success',
            title: 'Link Exec Berhasil Disalin!',
            timer: 1400,
            showConfirmButton: false
        });
    });
}

/**
 * Mengekspor seluruh database lokal ke dalam berkas cadangan JSON
 */
async function exportBackupToJson() {
    try {
        Swal.fire({
            title: 'Menyiapkan Cadangan JSON...',
            text: 'Membaca seluruh basis data lokal...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const tables = [
            'ruangan',
            'aset',
            'master_bph',
            'bph_masuk',
            'bph_keluar',
            'master_kode_barang',
            'riwayat_penghapusan',
            'riwayat_mutasi',
            'riwayat_pemeliharaan',
            'sensus_log'
        ];

        const backupData = {
            app: 'SINBAS Hybrid',
            version: '1.26.10',
            exported_at: new Date().toISOString(),
            profile: await db.getProfile(),
            data: {}
        };

        let totalRecords = 0;
        for (const tbl of tables) {
            const rows = await db.getAll(tbl);
            backupData.data[tbl] = rows || [];
            totalRecords += (rows ? rows.length : 0);
        }

        const jsonStr = JSON.stringify(backupData, null, 2);
        const dateStr = new Date().toISOString().slice(0, 10);
        const schoolCode = ((backupData.profile && (backupData.profile.npsn || backupData.profile.nama_sekolah)) || 'SINBAS').replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `BACKUP_SINBAS_${schoolCode}_${dateStr}.json`;

        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        if (typeof saveAs !== 'undefined') {
            saveAs(blob, fileName);
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        Swal.fire({
            icon: 'success',
            title: 'Backup Berhasil Diunduh!',
            html: `
                <div class="text-start p-2">
                    <p class="mb-2">Berkas cadangan JSON berhasil dibuat dan diunduh:</p>
                    <ul class="small mb-2">
                        <li><b>Nama Berkas:</b> <code>${fileName}</code></li>
                        <li><b>Total Rekaman Data:</b> ${totalRecords} data</li>
                        <li><b>Profil Sekolah:</b> Disertakan</li>
                    </ul>
                    <small class="text-muted">Simpan berkas ini di tempat yang aman sebagai cadangan database offline Anda.</small>
                </div>
            `,
            confirmButtonColor: '#2563eb'
        });
    } catch (err) {
        console.error('[BackupJSON] Gagal export JSON:', err);
        Swal.fire({
            icon: 'error',
            title: 'Gagal Membuat Cadangan',
            text: err.message || 'Terjadi kesalahan saat mengekspor database ke file JSON.'
        });
    }
}

/**
 * Memicu dialog pemilihan berkas JSON untuk restore
 */
function triggerRestoreJsonFile() {
    const input = document.getElementById('inputRestoreJsonFile');
    if (input) {
        input.value = '';
        input.click();
    }
}

/**
 * Menangani dan memvalidasi file JSON yang dipilih untuk pemulihan database
 */
async function handleRestoreJsonFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const confirmRes = await Swal.fire({
        title: 'Pulihkan Database dari JSON?',
        html: `Apakah Anda yakin ingin memulihkan database dari berkas <b>${file.name}</b>?<br><br><span class="text-danger fw-bold"><i class="fas fa-exclamation-triangle"></i> Data lokal saat ini akan ditimpa dengan isi berkas cadangan ini.</span>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-file-upload me-1"></i> Ya, Pulihkan Sekarang',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#10b981'
    });

    if (!confirmRes.isConfirmed) return;

    try {
        Swal.fire({
            title: 'Memulihkan Database...',
            text: 'Membaca dan memvalidasi berkas JSON...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const text = await file.text();
        let backupData;
        try {
            backupData = JSON.parse(text);
        } catch (e) {
            throw new Error('Format berkas tidak valid. Pastikan berkas adalah file JSON cadangan SINBAS.');
        }

        if (!backupData || typeof backupData !== 'object' || (!backupData.data && !backupData.profile)) {
            throw new Error('Struktur berkas cadangan tidak sesuai standar SINBAS.');
        }

        // 1. Pulihkan Profil Sekolah
        if (backupData.profile && typeof backupData.profile === 'object') {
            await db.saveProfile(backupData.profile);
        }

        // 2. Pulihkan Tabel-tabel
        const tables = [
            'ruangan',
            'aset',
            'master_bph',
            'bph_masuk',
            'bph_keluar',
            'master_kode_barang',
            'riwayat_penghapusan',
            'riwayat_mutasi',
            'riwayat_pemeliharaan',
            'sensus_log'
        ];

        let restoredCount = 0;
        if (backupData.data && typeof backupData.data === 'object') {
            for (const tbl of tables) {
                const rows = backupData.data[tbl];
                if (Array.isArray(rows)) {
                    await db.clearTable(tbl);
                    if (rows.length > 0) {
                        await db.bulkPut(tbl, rows);
                        restoredCount += rows.length;
                    }
                }
            }
        }

        // 3. Muat Ulang Seluruh Tampilan Aplikasi
        await reloadAllAppData();

        Swal.fire({
            icon: 'success',
            title: 'Database Berhasil Dipulihkan!',
            html: `
                <div class="text-start p-2">
                    <p class="mb-2">Pemulihan dari berkas JSON berhasil diselesaikan:</p>
                    <ul class="small mb-2">
                        <li><b>Berkas:</b> <code>${file.name}</code></li>
                        <li><b>Total Rekaman Dipulihkan:</b> ${restoredCount} data</li>
                        <li><b>Profil Sekolah:</b> Diperbarui</li>
                    </ul>
                    <small class="text-success fw-semibold">Seluruh data lokal telah diperbarui dan siap digunakan.</small>
                </div>
            `,
            confirmButtonColor: '#10b981'
        });
    } catch (err) {
        console.error('[RestoreJSON] Gagal restore:', err);
        Swal.fire({
            icon: 'error',
            title: 'Gagal Memulihkan Database',
            text: err.message || 'Terjadi kesalahan saat memproses berkas cadangan JSON.'
        });
    }
}

// =========================================================================
// PENGATURAN KONEKSI CLOUD (GOOGLE APPS SCRIPT) & MULTI-TENANT
// =========================================================================

function initCloudSettingsUI() {
    const inputUrl = document.getElementById('set_gas_exec_url');
    const inputTenant = document.getElementById('set_active_tenant');
    const inputTenantLabel = document.getElementById('set_tenant_label');
    const genTenantCode = document.getElementById('gen_tenant_code');
    const platformBadge = document.getElementById('cloudPlatformBadge');
    const statusTitle = document.getElementById('cloudStatusTitle');
    const statusDesc = document.getElementById('cloudStatusDesc');

    const curUrl = db.getGasExecUrl();
    const curTenant = db.getActiveTenant();

    if (inputUrl) inputUrl.value = curUrl;
    if (inputTenant) inputTenant.value = curTenant;
    if (inputTenantLabel) inputTenantLabel.value = appProfile.nama_sekolah || curTenant;
    if (genTenantCode && !genTenantCode.value) genTenantCode.value = curTenant;

    if (db.isElectron) {
        if (platformBadge) {
            platformBadge.className = 'badge bg-primary px-3 py-2 fw-semibold';
            platformBadge.innerHTML = '<i class="fas fa-desktop me-1"></i> Desktop Native (SQLite)';
        }
        if (statusTitle) statusTitle.textContent = 'Aplikasi Berjalan di Mode Desktop (Electron SQLite)';
        if (statusDesc) statusDesc.textContent = 'Seluruh data tersimpan secara mandiri di database lokal SQLite3 tanpa memerlukan jaringan internet.';
    } else {
        if (platformBadge) {
            platformBadge.className = 'badge bg-success px-3 py-2 fw-semibold';
            platformBadge.innerHTML = '<i class="fas fa-cloud me-1"></i> Web Browser (Google Sheets)';
        }
        if (statusTitle) statusTitle.textContent = curUrl ? `Terhubung ke Google Spreadsheet (${curTenant})` : 'Koneksi Google Apps Script Belum Dikonfigurasi';
        if (statusDesc) statusDesc.textContent = curUrl ? 'Perubahan data otomatis disinkronkan ke Google Spreadsheet sekolah.' : 'Masukkan URL Web App Exec dari Google Apps Script untuk mengaktifkan sinkronisasi.';
    }

    updateGeneratedSchoolLink();
}

function updateGeneratedSchoolLink() {
    const genCode = (document.getElementById('gen_tenant_code')?.value || db.getActiveTenant() || 'sekolahA').trim();
    const genUrlInput = document.getElementById('gen_tenant_url');
    if (!genUrlInput) return;

    let baseUrl = window.location.origin + window.location.pathname;
    baseUrl = baseUrl.replace(/\/index\.html$/i, '/');
    if (!baseUrl.endsWith('/')) baseUrl += '/';

    genUrlInput.value = `${baseUrl}?id=${encodeURIComponent(genCode)}`;
}

function copyGeneratedSchoolLink() {
    const genUrlInput = document.getElementById('gen_tenant_url');
    if (!genUrlInput || !genUrlInput.value) return;

    navigator.clipboard.writeText(genUrlInput.value).then(() => {
        Swal.fire({
            icon: 'success',
            title: 'Tautan Berhasil Disalin!',
            text: 'Tautan unik sekolah telah disalin ke papan klip. Kirimkan tautan ini kepada sekolah yang bersangkutan.',
            timer: 1600,
            showConfirmButton: false
        });
    }).catch(() => {
        genUrlInput.select();
        document.execCommand('copy');
        Swal.fire({
            icon: 'success',
            title: 'Tautan Berhasil Disalin!',
            timer: 1400,
            showConfirmButton: false
        });
    });
}

function testGeneratedSchoolLink() {
    const genUrlInput = document.getElementById('gen_tenant_url');
    if (genUrlInput && genUrlInput.value) {
        window.open(genUrlInput.value, '_blank');
    }
}

async function saveCloudSettings() {
    const url = document.getElementById('set_gas_exec_url')?.value.trim();
    const tenant = document.getElementById('set_active_tenant')?.value.trim().toUpperCase();

    if (!url) {
        Swal.fire({
            icon: 'warning',
            title: 'URL Belum Diisi',
            text: 'Masukkan URL Google Apps Script Web App (Exec URL) yang valid.'
        });
        return;
    }

    db.setGasExecUrl(url);
    if (tenant) {
        db.setActiveTenant(tenant);
    }

    initCloudSettingsUI();
    initPlatformAndLoginUI();

    Swal.fire({
        icon: 'success',
        title: 'Konfigurasi Online Disimpan!',
        text: `URL Google Apps Script dan Tenant aktif (${tenant || 'DEFAULT'}) telah berhasil diperbarui di browser.`
    });
}

async function testCloudConnection() {
    const url = document.getElementById('set_gas_exec_url')?.value.trim() || db.getGasExecUrl();
    const resultBox = document.getElementById('cloudTestResultBox');
    const btn = document.getElementById('btnTestCloudConnection');

    if (!url) {
        Swal.fire({
            icon: 'warning',
            title: 'URL GAS Kosong',
            text: 'Silakan isi URL Web App Exec dari Google Apps Script terlebih dahulu.'
        });
        return;
    }

    db.setGasExecUrl(url);

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Menguji...';
    }

    if (resultBox) {
        resultBox.className = 'mb-3 p-3 rounded border alert alert-info d-block';
        resultBox.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Menghubungi endpoint Google Apps Script...';
    }

    const startTime = Date.now();
    try {
        const res = await db.callGasApi('ping');
        const latency = Date.now() - startTime;

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-plug me-1"></i> Uji Koneksi Backend';
        }

        if (res && res.success) {
            if (resultBox) {
                resultBox.className = 'mb-3 p-3 rounded border alert alert-success d-block';
                resultBox.innerHTML = `
                    <div class="fw-bold fs-6 mb-1 text-success"><i class="fas fa-check-circle me-1"></i> Koneksi Berhasil &amp; Terverifikasi!</div>
                    <div><b>Layanan:</b> ${res.app_name || 'SINBAS Hybrid GAS Gateway'} &bull; <b>Versi:</b> ${res.version || '1.0.0'}</div>
                    <div><b>Waktu Tanggap (Latency):</b> <span class="badge bg-success">${latency} ms</span> &bull; <b>Tenant Aktif:</b> <span class="badge bg-primary text-uppercase">${db.getActiveTenant()}</span></div>
                    <div class="small text-muted mt-1">${res.message || 'Server backend Google Apps Script siap digunakan.'}</div>
                `;
            }
        } else {
            throw new Error(res.error || 'Server merespon tetapi mengembalikan status gagal.');
        }
    } catch (err) {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-plug me-1"></i> Uji Koneksi Backend';
        }
        if (resultBox) {
            resultBox.className = 'mb-3 p-3 rounded border alert alert-danger d-block';
            resultBox.innerHTML = `
                <div class="fw-bold fs-6 mb-1 text-danger"><i class="fas fa-times-circle me-1"></i> Koneksi Gagal Terhubung!</div>
                <div><b>Pesan Error:</b> ${err.message}</div>
                <div class="small mt-2">
                    <b>Tips Perbaikan:</b><br>
                    1. Pastikan Anda telah melakukan Deploy sebagai <b>Web App</b> dengan akses <b>Anyone</b> (Siapa saja).<br>
                    2. Pastikan URL berakhiran <code>/exec</code>, bukan <code>/dev</code>.<br>
                    3. Periksa koneksi internet Anda.
                </div>
            `;
        }
    }
}

async function forceSyncAllFromCloud() {
    if (db.isElectron) {
        Swal.fire({
            icon: 'info',
            title: 'Mode Desktop Offline',
            text: 'Aplikasi desktop berjalan menggunakan SQLite lokal. Sinkronisasi Google Sheets dikhususkan untuk mode Online Web.'
        });
        return;
    }

    if (!db.getGasExecUrl()) {
        Swal.fire({
            icon: 'warning',
            title: 'URL Belum Dikonfigurasi',
            text: 'Masukkan URL Google Apps Script Exec terlebih dahulu sebelum melakukan sinkronisasi.'
        });
        return;
    }

    const tenant = db.getActiveTenant();
    const conf = await Swal.fire({
        icon: 'question',
        title: 'Mulai Sinkronisasi Data?',
        text: `Aplikasi akan mengunduh seluruh data terbaru dari Google Spreadsheet sekolah (${tenant}).`,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-sync-alt me-1"></i> Ya, Sinkronkan Sekarang',
        cancelButtonText: 'Batal'
    });
    if (!conf.isConfirmed) return;

    Swal.fire({
        title: 'Menyinkronkan Data...',
        text: 'Mengambil profil sekolah, ruangan, aset KIB, BPH, dan mutasi dari Google Sheets...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const syncRes = await db.syncAllFromGas();
        await loadProfile();
        await loadRooms();
        await loadAssets();
        await loadBph();
        await loadMasterBph();
        await loadBphMasuk();
        await loadBphKeluar();
        await loadCustomKodeBarang();
        await loadRiwayatPenghapusan();
        updateDashboardStats();
        renderBukuIndukTable();
        renderMasterRuanganTable();
        renderMasterKodeBarangTable();
        renderMasterBphTable();
        renderKibTable();
        renderKirView();

        Swal.fire({
            icon: 'success',
            title: 'Sinkronisasi Berhasil Sempurna!',
            text: `Berhasil memuat ${syncRes.countAset || 0} unit aset dan seluruh data sekolah dari Google Spreadsheet.`
        });
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Gagal Sinkronisasi',
            text: err.message || 'Terjadi kesalahan saat berkomunikasi dengan Google Apps Script.'
        });
    }
}

function initThemeSettingsUI() {
    renderThemePresets();
    updateThemeCustomInputs();
    updateSettingsLogoPreviews();
}

function renderThemePresets() {
    const container = document.getElementById('themePresetContainer');
    if (!container) return;

    container.innerHTML = THEME_PRESETS.map(preset => {
        const isActive = currentThemeSettings.presetId === preset.id;
        const gradStyle = `linear-gradient(135deg, ${preset.c1} 0%, ${preset.c2} 50%, ${preset.c3} 100%)`;
        return `
            <div class="theme-preset-card ${isActive ? 'active' : ''}" onclick="selectThemePreset('${preset.id}')">
                <div class="theme-gradient-strip" style="background: ${gradStyle};"></div>
                <div class="theme-color-dots">
                    <span class="theme-color-dot" style="background: ${preset.c1};" title="Warna 1: ${preset.c1}"></span>
                    <span class="theme-color-dot" style="background: ${preset.c2};" title="Warna 2: ${preset.c2}"></span>
                    <span class="theme-color-dot" style="background: ${preset.c3};" title="Warna 3: ${preset.c3}"></span>
                </div>
                <div class="theme-preset-name">${preset.name}</div>
                <div class="theme-preset-desc">${preset.desc}</div>
            </div>
        `;
    }).join('');
}

function selectThemePreset(presetId) {
    const preset = THEME_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    applyTheme(preset.c1, preset.c2, preset.c3, preset.id, true);
    renderThemePresets();
    updateThemeCustomInputs();
    SinbasNotify('Tema ' + preset.name + ' berhasil diterapkan!');
}

function updateThemeCustomInputs() {
    const inp1 = document.getElementById('customColor1');
    const inp2 = document.getElementById('customColor2');
    const inp3 = document.getElementById('customColor3');
    if (inp1) inp1.value = currentThemeSettings.c1;
    if (inp2) inp2.value = currentThemeSettings.c2;
    if (inp3) inp3.value = currentThemeSettings.c3;
    updateCustomGradientPreview();
}

function updateCustomGradientPreview() {
    const c1 = document.getElementById('customColor1')?.value || '#1e3a8a';
    const c2 = document.getElementById('customColor2')?.value || '#0284c7';
    const c3 = document.getElementById('customColor3')?.value || '#0d9488';

    const lbl1 = document.getElementById('lblColor1');
    const lbl2 = document.getElementById('lblColor2');
    const lbl3 = document.getElementById('lblColor3');
    if (lbl1) lbl1.textContent = c1;
    if (lbl2) lbl2.textContent = c2;
    if (lbl3) lbl3.textContent = c3;

    const preview = document.getElementById('customGradientPreviewBox');
    if (preview) {
        preview.style.background = `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`;
    }
}

function applyCustomTheme() {
    const c1 = document.getElementById('customColor1')?.value || '#1e3a8a';
    const c2 = document.getElementById('customColor2')?.value || '#0284c7';
    const c3 = document.getElementById('customColor3')?.value || '#0d9488';

    applyTheme(c1, c2, c3, 'custom', true);
    renderThemePresets();
    SinbasNotify('Gradien 3 warna kustom berhasil diterapkan!');
}

function applyTheme(c1, c2, c3, presetId = 'custom', saveToDb = true) {
    currentThemeSettings = { presetId, c1, c2, c3 };

    document.documentElement.style.setProperty('--theme-c1', c1);
    document.documentElement.style.setProperty('--theme-c2', c2);
    document.documentElement.style.setProperty('--theme-c3', c3);
    document.documentElement.style.setProperty('--theme-gradient', `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`);
    document.documentElement.style.setProperty('--theme-sidebar-gradient', `linear-gradient(180deg, ${c1} 0%, ${c2} 55%, ${c3} 100%)`);

    try {
        localStorage.setItem('sinbas_theme', JSON.stringify(currentThemeSettings));
    } catch (e) {
        console.warn('Gagal simpan theme ke localStorage:', e);
    }

    if (saveToDb && typeof db !== 'undefined' && db && db.saveProfile) {
        appProfile.theme_preset = presetId;
        appProfile.theme_c1 = c1;
        appProfile.theme_c2 = c2;
        appProfile.theme_c3 = c3;
        db.saveProfile(appProfile).catch(e => console.warn('Gagal simpan theme ke SQLite:', e));
    }
}

function loadThemeSettings() {
    // 1. Coba dari appProfile jika sudah ada
    if (appProfile && appProfile.theme_c1 && appProfile.theme_c2 && appProfile.theme_c3) {
        applyTheme(appProfile.theme_c1, appProfile.theme_c2, appProfile.theme_c3, appProfile.theme_preset || 'custom', false);
        return;
    }

    // 2. Coba dari localStorage
    try {
        const raw = localStorage.getItem('sinbas_theme');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.c1 && parsed.c2 && parsed.c3) {
                applyTheme(parsed.c1, parsed.c2, parsed.c3, parsed.presetId || 'custom', false);
                return;
            }
        }
    } catch (e) {}

    // 3. Default fallback
    applyTheme('#1e3a8a', '#0284c7', '#0d9488', 'ocean_sapphire', false);
}

function updateSettingsLogoPreviews() {
    const defaultNeutralLogo = 'assets/img/logo_sinbas.png';
    const daerahPrev = document.getElementById('preview_logo_daerah');
    if (daerahPrev) {
        daerahPrev.src = appProfile.logo_daerah || localStorage.getItem('sinbas_logo_daerah') || defaultNeutralLogo;
    }
    const sekolahPrev = document.getElementById('preview_logo_sekolah');
    if (sekolahPrev) {
        sekolahPrev.src = appProfile.logo_sekolah || localStorage.getItem('sinbas_logo_sekolah') || defaultNeutralLogo;
    }
}

function applyLogosToDOM() {
    const defaultNeutralLogo = 'assets/img/logo_sinbas.png';
    const daerahLogo = appProfile.logo_daerah || localStorage.getItem('sinbas_logo_daerah') || '';
    const sekolahLogo = appProfile.logo_sekolah || localStorage.getItem('sinbas_logo_sekolah') || defaultNeutralLogo;

    document.querySelectorAll('.instansi-logo').forEach(el => {
        el.src = daerahLogo || defaultNeutralLogo;
    });
    document.querySelectorAll('.sekolah-logo, .login-logo-img:last-of-type, .topbar-school-logo').forEach(el => {
        el.src = sekolahLogo || defaultNeutralLogo;
    });

    // Update school tag image on topbar
    const topbarTagImg = document.querySelector('.school-tag img');
    if (topbarTagImg) topbarTagImg.src = sekolahLogo || defaultNeutralLogo;

    updateSettingsLogoPreviews();
}

function SinbasNotify(msg, icon = 'success') {
    if (typeof Swal !== 'undefined') {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2400,
            timerProgressBar: true
        });
        Toast.fire({ icon, title: msg });
    } else {
        console.log('[SINBAS Notify]', msg);
    }
}

// =========================================================================
// FITUR POTONG LOGO MANUAL RASIO 1:1 (CANVAS CROPPER)
// =========================================================================
let currentCropTargetType = 'sekolah'; // 'daerah' atau 'sekolah'
let cropImg = new Image();
let cropX = 160;
let cropY = 160;
let cropScale = 1.0;
let cropBaseScale = 1.0;
let cropRotation = 0;
let isCropperDragging = false;
let cropperDragStartX = 0;
let cropperDragStartY = 0;
let cropperInitialized = false;

function triggerUploadLogo(type) {
    currentCropTargetType = type;
    const fileInput = document.getElementById('logoFileInput');
    if (fileInput) {
        fileInput.value = '';
        fileInput.click();
    }
}

function initCropperListeners() {
    if (cropperInitialized) return;
    cropperInitialized = true;

    const fileInput = document.getElementById('logoFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (evt) => {
                loadCropperImage(evt.target.result);
            };
            reader.readAsDataURL(file);
        });
    }

    const viewport = document.getElementById('cropperViewport');
    if (viewport) {
        // Mouse drag
        viewport.addEventListener('mousedown', (e) => {
            isCropperDragging = true;
            cropperDragStartX = e.clientX;
            cropperDragStartY = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isCropperDragging) return;
            const dx = e.clientX - cropperDragStartX;
            const dy = e.clientY - cropperDragStartY;
            cropX += dx;
            cropY += dy;
            cropperDragStartX = e.clientX;
            cropperDragStartY = e.clientY;
            drawCropper();
        });

        window.addEventListener('mouseup', () => {
            isCropperDragging = false;
        });

        // Touch drag for touchscreens
        viewport.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isCropperDragging = true;
                cropperDragStartX = e.touches[0].clientX;
                cropperDragStartY = e.touches[0].clientY;
            }
        });

        viewport.addEventListener('touchmove', (e) => {
            if (!isCropperDragging || e.touches.length !== 1) return;
            e.preventDefault();
            const dx = e.touches[0].clientX - cropperDragStartX;
            const dy = e.touches[0].clientY - cropperDragStartY;
            cropX += dx;
            cropY += dy;
            cropperDragStartX = e.touches[0].clientX;
            cropperDragStartY = e.touches[0].clientY;
            drawCropper();
        }, { passive: false });

        viewport.addEventListener('touchend', () => {
            isCropperDragging = false;
        });

        // Mouse Wheel Zoom
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
            const newScale = cropScale * zoomFactor;
            const minScale = cropBaseScale * 0.2;
            const maxScale = cropBaseScale * 4.0;
            if (newScale >= minScale && newScale <= maxScale) {
                cropScale = newScale;
                const range = document.getElementById('cropperZoomRange');
                if (range) range.value = cropScale;
                drawCropper();
            }
        }, { passive: false });
    }
}

function loadCropperImage(dataUrl) {
    initCropperListeners();

    cropImg = new Image();
    cropImg.onload = () => {
        const modalEl = document.getElementById('modalCropLogo');
        if (modalEl) {
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();
        }

        const nw = cropImg.naturalWidth || cropImg.width || 320;
        const nh = cropImg.naturalHeight || cropImg.height || 320;

        // Hitung fit scale agar menutupi jendela 320x320
        cropBaseScale = Math.max(320 / nw, 320 / nh);
        cropScale = cropBaseScale;
        cropX = 160;
        cropY = 160;
        cropRotation = 0;

        const range = document.getElementById('cropperZoomRange');
        if (range) {
            range.min = (cropBaseScale * 0.2).toFixed(4);
            range.max = (cropBaseScale * 4.0).toFixed(4);
            range.step = ((range.max - range.min) / 100).toFixed(4);
            range.value = cropScale;
        }

        setTimeout(() => {
            drawCropper();
        }, 150);
    };
    cropImg.src = dataUrl;
}

function drawCheckerboard(ctx, w, h) {
    const size = 16;
    for (let x = 0; x < w; x += size) {
        for (let y = 0; y < h; y += size) {
            ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#f8fafc' : '#e2e8f0';
            ctx.fillRect(x, y, size, size);
        }
    }
}

function drawCropper() {
    const canvas = document.getElementById('cropperCanvas');
    if (!canvas || !cropImg || !cropImg.complete) return;
    const ctx = canvas.getContext('2d');

    // 1. Background checkerboard transparan
    drawCheckerboard(ctx, 320, 320);

    // 2. Gambar yang di-transformasikan
    const nw = cropImg.naturalWidth || cropImg.width;
    const nh = cropImg.naturalHeight || cropImg.height;

    ctx.save();
    ctx.translate(cropX, cropY);
    ctx.rotate((cropRotation * Math.PI) / 180);
    ctx.scale(cropScale, cropScale);
    ctx.drawImage(cropImg, -nw / 2, -nh / 2);
    ctx.restore();

    // 3. Grid Panduan 1:1 (Rule of Thirds)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(106.6, 0); ctx.lineTo(106.6, 320);
    ctx.moveTo(213.3, 0); ctx.lineTo(213.3, 320);
    ctx.moveTo(0, 106.6); ctx.lineTo(320, 106.6);
    ctx.moveTo(0, 213.3); ctx.lineTo(320, 213.3);
    ctx.stroke();

    // Center crosshair
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.75)';
    ctx.beginPath();
    ctx.moveTo(150, 160); ctx.lineTo(170, 160);
    ctx.moveTo(160, 150); ctx.lineTo(160, 170);
    ctx.stroke();
    ctx.restore();

    // 4. Update Live Previews
    updateCropperPreviews(canvas);
}

function updateCropperPreviews(mainCanvas) {
    // Persegi 100x100
    const sqCanvas = document.getElementById('cropperPreviewSquare');
    if (sqCanvas) {
        const sCtx = sqCanvas.getContext('2d');
        sCtx.clearRect(0, 0, 100, 100);
        drawCheckerboard(sCtx, 100, 100);
        sCtx.drawImage(mainCanvas, 0, 0, 320, 320, 0, 0, 100, 100);
    }

    // Bulat 100x100
    const ciCanvas = document.getElementById('cropperPreviewCircle');
    if (ciCanvas) {
        const cCtx = ciCanvas.getContext('2d');
        cCtx.clearRect(0, 0, 100, 100);
        drawCheckerboard(cCtx, 100, 100);
        cCtx.drawImage(mainCanvas, 0, 0, 320, 320, 0, 0, 100, 100);
    }
}

function onCropperZoomChange(val) {
    cropScale = parseFloat(val);
    drawCropper();
}

function cropZoomIn() {
    const range = document.getElementById('cropperZoomRange');
    const step = (parseFloat(range?.max || 4) - parseFloat(range?.min || 0.2)) / 20;
    cropScale = Math.min(parseFloat(range?.max || 4), cropScale + step);
    if (range) range.value = cropScale;
    drawCropper();
}

function cropZoomOut() {
    const range = document.getElementById('cropperZoomRange');
    const step = (parseFloat(range?.max || 4) - parseFloat(range?.min || 0.2)) / 20;
    cropScale = Math.max(parseFloat(range?.min || 0.2), cropScale - step);
    if (range) range.value = cropScale;
    drawCropper();
}

function cropRotateRight() {
    cropRotation = (cropRotation + 90) % 360;
    drawCropper();
}

function cropResetFit() {
    cropScale = cropBaseScale;
    cropX = 160;
    cropY = 160;
    cropRotation = 0;
    const range = document.getElementById('cropperZoomRange');
    if (range) range.value = cropScale;
    drawCropper();
}

async function saveCroppedLogo() {
    if (!cropImg || !cropImg.complete) return;

    // Render ke high-resolution 512x512 Canvas 1:1
    const outCanvas = document.createElement('canvas');
    outCanvas.width = 512;
    outCanvas.height = 512;
    const oCtx = outCanvas.getContext('2d');

    const nw = cropImg.naturalWidth || cropImg.width;
    const nh = cropImg.naturalHeight || cropImg.height;
    const factor = 512 / 320;

    oCtx.save();
    oCtx.translate(cropX * factor, cropY * factor);
    oCtx.rotate((cropRotation * Math.PI) / 180);
    oCtx.scale(cropScale * factor, cropScale * factor);
    oCtx.drawImage(cropImg, -nw / 2, -nh / 2);
    oCtx.restore();

    const croppedBase64 = outCanvas.toDataURL('image/png');

    if (currentCropTargetType === 'daerah') {
        appProfile.logo_daerah = croppedBase64;
        try { localStorage.setItem('sinbas_logo_daerah', croppedBase64); } catch (e) {}
    } else {
        appProfile.logo_sekolah = croppedBase64;
        cachedLogoBase64 = croppedBase64;
        try { localStorage.setItem('sinbas_logo_sekolah', croppedBase64); } catch (e) {}
    }

    if (typeof db !== 'undefined' && db && db.saveProfile) {
        await db.saveProfile(appProfile);
    }

    applyLogosToDOM();

    const modalEl = document.getElementById('modalCropLogo');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }

    SinbasNotify(currentCropTargetType === 'daerah' 
        ? 'Logo Pemerintah Daerah berhasil dipotong 1:1 dan disimpan!' 
        : 'Logo Sekolah berhasil dipotong 1:1 dan disimpan!'
    );
}

async function resetLogoToDefault(type) {
    const isDaerah = type === 'daerah';
    const title = isDaerah ? 'Reset Logo Daerah?' : 'Reset Logo Sekolah?';
    const text = isDaerah 
        ? 'Logo Pemerintah Daerah akan direset (kembali kosong / logo SINBAS bawaan).'
        : 'Logo Satuan Pendidikan akan dikembalikan ke logo bawaan SINBAS.';

    Swal.fire({
        title,
        text,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Reset Logo',
        cancelButtonText: 'Batal'
    }).then(async (res) => {
        if (res.isConfirmed) {
            if (isDaerah) {
                appProfile.logo_daerah = '';
                delete appProfile.logo_daerah;
                try { localStorage.removeItem('sinbas_logo_daerah'); } catch (e) {}
            } else {
                appProfile.logo_sekolah = 'assets/img/logo_sinbas.png';
                cachedLogoBase64 = null;
                try { localStorage.removeItem('sinbas_logo_sekolah'); } catch (e) {}
            }

            if (typeof db !== 'undefined' && db && db.saveProfile) {
                await db.saveProfile(appProfile);
            }

            applyLogosToDOM();
            SinbasNotify('Logo berhasil direset ke logo bawaan SINBAS!');
        }
    });
}

function toggleSecPassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    } else {
        input.type = 'password';
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
}

async function resetDefaultCredentials() {
    Swal.fire({
        title: 'Reset Kredensial?',
        text: 'Kredensial login akan dikembalikan ke username "admin" dan password "admin123". Lanjutkan?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#334155',
        confirmButtonText: 'Ya, Reset Kredensial',
        cancelButtonText: 'Batal',
        background: '#0f172a',
        color: '#ffffff'
    }).then(async (res) => {
        if (res.isConfirmed) {
            await db.saveAuth('admin', 'admin123');
            document.querySelectorAll('#secDisplayUsername, #sidebarDisplayUsername').forEach(el => el.textContent = 'admin');
            const secU = document.getElementById('sec_username');
            const loginU = document.getElementById('login_username');
            const loginP = document.getElementById('login_password');
            if (secU) secU.value = 'admin';
            if (loginU) loginU.value = 'admin';
            if (loginP) loginP.value = 'admin123';
            document.getElementById('sec_current_password').value = '';
            document.getElementById('sec_new_password').value = '';
            document.getElementById('sec_confirm_password').value = '';

            Swal.fire({
                icon: 'success',
                title: 'Berhasil Direset',
                text: 'Username sekarang "admin" dan password "admin123".',
                timer: 1500,
                showConfirmButton: false,
                background: '#0f172a',
                color: '#ffffff'
            });
        }
    });
}

function startRealtimeClock() {
    const el = document.getElementById('realtimeClock');
    if (!el) return;
    const update = () => {
        const now = new Date();
        const optionsDate = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
        const dateStr = now.toLocaleDateString('id-ID', optionsDate);
        const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        el.textContent = `${dateStr} • ${timeStr} WIB`;
    };
    update();
    setInterval(update, 1000);
}

function switchMasterSubTab(subTabId) {
    currentMasterDataSubTab = subTabId;
    document.querySelectorAll('.subtab-btn').forEach(b => {
        if (b.getAttribute('data-subtab') === subTabId) b.classList.add('active');
        else b.classList.remove('active');
    });

    document.querySelectorAll('.master-subpane').forEach(p => p.classList.add('d-none'));
    const target = document.getElementById(`subpane_${subTabId}`);
    if (target) target.classList.remove('d-none');

    if (subTabId === 'ruangan') renderMasterRuanganTable();
    else if (subTabId === 'kode_barang') renderMasterKodeBarangTable();
    else if (subTabId === 'bph') renderMasterBphTable();
}

// =========================================================================
// DASHBOARD & STATISTIK
// =========================================================================
async function updateDashboardStats() {
    const stats = await db.getStats();

    const elUnit = document.getElementById('stat_total_unit');
    if (elUnit) elUnit.textContent = (stats.total_unit || 0).toLocaleString('id-ID');
    const elNilai = document.getElementById('stat_total_nilai');
    if (elNilai) elNilai.textContent = 'Rp ' + (stats.total_nilai || 0).toLocaleString('id-ID');
    const elRuang = document.getElementById('stat_total_ruangan');
    if (elRuang) elRuang.textContent = (stats.total_ruangan || allRooms.length || 0).toLocaleString('id-ID');

    let baik = 0, rusakRingan = 0, rusakBerat = 0;
    allAssets.forEach(a => {
        if (a.kondisi === 'Baik') baik++;
        else if (a.kondisi === 'Rusak Ringan') rusakRingan++;
        else if (a.kondisi === 'Rusak Berat') rusakBerat++;
    });

    const elBaik = document.getElementById('stat_kondisi_baik');
    if (elBaik) elBaik.textContent = baik;
    const elRusak = document.getElementById('stat_kondisi_rusak');
    if (elRusak) elRusak.textContent = rusakRingan + rusakBerat;

    renderCharts(stats, baik, rusakRingan, rusakBerat);
}

function renderCharts(stats, baik, rr, rb) {
    if (typeof Chart === 'undefined') return;

    const kibMap = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    allAssets.forEach(a => {
        const val = Number(a.nilai_total || a.harga_satuan) || 0;
        kibMap[a.kib_type] = (kibMap[a.kib_type] || 0) + val;
    });

    const ctxKib = document.getElementById('chartKib');
    if (ctxKib) {
        if (kibChart) kibChart.destroy();
        kibChart = new Chart(ctxKib, {
            type: 'bar',
            data: {
                labels: ['KIB A (Tanah)', 'KIB B (Peralatan)', 'KIB C (Gedung)', 'KIB D (Jaringan)', 'KIB E (Buku/Lain)', 'KIB F (KDP)'],
                datasets: [{
                    label: 'Nilai Aset (Rp)',
                    data: [kibMap.A, kibMap.B, kibMap.C, kibMap.D, kibMap.E, kibMap.F],
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.75)',
                        'rgba(0, 242, 254, 0.75)',
                        'rgba(16, 185, 129, 0.75)',
                        'rgba(245, 158, 11, 0.75)',
                        'rgba(139, 92, 246, 0.75)',
                        'rgba(244, 63, 94, 0.75)'
                    ],
                    borderColor: '#38bdf8',
                    borderWidth: 1,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
                    y: {
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 10 },
                            callback: (v) => 'Rp ' + (v >= 1e6 ? (v / 1e6).toFixed(0) + ' Jt' : v)
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    }
                }
            }
        });
    }

    const ctxKondisi = document.getElementById('chartKondisi');
    if (ctxKondisi) {
        if (kondisiChart) kondisiChart.destroy();
        kondisiChart = new Chart(ctxKondisi, {
            type: 'doughnut',
            data: {
                labels: ['Baik', 'Rusak Ringan', 'Rusak Berat'],
                datasets: [{
                    data: [baik, rr, rb],
                    backgroundColor: ['#10b981', '#f59e0b', '#f43f5e'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#cbd5e1', font: { size: 11 } } }
                },
                cutout: '68%'
            }
        });
    }
}

// =========================================================================
// MENU 1: BUKU INDUK BARANG (TABEL PENGADAAN TERPADU & RINCIAN UNIT)
// =========================================================================
function getAssetBatches(assetList) {
    const batchMap = new Map();
    assetList.forEach(ast => {
        let bId = ast.batch_id;
        if (!bId) {
            const m = ast.id && String(ast.id).match(/^(AST-\d+)/);
            bId = m ? m[1] : ast.id;
        }
        if (!batchMap.has(bId)) {
            batchMap.set(bId, []);
        }
        batchMap.get(bId).push(ast);
    });

    const batches = [];
    batchMap.forEach((units, batchId) => {
        units.sort((a, b) => (parseInt(a.no_register, 10) || 0) - (parseInt(b.no_register, 10) || 0));
        const firstUnit = units[0];
        const lastUnit = units[units.length - 1];
        const totalQty = units.reduce((acc, u) => acc + (u.jumlah || 1), 0);
        const totalNilai = units.reduce((acc, u) => acc + (Number(u.nilai_total || u.harga_satuan) || 0), 0);

        const baikCount = units.filter(u => u.kondisi === 'Baik' && u.status_aset !== 'Usulan Penghapusan').length;
        const rrCount = units.filter(u => u.kondisi === 'Rusak Ringan' && u.status_aset !== 'Usulan Penghapusan').length;
        const rbCount = units.filter(u => u.kondisi === 'Rusak Berat' && u.status_aset !== 'Usulan Penghapusan').length;
        const hpsCount = units.filter(u => u.status_aset === 'Usulan Penghapusan').length;

        const uniqueRooms = [...new Set(units.map(u => u.ruangan_nama).filter(Boolean))];
        const roomDisplay = uniqueRooms.length === 1 ? uniqueRooms[0] : (uniqueRooms.length > 1 ? `${uniqueRooms.length} Ruangan Berbeda` : '-');
        const baseSpek = (firstUnit.spesifikasi_nama || firstUnit.nama_barang || '').replace(/\s*\(Unit\s*#?\d+\)$/i, '');

        batches.push({
            batch_id: batchId,
            first_id: firstUnit.id,
            kib_type: firstUnit.kib_type,
            kode_barang: firstUnit.kode_barang,
            nama_barang: firstUnit.nama_barang,
            spesifikasi_nama: baseSpek,
            merk_tipe: firstUnit.merk_tipe,
            no_pabrik_seri: units.length > 1 ? `${firstUnit.no_pabrik_seri || '-'} s/d ${lastUnit.no_pabrik_seri || '-'}` : (firstUnit.no_pabrik_seri || '-'),
            tahun_perolehan: firstUnit.tahun_perolehan,
            tanggal_perolehan: firstUnit.tanggal_perolehan,
            asal_usul: firstUnit.asal_usul,
            harga_satuan: firstUnit.harga_satuan,
            total_nilai: totalNilai,
            total_qty: totalQty,
            satuan: firstUnit.satuan || 'Unit',
            reg_start: firstUnit.no_register,
            reg_end: (units.length === 1 && totalQty > 1) 
                ? String((parseInt(firstUnit.no_register, 10) || 1) + totalQty - 1).padStart(5, '0') 
                : lastUnit.no_register,
            nibar_start: firstUnit.nibar,
            nibar_end: (units.length === 1 && totalQty > 1)
                ? (typeof NibarGenerator !== 'undefined' 
                    ? NibarGenerator.buildNibar(appProfile.npsn || '10505963', firstUnit.kode_barang, firstUnit.tahun_perolehan, String((parseInt(firstUnit.no_register, 10) || 1) + totalQty - 1).padStart(5, '0'))
                    : `${appProfile.npsn || '10505963'}-${firstUnit.kode_barang}-${firstUnit.tahun_perolehan}-${String((parseInt(firstUnit.no_register, 10) || 1) + totalQty - 1).padStart(5, '0')}`)
                : lastUnit.nibar,
            room_display: roomDisplay,
            baik_count: baikCount,
            rr_count: rrCount,
            rb_count: rbCount,
            hps_count: hpsCount,
            units: units
        });
    });
    return batches;
}

function getFilteredBukuIndukAssets() {
    let filtered = [...allAssets];

    const paneLap = document.getElementById('pane_laporan');
    const isPaneLap = paneLap && !paneLap.classList.contains('d-none');

    // Filter KIB
    const filterKib = isPaneLap ? 'Semua' : (document.getElementById('filter_bi_kib')?.value || 'Semua');
    if (filterKib !== 'Semua') {
        filtered = filtered.filter(a => a.kib_type === filterKib);
    }

    // Filter Kondisi
    const filterKondisi = isPaneLap
        ? (document.getElementById('filter_kib_laporan_kondisi')?.value || 'Semua')
        : (document.getElementById('filter_bi_kondisi')?.value || 'Semua');
    if (filterKondisi !== 'Semua') {
        filtered = filtered.filter(a => a.kondisi === filterKondisi);
    }

    // Filter Tahun Perolehan
    const filterTahun = isPaneLap
        ? (document.getElementById('filter_kib_laporan_tahun')?.value || 'Semua')
        : (document.getElementById('filter_bi_tahun')?.value || 'Semua');
    if (filterTahun !== 'Semua') {
        filtered = filtered.filter(a => String(a.tahun_perolehan) === String(filterTahun));
    }

    // Filter Search
    const searchTxt = (isPaneLap
        ? (document.getElementById('filter_kib_laporan_search')?.value || '')
        : (document.getElementById('search_bi_table')?.value || '')
    ).toLowerCase().trim();
    if (searchTxt) {
        filtered = filtered.filter(a =>
            (a.nibar && a.nibar.toLowerCase().includes(searchTxt)) ||
            (a.kode_barang && a.kode_barang.toLowerCase().includes(searchTxt)) ||
            (a.nama_barang && a.nama_barang.toLowerCase().includes(searchTxt)) ||
            (a.spesifikasi_nama && a.spesifikasi_nama.toLowerCase().includes(searchTxt)) ||
            (a.merk_tipe && a.merk_tipe.toLowerCase().includes(searchTxt)) ||
            (a.ruangan_nama && a.ruangan_nama.toLowerCase().includes(searchTxt))
        );
    }

    return filtered;
}

function renderBukuIndukTable() {
    const tbody = document.getElementById('bukuIndukTableBody');
    if (!tbody) return;

    const filtered = getFilteredBukuIndukAssets();

    const batches = getAssetBatches(filtered);
    const totalItems = batches.length;

    tbody.innerHTML = '';
    if (batches.length === 0) {
        renderTablePagination('buku_induk', 0);
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted"><i class="fas fa-inbox fa-2x mb-2 d-block"></i>Belum ada data barang di Buku Induk. Klik tombol "+ Tambah Barang" di atas.</td></tr>';
        return;
    }

    renderTablePagination('buku_induk', totalItems);
    const pState = tablePagination.buku_induk;
    const startIdx = (pState.page - 1) * pState.perPage;
    const pagedBatches = batches.slice(startIdx, startIdx + pState.perPage);

    pagedBatches.forEach((batch, idx) => {
        let kondisiBadges = '';
        if (batch.baik_count > 0) kondisiBadges += `<span class="badge-kondisi-b me-1">${batch.baik_count} Baik</span>`;
        if (batch.rr_count > 0) kondisiBadges += `<span class="badge-kondisi-rr me-1">${batch.rr_count} Rusak Ringan</span>`;
        if (batch.rb_count > 0) kondisiBadges += `<span class="badge-kondisi-rb me-1">${batch.rb_count} Rusak Berat</span>`;
        if (batch.hps_count > 0) kondisiBadges += `<span class="badge bg-danger bg-opacity-75 me-1"><i class="fas fa-trash-alt me-1"></i>${batch.hps_count} Usul Hapus</span>`;

        const allInHps = batch.hps_count > 0 && batch.hps_count === batch.total_qty;
        const tr = document.createElement('tr');
        if (allInHps) {
            tr.className = 'table-secondary row-aset-penghapusan';
            tr.style.cssText = 'background-color: #f1f5f9 !important; color: #64748b !important; opacity: 0.85;';
        }
        tr.innerHTML = `
            <td class="text-center">${startIdx + idx + 1}</td>
            <td class="text-center"><span class="badge bg-primary px-2 py-1">KIB ${batch.kib_type}</span></td>
            <td>
                <span class="badge-kode font-monospace fw-bold">${batch.kode_barang}</span>
            </td>
            <td>
                <div class="fw-bold text-dark">${batch.spesifikasi_nama}</div>
                ${batch.merk_tipe ? `<small class="text-muted"><i class="fas fa-tag me-1 text-secondary"></i>${batch.merk_tipe}</small>` : ''}
            </td>
            <td>
                <div class="fw-bold font-monospace text-dark"><i class="far fa-calendar-alt text-primary me-1"></i>${batch.tahun_perolehan}</div>
                <small class="badge bg-light text-secondary border mt-1">${batch.asal_usul || 'BOS Reguler'}</small>
            </td>
            <td class="text-center text-dark"><span class="fw-semibold">${batch.total_qty}</span> <small class="text-muted">${batch.satuan}</small></td>
            <td class="text-end fw-bold text-primary">Rp ${batch.total_nilai.toLocaleString('id-ID')}</td>
            <td class="text-center text-nowrap">${kondisiBadges}</td>
            <td class="text-center text-nowrap">
                <div class="btn-group btn-group-sm text-nowrap">
                    <button class="btn btn-sm btn-primary" title="Lihat Rincian Unit (${batch.total_qty} Unit)" onclick="openDetailBatchAset('${batch.batch_id}')">
                        <i class="fas fa-list-ol"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-primary" title="Cetak Semua Stiker QR (${batch.total_qty} Unit) - Kertas A4 / PDF" onclick="printBatchLabelsA4('${batch.batch_id}')">
                        <i class="fas fa-qrcode"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" ${allInHps ? 'disabled title="Dalam proses usulan penghapusan (Readonly)"' : `title="Edit Data Pengadaan" onclick="openModalEditAset('${batch.first_id}')"`}>
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" title="Hapus Seluruh Pengadaan" onclick="deleteBatchAset('${batch.batch_id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ATUR STATUS READONLY MODAL ASET
function setModalAsetReadOnly(isReadOnly) {
    const form = document.getElementById('formModalAset');
    if (!form) return;

    // Disabled / Enable seluruh field formulir
    const inputs = form.querySelectorAll('input:not([type="hidden"]), select, textarea');
    inputs.forEach(el => {
        el.disabled = isReadOnly;
    });

    // Sembunyikan tombol Simpan pada mode readonly
    const submitBtn = document.getElementById('btnSubmitModalAset');
    if (submitBtn) {
        submitBtn.style.display = isReadOnly ? 'none' : '';
    }

    // Ubah teks & gaya tombol Batal / Tutup
    const cancelBtn = document.getElementById('btnCancelModalAset');
    if (cancelBtn) {
        cancelBtn.innerHTML = isReadOnly ? '<i class="fas fa-times me-1"></i> Tutup' : '<i class="fas fa-times me-1"></i> Batal';
        if (isReadOnly) {
            cancelBtn.className = 'btn btn-secondary px-4 fw-semibold';
        } else {
            cancelBtn.className = 'btn-outline-custom';
        }
    }

    // Tampilkan / Sembunyikan notice banner mode readonly
    const noticeEl = document.getElementById('modalViewAsetNotice');
    if (noticeEl) {
        noticeEl.classList.toggle('d-none', !isReadOnly);
    }
}

// BUKA MODAL TAMBAH ASET (MODAL POPUP)
function openModalTambahAset() {
    setModalAsetReadOnly(false);
    const form = document.getElementById('formModalAset');
    if (form) form.reset();

    document.getElementById('modal_aset_mode').value = 'add';
    document.getElementById('modal_aset_id').value = '';
    document.getElementById('modalAsetTitle').innerHTML = '<i class="fas fa-plus-circle text-cyan me-2"></i>Tambah Aset Barang Baru (Buku Induk)';
    document.getElementById('container_batch_qty').classList.remove('d-none');

    // Reset dropdown bertingkat
    const selJenis = document.getElementById('modal_step_jenis');
    if (selJenis) selJenis.value = '';
    onAsetModalJenisChanged('');

    // Default dates & rooms
    document.getElementById('modal_tahun_perolehan').value = appProfile.tahun_anggaran || '2026';
    document.getElementById('modal_tanggal_perolehan').value = new Date().toISOString().split('T')[0];

    updateModalNibarPreview();

    const modal = new bootstrap.Modal(document.getElementById('modalFormAset'));
    modal.show();
}

// BUKA MODAL EDIT ASET
function openModalEditAset(asetId) {
    setModalAsetReadOnly(false);
    const ast = allAssets.find(a => a.id === asetId);
    if (!ast) return;

    document.getElementById('modal_aset_mode').value = 'edit';
    document.getElementById('modal_aset_id').value = ast.id;
    document.getElementById('modalAsetTitle').innerHTML = '<i class="fas fa-edit text-warning me-2"></i>Edit Data Aset Barang';
    document.getElementById('container_batch_qty').classList.add('d-none'); // Pada edit, unit individual

    document.getElementById('modal_kib_type').value = ast.kib_type;

    // Populate Fields
    document.getElementById('modal_spesifikasi_nama').value = ast.spesifikasi_nama || ast.nama_barang;
    document.getElementById('modal_merk_tipe').value = ast.merk_tipe || '';
    document.getElementById('modal_no_pabrik_seri').value = ast.no_pabrik_seri || '';
    const selAsal = document.getElementById('modal_asal_usul');
    if (ast.asal_usul) {
        let hasOpt = Array.from(selAsal.options).some(o => o.value === ast.asal_usul);
        if (!hasOpt) {
            selAsal.add(new Option(ast.asal_usul, ast.asal_usul, true, true));
        }
        selAsal.value = ast.asal_usul;
    } else {
        selAsal.value = 'BOS Reguler';
    }
    document.getElementById('modal_tanggal_perolehan').value = ast.tanggal_perolehan;
    document.getElementById('modal_kondisi').value = ast.kondisi;
    document.getElementById('modal_ruangan_id').value = ast.ruangan_id;
    document.getElementById('modal_satuan').value = ast.satuan;
    document.getElementById('modal_harga_satuan').value = ast.harga_satuan;
    document.getElementById('modal_jumlah').value = ast.jumlah || 1;
    document.getElementById('modal_nilai_total').value = ast.nilai_total;
    document.getElementById('modal_keterangan').value = ast.keterangan || '';

    // Cascade 5 levels from ast.kode_barang
    const parts = (ast.kode_barang || '').split('.');
    if (parts.length >= 7) {
        const j = parts.slice(0, 3).join('.');
        const o = parts.slice(0, 4).join('.');
        const r = parts.slice(0, 5).join('.');
        const sr = parts.slice(0, 6).join('.');
        setAsetModalCascade(j, o, r, sr, ast.kode_barang);
    } else {
        document.getElementById('modal_kode_barang').value = ast.kode_barang;
        document.getElementById('modal_nama_barang').value = ast.nama_barang;
    }

    // Data Khusus
    const k = SinbasExcelExporter.parseKhusus(ast.data_khusus);
    if (ast.kib_type === 'A') {
        if (document.getElementById('kiba_luas')) document.getElementById('kiba_luas').value = k.luas_m2 || '';
        if (document.getElementById('kiba_hak')) document.getElementById('kiba_hak').value = k.status_hak || 'Hak Pakai';
        if (document.getElementById('kiba_nosertifikat')) document.getElementById('kiba_nosertifikat').value = k.no_sertifikat || '';
        if (document.getElementById('kiba_tglsertifikat')) document.getElementById('kiba_tglsertifikat').value = k.tgl_sertifikat || '';
        if (document.getElementById('kiba_alamat')) document.getElementById('kiba_alamat').value = k.alamat_letak || '';
        if (document.getElementById('kiba_penggunaan')) document.getElementById('kiba_penggunaan').value = k.penggunaan || '';
    } else if (ast.kib_type === 'B') {
        if (document.getElementById('kibb_cc_ukuran')) document.getElementById('kibb_cc_ukuran').value = k.cc_ukuran || '';
        if (document.getElementById('kibb_no_mesin')) document.getElementById('kibb_no_mesin').value = k.no_mesin || '';
        if (document.getElementById('kibb_no_polisi')) document.getElementById('kibb_no_polisi').value = k.no_polisi || '';
        if (document.getElementById('kibb_no_bpkb')) document.getElementById('kibb_no_bpkb').value = k.no_bpkb || '';
    } else if (ast.kib_type === 'C') {
        if (document.getElementById('kibc_luas_lantai')) document.getElementById('kibc_luas_lantai').value = k.luas_lantai || '';
        if (document.getElementById('kibc_bertingkat')) document.getElementById('kibc_bertingkat').value = k.konstruksi_bertingkat || 'Tidak';
        if (document.getElementById('kibc_beton')) document.getElementById('kibc_beton').value = k.konstruksi_beton || 'Beton';
        if (document.getElementById('kibc_nodokumen')) document.getElementById('kibc_nodokumen').value = k.no_dokumen_gedung || '';
        if (document.getElementById('kibc_tgldokumen')) document.getElementById('kibc_tgldokumen').value = k.tgl_dokumen_gedung || '';
        if (document.getElementById('kibc_luas_tanah')) document.getElementById('kibc_luas_tanah').value = k.luas_tanah_m2 || '';
        if (document.getElementById('kibc_kode_tanah')) document.getElementById('kibc_kode_tanah').value = k.kode_tanah || '1.3.1.01.01.01.001';
    } else if (ast.kib_type === 'D') {
        if (document.getElementById('kibd_konstruksi')) document.getElementById('kibd_konstruksi').value = k.konstruksi || '';
        if (document.getElementById('kibd_panjang')) document.getElementById('kibd_panjang').value = k.panjang_km || '';
        if (document.getElementById('kibd_nodok')) document.getElementById('kibd_nodok').value = k.no_dokumen || '';
    } else if (ast.kib_type === 'E') {
        if (document.getElementById('kibe_judul_pencipta')) document.getElementById('kibe_judul_pencipta').value = k.judul_pencipta || '';
        if (document.getElementById('kibe_kegunaan')) document.getElementById('kibe_kegunaan').value = k.kegunaan || '';
        if (document.getElementById('kibe_ukuran_volume')) document.getElementById('kibe_ukuran_volume').value = k.ukuran_volume || '';
    } else if (ast.kib_type === 'F') {
        if (document.getElementById('kibf_luas_rencana')) document.getElementById('kibf_luas_rencana').value = k.luas_rencana || '';
        if (document.getElementById('kibf_no_spk')) document.getElementById('kibf_no_spk').value = k.no_spk || '';
        if (document.getElementById('kibf_persen_fisik')) document.getElementById('kibf_persen_fisik').value = k.persen_fisik || '50';
    }

    // Set preview NIBAR
    document.getElementById('modal_preview_nibar').textContent = ast.nibar;
    document.getElementById('modal_preview_register').textContent = ast.no_register;

    const modal = new bootstrap.Modal(document.getElementById('modalFormAset'));
    modal.show();
}

// BUKA MODAL LIHAT RINCIAN ASET (READONLY)
function openModalViewAset(asetId) {
    let ast = (allAssets || []).find(a => a.id === asetId);
    if (!ast && typeof allRiwayatPenghapusan !== 'undefined') {
        ast = allRiwayatPenghapusan.find(a => a.id === asetId);
    }
    if (!ast) return;

    // Muat data form menggunakan fungsi edit
    openModalEditAset(ast.id);

    // Ubah ke mode view / readonly
    document.getElementById('modal_aset_mode').value = 'view';
    document.getElementById('modalAsetTitle').innerHTML = `<i class="fas fa-eye text-primary me-2"></i>Rincian Data Aset — KIB ${ast.kib_type || '-'}`;

    setModalAsetReadOnly(true);
}
window.openModalViewAset = openModalViewAset;

// =========================================================================
// SISTEM KODEFIKASI BERTINGKAT (5 TINGKAT) MODAL ASET BUKU INDUK
// Permendagri 108/2016: Jenis (1.3.x) -> Objek (1.3.x.xx) -> Rincian (1.3.x.xx.xx)
// -> Sub Rincian (1.3.x.xx.xx.xx) -> Barang Akhir (1.3.x.xx.xx.xx.xxx)
// =========================================================================

function initAsetModalCascadingSelectors() {
    const selJenis = document.getElementById('modal_step_jenis');
    const selObjek = document.getElementById('modal_step_objek');
    const selRincian = document.getElementById('modal_step_rincian');
    const selSubRincian = document.getElementById('modal_step_sub_rincian');
    const selBarang = document.getElementById('modal_step_barang');

    if (!selJenis) return;

    // 1. Populate Jenis Aset
    selJenis.innerHTML = '<option value="">-- Pilih Jenis Aset / KIB --</option>';
    if (typeof PERMENDAGRI_JENIS !== 'undefined') {
        PERMENDAGRI_JENIS.forEach(j => {
            const opt = document.createElement('option');
            opt.value = j.kode;
            opt.setAttribute('data-kib', j.kib);
            opt.setAttribute('data-nama', j.nama);
            opt.textContent = `${j.kode} — ${j.nama} (KIB ${j.kib})`;
            selJenis.appendChild(opt);
        });
    }

    selJenis.addEventListener('change', () => onAsetModalJenisChanged(selJenis.value));
    if (selObjek) selObjek.addEventListener('change', () => onAsetModalObjekChanged(selObjek.value));
    if (selRincian) selRincian.addEventListener('change', () => onAsetModalRincianChanged(selRincian.value));
    if (selSubRincian) selSubRincian.addEventListener('change', () => onAsetModalSubRincianChanged(selSubRincian.value));
    if (selBarang) selBarang.addEventListener('change', () => onAsetModalBarangChanged(selBarang.value));
}

function onAsetModalJenisChanged(jenisKode) {
    const selJenis = document.getElementById('modal_step_jenis');
    const selObjek = document.getElementById('modal_step_objek');
    const selRincian = document.getElementById('modal_step_rincian');
    const selSubRincian = document.getElementById('modal_step_sub_rincian');
    const selBarang = document.getElementById('modal_step_barang');
    const kibTypeInp = document.getElementById('modal_kib_type');

    if (selObjek) {
        selObjek.innerHTML = '<option value="">-- Pilih Objek --</option>';
        selObjek.disabled = true;
    }
    if (selRincian) {
        selRincian.innerHTML = '<option value="">-- Pilih Rincian --</option>';
        selRincian.disabled = true;
    }
    if (selSubRincian) {
        selSubRincian.innerHTML = '<option value="">-- Pilih Sub Rincian --</option>';
        selSubRincian.disabled = true;
    }
    if (selBarang) {
        selBarang.innerHTML = '<option value="">-- Pilih Barang Akhir --</option>';
        selBarang.disabled = true;
    }

    document.getElementById('modal_kode_barang').value = '';
    document.getElementById('modal_nama_barang').value = '';

    if (!jenisKode) {
        updateModalNibarPreview();
        return;
    }

    const selectedOpt = selJenis.options[selJenis.selectedIndex];
    const kib = selectedOpt ? selectedOpt.getAttribute('data-kib') : 'B';
    if (kibTypeInp) kibTypeInp.value = kib;
    adjustModalKibDynamicFields(kib);

    if (typeof PERMENDAGRI_OBJEK !== 'undefined' && selObjek) {
        const filteredObjek = PERMENDAGRI_OBJEK.filter(o => o.p === jenisKode);
        filteredObjek.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.k;
            opt.setAttribute('data-nama', o.n);
            opt.textContent = `${o.k} — ${o.n}`;
            selObjek.appendChild(opt);
        });
        selObjek.disabled = false;
    }

    updateModalNibarPreview();
}

function onAsetModalObjekChanged(objekKode) {
    const selRincian = document.getElementById('modal_step_rincian');
    const selSubRincian = document.getElementById('modal_step_sub_rincian');
    const selBarang = document.getElementById('modal_step_barang');

    if (selRincian) {
        selRincian.innerHTML = '<option value="">-- Pilih Rincian --</option>';
        selRincian.disabled = true;
    }
    if (selSubRincian) {
        selSubRincian.innerHTML = '<option value="">-- Pilih Sub Rincian --</option>';
        selSubRincian.disabled = true;
    }
    if (selBarang) {
        selBarang.innerHTML = '<option value="">-- Pilih Barang Akhir --</option>';
        selBarang.disabled = true;
    }

    document.getElementById('modal_kode_barang').value = '';
    document.getElementById('modal_nama_barang').value = '';

    if (!objekKode) {
        updateModalNibarPreview();
        return;
    }

    if (typeof PERMENDAGRI_RINCIAN !== 'undefined' && selRincian) {
        const filteredRincian = PERMENDAGRI_RINCIAN.filter(r => r.p === objekKode);
        filteredRincian.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.k;
            opt.setAttribute('data-nama', r.n);
            opt.textContent = `${r.k} — ${r.n}`;
            selRincian.appendChild(opt);
        });
        selRincian.disabled = false;
    }

    updateModalNibarPreview();
}

function onAsetModalRincianChanged(rincianKode) {
    const selSubRincian = document.getElementById('modal_step_sub_rincian');
    const selBarang = document.getElementById('modal_step_barang');

    if (selSubRincian) {
        selSubRincian.innerHTML = '<option value="">-- Pilih Sub Rincian --</option>';
        selSubRincian.disabled = true;
    }
    if (selBarang) {
        selBarang.innerHTML = '<option value="">-- Pilih Barang Akhir --</option>';
        selBarang.disabled = true;
    }

    document.getElementById('modal_kode_barang').value = '';
    document.getElementById('modal_nama_barang').value = '';

    if (!rincianKode) {
        updateModalNibarPreview();
        return;
    }

    if (typeof PERMENDAGRI_SUB_RINCIAN !== 'undefined' && selSubRincian) {
        const filteredSub = PERMENDAGRI_SUB_RINCIAN.filter(sr => sr.p === rincianKode);
        filteredSub.forEach(sr => {
            const opt = document.createElement('option');
            opt.value = sr.k;
            opt.setAttribute('data-nama', sr.n);
            opt.textContent = `${sr.k} — ${sr.n}`;
            selSubRincian.appendChild(opt);
        });
        selSubRincian.disabled = false;
    }

    updateModalNibarPreview();
}

function onAsetModalSubRincianChanged(subRincianKode) {
    const selBarang = document.getElementById('modal_step_barang');
    if (!selBarang) return;

    selBarang.innerHTML = '<option value="">-- Pilih Barang Akhir (Permendagri / Kustom) --</option>';
    selBarang.disabled = true;

    document.getElementById('modal_kode_barang').value = '';
    document.getElementById('modal_nama_barang').value = '';

    if (!subRincianKode) {
        updateModalNibarPreview();
        return;
    }

    // Ambil bawaan Permendagri (Tingkat 7)
    let barangList = [];
    if (typeof PERMENDAGRI_BARANG !== 'undefined') {
        barangList = PERMENDAGRI_BARANG.filter(b => b.p === subRincianKode);
    }

    // Tambah kode kustom yang dibuat pengguna
    if (Array.isArray(customKodeBarang)) {
        customKodeBarang.forEach(c => {
            if (c.p === subRincianKode || (c.kode && c.kode.startsWith(subRincianKode + '.'))) {
                barangList.push({
                    k: c.kode,
                    n: `${c.nama} [Kustom]`,
                    b: c.kib,
                    p: subRincianKode,
                    is_custom: true
                });
            }
        });
    }

    barangList.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.k;
        opt.setAttribute('data-nama', b.n);
        opt.setAttribute('data-kib', b.b);
        opt.textContent = `${b.k} — ${b.n}`;
        selBarang.appendChild(opt);
    });

    selBarang.disabled = false;
    updateModalNibarPreview();
}

function onAsetModalBarangChanged(barangKode) {
    const selBarang = document.getElementById('modal_step_barang');
    if (!barangKode || !selBarang) {
        document.getElementById('modal_kode_barang').value = '';
        document.getElementById('modal_nama_barang').value = '';
        updateModalNibarPreview();
        return;
    }

    const opt = selBarang.options[selBarang.selectedIndex];
    const rawNama = opt ? opt.getAttribute('data-nama') || '' : '';
    const cleanNama = rawNama.replace(/\s*\[Kustom\]$/, '');

    document.getElementById('modal_kode_barang').value = barangKode;
    document.getElementById('modal_nama_barang').value = cleanNama;

    const spekInp = document.getElementById('modal_spesifikasi_nama');
    if (spekInp && (!spekInp.value || document.getElementById('modal_aset_mode').value === 'add')) {
        spekInp.value = cleanNama;
    }

    updateModalNibarPreview();
}

function setAsetModalCascade(jenisKode, objekKode, rincianKode, subRincianKode, barangKode) {
    const selJenis = document.getElementById('modal_step_jenis');
    if (!selJenis) return;

    selJenis.value = jenisKode;
    onAsetModalJenisChanged(jenisKode);

    const selObjek = document.getElementById('modal_step_objek');
    if (selObjek) {
        selObjek.value = objekKode;
        onAsetModalObjekChanged(objekKode);
    }

    const selRincian = document.getElementById('modal_step_rincian');
    if (selRincian) {
        selRincian.value = rincianKode;
        onAsetModalRincianChanged(rincianKode);
    }

    const selSubRincian = document.getElementById('modal_step_sub_rincian');
    if (selSubRincian) {
        selSubRincian.value = subRincianKode;
        onAsetModalSubRincianChanged(subRincianKode);
    }

    const selBarang = document.getElementById('modal_step_barang');
    if (selBarang) {
        selBarang.value = barangKode;
        onAsetModalBarangChanged(barangKode);
    }
}

function refreshAsetModalBarangList() {
    const selSubRincian = document.getElementById('modal_step_sub_rincian');
    if (selSubRincian && selSubRincian.value) {
        const curBarang = document.getElementById('modal_step_barang')?.value;
        onAsetModalSubRincianChanged(selSubRincian.value);
        if (curBarang) {
            const selBarang = document.getElementById('modal_step_barang');
            if (selBarang) selBarang.value = curBarang;
        }
    }
}

function adjustModalKibDynamicFields(kibLetter) {
    document.querySelectorAll('.modal-kib-dynamic-group').forEach(el => el.classList.add('d-none'));
    const targetGroup = document.getElementById(`modal_kib_fields_${kibLetter.toLowerCase()}`);
    if (targetGroup) targetGroup.classList.remove('d-none');
}

async function updateModalNibarPreview() {
    const mode = document.getElementById('modal_aset_mode')?.value;
    if (mode === 'edit' || mode === 'view') return; // Jaga NIBAR asli saat edit atau view

    const kode = document.getElementById('modal_kode_barang')?.value || '1.3.2.05.01.01.001';
    const tahun = document.getElementById('modal_tahun_perolehan')?.value || appProfile.tahun_anggaran || '2026';
    const npsn = appProfile.npsn || '10505963';

    const nextReg = await NibarGenerator.getNextRegisterNumber(db, kode, tahun);
    const regStr = NibarGenerator.formatRegister(nextReg);
    const nibar = NibarGenerator.buildNibar(npsn, kode, tahun, regStr);

    const prevEl = document.getElementById('modal_preview_nibar');
    const prevRegEl = document.getElementById('modal_preview_register');
    if (prevEl) prevEl.textContent = nibar;
    if (prevRegEl) prevRegEl.textContent = regStr;
}

// PROSES SIMPAN FORM ASET (MODAL)
async function saveModalAsset() {
    const mode = document.getElementById('modal_aset_mode').value;
    if (mode === 'view') return; // Jangan simpan jika dalam mode pratinjau readonly
    const editId = document.getElementById('modal_aset_id').value;

    const kibType = document.getElementById('modal_kib_type').value;
    const kodeBarang = document.getElementById('modal_kode_barang').value.trim();
    const namaBarang = document.getElementById('modal_nama_barang').value.trim();

    if (!kodeBarang || !namaBarang) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'warning',
                title: 'Kodefikasi Belum Lengkap!',
                text: 'Silakan pilih hierarki kodefikasi barang bertingkat hingga Langkah 5 (Barang Akhir).'
            });
        } else {
            alert('Silakan pilih hierarki kodefikasi barang bertingkat hingga Langkah 5 (Barang Akhir).');
        }
        return;
    }

    const spekNama = document.getElementById('modal_spesifikasi_nama').value || namaBarang;
    const merkTipe = document.getElementById('modal_merk_tipe').value || '-';
    const noSeri = document.getElementById('modal_no_pabrik_seri').value || '-';
    const bahan = document.getElementById('modal_bahan').value || '-';
    const asalUsul = document.getElementById('modal_asal_usul').value || 'BOS Reguler';
    const tahun = parseInt(document.getElementById('modal_tahun_perolehan').value, 10) || 2026;
    const tanggal = document.getElementById('modal_tanggal_perolehan').value || new Date().toISOString().split('T')[0];
    const harga = Number(document.getElementById('modal_harga_satuan').value) || 0;
    const qty = parseInt(document.getElementById('modal_jumlah').value, 10) || 1;
    const satuan = document.getElementById('modal_satuan').value || 'Unit';
    const kondisi = document.getElementById('modal_kondisi').value || 'Baik';
    const ruanganId = document.getElementById('modal_ruangan_id').value;
    const keterangan = document.getElementById('modal_keterangan').value || '-';

    const selectedRoom = allRooms.find(r => r.id === ruanganId);
    const ruanganNama = selectedRoom ? selectedRoom.nama_ruangan : '-';

    // Ekstrak Data Khusus per KIB
    let dataKhusus = {};
    if (kibType === 'A') {
        dataKhusus = {
            luas_m2: document.getElementById('kiba_luas')?.value || '-',
            status_hak: document.getElementById('kiba_hak')?.value || 'Hak Pakai',
            no_sertifikat: document.getElementById('kiba_nosertifikat')?.value || noSeri,
            tgl_sertifikat: document.getElementById('kiba_tglsertifikat')?.value || tanggal,
            alamat_letak: document.getElementById('kiba_alamat')?.value || appProfile.alamat,
            penggunaan: document.getElementById('kiba_penggunaan')?.value || 'Pendidikan'
        };
    } else if (kibType === 'B') {
        dataKhusus = {
            cc_ukuran: document.getElementById('kibb_cc_ukuran')?.value || '-',
            no_mesin: document.getElementById('kibb_no_mesin')?.value || '-',
            no_polisi: document.getElementById('kibb_no_polisi')?.value || '-',
            no_bpkb: document.getElementById('kibb_no_bpkb')?.value || '-'
        };
    } else if (kibType === 'C') {
        dataKhusus = {
            luas_lantai: document.getElementById('kibc_luas_lantai')?.value || '-',
            konstruksi_bertingkat: document.getElementById('kibc_bertingkat')?.value || 'Tidak',
            konstruksi_beton: document.getElementById('kibc_beton')?.value || 'Beton',
            no_dokumen_gedung: document.getElementById('kibc_nodokumen')?.value || noSeri,
            tgl_dokumen_gedung: document.getElementById('kibc_tgldokumen')?.value || tanggal,
            luas_tanah_m2: document.getElementById('kibc_luas_tanah')?.value || '-',
            status_hak_tanah: document.getElementById('kibc_hak_tanah')?.value || 'Hak Pakai',
            kode_tanah: document.getElementById('kibc_kode_tanah')?.value || '1.3.1.01.01.01.001'
        };
    } else if (kibType === 'D') {
        dataKhusus = {
            konstruksi: document.getElementById('kibd_konstruksi')?.value || 'Instalasi Jaringan',
            panjang_km: document.getElementById('kibd_panjang')?.value || '-',
            no_dokumen: document.getElementById('kibd_nodok')?.value || noSeri
        };
    } else if (kibType === 'E') {
        dataKhusus = {
            judul_pencipta: document.getElementById('kibe_judul_pencipta')?.value || spekNama,
            kegunaan: document.getElementById('kibe_kegunaan')?.value || 'Pembelajaran',
            ukuran_volume: document.getElementById('kibe_ukuran_volume')?.value || '-'
        };
    } else if (kibType === 'F') {
        dataKhusus = {
            luas_rencana: document.getElementById('kibf_luas_rencana')?.value || '-',
            no_spk: document.getElementById('kibf_no_spk')?.value || noSeri,
            persen_fisik: document.getElementById('kibf_persen_fisik')?.value || '50'
        };
    }

    if (mode === 'edit') {
        const existing = allAssets.find(a => a.id === editId);
        if (!existing) return;

        if (existing.batch_id) {
            const batchUnits = allAssets.filter(a => a.batch_id === existing.batch_id);
            for (const u of batchUnits) {
                await db.update('aset', u.id, {
                    kib_type: kibType,
                    kode_barang: kodeBarang,
                    nama_barang: namaBarang,
                    bahan: bahan,
                    asal_usul: asalUsul,
                    tahun_perolehan: tahun,
                    tanggal_perolehan: tanggal,
                    harga_satuan: harga,
                    nilai_total: harga,
                    satuan: satuan,
                    data_khusus: JSON.stringify(dataKhusus),
                    keterangan: keterangan,
                    updated_at: new Date().toISOString()
                });
            }
        } else {
            await db.update('aset', editId, {
                kib_type: kibType,
                kode_barang: kodeBarang,
                nama_barang: namaBarang,
                spesifikasi_nama: spekNama,
                merk_tipe: merkTipe,
                no_pabrik_seri: noSeri,
                bahan: bahan,
                asal_usul: asalUsul,
                tahun_perolehan: tahun,
                tanggal_perolehan: tanggal,
                harga_satuan: harga,
                nilai_total: harga * (existing.jumlah || 1),
                kondisi: kondisi,
                ruangan_id: ruanganId,
                ruangan_nama: ruanganNama,
                satuan: satuan,
                data_khusus: JSON.stringify(dataKhusus),
                keterangan: keterangan,
                updated_at: new Date().toISOString()
            });
        }
    } else {
        // MODE TAMBAH BARU (SEMUA KIB DIBUAT DENGAN BATCH ID & NOMOR REGISTER/NIBAR BERURUTAN)
        const batchId = 'BATCH-' + Date.now();
        const startReg = await NibarGenerator.getNextRegisterNumber(db, kodeBarang, tahun);
        const npsn = appProfile.npsn || '10505963';
        const toInsert = [];

        for (let i = 0; i < qty; i++) {
            const currentReg = startReg + i;
            const regStr = NibarGenerator.formatRegister(currentReg);
            const nibar = NibarGenerator.buildNibar(npsn, kodeBarang, tahun, regStr);
            const serialSuffix = (qty > 1 && noSeri && noSeri !== '-') ? `${noSeri}-${i + 1}` : noSeri;

            toInsert.push({
                id: 'AST-' + Date.now() + '-' + i,
                batch_id: batchId,
                kib_type: kibType,
                nibar: nibar,
                no_register: regStr,
                kode_barang: kodeBarang,
                nama_barang: namaBarang,
                spesifikasi_nama: (qty > 1 ? `${spekNama} (Unit #${i + 1})` : spekNama),
                merk_tipe: merkTipe,
                no_pabrik_seri: serialSuffix,
                bahan: bahan,
                asal_usul: asalUsul,
                tahun_perolehan: tahun,
                tanggal_perolehan: tanggal,
                harga_satuan: harga,
                nilai_total: harga,
                kondisi: kondisi,
                ruangan_id: ruanganId,
                ruangan_nama: ruanganNama,
                jumlah: 1,
                satuan: satuan,
                data_khusus: JSON.stringify(dataKhusus),
                status_aset: 'Aktif',
                keterangan: keterangan,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        }
        await db.bulkPut('aset', toInsert);
    }

    await loadAssets();
    updateDashboardStats();
    renderBukuIndukTable();
    renderKibTable();
    renderKirView();

    // Tutup Modal
    const modalEl = document.getElementById('modalFormAset');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: mode === 'edit' ? 'Data Aset Diperbarui!' : 'Aset Berhasil Didaftarkan!',
            text: 'Data buku induk barang telah diperbarui secara otomatis.'
        });
    }
}

// =========================================================================
// RINCIAN UNIT PENGADAAN (DETAIL BATCH), EDIT UNIT & USULAN PENGHAPUSAN
// =========================================================================
function openDetailBatchAset(batchId) {
    currentBatchViewingId = batchId;
    let units = allAssets.filter(a => {
        if (a.batch_id && a.batch_id === batchId) return true;
        if (a.id === batchId) return true;
        if (a.id && a.id.startsWith(batchId + '-')) return true;
        return false;
    });

    if (units.length === 1 && (parseInt(units[0].jumlah, 10) || 1) > 1) {
        if (typeof SinbasExcelExporter !== 'undefined' && typeof SinbasExcelExporter.expandToSingleUnits === 'function') {
            units = SinbasExcelExporter.expandToSingleUnits(units);
        }
    }

    if (units.length === 0) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'info', title: 'Data Tidak Ditemukan', text: 'Tidak ada unit barang dalam kelompok pengadaan ini.' });
        }
        return;
    }

    units.sort((a, b) => (parseInt(a.no_register, 10) || 0) - (parseInt(b.no_register, 10) || 0));
    const firstUnit = units[0];
    const lastUnit = units[units.length - 1];
    const totalQty = units.reduce((acc, u) => acc + (u.jumlah || 1), 0);
    const totalNilai = units.reduce((acc, u) => acc + (Number(u.nilai_total || u.harga_satuan) || 0), 0);

    const baseSpek = (firstUnit.spesifikasi_nama || firstUnit.nama_barang || '').replace(/\s*\(Unit\s*#?\d+\)$/i, '');

    document.getElementById('modalDetailBatchTitle').innerHTML = `<i class="fas fa-boxes me-2 text-cyan"></i>Rincian Pengadaan: ${baseSpek} (${totalQty} ${firstUnit.satuan || 'Unit'})`;
    document.getElementById('batch_detail_nama').textContent = `${baseSpek} (${firstUnit.merk_tipe || '-'})`;
    document.getElementById('batch_detail_kode').textContent = `Kodefikasi: ${firstUnit.kode_barang} • KIB ${firstUnit.kib_type}`;
    document.getElementById('batch_detail_pengadaan').textContent = `Tahun ${firstUnit.tahun_perolehan} • Sumber: ${firstUnit.asal_usul || 'BOS Reguler'}`;
    document.getElementById('batch_detail_rentang_reg').textContent = `Reg. ${firstUnit.no_register} s/d ${lastUnit.no_register}`;
    document.getElementById('batch_detail_total_nilai').textContent = `Rp ${totalNilai.toLocaleString('id-ID')}`;
    document.getElementById('batch_detail_qty').textContent = `${totalQty} ${firstUnit.satuan || 'Unit'} (@ Rp ${Number(firstUnit.harga_satuan || 0).toLocaleString('id-ID')})`;

    const tbody = document.getElementById('batchDetailTableBody');
    tbody.innerHTML = '';

    units.forEach((u, idx) => {
        let badgeKondisi = `<span class="badge-kondisi-b">Baik</span>`;
        if (u.kondisi === 'Rusak Ringan') badgeKondisi = `<span class="badge-kondisi-rr">Rusak Ringan</span>`;
        else if (u.kondisi === 'Rusak Berat') badgeKondisi = `<span class="badge-kondisi-rb">Rusak Berat</span>`;

        const isHapus = u.status_aset === 'Usulan Penghapusan';
        const badgeStatus = isHapus 
            ? `<span class="badge bg-danger"><i class="fas fa-trash-alt me-1"></i>Usul Hapus</span>`
            : `<span class="badge bg-success bg-opacity-75">Aktif</span>`;

        const tr = document.createElement('tr');
        if (isHapus) {
            tr.className = 'table-secondary row-aset-penghapusan';
            tr.style.cssText = 'background-color: #f1f5f9 !important; color: #64748b !important; opacity: 0.85;';
        }

        // Tombol Aksi: CUKUP DENGAN ICON SAJA
        let aksiButtonsHtml = '';
        if (isHapus) {
            aksiButtonsHtml = `
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-secondary" disabled title="Aset dalam proses usulan penghapusan (Readonly)">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline-info" title="Cetak Stiker QR Satuan Unit Ini (1 Unit)" onclick="printSingleLabel('${u.id}')">
                        <i class="fas fa-qrcode"></i>
                    </button>
                </div>
            `;
        } else {
            aksiButtonsHtml = `
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-warning" title="Pilih Ruangan & Kondisi Fisik" onclick="openModalEditUnit('${u.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline-info" title="Cetak Stiker QR Satuan Unit Ini (1 Unit)" onclick="printSingleLabel('${u.id}')">
                        <i class="fas fa-qrcode"></i>
                    </button>
                </div>
            `;
        }

        // Kolom Sebelah Aksi: PENGHAPUSAN
        let penghapusanColHtml = '';
        if (isHapus) {
            penghapusanColHtml = `
                <div class="d-inline-flex align-items-center gap-1">
                    <span class="badge bg-danger bg-opacity-75 py-1 px-2" title="Sedang Diajukan Usulan Penghapusan"><i class="fas fa-clock me-1"></i>Diajukan Hapus</span>
                    <button class="btn btn-sm btn-outline-warning py-1 px-2" title="Batalkan Usulan Penghapusan" onclick="cancelUsulanPenghapusan('${u.id}')">
                        <i class="fas fa-undo me-1"></i>Batal
                    </button>
                </div>
            `;
        } else {
            penghapusanColHtml = `
                <button class="btn btn-sm btn-outline-danger py-1 px-2" title="Ajukan Usulan Penghapusan Barang" onclick="openModalUsulanPenghapusan('${u.id}')">
                    <i class="fas fa-trash-alt me-1"></i>Usulkan Hapus
                </button>
            `;
        }

        tr.innerHTML = `
            <td class="text-center">${idx + 1}</td>
            <td class="text-center font-monospace"><span class="badge bg-light text-dark border font-monospace px-2 py-1">${u.no_register}</span></td>
            <td>
                <span class="badge-nibar font-monospace">${u.nibar}</span>
            </td>
            <td>
                <small class="font-monospace text-secondary fw-semibold">${u.no_pabrik_seri || '-'}</small>
            </td>
            <td>
                <span class="badge bg-secondary"><i class="fas fa-door-open me-1"></i>${u.ruangan_nama || '-'}</span>
            </td>
            <td class="text-center text-nowrap">${badgeKondisi}</td>
            <td class="text-center text-nowrap">${badgeStatus}</td>
            <td class="text-center text-nowrap">${aksiButtonsHtml}</td>
            <td class="text-center text-nowrap">${penghapusanColHtml}</td>
        `;
        tbody.appendChild(tr);
    });

    const modalEl = document.getElementById('modalDetailBatchAset');
    if (!modalEl.classList.contains('show')) {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function printAllQrInCurrentBatch() {
    if (!currentBatchViewingId) return;
    printBatchLabelsA4(currentBatchViewingId);
}

async function deleteBatchAset(batchId) {
    const units = allAssets.filter(a => {
        if (a.batch_id && a.batch_id === batchId) return true;
        if (a.id === batchId) return true;
        if (a.id && a.id.startsWith(batchId + '-')) return true;
        return false;
    });
    if (units.length === 0) return;

    const count = units.length;
    const name = units[0].spesifikasi_nama || units[0].nama_barang;

    if (typeof Swal !== 'undefined') {
        const res = await Swal.fire({
            icon: 'warning',
            title: `Hapus Seluruh Pengadaan (${count} Unit)?`,
            html: `Anda akan menghapus data pengadaan <b>${name}</b> sejumlah <b>${count} unit</b> secara permanen dari sistem inventaris. Tindakan ini tidak dapat dibatalkan.`,
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Hapus Semua Unit',
            cancelButtonText: 'Batal'
        });
        if (!res.isConfirmed) return;
    }

    for (const u of units) {
        await db.delete('aset', u.id);
    }
    await loadAssets();
    updateDashboardStats();
    renderBukuIndukTable();
    renderKibTable();
    renderKirView();

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Pengadaan Dihapus!',
            text: `Sebanyak ${count} unit barang berhasil dihapus dari inventaris.`
        });
    }
}

function openModalEditUnit(unitId) {
    const u = allAssets.find(a => a.id === unitId);
    if (!u) return;

    document.getElementById('unit_edit_id').value = u.id;
    document.getElementById('unit_edit_display_nama').textContent = `${u.spesifikasi_nama || u.nama_barang} (Register: ${u.no_register})`;
    document.getElementById('unit_edit_display_nibar').textContent = `NIBAR: ${u.nibar}`;

    const selRuang = document.getElementById('unit_edit_ruangan_id');
    selRuang.innerHTML = '';
    allRooms.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = `${r.kode_ruangan} — ${r.nama_ruangan}`;
        if (r.id === u.ruangan_id) opt.selected = true;
        selRuang.appendChild(opt);
    });

    document.getElementById('unit_edit_kondisi').value = u.kondisi || 'Baik';
    document.getElementById('unit_edit_seri').value = u.no_pabrik_seri || '';
    document.getElementById('unit_edit_keterangan').value = u.keterangan || '';

    const modalEl = document.getElementById('modalEditUnitAset');
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
}

async function saveModalEditUnit() {
    const unitId = document.getElementById('unit_edit_id').value;
    const u = allAssets.find(a => a.id === unitId);
    if (!u) return;

    const newRuanganId = document.getElementById('unit_edit_ruangan_id').value;
    const newKondisi = document.getElementById('unit_edit_kondisi').value;
    const newSeri = document.getElementById('unit_edit_seri').value.trim();
    const newKet = document.getElementById('unit_edit_keterangan').value.trim();

    const selectedRoom = allRooms.find(r => r.id === newRuanganId);
    const newRuanganNama = selectedRoom ? selectedRoom.nama_ruangan : '-';

    const oldRuanganId = u.ruangan_id;
    const oldRuanganNama = u.ruangan_nama;
    const roomChanged = (oldRuanganId && oldRuanganId !== newRuanganId);

    await db.update('aset', unitId, {
        ruangan_id: newRuanganId,
        ruangan_nama: newRuanganNama,
        kondisi: newKondisi,
        no_pabrik_seri: newSeri || u.no_pabrik_seri,
        keterangan: newKet || u.keterangan,
        updated_at: new Date().toISOString()
    });

    if (roomChanged) {
        const mutasiRecord = {
            id: 'MUT-' + Date.now(),
            aset_id: u.id,
            nibar: u.nibar,
            nama_barang: u.nama_barang,
            tanggal_mutasi: new Date().toISOString().split('T')[0],
            ruangan_asal_id: oldRuanganId,
            ruangan_asal_nama: oldRuanganNama,
            ruangan_tujuan_id: newRuanganId,
            ruangan_tujuan_nama: newRuanganNama,
            petugas: appProfile.pengurus_barang || 'Pengurus Barang',
            alasan_mutasi: 'Penataan Lokasi Fisik / Update Unit',
            no_berita_acara: `BA-MUT/${new Date().getFullYear()}/${u.no_register}`
        };
        await db.put('riwayat_mutasi', mutasiRecord);
    }

    await loadAssets();
    updateDashboardStats();
    renderBukuIndukTable();
    renderKirView();
    renderKibTable();

    // Tutup modal edit unit
    const modalEl = document.getElementById('modalEditUnitAset');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    // Refresh modal rincian unit jika sedang dibuka
    if (currentBatchViewingId) {
        openDetailBatchAset(currentBatchViewingId);
    }

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Unit Berhasil Diperbarui!',
            text: `Ruangan unit diatur ke "${newRuanganNama}" dengan kondisi "${newKondisi}".`
        });
    }
}

function openModalUsulanPenghapusan(unitId) {
    const u = allAssets.find(a => a.id === unitId);
    if (!u) return;

    document.getElementById('hps_aset_id').value = u.id;
    document.getElementById('hps_display_nama').textContent = `${u.spesifikasi_nama || u.nama_barang} (Register: ${u.no_register})`;
    document.getElementById('hps_display_nibar').textContent = `NIBAR: ${u.nibar}`;
    document.getElementById('hps_display_nilai').textContent = `Rp ${Number(u.harga_satuan || u.nilai_total || 0).toLocaleString('id-ID')}`;
    document.getElementById('hps_display_ruangan').textContent = `Ruangan: ${u.ruangan_nama || '-'}`;

    document.getElementById('hps_tanggal').value = new Date().toISOString().split('T')[0];
    document.getElementById('hps_petugas').value = appProfile.pengurus_barang || 'Pengurus Barang';
    document.getElementById('hps_kondisi').value = 'Rusak Berat';
    document.getElementById('hps_alasan').selectedIndex = 0;
    document.getElementById('hps_keterangan').value = '';

    const modalEl = document.getElementById('modalUsulanPenghapusan');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function saveModalUsulanPenghapusan() {
    const asetId = document.getElementById('hps_aset_id').value;
    const u = allAssets.find(a => a.id === asetId);
    if (!u) return;

    const tgl = document.getElementById('hps_tanggal').value || new Date().toISOString().split('T')[0];
    const petugas = document.getElementById('hps_petugas').value.trim() || 'Pengurus Barang';
    const alasan = document.getElementById('hps_alasan').value;
    const kondisiAkhir = document.getElementById('hps_kondisi').value || 'Rusak Berat';
    const keterangan = document.getElementById('hps_keterangan').value.trim() || '-';

    // 1. Update Aset di tabel aset
    await db.update('aset', asetId, {
        status_aset: 'Usulan Penghapusan',
        kondisi: kondisiAkhir,
        updated_at: new Date().toISOString()
    });

    // 2. Insert ke riwayat_penghapusan
    const hpsRecord = {
        id: 'HPS-' + Date.now(),
        aset_id: u.id,
        batch_id: u.batch_id || u.id,
        nibar: u.nibar,
        no_register: u.no_register,
        kode_barang: u.kode_barang,
        nama_barang: u.nama_barang,
        spesifikasi_nama: u.spesifikasi_nama,
        merk_tipe: u.merk_tipe,
        tahun_perolehan: u.tahun_perolehan,
        asal_usul: u.asal_usul || 'BOS Reguler',
        nilai_satuan: u.harga_satuan || u.nilai_total,
        ruangan_nama: u.ruangan_nama,
        kondisi_terakhir: kondisiAkhir,
        tanggal_usulan: tgl,
        alasan: alasan,
        no_sk_ba: '',
        petugas: petugas,
        keterangan: keterangan,
        status_penghapusan: 'Usulan Penghapusan',
        created_at: new Date().toISOString()
    };
    await db.put('riwayat_penghapusan', hpsRecord);

    await loadAssets();
    await loadRiwayatPenghapusan();
    updateDashboardStats();
    renderBukuIndukTable();
    renderRiwayatPenghapusan();

    // Tutup modal usulan penghapusan
    const modalEl = document.getElementById('modalUsulanPenghapusan');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    // Refresh modal rincian unit jika sedang dibuka
    if (currentBatchViewingId) {
        openDetailBatchAset(currentBatchViewingId);
    }

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Usulan Penghapusan Diajukan!',
            html: `Aset NIBAR <b>${u.nibar}</b> telah masuk ke dalam <b>Usulan Penghapusan Barang</b> dan tercatat di <b>Riwayat Penghapusan</b>.`
        });
    }
}

function renderRiwayatPenghapusan() {
    const tbody = document.getElementById('penghapusanHistoryTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!allRiwayatPenghapusan || allRiwayatPenghapusan.length === 0) {
        renderTablePagination('penghapusan', 0);
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted"><i class="fas fa-trash-alt fa-2x mb-2 d-block"></i>Belum ada usulan penghapusan aset barang. Untuk mengajukan usulan, buka rincian unit barang di Buku Induk Barang lalu klik tombol "Hapus".</td></tr>';
        return;
    }

    // Filter pencarian
    const q = (document.getElementById('search_penghapusan')?.value || '').toLowerCase().trim();
    let filteredList = allRiwayatPenghapusan.slice().reverse();
    if (q) {
        filteredList = filteredList.filter(h =>
            (h.nibar || '').toLowerCase().includes(q) ||
            (h.nama_barang || '').toLowerCase().includes(q) ||
            (h.spesifikasi_nama || '').toLowerCase().includes(q) ||
            (h.kode_barang || '').toLowerCase().includes(q) ||
            (h.alasan || '').toLowerCase().includes(q) ||
            (h.keterangan || '').toLowerCase().includes(q) ||
            (h.asal_usul || '').toLowerCase().includes(q)
        );
    }

    const totalItems = filteredList.length;
    renderTablePagination('penghapusan', totalItems);
    const pState = tablePagination.penghapusan;
    const startIdx = (pState.page - 1) * pState.perPage;
    const pagedHps = filteredList.slice(startIdx, startIdx + pState.perPage);

    if (pagedHps.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted"><i class="fas fa-search fa-2x mb-2 d-block"></i>Tidak ada data usulan penghapusan yang cocok dengan kata kunci pencarian.</td></tr>';
        return;
    }

    pagedHps.forEach((h, idx) => {
        let badgeKondisi = `<span class="badge-kondisi-rb">${h.kondisi_terakhir || 'Rusak Berat'}</span>`;
        if (h.kondisi_terakhir === 'Baik') badgeKondisi = `<span class="badge-kondisi-b">Baik</span>`;
        else if (h.kondisi_terakhir === 'Rusak Ringan') badgeKondisi = `<span class="badge-kondisi-rr">Rusak Ringan</span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">${startIdx + idx + 1}</td>
            <td><span class="badge bg-light text-dark border px-2 py-1">${h.tanggal_usulan || '-'}</span></td>
            <td>
                <span class="badge-nibar mb-1">${h.nibar}</span><br>
                <small class="text-muted">Reg. ${h.no_register || '-'}</small>
            </td>
            <td>
                <div class="fw-bold">${h.spesifikasi_nama || h.nama_barang}</div>
                <small class="text-muted">${h.merk_tipe || '-'} • Thn ${h.tahun_perolehan || '-'}</small>
            </td>
            <td>
                <span class="badge bg-danger bg-opacity-75 mb-1">${h.alasan}</span><br>
                <small class="text-muted">${h.keterangan || '-'}</small>
            </td>
            <td class="text-center">${badgeKondisi}</td>
            <td class="text-end fw-bold text-info">Rp ${(Number(h.nilai_satuan) || 0).toLocaleString('id-ID')}</td>
            <td class="text-center">
                <span class="badge bg-warning text-dark"><i class="fas fa-hourglass-half me-1"></i>${h.status_penghapusan || 'Usulan'}</span>
            </td>
            <td class="text-center text-nowrap">
                <div class="d-inline-flex align-items-center gap-1">
                    <button class="btn btn-sm btn-outline-primary py-1 px-2 shadow-sm" title="Pratinjau & Unduh Dokumen Berita Acara Word (.doc)" onclick="openPreviewBeritaAcara('${h.id}')">
                        <i class="fas fa-file-word"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger py-1 px-2 shadow-sm" title="Pratinjau & Cetak Dokumen PDF" onclick="openPreviewBeritaAcara('${h.id}')">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary py-1 px-2" title="Batalkan Usulan Penghapusan" onclick="cancelUsulanPenghapusan('${h.id}')">
                        <i class="fas fa-undo"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function cancelUsulanPenghapusan(hpsId) {
    let h = (allRiwayatPenghapusan || []).find(x => x.id === hpsId);
    if (!h) {
        h = (allRiwayatPenghapusan || []).find(x => x.aset_id === hpsId);
    }
    if (!h) {
        const u = (allAssets || []).find(a => a.id === hpsId);
        if (u) {
            h = { id: null, aset_id: u.id, nibar: u.nibar };
        } else {
            return;
        }
    }

    if (typeof Swal !== 'undefined') {
        const res = await Swal.fire({
            icon: 'question',
            title: 'Batalkan Usulan Penghapusan?',
            html: `Status aset <b>${h.nibar}</b> akan dikembalikan menjadi <b>Aktif</b> di inventaris sekolah.`,
            showCancelButton: true,
            confirmButtonColor: '#2563eb',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Kembalikan Aktif',
            cancelButtonText: 'Batal'
        });
        if (!res.isConfirmed) return;
    }

    await db.update('aset', h.aset_id, {
        status_aset: 'Aktif',
        updated_at: new Date().toISOString()
    });

    if (h.id) {
        await db.delete('riwayat_penghapusan', h.id);
    } else {
        const rec = (allRiwayatPenghapusan || []).find(x => x.aset_id === h.aset_id);
        if (rec) await db.delete('riwayat_penghapusan', rec.id);
    }

    await loadAssets();
    await loadRiwayatPenghapusan();
    updateDashboardStats();
    renderBukuIndukTable();
    renderRiwayatPenghapusan();

    if (currentBatchViewingId) {
        openDetailBatchAset(currentBatchViewingId);
    }

    SinbasNotify(`Usulan penghapusan aset ${h.nibar} berhasil dibatalkan!`);
}

function exportPenghapusanExcel(customTtd = null) {
    if (!allRiwayatPenghapusan || allRiwayatPenghapusan.length === 0) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'info', title: 'Data Kosong', text: 'Belum ada data usulan penghapusan aset untuk diekspor.' });
        }
        return;
    }

    const q = (document.getElementById('search_penghapusan')?.value || '').toLowerCase().trim();
    let exportList = allRiwayatPenghapusan.slice().reverse();
    if (q) {
        exportList = exportList.filter(h =>
            (h.nibar || '').toLowerCase().includes(q) ||
            (h.nama_barang || '').toLowerCase().includes(q) ||
            (h.spesifikasi_nama || '').toLowerCase().includes(q) ||
            (h.kode_barang || '').toLowerCase().includes(q) ||
            (h.alasan || '').toLowerCase().includes(q) ||
            (h.keterangan || '').toLowerCase().includes(q) ||
            (h.asal_usul || '').toLowerCase().includes(q)
        );
    }

    const prov = (appProfile.provinsi || 'JAMBI').toUpperCase();
    const instansi = (appProfile.nama_instansi || `PEMERINTAH PROVINSI ${prov}`).toUpperCase();
    const opd = (appProfile.nama_opd !== undefined ? appProfile.nama_opd : 'DINAS PENDIDIKAN DAN KEBUDAYAAN').trim();

    const rows = [
        ['DAFTAR REKAPITULASI USULAN PENGHAPUSAN BARANG MILIK DAERAH (BMD)'],
        [`SATUAN PENDIDIKAN: ${appProfile.nama_sekolah || 'SMAN 15 TEBO'}`],
        [`${instansi}${opd ? ` • ${opd.toUpperCase()}` : ''} • NPSN: ${appProfile.npsn || '10505963'}`],
        [''],
        [
            'No.',
            'Tanggal Usulan',
            'NIBAR',
            'No. Register',
            'Kodefikasi Barang',
            'Nama Barang',
            'Spesifikasi / Merk',
            'Tahun',
            'Sumber Dana / Asal Perolehan',
            'Nilai Perolehan (Rp)',
            'Kondisi Terakhir',
            'Alasan Penghapusan',
            'Keterangan / Sebab',
            'Petugas / Pengusul',
            'Status Usulan'
        ]
    ];

    exportList.forEach((h, idx) => {
        const u = (allAssets || []).find(a => a.id === h.aset_id) || {};
        const asalPerolehan = h.asal_usul || u.asal_usul || 'BOS Reguler';
        rows.push([
            idx + 1,
            h.tanggal_usulan || '-',
            h.nibar || '-',
            h.no_register || '-',
            h.kode_barang || '-',
            h.nama_barang || '-',
            h.spesifikasi_nama || h.merk_tipe || '-',
            h.tahun_perolehan || '-',
            asalPerolehan,
            Number(h.nilai_satuan) || 0,
            h.kondisi_terakhir || 'Rusak Berat',
            h.alasan || 'Rusak Berat / Aus',
            h.keterangan || '-',
            h.petugas || '-',
            h.status_penghapusan || 'Usulan Penghapusan'
        ]);
    });

    rows.push([]);
    SinbasExcelExporter.appendSignatures(rows, appProfile, null, customTtd || window.currentLaporanTtd);

    SinbasExcelExporter.generateFile(
        rows,
        `Daftar_Usulan_Penghapusan_BMD_${new Date().getFullYear()}.xlsx`,
        'Usulan Penghapusan',
        [
            { wch: 5 }, { wch: 15 }, { wch: 22 }, { wch: 12 }, { wch: 18 },
            { wch: 30 }, { wch: 25 }, { wch: 8 }, { wch: 25 }, { wch: 18 }, { wch: 16 },
            { wch: 22 }, { wch: 30 }, { wch: 20 }, { wch: 18 }
        ]
    );
}

// =========================================================================
// BERITA ACARA PENGHAPUSAN: GENERATOR DOKUMEN, PRATINJAU, WORD & EXCELJS A4
// =========================================================================
function formatTanggalIndo(dateStr) {
    if (!dateStr) return '-';
    try {
        const str = String(dateStr).trim();
        const bulanIndo = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        const parts = str.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            const thn = parts[0];
            const blnIdx = parseInt(parts[1], 10) - 1;
            const tgl = parseInt(parts[2], 10);
            if (blnIdx >= 0 && blnIdx < 12 && !isNaN(tgl)) {
                return `${tgl} ${bulanIndo[blnIdx]} ${thn}`;
            }
        }
        const d = new Date(str);
        if (isNaN(d.getTime())) return dateStr;
        return `${d.getDate()} ${bulanIndo[d.getMonth()]} ${d.getFullYear()}`;
    } catch (e) {
        return dateStr;
    }
}

function generateBeritaAcaraHtml(h) {
    if (!h) return '';
    const u = (allAssets || []).find(a => a.id === h.aset_id) || {};
    const asalPerolehan = h.asal_usul || u.asal_usul || 'BOS Reguler';
    const tglIndo = formatTanggalIndo(h.tanggal_usulan);
    const kepalaSekolah = appProfile.kepala_sekolah || 'Kepala Sekolah';
    const nipKepala = appProfile.nip_kepala_sekolah || '-';
    const pengurus = h.petugas || appProfile.pengurus_barang || 'Pengurus Barang';
    const nipPengurus = appProfile.nip_pengurus_barang || '-';
    const prov = (appProfile.provinsi || 'JAMBI').toUpperCase();
    const instansi = (appProfile.nama_instansi || `PEMERINTAH PROVINSI ${prov}`).toUpperCase();
    const opd = (appProfile.nama_opd !== undefined ? appProfile.nama_opd : 'DINAS PENDIDIKAN DAN KEBUDAYAAN').trim();
    const sekolah = (appProfile.nama_sekolah || 'SMAN 15 TEBO').toUpperCase();
    const npsn = appProfile.npsn || '10505963';
    const alamat = appProfile.alamat || 'Jl. Padang Lamo, Wirotho Agung, Rimbo Bujang, Kab. Tebo, Jambi';

    let logoDaerah = appProfile.logo_daerah || localStorage.getItem('sinbas_logo_daerah') || '';
    if (!logoDaerah || !logoDaerah.startsWith('data:image')) {
        logoDaerah = cachedDefaultLogoDaerahBase64 || '';
    }

    let logoSekolah = appProfile.logo_sekolah || localStorage.getItem('sinbas_logo_sekolah') || '';
    if (!logoSekolah || !logoSekolah.startsWith('data:image')) {
        logoSekolah = cachedDefaultLogoSekolahBase64 || cachedLogoSinbasBase64 || '';
    }

    // Pastikan jika salah satu kosong, minimal ada logo sekolah/sinbas yang tampil
    if (!logoDaerah && !logoSekolah) {
        logoSekolah = cachedLogoSinbasBase64 || 'assets/img/logo_sinbas.png';
    }

    let logoKiriHtml = '';
    let logoKananHtml = '';

    if (logoDaerah) {
        logoKiriHtml = `<img src="${logoDaerah}" width="75" height="75" alt="Logo Pemda" style="width: 75px; height: 75px; object-fit: contain;">`;
    }
    if (logoSekolah) {
        if (!logoDaerah) {
            logoKiriHtml = `<img src="${logoSekolah}" width="75" height="75" alt="Logo Sekolah" style="width: 75px; height: 75px; object-fit: contain;">`;
        } else {
            logoKananHtml = `<img src="${logoSekolah}" width="75" height="75" alt="Logo Sekolah" style="width: 75px; height: 75px; object-fit: contain;">`;
        }
    }

    return `
        <div class="ba-document-container" style="color: #000; font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.45;">
            <!-- KOP SURAT RESMI SEKOLAH -->
            <table style="width: 100%; border-bottom: 3px double #000; padding-bottom: 10px; margin-bottom: 18px; border-collapse: collapse;">
                <tr>
                    <td style="width: 85px; vertical-align: middle; text-align: left; padding: 0 10px 10px 0; border: none;">
                        ${logoKiriHtml}
                    </td>
                    <td style="vertical-align: middle; text-align: center; padding: 0 0 10px 0; border: none;">
                        <div style="font-size: 13pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">${instansi}</div>
                        ${opd ? `<div style="font-size: 12pt; font-weight: bold; text-transform: uppercase;">${opd.toUpperCase()}</div>` : ''}
                        <div style="font-size: 15pt; font-weight: bold; text-transform: uppercase; margin: 3px 0; letter-spacing: 0.5px;">${sekolah}</div>
                        <div style="font-size: 9.5pt; color: #222;">${alamat} • NPSN: ${npsn}</div>
                    </td>
                    <td style="width: 85px; vertical-align: middle; text-align: right; padding: 0 0 10px 10px; border: none;">
                        ${logoKananHtml}
                    </td>
                </tr>
            </table>

            <!-- JUDUL DAN NOMOR BERITA ACARA -->
            <div style="text-align: center; margin-bottom: 18px;">
                <div style="font-size: 12.5pt; font-weight: bold; text-decoration: underline; text-transform: uppercase; letter-spacing: 0.5px;">
                    BERITA ACARA PEMERIKSAAN KELAYAKAN DAN USULAN PENGHAPUSAN
                </div>
                <div style="font-size: 11.5pt; font-weight: bold; text-transform: uppercase; margin-top: 2px;">
                    BARANG MILIK DAERAH (BMD)
                </div>
                <div style="font-size: 11pt; margin-top: 6px; font-weight: normal;">
                    Nomor : ............................................................................................
                </div>
            </div>

            <!-- PARAGRAF PEMBUKA -->
            <p style="text-align: justify; text-indent: 32px; margin-bottom: 12px;">
                Pada hari ini, tanggal <b>${tglIndo}</b>, kami yang bertanda tangan di bawah ini bertindak sebagai Pengurus Barang dan Kuasa Pengguna Barang Milik Daerah pada <b>${appProfile.nama_sekolah || 'SMAN 15 TEBO'}</b>, telah melaksanakan pemeriksaan teknis, fisik, dan administrasi atas barang inventaris milik daerah sebagai berikut:
            </p>

            <!-- TABEL RINCIAN BARANG (SUMBER DANA / ASAL PEROLEHAN) -->
            <table style="width: 100%; border-collapse: collapse; margin: 12px 0 16px 0; font-size: 10pt;">
                <thead>
                    <tr style="background-color: #f1f5f9; text-align: center; font-weight: bold;">
                        <th style="border: 1px solid #000; padding: 6px 4px; width: 28px;">No.</th>
                        <th style="border: 1px solid #000; padding: 6px 4px; width: 105px;">Kode Barang</th>
                        <th style="border: 1px solid #000; padding: 6px 4px; width: 100px;">NIBAR / Reg.</th>
                        <th style="border: 1px solid #000; padding: 6px 6px;">Nama / Spesifikasi Barang</th>
                        <th style="border: 1px solid #000; padding: 6px 4px; width: 80px;">Merk / Tipe</th>
                        <th style="border: 1px solid #000; padding: 6px 4px; width: 45px;">Thn</th>
                        <th style="border: 1px solid #000; padding: 6px 6px; width: 110px;">Sumber Dana / Asal Perolehan</th>
                        <th style="border: 1px solid #000; padding: 6px 4px; width: 90px;">Nilai Perolehan</th>
                        <th style="border: 1px solid #000; padding: 6px 4px; width: 75px;">Kondisi</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; vertical-align: top;">1</td>
                        <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-family: monospace; font-size: 9pt; vertical-align: top;">${h.kode_barang || '-'}</td>
                        <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-family: monospace; font-size: 9pt; vertical-align: top;">
                            <b>${h.nibar || '-'}</b><br>
                            <span style="font-size: 8.5pt; color: #444;">Reg: ${h.no_register || '1'}</span>
                        </td>
                        <td style="border: 1px solid #000; padding: 6px 6px; vertical-align: top;">
                            <b>${h.spesifikasi_nama || h.nama_barang || '-'}</b>
                        </td>
                        <td style="border: 1px solid #000; padding: 6px 4px; vertical-align: top; text-align: center;">${h.merk_tipe || '-'}</td>
                        <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; vertical-align: top;">${h.tahun_perolehan || '-'}</td>
                        <td style="border: 1px solid #000; padding: 6px 6px; text-align: center; vertical-align: top;">
                            <span style="font-weight: 600;">${asalPerolehan}</span>
                        </td>
                        <td style="border: 1px solid #000; padding: 6px 4px; text-align: right; vertical-align: top; font-weight: bold; white-space: nowrap;">
                            Rp ${(Number(h.nilai_satuan) || 0).toLocaleString('id-ID')}
                        </td>
                        <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; vertical-align: top; font-weight: bold; color: #b91c1c;">
                            ${h.kondisi_terakhir || 'Rusak Berat'}
                        </td>
                    </tr>
                </tbody>
            </table>

            <!-- URAIAN DAN ALASAN -->
            <div style="margin-bottom: 12px;">
                <div style="font-weight: bold; margin-bottom: 3px;">1. Alasan Usulan Penghapusan:</div>
                <div style="padding-left: 20px; font-style: italic;">
                    ${h.alasan || 'Rusak Berat (Secara ekonomis tidak efisien untuk diperbaiki kembali).'}
                </div>
            </div>

            <div style="margin-bottom: 14px;">
                <div style="font-weight: bold; margin-bottom: 3px;">2. Catatan / Rincian Kerusakan Teknis:</div>
                <div style="padding-left: 20px; text-align: justify;">
                    ${h.keterangan && h.keterangan !== '-' ? h.keterangan : 'Barang mengalami kerusakan fisik yang berat, komponen aus dan tidak dapat diperbaiki lagi, serta tidak dapat difungsikan untuk mendukung kegiatan operasional belajar mengajar sekolah.'}
                </div>
            </div>

            <!-- PARAGRAF KESIMPULAN / PENUTUP -->
            <p style="text-align: justify; text-indent: 32px; margin-bottom: 14px;">
                Berdasarkan hasil pemeriksaan tersebut di atas, kami mengusulkan kepada Pengelola Barang Milik Daerah melalui Kepala Dinas Pendidikan Provinsi agar barang inventaris tersebut dapat diproses penghapusannya dari Buku Induk Barang Milik Daerah (BMD) sesuai dengan ketentuan <b>Permendagri No. 47 Tahun 2021</b> serta ketentuan perundang-undangan yang berlaku.
            </p>
            <p style="text-align: justify; text-indent: 32px; margin-bottom: 24px;">
                Demikian Berita Acara ini kami buat dengan sebenarnya dalam rangkap secukupnya untuk dipergunakan sebagaimana mestinya.
            </p>

            <!-- TANDA TANGAN DUA BELAH PIHAK -->
            <table style="width: 100%; border: none; margin-top: 25px;">
                <tr>
                    <td style="width: 48%; text-align: center; vertical-align: top; border: none; padding: 0;">
                        <div>Mengetahui,</div>
                        <div style="font-weight: bold;">Kepala Sekolah Selaku Kuasa Pengguna Barang</div>
                        <div style="height: 65px;"></div>
                        <div style="font-weight: bold; text-decoration: underline;">${kepalaSekolah}</div>
                        <div>NIP. ${nipKepala}</div>
                    </td>
                    <td style="width: 4%; border: none; padding: 0;"></td>
                    <td style="width: 48%; text-align: center; vertical-align: top; border: none; padding: 0;">
                        <div>${typeof SinbasExcelExporter !== 'undefined' ? SinbasExcelExporter.cleanKotaNama(appProfile.kabupaten_kota || appProfile.kabupaten) : (appProfile.kabupaten || 'Tebo')}, ${tglIndo}</div>
                        <div style="font-weight: bold;">Petugas Pengurus Barang,</div>
                        <div style="height: 65px;"></div>
                        <div style="font-weight: bold; text-decoration: underline;">${pengurus}</div>
                        <div>NIP. ${nipPengurus}</div>
                    </td>
                </tr>
            </table>
        </div>
    `;
}

let currentPreviewBaId = null;
let currentBaZoomLevel = 1.0;

function openPreviewBeritaAcara(hpsId) {
    let h = (allRiwayatPenghapusan || []).find(x => x.id === hpsId);
    if (!h) h = (allRiwayatPenghapusan || []).find(x => x.aset_id === hpsId);
    if (!h) return;

    currentPreviewBaId = h.id;
    const paperSheet = document.getElementById('baPreviewPaperSheet');
    if (!paperSheet) return;

    paperSheet.innerHTML = generateBeritaAcaraHtml(h);

    currentBaZoomLevel = 1.0;
    paperSheet.style.transform = 'scale(1)';
    const zoomLbl = document.getElementById('previewBaZoomLabel');
    if (zoomLbl) zoomLbl.textContent = '100%';

    const titleEl = document.getElementById('previewBaTitle');
    if (titleEl) {
        titleEl.textContent = `Pratinjau Berita Acara — NIBAR ${h.nibar}`;
    }

    const modalEl = document.getElementById('modalPreviewBeritaAcara');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function zoomPreviewBa(delta) {
    currentBaZoomLevel = Math.max(0.5, Math.min(2.0, currentBaZoomLevel + delta));
    const paperSheet = document.getElementById('baPreviewPaperSheet');
    if (paperSheet) {
        paperSheet.style.transform = `scale(${currentBaZoomLevel})`;
    }
    const zoomLbl = document.getElementById('previewBaZoomLabel');
    if (zoomLbl) {
        zoomLbl.textContent = `${Math.round(currentBaZoomLevel * 100)}%`;
    }
}

function resetZoomPreviewBa() {
    currentBaZoomLevel = 1.0;
    const paperSheet = document.getElementById('baPreviewPaperSheet');
    if (paperSheet) {
        paperSheet.style.transform = 'scale(1)';
    }
    const zoomLbl = document.getElementById('previewBaZoomLabel');
    if (zoomLbl) {
        zoomLbl.textContent = '100%';
    }
}

function printBeritaAcaraFromPreview() {
    document.body.classList.add('ba-printing');
    window.print();
    setTimeout(() => {
        document.body.classList.remove('ba-printing');
    }, 500);
}

function printBeritaAcaraPenghapusan(hpsId) {
    openPreviewBeritaAcara(hpsId);
    setTimeout(() => {
        printBeritaAcaraFromPreview();
    }, 300);
}

function downloadBeritaAcaraWord(hpsId) {
    const idToUse = hpsId || currentPreviewBaId;
    let h = (allRiwayatPenghapusan || []).find(x => x.id === idToUse);
    if (!h) h = (allRiwayatPenghapusan || []).find(x => x.aset_id === idToUse);
    if (!h) return;

    const htmlBody = generateBeritaAcaraHtml(h);

    const docContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset="utf-8">
            <title>Berita Acara Usulan Penghapusan BMD - ${h.nibar}</title>
            <!--[if gte mso 9]>
            <xml>
                <w:WordDocument>
                    <w:View>Print</w:View>
                    <w:Zoom>100</w:Zoom>
                    <w:DoNotOptimizeForBrowser/>
                </w:WordDocument>
            </xml>
            <![endif]-->
            <style>
                @page Section1 {
                    size: 21.0cm 29.7cm; /* A4 Portrait */
                    margin: 2.0cm 2.0cm 2.0cm 2.0cm;
                    mso-header-margin: 1.0cm;
                    mso-footer-margin: 1.0cm;
                    mso-paper-source: 0;
                }
                div.Section1 { page: Section1; }
                body {
                    font-family: 'Times New Roman', Times, serif;
                    font-size: 11pt;
                    color: #000000;
                    line-height: 1.45;
                }
                table {
                    border-collapse: collapse;
                    width: 100%;
                }
                th, td {
                    font-family: 'Times New Roman', Times, serif;
                }
            </style>
        </head>
        <body>
            <div class="Section1">
                ${htmlBody}
            </div>
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff', docContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Berita_Acara_Penghapusan_${h.nibar}_Reg_${h.no_register || '1'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function downloadBeritaAcaraExcelJS(hpsId) {
    const idToUse = hpsId || currentPreviewBaId;
    let h = (allRiwayatPenghapusan || []).find(x => x.id === idToUse);
    if (!h) h = (allRiwayatPenghapusan || []).find(x => x.aset_id === idToUse);
    if (!h) return;

    if (typeof ExcelJS === 'undefined' && typeof window.ExcelJS === 'undefined') {
        SinbasNotify('Pustaka ExcelJS belum siap. Mengunduh format standar...', 'warning');
        return;
    }

    const ExcelLib = window.ExcelJS || ExcelJS;
    const wb = new ExcelLib.Workbook();
    wb.creator = 'SINBAS BMD';
    wb.lastModifiedBy = appProfile.pengurus_barang || 'Pengurus Barang';
    wb.created = new Date();

    const ws = wb.addWorksheet('BA Penghapusan BMD', {
        pageSetup: {
            paperSize: 9, // A4
            orientation: 'portrait',
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

    // 9 Kolom: A=No, B=Kode, C=NIBAR/Reg, D=Nama/Spesifikasi, E=Merk, F=Thn, G=Sumber Dana, H=Nilai, I=Kondisi
    ws.columns = [
        { key: 'colA', width: 5 },   // No
        { key: 'colB', width: 15 },  // Kode Barang
        { key: 'colC', width: 17 },  // NIBAR / Reg
        { key: 'colD', width: 26 },  // Nama / Spesifikasi
        { key: 'colE', width: 14 },  // Merk / Tipe
        { key: 'colF', width: 8 },   // Thn
        { key: 'colG', width: 22 },  // Sumber Dana / Asal Perolehan
        { key: 'colH', width: 16 },  // Nilai Perolehan
        { key: 'colI', width: 14 }   // Kondisi
    ];

    const u = (allAssets || []).find(a => a.id === h.aset_id) || {};
    const asalPerolehan = h.asal_usul || u.asal_usul || 'BOS Reguler';
    const tglIndo = formatTanggalIndo(h.tanggal_usulan);
    const kepalaSekolah = appProfile.kepala_sekolah || 'Kepala Sekolah';
    const nipKepala = appProfile.nip_kepala_sekolah || '-';
    const pengurus = h.petugas || appProfile.pengurus_barang || 'Pengurus Barang';
    const nipPengurus = appProfile.nip_pengurus_barang || '-';
    const prov = (appProfile.provinsi || 'JAMBI').toUpperCase();
    const instansi = (appProfile.nama_instansi || `PEMERINTAH PROVINSI ${prov}`).toUpperCase();
    const opd = (appProfile.nama_opd !== undefined ? appProfile.nama_opd : 'DINAS PENDIDIKAN DAN KEBUDAYAAN').trim();
    const sekolah = (appProfile.nama_sekolah || 'SMAN 15 TEBO').toUpperCase();
    const npsn = appProfile.npsn || '10505963';
    const alamat = appProfile.alamat || 'Jl. Padang Lamo, Wirotho Agung, Rimbo Bujang, Kab. Tebo, Jambi';

    const hasOpd = !!opd;
    const offset = hasOpd ? 0 : -1;
    const r = (n) => (n <= 1 ? n : n + offset);

    // ROW 1: KOP 1 (Instansi)
    ws.mergeCells('A1:I1');
    ws.getCell('A1').value = instansi;
    ws.getCell('A1').font = { name: 'Times New Roman', size: 12, bold: true };
    ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

    // ROW 2: KOP 2 (OPD) - hanya jika diisi
    if (hasOpd) {
        ws.mergeCells('A2:I2');
        ws.getCell('A2').value = opd.toUpperCase();
        ws.getCell('A2').font = { name: 'Times New Roman', size: 11, bold: true };
        ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // ROW 3 (or 2 if no OPD): KOP 3 (Sekolah)
    ws.mergeCells(`A${r(3)}:I${r(3)}`);
    ws.getCell(`A${r(3)}`).value = sekolah;
    ws.getCell(`A${r(3)}`).font = { name: 'Times New Roman', size: 14, bold: true };
    ws.getCell(`A${r(3)}`).alignment = { horizontal: 'center', vertical: 'middle' };

    // ROW 4 (or 3 if no OPD): KOP 4 (Alamat & NPSN)
    ws.mergeCells(`A${r(4)}:I${r(4)}`);
    ws.getCell(`A${r(4)}`).value = `${alamat} • NPSN: ${npsn}`;
    ws.getCell(`A${r(4)}`).font = { name: 'Times New Roman', size: 9, italic: true };
    ws.getCell(`A${r(4)}`).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(`A${r(4)}`).border = {
        bottom: { style: 'double', color: { argb: 'FF000000' } }
    };

    // ROW 6: JUDUL
    ws.mergeCells(`A${r(6)}:I${r(6)}`);
    ws.getCell(`A${r(6)}`).value = 'BERITA ACARA PEMERIKSAAN KELAYAKAN DAN USULAN PENGHAPUSAN';
    ws.getCell(`A${r(6)}`).font = { name: 'Times New Roman', size: 12, bold: true, underline: true };
    ws.getCell(`A${r(6)}`).alignment = { horizontal: 'center', vertical: 'middle' };

    // ROW 7: SUBJUDUL
    ws.mergeCells(`A${r(7)}:I${r(7)}`);
    ws.getCell(`A${r(7)}`).value = 'BARANG MILIK DAERAH (BMD)';
    ws.getCell(`A${r(7)}`).font = { name: 'Times New Roman', size: 11, bold: true };
    ws.getCell(`A${r(7)}`).alignment = { horizontal: 'center', vertical: 'middle' };

    // ROW 8: NOMOR SURAT (GARIS PANJANG / TITIK-TITIK UNTUK INPUT MANUAL)
    ws.mergeCells(`A${r(8)}:I${r(8)}`);
    ws.getCell(`A${r(8)}`).value = 'Nomor : ............................................................................................';
    ws.getCell(`A${r(8)}`).font = { name: 'Times New Roman', size: 11 };
    ws.getCell(`A${r(8)}`).alignment = { horizontal: 'center', vertical: 'middle' };

    // ROW 10: PEMBUKA
    ws.mergeCells(`A${r(10)}:I${r(10)}`);
    ws.getCell(`A${r(10)}`).value = `Pada hari ini, tanggal ${tglIndo}, kami yang bertanda tangan di bawah ini bertindak sebagai Pengurus Barang dan Kuasa Pengguna Barang Milik Daerah pada ${appProfile.nama_sekolah || 'SMAN 15 TEBO'}, telah melaksanakan pemeriksaan teknis, fisik, dan administrasi atas barang inventaris milik daerah sebagai berikut:`;
    ws.getCell(`A${r(10)}`).font = { name: 'Times New Roman', size: 10 };
    ws.getCell(`A${r(10)}`).alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(r(10)).height = 34;

    // ROW 12: HEADER TABEL
    const headerRow = ws.getRow(r(12));
    headerRow.values = [
        'No.',
        'Kode Barang',
        'NIBAR / Reg.',
        'Nama / Spesifikasi Barang',
        'Merk / Tipe',
        'Thn',
        'Sumber Dana / Asal Perolehan',
        'Nilai Perolehan (Rp)',
        'Kondisi'
    ];
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
        cell.font = { name: 'Times New Roman', size: 10, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE2E8F0' }
        };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // ROW 13: DATA TABEL
    const dataRow = ws.getRow(r(13));
    dataRow.values = [
        1,
        h.kode_barang || '-',
        `${h.nibar || '-'}\nReg: ${h.no_register || '1'}`,
        h.spesifikasi_nama || h.nama_barang || '-',
        h.merk_tipe || '-',
        h.tahun_perolehan || '-',
        asalPerolehan,
        Number(h.nilai_satuan) || 0,
        h.kondisi_terakhir || 'Rusak Berat'
    ];
    dataRow.height = 30;

    dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    dataRow.getCell(4).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    dataRow.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    dataRow.getCell(8).numFmt = '#,##0';
    dataRow.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };

    dataRow.eachCell((cell) => {
        cell.font = { name: 'Times New Roman', size: 10 };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });
    dataRow.getCell(9).font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FFDC2626' } };

    // ROW 15-18: ALASAN & CATATAN
    ws.mergeCells(`A${r(15)}:I${r(15)}`);
    ws.getCell(`A${r(15)}`).value = '1. Alasan Usulan Penghapusan:';
    ws.getCell(`A${r(15)}`).font = { name: 'Times New Roman', size: 10, bold: true };

    ws.mergeCells(`A${r(16)}:I${r(16)}`);
    ws.getCell(`A${r(16)}`).value = `   • ${h.alasan || 'Rusak Berat (Secara ekonomis tidak efisien untuk diperbaiki kembali).'}`;
    ws.getCell(`A${r(16)}`).font = { name: 'Times New Roman', size: 10, italic: true };

    ws.mergeCells(`A${r(17)}:I${r(17)}`);
    ws.getCell(`A${r(17)}`).value = '2. Catatan / Rincian Kerusakan Teknis:';
    ws.getCell(`A${r(17)}`).font = { name: 'Times New Roman', size: 10, bold: true };

    ws.mergeCells(`A${r(18)}:I${r(18)}`);
    ws.getCell(`A${r(18)}`).value = `   ${h.keterangan && h.keterangan !== '-' ? h.keterangan : 'Barang mengalami kerusakan fisik yang berat, aus, dan tidak dapat difungsikan untuk mendukung kegiatan operasional sekolah.'}`;
    ws.getCell(`A${r(18)}`).font = { name: 'Times New Roman', size: 10 };
    ws.getCell(`A${r(18)}`).alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(r(18)).height = 24;

    // ROW 20: KESIMPULAN
    ws.mergeCells(`A${r(20)}:I${r(20)}`);
    ws.getCell(`A${r(20)}`).value = `Berdasarkan hasil pemeriksaan tersebut di atas, kami mengusulkan kepada Pengelola Barang Milik Daerah melalui Kepala Dinas Pendidikan Provinsi agar barang inventaris tersebut dapat diproses penghapusannya dari Buku Induk Barang Milik Daerah (BMD) sesuai Permendagri No. 47 Tahun 2021.`;
    ws.getCell(`A${r(20)}`).font = { name: 'Times New Roman', size: 10 };
    ws.getCell(`A${r(20)}`).alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(r(20)).height = 30;

    // ROW 22-28: TANDA TANGAN DUA PIHAK
    ws.mergeCells(`B${r(22)}:D${r(22)}`);
    ws.getCell(`B${r(22)}`).value = 'Mengetahui,';
    ws.getCell(`B${r(22)}`).alignment = { horizontal: 'center' };
    ws.getCell(`B${r(22)}`).font = { name: 'Times New Roman', size: 10 };

    ws.mergeCells(`G${r(22)}:I${r(22)}`);
    ws.getCell(`G${r(22)}`).value = `${typeof SinbasExcelExporter !== 'undefined' ? SinbasExcelExporter.cleanKotaNama(appProfile.kabupaten_kota || appProfile.kabupaten) : (appProfile.kabupaten || 'Tebo')}, ${tglIndo}`;
    ws.getCell(`G${r(22)}`).alignment = { horizontal: 'center' };
    ws.getCell(`G${r(22)}`).font = { name: 'Times New Roman', size: 10 };

    ws.mergeCells(`B${r(23)}:D${r(23)}`);
    ws.getCell(`B${r(23)}`).value = 'Kepala Sekolah Selaku Kuasa Pengguna Barang';
    ws.getCell(`B${r(23)}`).alignment = { horizontal: 'center' };
    ws.getCell(`B${r(23)}`).font = { name: 'Times New Roman', size: 10, bold: true };

    ws.mergeCells(`G${r(23)}:I${r(23)}`);
    ws.getCell(`G${r(23)}`).value = 'Petugas Pengurus Barang,';
    ws.getCell(`G${r(23)}`).alignment = { horizontal: 'center' };
    ws.getCell(`G${r(23)}`).font = { name: 'Times New Roman', size: 10, bold: true };

    ws.mergeCells(`B${r(27)}:D${r(27)}`);
    ws.getCell(`B${r(27)}`).value = kepalaSekolah;
    ws.getCell(`B${r(27)}`).alignment = { horizontal: 'center' };
    ws.getCell(`B${r(27)}`).font = { name: 'Times New Roman', size: 10, bold: true, underline: true };

    ws.mergeCells(`G${r(27)}:I${r(27)}`);
    ws.getCell(`G${r(27)}`).value = pengurus;
    ws.getCell(`G${r(27)}`).alignment = { horizontal: 'center' };
    ws.getCell(`G${r(27)}`).font = { name: 'Times New Roman', size: 10, bold: true, underline: true };

    ws.mergeCells(`B${r(28)}:D${r(28)}`);
    ws.getCell(`B${r(28)}`).value = `NIP. ${nipKepala}`;
    ws.getCell(`B${r(28)}`).alignment = { horizontal: 'center' };
    ws.getCell(`B${r(28)}`).font = { name: 'Times New Roman', size: 10 };

    ws.mergeCells(`G${r(28)}:I${r(28)}`);
    ws.getCell(`G${r(28)}`).value = `NIP. ${nipPengurus}`;
    ws.getCell(`G${r(28)}`).alignment = { horizontal: 'center' };
    ws.getCell(`G${r(28)}`).font = { name: 'Times New Roman', size: 10 };

    const buffer = await wb.xlsx.writeBuffer();
    const fileName = `Berita_Acara_Penghapusan_${h.nibar}_Reg_${h.no_register || '1'}.xlsx`;

    if (window.sinbasAPI && window.sinbasAPI.isElectron) {
        try {
            const uint8 = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < uint8.byteLength; i++) {
                binary += String.fromCharCode(uint8[i]);
            }
            const base64Data = btoa(binary);

            const result = await window.sinbasAPI.showSaveDialog({
                title: 'Simpan Lembar Berita Acara Excel (A4)',
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
                            html: `Lembar Berita Acara (Excel A4) berhasil disimpan ke:<br><small class="text-primary font-monospace">${result.filePath}</small>`,
                            confirmButtonText: 'Buka Folder'
                        }).then(sw => {
                            if (sw.isConfirmed) {
                                window.sinbasAPI.openPath(result.filePath);
                            }
                        });
                    }
                    return;
                }
            } else {
                return;
            }
        } catch (err) {
            console.warn('[ExcelExporter] Electron save dialog fallback:', err);
        }
    }

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
}

// =========================================================================
// MENU 2: MASTER DATA (TAB 1: MASTER RUANGAN)
// =========================================================================
function renderMasterRuanganTable() {
    const tbody = document.getElementById('ruanganTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (allRooms.length === 0) {
        renderTablePagination('ruangan', 0);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Belum ada ruangan terdaftar. Klik "+ Tambah Ruangan".</td></tr>';
        return;
    }

    const totalItems = allRooms.length;
    renderTablePagination('ruangan', totalItems);
    const pState = tablePagination.ruangan;
    const startIdx = (pState.page - 1) * pState.perPage;
    const pagedRooms = allRooms.slice(startIdx, startIdx + pState.perPage);

    pagedRooms.forEach((r, idx) => {
        const assetCount = allAssets.filter(a => a.ruangan_id === r.id).length;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">${startIdx + idx + 1}</td>
            <td><b class="text-cyan font-monospace">${r.kode_ruangan}</b></td>
            <td><div class="fw-bold">${r.nama_ruangan}</div></td>
            <td>${r.lokasi_gedung || '-'}</td>
            <td>${r.penanggung_jawab || '-'}<br><small class="text-muted">NIP: ${r.nip_penanggung_jawab || '-'}</small></td>
            <td class="text-center"><span class="badge bg-primary px-3 py-1">${assetCount} Aset</span></td>
            <td class="text-center">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-secondary" title="Edit Ruangan" onclick="openModalEditRuang('${r.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline-danger" title="Hapus Ruangan" onclick="deleteRuangan('${r.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openModalTambahRuang() {
    document.getElementById('formModalRuangan').reset();
    document.getElementById('modal_ruang_mode').value = 'add';
    document.getElementById('modal_ruang_id').value = '';
    document.getElementById('modalRuangTitle').innerHTML = '<i class="fas fa-plus-circle text-teal me-2"></i>Tambah Ruangan Baru';

    const modal = new bootstrap.Modal(document.getElementById('modalFormRuangan'));
    modal.show();
}

function openModalEditRuang(ruangId) {
    const r = allRooms.find(x => x.id === ruangId);
    if (!r) return;

    document.getElementById('modal_ruang_mode').value = 'edit';
    document.getElementById('modal_ruang_id').value = r.id;
    document.getElementById('modalRuangTitle').innerHTML = '<i class="fas fa-edit text-warning me-2"></i>Edit Data Ruangan';

    document.getElementById('ruang_kode').value = r.kode_ruangan;
    document.getElementById('ruang_nama').value = r.nama_ruangan;
    document.getElementById('ruang_gedung').value = r.lokasi_gedung || '';
    document.getElementById('ruang_pj').value = r.penanggung_jawab || '';
    document.getElementById('ruang_nip').value = r.nip_penanggung_jawab || '';
    document.getElementById('ruang_ket').value = r.keterangan || '';

    const modal = new bootstrap.Modal(document.getElementById('modalFormRuangan'));
    modal.show();
}

async function saveModalRuangan() {
    const mode = document.getElementById('modal_ruang_mode').value;
    const ruangId = document.getElementById('modal_ruang_id').value;

    const kode = document.getElementById('ruang_kode').value.trim();
    const nama = document.getElementById('ruang_nama').value.trim();
    const gedung = document.getElementById('ruang_gedung').value.trim();
    const pj = document.getElementById('ruang_pj').value.trim();
    const nip = document.getElementById('ruang_nip').value.trim();
    const ket = document.getElementById('ruang_ket').value.trim();

    if (!kode || !nama) {
        alert('Kode dan Nama Ruangan wajib diisi!');
        return;
    }

    if (mode === 'edit') {
        await db.update('ruangan', ruangId, {
            kode_ruangan: kode,
            nama_ruangan: nama,
            lokasi_gedung: gedung,
            penanggung_jawab: pj,
            nip_penanggung_jawab: nip,
            keterangan: ket
        });
    } else {
        const newR = {
            id: 'R-' + Date.now(),
            kode_ruangan: kode,
            nama_ruangan: nama,
            lokasi_gedung: gedung,
            penanggung_jawab: pj,
            nip_penanggung_jawab: nip,
            keterangan: ket
        };
        await db.put('ruangan', newR);
    }

    await loadRooms();
    renderMasterRuanganTable();
    renderKirView();

    const modalEl = document.getElementById('modalFormRuangan');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: mode === 'edit' ? 'Ruangan Diperbarui!' : 'Ruangan Ditambahkan!',
            text: `Ruangan ${nama} (${kode}) siap digunakan.`
        });
    }
}

async function deleteRuangan(ruangId) {
    const r = allRooms.find(x => x.id === ruangId);
    if (!r) return;

    const hasAssets = allAssets.some(a => a.ruangan_id === ruangId);
    if (hasAssets) {
        Swal.fire({
            icon: 'error',
            title: 'Ruangan Tidak Dapat Dihapus!',
            text: `Ruangan ${r.nama_ruangan} masih memiliki barang inventaris yang terdaftar. Pindahkan (mutasikan) barang terlebih dahulu.`
        });
        return;
    }

    Swal.fire({
        icon: 'warning',
        title: 'Hapus Ruangan Ini?',
        text: `Apakah Anda yakin ingin menghapus ruangan "${r.nama_ruangan}"?`,
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Hapus'
    }).then(async res => {
        if (res.isConfirmed) {
            await db.delete('ruangan', ruangId);
            await loadRooms();
            renderMasterRuanganTable();
            renderKirView();
        }
    });
}

function initMasterKode5LevelFilters() {
    const selJenis = document.getElementById('filter_mkb_jenis');
    const selObjek = document.getElementById('filter_mkb_objek');
    const selRincian = document.getElementById('filter_mkb_rincian');
    const selSubRincian = document.getElementById('filter_mkb_sub_rincian');
    const selBarang = document.getElementById('filter_mkb_barang');

    if (!selJenis) return;

    selJenis.innerHTML = '<option value="">-- Semua Jenis (A-F) --</option>';
    if (typeof PERMENDAGRI_JENIS !== 'undefined') {
        PERMENDAGRI_JENIS.forEach(j => {
            const opt = document.createElement('option');
            opt.value = j.kode;
            opt.textContent = `${j.kode} — ${j.nama} (KIB ${j.kib})`;
            selJenis.appendChild(opt);
        });
    }

    selJenis.addEventListener('change', () => onMasterKodeJenisChanged(selJenis.value));
    if (selObjek) selObjek.addEventListener('change', () => onMasterKodeObjekChanged(selObjek.value));
    if (selRincian) selRincian.addEventListener('change', () => onMasterKodeRincianChanged(selRincian.value));
    if (selSubRincian) selSubRincian.addEventListener('change', () => onMasterKodeSubRincianChanged(selSubRincian.value));
    if (selBarang) selBarang.addEventListener('change', () => onMasterKodeBarangChanged(selBarang.value));
}

function onMasterKodeJenisChanged(jenisKode) {
    const selObjek = document.getElementById('filter_mkb_objek');
    const selRincian = document.getElementById('filter_mkb_rincian');
    const selSubRincian = document.getElementById('filter_mkb_sub_rincian');
    const selBarang = document.getElementById('filter_mkb_barang');

    if (selObjek) {
        selObjek.innerHTML = '<option value="">-- Semua Objek --</option>';
        selObjek.disabled = true;
    }
    if (selRincian) {
        selRincian.innerHTML = '<option value="">-- Semua Rincian --</option>';
        selRincian.disabled = true;
    }
    if (selSubRincian) {
        selSubRincian.innerHTML = '<option value="">-- Semua Sub Rincian --</option>';
        selSubRincian.disabled = true;
    }
    if (selBarang) {
        selBarang.innerHTML = '<option value="">-- Semua Barang Spesifik --</option>';
        selBarang.disabled = true;
    }

    if (jenisKode && typeof PERMENDAGRI_OBJEK !== 'undefined' && selObjek) {
        const filtered = PERMENDAGRI_OBJEK.filter(o => o.p === jenisKode);
        filtered.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.k;
            opt.textContent = `${o.k} — ${o.n}`;
            selObjek.appendChild(opt);
        });
        selObjek.disabled = false;
    }

    renderMasterKodeBarangTable();
}

function onMasterKodeObjekChanged(objekKode) {
    const selRincian = document.getElementById('filter_mkb_rincian');
    const selSubRincian = document.getElementById('filter_mkb_sub_rincian');
    const selBarang = document.getElementById('filter_mkb_barang');

    if (selRincian) {
        selRincian.innerHTML = '<option value="">-- Semua Rincian --</option>';
        selRincian.disabled = true;
    }
    if (selSubRincian) {
        selSubRincian.innerHTML = '<option value="">-- Semua Sub Rincian --</option>';
        selSubRincian.disabled = true;
    }
    if (selBarang) {
        selBarang.innerHTML = '<option value="">-- Semua Barang Spesifik --</option>';
        selBarang.disabled = true;
    }

    if (objekKode && typeof PERMENDAGRI_RINCIAN !== 'undefined' && selRincian) {
        const filtered = PERMENDAGRI_RINCIAN.filter(r => r.p === objekKode);
        filtered.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.k;
            opt.textContent = `${r.k} — ${r.n}`;
            selRincian.appendChild(opt);
        });
        selRincian.disabled = false;
    }

    renderMasterKodeBarangTable();
}

function onMasterKodeRincianChanged(rincianKode) {
    const selSubRincian = document.getElementById('filter_mkb_sub_rincian');
    const selBarang = document.getElementById('filter_mkb_barang');

    if (selSubRincian) {
        selSubRincian.innerHTML = '<option value="">-- Semua Sub Rincian --</option>';
        selSubRincian.disabled = true;
    }
    if (selBarang) {
        selBarang.innerHTML = '<option value="">-- Semua Barang Spesifik --</option>';
        selBarang.disabled = true;
    }

    if (rincianKode && typeof PERMENDAGRI_SUB_RINCIAN !== 'undefined' && selSubRincian) {
        const filtered = PERMENDAGRI_SUB_RINCIAN.filter(sr => sr.p === rincianKode);
        filtered.forEach(sr => {
            const opt = document.createElement('option');
            opt.value = sr.k;
            opt.textContent = `${sr.k} — ${sr.n}`;
            selSubRincian.appendChild(opt);
        });
        selSubRincian.disabled = false;
    }

    renderMasterKodeBarangTable();
}

function onMasterKodeSubRincianChanged(subRincianKode) {
    const selBarang = document.getElementById('filter_mkb_barang');

    if (selBarang) {
        selBarang.innerHTML = '<option value="">-- Semua Barang Spesifik --</option>';
        selBarang.disabled = true;
    }

    if (subRincianKode && typeof PERMENDAGRI_BARANG !== 'undefined' && selBarang) {
        const filtered = PERMENDAGRI_BARANG.filter(b => b.p === subRincianKode);
        filtered.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.k;
            opt.textContent = `${b.k} — ${b.n}`;
            selBarang.appendChild(opt);
        });

        // Sertakan juga kode kustom jika ada
        if (Array.isArray(customKodeBarang)) {
            customKodeBarang.forEach(c => {
                const parts = c.kode.split('.');
                const parentSr = parts.slice(0, 6).join('.');
                if (parentSr === subRincianKode) {
                    const opt = document.createElement('option');
                    opt.value = c.kode;
                    opt.textContent = `${c.kode} — ${c.nama} [Kustom]`;
                    selBarang.appendChild(opt);
                }
            });
        }
        selBarang.disabled = false;
    }

    renderMasterKodeBarangTable();
}

function onMasterKodeBarangChanged(barangKode) {
    renderMasterKodeBarangTable();
}

function resetMasterKodeFilters() {
    const selJenis = document.getElementById('filter_mkb_jenis');
    if (selJenis) selJenis.value = '';
    onMasterKodeJenisChanged('');
    const sInput = document.getElementById('search_mkb');
    if (sInput) sInput.value = '';
    renderMasterKodeBarangTable();
}

// =========================================================================
// MENU 2: MASTER DATA (TAB 2: MASTER KODE BARANG PERMENDAGRI + KUSTOM)
// =========================================================================
function renderMasterKodeBarangTable() {
    const tbody = document.getElementById('kodeBarangTableBody');
    if (!tbody) return;

    const allCodes = getAllKodeBarangCombined();
    const jenisKode = document.getElementById('filter_mkb_jenis')?.value || '';
    const objekKode = document.getElementById('filter_mkb_objek')?.value || '';
    const rincianKode = document.getElementById('filter_mkb_rincian')?.value || '';
    const subRincianKode = document.getElementById('filter_mkb_sub_rincian')?.value || '';
    const barangKode = document.getElementById('filter_mkb_barang')?.value || '';
    const searchTxt = document.getElementById('search_mkb')?.value?.toLowerCase().trim() || '';

    let list = [...allCodes];
    let badgeText = 'Semua Kelompok Barang (A - F)';

    if (barangKode) {
        list = list.filter(c => c.kode === barangKode);
        badgeText = `Barang: ${barangKode}`;
    } else if (subRincianKode) {
        list = list.filter(c => c.kode.startsWith(subRincianKode + '.'));
        badgeText = `Sub Rincian: ${subRincianKode}`;
    } else if (rincianKode) {
        list = list.filter(c => c.kode.startsWith(rincianKode + '.'));
        badgeText = `Rincian: ${rincianKode}`;
    } else if (objekKode) {
        list = list.filter(c => c.kode.startsWith(objekKode + '.'));
        badgeText = `Objek: ${objekKode}`;
    } else if (jenisKode) {
        list = list.filter(c => c.kode.startsWith(jenisKode + '.'));
        const jItem = typeof PERMENDAGRI_JENIS !== 'undefined' ? PERMENDAGRI_JENIS.find(j => j.kode === jenisKode) : null;
        badgeText = `Jenis Aset: ${jenisKode} — ${jItem ? jItem.nama : ''} (KIB ${jItem ? jItem.kib : ''})`;
    }

    const badgeEl = document.getElementById('filter_mkb_active_badge');
    if (badgeEl) badgeEl.textContent = `Menampilkan: ${badgeText}`;

    if (searchTxt) {
        list = list.filter(c =>
            c.kode.toLowerCase().includes(searchTxt) ||
            c.nama.toLowerCase().includes(searchTxt) ||
            (c.kategori && c.kategori.toLowerCase().includes(searchTxt))
        );
    }

    const countEl = document.getElementById('count_master_kode');
    if (countEl) countEl.textContent = list.length;
    tbody.innerHTML = '';

    if (list.length === 0) {
        renderTablePagination('kode_barang', 0);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted"><i class="fas fa-search fa-2x mb-2 d-block"></i>Tidak ada kode barang yang sesuai dengan filter atau kata kunci.</td></tr>';
        return;
    }

    const totalItems = list.length;
    renderTablePagination('kode_barang', totalItems);
    const pState = tablePagination.kode_barang;
    const startIdx = (pState.page - 1) * pState.perPage;
    const pagedCodes = list.slice(startIdx, startIdx + pState.perPage);

    pagedCodes.forEach((c, idx) => {
        const isCustom = !!c.is_custom || (Array.isArray(customKodeBarang) && customKodeBarang.some(x => x.kode === c.kode));
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">${startIdx + idx + 1}</td>
            <td class="text-center"><span class="badge bg-primary">KIB ${c.kib}</span></td>
            <td><span class="badge-kode font-monospace">${c.kode}</span></td>
            <td><b>${c.nama}</b></td>
            <td><span class="badge bg-secondary">${c.kategori || '-'}</span></td>
            <td><small class="text-muted">${c.deskripsi || '-'}</small></td>
            <td class="text-center">
                ${isCustom 
                    ? '<span class="badge bg-cyan text-dark"><i class="fas fa-user-edit me-1"></i>Kustom</span>' 
                    : '<span class="badge bg-light text-secondary border"><i class="fas fa-shield-alt me-1 text-primary"></i>Permendagri</span>'}
            </td>
            <td class="text-center">
                ${isCustom 
                    ? `<button type="button" class="btn btn-sm btn-outline-danger px-2 py-1" onclick="deleteCustomKodeBarang('${c.kode}', '${c.id || ''}')" title="Hapus Kode Kustom"><i class="fas fa-trash-alt me-1"></i>Hapus</button>` 
                    : '<span class="badge bg-light text-secondary border" title="Kodefikasi bawaan standar nasional terlindungi"><i class="fas fa-lock me-1"></i>Bawaan</span>'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}


// =========================================================================
// MENU 2: MASTER DATA (TAB 3: MASTER KATALOG BPH - REFERENSI BARANG)
// =========================================================================
function renderMasterBphTable() {
    const tbody = document.getElementById('bphTableBody');
    if (!tbody) return;

    const statCountEl = document.getElementById('stat_total_master_bph');
    if (statCountEl) {
        statCountEl.textContent = `${allMasterBph.length} Jenis Barang`;
    }

    const searchTxt = document.getElementById('search_bph')?.value?.toLowerCase().trim() || '';
    let list = [...allMasterBph];
    if (searchTxt) {
        list = list.filter(b =>
            (b.nama_barang && b.nama_barang.toLowerCase().includes(searchTxt)) ||
            (b.kode_bph && b.kode_bph.toLowerCase().includes(searchTxt)) ||
            (b.kategori && b.kategori.toLowerCase().includes(searchTxt)) ||
            (b.spesifikasi && b.spesifikasi.toLowerCase().includes(searchTxt)) ||
            (b.keterangan && b.keterangan.toLowerCase().includes(searchTxt))
        );
    }

    tbody.innerHTML = '';
    if (list.length === 0) {
        renderTablePagination('master_bph', 0);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">Belum ada data Katalog Barang Pakai Habis. Klik "+ Tambah Master BPH".</td></tr>';
        return;
    }

    const totalItems = list.length;
    renderTablePagination('master_bph', totalItems);
    const pState = tablePagination.master_bph;
    const startIdx = (pState.page - 1) * pState.perPage;
    const pagedBph = list.slice(startIdx, startIdx + pState.perPage);

    pagedBph.forEach((b, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">${startIdx + idx + 1}</td>
            <td><span class="badge-kode font-monospace">${b.kode_bph || '-'}</span></td>
            <td><div class="fw-bold text-dark">${b.nama_barang}</div></td>
            <td><span class="badge bg-secondary">${b.kategori || 'ATK'}</span></td>
            <td class="text-center"><span class="badge bg-info text-dark font-monospace">${b.satuan || 'Pcs'}</span></td>
            <td><small class="text-secondary">${b.spesifikasi || '-'}</small></td>
            <td><small class="text-muted">${b.keterangan || '-'}</small></td>
            <td class="text-center">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-secondary" title="Edit Katalog BPH" onclick="openModalEditMasterBph('${b.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline-danger" title="Hapus Katalog BPH" onclick="deleteMasterBph('${b.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openModalTambahMasterBph() {
    const form = document.getElementById('formModalBph');
    if (form) form.reset();

    document.getElementById('modal_bph_mode').value = 'add';
    document.getElementById('modal_bph_id').value = '';
    document.getElementById('modalBphTitle').innerHTML = '<i class="fas fa-boxes text-amber me-2"></i>Tambah Master Katalog BPH';

    // Auto-generate kode berikutnya
    const nextNum = String(allMasterBph.length + 1).padStart(3, '0');
    document.getElementById('bph_kode').value = `1.1.7.01.01.${nextNum}`;

    const modal = new bootstrap.Modal(document.getElementById('modalFormBph'));
    modal.show();
}

function openModalEditMasterBph(masterId) {
    const b = allMasterBph.find(x => x.id === masterId);
    if (!b) return;

    document.getElementById('modal_bph_mode').value = 'edit';
    document.getElementById('modal_bph_id').value = b.id;
    document.getElementById('modalBphTitle').innerHTML = '<i class="fas fa-edit text-warning me-2"></i>Edit Master Katalog BPH';

    document.getElementById('bph_kode').value = b.kode_bph || '';
    document.getElementById('bph_nama').value = b.nama_barang || '';
    document.getElementById('bph_kategori').value = b.kategori || 'Alat Tulis Kantor (ATK)';
    document.getElementById('bph_satuan').value = b.satuan || 'Pcs';
    document.getElementById('bph_spesifikasi').value = b.spesifikasi || '';
    document.getElementById('bph_ket').value = b.keterangan || '';

    const modal = new bootstrap.Modal(document.getElementById('modalFormBph'));
    modal.show();
}

async function saveModalMasterBph() {
    const mode = document.getElementById('modal_bph_mode').value;
    const masterId = document.getElementById('modal_bph_id').value;

    const kode = document.getElementById('bph_kode').value.trim();
    const nama = document.getElementById('bph_nama').value.trim();
    const kategori = document.getElementById('bph_kategori').value.trim();
    const satuan = document.getElementById('bph_satuan').value.trim();
    const spesifikasi = document.getElementById('bph_spesifikasi').value.trim();
    const ket = document.getElementById('bph_ket').value.trim();

    if (!nama) {
        alert('Nama Barang Pakai Habis wajib diisi!');
        return;
    }

    if (mode === 'edit') {
        await db.update('master_bph', masterId, {
            kode_bph: kode,
            nama_barang: nama,
            kategori: kategori,
            satuan: satuan,
            spesifikasi: spesifikasi,
            keterangan: ket,
            updated_at: new Date().toISOString()
        });
    } else {
        const item = {
            id: 'MBPH-' + Date.now(),
            kode_bph: kode || `1.1.7.01.01.${String(allMasterBph.length + 1).padStart(3, '0')}`,
            nama_barang: nama,
            kategori: kategori,
            satuan: satuan || 'Pcs',
            spesifikasi: spesifikasi,
            keterangan: ket,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        await db.put('master_bph', item);
    }

    await loadMasterBph();
    renderMasterBphTable();

    const modalEl = document.getElementById('modalFormBph');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: mode === 'edit' ? 'Katalog Diperbarui!' : 'Katalog Ditambahkan!',
            text: `Data "${nama}" telah tersimpan di katalog referensi BPH.`
        });
    }
}

async function deleteMasterBph(masterId) {
    const b = allMasterBph.find(x => x.id === masterId);
    if (!b) return;

    // Periksa apakah sudah ada transaksi masuk atau keluar untuk barang ini
    const isUsedInMasuk = allBphMasuk.some(m => m.master_bph_id === masterId);
    const isUsedInKeluar = allBphKeluar.some(k => k.master_bph_id === masterId);

    if (isUsedInMasuk || isUsedInKeluar) {
        Swal.fire({
            icon: 'error',
            title: 'Katalog Tidak Dapat Dihapus',
            text: `Barang "${b.nama_barang}" sudah tercatat dalam riwayat mutasi masuk/keluar. Hapus transaksi mutasinya terlebih dahulu.`
        });
        return;
    }

    Swal.fire({
        icon: 'warning',
        title: 'Hapus Master Katalog BPH?',
        text: `Apakah Anda yakin ingin menghapus referensi "${b.nama_barang}"?`,
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Hapus'
    }).then(async res => {
        if (res.isConfirmed) {
            await db.delete('master_bph', masterId);
            await loadMasterBph();
            renderMasterBphTable();
        }
    });
}

function exportMasterBphExcel() {
    const rows = [
        ['KATALOG REFERENSI BARANG PAKAI HABIS (BPH) SEKOLAH'],
        [`Satuan Kerja: ${appProfile.nama_sekolah || 'SINBAS'} | Tahun Anggaran: ${appProfile.tahun_anggaran || '2026'}`],
        [],
        ['No.', 'Kode BPH', 'Nama Resmi Barang BPH', 'Kategori', 'Satuan Standar', 'Spesifikasi Teknis / Ukuran', 'Catatan / Penggunaan']
    ];

    allMasterBph.forEach((b, idx) => {
        rows.push([
            idx + 1,
            b.kode_bph || '-',
            b.nama_barang,
            b.kategori || 'ATK',
            b.satuan || 'Pcs',
            b.spesifikasi || '-',
            b.keterangan || '-'
        ]);
    });

    SinbasExcelExporter.generateFile(rows, `Katalog_Master_BPH_${appProfile.tahun_anggaran || '2026'}.xlsx`, 'Katalog BPH', [
        { wch: 5 }, { wch: 22 }, { wch: 38 }, { wch: 22 }, { wch: 14 }, { wch: 35 }, { wch: 30 }
    ]);
}

// =========================================================================
// ENGINE KALKULASI: MUTASI BULANAN & SALDO ROLL-FORWARD BPH
// =========================================================================
function parseBphYearMonth(dateStr) {
    if (!dateStr) return { year: 2026, month: 1 };
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
        return {
            year: parseInt(parts[0], 10) || 2026,
            month: parseInt(parts[1], 10) || 1
        };
    }
    const d = new Date(dateStr);
    return {
        year: d.getFullYear() || 2026,
        month: (d.getMonth() + 1) || 1
    };
}

function formatBphDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (_) {
        return dateStr;
    }
}

function getAvailableStockBph(masterId) {
    if (!masterId) return 0;
    const totalMasuk = allBphMasuk
        .filter(m => m.master_bph_id === masterId)
        .reduce((sum, m) => sum + (Number(m.jumlah) || 0), 0);
    const totalKeluar = allBphKeluar
        .filter(k => k.master_bph_id === masterId)
        .reduce((sum, k) => sum + (Number(k.jumlah) || 0), 0);
    return Math.max(0, totalMasuk - totalKeluar);
}

function getStockBalanceAtDate(masterId, dateStr) {
    if (!masterId) return 0;
    const cutoffDate = dateStr || '9999-99-99';
    const totalMasuk = allBphMasuk
        .filter(m => m.master_bph_id === masterId && (m.tanggal || '') <= cutoffDate)
        .reduce((sum, m) => sum + (Number(m.jumlah) || 0), 0);
    const totalKeluar = allBphKeluar
        .filter(k => k.master_bph_id === masterId && (k.tanggal || '') <= cutoffDate)
        .reduce((sum, k) => sum + (Number(k.jumlah) || 0), 0);
    return Math.max(0, totalMasuk - totalKeluar);
}

function calculateBphBalances(targetTahun, targetBulan) {
    const yr = parseInt(targetTahun, 10) || 2026;
    const mo = parseInt(targetBulan, 10) || 0;

    return allMasterBph.map(b => {
        const masukList = allBphMasuk.filter(m => m.master_bph_id === b.id);
        const keluarList = allBphKeluar.filter(k => k.master_bph_id === b.id);

        let saldoAwal = 0;
        let masukPeriode = 0;
        let keluarPeriode = 0;

        // Hitung Saldo Awal & Mutasi Masuk
        masukList.forEach(m => {
            const ym = parseBphYearMonth(m.tanggal);
            const qty = Number(m.jumlah) || 0;
            if (mo === 0) {
                if (ym.year < yr) saldoAwal += qty;
                else if (ym.year === yr) masukPeriode += qty;
            } else {
                if (ym.year < yr || (ym.year === yr && ym.month < mo)) saldoAwal += qty;
                else if (ym.year === yr && ym.month === mo) masukPeriode += qty;
            }
        });

        // Hitung Mutasi Keluar
        keluarList.forEach(k => {
            const ym = parseBphYearMonth(k.tanggal);
            const qty = Number(k.jumlah) || 0;
            if (mo === 0) {
                if (ym.year < yr) saldoAwal -= qty;
                else if (ym.year === yr) keluarPeriode += qty;
            } else {
                if (ym.year < yr || (ym.year === yr && ym.month < mo)) saldoAwal -= qty;
                else if (ym.year === yr && ym.month === mo) keluarPeriode += qty;
            }
        });

        const saldoAkhir = saldoAwal + masukPeriode - keluarPeriode;

        // Cari harga satuan pengadaan terakhir untuk valuasi persediaan
        let latestHarga = 0;
        if (masukList.length > 0) {
            const sorted = [...masukList].sort((x, y) => (y.tanggal || '').localeCompare(x.tanggal || ''));
            latestHarga = Number(sorted[0].harga_satuan) || 0;
        }
        const nilaiSaldo = Math.max(0, saldoAkhir) * latestHarga;

        return {
            master: b,
            saldoAwal,
            masuk: masukPeriode,
            keluar: keluarPeriode,
            saldoAkhir,
            hargaSatuan: latestHarga,
            nilaiSaldo
        };
    });
}

// =========================================================================
// MENU: BUKU PERSEDIAAN & RIWAYAT BPH (VIEW CONTROLLER & SUBTABS)
// =========================================================================
function onBphFilterChanged() {
    const selTahun = document.getElementById('filter_bph_tahun');
    const selBulan = document.getElementById('filter_bph_bulan');
    if (selTahun) currentBphFilterTahun = parseInt(selTahun.value, 10) || 2026;
    if (selBulan) currentBphFilterBulan = parseInt(selBulan.value, 10) || 0;

    renderBphPersediaanView();
}

function switchBphSubTab(subTab) {
    currentBphSubTab = subTab;

    const btnMasuk = document.getElementById('btnSubtabBphMasuk');
    const btnKeluar = document.getElementById('btnSubtabBphKeluar');
    const btnSaldo = document.getElementById('btnSubtabBphSaldo');
    if (btnMasuk) btnMasuk.classList.toggle('active', subTab === 'masuk');
    if (btnKeluar) btnKeluar.classList.toggle('active', subTab === 'keluar');
    if (btnSaldo) btnSaldo.classList.toggle('active', subTab === 'saldo');

    const paneMasuk = document.getElementById('subpane_bph_masuk') || document.getElementById('bph_subpane_masuk');
    const paneKeluar = document.getElementById('subpane_bph_keluar') || document.getElementById('bph_subpane_keluar');
    const paneSaldo = document.getElementById('subpane_bph_saldo') || document.getElementById('bph_subpane_saldo');
    if (paneMasuk) paneMasuk.classList.toggle('d-none', subTab !== 'masuk');
    if (paneKeluar) paneKeluar.classList.toggle('d-none', subTab !== 'keluar');
    if (paneSaldo) paneSaldo.classList.toggle('d-none', subTab !== 'saldo');

    renderBphPersediaanView();
}

function renderBphPersediaanView() {
    const namaBulan = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const periodeLabel = currentBphFilterBulan > 0 
        ? `${namaBulan[currentBphFilterBulan]} ${currentBphFilterTahun}` 
        : `Semua Bulan (Tahun ${currentBphFilterTahun})`;

    const lblMasuk = document.getElementById('lbl_bph_masuk_periode');
    const lblKeluar = document.getElementById('lbl_bph_keluar_periode');
    const lblSaldo = document.getElementById('lbl_bph_saldo_periode');
    if (lblMasuk) lblMasuk.textContent = periodeLabel;
    if (lblKeluar) lblKeluar.textContent = periodeLabel;
    if (lblSaldo) lblSaldo.textContent = periodeLabel;

    // Hitung balances untuk periode aktif
    const balances = calculateBphBalances(currentBphFilterTahun, currentBphFilterBulan);

    // Hitung KPI
    let totalQtyMasuk = 0;
    let totalNilaiMasuk = 0;
    let totalQtyKeluar = 0;
    let totalSisaStok = 0;
    let totalNilaiPersediaan = 0;

    balances.forEach(b => {
        totalQtyMasuk += b.masuk;
        totalQtyKeluar += b.keluar;
        totalSisaStok += Math.max(0, b.saldoAkhir);
        totalNilaiPersediaan += b.nilaiSaldo;
    });

    // Hitung total nilai masuk periode dari allBphMasuk
    allBphMasuk.forEach(m => {
        const ym = parseBphYearMonth(m.tanggal);
        if (ym.year === currentBphFilterTahun && (currentBphFilterBulan === 0 || ym.month === currentBphFilterBulan)) {
            totalNilaiMasuk += Number(m.total_nilai || (m.jumlah * m.harga_satuan)) || 0;
        }
    });

    const elMasukVal = document.getElementById('stat_bph_total_masuk');
    const elMasukRp = document.getElementById('stat_bph_nilai_masuk');
    const elKeluarVal = document.getElementById('stat_bph_total_keluar');
    const elSisaVal = document.getElementById('stat_bph_sisa_stok');
    const elNilaiPersediaan = document.getElementById('stat_bph_nilai_persediaan');

    if (elMasukVal) elMasukVal.textContent = totalQtyMasuk.toLocaleString('id-ID');
    if (elMasukRp) elMasukRp.textContent = 'Rp ' + totalNilaiMasuk.toLocaleString('id-ID');
    if (elKeluarVal) elKeluarVal.textContent = totalQtyKeluar.toLocaleString('id-ID');
    if (elSisaVal) elSisaVal.textContent = totalSisaStok.toLocaleString('id-ID');
    if (elNilaiPersediaan) elNilaiPersediaan.textContent = 'Rp ' + totalNilaiPersediaan.toLocaleString('id-ID');

    // Render subpane aktif
    if (currentBphSubTab === 'masuk') {
        renderBphMasukTable();
    } else if (currentBphSubTab === 'keluar') {
        renderBphKeluarTable();
    } else if (currentBphSubTab === 'saldo') {
        renderBphBukuPersediaanTable();
    }
}

// =========================================================================
// SUBTAB 1: BPH MASUK (CRUD PENERIMAAN / PENGADAAN)
// =========================================================================
function renderBphMasukTable() {
    const tbody = document.getElementById('bphMasukTableBody');
    if (!tbody) return;

    const searchTxt = (document.getElementById('search_bph_m')?.value || document.getElementById('search_bph_trx')?.value || '').toLowerCase().trim();

    let list = allBphMasuk.filter(m => {
        const ym = parseBphYearMonth(m.tanggal);
        if (ym.year !== currentBphFilterTahun) return false;
        if (currentBphFilterBulan > 0 && ym.month !== currentBphFilterBulan) return false;

        if (searchTxt) {
            const master = allMasterBph.find(b => b.id === m.master_bph_id);
            const nama = (master ? master.nama_barang : m.nama_barang || '').toLowerCase();
            const kode = (master ? master.kode_bph : m.kode_bph || '').toLowerCase();
            const bukti = (m.no_bukti || '').toLowerCase();
            const rekanan = (m.rekanan || '').toLowerCase();
            const ket = (m.keterangan || '').toLowerCase();
            return nama.includes(searchTxt) || kode.includes(searchTxt) || bukti.includes(searchTxt) || rekanan.includes(searchTxt) || ket.includes(searchTxt);
        }
        return true;
    });

    list.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

    tbody.innerHTML = '';
    if (list.length === 0) {
        renderTablePagination('bph_masuk', 0);
        tbody.innerHTML = '<tr><td colspan="12" class="text-center py-4 text-muted">Belum ada transaksi BPH Masuk pada periode ini. Klik "+ Catat BPH Masuk".</td></tr>';
        return;
    }

    const totalItems = list.length;
    renderTablePagination('bph_masuk', totalItems);
    const pState = tablePagination.bph_masuk;
    const startIdx = (pState.page - 1) * pState.perPage;
    const pagedMasuk = list.slice(startIdx, startIdx + pState.perPage);

    pagedMasuk.forEach((m, idx) => {
        const master = allMasterBph.find(b => b.id === m.master_bph_id);
        const nama = master ? master.nama_barang : (m.nama_barang || 'Barang BPH');
        const kode = master ? master.kode_bph : (m.kode_bph || '-');
        const kategori = master ? master.kategori : (m.kategori || 'ATK');
        const satuan = master ? master.satuan : (m.satuan || 'Pcs');
        const total = Number(m.total_nilai || (m.jumlah * m.harga_satuan)) || 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">${startIdx + idx + 1}</td>
            <td class="font-monospace">${formatBphDate(m.tanggal)}</td>
            <td><span class="badge-kode font-monospace">${kode}</span></td>
            <td><div class="fw-bold text-dark">${nama}</div></td>
            <td><span class="badge bg-secondary">${kategori}</span></td>
            <td class="text-center fw-bold text-success">+${Number(m.jumlah || 0).toLocaleString('id-ID')} ${satuan}</td>
            <td class="text-end">Rp ${(Number(m.harga_satuan) || 0).toLocaleString('id-ID')}</td>
            <td class="text-end fw-bold text-cyan">Rp ${total.toLocaleString('id-ID')}</td>
            <td><span class="badge bg-primary text-wrap">${m.sumber_dana || 'BOS Reguler'}</span></td>
            <td><span class="font-monospace small text-amber">${m.no_bukti || '-'}</span></td>
            <td><small class="text-secondary">${m.rekanan ? `<b>${m.rekanan}</b> — ` : ''}${m.keterangan || '-'}</small></td>
            <td class="text-center">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-secondary" title="Edit Masuk" onclick="openModalEditBphMasuk('${m.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline-danger" title="Hapus Masuk" onclick="deleteBphMasuk('${m.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openModalTambahBphMasuk() {
    const form = document.getElementById('formModalBphMasuk');
    if (form) form.reset();

    document.getElementById('modal_bph_masuk_mode').value = 'add';
    document.getElementById('modal_bph_masuk_id').value = '';
    document.getElementById('modalBphMasukTitle').innerHTML = '<i class="fas fa-arrow-down text-success me-2"></i>Catat Penerimaan BPH Masuk (Pengadaan)';

    // Isi select master katalog
    const selMaster = document.getElementById('bph_m_master_id');
    selMaster.innerHTML = '<option value="">-- Pilih Barang BPH --</option>';
    allMasterBph.forEach(b => {
        selMaster.add(new Option(`[${b.kode_bph || '-'}] ${b.nama_barang} (${b.satuan || 'Pcs'})`, b.id));
    });

    // Default tanggal hari ini dalam format YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('bph_m_tanggal').value = today;
    document.getElementById('bph_m_jumlah').value = 10;
    document.getElementById('bph_m_harga').value = 50000;
    calcBphMasukTotal();

    const modal = new bootstrap.Modal(document.getElementById('modalFormBphMasuk'));
    modal.show();
}

function onBphMasukMasterChanged() {
    const masterId = document.getElementById('bph_m_master_id').value;
    const master = allMasterBph.find(b => b.id === masterId);
    const satuanEl = document.getElementById('bph_m_satuan');
    if (satuanEl) {
        satuanEl.value = master ? (master.satuan || 'Pcs') : '';
    }
    calcBphMasukTotal();
}

function calcBphMasukTotal() {
    const qty = parseFloat(document.getElementById('bph_m_jumlah')?.value) || 0;
    const harga = parseFloat(document.getElementById('bph_m_harga')?.value) || 0;
    const total = qty * harga;

    const elDisplay = document.getElementById('bph_m_total_display');
    const elHidden = document.getElementById('bph_m_total');
    if (elDisplay) elDisplay.value = 'Rp ' + total.toLocaleString('id-ID');
    if (elHidden) elHidden.value = total;
}

function openModalEditBphMasuk(trxId) {
    const m = allBphMasuk.find(x => x.id === trxId);
    if (!m) return;

    document.getElementById('modal_bph_masuk_mode').value = 'edit';
    document.getElementById('modal_bph_masuk_id').value = m.id;
    document.getElementById('modalBphMasukTitle').innerHTML = '<i class="fas fa-edit text-warning me-2"></i>Edit Penerimaan BPH Masuk';

    const selMaster = document.getElementById('bph_m_master_id');
    selMaster.innerHTML = '<option value="">-- Pilih Barang BPH --</option>';
    allMasterBph.forEach(b => {
        selMaster.add(new Option(`[${b.kode_bph || '-'}] ${b.nama_barang} (${b.satuan || 'Pcs'})`, b.id));
    });
    selMaster.value = m.master_bph_id || '';

    document.getElementById('bph_m_tanggal').value = m.tanggal || '';
    document.getElementById('bph_m_jumlah').value = m.jumlah || 1;
    document.getElementById('bph_m_satuan').value = m.satuan || 'Pcs';
    document.getElementById('bph_m_harga').value = m.harga_satuan || 0;
    document.getElementById('bph_m_dana').value = m.sumber_dana || 'BOS Reguler';
    document.getElementById('bph_m_no_bukti').value = m.no_bukti || '';
    document.getElementById('bph_m_rekanan').value = m.rekanan || '';
    document.getElementById('bph_m_ket').value = m.keterangan || '';

    calcBphMasukTotal();

    const modal = new bootstrap.Modal(document.getElementById('modalFormBphMasuk'));
    modal.show();
}

async function saveModalBphMasuk() {
    const mode = document.getElementById('modal_bph_masuk_mode').value;
    const trxId = document.getElementById('modal_bph_masuk_id').value;

    const masterId = document.getElementById('bph_m_master_id').value;
    const tanggal = document.getElementById('bph_m_tanggal').value;
    const jumlah = parseFloat(document.getElementById('bph_m_jumlah').value) || 0;
    const satuan = document.getElementById('bph_m_satuan').value.trim();
    const harga = parseFloat(document.getElementById('bph_m_harga').value) || 0;
    const total = parseFloat(document.getElementById('bph_m_total').value) || (jumlah * harga);
    const dana = document.getElementById('bph_m_dana').value;
    const noBukti = document.getElementById('bph_m_no_bukti').value.trim();
    const rekanan = document.getElementById('bph_m_rekanan').value.trim();
    const ket = document.getElementById('bph_m_ket').value.trim();

    if (!masterId) {
        alert('Silakan pilih Barang dari Master Katalog BPH!');
        return;
    }
    if (!tanggal) {
        alert('Tanggal penerimaan masuk wajib diisi!');
        return;
    }
    if (jumlah <= 0) {
        alert('Jumlah masuk harus lebih besar dari 0!');
        return;
    }

    const master = allMasterBph.find(b => b.id === masterId);

    if (mode === 'edit') {
        await db.update('bph_masuk', trxId, {
            master_bph_id: masterId,
            nama_barang: master ? master.nama_barang : '',
            kode_bph: master ? master.kode_bph : '',
            kategori: master ? master.kategori : '',
            tanggal: tanggal,
            jumlah: jumlah,
            satuan: satuan || (master ? master.satuan : 'Pcs'),
            harga_satuan: harga,
            total_nilai: total,
            sumber_dana: dana,
            no_bukti: noBukti,
            rekanan: rekanan,
            keterangan: ket,
            updated_at: new Date().toISOString()
        });
    } else {
        const item = {
            id: 'BPH-M-' + Date.now(),
            master_bph_id: masterId,
            nama_barang: master ? master.nama_barang : '',
            kode_bph: master ? master.kode_bph : '',
            kategori: master ? master.kategori : '',
            tanggal: tanggal,
            jumlah: jumlah,
            satuan: satuan || (master ? master.satuan : 'Pcs'),
            harga_satuan: harga,
            total_nilai: total,
            sumber_dana: dana,
            no_bukti: noBukti,
            rekanan: rekanan,
            keterangan: ket,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        await db.put('bph_masuk', item);
    }

    await loadBphMasuk();
    renderBphPersediaanView();

    const modalEl = document.getElementById('modalFormBphMasuk');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: mode === 'edit' ? 'Transaksi Masuk Diperbarui!' : 'BPH Masuk Tersimpan!',
            text: `Penerimaan ${jumlah} ${satuan} ${master ? master.nama_barang : ''} berhasil dicatat.`
        });
    }
}

async function deleteBphMasuk(trxId) {
    const m = allBphMasuk.find(x => x.id === trxId);
    if (!m) return;

    Swal.fire({
        icon: 'warning',
        title: 'Hapus Catatan BPH Masuk?',
        text: `Apakah Anda yakin ingin menghapus transaksi masuk tanggal ${formatBphDate(m.tanggal)} (${m.jumlah} ${m.satuan || ''})?`,
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Hapus'
    }).then(async res => {
        if (res.isConfirmed) {
            await db.delete('bph_masuk', trxId);
            await loadBphMasuk();
            renderBphPersediaanView();
        }
    });
}

function exportBphMasukExcel(customTtd = null) {
    const rows = [
        ['DAFTAR PENERIMAAN BARANG PAKAI HABIS (BPH MASUK) SEKOLAH'],
        [`Satuan Kerja: ${appProfile.nama_sekolah || 'SINBAS'} | Tahun Anggaran: ${currentBphFilterTahun} | Periode: ${currentBphFilterBulan > 0 ? 'Bulan ' + currentBphFilterBulan : 'Semua Bulan'}`],
        [],
        ['No.', 'Tanggal Masuk', 'Kode BPH', 'Nama Barang BPH', 'Kategori', 'Jumlah Masuk', 'Satuan', 'Harga Satuan (Rp)', 'Total Nilai (Rp)', 'Sumber Dana', 'No. Bukti / Faktur', 'Rekanan Toko', 'Keterangan']
    ];

    let grandTotalQty = 0;
    let grandTotalRp = 0;

    const searchTxt = document.getElementById('search_bph_trx')?.value?.toLowerCase().trim() || '';

    let list = allBphMasuk.filter(m => {
        const ym = parseBphYearMonth(m.tanggal);
        if (ym.year !== currentBphFilterTahun) return false;
        if (currentBphFilterBulan > 0 && ym.month !== currentBphFilterBulan) return false;

        if (searchTxt) {
            const master = allMasterBph.find(b => b.id === m.master_bph_id);
            const nama = (master ? master.nama_barang : m.nama_barang || '').toLowerCase();
            const kode = (master ? master.kode_bph : m.kode_bph || '').toLowerCase();
            const bukti = (m.no_bukti || '').toLowerCase();
            const rekanan = (m.rekanan || '').toLowerCase();
            const ket = (m.keterangan || '').toLowerCase();
            return nama.includes(searchTxt) || kode.includes(searchTxt) || bukti.includes(searchTxt) || rekanan.includes(searchTxt) || ket.includes(searchTxt);
        }
        return true;
    });

    list.sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || ''));

    list.forEach((m, idx) => {
        const master = allMasterBph.find(b => b.id === m.master_bph_id);
        const nama = master ? master.nama_barang : (m.nama_barang || '');
        const kode = master ? master.kode_bph : (m.kode_bph || '-');
        const kat = master ? master.kategori : (m.kategori || 'ATK');
        const satuan = master ? master.satuan : (m.satuan || 'Pcs');
        const total = Number(m.total_nilai || (m.jumlah * m.harga_satuan)) || 0;

        grandTotalQty += Number(m.jumlah) || 0;
        grandTotalRp += total;

        rows.push([
            idx + 1,
            m.tanggal || '-',
            kode,
            nama,
            kat,
            Number(m.jumlah) || 0,
            satuan,
            Number(m.harga_satuan) || 0,
            total,
            m.sumber_dana || 'BOS Reguler',
            m.no_bukti || '-',
            m.rekanan || '-',
            m.keterangan || '-'
        ]);
    });

    rows.push(['', '', '', 'TOTAL PENERIMAAN BPH', '', grandTotalQty, '', '', grandTotalRp, '', '', '', '']);
    rows.push([]);
    SinbasExcelExporter.appendSignatures(rows, appProfile, currentBphFilterTahun, customTtd || window.currentLaporanTtd);

    SinbasExcelExporter.generateFile(rows, `BPH_Masuk_${currentBphFilterTahun}_Bulan_${currentBphFilterBulan || 'Semua'}.xlsx`, 'BPH Masuk', [
        { wch: 5 }, { wch: 14 }, { wch: 20 }, { wch: 35 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 22 }, { wch: 30 }
    ]);
}

// =========================================================================
// SUBTAB 2: BPH KELUAR (CRUD PENGELUARAN / PEMAKAIAN DENGAN KOLOM SALDO)
// =========================================================================
function renderBphKeluarTable() {
    const tbody = document.getElementById('bphKeluarTableBody');
    if (!tbody) return;

    const searchTxt = (document.getElementById('search_bph_k')?.value || document.getElementById('search_bph_trx')?.value || '').toLowerCase().trim();

    let list = allBphKeluar.filter(k => {
        const ym = parseBphYearMonth(k.tanggal);
        if (ym.year !== currentBphFilterTahun) return false;
        if (currentBphFilterBulan > 0 && ym.month !== currentBphFilterBulan) return false;

        if (searchTxt) {
            const master = allMasterBph.find(b => b.id === k.master_bph_id);
            const nama = (master ? master.nama_barang : k.nama_barang || '').toLowerCase();
            const kode = (master ? master.kode_bph : k.kode_bph || '').toLowerCase();
            const bukti = (k.no_bukti || '').toLowerCase();
            const penerima = (k.penerima || '').toLowerCase();
            const keperluan = (k.keperluan || '').toLowerCase();
            return nama.includes(searchTxt) || kode.includes(searchTxt) || bukti.includes(searchTxt) || penerima.includes(searchTxt) || keperluan.includes(searchTxt);
        }
        return true;
    });

    list.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

    tbody.innerHTML = '';
    if (list.length === 0) {
        renderTablePagination('bph_keluar', 0);
        tbody.innerHTML = '<tr><td colspan="11" class="text-center py-4 text-muted">Belum ada transaksi BPH Keluar pada periode ini. Klik "- Catat BPH Keluar".</td></tr>';
        return;
    }

    const totalItems = list.length;
    renderTablePagination('bph_keluar', totalItems);
    const pState = tablePagination.bph_keluar;
    const startIdx = (pState.page - 1) * pState.perPage;
    const pagedKeluar = list.slice(startIdx, startIdx + pState.perPage);

    pagedKeluar.forEach((k, idx) => {
        const master = allMasterBph.find(b => b.id === k.master_bph_id);
        const nama = master ? master.nama_barang : (k.nama_barang || 'Barang BPH');
        const kode = master ? master.kode_bph : (k.kode_bph || '-');
        const satuan = master ? master.satuan : (k.satuan || 'Pcs');

        const sisaSaldo = getStockBalanceAtDate(k.master_bph_id, k.tanggal);
        const room = allRooms.find(r => r.id === k.ruangan_id);
        const ruanganStr = room ? room.nama_ruangan : (k.ruangan_id || '-');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">${startIdx + idx + 1}</td>
            <td class="font-monospace">${formatBphDate(k.tanggal)}</td>
            <td><span class="badge-kode font-monospace">${kode}</span></td>
            <td><div class="fw-bold text-dark">${nama}</div></td>
            <td class="text-center fw-bold text-warning">-${Number(k.jumlah || 0).toLocaleString('id-ID')} ${satuan}</td>
            <td class="text-center" style="background: rgba(34, 197, 94, 0.08);">
                <span class="badge bg-success font-monospace px-2 py-1"><i class="fas fa-check-circle me-1"></i>Sisa: ${sisaSaldo.toLocaleString('id-ID')} ${satuan}</span>
            </td>
            <td><small class="text-secondary">${k.keperluan || '-'}</small></td>
            <td><div class="fw-bold text-cyan">${k.penerima || '-'}</div><small class="text-muted"><i class="fas fa-door-open me-1"></i>${ruanganStr}</small></td>
            <td><span class="font-monospace small text-amber">${k.no_bukti || '-'}</span></td>
            <td><small class="text-muted">${k.keterangan || '-'}</small></td>
            <td class="text-center">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-secondary" title="Edit Keluar" onclick="openModalEditBphKeluar('${k.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline-danger" title="Hapus Keluar" onclick="deleteBphKeluar('${k.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openModalTambahBphKeluar() {
    const form = document.getElementById('formModalBphKeluar');
    if (form) form.reset();

    document.getElementById('modal_bph_keluar_mode').value = 'add';
    document.getElementById('modal_bph_keluar_id').value = '';
    document.getElementById('modalBphKeluarTitle').innerHTML = '<i class="fas fa-arrow-up text-danger me-2"></i>Catat Pengeluaran BPH Keluar (Pemakaian Unit)';

    // Isi select master katalog
    const selMaster = document.getElementById('bph_k_master_id');
    selMaster.innerHTML = '<option value="">-- Pilih Barang BPH --</option>';
    allMasterBph.forEach(b => {
        const available = getAvailableStockBph(b.id);
        selMaster.add(new Option(`[${b.kode_bph || '-'}] ${b.nama_barang} (Sisa Stok: ${available} ${b.satuan || 'Pcs'})`, b.id));
    });

    // Isi select ruangan
    const selRuangan = document.getElementById('bph_k_ruangan_id');
    selRuangan.innerHTML = '<option value="">-- Pilih Ruangan / Unit --</option>';
    allRooms.forEach(r => {
        selRuangan.add(new Option(`[${r.kode_ruangan}] ${r.nama_ruangan}`, r.id));
    });

    // Default tanggal hari ini
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('bph_k_tanggal').value = today;
    document.getElementById('bph_k_jumlah').value = 1;

    onBphKeluarMasterChanged();

    const modal = new bootstrap.Modal(document.getElementById('modalFormBphKeluar'));
    modal.show();
}

function onBphKeluarMasterChanged() {
    const masterId = document.getElementById('bph_k_master_id').value;
    const master = allMasterBph.find(b => b.id === masterId);
    const satuanEl = document.getElementById('bph_k_satuan');
    const badgeStok = document.getElementById('bph_k_stok_badge');

    if (satuanEl) {
        satuanEl.value = master ? (master.satuan || 'Pcs') : '';
    }

    if (badgeStok) {
        if (!masterId) {
            badgeStok.className = 'badge bg-secondary fs-6 font-monospace';
            badgeStok.textContent = 'Pilih barang dahulu';
        } else {
            const available = getAvailableStockBph(masterId);
            const satuan = master ? (master.satuan || 'Pcs') : '';
            badgeStok.textContent = `${available} ${satuan}`;
            if (available <= 0) {
                badgeStok.className = 'badge bg-danger fs-6 font-monospace';
                badgeStok.textContent = `STOK HABIS (0 ${satuan})`;
            } else if (available < 5) {
                badgeStok.className = 'badge bg-warning text-dark fs-6 font-monospace';
            } else {
                badgeStok.className = 'badge bg-success fs-6 font-monospace';
            }
        }
    }

    validateBphKeluarQty();
}

function validateBphKeluarQty() {
    const masterId = document.getElementById('bph_k_master_id').value;
    const qtyInput = document.getElementById('bph_k_jumlah');
    if (!masterId || !qtyInput) return;

    const requested = parseFloat(qtyInput.value) || 0;
    const available = getAvailableStockBph(masterId);

    // Jika mode edit, tambahkan kembali qty transaksi saat ini ke available
    const mode = document.getElementById('modal_bph_keluar_mode').value;
    const trxId = document.getElementById('modal_bph_keluar_id').value;
    let actualAvailable = available;
    if (mode === 'edit') {
        const cur = allBphKeluar.find(x => x.id === trxId);
        if (cur && cur.master_bph_id === masterId) {
            actualAvailable += (Number(cur.jumlah) || 0);
        }
    }

    if (requested > actualAvailable) {
        qtyInput.style.borderColor = '#ef4444';
        qtyInput.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
    } else {
        qtyInput.style.borderColor = '';
        qtyInput.style.backgroundColor = '';
    }
}

function openModalEditBphKeluar(trxId) {
    const k = allBphKeluar.find(x => x.id === trxId);
    if (!k) return;

    document.getElementById('modal_bph_keluar_mode').value = 'edit';
    document.getElementById('modal_bph_keluar_id').value = k.id;
    document.getElementById('modalBphKeluarTitle').innerHTML = '<i class="fas fa-edit text-warning me-2"></i>Edit Pengeluaran BPH Keluar';

    const selMaster = document.getElementById('bph_k_master_id');
    selMaster.innerHTML = '<option value="">-- Pilih Barang BPH --</option>';
    allMasterBph.forEach(b => {
        selMaster.add(new Option(`[${b.kode_bph || '-'}] ${b.nama_barang} (${b.satuan || 'Pcs'})`, b.id));
    });
    selMaster.value = k.master_bph_id || '';

    const selRuangan = document.getElementById('bph_k_ruangan_id');
    selRuangan.innerHTML = '<option value="">-- Pilih Ruangan / Unit --</option>';
    allRooms.forEach(r => {
        selRuangan.add(new Option(`[${r.kode_ruangan}] ${r.nama_ruangan}`, r.id));
    });
    selRuangan.value = k.ruangan_id || '';

    document.getElementById('bph_k_tanggal').value = k.tanggal || '';
    document.getElementById('bph_k_jumlah').value = k.jumlah || 1;
    document.getElementById('bph_k_satuan').value = k.satuan || 'Pcs';
    document.getElementById('bph_k_keperluan').value = k.keperluan || '';
    document.getElementById('bph_k_penerima').value = k.penerima || '';
    document.getElementById('bph_k_no_bukti').value = k.no_bukti || '';
    document.getElementById('bph_k_ket').value = k.keterangan || '';

    onBphKeluarMasterChanged();

    const modal = new bootstrap.Modal(document.getElementById('modalFormBphKeluar'));
    modal.show();
}

async function saveModalBphKeluar() {
    const mode = document.getElementById('modal_bph_keluar_mode').value;
    const trxId = document.getElementById('modal_bph_keluar_id').value;

    const masterId = document.getElementById('bph_k_master_id').value;
    const tanggal = document.getElementById('bph_k_tanggal').value;
    const jumlah = parseFloat(document.getElementById('bph_k_jumlah').value) || 0;
    const satuan = document.getElementById('bph_k_satuan').value.trim();
    const keperluan = document.getElementById('bph_k_keperluan').value.trim();
    const penerima = document.getElementById('bph_k_penerima').value.trim();
    const ruanganId = document.getElementById('bph_k_ruangan_id').value;
    const noBukti = document.getElementById('bph_k_no_bukti').value.trim();
    const ket = document.getElementById('bph_k_ket').value.trim();

    if (!masterId) {
        alert('Silakan pilih Barang BPH yang dikeluarkan!');
        return;
    }
    if (!tanggal) {
        alert('Tanggal pengeluaran wajib diisi!');
        return;
    }
    if (jumlah <= 0) {
        alert('Jumlah keluar harus lebih besar dari 0!');
        return;
    }
    if (!keperluan) {
        alert('Keperluan pemakaian / kegiatan wajib diisi!');
        return;
    }
    if (!penerima) {
        alert('Nama penerima wajib diisi!');
        return;
    }

    // Validasi sisa stok
    let available = getAvailableStockBph(masterId);
    if (mode === 'edit') {
        const cur = allBphKeluar.find(x => x.id === trxId);
        if (cur && cur.master_bph_id === masterId) {
            available += (Number(cur.jumlah) || 0);
        }
    }

    if (jumlah > available) {
        const confirmExceed = confirm(`PERINGATAN: Jumlah yang dikeluarkan (${jumlah}) melebihi sisa stok fisik yang tersedia (${available}). Apakah tetap ingin menyimpan pengeluaran ini?`);
        if (!confirmExceed) return;
    }

    const master = allMasterBph.find(b => b.id === masterId);

    if (mode === 'edit') {
        await db.update('bph_keluar', trxId, {
            master_bph_id: masterId,
            nama_barang: master ? master.nama_barang : '',
            kode_bph: master ? master.kode_bph : '',
            kategori: master ? master.kategori : '',
            tanggal: tanggal,
            jumlah: jumlah,
            satuan: satuan || (master ? master.satuan : 'Pcs'),
            keperluan: keperluan,
            penerima: penerima,
            ruangan_id: ruanganId,
            no_bukti: noBukti,
            keterangan: ket,
            updated_at: new Date().toISOString()
        });
    } else {
        const item = {
            id: 'BPH-K-' + Date.now(),
            master_bph_id: masterId,
            nama_barang: master ? master.nama_barang : '',
            kode_bph: master ? master.kode_bph : '',
            kategori: master ? master.kategori : '',
            tanggal: tanggal,
            jumlah: jumlah,
            satuan: satuan || (master ? master.satuan : 'Pcs'),
            keperluan: keperluan,
            penerima: penerima,
            ruangan_id: ruanganId,
            no_bukti: noBukti,
            keterangan: ket,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        await db.put('bph_keluar', item);
    }

    await loadBphKeluar();
    renderBphPersediaanView();

    const modalEl = document.getElementById('modalFormBphKeluar');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: mode === 'edit' ? 'Transaksi Keluar Diperbarui!' : 'BPH Keluar Tersimpan!',
            text: `Pengeluaran ${jumlah} ${satuan} untuk "${keperluan}" berhasil dicatat.`
        });
    }
}

async function deleteBphKeluar(trxId) {
    const k = allBphKeluar.find(x => x.id === trxId);
    if (!k) return;

    Swal.fire({
        icon: 'warning',
        title: 'Hapus Catatan BPH Keluar?',
        text: `Apakah Anda yakin ingin menghapus pengeluaran tanggal ${formatBphDate(k.tanggal)} (${k.jumlah} ${k.satuan || ''})?`,
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Hapus'
    }).then(async res => {
        if (res.isConfirmed) {
            await db.delete('bph_keluar', trxId);
            await loadBphKeluar();
            renderBphPersediaanView();
        }
    });
}

function exportBphKeluarExcel(customTtd = null) {
    const rows = [
        ['DAFTAR PENGELUARAN / PEMAKAIAN BARANG PAKAI HABIS (BPH KELUAR) SEKOLAH'],
        [`Satuan Kerja: ${appProfile.nama_sekolah || 'SINBAS'} | Tahun Anggaran: ${currentBphFilterTahun} | Periode: ${currentBphFilterBulan > 0 ? 'Bulan ' + currentBphFilterBulan : 'Semua Bulan'}`],
        [],
        ['No.', 'Tanggal Keluar', 'Kode BPH', 'Nama Barang BPH', 'Jumlah Keluar', 'Satuan', 'Sisa Saldo Stok Transaksi', 'Keperluan Pemakaian / Kegiatan', 'Penerima', 'Ruangan / Unit', 'No. Bukti Pengeluaran', 'Keterangan']
    ];

    let grandTotalQty = 0;

    const searchTxt = document.getElementById('search_bph_trx')?.value?.toLowerCase().trim() || '';

    let list = allBphKeluar.filter(k => {
        const ym = parseBphYearMonth(k.tanggal);
        if (ym.year !== currentBphFilterTahun) return false;
        if (currentBphFilterBulan > 0 && ym.month !== currentBphFilterBulan) return false;

        if (searchTxt) {
            const master = allMasterBph.find(b => b.id === k.master_bph_id);
            const nama = (master ? master.nama_barang : k.nama_barang || '').toLowerCase();
            const kode = (master ? master.kode_bph : k.kode_bph || '').toLowerCase();
            const room = allRooms.find(r => r.id === k.ruangan_id);
            const ruanganStr = (room ? room.nama_ruangan : k.ruangan_id || '').toLowerCase();
            const kep = (k.keperluan || '').toLowerCase();
            const pen = (k.penerima || '').toLowerCase();
            const bukti = (k.no_bukti || '').toLowerCase();
            return nama.includes(searchTxt) || kode.includes(searchTxt) || ruanganStr.includes(searchTxt) || kep.includes(searchTxt) || pen.includes(searchTxt) || bukti.includes(searchTxt);
        }
        return true;
    });

    list.sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || ''));

    list.forEach((k, idx) => {
        const master = allMasterBph.find(b => b.id === k.master_bph_id);
        const nama = master ? master.nama_barang : (k.nama_barang || '');
        const kode = master ? master.kode_bph : (k.kode_bph || '-');
        const satuan = master ? master.satuan : (k.satuan || 'Pcs');
        const sisaSaldo = getStockBalanceAtDate(k.master_bph_id, k.tanggal);

        const room = allRooms.find(r => r.id === k.ruangan_id);
        const ruanganStr = room ? room.nama_ruangan : (k.ruangan_id || '-');

        grandTotalQty += Number(k.jumlah) || 0;

        rows.push([
            idx + 1,
            k.tanggal || '-',
            kode,
            nama,
            Number(k.jumlah) || 0,
            satuan,
            `${sisaSaldo} ${satuan}`,
            k.keperluan || '-',
            k.penerima || '-',
            ruanganStr,
            k.no_bukti || '-',
            k.keterangan || '-'
        ]);
    });

    rows.push(['', '', '', 'TOTAL PENGELUARAN BPH', grandTotalQty, '', '', '', '', '', '', '']);
    rows.push([]);
    SinbasExcelExporter.appendSignatures(rows, appProfile, currentBphFilterTahun, customTtd || window.currentLaporanTtd);

    SinbasExcelExporter.generateFile(rows, `BPH_Keluar_${currentBphFilterTahun}_Bulan_${currentBphFilterBulan || 'Semua'}.xlsx`, 'BPH Keluar', [
        { wch: 5 }, { wch: 14 }, { wch: 20 }, { wch: 35 }, { wch: 14 }, { wch: 10 }, { wch: 22 }, { wch: 30 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 25 }
    ]);
}

// =========================================================================
// SUBTAB 3: BUKU PERSEDIAAN & MUTASI SALDO ROLL-FORWARD (KARTU STOK)
// =========================================================================
function renderBphBukuPersediaanTable() {
    const tbody = document.getElementById('bphSaldoTableBody');
    if (!tbody) return;

    const balances = calculateBphBalances(currentBphFilterTahun, currentBphFilterBulan);
    const searchTxt = (document.getElementById('search_bph_s')?.value || document.getElementById('search_bph_trx')?.value || '').toLowerCase().trim();

    let list = balances;
    if (searchTxt) {
        list = list.filter(item => {
            const b = item.master;
            return (b.nama_barang && b.nama_barang.toLowerCase().includes(searchTxt)) ||
                   (b.kode_bph && b.kode_bph.toLowerCase().includes(searchTxt)) ||
                   (b.kategori && b.kategori.toLowerCase().includes(searchTxt));
        });
    }

    tbody.innerHTML = '';
    if (list.length === 0) {
        renderTablePagination('bph_saldo', 0);
        tbody.innerHTML = '<tr><td colspan="11" class="text-center py-4 text-muted">Belum ada barang di katalog persediaan.</td></tr>';
        return;
    }

    const totalItems = list.length;
    renderTablePagination('bph_saldo', totalItems);
    const pState = tablePagination.bph_saldo;
    const startIdx = (pState.page - 1) * pState.perPage;
    const pagedBalances = list.slice(startIdx, startIdx + pState.perPage);

    pagedBalances.forEach((item, idx) => {
        const b = item.master;
        let badgeStatus = '<span class="badge bg-success">Stok Aman</span>';
        if (item.saldoAkhir <= 0) {
            badgeStatus = '<span class="badge bg-danger">Habis</span>';
        } else if (item.saldoAkhir <= 5) {
            badgeStatus = '<span class="badge bg-warning text-dark">Kritis / Menipis</span>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">${startIdx + idx + 1}</td>
            <td><span class="badge-kode font-monospace">${b.kode_bph || '-'}</span></td>
            <td><div class="fw-bold text-dark">${b.nama_barang}</div></td>
            <td><span class="badge bg-secondary">${b.kategori || 'ATK'}</span></td>
            <td class="text-center font-monospace text-secondary fw-semibold">${item.saldoAwal.toLocaleString('id-ID')}</td>
            <td class="text-center font-monospace fw-bold text-success">+${item.masuk.toLocaleString('id-ID')}</td>
            <td class="text-center font-monospace fw-bold text-danger">-${item.keluar.toLocaleString('id-ID')}</td>
            <td class="text-center font-monospace fw-bold fs-6 text-cyan" style="background: rgba(56, 189, 248, 0.1);">
                ${item.saldoAkhir.toLocaleString('id-ID')}
            </td>
            <td class="text-center"><span class="badge bg-light text-secondary border font-monospace">${b.satuan || 'Pcs'}</span></td>
            <td class="text-end font-monospace fw-bold text-emerald">Rp ${item.nilaiSaldo.toLocaleString('id-ID')}</td>
            <td class="text-center">${badgeStatus}</td>
        `;
        tbody.appendChild(tr);
    });
}

function exportBphBukuPersediaanExcel() {
    const rows = [
        ['BUKU PERSEDIAAN BARANG PAKAI HABIS (KARTU STOK & MUTASI SALDO)'],
        [`Satuan Kerja: ${appProfile.nama_sekolah || 'SINBAS'} | Tahun Anggaran: ${currentBphFilterTahun} | Periode: ${currentBphFilterBulan > 0 ? 'Bulan ' + currentBphFilterBulan : 'Rekap Tahunan (Semua Bulan)'}`],
        [],
        ['No.', 'Kode BPH', 'Nama Resmi Barang BPH', 'Kategori', 'Saldo Awal', 'Penerimaan (+ Masuk)', 'Pengeluaran (- Keluar)', 'Saldo Akhir', 'Satuan', 'Estimasi Nilai Saldo (Rp)', 'Status Persediaan']
    ];

    const balances = calculateBphBalances(currentBphFilterTahun, currentBphFilterBulan);
    const searchTxt = document.getElementById('search_bph_trx')?.value?.toLowerCase().trim() || '';

    let list = balances;
    if (searchTxt) {
        list = list.filter(item => {
            const b = item.master || {};
            return (b.nama_barang && b.nama_barang.toLowerCase().includes(searchTxt)) ||
                   (b.kode_bph && b.kode_bph.toLowerCase().includes(searchTxt)) ||
                   (b.kategori && b.kategori.toLowerCase().includes(searchTxt));
        });
    }

    let totalSaldoAwal = 0;
    let totalMasuk = 0;
    let totalKeluar = 0;
    let totalSaldoAkhir = 0;
    let totalNilai = 0;

    list.forEach((item, idx) => {
        const b = item.master;
        totalSaldoAwal += item.saldoAwal;
        totalMasuk += item.masuk;
        totalKeluar += item.keluar;
        totalSaldoAkhir += item.saldoAkhir;
        totalNilai += item.nilaiSaldo;

        let statusText = 'Aman';
        if (item.saldoAkhir <= 0) statusText = 'Habis';
        else if (item.saldoAkhir <= 5) statusText = 'Kritis / Menipis';

        rows.push([
            idx + 1,
            b.kode_bph || '-',
            b.nama_barang,
            b.kategori || 'ATK',
            item.saldoAwal,
            item.masuk,
            item.keluar,
            item.saldoAkhir,
            b.satuan || 'Pcs',
            item.nilaiSaldo,
            statusText
        ]);
    });

    rows.push(['', '', 'TOTAL REKAPITULASI PERSEDIAAN', '', totalSaldoAwal, totalMasuk, totalKeluar, totalSaldoAkhir, '', totalNilai, '']);

    SinbasExcelExporter.generateFile(rows, `Buku_Persediaan_BPH_${currentBphFilterTahun}_Bulan_${currentBphFilterBulan || 'Semua'}.xlsx`, 'Buku Persediaan BPH', [
        { wch: 5 }, { wch: 20 }, { wch: 38 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 10 }, { wch: 20 }, { wch: 16 }
    ]);
}

function exportBphSaldoExcel() {
    exportBphBukuPersediaanExcel();
}

// =========================================================================
// Helper untuk mendapatkan tahun filter KIB aktif dari tab KIB atau tab Laporan
function getActiveKibFilterTahun() {
    const paneLap = document.getElementById('pane_laporan');
    const isPaneLap = paneLap && !paneLap.classList.contains('d-none');
    if (isPaneLap) {
        return document.getElementById('filter_kib_laporan_tahun')?.value || document.getElementById('filter_kib_tahun')?.value || 'Semua';
    }
    return document.getElementById('filter_kib_tahun')?.value || document.getElementById('filter_kib_laporan_tahun')?.value || 'Semua';
}

// MENU 3: MASTER KIB (A - F) VIEWER & EXCEL
// =========================================================================
function getFilteredKibAssets(kibType) {
    const targetKib = (kibType || currentKibFilter || 'B').toUpperCase();
    let filtered = allAssets.filter(a => a.kib_type === targetKib);

    const filterKondisi = document.getElementById('filter_kib_kondisi')?.value || document.getElementById('filter_kib_laporan_kondisi')?.value || 'Semua';
    if (filterKondisi !== 'Semua') {
        filtered = filtered.filter(a => a.kondisi === filterKondisi);
    }

    const filterTahun = document.getElementById('filter_kib_tahun')?.value || document.getElementById('filter_kib_laporan_tahun')?.value || 'Semua';
    if (filterTahun !== 'Semua') {
        filtered = filtered.filter(a => String(a.tahun_perolehan) === String(filterTahun));
    }

    const searchTxt = (document.getElementById('search_kib_table')?.value || document.getElementById('filter_kib_laporan_search')?.value || '').toLowerCase().trim();
    if (searchTxt) {
        filtered = filtered.filter(a =>
            (a.nibar && a.nibar.toLowerCase().includes(searchTxt)) ||
            (a.kode_barang && a.kode_barang.toLowerCase().includes(searchTxt)) ||
            (a.nama_barang && a.nama_barang.toLowerCase().includes(searchTxt)) ||
            (a.spesifikasi_nama && a.spesifikasi_nama.toLowerCase().includes(searchTxt)) ||
            (a.merk_tipe && a.merk_tipe.toLowerCase().includes(searchTxt)) ||
            (a.ruangan_nama && a.ruangan_nama.toLowerCase().includes(searchTxt))
        );
    }

    return filtered;
}

function renderKibTable() {
    const tbody = document.getElementById('kibTableBody');
    const tableHeaderEl = document.getElementById('kibTableHeader') || document.getElementById('kibTableHead');
    if (!tbody || !tableHeaderEl) return;

    const filtered = getFilteredKibAssets(currentKibFilter);

    renderKibHeader(tableHeaderEl, currentKibFilter);
    tbody.innerHTML = '';
    if (filtered.length === 0) {
        renderTablePagination('kib', 0);
        tbody.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-muted"><i class="fas fa-inbox fa-2x mb-2 d-block"></i>Belum ada data aset untuk KIB ${currentKibFilter}</td></tr>`;
        return;
    }

    const totalItems = filtered.length;
    renderTablePagination('kib', totalItems);
    const pState = tablePagination.kib;
    const startIdx = (pState.page - 1) * pState.perPage;
    const pagedAssets = filtered.slice(startIdx, startIdx + pState.perPage);

    pagedAssets.forEach((ast, idx) => {
        const k = SinbasExcelExporter.parseKhusus(ast.data_khusus);
        const tr = document.createElement('tr');
        tr.className = 'kib-row-clickable';
        tr.title = 'Klik baris ini untuk melihat rincian aset lengkap (Readonly)';
        tr.onclick = () => openModalViewAset(ast.id);

        let dynamicCols = '';
        if (currentKibFilter === 'A') {
            dynamicCols = `<td>${k.luas_m2 || '-'} m²</td><td>${k.status_hak || 'Hak Pakai'}</td><td>${k.no_sertifikat || '-'}</td><td>${k.penggunaan || 'Pendidikan'}</td>`;
        } else if (currentKibFilter === 'B') {
            dynamicCols = `<td><b>${ast.merk_tipe || '-'}</b></td><td><small class="text-muted font-monospace">${ast.no_pabrik_seri || '-'}</small></td><td>${ast.bahan || '-'}</td><td><span class="badge bg-secondary">${ast.ruangan_nama || '-'}</span></td>`;
        } else if (currentKibFilter === 'C') {
            dynamicCols = `<td>${k.luas_lantai || '-'} m²</td><td>${k.konstruksi_bertingkat || 'Tidak'} / ${k.konstruksi_beton || 'Beton'}</td><td><small class="text-muted font-monospace">${k.no_dokumen_gedung || '-'}</small></td><td><span class="badge bg-secondary">${ast.ruangan_nama || '-'}</span></td>`;
        } else if (currentKibFilter === 'D') {
            dynamicCols = `<td>${k.konstruksi || 'Instalasi'}</td><td>${k.panjang_km || '-'}</td><td>${k.luas_m2 || '-'}</td><td>${ast.asal_usul || 'BOS'}</td>`;
        } else if (currentKibFilter === 'E') {
            dynamicCols = `<td><b>${k.judul_pencipta || ast.spesifikasi_nama || '-'}</b></td><td>${ast.jumlah || 1} ${ast.satuan || 'Eks'}</td><td>${k.kegunaan || 'Pembelajaran'}</td><td><span class="badge bg-secondary">${ast.ruangan_nama || 'Perpustakaan'}</span></td>`;
        } else if (currentKibFilter === 'F') {
            dynamicCols = `<td>${k.bertingkat || 'Tidak'} / ${k.beton || 'Beton'}</td><td>${k.luas_rencana || '-'} m²</td><td><small class="text-muted font-monospace">${k.no_spk || '-'}</small></td><td><span class="badge bg-info text-dark">${k.persen_fisik || '50'}% Fisik</span></td>`;
        }

        let badgeKondisi = `<span class="badge-kondisi-b"><i class="fas fa-check-circle me-1"></i>Baik</span>`;
        if (ast.kondisi === 'Rusak Ringan') badgeKondisi = `<span class="badge-kondisi-rr"><i class="fas fa-tools me-1"></i>Rusak Ringan</span>`;
        else if (ast.kondisi === 'Rusak Berat') badgeKondisi = `<span class="badge-kondisi-rb"><i class="fas fa-times-circle me-1"></i>Rusak Berat</span>`;

        tr.innerHTML = `
            <td class="text-center">${startIdx + idx + 1}</td>
            <td><span class="badge-nibar mb-1">${ast.nibar}</span><br><span class="badge-kode">${ast.kode_barang}</span></td>
            <td><div class="fw-bold">${ast.spesifikasi_nama || ast.nama_barang}</div><small class="text-muted">${ast.asal_usul || 'BOS'} • Thn ${ast.tahun_perolehan}</small></td>
            ${dynamicCols}
            <td class="text-end fw-bold text-info">Rp ${(Number(ast.nilai_total || ast.harga_satuan) || 0).toLocaleString('id-ID')}</td>
            <td class="text-center">${badgeKondisi}</td>
            <td class="text-center">
                <button type="button" class="btn btn-sm btn-outline-primary py-0 px-2" title="Lihat Rincian Aset (Readonly)" onclick="event.stopPropagation(); openModalViewAset('${ast.id}')">
                    <i class="fas fa-eye me-1"></i>Lihat
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderKibHeader(headerEl, kibLetter) {
    let specificHeaders = '';
    if (kibLetter === 'A') specificHeaders = `<th>Luas Tanah</th><th>Status Hak</th><th>No. Sertifikat</th><th>Penggunaan</th>`;
    else if (kibLetter === 'B') specificHeaders = `<th>Merk / Tipe</th><th>No. Seri / Pabrik</th><th>Bahan</th><th>Ruangan / Lokasi</th>`;
    else if (kibLetter === 'C') specificHeaders = `<th>Luas Lantai</th><th>Bertingkat / Beton</th><th>No. Dokumen Gedung</th><th>Lokasi Ruang</th>`;
    else if (kibLetter === 'D') specificHeaders = `<th>Konstruksi</th><th>Panjang</th><th>Luas</th><th>Asal Usul</th>`;
    else if (kibLetter === 'E') specificHeaders = `<th>Judul / Pencipta</th><th>Jumlah / Qty</th><th>Kegunaan</th><th>Ruangan</th>`;
    else if (kibLetter === 'F') specificHeaders = `<th>Bertingkat / Beton</th><th>Luas Rencana</th><th>No. SPK / Kontrak</th><th>Progress Fisik</th>`;

    headerEl.innerHTML = `
        <tr>
            <th style="width: 40px;" class="text-center">No.</th>
            <th>Identitas (NIBAR & Kode)</th>
            <th>Nama Barang & Spesifikasi</th>
            ${specificHeaders}
            <th class="text-end">Nilai (Rp)</th>
            <th class="text-center">Kondisi</th>
            <th class="text-center" style="width: 75px;">Aksi</th>
        </tr>
    `;
}

function setKibFilter(kibLetter) {
    currentKibFilter = kibLetter;
    document.querySelectorAll('.btn-kib-filter').forEach(btn => {
        if (btn.getAttribute('data-kib') === kibLetter) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    const kibTitleEl = document.getElementById('kibActiveTitle');
    const descMap = {
        A: 'KIB A — ASET TANAH (PERMENDAGRI 47/2021)',
        B: 'KIB B — PERALATAN DAN MESIN / TIK / MEUBELAIR (PERMENDAGRI 47/2021)',
        C: 'KIB C — GEDUNG DAN BANGUNAN (PERMENDAGRI 47/2021)',
        D: 'KIB D — JALAN, IRIGASI DAN JARINGAN (PERMENDAGRI 47/2021)',
        E: 'KIB E — ASET TETAP LAINNYA / BUKU BOS / KESENIAN (PERMENDAGRI 47/2021)',
        F: 'KIB F — KONSTRUKSI DALAM PENGERJAAN / KDP (PERMENDAGRI 47/2021)'
    };
    if (kibTitleEl) kibTitleEl.textContent = descMap[kibLetter] || `KIB ${kibLetter}`;
    renderKibTable();
}

// =========================================================================
// PRATINJAU DOKUMEN RESMI KIB & EXCELJS (PERMENDAGRI 47/2021 & 108/2016)
// =========================================================================
function downloadActiveKibExcel() {
    previewKibReport(currentKibFilter || 'B', currentKibFormatVersion || '2021');
}

function previewKibReport(kibType, version) {
    currentPreviewReportType = 'kib';
    currentPreviewKibType = (kibType || currentKibFilter || 'B').toUpperCase();
    if (version) {
        currentKibFormatVersion = String(version);
    }
    currentPreviewZoom = 1.0;

    const modalEl = document.getElementById('modalPreviewKib');
    const badgeEl = document.getElementById('previewKibBadge');
    const titleEl = document.getElementById('previewKibTitle');
    const subTitleEl = document.getElementById('previewKibSubtitle');
    const sheetEl = document.getElementById('kibPreviewPaperSheet');
    const zoomLabelEl = document.getElementById('previewKibZoomLabel');
    const versionSelect = document.getElementById('previewKibFormatVersion');
    const versionWrapper = document.getElementById('previewKibFormatVersionWrapper');
    const legendBar = document.getElementById('previewKibLegendBar');

    if (versionWrapper) versionWrapper.style.display = 'flex';
    if (legendBar) legendBar.style.display = 'flex';

    if (versionSelect) {
        versionSelect.value = currentKibFormatVersion;
    }

    const descMap = {
        A: 'Tanah (KIB A)',
        B: 'Peralatan dan Mesin (KIB B)',
        C: 'Gedung dan Bangunan (KIB C)',
        D: 'Jalan, Irigasi dan Jaringan (KIB D)',
        E: 'Aset Tetap Lainnya / Buku Perpustakaan & Kesenian (KIB E)',
        F: 'Konstruksi dalam Pengerjaan / KDP (KIB F)'
    };

    const filteredAssets = getFilteredKibAssets(currentPreviewKibType);

    const filterKondisi = document.getElementById('filter_kib_kondisi')?.value || document.getElementById('filter_kib_laporan_kondisi')?.value || 'Semua';
    const filterTahun = getActiveKibFilterTahun();
    const searchTxt = (document.getElementById('search_kib_table')?.value || document.getElementById('filter_kib_laporan_search')?.value || '').trim();

    let filterDesc = [];
    if (filterKondisi !== 'Semua') filterDesc.push(`Kondisi: ${filterKondisi}`);
    if (filterTahun !== 'Semua') filterDesc.push(`Tahun: ${filterTahun}`);
    if (searchTxt) filterDesc.push(`Cari: "${searchTxt}"`);

    const filterInfo = filterDesc.length > 0 ? ` • [Filter Aktif: ${filterDesc.join(', ')} • ${filteredAssets.length} Aset]` : ` • [${filteredAssets.length} Aset]`;

    if (badgeEl) badgeEl.textContent = `KIB ${currentPreviewKibType}`;
    if (titleEl) {
        const jenisLaporan = currentKibFormatVersion === '2021' ? 'Daftar BMD' : 'KIB';
        const tahunStr = filterTahun === 'Semua' ? 'Semua Tahun' : `Tahun ${filterTahun}`;
        titleEl.textContent = `Pratinjau Dokumen Resmi ${jenisLaporan} ${currentPreviewKibType} — ${descMap[currentPreviewKibType] || ''} (${tahunStr})`;
    }
    if (subTitleEl) {
        if (currentKibFormatVersion === '2021') {
            subTitleEl.textContent = 'Format Baru Permendagri No. 47/2021 (Lampiran III — DAFTAR BMD, 7 Kolom Kodefikasi)' + filterInfo;
        } else {
            subTitleEl.textContent = 'Format Baku Permendagri No. 108/2016 (Format Klasik KIB A - F, 7 Kolom Kodefikasi)' + filterInfo;
        }
    }

    if (zoomLabelEl) zoomLabelEl.textContent = '100%';
    if (sheetEl) {
        sheetEl.style.transform = 'scale(1)';
        sheetEl.innerHTML = SinbasExcelExporter.renderKibPreviewHtml(currentPreviewKibType, filteredAssets, appProfile, currentKibFormatVersion, filterTahun, window.currentLaporanTtd);
    }

    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function previewKirReport(roomId) {
    currentPreviewReportType = 'kir';
    const targetRoomId = roomId || currentKirRoomId || (allRooms[0] ? allRooms[0].id : null);
    const ruang = allRooms.find(r => r.id === targetRoomId) || allRooms[0];
    if (!ruang) {
        SinbasNotify('Data ruangan belum tersedia.', 'warning');
        return;
    }
    currentPreviewKirRoom = ruang;
    currentPreviewZoom = 1.0;

    const modalEl = document.getElementById('modalPreviewKib');
    const badgeEl = document.getElementById('previewKibBadge');
    const titleEl = document.getElementById('previewKibTitle');
    const subTitleEl = document.getElementById('previewKibSubtitle');
    const sheetEl = document.getElementById('kibPreviewPaperSheet');
    const zoomLabelEl = document.getElementById('previewKibZoomLabel');
    const versionWrapper = document.getElementById('previewKibFormatVersionWrapper');
    const legendBar = document.getElementById('previewKibLegendBar');

    if (versionWrapper) versionWrapper.style.display = 'none';
    if (legendBar) legendBar.style.display = 'none';

    if (badgeEl) badgeEl.textContent = `KIR - ${ruang.kode_ruangan}`;
    if (titleEl) titleEl.textContent = `Pratinjau Kartu Inventaris Ruangan (KIR) — ${ruang.nama_ruangan}`;
    if (subTitleEl) subTitleEl.textContent = `Format Resmi Permendagri No. 47/2021 • Penanggung Jawab: ${ruang.penanggung_jawab || '-'}`;

    if (zoomLabelEl) zoomLabelEl.textContent = '100%';
    if (sheetEl) {
        sheetEl.style.transform = 'scale(1)';
        sheetEl.innerHTML = SinbasExcelExporter.renderKirPreviewHtml(ruang, allAssets, appProfile, window.currentLaporanTtd);
    }

    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function previewBukuIndukReport() {
    currentPreviewReportType = 'buku_induk';
    currentPreviewZoom = 1.0;

    const modalEl = document.getElementById('modalPreviewKib');
    const badgeEl = document.getElementById('previewKibBadge');
    const titleEl = document.getElementById('previewKibTitle');
    const subTitleEl = document.getElementById('previewKibSubtitle');
    const sheetEl = document.getElementById('kibPreviewPaperSheet');
    const zoomLabelEl = document.getElementById('previewKibZoomLabel');
    const versionWrapper = document.getElementById('previewKibFormatVersionWrapper');
    const legendBar = document.getElementById('previewKibLegendBar');

    if (versionWrapper) versionWrapper.style.display = 'none';
    if (legendBar) legendBar.style.display = 'flex';

    const filteredAssets = getFilteredBukuIndukAssets();

    const paneLap = document.getElementById('pane_laporan');
    const isPaneLap = paneLap && !paneLap.classList.contains('d-none');
    const filterTahun = isPaneLap 
        ? (document.getElementById('filter_kib_laporan_tahun')?.value || 'Semua')
        : (document.getElementById('filter_bi_tahun')?.value || 'Semua');
    const filterKondisi = isPaneLap 
        ? (document.getElementById('filter_kib_laporan_kondisi')?.value || 'Semua')
        : (document.getElementById('filter_bi_kondisi')?.value || 'Semua');
    const filterKib = isPaneLap ? 'Semua' : (document.getElementById('filter_bi_kib')?.value || 'Semua');
    const searchTxt = (isPaneLap 
        ? (document.getElementById('filter_kib_laporan_search')?.value || '')
        : (document.getElementById('search_bi_table')?.value || '')
    ).trim();

    let filterDesc = [];
    if (filterKib !== 'Semua') filterDesc.push(`KIB ${filterKib}`);
    if (filterKondisi !== 'Semua') filterDesc.push(`Kondisi: ${filterKondisi}`);
    if (filterTahun !== 'Semua') filterDesc.push(`Tahun: ${filterTahun}`);
    if (searchTxt) filterDesc.push(`Cari: "${searchTxt}"`);

    const filterInfo = filterDesc.length > 0 ? ` [Filter Aktif: ${filterDesc.join(', ')} • ${filteredAssets.length} Barang]` : ` [Semua KIB • ${filteredAssets.length} Barang]`;
    const tahunStr = filterTahun === 'Semua' ? 'Semua Tahun' : `Tahun ${filterTahun}`;

    if (badgeEl) badgeEl.textContent = 'INVENTARIS LENGKAP';
    if (titleEl) titleEl.textContent = `Pratinjau Buku Inventaris BMD Lengkap — Permendagri 47/2021 (${tahunStr})`;
    if (subTitleEl) subTitleEl.textContent = `Format Hirarki Kodefikasi (1.3.1 s/d 1.3.6) • Satuan Kerja: ${appProfile.nama_sekolah || 'SMAN 15 TEBO'}${filterInfo}`;

    if (zoomLabelEl) zoomLabelEl.textContent = '100%';
    if (sheetEl) {
        sheetEl.style.transform = 'scale(1)';
        sheetEl.innerHTML = SinbasExcelExporter.renderBukuIndukPreviewHtml(filteredAssets, appProfile, filterTahun, window.currentLaporanTtd);
    }

    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function previewBphReport(subType = 'masuk') {
    currentPreviewReportType = 'bph_' + subType;
    currentPreviewBphType = subType;
    currentPreviewZoom = 1.0;

    const modalEl = document.getElementById('modalPreviewKib');
    const badgeEl = document.getElementById('previewKibBadge');
    const titleEl = document.getElementById('previewKibTitle');
    const subTitleEl = document.getElementById('previewKibSubtitle');
    const sheetEl = document.getElementById('kibPreviewPaperSheet');
    const zoomLabelEl = document.getElementById('previewKibZoomLabel');
    const versionWrapper = document.getElementById('previewKibFormatVersionWrapper');
    const legendBar = document.getElementById('previewKibLegendBar');

    if (versionWrapper) versionWrapper.style.display = 'none';
    if (legendBar) legendBar.style.display = 'none';

    let list = [];
    const searchTxt = document.getElementById('search_bph_trx')?.value?.toLowerCase().trim() || '';

    if (subType === 'masuk') {
        list = allBphMasuk.filter(m => {
            const ym = parseBphYearMonth(m.tanggal);
            if (ym.year !== currentBphFilterTahun) return false;
            if (currentBphFilterBulan > 0 && ym.month !== currentBphFilterBulan) return false;

            if (searchTxt) {
                const master = allMasterBph.find(b => b.id === m.master_bph_id);
                const nama = (master ? master.nama_barang : m.nama_barang || '').toLowerCase();
                const kode = (master ? master.kode_bph : m.kode_bph || '').toLowerCase();
                const bukti = (m.no_bukti || '').toLowerCase();
                const rekanan = (m.rekanan || '').toLowerCase();
                const ket = (m.keterangan || '').toLowerCase();
                return nama.includes(searchTxt) || kode.includes(searchTxt) || bukti.includes(searchTxt) || rekanan.includes(searchTxt) || ket.includes(searchTxt);
            }
            return true;
        }).sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '')).map(m => {
            const master = allMasterBph.find(b => b.id === m.master_bph_id);
            return {
                tanggal: m.tanggal || '-',
                no_dokumen: m.no_bukti || '-',
                kode_bph: master ? master.kode_bph : (m.kode_bph || '-'),
                nama_barang: master ? master.nama_barang : (m.nama_barang || ''),
                satuan: master ? master.satuan : (m.satuan || 'Pcs'),
                sumber_dana: m.sumber_dana || 'BOS Reguler',
                jumlah: Number(m.jumlah) || 0,
                harga_satuan: Number(m.harga_satuan) || 0,
                total_harga: Number(m.total_nilai || (m.jumlah * m.harga_satuan)) || 0,
                keterangan: m.keterangan || m.rekanan || '-'
            };
        });

        if (badgeEl) badgeEl.textContent = 'BPH MASUK';
        if (titleEl) titleEl.textContent = 'Pratinjau Buku Penerimaan Barang Pakai Habis (BPH Masuk)';
        if (subTitleEl) subTitleEl.textContent = `Tahun Anggaran ${currentBphFilterTahun} • Periode: ${currentBphFilterBulan > 0 ? 'Bulan ' + currentBphFilterBulan : 'Semua Bulan'}${searchTxt ? ' • Cari: "' + searchTxt + '"' : ''}`;
    } else if (subType === 'keluar') {
        list = allBphKeluar.filter(k => {
            const ym = parseBphYearMonth(k.tanggal);
            if (ym.year !== currentBphFilterTahun) return false;
            if (currentBphFilterBulan > 0 && ym.month !== currentBphFilterBulan) return false;

            if (searchTxt) {
                const master = allMasterBph.find(b => b.id === k.master_bph_id);
                const nama = (master ? master.nama_barang : k.nama_barang || '').toLowerCase();
                const kode = (master ? master.kode_bph : k.kode_bph || '').toLowerCase();
                const room = allRooms.find(r => r.id === k.ruangan_id);
                const ruanganStr = (room ? room.nama_ruangan : k.ruangan_id || '').toLowerCase();
                const kep = (k.keperluan || '').toLowerCase();
                const pen = (k.penerima || '').toLowerCase();
                const bukti = (k.no_bukti || '').toLowerCase();
                return nama.includes(searchTxt) || kode.includes(searchTxt) || ruanganStr.includes(searchTxt) || kep.includes(searchTxt) || pen.includes(searchTxt) || bukti.includes(searchTxt);
            }
            return true;
        }).sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '')).map(k => {
            const master = allMasterBph.find(b => b.id === k.master_bph_id);
            const room = allRooms.find(r => r.id === k.ruangan_id);
            const ruanganStr = room ? room.nama_ruangan : (k.ruangan_id || '-');
            return {
                tanggal: k.tanggal || '-',
                no_dokumen: k.no_bukti || '-',
                kode_bph: master ? master.kode_bph : (k.kode_bph || '-'),
                nama_barang: master ? master.nama_barang : (k.nama_barang || ''),
                satuan: master ? master.satuan : (k.satuan || 'Pcs'),
                tujuan_penggunaan: `${ruanganStr} (${k.penerima || '-'})`,
                jumlah: Number(k.jumlah) || 0,
                petugas_penyerah: k.keperluan || '-',
                keterangan: k.keterangan || '-'
            };
        });

        if (badgeEl) badgeEl.textContent = 'BPH KELUAR';
        if (titleEl) titleEl.textContent = 'Pratinjau Buku Pengeluaran Barang Pakai Habis (BPH Keluar)';
        if (subTitleEl) subTitleEl.textContent = `Tahun Anggaran ${currentBphFilterTahun} • Periode: ${currentBphFilterBulan > 0 ? 'Bulan ' + currentBphFilterBulan : 'Semua Bulan'}${searchTxt ? ' • Cari: "' + searchTxt + '"' : ''}`;
    } else {
        // saldo / persediaan
        let balances = calculateBphBalances(currentBphFilterTahun, currentBphFilterBulan);
        if (searchTxt) {
            balances = balances.filter(item => {
                const b = item.master || {};
                return (b.nama_barang && b.nama_barang.toLowerCase().includes(searchTxt)) ||
                       (b.kode_bph && b.kode_bph.toLowerCase().includes(searchTxt)) ||
                       (b.kategori && b.kategori.toLowerCase().includes(searchTxt));
            });
        }
        list = balances.map(item => {
            const b = item.master || {};
            const avgPrice = item.saldoAkhir > 0 ? (item.nilaiSaldo / item.saldoAkhir) : 0;
            return {
                kode_bph: b.kode_bph || '-',
                nama_barang: b.nama_barang || '',
                satuan: b.satuan || 'Pcs',
                saldo_awal: item.saldoAwal,
                masuk: item.masuk,
                keluar: item.keluar,
                sisa: item.saldoAkhir,
                harga_satuan: avgPrice,
                total_nilai: item.nilaiSaldo
            };
        });

        if (badgeEl) badgeEl.textContent = 'BPH SALDO';
        if (titleEl) titleEl.textContent = 'Pratinjau Buku Saldo Persediaan Barang Pakai Habis (Stock Opname)';
        if (subTitleEl) subTitleEl.textContent = `Tahun Anggaran ${currentBphFilterTahun} • Rekapitulasi Mutasi Stok Fisik Akhir${searchTxt ? ' • Cari: "' + searchTxt + '"' : ''}`;
    }

    if (zoomLabelEl) zoomLabelEl.textContent = '100%';
    if (sheetEl) {
        sheetEl.style.transform = 'scale(1)';
        sheetEl.innerHTML = SinbasExcelExporter.renderBphPreviewHtml(subType, appProfile, {
            tahun: currentBphFilterTahun,
            bulan: currentBphFilterBulan,
            list
        }, window.currentLaporanTtd);
    }

    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function changeKibPreviewVersion(newVersion) {
    currentKibFormatVersion = newVersion || '2021';
    const titleEl = document.getElementById('previewKibTitle');
    const subTitleEl = document.getElementById('previewKibSubtitle');
    const sheetEl = document.getElementById('kibPreviewPaperSheet');

    const descMap = {
        A: 'Tanah (KIB A)',
        B: 'Peralatan dan Mesin (KIB B)',
        C: 'Gedung dan Bangunan (KIB C)',
        D: 'Jalan, Irigasi dan Jaringan (KIB D)',
        E: 'Aset Tetap Lainnya / Buku Perpustakaan & Kesenian (KIB E)',
        F: 'Konstruksi dalam Pengerjaan / KDP (KIB F)'
    };

    const filteredAssets = getFilteredKibAssets(currentPreviewKibType);

    const filterKondisi = document.getElementById('filter_kib_kondisi')?.value || document.getElementById('filter_kib_laporan_kondisi')?.value || 'Semua';
    const filterTahun = getActiveKibFilterTahun();
    const searchTxt = (document.getElementById('search_kib_table')?.value || document.getElementById('filter_kib_laporan_search')?.value || '').trim();

    let filterDesc = [];
    if (filterKondisi !== 'Semua') filterDesc.push(`Kondisi: ${filterKondisi}`);
    if (filterTahun !== 'Semua') filterDesc.push(`Tahun: ${filterTahun}`);
    if (searchTxt) filterDesc.push(`Cari: "${searchTxt}"`);

    const filterInfo = filterDesc.length > 0 ? ` • [Filter Aktif: ${filterDesc.join(', ')} • ${filteredAssets.length} Aset]` : ` • [${filteredAssets.length} Aset]`;

    if (titleEl) {
        const jenisLaporan = currentKibFormatVersion === '2021' ? 'Daftar BMD' : 'KIB';
        const tahunStr = filterTahun === 'Semua' ? 'Semua Tahun' : `Tahun ${filterTahun}`;
        titleEl.textContent = `Pratinjau Dokumen Resmi ${jenisLaporan} ${currentPreviewKibType} — ${descMap[currentPreviewKibType] || ''} (${tahunStr})`;
    }
    if (subTitleEl) {
        if (currentKibFormatVersion === '2021') {
            subTitleEl.textContent = 'Format Baru Permendagri No. 47/2021 (Lampiran III — DAFTAR BMD, 7 Kolom Kodefikasi)' + filterInfo;
        } else {
            subTitleEl.textContent = 'Format Baku Permendagri No. 108/2016 (Format Klasik KIB A - F, 7 Kolom Kodefikasi)' + filterInfo;
        }
    }

    if (sheetEl) {
        sheetEl.innerHTML = SinbasExcelExporter.renderKibPreviewHtml(currentPreviewKibType, filteredAssets, appProfile, currentKibFormatVersion, filterTahun, window.currentLaporanTtd);
    }
}

function zoomPreviewKib(delta) {
    currentPreviewZoom = Math.min(Math.max(Math.round((currentPreviewZoom + delta) * 10) / 10, 0.4), 2.0);
    const zoomLabelEl = document.getElementById('previewKibZoomLabel');
    const sheetEl = document.getElementById('kibPreviewPaperSheet');

    if (zoomLabelEl) zoomLabelEl.textContent = Math.round(currentPreviewZoom * 100) + '%';
    if (sheetEl) sheetEl.style.transform = `scale(${currentPreviewZoom})`;
}

function resetZoomPreviewKib() {
    currentPreviewZoom = 1.0;
    const zoomLabelEl = document.getElementById('previewKibZoomLabel');
    const sheetEl = document.getElementById('kibPreviewPaperSheet');

    if (zoomLabelEl) zoomLabelEl.textContent = '100%';
    if (sheetEl) sheetEl.style.transform = 'scale(1)';
}

// =========================================================================
// PENGATURAN TANDA TANGAN LAPORAN (TEMPAT & TANGGAL TTD MANUAL)
// =========================================================================
window.currentLaporanTtd = null;
let pendingLaporanAction = null; // 'print' | 'pdf' | 'excel' | 'preview'
let ttdListenersInitialized = false;

function getActiveReportTahunNumber() {
    let tahun = null;
    if (typeof currentPreviewReportType !== 'undefined') {
        if (currentPreviewReportType === 'kib') {
            tahun = typeof getActiveKibFilterTahun === 'function' ? getActiveKibFilterTahun() : null;
        } else if (currentPreviewReportType === 'buku_induk') {
            const paneLap = document.getElementById('pane_laporan');
            const isPaneLap = paneLap && !paneLap.classList.contains('d-none');
            tahun = isPaneLap 
                ? document.getElementById('filter_kib_laporan_tahun')?.value 
                : document.getElementById('filter_bi_tahun')?.value;
        }
    }
    if (tahun && tahun !== 'Semua' && !isNaN(parseInt(tahun, 10))) {
        return parseInt(tahun, 10);
    }
    return (appProfile && appProfile.tahun_anggaran) || new Date().getFullYear();
}

function initModalTtdListeners() {
    if (ttdListenersInitialized) return;
    const modalTtd = document.getElementById('modalTtdLaporan');
    if (!modalTtd) return;

    modalTtd.addEventListener('hidden.bs.modal', function () {
        const prevModal = document.getElementById('modalPreviewKib');
        if (prevModal && prevModal.classList.contains('show')) {
            document.body.classList.add('modal-open');
        }
    });

    modalTtd.addEventListener('show.bs.modal', function () {
        setTimeout(() => {
            const backdrops = document.querySelectorAll('.modal-backdrop');
            if (backdrops.length > 1) {
                backdrops[backdrops.length - 1].style.zIndex = '1060';
            }
        }, 10);
    });

    modalTtd.addEventListener('shown.bs.modal', function () {
        const inpTempat = document.getElementById('ttd_input_tempat');
        if (inpTempat) {
            inpTempat.focus();
            inpTempat.select();
        }
    });

    const inpTempat = document.getElementById('ttd_input_tempat');
    const inpTanggal = document.getElementById('ttd_input_tanggal');
    if (inpTempat) inpTempat.addEventListener('input', updateTtdLivePreview);
    if (inpTanggal) inpTanggal.addEventListener('input', updateTtdLivePreview);

    ttdListenersInitialized = true;
}

function requestLaporanActionWithTtd(action = 'preview') {
    pendingLaporanAction = action;

    initModalTtdListeners();

    const modalEl = document.getElementById('modalTtdLaporan');
    if (!modalEl) {
        if (action === 'print') printKibPreviewDocument(true);
        else if (action === 'pdf') downloadKibPreviewPdf(true);
        else if (action === 'excel') executeKibExcelDownload(true);
        return;
    }

    const actionLabelEl = document.getElementById('ttd_action_target_label');
    const submitBtn = document.getElementById('btn_modal_ttd_submit');
    const submitLabel = document.getElementById('btn_modal_ttd_submit_label');

    if (action === 'pdf') {
        if (actionLabelEl) actionLabelEl.textContent = 'Unduh PDF (Folio F4)';
        if (submitBtn) {
            submitBtn.className = 'btn btn-sm btn-danger fw-bold px-4 shadow-sm';
            if (submitLabel) submitLabel.innerHTML = '<i class="fas fa-file-pdf me-1"></i> Proses Unduh PDF';
        }
    } else if (action === 'excel') {
        if (actionLabelEl) actionLabelEl.textContent = 'Unduh Excel (ExcelJS)';
        if (submitBtn) {
            submitBtn.className = 'btn btn-sm btn-success fw-bold px-4 shadow-sm';
            if (submitLabel) submitLabel.innerHTML = '<i class="fas fa-file-excel me-1"></i> Proses Unduh Excel';
        }
    } else if (action === 'print') {
        if (actionLabelEl) actionLabelEl.textContent = 'Cetak Dokumen (Printer)';
        if (submitBtn) {
            submitBtn.className = 'btn btn-sm btn-primary fw-bold px-4 shadow-sm';
            if (submitLabel) submitLabel.innerHTML = '<i class="fas fa-print me-1"></i> Proses Cetak';
        }
    } else {
        if (actionLabelEl) actionLabelEl.textContent = 'Terapkan ke Pratinjau';
        if (submitBtn) {
            submitBtn.className = 'btn btn-sm btn-primary fw-bold px-4 shadow-sm';
            if (submitLabel) submitLabel.innerHTML = '<i class="fas fa-check me-1"></i> Terapkan TTD';
        }
    }

    initTtdModalFields();

    const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    bsModal.show();
}
window.requestLaporanActionWithTtd = requestLaporanActionWithTtd;

function initTtdModalFields() {
    const inpTempat = document.getElementById('ttd_input_tempat');
    const inpTanggal = document.getElementById('ttd_input_tanggal');

    let defTempat = '';
    if (window.currentLaporanTtd && window.currentLaporanTtd.tempat) {
        defTempat = window.currentLaporanTtd.tempat;
    } else if (typeof SinbasExcelExporter !== 'undefined') {
        defTempat = SinbasExcelExporter.cleanKotaNama(appProfile.kabupaten_kota || appProfile.kabupaten || 'Tebo');
    } else {
        defTempat = 'Tebo';
    }

    if (inpTempat) {
        inpTempat.value = defTempat;
    }

    let defTanggalIso = '';
    if (window.currentLaporanTtd && window.currentLaporanTtd.tanggalIso) {
        defTanggalIso = window.currentLaporanTtd.tanggalIso;
    } else {
        const tahunAktif = getActiveReportTahunNumber();
        const today = new Date();
        const todayYear = today.getFullYear();

        if (tahunAktif && Number(tahunAktif) !== todayYear) {
            defTanggalIso = `${tahunAktif}-12-31`;
        } else {
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            defTanggalIso = `${yyyy}-${mm}-${dd}`;
        }
    }

    if (inpTanggal) {
        inpTanggal.value = defTanggalIso;
    }

    updateTtdLivePreview();
}
window.initTtdModalFields = initTtdModalFields;

function setQuickTtdDate(type) {
    const inpTanggal = document.getElementById('ttd_input_tanggal');
    if (!inpTanggal) return;

    if (type === 'today') {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        inpTanggal.value = `${yyyy}-${mm}-${dd}`;
    } else if (type === 'year_end') {
        const tahunAktif = getActiveReportTahunNumber() || (appProfile && appProfile.tahun_anggaran) || new Date().getFullYear();
        inpTanggal.value = `${tahunAktif}-12-31`;
    }
    updateTtdLivePreview();
}
window.setQuickTtdDate = setQuickTtdDate;

function updateTtdLivePreview() {
    const inpTempat = document.getElementById('ttd_input_tempat');
    const inpTanggal = document.getElementById('ttd_input_tanggal');
    const previewEl = document.getElementById('ttd_live_preview_text');

    let tempat = (inpTempat && inpTempat.value ? inpTempat.value : '').trim();
    if (!tempat) tempat = 'Tempat';

    const tanggalIso = inpTanggal ? inpTanggal.value : '';
    const tanggalIndo = formatTanggalIndo(tanggalIso) || 'Tanggal';

    if (previewEl) {
        previewEl.textContent = `${tempat}, ${tanggalIndo}`;
    }
}
window.updateTtdLivePreview = updateTtdLivePreview;

function updatePreviewSheetTtd(tempat, tanggalIndo) {
    const textTtd = `${tempat}, ${tanggalIndo}`;
    const dateEls = document.querySelectorAll('#kibPreviewPaperSheet .kib-sig-date-line');
    if (dateEls && dateEls.length > 0) {
        dateEls.forEach(el => {
            el.textContent = textTtd;
        });
    } else {
        const sigCols = document.querySelectorAll('#kibPreviewPaperSheet .kib-sig-col');
        if (sigCols.length >= 2) {
            const rightCol = sigCols[1];
            const firstDiv = rightCol.querySelector('div');
            if (firstDiv) firstDiv.textContent = textTtd;
        }
    }
}

async function confirmAndProcessLaporanTtd() {
    const inpTempat = document.getElementById('ttd_input_tempat');
    const inpTanggal = document.getElementById('ttd_input_tanggal');

    let tempat = inpTempat ? inpTempat.value.trim() : '';
    if (!tempat) {
        tempat = typeof SinbasExcelExporter !== 'undefined'
            ? SinbasExcelExporter.cleanKotaNama(appProfile.kabupaten_kota || appProfile.kabupaten || 'Tebo')
            : 'Tebo';
    }

    let tanggalIso = inpTanggal ? inpTanggal.value : '';
    if (!tanggalIso) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        tanggalIso = `${yyyy}-${mm}-${dd}`;
    }

    const tanggalIndo = formatTanggalIndo(tanggalIso);

    window.currentLaporanTtd = {
        tempat: tempat,
        tanggal: tanggalIndo,
        tanggalIso: tanggalIso
    };

    const lblBrief = document.getElementById('lblPreviewTtdBrief');
    if (lblBrief) {
        lblBrief.textContent = `${tempat}, ${tanggalIndo}`;
    }

    updatePreviewSheetTtd(tempat, tanggalIndo);

    const modalEl = document.getElementById('modalTtdLaporan');
    if (modalEl) {
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
    }

    const action = pendingLaporanAction;
    pendingLaporanAction = null;

    if (action === 'print') {
        printKibPreviewDocument(true);
    } else if (action === 'pdf') {
        await downloadKibPreviewPdf(true);
    } else if (action === 'excel') {
        await executeKibExcelDownload(true, window.currentLaporanTtd);
    }
}
window.confirmAndProcessLaporanTtd = confirmAndProcessLaporanTtd;

function printKibPreviewDocument(skipPrompt = false) {
    if (!skipPrompt) {
        requestLaporanActionWithTtd('print');
        return;
    }
    document.body.classList.add('kib-printing');
    window.print();
    setTimeout(() => {
        document.body.classList.remove('kib-printing');
    }, 500);
}

async function downloadKibPreviewPdf(skipPrompt = false) {
    if (!skipPrompt) {
        requestLaporanActionWithTtd('pdf');
        return;
    }
    const sheetEl = document.getElementById('kibPreviewPaperSheet');
    if (!sheetEl) return;

    // Simpan transform zoom saat ini dan reset ke 1.0 agar render PDF jernih & presisi
    const prevTransform = sheetEl.style.transform;
    sheetEl.style.transform = 'none';

    // Buat nama file dinamis sesuai tipe dokumen yang dipratinjau
    const schoolClean = (appProfile.nama_sekolah || 'SEKOLAH').replace(/[^a-zA-Z0-9_-]/g, '_');
    let filterTahun = 'Semua';
    if (currentPreviewReportType === 'kib') {
        filterTahun = getActiveKibFilterTahun();
    } else if (currentPreviewReportType === 'buku_induk') {
        const paneLap = document.getElementById('pane_laporan');
        const isPaneLap = paneLap && !paneLap.classList.contains('d-none');
        filterTahun = isPaneLap 
            ? (document.getElementById('filter_kib_laporan_tahun')?.value || 'Semua')
            : (document.getElementById('filter_bi_tahun')?.value || 'Semua');
    }
    const tahunFile = (filterTahun && filterTahun !== 'Semua') ? filterTahun : 'Semua_Tahun';

    let filename = `Laporan_Inventaris_F4_${schoolClean}_${tahunFile}.pdf`;

    if (currentPreviewReportType === 'kib') {
        filename = `Laporan_KIB_${currentPreviewKibType}_F4_${schoolClean}_${tahunFile}.pdf`;
    } else if (currentPreviewReportType === 'kir') {
        const ruang = currentPreviewKirRoom || (allRooms || []).find(r => r.id === currentKirRoomId);
        const rName = (ruang?.nama_ruangan || 'Ruangan').replace(/[^a-zA-Z0-9_-]/g, '_');
        filename = `KIR_${rName}_F4_${schoolClean}_${appProfile.tahun_anggaran || new Date().getFullYear()}.pdf`;
    } else if (currentPreviewReportType === 'buku_induk') {
        filename = `Buku_Inventaris_BMD_Lengkap_F4_${schoolClean}_${tahunFile}.pdf`;
    } else if (currentPreviewReportType === 'bph_masuk') {
        filename = `BPH_Penerimaan_Masuk_F4_${schoolClean}_${appProfile.tahun_anggaran || new Date().getFullYear()}.pdf`;
    } else if (currentPreviewReportType === 'bph_keluar') {
        filename = `BPH_Pengeluaran_Keluar_F4_${schoolClean}_${appProfile.tahun_anggaran || new Date().getFullYear()}.pdf`;
    } else if (currentPreviewReportType === 'bph_saldo') {
        filename = `BPH_Rekapitulasi_Saldo_F4_${schoolClean}_${appProfile.tahun_anggaran || new Date().getFullYear()}.pdf`;
    } else if (currentPreviewReportType === 'penghapusan') {
        filename = `Usulan_Penghapusan_BMD_F4_${schoolClean}_${appProfile.tahun_anggaran || new Date().getFullYear()}.pdf`;
    } else if (currentPreviewReportType === 'mutasi') {
        filename = `Rekap_Mutasi_Aset_F4_${schoolClean}_${appProfile.tahun_anggaran || new Date().getFullYear()}.pdf`;
    }

    if (typeof html2pdf !== 'undefined') {
        // Tampilkan Loading Muter (Spinner) yang jelas agar pengguna tahu proses sedang berlangsung
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Menyiapkan Berkas PDF...',
                html: `
                    <div class="py-2 text-center">
                        <div class="spinner-border text-primary mb-3" style="width: 3.5rem; height: 3.5rem;" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <div class="fw-bold text-dark fs-6 mb-1">Sedang Menyusun Laporan PDF Resmi</div>
                        <div class="text-secondary small mb-2">Mengoptimalkan tata letak ke ukuran <b>F4 (Folio Landscape 330 x 215 mm)</b>...</div>
                        <div class="badge bg-light text-primary border px-3 py-1 font-monospace">Menyesuaikan Skala Seluruh Kolom Tanpa Terpotong</div>
                    </div>
                `,
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false
            });
            // Beri jeda 250ms agar browser sempat menggambar spinner animasi sebelum proses berat html2canvas
            await new Promise(resolve => setTimeout(resolve, 250));
        }

        try {
            // Terapkan class skala khusus F4 (Folio Landscape) agar seluruh 22 kolom proporsional
            sheetEl.classList.add('kib-pdf-folio-render');

            const opt = {
                margin: [4, 4, 4, 4],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    letterRendering: true,
                    logging: false,
                    scrollX: 0,
                    scrollY: 0
                },
                jsPDF: {
                    unit: 'mm',
                    format: [330, 215], // Ukuran Standar F4 / Folio Indonesia (Landscape)
                    orientation: 'landscape'
                },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };

            await html2pdf().set(opt).from(sheetEl).save();

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: 'Unduhan PDF Berhasil!',
                    html: `Berkas resmi <b>"${filename}"</b> (F4 Folio Landscape) telah selesai diunduh.`,
                    timer: 2500,
                    showConfirmButton: false
                });
            }
        } catch (err) {
            console.error('[SINBAS PDF] Gagal membuat PDF:', err);
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'info',
                    title: 'Membuka Dialog Cetak',
                    text: 'Dialihkan ke dialog cetak browser (Pilih "Save as PDF / Simpan sebagai PDF").',
                    timer: 2500,
                    showConfirmButton: false
                });
            }
            printKibPreviewDocument();
        } finally {
            sheetEl.classList.remove('kib-pdf-folio-render');
            sheetEl.style.transform = prevTransform;
        }
    } else {
        sheetEl.style.transform = prevTransform;
        printKibPreviewDocument();
    }
}
window.downloadKibPreviewPdf = downloadKibPreviewPdf;

async function executeKibExcelDownload(skipPrompt = false, customTtd = null) {
    if (!skipPrompt) {
        requestLaporanActionWithTtd('excel');
        return;
    }
    const ttd = customTtd || window.currentLaporanTtd || null;

    if (currentPreviewReportType === 'kib') {
        const filterTahun = getActiveKibFilterTahun();
        const targetAssets = getFilteredKibAssets(currentPreviewKibType);
        await SinbasExcelExporter.exportKibExcelJS(currentPreviewKibType, targetAssets, appProfile, currentKibFormatVersion, filterTahun, ttd);
    } else if (currentPreviewReportType === 'kir') {
        const ruang = currentPreviewKirRoom || allRooms.find(r => r.id === currentKirRoomId) || allRooms[0];
        if (ruang) SinbasExcelExporter.exportKir(ruang, allAssets, appProfile, ttd);
    } else if (currentPreviewReportType === 'buku_induk') {
        const paneLap = document.getElementById('pane_laporan');
        const isPaneLap = paneLap && !paneLap.classList.contains('d-none');
        const filterTahun = isPaneLap 
            ? (document.getElementById('filter_kib_laporan_tahun')?.value || 'Semua')
            : (document.getElementById('filter_bi_tahun')?.value || 'Semua');
        const targetAssets = getFilteredBukuIndukAssets();
        await SinbasExcelExporter.exportBukuInventarisSemua(targetAssets, appProfile, filterTahun, ttd);
    } else if (currentPreviewReportType === 'bph_masuk') {
        exportBphMasukExcel(ttd);
    } else if (currentPreviewReportType === 'bph_keluar') {
        exportBphKeluarExcel(ttd);
    } else if (currentPreviewReportType === 'bph_saldo') {
        exportBphSaldoExcel(ttd);
    } else if (currentPreviewReportType === 'penghapusan') {
        exportPenghapusanExcel(ttd);
    } else if (currentPreviewReportType === 'mutasi') {
        exportMutasiExcel(ttd);
    }
}

function previewPenghapusanReport() {
    currentPreviewReportType = 'penghapusan';
    currentPreviewZoom = 1.0;

    const modalEl = document.getElementById('modalPreviewKib');
    const badgeEl = document.getElementById('previewKibBadge');
    const titleEl = document.getElementById('previewKibTitle');
    const subTitleEl = document.getElementById('previewKibSubtitle');
    const sheetEl = document.getElementById('kibPreviewPaperSheet');
    const zoomLabelEl = document.getElementById('previewKibZoomLabel');
    const versionWrapper = document.getElementById('previewKibFormatVersionWrapper');
    const legendBar = document.getElementById('previewKibLegendBar');

    if (versionWrapper) versionWrapper.style.display = 'none';
    if (legendBar) legendBar.style.display = 'none';

    const q = (document.getElementById('search_penghapusan')?.value || '').toLowerCase().trim();
    let filteredList = (allRiwayatPenghapusan || []).slice().reverse();
    if (q) {
        filteredList = filteredList.filter(h =>
            (h.nibar || '').toLowerCase().includes(q) ||
            (h.nama_barang || '').toLowerCase().includes(q) ||
            (h.spesifikasi_nama || '').toLowerCase().includes(q) ||
            (h.kode_barang || '').toLowerCase().includes(q) ||
            (h.alasan || '').toLowerCase().includes(q) ||
            (h.keterangan || '').toLowerCase().includes(q) ||
            (h.asal_usul || '').toLowerCase().includes(q)
        );
    }

    const filterInfo = q ? ` • [Filter Cari: "${q}" • ${filteredList.length} Aset]` : ` • [${filteredList.length} Aset Diusulkan]`;

    if (badgeEl) badgeEl.textContent = 'PENGHAPUSAN';
    if (titleEl) titleEl.textContent = 'Pratinjau Rekapitulasi Usulan Penghapusan Barang Milik Daerah (BMD)';
    if (subTitleEl) subTitleEl.textContent = `Format Rekapitulasi Usulan Penghapusan • Satuan Kerja: ${appProfile.nama_sekolah || 'SMAN 15 TEBO'}${filterInfo}`;

    if (zoomLabelEl) zoomLabelEl.textContent = '100%';
    if (sheetEl) {
        sheetEl.style.transform = 'scale(1)';
        sheetEl.innerHTML = SinbasExcelExporter.renderPenghapusanPreviewHtml(filteredList, appProfile, window.currentLaporanTtd);
    }

    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
    }
}

async function previewMutasiReport() {
    currentPreviewReportType = 'mutasi';
    currentPreviewZoom = 1.0;

    const modalEl = document.getElementById('modalPreviewKib');
    const badgeEl = document.getElementById('previewKibBadge');
    const titleEl = document.getElementById('previewKibTitle');
    const subTitleEl = document.getElementById('previewKibSubtitle');
    const sheetEl = document.getElementById('kibPreviewPaperSheet');
    const zoomLabelEl = document.getElementById('previewKibZoomLabel');
    const versionWrapper = document.getElementById('previewKibFormatVersionWrapper');
    const legendBar = document.getElementById('previewKibLegendBar');

    if (versionWrapper) versionWrapper.style.display = 'none';
    if (legendBar) legendBar.style.display = 'none';

    const list = await db.getAll('riwayat_mutasi');
    const q = (document.getElementById('search_mutasi')?.value || '').toLowerCase().trim();
    let filteredList = (list || []).slice().reverse();
    if (q) {
        filteredList = filteredList.filter(m =>
            (m.nibar || '').toLowerCase().includes(q) ||
            (m.nama_barang || '').toLowerCase().includes(q) ||
            (m.ruangan_asal_nama || '').toLowerCase().includes(q) ||
            (m.ruangan_tujuan_nama || '').toLowerCase().includes(q) ||
            (m.alasan_mutasi || '').toLowerCase().includes(q) ||
            (m.no_berita_acara || '').toLowerCase().includes(q) ||
            (m.petugas || '').toLowerCase().includes(q)
        );
    }

    const filterInfo = q ? ` • [Filter Cari: "${q}" • ${filteredList.length} Riwayat]` : ` • [${filteredList.length} Riwayat Pergerakan]`;

    if (badgeEl) badgeEl.textContent = 'MUTASI';
    if (titleEl) titleEl.textContent = 'Pratinjau Catatan Riwayat Mutasi & Perpindahan Ruangan Barang';
    if (subTitleEl) subTitleEl.textContent = `Rekapitulasi Mutasi Antar Ruangan • Satuan Kerja: ${appProfile.nama_sekolah || 'SMAN 15 TEBO'}${filterInfo}`;

    if (zoomLabelEl) zoomLabelEl.textContent = '100%';
    if (sheetEl) {
        sheetEl.style.transform = 'scale(1)';
        sheetEl.innerHTML = SinbasExcelExporter.renderMutasiPreviewHtml(filteredList, appProfile, window.currentLaporanTtd);
    }

    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
    }
}

async function exportMutasiExcel() {
    const list = await db.getAll('riwayat_mutasi');
    if (!list || list.length === 0) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'info', title: 'Data Kosong', text: 'Belum ada data riwayat perpindahan/mutasi aset untuk diekspor.' });
        }
        return;
    }

    const q = (document.getElementById('search_mutasi')?.value || '').toLowerCase().trim();
    let exportList = list.slice().reverse();
    if (q) {
        exportList = exportList.filter(m =>
            (m.nibar || '').toLowerCase().includes(q) ||
            (m.nama_barang || '').toLowerCase().includes(q) ||
            (m.ruangan_asal_nama || '').toLowerCase().includes(q) ||
            (m.ruangan_tujuan_nama || '').toLowerCase().includes(q) ||
            (m.alasan_mutasi || '').toLowerCase().includes(q) ||
            (m.no_berita_acara || '').toLowerCase().includes(q) ||
            (m.petugas || '').toLowerCase().includes(q)
        );
    }

    const prov = (appProfile.provinsi || 'JAMBI').toUpperCase();
    const instansi = (appProfile.nama_instansi || `PEMERINTAH PROVINSI ${prov}`).toUpperCase();
    const opd = (appProfile.nama_opd !== undefined ? appProfile.nama_opd : 'DINAS PENDIDIKAN DAN KEBUDAYAAN').trim();

    const rows = [
        ['BUKU CATATAN REKAPITULASI MUTASI & PERPINDAHAN RUANGAN BARANG (BMD)'],
        [`SATUAN PENDIDIKAN: ${appProfile.nama_sekolah || 'SMAN 15 TEBO'}`],
        [`${instansi}${opd ? ` • ${opd.toUpperCase()}` : ''} • TAHUN: ${appProfile.tahun_anggaran || new Date().getFullYear()}`],
        [''],
        [
            'No.',
            'Tanggal Mutasi',
            'NIBAR',
            'Nama Barang',
            'Ruangan Asal',
            'Ruangan Tujuan',
            'Alasan Mutasi',
            'No. Berita Acara',
            'Petugas'
        ]
    ];

    exportList.forEach((m, idx) => {
        rows.push([
            idx + 1,
            m.tanggal_mutasi || '-',
            m.nibar || '-',
            m.nama_barang || '-',
            m.ruangan_asal_nama || '-',
            m.ruangan_tujuan_nama || '-',
            m.alasan_mutasi || '-',
            m.no_berita_acara || '-',
            m.petugas || '-'
        ]);
    });

    SinbasExcelExporter.generateFile(
        rows,
        `Riwayat_Mutasi_BMD_${new Date().getFullYear()}.xlsx`,
        'Riwayat Mutasi',
        [
            { wch: 5 }, { wch: 15 }, { wch: 22 }, { wch: 30 }, { wch: 20 },
            { wch: 20 }, { wch: 30 }, { wch: 22 }, { wch: 20 }
        ]
    );
}

// =========================================================================
// MENU 4: KARTU INVENTARIS RUANGAN (KIR) VIEW
// =========================================================================
function renderKirView() {
    const selectRuang = document.getElementById('select_kir_ruang');
    if (selectRuang) selectRuang.value = currentKirRoomId;

    const ruang = allRooms.find(r => r.id === currentKirRoomId) || allRooms[0];
    if (!ruang) return;

    document.getElementById('kir_nama_ruangan').textContent = ruang.nama_ruangan;
    document.getElementById('kir_kode_ruangan').textContent = ruang.kode_ruangan;
    document.getElementById('kir_pj').textContent = ruang.penanggung_jawab || '-';
    document.getElementById('kir_nip_pj').textContent = ruang.nip_penanggung_jawab || '-';
    document.getElementById('kir_gedung').textContent = ruang.lokasi_gedung || '-';

    const roomAssets = allAssets.filter(a => a.ruangan_id === ruang.id);
    const tbody = document.getElementById('kirTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (roomAssets.length === 0) {
        renderTablePagination('kir', 0);
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted"><i class="fas fa-boxes fa-2x mb-2 d-block"></i>Belum ada aset terdaftar di ruangan ${ruang.nama_ruangan}</td></tr>`;
        return;
    }

    const totalItems = roomAssets.length;
    renderTablePagination('kir', totalItems);
    const pState = tablePagination.kir;
    const startIdx = (pState.page - 1) * pState.perPage;
    const pagedRoomAssets = roomAssets.slice(startIdx, startIdx + pState.perPage);

    pagedRoomAssets.forEach((ast, idx) => {
        let badgeKondisi = `<span class="badge-kondisi-b">Baik</span>`;
        if (ast.kondisi === 'Rusak Ringan') badgeKondisi = `<span class="badge-kondisi-rr">Rusak Ringan</span>`;
        else if (ast.kondisi === 'Rusak Berat') badgeKondisi = `<span class="badge-kondisi-rb">Rusak Berat</span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">${startIdx + idx + 1}</td>
            <td><div class="fw-bold">${ast.spesifikasi_nama || ast.nama_barang}</div><small class="badge-kode">${ast.kode_barang}</small></td>
            <td><span class="badge-nibar font-monospace">${ast.nibar}</span></td>
            <td><span class="badge bg-light text-dark border font-monospace">${ast.no_register}</span></td>
            <td><b>${ast.merk_tipe || '-'}</b></td>
            <td><small class="text-muted font-monospace">${ast.no_pabrik_seri || '-'}</small></td>
            <td class="text-center font-monospace">${ast.tahun_perolehan}</td>
            <td class="text-center fw-bold">${ast.jumlah || 1} ${ast.satuan || 'Unit'}</td>
            <td class="text-center">${badgeKondisi}</td>
            <td class="text-end fw-bold text-primary">Rp ${(Number(ast.nilai_total || ast.harga_satuan) || 0).toLocaleString('id-ID')}</td>
        `;
        tbody.appendChild(tr);
    });
}

function onKirRoomChanged() {
    const sel = document.getElementById('select_kir_ruang');
    if (sel) {
        currentKirRoomId = sel.value;
        renderKirView();
    }
}

function downloadCurrentKirExcel() {
    previewKirReport(currentKirRoomId);
}

// =========================================================================
// MUTASI RUANGAN ASET
// =========================================================================
function openMutasiModal(asetId) {
    const aset = allAssets.find(a => a.id === asetId);
    if (!aset) return;

    document.getElementById('mutasi_aset_id').value = aset.id;
    document.getElementById('mutasi_display_nama').textContent = aset.spesifikasi_nama || aset.nama_barang;
    document.getElementById('mutasi_display_nibar').textContent = aset.nibar;
    document.getElementById('mutasi_asal_id').value = aset.ruangan_id;
    document.getElementById('mutasi_display_asal').textContent = aset.ruangan_nama || '-';

    const modal = new bootstrap.Modal(document.getElementById('modalMutasi'));
    modal.show();
}

async function processAssetMutation() {
    const asetId = document.getElementById('mutasi_aset_id').value;
    const asalId = document.getElementById('mutasi_asal_id').value;
    const tujuanId = document.getElementById('mutasi_tujuan_id').value;
    const alasan = document.getElementById('mutasi_alasan').value || 'Penyesuaian kebutuhan kelas';
    const noBA = document.getElementById('mutasi_no_ba').value || 'BA-MUTASI/' + Date.now();
    const petugas = document.getElementById('mutasi_petugas').value || appProfile.pengurus_barang || 'Pengurus Barang';

    const aset = allAssets.find(a => a.id === asetId);
    const ruangAsal = allRooms.find(r => r.id === asalId);
    const ruangTujuan = allRooms.find(r => r.id === tujuanId);

    if (!aset || !ruangTujuan) return;

    const logMutasi = {
        id: 'MUT-' + Date.now(),
        aset_id: aset.id,
        nibar: aset.nibar,
        nama_barang: aset.spesifikasi_nama || aset.nama_barang,
        tanggal_mutasi: new Date().toISOString().split('T')[0],
        ruangan_asal_id: asalId,
        ruangan_asal_nama: ruangAsal ? ruangAsal.nama_ruangan : '-',
        ruangan_tujuan_id: tujuanId,
        ruangan_tujuan_nama: ruangTujuan.nama_ruangan,
        petugas: petugas,
        alasan_mutasi: alasan,
        no_berita_acara: noBA
    };
    await db.put('riwayat_mutasi', logMutasi);

    await db.update('aset', aset.id, {
        ruangan_id: tujuanId,
        ruangan_nama: ruangTujuan.nama_ruangan,
        updated_at: new Date().toISOString()
    });

    await loadAssets();
    renderBukuIndukTable();
    renderKibTable();
    renderKirView();

    const modalEl = document.getElementById('modalMutasi');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Mutasi Berhasil Dilakukan!',
            text: `Aset berhasil dipindahkan ke: ${ruangTujuan.nama_ruangan}. NIBAR tetap melekat seumur hidup aset.`
        });
    }
}

async function renderMutasiHistory() {
    const list = await db.getAll('riwayat_mutasi');
    const tbody = document.getElementById('mutasiHistoryTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!list || list.length === 0) {
        renderTablePagination('mutasi', 0);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted"><i class="fas fa-history fa-2x mb-2 d-block"></i>Belum ada riwayat pergerakan/mutasi aset.</td></tr>';
        return;
    }

    const q = (document.getElementById('search_mutasi')?.value || '').toLowerCase().trim();
    let reversedList = list.slice().reverse();
    if (q) {
        reversedList = reversedList.filter(m =>
            (m.nibar || '').toLowerCase().includes(q) ||
            (m.nama_barang || '').toLowerCase().includes(q) ||
            (m.ruangan_asal_nama || '').toLowerCase().includes(q) ||
            (m.ruangan_tujuan_nama || '').toLowerCase().includes(q) ||
            (m.alasan_mutasi || '').toLowerCase().includes(q) ||
            (m.no_berita_acara || '').toLowerCase().includes(q) ||
            (m.petugas || '').toLowerCase().includes(q)
        );
    }

    const totalItems = reversedList.length;
    renderTablePagination('mutasi', totalItems);
    const pState = tablePagination.mutasi;
    const startIdx = (pState.page - 1) * pState.perPage;
    const pagedMut = reversedList.slice(startIdx, startIdx + pState.perPage);

    if (pagedMut.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted"><i class="fas fa-search fa-2x mb-2 d-block"></i>Tidak ada data riwayat mutasi yang cocok dengan pencarian.</td></tr>';
        return;
    }

    pagedMut.forEach((mut, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">${startIdx + idx + 1}</td>
            <td><span class="badge bg-light text-dark border px-2 py-1">${mut.tanggal_mutasi || '-'}</span></td>
            <td><small class="badge-nibar mb-1">${mut.nibar || '-'}</small><br><b>${mut.nama_barang || '-'}</b></td>
            <td><span class="badge bg-secondary">${mut.ruangan_asal_nama || '-'}</span></td>
            <td><span class="badge bg-success">${mut.ruangan_tujuan_nama || '-'}</span></td>
            <td><small>${mut.alasan_mutasi || '-'}</small><br><span class="badge bg-light text-dark border font-monospace">${mut.no_berita_acara || '-'}</span></td>
            <td>${mut.petugas || '-'}</td>
            <td class="text-center text-nowrap">
                <button type="button" class="btn btn-sm btn-outline-danger py-1 px-2 shadow-sm" title="Hapus Riwayat Mutasi Ini" onclick="deleteRiwayatMutasi('${mut.id}')">
                    <i class="fas fa-trash-alt me-1"></i>Hapus
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function exportMutasiExcel(customTtd = null) {
    const list = await db.getAll('riwayat_mutasi');
    if (!list || list.length === 0) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'info', title: 'Data Kosong', text: 'Belum ada riwayat mutasi aset untuk diekspor.' });
        }
        return;
    }

    const q = (document.getElementById('search_mutasi')?.value || '').toLowerCase().trim();
    let exportList = list.slice().reverse();
    if (q) {
        exportList = exportList.filter(m =>
            (m.nibar || '').toLowerCase().includes(q) ||
            (m.nama_barang || '').toLowerCase().includes(q) ||
            (m.ruangan_asal_nama || '').toLowerCase().includes(q) ||
            (m.ruangan_tujuan_nama || '').toLowerCase().includes(q) ||
            (m.alasan_mutasi || '').toLowerCase().includes(q) ||
            (m.no_berita_acara || '').toLowerCase().includes(q) ||
            (m.petugas || '').toLowerCase().includes(q)
        );
    }

    const rows = [
        ['CATATAN RIWAYAT MUTASI & PERPINDAHAN RUANGAN BARANG (BMD)'],
        [`SATUAN PENDIDIKAN: ${appProfile.nama_sekolah || 'SMAN 15 TEBO'}`],
        [`PEMERINTAH PROVINSI ${(appProfile.provinsi || 'JAMBI').toUpperCase()} • NPSN: ${appProfile.npsn || '10505963'}`],
        [''],
        ['No.', 'Tanggal Mutasi', 'NIBAR', 'Nama Barang / Spesifikasi', 'Ruangan Asal', 'Ruangan Tujuan', 'Alasan Mutasi', 'No. Berita Acara', 'Petugas']
    ];

    exportList.forEach((m, idx) => {
        rows.push([
            idx + 1,
            m.tanggal_mutasi || '-',
            m.nibar || '-',
            m.nama_barang || '-',
            m.ruangan_asal_nama || '-',
            m.ruangan_tujuan_nama || '-',
            m.alasan_mutasi || '-',
            m.no_berita_acara || '-',
            m.petugas || '-'
        ]);
    });

    rows.push([]);
    SinbasExcelExporter.appendSignatures(rows, appProfile, null, customTtd || window.currentLaporanTtd);

    SinbasExcelExporter.generateFile(
        rows,
        `Rekap_Mutasi_Aset_${new Date().getFullYear()}.xlsx`,
        'Riwayat Mutasi',
        [
            { wch: 5 }, { wch: 15 }, { wch: 22 }, { wch: 32 }, { wch: 20 },
            { wch: 20 }, { wch: 25 }, { wch: 22 }, { wch: 20 }
        ]
    );
}

async function deleteRiwayatMutasi(mutId) {
    if (typeof Swal !== 'undefined') {
        const res = await Swal.fire({
            icon: 'warning',
            title: 'Hapus Riwayat Mutasi?',
            text: 'Data riwayat pergerakan/mutasi barang ini akan dihapus permanen dari daftar riwayat.',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: '<i class="fas fa-trash-alt me-1"></i> Ya, Hapus',
            cancelButtonText: 'Batal'
        });
        if (!res.isConfirmed) return;
    } else {
        if (!confirm('Hapus riwayat mutasi ini?')) return;
    }

    try {
        await db.delete('riwayat_mutasi', mutId);
        await renderMutasiHistory();
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Riwayat Dihapus',
                text: 'Catatan mutasi berhasil dihapus dari sistem.',
                timer: 1500,
                showConfirmButton: false
            });
        }
    } catch (err) {
        console.error('[SINBAS] Gagal hapus riwayat mutasi:', err);
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menghapus',
                text: err.message || 'Terjadi kesalahan saat menghapus data riwayat mutasi.'
            });
        }
    }
}

// =========================================================================
// CETAK STIKER LABEL QR CODE (ASSET TAGS)
// =========================================================================
function renderStickersGrid() {
    const container = document.getElementById('stickersGridContainer');
    if (!container) return;

    container.innerHTML = '';
    if (allAssets.length === 0) {
        container.innerHTML = '<div class="text-center py-5 text-muted">Belum ada aset untuk dicetak stikernya.</div>';
        return;
    }

    allAssets.forEach(ast => {
        const card = document.createElement('div');
        card.className = 'asset-sticker-card';
        const qrId = 'qr_canv_' + ast.id.replace(/[^a-zA-Z0-9]/g, '_');

        card.innerHTML = `
            <div class="sticker-header">
                <img src="${appProfile.logo_sekolah || localStorage.getItem('sinbas_logo_sekolah') || 'assets/img/logo_sinbas.png'}" class="sticker-logo" alt="Logo">
                <div>
                    <div class="sticker-org-title">${appProfile.nama_sekolah || 'SMAN 15 TEBO'}</div>
                    <div style="font-size: 0.58rem; color: #475569;">INVENTARIS BARANG MILIK DAERAH</div>
                </div>
            </div>
            <div class="sticker-body">
                <div class="sticker-qr-box" id="${qrId}"></div>
                <div class="sticker-info">
                    <div class="sticker-nibar">${ast.nibar}</div>
                    <div class="sticker-nama">${ast.spesifikasi_nama || ast.nama_barang}</div>
                    <div style="color: #64748b;">Kode: ${ast.kode_barang}</div>
                    <div style="color: #64748b;">Merk: ${ast.merk_tipe || '-'} | Seri: ${ast.no_pabrik_seri || '-'}</div>
                    <div style="color: #1e3a8a; font-weight: 600;">Ruang: ${ast.ruangan_nama || '-'}</div>
                </div>
            </div>
            <div class="sticker-footer">
                <span>TAHUN: ${ast.tahun_perolehan}</span>
                <span>KONDISI: ${ast.kondisi}</span>
                <span>DANA: ${ast.asal_usul || 'BOS'}</span>
            </div>
        `;
        container.appendChild(card);

        setTimeout(() => {
            const qrBox = document.getElementById(qrId);
            if (qrBox && typeof QRCode !== 'undefined') {
                qrBox.innerHTML = '';
                new QRCode(qrBox, {
                    text: NibarGenerator.createQrPayload(ast, appProfile),
                    width: 76,
                    height: 76,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            }
        }, 20);
    });
}

// =========================================================================
// SISTEM CETAK STIKER QR CODE (SATUAN & BATCH A4 / PDF)
// =========================================================================
let cachedLogoBase64 = null;

async function getLogoBase64() {
    if (appProfile && appProfile.logo_sekolah) {
        return appProfile.logo_sekolah;
    }
    const localLogo = localStorage.getItem('sinbas_logo_sekolah');
    if (localLogo) return localLogo;
    if (cachedLogoBase64) return cachedLogoBase64;
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width || 80;
                canvas.height = img.naturalHeight || img.height || 80;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                cachedLogoBase64 = canvas.toDataURL('image/png');
                resolve(cachedLogoBase64);
            } catch (e) {
                console.warn('Gagal render logo base64:', e);
                resolve('assets/img/logo_sinbas.png');
            }
        };
        img.onerror = () => {
            resolve('assets/img/logo_sinbas.png');
        };
        img.src = 'assets/img/logo_sinbas.png';
    });
}

function generateQrDataUrl(text, size = 130) {
    return new Promise((resolve) => {
        try {
            if (typeof QRCode === 'undefined') {
                console.error('Library QRCode tidak ditemukan.');
                resolve('');
                return;
            }
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'fixed';
            tempDiv.style.top = '-9999px';
            tempDiv.style.left = '-9999px';
            tempDiv.style.width = size + 'px';
            tempDiv.style.height = size + 'px';
            tempDiv.style.visibility = 'hidden';
            document.body.appendChild(tempDiv);

            new QRCode(tempDiv, {
                text: String(text || ''),
                width: size,
                height: size,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });

            setTimeout(() => {
                let dataUrl = '';
                const canvas = tempDiv.querySelector('canvas');
                if (canvas) {
                    try { dataUrl = canvas.toDataURL('image/png'); } catch (e) {}
                }
                if (!dataUrl) {
                    const img = tempDiv.querySelector('img');
                    if (img && img.src && img.src.startsWith('data:')) {
                        dataUrl = img.src;
                    }
                }
                tempDiv.remove();
                resolve(dataUrl);
            }, 40);
        } catch (err) {
            console.error('Error in generateQrDataUrl:', err);
            resolve('');
        }
    });
}

function renderSingleStickerHtml(ast, qrDataUrl, logoDataUrl) {
    const sekolahNama = (appProfile && appProfile.nama_sekolah) ? appProfile.nama_sekolah.toUpperCase() : 'SMAN 15 TEBO';
    const spekNama = (ast.spesifikasi_nama || ast.nama_barang || '-').replace(/\s*\(Unit\s*#?\d+\)$/i, '');
    const merkTipe = ast.merk_tipe || '-';
    const noSeri = ast.no_pabrik_seri || '-';
    const ruangan = ast.ruangan_nama || 'Belum Ditentukan';
    const thn = ast.tahun_perolehan || '-';
    const kondisi = ast.kondisi || 'Baik';
    const sumber = ast.asal_usul || 'BOS Reguler';

    return `
        <div class="asset-sticker">
            <div class="stk-header">
                <img src="${logoDataUrl}" class="stk-logo" alt="Logo">
                <div class="stk-header-text">
                    <div class="stk-header-instansi">PEMERINTAH PROVINSI JAMBI • DISDIK</div>
                    <div class="stk-header-school">${sekolahNama}</div>
                    <div class="stk-header-sub">INVENTARIS BARANG MILIK DAERAH (BMD)</div>
                </div>
            </div>
            <div class="stk-body">
                <div class="stk-qr-box">
                    ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR">` : `<div style="font-size:8px;color:#999;text-align:center;">QR Error</div>`}
                </div>
                <div class="stk-details">
                    <div class="stk-nibar" title="${ast.nibar}">${ast.nibar}</div>
                    <div class="stk-nama" title="${spekNama}">${spekNama}</div>
                    <div class="stk-reg-kode">
                        <span class="stk-reg">Reg. ${ast.no_register}</span>
                        <span class="stk-kode">${ast.kode_barang}</span>
                    </div>
                    <div class="stk-meta">Merk: ${merkTipe} | Seri: ${noSeri}</div>
                    <div class="stk-ruang">📍 Ruang: ${ruangan}</div>
                </div>
            </div>
            <div class="stk-footer">
                <span>THN: ${thn}</span>
                <span>KONDISI: ${kondisi}</span>
                <span>SUMBER: ${sumber}</span>
            </div>
        </div>
    `;
}

// 1. CETAK STIKER SATUAN (HANYA 1 UNIT SAJA)
async function printSingleLabel(asetId) {
    const ast = allAssets.find(a => a.id === asetId);
    if (!ast) {
        if (typeof Swal !== 'undefined') Swal.fire({ icon: 'warning', title: 'Data Aset Tidak Ditemukan' });
        return;
    }

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Menyiapkan Stiker QR...',
            html: `Membuat kode QR untuk unit register <b>${ast.no_register}</b> (${ast.nibar})`,
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });
    }

    const payloadText = (typeof NibarGenerator !== 'undefined') 
        ? NibarGenerator.createQrPayload(ast, appProfile)
        : JSON.stringify({ nibar: ast.nibar, nama: ast.nama_barang, reg: ast.no_register });

    const [qrDataUrl, logoDataUrl] = await Promise.all([
        generateQrDataUrl(payloadText, 140),
        getLogoBase64()
    ]);

    if (typeof Swal !== 'undefined') Swal.close();

    const stickerHtml = renderSingleStickerHtml(ast, qrDataUrl, logoDataUrl);
    const win = window.open('', '_blank', 'width=800,height=680');
    if (!win) {
        alert('Gagal membuka jendela cetak. Pastikan pop-up diizinkan.');
        return;
    }

    win.document.open();
    win.document.write(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Stiker QR Satuan - ${ast.nibar}</title>
    <style>
        @page { size: auto; margin: 10mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif;
            background: #f1f5f9;
            color: #0f172a;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 30px 20px;
            min-height: 100vh;
        }
        .no-print-toolbar {
            width: 100%;
            max-width: 480px;
            margin-bottom: 24px;
            background: white;
            padding: 16px 20px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
            border: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .toolbar-info h2 { font-size: 15px; font-weight: 700; color: #0284c7; margin-bottom: 4px; }
        .toolbar-info p { font-size: 12px; color: #64748b; }
        .toolbar-actions { display: flex; gap: 8px; }
        .btn-action-print {
            background: #0284c7;
            color: white;
            font-weight: 600;
            padding: 8px 16px;
            font-size: 13px;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(2,132,199,0.3);
        }
        .btn-action-print:hover { background: #0369a1; }
        .btn-action-close {
            background: #64748b;
            color: white;
            padding: 8px 12px;
            font-size: 13px;
            border-radius: 6px;
            border: none;
            cursor: pointer;
        }
        .sticker-container {
            background: white;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.1);
            border: 1px dashed #cbd5e1;
        }
        .asset-sticker {
            width: 95mm;
            min-height: 54mm;
            border: 2px solid #0f172a;
            border-radius: 6px;
            padding: 8px 10px;
            background: white;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
        }
        .stk-header {
            display: flex;
            align-items: center;
            gap: 8px;
            border-bottom: 1.5px solid #0f172a;
            padding-bottom: 4px;
            margin-bottom: 5px;
        }
        .stk-logo { width: 30px; height: 30px; object-fit: contain; }
        .stk-header-text { flex: 1; line-height: 1.15; }
        .stk-header-instansi { font-size: 6pt; font-weight: 700; color: #334155; text-transform: uppercase; }
        .stk-header-school { font-size: 7.5pt; font-weight: 800; color: #0f172a; text-transform: uppercase; }
        .stk-header-sub { font-size: 6pt; font-weight: 700; color: #0369a1; }
        .stk-body { display: flex; gap: 10px; align-items: center; flex: 1; }
        .stk-qr-box {
            width: 80px; height: 80px; flex-shrink: 0;
            border: 1px solid #cbd5e1; background: white;
            display: flex; align-items: center; justify-content: center; padding: 2px;
        }
        .stk-qr-box img { width: 100%; height: 100%; object-fit: contain; }
        .stk-details { flex: 1; font-size: 6.8pt; line-height: 1.3; color: #1e293b; overflow: hidden; }
        .stk-nibar { font-family: monospace; font-weight: 800; font-size: 7.5pt; color: #0369a1; margin-bottom: 2px; }
        .stk-nama { font-weight: 700; font-size: 7.8pt; color: #0f172a; margin-bottom: 2px; }
        .stk-reg-kode { display: flex; gap: 6px; margin-bottom: 2px; align-items: center; }
        .stk-reg { font-family: monospace; font-weight: 700; background: #0f172a; color: white; padding: 1px 5px; border-radius: 3px; font-size: 6.5pt; }
        .stk-kode { font-family: monospace; font-weight: 600; color: #475569; }
        .stk-meta { color: #475569; }
        .stk-ruang { font-weight: 700; color: #15803d; margin-top: 1px; }
        .stk-footer {
            display: flex; justify-content: space-between;
            border-top: 1px dashed #94a3b8; padding-top: 4px; margin-top: 4px;
            font-size: 6pt; font-weight: 600; color: #475569; text-transform: uppercase;
        }
        @media print {
            body { background: transparent !important; padding: 0 !important; }
            .no-print-toolbar { display: none !important; }
            .sticker-container { border: none !important; box-shadow: none !important; padding: 0 !important; }
            .asset-sticker { box-shadow: none !important; }
        }
    </style>
</head>
<body>
    <div class="no-print-toolbar">
        <div class="toolbar-info">
            <h2>Stiker Label QR Satuan (1 Unit)</h2>
            <p>NIBAR: <b>${ast.nibar}</b> • Register: <b>${ast.no_register}</b></p>
        </div>
        <div class="toolbar-actions">
            <button class="btn-action-print" onclick="window.print()">🖨️ Cetak Stiker</button>
            <button class="btn-action-close" onclick="window.close()">Tutup</button>
        </div>
    </div>
    <div class="sticker-container">
        ${stickerHtml}
    </div>
</body>
</html>`);
    win.document.close();
}

// 2. CETAK SEMUA STIKER DALAM PENGADAAN (A4 / PDF)
async function printBatchLabelsA4(batchId) {
    if (!batchId) {
        if (typeof Swal !== 'undefined') Swal.fire({ icon: 'warning', title: 'Batch ID Tidak Valid' });
        return;
    }

    let units = allAssets.filter(a => {
        if (a.batch_id && a.batch_id === batchId) return true;
        if (a.id === batchId) return true;
        if (a.id && a.id.startsWith(batchId + '-')) return true;
        return false;
    });

    if (units.length === 1 && (parseInt(units[0].jumlah, 10) || 1) > 1) {
        if (typeof SinbasExcelExporter !== 'undefined' && typeof SinbasExcelExporter.expandToSingleUnits === 'function') {
            units = SinbasExcelExporter.expandToSingleUnits(units);
        }
    }

    units.sort((a, b) => (parseInt(a.no_register, 10) || 0) - (parseInt(b.no_register, 10) || 0));

    if (units.length === 0) {
        if (typeof Swal !== 'undefined') Swal.fire({ icon: 'info', title: 'Data Tidak Ditemukan', text: 'Tidak ada unit barang dalam kelompok pengadaan ini.' });
        return;
    }

    const totalCount = units.length;
    const firstUnit = units[0];
    const lastUnit = units[units.length - 1];
    const baseSpek = (firstUnit.spesifikasi_nama || firstUnit.nama_barang || '').replace(/\s*\(Unit\s*#?\d+\)$/i, '');

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: `Menyiapkan ${totalCount} Stiker QR A4...`,
            html: `Membuat ${totalCount} kode QR untuk pengadaan <b>${baseSpek}</b> (Reg. ${firstUnit.no_register} s/d ${lastUnit.no_register})`,
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });
    }

    const logoDataUrl = await getLogoBase64();

    // Generate semua QR data URLs secara berurutan
    const stickersHtmlList = [];
    for (let i = 0; i < units.length; i++) {
        const u = units[i];
        const payloadText = (typeof NibarGenerator !== 'undefined') 
            ? NibarGenerator.createQrPayload(u, appProfile)
            : JSON.stringify({ nibar: u.nibar, nama: u.nama_barang, reg: u.no_register });
        const qrDataUrl = await generateQrDataUrl(payloadText, 130);
        stickersHtmlList.push(renderSingleStickerHtml(u, qrDataUrl, logoDataUrl));
    }

    if (typeof Swal !== 'undefined') Swal.close();

    const win = window.open('', '_blank', 'width=1000,height=850');
    if (!win) {
        alert('Gagal membuka jendela cetak. Pastikan pop-up diizinkan pada browser Anda.');
        return;
    }

    win.document.open();
    win.document.write(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Cetak Semua Stiker QR A4 - ${baseSpek} (${totalCount} Unit)</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 8mm 10mm;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif;
            background: #f1f5f9;
            color: #0f172a;
            padding: 24px;
            min-height: 100vh;
        }
        .no-print-toolbar {
            max-width: 194mm;
            margin: 0 auto 20px auto;
            background: #ffffff;
            padding: 16px 20px;
            border-radius: 12px;
            border: 1px solid #cbd5e1;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
        }
        .toolbar-info h2 {
            font-size: 16px;
            font-weight: 800;
            color: #0284c7;
            margin-bottom: 4px;
        }
        .toolbar-info p {
            font-size: 12.5px;
            color: #475569;
        }
        .toolbar-actions {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .btn-action-print {
            background: #0284c7;
            color: white;
            font-weight: 700;
            padding: 10px 20px;
            font-size: 13.5px;
            border-radius: 7px;
            border: none;
            cursor: pointer;
            box-shadow: 0 3px 8px rgba(2,132,199,0.3);
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .btn-action-print:hover { background: #0369a1; }
        .btn-action-close {
            background: #64748b;
            color: white;
            padding: 10px 16px;
            font-size: 13.5px;
            border-radius: 7px;
            border: none;
            cursor: pointer;
        }
        .a4-print-sheet {
            width: 190mm;
            margin: 0 auto;
            background: transparent;
        }
        .stickers-a4-grid {
            display: grid;
            grid-template-columns: repeat(2, 92mm);
            gap: 6mm;
            justify-content: center;
        }
        .asset-sticker {
            width: 92mm;
            height: 52mm;
            border: 1.5px solid #0f172a;
            border-radius: 5px;
            padding: 7px 8px;
            background: #ffffff;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            page-break-inside: avoid;
            break-inside: avoid;
            box-sizing: border-box;
            box-shadow: 0 2px 6px rgba(0,0,0,0.06);
        }
        .stk-header {
            display: flex;
            align-items: center;
            gap: 6px;
            border-bottom: 1.5px solid #0f172a;
            padding-bottom: 3px;
            margin-bottom: 4px;
        }
        .stk-logo { width: 26px; height: 26px; object-fit: contain; }
        .stk-header-text { flex: 1; line-height: 1.1; }
        .stk-header-instansi { font-size: 5.5pt; font-weight: 700; color: #334155; text-transform: uppercase; }
        .stk-header-school { font-size: 7pt; font-weight: 800; color: #0f172a; text-transform: uppercase; }
        .stk-header-sub { font-size: 5.5pt; font-weight: 700; color: #0369a1; }
        .stk-body { display: flex; gap: 8px; align-items: center; flex: 1; }
        .stk-qr-box {
            width: 76px; height: 76px; flex-shrink: 0;
            border: 1px solid #cbd5e1; background: white;
            display: flex; align-items: center; justify-content: center; padding: 2px;
        }
        .stk-qr-box img { width: 100%; height: 100%; object-fit: contain; }
        .stk-details { flex: 1; font-size: 6.2pt; line-height: 1.25; color: #1e293b; overflow: hidden; }
        .stk-nibar {
            font-family: 'Consolas', 'Courier New', monospace;
            font-weight: 800; font-size: 6.8pt; color: #0369a1;
            margin-bottom: 2px; letter-spacing: 0.2px; word-break: break-all;
        }
        .stk-nama {
            font-weight: 700; font-size: 7pt; color: #0f172a;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;
        }
        .stk-reg-kode { display: flex; gap: 6px; margin-bottom: 2px; align-items: center; }
        .stk-reg {
            font-family: monospace; font-weight: 700;
            background: #0f172a; color: white; padding: 1px 4px;
            border-radius: 3px; font-size: 6pt;
        }
        .stk-kode { font-family: monospace; font-weight: 600; color: #475569; }
        .stk-meta { color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .stk-ruang { font-weight: 700; color: #15803d; margin-top: 1px; }
        .stk-footer {
            display: flex; justify-content: space-between;
            border-top: 1px dashed #94a3b8; padding-top: 3px; margin-top: 3px;
            font-size: 5.5pt; font-weight: 600; color: #475569; text-transform: uppercase;
        }
        @media print {
            body { background: transparent !important; padding: 0 !important; }
            .no-print-toolbar { display: none !important; }
            .a4-print-sheet { width: 100% !important; margin: 0 !important; }
            .asset-sticker { box-shadow: none !important; page-break-inside: avoid !important; break-inside: avoid !important; }
        }
    </style>
</head>
<body>
    <div class="no-print-toolbar">
        <div class="toolbar-info">
            <h2>Lembar Cetak Stiker QR Inventaris (Format Kertas A4 / PDF)</h2>
            <p>Pengadaan: <b>${baseSpek}</b> • Total: <b>${totalCount} Unit</b> (${firstUnit.satuan || 'Unit'}) • Register <b>${firstUnit.no_register}</b> s/d <b>${lastUnit.no_register}</b></p>
        </div>
        <div class="toolbar-actions">
            <button class="btn-action-print" onclick="window.print()">🖨️ Cetak / Simpan PDF (A4)</button>
            <button class="btn-action-close" onclick="window.close()">Tutup</button>
        </div>
    </div>
    <div class="a4-print-sheet">
        <div class="stickers-a4-grid">
            ${stickersHtmlList.join('')}
        </div>
    </div>
</body>
</html>`);
    win.document.close();
}

function printAllStickers() {
    window.print();
}

// =========================================================================
// SENSUS / STOCK OPNAME VIA WEBCAM QR SCANNER
// =========================================================================
function renderBphSaldoTable() {
    renderBphBukuPersediaanTable();
}

function toggleQrScanner() {
    const btn = document.getElementById('btnToggleScanner');

    if (html5QrScanner) {
        html5QrScanner.stop().then(() => {
            html5QrScanner.clear();
            html5QrScanner = null;
            if (btn) {
                btn.className = 'btn btn-sm btn-primary-custom';
                btn.innerHTML = '<i class="fas fa-camera me-1"></i> Buka Kamera Scanner';
            }
            const readerEl = document.getElementById('qr-reader');
            if (readerEl) {
                readerEl.innerHTML = '<span class="text-white-50 small p-4"><i class="fas fa-video-slash fa-2x d-block mb-2 text-secondary"></i>Kamera dimatikan.<br>Klik tombol <b>"Buka Kamera Scanner"</b> di atas.</span>';
            }
        }).catch(err => {
            console.warn('Gagal stop scanner:', err);
            html5QrScanner = null;
            if (btn) {
                btn.className = 'btn btn-sm btn-primary-custom';
                btn.innerHTML = '<i class="fas fa-camera me-1"></i> Buka Kamera Scanner';
            }
        });
        return;
    }

    if (typeof Html5Qrcode === 'undefined') {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Modul Scanner Belum Siap',
                text: 'Pustaka Html5Qrcode belum selesai dimuat.'
            });
        } else {
            alert('Modul Html5Qrcode belum tersedia.');
        }
        return;
    }

    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Membuka Kamera...';

    html5QrScanner = new Html5Qrcode("qr-reader");
    const config = { fps: 15, qrbox: { width: 250, height: 250 } };

    Html5Qrcode.getCameras().then(cameras => {
        if (cameras && cameras.length > 0) {
            const chosenId = cameras.length > 1 ? cameras[cameras.length - 1].id : cameras[0].id;
            html5QrScanner.start(
                chosenId,
                config,
                (decodedText) => handleScannedResult(decodedText),
                () => {}
            ).then(() => {
                if (btn) {
                    btn.className = 'btn btn-sm btn-danger';
                    btn.innerHTML = '<i class="fas fa-stop me-1"></i> Matikan Kamera';
                }
            }).catch(err => {
                console.warn('Gagal start dengan chosenId, mencoba fallback facingMode:', err);
                startCameraFallback(config, btn);
            });
        } else {
            startCameraFallback(config, btn);
        }
    }).catch(err => {
        console.warn('getCameras error, mencoba facingMode:', err);
        startCameraFallback(config, btn);
    });
}

function startCameraFallback(config, btn) {
    if (!html5QrScanner) return;
    html5QrScanner.start(
        { facingMode: "environment" },
        config,
        (decodedText) => handleScannedResult(decodedText),
        () => {}
    ).then(() => {
        if (btn) {
            btn.className = 'btn btn-sm btn-danger';
            btn.innerHTML = '<i class="fas fa-stop me-1"></i> Matikan Kamera';
        }
    }).catch(err => {
        console.error('Kamera gagal dibuka:', err);
        html5QrScanner = null;
        if (btn) {
            btn.className = 'btn btn-sm btn-primary-custom';
            btn.innerHTML = '<i class="fas fa-camera me-1"></i> Buka Kamera Scanner';
        }
        const readerEl = document.getElementById('qr-reader');
        if (readerEl) {
            readerEl.innerHTML = '<span class="text-white-50 small p-4 text-center"><i class="fas fa-exclamation-triangle fa-2x d-block mb-2 text-warning"></i>Kamera tidak dapat diakses.<br>Pastikan webcam terhubung dan tidak sedang digunakan aplikasi lain.</span>';
        }
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'warning',
                title: 'Kamera Tidak Terdeteksi',
                text: 'Webcam tidak dapat dibuka atau sedang dipakai oleh aplikasi lain. Anda dapat menggunakan Barcode Scanner USB atau mengetik NIBAR pada kotak input di samping.'
            });
        }
    });
}

function handleScannedResult(rawText) {
    let nibar = rawText;
    try {
        const obj = JSON.parse(rawText);
        if (obj.nibar) nibar = obj.nibar;
    } catch (_) {}

    const aset = allAssets.find(a => a.nibar === nibar);
    const resultBox = document.getElementById('sensus_scan_result');

    if (!aset) {
        if (resultBox) {
            resultBox.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <b>Aset Tidak Dikenali!</b><br>
                    NIBAR: <code>${nibar}</code> tidak terdaftar di database sekolah ini.
                </div>
            `;
        }
        return;
    }

    if (resultBox) {
        resultBox.innerHTML = `
            <div class="alert alert-success">
                <i class="fas fa-check-circle me-2"></i>
                <b>Fisik Aset Terverifikasi Sesuai!</b><br>
                <b>${aset.spesifikasi_nama || aset.nama_barang}</b><br>
                NIBAR: <span class="badge-nibar">${aset.nibar}</span> | Kode: ${aset.kode_barang}<br>
                Ruangan Terdaftar: <span class="badge bg-primary">${aset.ruangan_nama}</span> | Kondisi: ${aset.kondisi}
            </div>
        `;
    }
}

function verifyManualNibar() {
    const inp = document.getElementById('sensus_manual_nibar');
    if (inp && inp.value) handleScannedResult(inp.value.trim());
}

// =========================================================================
// PENGATURAN & PROFIL SEKOLAH
// =========================================================================
async function saveProfileSettings() {
    try {
        const rawInstansi = document.getElementById('set_nama_instansi')?.value.trim();
        const rawOpd = document.getElementById('set_nama_opd')?.value.trim();
        const prov = document.getElementById('set_provinsi')?.value || appProfile.provinsi || 'Jambi';

        const newProfile = {
            ...appProfile,
            nama_instansi: rawInstansi !== undefined && rawInstansi !== '' ? rawInstansi : (appProfile.nama_instansi || `PEMERINTAH PROVINSI ${(prov || 'Jambi').toUpperCase()}`),
            nama_opd: rawOpd !== undefined ? rawOpd : (appProfile.nama_opd || ''), // Opsional, bisa dikosongkan
            nama_sekolah: document.getElementById('set_nama_sekolah')?.value || appProfile.nama_sekolah || '',
            npsn: document.getElementById('set_npsn')?.value || appProfile.npsn || '',
            kode_pemilik: document.getElementById('set_kode_pemilik')?.value || appProfile.kode_pemilik || '11',
            provinsi: prov,
            kabupaten_kota: document.getElementById('set_kabupaten_kota')?.value || appProfile.kabupaten_kota || 'Kabupaten Tebo',
            kecamatan: document.getElementById('set_kecamatan')?.value || appProfile.kecamatan || 'Rimbo Bujang',
            kode_bidang: document.getElementById('set_kode_bidang')?.value || appProfile.kode_bidang || '01',
            kode_skpd: document.getElementById('set_kode_skpd')?.value || appProfile.kode_skpd || '001',
            alamat: document.getElementById('set_alamat')?.value || appProfile.alamat || '',
            kode_lokasi: document.getElementById('set_kode_lokasi')?.value || appProfile.kode_lokasi || '11.15.09.04.01.001.10505963',
            kepala_sekolah: document.getElementById('set_kepala_sekolah')?.value || appProfile.kepala_sekolah || '',
            nip_kepala_sekolah: document.getElementById('set_nip_kepala_sekolah')?.value || appProfile.nip_kepala_sekolah || '',
            pengurus_barang: document.getElementById('set_pengurus_barang')?.value || appProfile.pengurus_barang || '',
            nip_pengurus_barang: document.getElementById('set_nip_pengurus_barang')?.value || appProfile.nip_pengurus_barang || '',
            tahun_anggaran: document.getElementById('set_tahun_anggaran')?.value || appProfile.tahun_anggaran || new Date().getFullYear().toString()
        };

        await db.saveProfile(newProfile);
        appProfile = newProfile;
        await loadProfile();

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Profil Berhasil Disimpan',
                text: 'Data sekolah dan informasi pejabat penatausahaan aset telah diperbarui secara permanen.'
            });
        }
    } catch (err) {
        console.error('[SINBAS] Gagal simpan profil:', err);
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menyimpan',
                text: err.message || 'Terjadi kesalahan saat menyimpan pengaturan profil.'
            });
        }
    }
}

async function deleteAsset(asetId) {
    Swal.fire({
        icon: 'warning',
        title: 'Hapus Aset Ini?',
        text: 'Tindakan ini akan menghapus data aset dari sistem inventaris.',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Hapus'
    }).then(async res => {
        if (res.isConfirmed) {
            await db.delete('aset', asetId);
            await loadAssets();
            updateDashboardStats();
            renderBukuIndukTable();
            renderKibTable();
            renderKirView();
        }
    });
}

// =========================================================================
// FORM LISTENERS
// =========================================================================
function initFormListeners() {
    // Form Modal Aset
    const formModalAset = document.getElementById('formModalAset');
    if (formModalAset) {
        formModalAset.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveModalAsset();
        });
    }

    // Inisialisasi Cascading Selectors Bertingkat (Buku Induk & Master Kode)
    if (typeof initAsetModalCascadingSelectors === 'function') initAsetModalCascadingSelectors();
    if (typeof initMkbModalCascadingSelectors === 'function') initMkbModalCascadingSelectors();

    const modalHargaInp = document.getElementById('modal_harga_satuan');
    const modalQtyInp = document.getElementById('modal_jumlah');
    const modalTotalInp = document.getElementById('modal_nilai_total');
    function calcModalTotal() {
        const h = Number(modalHargaInp.value) || 0;
        const q = Number(modalQtyInp.value) || 1;
        if (modalTotalInp) modalTotalInp.value = (h * q);
    }
    if (modalHargaInp) modalHargaInp.addEventListener('input', calcModalTotal);
    if (modalQtyInp) modalQtyInp.addEventListener('input', calcModalTotal);

    const modalTahunInp = document.getElementById('modal_tahun_perolehan');
    if (modalTahunInp) modalTahunInp.addEventListener('change', updateModalNibarPreview);

    // Form Modal Ruangan
    const formModalRuang = document.getElementById('formModalRuangan');
    if (formModalRuang) {
        formModalRuang.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveModalRuangan();
        });
    }

    // Form Modal Master Katalog BPH
    const formModalBph = document.getElementById('formModalBph');
    if (formModalBph) {
        formModalBph.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveModalMasterBph();
        });
    }

    // Form Modal Transaksi BPH Masuk
    const formModalBphMasuk = document.getElementById('formModalBphMasuk');
    if (formModalBphMasuk) {
        formModalBphMasuk.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveModalBphMasuk();
        });
    }

    // Form Modal Transaksi BPH Keluar
    const formModalBphKeluar = document.getElementById('formModalBphKeluar');
    if (formModalBphKeluar) {
        formModalBphKeluar.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveModalBphKeluar();
        });
    }

    // Form Modal Kode Barang Baru
    const formModalKode = document.getElementById('formModalKodeBarang');
    if (formModalKode) {
        formModalKode.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveModalKodeBarang();
        });
    }

    // Form Mutasi
    const formMutasi = document.getElementById('formProsesMutasi');
    if (formMutasi) {
        formMutasi.addEventListener('submit', async (e) => {
            e.preventDefault();
            await processAssetMutation();
        });
    }

    // Form Settings
    const formSettings = document.getElementById('formSettings');
    if (formSettings) {
        formSettings.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveProfileSettings();
        });
    }
}


// =========================================================================
// SISTEM HIERARKI WILAYAH & GENERATOR KODE LOKASI BMD (PERMENDAGRI)
// =========================================================================
function initSettingsWilayahSelectors() {
    const selProv = document.getElementById('set_provinsi_sel');
    if (!selProv) return;

    // Set dropdown kode pemilik
    const selPemilik = document.getElementById('set_kode_pemilik');
    if (selPemilik && appProfile.kode_pemilik) {
        selPemilik.value = appProfile.kode_pemilik;
    }

    const inpBidang = document.getElementById('set_kode_bidang');
    if (inpBidang && appProfile.kode_bidang) {
        inpBidang.value = appProfile.kode_bidang;
    }

    const inpSkpd = document.getElementById('set_kode_skpd');
    if (inpSkpd && appProfile.kode_skpd) {
        inpSkpd.value = appProfile.kode_skpd;
    }

    selProv.innerHTML = '<option value="">-- Pilih Provinsi --</option>';
    if (typeof WILAYAH_PROVINSI !== 'undefined') {
        WILAYAH_PROVINSI.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.kode;
            opt.setAttribute('data-nama', p.nama);
            opt.textContent = `${p.kode} — ${p.nama}`;
            selProv.appendChild(opt);
        });
    }

    setSettingsWilayahCascade(
        appProfile.provinsi || 'Jambi',
        appProfile.kabupaten_kota || 'Kabupaten Tebo',
        appProfile.kecamatan || 'Rimbo Bujang'
    );
}

function setSettingsWilayahCascade(provName, kabName, kecName) {
    const selProv = document.getElementById('set_provinsi_sel');
    const selKab = document.getElementById('set_kabupaten_sel');
    const selKec = document.getElementById('set_kecamatan_sel');
    if (!selProv) return;

    // 1. Set Provinsi
    let foundProv = null;
    if (typeof WILAYAH_PROVINSI !== 'undefined') {
        foundProv = WILAYAH_PROVINSI.find(p => p.nama.toLowerCase() === (provName || '').toLowerCase() || p.kode === provName);
    }
    if (foundProv) {
        selProv.value = foundProv.kode;
    } else {
        selProv.value = '15'; // Default Jambi
    }
    onSettingsProvinsiChanged(false);

    // 2. Set Kabupaten
    const curProvKode = selProv.value;
    let foundKab = null;
    if (typeof WILAYAH_KABUPATEN !== 'undefined' && WILAYAH_KABUPATEN[curProvKode]) {
        foundKab = WILAYAH_KABUPATEN[curProvKode].find(k => k.nama.toLowerCase().includes((kabName || '').toLowerCase()) || k.kode === kabName);
    }
    if (foundKab && selKab) {
        selKab.value = foundKab.kode;
    } else if (selKab) {
        selKab.value = '15.09'; // Default Tebo
    }
    onSettingsKabupatenChanged(false);

    // 3. Set Kecamatan
    const curKabKode = selKab ? selKab.value : '15.09';
    let foundKec = null;
    if (typeof WILAYAH_KECAMATAN !== 'undefined' && WILAYAH_KECAMATAN[curKabKode]) {
        foundKec = WILAYAH_KECAMATAN[curKabKode].find(kc => kc.nama.toLowerCase().includes((kecName || '').toLowerCase()) || kc.kode === kecName);
    }
    if (foundKec && selKec) {
        selKec.value = foundKec.kode;
    } else if (selKec) {
        selKec.value = '15.09.04'; // Default Rimbo Bujang
    }
    onSettingsKecamatanChanged(false);
}

function onSettingsProvinsiChanged(triggerAutoCode = true) {
    const selProv = document.getElementById('set_provinsi_sel');
    const selKab = document.getElementById('set_kabupaten_sel');
    const selKec = document.getElementById('set_kecamatan_sel');
    const provKode = selProv?.value || '';

    const provOpt = selProv?.options[selProv.selectedIndex];
    const provNama = provOpt ? provOpt.getAttribute('data-nama') || '' : '';
    const hiddenProv = document.getElementById('set_provinsi');
    if (hiddenProv) hiddenProv.value = provNama;

    if (selKab) {
        selKab.innerHTML = '<option value="">-- Pilih Kabupaten / Kota --</option>';
        selKab.disabled = !provKode;
    }
    if (selKec) {
        selKec.innerHTML = '<option value="">-- Pilih Kecamatan --</option>';
        selKec.disabled = true;
    }

    if (!provKode) return;

    if (typeof WILAYAH_KABUPATEN !== 'undefined' && WILAYAH_KABUPATEN[provKode]) {
        WILAYAH_KABUPATEN[provKode].forEach(k => {
            const opt = document.createElement('option');
            opt.value = k.kode;
            opt.setAttribute('data-nama', k.nama);
            opt.textContent = `${k.kode} — ${k.nama}`;
            selKab.appendChild(opt);
        });
    }

    const optManual = document.createElement('option');
    optManual.value = 'MANUAL';
    optManual.textContent = '+ Ketik Kabupaten Manual...';
    if (selKab) selKab.appendChild(optManual);

    if (triggerAutoCode) updateAutoKodeLokasi();
}

function onSettingsKabupatenChanged(triggerAutoCode = true) {
    const selKab = document.getElementById('set_kabupaten_sel');
    const selKec = document.getElementById('set_kecamatan_sel');
    const kabKode = selKab?.value || '';

    if (kabKode === 'MANUAL') {
        const manualName = prompt('Ketik Nama Kabupaten / Kota:');
        if (manualName) {
            const hiddenKab = document.getElementById('set_kabupaten_kota');
            if (hiddenKab) hiddenKab.value = manualName;
        }
        return;
    }

    const kabOpt = selKab?.options[selKab.selectedIndex];
    const kabNama = kabOpt ? kabOpt.getAttribute('data-nama') || '' : '';
    const hiddenKab = document.getElementById('set_kabupaten_kota');
    if (hiddenKab) hiddenKab.value = kabNama;

    if (selKec) {
        selKec.innerHTML = '<option value="">-- Pilih Kecamatan --</option>';
        selKec.disabled = !kabKode;
    }

    if (!kabKode) return;

    if (typeof WILAYAH_KECAMATAN !== 'undefined' && WILAYAH_KECAMATAN[kabKode]) {
        WILAYAH_KECAMATAN[kabKode].forEach(kc => {
            const opt = document.createElement('option');
            opt.value = kc.kode;
            opt.setAttribute('data-nama', kc.nama);
            opt.textContent = `${kc.kode} — ${kc.nama}`;
            selKec.appendChild(opt);
        });
    }

    if (triggerAutoCode) updateAutoKodeLokasi();
}

function onSettingsKecamatanChanged(triggerAutoCode = true) {
    const selKec = document.getElementById('set_kecamatan_sel');
    const kecOpt = selKec?.options[selKec.selectedIndex];
    const kecNama = kecOpt ? kecOpt.getAttribute('data-nama') || '' : '';
    const hiddenKec = document.getElementById('set_kecamatan');
    if (hiddenKec) hiddenKec.value = kecNama;

    if (triggerAutoCode) updateAutoKodeLokasi();
}

function updateAutoKodeLokasi() {
    const selPemilik = document.getElementById('set_kode_pemilik');
    const selProv = document.getElementById('set_provinsi_sel');
    const selKab = document.getElementById('set_kabupaten_sel');
    const selKec = document.getElementById('set_kecamatan_sel');
    const inpBidang = document.getElementById('set_kode_bidang');
    const inpSkpd = document.getElementById('set_kode_skpd');
    const inpNpsn = document.getElementById('set_npsn');
    const inpKode = document.getElementById('set_kode_lokasi');
    if (!inpKode) return;

    // 1. Kode Status Kepemilikan (11: Pemda Provinsi / SMA, 12: Pemda Kab/Kota, 00: Pusat, 13: Lainnya)
    const kodePemilik = selPemilik?.value || '11';

    // 2. Kode Wilayah Provinsi (2 digit) & Kab/Kota (2 digit) & Kecamatan (2 digit)
    const provKode = selProv?.value || '15';
    let kabVal = selKab?.value || '15.09';
    let kecVal = selKec?.value || '15.09.04';

    const provDigit = provKode.replace(/[^0-9]/g, '').slice(0, 2) || '15';
    let kabDigit = '09';
    if (kabVal.includes('.')) {
        kabDigit = kabVal.split('.')[1] || '09';
    }
    let kecDigit = '04';
    if (kecVal.includes('.')) {
        const parts = kecVal.split('.');
        kecDigit = parts[2] || '04';
    }

    // 3. Bidang Urusan Pemerintahan (01: Pendidikan)
    const bidangUrusan = (inpBidang?.value || '01').trim() || '01';

    // 4. Kode SKPD Pengguna Barang (001: Dinas Pendidikan)
    const kodeDinas = (inpSkpd?.value || '001').trim() || '001';

    // 5. Kode Unit Kerja / Kuasa Pengguna Barang: Menggunakan NPSN Sekolah
    const kodeSekolah = (inpNpsn?.value || '10505963').trim() || '10505963';

    // Susunan Standar Permendagri No. 108/2016: [Pemilik].[Prov].[Kab].[Kec].[Bidang].[SKPD].[NPSN]
    const generatedKode = `${kodePemilik}.${provDigit}.${kabDigit}.${kecDigit}.${bidangUrusan}.${kodeDinas}.${kodeSekolah}`;
    inpKode.value = generatedKode;
}

// =========================================================================
// PENGATURAN KONEKSI CLOUD & MULTI-TENANT (GOOGLE APPS SCRIPT)
// =========================================================================

function initCloudSettingsUI() {
    const titleEl = document.getElementById('cloudStatusTitle');
    const descEl = document.getElementById('cloudStatusDesc');
    const badgeEl = document.getElementById('cloudPlatformBadge');

    if (db.isElectron) {
        if (titleEl) titleEl.textContent = 'Platform: Desktop Native (Electron + SQLite)';
        if (descEl) descEl.textContent = 'Database lokal tersimpan di SQLite. Anda dapat menyelaraskan data ke Google Sheets kapan saja menggunakan Sinkronisasi 2 Arah.';
        if (badgeEl) {
            badgeEl.className = 'badge bg-primary px-3 py-2 fw-semibold';
            badgeEl.innerHTML = '<i class="fas fa-desktop me-1"></i> Desktop SQLite';
        }
    } else {
        const activeTenant = db.getActiveTenant();
        if (titleEl) titleEl.textContent = `Platform: Web Online (Google Sheets Cloud)`;
        if (descEl) descEl.textContent = `Aplikasi beroperasi di web browser dan terhubung ke Google Apps Script (Tenant: ${activeTenant}).`;
        if (badgeEl) {
            badgeEl.className = 'badge bg-success px-3 py-2 fw-semibold';
            badgeEl.innerHTML = '<i class="fas fa-cloud me-1"></i> Web Online';
        }
    }

    const inpUrl = document.getElementById('set_gas_exec_url');
    if (inpUrl) inpUrl.value = db.getGasExecUrl() || '';

    const inpTenant = document.getElementById('set_active_tenant');
    if (inpTenant) inpTenant.value = db.getActiveTenant();

    const inpLabel = document.getElementById('set_tenant_label');
    if (inpLabel) inpLabel.value = (appProfile && appProfile.nama_sekolah) ? appProfile.nama_sekolah : db.getActiveTenant();

    const inpGenCode = document.getElementById('gen_tenant_code');
    if (inpGenCode && !inpGenCode.value) inpGenCode.value = db.getActiveTenant();

    updateGeneratedSchoolLink();
}

async function saveCloudSettings() {
    const inpUrl = document.getElementById('set_gas_exec_url');
    const inpTenant = document.getElementById('set_active_tenant');

    const url = inpUrl ? inpUrl.value.trim() : '';
    const tenant = inpTenant ? inpTenant.value.trim() : '';

    if (!url) {
        Swal.fire({
            icon: 'warning',
            title: 'URL Belum Diisi',
            text: 'Silakan masukkan URL Web App Google Apps Script Exec yang berakhiran /exec.'
        });
        return;
    }

    db.setGasExecUrl(url, tenant);
    if (tenant) {
        db.setActiveTenant(tenant);
    }

    initCloudSettingsUI();

    Swal.fire({
        icon: 'success',
        title: 'Konfigurasi Online Tersimpan!',
        text: `URL Google Apps Script dan tenant "${tenant || db.getActiveTenant()}" berhasil disimpan. Anda dapat langsung menguji koneksi atau memulai sinkronisasi 2 arah.`,
        confirmButtonColor: '#2563eb'
    });
}

async function testCloudConnection() {
    const btn = document.getElementById('btnTestCloudConnection');
    const box = document.getElementById('cloudTestResultBox');
    const inpUrl = document.getElementById('set_gas_exec_url');
    const inpTenant = document.getElementById('set_active_tenant');

    const testUrl = inpUrl ? inpUrl.value.trim() : '';
    const testTenant = inpTenant ? inpTenant.value.trim() : db.getActiveTenant();

    if (!testUrl) {
        Swal.fire({
            icon: 'warning',
            title: 'URL Kosong',
            text: 'Masukkan URL Google Apps Script Exec sebelum menguji koneksi.'
        });
        return;
    }

    // Simpan sementara URL & tenant jika user belum menekan tombol simpan
    db.setGasExecUrl(testUrl, testTenant);
    if (testTenant) db.setActiveTenant(testTenant);

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Menguji...';
    }

    if (box) {
        box.classList.remove('d-none');
        box.className = 'mb-3 p-3 rounded border bg-light text-secondary';
        box.innerHTML = '<i class="fas fa-spinner fa-spin text-primary me-2"></i> Mengirim paket ping ke Google Apps Script...';
    }

    const startT = Date.now();
    try {
        const res = await db.callGasApi('ping', { tenant: testTenant });
        const latency = Date.now() - startT;

        if (res && res.success) {
            if (box) {
                box.className = 'mb-3 p-3 rounded border border-success bg-success bg-opacity-10 text-success';
                box.innerHTML = `
                    <div class="d-flex align-items-center gap-2 fw-bold mb-1">
                        <i class="fas fa-check-circle fs-5"></i> Koneksi Berhasil! (${latency} ms)
                    </div>
                    <div class="small">
                        <b>Spreadsheet Terhubung:</b> ${res.active_spreadsheet_name || res.tenant?.nama_sekolah || 'Google Sheets OK'}<br>
                        <b>Tenant Aktif:</b> <code>${testTenant}</code> &bull; <b>Versi API:</b> ${res.version || '1.0.0'}
                    </div>
                `;
            }
        } else {
            throw new Error(res?.error || 'Respon server tidak valid.');
        }
    } catch (err) {
        if (box) {
            box.className = 'mb-3 p-3 rounded border border-danger bg-danger bg-opacity-10 text-danger';
            box.innerHTML = `
                <div class="d-flex align-items-center gap-2 fw-bold mb-1">
                    <i class="fas fa-times-circle fs-5"></i> Gagal Menghubungi Google Apps Script
                </div>
                <div class="small">${err.message || 'Periksa URL Exec, pengaturan CORS, atau koneksi internet Anda.'}</div>
            `;
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-plug me-1"></i> Uji Koneksi Backend';
        }
    }
}

function forceSyncAllFromCloud() {
    openSyncModal();
}

// =========================================================================
// =========================================================================
// SINKRONISASI 2 ARAH HYBRID (OFFLINE DESKTOP <-> ONLINE GOOGLE SHEETS)
// =========================================================================

/**
 * Membuka Modal Sinkronisasi Data 2 Arah
 */
function openSyncModal() {
    const modalEl = document.getElementById('modalSyncData');
    if (!modalEl) return;

    // Reset status tahapan sinkronisasi ke kondisi siap
    resetAllSyncStagesUI();

    // 1. Tampilkan informasi Mode (Offline SQLite vs Browser Dexie)
    const modeBadge = document.getElementById('syncModalModeBadge');
    if (modeBadge) {
        if (db.isElectron) {
            modeBadge.className = 'badge bg-primary px-2 py-1';
            modeBadge.innerHTML = '<i class="fas fa-desktop me-1"></i> Desktop SQLite (Offline)';
        } else {
            modeBadge.className = 'badge bg-info text-dark px-2 py-1';
            modeBadge.innerHTML = '<i class="fas fa-globe me-1"></i> Browser Web (Online)';
        }
    }

    // 2. Tampilkan Tenant Aktif
    const tenantBadge = document.getElementById('syncModalTenantBadge');
    const activeTenant = db.getActiveTenant();
    if (tenantBadge) {
        tenantBadge.textContent = `Tenant: ${activeTenant}`;
    }

    // 3. Waktu Sinkronisasi Terakhir
    const lastSyncEl = document.getElementById('syncModalLastSync');
    if (lastSyncEl) {
        lastSyncEl.textContent = db.getLastSyncTime();
    }

    // 4. Isi Kolom Input Link Exec di Modal (Bisa diedit / dihapus)
    const modalUrlInp = document.getElementById('sync_modal_gas_url');
    if (modalUrlInp) {
        modalUrlInp.value = db.getGasExecUrl() || db.getOfflineConfigUrl() || '';
    }

    // 5. Reset Status Koneksi & Log
    const connBadge = document.getElementById('syncModalConnBadge');
    if (connBadge) {
        const gasUrl = db.getGasExecUrl();
        if (!gasUrl) {
            connBadge.className = 'badge bg-danger px-2 py-1';
            connBadge.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i> URL Belum Diisi';
        } else {
            connBadge.className = 'badge bg-warning text-dark px-2 py-1';
            connBadge.innerHTML = '<i class="fas fa-question-circle me-1"></i> Status: Menunggu Tes';
        }
    }

    // Tampilkan modal
    const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalInstance.show();
}

/**
 * Handler saat input Link Exec di Modal diketik / diedit langsung
 */
function onSyncModalUrlChanged() {
    const inp = document.getElementById('sync_modal_gas_url');
    if (inp && inp.value.trim()) {
        const val = inp.value.trim();
        db.setGasExecUrl(val);
    }
}

/**
 * Menghapus / Mengosongkan Link Exec di Modal
 */
function clearSyncModalUrl() {
    const inp = document.getElementById('sync_modal_gas_url');
    if (inp) {
        inp.value = '';
        inp.focus();
        appendSyncLog('Kolom Link Exec dikosongkan.', 'warning');
    }
}

/**
 * Menempelkan Link Exec dari Clipboard ke Modal
 */
async function pasteSyncModalUrl() {
    const inp = document.getElementById('sync_modal_gas_url');
    if (!inp) return;
    try {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
            inp.value = text.trim();
            saveSyncModalUrl(true);
            appendSyncLog('Link Exec berhasil ditempel dari clipboard.', 'success');
        } else {
            Swal.fire({ icon: 'info', title: 'Clipboard Kosong', text: 'Tidak ada teks yang disalin di clipboard.' });
        }
    } catch (_) {
        inp.focus();
        Swal.fire({ icon: 'info', title: 'Izin Clipboard', text: 'Gunakan shortcut Ctrl + V untuk menempelkan link ke dalam kolom.' });
    }
}

/**
 * Menyimpan Link Exec yang diedit di Modal ke database/localStorage
 */
function saveSyncModalUrl(isSilent = false) {
    const inp = document.getElementById('sync_modal_gas_url');
    const val = inp ? inp.value.trim() : '';

    if (!val) {
        db.setGasExecUrl('');
        if (!isSilent) {
            Swal.fire({
                icon: 'warning',
                title: 'Link Kosong',
                text: 'Kolom link kosong. Link kustom telah dihapus.'
            });
        }
        return;
    }

    db.setGasExecUrl(val);

    // Update juga ke field di Pengaturan Cloud jika ada
    const cloudUrlInp = document.getElementById('set_gas_exec_url');
    if (cloudUrlInp) cloudUrlInp.value = val;

    appendSyncLog(`Link Exec diperbarui: ${val.substring(0, 45)}...`, 'success');

    if (!isSilent) {
        Swal.fire({
            icon: 'success',
            title: 'Link Disimpan!',
            text: 'Link Google Apps Script Exec berhasil disimpan untuk sinkronisasi.',
            timer: 1500,
            showConfirmButton: false
        });
    }
}

/**
 * Memuat Ulang Link Bawaan dari config-offline.js ke input Modal
 */
function resetSyncModalUrlToConfigOffline() {
    const defaultUrl = db.getOfflineConfigUrl();
    const inp = document.getElementById('sync_modal_gas_url');
    if (inp) {
        inp.value = defaultUrl;
        db.setGasExecUrl(defaultUrl);
        appendSyncLog('Link Exec di-reset kembali ke bawaan config-offline.js.', 'info');
        Swal.fire({
            icon: 'info',
            title: 'Link Bawaan Dimuat',
            text: defaultUrl ? 'Link Exec bawaan dari config-offline.js berhasil dimuat ke dalam kolom.' : 'Belum ada link di config-offline.js.',
            timer: 1600,
            showConfirmButton: false
        });
    }
}

/**
 * Memvalidasi dan mendapatkan URL dari modal input sebelum sinkron
 */
function getValidSyncModalGasUrl() {
    const inp = document.getElementById('sync_modal_gas_url');
    let url = inp ? inp.value.trim() : '';

    if (!url) {
        url = db.getGasExecUrl() || db.getOfflineConfigUrl();
    }

    if (!url) {
        Swal.fire({
            icon: 'warning',
            title: 'Link Exec Belum Diisi',
            text: 'Silakan masukkan Link Exec Google Apps Script pada kolom di atas atau klik "Muat Ulang Link Bawaan".',
            confirmButtonColor: '#2563eb'
        });
        if (inp) inp.focus();
        return '';
    }

    db.setGasExecUrl(url);
    return url;
}

/**
 * Uji Koneksi ke Google Apps Script dari Modal
 */
async function checkSyncModalConnection() {
    const connBadge = document.getElementById('syncModalConnBadge');
    const btnTest = document.getElementById('btnTestSyncConn');
    const gasUrl = getValidSyncModalGasUrl();

    if (!gasUrl) {
        if (connBadge) {
            connBadge.className = 'badge bg-danger px-2 py-1';
            connBadge.innerHTML = '<i class="fas fa-times-circle me-1"></i> URL Belum Diisi';
        }
        appendSyncLog('Gagal: Masukkan URL Google Apps Script Exec pada kolom di atas.', 'error');
        return false;
    }

    if (btnTest) {
        btnTest.disabled = true;
        btnTest.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Menguji...';
    }
    if (connBadge) {
        connBadge.className = 'badge bg-info text-dark px-2 py-1';
        connBadge.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Menguji Sambungan...';
    }

    appendSyncLog(`Menguji koneksi ke endpoint Google Apps Script (${db.getActiveTenant()})...`);
    const startTime = Date.now();

    try {
        const res = await db.callGasApi('ping');
        const latency = Date.now() - startTime;

        if (res && res.success) {
            if (connBadge) {
                connBadge.className = 'badge bg-success px-2 py-1';
                connBadge.innerHTML = `<i class="fas fa-check-circle me-1"></i> Terhubung (${latency}ms)`;
            }
            appendSyncLog(`Terhubung ke Google Spreadsheet! Versi API: ${res.version || '1.0.0'} (${latency}ms)`, 'success');
            return true;
        } else {
            throw new Error(res?.error || 'Respon server tidak valid');
        }
    } catch (err) {
        if (connBadge) {
            connBadge.className = 'badge bg-danger px-2 py-1';
            connBadge.innerHTML = '<i class="fas fa-times-circle me-1"></i> Gagal Terhubung';
        }
        appendSyncLog(`Koneksi Gagal: ${err.message}`, 'error');
        return false;
    } finally {
        if (btnTest) {
            btnTest.disabled = false;
            btnTest.innerHTML = '<i class="fas fa-plug me-1"></i> Uji Koneksi Cloud';
        }
    }
}

/**
 * Pintasan membuka Pengaturan Backup & Restore dari modal sinkronisasi
 */
function openCloudSettingsFromSync() {
    const modalEl = document.getElementById('modalSyncData');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
    showView('app');
    switchTab('settings');
    switchSettingsSub('backup');
}

/**
 * Inisialisasi Database Google Spreadsheet secara Remote dari SINBAS
 */
async function initRemoteSpreadsheetDb() {
    const gasUrl = getValidSyncModalGasUrl();
    if (!gasUrl) return;

    const profile = (typeof appProfile !== 'undefined' && appProfile) ? appProfile : {};
    const namaSekolah = profile.nama_sekolah || 'Satuan Pendidikan';

    const confirmRes = await Swal.fire({
        icon: 'question',
        title: 'Setup Database Otomatis?',
        html: `Apakah Anda ingin membuat dan memformat <b>11 Sheet Database SINBAS</b> di Google Spreadsheet secara otomatis untuk <b>${namaSekolah}</b>?<br><br><small class="text-muted">Proses ini aman: jika sheet sudah ada, struktur header & kolom akan dirapikan tanpa menghapus data yang telah tersimpan.</small>`,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-magic me-1"></i> Ya, Setup Otomatis',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#059669'
    });

    if (!confirmRes.isConfirmed) return;

    const btn = document.getElementById('btnInitRemoteGasDb');
    const oldHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Menyiapkan Spreadsheet...';
    }

    appendSyncLog('Mengirim instruksi setup database otomatis ke Google Apps Script...', 'info');

    try {
        const res = await db.callGasApi('initSchool', {
            profile: profile,
            tenant: db.getActiveTenant()
        });

        if (res && res.success) {
            appendSyncLog(`Setup Berhasil: ${res.message || '11 sheet database telah dibuat & diformat!'}`, 'success');
            if (res.spreadsheet_id) {
                appendSyncLog(`Spreadsheet ID: ${res.spreadsheet_id}`, 'info');
            }

            await Swal.fire({
                icon: 'success',
                title: 'Database Berhasil Disetup!',
                html: `Seluruh <b>11 Sheet Database SINBAS</b> telah berhasil dibuat dan diformat otomatis di Google Spreadsheet Anda sesuai standar Permendagri 108/2016 & Permendagri 47/2021.<br><br>` +
                      `<b>ID Spreadsheet:</b> <code class="user-select-all">${res.spreadsheet_id || '-'}</code><br><br>` +
                      `Sekarang Anda dapat langsung klik tombol <b>"Mulai Sinkronkan"</b> untuk mengunggah atau menyelaraskan data!`,
                confirmButtonColor: '#2563eb'
            });
        } else {
            throw new Error(res?.error || 'Gagal inisialisasi database di Spreadsheet.');
        }
    } catch (err) {
        appendSyncLog(`Gagal Setup Database: ${err.message}`, 'error');
        Swal.fire({
            icon: 'error',
            title: 'Setup Database Gagal',
            text: err.message || 'Terjadi kesalahan saat menghubungi server Google Apps Script.'
        });
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = oldHtml;
        }
    }
}

/**
 * Mengatur Status Tampilan Tahap Sinkronisasi (1 s/d 6)
 * status: 'pending' | 'active' | 'completed' | 'error'
 */
function setSyncStageUI(stageNum, status, customMsg) {
    const iconEl = document.getElementById(`stageIcon${stageNum}`);
    const statusEl = document.getElementById(`stageStatus${stageNum}`);
    const itemEl = document.getElementById(`stageItem${stageNum}`);

    if (!iconEl || !statusEl) return;

    if (status === 'active') {
        iconEl.className = 'stage-icon-circle rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold shadow-sm';
        iconEl.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 0.72rem;"></i>';
        statusEl.className = 'badge bg-primary text-white small';
        statusEl.textContent = customMsg || 'Memproses...';
        if (itemEl) itemEl.style.backgroundColor = '#eff6ff';
    } else if (status === 'completed') {
        iconEl.className = 'stage-icon-circle rounded-circle bg-success text-white d-flex align-items-center justify-content-center fw-bold shadow-sm';
        iconEl.innerHTML = '<i class="fas fa-check" style="font-size: 0.72rem;"></i>';
        statusEl.className = 'badge bg-success text-white small';
        statusEl.textContent = customMsg || 'Selesai';
        if (itemEl) itemEl.style.backgroundColor = '#f0fdf4';
    } else if (status === 'error') {
        iconEl.className = 'stage-icon-circle rounded-circle bg-danger text-white d-flex align-items-center justify-content-center fw-bold shadow-sm';
        iconEl.innerHTML = '<i class="fas fa-times" style="font-size: 0.72rem;"></i>';
        statusEl.className = 'badge bg-danger text-white small';
        statusEl.textContent = customMsg || 'Gagal';
        if (itemEl) itemEl.style.backgroundColor = '#fef2f2';
    } else {
        // pending
        iconEl.className = 'stage-icon-circle rounded-circle bg-light text-secondary d-flex align-items-center justify-content-center fw-bold';
        iconEl.textContent = String(stageNum);
        statusEl.className = 'badge bg-light text-muted small';
        statusEl.textContent = 'Menunggu';
        if (itemEl) itemEl.style.backgroundColor = '';
    }
}

/**
 * Reset Seluruh Tahapan Sinkronisasi ke Kondisi Awal
 */
function resetAllSyncStagesUI() {
    for (let i = 1; i <= 6; i++) {
        setSyncStageUI(i, 'pending');
    }
    const bar = document.getElementById('syncProgressBar');
    const pctBadge = document.getElementById('syncProgressPercent');
    const lbl = document.getElementById('syncProgressLabel');
    if (bar) bar.style.width = '0%';
    if (pctBadge) pctBadge.textContent = '0%';
    if (lbl) lbl.innerHTML = '<i class="fas fa-tasks text-primary me-1"></i> Status: Siap Melakukan Sinkronisasi';
}

/**
 * Memperbarui Tampilan Progress Bar, Label & Tahapan Sinkronisasi
 */
function updateSyncProgress(label, percent) {
    const pct = Math.max(0, Math.min(100, Math.round(percent)));
    const bar = document.getElementById('syncProgressBar');
    const pctBadge = document.getElementById('syncProgressPercent');
    const lbl = document.getElementById('syncProgressLabel');

    if (bar) bar.style.width = `${pct}%`;
    if (pctBadge) pctBadge.textContent = `${pct}%`;
    if (lbl) lbl.innerHTML = `<i class="fas fa-spinner fa-spin text-primary me-1"></i> ${label}`;

    appendSyncLog(label);

    // Otomatis memperbarui indikator tahapan (Stage UI) secara bertahap
    if (pct > 0 && pct <= 20) {
        setSyncStageUI(1, 'active', 'Memverifikasi...');
    } else if (pct > 20 && pct <= 35) {
        setSyncStageUI(1, 'completed', 'Terhubung');
        setSyncStageUI(2, 'active', 'Menyelaraskan...');
    } else if (pct > 35 && pct <= 60) {
        setSyncStageUI(1, 'completed');
        setSyncStageUI(2, 'completed');
        setSyncStageUI(3, 'active', 'Menyelaraskan...');
    } else if (pct > 60 && pct <= 75) {
        setSyncStageUI(1, 'completed');
        setSyncStageUI(2, 'completed');
        setSyncStageUI(3, 'completed');
        setSyncStageUI(4, 'active', 'Menyelaraskan...');
    } else if (pct > 75 && pct <= 90) {
        setSyncStageUI(1, 'completed');
        setSyncStageUI(2, 'completed');
        setSyncStageUI(3, 'completed');
        setSyncStageUI(4, 'completed');
        setSyncStageUI(5, 'active', 'Menyelaraskan...');
    } else if (pct > 90 && pct < 100) {
        setSyncStageUI(1, 'completed');
        setSyncStageUI(2, 'completed');
        setSyncStageUI(3, 'completed');
        setSyncStageUI(4, 'completed');
        setSyncStageUI(5, 'completed');
        setSyncStageUI(6, 'active', 'Mengunggah & Menyimpan...');
    } else if (pct >= 100) {
        for (let s = 1; s <= 6; s++) {
            setSyncStageUI(s, 'completed');
        }
    }
}

/**
 * Menambahkan Catatan Baris ke Konsol Log Sinkronisasi
 */
function appendSyncLog(message, type = 'info') {
    const box = document.getElementById('syncLogBox');
    if (!box) return;

    const time = new Date().toLocaleTimeString('id-ID');
    let colorClass = 'text-light';
    let icon = '&bull;';

    if (type === 'success') {
        colorClass = 'text-success fw-bold';
        icon = '✓';
    } else if (type === 'error') {
        colorClass = 'text-danger fw-bold';
        icon = '✗';
    } else if (type === 'warning') {
        colorClass = 'text-warning';
        icon = '!';
    }

    const line = document.createElement('div');
    line.className = colorClass;
    line.innerHTML = `<span class="text-secondary">[${time}]</span> ${icon} ${message}`;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
}

/**
 * Membersihkan Konsol Log
 */
function clearSyncLog() {
    const box = document.getElementById('syncLogBox');
    if (box) {
        box.innerHTML = '<div class="text-muted">// Log sinkronisasi dibersihkan.</div>';
    }
}

/**
 * Mengunci / Membuka Tombol Sinkronisasi Selama Berjalan
 */
function setSyncButtonsLock(locked) {
    const btns = [
        document.getElementById('btnRunTwoWaySync'),
        document.getElementById('btnBackupJson'),
        document.getElementById('btnRestoreJson'),
        document.getElementById('btnTestSyncConn'),
        document.getElementById('btnClearSyncModalUrl'),
        document.getElementById('btnCloseSyncModal'),
        document.getElementById('btnCloseSyncModalX'),
        document.getElementById('btnTopbarSync')
    ];
    btns.forEach(b => {
        if (b) b.disabled = locked;
    });

    const topbarIcon = document.getElementById('topbarSyncIcon');
    const headerIcon = document.getElementById('syncHeaderIcon');
    const actionBtnIcon = document.getElementById('syncActionBtnIcon');
    if (locked) {
        if (topbarIcon) topbarIcon.classList.add('fa-spin');
        if (headerIcon) headerIcon.classList.add('fa-spin');
        if (actionBtnIcon) actionBtnIcon.classList.add('fa-spin');
    } else {
        if (topbarIcon) topbarIcon.classList.remove('fa-spin');
        if (headerIcon) headerIcon.classList.remove('fa-spin');
        if (actionBtnIcon) actionBtnIcon.classList.remove('fa-spin');
    }
}

/**
 * Memuat Ulang Seluruh Data Aplikasi ke Antarmuka Setelah Sinkronisasi
 */
async function reloadAllAppData() {
    await loadProfile();
    await loadRooms();
    await loadAssets();
    await loadBph();
    await loadMasterBph();
    await loadBphMasuk();
    await loadBphKeluar();
    await loadCustomKodeBarang();
    await loadRiwayatPenghapusan();
    await loadRiwayatMutasi();
    await loadRiwayatPemeliharaan();
    await loadSensusLog();

    updateDashboardStats();
    renderBukuIndukTable();
    renderMasterRuanganTable();
    renderMasterKodeBarangTable();
    renderMasterBphTable();
    renderKibTable();
    renderKirView();
    renderRiwayatPenghapusan();
    renderRiwayatMutasi();
    renderRiwayatPemeliharaan();
    renderSensusLog();
    applyLogosToDOM();
}

/**
 * 1. EKSEKUSI SINKRONISASI 2 ARAH (SMART MERGE)
 */
async function executeSmartTwoWaySync() {
    if (db.syncing) {
        Swal.fire({ icon: 'info', title: 'Sedang Berjalan', text: 'Proses sinkronisasi data sedang berlangsung. Harap tunggu...' });
        return;
    }

    const gasUrl = getValidSyncModalGasUrl();
    if (!gasUrl) return;

    resetAllSyncStagesUI();
    setSyncButtonsLock(true);
    clearSyncLog();
    appendSyncLog('Memulai Sinkronisasi 2 Arah (Smart Merge)...', 'info');

    try {
        const result = await db.syncTwoWay((msg, pct) => {
            updateSyncProgress(msg, pct);
        });

        appendSyncLog('Memperbarui tampilan aplikasi dengan data tersinkronisasi...', 'info');
        await reloadAllAppData();

        // Update Waktu Sinkron Terakhir
        const lastSync = db.getLastSyncTime();
        const lastSyncEl = document.getElementById('syncModalLastSync');
        if (lastSyncEl) lastSyncEl.textContent = lastSync;

        for (let s = 1; s <= 6; s++) {
            setSyncStageUI(s, 'completed');
        }

        const lbl = document.getElementById('syncProgressLabel');
        if (lbl) lbl.innerHTML = '<i class="fas fa-check-circle text-success me-1"></i> Sinkronisasi 2 Arah Berhasil Selesai!';

        appendSyncLog(`Sinkronisasi Selesai! Upload: ${result.stats?.uploadedCount || 0} data | Download: ${result.stats?.downloadedCount || 0} data.`, 'success');

        Swal.fire({
            icon: 'success',
            title: 'Sinkronisasi 2 Arah Berhasil!',
            html: `
                <div class="text-start p-2">
                    <p class="mb-2">Data offline dan Google Spreadsheet telah selaras sempurna:</p>
                    <ul class="small mb-2">
                        <li><b>Profil Sekolah &amp; Alamat:</b> Diselaraskan</li>
                        <li><b>Data Dikirim ke Cloud:</b> ${result.stats?.uploadedCount || 0} record</li>
                        <li><b>Data Diterima ke Komputer:</b> ${result.stats?.downloadedCount || 0} record</li>
                    </ul>
                    <small class="text-muted">Waktu sinkron: ${lastSync}</small>
                </div>
            `,
            confirmButtonColor: '#2563eb'
        });
    } catch (err) {
        appendSyncLog(`Gagal Sinkronisasi: ${err.message}`, 'error');
        const lbl = document.getElementById('syncProgressLabel');
        if (lbl) lbl.innerHTML = `<i class="fas fa-times-circle text-danger me-1"></i> Gagal: ${err.message}`;

        for (let s = 1; s <= 6; s++) {
            const statusEl = document.getElementById(`stageStatus${s}`);
            if (statusEl && statusEl.textContent === 'Memproses...') {
                setSyncStageUI(s, 'error', 'Gagal');
                break;
            }
        }

        Swal.fire({
            icon: 'error',
            title: 'Sinkronisasi Gagal',
            text: err.message || 'Terjadi kesalahan saat berkomunikasi dengan Google Spreadsheet.',
            confirmButtonColor: '#2563eb'
        });
    } finally {
        setSyncButtonsLock(false);
    }
}

/**
 * 2. EKSEKUSI UPLOAD PENUH (LOKAL -> CLOUD GOOGLE SHEETS)
 */
async function executeFullUploadSync() {
    if (db.syncing) return;

    let gasUrl = db.getGasExecUrl() || db.getOfflineConfigUrl();
    if (!gasUrl) {
        gasUrl = getValidSyncModalGasUrl();
    }
    if (!gasUrl) {
        Swal.fire({
            icon: 'warning',
            title: 'Link Exec Belum Diisi',
            text: 'Silakan isi Link Exec Google Apps Script di berkas desktop_offline/config-offline.js terlebih dahulu.'
        });
        return;
    }

    const confirmRes = await Swal.fire({
        title: 'Upload Seluruh Data ke Google Sheets?',
        html: 'Tindakan ini akan mengunggah seluruh profil sekolah, kode lokasi, master ruangan, aset KIB A-F, BPH, dan riwayat dari komputer ke Google Spreadsheet.<br><br>Lanjutkan?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-cloud-upload-alt me-1"></i> Ya, Unggah Sekarang',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#2563eb'
    });

    if (!confirmRes.isConfirmed) return;

    openSyncModal();
    setSyncButtonsLock(true);
    clearSyncLog();
    appendSyncLog('Memulai Upload Penuh dari Lokal ke Google Spreadsheet...', 'info');

    try {
        const result = await db.uploadAllToGas((msg, pct) => {
            updateSyncProgress(msg, pct);
        });

        const lastSync = db.getLastSyncTime();
        const lastSyncEl = document.getElementById('syncModalLastSync');
        if (lastSyncEl) lastSyncEl.textContent = lastSync;

        for (let s = 1; s <= 6; s++) {
            setSyncStageUI(s, 'completed');
        }

        const lbl = document.getElementById('syncProgressLabel');
        if (lbl) lbl.innerHTML = '<i class="fas fa-check-circle text-success me-1"></i> Upload Penuh Berhasil!';

        appendSyncLog('Seluruh data lokal berhasil disimpan ke Google Spreadsheet.', 'success');

        Swal.fire({
            icon: 'success',
            title: 'Upload Penuh Berhasil!',
            text: 'Seluruh data sekolah dan inventaris berhasil diunggah ke Google Spreadsheet.',
            confirmButtonColor: '#2563eb'
        });
    } catch (err) {
        appendSyncLog(`Gagal Upload: ${err.message}`, 'error');
        const lbl = document.getElementById('syncProgressLabel');
        if (lbl) lbl.innerHTML = `<i class="fas fa-times-circle text-danger me-1"></i> Gagal: ${err.message}`;

        Swal.fire({
            icon: 'error',
            title: 'Upload Gagal',
            text: err.message || 'Terjadi masalah saat mengunggah data ke Google Spreadsheet.',
            confirmButtonColor: '#2563eb'
        });
    } finally {
        setSyncButtonsLock(false);
    }
}

/**
 * 3. EKSEKUSI DOWNLOAD PENUH (CLOUD GOOGLE SHEETS -> LOKAL)
 */
async function executeFullDownloadSync() {
    if (db.syncing) return;

    let gasUrl = db.getGasExecUrl() || db.getOfflineConfigUrl();
    if (!gasUrl) {
        gasUrl = getValidSyncModalGasUrl();
    }
    if (!gasUrl) {
        Swal.fire({
            icon: 'warning',
            title: 'Link Exec Belum Diisi',
            text: 'Silakan isi Link Exec Google Apps Script di berkas desktop_offline/config-offline.js terlebih dahulu.'
        });
        return;
    }

    const confirmRes = await Swal.fire({
        title: 'Download Seluruh Data dari Google Sheets?',
        html: 'Tindakan ini akan mengambil seluruh data dari Google Spreadsheet dan <b>memperbarui / menimpa</b> database komputer Anda.<br><br><span class="text-warning fw-bold"><i class="fas fa-exclamation-triangle"></i> Pastikan data di Spreadsheet adalah data terbaru yang ingin digunakan.</span><br><br>Lanjutkan?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-cloud-download-alt me-1"></i> Ya, Download Data',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#10b981'
    });

    if (!confirmRes.isConfirmed) return;

    openSyncModal();
    setSyncButtonsLock(true);
    clearSyncLog();
    appendSyncLog('Memulai Download Penuh dari Google Spreadsheet ke Lokal...', 'info');

    try {
        const result = await db.downloadAllFromGas((msg, pct) => {
            updateSyncProgress(msg, pct);
        });

        appendSyncLog('Memperbarui antarmuka aplikasi dengan data cloud...', 'info');
        await reloadAllAppData();

        const lastSync = db.getLastSyncTime();
        const lastSyncEl = document.getElementById('syncModalLastSync');
        if (lastSyncEl) lastSyncEl.textContent = lastSync;

        for (let s = 1; s <= 6; s++) {
            setSyncStageUI(s, 'completed');
        }

        const lbl = document.getElementById('syncProgressLabel');
        if (lbl) lbl.innerHTML = '<i class="fas fa-check-circle text-success me-1"></i> Download Penuh Berhasil!';

        appendSyncLog(`Download Selesai! Sebanyak ${result.countAset || 0} unit aset berhasil dimuat ke database lokal.`, 'success');

        Swal.fire({
            icon: 'success',
            title: 'Download Penuh Berhasil!',
            text: `Data berhasil diunduh dari Google Spreadsheet. Sebanyak ${result.countAset || 0} unit aset siap digunakan.`,
            confirmButtonColor: '#10b981'
        });
    } catch (err) {
        appendSyncLog(`Gagal Download: ${err.message}`, 'error');
        const lbl = document.getElementById('syncProgressLabel');
        if (lbl) lbl.innerHTML = `<i class="fas fa-times-circle text-danger me-1"></i> Gagal: ${err.message}`;

        Swal.fire({
            icon: 'error',
            title: 'Download Gagal',
            text: err.message || 'Terjadi masalah saat mengunggah data dari Google Spreadsheet.',
            confirmButtonColor: '#2563eb'
        });
    } finally {
        setSyncButtonsLock(false);
    }
}

/**
 * Generator Tautan Multi-Tenant untuk Sekolah Pembeli
 */
function updateGeneratedSchoolLink() {
    const codeInp = document.getElementById('gen_tenant_code');
    const urlInp = document.getElementById('gen_tenant_url');
    if (!urlInp) return;

    const rawCode = codeInp ? codeInp.value.trim() : '';
    const cleanCode = encodeURIComponent(rawCode || 'sekolahA');

    let base = window.location.origin + window.location.pathname;
    if (base.endsWith('index.html')) {
        base = base.replace(/index\.html$/, '');
    }
    if (!base.endsWith('/')) {
        base += '/';
    }

    urlInp.value = `${base}?id=${cleanCode}`;
}

function copyGeneratedSchoolLink() {
    const urlInp = document.getElementById('gen_tenant_url');
    if (!urlInp || !urlInp.value) {
        updateGeneratedSchoolLink();
    }
    if (urlInp) {
        urlInp.select();
        navigator.clipboard.writeText(urlInp.value).then(() => {
            Swal.fire({
                icon: 'success',
                title: 'Tautan Disalin!',
                text: 'Tautan khusus sekolah berhasil disalin ke clipboard dan siap dikirim ke sekolah pembeli.',
                timer: 1500,
                showConfirmButton: false
            });
        }).catch(() => {
            document.execCommand('copy');
            Swal.fire({ icon: 'success', title: 'Tautan Disalin!', timer: 1500, showConfirmButton: false });
        });
    }
}

function testGeneratedSchoolLink() {
    const urlInp = document.getElementById('gen_tenant_url');
    if (urlInp && urlInp.value) {
        window.open(urlInp.value, '_blank');
    }
}
