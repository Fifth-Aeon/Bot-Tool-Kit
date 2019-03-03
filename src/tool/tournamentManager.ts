import * as cluster from 'cluster';
import { Card } from 'game_model/card-types/card';
import { sample } from 'lodash';
import { AIConstructor } from '../game_model/ai/aiList';
import { CardData, cardList } from '../game_model/cards/cardList';
import { DeckList } from '../game_model/deckList';
import { limitedFormat } from '../game_model/gameFormat';
import { GameInfo } from './gameManager';
import {
    AddCardMessage,
    MasterToWorkerMessage,
    MasterToWorkerMessageType,
    StartGameMesage,
    StartAiMessage
} from './masterToWorkerMessages';
import {
    ConstructedTournament,
    LimitedTournament,
    PreconstructedTournament
} from './tournamentDefinition';
import {
    WorkerToMasterMessage,
    WorkerToMasterMessageType,
    GameResultMessage,
    ReadyMessage,
    GameEventMessage,
    GameActionMessage
} from './workerToMasterMessages';

interface WorkerHandle {
    readonly worker: cluster.Worker;
    isAi: boolean;
    runtime: number;
    busy: boolean;
    game: GameInfo | undefined;
}

export class TournamentManager {
    static instance: TournamentManager;
    private static checkTimeoutInterval = 500;

    private gameQueue: GameInfo[] = [];
    private workers: Map<number, WorkerHandle> = new Map();
    private associatedGameWorker: Map<number, WorkerHandle> = new Map();
    private associatedAiWorkers: Map<
        number,
        [WorkerHandle, WorkerHandle]
    > = new Map();
    private newCards: Array<CardData> = [];
    private gameCount = 0;
    private results: number[] = [];

    public static getInstance(
        timeLimit: number = 30000,
        isolateAi: boolean = true
    ) {
        if (!this.instance) {
            this.instance = new TournamentManager(timeLimit, isolateAi);
        }
        return this.instance;
    }

    private onTournamentEnd: () => any = () => null;

    constructor(private timeLimit: number, private isolateAi: boolean = true) {
        if (TournamentManager.instance !== undefined) {
            throw new Error('May only have one tournament manager singleton');
        }

        setInterval(
            this.checkTimeout.bind(this),
            TournamentManager.checkTimeoutInterval
        );
    }

