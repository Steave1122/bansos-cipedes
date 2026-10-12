function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  // Untuk teks yang disisipkan ke dalam onclick="...'...'" (string JS berkutip tunggal di dalam atribut HTML berkutip ganda)
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderKlasifikasi(raw) {
  if (!raw) return '';
  try {
    var r = typeof raw === 'string' ? JSON.parse(raw) : raw;
    var kategori = r.kategori || 'Tidak Memenuhi Kriteria';
    var alasan = r.alasan || [];
    var dasar = r.dasarHukum;
    var detail = r.klasifikasiDetail;
    var warnaMap = {'PKH':'#16a34a','BPNT':'#2563eb','BST':'#d97706','Bawaku Makmur':'#7c3aed','Tidak Memenuhi Kriteria':'#dc2626','Tidak Memenuhi Syarat Dasar':'#dc2626'};
    var warna = warnaMap[kategori] || '#94a3b8';
    var html = '<div style="margin-top:8px;padding:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">';
    html += '<div style="margin-bottom:6px;"><span style="background:' + warna + ';color:#fff;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;">' + kategori + '</span></div>';
    if (alasan.length > 0) {
      html += '<div style="font-size:10px;font-weight:700;color:#475569;margin-bottom:3px;">Dasar Klasifikasi:</div>';
      for (var i = 0; i < alasan.length; i++) {
        html += '<div style="font-size:10px;color:#64748b;padding-left:6px;margin-top:2px;">* ' + alasan[i] + '</div>';
      }
    }
    if (dasar) {
      html += '<div style="margin-top:5px;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:4px;">' + dasar + '</div>';
    }
    if (detail) {
      html += '<div style="margin-top:6px;font-size:10px;font-weight:700;color:#475569;">Alasan tidak memenuhi kriteria:</div>';
      var programs = Object.keys(detail);
      for (var j = 0; j < programs.length; j++) {
        var prog = programs[j];
        var list = detail[prog];
        if (list && list.length > 0) {
          html += '<div style="margin-top:4px;"><span style="font-size:10px;font-weight:700;color:#475569;">' + prog + ':</span>';
          for (var k = 0; k < list.length; k++) {
            html += '<div style="font-size:10px;color:#94a3b8;padding-left:8px;">- ' + list[k] + '</div>';
          }
          html += '</div>';
        }
      }
    }
    html += '</div>';
    return html;
  } catch(e) { return ''; }
}

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : `${window.location.protocol}//${window.location.hostname}/api`;
let currentUser = null;
let currentToken = null;

// ══════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════
function showToast(message, type = 'success', duration = 3000) {
  const existing = document.getElementById('toast-notification');
  if (existing) existing.remove();
  const iconMap = { success:'ti-circle-check', error:'ti-alert-circle', info:'ti-info-circle', warning:'ti-alert-triangle' };
  const colorMap = {
    success: { bg:'#16a34a', border:'#15803d' },
    error:   { bg:'#dc2626', border:'#b91c1c' },
    info:    { bg:'#1d4ed8', border:'#1e40af' },
    warning: { bg:'#d97706', border:'#b45309' }
  };
  const isMobile = window.innerWidth <= 768;
  const c = colorMap[type] || colorMap.info;
  const toast = document.createElement('div');
  toast.id = 'toast-notification';
  toast.style.cssText = `
    position:fixed;
    ${isMobile ? 'bottom:72px;left:12px;right:12px;' : 'top:20px;right:20px;max-width:360px;'}
    background:${c.bg};color:#fff;
    padding:12px 16px;border-radius:10px;
    box-shadow:0 4px 20px rgba(0,0,0,0.2);
    display:flex;align-items:center;gap:10px;
    font-size:13px;font-weight:500;z-index:9999;
    border-left:4px solid ${c.border};
    animation:${isMobile ? 'slideUp' : 'slideIn'} 0.25s ease;
    line-height:1.5;font-family:'Segoe UI',system-ui,sans-serif;
  `;
  toast.innerHTML = `
    <i class="ti ${iconMap[type]||'ti-info-circle'}" style="font-size:18px;flex-shrink:0;"></i>
    <span style="flex:1;white-space:pre-line">${message}</span>
    <span onclick="this.parentElement.remove()" style="cursor:pointer;opacity:0.7;font-size:16px;flex-shrink:0;margin-left:4px;">✕</span>
  `;
  if (!document.getElementById('toast-style')) {
    const s = document.createElement('style');
    s.id = 'toast-style';
    s.textContent = `
      @keyframes slideIn  { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
      @keyframes slideOut { from{transform:translateX(0);opacity:1}    to{transform:translateX(110%);opacity:0} }
      @keyframes slideUp  { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
      @keyframes slideDown{ from{transform:translateY(0);opacity:1}    to{transform:translateY(100%);opacity:0} }
    `;
    document.head.appendChild(s);
  }
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.animation = isMobile ? 'slideDown 0.25s ease forwards' : 'slideOut 0.25s ease forwards';
      setTimeout(() => toast.remove(), 250);
    }
  }, duration);
}

// ══════════════════════════════════════════
// TX ID
// ══════════════════════════════════════════
function copyTxId(txid) {
  navigator.clipboard.writeText(txid)
    .then(() => showToast('TX ID berhasil disalin!', 'success', 2000))
    .catch(() => {
      const el = document.createElement('textarea');
      el.value = txid; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
      showToast('TX ID berhasil disalin!', 'success', 2000);
    });
}

function txIdCell(txid) {
  if (!txid) return '<td style="color:#cbd5e1;font-size:12px;">—</td>';
  const short = txid.substring(0,10) + '...' + txid.substring(txid.length-6);
  return `<td>
    <div style="display:flex;align-items:center;gap:5px;">
      <span class="tx-id" title="${txid}" onclick="copyTxId('${txid}')">${short}</span>
      <button onclick="copyTxId('${txid}')" title="Salin"
        style="background:none;border:1px solid #e2e8f0;border-radius:4px;padding:2px 5px;cursor:pointer;font-size:10px;color:#94a3b8;flex-shrink:0;">
        <i class="ti ti-copy" style="font-size:11px;"></i>
      </button>
    </div>
  </td>`;
}

// ══════════════════════════════════════════
// UTILITY
// ══════════════════════════════════════════
function showMessage(elementId, message, type) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const iconMap = { error:'ti-alert-circle', success:'ti-circle-check', info:'ti-info-circle' };
  el.innerHTML = `<i class="ti ${iconMap[type]||'ti-info-circle'}"></i><span>${message}</span>`;
  el.className = `message ${type}`;
}

function getStatusBadge(status) {
  const map = {
    'Diajukan':           'badge-warning',
    'Verifikasi RT':      'badge-info',
    'Verifikasi RW':      'badge-info',
    'Verifikasi IPSM':    'badge-info',
    'Verifikasi Puskesos':'badge-info',
    'Disetujui':          'badge-success',
    'Ditolak':            'badge-danger'
  };
  return `<span class="badge ${map[status]||'badge-primary'}">${status}</span>`;
}

function formatDate(dateStr, showTime = false) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const tanggal = date.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  if (!showTime) return tanggal;
  const jam = date.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
  return `${tanggal}, ${jam}`;
}

async function apiCall(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(`${API_URL}${endpoint}`, options);
  return response.json();
}

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  const icon = btn.querySelector ? btn.querySelector('i') : null;
  if (icon) icon.className = isPass ? 'ti ti-eye-off' : 'ti ti-eye';
  else btn.textContent = isPass ? '🙈' : '👁️';
}

// ══════════════════════════════════════════
// AVATAR HELPER
// ══════════════════════════════════════════
const AV_COLORS = ['av-blue','av-green','av-amber','av-purple','av-red','av-teal'];
function getAvColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}
function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase();
}
function avatarCell(name, sub = '') {
  const cls = getAvColor(name);
  const init = getInitials(name);
  return `<div class="name-cell">
    <div class="name-avatar ${cls}">${init}</div>
    <div class="name-cell-text">
      <p>${name}</p>
      ${sub ? `<span>${sub}</span>` : ''}
    </div>
  </div>`;
}

// ══════════════════════════════════════════
// STAT CARD BUILDER
// ══════════════════════════════════════════
function statCard(num, label, iconClass, colorClass, trend = null) {
  const trendHtml = trend !== null ? `
    <span class="stat-trend ${trend >= 0 ? 'trend-up' : 'trend-down'}">
      <i class="ti ${trend >= 0 ? 'ti-trending-up' : 'ti-trending-down'}"></i>
      ${trend >= 0 ? '+' : ''}${trend}
    </span>` : '';
  return `
    <div class="stat-card sc-${colorClass}">
      <div class="stat-top">
        <div class="stat-icon si-${colorClass}"><i class="ti ${iconClass}"></i></div>
        ${trendHtml}
      </div>
      <div class="stat-number">${num}</div>
      <div class="stat-label">${label}</div>
    </div>`;
}

// ══════════════════════════════════════════
// MOBILE CARD LIST
// ══════════════════════════════════════════
function mobileCardList(items) {
  return `<div class="mobile-card-list">${items}</div>`;
}

// ══════════════════════════════════════════
// SIDEBAR BUILDER
// ══════════════════════════════════════════
function buildAdminSidebar(activeSection) {
  const init = getInitials(currentUser.nama);
  const avCls = getAvColor(currentUser.nama);
  const menuUtama = [
    { id:'dashboard',        icon:'ti-layout-dashboard', label:'Dashboard' },
    { id:'warga',            icon:'ti-users',            label:'Data Warga' },
    { id:'pengajuan',        icon:'ti-clipboard-list',   label:'Pengajuan' },
    { id:'verifikasi',       icon:'ti-circle-check',     label:'Verifikasi' },
    { id:'penerima',         icon:'ti-gift',             label:'Penerima' },
  ];
  const menuBlockchain = [
    { id:'audit',            icon:'ti-link',             label:'Audit Blockchain' },
    { id:'verify-txid',      icon:'ti-search',           label:'Verif. TX ID' },
  ];
  const menuSistem = [
    { id:'petugas',          icon:'ti-shield-check',     label:'Kelola Petugas' },
    { id:'auditlog',         icon:'ti-history',          label:'Log Aktivitas' },
  ];
  const renderItems = (items) => items.map(n => `
    <button class="sidebar-item ${activeSection===n.id?'active':''}"
      onclick="showAdminSection('${n.id}', event)">
      <i class="ti ${n.icon}"></i>${n.label}
    </button>`).join('');
  return `
    <div class="sidebar-brand">
      <div class="sidebar-brand-icon"><i class="ti ti-building-community"></i></div>
      <div class="sidebar-brand-text">
        <p>Bansos Cipedes</p><span>Admin Panel</span>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="sidebar-section">Utama</div>
      ${renderItems(menuUtama)}
      <div class="sidebar-section">Blockchain</div>
      ${renderItems(menuBlockchain)}
      <div class="sidebar-section">Sistem</div>
      ${renderItems(menuSistem)}
    </nav>
    <div class="sidebar-user" onclick="showEditProfil()" style="cursor:pointer;" title="Edit Profil">
      <div class="sidebar-avatar ${avCls}">${init}</div>
      <div class="sidebar-user-info">
        <p>${currentUser.nama}</p>
        <span>${currentUser.jabatan}</span>
      </div>
      <button class="sidebar-logout" onclick="event.stopPropagation();logout()" title="Keluar">
        <i class="ti ti-logout"></i>
      </button>
    </div>`;
}

function buildPetugasSidebar(activeSection) {
  const init = getInitials(currentUser.nama);
  const avCls = getAvColor(currentUser.nama);
  const nav = [
    { id:'dashboard', icon:'ti-layout-dashboard', label:'Dashboard' },
    { id:'antrian',   icon:'ti-clipboard-list',   label:'Antrian Verifikasi' },
    { id:'riwayat',   icon:'ti-history',          label:'Riwayat Saya' },
  ];
  return `
    <div class="sidebar-brand">
      <div class="sidebar-brand-icon"><i class="ti ti-building-community"></i></div>
      <div class="sidebar-brand-text">
        <p>Bansos Cipedes</p><span>${currentUser.jabatan}</span>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="sidebar-section">Menu</div>
      ${nav.map(n => `
        <button class="sidebar-item ${activeSection===n.id?'active':''}"
          onclick="showPetugasSection('${n.id}', event)">
          <i class="ti ${n.icon}"></i>${n.label}
        </button>`).join('')}
    </nav>
    <div class="sidebar-user" onclick="showEditProfil()" style="cursor:pointer;" title="Edit Profil">
      <div class="sidebar-avatar ${avCls}">${init}</div>
      <div class="sidebar-user-info">
        <p>${currentUser.nama}</p><span>${currentUser.jabatan}</span>
      </div>
      <button class="sidebar-logout" onclick="event.stopPropagation();logout()" title="Keluar">
        <i class="ti ti-logout"></i>
      </button>
    </div>`;
}

function buildWargaSidebar(activeSection) {
  const init = getInitials(currentUser.nama);
  const avCls = getAvColor(currentUser.nama);
  const nav = [
    { id:'status',     icon:'ti-chart-bar',   label:'Status Pengajuan' },
    { id:'ajukan',     icon:'ti-file-plus',   label:'Ajukan Bantuan' },
    { id:'riwayat',    icon:'ti-history',     label:'Riwayat Penerimaan' },
    { id:'konfirmasi', icon:'ti-scan',        label:'Konfirmasi Penerimaan' },
  ];
  return `
    <div class="sidebar-brand">
      <div class="sidebar-brand-icon"><i class="ti ti-building-community"></i></div>
      <div class="sidebar-brand-text">
        <p>Bansos Cipedes</p><span>Portal Warga</span>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="sidebar-section">Menu</div>
      ${nav.map(n => `
        <button class="sidebar-item ${activeSection===n.id?'active':''}"
          onclick="showWargaSection('${n.id}', event)">
          <i class="ti ${n.icon}"></i>${n.label}
        </button>`).join('')}
    </nav>
    <div class="sidebar-user">
      <div class="sidebar-avatar ${avCls}">${init}</div>
      <div class="sidebar-user-info">
        <p>${currentUser.nama}</p><span>Warga</span>
      </div>
      <button class="sidebar-logout" onclick="logout()" title="Keluar">
        <i class="ti ti-logout"></i>
      </button>
    </div>`;
}

// ══════════════════════════════════════════
// TOPBAR & MOBILE TOPBAR BUILDER
// ══════════════════════════════════════════
// ══════════════════════════════════════════
// SISTEM NOTIFIKASI
// ══════════════════════════════════════════
const _notifList = [];

function addNotif(icon, title, desc, type = 'success') {
  _notifList.unshift({
    icon, title, desc, type,
    time: new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })
  });
  updateNotifBadge();
}

function updateNotifBadge() {
  const dot = document.querySelector('.topbar-notif-dot');
  const mobileDot = document.querySelector('.mobile-notif-dot');
  if (dot) dot.style.display = _notifList.length > 0 ? 'block' : 'none';
  if (mobileDot) mobileDot.style.display = _notifList.length > 0 ? 'block' : 'none';
}

function toggleNotifPanel() {
  const existing = document.getElementById('notif-panel');
  if (existing) { existing.remove(); return; }

  const colorMap = { success:'#16a34a', info:'#1d4ed8', warning:'#d97706', error:'#dc2626' };
  const bgMap    = { success:'#f0fdf4', info:'#eff6ff', warning:'#fffbeb', error:'#fef2f2' };

  const panel = document.createElement('div');
  panel.id = 'notif-panel';
  panel.style.cssText = 'position:fixed;top:56px;right:16px;width:320px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.12);z-index:1000;overflow:hidden;';
  panel.innerHTML = `
    <div style="padding:12px 16px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:13px;font-weight:600;color:#0f172a;">Notifikasi</span>
      ${_notifList.length > 0 ? `<button onclick="_notifList.length=0;updateNotifBadge();toggleNotifPanel();"
        style="font-size:11px;color:#64748b;background:none;border:none;cursor:pointer;">Hapus semua</button>` : ''}
    </div>
    <div style="max-height:320px;overflow-y:auto;">
      ${_notifList.length === 0
        ? `<div style="text-align:center;padding:32px;color:#94a3b8;">
            <i class="ti ti-bell-off" style="font-size:28px;display:block;margin-bottom:8px;"></i>
            Tidak ada notifikasi
          </div>`
        : _notifList.map(n => `
          <div style="padding:12px 16px;border-bottom:1px solid #f8fafc;display:flex;align-items:flex-start;gap:10px;background:${bgMap[n.type]||'#fff'};">
            <i class="ti ${n.icon}" style="font-size:18px;color:${colorMap[n.type]||'#64748b'};flex-shrink:0;margin-top:1px;"></i>
            <div style="flex:1;min-width:0;">
              <p style="font-size:12px;font-weight:600;color:#0f172a;margin-bottom:2px;">${n.title}</p>
              <p style="font-size:11px;color:#64748b;line-height:1.4;">${n.desc}</p>
              <p style="font-size:10px;color:#94a3b8;margin-top:4px;">${n.time}</p>
            </div>
          </div>`).join('')}
    </div>`;

  document.body.appendChild(panel);
  setTimeout(() => document.addEventListener('click', function handler(e) {
    if (!panel.contains(e.target) && !e.target.closest('.topbar-notif')) {
      panel.remove();
      document.removeEventListener('click', handler);
    }
  }), 100);
}

function buildTopbar(title, showExport = false, exportFn = '') {
  return `
    <div class="topbar">
      <div class="topbar-left">
        <i class="ti ti-chevron-right" style="font-size:13px;"></i>
        <strong>${title}</strong>
      </div>
      <div class="topbar-right">
        <div class="topbar-notif" onclick="toggleNotifPanel()" style="cursor:pointer;position:relative;">
          <i class="ti ti-bell"></i>
          <span class="topbar-notif-dot" style="display:none;"></span>
        </div>
        ${showExport ? `<button class="topbar-btn" onclick="${exportFn}">
          <i class="ti ti-download"></i> Export PDF
        </button>` : ''}
      </div>
    </div>`;
}

function buildMobileTopbar(title) {
  const init = getInitials(currentUser.nama);
  const avCls = getAvColor(currentUser.nama);
  return `
    <div class="mobile-topbar">
      <div class="mobile-topbar-brand">
        <div class="brand-icon"><i class="ti ti-building-community"></i></div>
        <p>${title}</p>
      </div>
      <div class="mobile-topbar-right">
        <div class="mobile-avatar ${avCls}">${init}</div>
        <button onclick="logout()"><i class="ti ti-logout"></i></button>
      </div>
    </div>`;
}

// ══════════════════════════════════════════
// BOTTOM NAV BUILDER
// ══════════════════════════════════════════
function buildAdminBottomNav(active) {
  const items = [
    { id:'dashboard', icon:'ti-layout-dashboard', label:'Dashboard' },
    { id:'pengajuan', icon:'ti-clipboard-list',   label:'Pengajuan' },
    { id:'penerima',  icon:'ti-gift',             label:'Penerima' },
    { id:'audit',     icon:'ti-link',             label:'Audit' },
    { id:'petugas',   icon:'ti-shield-check',     label:'Petugas' },
  ];
  return `<div class="bottom-nav"><div class="bottom-nav-inner">
    ${items.map(it => `
      <button class="bottom-nav-item ${active===it.id?'active':''}" data-section="${it.id}"
        onclick="showAdminSection('${it.id}', event)">
        <i class="ti ${it.icon}"></i>
        <span>${it.label}</span>
      </button>`).join('')}
  </div></div>`;
}

function buildPetugasBottomNav(active) {
  const items = [
    { id:'dashboard', icon:'ti-layout-dashboard', label:'Dashboard' },
    { id:'antrian',   icon:'ti-clipboard-list',   label:'Antrian' },
    { id:'riwayat',   icon:'ti-history',          label:'Riwayat' },
  ];
  return `<div class="bottom-nav"><div class="bottom-nav-inner">
    ${items.map(it => `
      <button class="bottom-nav-item ${active===it.id?'active':''}" data-section="${it.id}"
        onclick="showPetugasSection('${it.id}', event)">
        <i class="ti ${it.icon}"></i>
        <span>${it.label}</span>
      </button>`).join('')}
  </div></div>`;
}

function buildWargaBottomNav(active) {
  const items = [
    { id:'status',     icon:'ti-chart-bar',  label:'Status' },
    { id:'ajukan',     icon:'ti-file-plus',  label:'Ajukan' },
    { id:'riwayat',    icon:'ti-history',    label:'Riwayat' },
    { id:'konfirmasi', icon:'ti-scan',       label:'Konfirmasi' },
  ];
  return `<div class="bottom-nav"><div class="bottom-nav-inner">
    ${items.map(it => `
      <button class="bottom-nav-item ${active===it.id?'active':''}" data-section="${it.id}"
        onclick="showWargaSection('${it.id}', event)">
        <i class="ti ${it.icon}"></i>
        <span>${it.label}</span>
      </button>`).join('')}
  </div></div>`;
}

