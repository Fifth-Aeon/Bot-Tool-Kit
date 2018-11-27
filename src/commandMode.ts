import * as commander from "commander";
import { runTournament, runGame, createBot, packageBot } from "./commands";
import { aiList } from "./game_model/ai/aiList";

export function readArgs() {
    commander.command('game <bot1> <deck1> <bot2> <deck2>')
        .description('Runs a game between the given A.Is with the given decks');

    commander.command('tournament <aiNames> <deckNames> <numberOfGames>')
        .option('-m, --mirror', 'Forces all matches to be mirror matches')
        .description('Runs an A.I tournament with the given decks and players (lists of names and bots should be comma seperated with no spaces)');

    commander.command('create <name>')
        .description('Creates a new bot with the given name.');

    commander.command('package <botfile>')
        .description('Packages a bot in the given file into a distributable form.');

    commander.parse(process.argv);

    let command = commander.args[0];
    switch (command) {
        case 'game':
            parseGameArgs(commander.args[1], commander.args[2], commander.args[3], commander.args[4]);
            break;
        case 'tournament':
            parseTournamentArgs(commander.args[1], commander.args[2], commander.args[3], commander.args[4] || "false");
            break;
        case 'create':
            parseCreatebotArgs(commander.args[1]);
            break;
        case 'package':
            parsePackageBotArgs(commander.args[1]);
            break;
    }
}

function parseTournamentArgs(aiNames: string, deckNames: string, numberOfGames: string, mirror: string) {
    let constructors = aiList.getConstructorsByName(aiNames.split(','));
    let deckNamesTokenized = deckNames.split(',');
    let gameCount = parseInt(numberOfGames);
    let mirrorMode = mirror === "true" ? true : false;
    runTournament(constructors, deckNamesTokenized, mirrorMode, gameCount);
}

function parseGameArgs(bot1: string, deck1: string, bot2: string, deck2: string) {
    runGame([deck1, deck2], aiList.getConstructorsByName([bot1, bot2]));
}

function parseCreatebotArgs(name: string) {
    createBot(name);
}

function parsePackageBotArgs(botfile: string) {
    packageBot(botfile);
}