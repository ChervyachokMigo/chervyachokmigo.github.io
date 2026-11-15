/* ============================================================
   Конфигурация колонок
   ============================================================ */
const CONFIG = {
    assault: {
        sortField: 'test',
        highScore: null,
        columns: [
            { key: 'rating',  label: 'ТОП',         thClass: 'rating-col num-col',  tdClass: 'rating-cell num-cell',  role: 'rating' },
            { key: 'avatar',  label: 'АВАТАР',      thClass: 'avatar-col',          tdClass: 'avatar-cell',           role: 'avatar' },
            { key: 'nick',    label: 'НИК',         thClass: 'nick-col',            tdClass: 'nick-cell',             role: 'nick'   },
            { key: 'test',    label: 'ИСПЫТАНИЕ',   thClass: 'num-col value-col',    tdClass: 'num-cell value-cell',    role: 'number' },
            { key: 'avg',     label: 'ОТ СРЕДНЕГО', thClass: 'avg-col num-col',     tdClass: 'avg-cell num-cell',     role: 'avg'    },
        ],
    },
    defence: {
        sortField: 'points',
        highScore: { fieldKey: 'points', threshold: 100000, className: 'high-score' },
        columns: [
            { key: 'rating', label: 'ТОП',         thClass: 'rating-col num-col', tdClass: 'rating-cell num-cell',  role: 'rating' },
            { key: 'avatar', label: 'АВАТАР',      thClass: 'avatar-col',         tdClass: 'avatar-cell',           role: 'avatar' },
            { key: 'nick',   label: 'НИК',         thClass: 'nick-col',           tdClass: 'nick-cell',             role: 'nick'   },
            { key: 'points',  label: 'ОЧКИ',        thClass: 'num-col value-col', tdClass: 'value-cell num-cell',  role: 'number' },
            { key: 'avg',    label: 'ОТ СРЕДНЕГО', thClass: 'avg-col num-col',     tdClass: 'avg-cell num-cell',     role: 'avg'    },
        ],
    },
};

/* ============================================================
   Состояние
   ============================================================ */
let manifest       = null;
let currentType    = 'assault';
let currentSubtype = 'test';
let currentFile    = null;
let currentData    = null;
let previousData   = null;
let nickFilter     = '';

const selectedFiles = { assault: null, defence: null };

const sortState = {
    assault: { key: 'test',    dir: 'desc' },
    stamina: { key: 'stamina', dir: 'desc' },
    defence: { key: 'points',  dir: 'desc' },
};

const headEl          = document.getElementById('tableHead');
const bodyEl          = document.getElementById('tableBody');
const countEl         = document.getElementById('participantsCount');
const lastUpdEl       = document.getElementById('lastUpdate');
const tableSelectorEl = document.getElementById('tableSelector');
const subTypeSelEl    = document.getElementById('subTypeSelector');
const nickFilterEl    = document.getElementById('nickFilter');

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

function rowKey(row) {
    if (row.id) return String(row.id);
    const n = String(row.nick || '').trim().toLowerCase();
    const a = String(row.avatar || '').trim();
    return n + '|' + a;
}

function resolveAvatarPath(row) {
    const av = row.avatar;
    if (av && av.includes('/')) return av;
    if (av && manifest.avatars?.[av]) return manifest.avatars[av];
    return null;
}

/* ============================================================
   URL hash
   ============================================================ */
function updateHash(section) {
    let hash;
    if (section === 'assault' || section === 'defence') {
        if (currentFile) {
            const file = currentFile.replace(/\.json$/i, '');
            const sub = section === 'assault' ? '/' + currentSubtype : '';
            hash = `#${section}/${encodeURIComponent(file)}${sub}`;
        } else {
            hash = `#${section}`;
        }
    } else {
        hash = `#${section}`;
    }
    if (location.hash !== hash) {
        history.replaceState(null, '', hash);
    }
}

