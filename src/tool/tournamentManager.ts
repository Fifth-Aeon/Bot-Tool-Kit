import * as cluster from 'cluster';
import { sample } from 'lodash';
import { GameManager, GameInfo } from './gameManager';
import { AIConstructor, aiList } from '../game_model/ai/aiList';
import { CardData, cardList } from '../game_model/cards/cardList';
import { DeckList, SavedDeck } from '../game_model/deckList';
import { standardFormat } from '../game_model/gameFormat';
import {
    AddCardMessage,
    MasterToWorkerMessage,
    MasterToWorkerMessageType,
    StartGameMesage
} from './masterToWorkerMessages';
import {
    GameResultMessage,
    ReadyMessage,
    WorkerToMasterMessage,
    WorkerToMasterMessageType
} from './workerToMasterMessages';

interface WorkerHandle {
    readonly worker: cluster.Worker;
    runtime: number;
    busy: boolean;
    game: GameInfo | undefined;
}

export class TournamentManager {
    constructor(private timeLimit: number) {
        if (TournamentManager.instance !== undefined) {
            throw new Error('May only have one tournament manager singleton');
        }
        const checkTimeoutInterval = 500;
        setInterval(() => {
            for (const workerHandle of Array.from(this.workers.values())) {
                if (workerHandle.busy) {
                    workerHandle.runtime += checkTimeoutInterval;
                }
                if (workerHandle.runtime >= this.timeLimit) {
                    console.warn(
                        `Worker ${workerHandle.worker.id}:${
                            workerHandle.worker.process.pid
                        } timed out. Killing it.`
                    );
                    workerHandle.worker.kill();
                    if (workerHandle.game) {
                        this.gameQueue.push(workerHandle.game);
                        console.warn(
                            `(it was ${workerHandle.game.deck1.name} vs ${
                                workerHandle.game.deck2.name
                            })`
                        );
                    }
                    this.workers.delete(workerHandle.worker.process.pid);
                    this.createWorker();

                }
            }
        }, checkTimeoutInterval);
    }
    static instance: TournamentManager;

    private gameQueue: GameInfo[] = [];
    private workers: Map<number, WorkerHandle> = new Map();
    private newCards: Array<CardData> = [];
    private gameCount = 0;
    private results: number[] = [];

    public static getInstance(timeLimit: number = 30000) {
        if (!this.instance) {
            this.instance = new TournamentManager(timeLimit);
        }
        return this.instance;
    }

    private onTournamentEnd: () => any = () => null;

    public async createWorker() {
        const worker = cluster.fork();
        await new Promise(resolve => worker.on('online', () => resolve()));

        for (const card of this.newCards) {
            this.sendCardToWorker(card, worker);
        }
        worker.on('message', (msg: WorkerToMasterMessage) => {
            if (msg.type === WorkerToMasterMessageType.GameResult) {
                if (msg.error === true) {
                    console.warn(
                        'got error result, requing',
                        msg.game.deck1,
                        'vs',
                        msg.game.deck2
                    );
                    this.gameQueue.push(msg.game);
                } else {
                    this.writeResult(msg.winner, msg.id);
                }
            } else {
                console.warn('worker', msg.id, 'is ready');
                this.workers.set(msg.id, {
                    busy: false,
                    runtime: 0,
                    worker: worker,
                    game: undefined
                });
                if (this.gameCount > 0) {
                    this.startGame();
                }
            }
        });
        worker.on('disconnect', () => {
            if (this.workers.has(worker.process.pid)) {
                this.workers.delete(worker.process.pid);
                console.warn(
                    `Worker ${worker.id}:${
                        worker.process.pid
                    } disconnected. Spawning a new worker.`
                );
                this.createWorker();
            }
            
        });
    }

    private reset() {
        this.gameCount = 0;
        this.results = [];
    }

