import { AutoBalancer, ComprehensiveSearch, BalanceMethods } from "./autoBalancer";
import { CardType } from "./game_model/card";
import { UnitData } from "./game_model/cards/cardList";
import { decapitate } from "./game_model/cards/decayCards";
import { allDecks } from "./game_model/scenarios/decks";
import { UnitType } from "./game_model/unit";
import * as cluster from "cluster";
import { TournamentManager, TournamentWorker } from "./tournamentManager";

// Unhandled promise rejections should throw exceptions
process.on('unhandledRejection', up => { throw up });

if (cluster.isMaster) {



    const numWorkers = require('os').cpus().length;
    const manager = new TournamentManager(8500);
    console.log('create', numWorkers, 'workers');
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

    let tenTenUnit: UnitData = {
        cardType: CardType.Unit,
        type: UnitType.Human,
        cost: { energy: 1 },
        life: 10,
        damage: 10,
        id: 'test-card',
        name: 'Test Card',
        imageUrl: '',
        targeter: { id: 'Untargeted', optional: false },
        mechanics: []
    };

    let growthCostSearch: ComprehensiveSearch = {
        kind: BalanceMethods.ComprehensiveSearch,
        searchParameters: [{ id: 'energy', min: 8, max: 10 }, { id: 'growth', min: 0, max: 6 }],
        trialsPerConfiguraiton: 10
    }

    let energyCostSearch: ComprehensiveSearch = {
        kind: BalanceMethods.ComprehensiveSearch,
        searchParameters: [{ id: 'energy', min: 8, max: 10 }],
        trialsPerConfiguraiton: 10
    }

    let fullSearch: ComprehensiveSearch = {
        kind: BalanceMethods.ComprehensiveSearch,
        searchParameters: [
            { id: 'energy', min: 1, max: 10 }, 
            { id: 'growth', min: 0, max: 6 },
            { id: 'damage', min: 0, max: 10 },
            { id: 'life', min: 0, max: 10 },
        ],
        trialsPerConfiguraiton: 1
    }

    console.log('Balancing card', tenTenUnit);
    balancer.balanceCard(tenTenUnit, decapitate(), allDecks, growthCostSearch).then(balanced => {
        console.log('Result ----------------------');
        console.log(balanced);
        process.exit(0);
    });
}