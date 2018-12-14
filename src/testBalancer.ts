import { AutoBalancer, ComprehensiveSearchConfig, BalanceMethods } from "./autoBalancer";
import { CardType } from "./game_model/card";
import { UnitData, SpellData } from "./game_model/cards/cardList";
import { decapitate } from "./game_model/cards/decayCards";
import { allDecks } from "./game_model/scenarios/decks";
import { UnitType } from "./game_model/unit";
import * as cluster from "cluster";
import { TournamentManager, TournamentWorker } from "./tournamentManager";
import { DealDamage } from "./game_model/cards/mechanics/dealDamage";
import { SingleUnit } from "./game_model/cards/targeters/basicTargeter";
import { Flying } from "./game_model/cards/mechanics/skills";
import { DrawCard } from "./game_model/cards/mechanics/draw";

// Unhandled promise rejections should throw exceptions
process.on('unhandledRejection', up => { throw up });

if (cluster.isMaster) {
    const numWorkers = require('os').cpus().length;
    const manager = new TournamentManager(8500);

    console.warn('create', numWorkers, 'workers');
    for (let i = 0; i < numWorkers; i++) {
        manager.createWorker();
    }

    runBalancer(manager);
} else {
    new TournamentWorker();
}


function runBalancer(manager: TournamentManager) {
    const balancer = new AutoBalancer(manager);

    let plainUnit: UnitData = {
        cardType: CardType.Unit,
        type: UnitType.Human,
        cost: { energy: 1 },
        life: 0,
        damage: 0,
        id: 'test-card',
        name: 'Test Card',
        imageUrl: '',
        targeter: { id: 'Untargeted', optional: false },
        mechanics: []
    };

    let damageSpell: SpellData = {
        "name": "test", "id": "3417ee80-e091-4464-b6e7-ea9685dd3017",
        "imageUrl": "person.png",
        "cost": { "energy": 0, "synthesis": 0, "growth": 0, "decay": 0, "renewal": 0 },
        "mechanics": [{
            "id": "DealDamage", "parameters": ["3"],
            "trigger": { "id": "Play" },
            "targeter": { "id": "Host", "optional": false }
        }],
        "targeter": { "id": "SingleUnit", "optional": false },
        "cardType": 0
    }

    let drawSpell: SpellData = {
        "name": "test", "id": "3417ee80-e091-4464-b6e7-ea9685dd3017",
        "imageUrl": "person.png",
        "cost": { "energy": 0, "synthesis": 0, "growth": 0, "decay": 0, "renewal": 0 },
        "mechanics": [{
            "id": DrawCard.getId(), 
            "parameters": ["3"],
            "trigger": { "id": "Play" }
        }],
        "targeter": { "id": "SingleUnit", "optional": false },
        "cardType": 0
    }

    let uncostedDecapitate: SpellData = {
        "name": "test", "id": "3417ee80-e091-4464-b6e7-ea9685dd3017",
        "imageUrl": "person.png",
        "cost": { "energy": 0, "synthesis": 0, "growth": 0, "decay": 3, "renewal": 0 },
        "mechanics": [
            {
                "id": "KillTarget", "parameters": [], "trigger": { "id": "Play" },
                "targeter": { "id": "Host", "optional": false }
            }],
        "targeter": { "id": "SingleUnit", "optional": false },
        "cardType": 0,
    }


    let tenTenUnit: UnitData = {
        cardType: CardType.Unit,
        type: UnitType.Human,
        cost: { energy: 1 , growth: 6},
        life: 10,
        damage: 10,
        id: 'test-card',
        name: 'Test Card',
        imageUrl: '',
        targeter: { id: 'Untargeted', optional: false },
        mechanics: []
    };

    let fiveFiveFlyer: UnitData = {
        cardType: CardType.Unit,
        type: UnitType.Human,
        cost: { energy: 1},
        life: 5,
        damage: 5,
        id: 'test-card',
        name: 'Test Card',
        imageUrl: '',
        targeter: { id: 'Untargeted', optional: false },
        mechanics: [{id: Flying.getId(), parameters: []}]
    };

    let threeThreeUnit: UnitData = {
        cardType: CardType.Unit,
        type: UnitType.Human,
        cost: { energy: 1},
        life: 3,
        damage: 3,
        id: 'test-card',
        name: 'Test Card',
        imageUrl: '',
        targeter: { id: 'Untargeted', optional: false },
        mechanics: []
    };

    let growthCostSearch: ComprehensiveSearchConfig = {
        kind: BalanceMethods.ComprehensiveSearch,
        searchParameters: [{ id: 'energy', min: 8, max: 10 }, { id: 'growth', min: 0, max: 6 }],
        trialsPerConfiguraiton: 2
    }

    let energyCostSearch: ComprehensiveSearchConfig = {
        kind: BalanceMethods.ComprehensiveSearch,
        searchParameters: [{ id: 'energy', min: 0, max: 10 }],
        trialsPerConfiguraiton: 10
    }

    let fullSearch: ComprehensiveSearchConfig = {
        kind: BalanceMethods.ComprehensiveSearch,
        searchParameters: [
            { id: 'energy', min: 1, max: 10 },
            { id: 'growth', min: 0, max: 6 },
            { id: 'damage', min: 0, max: 10 },
            { id: 'life', min: 0, max: 10 },
        ],
        trialsPerConfiguraiton: 1
    }

    const cardToBalance = drawSpell;
    console.log('Balancing card', cardToBalance);
    balancer.balanceCard('results/drawSpell.dat', cardToBalance, decapitate(), allDecks, energyCostSearch).then(balanced => {
        console.log('Result ----------------------');
        console.log(balanced);
        console.log("\007");
        process.exit(0);
    });
}