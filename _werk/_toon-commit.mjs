import { execSync } from 'node:child_process';
console.log(execSync('git log -3 --pretty=format:"%h  %s"', { encoding: 'utf8' }));
