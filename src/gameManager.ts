import { Unit } from "game_model/unit";
import { AI } from "./game_model/ai/ai";
import { DefaultAI } from "./game_model/ai/defaultAi";
import { Animator } from "./game_model/animator";
import { ClientGame } from "./game_model/clientGame";
import { Game, GameActionType, GameSyncEvent, SyncEventType } from "./game_model/game";
import { standardFormat } from "./game_model/gameFormat";
import { ServerGame } from "./game_model/serverGame";
import * as fs from "fs";
import { DeckList } from "game_model/deckList";
import { sample } from "lodash";
import { AIConstructor } from "game_model/ai/aiList";

export class GameManager {
  private game1: ClientGame;
  private game2: ClientGame;
  private gameModel: ServerGame;

  private onGameEnd: (winner: number) => any = () => null;

  private ais: Array<AI> = [];
  private aiTick: any;
  private seed: number;


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

  private printEvents(events: GameSyncEvent[]) {
    for (let event of events) {
      console.log(SyncEventType[event.type], event.params);
    }
  }

  private printGameEvents(game: Game, num: number) {
    let events = this.game1.getPastEvents().slice(this.game1.getPastEvents().length - num);

    console.log();
    console.log(`Last ${num} ${game.getName()} events`);
    for (let event of events) {
      console.log(SyncEventType[event.type], event.params);
    }
    console.log();

  }

  private checkGameSyncronization(game1: Game, game2: Game) {
    for (let i = 0; i < 2; i++) {
      let player1 = game1.getPlayer(i);
      let hand1 = player1.getHand();

      let player2 = game2.getPlayer(i);
      let hand2 = player2.getHand();

      let playerS = this.gameModel.getPlayer(i);
      let handS = playerS.getHand();

      if (hand1.length != hand2.length) {
        throw new Error(`Sync error hands of player ${i} are not equally long ${hand1.length} in game1 vs ${hand2.length} in game2 vs ${handS.length} in serve`);
      }
    }

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
            this.saveSeed(this.seed);

            console.error('Failure while sending events to A.Is');
            console.error(error);
            //console.error('Game 1 Units', this.game1.getBoard().getAllUnits().map(unit => [unit.getName(), unit.getId()]));
            //console.error('Game 2 Units', this.game2.getBoard().getAllUnits().map(unit => [unit.getName(), unit.getId()]));

            console.log(`Game 1 hand`, this.game1.getPlayer(aiNum).getHand().map(card => [card.getName(), card.getId()]));
            console.log(`Game 2 hand`, this.game2.getPlayer(aiNum).getHand().map(card => [card.getName(), card.getId()]));
            console.log(`Game S hand`, this.gameModel.getPlayer(aiNum).getHand().map(card => [card.getName(), card.getId()]));

            this.printGameEvents(this.game1, 4);
            this.printGameEvents(this.game2, 4);
            this.printGameEvents(this.gameModel, 4);

            //console.error('Game 1 cards', this.game1.lastCardsPlayed);
            //console.error('Game 2 cards', this.game2.lastCardsPlayed);
            //console.error('server cards', this.gameModel.lastCardsPlayed);
            throw new Error();
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
    //console.log(playerNumber, 'took', GameActionType[type], 'with', params);
    let res = this.gameModel.handleAction({
      type: type,
      player: playerNumber,
      params: params
    });

    //console.log(`AI ${playerNumber} sent action ${GameActionType[type]} with params`, params);
    if (res === null) {
      this.saveSeed(this.seed);

      console.error(
        "An action sent to game model by",
        playerNumber,
        "failed. It was",
        GameActionType[type],
        "with",
        params
      );

      console.log(this.gameModel.lastCardsPlayed);
      console.log(this.game1.lastCardsPlayed);
      console.log(this.game2.lastCardsPlayed);

      console.error('Game 1 Units', this.game1.getBoard().getAllUnits().map(unit => this.summerizeUnit(unit)));
      console.error('Game 2 Units', this.game2.getBoard().getAllUnits().map(unit => this.summerizeUnit(unit)));
      console.error('S Game Units', this.gameModel.getBoard().getAllUnits().map(unit => this.summerizeUnit(unit)));

      this.printCards(this.game1);
      this.printCards(this.game2);
      this.printCards(this.gameModel);

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
            this.startAIGame(ais[i], ais[j], deck1, deck2);
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
    this.announceResults(ais, scores);
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

  private loadOrGenerateSeed() {
    if (fs.existsSync('seedfile')) {
      return parseInt(fs.readFileSync('seedfile').toString());
    }
    return new Date().getTime();
  }

  private saveSeed(seed: number) {
    fs.writeFileSync('seedfile', seed);
  }

  public startAIGame(ai1: AIConstructor = DefaultAI, ai2: AIConstructor = DefaultAI, deck1: DeckList, deck2: DeckList) {
    this.seed = this.loadOrGenerateSeed();
    ServerGame.setSeed(this.seed);
    console.log('Start game with seed', this.seed);


    // The player always goes first vs the A.I
    //let aiDeck = sample(allDecks);
    let animator = new Animator(0.0001);
    console.log(`${ai1.name} with deck ${deck1.name} vs ${ai2.name} with deck ${deck2.name}`);

    // Initialize games
    this.gameModel = new ServerGame("server", standardFormat, [deck1, deck2]);
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

    this.ais.push(new ai1(0, this.game1, deck1));
    this.ais.push(new ai2(1, this.game2, deck2));
    this.sendEventsToLocalPlayers(this.gameModel.startGame());
    this.startAiInDelayMode(1, animator);
  }
}