function parseHash() {
    try {
        const h = decodeURIComponent(location.hash.slice(1) || '');
        if (!h) return null;
        const parts = h.split('/');
        const section = parts[0];
        const valid = ['bases', 'assault', 'defence', 'stickers', 'altars', 'links'];
        if (!valid.includes(section)) return null;
        return {
            section,
            file: parts[1] || null,
            subtype: parts[2] || null,
        };
    } catch (e) {
        return null;
    }
}

/* ============================================================
   Рейтинги и предыдущая таблица
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
   Сортировка
   ============================================================ */
function defaultSortDir(col) {
    return (col.role === 'rating' || col.role === 'number' || col.role === 'avg') ? 'desc' : 'asc';
}

function onSortClick(tableId, col) {
    const state = sortState[tableId];
    if (state.key === col.key) {
        state.dir = state.dir === 'asc' ? 'desc' : 'asc';
    } else {
        state.key = col.key;
        state.dir = defaultSortDir(col);
    }
    if (tableId === 'stamina') renderStamina();
    else render();
}

function sortRowsBy(rows, col, dir, statsMap) {
    const getVal = (row) => {
        switch (col.role) {
            case 'rating': return statsMap.get(row)?.pct ?? null;
            case 'avg':    return statsMap.get(row)?.avg ?? null;
            case 'nick':   return String(row.nick || '').toLowerCase();
            case 'avatar': {
                const av = (resolveAvatarPath(row) || '').toLowerCase();
                const nick = String(row.nick || '').toLowerCase();
                return av + '|' + nick;
            }
            default:       return num(row[col.key]);
        }
    };

    rows.sort((a, b) => {
        const va = getVal(a);
        const vb = getVal(b);
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        let cmp;
        if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
        else cmp = String(va).localeCompare(String(vb), 'ru');
        return dir === 'asc' ? cmp : -cmp;
    });
}

/* ============================================================
   Фильтр по нику (+±2 соседа, матчи выделены)
   ============================================================ */
function applyNickFilter(rows, query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return { filtered: rows, highlight: new Set() };

    const matches = [];
    const highlight = new Set();
    rows.forEach((r, i) => {
        if (String(r.nick || '').toLowerCase().includes(q)) {
            matches.push(i);
            highlight.add(r);
        }
    });

    if (matches.length === 0) {
        return { filtered: [], highlight };
    }

    const keep = new Set();
    for (const idx of matches) {
        for (let i = idx - 2; i <= idx + 2; i++) {
            if (i >= 0 && i < rows.length) keep.add(i);
        }
    }

    const keepArr = [...keep].sort((a, b) => a - b);
    const filtered = [];
    for (let i = 0; i < keepArr.length; i++) {
        if (i > 0 && keepArr[i] - keepArr[i - 1] > 1) {
            filtered.push({ __gap: true });
        }
        filtered.push(rows[keepArr[i]]);
    }

    return { filtered, highlight };
}

/* ============================================================
   Рендер ячеек
   ============================================================ */
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

/* ============================================================
   Универсальный рендер таблицы
   ============================================================ */
function buildTable(cfg, rows, prevIndex, statsMap, headTarget, bodyTarget, tableId, state, highlight) {
    headTarget.innerHTML = '';
    const trh = document.createElement('tr');
    for (const col of cfg.columns) {
        const th = document.createElement('th');
        if (col.thClass) th.className = col.thClass;
        th.textContent = col.label;
        if (state && state.key === col.key) {
            th.classList.add('sorted', state.dir === 'asc' ? 'sort-asc' : 'sort-desc');
        }
        th.addEventListener('click', () => onSortClick(tableId, col));
        trh.appendChild(th);
    }
    headTarget.appendChild(trh);

    bodyTarget.innerHTML = '';

    if (!rows.length) {
        const msg = nickFilter.trim() ? 'Ничего не найдено' : 'Нет данных';
        bodyTarget.innerHTML = `<tr><td colspan="${cfg.columns.length}" style="text-align:center;padding:40px;color:#666;">${msg}</td></tr>`;
        return;
    }

    const top10Count = Math.max(1, Math.ceil(rows.filter(r => !r.__gap).length * 0.1));

    for (const row of rows) {
        if (row.__gap) {
            const tr = document.createElement('tr');
            tr.className = 'gap-row';
            const td = document.createElement('td');
            td.colSpan = cfg.columns.length;
            td.textContent = '· · ·';
            tr.appendChild(td);
            bodyTarget.appendChild(tr);
            continue;
        }

        const tr = document.createElement('tr');
        const stats = statsMap.get(row) || { pct: null, avg: null };

        if (stats.rank != null && stats.rank <= top10Count) {
            tr.classList.add('top-row');
        }
        if (highlight && highlight.has(row)) {
            tr.classList.add('nick-match');
        }

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
                    td.addEventListener('click', () => openNickStats(row));
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
        bodyTarget.appendChild(tr);
    }
}

