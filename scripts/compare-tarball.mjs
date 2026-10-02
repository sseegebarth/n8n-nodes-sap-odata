#!/usr/bin/env node
/**
 * Compares a candidate npm tarball against a baseline tarball and fails unless
 * every difference is covered by scripts/compare-allowlist.json:
 *   versionOnly    JSON files that may differ only in their "version" key
 *   changedAllowed files whose content may differ
 * File lists must be identical. Everything else must be byte-identical.
 *
 * Usage: node scripts/compare-tarball.mjs <candidate.tgz> <baseline.tgz>
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const [candidateArg, baselineArg] = process.argv.slice(2);
if (!candidateArg || !baselineArg) {
	console.error('Usage: node scripts/compare-tarball.mjs <candidate.tgz> <baseline.tgz>');
	process.exit(2);
}
const allow = JSON.parse(readFileSync(path.resolve('scripts/compare-allowlist.json'), 'utf8'));

function extract(tgz) {
	const dir = mkdtempSync(path.join(tmpdir(), 'tarball-'));
	execFileSync('tar', ['-xzf', path.resolve(tgz), '-C', dir]);
	return dir;
}
function listFiles(root, rel = '') {
	const out = [];
	for (const entry of readdirSync(path.join(root, rel))) {
		const r = rel ? `${rel}/${entry}` : entry;
		if (statSync(path.join(root, r)).isDirectory()) out.push(...listFiles(root, r));
		else out.push(r);
	}
	return out.sort();
}

const cand = extract(candidateArg);
const base = extract(baselineArg);
const candFiles = listFiles(cand);
const baseFiles = listFiles(base);
const problems = [];

for (const f of baseFiles) if (!candFiles.includes(f)) problems.push(`missing in candidate: ${f}`);
for (const f of candFiles) if (!baseFiles.includes(f)) problems.push(`new in candidate: ${f}`);

const report = [];
for (const f of candFiles) {
	if (!baseFiles.includes(f)) continue;
	const a = readFileSync(path.join(cand, f));
	const b = readFileSync(path.join(base, f));
	if (a.equals(b)) continue;
	if (allow.versionOnly.includes(f)) {
		const ja = JSON.parse(a.toString('utf8'));
		const jb = JSON.parse(b.toString('utf8'));
		delete ja.version;
		delete jb.version;
		if (JSON.stringify(ja) === JSON.stringify(jb)) {
			report.push(`version only: ${f}`);
		} else {
			problems.push(`${f} differs beyond "version"`);
		}
	} else if (allow.changedAllowed.includes(f)) {
		report.push(`changed (allowed): ${f}`);
	} else {
		problems.push(`unexpected difference: ${f}`);
	}
}

console.log(`candidate: ${candFiles.length} files, baseline: ${baseFiles.length} files`);
for (const line of report) console.log(`  ${line}`);
if (problems.length) {
	console.error(`BLOCKING (${problems.length}):\n  ${problems.join('\n  ')}`);
	process.exit(1);
}
console.log('Tarball comparison passed.');
