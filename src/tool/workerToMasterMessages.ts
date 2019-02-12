import { GameInfo } from './gameManager';

export enum WorkerToMasterMessageType {
    Ready,
    GameResult
}

export type WorkerToMasterMessage = ReadyMessage | GameResultMessage;

export interface ReadyMessage {
    readonly type: WorkerToMasterMessageType.Ready;
    readonly id: number;
}

interface GameResultMessageBase {
    readonly type: WorkerToMasterMessageType.GameResult;
    readonly id: number;
    readonly error: boolean;
}

export type GameResultMessage = GameErrorMessage | GameSucessMessage;

export interface GameErrorMessage extends GameResultMessageBase {
    readonly error: true;
    readonly game: GameInfo;
}

export interface GameSucessMessage extends GameResultMessageBase {
    readonly error: false;
    readonly winner: number;
}