/* ============================================================
   Рендер основной таблицы
   ============================================================ */
function render() {
    const cfg = CONFIG[currentType];
    const rows = (currentData?.rows || []).slice();
    const prevIndex = buildPrevIndex(previousData?.rows);
    const state = sortState[currentType];

    const statsMap = computeRanking(rows, cfg.sortField);
    const sortCol = cfg.columns.find(c => c.key === state.key)
        || cfg.columns.find(c => c.key === cfg.sortField)
        || cfg.columns[0];

    if (rows.length > 0 && sortCol) {
        sortRowsBy(rows, sortCol, state.dir, statsMap);
    }

    const { filtered, highlight } = applyNickFilter(rows, nickFilter);

    buildTable(cfg, filtered, prevIndex, statsMap, headEl, bodyEl, currentType, state, highlight);
    countEl.textContent = (currentData?.rows || []).length;

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
    applySubtypeVisibility();
}

/* ============================================================
   Рендер таблицы СТОЙКОСТИ
   ============================================================ */
function renderStamina() {
    if (currentType !== 'assault') return;

    const head = document.getElementById('staminaHead');
    const body = document.getElementById('staminaBody');
    if (!head || !body) return;

    const cfg = {
        sortField: 'stamina',
        highScore: null,
        columns: [
            { key: 'rating',  label: 'ТОП',         thClass: 'rating-col num-col',  tdClass: 'rating-cell num-cell', role: 'rating' },
            { key: 'avatar',  label: 'АВАТАР',      thClass: 'avatar-col',          tdClass: 'avatar-cell',          role: 'avatar' },
            { key: 'nick',    label: 'НИК',         thClass: 'nick-col',            tdClass: 'nick-cell',            role: 'nick'   },
            { key: 'stamina', label: 'СТОЙКОСТЬ',   thClass: 'num-col value-col',   tdClass: 'num-cell value-cell',  role: 'number' },
            { key: 'avg',     label: 'ОТ СРЕДНЕГО', thClass: 'avg-col num-col',     tdClass: 'avg-cell num-cell',    role: 'avg'    },
        ],
    };

    const rows = (currentData?.rows || []).filter(r => num(r.stamina) != null);
    const prevIndex = buildPrevIndex(previousData?.rows);
    const state = sortState.stamina;

    const statsMap = computeRanking(rows, 'stamina');
    const sortCol = cfg.columns.find(c => c.key === state.key)
        || cfg.columns.find(c => c.key === 'stamina')
        || cfg.columns[0];

    if (rows.length > 0 && sortCol) {
        sortRowsBy(rows, sortCol, state.dir, statsMap);
    }

    const { filtered, highlight } = applyNickFilter(rows, nickFilter);

    buildTable(cfg, filtered, prevIndex, statsMap, head, body, 'stamina', state, highlight);
}

/* ============================================================
   Видимость основной / стойкости по подтипу
   ============================================================ */
