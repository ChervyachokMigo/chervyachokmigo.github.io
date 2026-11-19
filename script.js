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
let deltaFilter    = null;   // null | 'grew' | 'fell' | 'new' | 'back'

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
function titleDateVal(title) {
    const m = String(title || '').match(/(\d{1,2})[\s_\-]+(\d{1,2})[\s_\-]+(\d{4})/);
    if (!m) return 0;
    return Date.UTC(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
}
function isVideoUrl(url) {
    return /\.(mp4|webm|mov|mkv)(\?.*)?$/i.test(String(url || ''));
}
/* ============================================================
   Кеш JSON (localStorage, TTL)
   ============================================================ */
const CACHE_TTL_MS = 60 * 60 * 1000;   // 1 час — для таблиц
const CACHE_TTL_SHORT_MS = 15 * 60 * 1000;   // 15 минут — для altars/stickers/bases/links
const CACHE_PREFIX = 'cache_v2:';

async function fetchJSON(url, opts = {}) {
    const { ttl = 0, bustCache = false, noFallback = false } = opts;
    const cacheKey = CACHE_PREFIX + url;
    let cached = null;

    if (ttl > 0) {
        try {
            const raw = localStorage.getItem(cacheKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.ts && parsed.data) {
                    cached = parsed;
                    if (!bustCache && Date.now() - parsed.ts < ttl) {
                        return parsed.data;
                    }
                }
            }
        } catch (e) {}
    }

    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
        const data = await res.json();
        if (ttl > 0) {
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
            } catch (e) {}
        }
        return data;
    } catch (e) {
        if (cached && !noFallback) {
            console.warn('Fetch failed, using stale cache:', url);
            return cached.data;
        }
        throw e;
    }
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
   Полный кеш всех таблиц (для истории: NEW/BACK, сводка, статистика)
   ============================================================ */
let allTablesCache = null;

async function preloadAllTables(bust = false) {
    if (allTablesCache && !bust) return allTablesCache;
    const items = [];
    if (manifest.assault?.files) {
        for (const f of manifest.assault.files) {
            items.push({ type: 'assault', meta: f, folder: manifest.assault.folder });
        }
    }
    if (manifest.defence?.files) {
        for (const f of manifest.defence.files) {
            items.push({ type: 'defence', meta: f, folder: manifest.defence.folder });
        }
    }
    const opts = bust
        ? { ttl: CACHE_TTL_MS, bustCache: true, noFallback: true }
        : { ttl: CACHE_TTL_MS };
    const results = await Promise.all(items.map(async (item) => {
        try {
            const data = await fetchJSON(
                `${item.folder}/${encodeURIComponent(item.meta.file)}`,
                opts
            );
            return { type: item.type, meta: item.meta, data };
        } catch (e) {
            console.warn('Не загружено:', item.meta.file, e.message);
            return null;
        }
    }));
    allTablesCache = results.filter(Boolean);
    return allTablesCache;
}

function getHistoryKeysForFile(type, fileName) {
    const prevKeys = new Set();
    const olderKeys = new Set();
    if (!allTablesCache || !fileName) return { prevKeys, olderKeys };
    const files = manifest?.[type]?.files || [];
    const idx = files.findIndex(f => f.file === fileName);
    if (idx < 0) return { prevKeys, olderKeys };

    const findTable = (file) =>
        allTablesCache.find(t => t.type === type && t.meta.file === file);

    const prevFile = files[idx + 1]?.file;
    if (prevFile) {
        const item = findTable(prevFile);
        if (item?.data?.rows) {
            for (const r of item.data.rows) prevKeys.add(rowKey(r));
        }
    }
    for (let i = idx + 2; i < files.length; i++) {
        const item = findTable(files[i].file);
        if (item?.data?.rows) {
            for (const r of item.data.rows) olderKeys.add(rowKey(r));
        }
    }
    return { prevKeys, olderKeys };
}

