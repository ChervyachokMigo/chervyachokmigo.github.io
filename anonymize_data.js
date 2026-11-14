const fs     = require('fs').promises;
const path   = require('path');
const crypto = require('crypto');

const DATA_DIR    = path.join(__dirname, 'data');
const NICKS_FILE  = path.join(DATA_DIR, 'nicks', 'nicks.json');
const AVATARS_DIR = path.join(__dirname, 'avatars');
const FOLDERS     = ['deadly_assault', 'shiyui_defence'];
const IMAGE_EXT   = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

function maskNick(nick) {
    if (!nick) return '';
    const s = String(nick).trim();
    if (!s) return '';
    if (s.length === 1) return s[0].toUpperCase();
    return s[0].toUpperCase() + s[s.length - 1].toUpperCase();
}

// Стабильный необратимый ID от полного ника
function makeId(fullNick) {
    return crypto.createHash('sha256')
        .update(String(fullNick).trim().toLowerCase())
        .digest('hex')
        .slice(0, 8);
}

async function loadAvatarsMap() {
    const files = await fs.readdir(AVATARS_DIR);
    const map = {};
    for (const f of files) {
        if (!IMAGE_EXT.includes(path.extname(f).toLowerCase())) continue;
        const name = path.basename(f, path.extname(f));
        map[name] = `avatars/${encodeURIComponent(f)}`;
    }
    return map;
}

async function processFile(filePath, nicks, avatars) {
    const txt  = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(txt);
    if (!Array.isArray(data.rows)) return;

    let masked = 0;
    for (const row of data.rows) {
        const full = row.nick;
        if (!full) continue;
        const avatarName = nicks[full] || '';
        row.id     = makeId(full);
        row.avatar = avatars[avatarName] || '';
        row.nick   = maskNick(full);
        masked++;
    }

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`   ${path.basename(filePath)}: ${masked} строк`);
}

(async () => {
    const nicks   = JSON.parse(await fs.readFile(NICKS_FILE, 'utf8'));
    const avatars = await loadAvatarsMap();
    console.log(`Загружено аватарок: ${Object.keys(avatars).length}`);

    for (const folder of FOLDERS) {
        const dir = path.join(DATA_DIR, folder);
        let files;
        try { files = await fs.readdir(dir); }
        catch { console.warn(`[!] Нет папки: ${dir}`); continue; }

        console.log(`\n[${folder}]`);
        for (const f of files) {
            if (!f.toLowerCase().endsWith('.json')) continue;
            if (/backup/i.test(f)) continue;
            await processFile(path.join(dir, f), nicks, avatars);
        }
    }

    console.log('\n✅ Анонимизация завершена');
})().catch(e => { console.error(e); process.exit(1); });