function applySubtypeVisibility() {
    const mainArea    = document.getElementById('captureArea');
    const staminaArea = document.getElementById('staminaArea');
    if (currentType === 'assault' && currentSubtype === 'stamina') {
        mainArea.style.display    = 'none';
        staminaArea.style.display = '';
    } else {
        mainArea.style.display    = '';
        staminaArea.style.display = 'none';
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

function updateSubtypeSelector() {
    if (!subTypeSelEl) return;
    subTypeSelEl.querySelectorAll('.table-btn[data-subtype]').forEach(b => {
        b.classList.toggle('active', b.dataset.subtype === currentSubtype);
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
        updateHash(currentType);
    } catch (e) {
        console.error(e);
        currentData = null;
        previousData = null;
        headEl.innerHTML = '';
        bodyEl.innerHTML = '';
        countEl.textContent = '0';
        lastUpdEl.textContent = e.message;
        document.getElementById('staminaArea').style.display = 'none';
    }
}

/* ============================================================
   Статистика по нику
   ============================================================ */
async function openNickStats(row) {
    const modal = document.getElementById('nickModal');
    if (!modal || !modal.hidden) return;

    const avatarEl  = document.getElementById('nickModalAvatar');
    const nameEl    = document.getElementById('nickModalName');
    const metaEl    = document.getElementById('nickModalMeta');
    const summaryEl = document.getElementById('nickModalSummary');
    const bodyEl    = document.getElementById('nickModalBody');

    const key = rowKey(row);

    avatarEl.innerHTML = '';
    const avPath = resolveAvatarPath(row);
    if (avPath) {
        const img = document.createElement('img');
        img.src = avPath;
        img.alt = '';
        avatarEl.appendChild(img);
    }
    nameEl.textContent = maskNick(row.nick);
    metaEl.textContent = currentType === 'assault' ? 'Опасный Штурм' : 'Оборона Шиюй';

    summaryEl.innerHTML = '<div class="nick-stat nick-stat-wide">Загрузка…</div>';
    bodyEl.innerHTML = '';
    modal.hidden = false;

    const files = manifest[currentType].files;
    const folder = manifest[currentType].folder;
    const field = currentType === 'assault' ? 'test' : 'points';
    const fieldLabel = currentType === 'assault' ? 'Испытание' : 'Очки';

    const history = [];
    for (const f of files) {
        try {
            const data = await fetchJSON(`${folder}/${encodeURIComponent(f.file)}`);
            const rows = data.rows || [];
            const playerRow = rows.find(r => rowKey(r) === key);
            if (!playerRow) continue;

            const ranked = computeRanking(rows, field);
            const stats = ranked.get(playerRow) || {};

            let staminaRank = null;
            let staminaPct = null;
            if (currentType === 'assault' && num(playerRow.stamina) != null) {
                const stRows = rows.filter(r => num(r.stamina) != null);
                const stRanked = computeRanking(stRows, 'stamina');
                const stStats = stRanked.get(playerRow) || {};
                staminaRank = stStats.rank;
                staminaPct = stStats.pct;
            }

            history.push({
                title: f.title,
                savedAt: f.savedAt,
                value: num(playerRow[field]),
                stamina: num(playerRow.stamina),
                rank: stats.rank,
                staminaRank,
            });
        } catch (e) {
            console.warn('Не загружено:', f.file);
        }
    }

    if (history.length === 0) {
        summaryEl.innerHTML = '<div class="nick-stat nick-stat-wide">Нет данных по игроку</div>';
        return;
    }

    history.sort((a, b) => (Date.parse(b.savedAt) || 0) - (Date.parse(a.savedAt) || 0));

    const values = history.map(h => h.value).filter(v => v != null);
    const ranks = history.map(h => h.rank).filter(r => r != null);
    const bestValue = values.length ? Math.max(...values) : null;
    const avgValue = values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : null;
    const bestRank = ranks.length ? Math.min(...ranks) : null;

    summaryEl.innerHTML = `
        <div class="nick-stat">
            <div class="nick-stat-label">Таблиц</div>
            <div class="nick-stat-value">${history.length}</div>
        </div>
        <div class="nick-stat">
            <div class="nick-stat-label">Лучший</div>
            <div class="nick-stat-value">${bestValue != null ? fmtInt(bestValue) : '—'}</div>
        </div>
        <div class="nick-stat">
            <div class="nick-stat-label">Средний</div>
            <div class="nick-stat-value">${avgValue != null ? fmtInt(avgValue) : '—'}</div>
        </div>
        <div class="nick-stat">
            <div class="nick-stat-label">Лучший ранг</div>
            <div class="nick-stat-value">${bestRank != null ? '#' + bestRank : '—'}</div>
        </div>
    `;

    bodyEl.innerHTML = '';
    for (let i = 0; i < history.length; i++) {
        const h = history[i];
        const prev = history[i + 1];
        const rowEl = document.createElement('div');
        rowEl.className = 'nick-history-row';

        const dateEl = document.createElement('div');
        dateEl.className = 'nick-history-date';
        dateEl.textContent = shortDate(h.title, h.title);
        rowEl.appendChild(dateEl);

        // Основное поле
        const line1 = document.createElement('div');
        line1.className = 'nick-history-line';
        line1.innerHTML = `
            <span class="nick-history-label">${fieldLabel}</span>
            <span class="nick-history-value">${h.value != null ? fmtInt(h.value) : '—'}</span>
            <span class="nick-history-rank">${h.rank != null ? '#' + h.rank : '—'}</span>
        `;
        if (prev && prev.value != null && h.value != null && h.value !== prev.value) {
            const diff = h.value - prev.value;
            const span = document.createElement('span');
            span.className = 'cell-diff ' + (diff > 0 ? 'positive' : 'negative');
            span.textContent = (diff > 0 ? '+' : '−') + fmtInt(Math.abs(diff));
            line1.appendChild(span);
        }
        rowEl.appendChild(line1);

        // Стойкость (только assault)
        if (currentType === 'assault' && h.stamina != null) {
            const line2 = document.createElement('div');
            line2.className = 'nick-history-line';
            line2.innerHTML = `
                <span class="nick-history-label">Стойкость</span>
                <span class="nick-history-value">${fmtInt(h.stamina)}</span>
                <span class="nick-history-rank">${h.staminaRank != null ? '#' + h.staminaRank : '—'}</span>
            `;
            if (prev && prev.stamina != null && prev.stamina !== h.stamina) {
                const diff = h.stamina - prev.stamina;
                const span = document.createElement('span');
                span.className = 'cell-diff ' + (diff > 0 ? 'positive' : 'negative');
                span.textContent = (diff > 0 ? '+' : '−') + fmtInt(Math.abs(diff));
                line2.appendChild(span);
            }
            rowEl.appendChild(line2);
        }

        bodyEl.appendChild(rowEl);
    }
}

/* ============================================================
   Стикеры
   ============================================================ */
async function loadStickers() {
    const grid = document.getElementById('stickerGrid');
    if (!grid) return;
    let items;
    try {
        items = await fetchJSON('content/stickers.json');
    } catch (e) {
        console.warn('Не удалось загрузить stickers.json:', e.message);
        grid.innerHTML = '<span class="empty-selector">stickers.json не найден</span>';
        return;
    }
    if (!Array.isArray(items) || items.length === 0) {
        grid.innerHTML = '<span class="empty-selector">Список стикеров пуст</span>';
        return;
    }
    grid.innerHTML = '';
    for (const item of items) {
        const href    = String(item.href || '').trim();
        const deleted = item.deleted === true;
        if (!href) continue;
        const a = document.createElement('a');
        a.className = 'sticker-card' + (deleted ? ' deleted' : '');
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener';
        const n = document.createElement('span');
        n.className = 'sticker-name';
        n.textContent = item.name || '—';
        a.appendChild(n);
        const u = document.createElement('span');
        u.className = 'sticker-url';
        u.textContent = item.url || '';
        a.appendChild(u);
        grid.appendChild(a);
    }
}

/* ============================================================
   Базы Зюзиков
   ============================================================ */
async function loadBases() {
    const tbody = document.getElementById('basesBody');
    if (!tbody) return;
    let items;
    try {
        items = await fetchJSON('content/bases.json');
    } catch (e) {
        console.warn('Не удалось загрузить bases.json:', e.message);
        tbody.innerHTML = '<tr><td colspan="2" class="empty-cell">bases.json не найден</td></tr>';
        return;
    }
    if (!Array.isArray(items) || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" class="empty-cell">Список баз пуст</td></tr>';
        return;
    }
    tbody.innerHTML = '';
    for (const item of items) {
        const tr = document.createElement('tr');
        const tdName = document.createElement('td');
        tdName.className = 'bases-name-cell';
        tdName.textContent = item.name || '';
        tr.appendChild(tdName);
        const tdCode = document.createElement('td');
        tdCode.className = 'bases-code-cell';
        tdCode.textContent = item.code || '';
        tr.appendChild(tdCode);
        tbody.appendChild(tr);
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
        items = await fetchJSON('content/altars.json');
    } catch (e) {
        console.warn('Не удалось загрузить altars.json:', e.message);
        grid.innerHTML = '<span class="empty-selector">altars.json не найден</span>';
        return;
    }
    if (!Array.isArray(items) || items.length === 0) {
        grid.innerHTML = '<span class="empty-selector">Список алтарей пуст</span>';
        return;
    }
    items = items.slice().sort((a, b) => {
        const av = parseFloat(a.version) || 0;
        const bv = parseFloat(b.version) || 0;
        return av - bv;
    });
    grid.innerHTML = '';
    for (const item of items) {
        const src     = String(item.src || '').trim();
        const name    = String(item.name || '').trim();
        const missing = item.missing === true;
        if (!missing && !src) continue;
        const video = !missing && isVideoUrl(src);
        const isPending = !missing && item.finalized === 0;
        const btn = document.createElement('button');
        if (missing) {
            btn.className = 'altar-card missing';
            btn.disabled = true;
        } else {
            btn.className = 'altar-card ' + (isPending ? 'pending' : 'finalized');
            btn.dataset.src  = src;
            btn.dataset.type = video ? 'video' : 'image';
        }
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
        tag.textContent = missing ? '—' : (video ? 'MP4' : 'PNG');
        btn.appendChild(tag);
        grid.appendChild(btn);
    }
}

/* ============================================================
   Полезные ссылки
   ============================================================ */
async function loadLinks() {
    const grid = document.getElementById('linksGrid');
    if (!grid) return;
    let items;
    try {
        items = await fetchJSON('content/links.json');
    } catch (e) {
        console.warn('Не удалось загрузить links.json:', e.message);
        grid.innerHTML = '<span class="empty-selector">links.json не найден</span>';
        return;
    }
    if (!Array.isArray(items) || items.length === 0) {
        grid.innerHTML = '<span class="empty-selector">Список ссылок пуст</span>';
        return;
    }
    grid.innerHTML = '';
    for (const cat of items) {
        const links = Array.isArray(cat.links) ? cat.links : [];
        for (const link of links) {
            const href = String(link.url || '').trim();
            if (!href) continue;
            const a = document.createElement('a');
            a.className = 'link-btn';
            a.href = href;
            a.target = '_blank';
            a.rel = 'noopener';
            const catEl = document.createElement('span');
            catEl.className = 'link-btn-cat';
            catEl.textContent = cat.category || '';
            a.appendChild(catEl);
            const name = document.createElement('span');
            name.className = 'link-btn-name';
            name.textContent = link.name || href;
            a.appendChild(name);
            grid.appendChild(a);
        }
    }
}

/* ============================================================
   Напоминание 19:00 МСК
   ============================================================ */
const MSK_REMINDER_KEY = 'msk19_reminder_date';

function getMskParts() {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Moscow',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', hour12: false
    }).formatToParts(new Date());
    const get = t => parts.find(p => p.type === t)?.value;
    return {
        date: `${get('year')}-${get('month')}-${get('day')}`,
        hour: parseInt(get('hour'), 10)
    };
}

function checkMskReminder() {
    const { date, hour } = getMskParts();
    if (hour !== 19) return;
    try {
        if (localStorage.getItem(MSK_REMINDER_KEY) === date) return;
        localStorage.setItem(MSK_REMINDER_KEY, date);
    } catch (e) {}
    const modal = document.getElementById('mskModal');
    if (!modal) return;
    const img = modal.querySelector('img[data-src]');
    if (img && !img.src) img.src = img.dataset.src;
    modal.hidden = false;
}

/* ============================================================
   Хелпер закрытия модалок
   ============================================================ */
function attachModalDismiss(modalEl, closeBtn, clickTargets) {
    if (!modalEl) return () => {};
    const targets = clickTargets || [modalEl];
    const close = () => {
        modalEl.hidden = true;
        modalEl.dispatchEvent(new CustomEvent('modal:closed'));
    };
    if (closeBtn) closeBtn.addEventListener('click', close);
    modalEl.addEventListener('click', (e) => {
        if (targets.includes(e.target)) close();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modalEl.hidden) close();
    });
    return close;
}

