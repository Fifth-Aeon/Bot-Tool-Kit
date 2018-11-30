import { CardData, CardList, cardList } from "./game_model/cards/cardList";
import { Card } from "./game_model/card";
import { DeckList } from "./game_model/deckList";
import { GameManager } from "./gameManager";
import { DefaultAI } from "./game_model/ai/defaultAi";
import { TournamentManager } from "tournamentManager";


export class AutoBalancer {

    constructor(private manager: TournamentManager) {
       
    }

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

    public async balanceCard(cardData: CardData, goal: Card, decks: DeckList[], threshold: number, games: number): Promise<CardData> {
        // Register the card with the card list so we can construct instances of it
        cardList.addFactory(cardList.buildCardFactory(cardData));
        this.manager.registerCard(cardData);

        // Construct the deck lists with the target card and the goal card
        let decksWithTargetCard = this.insertIntoDecklists('target', cardList.getCard(cardData.id), decks);
        let decksWithGoalCard = this.insertIntoDecklists('goal', goal, decks);

        // Play them against eachother and check winrate
        let outcomes = await this.manager.runDeckTournament(DefaultAI, decksWithTargetCard, decksWithGoalCard, games);
        let winRate = outcomes[0] / (outcomes[0] + outcomes[1]);
        console.log(`Tournament round complete. Target card won ${outcomes[0]} out of ${outcomes[0] + outcomes[1]} games (${winRate * 100}%).`);

        // If winrate of target card too high, nerf it, if too low buff it, if ok then return
        if (winRate > 0.5 + threshold) {
            // The cards win rate is too high, nerf it.
            console.log(`Win rate of ${winRate * 100}% is above maximum threshold of ${(0.5 + threshold) * 100}% so nerfing`);
            this.nerfCard(cardData);
            return this.balanceCard(cardData, goal, decks, threshold, games);
        } else if (winRate < 0.5 - threshold) {
            // The cards win rate is too low buff it.
            console.log(`Win rate of ${winRate * 100}% is above maximum threshold of ${(0.5 + threshold) * 100}% so buffing`);
            this.buffCard(cardData);
            return this.balanceCard(cardData, goal, decks, threshold, games);
        } else {
            // The card's win rate is within acceptable parameters
            return cardData;
        }
    }

    private buffCard(card: CardData): CardData {
        console.log(`Buff: decreasing energy cost from ${card.cost.energy} to ${card.cost.energy - 1}.`);
        card.cost.energy--;
        return card;
    }

    private nerfCard(card: CardData): CardData {
        console.log(`Nerf: increasing energy cost from ${card.cost.energy} to ${card.cost.energy + 1}.`);
        card.cost.energy++;
        return card;
    }

}