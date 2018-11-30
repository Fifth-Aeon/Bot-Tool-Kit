import { AutoBalancer } from "./autoBalancer";
import { CardType } from "./game_model/card";
import { UnitData } from "./game_model/cards/cardList";
import { decapitate } from "./game_model/cards/decayCards";
import { allDecks } from "./game_model/scenarios/decks";
import { UnitType } from "./game_model/unit";
import * as cluster from "cluster";
import { TournamentManager, TournamentWorker } from "./tournamentManager";

// Unhandled promise rejections should throw exceptions
process.on('unhandledRejection', up => { throw up });

let workers = [];
if (cluster.isMaster) {
    // Start workers and listen for messages containing notifyRequest
    const numWorkers = require('os').cpus().length;
    console.log('create', numWorkers, 'workers');
    for (let i = 0; i < numWorkers; i++) {
        workers.push(cluster.fork());
    }

    let workersOnline = 0;
    cluster.on('online', () => {
        workersOnline++;
        if (workersOnline === numWorkers) {
            setTimeout(() => {
                runBalancer();
            }, 3000)

        }
    })

} else {
    new TournamentWorker();
}


function runBalancer() {
    const balancer = new AutoBalancer(new TournamentManager(workers));

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

    console.log('start test balancer');
    balancer.balanceCard(cData, decapitate(), allDecks, 0.05, 5).then(balanced => {
        console.log('res', balanced);
        process.exit(0);
    });
}