function bindMskModal() {
    const modal    = document.getElementById('mskModal');
    const closeBtn = document.getElementById('mskModalClose');
    if (!modal) return;
    attachModalDismiss(modal, closeBtn);
}

function bindNickModal() {
    const modal    = document.getElementById('nickModal');
    const closeBtn = document.getElementById('nickModalClose');
    if (!modal) return;
    attachModalDismiss(modal, closeBtn);
}

function bindAltars() {
    const modal    = document.getElementById('altarModal');
    const body     = document.getElementById('altarModalBody');
    const nameEl   = document.getElementById('altarModalName');
    const closeBtn = document.getElementById('altarModalClose');
    const prevBtn  = document.getElementById('altarModalPrev');
    const nextBtn  = document.getElementById('altarModalNext');
    const grid     = document.getElementById('altarGrid');
    if (!modal || !body || !grid) return;

    let cardsList = [];
    let currentIdx = -1;

    attachModalDismiss(modal, closeBtn, [modal, body]);
    modal.addEventListener('modal:closed', () => {
        body.innerHTML = '';
        nameEl.textContent = '';
        grid.querySelectorAll('.altar-card').forEach(c => c.classList.remove('active'));
        cardsList = [];
        currentIdx = -1;
    });

    const missingCb = document.getElementById('showMissing');
    if (missingCb) {
        missingCb.addEventListener('change', () => {
            grid.classList.toggle('show-missing', missingCb.checked);
        });
    }

    function openModal(card) {
        if (!card || !card.dataset.src) return;
        grid.querySelectorAll('.altar-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        cardsList = Array.from(grid.querySelectorAll('.altar-card')).filter(c => {
            return c.offsetParent !== null && c.dataset.src;
        });
        currentIdx = cardsList.indexOf(card);

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

    function goToNext(dir) {
        if (cardsList.length < 2 || currentIdx < 0) return;
        const nextIdx = (currentIdx + dir + cardsList.length) % cardsList.length;
        openModal(cardsList[nextIdx]);
    }

    // Обновить видимость стрелок (скрыть, если карточек < 2)
    function updateNavVisibility() {
        const show = cardsList.length >= 2;
        if (prevBtn) prevBtn.style.display = show ? '' : 'none';
        if (nextBtn) nextBtn.style.display = show ? '' : 'none';
    }

    // Клик на карточку
    grid.addEventListener('click', (e) => {
        const card = e.target.closest('.altar-card');
        if (!card) return;
        if (card.classList.contains('active')) {
            modal.hidden = true;
            modal.dispatchEvent(new CustomEvent('modal:closed'));
        } else {
            openModal(card);
            updateNavVisibility();
        }
    });

    // Клик по стрелкам
    if (prevBtn) prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        goToNext(-1);
    });
    if (nextBtn) nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        goToNext(1);
    });

    // Клавиши ← →
    document.addEventListener('keydown', (e) => {
        if (modal.hidden) return;
        if (e.target.tagName === 'INPUT' || e.target.isContentEditable) return;
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        if (cardsList.length < 2) return;
        e.preventDefault();
        goToNext(e.key === 'ArrowLeft' ? -1 : 1);
    });
}

