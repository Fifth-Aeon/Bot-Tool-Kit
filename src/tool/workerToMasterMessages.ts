import { GameInfo } from './gameManager';
import { GameAction } from '../game_model/events/gameAction';
import { GameSyncEvent } from '../game_model/events/syncEvent';

export enum WorkerToMasterMessageType {
    Ready,
    GameResult,
    GameAction,
    GameEvent
}

export type WorkerToMasterMessage = ReadyMessage | GameResultMessage | GameEventMessage | GameActionMessage;

export interface GameEventMessage {
    readonly type: WorkerToMasterMessageType.GameEvent;
    readonly id: number;
    readonly event: GameSyncEvent;
}

export interface ReadyMessage {
    readonly type: WorkerToMasterMessageType.Ready;
    readonly id: number;
}

export interface GameActionMessage {
    readonly type: WorkerToMasterMessageType.GameAction;
    readonly id: number;
    readonly action: GameAction;
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
