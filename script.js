/* ============================================================
   Конфигурация колонок
   ============================================================ */
const CONFIG = {
    assault: {
        title: 'ОПАСНЫЙ ШТУРМ',
        sortField: 'test',
        avgField:  'test',
        highScore: null,
        columns: [
            { key: 'rating',  label: 'ТОП',         thClass: 'rating-col num-col',  tdClass: 'rating-cell num-cell',  role: 'rating' },
            { key: 'avatar',  label: 'АВАТАР',      thClass: 'avatar-col',          tdClass: 'avatar-cell',           role: 'avatar' },
            { key: 'nick',    label: 'НИК',         thClass: 'nick-col',            tdClass: 'nick-cell',             role: 'nick'   },
            { key: 'test',    label: 'ИСПЫТАНИЕ',   thClass: 'num-col test-col',    tdClass: 'num-cell test-cell',    role: 'number' },
            { key: 'avg',     label: 'ОТ СРЕДНЕГО', thClass: 'rating-col num-col',  tdClass: 'rating-cell num-cell',  role: 'avg'    },
        ],
    },
    defence: {
        title: 'ОБОРОНА ШИЮЙ',
        sortField: 'points',
        avgField:  'points',
        highScore: { fieldKey: 'points', threshold: 100000, className: 'high-score' },
        columns: [
            { key: 'rating', label: 'ТОП',         thClass: 'rating-col num-col', tdClass: 'rating-cell num-cell',  role: 'rating' },
            { key: 'avatar', label: 'АВАТАР',      thClass: 'avatar-col',         tdClass: 'avatar-cell',           role: 'avatar' },
            { key: 'nick',   label: 'НИК',         thClass: 'nick-col',           tdClass: 'nick-cell',             role: 'nick'   },
            { key: 'points', label: 'ОЧКИ',        thClass: 'num-col',            tdClass: 'points-cell num-cell',  role: 'number' },
            { key: 'avg',    label: 'ОТ СРЕДНЕГО', thClass: 'rating-col num-col', tdClass: 'rating-cell num-cell',  role: 'avg'    },
        ],
    },
};

/* ============================================================
   Состояние
   ============================================================ */
let manifest       = null;
let nicks          = {};
let currentSection = 'bases';
let currentType    = 'assault';
let currentFile    = null;
let currentData    = null;
let previousData   = null;

const selectedFiles = { assault: null, defence: null };

const headEl          = document.getElementById('tableHead');
const bodyEl          = document.getElementById('tableBody');
const titleEl         = document.getElementById('mainTitle');
const countEl         = document.getElementById('participantsCount');
const lastUpdEl       = document.getElementById('lastUpdate');
const tableSelectorEl = document.getElementById('tableSelector');

/* ============================================================
   Утилиты
   ============================================================ */
