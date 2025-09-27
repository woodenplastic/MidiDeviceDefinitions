/*
 * Device Icon Updater Script
 * 
 * This script updates all device_icon fields that are set to "none" 
 * with the lowercase version of the device name.
 * 
 * Usage: node UpdateDeviceIcons.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const rootPath = path.join(__dirname, '..');
const outputDir = path.join(rootPath, 'Json');

function findLatestDatabase() {
    console.log('🔍 Looking for latest database file...');
    
    try {
        const files = fs.readdirSync(outputDir);
        const versionRegex = /midi-database-v(\d+)\.json$/;

        const versions = files
            .map(file => {
                const match = file.match(versionRegex);
                return match ? { version: parseInt(match[1]), file: file } : null;
            })
            .filter(v => v !== null)
            .sort((a, b) => b.version - a.version);

        if (versions.length > 0) {
            const latestFile = path.join(outputDir, versions[0].file);
            console.log(`📝 Found latest database: ${versions[0].file} (v${versions[0].version})`);
            return { file: latestFile, version: versions[0].version };
        } else {
            console.log('❌ No database files found!');
            return null;
        }
    } catch (error) {
        console.error('⚠️ Error finding database:', error);
        return null;
    }
}

function loadDatabase(filePath) {
    try {
        console.log('📄 Loading database...');
        const content = fs.readFileSync(filePath, 'utf8');
        const database = JSON.parse(content);
        console.log(`✅ Loaded database v${database.version}`);
        return database;
    } catch (error) {
        console.error('❌ Error loading database:', error);
        return null;
    }
}

function removeOldDatabases(directory) {
    console.log('🧹 Cleaning old database files...');
    const removed = [];
    fs.readdirSync(directory).forEach(file => {
        if (file.startsWith('midi-database')) {
            fs.unlinkSync(path.join(directory, file));
            removed.push(file);
        }
    });

    if (removed.length > 0) {
        console.log(`✅ Removed ${removed.length} old files:`);
        removed.forEach(file => console.log(`  - ${file}`));
    } else {
        console.log('ℹ️ No old database files found to remove');
    }
}

function writeFiles(database, version) {
    const jsonFile = path.join(outputDir, `midi-database-v${version}.json`);
    const gzipFile = jsonFile + '.gz';

    const minified = JSON.stringify(database);
    fs.writeFileSync(jsonFile, minified);
    fs.writeFileSync(gzipFile, zlib.gzipSync(minified));

    console.log(`\n✅ Database saved to ${outputDir}`);
    console.log(`- ${path.basename(jsonFile)}`);
    console.log(`- ${path.basename(gzipFile)}`);
}

function sanitizeIconName(manufacturer, deviceName) {
    // Create manufacturer_device format, convert to lowercase and sanitize
    const combined = `${manufacturer}_${deviceName}`;
    return combined
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
}

function updateDeviceIcons() {
    console.log('\n🎨 Starting Device Icon Update...');

    // Find and load the latest database
    const databaseInfo = findLatestDatabase();
    if (!databaseInfo) {
        console.error('❌ Cannot proceed without a database file');
        return;
    }

    const database = loadDatabase(databaseInfo.file);
    if (!database) {
        console.error('❌ Cannot proceed without loading database');
        return;
    }

    // Update version and timestamp
    const newVersion = databaseInfo.version + 1;
    database.version = newVersion;
    database.generatedAt = new Date().toISOString();

    console.log(`📈 Updating to version ${newVersion}`);

    // Remove old database files
    removeOldDatabases(outputDir);

    let updatedCount = 0;
    let totalDevices = 0;
    let skippedCount = 0;

    // Process each manufacturer
    Object.keys(database).forEach(manufacturer => {
        if (manufacturer === 'version' || manufacturer === 'generatedAt') {
            return;
        }

        console.log(`📦 Processing manufacturer: ${manufacturer}`);
        
        Object.keys(database[manufacturer]).forEach(deviceKey => {
            totalDevices++;
            const device = database[manufacturer][deviceKey];
            
            if (device.device_icon === "none" || device.device_icon === "") {
                // Extract original device name from the key (convert underscores back to spaces for processing)
                const originalDeviceName = deviceKey.replace(/_/g, ' ');
                const originalManufacturerName = manufacturer.replace(/_/g, ' ');
                const newIcon = sanitizeIconName(originalManufacturerName, originalDeviceName);
                
                device.device_icon = newIcon;
                updatedCount++;
                
                console.log(`  🎨 Updated: ${deviceKey} -> "${newIcon}"`);
            } else {
                skippedCount++;
                console.log(`  ⏭️  Skipped: ${deviceKey} (already has icon: "${device.device_icon}")`);
            }
        });
    });

    // Save the updated database
    writeFiles(database, newVersion);

    // Summary
    console.log('\n✅ Device Icon Update Complete!');
    console.log(`📊 Total Devices: ${totalDevices}`);
    console.log(`🎨 Updated Icons: ${updatedCount}`);
    console.log(`⏭️  Skipped (already set): ${skippedCount}`);
    console.log(`📌 New Version: ${newVersion}`);
    console.log(`📅 Generated: ${database.generatedAt}`);

    if (updatedCount > 0) {
        console.log('\n💡 All devices with "none" icons now have manufacturer_device format icons!');
    } else {
        console.log('\n💡 No devices needed icon updates - all icons were already set!');
    }
}

// Run the update
updateDeviceIcons();