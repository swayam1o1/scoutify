const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Artisan = require('../models/Artisan');
const { CONTACT_STATUSES } = require('../constants/artisan');

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/scoutify';

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    // Clear existing ingested data
    await Artisan.deleteMany({ userId: { $exists: false } });
    console.log('Cleared existing ingested artisans.');

    const statesDir = path.join(__dirname, '../../states');
    const files = fs.readdirSync(statesDir).filter(f => f.endsWith('.csv'));

    let totalImported = 0;
    let totalDuplicatesMerged = 0;

    for (const file of files) {
      const filePath = path.join(statesDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/);

      let currentSpecialization = 'General';

      for (const line of lines) {
        if (!line.trim()) continue;

        const row = parseCsvLine(line);
        if (row.length === 0 || !row[0]) continue;

        // Check if Category row
        if (row[0].toUpperCase().startsWith('CATEGORY')) {
          const match = row[0].match(/CATEGORY\s*:\s*([^,]+)/i);
          if (match && match[1]) {
            currentSpecialization = match[1].trim();
          }
          continue;
        }

        // Check if Header row
        if (row[0].toLowerCase().includes('company name')) {
          continue;
        }

        // It is a data row
        const companyName = row[0];
        const phoneNumber = row[1] || '';
        const email = row[2] || '';
        const instagram = row[3] || '';
        const city = row[4] || '';
        const personOfContact = row[5] || '';
        // Spreadsheet column is free text; anything unrecognised is treated as a
        // legacy verified listing so imports stay publicly searchable.
        const rawStatus = (row[6] || '').trim().toLowerCase();
        const contactStatus = CONTACT_STATUSES.includes(rawStatus) ? rawStatus : 'verified';

        // Find and update or insert
        const existing = await Artisan.findOne({
          companyName: companyName,
          city: city
        });

        if (existing) {
          if (!existing.specialization.includes(currentSpecialization)) {
            existing.specialization.push(currentSpecialization);
            existing.searchText = buildSearchText(existing);
            await existing.save();
            totalDuplicatesMerged++;
          }
        } else {
          await Artisan.create({
            companyName,
            phoneNumber,
            email,
            instagram,
            city,
            personOfContact,
            contactStatus,
            specialization: [currentSpecialization],
            searchText: buildSearchText({ companyName, city, specialization: [currentSpecialization] })
          });
          totalImported++;
        }
      }
      console.log(`Finished processing file: ${file}`);
    }

    console.log('\n--- Ingestion Report ---');
    console.log(`New Artisans Imported: ${totalImported}`);
    console.log(`Categories Merged for Duplicates: ${totalDuplicatesMerged}`);
    console.log(`Total Artisans in Database: ${await Artisan.countDocuments()}`);

  } catch (err) {
    console.error('Error during data import:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

function buildSearchText(artisan) {
  return [
    artisan.companyName,
    artisan.personOfContact,
    artisan.city,
    artisan.specialization?.join(', ')
  ].filter(Boolean).join(' | ');
}

run();
