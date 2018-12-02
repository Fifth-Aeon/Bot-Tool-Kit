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

    let cData: UnitData = {
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

    let config1: ComprehensiveSearch = {
        kind: BalanceMethods.ComprehensiveSearch,
        searchParameters: [{ id: 'energy', min: 6, max: 9 }, { id: 'growth', min: 0, max: 6 }],
        trialsPerConfiguraiton: 1
    }

    console.log('start test balancer');
    balancer.balanceCard(cData, decapitate(), allDecks, config1).then(balanced => {
        console.log('res', balanced);
        process.exit(0);
    });
}