import { SavedDeck } from 'game_model/deckList';
import { GameSyncEvent } from 'game_model/events/syncEvent';
import { CardData } from '../game_model/cards/cardList';
import { GameInfo } from './gameManager';

export enum MasterToWorkerMessageType {
    StartAI,
    StartGame,
    AddCard,
    Timeout,
    SyncMessage
}

export type MasterToWorkerMessage =
    | SyncMessage
    | StartAiMessage
    | StartGameMesage
    | AddCardMessage
    | TimeoutMessage;

export interface SyncMessage {
    readonly type: MasterToWorkerMessageType.SyncMessage;
    readonly events: GameSyncEvent[];
}

export interface StartAiMessage {
    readonly type: MasterToWorkerMessageType.StartAI;
    readonly aiName: string;
    readonly deck: SavedDeck;
    readonly playerNumber: number;
}

export interface StartGameMesage {
    readonly type: MasterToWorkerMessageType.StartGame;
    readonly game: GameInfo;
    readonly seperateAiWorkers: boolean;
}

export interface AddCardMessage {
    readonly type: MasterToWorkerMessageType.AddCard;
    readonly cardData: CardData;
}

export interface TimeoutMessage {
    readonly type: MasterToWorkerMessageType.Timeout;
}
