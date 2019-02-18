import { DeckList } from '../game_model/deckList';
import { AIConstructor } from '../game_model/ai/aiList';

export type TournamentDefinition =
    | PreconstructedTournamentDefinition
    | ConstructedTournamentDefinition
    | LimitedTournamentDefinition;

export type Tournament =
    | PreconstructedTournament
    | ConstructedTournament
    | LimitedTournament;

export enum TournamentType {
    Preconstructed = 'Preconstructed',
    Constructed = 'Constructed',
    Limited = 'Limited'
}

export enum TournamentOptions {
    UseAll = 'UseAll'
}

export interface PreconstructedTournament {
    type: TournamentType.Preconstructed;
    deckPool: DeckList[];
    ais: AIConstructor[];
    mirrorMode: boolean;
    gamesPerMatchup: number;
}

interface PreconstructedTournamentDefinition {
    name: string;
    type: TournamentType.Preconstructed;
    deckPool: string[] | TournamentOptions.UseAll;
    ais: string[] | TournamentOptions.UseAll;
    mirrorMode: boolean;
    gamesPerMatchup: number;
}

export interface ConstructedTournament {
    type: TournamentType.Constructed;
    aisWithDecks: Map<AIConstructor, DeckList[]>;
    gamesPerMatchup: number;
}

interface ConstructedTournamentDefinition {
    name: string;
    type: TournamentType.Constructed;
    aisWithDecks: {
        [key: string]: string[];
    };
    gamesPerMatchup: number;
}

export interface LimitedTournament {
    type: TournamentType.Limited;
    ais: AIConstructor[];
    gamesPerMatchup: number;
    cardsInPool: number;
}

interface LimitedTournamentDefinition {
    name: string;
    type: TournamentType.Limited;
    ais: string[] | TournamentOptions.UseAll;
    gamesPerMatchup: number;
    cardsInPool: number;
}
