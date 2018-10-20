import { sample } from "lodash";
import { AI, AIConstructor } from "./game_model/ai/ai";
import { DefaultAI } from "./game_model/ai/defaultAi";
import { Animator } from "./game_model/animator";
import { ClientGame } from "./game_model/clientGame";
import {
  GameActionType,
  GameSyncEvent,
  SyncEventType
} from "./game_model/game";
import { standardFormat } from "./game_model/gameFormat";
import { allDecks } from "./game_model/scenarios/decks";
import { ServerGame } from "./game_model/serverGame";

export class GameManager {
  private game1: ClientGame;
  private game2: ClientGame;
  private gameModel: ServerGame;

  private onGameEnd: (winner: number) => void;

  private ais: Array<AI> = [];
  private aiTick: any;

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
    if (this.aiTick !== undefined) clearInterval(this.aiTick);
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
        this.watchGame(event);
      }
    }, 50);
  }

  private watchGame(event: GameSyncEvent) {
    if (event.type == SyncEventType.Ended) {
      this.endGame(event.params.winner, event.params.quit);
    } else if (event.type == SyncEventType.TurnStart) {
      console.log(
        `Turn ${event.params.turnNum} Life Totals ${this.gameModel
          .getPlayer(0)
          .getLife()} to ${this.gameModel.getPlayer(1).getLife()}.`
      );
    }
  }

  private sendGameAction(
    type: GameActionType,
    params: any,
    playerNumber: number
  ) {
    let res = this.gameModel.handleAction({
      type: type,
      player: playerNumber,
      params: params
    });
    console.log(
      "AI",
      playerNumber,
      "sent action",
      GameActionType[type],
      params
    );
    if (res === null) {
      console.error(
        "An action sent to game model by",
        playerNumber,
        "failed.",
        "It was",
        GameActionType[type],
        "with",
        params
      );
      return;
    }
    this.sendEventsToLocalPlayers(res);
  }

  public isInputEnabled() {
    return this.ais.length < 2;
  }

  // Game Life cycle ------------------------------------------------

  /** Invoked when the game ends (because a player won) */
  private endGame(winner: number, quit: boolean) {
    this.stopAI();
    console.log(`A.I ${winner} won the game`);
    this.onGameEnd(winner);
  }

  public async runRoundRobinTournament(
    ais: Array<AIConstructor> = [DefaultAI, DefaultAI],
    numberOfGames = 3
  ) {

    let scores = Array<number>(ais.length).fill(0, 0, ais.length);
    for (let i = 0; i < ais.length; i++) {
      for (let j = 0; j < ais.length; j++) {
        if (i != j) {
          for (let k = 0; k < numberOfGames; k++) {
            this.startAIGame(ais[i], ais[j]);
            await new Promise(resolve => {
              this.endGame = winner => {
                if (winner === 0) {
                  scores[i]++;
                } else {
                  scores[j]++;
                }
                resolve();
              };
            });
          }
        }
      }
    }

    let max = Math.max(...scores);
    for (let i = 0; i < ais.length; i++) {
      if (scores[i] === max)
        console.log('A.I', i, 'Won the tournament (or tied)');
    }
  }

  public startAIGame(ai1: AIConstructor = DefaultAI, ai2: AIConstructor = DefaultAI) {
    // The player always goes first vs the A.I
    let aiDeck = sample(allDecks);
    let anim = new Animator(0.01);
    console.log("Using deck", aiDeck.name, "(mirror match)");

    // Initialize games
    this.gameModel = new ServerGame("server", standardFormat, [aiDeck, aiDeck]);
    this.game1 = new ClientGame(
      "A.I - 1",
      (type, params) => this.sendGameAction(type, params, 0),
      anim
    );
    this.game2 = new ClientGame(
      "A.I - 2",
      (type, params) => this.sendGameAction(type, params, 1),
      anim
    );

    this.ais.push(new ai1(0, this.game1, aiDeck, anim));
    this.ais.push(new ai2(1, this.game2, aiDeck, anim));
    this.setAISpeed(50);

    this.sendEventsToLocalPlayers(this.gameModel.startGame());
  }
}