function num(v) {
    if (v === '' || v == null) return null;
    const n = Number(String(v).replace(/\s+/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}
function fmtInt(n) {
    if (n == null) return '';
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
function formatPercent(p) {
    if (p == null) return '—';
    const r = Math.round(p * 10) / 10;
    return Number.isInteger(r) ? `${r}%` : `${r.toFixed(1)}%`;
}
function maskNick(nick) {
    if (!nick) return '';
    const s = String(nick).trim();
    if (!s) return '';
    if (s.length === 1) return s[0].toUpperCase();
    return s[0].toUpperCase() + s[s.length - 1].toUpperCase();
}
function shortDate(title, file) {
    const src = title || file || '';
    const m = src.match(/(\d{1,2})[\s_\-]+(\d{1,2})[\s_\-]+(\d{4})/);
    if (m) return `${m[1]} ${m[2]} ${m[3]}`;
    return (title || file || '').replace(/\.json$/i, '');
}
function isVideoUrl(url) {
    return /\.(mp4|webm|mov|mkv)(\?.*)?$/i.test(String(url || ''));
}
async function fetchJSON(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.json();
}

/* ============================================================
   Ключ строки для дельт
   Приоритет — id (уникален), fallback — ник|аватарка
   ============================================================ */
function rowKey(row) {
    if (row.id) return String(row.id);
    const n = String(row.nick || '').trim().toLowerCase();
    const a = String(row.avatar || '').trim();
    return n + '|' + a;
}

/* ============================================================
   Путь к аватарке
   row.avatar может быть:
   - полный путь ("avatars/Avatar_Sunna.webp") — новый формат
   - имя ("Avatar_Sunna") — старый формат
   - отсутствовать — fallback по нику через nicks.json
   ============================================================ */
function resolveAvatarPath(row) {
    const av = row.avatar;
    if (av && av.includes('/')) return av;             // уже полный путь
    if (av && manifest.avatars?.[av]) return manifest.avatars[av];   // имя
    const fromNicks = nicks[row.nick];
    if (fromNicks && manifest.avatars?.[fromNicks]) return manifest.avatars[fromNicks];
    return null;
}

/* ============================================================
   Расчёт рейтингов
   ============================================================ */
function computeRanking(rows, field) {
    const entries = rows.map((r, i) => ({ r, v: num(r[field]), i }));
    const valid = entries.filter(e => e.v != null).sort((a, b) => b.v - a.v);
    const total = valid.length;
    const mean  = total ? valid.reduce((s, e) => s + e.v, 0) / total : 0;
    const map = new Map();
    let lastV = null, lastRank = 0;
    valid.forEach((e, i) => {
        const rank = e.v === lastV ? lastRank : (i + 1);
        lastV = e.v; lastRank = rank;
        let pct = Math.floor((rank / total) * 1000) / 10;
        if (pct < 0.1) pct = 0.1;
        const avg = mean === 0 ? 100 : (e.v / mean) * 100;
        map.set(e.r, { pct, avg, rank });
    });
    for (const e of entries) if (!map.has(e.r)) map.set(e.r, { pct: null, avg: null, rank: null });
    return map;
}

/* ============================================================
   Индекс предыдущей таблицы
   ============================================================ */
function buildPrevIndex(prevRows) {
    const map = new Map();
    if (!Array.isArray(prevRows)) return map;
    for (const r of prevRows) {
        const k = rowKey(r);
        if (k !== '|') map.set(k, r);
    }
    return map;
}

/* ============================================================
   Рендер
   ============================================================ */
function buildHeader(cfg) {
    headEl.innerHTML = '';
    const tr = document.createElement('tr');
    for (const col of cfg.columns) {
        const th = document.createElement('th');
        if (col.thClass) th.className = col.thClass;
        th.textContent = col.label;
        tr.appendChild(th);
    }
    headEl.appendChild(tr);
}

function renderAvatarCell(td, row) {
    const path = resolveAvatarPath(row);

    if (path) {
        const img = document.createElement('img');
        img.src = path;
        img.alt = row.nick || '';
        img.loading = 'lazy';
        img.draggable = false;
        img.onerror = () => {
            img.remove();
            const span = document.createElement('span');
            span.className = 'no-avatar';
            span.textContent = '?';
            td.appendChild(span);
        };
        td.appendChild(img);
    } else {
        const span = document.createElement('span');
        span.className = 'no-avatar';
        span.textContent = '?';
        td.appendChild(span);
    }
}

function appendDiff(td, diff) {
    if (diff === 0) return;
    const span = document.createElement('span');
    span.className = 'cell-diff ' + (diff > 0 ? 'positive' : 'negative');
    span.textContent = (diff > 0 ? '+' : '−') + fmtInt(Math.abs(diff));
    td.appendChild(span);
}

function render() {
    const cfg = CONFIG[currentType];
    const baseTitle = (currentData?.title || cfg.title).replace(/\s*\([^)]*\)\s*$/, '').trim();

    if (currentType === 'assault') {
        titleEl.textContent = baseTitle + ' (ИСПЫТАНИЕ)';
    } else {
        titleEl.textContent = baseTitle;
    }

    buildHeader(cfg);
    bodyEl.innerHTML = '';

    const rows = (currentData?.rows || []).slice();
    if (!rows.length) {
        bodyEl.innerHTML = `<tr><td colspan="${cfg.columns.length}" style="text-align:center; padding:40px; color:#666;">Нет данных</td></tr>`;
        countEl.textContent = '0';
        lastUpdEl.textContent = '—';
        renderStamina();
        return;
    }

    rows.sort((a, b) => (num(b[cfg.sortField]) ?? -Infinity) - (num(a[cfg.sortField]) ?? -Infinity));
    const ranked = computeRanking(rows, cfg.sortField);
    const prevIndex = buildPrevIndex(previousData?.rows);

    for (const row of rows) {
        const tr = document.createElement('tr');
        const stats = ranked.get(row) || { pct: null, avg: null };

        for (const col of cfg.columns) {
            const td = document.createElement('td');
            if (col.tdClass) td.className = col.tdClass;

            switch (col.role) {
                case 'rating':
                    td.textContent = formatPercent(stats.pct);
                    break;

                case 'avatar':
                    renderAvatarCell(td, row);
                    break;

                case 'nick':
                    td.textContent = maskNick(row.nick);
                    break;

                case 'number': {
                    const v = num(row[col.key]);
                    td.textContent = v == null ? '' : fmtInt(v);
                    if (cfg.highScore && col.key === cfg.highScore.fieldKey
                        && v != null && v >= cfg.highScore.threshold) {
                        td.classList.add(cfg.highScore.className);
                    }

                    const prevRow = prevIndex.get(rowKey(row));
                    if (prevRow && v != null) {
                        const prevV = num(prevRow[col.key]);
                        if (prevV != null) appendDiff(td, v - prevV);
                    }
                    break;
                }

                case 'avg':
                    td.textContent = formatPercent(stats.avg);
                    break;

                default:
                    td.textContent = row[col.key] ?? '';
            }

            tr.appendChild(td);
        }
        bodyEl.appendChild(tr);
    }

    countEl.textContent = rows.length;

    if (currentData?.savedAt) {
        const d = new Date(currentData.savedAt);
        if (!isNaN(d)) {
            const p = n => String(n).padStart(2, '0');
            lastUpdEl.textContent =
                `Данные: ${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} ` +
                `${p(d.getHours())}:${p(d.getMinutes())}`;
        } else {
            lastUpdEl.textContent = '—';
        }
    } else {
        lastUpdEl.textContent = '—';
    }

    renderStamina();
}

/* ============================================================
   СТОЙКОСТЬ (только для штурма)
   ============================================================ */
function renderStamina() {
    const area = document.getElementById('staminaArea');
    if (currentType !== 'assault' || !currentData?.rows) {
        area.style.display = 'none';
        return;
    }

    const rows = currentData.rows
        .filter(r => num(r.stamina) != null)
        .sort((a, b) => num(b.stamina) - num(a.stamina));

    if (!rows.length) {
        area.style.display = 'none';
        return;
    }
    area.style.display = '';

    const baseTitle = (currentData.title || 'ОПАСНЫЙ ШТУРМ').replace(/\s*\([^)]*\)\s*$/, '').trim();
    document.getElementById('staminaTitle').textContent = baseTitle + ' (СТОЙКОСТЬ)';

    const ranked = computeRanking(rows, 'stamina');

    const head = document.getElementById('staminaHead');
    head.innerHTML = '';
    const trh = document.createElement('tr');
    [
        { cls: 'rating-col num-col',  label: 'ТОП' },
        { cls: 'avatar-col',          label: 'АВАТАР' },
        { cls: 'nick-col',            label: 'НИК' },
        { cls: 'num-col stamina-col', label: 'СТОЙКОСТЬ' },
        { cls: 'rating-col num-col',  label: 'ОТ СРЕДНЕГО' },
    ].forEach(d => {
        const th = document.createElement('th');
        th.className = d.cls;
        th.textContent = d.label;
        trh.appendChild(th);
    });
    head.appendChild(trh);

    const body = document.getElementById('staminaBody');
    body.innerHTML = '';

    const prevIndex = buildPrevIndex(previousData?.rows);

    for (const row of rows) {
        const tr = document.createElement('tr');
        const stats = ranked.get(row) || { pct: null, avg: null };

        const tdRating = document.createElement('td');
        tdRating.className = 'rating-cell num-cell';
        tdRating.textContent = formatPercent(stats.pct);
        tr.appendChild(tdRating);

        const tdAvatar = document.createElement('td');
        tdAvatar.className = 'avatar-cell';
        renderAvatarCell(tdAvatar, row);
        tr.appendChild(tdAvatar);

        const tdNick = document.createElement('td');
        tdNick.className = 'nick-cell';
        tdNick.textContent = maskNick(row.nick);
        tr.appendChild(tdNick);

        const tdSt = document.createElement('td');
        tdSt.className = 'num-cell stamina-cell';
        const v = num(row.stamina);
        tdSt.textContent = fmtInt(v);

        const prevRow = prevIndex.get(rowKey(row));
        if (prevRow) {
            const prevV = num(prevRow.stamina);
            if (prevV != null) appendDiff(tdSt, v - prevV);
        }
        tr.appendChild(tdSt);

        const tdAvg = document.createElement('td');
        tdAvg.className = 'rating-cell num-cell';
        tdAvg.textContent = formatPercent(stats.avg);
        tr.appendChild(tdAvg);

        body.appendChild(tr);
    }
}

/* ============================================================
   Выбор таблицы
   ============================================================ */
function renderTableSelector() {
    const files = manifest?.[currentType]?.files || [];
    tableSelectorEl.innerHTML = '';

    if (files.length === 0) {
        tableSelectorEl.innerHTML = '<span class="empty-selector">Нет таблиц в папке</span>';
        return;
    }

    for (const f of files) {
        const btn = document.createElement('button');
        btn.className = 'table-btn';
        btn.textContent = shortDate(f.title, f.file);
        btn.title = f.title || f.file;
        btn.dataset.file = f.file;
        btn.addEventListener('click', () => loadTable(f.file));
        tableSelectorEl.appendChild(btn);
    }
    updateTableSelector();
}

function updateTableSelector() {
    tableSelectorEl.querySelectorAll('.table-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.file === currentFile);
    });
}

