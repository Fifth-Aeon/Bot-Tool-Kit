import { SavedDeck } from "game_model/deckList";
import { CardData } from "game_model/cards/cardList";

export enum MasterToWorkerMessageType {
    StartGame, AddCard, Timeout
}

export type MasterToWorkerMessage = StartGameMesage | AddCardMessage | TimeoutMessage;

export interface StartGameMesage {
    readonly type: MasterToWorkerMessageType.StartGame;
    readonly ai1: string;
    readonly ai2: string;
    readonly deck1: SavedDeck;
    readonly deck2: SavedDeck;
    readonly playerNumbers: number[];
}

export interface AddCardMessage {
    readonly type: MasterToWorkerMessageType.AddCard;
    readonly cardData: CardData;
}

export interface TimeoutMessage {
    readonly type: MasterToWorkerMessageType.Timeout;
}
