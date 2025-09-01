#!/usr/bin/env node

/**
 * Uniform Palace Business System - Test Script
 * This script tests the basic functionality of your system
 */

const http = require('http');

console.log('🧪 Testing Uniform Palace Business System...\n');

// Test configuration
const config = {
    host: 'localhost',
    port: 5000,
    timeout: 5000
};

// Test endpoints
const endpoints = [
    { path: '/', name: 'Website Homepage' },
    { path: '/api/health', name: 'Health Check' },
    { path: '/api/inquiries', name: 'Inquiries API' }
];

// Test functions
function testEndpoint(path, name) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: config.host,
            port: config.port,
            path: path,
            method: 'GET',
            timeout: config.timeout
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve({ success: true, status: res.statusCode, name });
                } else {
                    resolve({ success: false, status: res.statusCode, name, error: `HTTP ${res.statusCode}` });
                }
            });
        });

        req.on('error', (err) => {
            resolve({ success: false, name, error: err.message });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ success: false, name, error: 'Request timeout' });
        });

        req.end();
    });
}

async function runTests() {
    console.log('🔍 Testing system endpoints...\n');

    let passed = 0;
    let total = endpoints.length;

    for (const endpoint of endpoints) {
        process.stdout.write(`Testing ${endpoint.name}... `);
        
        try {
            const result = await testEndpoint(endpoint.path, endpoint.name);
            
            if (result.success) {
                console.log('✅ PASSED');
                passed++;
            } else {
                console.log(`❌ FAILED (${result.error})`);
            }
        } catch (error) {
            console.log(`❌ FAILED (${error.message})`);
        }
    }

    console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);

    if (passed === total) {
        console.log('\n🎉 All tests passed! Your system is working correctly.');
        console.log('\n🌐 You can now:');
        console.log('   • Visit your website: http://localhost:5000');
        console.log('   • Access the API: http://localhost:5000/api');
        console.log('   • Submit inquiries through the contact form');
        console.log('   • Login to admin panel with: admin / admin123');
    } else {
        console.log('\n⚠️  Some tests failed. Please check:');
        console.log('   • Is the server running? (npm start)');
        console.log('   • Is MongoDB connected?');
        console.log('   • Check server logs for errors');
    }
}

// Check if server is running
function checkServer() {
    return new Promise((resolve) => {
        const req = http.request({
            hostname: config.host,
            port: config.port,
            path: '/api/health',
            method: 'GET',
            timeout: 2000
        }, (res) => {
            resolve(true);
        });

        req.on('error', () => resolve(false));
        req.on('timeout', () => resolve(false));
        req.end();
    });
}

// Main execution
async function main() {
    console.log('🔌 Checking if server is running...');
    
    const serverRunning = await checkServer();
    
    if (!serverRunning) {
        console.log('❌ Server is not running!');
        console.log('\n🚀 To start the server:');
        console.log('   1. Open terminal in this folder');
        console.log('   2. Run: npm start');
        console.log('   3. Or double-click: start.bat (Windows)');
        console.log('   4. Or run: start.ps1 (PowerShell)');
        console.log('\n⏳ Waiting for server to start...');
        
        // Wait and retry
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            attempts++;
            
            process.stdout.write(`Attempt ${attempts}/${maxAttempts}... `);
            
            if (await checkServer()) {
                console.log('✅ Server is now running!');
                break;
            } else {
                console.log('❌ Still waiting...');
            }
        }
        
        if (attempts >= maxAttempts) {
            console.log('\n⏰ Timeout waiting for server. Please start it manually.');
            process.exit(1);
        }
    } else {
        console.log('✅ Server is running!\n');
    }

    // Run tests
    await runTests();
}

// Handle errors gracefully
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run the test
main().catch(console.error);