// ══════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════

async function loginPetugasTahap1() {
  const username = document.getElementById('petugas-username').value.trim();
  const password = document.getElementById('petugas-password').value;
  if (!username || !password) return showMessage('login-message', 'Username dan password wajib diisi', 'error');
  try {
    const res = await apiCall('/auth/petugas/login', 'POST', { username, password });
    if (res.success) {
      petugasOtpStage = true;
      document.getElementById('petugas-otp-group').classList.remove('hidden');
      document.getElementById('petugas-username').disabled = true;
      document.getElementById('petugas-password').disabled = true;
      document.getElementById('btn-login-petugas').innerHTML = '<i class="ti ti-shield-check"></i> Verifikasi OTP';
      showMessage('login-message', res.message + ' [Simulasi] Kode OTP: ' + res.otp_simulasi, 'success');
      setTimeout(() => document.getElementById('petugas-otp').focus(), 100);
    } else {
      showMessage('login-message', res.message, 'error');
    }
  } catch { showMessage('login-message', 'Gagal terhubung ke server', 'error'); }
}
async function loginPetugasTahap2(otp) {
  const username = document.getElementById('petugas-username').value.trim();
  try {
    const res = await apiCall('/auth/petugas/verify-otp-login', 'POST', { username, otp });
    if (res.success) {
      currentToken = res.token; currentUser = res.user;
      localStorage.setItem('token', currentToken);
      localStorage.setItem('user', JSON.stringify(currentUser));
      const label = {'Admin Kelurahan':'Admin Kelurahan','RT':'Petugas RT','RW':'Petugas RW','IPSM':'Petugas IPSM','Puskesos':'Petugas Puskesos'}[res.user.jabatan] || res.user.jabatan;
      loadDashboard();
      startNotifPolling();
      setTimeout(() => showToast(`Selamat datang, ${res.user.nama}!\nLogin sebagai ${label}`, 'success', 4000), 400);
    } else {
      showMessage('login-message', res.message, 'error');
    }
  } catch { showMessage('login-message', 'Gagal terhubung ke server', 'error'); }
}

async function loginWarga() {
  const nik = document.getElementById('warga-nik').value.trim();
  const password = document.getElementById('warga-password').value;
  if (!nik || !password) return showMessage('login-message', 'NIK dan password wajib diisi', 'error');
  try {
    const res = await apiCall('/auth/warga/login', 'POST', { nik, password });
    if (res.success) {
      currentToken = res.token; currentUser = res.user;
      localStorage.setItem('token', currentToken);
      localStorage.setItem('user', JSON.stringify(currentUser));
      loadPortalWarga();
      startNotifPolling();
      setTimeout(() => showToast(`Selamat datang, ${res.user.nama}!`, 'info', 4000), 400);
    } else {
      showMessage('login-message', res.message, 'error');
    }
  } catch { showMessage('login-message', 'Gagal terhubung ke server', 'error'); }
}

function logout() {
  if (!confirm('Apakah Anda yakin ingin keluar?')) return;
  currentToken = null; currentUser = null;
  localStorage.removeItem('token'); localStorage.removeItem('user');
  location.reload();
}


function tandaiChatBadge(id_pengajuan, show) {
  const ids = [
    'chat-unread-badge-' + id_pengajuan,
    'chat-unread-badge-mobile-' + id_pengajuan,
    'chat-unread-badge-warga-' + id_pengajuan
  ];
  ids.forEach(elId => {
    const el = document.getElementById(elId);
    if (el) el.classList.toggle('hidden', !show);
  });
}

async function cekPesanBaru(daftarPengajuan, statusAktifSaja) {
  for (const p of daftarPengajuan) {
    if (statusAktifSaja && ['Disetujui', 'Ditolak', 'Tidak Memenuhi Syarat Dasar'].includes(p.status_pengajuan)) continue;
    try {
      const res = await apiCall('/pesan/' + p.id_pengajuan + '/unread-count');
      if (!res.success) continue;
      const key = 'chat_unread_diketahui_' + p.id_pengajuan + '_' + currentUser.id;
      const sebelumnya = parseInt(localStorage.getItem(key) || '0');
      if (res.unread > 0 && res.unread > sebelumnya) {
        addNotif('ti-message-circle', 'Pesan Baru',
          'Ada pesan baru di chat pengajuan ' + (p.jenis_bantuan || ('#' + p.id_pengajuan)) + '.', 'info');
      }
      tandaiChatBadge(p.id_pengajuan, res.unread > 0);
      localStorage.setItem(key, res.unread || 0);
    } catch { /* abaikan kegagalan cek pesan, tidak kritis */ }
  }
}

function startNotifPolling() {
  if (window._notifPollingInterval) clearInterval(window._notifPollingInterval);
  window._notifPollingInterval = setInterval(async () => {
    if (!currentUser) return;
    if (currentUser.role === 'warga') {
      const res = await apiCall('/pengajuan/warga/' + currentUser.id);
      if (!res.success || !res.data) return;
      const statusKey = 'status_terakhir_' + currentUser.id;
      const statusTersimpan = JSON.parse(localStorage.getItem(statusKey) || '{}');
      const statusBaru = {};
      (res.data || []).forEach(p => {
        statusBaru[p.id_pengajuan] = p.status_pengajuan;
        const statusLama = statusTersimpan[p.id_pengajuan];
        if (statusLama && statusLama !== p.status_pengajuan) {
          if (p.status_pengajuan === 'Ditolak') {
            addNotif('ti-circle-x', 'Pengajuan Ditolak',
              'Pengajuan ' + p.jenis_bantuan + ' ditolak. Alasan: ' + (p.keterangan || '-'), 'error');
          } else if (p.status_pengajuan === 'Disetujui') {
            addNotif('ti-circle-check', 'Pengajuan Disetujui',
              'Selamat! Pengajuan ' + p.jenis_bantuan + ' Anda telah disetujui.', 'success');
          } else {
            addNotif('ti-arrow-right', 'Status Diperbarui',
              'Pengajuan ' + p.jenis_bantuan + ' kini di tahap ' + p.status_pengajuan + '.', 'info');
          }
        }
      });
      localStorage.setItem(statusKey, JSON.stringify(statusBaru));
      await cekPesanBaru(res.data, true);
    } else {
      const res = await apiCall('/verifikasi/antrian');
      if (!res.success || !res.data) return;
      const antrianKey = 'antrian_ids_' + currentUser.id;
      const idsLama = JSON.parse(localStorage.getItem(antrianKey) || '[]');
      const idsBaru = res.data.map(p => p.id_pengajuan);
      const idsBaruMasuk = idsBaru.filter(id => !idsLama.includes(id));
      if (idsLama.length > 0 && idsBaruMasuk.length > 0) {
        addNotif('ti-inbox', 'Pengajuan Baru Masuk',
          idsBaruMasuk.length + ' pengajuan baru menunggu verifikasi ' + currentUser.jabatan + '.', 'info');
      }
      localStorage.setItem(antrianKey, JSON.stringify(idsBaru));
      await cekPesanBaru(res.data, false);
    }
  }, 3000);
}

function loadDashboard() {
  if (currentUser.jabatan === 'Admin Kelurahan') loadAdminDashboard();
  else loadPetugasDashboard();
  startNotifPolling();
}

// ══════════════════════════════════════════
// ADMIN DASHBOARD
// ══════════════════════════════════════════
async function loadAdminDashboard() {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${buildMobileTopbar('Bansos Cipedes')}
    <div class="app-layout">
      <aside class="sidebar" id="admin-sidebar">
        ${buildAdminSidebar('dashboard')}
      </aside>
      <div class="main-area">
        ${buildTopbar('Dashboard', true, 'exportPDF()')}
        <main class="content" id="admin-content">
          <div class="loading"><div class="spinner"></div>Memuat dashboard...</div>
        </main>
      </div>
    </div>
    ${buildAdminBottomNav('dashboard')}`;
  await loadAdminStats();
}

async function loadAdminStats() {
  try {
    const res = await apiCall('/dashboard/admin');
    if (!res.success) return;
    const d = res.data;
    document.getElementById('admin-content').innerHTML = `
      <div class="page-header">
        <h2>Dashboard Admin Kelurahan</h2>
        <span>${formatDate(new Date().toISOString())}</span>
      </div>
      <div class="stats-grid">
        ${statCard(d.statistik.total_warga,    'Total Warga',    'ti-users',         'blue',   2)}
        ${statCard(d.statistik.total_pengajuan,'Total Pengajuan','ti-clipboard-list','purple', 5)}
        ${statCard(d.statistik.total_penerima, 'Penerima Aktif', 'ti-gift',          'green',  1)}
        ${statCard(d.statistik.total_disetujui,'Disetujui',      'ti-circle-check',  'green',  3)}
        ${statCard(d.statistik.total_ditolak,  'Ditolak',        'ti-circle-x',      'red',   -1)}
        ${statCard(d.statistik.total_menunggu, 'Menunggu',       'ti-clock',         'amber', -2)}
      </div>
      <div class="card">
        <div class="card-header">
          <h3>Pengajuan Terbaru</h3>
          <span style="font-size:11px;color:#94a3b8;">${d.pengajuan_terbaru.length} data</span>
        </div>
        ${d.pengajuan_terbaru.length === 0
          ? '<div style="text-align:center;padding:32px;color:#94a3b8;">Belum ada pengajuan</div>'
          : `<div class="table-responsive">
              <table>
                <thead><tr>
                  <th>Warga</th><th>Bantuan</th><th>Tanggal</th><th>Status</th><th>TX ID</th>
                </tr></thead>
                <tbody>
                  ${d.pengajuan_terbaru.map(p => `
                    <tr>
                      <td>${avatarCell(p.nama_warga, p.nik)}</td>
                      <td>
                    <div style="font-size:12px;font-weight:600;color:#0f172a;">${p.jenis_bantuan}</div>
                    ${renderKlasifikasi(p.rekomendasi_sistem)}
                  </td>
                      <td style="font-size:12px;color:#64748b;">${formatDate(p.tanggal_pengajuan)}</td>
                      <td>${getStatusBadge(p.status_pengajuan)}</td>
                      ${txIdCell(p.tx_id_blockchain)}
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
            ${mobileCardList(d.pengajuan_terbaru.map(p => `
              <div class="mobile-item">
                <div class="mobile-item-header">
                  ${avatarCell(p.nama_warga, p.nik)}
                  ${getStatusBadge(p.status_pengajuan)}
                </div>
                <div class="mobile-item-body">
                  <div class="mobile-item-row"><span class="key">Bantuan</span><span class="val" style="font-weight:600;">${p.jenis_bantuan}</span></div>
                ${renderKlasifikasi(p.rekomendasi_sistem)}
                  <div class="mobile-item-row"><span class="key">Tanggal</span><span class="val">${formatDate(p.tanggal_pengajuan)}</span></div>
                </div>
                ${p.tx_id_blockchain ? `<div class="mobile-item-tx"><i class="ti ti-link"></i>${p.tx_id_blockchain.substring(0,20)}...</div>` : ''}
              </div>`).join(''))}`}
      </div>`;
  } catch {
    document.getElementById('admin-content').innerHTML = '<p style="color:#dc2626;padding:20px;">Gagal memuat data</p>';
  }
}

function syncBottomNavActive(sectionId) {
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === sectionId);
  });
}

