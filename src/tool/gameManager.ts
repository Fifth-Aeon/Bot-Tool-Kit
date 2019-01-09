import * as fs from "fs";
import { AIConstructor } from "../game_model/ai/aiList";
import { DeckList, SavedDeck } from "../game_model/deckList";
import { Unit } from "../game_model/card-types/unit";
import { AI } from "../game_model/ai/ai";
import { DefaultAI } from "../game_model/ai/defaultAi";
import { Animator } from "../game_model/animator";
import { ClientGame } from "../game_model/clientGame";
import { Game } from "../game_model/game";
import { standardFormat } from "../game_model/gameFormat";
import { ServerGame } from "../game_model/serverGame";
import { GameSyncEvent, SyncEventType } from "../game_model/events/syncEvent";
import { GameActionType, GameAction } from "../game_model/events/gameAction";


export interface GameInfo {
    readonly ai1: string;
    readonly ai2: string;
    readonly deck1: SavedDeck;
    readonly deck2: SavedDeck;
    readonly playerNumbers: number[];
}

export class GameManager {
  private game1: ClientGame;
  private game2: ClientGame;
  private gameModel: ServerGame;


  private ais: Array<AI> = [];
  private aiTick: any;
  private seed: number;

  public onGameEnd: (winner: number) => any = () => null;
  public annoucmentsOn = true;
  public exitOnFailure = true;

  constructor() {
    this.reset();
  }

  public reset() {
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

  public startAiInDelayMode(ms: number, animator: Animator) {
    for (let ai of this.ais) {
      ai.startActingDelayMode(ms, animator);
    }
  }

  public startAiInImmediateMode() {
    for (let ai of this.ais) {
      ai.startActingImmediateMode();
    }
  }

  private printGameEvents(game: Game, num: number) {
    let events = this.game1.getPastEvents().slice(this.game1.getPastEvents().length - num);

    console.error();
    console.error(`Last ${num} ${game.getName()} events`);
    for (let event of events) {
      console.error(SyncEventType[event.type], event);
    }
    console.error();

  }


  // Action communication -------------------------------------
  private sendEventsToLocalPlayers(events: GameSyncEvent[]) {
    setTimeout(() => {
      for (let event of events) {
        let aiNum = 0;
        for (let ai of this.ais) {
          try {
            ai.handleGameEvent(event);
          } catch (error) {

            console.error('Failure while sending events to A.Is');
            console.error(error);
            //console.error('Game 1 Units', this.game1.getBoard().getAllUnits().map(unit => [unit.getName(), unit.getId()]));
            //console.error('Game 2 Units', this.game2.getBoard().getAllUnits().map(unit => [unit.getName(), unit.getId()]));

            console.error(`Game 1 hand`, this.game1.getPlayer(aiNum).getHand().map(card => [card.getName(), card.getId()]));
            console.error(`Game 2 hand`, this.game2.getPlayer(aiNum).getHand().map(card => [card.getName(), card.getId()]));
            console.error(`Game S hand`, this.gameModel.getPlayer(aiNum).getHand().map(card => [card.getName(), card.getId()]));

            this.printGameEvents(this.game1, 4);
            this.printGameEvents(this.game2, 4);
            this.printGameEvents(this.gameModel, 4);

            //console.error('Game 1 cards', this.game1.lastCardsPlayed);
            //console.error('Game 2 cards', this.game2.lastCardsPlayed);
            //console.error('server cards', this.gameModel.lastCardsPlayed);
            this.onFailure();

          }
          aiNum++;
        }
        this.watchGame(event);
      }


    }, 1);
  }

  private checkPriorityChange(event: GameSyncEvent) {
    if (!this.gameModel.canTakeAction())
      return;
    if (event.type === SyncEventType.TurnStart || event.type === SyncEventType.PhaseChange || event.type === SyncEventType.ChoiceMade)
      this.ais[this.gameModel.getActivePlayer()].onGainPriority();
  }

  private watchGame(event: GameSyncEvent) {
    if (event.type === SyncEventType.Ended) {
      this.endGame(event.winner);
    } else if (this.annoucmentsOn && event.type == SyncEventType.TurnStart && this.gameModel) {
      console.log(
        `Turn ${event.turnNum} Life Totals ${this.gameModel
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

  private sendGameAction(action: GameAction) {
    //console.log(playerNumber, 'took', GameActionType[type], 'with', params);
    let res = this.gameModel.handleAction(action);

    //console.log(`AI ${playerNumber} sent action ${GameActionType[type]} with params`, params);
    if (res === null) {

      console.error(
        "An action sent to game model by",
        action.player,
        "failed. It was",
        GameActionType[action.type],
        "with",
        action
      );

      console.error(this.gameModel.lastCardsPlayed);
      console.error(this.game1.lastCardsPlayed);
      console.error(this.game2.lastCardsPlayed);

      console.error('Game 1 Units', this.game1.getBoard().getAllUnits().map(unit => this.summerizeUnit(unit)));
      console.error('Game 2 Units', this.game2.getBoard().getAllUnits().map(unit => this.summerizeUnit(unit)));
      console.error('S Game Units', this.gameModel.getBoard().getAllUnits().map(unit => this.summerizeUnit(unit)));

      this.printCards(this.game1);
      this.printCards(this.game2);
      this.printCards(this.gameModel);

      this.onFailure();


      return;
    }
    this.sendEventsToLocalPlayers(res);
  }

  public isInputEnabled() {
    return this.ais.length < 2;
  }

  // Game Life cycle ------------------------------------------------

  /** Invoked when the game ends (because a player won) */
  private endGame(winner: number) {
    if (this.annoucmentsOn) {
      console.log(`A.I ${winner} won the game`);
    }
    this.reset();
    this.onGameEnd(winner);
  }

  /** Executed when a game raises an error. Must execute some kind of policy to recover or exit. */
  public onFailure() {
    if (this.exitOnFailure) {
      this.saveSeed(this.seed);
      process.exit(1);
    } else {
      this.endGame(NaN);
    }
  }

 
  private loadOrGenerateSeed(): number {
    if (this.exitOnFailure && fs.existsSync('seedfile')) {
      let savedSeed = parseInt(fs.readFileSync('seedfile').toString());
      console.warn('Using saved seed', savedSeed);
      return savedSeed;
    }
    return new Date().getTime();
  }

  private saveSeed(seed: number) {
    fs.writeFileSync('seedfile', seed);
  }

  public startAIGame(ai1: AIConstructor = DefaultAI, ai2: AIConstructor = DefaultAI, deck1: DeckList, deck2: DeckList) {
    this.seed = this.loadOrGenerateSeed();
    ServerGame.setSeed(this.seed);


    // The player always goes first vs the A.I
    //let aiDeck = sample(allDecks);
    let animator = new Animator(0.0001);

    if (this.annoucmentsOn) {
      console.log('Start game with seed', this.seed);
      console.log(`${ai1.name} with deck ${deck1.name} vs ${ai2.name} with deck ${deck2.name}`);
    }

    // Initialize games
    this.gameModel = new ServerGame("server", standardFormat, [deck1, deck2]);
    this.game1 = new ClientGame(
      "A.I - 1",
      (_, action) => this.sendGameAction(action),
      animator
    );
    this.game2 = new ClientGame(
      "A.I - 2",
      (_, action) => this.sendGameAction(action),
      animator
    );

    this.ais.push(new ai1(0, this.game1, deck1));
    this.ais.push(new ai2(1, this.game2, deck2));
    this.sendEventsToLocalPlayers(this.gameModel.startGame());
    this.startAiInDelayMode(1, animator);
  }
}
