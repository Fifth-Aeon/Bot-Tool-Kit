import * as cluster from "cluster";
import { sample } from "lodash";
import { AddCardMessage, isAddCardMessage, isStartGameMessage, isTimeoutMessage, MasterToWorkerMessage, MasterToWorkerMessageType, StartGameMesage, TimeoutMessage } from "./masterToWorkerMessages";
import { GameManager } from "./gameManager";
import { AIConstructor, aiList } from "./game_model/ai/aiList";
import { CardData, cardList } from "./game_model/cards/cardList";
import { DeckList } from "./game_model/deckList";
import { standardFormat } from "./game_model/gameFormat";
import { WorkerToMasterMessage, isGameResultMessage, isReadyMessage, GameResultMessage, WorkerToMasterMessageType, ReadyMessage } from "./workerToMasterMessages";

class WorkerHandle {
    worker: cluster.Worker;
    runtime: number;
    busy: boolean;
}

export class TournamentManager {
    private gameQueue: StartGameMesage[] = [];
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
                    workerHandle.worker.destroy();
                    this.gameCount--;
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
            if (isGameResultMessage(msg)) {
                this.writeResult(msg.result, msg.id);
            } else if (isReadyMessage(msg)) {
                console.log('worker', msg.id, 'is ready');
                this.workers.set(msg.id, {
                    busy: false,
                    runtime: 0,
                    worker: worker
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
        if (this.gameCount === 0) {
            this.onTournamentEnd();
        } else {
            let worker = this.workers.get(workerId);
            console.log(`Game completed ${this.gameCount} remain.`);
            worker.busy = false;
            worker.runtime = 0;
            this.results.push(result);
            this.startGame();
        }
    }

    private enqueueGame(ai: AIConstructor, deck1: DeckList, deck2: DeckList, playerNumbers: number[]) {
        this.gameQueue.push({
            type: MasterToWorkerMessageType.StartGame,
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
                workerHandle.busy = true;
                let msg = this.gameQueue.pop();
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

    constructor() {
        this.gameManger = new GameManager();
        this.gameManger.annoucmentsOn = false;
        this.gameManger.exitOnFailure = false;

        process.on('message', (msg: MasterToWorkerMessage) => this.readMessage(msg));

        this.gameManger.onGameEnd = (winner) => {
            process.send({
                type: WorkerToMasterMessageType.GameResult,
                id: process.pid,
                result: this.playerNumbers[winner]
            } as GameResultMessage);
        }

        process.send({
            type: WorkerToMasterMessageType.Ready,
            id: process.pid
        } as ReadyMessage);
    }

    private readMessage(message: MasterToWorkerMessage) {
        if (isStartGameMessage(message)) {
            this.startGame(message);
        } else if (isAddCardMessage(message)) {
            this.addCardToPool(message);
        } else if (isTimeoutMessage(message)) {
            this.timeout();
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
        let ais = aiList.getConstructorsByName([params.ai1, params.ai2]);
        this.gameManger.startAIGame(ais[0], ais[1], new DeckList(standardFormat, params.deck1), new DeckList(standardFormat, params.deck2));
        this.playerNumbers = params.playerNumbers;
    }

}