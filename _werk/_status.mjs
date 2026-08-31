import { execSync } from 'node:child_process';
const r = execSync('git status --porcelain', { encoding: 'utf8' }).split('\n').filter(Boolean);
const zonderDeploy = r.filter(l => !/deploy\//.test(l));
console.log('totaal gewijzigd/nieuw : ' + r.length);
console.log('zonder deploy/         : ' + zonderDeploy.length);
console.log('\nnieuwe bestanden:');
for (const l of zonderDeploy.filter(l => l.startsWith('??'))) console.log('  ' + l.slice(3));
console.log('\ngewijzigde niet-HTML:');
for (const l of zonderDeploy.filter(l => !l.startsWith('??') && !/\.html$/.test(l))) console.log('  ' + l);
