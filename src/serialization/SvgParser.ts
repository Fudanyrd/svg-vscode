import * as vscode from 'vscode';

type XmlTokenKind = "open" | "self" | "close" | "text";

interface XmlToken {
    readonly kind: XmlTokenKind;
    readonly name: string;
    readonly attrs: Map<string, string>;
    readonly content: string;
    readonly range: vscode.Range;
}

/**
 * Represents an element in the svg document (not including XML comment).
 * Instead of keeping the whole attribute list, only keeping the node id
 * is sufficient for the VS Code plugin.
 *
 * Examples:
 *
 * - A rectangle with no children:
 * <blockquote><pre>
 *   <rect x="0" y="0" width="400" height="300" />
 * </pre></blockquote>
 *
 * - A group of elements:
 * <blockquote><pre>
 *   <g id="g0"></g>
 * </pre></blockquote>
 */
export class XmlNode {
    readonly name: string;
    readonly id: string | undefined;
    readonly range: vscode.Range;
    readonly children: XmlNode[];

    constructor(name: string, id: string | undefined, range: vscode.Range, children: XmlNode[]) {
        this.name = name;
        this.id = id;
        this.range = range;
        this.children = children;
    }
}

function isWhitespaceCode(code: number): boolean {
    return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
}

function isNameStartCode(code: number): boolean {
    return (
        (code >= 0x41 && code <= 0x5a) || // A-Z
        (code >= 0x61 && code <= 0x7a) || // a-z
        code === 0x5f || // _
        code === 0x3a // :
    );
}

function isNameCode(code: number): boolean {
    return (
        isNameStartCode(code) ||
        (code >= 0x30 && code <= 0x39) || // 0-9
        code === 0x2d || // -
        code === 0x2e // .
    );
}

function readName(text: string, start: number): { name: string; next: number } {
    if (start >= text.length || !isNameStartCode(text.charCodeAt(start))) {
        throw new Error('Expected an XML name.');
    }

    let i = start + 1;
    while (i < text.length && isNameCode(text.charCodeAt(i))) {
        i++;
    }

    return { name: text.slice(start, i), next: i };
}

interface ElementFrame {
    readonly name: string;
    readonly id: string | undefined;
    readonly open: XmlToken;
    readonly children: XmlNode[];
}

export class SvgParser {
    parse(document: vscode.TextDocument): XmlNode | undefined {
        try {
            const text = document.getText();
            const tokens = this.tokenize(text, document);
            return this.buildTree(tokens);
        } catch (e: any) {
            // The Outline view is allowed to be empty while the document is
            // being edited and the XML is temporarily incomplete/invalid.
            console.error(`Failed to parse SVG document: ${e.message}`);
            return undefined;
        }
    }

    private tokenize(text: string, document: vscode.TextDocument): XmlToken[] {
        const tokens: XmlToken[] = [];
        let i = 0;

        while (i < text.length) {
            const lt = text.indexOf('<', i);

            if (lt === -1) {
                if (i < text.length) {
                    tokens.push(this.makeTextToken(text, i, text.length, document));
                }
                break;
            }

            if (lt > i) {
                tokens.push(this.makeTextToken(text, i, lt, document));
            }

            if (text.startsWith('<!--', lt)) {
                const end = text.indexOf('-->', lt + 4);
                if (end === -1) {
                    throw new Error('Unterminated XML comment.');
                }
                i = end + 3;
            } else if (text.startsWith('<![CDATA[', lt)) {
                const end = text.indexOf(']]>', lt + 9);
                if (end === -1) {
                    throw new Error('Unterminated CDATA section.');
                }
                tokens.push(this.makeTextToken(text, lt + 9, end, document));
                i = end + 3;
            } else if (text.startsWith('<?', lt)) {
                const end = text.indexOf('?>', lt + 2);
                if (end === -1) {
                    throw new Error('Unterminated processing instruction.');
                }
                i = end + 2;
            } else if (text.startsWith('<!', lt)) {
                i = this.findDeclarationEnd(text, lt + 2) + 1;
            } else if (text.startsWith('</', lt)) {
                const result = this.parseCloseTag(text, lt, document);
                tokens.push(result.token);
                i = result.next;
            } else {
                const result = this.parseElementTag(text, lt, document);
                tokens.push(result.token);
                i = result.next;
            }
        }

        return tokens;
    }

    private makeTextToken(
        text: string,
        start: number,
        end: number,
        document: vscode.TextDocument
    ): XmlToken {
        return {
            kind: 'text',
            name: '',
            attrs: new Map(),
            content: this.decodeEntities(text.slice(start, end)),
            range: this.makeRange(start, end, document)
        };
    }

    private parseCloseTag(
        text: string,
        start: number,
        document: vscode.TextDocument
    ): { token: XmlToken; next: number } {
        let i = start + 2;
        i = this.skipWhitespace(text, i);

        const name = readName(text, i);
        i = name.next;
        i = this.skipWhitespace(text, i);

        if (text[i] !== '>') {
            throw new Error('Expected ">" in closing tag.');
        }
        i++;

        return {
            token: {
                kind: 'close',
                name: name.name,
                attrs: new Map(),
                content: '',
                range: this.makeRange(start, i, document)
            },
            next: i
        };
    }

