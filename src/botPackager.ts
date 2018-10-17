import * as fs from "fs";
import * as util from "util";
import * as path from "path";
import * as ts from "typescript";
import * as webpack from "webpack";

const packageOutPath = "packaged";
const outPath = "dist/bots";
export class BotPackager {

  public buildBot(botName: string) {
    this.compile([botName], {
      noEmitOnError: false,
      noImplicitAny: false,
      outDir: "dist",
      target: ts.ScriptTarget.ES2017,
      module: ts.ModuleKind.CommonJS
    });

    this.runWebpack(path.join(outPath, botName.replace(".ts", ".js")));
  }

  private compile(fileNames: string[], options: ts.CompilerOptions): void {
    let program = ts.createProgram(fileNames, options);
    let emitResult = program.emit();

    let allDiagnostics = ts
      .getPreEmitDiagnostics(program)
      .concat(emitResult.diagnostics);

    allDiagnostics.forEach(diagnostic => {
      if (diagnostic.file) {
        let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
          diagnostic.start!
        );
        let message = ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          "\n"
        );
        console.log(
          `${diagnostic.file.fileName} (${line + 1},${character +
            1}): ${message}`
        );
      } else {
        console.log(
          `${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`
        );
      }
    });

    let exitCode = emitResult.emitSkipped ? 1 : 0;
  }

  private runWebpack(file: string) {
    path.basename(file)
    const jsFile = './' + path.join(outPath, path.basename(file));
    const packageFile = './' + path.join(packageOutPath, path.basename(file));
    console.log(jsFile);
    console.log(packageFile)
    const compiler = webpack({
      entry: jsFile,
      output: {
        filename: packageFile
      }
    });

    compiler.run((err, stats) => {
      if (err) console.error(err);
      console.log(stats.toString());

      console.log("webpack ran");
    });
  }
}
