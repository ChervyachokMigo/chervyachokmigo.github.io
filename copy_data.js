const fs   = require('fs').promises;
const path = require('path');

// ⚠️ Поменяй на путь к папке редактора таблиц
const SOURCE_DATA_DIR = 'C:\\node_js\\zzz_da_2ch\\data';

const TARGET_DATA_DIR = path.join(__dirname, 'data');
const FOLDERS = ['deadly_assault', 'shiyui_defence', 'nicks'];

function isBackup(name) {
    return /backup/i.test(name);
}

async function copyFolder(folder) {
    const src = path.join(SOURCE_DATA_DIR, folder);
    const dst = path.join(TARGET_DATA_DIR, folder);
    await fs.mkdir(dst, { recursive: true });

    let files;
    try { files = await fs.readdir(src); }
    catch { console.warn(`[!] Нет папки: ${src}`); return; }

    for (const f of files) {
        if (isBackup(f)) { console.log(`   skip backup: ${f}`); continue; }
        const srcFile = path.join(src, f);
        const dstFile = path.join(dst, f);
        const stat = await fs.stat(srcFile);
        if (stat.isDirectory()) continue;
        await fs.copyFile(srcFile, dstFile);
        console.log(`   copied: ${folder}/${f}`);
    }
}

(async () => {
    console.log(`Источник: ${SOURCE_DATA_DIR}`);
    console.log(`Цель:     ${TARGET_DATA_DIR}\n`);
    for (const folder of FOLDERS) {
        console.log(`[${folder}]`);
        await copyFolder(folder);
    }
    console.log('\n✅ Копирование завершено');
})().catch(e => { console.error(e); process.exit(1); });