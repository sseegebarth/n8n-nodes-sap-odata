#!/usr/bin/env node
/**
 * Release gate: runs the same static analysis as `npx @n8n/scan-community-package`
 * on a local directory and fails unless every finding is on the allowlist.
 *
 * The scanner has two legs. "source" lints the attested source checkout with the
 * full rule set; "dist" lints the packed tarball (compiled JS plus package.json).
 * The scanner CLI itself only accepts a published package name and sets no exit
 * code on failure, so this script reuses its exported config instead.
 *
 * Usage: node scripts/scan-gate.mjs <source|dist> <directory> <scannerInstallDir>
 *   scannerInstallDir: a directory where @n8n/scan-community-package was installed
 *   with `npm install --prefix <dir> --ignore-scripts @n8n/scan-community-package@<pinned>`
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [mode, dirArg, scannerDirArg] = process.argv.slice(2);
if (!['source', 'dist'].includes(mode) || !dirArg || !scannerDirArg) {
	console.error('Usage: node scripts/scan-gate.mjs <source|dist> <directory> <scannerInstallDir>');
	process.exit(2);
}

const targetDir = path.resolve(dirArg);
const scannerPkg = path.join(path.resolve(scannerDirArg), 'node_modules', '@n8n', 'scan-community-package');
const scannerVersion = JSON.parse(readFileSync(path.join(scannerPkg, 'package.json'), 'utf8')).version;
const scanner = await import(pathToFileURL(path.join(scannerPkg, 'scanner', 'scanner.mjs')).href);
const requireFromScanner = createRequire(path.join(scannerPkg, 'package.json'));
const { ESLint } = requireFromScanner('eslint');
const glob = requireFromScanner('fast-glob');

const patterns = mode === 'source' ? scanner.SOURCE_FILE_PATTERNS : ['**/*.js', 'package.json'];
const allowlistPath = path.resolve('scripts/scan-allowlist.json');
const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'))[mode] ?? [];

const eslint = new ESLint({
	cwd: targetDir,
	allowInlineConfig: false,
	overrideConfigFile: true,
	overrideConfig: await scanner.buildScanConfig(),
});
const files = glob.sync(patterns, {
	cwd: targetDir,
	absolute: true,
	ignore: ['node_modules/**', '**/package-lock.json'],
});
const results = await eslint.lintFiles(files);

const blocking = [];
const accepted = [];
for (const result of results) {
	const file = path.relative(targetDir, result.filePath).split(path.sep).join('/');
	for (const m of result.messages) {
		if (m.severity !== 2) continue;
		const finding = { file, line: m.line, ruleId: m.ruleId, message: m.message };
		const ok = allowlist.some(
			(a) => a.file === file && a.ruleId === m.ruleId && m.message.includes(a.messageIncludes),
		);
		(ok ? accepted : blocking).push(finding);
	}
}

const fmt = (f) => `  ${f.file}:${f.line}  ${f.ruleId}\n      ${f.message}`;
console.log(`n8n scanner ${scannerVersion}, ${mode} leg, ${files.length} files in ${targetDir}`);
if (accepted.length) console.log(`Accepted by allowlist (${accepted.length}):\n${accepted.map(fmt).join('\n')}`);
if (blocking.length) {
	console.error(`BLOCKING findings (${blocking.length}):\n${blocking.map(fmt).join('\n')}`);
	process.exit(1);
}
console.log('Gate passed.');
