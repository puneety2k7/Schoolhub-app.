const fs = require('fs');
const path = require('path');

const phaseDirectory = __dirname;
const applicationPath = path.join(phaseDirectory, '..', 'SchoolHub_School_Management_App_Complete.html');
const sourcePath = path.join(phaseDirectory, 'assets', 'workspace-manager.js');
const adminSettingsSourcePath = path.join(phaseDirectory, '..', 'Phase_WM2_14B_1', 'assets', 'workspace-manager.js');
const application = fs.readFileSync(applicationPath, 'utf8');
const source = fs.readFileSync(sourcePath, 'utf8').trim();
const openTag = '<script id="phase-wm2-workspace-manager">';
const start = application.indexOf(openTag);

if (start < 0 || application.indexOf(openTag, start + openTag.length) >= 0) {
  throw new Error('Expected exactly one embedded Workspace Manager module.');
}

const bodyStart = start + openTag.length;
const end = application.indexOf('</script>', bodyStart);
if (end < 0) throw new Error('Embedded Workspace Manager closing tag was not found.');

const eol = application.includes('\r\n') ? '\r\n' : '\n';
const normalizedSource = source.replace(/\r?\n/g, eol);
const updated = application.slice(0, bodyStart) + eol + normalizedSource + eol + application.slice(end);
fs.writeFileSync(applicationPath, updated, 'utf8');
if (fs.existsSync(adminSettingsSourcePath)) {
  fs.writeFileSync(adminSettingsSourcePath, normalizedSource + eol, 'utf8');
}
console.log('Embedded Workspace Manager synchronized from', path.relative(process.cwd(), sourcePath));