    private checkTimeout() {
        for (const workerHandle of Array.from(this.workers.values())) {
            if (workerHandle.busy) {
                workerHandle.runtime += TournamentManager.checkTimeoutInterval;
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
                } else {
                    this.gameCount--;
                }
                this.workers.delete(workerHandle.worker.process.pid);
                this.createWorker();
            }
        }
    }

    public async createWorker() {
        const worker = cluster.fork();
        await new Promise(resolve => worker.on('online', () => resolve()));

        for (const card of this.newCards) {
            this.sendCardToWorker(card, worker);
        }
        worker.on('message', (msg: WorkerToMasterMessage) => {
            switch (msg.type) {
                case WorkerToMasterMessageType.GameResult:
                    this.reciveGameResult(msg);
                    break;
                case WorkerToMasterMessageType.Ready:
                    this.reciveReadyMsg(msg, worker);
                    break;
                case WorkerToMasterMessageType.GameAction:
                    this.forwardGameAction(msg, worker.id);
                    break;
                case WorkerToMasterMessageType.GameEvent:
                    this.forwardGameEvent(msg, worker.id);
                    break;
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

    private forwardGameEvent(msg: GameEventMessage, id: number) {
        const aiWorkers = this.associatedAiWorkers.get(id);
        if (!aiWorkers) {
            throw new Error(`No ai workers associated with id ${id}.`);
        }
        for (const workerHandle of aiWorkers) {
            this.sendMessageToWorker(workerHandle.worker, {
                type: MasterToWorkerMessageType.SyncMessage,
                event: msg.event
            });
        }
    }

    private forwardGameAction(msg: GameActionMessage, id: number) {
        const gameWorker = this.associatedGameWorker.get(id);
        if (!gameWorker) {
            throw new Error(`No game worker associated with id ${id}.`);
        }
        this.sendMessageToWorker(gameWorker.worker, {
            type: MasterToWorkerMessageType.ActionMessage,
            action: msg.action
        });
    }

    private reciveGameResult(msg: GameResultMessage) {
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
    }

    private reciveReadyMsg(msg: ReadyMessage, worker: cluster.Worker) {
        console.warn('worker', msg.id, 'is ready');
        this.workers.set(msg.id, {
            isAi: true,
            busy: false,
            runtime: 0,
            worker: worker,
            game: undefined
        });
        if (this.gameCount > 0) {
            this.startGame();
        }
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
            if (this.isolateAi) {
                const ais = this.associatedAiWorkers.get(worker.worker.id);
                if (!ais) {
                    throw new Error('Could not find A.I workers for ending game');
                }
                for (const aiHandle of ais) {
                    aiHandle.busy = false;
                    aiHandle.runtime = 0;
                }
            }
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

    private getFreeWorker() {
        for (const workerHandle of Array.from(this.workers.values())) {
            if (!workerHandle.busy && workerHandle.worker.process.connected) {
                return workerHandle;
            }
        }
    }

    private getFreeWorkerGroup() {
        const workers = [];
        for (const workerHandle of Array.from(this.workers.values())) {
            if (!workerHandle.busy && workerHandle.worker.process.connected) {
                workers.push(workerHandle);
            }
        }
        if (workers.length >= 3) {
            return workers;
        }
    }

    private startGame() {
        if (this.isolateAi) {
            const workers = this.getFreeWorkerGroup();
            if (!workers) {
                return;
            }
            const game = this.gameQueue.pop();
            if (!game) {
                return;
            }
            const gameWorker = workers[0];
            const aiWorker1 = workers[1];
            const aiWorker2 = workers[2];

            gameWorker.busy = true;
            gameWorker.game = game;
            gameWorker.worker.send({
                type: MasterToWorkerMessageType.StartGame,
                game: game,
                seperateAiWorkers: true
            } as StartGameMesage);

            aiWorker1.busy = true;
            aiWorker1.isAi = true;
            aiWorker1.worker.send({
                type: MasterToWorkerMessageType.StartAI,
                aiName: game.ai1,
                deck: game.deck1,
                playerNumber: 0
            } as StartAiMessage);

            aiWorker2.busy = true;
            aiWorker2.isAi = true;
            aiWorker2.worker.send({
                type: MasterToWorkerMessageType.StartAI,
                aiName: game.ai2,
                deck: game.deck2,
                playerNumber: 1
            } as StartAiMessage);

            this.associatedGameWorker.set(
                aiWorker1.worker.id,
                gameWorker            );
            this.associatedGameWorker.set(
                aiWorker2.worker.id,
                gameWorker
            );
            this.associatedAiWorkers.set(gameWorker.worker.id, [
                aiWorker1,
                aiWorker2
            ]);
        } else {
            const worker = this.getFreeWorker();
            if (!worker) {
                return;
            }
            const game = this.gameQueue.pop();
            if (!game) {
                return;
            }
            const msg: StartGameMesage = {
                type: MasterToWorkerMessageType.StartGame,
                game: game,
                seperateAiWorkers: false
            };
            worker.busy = true;
            worker.game = msg.game;
            worker.worker.send(msg);
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
        this.startTournament();
    }

    public async runConstructedTournament(tournament: ConstructedTournament) {
        const entries = Array.from(tournament.aisWithDecks.entries());
        for (let i = 0; i < entries.length; i++) {
            for (let j = 0; j < entries.length; j++) {
                if (i > j) {
                    for (let k = 0; k < tournament.gamesPerMatchup; k++) {
                        for (const deck1 of entries[i][1]) {
                            for (const deck2 of entries[j][1]) {
                                this.enqueueGame(
                                    entries[i][0],
                                    entries[j][0],
                                    deck1,
                                    deck2,
                                    [i, j]
                                );
                                this.enqueueGame(
                                    entries[j][0],
                                    entries[i][0],
                                    deck1,
                                    deck2,
                                    [j, i]
                                );
                            }
                        }
                    }
                }
            }
        }
        return this.startTournament();
    }

    public async runLimitedTournament(tournament: LimitedTournament) {
        const ais = tournament.ais;
        const cardPool = this.formLimitedPool(tournament.cardsInPool);
        const decks = ais.map(ai =>
            ai.getDeckbuilder().formDeckFromPool(cardPool, limitedFormat)
        );
        for (let i = 0; i < ais.length; i++) {
            for (let j = 0; j < ais.length; j++) {
                if (i > j) {
                    for (let k = 0; k < tournament.gamesPerMatchup; k++) {
                        this.enqueueGame(ais[i], ais[j], decks[i], decks[j], [
                            i,
                            j
                        ]);
                        this.enqueueGame(ais[j], ais[i], decks[j], decks[i], [
                            j,
                            i
                        ]);
                    }
                }
            }
        }
        return this.startTournament();
    }

    private formLimitedPool(size: number): DeckList {
        const pool = new DeckList();
        for (let i = 0; i < size; i++) {
            pool.addCard(sample(cardList.getCards()) as Card);
        }
        return pool;
    }

    public async runPreconstructedTournament(
        tournament: PreconstructedTournament
    ) {
        for (let i = 0; i < tournament.ais.length; i++) {
            for (let j = 0; j < tournament.ais.length; j++) {
                if (i > j) {
                    for (let k = 0; k < tournament.gamesPerMatchup; k++) {
                        for (const deck1 of tournament.deckPool) {
                            if (tournament.mirrorMode) {
                                this.enqueueGame(
                                    tournament.ais[i],
                                    tournament.ais[j],
                                    deck1,
                                    deck1,
                                    [i, j]
                                );
                                this.enqueueGame(
                                    tournament.ais[j],
                                    tournament.ais[i],
                                    deck1,
                                    deck1,
                                    [j, i]
                                );
                            } else {
                                for (const deck2 of tournament.deckPool) {
                                    this.enqueueGame(
                                        tournament.ais[i],
                                        tournament.ais[j],
                                        deck1,
                                        deck2,
                                        [i, j]
                                    );
                                    this.enqueueGame(
                                        tournament.ais[j],
                                        tournament.ais[i],
                                        deck1,
                                        deck2,
                                        [j, i]
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
        return this.startTournament();
    }

    private async startTournament() {
        for (let i = 0; i < this.workers.size; i++) {
            this.startGame();
        }
        await new Promise(resolve => {
            this.onTournamentEnd = () => resolve();
        });
        const scores = this.buildScores();
        return scores;
    }

    public announceResults(ais: Array<AIConstructor>, scores: Array<number>) {
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
