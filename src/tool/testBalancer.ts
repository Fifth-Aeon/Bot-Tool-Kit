import * as cluster from 'cluster';
import { CardType } from '../game_model/card-types/card';
import { UnitType } from '../game_model/card-types/unit';
import { SpellData, UnitData } from '../game_model/cards/cardList';
import { decapitate } from '../game_model/cards/decayCards';
import { DrawCard } from '../game_model/cards/mechanics/draw';
import { Flying, Relentless } from '../game_model/cards/mechanics/skills';
import { allDecks } from '../game_model/scenarios/decks';
import { AutoBalancer, BalanceMethods, ComprehensiveSearchConfig } from './autoBalancer';
import { TournamentManager } from './tournamentManager';
import { TournamentWorker } from './tournamentWorker';

// Unhandled promise rejections should throw exceptions
process.on('unhandledRejection', up => {
    throw up;
});

if (cluster.isMaster) {
    const numWorkers = require('os').cpus().length;
    const manager = TournamentManager.getInstance();

    console.warn('create', numWorkers, 'workers');
    for (let i = 0; i < numWorkers; i++) {
        manager.createWorker();
    }

    runBalancer(manager);
} else {
    const worker = new TournamentWorker();
}

async function runBalancer(manager: TournamentManager) {
    const balancer = new AutoBalancer(manager);

    const plainUnit: UnitData = {
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

    const damageSpell: SpellData = {
        name: 'test',
        id: '3417ee80-e091-4464-b6e7-ea9685dd3017',
        imageUrl: 'person.png',
        cost: { energy: 0, synthesis: 0, growth: 0, decay: 0, renewal: 0 },
        mechanics: [
            {
                id: 'DealDamage',
                parameters: ['3'],
                trigger: { id: 'Play' },
                targeter: { id: 'Host', optional: false }
            }
        ],
        targeter: { id: 'SingleUnit', optional: false },
        cardType: 0
    };

    const drawSpell: SpellData = {
        name: 'test',
        id: '3417ee80-e091-4464-b6e7-ea9685dd3017',
        imageUrl: 'person.png',
        cost: { energy: 0, synthesis: 0, growth: 0, decay: 0, renewal: 0 },
        mechanics: [
            {
                id: DrawCard.getId(),
                parameters: ['3'],
                trigger: { id: 'Play' }
            }
        ],
        targeter: { id: 'SingleUnit', optional: false },
        cardType: 0
    };

    const uncostedDecapitate: SpellData = {
        name: 'test',
        id: '3417ee80-e091-4464-b6e7-ea9685dd3017',
        imageUrl: 'person.png',
        cost: { energy: 0, synthesis: 0, growth: 0, decay: 3, renewal: 0 },
        mechanics: [
            {
                id: 'KillTarget',
                parameters: [],
                trigger: { id: 'Play' },
                targeter: { id: 'Host', optional: false }
            }
        ],
        targeter: { id: 'SingleUnit', optional: false },
        cardType: 0
    };

    const tenTenUnit: UnitData = {
        cardType: CardType.Unit,
        type: UnitType.Human,
        cost: { energy: 7 },
        life: 10,
        damage: 10,
        id: 'test-card',
        name: 'Test Card',
        imageUrl: '',
        targeter: { id: 'Untargeted', optional: false },
        mechanics: []
    };

    const fiveFiveFlyer: UnitData = {
        cardType: CardType.Unit,
        type: UnitType.Human,
        cost: { energy: 7 },
        life: 5,
        damage: 5,
        id: 'test-card',
        name: 'Test Card',
        imageUrl: '',
        targeter: { id: 'Untargeted', optional: false },
        mechanics: [{ id: Flying.getId(), parameters: [] }]
    };

    const threeThreeUnit: UnitData = {
        cardType: CardType.Unit,
        type: UnitType.Human,
        cost: { energy: 7 },
        life: 3,
        damage: 3,
        id: 'test-card',
        name: 'Test Card',
        imageUrl: '',
        targeter: { id: 'Untargeted', optional: false },
        mechanics: []
    };

    const relentlessUnitAttack: UnitData = {
        cardType: CardType.Unit,
        type: UnitType.Human,
        cost: { energy: 7 },
        life: 5,
        damage: 5,
        id: 'test-card',
        name: 'Test Card',
        imageUrl: '',
        targeter: { id: 'Untargeted', optional: false },
        mechanics: [{ id: Relentless.getId(), parameters: [] }]
    };

    const growthCostSearch: ComprehensiveSearchConfig = {
        kind: BalanceMethods.ComprehensiveSearch,
        searchParameters: [
            { id: 'energy', min: 8, max: 10 },
            { id: 'growth', min: 0, max: 6 }
        ],
        trialsPerConfiguraiton: 1
    };

    const energyCostSearch: ComprehensiveSearchConfig = {
        kind: BalanceMethods.ComprehensiveSearch,
        searchParameters: [{ id: 'energy', min: 0, max: 10 }],
        trialsPerConfiguraiton: 30
    };

    const attackPowerSearch: ComprehensiveSearchConfig = {
        kind: BalanceMethods.ComprehensiveSearch,
        searchParameters: [{ id: 'damage', min: 0, max: 10 }],
        trialsPerConfiguraiton: 30
    };

    const fullSearch: ComprehensiveSearchConfig = {
        kind: BalanceMethods.ComprehensiveSearch,
        searchParameters: [
            { id: 'energy', min: 1, max: 10 },
            { id: 'growth', min: 0, max: 6 },
            { id: 'damage', min: 0, max: 10 },
            { id: 'life', min: 0, max: 10 }
        ],
        trialsPerConfiguraiton: 1
    };

    const tests = [
        { out: 'flyerAttack', card: fiveFiveFlyer, algo: attackPowerSearch },
        { out: 'bigUnitAttack', card: tenTenUnit, algo: attackPowerSearch },
        {
            out: 'smallUnitAttack',
            card: threeThreeUnit,
            algo: attackPowerSearch
        },
        {
            out: 'relentlessUnitAttack',
            card: relentlessUnitAttack,
            algo: attackPowerSearch
        },
        { out: 'drawSpell', card: drawSpell, algo: energyCostSearch },
        { out: 'bigUnit', card: tenTenUnit, algo: energyCostSearch },
        { out: 'damageSpell', card: damageSpell, algo: energyCostSearch },
        { out: 'drawSpell', card: drawSpell, algo: energyCostSearch },
        { out: 'flyer', card: fiveFiveFlyer, algo: energyCostSearch },
        { out: 'mirror', card: uncostedDecapitate, algo: energyCostSearch },
        { out: 'smallUnit', card: threeThreeUnit, algo: energyCostSearch }
    ];

    for (const test of tests) {
        const cardToBalance = test.card;
        await balancer.balanceCard(
            `results/${test.out}.dat`,
            cardToBalance,
            decapitate(),
            allDecks,
            test.algo
        );
    }
    process.exit(0);
}
