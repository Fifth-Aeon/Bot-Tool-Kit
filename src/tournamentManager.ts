import { AIConstructor, aiList } from "./game_model/ai/aiList";
import { DeckList, SavedDeck } from "./game_model/deckList";
import { GameManager } from "./gameManager";
import * as cluster from "cluster";
import { sample } from "lodash";
import { GameFormat, standardFormat } from "./game_model/gameFormat";
import { cardList, CardData } from "./game_model/cards/cardList";

export class TournamentManager {
    private gameQueue: StartGameMesage[] = [];
    private busyWorkers: boolean[] = [];
    private onTournamentEnd: () => any = () => null;
    private gameCount: number = 0;
    private results = [];

    constructor(private workers: cluster.Worker[] = []) {
        for (let i = 0; i < workers.length; i++) {
            let worker = workers[i];
            worker.on('message', (msg) => {
                if (typeof msg === 'number') {
                    this.writeResult(msg, i);
                }
            });
        }
        this.busyWorkers = Array<boolean>(workers.length).fill(false);
    }

    private reset() {
        this.gameCount = 0;
        this.results = [];
        this.busyWorkers = Array<boolean>(this.workers.length).fill(false);
    }

    private writeResult(result: number, workerId: number) {
        this.gameCount--;
        if (this.gameCount === 0) {
            this.onTournamentEnd();
        } else {
            console.log(`Game completed ${this.gameCount} remain.`, this.busyWorkers);
            this.busyWorkers[workerId] = false;
            this.results.push(result);
            this.startGame();
        }
    }

    private enqueueGame(ai1: AIConstructor, ai2: AIConstructor, deck1: DeckList, deck2: DeckList) {
        this.gameQueue.push({
            type: 'StartGameMesage',
            ai1: ai1.name, ai2: ai2.name, deck1: deck1.getSavable(), deck2: deck2.getSavable()
        });
        this.gameCount++;
    }

    private startGame() {
        if (this.gameQueue.length === 0)
            return;
        for (let i = 0; i < this.busyWorkers.length; i++) {
            if (this.busyWorkers[i] === false) {
                this.busyWorkers[i] = true;
                let msg = this.gameQueue.pop();
                this.workers[i].send(msg);
            }
        }
    }

    public registerCard(card: CardData) {
        for (let worker of this.workers) {
            worker.send({
                type: 'AddCardToPool',
                cardData: card
            } as AddCardMessage);
        }
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
                    this.enqueueGame(ai, ai, decks1[i], decks2[j]);
                }
            }
        }
        for (let i = 0; i < this.workers.length; i++) {
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
        let scores = Array<number>(ais.length).fill(0, 0, ais.length);
        for (let i = 0; i < ais.length; i++) {
            for (let j = 0; j < ais.length; j++) {
                if (i != j) {
                    for (let k = 0; k < numberOfGamesPerMatchup; k++) {
                        let deck1 = sample(decks);
                        let deck2 = mirrorMode ? deck1 : sample(decks);
                        this.enqueueGame(ais[i], ais[j], deck1, deck2);
                    }
                }
            }
        }
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

interface StartGameMesage {
    type: 'StartGameMesage'
    ai1: string,
    ai2: string,
    deck1: SavedDeck,
    deck2: SavedDeck
}

interface AddCardMessage {
    type: 'AddCardToPool',
    cardData: CardData
}

export class TournamentWorker {

    private gameManger: GameManager;

    constructor() {
        this.gameManger = new GameManager();
        this.gameManger.annoucmentsOn = false;
        this.gameManger.exitOnFailure = false;

        process.on('message', (msg) => {
            if (typeof msg === 'object' && msg.type === 'StartGameMesage') {
                this.startGame(msg);
            } else if (typeof msg === 'object' && msg.type === 'AddCardToPool') {
                this.addCardToPool(msg);
            }
            process.send({ msgFromWorker: 'This is from worker ' + process.pid + '.' })
        });

        this.gameManger.onGameEnd = (winner) => {
            console.log(`Worker ${process.pid} finished game ${winner} won`);
            process.send(winner);
            cluster.worker.send('zoop');
        }

        console.log(process.pid, 'ready.')
        process.send('readdy freadys');

    }

    private addCardToPool(params: AddCardMessage) {
        console.log(process.pid, 'add card', params.cardData.name);
        cardList.addFactory(cardList.buildCardFactory(params.cardData));

    }

    private startGame(params: StartGameMesage) {
        console.log(process.pid, 'starting game');
        let ais = aiList.getConstructorsByName([params.ai1, params.ai2]);
        this.gameManger.startAIGame(ais[0], ais[1], new DeckList(standardFormat, params.deck1), new DeckList(standardFormat, params.deck2));
    }

}