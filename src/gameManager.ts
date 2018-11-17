import { Unit } from "game_model/unit";
import { AI, AIConstructor } from "./game_model/ai/ai";
import { DefaultAI } from "./game_model/ai/defaultAi";
import { Animator } from "./game_model/animator";
import { ClientGame } from "./game_model/clientGame";
import { Game, GameActionType, GameSyncEvent, SyncEventType } from "./game_model/game";
import { standardFormat } from "./game_model/gameFormat";
import { ServerGame } from "./game_model/serverGame";
import { sample } from 'lodash';
import { allDecks, deckMap } from "./game_model/scenarios/decks";


export class GameManager {
  private game1: ClientGame;
  private game2: ClientGame;
  private gameModel: ServerGame;

  private onGameEnd: (winner: number) => any = () => null;

  private ais: Array<AI> = [];
  private aiTick: any;

  constructor() {
    this.reset();
  }

  public reset() {
    console.log('reset');
    this.stopAI();
    this.game1 = null;
    this.game2 = null;
    this.gameModel = null;
    this.ais = [];
  }

  private stopAI() {
    for (let ai of this.ais) {
      ai.stopActing();
    }
  }

  public setAISpeed(ms: number, animator: Animator) {
    for (let ai of this.ais) {
      ai.startActingDelayMode(ms, animator);
    }
  }

  // Action communication -------------------------------------
  private sendEventsToLocalPlayers(events: GameSyncEvent[]) {
    setTimeout(() => {
      for (let event of events) {
        for (let ai of this.ais) {
          try {
            ai.handleGameEvent(event);
          } catch (error) {
            console.error('Failure while sending events to A.Is');
            console.error(error);
            console.error('Game 1 Units', this.game1.getBoard().getAllUnits().map(unit => [unit.getName(), unit.getId()]));
            console.error('Game 2 Units', this.game2.getBoard().getAllUnits().map(unit => [unit.getName(), unit.getId()]));
            throw new Error();
          }
        }
        this.watchGame(event);
      }
    }, 50);
  }

  private checkPriorityChange(event: GameSyncEvent) {
    if (!this.gameModel.canTakeAction())
      return;
    if (event.type === SyncEventType.TurnStart || event.type === SyncEventType.PhaseChange || event.type === SyncEventType.ChoiceMade)
      this.ais[this.gameModel.getActivePlayer()].onGainPriority();
  }

  private watchGame(event: GameSyncEvent) {
    if (event.type == SyncEventType.Ended) {
      this.endGame(event.params.winner, event.params.quit);
    } else if (event.type == SyncEventType.TurnStart && this.gameModel) {
      console.log(
        `Turn ${event.params.turnNum} Life Totals ${this.gameModel
          .getPlayer(0)
          .getLife()} to ${this.gameModel.getPlayer(1).getLife()}.`
      );
    }

    if (this.gameModel) {
      this.checkPriorityChange(event);
    }
  }

  private summerizeUnit(unit: Unit): String {
    return `${unit.getId()}: ${unit.getName()} E:${unit.isExhausted()} A: ${unit.canAttack()}`
  }

  private printCards(game: Game) {
    console.error(game.getName(), 'Hand 1', this.game1.getPlayer(0).getHand().map(card =>
      [card.getId(), card.getName(), card.isPlayable(game)]));
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

    //console.log(`AI ${playerNumber} sent action ${GameActionType[type]} with params`, params);
    if (res === null) {
      console.error(
        "An action sent to game model by",
        playerNumber,
        "failed. It was",
        GameActionType[type],
        "with",
        params
      );
      if (type != GameActionType.PlayResource) {
        console.error('Game 1 Units', this.game1.getBoard().getAllUnits().map(unit => this.summerizeUnit(unit)));
        console.error('Game 2 Units', this.game2.getBoard().getAllUnits().map(unit => this.summerizeUnit(unit)));
        console.error('S Game Units', this.gameModel.getBoard().getAllUnits().map(unit => this.summerizeUnit(unit)));

        this.printCards(this.game1);
        this.printCards(this.game2);
        this.printCards(this.gameModel);
      }
      process.exit(1);

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
    console.log(`A.I ${winner} won the game`);
    this.reset();
    this.onGameEnd(winner);
  }

  public async runRoundRobinTournament(
    ais: Array<AIConstructor> = [DefaultAI, DefaultAI],
    numberOfGames = 1000
  ) {

    let scores = Array<number>(ais.length).fill(0, 0, ais.length);
    for (let i = 0; i < ais.length; i++) {
      for (let j = 0; j < ais.length; j++) {
        if (i != j) {
          for (let k = 0; k < numberOfGames; k++) {
            this.startAIGame(ais[i], ais[j]);
            await new Promise(resolve => {
              this.onGameEnd = winner => {
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
    // let aiDeck = deckMap.get('clericalOrder');
    let animator = new Animator(0.0001);
    console.log("Using deck", aiDeck.name, "(mirror match)");

    // Initialize games
    this.gameModel = new ServerGame("server", standardFormat, [aiDeck, aiDeck]);
    this.game1 = new ClientGame(
      "A.I - 1",
      (type, params) => this.sendGameAction(type, params, 0),
      animator
    );
    this.game2 = new ClientGame(
      "A.I - 2",
      (type, params) => this.sendGameAction(type, params, 1),
      animator
    );

    this.ais.push(new ai1(0, this.game1, aiDeck));
    this.ais.push(new ai2(1, this.game2, aiDeck));
    this.setAISpeed(50, animator);
    this.sendEventsToLocalPlayers(this.gameModel.startGame());
  }
}
