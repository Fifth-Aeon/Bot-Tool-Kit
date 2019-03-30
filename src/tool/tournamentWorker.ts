import { aiList } from '../game_model/ai/aiList';
import { cardList } from '../game_model/cards/cardList';
import { DeckList } from '../game_model/deckList';
import { GameAction } from '../game_model/events/gameAction';
import { GameSyncEvent } from '../game_model/events/syncEvent';
import { standardFormat } from '../game_model/gameFormat';
import { AiManager } from './aiManager';
import { GameInfo, GameManager } from './gameManager';
import {
    ActionMessage,
    AddCardMessage,
    MasterToWorkerMessage,
    MasterToWorkerMessageType,
    StartAiMessage,
    StartGameMesage
} from './masterToWorkerMessages';
import {
    GameResultMessage,
    ReadyMessage,
    WorkerToMasterMessageType
} from './workerToMasterMessages';
import * as fs from 'fs';

export class TournamentWorker {
    private gameManger?: GameManager;
    private aiManager?: AiManager;

    private useSeprateAi = false;
    private playerNumbers: number[] = [];
    private gameInfo?: GameInfo;

    constructor() {
        process.on('message', (msg: MasterToWorkerMessage) =>
            this.readMessage(msg)
        );

        if (process.send) {
            process.send({
                type: WorkerToMasterMessageType.Ready,
                id: process.pid
            } as ReadyMessage);
        }
    }

    private readMessage(message: MasterToWorkerMessage) {
        switch (message.type) {
            case MasterToWorkerMessageType.StartGame:
                this.startGame(message);
                break;
            case MasterToWorkerMessageType.StartAI:
                this.startAi(message);
                break;
            case MasterToWorkerMessageType.AddCard:
                this.addCardToPool(message);
                break;
            case MasterToWorkerMessageType.SyncMessage:
                this.syncMessage(message.event);
                break;
            case MasterToWorkerMessageType.ActionMessage:
                this.syncAction(message);
                break;
        }
    }

    private syncAction(message: ActionMessage) {
        if (!this.gameManger) {
            throw new Error(
                'Cannot sync action when not configured as game worker'
            );
        }
        this.gameManger.syncAction(message.action);
    }

    private startGameWorker() {
        const sender = this.useSeprateAi
            ? this.sendGameMessage
            : GameManager.noop;
        this.gameManger = new GameManager(sender);

        this.gameManger.onGameEnd = winner => {
            if (!process.send) {
                throw new Error('No process.send avalible');
            }
            if (isNaN(winner)) {
                process.send({
                    type: WorkerToMasterMessageType.GameResult,
                    id: process.pid,
                    error: true,
                    game: this.gameInfo
                } as GameResultMessage);
            } else {
                process.send({
                    type: WorkerToMasterMessageType.GameResult,
                    id: process.pid,
                    error: false,
                    winner: this.playerNumbers[winner]
                } as GameResultMessage);
            }
        };

        return this.gameManger;
    }

    private sendGameMessage(event: GameSyncEvent) {
        if (!process.send) {
            throw new Error('Cannot send game sync message');
        }
        process.send({
            type: WorkerToMasterMessageType.GameEvent,
            id: process.pid,
            event: event
        });
    }

    private addCardToPool(params: AddCardMessage) {
        cardList.addFactory(cardList.buildCardFactory(params.cardData));
    }

    private syncMessage(event: GameSyncEvent) {
        if (!this.aiManager) {
            return;
        }
        this.aiManager.reciveSyncronizationEvent(event);
    }

    private startAi(params: StartAiMessage) {
        if (!this.aiManager) {
            this.aiManager = new AiManager(this.sendGameAction.bind(this));
        }
        this.gameManger = undefined;

        const deck = new DeckList(standardFormat, params.deck);
        this.aiManager.startAi(params.aiName, deck, params.playerNumber);
    }

    private sendGameAction(action: GameAction) {
        if (!process.send) {
            throw new Error('Cannot send message');
        }
        process.send({
            type: WorkerToMasterMessageType.GameAction,
            id: process.pid,
            action: action
        });
    }

    private startGame(params: StartGameMesage) {
        this.useSeprateAi = params.seperateAiWorkers;
        if (!this.gameManger) {
            this.gameManger = this.startGameWorker();
        }
        const ais = aiList.getConstructorsByName([
            params.game.ai1,
            params.game.ai2
        ]);
        this.gameInfo = params.game;
        this.gameManger.startAIGame(
            ais[0],
            ais[1],
            new DeckList(standardFormat, params.game.deck1),
            new DeckList(standardFormat, params.game.deck2)
        );
        this.playerNumbers = params.game.playerNumbers;
    }
}
