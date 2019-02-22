import { openInteractivePrompt } from './tool/interactivePrompt';
import * as bots from './bots/importBots';
import { readArgs } from './tool/commandMode';
import * as cluster from 'cluster';
import { TournamentManager, TournamentWorker } from './tool/tournamentManager';
import { runTournament } from './tool/commands';
import { tournamentLoader } from './tool/tournamentLoader';

// Unhandled promise rejections should throw exceptions
process.on('unhandledRejection', up => {
    throw up;
});

if (cluster.isMaster) {
    const numWorkers = require('os').cpus().length - 1;
    const manager = TournamentManager.getInstance();

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