/* ============================================================
   Навигация
   ============================================================ */
function showSection(section) {
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.section === section);
    });
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    document.body.className = 'index-page ' + section;

    if (section === 'bases') {
        document.getElementById('viewBases').classList.add('active');
        lastUpdEl.textContent = '—';
        updateHash(section);
        return;
    }
    if (section === 'stickers') {
        document.getElementById('viewStickers').classList.add('active');
        lastUpdEl.textContent = '—';
        updateHash(section);
        return;
    }
    if (section === 'altars') {
        document.getElementById('viewAltars').classList.add('active');
        lastUpdEl.textContent = '—';
        updateHash(section);
        return;
    }
    if (section === 'links') {
        document.getElementById('viewLinks').classList.add('active');
        lastUpdEl.textContent = '—';
        updateHash(section);
        return;
    }

    currentType = section;

    if (section === 'assault') {
        subTypeSelEl.style.display = '';
        updateSubtypeSelector();
    } else {
        subTypeSelEl.style.display = 'none';
        currentSubtype = 'test';
    }

    document.getElementById('viewTables').classList.add('active');
    renderTableSelector();

    const files = manifest?.[currentType]?.files || [];
    if (files.length > 0) {
        const targetFile = selectedFiles[currentType] || files[0].file;
        loadTable(targetFile);
    } else {
        headEl.innerHTML = '';
        bodyEl.innerHTML = '';
        countEl.textContent = '0';
        lastUpdEl.textContent = '—';
        document.getElementById('staminaArea').style.display = 'none';
    }
}

