import { sample } from 'lodash';
import { AI } from './game_model/ai/ai';
import { DefaultAI } from './game_model/ai/defaultAi';
import { Animator } from './game_model/animator';
import { ClientGame } from './game_model/clientGame';
import { GameActionType, GameSyncEvent } from './game_model/game';
import { standardFormat } from './game_model/gameFormat';
import { Log } from './game_model/log';
import { allDecks } from './game_model/scenarios/decks';
import { ServerGame } from './game_model/serverGame';


export class GameManager {
    private game1: ClientGame;
    private game2: ClientGame;
    private gameModel: ServerGame;

    private ais: Array<AI> = [];
    private aiTick: any;

    private log: Log;
    private onGameEnd: (won: boolean, quit: boolean) => any;

    constructor() {
        this.setAISpeed(1000);

        this.reset();
    }

    public reset() {
        this.game1 = null;
        this.game2 = null;
        this.gameModel = null;
        this.ais = [];
        this.stopAI();
    }

    private stopAI() {
        clearInterval(this.aiTick);
    }

    public setAISpeed(ms: number) {
        if (this.aiTick !== undefined)
            clearInterval(this.aiTick);
        this.aiTick = setInterval(() => {
            for (let ai of this.ais) {
                ai.pulse();
            }
        }, ms);
    }


    // Action communication -------------------------------------
    private sendEventsToLocalPlayers(events: GameSyncEvent[]) {
        setTimeout(() => {
            for (let event of events) {
                for (let ai of this.ais) {
                    ai.handleGameEvent(event);
                }
            }
        }, 50);
    }

    private sendGameAction(type: GameActionType, params: any, isAi: boolean = false) {
        let res = this.gameModel.handleAction({
            type: type,
            player: isAi ? 1 : 0,
            params: params
        });
        if (res === null) {
            console.error('An action sent to game model by', isAi ?
                'the A.I' : 'the player', 'failed.', 'It was', GameActionType[type], 'with', params);
            return;
        }
        this.sendEventsToLocalPlayers(res);

    }


    public getGame() {
        return this.game1;
    }

    public setGameEndCallback(newCallback: (won: boolean, quit: boolean) => any) {
        this.onGameEnd = newCallback;
    }

    public getLog() {
        return this.log;
    }

    public isInputEnabled() {
        return this.ais.length < 2;
    }

    // Game Life cycle ------------------------------------------------

    /** Invoked when the game ends (because a player won) */
    private endGame(winner: number, quit: boolean) {
        this.stopAI();
    }

    /** Invoked when we quit the game (before its over) */
    public exitGame() {
        this.sendGameAction(GameActionType.Quit, {});
    }


    public startAIGame(aiCount = 1) {
        // The player always goes first vs the A.I
        let aiDeck = sample(allDecks);
        let anim = new Animator(0.01);
        

        // Initialize games
        this.gameModel = new ServerGame('server', standardFormat, [aiDeck, aiDeck]);
        this.game1 = new ClientGame('A.I - 1',
            (type, params) => this.sendGameAction(type, params, false),
            anim,
            this.log);
        this.game2 = new ClientGame('A.I - 2',
            (type, params) => this.sendGameAction(type, params, true),
            anim);

        const aiGames = [this.game2, this.game1];
        for (let i = 0; i < aiCount; i++) {
            let playerNumber = this.game1.getOtherPlayerNumber(i);
            this.ais.push(new DefaultAI(playerNumber, aiGames[i], aiDeck, anim));
        }
        this.setAISpeed(500);

        this.sendEventsToLocalPlayers(this.gameModel.startGame());
    }
}
