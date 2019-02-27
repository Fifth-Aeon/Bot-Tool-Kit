import { MasterToWorkerMessageType, MasterToWorkerMessage, AddCardMessage, StartGameMesage } from './masterToWorkerMessages';
import { ReadyMessage, WorkerToMasterMessageType, GameResultMessage } from './workerToMasterMessages';
import { GameManager, GameInfo } from './gameManager';
import { cardList } from '../game_model/cards/cardList';
import { aiList } from '../game_model/ai/aiList';
import { standardFormat } from '../game_model/gameFormat';
import { DeckList } from '../game_model/deckList';

export class TournamentWorker {
    private gameManger: GameManager;
    private playerNumbers: number[] = [];
    private gameInfo?: GameInfo;

    constructor() {
        this.gameManger = new GameManager();
        this.gameManger.annoucmentsOn = false;
        this.gameManger.exitOnFailure = false;

        process.on('message', (msg: MasterToWorkerMessage) =>
            this.readMessage(msg)
        );

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
            case MasterToWorkerMessageType.AddCard:
                this.addCardToPool(message);
                break;
            case MasterToWorkerMessageType.Timeout:
                this.timeout();
                break;
        }
    }

    private timeout() {
        this.gameManger.reset();
        console.warn(`Worker ${process.pid} timed out.`);
        if (process.send) {
            process.send(-1);
        }
    }

    private addCardToPool(params: AddCardMessage) {
        cardList.addFactory(cardList.buildCardFactory(params.cardData));
    }

    private startGame(params: StartGameMesage) {
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

