import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as vscode from 'vscode';
import { SvgFileDecorationProvider } from '../extension';

suite('SVG file decoration', () => {
	test('marks .svg files with [] and ignores other files and directories', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-decoration-'));

		const svgPath = path.join(dir, 'example.svg');
		const upperSvgPath = path.join(dir, 'UPPER.SVG');
		const txtPath = path.join(dir, 'notes.txt');
		const svgDirPath = path.join(dir, 'folder.svg');

		fs.writeFileSync(svgPath, '<svg/>');
		fs.writeFileSync(upperSvgPath, '<svg/>');
		fs.writeFileSync(txtPath, 'hello');
		fs.mkdirSync(svgDirPath);

		const provider = new SvgFileDecorationProvider();
		const token = new vscode.CancellationTokenSource().token;

		try {
			const svgDecoration = await provider.provideFileDecoration(vscode.Uri.file(svgPath), token);
			assert.ok(svgDecoration);
			assert.strictEqual(svgDecoration!.badge, '[]');

			const upperDecoration = await provider.provideFileDecoration(vscode.Uri.file(upperSvgPath), token);
			assert.ok(upperDecoration);
			assert.strictEqual(upperDecoration!.badge, '[]');

			const txtDecoration = await provider.provideFileDecoration(vscode.Uri.file(txtPath), token);
			assert.strictEqual(txtDecoration, undefined);

			const dirDecoration = await provider.provideFileDecoration(vscode.Uri.file(svgDirPath), token);
			assert.strictEqual(dirDecoration, undefined);

			const nonFileDecoration = await provider.provideFileDecoration(vscode.Uri.parse('untitled:example.svg'), token);
			assert.strictEqual(nonFileDecoration, undefined);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
