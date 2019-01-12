import { GameInfo } from "./gameManager";

export enum WorkerToMasterMessageType {
    Ready, GameResult
}

export type WorkerToMasterMessage = ReadyMessage | GameResultMessage;

export interface ReadyMessage {
    readonly type: WorkerToMasterMessageType.Ready;
    readonly id: number;
}


export interface GameResultMessage {
    readonly type: WorkerToMasterMessageType.GameResult;
    readonly id: number;

    readonly error: boolean;
    readonly winner?: number;
    readonly game?: GameInfo;
}