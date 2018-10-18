import * as fs from "fs";
import * as path from "path";
import * as inquirer from "inquirer";
import * as figlet from "figlet";
import { BotPackager } from "./botPackager";
import { camelCase, capitalize } from "lodash";
import { GameManager } from "./gameManager";

const chalk = require("chalk");
const packager = new BotPackager();
const manager = new GameManager();

//const shell = require("shelljs");

const init = () => {
  console.log(
    chalk.cyan(
      figlet.textSync("Fifth Aeon - Bot Toolkit", {
        font: "Standard",
        horizontalLayout: "default",
        verticalLayout: "default"
      })
    )
  );
};

const botsPath = "src/bots";
const packageBot = async () => {
  let files = fs.readdirSync(botsPath);
  let botFiles = files
    .filter(name => name.includes(".ts"))
    .map(name => path.join(botsPath, name));

  let result = await inquirer.prompt([
    {
      type: "list",
      name: "path",
      message: "Which file would you like to package as a bot",
      choices: botFiles
    }
  ]);
  let filename = (result as any).path as string;

  packager.buildBot(filename);
};

const outputBot = (name: string) => {
  const identifier = camelCase(name);
  const typename = capitalize(identifier);
  const code = `import { DefaultAI } from '../game_model/ai/defaultAi';

/**
 * ${name} is a Fifth Aeon bot.
 * 
 * It inherits the behavior of the default bot. You can customize it by overriding methods.
 * 
 * If you would rather work from scratch change extends DefaultAI to extends AI
 */
export class ${typename} extends DefaultAI {

}
`;

  fs.writeFileSync(`src/bots/${identifier}.ts`, code);
};

const createBot = async () => {
  let result = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "What will the bot be named?"
    }
  ]);
  let name = (result as any).name as string;

  outputBot(name);
};

const askForCommand = async () => {
  const options = {
    create: "Create a new bot",
    package: "Package a bot for distribution",
    game: "Run a game (between 2 bots)"
  };
  let result = await inquirer.prompt([
    {
      type: "list",
      name: "option",
      message: "What would you like to do?",
      choices: [options.create, options.package, options.game]
    }
  ]);
  let choice = (result as any).option as string;

  switch (choice) {
    case options.create:
      createBot();
      break;
    case options.package:
      packageBot();
      break;
    case options.game:
      manager.startAIGame();
      break;
  }
};

const run = async () => {
  // show script introduction
  init();

  // ask questions
  askForCommand();
};
run();
