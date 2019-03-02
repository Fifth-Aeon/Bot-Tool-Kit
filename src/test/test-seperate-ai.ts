import * as cluster from 'cluster';
import * as bots from '../bots/importBots';
import { TournamentManager } from '../tool/tournamentManager';
import { TournamentWorker } from '../tool/tournamentWorker';

// Unhandled promise rejections should throw exceptions
process.on('unhandledRejection', up => {
    throw up;
});

if (cluster.isMaster) {
    const numWorkers = 3;
    const manager = TournamentManager.getInstance();

    for (let i = 0; i < numWorkers; i++) {
        manager.createWorker();
    }


} else {
    // tslint:disable-next-line:no-unused-expression
    new TournamentWorker();
}

const importBotz = bots;
