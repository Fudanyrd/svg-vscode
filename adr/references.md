# References

Documentation consulted while building this starter extension.

## VS Code extension basics

- [Your First Extension](https://code.visualstudio.com/api/get-started/your-first-extension)
- [Extension Anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy)
- [Extension Manifest (package.json) reference](https://code.visualstudio.com/api/references/extension-manifest)
- [Activation Events](https://code.visualstudio.com/api/references/activation-events)

## Outline / document symbols API

- [Programmatic Language Features — Document Symbols](https://code.visualstudio.com/api/language-extensions/programmatic-language-features#show-all-symbol-definitions-within-a-document)
- [`DocumentSymbolProvider`](https://code.visualstudio.com/api/references/vscode-api#DocumentSymbolProvider)
- [`languages.registerDocumentSymbolProvider`](https://code.visualstudio.com/api/references/vscode-api#languages.registerDocumentSymbolProvider)
- [`DocumentSymbol`](https://code.visualstudio.com/api/references/vscode-api#DocumentSymbol)
- [`SymbolKind`](https://code.visualstudio.com/api/references/vscode-api#SymbolKind)
- [`DocumentSelector`](https://code.visualstudio.com/api/references/vscode-api#DocumentSelector)
- [`TextDocument`](https://code.visualstudio.com/api/references/vscode-api#TextDocument)

## Language contributions (for future work)

- [Language Extension Guidelines](https://code.visualstudio.com/api/language-extensions/overview)
- [Language Configuration Guide](https://code.visualstudio.com/api/language-extensions/language-configuration-guide)
- [Syntax Highlight Guide](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide)

## Notes / findings

- The local VS Code install (1.145.2) maps `.svg` to the built-in `xml`
  language (see `resources/app/extensions/xml/package.json`). Because of this,
  the starter registers its `DocumentSymbolProvider` for the `xml` language and
  filters by file name inside the provider, instead of contributing a new
  `svg` language id (which would conflict with the built-in `.svg → xml`
  association).
- In the Outline view a `DocumentSymbol` with children is rendered as a
  collapsible container; in the breadcrumbs / "Go to Symbol in File" that
  container is shown with a trailing `/` (e.g. `svg/`).