async function loadTable(fileName) {
    currentFile = fileName;
    selectedFiles[currentType] = fileName;
    updateTableSelector();

    const folder = manifest[currentType].folder;
    const url = `${folder}/${encodeURIComponent(fileName)}`;

    try {
        currentData = await fetchJSON(url);

        const files = manifest[currentType].files;
        const idx = files.findIndex(f => f.file === fileName);
        const prevFile = files[idx + 1]?.file;

        previousData = null;
        if (prevFile) {
            try {
                previousData = await fetchJSON(`${folder}/${encodeURIComponent(prevFile)}`);
            } catch (e) {
                console.warn('Не удалось загрузить предыдущую таблицу:', e.message);
            }
        }

        render();
    } catch (e) {
        console.error(e);
        currentData = null;
        previousData = null;
        headEl.innerHTML = '';
        bodyEl.innerHTML = '';
        titleEl.textContent = 'Ошибка загрузки';
        countEl.textContent = '0';
        lastUpdEl.textContent = e.message;
        document.getElementById('staminaArea').style.display = 'none';
    }
}

/* ============================================================
   Алтари
   ============================================================ */
async function loadAltars() {
    const grid = document.getElementById('altarGrid');
    if (!grid) return;

    let items;
    try {
        items = await fetchJSON('altars.json');
    } catch (e) {
        console.warn('Не удалось загрузить altars.json:', e.message);
        grid.innerHTML = '<span class="empty-selector">altars.json не найден</span>';
        return;
    }

    if (!Array.isArray(items) || items.length === 0) {
        grid.innerHTML = '<span class="empty-selector">Список алтарей пуст</span>';
        return;
    }

    grid.innerHTML = '';

    for (const item of items) {
        const src  = String(item.src || '').trim();
        const name = String(item.name || '').trim();
        if (!src) continue;

        const video = isVideoUrl(src);

        const btn = document.createElement('button');
        btn.className = 'altar-card';
        btn.dataset.src  = src;
        btn.dataset.type = video ? 'video' : 'image';

        const info = document.createElement('span');
        info.className = 'altar-info';

        const v = document.createElement('span');
        v.className = 'altar-version';
        v.textContent = item.version || '';
        info.appendChild(v);

        const n = document.createElement('span');
        n.className = 'altar-name';
        n.textContent = name || '—';
        info.appendChild(n);

        btn.appendChild(info);

        const tag = document.createElement('span');
        tag.className = 'altar-tag';
        tag.textContent = video ? 'MP4' : 'PNG';
        btn.appendChild(tag);

        grid.appendChild(btn);
    }
}

