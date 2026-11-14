import * as path from 'path';
import * as vscode from 'vscode';
import { XmlNode, SvgParser } from './serialization/SvgParser';

/**
 * VS Code maps `.svg` files to the built-in `xml` language by default, so this
 * starter registers its DocumentSymbolProvider for `xml` (and also `svg`, in
 * case a dedicated svg language is contributed later) and narrows the result
 * to SVG files by checking the file name.
 */
function isSvgDocument(document: vscode.TextDocument): boolean {
  return document.fileName.toLowerCase().endsWith('.svg');
}

/**
 * Returns true when `filePath` has an `.svg` extension (case-insensitive).
 * This is the sole predicate behind the Explorer `[]` badge.
 */
function hasSvgExtension(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.svg';
}

/**
 * Decorates `.svg` files with a `[]` badge in the Explorer view.
 *
 * The badge is purely presentational: it is attached to the Explorer tree
 * node by VS Code and never changes the file name or file contents.
 */
export class SvgFileDecorationProvider implements vscode.FileDecorationProvider {
  async provideFileDecoration(
    uri: vscode.Uri,
    _token: vscode.CancellationToken
  ): Promise<vscode.FileDecoration | undefined> {
    // Only decorate real files on disk. URI schemes such as `untitled:` or
    // virtual schemes are not part of the Explorer file tree we target.
    if (uri.scheme !== 'file' || !hasSvgExtension(uri.fsPath)) {
      return undefined;
    }

    // A directory may technically be named `something.svg`; do not decorate
    // it because the requirement is to mark files only.
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.type !== vscode.FileType.File) {
        return undefined;
      }
    } catch {
      // The file may have been deleted between the tree query and the stat
      // call. Treat it as non-decoratable instead of failing.
      return undefined;
    }

    return {
      badge: '[]',
      tooltip: 'SVG file'
    };
  }
}

class SvgDocumentSymbolProvider implements vscode.DocumentSymbolProvider {

  private inferSymbolKind(name: string): vscode.SymbolKind {
    switch (name) {
      case "svg": {
        return vscode.SymbolKind.Module;
      }
      case "g": {
        return vscode.SymbolKind.Class;
      }
    }
    return vscode.SymbolKind.Method;
  }

  private buildSymbol(node: XmlNode): vscode.DocumentSymbol {
    let children: vscode.DocumentSymbol[] = [];

    var childNode: XmlNode;
    for (var i = 0; i < node.children.length; i++) {
      childNode = node.children[i];
      children.push(this.buildSymbol(childNode));
    }

    let ret = new vscode.DocumentSymbol(
      node.name + (node.id ? `#${node.id}` : ""),
      "",
      this.inferSymbolKind(node.name),
      node.range,
      node.range, 
    );
    ret.children = children;
    return ret;
  }

  provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<
    vscode.SymbolInformation[] | vscode.DocumentSymbol[]
  > {
    if (!isSvgDocument(document)) {
      return [];
    }

    const svgRoot = (new SvgParser()).parse(document);
    if (svgRoot === undefined) {
      return [];
    }
    return [this.buildSymbol(svgRoot)];
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new SvgDocumentSymbolProvider();

  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      [{ language: 'xml', scheme: 'file' }, { language: 'svg', scheme: 'file' }],
      provider
    )
  );

  // A.1: show a `[]` badge next to `.svg` files in the Explorer view.
  const decorationProvider = new SvgFileDecorationProvider();
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(decorationProvider)
  );

  const disposable = vscode.commands.registerCommand('demo.helloWorld', () => {
    vscode.window.showInformationMessage('SVG extension is active!');
  });
  
  context.subscriptions.push(disposable);

  console.log("svg extension activated");
}

export function deactivate(): void {}
