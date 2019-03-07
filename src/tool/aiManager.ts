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

    constructor(private outputChannel: (act: GameAction) => any) {}

    public startAi(aiName: string, deck: DeckList, playerNumber: number) {
        if (this.ai) {
            this.ai.stopActing();
        }

        const constructor = aiList.getConstructorByName(aiName);
        const animator = new Animator(0.0001);
        const game = new ClientGame(
            'A.I ' + playerNumber,
            (_, action) => this.sendGameAction(action),
            animator
        );
        this.ai = new constructor(playerNumber, game, deck);
    }

    public reciveSyncronizationEvent(event: GameSyncEvent) {
        if (!this.ai) {
            return;
        }



        if (event.type === SyncEventType.PriortyGained) {
            if (
                this.aiActive &&
                event.player === this.ai.getPlayerNumber()
            ) {
                this.ai.onGainPriority();
            }
        } else {
            this.ai.handleGameEvent(event);
        }

        if (!this.aiActive && event.type === SyncEventType.TurnStart) {
            this.aiActive = true;
            this.ai.startActingDelayMode(25, new Animator(0.0001));
            console.log('Activate', this.ai.getPlayerNumber());
        } else if (this.aiActive && event.type === SyncEventType.Ended) {
            this.aiActive = false;
        }
    }

    private sendGameAction(action: GameAction) {
        this.outputChannel(action);
    }
}