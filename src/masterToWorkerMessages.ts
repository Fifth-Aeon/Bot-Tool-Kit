import { SavedDeck } from "game_model/deckList";
import { CardData } from "game_model/cards/cardList";

export enum MasterToWorkerMessageType {
    StartGame, AddCard, Timeout
}

export type MasterToWorkerMessage = StartGameMesage | AddCardMessage | TimeoutMessage;

export interface StartGameMesage {
    type: MasterToWorkerMessageType.StartGame;
    ai1: string;
    ai2: string;
    deck1: SavedDeck;
    deck2: SavedDeck;
    playerNumbers: number[];
}

export function isStartGameMessage(message: MasterToWorkerMessage): message is StartGameMesage {
    return message.type === MasterToWorkerMessageType.StartGame;
}

export interface AddCardMessage {
    type: MasterToWorkerMessageType.AddCard;
    cardData: CardData;
}

export function isAddCardMessage(message: MasterToWorkerMessage): message is AddCardMessage {
    return message.type === MasterToWorkerMessageType.AddCard;
}

export interface TimeoutMessage {
    type: MasterToWorkerMessageType.Timeout;
}

export function isTimeoutMessage(message: MasterToWorkerMessage): message is TimeoutMessage {
    return message.type === MasterToWorkerMessageType.Timeout;
}
