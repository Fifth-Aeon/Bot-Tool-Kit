import { DefaultAI } from '../game_model/ai/defaultAi';

/**
 * Berserker is a version of the default A.I that always makes every available attack and never blocks.
 * 
 * As a consequence this A.I is unlikely to be very competent.
 * 
 * Otherwise its identical to DefaultAI
 */
export class BerserkerAI extends DefaultAI {

    /** Attack with all legal units */
    protected attack() {
        let potentialAttackers = this.game.getBoard()
            .getPlayerUnits(this.playerNumber)
            .filter(unit => unit.canAttack());

        for (let attacker of potentialAttackers) {    
            this.game.declareAttacker(attacker);
        }

        return true;
    }

    /** Never block anything */
    protected block() {}
}

