import * as commander from "commander";
import { runTournament, runGame, createBot, packageBot } from "./commands";
import { aiList } from "./game_model/ai/aiList";

export function readArgs() {
    commander
        .command('game <deck1> <deck2>', 'Runs a game between the given A.Is with the given decks')
        .action(function (deck1, deck2) {
            console.log('game')
            runGame([deck1, deck2]);
        });
        
    commander.command('tournament <aiNames> <deckNames> <numberOfGames>')
        .description('Runs an A.I tournament with the given decks and players (lists of names and bots should be comma seperated with no spaces)')
        .option('-m, --mirror', 'Forces all matches to be mirror matches')
        .action(function (aiNames: string, deckNames: string, numberOfGames: string, options) {
            let constructors = aiList.getConstructorsByName(aiNames.split(','));
            let deckNamesTokenized = deckNames.split(',');
            let gameCount = parseInt(numberOfGames);
            let mirrorMode = options.mirror ? true : false;
            runTournament(constructors, deckNamesTokenized, mirrorMode, gameCount);
        });

    commander
        .command('create <name>', 'Creates a new bot with the given name.')
        .action(function (name) {
            createBot(name);
        });

    commander
        .command('package <botfile>', 'Packages a bot in the given file into a distributable form.')
        .action(function (botfile) {
            packageBot(botfile);
        });

    commander.parse(process.argv)
}