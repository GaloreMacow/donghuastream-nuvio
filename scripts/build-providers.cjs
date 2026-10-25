const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const canonical = fs.readFileSync(path.join(root, 'providers/donghuastream.js'), 'utf8');
const sites = require('./sites.cjs');
const marker = /^  var SOURCE_SITE = (\{[^\n]+\});$/m;
const selected = canonical.match(marker);
if (!selected || JSON.parse(selected[1]).id !== 'donghuastream') throw new Error('Expected default site selection');
for (const provider of manifest.scrapers) {
  const siteId = provider.id.replace(/^donghuastream-/, '');
  const site = sites.find(item => item.id === siteId);
  if (!site) throw new Error('Unknown site: ' + siteId);
  const expected = canonical.replace(marker, '  var SOURCE_SITE = ' + JSON.stringify(site) + ';');
  const filename = path.join(root, provider.filename);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(filename) || fs.readFileSync(filename, 'utf8') !== expected) {
      throw new Error('Run npm run build to update ' + provider.filename);
    }
  } else {
    fs.writeFileSync(filename, expected);
  }
}
console.log(process.argv.includes('--check') ? 'Provider copies are current.' : 'Generated individual site providers.');
