import { TournamentManager } from "tournamentManager";
import { DefaultAI } from "./game_model/ai/defaultAi";
import { Card, CardType } from "./game_model/card";
import { CardData, cardList } from "./game_model/cards/cardList";
import { DeckList } from "./game_model/deckList";
import { property, set, reduce, flatten, map } from 'lodash';
import * as fs from "fs";



interface ModifiableElement {
    id: string;
    prior: number;
    min: number;
    max: number;
}

export enum BalanceMethods {
    ComprehensiveSearch, HillDescent
}

export type BalanceMethodConfiguration = ComprehensiveSearchConfig | HillDescentConfig

export interface Modifiable {
    id: string,
    min?: number,
    max?: number
}

export interface ComprehensiveSearchConfig {
    readonly kind: BalanceMethods.ComprehensiveSearch;
    readonly trialsPerConfiguraiton: number;
    readonly searchParameters: Modifiable[];
}

export interface HillDescentConfig {
    readonly kind: BalanceMethods.HillDescent;
    readonly trialsPerConfiguraiton: number;
    readonly threshold: number;
    readonly maxTrials: number;
}

export class AutoBalancer {

    private modifiableElemnts: ModifiableElement[];
    private cardData: CardData;
    private goal: Card;
    private decks: DeckList[];
    private outputFile: string;

    constructor(private manager: TournamentManager) { }

    private insertIntoDecklists(suffix: string, card: Card, decks: DeckList[]) {
        let clones = decks.map(deck => deck.clone());
        for (let clone of clones) {
            for (let i = 0; i < 4; i++) {
                clone.addCard(card);
            }
            clone.name = clone.name + ' - ' + suffix;
        }
        return clones;
    }

    public async balanceCard(outputFile: string, cardData: CardData, goal: Card, decks: DeckList[], parameters: BalanceMethodConfiguration): Promise<CardData> {
        this.outputFile = outputFile;
        this.modifiableElemnts = this.getModifiableElements(cardData);
        this.cardData = cardData;
        this.goal = goal;
        this.decks = decks;

        if (parameters.kind === BalanceMethods.ComprehensiveSearch) {
            return this.comprehensiveSearch(parameters);
        } else if (parameters.kind === BalanceMethods.HillDescent) {
            return this.hillDescentMethod(parameters.threshold, parameters.trialsPerConfiguraiton);
        }
    }

    private async comprehensiveSearch(parameters: ComprehensiveSearchConfig): Promise<CardData> {
        let toSearch = this.modifiableElemnts.filter(el => {
            for (let param of parameters.searchParameters) {
                if (el.id.includes(param.id)) {
                    if (param.max)
                        el.max = param.max;
                    if (param.min)
                        el.min = param.min;
                    return true;
                }
            }
            return false;
        });
        let combinations = this.cartesianProductOf(...toSearch.map(this.makeOptionsList)) as number[][];

        let best = combinations[0];
        let bestScore = Infinity;
        let outputData = ['Energy Winrate Score'];

        for (let combination of combinations) {
            this.applyConfigurationToCard(toSearch, combination);
            let results = await this.runTournament(parameters.trialsPerConfiguraiton);

            let score = await this.fullInjectionScore(results);

            if (score < bestScore) {
                bestScore = score;
                best = combination;
            }

            outputData.push(`${combination} ${results.rate} ${score}`);

            console.log(`${combination} -> Won: (${results.wins} / ${results.games}) WR: ${results.rate * 100}% Score: ${score}`);
        }

        fs.writeFileSync(this.outputFile, outputData.join('\n'));

        this.applyConfigurationToCard(toSearch, best);
        return this.cardData;
    }

    private async fullInjectionScore(results: any) {
        return Math.abs(results.rate - 0.5);
    }

    private applyConfigurationToCard(elements: ModifiableElement[], values: number[]) {
        elements.forEach((element, i) => {
            set(this.cardData, element.id, values[i]);
        });
    }

    private makeOptionsList(element: ModifiableElement) {
        let vals = []
        for (let i = element.min; i <= element.max; i++) {
            vals.push(i);
        }
        return vals;
    }

    private cartesianProductOf(...args: any[]) {
        return reduce(args, function (a, b) {
            return flatten(map(a, function (x) {
                return map(b, function (y) {
                    return x.concat([y]);
                });
            }));
        }, [[]]);
    };

    private async hillDescentMethod(threshold: number, games: number): Promise<CardData> {
        let goalWinRate = 0.5;
        let runs = 0;

        while (true) {
            let result = await this.runTournament(games);
            let delta = goalWinRate - result.rate;

            if (this.shouldTerminate(runs, delta, threshold)) {
                return this.cardData;
            } else {
                runs++;
                this.cardData = this.modifyCard(this.cardData, delta);
            }
        }
    }

    private getModifiableElements(cardData: CardData) {
        let items: ModifiableElement[] = [
            { id: 'cost.energy', prior: -0.1, min: 0, max: 10 },
            { id: 'cost.renwal', prior: -0.05, min: 0, max: 6 },
            { id: 'cost.growth', prior: -0.05, min: 0, max: 6 },
            { id: 'cost.decay', prior: -0.05, min: 0, max: 6 },
            { id: 'cost.synthesis', prior: -0.05, min: 0, max: 6 }
        ];
        if (cardData.cardType === CardType.Unit) {
            items.push({ id: 'life', prior: 0.05, min: 0, max: 15 });
            items.push({ id: 'damage', prior: 0.05, min: 0, max: 15 });
        } else if (cardData.cardType === CardType.Enchantment) {
            items.push({ id: 'power', prior: 0.05, min: 0, max: 10 });
            items.push({ id: 'empowerCost', prior: 0.025, min: 0, max: 10 });
        }
        return items;
    }

    private modifyCard(cardData: CardData, delta: number): CardData {
        if (delta < 0) {
            this.buffCard(cardData);
        } else {
            this.nerfCard(cardData);
        }
        return cardData;
    }

    private shouldTerminate(runs: number, delta: number, threshold: number): boolean {
        return Math.abs(delta) <= threshold;
    }

    private async runTournament(games: number) {
        // Register the card with the card list so we can construct instances of it
        cardList.addFactory(cardList.buildCardFactory(this.cardData));
        this.manager.registerCard(this.cardData);

        // Construct the deck lists with the target card and the goal card
        let decksWithTargetCard = this.insertIntoDecklists('target', cardList.getCard(this.cardData.id), this.decks);
        let decksWithGoalCard = this.insertIntoDecklists('goal', this.goal, this.decks);

        // Play them against eachother and check winrate
        let outcomes = await this.manager.runDeckTournament(DefaultAI, decksWithTargetCard, decksWithGoalCard, games);
        let winRate = outcomes[0] / (outcomes[0] + outcomes[1]);
        console.log(`Tournament round complete. Target card won ${outcomes[0]} out of ${outcomes[0] + outcomes[1]} games (${winRate * 100}%).`);

        return {
            wins: outcomes[0],
            games: outcomes[0] + outcomes[1],
            rate: winRate
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