export enum WorkerToMasterMessageType {
    Ready, GameResult
}

export type WorkerToMasterMessage = ReadyMessage | GameResultMessage;

export interface ReadyMessage {
    type: WorkerToMasterMessageType.Ready;
    id: number;
}

export function isReadyMessage(message: WorkerToMasterMessage): message is ReadyMessage {
    return message.type === WorkerToMasterMessageType.Ready;
}

export interface GameResultMessage {
    type: WorkerToMasterMessageType.GameResult;
    id: number;
    result: number;
}

export function isGameResultMessage(message: WorkerToMasterMessage): message is GameResultMessage {
    return message.type === WorkerToMasterMessageType.GameResult;
}
