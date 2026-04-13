const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname, 'test_data');
if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
    console.log(`Created directory: ${testDir}`);
}

// Helper untuk membuat file dengan isi tertentu
function createFile(fileName, content) {
    const filePath = path.join(testDir, fileName);
    fs.writeFileSync(filePath, content);
    console.log(`Created file: ${fileName} (${content.length} bytes)`);
}

console.log("--- Generating Test Data ---");

// 1. File Asli
const contentA = "Konten Spesifik A - Ini adalah file asli yang unik.";
createFile('original_A.txt', contentA);

// 2. Duplikat Identik (Nama beda, isi sama persis)
createFile('duplicate_1_A.txt', contentA);
createFile('duplicate_2_A.txt', contentA);

// 3. File dengan Ukuran Sama tapi Isi Berbeda (Pass 2 test: Partial Hash)
// Isinya sama panjangnya (51 karakter), tapi ada beda 1 karakter di akhir
const contentB = "Konten Spesifik A - Ini adalah file asli yang unik!"; 
createFile('fake_duplicate.txt', contentB);

// 4. File Konten Lain
const contentC = "Konten Berbeda Total - Untuk grup duplikat kedua.";
createFile('original_C.txt', contentC);
createFile('duplicate_C.txt', contentC);

// 5. File 0-byte (Harus diabaikan sesuai spek)
createFile('empty.txt', "");

console.log("----------------------------");
console.log("Data uji siap! Silakan jalankan 'npm start' dan scan folder 'test_data'.");