function showAdminSection(section, e) {
  if (e) e.preventDefault();
  syncBottomNavActive(section);
  // Update sidebar
  const sb = document.getElementById('admin-sidebar');
  if (sb) sb.innerHTML = buildAdminSidebar(section);
  // Update topbar title
  const tb = document.querySelector('.topbar strong');
  const titleMap = {
    dashboard:'Dashboard', warga:'Data Warga', pengajuan:'Pengajuan',
    verifikasi:'Verifikasi', penerima:'Penerima', 
    audit:'Audit Blockchain', 'verify-txid':'Verifikasi TX ID', petugas:'Kelola Petugas',
    auditlog:'Log Aktivitas'
  };
  if (tb) tb.textContent = titleMap[section] || section;
  const content = document.getElementById('admin-content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div>Memuat...</div>';
  if (section === 'dashboard')        return loadAdminStats();
  if (section === 'pengajuan')        return loadAdminPengajuan();
  if (section === 'verifikasi')       return loadAdminVerifikasi();
  if (section === 'penerima')         return loadAdminPenerima();
  if (section === 'warga')            return loadAdminWarga();
  if (section === 'audit')            return loadAuditBlockchain();
  if (section === 'verify-txid')      return loadVerifikasiTxId();
  if (section === 'petugas')          return loadKelolaPetugas();
  if (section === 'auditlog')         return loadAuditLog();
}
async function loadAuditLog() {
  const res = await apiCall('/auditlog?limit=100');
  const content = document.getElementById('admin-content');
  const data = res.data || [];
  const rows = data.map(function(l) {
    const ip = (l.ip_address || '-').replace('::ffff:', '');
    const badgeClass = l.status === 'Berhasil' ? 'badge-success' : 'badge-danger';
    return '<tr><td style="white-space:nowrap;font-size:12px;">' + formatDate(l.created_at) +
      '</td><td>' + escapeHtml(l.nama_aktor) + '<br><span style="font-size:11px;color:#94a3b8;">' + escapeHtml(l.tipe_aktor) +
      '</span></td><td>' + escapeHtml(l.aksi) +
      '</td><td style="max-width:260px;font-size:12px;color:#64748b;">' + escapeHtml(l.detail || '-') +
      '</td><td style="font-size:12px;">' + escapeHtml(ip) +
      '</td><td style="max-width:180px;font-size:11px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(l.user_agent || '-') +
      '</td><td><span class="badge ' + badgeClass + '">' + escapeHtml(l.status) +
      '</span></td></tr>';
  }).join('');
  const emptyRow = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;">Belum ada log tercatat</td></tr>';
  const bodyHtml = data.length === 0 ? emptyRow : rows;
  content.innerHTML = '<div class="page-header"><h2>Log Aktivitas</h2></div>' +
    '<div class="card">' +
    '<div class="card-header"><span>' + data.length + ' aktivitas tercatat (login dan verifikasi)</span></div>' +
    '<div class="table-wrap"><table><thead><tr>' +
    '<th>Waktu</th><th>Aktor</th><th>Aksi</th><th>Detail</th><th>IP Address</th><th>Perangkat</th><th>Status</th>' +
    '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>' +
    '</div>';
}
async function loadAdminPengajuan() {
  const res = await apiCall('/pengajuan');
  const content = document.getElementById('admin-content');
  content.innerHTML = `
    <div class="page-header"><h2>Pengajuan Bantuan Sosial</h2></div>
    <div class="card">
      <div class="card-header">
        <h3>Semua Pengajuan</h3>
        <span style="font-size:11px;color:#94a3b8;" id="pengajuan-info">${res.data.length} pengajuan</span>
      </div>
      <div class="card-filters">
        <input type="text" id="search-pengajuan" placeholder="🔍 Cari nama / NIK..." oninput="filterPengajuan()">
        <select id="filter-pengajuan-status" onchange="filterPengajuan()">
          <option value="">Semua Status</option>
          <option>Diajukan</option><option>Verifikasi RT</option><option>Verifikasi RW</option>
          <option>Verifikasi IPSM</option><option>Verifikasi Puskesos</option>
          <option>Disetujui</option><option>Ditolak</option>
        </select>
      </div>
      <div id="pengajuan-table-container">
        ${renderPengajuanTable(res.data)}
      </div>
    </div>`;
  window._pengajuanData = res.data;
}

function renderPengajuanTable(data) {
  if (data.length === 0) return '<div style="text-align:center;padding:32px;color:#94a3b8;">Tidak ada data</div>';
  return `
    <div class="table-responsive">
      <table>
        <thead><tr>
          <th>Warga</th><th>Bantuan</th><th>Keterangan</th><th>Tanggal</th><th>Status</th><th>TX ID</th>
        </tr></thead>
        <tbody>
          ${data.map(p => `
            <tr>
              <td>${avatarCell(p.nama_warga, p.nik)}</td>
              <td style="font-size:12px;font-weight:500;">${p.jenis_bantuan}</td>
              <td style="font-size:12px;color:#64748b;">${escapeHtml(p.keterangan)||'—'}</td>
              <td style="font-size:12px;color:#64748b;">${formatDate(p.tanggal_pengajuan)}</td>
              <td>${getStatusBadge(p.status_pengajuan)}</td>
              ${txIdCell(p.tx_id_blockchain)}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${mobileCardList(data.map(p => `
      <div class="mobile-item">
        <div class="mobile-item-header">
          ${avatarCell(p.nama_warga, p.nik)}
          ${getStatusBadge(p.status_pengajuan)}
        </div>
        <div class="mobile-item-body">
          <div class="mobile-item-row"><span class="key">Bantuan</span><span class="val">${p.jenis_bantuan}</span></div>
          <div class="mobile-item-row"><span class="key">Tanggal</span><span class="val">${formatDate(p.tanggal_pengajuan)}</span></div>
          ${p.keterangan ? `<div class="mobile-item-row"><span class="key">Keterangan</span><span class="val">${escapeHtml(p.keterangan)}</span></div>` : ''}
        </div>
        ${p.tx_id_blockchain ? `<div class="mobile-item-tx"><i class="ti ti-link"></i>${p.tx_id_blockchain.substring(0,20)}...</div>` : ''}
      </div>`).join(''))}`;
}

function filterPengajuan() {
  const kw = document.getElementById('search-pengajuan').value.toLowerCase();
  const st = document.getElementById('filter-pengajuan-status').value;
  const filtered = window._pengajuanData.filter(p =>
    (!kw || p.nama_warga.toLowerCase().includes(kw) || p.nik.includes(kw) || p.jenis_bantuan.toLowerCase().includes(kw)) &&
    (!st || p.status_pengajuan === st)
  );
  document.getElementById('pengajuan-table-container').innerHTML = renderPengajuanTable(filtered);
  document.getElementById('pengajuan-info').textContent = `${filtered.length} dari ${window._pengajuanData.length} pengajuan`;
}

// ══════════════════════════════════════════
// ADMIN — VERIFIKASI AKHIR
// ══════════════════════════════════════════
async function loadAdminVerifikasi() {
  const res = await apiCall('/verifikasi/antrian');
  const content = document.getElementById('admin-content');
  content.innerHTML = `
    <div class="page-header"><h2>Antrian Verifikasi</h2><span>${currentUser.jabatan}</span></div>
    <div class="card">
      ${res.data.length === 0
        ? '<div style="text-align:center;padding:40px;color:#94a3b8;"><i class="ti ti-circle-check" style="font-size:32px;display:block;margin-bottom:8px;"></i>Tidak ada antrian</div>'
        : `<div class="table-responsive"><table>
            <thead><tr><th>Warga</th><th>Bantuan</th><th>Keterangan</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              ${res.data.map(p => `
                <tr>
                  <td>${avatarCell(p.nama_warga, p.nik)}</td>
                  <td id="saw-adm-${p.id_pengajuan}">
                    <div style="font-size:12px;font-weight:600;">${p.jenis_bantuan}</div>
                  </td>
                  <td style="font-size:12px;color:#64748b;">${escapeHtml(p.keterangan)||'—'}</td>
                  <td>${getStatusBadge(p.status_pengajuan)}</td>
                  <td>
                    <div style="display:flex;gap:6px;">
                      <button class="btn-secondary" onclick="showDetailAntrian(${p.id_pengajuan},'${escapeAttr(p.nama_warga)}','${escapeAttr(p.nik)}','${escapeAttr(p.jenis_bantuan)}','${escapeAttr(p.alamat||'')}','${escapeAttr(p.status_pengajuan)}','${escapeAttr(p.keterangan||'')}','')" title="Lihat Detail dan Dokumen">
                        <i class="ti ti-eye"></i>
                      </button>
                      <button class="btn-success" onclick="submitVerifikasi(${p.id_pengajuan},'Disetujui')">
                        <i class="ti ti-check"></i> Setujui
                      </button>
                      <button class="btn-danger" onclick="submitVerifikasi(${p.id_pengajuan},'Ditolak')">
                        <i class="ti ti-x"></i> Tolak
                      </button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table></div>
          ${mobileCardList(res.data.map(p => `
            <div class="mobile-item">
              <div class="mobile-item-header">
                ${avatarCell(p.nama_warga, p.nik)}
                ${getStatusBadge(p.status_pengajuan)}
              </div>
              <div class="mobile-item-body">
                <div class="mobile-item-row"><span class="key">Bantuan</span><span class="val">${p.jenis_bantuan}</span></div>
              </div>
              <div style="display:flex;gap:8px;margin-top:10px;">
                <button class="btn-success" style="flex:1;" onclick="submitVerifikasi(${p.id_pengajuan},'Disetujui')">✓ Setujui</button>
                <button class="btn-danger" style="flex:1;" onclick="submitVerifikasi(${p.id_pengajuan},'Ditolak')">✗ Tolak</button>
              </div>
            </div>`).join(''))}`}
   </div>`;
  res.data.forEach(p => {
    const el = document.getElementById('saw-adm-' + p.id_pengajuan);
    if (el) el.innerHTML += renderKlasifikasi(p.rekomendasi_sistem);
  });
}
async function submitVerifikasi(id_pengajuan, keputusan) {
  const catatan = prompt(`Catatan verifikasi (${keputusan}):`);
  if (catatan === null) return;
  const res = await apiCall('/verifikasi', 'POST', { id_pengajuan, keputusan, catatan });
  showToast(res.message, res.success ? 'success' : 'error');
  loadAdminVerifikasi();
}

// ══════════════════════════════════════════
// ADMIN — PENERIMA
// ══════════════════════════════════════════
async function loadAdminPenerima() {
  const res = await apiCall('/penerima');
  const content = document.getElementById('admin-content');
  content.innerHTML = `
    <div class="page-header"><h2>Penerima Bantuan</h2></div>
    <div class="card">
      <div class="card-header">
        <h3>Penerima Aktif</h3>
        <span style="font-size:11px;color:#94a3b8;" id="penerima-info">${(res.data||[]).length} penerima</span>
      </div>
      <div class="card-filters">
        <input type="text" id="search-penerima" placeholder="🔍 Cari nama / NIK..." oninput="filterPenerima()">
      </div>
      <div id="penerima-table-container">${renderPenerimaTable(res.data||[])}</div>
    </div>`;
  window._penerimaData = res.data || [];
}

function renderPenerimaTable(data) {
  if (data.length === 0) return '<div style="text-align:center;padding:32px;color:#94a3b8;">Belum ada penerima</div>';
  return `
    <div class="table-responsive"><table>
      <thead><tr><th>Warga</th><th>Bantuan</th><th>Tgl Daftar</th><th>Status</th><th>TX ID</th><th>Aksi</th></tr></thead>
      <tbody>
        ${data.map(p => `
          <tr>
            <td>${avatarCell(p.nama_warga, p.nik)}</td>
            <td style="font-size:12px;font-weight:500;">${p.jenis_bantuan}</td>
            <td style="font-size:12px;color:#64748b;">${formatDate(p.tanggal_daftar)}</td>
            <td><span class="badge badge-success">Aktif</span></td>
            ${txIdCell(p.tx_id_blockchain)}
            <td>
              <button class="btn-secondary" style="padding:6px 10px;font-size:11px;"
                onclick="showDetailPenerima(${p.id_penerima},'${escapeAttr(p.nama_warga)}')">
                <i class="ti ti-eye" style="font-size:13px;"></i> Detail
              </button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table></div>
    ${mobileCardList(data.map(p => `
      <div class="mobile-item">
        <div class="mobile-item-header">
          ${avatarCell(p.nama_warga, p.nik)}
          <span class="badge badge-success">Aktif</span>
        </div>
        <div class="mobile-item-body">
          <div class="mobile-item-row"><span class="key">Bantuan</span><span class="val">${p.jenis_bantuan}</span></div>
          <div class="mobile-item-row"><span class="key">Tgl Daftar</span><span class="val">${formatDate(p.tanggal_daftar)}</span></div>
        </div>
        <div style="margin-top:10px;">
          <button class="btn-secondary" style="width:100%;" onclick="showDetailPenerima(${p.id_penerima},'${escapeAttr(p.nama_warga)}')">
            <i class="ti ti-eye"></i> Lihat Detail
          </button>
        </div>
      </div>`).join(''))}`;
}

function filterPenerima() {
  const kw = document.getElementById('search-penerima').value.toLowerCase();
  const filtered = window._penerimaData.filter(p =>
    p.nama_warga.toLowerCase().includes(kw) || p.nik.includes(kw) || p.jenis_bantuan.toLowerCase().includes(kw)
  );
  document.getElementById('penerima-table-container').innerHTML = renderPenerimaTable(filtered);
  document.getElementById('penerima-info').textContent = `${filtered.length} dari ${window._penerimaData.length} penerima`;
}

async function showDetailPenerima(id_penerima) {
  const content = document.getElementById('admin-content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div>Memuat detail...</div>';
  try {
    const [resPenerima, resKonfirmasi] = await Promise.all([
      apiCall(`/penerima/${id_penerima}`),
      apiCall(`/penerima/${id_penerima}/riwayat-konfirmasi`)
    ]);
    const p = resPenerima.data;
    p.nama_warga = escapeHtml(p.nama_warga); p.nik = escapeHtml(p.nik); p.jenis_bantuan = escapeHtml(p.jenis_bantuan);
    const konfirmasi = resKonfirmasi.data || [];
    konfirmasi.forEach(k => { k.nama_petugas = escapeHtml(k.nama_petugas); });
    const totalKlaim = konfirmasi.filter(k => k.status_verifikasi === 'Berhasil').length;
    const terbaru = konfirmasi[0] || null;
    content.innerHTML = `
      <div class="page-header">
        <h2>Detail Penerima</h2>
        <button class="btn-secondary" onclick="loadAdminPenerima()">
          <i class="ti ti-arrow-left"></i> Kembali
        </button>
      </div>

      <!-- Summary cards -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
        <div class="stat-card sc-green">
          <div class="stat-top"><div class="stat-icon si-green"><i class="ti ti-gift"></i></div></div>
          <div class="stat-number">${totalKlaim}</div>
          <div class="stat-label">Total Klaim Berhasil</div>
        </div>
        <div class="stat-card sc-blue">
          <div class="stat-top"><div class="stat-icon si-blue"><i class="ti ti-calendar"></i></div></div>
          <div class="stat-number" style="font-size:16px;">${terbaru ? terbaru.periode_bantuan : '—'}</div>
          <div class="stat-label">Periode Terakhir</div>
        </div>
        <div class="stat-card sc-purple">
          <div class="stat-top"><div class="stat-icon si-purple"><i class="ti ti-clock"></i></div></div>
          <div class="stat-number" style="font-size:14px;">${terbaru ? formatDate(terbaru.tanggal_ambil) : '—'}</div>
          <div class="stat-label">Klaim Terakhir</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px;">
        <div class="card-header"><h3>Data Penerima</h3></div>
        <div style="padding:14px 18px;">
          <table style="width:100%;font-size:13px;">
            <tr><td style="font-weight:600;padding:7px 0;width:160px;color:#64748b;">Nama</td><td>${p.nama_warga}</td></tr>
            <tr><td style="font-weight:600;padding:7px 0;color:#64748b;">NIK</td><td style="font-family:monospace;">${p.nik}</td></tr>
            <tr><td style="font-weight:600;padding:7px 0;color:#64748b;">Jenis Bantuan</td><td>${p.jenis_bantuan}</td></tr>
            <tr><td style="font-weight:600;padding:7px 0;color:#64748b;">Tanggal Daftar</td><td>${formatDate(p.tanggal_daftar)}</td></tr>
            <tr><td style="font-weight:600;padding:7px 0;color:#64748b;">Status</td><td><span class="badge badge-success">Aktif</span></td></tr>
            <tr><td style="font-weight:600;padding:7px 0;color:#64748b;">TX ID Penetapan</td>
              <td>${p.tx_id_blockchain
                ? `<div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-family:monospace;font-size:11px;color:#94a3b8;">${p.tx_id_blockchain}</span>
                    <button onclick="copyTxId('${p.tx_id_blockchain}')" style="background:none;border:1px solid #e2e8f0;border-radius:4px;padding:2px 6px;cursor:pointer;">
                      <i class="ti ti-copy" style="font-size:11px;color:#94a3b8;"></i>
                    </button>
                  </div>` : '—'}</td>
            </tr>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Riwayat Konfirmasi Penerimaan</h3>
          <span style="font-size:11px;color:#94a3b8;">${konfirmasi.length} transaksi</span>
        </div>
        ${konfirmasi.length === 0
          ? '<div style="text-align:center;padding:32px;color:#94a3b8;"><i class="ti ti-inbox" style="font-size:32px;display:block;margin-bottom:8px;"></i>Belum ada konfirmasi penerimaan</div>'
          : `<div class="table-responsive"><table>
              <thead><tr><th>Periode</th><th>Tanggal Klaim</th><th>Cara Verif</th><th>Status</th><th>TX ID</th></tr></thead>
              <tbody>
                ${konfirmasi.map(k => `
                  <tr>
                    <td><span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;">${k.periode_bantuan}</span></td>
                    <td style="font-size:12px;color:#64748b;">${formatDate(k.tanggal_ambil, true)}</td>
                    <td style="font-size:12px;color:#64748b;">${k.nama_petugas ? '<i class="ti ti-shield-check" style="font-size:11px;"></i> Via Petugas' : '<i class="ti ti-user-check" style="font-size:11px;"></i> Mandiri (Warga)'}</td>
                    <td><span class="badge badge-success"><i class="ti ti-circle-check" style="font-size:10px;"></i> ${k.status_verifikasi}</span></td>
                    ${txIdCell(k.tx_id_blockchain)}
                  </tr>`).join('')}
              </tbody>
            </table></div>
            ${mobileCardList(konfirmasi.map(k => `
              <div class="mobile-item">
                <div class="mobile-item-header">
                  <div>
                    <p style="font-size:13px;font-weight:600;">${k.periode_bantuan}</p>
                    <span style="font-size:11px;color:#94a3b8;">${formatDate(k.tanggal_ambil, true)}</span>
                  </div>
                  <span class="badge badge-success">${k.status_verifikasi}</span>
                </div>
                <div class="mobile-item-body">
                  <div class="mobile-item-row"><span class="key">Cara Verif</span><span class="val">${k.nama_petugas ? 'Via Petugas' : 'Mandiri (Warga)'}</span></div>
                </div>
                ${k.tx_id_blockchain ? `<div class="mobile-item-tx"><i class="ti ti-link"></i>${k.tx_id_blockchain.substring(0,20)}...</div>` : ''}
              </div>`).join(''))}`}
      </div>`;
  } catch (e) {
    content.innerHTML = `<p style="color:#dc2626;padding:20px;">Gagal memuat: ${e.message}</p>`;
  }
}

// ══════════════════════════════════════════
// ADMIN — DATA WARGA
// ══════════════════════════════════════════
async function loadAdminWarga() {
  const res = await apiCall('/warga');
  const content = document.getElementById('admin-content');
  content.innerHTML = `
    <div class="page-header"><h2>Data Master Warga</h2></div>
    <div class="card">
      <div class="card-header">
        <h3>Daftar Warga</h3>
        <div style="display:flex;gap:8px;">
          <input type="text" id="search-warga" placeholder="🔍 Cari..." oninput="filterWarga()"
            style="padding:7px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;width:160px;outline:none;">
          <button class="btn-primary" onclick="showTambahWarga()" style="width:auto;padding:8px 14px;font-size:12px;">
            <i class="ti ti-plus"></i> Tambah
          </button>
        </div>
      </div>
      <div id="warga-info" style="font-size:12px;color:#94a3b8;padding:8px 16px;">${res.data.length} warga terdaftar</div>
      <div id="warga-table-container">${renderWargaTable(res.data)}</div>
    </div>`;
  window._wargaData = res.data;
}

function renderWargaTable(data) {
  if (data.length === 0) return '<div style="text-align:center;padding:32px;color:#94a3b8;">Tidak ada data warga</div>';
  return `
    <div class="table-responsive"><table>
      <thead><tr><th>Nama</th><th>NIK</th><th>Alamat</th><th>RT</th><th>RW</th><th>No HP</th></tr></thead>
      <tbody>
        ${data.map(w => `
          <tr>
            <td>${avatarCell(escapeHtml(w.nama_warga))}</td>
            <td style="font-family:monospace;font-size:12px;">${escapeHtml(w.nik)}</td>
            <td style="font-size:12px;color:#64748b;">${escapeHtml(w.alamat)}</td>
            <td style="font-size:12px;">${escapeHtml(w.id_rt)}</td>
            <td style="font-size:12px;">${escapeHtml(w.id_rw)}</td>
            <td style="font-size:12px;">${escapeHtml(w.no_hp)||'—'}</td>
          </tr>`).join('')}
      </tbody>
    </table></div>
    ${mobileCardList(data.map(w => `
      <div class="mobile-item">
        <div class="mobile-item-header">${avatarCell(escapeHtml(w.nama_warga))}</div>
        <div class="mobile-item-body">
          <div class="mobile-item-row"><span class="key">NIK</span><span class="val" style="font-family:monospace;">${escapeHtml(w.nik)}</span></div>
          <div class="mobile-item-row"><span class="key">Alamat</span><span class="val">${escapeHtml(w.alamat)}</span></div>
          <div class="mobile-item-row"><span class="key">RT/RW</span><span class="val">${escapeHtml(w.id_rt)}/${escapeHtml(w.id_rw)}</span></div>
        </div>
      </div>`).join(''))}`;
}

function filterWarga() {
  const kw = document.getElementById('search-warga').value.toLowerCase();
  const filtered = window._wargaData.filter(w =>
    w.nama_warga.toLowerCase().includes(kw) || w.nik.includes(kw) || w.alamat.toLowerCase().includes(kw)
  );
  document.getElementById('warga-table-container').innerHTML = renderWargaTable(filtered);
  document.getElementById('warga-info').textContent = `${filtered.length} dari ${window._wargaData.length} warga`;
}

function showTambahWarga() {
  const content = document.getElementById('admin-content');
  content.innerHTML = `
    <div class="page-header">
      <h2>Tambah Warga Baru</h2>
      <button class="btn-secondary" onclick="loadAdminWarga()"><i class="ti ti-arrow-left"></i> Kembali</button>
    </div>
    <div class="card" style="max-width:500px;">
      <div style="padding:20px;">
        <div style="background:#f0fdf4;border-left:3px solid #16a34a;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#15803d;">
          <i class="ti ti-info-circle" style="vertical-align:-2px;margin-right:6px;"></i>
          Warga akan mendaftarkan akun sendiri via portal menggunakan NIK dan OTP.
        </div>
        <div class="form-group"><label>Nama Lengkap</label><input type="text" id="tw-nama" placeholder="Nama lengkap warga"></div>
        <div class="form-group"><label>NIK (16 digit)</label><input type="text" id="tw-nik" maxlength="16" placeholder="3273XXXXXXXXXXXX" oninput="this.value=this.value.replace(/[^0-9]/g,'')"></div>
        <div class="form-group"><label>Alamat Lengkap</label><textarea id="tw-alamat" rows="3" placeholder="Jl. ..."></textarea></div>
        <div class="form-group"><label>No HP</label><input type="text" id="tw-hp" placeholder="08XXXXXXXXXX" oninput="this.value=this.value.replace(/[^0-9]/g,'')"></div>
        <div style="display:flex;gap:12px;">
          <div class="form-group" style="flex:1;margin-bottom:0;"><label>RT</label><input type="number" id="tw-rt" placeholder="1"></div>
          <div class="form-group" style="flex:1;margin-bottom:0;"><label>RW</label><input type="number" id="tw-rw" placeholder="1"></div>
        </div>
        <button class="btn-primary" onclick="simpanWarga()" style="margin-top:16px;">
          <i class="ti ti-device-floppy"></i> Simpan
        </button>
        <div id="tw-message" class="message"></div>
      </div>
    </div>`;
}

async function simpanWarga() {
  const data = {
    nama_warga: document.getElementById('tw-nama').value,
    nik: document.getElementById('tw-nik').value,
    alamat: document.getElementById('tw-alamat').value,
    no_hp: document.getElementById('tw-hp').value,
    id_rt: document.getElementById('tw-rt').value,
    id_rw: document.getElementById('tw-rw').value,
  };
  if (!data.nama_warga||!data.nik||!data.alamat||!data.id_rt||!data.id_rw)
    return showMessage('tw-message','Semua field wajib diisi','error');
  if (data.nik.length !== 16) return showMessage('tw-message','NIK harus 16 digit','error');
  const res = await apiCall('/warga','POST',data);
  if (res.success) { showToast('Warga berhasil ditambahkan!','success'); setTimeout(loadAdminWarga,1000); }
  else showMessage('tw-message',res.message,'error');
}
// ══════════════════════════════════════════
// AUDIT BLOCKCHAIN
// ══════════════════════════════════════════
let auditData = [], auditDataFiltered = [];

async function loadAuditBlockchain() {
  const res = await apiCall('/pengajuan');
  auditData = res.data || [];
  auditDataFiltered = [...auditData];
  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const content = document.getElementById('admin-content');
  content.innerHTML = `
    <div class="page-header"><h2>Audit Riwayat Blockchain</h2></div>
    <div style="background:#eff6ff;border-left:3px solid #1d4ed8;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#1e40af;">
      <i class="ti ti-link" style="vertical-align:-2px;margin-right:6px;"></i>
      Seluruh transaksi tercatat permanen di ledger <strong>Hyperledger Fabric</strong> — SHA-256 · Raft Consensus.
    </div>
    <div class="card" style="margin-bottom:14px;">
      <div class="card-header"><h3>Filter Data</h3></div>
      <div class="card-filters">
        <div style="display:flex;flex-direction:column;gap:4px;">
          <label style="font-size:11px;color:#64748b;">Dari</label>
          <input type="date" id="filter-dari" value="${firstDay}">
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <label style="font-size:11px;color:#64748b;">Sampai</label>
          <input type="date" id="filter-sampai" value="${today}">
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <label style="font-size:11px;color:#64748b;">Status</label>
          <select id="filter-status">
            <option value="">Semua</option>
            <option>Diajukan</option><option>Verifikasi RT</option><option>Verifikasi RW</option>
            <option>Verifikasi IPSM</option><option>Verifikasi Puskesos</option>
            <option>Disetujui</option><option>Ditolak</option>
          </select>
        </div>
        <div style="display:flex;gap:8px;align-items:flex-end;">
          <button class="btn-primary" onclick="filterAudit()" style="width:auto;padding:8px 16px;">
            <i class="ti ti-filter"></i> Tampilkan
          </button>
          <button class="btn-secondary" onclick="resetFilterAudit()">Reset</button>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <h3>Transaksi Pengajuan</h3>
        <div style="display:flex;gap:8px;">
          <button class="btn-secondary" onclick="exportCSV()">
            <i class="ti ti-file-spreadsheet"></i> CSV
          </button>
          <button class="btn-primary" onclick="exportPDF()" style="width:auto;padding:8px 14px;">
            <i class="ti ti-file-text"></i> PDF
          </button>
        </div>
      </div>
      <div id="audit-info" style="font-size:12px;color:#94a3b8;padding:8px 16px;">
        Menampilkan <strong>${auditData.length}</strong> data
      </div>
      <div id="audit-table-container">${renderAuditTable(auditData)}</div>
    </div>`;
}

function renderAuditTable(data) {
  if (data.length === 0) return '<div style="text-align:center;padding:32px;color:#94a3b8;">Tidak ada data</div>';
  return `
    <div class="table-responsive"><table>
      <thead><tr>
        <th>Warga</th><th>Bantuan</th><th>Tanggal</th><th>Status</th><th>TX ID</th><th>Aksi</th>
      </tr></thead>
      <tbody>
        ${data.map(p => `
          <tr>
            <td>${avatarCell(escapeHtml(p.nama_warga), escapeHtml(p.nik))}</td>
            <td style="font-size:12px;font-weight:500;">${escapeHtml(p.jenis_bantuan)}</td>
            <td style="font-size:12px;color:#64748b;">${formatDate(p.tanggal_pengajuan)}</td>
            <td>${getStatusBadge(p.status_pengajuan)}</td>
            ${txIdCell(p.tx_id_blockchain)}
            <td>
              <button class="btn-secondary" style="padding:5px 10px;font-size:11px;" onclick="verifikasiIntegritas(${p.id_pengajuan})" title="Verifikasi Integritas Data">
                <i class="ti ti-shield-check"></i>
              </button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table></div>
    ${mobileCardList(data.map(p => `
      <div class="mobile-item">
        <div class="mobile-item-header">
          ${avatarCell(escapeHtml(p.nama_warga), escapeHtml(p.nik))}
          ${getStatusBadge(p.status_pengajuan)}
        </div>
        <div class="mobile-item-body">
          <div class="mobile-item-row"><span class="key">Bantuan</span><span class="val">${escapeHtml(p.jenis_bantuan)}</span></div>
          <div class="mobile-item-row"><span class="key">Tanggal</span><span class="val">${formatDate(p.tanggal_pengajuan)}</span></div>
        </div>
        ${p.tx_id_blockchain ? `<div class="mobile-item-tx"><i class="ti ti-link"></i>${p.tx_id_blockchain.substring(0,20)}...</div>` : ''}
        <button class="btn-secondary" style="width:100%;margin-top:8px;" onclick="event.stopPropagation(); verifikasiIntegritas(${p.id_pengajuan})">
          <i class="ti ti-shield-check"></i> Verifikasi Integritas
        </button>
      </div>`).join(''))}`;
}

async function verifikasiIntegritas(id_pengajuan) {
  showToast('Memeriksa integritas data...', 'info');
  const res = await apiCall('/blockchain/verify-integrity/' + id_pengajuan);
  if (!res.success) {
    showToast(res.message, 'error');
    return;
  }
  if (res.status === 'belum_tercatat') {
    showToast(res.message, 'info');
  } else if (res.status === 'cocok') {
    showToast('Data terverifikasi cocok dengan blockchain', 'success');
  } else {
    showModal(`
      <div style="text-align:center;padding:10px;">
        <i class="ti ti-alert-triangle" style="font-size:40px;color:#dc2626;"></i>
        <h3 style="font-size:16px;font-weight:700;color:#dc2626;margin:10px 0;">Integritas Data Tidak Cocok!</h3>
        <p style="font-size:13px;color:#374151;margin-bottom:16px;">${escapeHtml(res.message)}</p>
        <div style="text-align:left;background:#fef2f2;padding:12px;border-radius:8px;font-size:11px;font-family:monospace;word-break:break-all;">
          <p style="margin-bottom:6px;"><strong>Hash MySQL:</strong><br>${escapeHtml(res.hash_mysql)}</p>
          <p><strong>Hash Blockchain:</strong><br>${escapeHtml(res.hash_ledger)}</p>
        </div>
        <button class="btn-secondary" style="width:100%;margin-top:14px;" onclick="closeModal()">Tutup</button>
      </div>
    `);
  }
}

function filterAudit() {
  const dari = document.getElementById('filter-dari').value;
  const sampai = document.getElementById('filter-sampai').value;
  const status = document.getElementById('filter-status').value;
  auditDataFiltered = auditData.filter(p => {
    const tgl = new Date(p.tanggal_pengajuan);
    return (!dari || tgl >= new Date(dari)) &&
           (!sampai || tgl <= new Date(sampai + 'T23:59:59')) &&
           (!status || p.status_pengajuan === status);
  });
  document.getElementById('audit-table-container').innerHTML = renderAuditTable(auditDataFiltered);
  document.getElementById('audit-info').innerHTML = `Menampilkan <strong>${auditDataFiltered.length}</strong> dari <strong>${auditData.length}</strong> data`;
  showToast(`${auditDataFiltered.length} data ditemukan`, 'info', 2000);
}

function resetFilterAudit() {
  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  document.getElementById('filter-dari').value = firstDay;
  document.getElementById('filter-sampai').value = today;
  document.getElementById('filter-status').value = '';
  auditDataFiltered = [...auditData];
  document.getElementById('audit-table-container').innerHTML = renderAuditTable(auditDataFiltered);
  document.getElementById('audit-info').innerHTML = `Menampilkan <strong>${auditData.length}</strong> data`;
}

function sanitizeCsvField(val) {
  // Cegah Formula/CSV Injection: netralkan field yang diawali karakter pemicu formula
  const s = String(val === null || val === undefined ? '' : val);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

async function exportCSV() {
  if (!auditDataFiltered.length) return showToast('Tidak ada data', 'warning');
  const headers = ['Nama Warga','NIK','Jenis Bantuan','Tanggal','Status','TX ID'];
  const rows = auditDataFiltered.map(p => [
    p.nama_warga, p.nik, p.jenis_bantuan,
    formatDate(p.tanggal_pengajuan), p.status_pengajuan, p.tx_id_blockchain||'-'
  ].map(sanitizeCsvField));
  const csv = [headers,...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));
  a.download = `Laporan_Bansos_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  apiCall('/auditlog/catat-export', 'POST', { format: 'csv', jumlah_data: auditDataFiltered.length });
  showToast('CSV berhasil diunduh!', 'success');
}

async function exportPDF() {
  if (!auditDataFiltered.length) return showToast('Tidak ada data', 'warning');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
  const tgl = new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
  const dari = document.getElementById('filter-dari').value;
  const sampai = document.getElementById('filter-sampai').value;
  const filterInfo = dari && sampai ? `Periode: ${formatDate(dari)} s/d ${formatDate(sampai)}` : 'Periode: Semua Data';

  doc.setFillColor(15,23,42); doc.rect(0,0,297,30,'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(13); doc.setFont('helvetica','bold');
  doc.text('LAPORAN PENYALURAN BANTUAN SOSIAL',148,12,{align:'center'});
  doc.setFontSize(9); doc.setFont('helvetica','normal');
  doc.text('Kelurahan Cipedes · Kecamatan Sukajadi · Kota Bandung',148,20,{align:'center'});
  doc.text('Berbasis Blockchain Hyperledger Fabric',148,26,{align:'center'});

  doc.setTextColor(0,0,0); doc.setFontSize(9);
  doc.text(`Tanggal Cetak: ${tgl}`,14,38);
  doc.text(`${filterInfo}`,14,44);
  doc.text(`Total Data: ${auditDataFiltered.length} pengajuan`,14,50);
  doc.text(`Dicetak: ${currentUser.nama} (${currentUser.jabatan})`,14,56);
  doc.setDrawColor(15,23,42); doc.setLineWidth(0.5); doc.line(14,60,283,60);

  doc.autoTable({
    startY:64,
    head:[['Nama Warga','NIK','Bantuan','Tanggal','Status','TX ID']],
    body:auditDataFiltered.map(p=>[
      String(p.nama_warga||''), String(p.nik||''), String(p.jenis_bantuan||''),
      formatDate(p.tanggal_pengajuan), p.status_pengajuan, p.tx_id_blockchain||'-'
    ]),
    headStyles:{fillColor:[15,23,42],textColor:[255,255,255],fontStyle:'bold',fontSize:8},
    bodyStyles:{fontSize:7},
    alternateRowStyles:{fillColor:[248,250,252]},
    margin:{left:14,right:14}
  });

  const pages = doc.internal.getNumberOfPages();
  for (let i=1;i<=pages;i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150,150,150);
    doc.text(`Hal ${i}/${pages} — Sistem Bansos Kelurahan Cipedes`,148,doc.internal.pageSize.height-6,{align:'center'});
  }
  doc.save(`Laporan_Bansos_${new Date().toISOString().split('T')[0]}.pdf`);
  apiCall('/auditlog/catat-export', 'POST', { format: 'pdf', jumlah_data: auditDataFiltered.length });
  showToast('PDF berhasil diunduh!', 'success');
}

// ══════════════════════════════════════════
// VERIFIKASI TX ID
// ══════════════════════════════════════════
async function loadVerifikasiTxId() {
  const resInfo = await apiCall('/blockchain/channel-info');
  const info = resInfo.data || {};
  const content = document.getElementById('admin-content');
  content.innerHTML = `
    <div class="page-header"><h2>Verifikasi TX ID Blockchain</h2></div>
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px;">
      ${statCard(info.total_transaksi?.pengajuan||0, 'Tx Pengajuan',  'ti-clipboard-list','blue')}
      ${statCard(info.total_transaksi?.verifikasi||0,'Tx Verifikasi', 'ti-circle-check',  'green')}
      ${statCard(info.total_transaksi?.penerima||0,  'Tx Penerima',   'ti-gift',          'purple')}
      ${statCard(info.total_transaksi?.konfirmasi||0,'Tx Konfirmasi', 'ti-scan',          'amber')}
    </div>
    <div class="card" style="margin-bottom:14px;">
      <div class="card-header"><h3>Info Jaringan Blockchain</h3></div>
      <div style="padding:14px 18px;">
        <table style="width:100%;font-size:13px;">
          <tr><td style="font-weight:600;padding:6px 0;width:160px;color:#64748b;">Platform</td><td>${info.platform||'—'}</td></tr>
          <tr><td style="font-weight:600;padding:6px 0;color:#64748b;">Channel</td><td><code style="font-size:12px;">${info.channel||'—'}</code></td></tr>
          <tr><td style="font-weight:600;padding:6px 0;color:#64748b;">Chaincode</td><td><code style="font-size:12px;">${info.chaincode||'—'}</code></td></tr>
          <tr><td style="font-weight:600;padding:6px 0;color:#64748b;">Konsensus</td><td>${info.consensus||'—'}</td></tr>
          <tr><td style="font-weight:600;padding:6px 0;color:#64748b;">Hash</td><td>${info.hashing||'—'}</td></tr>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Cari & Verifikasi TX ID</h3></div>
      <div style="padding:16px 18px;">
        <p style="font-size:13px;color:#64748b;margin-bottom:14px;">Masukkan TX ID untuk memverifikasi keaslian transaksi di blockchain.</p>
        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
          <input type="text" id="txid-input"
            placeholder="Masukkan TX ID (64 karakter hex)..."
            style="flex:1;min-width:0;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:monospace;font-size:12px;outline:none;">
          <button onclick="navigator.clipboard.readText().then(t=>{document.getElementById('txid-input').value=t;verifyTxId();})"
            style="padding:10px 14px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:12px;color:#64748b;white-space:nowrap;">
            <i class="ti ti-clipboard"></i> Paste
          </button>
          <button class="btn-primary" onclick="verifyTxId()" style="width:auto;padding:10px 18px;flex-shrink:0;">
            <i class="ti ti-search"></i> Verifikasi
          </button>
        </div>
        <div id="txid-result"></div>
      </div>
    </div>`;
  document.getElementById('txid-input').addEventListener('keypress', e => { if (e.key==='Enter') verifyTxId(); });
}

async function verifyTxId() {
  const txid = document.getElementById('txid-input').value.trim();
  if (!txid) return showToast('Masukkan TX ID', 'warning');
  if (txid.length !== 64) return showToast('TX ID harus 64 karakter', 'warning');
  const resultEl = document.getElementById('txid-result');
  resultEl.innerHTML = '<div class="loading"><div class="spinner"></div>Memverifikasi...</div>';
  try {
    const res = await apiCall(`/blockchain/verify-txid/${txid}`);
    if (res.success) {
      const typeColors = {
        'Pengajuan Bantuan Sosial':'#1d4ed8',
        'Verifikasi Berjenjang':'#16a34a',
        'Penetapan Penerima':'#0891b2',
        'Konfirmasi Penerimaan':'#7c3aed'
      };
      const typeIcons = {
        'Pengajuan Bantuan Sosial':'ti-clipboard-list',
        'Verifikasi Berjenjang':'ti-circle-check',
        'Penetapan Penerima':'ti-gift',
        'Konfirmasi Penerimaan':'ti-scan'
      };
      const color = typeColors[res.type]||'#1d4ed8';
      const icon  = typeIcons[res.type]||'ti-link';
      const skipKeys = ['tx_id_blockchain','embedding_wajah','hash_wajah'];
      const labelMap = {
        id_pengajuan:'ID Pengajuan', nama_warga:'Nama Warga', nik:'NIK',
        jenis_bantuan:'Jenis Bantuan', status_pengajuan:'Status', tanggal_pengajuan:'Tanggal',
        keterangan:'Keterangan', tahap_verifikasi:'Tahap', keputusan:'Keputusan',
        catatan:'Catatan', tanggal_verifikasi:'Tgl Verifikasi', nama_petugas:'Petugas',
        jabatan:'Jabatan', tanggal_daftar:'Tgl Daftar', tanggal_ambil:'Tgl Ambil',
        periode_bantuan:'Periode', status_verifikasi:'Status'
      };
      const rows = Object.entries(res.data)
        .filter(([k])=>!skipKeys.includes(k))
        .map(([k,v])=>`
          <tr>
            <td style="font-weight:600;color:#64748b;width:160px;padding:6px 0;font-size:12px;">${escapeHtml(labelMap[k]||k)}</td>
            <td style="padding:6px 0;font-size:12px;">${escapeHtml(v)||'—'}</td>
          </tr>`).join('');
      resultEl.innerHTML = `
        <div style="border:1px solid ${color};border-radius:10px;overflow:hidden;">
          <div style="background:${color};padding:14px 16px;color:#fff;display:flex;align-items:center;gap:10px;">
            <i class="ti ${icon}" style="font-size:20px;"></i>
            <div>
              <div style="font-weight:700;">✓ TX ID Terverifikasi</div>
              <div style="font-size:11px;opacity:0.8;">${res.type}</div>
            </div>
          </div>
          <div style="padding:16px;">
            <div style="background:#f8fafc;padding:8px 12px;border-radius:6px;margin-bottom:14px;font-size:11px;font-family:monospace;word-break:break-all;display:flex;align-items:center;gap:8px;">
              <span style="flex:1;color:#64748b;">${res.txid}</span>
              <button onclick="copyTxId('${res.txid}')"
                style="background:none;border:1px solid #e2e8f0;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:11px;color:#94a3b8;flex-shrink:0;">
                <i class="ti ti-copy"></i>
              </button>
            </div>
            <table style="width:100%;border-collapse:collapse;"><tbody>${rows}</tbody></table>
            <div style="margin-top:14px;padding:10px 12px;background:#eff6ff;border-radius:8px;font-size:12px;color:#1e40af;border-left:3px solid #1d4ed8;">
              <i class="ti ti-link" style="vertical-align:-2px;margin-right:6px;"></i>
              Tercatat permanen di ledger <strong>Hyperledger Fabric</strong> · <strong>SHA-256</strong> · <strong>Raft</strong>
            </div>
          </div>
        </div>`;
      showToast('TX ID valid!', 'success');
    } else {
      resultEl.innerHTML = `
        <div style="border:1px solid #dc2626;border-radius:10px;overflow:hidden;">
          <div style="background:#dc2626;padding:14px 16px;color:#fff;display:flex;align-items:center;gap:10px;">
            <i class="ti ti-circle-x" style="font-size:20px;"></i>
            <div>
              <div style="font-weight:700;">TX ID Tidak Ditemukan</div>
              <div style="font-size:11px;opacity:0.8;">${res.message}</div>
            </div>
          </div>
        </div>`;
      showToast('TX ID tidak ditemukan', 'error');
    }
  } catch (e) {
    resultEl.innerHTML = `<p style="color:#dc2626;padding:12px;">Error: ${e.message}</p>`;
  }
}
// ══════════════════════════════════════════
// KELOLA PETUGAS
// ══════════════════════════════════════════
async function loadKelolaPetugas() {
  const res = await apiCall('/petugas');
  const content = document.getElementById('admin-content');
  content.innerHTML = `
    <div class="page-header"><h2>Kelola Petugas</h2></div>
    <div class="card">
      <div class="card-header">
        <h3>Daftar Petugas</h3>
        <div style="display:flex;gap:8px;">
          <input type="text" id="search-petugas" placeholder="🔍 Cari..." oninput="filterPetugas()"
            style="padding:7px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;width:160px;outline:none;">
          <button class="btn-primary" onclick="showTambahPetugas()" style="width:auto;padding:8px 14px;font-size:12px;">
            <i class="ti ti-plus"></i> Tambah
          </button>
        </div>
      </div>
      <div id="petugas-info" style="font-size:12px;color:#94a3b8;padding:8px 16px;">${res.data.length} petugas terdaftar</div>
      <div id="petugas-table-container">${renderPetugasTable(res.data)}</div>
    </div>`;
  window._petugasData = res.data;
}

function renderPetugasTable(data) {
  if (data.length === 0) return '<div style="text-align:center;padding:32px;color:#94a3b8;">Tidak ada data petugas</div>';
  const jabBadge = {
    'Admin Kelurahan':'badge-primary','RT':'badge-info',
    'RW':'badge-info','IPSM':'badge-warning','Puskesos':'badge-success'
  };
  return `
    <div class="table-responsive"><table>
      <thead><tr><th>Nama</th><th>Jabatan</th><th>Username</th><th>No HP</th><th>Tgl Daftar</th><th>Aksi</th></tr></thead>
      <tbody>
        ${data.map(p => `
          <tr>
            <td>${avatarCell(escapeHtml(p.nama_petugas))}</td>
            <td><span class="badge ${jabBadge[p.jabatan]||'badge-primary'}">${escapeHtml(p.jabatan)}</span></td>
            <td style="font-family:monospace;font-size:12px;">${escapeHtml(p.username)}</td>
            <td style="font-size:12px;">${escapeHtml(p.no_hp)||'—'}</td>
            <td style="font-size:12px;color:#64748b;">${formatDate(p.created_at)}</td>
            <td>
              <div style="display:flex;gap:6px;">
                <button class="btn-secondary" style="padding:5px 10px;font-size:11px;"
                  onclick="showEditPetugas(${p.id_petugas},'${escapeAttr(p.nama_petugas)}','${escapeAttr(p.jabatan)}','${escapeAttr(p.no_hp||'')}')">
                  <i class="ti ti-pencil"></i>
                </button>
                ${p.jabatan!=='Admin Kelurahan'?`
                <button class="btn-danger" style="padding:5px 10px;font-size:11px;"
                  onclick="hapusPetugas(${p.id_petugas},'${escapeAttr(p.nama_petugas)}')">
                  <i class="ti ti-trash"></i>
                </button>`:''}
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table></div>
    ${mobileCardList(data.map(p => `
      <div class="mobile-item">
        <div class="mobile-item-header">
          ${avatarCell(escapeHtml(p.nama_petugas))}
          <span class="badge ${jabBadge[p.jabatan]||'badge-primary'}">${escapeHtml(p.jabatan)}</span>
        </div>
        <div class="mobile-item-body">
          <div class="mobile-item-row"><span class="key">Username</span><span class="val" style="font-family:monospace;">${escapeHtml(p.username)}</span></div>
          <div class="mobile-item-row"><span class="key">No HP</span><span class="val">${escapeHtml(p.no_hp)||'—'}</span></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn-secondary" style="flex:1;" onclick="showEditPetugas(${p.id_petugas},'${escapeAttr(p.nama_petugas)}','${escapeAttr(p.jabatan)}','${escapeAttr(p.no_hp||'')}')">
            <i class="ti ti-pencil"></i> Edit
          </button>
          ${p.jabatan!=='Admin Kelurahan'?`
          <button class="btn-danger" style="flex:1;" onclick="hapusPetugas(${p.id_petugas},'${escapeAttr(p.nama_petugas)}')">
            <i class="ti ti-trash"></i> Hapus
          </button>`:''}
        </div>
      </div>`).join(''))}`;
}

function filterPetugas() {
  const kw = document.getElementById('search-petugas').value.toLowerCase();
  const filtered = window._petugasData.filter(p =>
    p.nama_petugas.toLowerCase().includes(kw) ||
    p.jabatan.toLowerCase().includes(kw) ||
    p.username.toLowerCase().includes(kw)
  );
  document.getElementById('petugas-table-container').innerHTML = renderPetugasTable(filtered);
  document.getElementById('petugas-info').textContent = `${filtered.length} dari ${window._petugasData.length} petugas`;
}

function showTambahPetugas() {
  const content = document.getElementById('admin-content');
  content.innerHTML = `
    <div class="page-header">
      <h2>Tambah Petugas</h2>
      <button class="btn-secondary" onclick="loadKelolaPetugas()"><i class="ti ti-arrow-left"></i> Kembali</button>
    </div>
    <div class="card" style="max-width:480px;">
      <div style="padding:20px;">
        <div class="form-group"><label>Nama Lengkap</label><input type="text" id="tp-nama" placeholder="Nama petugas"></div>
        <div class="form-group">
          <label>Jabatan</label>
          <select id="tp-jabatan">
            <option value="">-- Pilih Jabatan --</option>
            <option>RT</option><option>RW</option><option>IPSM</option>
            <option>Puskesos</option><option>Admin Kelurahan</option>
          </select>
        </div>
        <div class="form-group"><label>Username</label><input type="text" id="tp-username" placeholder="username unik"></div>
        <div class="form-group">
          <label>Password</label>
          <div style="position:relative;">
            <input type="password" id="tp-password" placeholder="minimal 6 karakter" style="padding-right:40px;">
            <button type="button" onclick="togglePassword('tp-password',this)"
              style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#9ca3af;font-size:16px;display:flex;align-items:center;">
              <i class="ti ti-eye"></i>
            </button>
          </div>
        </div>
        <div class="form-group"><label>No HP</label><input type="text" id="tp-hp" placeholder="08XXXXXXXXXX" oninput="this.value=this.value.replace(/[^0-9]/g,'')"></div>
        <div style="display:flex;gap:10px;margin-top:16px;">
          <button class="btn-primary" onclick="simpanPetugas()" style="width:auto;padding:10px 22px;">
            <i class="ti ti-device-floppy"></i> Simpan
          </button>
          <button class="btn-secondary" onclick="loadKelolaPetugas()">Batal</button>
        </div>
        <div id="tp-message" class="message"></div>
      </div>
    </div>`;
}

async function simpanPetugas() {
  const data = {
    nama_petugas: document.getElementById('tp-nama').value,
    jabatan: document.getElementById('tp-jabatan').value,
    username: document.getElementById('tp-username').value,
    password: document.getElementById('tp-password').value,
    no_hp: document.getElementById('tp-hp').value
  };
  if (!data.nama_petugas||!data.jabatan||!data.username||!data.password)
    return showMessage('tp-message','Semua field wajib diisi','error');
  const res = await apiCall('/petugas','POST',data);
  if (res.success) { showToast('Petugas berhasil ditambahkan!','success'); setTimeout(loadKelolaPetugas,1000); }
  else showMessage('tp-message',res.message,'error');
}

function showEditPetugas(id, nama, jabatan, no_hp) {
  const content = document.getElementById('admin-content');
  content.innerHTML = `
    <div class="page-header">
      <h2>Edit Petugas</h2>
      <button class="btn-secondary" onclick="loadKelolaPetugas()"><i class="ti ti-arrow-left"></i> Kembali</button>
    </div>
    <div class="card" style="max-width:480px;">
      <div style="padding:20px;">
        <div class="form-group"><label>Nama Lengkap</label><input type="text" id="ep-nama" value="${escapeHtml(nama)}"></div>
        <div class="form-group">
          <label>Jabatan</label>
          <select id="ep-jabatan">
            <option value="RT" ${jabatan==='RT'?'selected':''}>RT</option>
            <option value="RW" ${jabatan==='RW'?'selected':''}>RW</option>
            <option value="IPSM" ${jabatan==='IPSM'?'selected':''}>IPSM</option>
            <option value="Puskesos" ${jabatan==='Puskesos'?'selected':''}>Puskesos</option>
            <option value="Admin Kelurahan" ${jabatan==='Admin Kelurahan'?'selected':''}>Admin Kelurahan</option>
          </select>
        </div>
        <div class="form-group"><label>No HP</label><input type="text" id="ep-hp" value="${escapeHtml(no_hp)}" oninput="this.value=this.value.replace(/[^0-9]/g,'')"></div>
        <div style="display:flex;gap:10px;margin-top:16px;">
          <button class="btn-primary" onclick="updatePetugas(${id})" style="width:auto;padding:10px 22px;">
            <i class="ti ti-device-floppy"></i> Simpan
          </button>
          <button class="btn-secondary" onclick="loadKelolaPetugas()">Batal</button>
        </div>
        <div id="ep-message" class="message"></div>
      </div>
    </div>`;
}

async function updatePetugas(id) {
  const data = {
    nama_petugas: document.getElementById('ep-nama').value,
    jabatan: document.getElementById('ep-jabatan').value,
    no_hp: document.getElementById('ep-hp').value
  };
  const res = await apiCall(`/petugas/${id}`,'PUT',data);
  if (res.success) { showToast('Petugas berhasil diupdate!','success'); setTimeout(loadKelolaPetugas,1000); }
  else showMessage('ep-message',res.message,'error');
}

async function hapusPetugas(id, nama) {
  if (!confirm(`Hapus petugas "${nama}"?`)) return;
  const res = await apiCall(`/petugas/${id}`,'DELETE');
  showToast(res.message, res.success?'success':'error');
  if (res.success) loadKelolaPetugas();
}

// ══════════════════════════════════════════
// PETUGAS DASHBOARD
// ══════════════════════════════════════════
async function loadPetugasDashboard() {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${buildMobileTopbar('Bansos Cipedes')}
    <div class="app-layout">
      <aside class="sidebar" id="petugas-sidebar">
        ${buildPetugasSidebar('dashboard')}
      </aside>
      <div class="main-area">
        ${buildTopbar(`Dashboard ${currentUser.jabatan}`)}
        <main class="content" id="petugas-content">
          <div class="loading"><div class="spinner"></div>Memuat...</div>
        </main>
      </div>
    </div>
    ${buildPetugasBottomNav('dashboard')}`;
  await loadPetugasStats();
}

async function loadPetugasStats() {
  try {
    const res = await apiCall('/dashboard/petugas');
    if (!res.success) return;
    const d = res.data;
    document.getElementById('petugas-content').innerHTML = `
      <div class="page-header">
        <h2>Dashboard ${currentUser.jabatan}</h2>
        <span>${formatDate(new Date().toISOString())}</span>
      </div>
      <div class="stats-grid" style="grid-template-columns:repeat(2,1fr);max-width:400px;">
        ${statCard(d.statistik.antrian_menunggu,  'Menunggu Verifikasi','ti-clock',        'amber')}
        ${statCard(d.statistik.sudah_diverifikasi,'Sudah Diverifikasi', 'ti-circle-check', 'green')}
      </div>
      <div class="card">
        <div class="card-header"><h3>Verifikasi Terbaru</h3></div>
        ${d.verifikasi_terbaru.length===0
          ? '<div style="text-align:center;padding:32px;color:#94a3b8;">Belum ada riwayat verifikasi</div>'
          : `<div class="table-responsive"><table>
              <thead><tr><th>Warga</th><th>Bantuan</th><th>Keputusan</th><th>Tanggal</th><th>TX ID</th></tr></thead>
              <tbody>
                ${d.verifikasi_terbaru.map(v=>`
                  <tr>
                    <td>${avatarCell(v.nama_warga, v.nik)}</td>
                    <td style="font-size:12px;font-weight:500;">${v.jenis_bantuan}</td>
                    <td>${getStatusBadge(v.keputusan)}</td>
                    <td style="font-size:12px;color:#64748b;">${formatDate(v.tanggal_verifikasi,true)}</td>
                    ${txIdCell(v.tx_id_blockchain)}
                  </tr>`).join('')}
              </tbody>
            </table></div>
            ${mobileCardList(d.verifikasi_terbaru.map(v=>`
              <div class="mobile-item" onclick="showDetailRiwayat('${escapeAttr(v.nama_warga)}','${escapeAttr(v.nik)}','${escapeAttr(v.jenis_bantuan)}','${escapeAttr(v.keputusan)}','${escapeAttr(v.tanggal_verifikasi)}','${escapeAttr(v.catatan||'')}','${escapeAttr(v.tx_id_blockchain||'')}')" style="cursor:pointer;">
                <div class="mobile-item-header">
                  ${avatarCell(v.nama_warga, v.nik)}
                  ${getStatusBadge(v.keputusan)}
                </div>
                <div class="mobile-item-body">
                  <div class="mobile-item-row"><span class="key">Bantuan</span><span class="val">${v.jenis_bantuan}</span></div>
                  <div class="mobile-item-row"><span class="key">Tanggal</span><span class="val">${formatDate(v.tanggal_verifikasi,true)}</span></div>
                </div>
                <div style="font-size:11px;color:#94a3b8;margin-top:6px;display:flex;align-items:center;gap:4px;">
                  <i class="ti ti-tap" style="font-size:12px;"></i> Ketuk untuk detail
                </div>
              </div>`).join(''))}`}
      </div>`;
  } catch {
    document.getElementById('petugas-content').innerHTML = '<p style="color:#dc2626;padding:20px;">Gagal memuat data</p>';
  }
}

function showPetugasSection(section, e) {
  if (e) e.preventDefault();
  syncBottomNavActive(section);
  const sb = document.getElementById('petugas-sidebar');
  if (sb) sb.innerHTML = buildPetugasSidebar(section);
  const tb = document.querySelector('.topbar strong');
  const titles = { dashboard:`Dashboard ${currentUser.jabatan}`, antrian:'Antrian Verifikasi', riwayat:'Riwayat Saya' };
  if (tb) tb.textContent = titles[section]||section;
  const content = document.getElementById('petugas-content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div>Memuat...</div>';
  if (section==='dashboard') return loadPetugasStats();
  if (section==='antrian')   return loadAntrianVerifikasi();
  if (section==='riwayat')   return loadRiwayatVerifikasi();
}

async function loadAntrianVerifikasi() {
  const res = await apiCall('/verifikasi/antrian');
  const content = document.getElementById('petugas-content');

  const antrianKey = 'antrian_ids_' + currentUser.id;
  const idsLama = JSON.parse(localStorage.getItem(antrianKey) || '[]');
  const idsBaru = (res.data || []).map(p => p.id_pengajuan);
  const idsBaruMasuk = idsBaru.filter(id => !idsLama.includes(id));
  if (idsLama.length > 0 && idsBaruMasuk.length > 0) {
    const dataBaruMasuk = res.data.filter(p => idsBaruMasuk.includes(p.id_pengajuan));
    if (idsBaruMasuk.length === 1) {
      const p = dataBaruMasuk[0];
      addNotif('ti-inbox', 'Pengajuan Baru Masuk',
        `Pengajuan ${p.jenis_bantuan} dari ${p.nama_warga} menunggu verifikasi ${currentUser.jabatan}.`,
        'info');
    } else {
      addNotif('ti-inbox', 'Pengajuan Baru Masuk',
        `${idsBaruMasuk.length} pengajuan baru menunggu verifikasi ${currentUser.jabatan}.`,
        'info');
    }
  }
  localStorage.setItem(antrianKey, JSON.stringify(idsBaru));

  content.innerHTML = `
    <div class="page-header"><h2>Antrian Verifikasi</h2><span>${currentUser.jabatan}</span></div>
    <div class="card">
      ${res.data.length===0
        ? '<div style="text-align:center;padding:40px;color:#94a3b8;"><i class="ti ti-circle-check" style="font-size:32px;display:block;margin-bottom:8px;"></i>Tidak ada antrian</div>'
        : `<div class="table-responsive"><table>
            <thead><tr><th>Warga</th><th>Alamat</th><th>Bantuan</th><th>Keterangan</th><th>Aksi</th></tr></thead>
            <tbody>
              ${res.data.map(p=>`
                <tr>
                  <td>
                    ${avatarCell(p.nama_warga, p.nik)}
 <div style="font-size:12px;color:#64748b;margin-top:4px;font-weight:500;">${new Date(p.tanggal_pengajuan).toLocaleDateString('id-ID')} · No.${p.id_pengajuan}</div>
                  </td>
                  <td style="font-size:12px;color:#64748b;">${p.alamat}</td>
                  <td id="saw-td-${p.id_pengajuan}">
                    <div style="font-size:12px;font-weight:600;">${p.jenis_bantuan}</div>
                  </td>
                  <td style="font-size:12px;color:#64748b;">${escapeHtml(p.keterangan)||'—'}</td>
                  <td>
                    <div style="display:flex;gap:6px;">
                      <button class="btn-secondary" onclick="showDetailAntrian(${p.id_pengajuan},'${escapeAttr(p.nama_warga)}','${escapeAttr(p.nik)}','${escapeAttr(p.jenis_bantuan)}','${escapeAttr(p.alamat)}','${escapeAttr(p.status_pengajuan)}','${escapeAttr(p.keterangan||'')}','')" title="Lihat Detail dan Dokumen">
                        <i class="ti ti-eye"></i>
                      </button>
                      <button class="btn-secondary" style="position:relative;" onclick="bukaChatPetugas(${p.id_pengajuan}, '${escapeAttr(p.nama_warga)}')" title="Chat">
                        <i class="ti ti-message-circle"></i>
                        <span id="chat-unread-badge-${p.id_pengajuan}" class="hidden" style="position:absolute;top:3px;right:3px;width:8px;height:8px;background:#dc2626;border-radius:50%;border:1.5px solid #fff;"></span>
                      </button>
                      <button class="btn-success" onclick="submitVerifikasiPetugas(${p.id_pengajuan},'Disetujui')">
                        <i class="ti ti-check"></i> Setujui
                      </button>
                      <button class="btn-danger" onclick="submitVerifikasiPetugas(${p.id_pengajuan},'Ditolak')">
                        <i class="ti ti-x"></i> Tolak
                      </button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table></div>
          ${mobileCardList(res.data.map(p=>`
            <div class="mobile-item" onclick="showDetailAntrian(${p.id_pengajuan},'${escapeAttr(p.nama_warga)}','${escapeAttr(p.nik)}','${escapeAttr(p.jenis_bantuan)}','${escapeAttr(p.alamat)}','${escapeAttr(p.status_pengajuan)}','${escapeAttr(p.keterangan||'')}','')" style="cursor:pointer;">
              <div class="mobile-item-header">${avatarCell(p.nama_warga, p.nik)}</div>
              <div class="mobile-item-body">
                <div class="mobile-item-row"><span class="key">Tanggal</span><span class="val">${new Date(p.tanggal_pengajuan).toLocaleDateString('id-ID')} · No.${p.id_pengajuan}</span></div>
                <div class="mobile-item-row"><span class="key">Bantuan</span><span class="val" style="font-weight:600;">${p.jenis_bantuan}</span></div>
                <div class="mobile-item-row"><span class="key">Alamat</span><span class="val">${p.alamat}</span></div>
                ${p.keterangan ? `<div class="mobile-item-row"><span class="key">Keterangan</span><span class="val">${escapeHtml(p.keterangan)}</span></div>` : ''}
              </div>
              <div style="display:flex;gap:8px;margin-top:10px;">
                <button class="btn-secondary" style="position:relative;" onclick="event.stopPropagation(); bukaChatPetugas(${p.id_pengajuan}, '${escapeAttr(p.nama_warga)}')" title="Chat"><i class="ti ti-message-circle"></i><span id="chat-unread-badge-mobile-${p.id_pengajuan}" class="hidden" style="position:absolute;top:3px;right:3px;width:8px;height:8px;background:#dc2626;border-radius:50%;border:1.5px solid #fff;"></span></button>
                <button class="btn-success" style="flex:1;" onclick="submitVerifikasiPetugas(${p.id_pengajuan},'Disetujui')">✓ Setujui</button>
                <button class="btn-danger"  style="flex:1;" onclick="submitVerifikasiPetugas(${p.id_pengajuan},'Ditolak')">✗ Tolak</button>
              </div>
            </div>`).join(''))}`}
    </div>`;
  res.data.forEach(p => {
    const el = document.getElementById('saw-td-' + p.id_pengajuan);
    if (el) el.innerHTML += renderKlasifikasi(p.rekomendasi_sistem);
  });
  cekPesanBaru(res.data, false);
}

function submitVerifikasiPetugas(id_pengajuan, keputusan) {
  if (keputusan === 'Disetujui') {
    showModal(`
      <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:12px;">Setujui Pengajuan</h3>
      <div class="form-group">
        <label>Catatan (opsional)</label>
        <textarea id="vf-catatan" rows="3" placeholder="Catatan tambahan (opsional)..."></textarea>
      </div>
      <button class="btn-primary" onclick="kirimVerifikasiFinal(${id_pengajuan}, 'Disetujui', document.getElementById('vf-catatan').value || 'Disetujui')" style="width:100%;margin-top:8px;">
        <i class="ti ti-check"></i> Konfirmasi Persetujuan
      </button>
    `);
    return;
  }
  const alasanTemplate = [
    'Data atau dokumen pendukung tidak lengkap',
    'Penghasilan di atas ambang batas regulasi (>Rp600.000/kapita)',
    'Tidak memenuhi komponen kerentanan keluarga sesuai kriteria PKH',
    'Sudah terdaftar sebagai penerima bantuan sosial lain',
    'Data tidak sesuai dengan kondisi aktual di lapangan',
    'Termasuk kategori ASN/TNI/Polri/penerima pensiun (tidak berhak)',
    'Lainnya (isi manual)'
  ];
  showModal(`
    <h3 style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:12px;">Tolak Pengajuan</h3>
    <div class="form-group">
      <label>Pilih Alasan Penolakan</label>
      <select id="vf-alasan-pilihan" onchange="toggleAlasanManual(this.value)">
        ${alasanTemplate.map(a => `<option value="${a}">${a}</option>`).join('')}
      </select>
    </div>
    <div class="form-group" id="vf-manual-group" style="display:none;">
      <label>Tulis Alasan</label>
      <textarea id="vf-catatan-manual" rows="3" placeholder="Jelaskan alasan penolakan secara spesifik..."></textarea>
    </div>
    <button class="btn-primary" onclick="kirimVerifikasiTolak(${id_pengajuan})" style="width:100%;margin-top:8px;background:#dc2626;">
      <i class="ti ti-x"></i> Konfirmasi Penolakan
    </button>
  `);
}

function toggleAlasanManual(value) {
  const manualGroup = document.getElementById('vf-manual-group');
  if (value === 'Lainnya (isi manual)') {
    manualGroup.style.display = 'block';
  } else {
    manualGroup.style.display = 'none';
  }
}

async function kirimVerifikasiTolak(id_pengajuan) {
  const pilihan = document.getElementById('vf-alasan-pilihan').value;
  let catatan = pilihan;
  if (pilihan === 'Lainnya (isi manual)') {
    const manual = document.getElementById('vf-catatan-manual').value.trim();
    if (!manual) return showToast('Mohon isi alasan penolakan', 'error');
    catatan = manual;
  }
  closeModal();
  const res = await apiCall('/verifikasi','POST',{id_pengajuan, keputusan: 'Ditolak', catatan});
  showToast(res.message, res.success?'success':'error');
  loadAntrianVerifikasi();
}

async function kirimVerifikasiFinal(id_pengajuan, keputusan, catatan) {
  closeModal();
  const res = await apiCall('/verifikasi','POST',{id_pengajuan,keputusan,catatan});
  showToast(res.message, res.success?'success':'error');
  loadAntrianVerifikasi();
}

async function loadRiwayatVerifikasi() {
  const res = await apiCall('/verifikasi/riwayat');
  const content = document.getElementById('petugas-content');
  content.innerHTML = `
    <div class="page-header"><h2>Riwayat Verifikasi Saya</h2></div>
    <div class="card">
      ${res.data.length===0
        ? '<div style="text-align:center;padding:32px;color:#94a3b8;">Belum ada riwayat</div>'
        : `<div class="table-responsive"><table>
            <thead><tr><th>Warga</th><th>Bantuan</th><th>Keputusan</th><th>Catatan</th><th>Tanggal</th><th>TX ID</th></tr></thead>
            <tbody>
              ${res.data.map(v=>`
                <tr>
                  <td>${avatarCell(v.nama_warga, v.nik)}</td>
                  <td style="font-size:12px;font-weight:500;">${v.jenis_bantuan}</td>
                  <td>${getStatusBadge(v.keputusan)}</td>
                  <td style="font-size:12px;color:#64748b;">${escapeHtml(v.catatan)||'—'}</td>
                  <td style="font-size:12px;color:#64748b;">${formatDate(v.tanggal_verifikasi,true)}</td>
                  ${txIdCell(v.tx_id_blockchain)}
                </tr>`).join('')}
            </tbody>
          </table></div>
          ${mobileCardList(res.data.map(v=>`
            <div class="mobile-item" onclick="showDetailRiwayat('${escapeAttr(v.nama_warga)}','${escapeAttr(v.nik)}','${escapeAttr(v.jenis_bantuan)}','${escapeAttr(v.keputusan)}','${escapeAttr(v.tanggal_verifikasi)}','${escapeAttr(v.catatan||'')}','${escapeAttr(v.tx_id_blockchain||'')}')" style="cursor:pointer;">
              <div class="mobile-item-header">
                ${avatarCell(v.nama_warga, v.nik)}
                ${getStatusBadge(v.keputusan)}
              </div>
              <div class="mobile-item-body">
                <div class="mobile-item-row"><span class="key">Bantuan</span><span class="val">${v.jenis_bantuan}</span></div>
                <div class="mobile-item-row"><span class="key">Tanggal</span><span class="val">${formatDate(v.tanggal_verifikasi,true)}</span></div>
                ${v.catatan ? `<div class="mobile-item-row"><span class="key">Catatan</span><span class="val">${v.catatan}</span></div>` : ''}
              </div>
              ${v.tx_id_blockchain ? `<div class="mobile-item-tx"><i class="ti ti-link"></i>${v.tx_id_blockchain.substring(0,20)}...</div>` : ''}
            </div>`).join(''))}`}
    </div>`;
}

// ══════════════════════════════════════════
// PORTAL WARGA
// ══════════════════════════════════════════
async function loadPortalWarga() {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${buildMobileTopbar('Portal Warga')}
    <div class="app-layout">
      <aside class="sidebar" id="warga-sidebar">
        ${buildWargaSidebar('status')}
      </aside>
      <div class="main-area">
        ${buildTopbar('Status Pengajuan')}
        <main class="content" id="warga-content">
          <div class="loading"><div class="spinner"></div>Memuat...</div>
        </main>
      </div>
    </div>
    ${buildWargaBottomNav('status')}`;
  await loadStatusPengajuan();
}

function showWargaSection(section, e) {
  if (e) e.preventDefault();
  syncBottomNavActive(section);
  const sb = document.getElementById('warga-sidebar');
  if (sb) sb.innerHTML = buildWargaSidebar(section);
  const tb = document.querySelector('.topbar strong');
  const titles = {
    status:'Status Pengajuan', ajukan:'Ajukan Bantuan',
    riwayat:'Riwayat Penerimaan', konfirmasi:'Konfirmasi Penerimaan'
  };
  if (tb) tb.textContent = titles[section]||section;
  if (section==='status')     return loadStatusPengajuan();
  if (section==='ajukan')     return loadFormAjukan();
  if (section==='riwayat')    return loadRiwayatPenerimaan();
  if (section==='konfirmasi') return loadKonfirmasiPenerimaan();
}

// Pull to Refresh mobile
function initPullToRefresh(contentId, refreshFn) {
  if (window.innerWidth > 768) return;
  const el = document.getElementById(contentId);
  if (!el) return;
  const TRIGGER_THRESHOLD = 170;
  const SHOW_INDICATOR_AT = 60;
  const SCROLL_SETTLE_MS = 300;
  const MIN_DURATION_MS = 200;
  let startY = 0, startTime = 0, pulling = false, indicator = null;
  let lastScrollTime = 0;
  el.addEventListener('scroll', () => { lastScrollTime = Date.now(); }, { passive:true });
  el.addEventListener('touchstart', e => {
    const sudahDiam = (Date.now() - lastScrollTime) > SCROLL_SETTLE_MS;
    if (el.scrollTop === 0 && sudahDiam) { startY = e.touches[0].clientY; startTime = Date.now(); pulling = true; }
  }, { passive:true });
  el.addEventListener('touchmove', e => {
    if (!pulling) return;
    // Batalkan kalau user sudah scroll turun sedikit pun di tengah gestur (bukan murni tarik dari atas)
    if (el.scrollTop > 0) {
      pulling = false;
      if (indicator) { indicator.remove(); indicator = null; }
      return;
    }
    const diff = e.touches[0].clientY - startY;
    if (diff > SHOW_INDICATOR_AT && diff < 220) {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.style.cssText = 'position:fixed;top:120px;left:50%;transform:translateX(-50%);background:#0f172a;color:white;padding:8px 20px;border-radius:20px;font-size:12px;z-index:9998;';
        document.body.appendChild(indicator);
      }
      indicator.textContent = diff > TRIGGER_THRESHOLD ? '↑ Lepas untuk refresh' : '↓ Tarik untuk refresh';
    } else if (indicator) {
      indicator.remove(); indicator = null;
    }
  }, { passive:true });
  el.addEventListener('touchend', e => {
    if (!pulling) return;
    const diff = e.changedTouches[0].clientY - startY;
    const durasi = Date.now() - startTime;
    if (indicator) { indicator.remove(); indicator = null; }
    // Cuma trigger kalau gerakannya cukup lambat (tarikan sengaja), bukan sentakan/flick cepat
    if (diff > TRIGGER_THRESHOLD && durasi > MIN_DURATION_MS) { showToast('Memuat ulang...','info',1500); refreshFn(); }
    pulling = false; startY = 0;
  }, { passive:true });
}

async function loadStatusPengajuan() {
  const res = await apiCall(`/pengajuan/warga/${currentUser.id}`);
  const content = document.getElementById('warga-content');
  const tahapan = ['Diajukan','Verifikasi RT','Verifikasi RW','Verifikasi IPSM','Verifikasi Puskesos','Disetujui'];

  content.innerHTML = `
    <div class="page-header"><h2>Status Pengajuan</h2></div>
    ${res.data.length===0 ? `
      <div class="card" style="text-align:center;padding:48px;">
        <i class="ti ti-clipboard-list" style="font-size:40px;color:#94a3b8;display:block;margin-bottom:12px;"></i>
        <p style="color:#94a3b8;margin-bottom:16px;">Belum ada pengajuan bantuan sosial</p>
        <button class="btn-primary" onclick="showWargaSection('ajukan',null)" style="width:auto;padding:10px 24px;margin:0 auto;display:inline-flex;align-items:center;justify-content:center;gap:8px;">
          <i class="ti ti-plus"></i> Ajukan Sekarang
        </button>
      </div>` :
      res.data.map(p => `
        <div class="card">
          <div class="card-header">
            <h3>${p.jenis_bantuan}</h3>
            ${getStatusBadge(p.status_pengajuan)}
          </div>
          <div style="padding:0 18px 16px;">
            <p style="font-size:12px;color:#94a3b8;margin-bottom:12px;">
              <i class="ti ti-calendar" style="vertical-align:-2px;margin-right:4px;"></i>
              Diajukan: ${formatDate(p.tanggal_pengajuan)}
            </p>
            ${p.rekomendasi_sistem ? `
              <div id="saw-warga-${p.id_pengajuan}" style="margin-bottom:12px;"></div>` : ''}
            ${p.keterangan ? `
              <div style="background:#f8fafc;padding:10px 12px;border-radius:8px;margin-bottom:12px;border-left:3px solid #1d4ed8;font-size:13px;color:#374151;">
                <i class="ti ti-notes" style="vertical-align:-2px;margin-right:6px;color:#1d4ed8;"></i>${p.keterangan}
              </div>` : ''}
            <div class="timeline">
              ${tahapan.map((t,i) => {
                const idx = tahapan.indexOf(p.status_pengajuan);
                const isDisetujui = p.status_pengajuan === 'Disetujui';
                const isDone = i <= idx || isDisetujui;
                const isActive = (i === idx + 1) && !isDisetujui;
                return `<div class="timeline-item ${isDone?'done':''} ${isActive?'active':''}">
                  <div class="timeline-dot"></div>
                  <div class="timeline-label">${t}</div>
                </div>`;
              }).join('')}
              ${p.status_pengajuan==='Ditolak'?`
                <div class="timeline-item rejected">
                  <div class="timeline-dot"></div>
                  <div class="timeline-label" style="color:#dc2626;font-weight:600;">Ditolak</div>
                </div>`:''}
            </div>
            ${p.status_pengajuan==='Ditolak' && p.alasan_penolakan ? `
              <div style="background:#fef2f2;padding:10px 12px;border-radius:8px;margin-top:12px;border-left:3px solid #dc2626;font-size:13px;color:#7f1d1d;">
                <p style="font-weight:600;margin-bottom:4px;">
                  <i class="ti ti-x-circle" style="vertical-align:-2px;margin-right:4px;"></i>
                  Ditolak pada tahap ${p.tahap_penolakan || '-'}
                </p>
                <p>${p.alasan_penolakan}</p>
              </div>` : ''}
            ${p.tx_id_blockchain ? `
              <div style="margin-top:12px;padding:10px 12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
                <p style="font-size:10px;color:#94a3b8;margin-bottom:6px;display:flex;align-items:center;gap:4px;">
                  <i class="ti ti-link" style="font-size:12px;"></i> TX ID Blockchain
                </p>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="font-family:monospace;font-size:11px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.tx_id_blockchain}</span>
                  <button onclick="copyTxId('${p.tx_id_blockchain}')"
                    style="background:none;border:1px solid #e2e8f0;border-radius:4px;padding:2px 6px;cursor:pointer;flex-shrink:0;">
                    <i class="ti ti-copy" style="font-size:11px;color:#94a3b8;"></i>
                  </button>
                </div>
              </div>` : ''}
            ${p.status_pengajuan !== 'Disetujui' && p.status_pengajuan !== 'Ditolak' && p.status_pengajuan !== 'Tidak Memenuhi Syarat Dasar' ? `
            <div style="margin-top:12px;">
              <button class="btn-secondary" style="width:100%;justify-content:center;position:relative;" onclick="toggleChatPengajuan(${p.id_pengajuan})">
                <i class="ti ti-message-circle"></i> Chat dengan Petugas
                <span id="chat-unread-badge-warga-${p.id_pengajuan}" class="hidden" style="position:absolute;top:8px;right:18px;width:8px;height:8px;background:#dc2626;border-radius:50%;"></span>
              </button>
              <div id="chat-panel-${p.id_pengajuan}" class="hidden" style="margin-top:10px;border-radius:14px;overflow:hidden;background:#f8fafc;">
                <div id="chat-messages-${p.id_pengajuan}" style="height:260px;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:2px;"></div>
                <div style="display:flex;gap:8px;align-items:center;padding:10px;background:#fff;border-top:1px solid #f1f5f9;">
                  <input type="text" id="chat-input-${p.id_pengajuan}" placeholder="Tulis pesan..." maxlength="1000" style="flex:1;padding:10px 14px;border:1px solid #e2e8f0;border-radius:999px;font-size:13px;outline:none;background:#f8fafc;" onkeypress="if(event.key==='Enter') kirimPesanPengajuan(${p.id_pengajuan})">
                  <button onclick="kirimPesanPengajuan(${p.id_pengajuan})" style="background:#1d4ed8;color:#fff;border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
                    <i class="ti ti-send" style="font-size:14px;"></i>
                  </button>
                </div>
              </div>
            </div>` : ''}
          </div>
        </div>`).join('')}`;
  res.data.forEach(p => {
    const el = document.getElementById('saw-warga-' + p.id_pengajuan);
    if (el) el.innerHTML = renderKlasifikasi(p.rekomendasi_sistem);
  });
  initPullToRefresh('warga-content', loadStatusPengajuan);
}

async function toggleChatPengajuan(id_pengajuan) {
  const panel = document.getElementById('chat-panel-' + id_pengajuan);
  if (!panel) return;
  const isHidden = panel.classList.contains('hidden');
  if (isHidden) {
    panel.classList.remove('hidden');
    await loadPesanPengajuan(id_pengajuan);
    tandaiChatBadge(id_pengajuan, false);
  } else {
    panel.classList.add('hidden');
  }
}

async function loadPesanPengajuan(id_pengajuan) {
  const container = document.getElementById('chat-messages-' + id_pengajuan);
  if (!container) return;
  const res = await apiCall('/pesan/' + id_pengajuan);
  if (!res.success) {
    container.innerHTML = '<div style="margin:auto;color:#94a3b8;text-align:center;font-size:12px;">Gagal memuat pesan</div>';
    return;
  }
  const isWarga = currentUser.role === 'warga';
  const data = res.data || [];
  if (data.length === 0) {
    container.innerHTML = `<div style="margin:auto;text-align:center;color:#94a3b8;">
      <i class="ti ti-message-2" style="font-size:32px;display:block;margin-bottom:8px;opacity:0.5;"></i>
      <p style="font-size:12px;">Belum ada pesan.<br>Mulai percakapan sekarang.</p>
    </div>`;
    return;
  }
  container.innerHTML = data.map((m, i) => {
    const milikSaya = (isWarga && m.tipe_pengirim === 'warga') || (!isWarga && m.tipe_pengirim === 'petugas');
    const prev = data[i - 1];
    const sameAsPrev = prev && prev.tipe_pengirim === m.tipe_pengirim;
    const tailRadius = milikSaya
      ? (sameAsPrev ? '16px 4px 4px 16px' : '16px 16px 4px 16px')
      : (sameAsPrev ? '4px 16px 16px 4px' : '16px 16px 16px 4px');
    return `<div style="display:flex;justify-content:${milikSaya ? 'flex-end' : 'flex-start'};margin-top:${sameAsPrev ? '2px' : '10px'};">
      <div style="max-width:78%;">
        ${!sameAsPrev ? `<p style="font-size:10px;font-weight:600;color:#94a3b8;margin-bottom:3px;padding:0 4px;${milikSaya ? 'text-align:right;' : ''}">${escapeHtml(m.nama_pengirim)}</p>` : ''}
        <div style="background:${milikSaya ? '#1d4ed8' : '#fff'};color:${milikSaya ? '#fff' : '#1e293b'};padding:9px 13px;border-radius:${tailRadius};border:${milikSaya ? 'none' : '1px solid #e2e8f0'};box-shadow:0 1px 2px rgba(0,0,0,0.04);">
          <p style="font-size:13px;white-space:pre-wrap;word-break:break-word;line-height:1.4;">${escapeHtml(m.isi_pesan)}</p>
        </div>
        <p style="font-size:9px;color:#cbd5e1;margin-top:2px;padding:0 4px;${milikSaya ? 'text-align:right;' : ''}">${formatDate(m.created_at, true)}</p>
      </div>
    </div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

async function kirimPesanPengajuan(id_pengajuan) {
  const input = document.getElementById('chat-input-' + id_pengajuan);
  const isi = input.value.trim();
  if (!isi) return;
  const res = await apiCall('/pesan/' + id_pengajuan, 'POST', { isi_pesan: isi });
  if (res.success) {
    input.value = '';
    await loadPesanPengajuan(id_pengajuan);
  } else {
    showToast(res.message, 'error');
  }
}

const DAFTAR_PEKERJAAN = [
  'Buruh harian lepas', 'Buruh pabrik', 'Pedagang kaki lima', 'Pedagang/wiraswasta kecil',
  'Ojek online/konvensional', 'Sopir angkot/taksi', 'Tukang bangunan/kuli bangunan',
  'Pembantu rumah tangga', 'Tukang parkir', 'Pemulung', 'Penjahit', 'Tukang cuci/setrika',
  'Satpam/security', 'Karyawan swasta', 'Petani/buruh tani', 'Pengrajin/UMKM rumahan',
  'Ibu rumah tangga', 'Tidak bekerja/pengangguran', 'Pensiunan'
];

function filterPekerjaanDropdown() {
  const input = document.getElementById('aj-pekerjaan');
  const dropdown = document.getElementById('pekerjaan-dropdown');
  if (!input || !dropdown) return;
  const keyword = input.value.trim().toLowerCase();
  const hasil = keyword
    ? DAFTAR_PEKERJAAN.filter(p => p.toLowerCase().includes(keyword))
    : DAFTAR_PEKERJAAN;
  if (hasil.length === 0) {
    dropdown.classList.add('hidden');
    return;
  }
  dropdown.innerHTML = hasil.map(p => `
    <div style="padding:10px 14px;font-size:13px;cursor:pointer;border-bottom:1px solid #f1f5f9;"
      onmousedown="pilihPekerjaan('${escapeAttr(p)}')">${escapeHtml(p)}</div>
  `).join('');
  dropdown.classList.remove('hidden');
}

function pilihPekerjaan(nilai) {
  const input = document.getElementById('aj-pekerjaan');
  const dropdown = document.getElementById('pekerjaan-dropdown');
  if (input) input.value = nilai;
  if (dropdown) dropdown.classList.add('hidden');
}

document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('pekerjaan-dropdown');
  const input = document.getElementById('aj-pekerjaan');
  if (dropdown && input && e.target !== input && !dropdown.contains(e.target)) {
    dropdown.classList.add('hidden');
  }
});

function formatRupiahInput(input) {
  let raw = input.value.replace(/\D/g, '');
  if (raw.length > 12) raw = raw.slice(0, 12);
  input.dataset.rawValue = raw;
  input.value = raw ? Number(raw).toLocaleString('id-ID') : '';
}

async function loadFormAjukan() {
  const content = document.getElementById('warga-content');
  content.innerHTML = `
    <div class="page-header"><h2>Ajukan Bantuan Sosial</h2></div>
    <div class="card rek-form" style="max-width:520px;margin:0 auto;">
      <div style="padding:20px;">
        <div style="background:#eff6ff;border-left:3px solid #1d4ed8;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#1e40af;">
          <i class="ti ti-info-circle" style="vertical-align:-2px;margin-right:6px;"></i>
          Sistem akan otomatis merekomendasikan jenis bantuan yang sesuai berdasarkan
          kondisi keluarga Anda. Pengajuan akan diverifikasi: RT/RW \u2192 IPSM \u2192 Puskesos \u2192 Admin Kelurahan.
        </div>

        <div class="form-group">
          <label>Penghasilan Bulanan (Rp)</label>
          <input type="text" id="aj-penghasilan" inputmode="numeric" placeholder="Contoh: 1.500.000" oninput="formatRupiahInput(this)">
          <span style="font-size:11px;color:#94a3b8;display:block;margin-top:4px;">Masukkan total penghasilan seluruh anggota keluarga per bulan</span>
        </div>

        <div class="form-group">
          <label>Jumlah Anggota Keluarga</label>
          <input type="number" id="aj-jumlah-keluarga" min="1" value="1">
        </div>

        <div class="form-group">
          <label>Pekerjaan</label>
          <div style="position:relative;">
            <input type="text" id="aj-pekerjaan" placeholder="Pilih atau ketik sendiri" autocomplete="off"
              oninput="filterPekerjaanDropdown()" onfocus="filterPekerjaanDropdown()">
            <div id="pekerjaan-dropdown" class="hidden" style="position:absolute;top:100%;left:0;right:0;z-index:50;background:#fff;border:1px solid #e2e8f0;border-radius:8px;margin-top:4px;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.08);"></div>
          </div>
        </div>

        <div class="form-group">
          <span class="rek-section-label">Foto KTP</span>
          <div class="rek-photo-box">
            <div id="aj-foto-ktp-preview"><span class="rek-photo-placeholder"><i class="ti ti-id-badge-2"></i> Pastikan NIK dan nama terbaca jelas</span></div>
          </div>
          <div class="rek-photo-actions">
            <button type="button" class="btn-secondary" onclick="document.getElementById('aj-foto-ktp-kamera').click()"><i class="ti ti-camera"></i> Ambil Foto</button>
            <button type="button" class="btn-secondary" onclick="document.getElementById('aj-foto-ktp-galeri').click()"><i class="ti ti-photo"></i> Pilih dari Galeri</button>
          </div>
          <input type="file" id="aj-foto-ktp-kamera" accept="image/*" capture="environment" style="display:none" onchange="handleFotoUpload(this, 'aj-foto-ktp-preview', 'KTP')">
          <input type="file" id="aj-foto-ktp-galeri" accept="image/*" style="display:none" onchange="handleFotoUpload(this, 'aj-foto-ktp-preview', 'KTP')">
        </div>

        <div class="form-group">
          <span class="rek-section-label">Foto Rumah (tampak depan)</span>
          <div class="rek-photo-box">
            <div id="aj-foto-rumah-preview"><span class="rek-photo-placeholder"><i class="ti ti-home"></i> Foto seluruh bangunan tampak depan</span></div>
          </div>
          <div class="rek-photo-actions">
            <button type="button" class="btn-secondary" onclick="document.getElementById('aj-foto-rumah-kamera').click()"><i class="ti ti-camera"></i> Ambil Foto</button>
            <button type="button" class="btn-secondary" onclick="document.getElementById('aj-foto-rumah-galeri').click()"><i class="ti ti-photo"></i> Pilih dari Galeri</button>
          </div>
          <input type="file" id="aj-foto-rumah-kamera" accept="image/*" capture="environment" style="display:none" onchange="handleFotoUpload(this, 'aj-foto-rumah-preview', 'Rumah')">
          <input type="file" id="aj-foto-rumah-galeri" accept="image/*" style="display:none" onchange="handleFotoUpload(this, 'aj-foto-rumah-preview', 'Rumah')">
        </div>

        <div class="form-group">
          <span class="rek-section-label">Status Khusus (centang jika sesuai)</span>
          <div class="rek-checkbox-row">
            <input type="checkbox" id="aj-asn">
            <span>Saya/anggota keluarga ASN, TNI, atau Polri</span>
          </div>
          <div class="rek-checkbox-row">
            <input type="checkbox" id="aj-pensiunan">
            <span>Penerima gaji pensiun bulanan dari negara</span>
          </div>
          <div class="rek-checkbox-row">
            <input type="checkbox" id="aj-bansos-lain">
            <span>Sudah menerima bantuan lain (Kartu Prakerja, dll)</span>
          </div>
        </div>

        <div class="form-group">
          <span class="rek-section-label">Kondisi Keluarga (centang yang sesuai)</span>
          <div class="rek-checkbox-row">
            <input type="checkbox" id="aj-balita">
            <span>Ada balita (usia 0\u20136 tahun)</span>
          </div>
          <div class="rek-checkbox-row">
            <input type="checkbox" id="aj-ibu-hamil">
            <span>Ada ibu hamil/nifas</span>
          </div>
          <div class="rek-checkbox-row">
            <input type="checkbox" id="aj-anak-sekolah">
            <span>Ada anak usia sekolah (SD/SMP/SMA)</span>
          </div>
          <div class="rek-checkbox-row">
            <input type="checkbox" id="aj-lansia">
            <span>Ada lansia (70 tahun ke atas)</span>
          </div>
          <div class="rek-checkbox-row">
            <input type="checkbox" id="aj-disabilitas">
            <span>Ada anggota keluarga disabilitas</span>
          </div>
          <div class="rek-checkbox-row">
            <input type="checkbox" id="aj-kks">
            <span>Sudah punya Kartu Keluarga Sejahtera (KKS)</span>
          </div>
          <div class="rek-checkbox-row">
            <input type="checkbox" id="aj-usaha-mikro">
            <span>Punya usaha mikro/kecil</span>
          </div>
        </div>

        <div class="form-group">
          <div class="rek-checkbox-row">
            <input type="checkbox" id="aj-darurat" onchange="toggleKeteranganDarurat()">
            <span>Sedang dalam kondisi darurat ekonomi (bencana, PHK mendadak, dll)</span>
          </div>
          <div id="wrapper-aj-darurat" style="display:none;margin-top:8px;">
            <textarea id="aj-keterangan-darurat" rows="2" placeholder="Jelaskan kondisi darurat..." style="width:100%;"></textarea>
          </div>
        </div>

        <div class="form-group">
          <label>Keterangan Tambahan (opsional)</label>
          <textarea id="aj-keterangan" rows="3" placeholder="Informasi tambahan jika diperlukan..." style="width:100%;"></textarea>
        </div>

        <button class="btn-primary" onclick="submitPengajuan()">
          <i class="ti ti-send"></i> Ajukan Bantuan
        </button>
        <div id="aj-message" class="message"></div>
      </div>
    </div>`;
}

function toggleKeteranganDarurat() {
  const checked = document.getElementById('aj-darurat').checked;
  document.getElementById('wrapper-aj-darurat').style.display = checked ? 'block' : 'none';
}

function handleFotoUpload(input, previewId, label) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result;
    const baseId = input.id.replace('-kamera', '').replace('-galeri', '');
    const kameraInput = document.getElementById(baseId + '-kamera');
    const galeriInput = document.getElementById(baseId + '-galeri');
    if (kameraInput) kameraInput.dataset.base64 = base64;
    if (galeriInput) galeriInput.dataset.base64 = base64;
    document.getElementById(previewId).innerHTML = `
      <img src="${base64}" alt="Foto ${label}">
      <button type="button" class="rek-photo-retake" onclick="event.stopPropagation(); document.getElementById('${baseId}-kamera').click()">
        <i class="ti ti-refresh"></i> Ambil Ulang
      </button>`;
  };
  reader.readAsDataURL(file);
}

async function submitPengajuan() {
  const penghasilanInput = document.getElementById('aj-penghasilan');
  const penghasilan_bulanan = Number(penghasilanInput.dataset.rawValue || penghasilanInput.value.replace(/\D/g, ''));
  const jumlah_anggota_keluarga = Number(document.getElementById('aj-jumlah-keluarga').value);

  if (!penghasilan_bulanan && penghasilan_bulanan !== 0) {
    return showMessage('aj-message', 'Penghasilan bulanan wajib diisi', 'error');
  }
  if (!jumlah_anggota_keluarga || jumlah_anggota_keluarga < 1) {
    return showMessage('aj-message', 'Jumlah anggota keluarga wajib diisi', 'error');
  }

  const fotoKtpBase64 = document.getElementById('aj-foto-ktp-kamera').dataset.base64
    || document.getElementById('aj-foto-ktp-galeri').dataset.base64;
  const fotoRumahBase64 = document.getElementById('aj-foto-rumah-kamera').dataset.base64
    || document.getElementById('aj-foto-rumah-galeri').dataset.base64;

  if (!fotoKtpBase64) {
    return showMessage('aj-message', 'Foto KTP wajib diunggah', 'error');
  }
  if (!fotoRumahBase64) {
    return showMessage('aj-message', 'Foto rumah wajib diunggah', 'error');
  }

  const payload = {
    keterangan: document.getElementById('aj-keterangan').value,
    penghasilan_bulanan,
    jumlah_anggota_keluarga,
    pekerjaan: document.getElementById('aj-pekerjaan').value,
    foto_ktp: fotoKtpBase64,
    foto_rumah: fotoRumahBase64,
    status_asn_tni_polri: document.getElementById('aj-asn').checked,
    status_pensiunan: document.getElementById('aj-pensiunan').checked,
    penerima_bansos_lain: document.getElementById('aj-bansos-lain').checked,
    ada_balita: document.getElementById('aj-balita').checked,
    ada_ibu_hamil: document.getElementById('aj-ibu-hamil').checked,
    ada_anak_sekolah: document.getElementById('aj-anak-sekolah').checked,
    ada_lansia: document.getElementById('aj-lansia').checked,
    ada_disabilitas: document.getElementById('aj-disabilitas').checked,
    punya_kks: document.getElementById('aj-kks').checked,
    punya_usaha_mikro: document.getElementById('aj-usaha-mikro').checked,
    kondisi_darurat: document.getElementById('aj-darurat').checked,
    keterangan_kondisi_darurat: document.getElementById('aj-keterangan-darurat').value,
  };

  const res = await apiCall('/pengajuan', 'POST', payload);

  if (res.success) {
    const rekomendasi = res.rekomendasi && res.rekomendasi.kategori
      ? res.rekomendasi.kategori
      : null;
    const pesan = rekomendasi
      ? `Pengajuan berhasil! Sistem merekomendasikan: ${rekomendasi}. Menunggu verifikasi RT.`
      : 'Pengajuan berhasil diajukan dan dicatat di blockchain!';
    showToast(pesan, 'success', 5000);
    setTimeout(loadStatusPengajuan, 1000);
  } else {
    showMessage('aj-message', res.message, 'error');
  }
}

async function loadRiwayatPenerimaan() {
  const content = document.getElementById('warga-content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div>Memuat...</div>';
  const res = await apiCall(`/penerima/riwayat/${currentUser.id}`);
  const data = res.data || [];
  const terbaru = data[0] || null;
  content.innerHTML = `
    <div class="page-header"><h2>Riwayat Penerimaan</h2></div>
    ${terbaru ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin-bottom:16px;display:flex;align-items:center;gap:14px;">
      <i class="ti ti-circle-check" style="font-size:36px;color:#16a34a;flex-shrink:0;"></i>
      <div>
        <p style="font-weight:700;color:#15803d;font-size:14px;margin-bottom:2px;">Bantuan Terakhir Diterima</p>
        <p style="font-size:13px;color:#15803d;">${terbaru.jenis_bantuan} · Periode ${terbaru.periode_bantuan}</p>
        <p style="font-size:12px;color:#64748b;margin-top:2px;">
          <i class="ti ti-calendar" style="vertical-align:-2px;margin-right:4px;"></i>
          ${formatDate(terbaru.tanggal_ambil, true)}
        </p>
      </div>
    </div>` : ''}
    <div style="background:#eff6ff;border-left:3px solid #1d4ed8;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#1e40af;">
      <i class="ti ti-link" style="vertical-align:-2px;margin-right:6px;"></i>
      Seluruh riwayat tercatat permanen di ledger blockchain Hyperledger Fabric.
    </div>
    ${data.length===0 ? `
      <div class="card" style="text-align:center;padding:40px;">
        <i class="ti ti-inbox" style="font-size:40px;color:#94a3b8;display:block;margin-bottom:12px;"></i>
        <p style="color:#94a3b8;">Belum ada riwayat penerimaan bantuan.</p>
        <p style="font-size:12px;color:#cbd5e1;margin-top:8px;">Riwayat akan muncul setelah Konfirmasi Penerimaan berhasil dilakukan.</p>
      </div>` :
      `<div class="card">
        <div class="card-header">
          <h3>Riwayat Pengambilan Bantuan</h3>
          <span style="font-size:11px;color:#94a3b8;">${data.length} transaksi</span>
        </div>
        <div class="table-responsive"><table>
          <thead><tr><th>Bantuan</th><th>Periode</th><th>Tanggal Ambil</th><th>Cara Verif</th><th>Status</th><th>TX ID</th></tr></thead>
          <tbody>
            ${data.map(k=>`
              <tr>
                <td style="font-size:12px;font-weight:500;">${k.jenis_bantuan}</td>
                <td><span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;">${k.periode_bantuan}</span></td>
                <td style="font-size:12px;color:#64748b;">${formatDate(k.tanggal_ambil,true)}</td>
                <td style="font-size:12px;color:#64748b;">${k.nama_petugas ? '<i class="ti ti-shield-check" style="font-size:11px;"></i> Via Petugas' : '<i class="ti ti-user-check" style="font-size:11px;"></i> Mandiri (Warga)'}</td>
                <td><span class="badge badge-success"><i class="ti ti-circle-check" style="font-size:10px;"></i> ${k.status_verifikasi}</span></td>
                ${txIdCell(k.tx_id_blockchain)}
              </tr>`).join('')}
          </tbody>
        </table></div>
        <div style="padding:12px 16px;background:#fafafa;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8;display:flex;align-items:center;gap:6px;">
          <i class="ti ti-info-circle" style="font-size:14px;"></i>
          Untuk periode bantuan berikutnya, lakukan konfirmasi penerimaan melalui menu Konfirmasi Penerimaan.
        </div>
      </div>`}`;
}

// ══════════════════════════════════════════
// AUTO LOGIN
// ══════════════════════════════════════════
window.onload = () => {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  if (token && user) {
    currentToken = token;
    currentUser = JSON.parse(user);
    if (currentUser.role === 'warga') {
      loadPortalWarga();
      startNotifPolling();
      setTimeout(() => showToast(`Selamat datang kembali, ${currentUser.nama}!`, 'info', 3000), 500);
    } else {
      loadDashboard();
      startNotifPolling();
      setTimeout(() => showToast(`Selamat datang kembali, ${currentUser.nama}!`, 'success', 3000), 500);
    }
  }
};

async function loadKonfirmasiPenerimaan() {
  const res = await apiCall('/penerima/cek-status/' + currentUser.id);
  const content = document.getElementById('warga-content');
  if (!res.success || !res.data) {
    content.innerHTML = `
      <div class="page-header"><h2>Konfirmasi Penerimaan</h2></div>
      <div class="card" style="text-align:center;padding:48px;">
        <i class="ti ti-clock" style="font-size:40px;color:#94a3b8;display:block;margin-bottom:12px;"></i>
        <h3 style="color:#374151;margin-bottom:8px;">Belum Ditetapkan sebagai Penerima</h3>
        <p style="color:#94a3b8;font-size:13px;">Pastikan pengajuan Anda sudah disetujui oleh Admin Kelurahan.</p>
      </div>`;
    return;
  }
  const p = res.data;
  content.innerHTML = `
    <div class="page-header"><h2>Konfirmasi Penerimaan</h2></div>
    <div class="card">
      <div class="card-header">
        <h3>${p.jenis_bantuan || 'Bantuan Sosial'}</h3>
        <span style="background:#16a34a;color:#fff;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;">Aktif</span>
      </div>
      <div style="padding:0 18px 18px;">
        <p style="font-size:12px;color:#94a3b8;margin-bottom:16px;">Konfirmasi penerimaan bantuan untuk periode ${new Date().toLocaleDateString('id-ID',{month:'long',year:'numeric'})}</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:140px;">Nama</td><td style="font-size:13px;font-weight:600;">${currentUser.nama}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">NIK</td><td style="font-size:13px;">${currentUser.nik}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Jenis Bantuan</td><td style="font-size:13px;font-weight:600;">${p.jenis_bantuan||'-'}</td></tr>
        </table>
        <div style="padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:12px;">
          <p style="color:#15803d;font-size:13px;margin-bottom:12px;"><i class="ti ti-info-circle"></i> Klik tombol di bawah untuk mengkonfirmasi penerimaan bantuan periode ini. Konfirmasi akan dicatat secara permanen di blockchain.</p>
          <button class="btn-success" onclick="submitKonfirmasiManual(${p.id_penerima})" style="width:100%;padding:12px;font-size:14px;">
            <i class="ti ti-check"></i> Konfirmasi Penerimaan Bantuan
          </button>
        </div>
      </div>
    </div>`;
}

async function submitKonfirmasiManual(id_penerima) {
  const res = await apiCall('/penerima/warga/konfirmasi', 'POST', { id_penerima });
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) {
    addNotif('ti-circle-check', 'Konfirmasi Berhasil',
      `Bantuan ${res.jenis_bantuan || ''} periode ${res.periode_bantuan || ''} telah dikonfirmasi. TX ID: ${(res.tx_id_blockchain || '').substring(0,16)}...`,
      'success');
    loadKonfirmasiPenerimaan();
  }
}

// ══════════════════════════════════════════
// REGISTRASI AKUN WARGA
// ══════════════════════════════════════════
function showRegistrasiWarga() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5rem 1rem;background:#f0ede8;">

      <div style="width:100%;max-width:480px;display:flex;align-items:center;gap:8px;padding:8px 14px;background:#ecfdf5;border-left:3px solid #16a34a;border-radius:0 8px 8px 0;margin-bottom:1.25rem;">
        <i class="ti ti-lock" style="font-size:15px;color:#15803d;flex-shrink:0;"></i>
        <span style="font-size:12px;color:#15803d;font-weight:500;">Portal resmi Kelurahan Cipedes &nbsp;·&nbsp; Koneksi aman &nbsp;·&nbsp; Enkripsi SHA-256</span>
      </div>

      <div style="width:100%;max-width:480px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.06);">

        <div style="padding:1.5rem 1.75rem 1.25rem;border-bottom:1px solid #f1f5f9;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:1rem;">
            <div style="width:44px;height:44px;background:#eff6ff;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i class="ti ti-user-plus" style="font-size:22px;color:#1d4ed8;"></i>
            </div>
            <div>
              <h1 style="font-size:15px;font-weight:600;color:#1e293b;margin:0;">Daftar Akun Warga</h1>
              <p style="font-size:11px;color:#64748b;margin:2px 0 0;">Kelurahan Cipedes &nbsp;·&nbsp; Kecamatan Sukajadi</p>
            </div>
          </div>
          <div style="display:flex;align-items:center;" id="reg-step-indicator">
            <div id="si-1" style="display:flex;align-items:center;gap:6px;">
              <div style="width:24px;height:24px;border-radius:50%;background:#1d4ed8;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">1</div>
              <span style="font-size:12px;font-weight:500;color:#1d4ed8;">Verifikasi NIK</span>
            </div>
            <div style="flex:1;height:1px;background:#e2e8f0;margin:0 8px;"></div>
            <div id="si-2" style="display:flex;align-items:center;gap:6px;">
              <div style="width:24px;height:24px;border-radius:50%;background:#e2e8f0;color:#94a3b8;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">2</div>
              <span style="font-size:12px;color:#94a3b8;">Kode OTP</span>
            </div>
            <div style="flex:1;height:1px;background:#e2e8f0;margin:0 8px;"></div>
            <div id="si-3" style="display:flex;align-items:center;gap:6px;">
              <div style="width:24px;height:24px;border-radius:50%;background:#e2e8f0;color:#94a3b8;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">3</div>
              <span style="font-size:12px;color:#94a3b8;">Buat Password</span>
            </div>
          </div>
        </div>

        <!-- STEP 1 -->
        <div id="reg-step-1" style="padding:1.5rem 1.75rem;">
          <div style="margin-bottom:1.25rem;">
            <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:5px;">NIK (16 digit)</label>
            <span style="font-size:12px;color:#6b7280;margin-bottom:6px;display:block;">Masukkan NIK sesuai KTP. NIK harus sudah terdaftar di kelurahan.</span>
            <input type="text" id="reg-nik" placeholder="3273XXXXXXXXXXXX" maxlength="16"
              inputmode="numeric" pattern="[0-9]*"
              oninput="this.value=this.value.replace(/[^0-9]/g,'')"
              onkeypress="if(event.key==='Enter') kirimOtpRegistrasi()"
              style="width:100%;padding:10px 14px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:15px;font-family:'Courier New',monospace;letter-spacing:0.06em;background:#fff;color:#1e293b;outline:none;">
          </div>
          <div id="reg-message" class="message" style="margin-bottom:1rem;"></div>
          <button onclick="kirimOtpRegistrasi()"
            style="width:100%;padding:12px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:10px;">
            <i class="ti ti-send" style="font-size:17px;"></i> Kirim OTP ke HP
          </button>
          <button onclick="location.reload()"
            style="width:100%;padding:11px;background:transparent;color:#374151;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;">
            <i class="ti ti-arrow-left" style="font-size:15px;"></i> Kembali ke Login
          </button>
        </div>

        <!-- STEP 2 -->
        <div id="reg-step-2" style="padding:1.5rem 1.75rem;display:none;">
          <div id="reg-otp-info" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 14px;margin-bottom:1.25rem;font-size:13px;color:#15803d;"></div>
          <div style="margin-bottom:1.25rem;">
            <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:5px;">Kode OTP (6 digit)</label>
            <input type="tel" id="reg-otp" placeholder="• • • • • •" maxlength="6"
              inputmode="numeric" pattern="[0-9]*"
              oninput="this.value=this.value.replace(/[^0-9]/g,'')"
              onkeypress="if(event.key==='Enter') verifikasiOtpRegistrasi()"
              style="width:100%;padding:12px 14px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:22px;font-family:'Courier New',monospace;letter-spacing:0.5rem;text-align:center;background:#fff;color:#1e293b;outline:none;">
          </div>
          <div id="reg-message-2" class="message" style="margin-bottom:1rem;"></div>
          <button onclick="verifikasiOtpRegistrasi()"
            style="width:100%;padding:12px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:10px;">
            <i class="ti ti-circle-check" style="font-size:17px;"></i> Verifikasi OTP
          </button>
          <button onclick="document.getElementById('reg-step-1').style.display='block';document.getElementById('reg-step-2').style.display='none';regUpdateStep(1);"
            style="width:100%;padding:11px;background:transparent;color:#374151;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;">
            <i class="ti ti-refresh" style="font-size:15px;"></i> Kirim Ulang OTP
          </button>
          <button onclick="location.reload()"
            style="width:100%;padding:10px;background:transparent;color:#94a3b8;border:none;border-radius:8px;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;margin-top:4px;">
            <i class="ti ti-arrow-left" style="font-size:14px;"></i> Kembali ke Login
          </button>
        </div>

        <!-- STEP 3 -->
        <div id="reg-step-3" style="padding:1.5rem 1.75rem;display:none;">
          <div id="reg-info-warga" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 14px;margin-bottom:1.25rem;font-size:13px;color:#15803d;"></div>
          <div style="margin-bottom:1rem;">
            <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:5px;">Password Baru</label>
            <div style="position:relative;">
              <input type="password" id="reg-password" placeholder="Minimal 6 karakter"
                onkeypress="if(event.key==='Enter') document.getElementById('reg-password-confirm').focus();"
                style="width:100%;padding:10px 40px 10px 14px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:15px;background:#fff;color:#1e293b;outline:none;">
              <button type="button" onclick="togglePassword('reg-password',this)"
                style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#9ca3af;font-size:16px;display:flex;align-items:center;">
                <i class="ti ti-eye"></i>
              </button>
            </div>
          </div>
          <div style="margin-bottom:1.25rem;">
            <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:5px;">Konfirmasi Password</label>
            <div style="position:relative;">
              <input type="password" id="reg-password-confirm" placeholder="Ulangi password"
                onkeypress="if(event.key==='Enter') submitRegistrasi();"
                style="width:100%;padding:10px 40px 10px 14px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:15px;background:#fff;color:#1e293b;outline:none;">
              <button type="button" onclick="togglePassword('reg-password-confirm',this)"
                style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#9ca3af;font-size:16px;display:flex;align-items:center;">
                <i class="ti ti-eye"></i>
              </button>
            </div>
          </div>
          <div id="reg-message-3" class="message" style="margin-bottom:1rem;"></div>
          <button onclick="submitRegistrasi()"
            style="width:100%;padding:12px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
            <i class="ti ti-circle-check" style="font-size:17px;"></i> Daftar Akun
          </button>
          <button onclick="location.reload()"
            style="width:100%;padding:10px;background:transparent;color:#94a3b8;border:none;border-radius:8px;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;margin-top:4px;">
            <i class="ti ti-arrow-left" style="font-size:14px;"></i> Kembali ke Login
          </button>
        </div>

        <div style="padding:0.875rem 1.75rem;border-top:1px solid #f1f5f9;background:#fafafa;text-align:center;">
          <span style="font-size:11px;color:#94a3b8;">Sudah punya akun? </span>
          <a onclick="location.reload()" href="#" style="font-size:11px;color:#1d4ed8;font-weight:500;text-decoration:none;">Masuk di sini</a>
        </div>
      </div>

      <p style="width:100%;max-width:480px;text-align:center;margin-top:1rem;font-size:11px;color:#a3a098;line-height:1.6;">
        Pendaftaran hanya untuk warga Kelurahan Cipedes yang NIK-nya sudah terdaftar.<br>
        Mengalami masalah? Hubungi petugas kelurahan setempat.
      </p>
    </div>`;
}

function regUpdateStep(step) {
  [1,2,3].forEach(i => {
    const si = document.getElementById('si-' + i);
    if (!si) return;
    const dot = si.querySelector('div');
    const label = si.querySelector('span');
    if (i < step) {
      dot.style.background = '#16a34a'; dot.style.color = '#fff';
      dot.innerHTML = '<i class="ti ti-check" style="font-size:12px;"></i>';
      label.style.color = '#15803d';
    } else if (i === step) {
      dot.style.background = '#1d4ed8'; dot.style.color = '#fff';
      dot.textContent = i;
      label.style.color = '#1d4ed8'; label.style.fontWeight = '500';
    } else {
      dot.style.background = '#e2e8f0'; dot.style.color = '#94a3b8';
      dot.textContent = i; label.style.color = '#94a3b8';
    }
  });
}

async function kirimOtpRegistrasi() {
  const nik = document.getElementById('reg-nik').value.trim();
  if (nik.length !== 16) return showMessage('reg-message', 'NIK harus 16 digit', 'error');
  try {
    showMessage('reg-message', '⏳ Mengirim OTP...', 'info');
    const res = await apiCall('/auth/warga/generate-otp', 'POST', { nik });
    if (res.success) {
      regNik = nik;
      document.getElementById('reg-step-1').style.display = 'none';
      document.getElementById('reg-step-2').style.display = 'block';
      regUpdateStep(2);
      document.getElementById('reg-otp-info').innerHTML = `
        <p style="margin:0;color:#0F6E56"><strong>✅ OTP Terkirim</strong></p>
        <p style="margin:0.25rem 0 0">Nama: <strong>${escapeHtml(res.nama_warga)}</strong></p>
        <p style="margin:0.25rem 0 0">Kode OTP dikirim ke: <strong>${escapeHtml(res.no_hp_masked)}</strong></p>
        <p style="margin:0.25rem 0 0;color:#856404;font-size:0.85rem">⏱️ Berlaku 5 menit</p>
        ${res.otp_simulasi ? `<p style="margin:0.5rem 0 0;padding:0.5rem;background:#fff3cd;border-radius:4px;font-size:0.85rem">
          🔔 <strong>Mode Simulasi:</strong> OTP: <strong style="font-size:1.2rem;letter-spacing:0.2rem">${res.otp_simulasi}</strong>
        </p>` : ''}`;
    } else { showMessage('reg-message', res.message, 'error'); }
  } catch { showMessage('reg-message', 'Gagal terhubung ke server', 'error'); }
}

async function verifikasiOtpRegistrasi() {
  const otp = document.getElementById('reg-otp').value.trim();
  if (otp.length !== 6) return showMessage('reg-message-2', 'OTP harus 6 digit', 'error');
  try {
    showMessage('reg-message-2', '⏳ Memverifikasi OTP...', 'info');
    const res = await apiCall('/auth/warga/verify-otp', 'POST', { nik: regNik, otp });
    if (res.success) {
      document.getElementById('reg-step-2').style.display = 'none';
      document.getElementById('reg-step-3').style.display = 'block';
      regUpdateStep(3);
      document.getElementById('reg-info-warga').innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <i class="ti ti-circle-check" style="font-size:16px;color:#15803d;"></i>
          <strong style="color:#15803d;">OTP Terverifikasi</strong>
        </div>
        <p style="margin:0.25rem 0 0;font-size:13px;">Nama: <strong>${escapeHtml(res.data.nama_warga)}</strong></p>
        <p style="margin:0.25rem 0 0;font-size:13px;">NIK: ${escapeHtml(res.data.nik)}</p>
        <p style="margin:0.25rem 0 0;font-size:13px;">Alamat: ${escapeHtml(res.data.alamat)||'—'}</p>`;
    } else { showMessage('reg-message-2', res.message, 'error'); }
  } catch { showMessage('reg-message-2', 'Gagal terhubung ke server', 'error'); }
}

let regNik = null;


async function submitRegistrasi() {
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-password-confirm').value;
  if (!password || password.length < 6) return showMessage('reg-message-3', 'Password minimal 6 karakter', 'error');
  if (password !== confirm) return showMessage('reg-message-3', 'Password tidak cocok', 'error');
  showMessage('reg-message-3', '⏳ Mendaftarkan akun...', 'info');
  try {
    const res = await apiCall('/auth/warga/register', 'POST', { nik: regNik, password });
    if (res.success) {
      document.getElementById('app').innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f0ede8;padding:1.5rem;">
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:2rem;max-width:400px;width:100%;text-align:center;box-shadow:0 2px 16px rgba(0,0,0,0.06);">
            <i class="ti ti-circle-check" style="font-size:56px;color:#16a34a;display:block;margin-bottom:12px;"></i>
            <h2 style="color:#15803d;margin-bottom:8px;">Akun Berhasil Dibuat!</h2>
            <p style="color:#374151;margin-bottom:6px;">Selamat datang, <strong>${escapeHtml(res.nama_warga)}</strong></p>
            <p style="font-size:13px;color:#64748b;margin-bottom:12px;">Akun Anda telah diverifikasi dan terdaftar di blockchain.</p>
            ${res.tx_id_blockchain ? `
              <div style="background:#f8fafc;padding:8px 12px;border-radius:6px;margin-bottom:12px;font-family:monospace;font-size:10px;color:#94a3b8;word-break:break-all;">
                TX ID: ${res.tx_id_blockchain}
              </div>` : ''}
            <button class="btn-primary" onclick="location.reload()">
              <i class="ti ti-login"></i> Login Sekarang
            </button>
          </div>
        </div>`;
    } else { showMessage('reg-message-3', res.message, 'error'); }
  } catch { showMessage('reg-message-3', 'Gagal terhubung ke server', 'error'); }
}



// ══════════════════════════════════════════
// EDIT PROFIL
// ══════════════════════════════════════════
async function showEditProfil() {
  const isWarga = currentUser.role === 'warga';
  const endpoint = isWarga ? '/auth/warga/profil' : '/auth/petugas/profil';
  const res = await apiCall(endpoint);
  const d = res.data || {};
  const fotoProfil = d.foto_profil || null;
  const avCls = getAvColor(currentUser.nama);
  const init = getInitials(currentUser.nama);

  showModal(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <h3 style="font-size:15px;font-weight:700;color:#0f172a;">Edit Profil</h3>
      <button onclick="closeModal()" style="background:none;border:none;cursor:pointer;font-size:20px;color:#94a3b8;">✕</button>
    </div>

    <!-- Foto profil -->
    <div style="text-align:center;margin-bottom:20px;">
      <div style="position:relative;display:inline-block;">
        <div id="profil-avatar" style="width:80px;height:80px;border-radius:50%;overflow:hidden;border:3px solid #e2e8f0;margin:0 auto;">
          ${fotoProfil
            ? `<img src="${fotoProfil}" style="width:100%;height:100%;object-fit:cover;">`
            : `<div class="${avCls}" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff;">${init}</div>`}
        </div>
        <label for="foto-upload" style="position:absolute;bottom:0;right:0;width:26px;height:26px;background:#1d4ed8;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px solid #fff;">
          <i class="ti ti-camera" style="font-size:13px;color:#fff;"></i>
        </label>
        <input type="file" id="foto-upload" accept="image/*" style="display:none;" onchange="previewFotoProfil(this)">
      </div>
      <p style="font-size:12px;color:#94a3b8;margin-top:8px;">Ketuk kamera untuk ganti foto</p>
    </div>

    <!-- Info -->
    <div style="background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
        <span style="color:#64748b;">Nama</span>
        <span style="font-weight:600;">${escapeHtml(isWarga ? d.nama_warga : d.nama_petugas)}</span>
      </div>
      ${isWarga ? `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
        <span style="color:#64748b;">NIK</span>
        <span style="font-family:monospace;">${escapeHtml(d.nik)}</span>
      </div>` : `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
        <span style="color:#64748b;">Username</span>
        <span style="font-family:monospace;">${escapeHtml(d.username)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
        <span style="color:#64748b;">Jabatan</span>
        <span>${escapeHtml(d.jabatan)}</span>
      </div>`}
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;">
        <span style="color:#64748b;">No HP</span>
        <span>${escapeHtml(d.no_hp)||'—'}</span>
      </div>
    </div>

    <div id="profil-msg" class="message"></div>

    <button id="btn-simpan-foto" onclick="simpanFotoProfil()" style="display:none;width:100%;padding:11px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;display:none;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;">
      <i class="ti ti-device-floppy"></i> Simpan Foto
    </button>
    <button onclick="logout()" style="width:100%;padding:11px;background:transparent;color:#dc2626;border:1.5px solid #fecaca;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
      <i class="ti ti-logout"></i> Keluar
    </button>
  `);
}

function previewFotoProfil(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    window._newFotoProfil = e.target.result;
    document.getElementById('profil-avatar').innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
    const btn = document.getElementById('btn-simpan-foto');
    if (btn) { btn.style.display = 'flex'; }
  };
  reader.readAsDataURL(file);
}

async function simpanFotoProfil() {
  if (!window._newFotoProfil) return;
  const isWarga = currentUser.role === 'warga';
  const endpoint = isWarga ? '/auth/warga/foto-profil' : '/auth/petugas/foto-profil';
  showMessage('profil-msg', '⏳ Menyimpan...', 'info');
  const res = await apiCall(endpoint, 'PUT', { foto_profil: window._newFotoProfil });
  if (res.success) {
    showToast('Foto profil berhasil diupdate!', 'success');
    window._newFotoProfil = null;
    closeModal();
    // Update avatar di sidebar
    updateSidebarAvatar();
  } else {
    showMessage('profil-msg', res.message, 'error');
  }
}

async function updateSidebarAvatar() {
  const isWarga = currentUser.role === 'warga';
  const endpoint = isWarga ? '/auth/warga/profil' : '/auth/petugas/profil';
  const res = await apiCall(endpoint);
  if (!res.success || !res.data.foto_profil) return;
  const foto = res.data.foto_profil;
  // Update semua sidebar avatar
  document.querySelectorAll('.sidebar-avatar').forEach(el => {
    el.style.background = 'none';
    el.style.padding = '0';
    el.innerHTML = `<img src="${foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  });
}

// ══════════════════════════════════════════
// MODAL DETAIL
// ══════════════════════════════════════════
function showModal(html) {
  const existing = document.getElementById('detail-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'detail-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:flex-end;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:520px;max-height:85vh;overflow-y:auto;padding:20px;">
      <div style="width:36px;height:4px;background:#e2e8f0;border-radius:2px;margin:0 auto 16px;"></div>
      ${html}
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function closeModal() {
  const m = document.getElementById('detail-modal');
  if (m) m.remove();
}

let _chatModalPengajuanId = null;

async function bukaChatPetugas(id_pengajuan, nama_warga) {
  _chatModalPengajuanId = id_pengajuan;
  const avCls = getAvColor(nama_warga);
  const init = getInitials(nama_warga);
  showModal(`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
      <div class="${avCls}" style="width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex-shrink:0;">${escapeHtml(init)}</div>
      <div style="flex:1;min-width:0;">
        <h3 style="font-size:14px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(nama_warga)}</h3>
        <p style="font-size:11px;color:#94a3b8;">Pengajuan #${id_pengajuan}</p>
      </div>
      <button onclick="closeModal()" style="background:#f1f5f9;border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;color:#64748b;font-size:15px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">✕</button>
    </div>
    <div id="chat-messages-modal" style="height:340px;overflow-y:auto;padding:12px;background:#f8fafc;border-radius:14px;margin-bottom:12px;display:flex;flex-direction:column;gap:2px;"></div>
    <div style="display:flex;gap:8px;align-items:center;">
      <input type="text" id="chat-input-modal" placeholder="Tulis pesan..." maxlength="1000" style="flex:1;padding:11px 16px;border:1px solid #e2e8f0;border-radius:999px;font-size:13px;outline:none;background:#f8fafc;" onkeypress="if(event.key==='Enter') kirimPesanModal()">
      <button onclick="kirimPesanModal()" style="background:#1d4ed8;color:#fff;border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
        <i class="ti ti-send" style="font-size:16px;"></i>
      </button>
    </div>
  `);
  await loadPesanModal();
  tandaiChatBadge(id_pengajuan, false);
}

async function loadPesanModal() {
  const container = document.getElementById('chat-messages-modal');
  if (!container || !_chatModalPengajuanId) return;
  const res = await apiCall('/pesan/' + _chatModalPengajuanId);
  if (!res.success) {
    container.innerHTML = '<div style="margin:auto;color:#94a3b8;text-align:center;font-size:12px;">Gagal memuat pesan</div>';
    return;
  }
  const isWarga = currentUser.role === 'warga';
  const data = res.data || [];
  if (data.length === 0) {
    container.innerHTML = `<div style="margin:auto;text-align:center;color:#94a3b8;">
      <i class="ti ti-message-2" style="font-size:32px;display:block;margin-bottom:8px;opacity:0.5;"></i>
      <p style="font-size:12px;">Belum ada pesan.<br>Mulai percakapan sekarang.</p>
    </div>`;
    return;
  }
  container.innerHTML = data.map((m, i) => {
    const milikSaya = (isWarga && m.tipe_pengirim === 'warga') || (!isWarga && m.tipe_pengirim === 'petugas');
    const prev = data[i - 1];
    const sameAsPrev = prev && prev.tipe_pengirim === m.tipe_pengirim;
    const tailRadius = milikSaya
      ? (sameAsPrev ? '16px 4px 4px 16px' : '16px 16px 4px 16px')
      : (sameAsPrev ? '4px 16px 16px 4px' : '16px 16px 16px 4px');
    return `<div style="display:flex;justify-content:${milikSaya ? 'flex-end' : 'flex-start'};margin-top:${sameAsPrev ? '2px' : '10px'};">
      <div style="max-width:72%;">
        ${!sameAsPrev ? `<p style="font-size:10px;font-weight:600;color:#94a3b8;margin-bottom:3px;padding:0 4px;${milikSaya ? 'text-align:right;' : ''}">${escapeHtml(m.nama_pengirim)}</p>` : ''}
        <div style="background:${milikSaya ? '#1d4ed8' : '#fff'};color:${milikSaya ? '#fff' : '#1e293b'};padding:9px 13px;border-radius:${tailRadius};border:${milikSaya ? 'none' : '1px solid #e2e8f0'};box-shadow:0 1px 2px rgba(0,0,0,0.04);">
          <p style="font-size:13px;white-space:pre-wrap;word-break:break-word;line-height:1.4;">${escapeHtml(m.isi_pesan)}</p>
        </div>
        <p style="font-size:9px;color:#cbd5e1;margin-top:2px;padding:0 4px;${milikSaya ? 'text-align:right;' : ''}">${formatDate(m.created_at, true)}</p>
      </div>
    </div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

async function kirimPesanModal() {
  const input = document.getElementById('chat-input-modal');
  const isi = input.value.trim();
  if (!isi || !_chatModalPengajuanId) return;
  const res = await apiCall('/pesan/' + _chatModalPengajuanId, 'POST', { isi_pesan: isi });
  if (res.success) {
    input.value = '';
    await loadPesanModal();
  } else {
    showToast(res.message, 'error');
  }
}

function showFotoBesar(src, id_pengajuan, nama_warga, nik, jenis_bantuan, alamat, status_pengajuan, keterangan, tx_id) {
  showModal(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <button onclick="showDetailAntrian(${id_pengajuan}, '${nama_warga}', '${nik}', '${jenis_bantuan}', '${alamat}', '${status_pengajuan}', '${keterangan}', '${tx_id}')" style="background:none;border:none;cursor:pointer;font-size:13px;color:#1e40af;display:flex;align-items:center;gap:4px;">
        <i class="ti ti-arrow-left"></i> Kembali
      </button>
      <button onclick="closeModal()" style="background:none;border:none;cursor:pointer;font-size:20px;color:#94a3b8;">✕</button>
    </div>
    <img src="${src}" style="width:100%;border-radius:8px;">
  `);
}
async function showDetailAntrian(id_pengajuan, nama_warga, nik, jenis_bantuan, alamat, status_pengajuan, keterangan, tx_id) {
  nama_warga = escapeHtml(nama_warga); nik = escapeHtml(nik); jenis_bantuan = escapeHtml(jenis_bantuan);
  alamat = escapeHtml(alamat); keterangan = escapeHtml(keterangan);
  showModal(`<div style="text-align:center;padding:40px 0;color:#94a3b8;">Memuat detail pengajuan...</div>`);
  let fotoKtp = '', fotoRumah = '';
  try {
    const res = await apiCall('/pengajuan/' + id_pengajuan);
    if (res.success && res.data) {
      fotoKtp = res.data.foto_ktp || '';
      fotoRumah = res.data.foto_rumah || '';
    }
  } catch (e) {}
  const imgSrc = (b64) => b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
  showModal(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <h3 style="font-size:15px;font-weight:700;color:#0f172a;">Detail Pengajuan</h3>
      <button onclick="closeModal()" style="background:none;border:none;cursor:pointer;font-size:20px;color:#94a3b8;">✕</button>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
      ${avatarCell(nama_warga, nik)}
    </div>
    <div style="background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
        <span style="color:#64748b;">NIK</span><span style="font-family:monospace;font-weight:500;">${nik}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
        <span style="color:#64748b;">Jenis Bantuan</span><span style="font-weight:600;">${jenis_bantuan}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
        <span style="color:#64748b;">Alamat</span><span style="text-align:right;max-width:60%;">${alamat}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
        <span style="color:#64748b;">Status</span>${getStatusBadge(status_pengajuan)}
      </div>
      ${keterangan ? `
      <div style="padding:6px 0;font-size:13px;">
        <span style="color:#64748b;display:block;margin-bottom:4px;">Keterangan</span>
        <div style="background:#eff6ff;padding:8px 10px;border-radius:6px;color:#1e40af;font-size:12px;">${keterangan}</div>
      </div>` : ''}
    </div>
    ${(fotoKtp || fotoRumah) ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
      ${fotoKtp ? `<div><p style="font-size:11px;color:#64748b;margin:0 0 4px;">Foto KTP</p><img src="${imgSrc(fotoKtp)}" style="width:100%;border-radius:8px;border:1px solid #e2e8f0;cursor:pointer;" onclick="showFotoBesar(this.src, ${id_pengajuan}, '${nama_warga}', '${nik}', '${jenis_bantuan}', '${alamat}', '${status_pengajuan}', '${keterangan}', '${tx_id}')"></div>` : ''}
      ${fotoRumah ? `<div><p style="font-size:11px;color:#64748b;margin:0 0 4px;">Foto Rumah</p><img src="${imgSrc(fotoRumah)}" style="width:100%;border-radius:8px;border:1px solid #e2e8f0;cursor:pointer;" onclick="showFotoBesar(this.src, ${id_pengajuan}, '${nama_warga}', '${nik}', '${jenis_bantuan}', '${alamat}', '${status_pengajuan}', '${keterangan}', '${tx_id}')"></div>` : ''}
    </div>` : `<p style="font-size:12px;color:#94a3b8;margin-bottom:14px;">Dokumen pendukung tidak tersedia</p>`}
    <div style="display:flex;gap:8px;">
      <button class="btn-success" style="flex:1;" onclick="closeModal();submitVerifikasiPetugas(${id_pengajuan},'Disetujui')">
        <i class="ti ti-check"></i> Setujui
      </button>
      <button class="btn-danger" style="flex:1;" onclick="closeModal();submitVerifikasiPetugas(${id_pengajuan},'Ditolak')">
        <i class="ti ti-x"></i> Tolak
      </button>
    </div>
  `);
}

function showDetailRiwayat(nama_warga, nik, jenis_bantuan, keputusan, tanggal_verifikasi, catatan, tx_id_blockchain) {
  nama_warga = escapeHtml(nama_warga); nik = escapeHtml(nik); jenis_bantuan = escapeHtml(jenis_bantuan);
  catatan = escapeHtml(catatan);
  showModal(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <h3 style="font-size:15px;font-weight:700;color:#0f172a;">Detail Verifikasi</h3>
      <button onclick="closeModal()" style="background:none;border:none;cursor:pointer;font-size:20px;color:#94a3b8;">✕</button>
    </div>
    <div style="margin-bottom:16px;">
      ${avatarCell(nama_warga, nik)}
    </div>
    <div style="background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
        <span style="color:#64748b;">NIK</span><span style="font-family:monospace;font-weight:500;">${nik}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
        <span style="color:#64748b;">Jenis Bantuan</span><span style="font-weight:600;">${jenis_bantuan}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
        <span style="color:#64748b;">Keputusan</span>${getStatusBadge(keputusan)}
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
        <span style="color:#64748b;">Tanggal</span><span>${formatDate(tanggal_verifikasi,true)}</span>
      </div>
      ${catatan ? `
      <div style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
        <span style="color:#64748b;display:block;margin-bottom:4px;">Catatan</span>
        <div style="background:#fffbeb;padding:8px 10px;border-radius:6px;color:#92400e;font-size:12px;">${catatan}</div>
      </div>` : ''}
      ${tx_id_blockchain ? `
      <div style="padding:6px 0;font-size:13px;">
        <span style="color:#64748b;display:block;margin-bottom:6px;">TX ID Blockchain</span>
        <div style="background:#f1f5f9;padding:8px 10px;border-radius:6px;display:flex;align-items:center;gap:8px;">
          <span style="font-family:monospace;font-size:10px;color:#64748b;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${tx_id_blockchain}</span>
          <button onclick="copyTxId('${tx_id_blockchain}')"
            style="background:#1d4ed8;color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;flex-shrink:0;display:flex;align-items:center;gap:4px;">
            <i class="ti ti-copy" style="font-size:12px;"></i> Salin
          </button>
        </div>
      </div>` : ''}
    </div>
  `);
}