function computeSummary(currentRows, prevRows, field, olderKeys) {
    // Ранги: в текущей и предыдущей
    const curRanking  = computeRanking(currentRows, field);
    const prevRanking = computeRanking(prevRows, field);

    const prevValueByKey = new Map();
    for (const r of prevRows) {
        const v = num(r[field]);
        if (v != null) prevValueByKey.set(rowKey(r), v);
    }

    const prevRankByKey = new Map();
    for (const [r, s] of prevRanking) {
        if (s.rank != null) prevRankByKey.set(rowKey(r), s.rank);
    }

    let grew = 0, fell = 0, same = 0, newCount = 0, backCount = 0;
    const pointDeltas = [];
    const curKeys = new Set();

    for (const r of currentRows) {
        const v = num(r[field]);
        if (v == null) continue;
        const key = rowKey(r);
        curKeys.add(key);

        const curRank  = curRanking.get(r)?.rank;
        const prevRank = prevRankByKey.get(key);

        // Классификация по ИЗМЕНЕНИЮ МЕСТА
        if (prevRank != null && curRank != null) {
            if (curRank < prevRank)      grew++;   // поднялся (место стало меньше)
            else if (curRank > prevRank) fell++;   // опустился
            else                          same++;  // место не изменилось
        } else if (olderKeys && olderKeys.has(key)) {
            backCount++;
        } else {
            newCount++;
        }

        // Для среднего — изменение ОЧКОВ (не места)
        const prevV = prevValueByKey.get(key);
        if (prevV != null) pointDeltas.push(v - prevV);
    }

    let leftCount = 0;
    for (const k of prevRankByKey.keys()) if (!curKeys.has(k)) leftCount++;

    let avg = null;
    if (pointDeltas.length) {
        avg = Math.round(pointDeltas.reduce((a, b) => a + b, 0) / pointDeltas.length);
    }
    return { grew, fell, same, newCount, backCount, leftCount, avg };
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

        if (section === 'stats' && parts[1]) {
            return { section: 'stats', id: parts[1] };
        }

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
function applyFilters(rows, statsMap, prevRankMap, olderKeys) {
    function deltaType(row) {
        const key = rowKey(row);
        const curRank = statsMap.get(row)?.rank;
        const prevRank = prevRankMap ? prevRankMap.get(key) : null;
        if (prevRank != null && curRank != null) {
            if (curRank < prevRank) return 'grew';
            if (curRank > prevRank) return 'fell';
            return 'same';
        }
        if (olderKeys && olderKeys.has(key)) return 'back';
        return 'new';
    }

    // Шаг 1: фильтр по типу дельты
    const base = deltaFilter
        ? rows.filter(r => deltaType(r) === deltaFilter)
        : rows;

    // Шаг 2: фильтр по нику
    const q = nickFilter.trim().toLowerCase();
    if (!q) {
        return { filtered: base, highlight: new Set() };
    }

    const matches = base.filter(r => String(r.nick || '').toLowerCase().includes(q));
    const highlight = new Set(matches);

    // Если активен ещё и delta-фильтр — без соседей
    if (deltaFilter) {
        return { filtered: matches, highlight };
    }

    // Только ник — с ±2 соседями и разделителями
    if (matches.length === 0) {
        return { filtered: [], highlight };
    }

    const matchIndices = new Set();
    base.forEach((r, i) => {
        if (String(r.nick || '').toLowerCase().includes(q)) matchIndices.add(i);
    });

    const keep = new Set();
    for (const idx of matchIndices) {
        for (let i = idx - 2; i <= idx + 2; i++) {
            if (i >= 0 && i < base.length) keep.add(i);
        }
    }

    const keepArr = [...keep].sort((a, b) => a - b);
    const filtered = [];
    for (let i = 0; i < keepArr.length; i++) {
        if (i > 0 && keepArr[i] - keepArr[i - 1] > 1) {
            filtered.push({ __gap: true });
        }
        filtered.push(base[keepArr[i]]);
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
    if (diff === 0) {
        const span = document.createElement('span');
        span.className = 'cell-diff same';
        span.textContent = '±0';
        span.title = 'Значение не изменилось';
        td.appendChild(span);
        return;
    }
    const span = document.createElement('span');
    span.className = 'cell-diff ' + (diff > 0 ? 'positive' : 'negative');
    span.textContent = (diff > 0 ? '+' : '−') + fmtInt(Math.abs(diff));
    td.appendChild(span);
}

/* ============================================================
   Универсальный рендер таблицы
   ============================================================ */
function buildTable(cfg, rows, prevIndex, prevRankMap, statsMap, headTarget, bodyTarget, tableId, state, highlight, olderKeys) {
    headTarget.innerHTML = '';
    const trh = document.createElement('tr');
    const HEAD_TIPS = {
        rating: 'ТОП: процент игроков, которых ты обгоняешь. Под значением — изменение позиции',
        nick:   'Ник в таблице (маска из первой и последней букв). Клик — статистика игрока',
        test:   'ИСПЫТАНИЕ: очки за Опасный Штурм - Испытание. Под значением — разница с прошлой таблицей',
        stamina:'СТОЙКОСТЬ: очки за Опасный Штурм - Стойкость. Под значением — разница с прошлой таблицей',
        points: 'ОЧКИ: набрано за Оборону Шиюй. Под значением — разница с прошлой таблицей',
        avg:    'ОТ СРЕДНЕГО: отношение значения к среднему по таблице.',
    };

    for (const col of cfg.columns) {
        const th = document.createElement('th');
        if (col.thClass) th.className = col.thClass;
        th.textContent = col.label;
        if (HEAD_TIPS[col.key]) th.title = HEAD_TIPS[col.key];
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

        if (stats.avg != null && stats.avg > 100) {
            tr.classList.add('top-row');
        }
        if (highlight && highlight.has(row)) {
            tr.classList.add('nick-match');
        }

        for (const col of cfg.columns) {
            const td = document.createElement('td');
            if (col.tdClass) td.className = col.tdClass;

            switch (col.role) {
                case 'rating': {
                    td.textContent = formatPercent(stats.pct);
                    if (stats.rank != null) {
                        td.title = `Место #${stats.rank} (топ-${formatPercent(stats.pct)})`;

                        const key = rowKey(row);
                        const curRank = stats.rank;
                        const prevRank = prevRankMap ? prevRankMap.get(key) : null;

                        if (prevRank != null) {
                            const delta = prevRank - curRank;
                            if (delta !== 0) {
                                const span = document.createElement('span');
                                span.className = 'rank-diff ' + (delta > 0 ? 'positive' : 'negative');
                                span.textContent = (delta > 0 ? '↑' : '↓') + Math.abs(delta);
                                span.title = delta > 0
                                    ? `Место улучшилось: было #${prevRank}, стало #${curRank} (+${delta})`
                                    : `Место ухудшилось: было #${prevRank}, стало #${curRank} (−${Math.abs(delta)})`;
                                td.appendChild(span);
                            } else {
                                const span = document.createElement('span');
                                span.className = 'rank-diff same';
                                span.textContent = '=';
                                span.title = `Место не изменилось (#${curRank})`;
                                td.appendChild(span);
                            }
                        } else {
                            const isBack = olderKeys && olderKeys.has(key);
                            const badge = document.createElement('span');
                            badge.className = 'rank-badge ' + (isBack ? 'back' : 'new');
                            badge.textContent = isBack ? 'BACK' : 'NEW';
                            badge.title = isBack
                                ? 'Вернулся — был в более старых таблицах, но отсутствовал в прошлой'
                                : 'Новый — не было ни в одной прошлой таблице';
                            td.appendChild(badge);
                        }
                    }
                    break;
                }

                case 'avatar':
                    renderAvatarCell(td, row);
                    break;

                case 'nick':
                    td.textContent = maskNick(row.nick);
                    td.title = 'Посмотреть статистику игрока (все таблицы, история)';
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

                case 'avg': {
                    td.textContent = formatPercent(stats.avg);
                    if (stats.avg != null) {
                        const delta = Math.round(stats.avg - 100);
                        td.title = delta > 0
                            ? `На ${delta}% выше среднего по таблице`
                            : delta < 0
                                ? `На ${Math.abs(delta)}% ниже среднего по таблице`
                                : 'Ровно среднее значение';
                    }
                    break;
                }

                default:
                    td.textContent = row[col.key] ?? '';
            }

            tr.appendChild(td);
        }
        bodyTarget.appendChild(tr);
    }

    bodyTarget.classList.remove('table-anim');
    void bodyTarget.offsetWidth;
    bodyTarget.classList.add('table-anim');
}

/* ============================================================
   Обновление UI фильтра (рамка, счётчик, кнопка сброса)
   ============================================================ */
function updateFilterUI() {
    const wrap     = document.getElementById('nickFilterWrap');
    const clearBtn = document.getElementById('nickFilterClear');
    const statusEl = document.getElementById('nickFilterStatus');
    if (!wrap || !clearBtn || !statusEl) return;

    const q = nickFilter.trim();
    const active = q.length > 0;

    wrap.classList.toggle('filter-active', active);
    clearBtn.hidden = !active;

    if (active) {
        const rows = (currentData?.rows || []);
        const matches = rows.filter(r =>
            String(r.nick || '').toLowerCase().includes(q.toLowerCase())
        ).length;
        statusEl.textContent = matches > 0 ? `${matches} найдено` : 'нет совпадений';
        statusEl.hidden = false;
    } else {
        statusEl.hidden = true;
        statusEl.textContent = '';
    }

    // Delta-status
    const deltaStatusEl = document.getElementById('deltaStatus');
    if (deltaStatusEl) {
        if (deltaFilter) {
            let bodyToCheck = bodyEl;
            if (currentType === 'assault' && currentSubtype === 'stamina') {
                bodyToCheck = document.getElementById('staminaBody') || bodyEl;
            }
            const cnt = bodyToCheck.querySelectorAll(
                'tr:not(.gap-row):not(.loading-row):not(.error-row)'
            ).length;
            deltaStatusEl.textContent = cnt > 0 ? `${cnt} шт.` : 'пусто';
            deltaStatusEl.hidden = false;
        } else {
            deltaStatusEl.hidden = true;
            deltaStatusEl.textContent = '';
        }
    }
}
/* ============================================================
   Сводка изменений над таблицей
   ============================================================ */
function updateSummary() {
    const el = document.getElementById('tableSummary');
    if (!el) return;

    if (!currentData || !previousData || nickFilter.trim() || deltaFilter) {
        el.hidden = true;
        return;
    }

    let field;
    if (currentType === 'assault') {
        field = currentSubtype === 'stamina' ? 'stamina' : 'test';
    } else {
        field = 'points';
    }

    const { olderKeys } = getHistoryKeysForFile(currentType, currentFile);
    const s = computeSummary(currentData.rows || [], previousData.rows || [], field, olderKeys);

    const total = s.grew + s.fell + s.same + s.newCount + s.backCount + s.leftCount;
    if (total === 0) { el.hidden = true; return; }

    const prevDate = previousData.title ? shortDate(previousData.title, '') : '—';

    el.innerHTML = '';

    const mk = (cls, text, title) => {
        const sp = document.createElement('span');
        sp.className = 'sum-item ' + cls;
        sp.textContent = text;
        if (title) sp.title = title;
        return sp;
    };

    const dateItem = mk('sum-prev-date', prevDate);
    dateItem.title = 'Сравнение с таблицей от ' + prevDate;
    el.appendChild(dateItem);
    if (s.grew > 0) el.appendChild(mk('sum-up', s.grew + ' ↑', 'Поднялись в рейтинге (место улучшилось)'));
    if (s.fell > 0) el.appendChild(mk('sum-down', s.fell + ' ↓', 'Опустились в рейтинге (место ухудшилось)'));
    if (s.same > 0) el.appendChild(mk('sum-same', s.same + ' =', 'Место не изменилось'));
    if (s.newCount > 0) el.appendChild(mk('sum-new', s.newCount + ' новых', 'Новые игроки'));
    if (s.backCount > 0) el.appendChild(mk('sum-back', s.backCount + ' верн.', 'Вернулись после пропуска'));
    if (s.leftCount > 0) el.appendChild(mk('sum-left', s.leftCount + ' ушли', 'Пропали из таблицы'));

    if (s.avg != null && s.avg !== 0) {
        el.appendChild(mk(
            'sum-avg ' + (s.avg > 0 ? 'positive' : 'negative'),
            (s.avg > 0 ? '+' : '') + fmtInt(s.avg) + ' очк. ср.',
            'Среднее изменение очков'
        ));
    }

    el.hidden = false;
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

    // Ранги из предыдущей таблицы
    const prevRankMap = new Map();
    if (previousData?.rows?.length) {
        const prevStats = computeRanking(previousData.rows, cfg.sortField);
        for (const [r, s] of prevStats) {
            if (s.rank != null) prevRankMap.set(rowKey(r), s.rank);
        }
    }

    // Игроки, которые были в таблицах старше предыдущей
    const { olderKeys } = getHistoryKeysForFile(currentType, currentFile);

    const sortCol = cfg.columns.find(c => c.key === state.key)
        || cfg.columns.find(c => c.key === cfg.sortField)
        || cfg.columns[0];

    if (rows.length > 0 && sortCol) {
        sortRowsBy(rows, sortCol, state.dir, statsMap);
    }

    const { filtered, highlight } = applyFilters(rows, statsMap, prevRankMap, olderKeys);

    buildTable(cfg, filtered, prevIndex, prevRankMap, statsMap, headEl, bodyEl, currentType, state, highlight, olderKeys);
    countEl.textContent = (currentData?.rows || []).length;

    const participantsLine = document.querySelector('.participants-line');
    if (participantsLine) participantsLine.classList.remove('is-loading');

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
    updateFilterUI();
    updateSummary();
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

    const prevRankMap = new Map();
    if (previousData?.rows?.length) {
        const prevRows = previousData.rows.filter(r => num(r.stamina) != null);
        const prevStats = computeRanking(prevRows, 'stamina');
        for (const [r, s] of prevStats) {
            if (s.rank != null) prevRankMap.set(rowKey(r), s.rank);
        }
    }

    const { olderKeys } = getHistoryKeysForFile(currentType, currentFile);

    const sortCol = cfg.columns.find(c => c.key === state.key)
        || cfg.columns.find(c => c.key === 'stamina')
        || cfg.columns[0];

    if (rows.length > 0 && sortCol) {
        sortRowsBy(rows, sortCol, state.dir, statsMap);
    }

    const { filtered, highlight } = applyFilters(rows, statsMap, prevRankMap, olderKeys);

    buildTable(cfg, filtered, prevIndex, prevRankMap, statsMap, head, body, 'stamina', state, highlight, olderKeys);
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

    // Скрыть строку участников на время загрузки
    const participantsLine = document.querySelector('.participants-line');
    if (participantsLine) participantsLine.classList.add('is-loading');

    // Показать индикатор загрузки
    const loadingRow = `<tr class="loading-row"><td colspan="${CONFIG[currentType].columns.length}">
        <span class="loading-spinner"></span>Загрузка…
    </td></tr>`;
    headEl.innerHTML = '';
    bodyEl.innerHTML = loadingRow;

    const stHead = document.getElementById('staminaHead');
    const stBody = document.getElementById('staminaBody');
    if (stHead) stHead.innerHTML = '';
    if (stBody) {
        stBody.innerHTML = `<tr class="loading-row"><td colspan="5">
            <span class="loading-spinner"></span>Загрузка…
        </td></tr>`;
    }

    const folder = manifest[currentType].folder;
    const url = `${folder}/${encodeURIComponent(fileName)}`;

    try {
        currentData = await fetchJSON(url, { ttl: CACHE_TTL_MS });

        const files = manifest[currentType].files;
        const idx = files.findIndex(f => f.file === fileName);
        const prevFile = files[idx + 1]?.file;

        previousData = null;
        if (prevFile) {
            try {
                previousData = await fetchJSON(`${folder}/${encodeURIComponent(prevFile)}`, { ttl: CACHE_TTL_MS });
            } catch (e) {
                console.warn('Не удалось загрузить предыдущую таблицу:', e.message);
            }
        }

        // Загружаем полную историю для NEW/BACK и сводки (если ещё не в кеше)
        await preloadAllTables();

        render();
        updateHash(currentType);

        const filterMsg = [];
        if (nickFilter.trim()) filterMsg.push('ник: ' + nickFilter.trim());
        if (deltaFilter) {
            const labels = { grew: '↑ рост', fell: '↓ падение', new: 'NEW', back: 'BACK' };
            filterMsg.push(labels[deltaFilter]);
        }
        if (filterMsg.length) showToast('Фильтр: ' + filterMsg.join(' · '));
    } catch (e) {
        console.error(e);
        currentData = null;
        previousData = null;
        headEl.innerHTML = '';
        bodyEl.innerHTML = '';

        const participantsLine = document.querySelector('.participants-line');
        if (participantsLine) participantsLine.classList.remove('is-loading');

        const tr = document.createElement('tr');
        tr.className = 'error-row';
        const td = document.createElement('td');
        td.colSpan = CONFIG[currentType].columns.length;

        const wrap = document.createElement('div');
        wrap.className = 'error-cell';

        const msg = document.createElement('div');
        msg.className = 'error-text';
        msg.textContent = 'Не удалось загрузить: ' + e.message;
        wrap.appendChild(msg);

        const retry = document.createElement('button');
        retry.className = 'error-retry';
        retry.textContent = 'Повторить';
        retry.addEventListener('click', () => loadTable(fileName));
        wrap.appendChild(retry);

        td.appendChild(wrap);
        tr.appendChild(td);
        bodyEl.appendChild(tr);

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
    metaEl.textContent = 'Все таблицы';

    summaryEl.innerHTML = '<div class="nick-stat nick-stat-wide">Загрузка…</div>';
    bodyEl.innerHTML = '';
    modal.hidden = false;

    const statsId = key;
    if (statsId && statsId !== '|') {
        const newHash = `#stats/${encodeURIComponent(statsId)}`;
        if (location.hash !== newHash) {
            history.replaceState(null, '', newHash);
        }
    }

    await preloadAllTables();
    const all = allTablesCache || [];

    const timeline = [];
    const statsTest = [];
    const statsStamina = [];
    const statsPoints = [];

    for (const item of all) {
        const rows = item.data.rows || [];
        const playerRow = rows.find(r => rowKey(r) === key);
        if (!playerRow) continue;

        if (item.type === 'assault') {
            const testVal = num(playerRow.test);
            if (testVal != null) {
                const ranked = computeRanking(rows, 'test');
                const s = ranked.get(playerRow) || {};
                timeline.push({ title: item.meta.title, savedAt: item.meta.savedAt, type: 'test', value: testVal, rank: s.rank });
                statsTest.push(testVal);
            }
            const staminaVal = num(playerRow.stamina);
            if (staminaVal != null) {
                const stRows = rows.filter(r => num(r.stamina) != null);
                const ranked = computeRanking(stRows, 'stamina');
                const s = ranked.get(playerRow) || {};
                timeline.push({ title: item.meta.title, savedAt: item.meta.savedAt, type: 'stamina', value: staminaVal, rank: s.rank });
                statsStamina.push(staminaVal);
            }
        } else {
            const pointsVal = num(playerRow.points);
            if (pointsVal != null) {
                const ranked = computeRanking(rows, 'points');
                const s = ranked.get(playerRow) || {};
                timeline.push({ title: item.meta.title, savedAt: item.meta.savedAt, type: 'points', value: pointsVal, rank: s.rank });
                statsPoints.push(pointsVal);
            }
        }
    }

    if (!timeline.length) {
        summaryEl.innerHTML = '<div class="nick-stat nick-stat-wide">Игрок не найден ни в одной таблице</div>';
        return;
    }

    // Сортировка по ДАТЕ ИЗ НАЗВАНИЯ (не по savedAt), новые сверху.
    // Тай-брейк для одинаковой даты: Испытание → Стойкость → Оборона.
    timeline.sort((a, b) => {
        const da = titleDateVal(a.title);
        const db = titleDateVal(b.title);
        if (da !== db) return db - da;
        const order = { stamina: 0, test: 1, points: 2 };
        return (order[a.type] || 0) - (order[b.type] || 0);
    });

    // Для дельты — предыдущее значение того же типа (следующая по хронологии)
    const prevByType = {};
    for (let i = timeline.length - 1; i >= 0; i--) {
        const t = timeline[i];
        t.prevValue = prevByType[t.type] ?? null;
        prevByType[t.type] = t.value;
    }

    function buildSummaryBlock(label, type, values) {
        if (!values.length) {
            return `<div class="nick-summary-block">
                <div class="nick-summary-title nick-type-${type}">${label}</div>
                <div class="nick-summary-empty">—</div>
            </div>`;
        }
        const best = Math.max(...values);
        const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
        return `<div class="nick-summary-block">
            <div class="nick-summary-title nick-type-${type}">${label}</div>
            <div class="nick-summary-stats">
                <div><span>Лучший</span><b>${fmtInt(best)}</b></div>
                <div><span>Средний</span><b>${fmtInt(avg)}</b></div>
                <div><span>Таблиц</span><b>${values.length}</b></div>
            </div>
        </div>`;
    }

    summaryEl.innerHTML =
        buildSummaryBlock('Стойкость', 'stamina', statsStamina) +
        buildSummaryBlock('Испытание', 'test', statsTest) +
        buildSummaryBlock('Оборона Шиюй', 'points', statsPoints);

    bodyEl.innerHTML = '';

    const typeLabels = {
        test: 'Испытание',
        stamina: 'Стойкость',
        points: 'Оборона',
    };

    for (const t of timeline) {
        const rowEl = document.createElement('div');
        rowEl.className = 'nick-timeline-row';

        const dateEl = document.createElement('div');
        dateEl.className = 'nick-timeline-date';
        dateEl.textContent = shortDate(t.title, t.title);
        rowEl.appendChild(dateEl);

        const typeEl = document.createElement('div');
        typeEl.className = 'nick-timeline-type nick-type-' + t.type;
        typeEl.textContent = typeLabels[t.type];
        rowEl.appendChild(typeEl);

        const valEl = document.createElement('div');
        valEl.className = 'nick-timeline-value';
        valEl.textContent = fmtInt(t.value);
        rowEl.appendChild(valEl);

        const diffEl = document.createElement('div');
        diffEl.className = 'nick-timeline-diff';
        if (t.prevValue == null) {
            diffEl.textContent = '—';
            diffEl.classList.add('muted');
        } else {
            const d = t.value - t.prevValue;
            if (d === 0) {
                diffEl.textContent = '±0';
                diffEl.classList.add('positive');
            } else {
                diffEl.textContent = (d > 0 ? '+' : '−') + fmtInt(Math.abs(d));
                diffEl.classList.add(d > 0 ? 'positive' : 'negative');
            }
        }
        rowEl.appendChild(diffEl);

        const rankEl = document.createElement('div');
        rankEl.className = 'nick-timeline-rank';
        rankEl.textContent = t.rank != null ? '#' + t.rank : '—';
        rowEl.appendChild(rankEl);

        bodyEl.appendChild(rowEl);
    }
}

/* ============================================================
   Стикеры
   ============================================================ */
async function loadStickers(bust = false) {
    const grid = document.getElementById('stickerGrid');
    if (!grid) return;
    let items;
    try {
        items = await fetchJSON('content/stickers.json', {
            ttl: CACHE_TTL_SHORT_MS,
            bustCache: bust,
            noFallback: bust,
        });
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
async function loadBases(bust = false) {
    const tbody = document.getElementById('basesBody');
    if (!tbody) return;
    let items;
    try {
        items = await fetchJSON('content/bases.json', {
            ttl: CACHE_TTL_SHORT_MS,
            bustCache: bust,
            noFallback: bust,
        });
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
async function loadAltars(bust = false) {
    const grid = document.getElementById('altarGrid');
    if (!grid) return;
    let items;
    try {
        items = await fetchJSON('content/altars.json', {
            ttl: CACHE_TTL_SHORT_MS,
            bustCache: bust,
            noFallback: bust,
        });
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
        const src          = String(item.src || '').trim();
        const name         = String(item.name || '').trim();
        const missing      = item.missing === true;
        const videoSrc     = String(item.video || '').trim();
        const designation  = String(item.designation || '').trim();

        if (!missing && !src) continue;

        const srcIsVideo = !missing && isVideoUrl(src);
        const hasVideo = !missing && !srcIsVideo && !!videoSrc;
        const hasDesignation = !missing && !!designation;
        const isPending = !missing && item.finalized === 0;

        const btn = document.createElement('button');
        if (missing) {
            btn.className = 'altar-card missing';
            btn.disabled = true;
        } else {
            btn.className = 'altar-card ' + (isPending ? 'pending' : 'finalized');
            btn.dataset.src = src;
            btn.dataset.type = srcIsVideo ? 'video' : 'image';
            if (hasVideo) btn.dataset.video = videoSrc;
            if (hasDesignation) btn.dataset.designation = designation;
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

        // Теги справа
        const tags = document.createElement('span');
        tags.className = 'altar-tags';

        const primaryTag = document.createElement('span');
        primaryTag.className = 'altar-tag';
        primaryTag.textContent = missing ? '—' : (srcIsVideo ? 'MP4' : 'PNG');
        tags.appendChild(primaryTag);

        if (hasVideo) {
            const t = document.createElement('span');
            t.className = 'altar-tag altar-tag-extra';
            t.textContent = '▶';
            t.title = 'Есть видео-вариант';
            tags.appendChild(t);
        }
        if (hasDesignation) {
            const t = document.createElement('span');
            t.className = 'altar-tag altar-tag-extra';
            t.textContent = '◎';
            t.title = 'Есть обозначения';
            tags.appendChild(t);
        }

        btn.appendChild(tags);
        grid.appendChild(btn);
    }
}

/* ============================================================
   Полезные ссылки
   ============================================================ */
async function loadLinks(bust = false) {
    const grid = document.getElementById('linksGrid');
    if (!grid) return;
    let items;
    try {
        items = await fetchJSON('content/links.json', {
            ttl: CACHE_TTL_SHORT_MS,
            bustCache: bust,
            noFallback: bust,
        });
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
    modal.addEventListener('modal:closed', () => {
        const section = (document.body.className || '').replace('index-page', '').trim() || 'bases';
        updateHash(section);
    });
}
async function refreshCurrent() {
    const btn = document.getElementById('refreshBtn');
    if (btn) btn.classList.add('spinning');

    if (!navigator.onLine) {
        showToast('Нет соединения');
        if (btn) btn.classList.remove('spinning');
        return;
    }

    try {
        manifest = await fetchJSON('content/manifest.json', { ttl: CACHE_TTL_MS, bustCache: true, noFallback: true });
        renderTableSelector();

        allTablesCache = null;
        await preloadAllTables(true);

        // Перезагружаем «редкие» JSON с обходом кеша
        try { await loadBases(true); } catch (e) {}
        try { await loadStickers(true); } catch (e) {}
        try { await loadAltars(true); } catch (e) {}
        try { await loadLinks(true); } catch (e) {}

        // Если сейчас на странице таблицы — перерисовываем её
        const section = (document.body.className || '').replace('index-page', '').trim();
        const onTablesPage = (section === 'assault' || section === 'defence');

        if (onTablesPage && currentFile) {
            const folder = manifest[currentType].folder;
            const url = `${folder}/${encodeURIComponent(currentFile)}`;

            const fresh = await fetchJSON(url, { ttl: CACHE_TTL_MS, bustCache: true, noFallback: true });

            const files = manifest[currentType].files;
            const idx = files.findIndex(f => f.file === currentFile);
            const prevFile = files[idx + 1]?.file;
            let prevFresh = null;
            if (prevFile) {
                try {
                    prevFresh = await fetchJSON(`${folder}/${encodeURIComponent(prevFile)}`, { ttl: CACHE_TTL_MS, bustCache: true, noFallback: true });
                } catch (e) {
                    prevFresh = null;
                }
            }

            currentData = fresh;
            previousData = prevFresh;
            render();
        }

        let msg = 'Данные обновлены';
        if (onTablesPage && nickFilter.trim()) {
            msg += ' · Фильтр: ' + nickFilter.trim();
        }
        showToast(msg);
    } catch (e) {
        console.error('Refresh failed:', e);
        showToast(navigator.onLine ? 'Ошибка обновления' : 'Соединение прервано');
    } finally {
        if (btn) btn.classList.remove('spinning');
    }
}

function bindRefresh() {
    const btn = document.getElementById('refreshBtn');
    if (btn) btn.addEventListener('click', refreshCurrent);
}
function bindScrollTop() {
    const btn = document.getElementById('scrollTopBtn');
    if (!btn) return;

    const toggle = () => {
        btn.classList.toggle('visible', window.scrollY > 400);
    };
    window.addEventListener('scroll', toggle, { passive: true });
    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    toggle();
}
/* ============================================================
   Поиск игрока по ID среди всех загруженных таблиц
   Возвращает самую свежую таблицу, где игрок есть
   ============================================================ */
function findRowById(id) {
    if (!allTablesCache || !id) return null;
    let best = null;
    for (const item of allTablesCache) {
        const rows = item.data.rows || [];
        const found = rows.find(r => rowKey(r) === id);
        if (!found) continue;
        const itemDate = titleDateVal(item.meta.title);
        if (!best || itemDate > best.date) {
            best = { row: found, item, date: itemDate };
        }
    }
    return best;
}

function bindAltars() {
    const modal    = document.getElementById('altarModal');
    const body     = document.getElementById('altarModalBody');
    const nameEl   = document.getElementById('altarModalName');
    const closeBtn = document.getElementById('altarModalClose');
    const prevBtn  = document.getElementById('altarModalPrev');
    const nextBtn  = document.getElementById('altarModalNext');
    const tabsEl   = document.getElementById('altarModalTabs');
    const desigBtn = document.getElementById('altarModalDesignation');
    const desigModal = document.getElementById('designationModal');
    const desigBody  = document.getElementById('designationModalBody');
    const desigName  = document.getElementById('designationModalName');
    const desigClose = document.getElementById('designationModalClose');
    const grid     = document.getElementById('altarGrid');
    if (!modal || !body || !grid) return;

    let cardsList = [];
    let currentIdx = -1;
    let currentCard = null;

    attachModalDismiss(modal, closeBtn, [modal, body]);
    modal.addEventListener('modal:closed', () => {
        body.innerHTML = '';
        nameEl.textContent = '';
        grid.querySelectorAll('.altar-card').forEach(c => c.classList.remove('active'));
        cardsList = [];
        currentIdx = -1;
        currentCard = null;
        if (desigModal) desigModal.hidden = true;
    });

    const missingCb = document.getElementById('showMissing');
    if (missingCb) {
        missingCb.addEventListener('change', () => {
            grid.classList.toggle('show-missing', missingCb.checked);
        });
    }

    function showAltarStub(label) {
        body.innerHTML = '';
        const stub = document.createElement('div');
        stub.className = 'altar-stub';

        const icon = document.createElement('div');
        icon.className = 'altar-stub-icon';
        icon.textContent = '□';

        const text = document.createElement('div');
        text.className = 'altar-stub-text';
        text.textContent = label;

        stub.appendChild(icon);
        stub.appendChild(text);
        body.appendChild(stub);
    }

    function showMedia(view, primarySrc, videoSrc, name) {
        body.innerHTML = '';

        const useVideo = (view === 'video') && !!videoSrc;
        const mediaSrc = useVideo ? videoSrc : primarySrc;
        const isVid = useVideo || isVideoUrl(primarySrc);

        if (isVid) {
            const v = document.createElement('video');
            v.src = mediaSrc;
            v.controls = true;
            v.autoplay = true;
            v.loop = true;
            v.muted = true;
            v.playsInline = true;
            v.addEventListener('error', () => {
                showAltarStub(navigator.onLine ? 'Видео недоступно' : 'Нет соединения');
            });
            body.appendChild(v);
        } else {
            const img = document.createElement('img');
            img.src = mediaSrc;
            img.alt = name;
            img.addEventListener('error', () => {
                showAltarStub(navigator.onLine ? 'Не удалось загрузить' : 'Нет соединения');
            });
            body.appendChild(img);
        }
    }

    function openModal(card) {
        if (!card || !card.dataset.src) return;

        if (desigModal) desigModal.hidden = true;

        grid.querySelectorAll('.altar-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        cardsList = Array.from(grid.querySelectorAll('.altar-card')).filter(c => {
            return c.offsetParent !== null && c.dataset.src;
        });
        currentIdx = cardsList.indexOf(card);
        currentCard = card;

        const src = card.dataset.src;
        const videoSrc = card.dataset.video || '';
        const designation = card.dataset.designation || '';
        const name = card.querySelector('.altar-name')?.textContent || '';
        const srcIsVideo = isVideoUrl(src);
        const hasVideo = !srcIsVideo && !!videoSrc;
        const hasDesignation = !!designation;

        nameEl.textContent = name;

        // Tabs
        if (tabsEl) {
            tabsEl.hidden = !hasVideo;
            if (hasVideo) {
                tabsEl.querySelectorAll('.altar-tab-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.view === 'image');
                });
            }
        }

        // Designation button
        if (desigBtn) {
            desigBtn.hidden = !hasDesignation;
        }

        // Show primary
        showMedia('image', src, videoSrc, name);

        modal.hidden = false;
        updateNavVisibility();
    }

    function goToNext(dir) {
        if (cardsList.length < 2 || currentIdx < 0) return;
        const nextIdx = (currentIdx + dir + cardsList.length) % cardsList.length;
        openModal(cardsList[nextIdx]);
    }

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

    // Вкладки Картинка/Видео
    if (tabsEl) {
        tabsEl.querySelectorAll('.altar-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!currentCard) return;
                const src = currentCard.dataset.src;
                const videoSrc = currentCard.dataset.video || '';
                const name = currentCard.querySelector('.altar-name')?.textContent || '';
                showMedia(btn.dataset.view, src, videoSrc, name);
                tabsEl.querySelectorAll('.altar-tab-btn').forEach(b => {
                    b.classList.toggle('active', b === btn);
                });
            });
        });
    }

    // Обозначения
    if (desigBtn && desigModal && desigBody && desigName) {
        desigBtn.addEventListener('click', () => {
            if (!currentCard) return;
            const designation = currentCard.dataset.designation || '';
            if (!designation) return;

            const name = currentCard.querySelector('.altar-name')?.textContent || '';
            desigName.textContent = name + ' — Обозначения';
            desigBody.innerHTML = '';

            const img = document.createElement('img');
            img.src = designation;
            img.alt = name + ' (обозначения)';
            img.addEventListener('error', () => {
                desigBody.innerHTML = '';
                const stub = document.createElement('div');
                stub.className = 'altar-stub';
                stub.innerHTML = '<div class="altar-stub-icon">□</div><div class="altar-stub-text">' +
                    (navigator.onLine ? 'Не удалось загрузить' : 'Нет соединения') + '</div>';
                desigBody.appendChild(stub);
            });
            desigBody.appendChild(img);

            desigModal.hidden = false;
        });
    }

    if (desigClose && desigModal) {
        desigClose.addEventListener('click', () => { desigModal.hidden = true; });
        desigModal.addEventListener('click', (e) => {
            if (e.target === desigModal) desigModal.hidden = true;
        });
        // Escape в capture-фазе — сначала закрывает designation, потом уже altar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !desigModal.hidden) {
                e.stopImmediatePropagation();
                desigModal.hidden = true;
            }
        }, true);
    }

    // Клавиши ← → (работают в altar modal)
    document.addEventListener('keydown', (e) => {
        if (modal.hidden) return;
        if (desigModal && !desigModal.hidden) return; // пока открыт designation — не листаем
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
async function showSection(section) {
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.section === section);
    });
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    document.body.className = 'index-page ' + section;
    updateHash(section);

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
    if (section === 'links') {
        document.getElementById('viewLinks').classList.add('active');
        lastUpdEl.textContent = '—';
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
        await loadTable(targetFile);
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

            const filterMsg = [];
            if (nickFilter.trim()) filterMsg.push('ник: ' + nickFilter.trim());
            if (deltaFilter) {
                const labels = { grew: '↑ рост', fell: '↓ падение', new: 'NEW', back: 'BACK' };
                filterMsg.push(labels[deltaFilter]);
            }
            if (filterMsg.length) showToast('Фильтр: ' + filterMsg.join(' · '));
        });
    });
}

