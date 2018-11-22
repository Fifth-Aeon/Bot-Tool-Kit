import * as figlet from "figlet";
import * as fs from "fs";
import * as inquirer from "inquirer";
import * as path from "path";
import { createBot, runGame, runTournament, packageBot } from "./commands";
import { allDecks } from "./game_model/scenarios/decks";

const chalk = require("chalk");

const createBanner = () => {
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

const askForCommand = async () => {
    const options = {
        tournament: "Run a round robin tournament",
        game: "Run a game (between 2 bots)",
        create: "Create a new bot",
        package: "Package a bot for distribution"
    };
    let result = await inquirer.prompt([
        {
            type: "list",
            name: "option",
            message: "What would you like to do?",
            choices: [options.tournament, options.game, options.create, options.package]
        }
    ]);
    let choice = (result as any).option as string;

    switch (choice) {
        case options.create:
            getNewBotDetails();
            break;
        case options.package:
            selectBotToPackage();
            break;
        case options.game:
        getGameDetails()
            break;
        case options.tournament:
            getTournamentDetails();
            break;
    }
};

const botsPath = "src/bots";
const selectBotToPackage = async () => {
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
    packageBot(filename);
}

const getSingleDeck = async (message: string): Promise<string> => {
    let result = await inquirer.prompt([
        {
            type: "list",
            name: "deckName",
            message: message,
            choices: allDecks.sort()
        }
    ]);
    return (result as any).deckName as string
}

const getGameDetails = async () => {
    runGame([await getSingleDeck('Player 1 deck'), await getSingleDeck('Player 2 deck')]);
}

const getDeckSet = async (): Promise<string[]> => {
    let result = await inquirer.prompt([
        {
            type: "checkbox",
            name: "deckNames",
            message: "Select the decks that will be used",
            choices: allDecks.sort()
        }
    ]);
    return (result as any).deckNames as string[];
}

const getMirrorMode = async (): Promise<boolean> => {
    let mirrorMode = "Mirror matches only (both A.I always have the same deck)"
    let result = await inquirer.prompt([
        {
            type: "list",
            name: "deckName",
            message: "Select Mode",
            choices: [mirrorMode, "Allow non-mirror matches"]
        }
    ]);
    return (result as any).mode  == mirrorMode;
}

const getMatchNumber = async (): Promise<number> => {
    let result = await inquirer.prompt([
        {
            type: "input",
            name: "count",
            message: "How many matches should be played between each A.I?",
            filter: input => parseInt(input),
            validate: input => {
                let int = parseInt(input);
                if (isNaN(int) || int < 1) {
                    return "Must be a positive integer";
                }
                return true;
            }
        }
    ]);
    return (result as any).count as number;
}

const getTournamentDetails = async () => {
    runTournament(await getDeckSet(), await getMirrorMode(), await getMatchNumber());
}

const getNewBotDetails = async () => {
    let result = await inquirer.prompt([
        {
            type: "input",
            name: "name",
            message: "What will the bot be named?"
        }
    ]);
    let name = (result as any).name as string;
    createBot(name);
}

export const openInteractivePrompt = async () => {
    // show script introduction
    createBanner();

    // ask questions
    askForCommand();
};

