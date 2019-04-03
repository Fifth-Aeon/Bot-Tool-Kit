import { SavedDeck } from '../game_model/deckList';
import { GameAction } from '../game_model/events/gameAction';
import { GameSyncEvent } from '../game_model/events/syncEvent';

export enum MessageType {
    Ping = 'Ping',
    StartGame = 'StartGame',
    GameEvent = 'GameEvent',
    GameAction = 'GameAction'
}

export type Message =
    | PingMessage
    | StartGameMessage
    | GameEventMessage
    | GameActionMessage;

interface BaseMessage {
    source: string;
    type: MessageType;
}

export interface PingMessage extends BaseMessage {
    type: MessageType.Ping;
}

export interface StartGameMessage extends BaseMessage {
    type: MessageType.StartGame;
    data: {
        deck: SavedDeck;
        playerNumber: 0 | 1;
    };
}

export interface GameEventMessage extends BaseMessage {
    type: MessageType.GameEvent;
    data: GameSyncEvent;
}

export interface GameActionMessage extends BaseMessage {
    type: MessageType.GameAction;
    data: GameAction;
}