function bindAltars() {
    const modal    = document.getElementById('altarModal');
    const body     = document.getElementById('altarModalBody');
    const nameEl   = document.getElementById('altarModalName');
    const closeBtn = document.getElementById('altarModalClose');
    const grid     = document.getElementById('altarGrid');
    if (!modal || !body || !grid) return;

    function closeModal() {
        modal.hidden = true;
        body.innerHTML = '';
        nameEl.textContent = '';
        grid.querySelectorAll('.altar-card').forEach(c => c.classList.remove('active'));
    }

    function openModal(card) {
        grid.querySelectorAll('.altar-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        const src  = card.dataset.src;
        const type = card.dataset.type || 'image';
        const name = card.querySelector('.altar-name')?.textContent || '';

        nameEl.textContent = name;
        body.innerHTML = '';

        if (type === 'video') {
            const v = document.createElement('video');
            v.src = src;
            v.controls = true;
            v.autoplay = true;
            v.loop = true;
            v.muted = true;
            v.playsInline = true;
            body.appendChild(v);
        } else {
            const img = document.createElement('img');
            img.src = src;
            img.alt = name;
            body.appendChild(img);
        }

        modal.hidden = false;
    }

    grid.addEventListener('click', (e) => {
        const card = e.target.closest('.altar-card');
        if (!card) return;
        const isActive = card.classList.contains('active');
        if (isActive) closeModal();
        else openModal(card);
    });

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target === body) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) closeModal();
    });
}

