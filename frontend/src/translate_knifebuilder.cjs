const fs = require('fs');
let c = fs.readFileSync('pages/KnifeBuilder.jsx', 'utf8');

c = c.replace(/title="Custom Knife Builder"/, "title={t('knivesBuilder.title', 'Custom Knife Builder')}");
c = c.replace(/subtitle="Design bespoke blades and instantly generate production orders."/, "subtitle={t('knivesBuilder.subtitle', 'Design bespoke blades and instantly generate production orders.')}");

// Mapping steps
c = c.replace(/\{step\}/, "{t(`knivesBuilder.steps.\${['profile', 'materials', 'measurements', 'summary'][idx]}`, step)}");

// Step 0
c = c.replace(/Base Profile/, "{t('knivesBuilder.baseProfile', 'Base Profile')}");
c = c.replace(/\{type\}/g, "{t(`knivesBuilder.types.${type}`, type)}");

// Step 1
c = c.replace(/Steel Selection/, "{t('knivesBuilder.steelSelection', 'Steel Selection')}");
c = c.replace(/\{steel\}/g, "{t(`knivesBuilder.steels.${steel}`, steel)}");
c = c.replace(/Handle Material/, "{t('knivesBuilder.handleMaterial', 'Handle Material')}");
c = c.replace(/\{handle\}/g, "{t(`knivesBuilder.handles.${handle}`, handle)}");

// Step 2
c = c.replace(/Specifications/, "{t('knivesBuilder.specifications', 'Specifications')}");
c = c.replace(/>Blade Length \(cm\)</, ">{t('knivesBuilder.bladeLength', 'Blade Length (cm)')}<");
c = c.replace(/>Total Length \(cm\)</, ">{t('knivesBuilder.totalLength', 'Total Length (cm)')}<");
c = c.replace(/>Custom Leather Sheath</, ">{t('knivesBuilder.sheath', 'Custom Leather Sheath')}<");
c = c.replace(/>\+2500 DZD Estimated</, ">{t('knivesBuilder.sheathEstimate', '+2500 DZD Estimated')}<");
c = c.replace(/>Special Notes for the Forge</, ">{t('knivesBuilder.specialNotes', 'Special Notes for the Forge')}<");

// Step 3
c = c.replace(/>Quote Summary</, ">{t('knivesBuilder.quoteSummary', 'Quote Summary')}<");
c = c.replace(/>Profile</, ">{t('knivesBuilder.profile', 'Profile')}<");
c = c.replace(/>Steel</, ">{t('knivesBuilder.steel', 'Steel')}<");
c = c.replace(/>Handle</, ">{t('knivesBuilder.handle', 'Handle')}<");
c = c.replace(/>Sheath</, ">{t('knivesBuilder.sheath', 'Sheath')}<");
c = c.replace(/'Yes' : 'No'/, "t('knivesBuilder.yes', 'Yes') : t('knivesBuilder.no', 'No')");
c = c.replace(/>Estimated Final Price</, ">{t('knivesBuilder.estimatedFinalPrice', 'Estimated Final Price')}<");
c = c.replace(/>Deposit Required</, ">{t('knivesBuilder.depositRequired', 'Deposit Required')}<");
c = c.replace(/>Link Client</, ">{t('knivesBuilder.linkClient', 'Link Client')}<");
c = c.replace(/>Select an existing client\.\.\.</, ">{t('knivesBuilder.selectClient', 'Select an existing client...')}<");

// Buttons & Errors
c = c.replace(/> Back/, "> {t('knivesBuilder.btnBack', 'Back')}");
c = c.replace(/Next Step </, "{t('knivesBuilder.btnNext', 'Next Step')} <");
c = c.replace(/>\s*Place Custom Order\s*</, "> {t('knivesBuilder.btnPlaceOrder', 'Place Custom Order')} <");
c = c.replace(/'Please select a client\.'/, "t('knivesBuilder.errSelectClient', 'Please select a client.')");

fs.writeFileSync('pages/KnifeBuilder.jsx', c, 'utf8');
console.log('Translated KnifeBuilder!');
