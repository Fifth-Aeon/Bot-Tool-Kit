import * as cluster from "cluster";
import { sample } from "lodash";
import { GameManager, GameInfo } from "./gameManager";
import { AIConstructor, aiList } from "./game_model/ai/aiList";
import { CardData, cardList } from "./game_model/cards/cardList";
import { DeckList, SavedDeck } from "./game_model/deckList";
import { standardFormat } from "./game_model/gameFormat";
import { AddCardMessage, MasterToWorkerMessage, MasterToWorkerMessageType, StartGameMesage } from "./masterToWorkerMessages";
import { GameResultMessage, ReadyMessage, WorkerToMasterMessage, WorkerToMasterMessageType } from "./workerToMasterMessages";

interface WorkerHandle {
    readonly worker: cluster.Worker;
    runtime: number;
    busy: boolean;
    game: GameInfo;
}


export class TournamentManager {
    private gameQueue: GameInfo[] = [];
    private workers: Map<number, WorkerHandle> = new Map();
    private newCards: Array<CardData> = [];

    private onTournamentEnd: () => any = () => null;
    private gameCount: number = 0;
    private results = [];

    constructor(private timeLimit: number) {
        const checkTimeoutInterval = 500;
        setInterval(() => {
            for (let workerHandle of Array.from(this.workers.values())) {
                if (workerHandle.busy)
                    workerHandle.runtime += checkTimeoutInterval;
                if (workerHandle.runtime >= this.timeLimit) {
                    console.warn(`Worker ${workerHandle.worker.id}:${workerHandle.worker.process.pid} timed out. Killing it.`)
                    workerHandle.worker.kill();
                    this.gameQueue.push(workerHandle.game);
                }
            }
            this.timeLimit
        }, checkTimeoutInterval);
    }

    public async createWorker() {
        let worker = cluster.fork();
        await new Promise(resolve => worker.on('online', () => resolve()));

        for (let card of this.newCards) {
            this.sendCardToWorker(card, worker);
        }
        worker.on('message', (msg: WorkerToMasterMessage) => {
            if (msg.type === WorkerToMasterMessageType.GameResult) {
                if (msg.error) {
                    console.warn('got error esult, requing');
                    this.gameQueue.push(msg.game);
                } else
                    this.writeResult(msg.winner, msg.id);
            } else {
                console.warn('worker', msg.id, 'is ready');
                this.workers.set(msg.id, {
                    busy: false,
                    runtime: 0,
                    worker: worker,
                    game: null
                });
                if (this.gameCount > 0) {
                    this.startGame();
                }
            }
        });
        worker.on('disconnect', () => {
            this.workers.delete(worker.process.pid);
            console.warn(`Worker ${worker.id}:${worker.process.pid} disconnected. Spawning a new worker.`);
            this.createWorker();
        });
    }

    private reset() {
        this.gameCount = 0;
        this.results = [];
    }

    private writeResult(result: number, workerId: number) {
        this.gameCount--;
        this.results.push(result);
        if (this.gameCount <= 0) {
            this.onTournamentEnd();
        } else {
            let worker = this.workers.get(workerId);
            //console.log(`Game completed ${this.gameCount} remain.`);
            worker.busy = false;
            worker.runtime = 0;
            this.startGame();
        }
    }

    private enqueueGame(ai: AIConstructor, deck1: DeckList, deck2: DeckList, playerNumbers: number[]) {
        this.gameQueue.push({
            ai1: ai.name,
            ai2: ai.name,
            deck1: deck1.getSavable(),
            deck2: deck2.getSavable(),
            playerNumbers: playerNumbers
        });
        this.gameCount++;
    }

    private startGame() {
        if (this.gameQueue.length === 0)
            return;

        for (let workerHandle of Array.from(this.workers.values())) {
            if (!workerHandle.busy && workerHandle.worker.process.connected) {
                let msg: StartGameMesage = {
                    type: MasterToWorkerMessageType.StartGame,
                    game: this.gameQueue.pop()
                };
                workerHandle.busy = true;
                workerHandle.game = msg.game;
                workerHandle.worker.send(msg);
            }
        }
    }

    private sendMessageToWorker(worker: cluster.Worker, message: MasterToWorkerMessage) {
        if (!worker.process.connected)
            return;
        worker.send(message);
    }

    public registerCard(card: CardData) {
        this.newCards.push(card);
        for (let workerHandle of Array.from(this.workers.values())) {
            this.sendCardToWorker(card, workerHandle.worker);
        }
    }

