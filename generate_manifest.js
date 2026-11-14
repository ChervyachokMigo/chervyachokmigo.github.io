const fs   = require('fs').promises;
const path = require('path');

const ROOT            = __dirname;
const ASSAULT_FOLDER  = 'data/deadly_assault';
const DEFENCE_FOLDER  = 'data/shiyui_defence';
const NICKS_FILE      = 'data/nicks/nicks.json';
const AVATARS_FOLDER  = 'avatars';
const IMAGE_EXT       = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

async function scanJsonFolder(folder) {
    const abs = path.join(ROOT, folder);
    let files;
    try { files = await fs.readdir(abs); }
    catch { console.warn(`[!] Папка не найдена: ${folder}`); return []; }

    const items = [];
    for (const f of files) {
        if (!f.toLowerCase().endsWith('.json')) continue;
        try {
            const txt = await fs.readFile(path.join(abs, f), 'utf8');
            const d = JSON.parse(txt);
            items.push({
                file: f,
                title: d.title || f.replace(/\.json$/i, ''),
                savedAt: d.savedAt || '',
                rows: Array.isArray(d.rows) ? d.rows.length : 0,
            });
        } catch (e) {
            console.warn(`[!] Не прочитан ${f}: ${e.message}`);
        }
    }
    // новые первыми
    items.sort((a, b) => (Date.parse(b.savedAt) || 0) - (Date.parse(a.savedAt) || 0));
    return items;
}

async function scanAvatars() {
    const abs = path.join(ROOT, AVATARS_FOLDER);
    let files;
    try { files = await fs.readdir(abs); }
    catch { console.warn(`[!] Папка не найдена: ${AVATARS_FOLDER}`); return {}; }

    const map = {};
    for (const f of files) {
        if (!IMAGE_EXT.includes(path.extname(f).toLowerCase())) continue;
        const name = path.basename(f, path.extname(f));       // ключ для nicks.json — как есть
        map[name] = `${AVATARS_FOLDER}/${encodeURIComponent(f)}`;  // URL — безопасный
    }
    return map;
}

(async () => {
    console.log('Сканирование папок...');

    const assault = await scanJsonFolder(ASSAULT_FOLDER);
    const defence = await scanJsonFolder(DEFENCE_FOLDER);
    const avatars = await scanAvatars();

    const manifest = {
        generatedAt: new Date().toISOString(),
        assault: { folder: ASSAULT_FOLDER, files: assault },
        defence: { folder: DEFENCE_FOLDER, files: defence },
        avatars,
    };

    await fs.writeFile(path.join(ROOT, 'manifest.json'),
        JSON.stringify(manifest, null, 2), 'utf8');

    console.log('✅ manifest.json обновлён');
    console.log(`   Штурм:   ${assault.length} шт.` + (assault[0] ? `  →  ${assault[0].file}` : ''));
    console.log(`   Оборона: ${defence.length} шт.` + (defence[0] ? `  →  ${defence[0].file}` : ''));
    console.log(`   Аватары: ${Object.keys(avatars).length} шт.`);
})().catch(e => { console.error(e); process.exit(1); });