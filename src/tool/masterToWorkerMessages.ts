import { SavedDeck } from 'game_model/deckList';
import { GameSyncEvent } from 'game_model/events/syncEvent';
import { CardData } from '../game_model/cards/cardList';
import { GameInfo } from './gameManager';
import { GameAction } from '../game_model/events/gameAction';

export enum MasterToWorkerMessageType {
    StartAI,
    StartGame,
    AddCard,
    Timeout,
    SyncMessage,
    ActionMessage
}

export type MasterToWorkerMessage =
    | SyncMessage
    | ActionMessage
    | StartAiMessage
    | StartGameMesage
    | AddCardMessage
    | TimeoutMessage;

export interface ActionMessage {
    readonly type: MasterToWorkerMessageType.ActionMessage;
    readonly action: GameAction;
}

export interface SyncMessage {
    readonly type: MasterToWorkerMessageType.SyncMessage;
    readonly event: GameSyncEvent;
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