if (nickFilterEl) {
    nickFilterEl.addEventListener('input', (e) => {
        nickFilter = e.target.value;
        render();
    });
    nickFilterEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && nickFilter) {
            e.preventDefault();
            nickFilter = '';
            nickFilterEl.value = '';
            nickFilterEl.blur();
            render();
        }
    });
}

const nickFilterClearEl = document.getElementById('nickFilterClear');
if (nickFilterClearEl) {
    nickFilterClearEl.addEventListener('click', () => {
        nickFilter = '';
        if (nickFilterEl) {
            nickFilterEl.value = '';
            nickFilterEl.focus();
        }
        render();
    });
}

// Delta filters
document.querySelectorAll('.delta-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const val = btn.dataset.delta || null;
        if (deltaFilter === val) return;
        deltaFilter = val;
        document.querySelectorAll('.delta-btn').forEach(b => {
            b.classList.toggle('active', (b.dataset.delta || null) === deltaFilter);
        });
        render();
    });
});

const shareBtn = document.getElementById('shareBtn');
if (shareBtn) shareBtn.addEventListener('click', copyShareLink);

const nickShareBtn = document.getElementById('nickShareBtn');
if (nickShareBtn) {
    nickShareBtn.addEventListener('click', async () => {
        const hash = location.hash;
        if (!hash.startsWith('#stats/')) {
            showToast('Сначала откройте игрока');
            return;
        }
        const url = location.origin + location.pathname + hash;
        try {
            await navigator.clipboard.writeText(url);
            showToast('Ссылка на игрока скопирована');
            nickShareBtn.classList.add('copied');
            nickShareBtn.textContent = '✓';
            setTimeout(() => {
                nickShareBtn.classList.remove('copied');
                nickShareBtn.textContent = '🔗';
            }, 1500);
        } catch (e) {
            prompt('Скопируйте ссылку:', url);
        }
    });
}
/* ============================================================
   Переключатель зеркала 2ch
   ============================================================ */
