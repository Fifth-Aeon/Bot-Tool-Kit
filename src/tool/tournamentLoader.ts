import * as fs from 'fs';
import * as path from 'path';
import {
    TournamentDefinition,
    PreconstructedTournament,
    LimitedTournament,
    ConstructedTournament,
    TournamentType,
    TournamentOptions,
    Tournament
} from './tournamentDefinition';
import { SavedDeck, DeckList } from '../game_model/deckList';
import { standardFormat } from '../game_model/gameFormat';
import { aiList, AIConstructor } from '../game_model/ai/aiList';
import { Scenario, ScenarioData } from '../game_model/scenario';

class TournamentLoader {
    private static tournamentDataPath = 'data/tournaments';
    private static deckDataPath = 'data/decks';
    private static scenarioDataPath = 'data/testScenarios';

    private tournamentDefinitions = new Map<string, TournamentDefinition>();
    private decks = new Map<string, DeckList>();
    private scenarios = new Map<string, Scenario>();

    constructor() {
        this.readAllTournaments();
        this.readAllDecks();
        this.readAllScenarios();
    }

    public getTournamentNames() {
        return Array.from(this.tournamentDefinitions.keys());
    }

    public getScenarioNames() {
        return Array.from(this.scenarios.keys());
    }

    public getTournamentByName(name: string) {
        const constructor = this.tournamentDefinitions.get(name);
        if (!constructor) {
            throw new Error(`No tournament definiton found named ${name}`);
        }
        return this.buildTournamentDefintion(constructor);
    }

    public getDecksByName(names: string[] | TournamentOptions.UseAll) {
        if (names === TournamentOptions.UseAll) {
            return [...this.decks.values()];
        }
        return names.map(name => {
            const constructor = this.decks.get(name);
            if (!constructor) {
                throw new Error(`No deck definiton found named ${name}`);
            }
            return constructor;
        });
    }

    public getDeckNames() {
        return Array.from(this.decks.keys());
    }

    private buildTournamentDefintion(
        definition: TournamentDefinition
    ): Tournament {
        switch (definition.type) {
            case TournamentType.Preconstructed:
                return {
                    ais: this.getAiConstructors(definition.ais),
                    deckPool: this.getDecksByName(definition.deckPool),
                    gamesPerMatchup: definition.gamesPerMatchup,
                    mirrorMode: definition.mirrorMode,
                    type: definition.type
                } as PreconstructedTournament;
            case TournamentType.Constructed:
                const aisWithDecks = new Map<AIConstructor, DeckList[]>();
                for (const key in definition.aisWithDecks) {
                    if (definition.aisWithDecks) {
                        aisWithDecks.set(this.getAiConstructor(key), this.getDecksByName(definition.aisWithDecks[key]));
                    }
                }
                return {
                    aisWithDecks: aisWithDecks,
                    gamesPerMatchup: definition.gamesPerMatchup,
                    type: definition.type
                } as ConstructedTournament;
            case TournamentType.Limited:
                return {
                    ais: this.getAiConstructors(definition.ais),
                    gamesPerMatchup: definition.gamesPerMatchup,
                    cardsInPool: definition.cardsInPool,
                    type: definition.type
                } as LimitedTournament;
        }
    }

    private getAiConstructors(names: string[] | TournamentOptions.UseAll) {
        if (names === TournamentOptions.UseAll) {
            return aiList.getConstructors();
        }
        return aiList.getConstructorsByName(names);
    }

    private getAiConstructor(name: string) {
        return aiList.getConstructorsByName([name])[0];
    }

    private readAllScenarios() {
        const files = this.getJsonFiles(TournamentLoader.scenarioDataPath);

        for (const file of files) {
            const fileData = JSON.parse(
                fs.readFileSync(file).toString()
            ) as ScenarioData;
            this.scenarios.set(fileData.name, new Scenario(fileData));
        }
    }

    private readAllDecks() {
        const files = this.getJsonFiles(TournamentLoader.deckDataPath);
        for (const file of files) {
            const fileData = JSON.parse(
                fs.readFileSync(file).toString()
            ) as SavedDeck;
            this.decks.set(
                fileData.name,
                new DeckList(standardFormat, fileData)
            );
        }
    }

    private readAllTournaments() {
        const files = this.getJsonFiles(TournamentLoader.tournamentDataPath);

        for (const file of files) {
            const fileData = JSON.parse(
                fs.readFileSync(file).toString()
            ) as TournamentDefinition;
            this.tournamentDefinitions.set(fileData.name, fileData);
        }
    }

    private getJsonFiles(directory: string) {
        return fs
            .readdirSync(directory)
            .filter(name => name.includes('.json'))
            .map(name => path.join(directory, name));
    }
}

export const tournamentLoader = new TournamentLoader();
