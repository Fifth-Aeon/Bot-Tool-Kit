import * as fs from "fs";
import * as util from "util";
import * as path from "path";
import * as ts from "typescript";
import * as webpack from "webpack";

function compile(fileNames: string[], options: ts.CompilerOptions): void {
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
        `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
      );
    } else {
      console.log(
        `${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`
      );
    }
  });

  let exitCode = emitResult.emitSkipped ? 1 : 0;
}

const runWebpack = (file: string) => {
  const compiler = webpack({
    entry: './out/bots/berserker.js',
    output: {
      filename: file + '.js',
    }
  });

  compiler.run((err, stats) => {
    if (err) console.error(err);
    console.log(stats.toString());

    console.log("webpack ran");
  });
};

const readdir = util.promisify(fs.readdir);
const botsPath = "src/bots";
const outPath = "out/bots";
(async () => {
  let files = await readdir(botsPath);
  let botFiles = files
    .filter(name => name.includes(".ts"))
    .map(name => path.join(botsPath, name));

  compile(botFiles, {
    noEmitOnError: false,
    noImplicitAny: false,
    outDir: "out",
    target: ts.ScriptTarget.ES2017,
    module: ts.ModuleKind.CommonJS
  });

  runWebpack(path.join(outPath, botFiles[0].replace('.ts', '.js')));
})();
