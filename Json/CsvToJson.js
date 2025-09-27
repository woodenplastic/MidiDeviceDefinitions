/*
 CSV Format:
 manufacturer,device,section,parameter_name,parameter_description,cc_msb,cc_lsb,cc_min_value,cc_max_value,nrpn_msb,nrpn_lsb,nrpn_min_value,nrpn_max_value,orientation,notes,usage
 Example:
 Lofty,Trundler,Oscillators,Glide rate,"Adjusts the glide (portmanteau) time",5,,0,127,1,1,0,127,0-based,Default is zero.,
 Lofty,Trundler,Oscillators,Glide switch,Enables or disables glide.,65,,0,127,1,2,0,127,0-based,,0-63: Off; 64-127: On
 Lofty,Trundler,Oscillators,Note sync,Enables and disables Note Sync,81,,0,127,,,,,0-based,,0: Off; 1-127: On
 Lofty,Trundler,Amp,Pan,Pans between left to right channel,10,,0,127,30,0,0,127,Centered,Left…Centered…Right,0~127: Pan amount
 
  JSON Format:
    {
    "brand": {
      "device": {
        "midi_thru": true|false|"", 
        "midi_in": "TRS|DIN|USB|...|"",
        "midi_clock": true|false|"",
        "phantom_power": "None|Required|Optional|...|"",
        "midi_channel": {
          "instructions": "Step by step instructions for setting MIDI channel... or empty string"
        },

        "instructions": "General device instructions or empty string",
        "cc": [
          {
            "name": "Parameter Name",
            "description": "Detailed description or empty string",
            "usage" : "Further Details or empty string",
            "curve": "Toggle|0-based|1-based|Centered",
            "value": 0,
            "min": 0,
            "max": 127,
            "type": "Parameter|System|Scene......",
          },
          {
            "name": "Another Parameter",
            "description": "Detailed description or empty string",
            "usage" : "Further Details or empty string",
            "curve": "Toggle|0-based|1-based|Centered",
            "value": 1,
            "min": 0,
            "max": 127,
            "type": "Parameter|System|Scene......",
          }
        ],
        "nrpn": [
          {
            "name": "NRPN Parameter Name",
            "description": "Detailed description or empty string",
            "usage" : "Further Details or empty string",
            "curve": "Toggle|0-based|1-based|Centered",
            "msb": 99,
            "lsb": 98,
            "min": 0,
            "max": 16383,
            "type": "Parameter|System|Scene......",
          },
          {
            "name": "Another NRPN Parameter",
            "description": "Detailed description or empty string",
            "usage" : "Further Details or empty string",
            "curve": "Toggle|0-based|1-based|Centered",
            "msb": 99,
            "lsb": 99,
            "min": 0,
            "max": 16383,
            "type": "Parameter|System|Scene......",
          }
        ],
        "pc": [
          {
            "name": "Parameter Name",
            "description": "Detailed description or empty string",
            "usage" : "Further Details or empty string",
            "curve": "Toggle|0-based|1-based|Centered",
            "value": 0,
            "min": 0,
            "max": 127,
            "type": "Parameter|System|Scene......",
          },
          {
            "name": "Another Parameter",
            "description": "Detailed description or empty string",
            "usage" : "Further Details or empty string",
            "value": 1,
            "min": 0,
            "max": 127,
            "type": "Parameter|System|Scene......",
          }
        ],
      },
      "another_device": {
        // Same structure as above for each device
      }
    },
    "another_brand_": {
      // Same structure as above for each brand
    }
  }

 IMPORTANT: This script now PRESERVES manual edits by merging CSV data with existing JSON data.
 - Existing devices keep their manual edits (midi_thru, midi_in, instructions, etc.)
 - Parameters are merged intelligently - existing detailed descriptions/usage preserved
 - Only CSV data is updated, manual enhancements remain intact
 - Creates incremental versions while preserving all previous work
*/

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const rootPath = path.join(__dirname, '..');
const outputDir = path.join(rootPath, 'Json');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created output directory: ${outputDir}`);
}

function findLatestDatabase() {
    console.log('🔍 Looking for existing database...');
    
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
            console.log(`📝 Found existing database: ${versions[0].file} (v${versions[0].version})`);
            return { file: latestFile, version: versions[0].version };
        } else {
            console.log('📝 No existing database found');
            return { file: null, version: 0 };
        }
    } catch (error) {
        console.error('⚠️ Error finding existing database:', error);
        return { file: null, version: 0 };
    }
}

function loadExistingDatabase(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
        console.log('📄 Creating new database structure...');
        return { version: 1, generatedAt: new Date().toISOString() };
    }

    try {
        console.log('� Loading existing database...');
        const content = fs.readFileSync(filePath, 'utf8');
        const database = JSON.parse(content);
        console.log(`✅ Loaded database v${database.version} (${Object.keys(database).filter(k => k !== 'version' && k !== 'generatedAt').length} manufacturers)`);
        return database;
    } catch (error) {
        console.error('❌ Error loading existing database:', error);
        console.log('📄 Creating new database structure...');
        return { version: 1, generatedAt: new Date().toISOString() };
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
    const timestamp = database.generatedAt;
    const jsonFile = path.join(outputDir, `midi-database-v${version}.json`);
    const gzipFile = jsonFile + '.gz';

    const minified = JSON.stringify(database);
    fs.writeFileSync(jsonFile, minified);
    fs.writeFileSync(gzipFile, zlib.gzipSync(minified));

    console.log(`\n✅ Database saved to ${outputDir}`);
    console.log(`- ${path.basename(jsonFile)}`);
    console.log(`- ${path.basename(gzipFile)}`);
}

function mergeDeviceData(existingDevice, csvData) {
    // Create new device structure if it doesn't exist
    if (!existingDevice) {
        return {
            device_icon: csvData[0]?.icon || "none",
            midi_thru: "",
            midi_in: "",
            midi_clock: "",
            phantom_power: "",
            midi_channel: {
                instructions: ""
            },
            instructions: "",
            cc: [],
            nrpn: [],
            pc: []
        };
    }

    // Preserve existing manual data, only update if empty
    const mergedDevice = {
        device_icon: existingDevice.device_icon || csvData[0]?.icon || "none",
        midi_thru: existingDevice.midi_thru || "",
        midi_in: existingDevice.midi_in || "",
        midi_clock: existingDevice.midi_clock || "",
        phantom_power: existingDevice.phantom_power || "",
        midi_channel: existingDevice.midi_channel || { instructions: "" },
        instructions: existingDevice.instructions || "",
        cc: [...(existingDevice.cc || [])],
        nrpn: [...(existingDevice.nrpn || [])],
        pc: [...(existingDevice.pc || [])]
    };

    return mergedDevice;
}

function mergeParameters(existingParams, newParams, paramType) {
    // Create a map of existing parameters for quick lookup
    const existingMap = new Map();
    
    if (paramType === 'cc') {
        existingParams.forEach((param, index) => {
            existingMap.set(`${param.name}_${param.value}`, { param, index });
        });
    } else if (paramType === 'nrpn') {
        existingParams.forEach((param, index) => {
            existingMap.set(`${param.name}_${param.msb}_${param.lsb}`, { param, index });
        });
    }

    const updatedParams = [...existingParams];

    // Process new parameters from CSV
    newParams.forEach(newParam => {
        let key;
        if (paramType === 'cc') {
            key = `${newParam.name}_${newParam.value}`;
        } else if (paramType === 'nrpn') {
            key = `${newParam.name}_${newParam.msb}_${newParam.lsb}`;
        }

        const existing = existingMap.get(key);
        
        if (existing) {
            // Update existing parameter with smart merging
            const existingParam = existing.param;
            
            // Determine if we should use CSV or existing data for description/usage
            // Use CSV data if:
            // 1. Existing field is empty
            // 2. CSV has new content (different from existing)
            // 3. CSV content is significantly longer (likely more detailed)
            
            const shouldUpdateDescription = !existingParam.description || 
                                          (newParam.description && newParam.description !== existingParam.description) ||
                                          (newParam.description && newParam.description.length > existingParam.description.length * 1.5);
                                          
            const shouldUpdateUsage = !existingParam.usage || 
                                    (newParam.usage && newParam.usage !== existingParam.usage) ||
                                    (newParam.usage && newParam.usage.length > existingParam.usage.length * 1.5);

            updatedParams[existing.index] = {
                ...newParam, // Start with all CSV data
                // Selectively preserve manual edits only when they're clearly better
                description: shouldUpdateDescription ? (newParam.description || "") : existingParam.description,
                usage: shouldUpdateUsage ? (newParam.usage || "") : existingParam.usage,
                // Preserve non-CSV fields that might have manual edits
                curve: existingParam.curve || newParam.curve || "0-based"
            };
            
            // Log when CSV updates are applied
            if (shouldUpdateDescription && newParam.description) {
                console.log(`    📝 Updated description for "${newParam.name}"`);
            }
            if (shouldUpdateUsage && newParam.usage) {
                console.log(`    📝 Updated usage for "${newParam.name}"`);
            }
        } else {
            // Add new parameter
            updatedParams.push(newParam);
        }
    });

    return updatedParams;
}

function parseCSV(csvText) {
    const lines = csvText.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('manufacturer'));

    return lines.map(line => {
        const fields = line.split(',').map(field => field.trim());
        return {
            manufacturer: fields[0],
            device: fields[1],
            section: fields[2],
            name: fields[3],
            description: fields[4],
            cc: {
                msb: fields[5] ? parseInt(fields[5]) : null,
                lsb: fields[6] ? parseInt(fields[6]) : null,
                min: fields[7] ? parseInt(fields[7]) : 0,
                max: fields[8] ? parseInt(fields[8]) : 127
            },
            nrpn: {
                msb: fields[9] ? parseInt(fields[9]) : null,
                lsb: fields[10] ? parseInt(fields[10]) : null,
                min: fields[11] ? parseInt(fields[11]) : 0,
                max: fields[12] ? parseInt(fields[12]) : 127
            },
            orientation: fields[13] || null,
            notes: fields[14] || null,
            usage: fields[15] || null,
            icon: fields[16] || "none"
        };
    });
}

function convertDatabase() {
    console.log('\n🚀 Starting MIDI database merge/update...');

    // Find and load existing database
    const existingInfo = findLatestDatabase();
    const database = loadExistingDatabase(existingInfo.file);
    
    // Update version and timestamp
    const newVersion = existingInfo.version + 1;
    database.version = newVersion;
    database.generatedAt = new Date().toISOString();
    
    console.log(`📈 Updating to version ${newVersion}`);

    // Remove old database files (we'll create the new version)
    removeOldDatabases(outputDir);

    const manufacturerFolders = fs.readdirSync(rootPath).filter(file =>
        fs.statSync(path.join(rootPath, file)).isDirectory() &&
        file !== 'Json' &&
        file !== '.git' &&
        file !== '.github' &&
        !file.startsWith('.')
    );

    let updatedDevices = 0;
    let newDevices = 0;

    manufacturerFolders.forEach(folder => {
        console.log(`📦 Processing folder: ${folder}`);
        const csvFiles = fs.readdirSync(path.join(rootPath, folder)).filter(file => file.endsWith('.csv'));
        console.log(`Found ${csvFiles.length} CSV file(s) in manufacturer folder: ${folder}`);

        csvFiles.forEach(file => {
            try {
                const csvContent = fs.readFileSync(path.join(rootPath, folder, file), 'utf8');
                const deviceData = parseCSV(csvContent);

                if (deviceData.length > 0) {
                    const manufacturer = deviceData[0].manufacturer.replace(/\s+/g, '_');
                    const deviceName = deviceData[0].device.replace(/\s+/g, '_');

                    // Initialize manufacturer if it doesn't exist
                    if (!database[manufacturer]) {
                        database[manufacturer] = {};
                    }

                    // Check if device exists
                    const deviceExists = database[manufacturer][deviceName];
                    
                    // Merge device data (preserves existing manual edits)
                    const mergedDevice = mergeDeviceData(database[manufacturer][deviceName], deviceData);
                    
                    // Collect new CC and NRPN parameters from CSV
                    const newCcParams = [];
                    const newNrpnParams = [];

                    deviceData.forEach(param => {
                        if (param.cc.msb !== null) {
                            newCcParams.push({
                                name: param.name,
                                description: param.description || "",
                                usage: param.usage || "",
                                curve: param.orientation || "0-based",
                                value: param.cc.msb,
                                min: param.cc.min,
                                max: param.cc.max,
                                type: param.section || "Parameter",
                            });
                        }

                        if (param.nrpn.msb !== null && param.nrpn.lsb !== null) {
                            newNrpnParams.push({
                                name: param.name,
                                description: param.description || "",
                                usage: param.usage || "",
                                curve: param.orientation || "0-based",
                                msb: param.nrpn.msb,
                                lsb: param.nrpn.lsb,
                                min: param.nrpn.min,
                                max: param.nrpn.max,
                                type: param.section || "Parameter",
                            });
                        }
                    });

                    // Merge parameters (preserves manual edits)
                    mergedDevice.cc = mergeParameters(mergedDevice.cc, newCcParams, 'cc');
                    mergedDevice.nrpn = mergeParameters(mergedDevice.nrpn, newNrpnParams, 'nrpn');

                    database[manufacturer][deviceName] = mergedDevice;
                    
                    if (deviceExists) {
                        updatedDevices++;
                        console.log(`  ✏️  Updated: ${manufacturer}/${deviceName}`);
                    } else {
                        newDevices++;
                        console.log(`  ➕ Added: ${manufacturer}/${deviceName}`);
                    }
                }
            } catch (error) {
                console.error(`❌ Error processing ${file}:`, error);
            }
        });
    });

    writeFiles(database, newVersion);

    const manufacturers = Object.keys(database);
    let totalDeviceCount = 0;
    manufacturers.forEach(mfr => {
        if (mfr !== 'version' && mfr !== 'generatedAt') {
            totalDeviceCount += Object.keys(database[mfr]).length;
        }
    });

    console.log('\n✅ Database merge/update complete!');
    console.log(`📂 Manufacturers: ${manufacturers.length - 2}`);
    console.log(`📂 Total Devices: ${totalDeviceCount}`);
    console.log(`➕ New Devices: ${newDevices}`);
    console.log(`✏️  Updated Devices: ${updatedDevices}`);
    console.log(`📌 Version: ${newVersion}`);
    console.log(`📅 Generated: ${database.generatedAt}`);
    console.log('\n💡 Manual edits in existing devices have been preserved!');
}

convertDatabase();
