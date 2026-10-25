const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const canonical = fs.readFileSync(path.join(root, 'providers/donghuastream.js'), 'utf8');
const marker = "var SOURCE_SITE = 'donghuastream';";
if (canonical.split(marker).length !== 2) throw new Error('Expected one source selection marker');
for (const provider of manifest.scrapers) {
  const siteId = provider.id.replace(/^donghuastream-/, '');
  if (!canonical.includes("{ id: '" + siteId + "',")) throw new Error('Unknown site: ' + siteId);
  const expected = canonical.replace(marker, "var SOURCE_SITE = '" + siteId + "';");
  const filename = path.join(root, provider.filename);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(filename) || fs.readFileSync(filename, 'utf8') !== expected) {
      throw new Error('Run npm run build to update ' + provider.filename);
    }
  } else if (siteId !== 'donghuastream') {
    fs.writeFileSync(filename, expected);
  }
}
console.log(process.argv.includes('--check') ? 'Provider copies are current.' : 'Generated individual site providers.');
