/**
 * Seed real Algerian courier coverage data for testing.
 * Run: node scripts/seedCoverage.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  const Courier = require('../models/Courier');
  const CourierCoverage = require('../models/CourierCoverage');

  const courier = await Courier.findOne().lean();
  if (!courier) {
    console.log('No courier found in DB. Create one first.');
    process.exit(1);
  }
  console.log('Using courier:', courier._id, courier.name);

  // Clean fake coverage data (non-numeric wilaya codes)
  const deleted = await CourierCoverage.deleteMany({ wilayaCode: { $not: /^\d+$/ } });
  console.log('Cleaned', deleted.deletedCount, 'fake coverage records');

  // Major wilayas with their communes
  const coverageData = [
    { wilayaCode: '16', communes: ['Alger Centre', 'Bab El Oued', 'Hussein Dey', 'Kouba', 'Bir Mourad Rais', 'El Biar', 'Bouzareah', 'Dely Ibrahim', 'Draria', 'Ain Benian', 'Cheraga', 'Staoueli', 'Zeralda', 'Bordj El Kiffan', 'Dar El Beida', 'Rouiba', 'Reghaia'] },
    { wilayaCode: '31', communes: ['Oran', 'Bir El Djir', 'Es Senia', 'Ain Turk', 'Arzew', 'Bethioua', 'Ain El Bya', 'Hassi Bounif', 'Sidi Chahmi'] },
    { wilayaCode: '25', communes: ['Constantine', 'El Khroub', 'Ain Smara', 'Hamma Bouziane', 'Didouche Mourad', 'Zighoud Youcef', 'Ali Mendjeli'] },
    { wilayaCode: '9', communes: ['Blida', 'Boufarik', 'Bougara', 'Ouled Yaich', 'Mouzaia', 'Chiffa', 'El Affroun', 'Beni Mered'] },
    { wilayaCode: '19', communes: ['Setif', 'El Eulma', 'Ain Oulmene', 'Ain Arnat', 'Bougaa', 'Ain Azel'] },
    { wilayaCode: '5', communes: ['Batna', 'Ain Touta', 'Barika', 'Merouana', 'Tazoult', 'Ngaous'] },
    { wilayaCode: '6', communes: ['Bejaia', 'Akbou', 'El Kseur', 'Sidi Aich', 'Amizour', 'Tichy', 'Aokas'] },
    { wilayaCode: '15', communes: ['Tizi Ouzou', 'Draa Ben Khedda', 'Azazga', 'Ain El Hammam', 'Larbaa Nath Irathen', 'Boghni', 'Tigzirt'] },
    { wilayaCode: '23', communes: ['Annaba', 'El Bouni', 'Sidi Amar', 'El Hadjar', 'Ain Berda', 'Berrahal'] },
    { wilayaCode: '35', communes: ['Boumerdes', 'Dellys', 'Corso', 'Bordj Menaiel', 'Khemis El Khechna', 'Boudouaou', 'Naciria'] },
    { wilayaCode: '42', communes: ['Tipaza', 'Kolea', 'Hadjout', 'Cherchell', 'Fouka', 'Bou Ismail', 'Ain Tagourait'] },
    { wilayaCode: '2', communes: ['Chlef', 'Ech Cheliff', 'Oued Fodda', 'Tenes', 'Ain Merane', 'Boukadir'] },
    { wilayaCode: '7', communes: ['Biskra', 'El Kantara', 'Tolga', 'Ouled Djellal', 'Sidi Okba', 'Zeribet El Oued'] },
    { wilayaCode: '1', communes: ['Adrar', 'Reggane', 'Timimoun', 'In Salah'] },
    { wilayaCode: '3', communes: ['Laghouat', 'Aflou', 'Hassi R\'Mel', 'Ksar El Hirane'] },
  ];

  let inserted = 0;
  for (const { wilayaCode, communes } of coverageData) {
    for (const commune of communes) {
      const exists = await CourierCoverage.findOne({
        courierId: courier._id,
        wilayaCode,
        commune,
        tenant: courier.tenant
      });
      if (!exists) {
        await CourierCoverage.create({
          courierId: courier._id,
          tenant: courier.tenant,
          wilayaCode,
          commune,
          homeSupported: true,
          officeSupported: commune.length > 6 // simulate some having office
        });
        inserted++;
      }
    }
  }

  console.log('Inserted', inserted, 'new coverage records');
  const total = await CourierCoverage.countDocuments();
  console.log('Total coverage records:', total);

  mongoose.disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
