import * as cluster from 'cluster';
import * as bots from '../bots/importBots';
import { runTournament } from '../tool/commands';
import { tournamentLoader } from '../tool/tournamentLoader';
import { TournamentManager } from '../tool/tournamentManager';
import { TournamentWorker } from '../tool/tournamentWorker';

// Unhandled promise rejections should throw exceptions
process.on('unhandledRejection', up => {
    throw up;
});

if (cluster.isMaster) {
    const numWorkers =  Math.floor(require('os').cpus().length / 3) * 3;
    const manager = TournamentManager.getInstance(10000, true);

    console.warn('create', numWorkers, 'workers');
    for (let i = 0; i < numWorkers; i++) {
        manager.createWorker();
    }

    runTournament(tournamentLoader.getTournamentByName('Standard Limited'));
} else {
    // tslint:disable-next-line:no-unused-expression
    new TournamentWorker();
}

const importBotz = bots;
