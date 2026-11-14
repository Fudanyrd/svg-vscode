import * as assert from 'assert';
import * as vscode from 'vscode';

import { SvgParser } from '../serialization/SvgParser';

async function parse(svg: string) {
    const document = await vscode.workspace.openTextDocument({
        language: 'xml',
        content: svg
    });
    return new SvgParser().parse(document);
}

suite('SvgParser', () => {
    test('parses nested elements and keeps the id attribute only', async () => {
        const root = await parse(`<svg xmlns="http://www.w3.org/2000/svg" width="400">
  <rect x="0" y="0" width="400" height="300" fill="#ffffff"/>
  <text id="t1" x="10" y="290">imported</text>
  <g id="g1">
    <rect id="r2" x="0" y="0" width="10" height="10"/>
    <circle id="c2" cx="5" cy="5" r="2"/>
  </g>
</svg>`);

        assert.ok(root);
        assert.strictEqual(root!.name, 'svg');
        assert.strictEqual(root!.id, undefined);

        assert.strictEqual(root!.children.length, 3);

        assert.strictEqual(root!.children[0].name, 'rect');
        assert.strictEqual(root!.children[0].id, undefined);
        assert.strictEqual(root!.children[0].children.length, 0);

        assert.strictEqual(root!.children[1].name, 'text');
        assert.strictEqual(root!.children[1].id, 't1');
        assert.strictEqual(root!.children[1].children.length, 0);

        assert.strictEqual(root!.children[2].name, 'g');
        assert.strictEqual(root!.children[2].id, 'g1');
        assert.strictEqual(root!.children[2].children.length, 2);
        assert.strictEqual(root!.children[2].children[0].name, 'rect');
        assert.strictEqual(root!.children[2].children[0].id, 'r2');
        assert.strictEqual(root!.children[2].children[1].name, 'circle');
        assert.strictEqual(root!.children[2].children[1].id, 'c2');
    });

    test('covers the whole element with the node range', async () => {
        const svg = '<svg>\n  <g id="g1">\n    <rect id="r2"/>\n  </g>\n</svg>';
        const root = await parse(svg);
        const lines = svg.split('\n');

        assert.ok(root);
        assert.strictEqual(root!.range.start.line, 0);
        assert.strictEqual(root!.range.start.character, 0);
        assert.strictEqual(root!.range.end.line, lines.length - 1);
        assert.strictEqual(root!.range.end.character, lines[lines.length - 1].length);

        const group = root!.children[0];
        assert.strictEqual(group.range.start.line, 1);
        assert.strictEqual(group.range.start.character, 2);
        assert.strictEqual(group.range.end.line, 3);
        assert.strictEqual(group.range.end.character, 6);

        const rect = group.children[0];
        assert.strictEqual(rect.range.start.line, 2);
        assert.strictEqual(rect.range.end.line, 2);
    });

    test('ignores the XML declaration, comments, and CDATA', async () => {
        const root = await parse(`<?xml version="1.0" encoding="UTF-8"?>
<!-- file-level comment -->
<svg>
  <!-- keep this node -->
  <circle id="c1"/>
  <![CDATA[ignored text]]>
</svg>`);

        assert.ok(root);
        assert.strictEqual(root!.name, 'svg');
        assert.strictEqual(root!.children.length, 1);
        assert.strictEqual(root!.children[0].name, 'circle');
        assert.strictEqual(root!.children[0].id, 'c1');
    });

    test('supports a self-closing root element', async () => {
        const root = await parse('<svg/>');

        assert.ok(root);
        assert.strictEqual(root!.name, 'svg');
        assert.strictEqual(root!.id, undefined);
        assert.strictEqual(root!.children.length, 0);
    });

    test('decodes entities in the id attribute', async () => {
        const root = await parse('<svg><g id="a&amp;b"></g></svg>');

        assert.ok(root);
        assert.strictEqual(root!.children[0].id, 'a&b');
    });

    test('returns undefined for incomplete XML without throwing', async () => {
        assert.strictEqual(await parse('<svg>'), undefined);
        assert.strictEqual(await parse('<svg><g></svg>'), undefined);
        assert.strictEqual(await parse('<svg><rect></svg>'), undefined);
        assert.strictEqual(await parse('<svg></g>'), undefined);
        assert.strictEqual(await parse('text outside root'), undefined);
        assert.strictEqual(await parse('<!-- unterminated comment'), undefined);
    });
});
