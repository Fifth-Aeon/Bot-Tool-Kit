import { GameAction } from '../game_model/events/gameAction';
import { GameSyncEvent } from '../game_model/events/syncEvent';
import { allDecks } from '../game_model/scenarios/decks';
import { AiManager } from '../tool/aiManager';
import { GameManager } from '../tool/gameManager';
import { AiServer } from '../tool/aiServer';

class TestHarness {
    private gameManger = new GameManager(
        this.sendMessageToAis.bind(this),
        3000,
        true
    );
    private aiManager1 = new AiManager(this.sendActionToGame.bind(this));
    private aiManager2 = new AiManager(this.sendActionToGame.bind(this));

    private deck1 = allDecks[0];
    private deck2 = allDecks[0];

    private sendActionToGame(action: GameAction) {
        this.gameManger.syncAction(action);
    }

    private sendMessageToAis(event: GameSyncEvent) {
        this.aiManager1.reciveSyncronizationEvent(event);
        this.aiManager2.reciveSyncronizationEvent(event);
    }

    public start() {
        this.aiManager1.startAi('DefaultAI', this.deck1, 0);
        this.aiManager2.startAi('DefaultAI', this.deck2, 1);
        this.gameManger.startAIGame(
            undefined,
            undefined,
            this.deck1,
            this.deck2
        );
        return this.gameManger.getGameEndPromise();
    }

    public async runNTimes(n: number) {
        for (let i = 0; i < n; i++) {
            await this.start();
        }
    }
}

// new TestHarness().runNTimes(100);
const server = new AiServer('DefaultAI', allDecks[0]);