    private parseElementTag(
        text: string,
        start: number,
        document: vscode.TextDocument
    ): { token: XmlToken; next: number } {
        let i = start + 1;
        const name = readName(text, i);
        i = name.next;

        const attrs = new Map<string, string>();

        while (i < text.length) {
            i = this.skipWhitespace(text, i);
            if (i >= text.length) {
                throw new Error('Unterminated start tag.');
            }

            if (text[i] === '/' && text[i + 1] === '>') {
                i += 2;
                return {
                    token: {
                        kind: 'self',
                        name: name.name,
                        attrs,
                        content: '',
                        range: this.makeRange(start, i, document)
                    },
                    next: i
                };
            }

            if (text[i] === '>') {
                i++;
                return {
                    token: {
                        kind: 'open',
                        name: name.name,
                        attrs,
                        content: '',
                        range: this.makeRange(start, i, document)
                    },
                    next: i
                };
            }

            const attrName = readName(text, i);
            i = attrName.next;
            i = this.skipWhitespace(text, i);

            if (text[i] !== '=') {
                throw new Error(`Expected "=" after attribute "${attrName.name}".`);
            }
            i++;
            i = this.skipWhitespace(text, i);

            const quote = text[i];
            if (quote !== '"' && quote !== "'") {
                throw new Error(`Expected a quoted value for attribute "${attrName.name}".`);
            }
            i++;

            const valueStart = i;
            while (i < text.length && text[i] !== quote) {
                i++;
            }
            if (i >= text.length) {
                throw new Error(`Unterminated value for attribute "${attrName.name}".`);
            }

            attrs.set(attrName.name, this.decodeEntities(text.slice(valueStart, i)));
            i++;
        }

        throw new Error('Unterminated start tag.');
    }

    private findDeclarationEnd(text: string, start: number): number {
        let i = start;
        let bracketDepth = 0;

        while (i < text.length) {
            const ch = text[i];

            if (ch === '"' || ch === "'") {
                const quote = ch;
                i++;
                while (i < text.length && text[i] !== quote) {
                    i++;
                }
                if (i < text.length) {
                    i++;
                }
                continue;
            }

            if (ch === '[') {
                bracketDepth++;
                i++;
                continue;
            }

            if (ch === ']') {
                bracketDepth--;
                i++;
                continue;
            }

            if (ch === '>' && bracketDepth === 0) {
                return i;
            }

            i++;
        }

        throw new Error('Unterminated declaration.');
    }

    private buildTree(tokens: XmlToken[]): XmlNode | undefined {
        const stack: ElementFrame[] = [];
        const roots: XmlNode[] = [];

        for (const token of tokens) {
            if (token.kind === 'text') {
                if (token.content.trim().length > 0 && stack.length === 0) {
                    throw new Error('Text is not allowed outside the root element.');
                }
                continue;
            }

            if (token.kind === 'open') {
                stack.push({
                    name: token.name,
                    id: token.attrs.get('id'),
                    open: token,
                    children: []
                });
                continue;
            }

            if (token.kind === 'self') {
                const node = new XmlNode(token.name, token.attrs.get('id'), token.range, []);
                if (stack.length === 0) {
                    roots.push(node);
                } else {
                    stack[stack.length - 1].children.push(node);
                }
                continue;
            }

            // token.kind === 'close'
            const frame = stack.pop();
            if (!frame || frame.name !== token.name) {
                throw new Error(`Mismatched closing tag </${token.name}>.`);
            }

            const range = new vscode.Range(frame.open.range.start, token.range.end);
            const node = new XmlNode(frame.name, frame.id, range, frame.children);

            if (stack.length === 0) {
                roots.push(node);
            } else {
                stack[stack.length - 1].children.push(node);
            }
        }

        if (stack.length > 0) {
            throw new Error('Unclosed elements remain.');
        }
        if (roots.length !== 1) {
            throw new Error(`Expected exactly one root element, found ${roots.length}.`);
        }

        return roots[0];
    }

    private skipWhitespace(text: string, start: number): number {
        let i = start;
        while (i < text.length && isWhitespaceCode(text.charCodeAt(i))) {
            i++;
        }
        return i;
    }

    private makeRange(start: number, end: number, document: vscode.TextDocument): vscode.Range {
        return new vscode.Range(document.positionAt(start), document.positionAt(end));
    }

    private decodeEntities(value: string): string {
        return value.replace(
            /&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g,
            (match: string, ref: string): string => {
                if (ref.startsWith('#')) {
                    const isHex = ref[1] === 'x' || ref[1] === 'X';
                    const code = isHex
                        ? parseInt(ref.slice(2), 16)
                        : parseInt(ref.slice(1), 10);

                    if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) {
                        return match;
                    }
                    return String.fromCodePoint(code);
                }

                switch (ref) {
                    case 'amp':
                        return '&';
                    case 'lt':
                        return '<';
                    case 'gt':
                        return '>';
                    case 'quot':
                        return '"';
                    case 'apos':
                        return "'";
                    default:
                        return match;
                }
            }
        );
    }
}
