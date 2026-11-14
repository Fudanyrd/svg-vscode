import * as vscode from 'vscode';

/**
 * VS Code maps `.svg` files to the built-in `xml` language by default, so this
 * starter registers its DocumentSymbolProvider for `xml` (and also `svg`, in
 * case a dedicated svg language is contributed later) and narrows the result
 * to SVG files by checking the file name.
 */
function isSvgDocument(document: vscode.TextDocument): boolean {
  return document.fileName.toLowerCase().endsWith('.svg');
}

class SvgDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<
    vscode.SymbolInformation[] | vscode.DocumentSymbol[]
  > {
    if (!isSvgDocument(document)) {
      return [];
    }

    // Hard-coded starter symbol: the SVG root element.
    //
    // `DocumentSymbol` supports a `children` array to build a tree. Once this
    // node has children, the Outline view shows it as a collapsible container
    // and the breadcrumbs / "Go to Symbol in File" show it as "svg/".
    const svgRoot = new vscode.DocumentSymbol(
      'svg',               // label shown in the Outline panel
      'SVG root element',  // detail (secondary text)
      vscode.SymbolKind.Module,
      new vscode.Range(0, 0, 0, 0), // full range (whole symbol)
      new vscode.Range(0, 0, 0, 0)  // selection range
    );

    return [svgRoot];
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

  const disposable = vscode.commands.registerCommand('demo.helloWorld', () => {
    vscode.window.showInformationMessage('SVG extension is active!');
  });
  
  context.subscriptions.push(disposable);

  console.log("svg extension activated");
}

export function deactivate(): void {}
