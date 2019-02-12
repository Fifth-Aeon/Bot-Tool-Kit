import { GameInfo } from './gameManager';
import { CardData } from '../game_model/cards/cardList';

export enum MasterToWorkerMessageType {
    StartGame,
    AddCard,
    Timeout
}

export type MasterToWorkerMessage =
    | StartGameMesage
    | AddCardMessage
    | TimeoutMessage;

export interface StartGameMesage {
    readonly type: MasterToWorkerMessageType.StartGame;
    readonly game: GameInfo;
}

export interface AddCardMessage {
    readonly type: MasterToWorkerMessageType.AddCard;
    readonly cardData: CardData;
}

export interface TimeoutMessage {
    readonly type: MasterToWorkerMessageType.Timeout;
}