/* ============================================================
   Share + Toast
   ============================================================ */
function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

async function copyShareLink() {
    const url = location.href;
    try {
        await navigator.clipboard.writeText(url);
        showToast('Ссылка скопирована');
    } catch (e) {
        prompt('Скопируйте ссылку:', url);
    }
}

/* ============================================================
   Обработчики
   ============================================================ */
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showSection(btn.dataset.section));
});

if (subTypeSelEl) {
    subTypeSelEl.querySelectorAll('.table-btn[data-subtype]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.subtype === currentSubtype) return;
            currentSubtype = btn.dataset.subtype;
            updateSubtypeSelector();
            render();
            updateHash(currentType);
        });
    });
}

if (nickFilterEl) {
    nickFilterEl.addEventListener('input', (e) => {
        nickFilter = e.target.value;
        render();
    });
}

const shareBtn = document.getElementById('shareBtn');
if (shareBtn) shareBtn.addEventListener('click', copyShareLink);

/* ============================================================
   Старт
   ============================================================ */
(async function init() {
    bindAltars();
    bindMskModal();
    bindNickModal();
    checkMskReminder();
    setInterval(checkMskReminder, 60 * 1000);

    if (location.protocol === 'file:') {
        lastUpdEl.textContent = 'Открой через start_server.bat (localhost)';
        document.querySelectorAll('.nav-btn').forEach(b => b.disabled = true);
        return;
    }

    try {
        manifest = await fetchJSON('content/manifest.json');
    } catch (e) {
        console.error(e);
        lastUpdEl.textContent = 'Ошибка manifest.json: ' + e.message;
        return;
    }

    await Promise.all([loadBases(), loadStickers(), loadAltars(), loadLinks()]);

    // Восстановление из hash
    const initial = parseHash();
    if (initial) {
        if (initial.section === 'assault' || initial.section === 'defence') {
            if (initial.subtype) currentSubtype = initial.subtype;
            const files = manifest[initial.section].files || [];
            if (initial.file) {
                const match = files.find(f =>
                    f.file.replace(/\.json$/i, '') === initial.file
                    || f.file === initial.file
                );
                if (match) selectedFiles[initial.section] = match.file;
            }
        }
        showSection(initial.section);
    } else {
        showSection('bases');
    }
})();