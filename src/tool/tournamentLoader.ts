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
import { aiList } from '../game_model/ai/aiList';
import { allDecks } from '../game_model/scenarios/decks';

class TournamentLoader {
    private static tournamentDataPath = 'data/tournaments';
    private static deckDataPath = 'data/decks';

    private tournamentDefinitions = new Map<string, TournamentDefinition>();
    private decks = new Map<string, DeckList>();

    constructor() {
        this.readAllTournaments();
        this.readAllDecks();
    }

    public getTournamentNames() {
        return Array.from(this.tournamentDefinitions.keys());
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
                return {
                    ais: this.getAiConstructors(definition.ais),
                    aiDeckPools: definition.aiDeckPools.map(pool =>
                        this.getDecksByName(pool)
                    ),
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

    private readAllTournaments() {
        const files = this.getJsonFiles(TournamentLoader.tournamentDataPath);

        for (const file of files) {
            const fileData = JSON.parse(
                fs.readFileSync(file).toString()
            ) as TournamentDefinition;
            this.tournamentDefinitions.set(fileData.name, fileData);
        }
    }

    private readAllDecks() {
        const files = this.getJsonFiles(TournamentLoader.deckDataPath);

        for (const deck of allDecks) {
            this.decks.set(deck.name, deck);
        }

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

    private getJsonFiles(directory: string) {
        return fs
            .readdirSync(directory)
            .filter(name => name.includes('.json'))
            .map(name => path.join(directory, name));
    }
}

export const tournamentLoader = new TournamentLoader();
