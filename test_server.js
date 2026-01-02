// Test script để verify server static file serving
// Using built-in fetch (Node 18+)

const baseUrl = 'http://localhost:3000';

// Test files that should exist
const testFiles = [
    '/style/profile.css',
    '/style/shop.css',
    '/style/style.css',
    '/style/variables.css',
    '/js/modules/profile_entry.js',
    '/js/modules/shop_entry.js',
    '/js/modules/user_profile.js',
    '/js/supabase/auth.js',
    '/pages/profile.html',
    '/pages/shop.html'
];

async function testFile(filePath) {
    try {
        const response = await fetch(`${baseUrl}${filePath}`);
        const contentType = response.headers.get('content-type');

        if (response.ok) {
            console.log(`✅ ${filePath} - Status: ${response.status}, Content-Type: ${contentType}`);
            return true;
        } else {
            console.log(`❌ ${filePath} - Status: ${response.status}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ ${filePath} - Error: ${error.message}`);
        return false;
    }
}

async function runTests() {
    console.log('🧪 Testing server static file serving...\n');

    let passed = 0;
    let failed = 0;

    for (const file of testFiles) {
        const success = await testFile(file);
        if (success) {
            passed++;
        } else {
            failed++;
        }
    }

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
        console.log('🎉 All static files are being served correctly!');
    } else {
        console.log('⚠️  Some files are not being served correctly.');
    }
}

runTests().catch(console.error);
