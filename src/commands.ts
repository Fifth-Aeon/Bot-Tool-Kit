import * as fs from "fs";
import { AIConstructor } from "./game_model/ai/aiList";
import { camelCase, capitalize } from "lodash";
import { BotPackager } from "./botPackager";
import { GameManager } from "./gameManager";
import { DefaultAI } from "./game_model/ai/defaultAi";
import { deckMap } from "./game_model/scenarios/decks";
import { TournamentManager } from "./tournamentManager";

const packager = new BotPackager();
const manager = new GameManager();
const tourney = new TournamentManager();

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

    fs.appendFileSync('src/bots/importBots.ts', 
`import { ${typename} } from './${identifier}';
aiList.registerConstructor(${typename});\n\n`);

};

const loadDecks = (deckNames: string[]) => {
    return deckNames.map(name => {
        const properName = camelCase(name);
        if (deckMap.has(properName)) {
            return deckMap.get(properName);
        }
        throw new Error(`No deck named ${name} legal decks are ${Array.from(deckMap.keys())}.`);
    })
}

export const runGame = (deckNames: string[], ais: AIConstructor[]) => {
    const decks = loadDecks(deckNames);
    manager.startAIGame(ais[0], ais[1], decks[0], decks[1]);
}

export const runTournament = (ais: AIConstructor[],deckNames: string[], mirrorMode: boolean, gamesPerMatchup: number) => {
    tourney.runRoundRobinTournament(ais, loadDecks(deckNames), mirrorMode, gamesPerMatchup);
}