    private sendCardToWorker(card: CardData, worker: cluster.Worker) {
        this.sendMessageToWorker(worker, {
            type: MasterToWorkerMessageType.AddCard,
            cardData: card
        } as AddCardMessage);
    }

    private buildScores(): number[] {
        let scores = [];
        for (let result of this.results) {
            if (!scores[result]) {
                scores[result] = 0;
            }
            scores[result]++;
        }
        return scores;
    }

    public async runDeckTournament(
        ai: AIConstructor,
        decks1: DeckList[],
        decks2: DeckList[],
        numberOfGamesPerMatchup: number
    ) {
        this.reset();
        for (let i = 0; i < decks1.length; i++) {
            for (let j = 0; j < decks2.length; j++) {
                for (let k = 0; k < numberOfGamesPerMatchup; k++) {
                    let deck1 = decks1[i];
                    let deck2 = decks2[i];
                    this.enqueueGame(ai, deck1, deck2, [0, 1]);
                    this.enqueueGame(ai, deck2, deck1, [1, 0]);
                }
            }
        }
        for (let i = 0; i < this.workers.size; i++) {
            this.startGame();
        }
        await new Promise(resolve => {
            this.onTournamentEnd = () => resolve();
        });
        return this.buildScores();
    }

    public async runRoundRobinTournament(
        ais: Array<AIConstructor>,
        decks: Array<DeckList>,
        mirrorMode: boolean,
        numberOfGamesPerMatchup: number
    ) {
        for (let i = 0; i < ais.length; i++) {
            for (let j = 0; j < ais.length; j++) {
                if (i != j) {
                    for (let k = 0; k < numberOfGamesPerMatchup; k++) {
                        let deck1 = sample(decks);
                        let deck2 = mirrorMode ? deck1 : sample(decks);
                        this.enqueueGame(ais[i], deck1, deck2, [0, 1]);
                    }
                }
            }
        }
        for (let i = 0; i < this.workers.size; i++) {
            this.startGame();
        }
        await new Promise(resolve => {
            this.onTournamentEnd = () => resolve();
        });
        let scores = this.buildScores();
        this.announceResults(ais, scores);
        return scores;
    }


    private announceResults(ais: Array<AIConstructor>, scores: Array<number>) {
        console.log('\nTournament Results ------------------------------------------')

        let results = ais.map((ai, i) => {
            return {
                name: `${ai.name} (${i + 1})`,
                score: scores[i]
            }
        }).sort((a, b) => b.score - a.score);
        let lastScore = results[0].score;
        let rank = 1;
        for (let result of results) {
            if (result.score < lastScore) {
                lastScore = result.score;
                rank++;
            }
            console.log(`${rank}${this.getRankSuffix(rank)} place: ${result.name} with a score of ${result.score}.`);
        }
    }

    private getRankSuffix(rank: number) {
        if (rank === 1) {
            return 'st';
        } else if (rank === 2) {
            return 'ed';
        } else {
            return 'th';
        }
    }

}

export class TournamentWorker {
    private gameManger: GameManager;
    private playerNumbers: number[];
    private gameInfo: GameInfo;

    constructor() {
        this.gameManger = new GameManager();
        this.gameManger.annoucmentsOn = false;
        this.gameManger.exitOnFailure = false;

        process.on('message', (msg: MasterToWorkerMessage) => this.readMessage(msg));

        this.gameManger.onGameEnd = (winner) => {
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

        }

        process.send({
            type: WorkerToMasterMessageType.Ready,
            id: process.pid
        } as ReadyMessage);
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
            default: return assertNever(message);
        }
    }

    private timeout() {
        this.gameManger.reset();
        console.warn(`Worker ${process.pid} timed out.`);
        process.send(-1);
    }

    private addCardToPool(params: AddCardMessage) {
        cardList.addFactory(cardList.buildCardFactory(params.cardData));
    }

    private startGame(params: StartGameMesage) {
        let ais = aiList.getConstructorsByName([params.game.ai1, params.game.ai2]);
        this.gameInfo = params.game;
        this.gameManger.startAIGame(ais[0], ais[1],
            new DeckList(standardFormat, params.game.deck1),
            new DeckList(standardFormat, params.game.deck2));
        this.playerNumbers = params.game.playerNumbers;
    }

}

function assertNever(x: never): never {
    throw new Error("Unexpected object: " + x);
}