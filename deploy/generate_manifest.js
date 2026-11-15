const fs   = require('fs').promises;
const path = require('path');

const ROOT            = path.join(__dirname, '..');
const CONTENT_FOLDER  = 'content';
const ASSAULT_FOLDER  = 'data/deadly_assault';
const DEFENCE_FOLDER  = 'data/shiyui_defence';
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
        const name = path.basename(f, path.extname(f));
        map[name] = `${AVATARS_FOLDER}/${encodeURIComponent(f)}`;
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

    const outDir = path.join(ROOT, CONTENT_FOLDER);
    await fs.mkdir(outDir, { recursive: true });

    await fs.writeFile(path.join(outDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2), 'utf8');

    console.log('✅ content/manifest.json обновлён');
    console.log(`   Штурм:   ${assault.length} шт.` + (assault[0] ? `  →  ${assault[0].file}` : ''));
    console.log(`   Оборона: ${defence.length} шт.` + (defence[0] ? `  →  ${defence[0].file}` : ''));
    console.log(`   Аватары: ${Object.keys(avatars).length} шт.`);
})().catch(e => { console.error(e); process.exit(1); });