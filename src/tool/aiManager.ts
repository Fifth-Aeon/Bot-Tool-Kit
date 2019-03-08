import { AI } from '../game_model/ai/ai';
import { aiList } from '../game_model/ai/aiList';
import { Animator } from '../game_model/animator';
import { ClientGame } from '../game_model/clientGame';
import { DeckList } from '../game_model/deckList';
import { GameAction } from '../game_model/events/gameAction';
import { GameSyncEvent, SyncEventType } from '../game_model/events/syncEvent';

export class AiManager {
    private ai?: AI;
    private aiActive = false;
    private animator: Animator;

    constructor(private outputChannel: (act: GameAction) => any, private speed = 25, private animationSpeed = 0.00001) {
        this.animator = new Animator(animationSpeed);
    }

    public startAi(aiName: string, deck: DeckList, playerNumber: number) {
        if (this.ai) {
            this.ai.stopActing();
        }

        const constructor = aiList.getConstructorByName(aiName);
        const game = new ClientGame(
            'A.I ' + playerNumber,
            (_, action) => this.sendGameAction(action),
            this.animator
        );
        this.ai = new constructor(playerNumber, game, deck);
    }

    public reciveSyncronizationEvent(event: GameSyncEvent) {
        if (!this.ai) {
            return;
        }

        if (event.type === SyncEventType.PriortyGained) {
            if (this.aiActive && event.player === this.ai.getPlayerNumber()) {
                this.ai.onGainPriority();
            }
        } else {
            this.ai.handleGameEvent(event);
        }

        if (!this.aiActive && event.type === SyncEventType.TurnStart) {
            this.aiActive = true;
            this.ai.startActingDelayMode(this.speed, this.animator);
        } else if (this.aiActive && event.type === SyncEventType.Ended) {
            this.aiActive = false;
        }
    }

    private sendGameAction(action: GameAction) {
        this.outputChannel(action);
    }
}