const DOMAIN_KEY = 'gacha_domain';
const DOMAINS = {
    su:  'https://2ch.su/gacha/catalog.html?search=zzz',
    org: 'https://2ch.org/gacha/catalog.html?search=zzz',
};

function applyDomain(domain) {
    if (!DOMAINS[domain]) domain = 'su';
    const link = document.getElementById('gachaLink');
    if (link) link.href = DOMAINS[domain];
    document.querySelectorAll('.domain-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.domain === domain);
    });
    try { localStorage.setItem(DOMAIN_KEY, domain); } catch (e) {}
}

function bindDomainSwitch() {
    document.querySelectorAll('.domain-btn').forEach(btn => {
        btn.addEventListener('click', () => applyDomain(btn.dataset.domain));
    });

    let saved = 'su';
    try { saved = localStorage.getItem(DOMAIN_KEY) || 'su'; } catch (e) {}
    applyDomain(saved);
}
/* ============================================================
   Старт
   ============================================================ */
(async function init() {
    bindAltars();
    bindMskModal();
    bindNickModal();
    bindScrollTop();
    bindRefresh();
    bindDomainSwitch();
    checkMskReminder();
    setInterval(checkMskReminder, 60 * 1000);

    if (location.protocol === 'file:') {
        lastUpdEl.textContent = 'Открой через start_server.bat (localhost)';
        document.querySelectorAll('.nav-btn').forEach(b => b.disabled = true);
        return;
    }

    try {
        manifest = await fetchJSON('content/manifest.json', { ttl: CACHE_TTL_MS });
    } catch (e) {
        console.error(e);
        lastUpdEl.textContent = 'Ошибка manifest.json: ' + e.message;
        return;
    }

    await Promise.all([
        preloadAllTables(),
        loadBases(),
        loadStickers(),
        loadAltars(),
        loadLinks(),
    ]);

    // Восстановление из hash
    const initial = parseHash();
    if (initial) {
        if (initial.section === 'stats' && initial.id) {
            const found = findRowById(initial.id);
            if (found) {
                const fileMeta = manifest[found.item.type]?.files.find(f => f.file === found.item.meta.file);
                if (fileMeta) {
                    selectedFiles[found.item.type] = fileMeta.file;
                }
                await showSection(found.item.type);
                openNickStats(found.row);
            } else {
                await showSection('bases');
                showToast('Игрок не найден');
            }
        } else if (initial.section === 'assault' || initial.section === 'defence') {
            if (initial.subtype) currentSubtype = initial.subtype;
            const files = manifest[initial.section].files || [];
            if (initial.file) {
                const match = files.find(f =>
                    f.file.replace(/\.json$/i, '') === initial.file
                    || f.file === initial.file
                );
                if (match) selectedFiles[initial.section] = match.file;
            }
            await showSection(initial.section);
        } else {
            await showSection(initial.section);
        }
    } else {
        await showSection('bases');
    }
})();