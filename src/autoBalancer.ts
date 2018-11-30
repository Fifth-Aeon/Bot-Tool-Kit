import { CardData, CardList, cardList } from "./game_model/cards/cardList";
import { Card } from "./game_model/card";
import { DeckList } from "./game_model/deckList";
import { GameManager } from "./gameManager";
import { DefaultAI } from "./game_model/ai/defaultAi";


export class AutoBalancer {
    private manger: GameManager = new GameManager();

    private insertIntoDecklists(suffix: string, card: Card, decks: DeckList[]) {
        let clones = decks.map(deck => deck.clone());
        for (let clone of clones) {
            clone.addCard(card);
            clone.addCard(card);
            clone.addCard(card);
            clone.addCard(card);
            clone.name = clone.name + ' - ' + suffix;
        }
        return clones;
    }

    public balanceCard(card: CardData, goal: Card, decks: DeckList[], threshold: number, games: number) {
        // Register the card with the card list so we can construct instances of it
        cardList.addFactory(cardList.buildCardFactory(card));
        
        // Construct the deck lists with the target card and the goal card
        let decksWithTargetCard = this.insertIntoDecklists('target', cardList.getCard(card.id), decks);
        let decksWithGoalCard = this.insertIntoDecklists('goal', goal, decks);

        // Play them against eachother and check winrate
        let outcomes = this.manger.runDeckTournament(DefaultAI, decksWithTargetCard, decksWithGoalCard, games);
        let winRate = outcomes[0] / (outcomes[0] + outcomes[1]);

        // If winrate of target card too high, nerf it, if too low buff it, if ok then return
        if (winRate > 0.5 + threshold) {
            // The cards win rate is too high, nerf it.
            this.nerfCard(card);
        } else if (winRate < 0.5 - threshold) {
            // The cards win rate is too low buff it.
            this.buffCard(card);
        } else {
            // The card's win rate is within acceptable parameters
            return card;
        }
    }

    private buffCard(card: CardData) : CardData {
        card.cost.energy--;
        return card;
    }

    private nerfCard(card: CardData) : CardData {
        card.cost.energy++;
        return card;
    }

}