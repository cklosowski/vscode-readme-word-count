// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { count, IWordCountResult } from "@homegrown/word-counter";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "readme-word-count" is now active!'
  );

  const updater = new WordCountUIUpdater();
  context.subscriptions.push(updater);
  updater.update();
}


type WordCountResultKeys = keyof IWordCountResult;
class WordCountUIUpdater {
  private counts = [
    "words" as const
  ];
  private enableSelectionCount: boolean = true;
  private statusBarItem;
  private disposable: vscode.Disposable[] = [];
  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left
    );

    vscode.window.onDidChangeTextEditorSelection(
      this.update,
      this,
      this.disposable
    );
    vscode.window.onDidChangeActiveTextEditor(
      this.update,
      this,
      this.disposable
    );
  }

  update() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document) {
      this.statusBarItem.hide();
      return;
    }

    const document = editor.document;

    // Check if the current document is either `markdown`, `plaintext`, or the filename is `readme.txt` (case insensitive)
    const isMarkdownOrPlaintextOrReadmeTxt = (
      (document.languageId === "markdown" || document.languageId === "plaintext") &&
      document.fileName.toLowerCase().endsWith("readme.txt")
    );

    if (!isMarkdownOrPlaintextOrReadmeTxt) {
      this.statusBarItem.hide();
      return;
    }

    try {
      const docContent = editor.document.getText();
      const lines = docContent.split("\n");

	  // Handle Selection Counts.
      const selectionCount: IWordCountResult = {
        words: 0,
        lines: 0,
        characters: 0,
        charactersWithSpaces: 0,
      };
      const selectionContent = editor.selections
        .map(({ start, end }) => {
          const text = editor.document.getText(new vscode.Range(start, end));
          return text;
        })
        .filter((text) => !!text);
      const showSelectionCount = selectionContent.length > 0;
	  if ( showSelectionCount ) {
		selectionContent.forEach((text) => {
    		const countResult = count(text);
    		Object.keys(selectionCount).forEach((key) => {
    		selectionCount[key as WordCountResultKeys] +=
    			countResult[key as WordCountResultKeys] ?? 0;
    		});
		});
	  }

	  // Handle the section word counts.
      let sectionCounts: { [key: string]: number } = {};
      let currentSection = "";
      let isInSection = false;
      let isOverLimit = false;
	  let firstSectionFound = false;

      for (const line of lines) {
		if ( line.startsWith("===")) {
			// If this is the main header file, we don't want to parse it.
			continue;
		}

		// Until we find our first section, skip the lines.
		let isSectionHeader = line.startsWith("==");
		if (!isSectionHeader && !firstSectionFound ) {
			continue;
		}

		if (isSectionHeader) {
		  isInSection = false;
		  if ( !firstSectionFound ) {
			firstSectionFound = true;
		  }

		  isInSection = true;
          currentSection = line.replace(/=/g, "").trim();
          sectionCounts[currentSection] = 0;
		} else {
          const countResult = count(line);
          sectionCounts[currentSection] += countResult.words ?? 0;
        }
      }

      this.statusBarItem.tooltip = '';
	  for(const [section, count] of Object.entries(sectionCounts)) {
		if ( count > 1500 ) {
			isOverLimit = true;
		}

		this.statusBarItem.tooltip += `${section}: ${count} Words\n`;
	  }

	  /**
	   * Update the status bar item with OK or Overlimit status.
	   */
	  let statusBarItemText = 'Readme: ';

	  statusBarItemText += isOverLimit ? "Overlimit" : "OK";

	  // If we are showing the selection count, then add the selection count to the status bar item.
	  if ( showSelectionCount ) {
		statusBarItemText += ` | Selected: ${selectionCount.words} Words`;
	  }

      this.statusBarItem.text = statusBarItemText;

      // Set the status bar item background color to red if over the limit. Otherwise Green.=
	  this.statusBarItem.backgroundColor = isOverLimit ?
		new vscode.ThemeColor('statusBarItem.errorBackground') :
		new vscode.ThemeColor('statusBarItem.successBackground');

      this.statusBarItem.show();
    } catch (e) {
      console.log(e);
    }
  }

  dispose() {
    this.statusBarItem.dispose();
    vscode.Disposable.from(...this.disposable).dispose();
  }
}
