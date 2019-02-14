import * as fs from 'fs';
import { AIConstructor } from '../game_model/ai/aiList';
import { camelCase, capitalize } from 'lodash';
import { BotPackager } from './botPackager';
import { GameManager } from './gameManager';
import { deckMap } from '../game_model/scenarios/decks';
import { TournamentManager } from './tournamentManager';
import { DeckList } from 'game_model/deckList';
import { Tournament, TournamentType } from './tournamentDefinition';

const packager = new BotPackager();
const manager = new GameManager();

export const packageBot = (filename: string) => {
    packager.buildBot(filename);
};

export const createBot = (name: string) => {
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

    fs.appendFileSync(
        'src/bots/importBots.ts',
        `import { ${typename} } from './${identifier}';
aiList.registerConstructor(${typename});\n\n`
    );
};

const loadDecks = (deckNames: string[]) => {
    return deckNames.map(name => {
        const properName = camelCase(name);
        const deck = deckMap.get(properName);
        if (!deck) {
            throw new Error(
                `No deck named ${name} legal decks are ${Array.from(
                    deckMap.keys()
                )}.`
            );
        }
        return deck;
    });
};

export const runGame = (deckNames: string[], ais: AIConstructor[]) => {
    const decks = loadDecks(deckNames);
    const deck1 = decks[0];
    const deck2 = decks[1];
    if (!deck1 || !deck2) {
        throw new Error('No decks found with the given ids');
    }
    manager.startAIGame(ais[0], ais[1], deck1, deck2);
};

export const runTournament = async (tournament: Tournament) => {
    switch (tournament.type) {
        case TournamentType.Preconstructed:
            await TournamentManager.getInstance().runRoundRobinTournament(
                tournament.ais,
                tournament.deckPool,
                tournament.mirrorMode,
                tournament.gamesPerMatchup
            );
            break;
    }
    process.exit(0);
};