    private writeResult(result: number, workerId: number) {
        this.gameCount--;
        this.results.push(result);
        console.warn(`Game completed ${this.gameCount} remain.`);
        if (this.gameCount <= 0) {
            this.onTournamentEnd();
        } else {
            const worker = this.workers.get(workerId);
            if (!worker) {
                return;
            }
            worker.busy = false;
            worker.runtime = 0;
            this.startGame();
        }
    }

    private enqueueGame(
        ai1: AIConstructor,
        ai2: AIConstructor,
        deck1: DeckList,
        deck2: DeckList,
        playerNumbers: number[]
    ) {
        this.gameQueue.push({
            ai1: ai1.name,
            ai2: ai2.name,
            deck1: deck1.getSavable(),
            deck2: deck2.getSavable(),
            playerNumbers: playerNumbers
        });
        this.gameCount++;
    }

    private startGame() {
        for (const workerHandle of Array.from(this.workers.values())) {
            if (!workerHandle.busy && workerHandle.worker.process.connected) {
                const game = this.gameQueue.pop();
                if (!game) {
                    return;
                }
                const msg: StartGameMesage = {
                    type: MasterToWorkerMessageType.StartGame,
                    game: game
                };
                workerHandle.busy = true;
                workerHandle.game = msg.game;
                workerHandle.worker.send(msg);
            }
        }
    }

    private sendMessageToWorker(
        worker: cluster.Worker,
        message: MasterToWorkerMessage
    ) {
        if (!worker.process.connected) {
            return;
        }
        worker.send(message);
    }

    public registerCard(card: CardData) {
        this.newCards.push(card);
        for (const workerHandle of Array.from(this.workers.values())) {
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
        const scores = [];
        for (const result of this.results) {
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
                    const deck1 = decks1[i];
                    const deck2 = decks2[i];
                    this.enqueueGame(ai, ai, deck1, deck2, [0, 1]);
                    this.enqueueGame(ai, ai, deck2, deck1, [1, 0]);
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
                if (i > j) {
                    for (let k = 0; k < numberOfGamesPerMatchup; k++) {
                        for (const deck1 of decks) {
                            if (mirrorMode) {
                                this.enqueueGame(ais[i], ais[j], deck1, deck1, [
                                    0,
                                    1
                                ]);
                                this.enqueueGame(ais[j], ais[i], deck1, deck1, [
                                    0,
                                    1
                                ]);
                            } else {
                                for (const deck2 of decks) {
                                    this.enqueueGame(
                                        ais[i],
                                        ais[j],
                                        deck1,
                                        deck2,
                                        [0, 1]
                                    );
                                    this.enqueueGame(
                                        ais[j],
                                        ais[i],
                                        deck1,
                                        deck2,
                                        [0, 1]
                                    );
                                }
                            }
                        }
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
        const scores = this.buildScores();
        this.announceResults(ais, scores);
        return scores;
    }

    private announceResults(ais: Array<AIConstructor>, scores: Array<number>) {
        console.log(
            '\nTournament Results ------------------------------------------'
        );

        const results = ais
            .map((ai, i) => {
                return {
                    name: `${ai.name} (${i + 1})`,
                    score: scores[i]
                };
            })
            .sort((a, b) => b.score - a.score);
        let lastScore = results[0].score;
        let rank = 1;
        for (const result of results) {
            if (result.score < lastScore) {
                lastScore = result.score;
                rank++;
            }
            console.log(
                `${rank}${this.getRankSuffix(rank)} place: ${
                    result.name
                } with a score of ${result.score}.`
            );
        }
    }

    private getRankSuffix(i: number) {
        const j = i % 10,
            k = i % 100;
        if (j === 1 && k !== 11) {
            return 'st';
        }
        if (j === 2 && k !== 12) {
            return 'nd';
        }
        if (j === 3 && k !== 13) {
            return 'rd';
        }
        return 'th';
    }
}

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

        setInterval(() => console.log('I live!', process.pid), 3000);

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
            default:
                return assertNever(message);
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

function assertNever(x: never): never {
    throw new Error('Unexpected object: ' + x);
}
