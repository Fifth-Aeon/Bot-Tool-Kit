import * as figlet from 'figlet';
import * as fs from 'fs';
import * as inquirer from 'inquirer';
import * as path from 'path';
import { AIConstructor, aiList } from '../game_model/ai/aiList';
import { DefaultAI } from '../game_model/ai/defaultAi';
import { DeckList } from '../game_model/deckList';
import { allDecks } from '../game_model/scenarios/decks';
import { createBot, packageBot, runGame, runTournament } from './commands';
import { Tournament } from './tournamentDefinition';
import { tournamentLoader } from './tournamentLoader';

const chalk = require('chalk');

const createBanner = () => {
    console.log(
        chalk.cyan(
            figlet.textSync('Fifth Aeon - Bot Toolkit', {
                font: 'Standard',
                horizontalLayout: 'default',
                verticalLayout: 'default'
            })
        )
    );
};

const askForCommand = async () => {
    const options = {
        tournament: 'Run a tournament',
        tournamentDef: 'Create a new tournament definition',
        game: 'Run a game (between 2 bots)',
        create: 'Create a new bot',
        package: 'Package a bot for distribution'
    };
    const result = await inquirer.prompt([
        {
            type: 'list',
            name: 'option',
            message: 'What would you like to do?',
            choices: [
                options.tournament,
                options.tournamentDef,
                options.game,
                options.create,
                options.package
            ]
        }
    ]);
    const choice = (result as any).option as string;

    switch (choice) {
        case options.create:
            getNewBotDetails();
            break;
        case options.package:
            selectBotToPackage();
            break;
        case options.game:
            getGameDetails();
            break;
        case options.tournament:
            getTournamentToStart();
            break;
        case options.tournamentDef:
            getTournamentDetails();
            break;
    }
};

const botsPath = 'src/bots';
const selectBotToPackage = async () => {
    const files = fs.readdirSync(botsPath);
    const botFiles = files
        .filter(name => name.includes('.ts'))
        .map(name => path.join(botsPath, name));

    const result = await inquirer.prompt([
        {
            type: 'list',
            name: 'path',
            message: 'Which file would you like to package as a bot',
            choices: botFiles
        }
    ]);
    const filename = (result as any).path as string;
    packageBot(filename);
};

const getSingleDeck = async (message: string): Promise<string> => {
    const result = await inquirer.prompt([
        {
            type: 'list',
            name: 'deckName',
            message: message,
            choices: allDecks.sort()
        }
    ]);
    return (result as any).deckName as string;
};

const getGameDetails = async () => {
    runGame(
        [
            await getSingleDeck('Player 1 deck'),
            await getSingleDeck('Player 2 deck')
        ],
        [DefaultAI, DefaultAI]
    );
};

const getDeckSet = async (): Promise<DeckList[]> => {
    const result = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'deckNames',
            message: 'Select the decks that will be used',
            choices: allDecks.map(deck => deck.name).sort()
        }
    ]);
    return tournamentLoader.getDecksByName((result as any).deckNames as string[]);
};

const getAISet = async (): Promise<AIConstructor[]> => {
    const result = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'ais',
            message: 'Select A.Is to play in the tournament',
            choices: aiList.getConsturctorNames()
        }
    ]);
    return aiList.getConstructorsByName((result as any).ais);
};

const getMirrorMode = async (): Promise<boolean> => {
    const mirrorMode =
        'Mirror matches only (both A.I always have the same deck)';
    const result = await inquirer.prompt([
        {
            type: 'list',
            name: 'deckName',
            message: 'Select Mode',
            choices: [mirrorMode, 'Allow non-mirror matches']
        }
    ]);
    return (result as any).mode === mirrorMode;
};

const getMatchNumber = async (): Promise<number> => {
    const result = await inquirer.prompt([
        {
            type: 'input',
            name: 'count',
            message: 'How many matches should be played between each A.I?',
            filter: input => parseInt(input, 10),
            validate: input => {
                const int = parseInt(input, 10);
                if (isNaN(int) || int < 1) {
                    return 'Must be a positive integer';
                }
                return true;
            }
        }
    ]);
    return (result as any).count as number;
};

const getTournamentDefinition = async (): Promise<Tournament> => {
    const result = await inquirer.prompt([
        {
            type: 'list',
            name: 'definitonName',
            message: 'Choose a tournament definition',
            choices: tournamentLoader.getTournamentNames()
        }
    ]);
    return tournamentLoader.getTournamentByName((result as any)
        .definitonName as string);
};

const getTournamentToStart = async () => {
    const tourny = await getTournamentDefinition();
    runTournament(tourny);
};

const getTournamentDetails = async () => {
    /*
    runTournament(
        await getAISet(),
        await getDeckSet(),
        await getMirrorMode(),
        await getMatchNumber()
    );
    */
};

const getNewBotDetails = async () => {
    const result = await inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'What will the bot be named?'
        }
    ]);
    const name = (result as any).name as string;
    createBot(name);
};

export const openInteractivePrompt = async () => {
    // show script introduction
    createBanner();

    // ask questions
    askForCommand();
};
