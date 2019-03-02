import { AI } from '../game_model/ai/ai';
import { Animator } from '../game_model/animator';
import { ClientGame } from '../game_model/clientGame';
import { GameAction } from '../game_model/events/gameAction';
import { aiList } from '../game_model/ai/aiList';
import { cardList } from '../game_model/cards/cardList';
import { DeckList } from '../game_model/deckList';
import { standardFormat } from '../game_model/gameFormat';
import { GameInfo, GameManager } from './gameManager';
import {
    AddCardMessage,
    MasterToWorkerMessage,
    MasterToWorkerMessageType,
    StartAiMessage,
    StartGameMesage,
    SyncMessage,
    ActionMessage
} from './masterToWorkerMessages';
import {
    GameResultMessage,
    ReadyMessage,
    WorkerToMasterMessageType
} from './workerToMasterMessages';
import { GameSyncEvent, SyncEventType } from '../game_model/events/syncEvent';

export class TournamentWorker {
    private gameManger?: GameManager;
    private ai?: AI;
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
                this.syncMessage(message);
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

    private syncMessage(params: SyncMessage) {
        if (!this.ai) {
            throw new Error();
        }
        if (params.event.type === SyncEventType.PriortyGained) {
            this.ai.onGainPriority();
        } else {
            this.ai.handleGameEvent(params.event);
        }
    }

    private startAi(params: StartAiMessage) {
        const constructor = aiList.getConstructorByName(params.aiName);
        const deck = new DeckList(standardFormat, params.deck);
        const animator = new Animator(0.0001);
        const game = new ClientGame(
            'A.I ' + params.playerNumber,
            (_, action) => this.sendGameAction(action),
            animator
        );
        this.ai = new constructor(params.playerNumber, game, deck);
        this.ai.startActingDelayMode(1, animator);
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