/* ============================================================
   Навигация
   ============================================================ */
function showSection(section) {
    currentSection = section;

    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.section === section);
    });
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    document.body.className = 'index-page ' + section;

    if (section === 'bases') {
        document.getElementById('viewBases').classList.add('active');
        lastUpdEl.textContent = '—';
        return;
    }
    if (section === 'stickers') {
        document.getElementById('viewStickers').classList.add('active');
        lastUpdEl.textContent = '—';
        return;
    }
    if (section === 'altars') {
        document.getElementById('viewAltars').classList.add('active');
        lastUpdEl.textContent = '—';
        return;
    }

    currentType = section;
    document.getElementById('viewTables').classList.add('active');

    renderTableSelector();

    const files = manifest?.[currentType]?.files || [];
    if (files.length > 0) {
        const targetFile = selectedFiles[currentType] || files[0].file;
        loadTable(targetFile);
    } else {
        headEl.innerHTML = '';
        bodyEl.innerHTML = '';
        titleEl.textContent = 'Нет таблиц';
        countEl.textContent = '0';
        lastUpdEl.textContent = '—';
        document.getElementById('staminaArea').style.display = 'none';
    }
}

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showSection(btn.dataset.section));
});

/* ============================================================
   Старт
   ============================================================ */
(async function init() {
    bindAltars();

    if (location.protocol === 'file:') {
        lastUpdEl.textContent = 'Открой через start_server.bat (localhost)';
        document.querySelectorAll('.nav-btn').forEach(b => b.disabled = true);
        return;
    }

    try {
        manifest = await fetchJSON('manifest.json');
    } catch (e) {
        console.error(e);
        lastUpdEl.textContent = 'Ошибка manifest.json: ' + e.message;
        return;
    }

    await loadAltars();
    showSection('bases');
})();