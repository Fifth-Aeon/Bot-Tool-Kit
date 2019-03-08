import * as WebSocket from 'ws';
import { GameAction } from '../game_model/events/gameAction';
import { GameSyncEvent } from '../game_model/events/syncEvent';
import { AiManager } from './aiManager';
import { SavedDeck, DeckList } from '../game_model/deckList';
import { standardFormat } from '../game_model/gameFormat';
import { GameManager } from './gameManager';


export enum MessageType {
    Ping = 3,
    StartGame = 10,
    GameEvent = 15,
    GameAction = 16
}

export interface Message {
    source: string;
    type: string;
    data: any;
}

export class AiServer {
    private socketServer: WebSocket.Server;
    private clientSocket?: WebSocket;
    private gameManger = new GameManager(this.sendSyncEvent.bind(this), null, true);
    private aiManger = new AiManager(
        act => this.gameManger.syncAction(act),
        1000,
        1
    );

    constructor(private aiName: string, private deckList: DeckList) {
        this.socketServer = new WebSocket.Server({ port: 4236 });
        console.log('A.I Server open on port', 4236);

        this.socketServer.on('error', err => {
            console.error('Server Websocket Error:\n', err);
        });

        this.socketServer.on('connection', socket => {
            if (this.clientSocket) {
                this.clientSocket.close();
                console.warn('Found new socket, closing existing one');
            }
            this.clientSocket = socket;
            socket.on('message', this.reciveMessage.bind(this));
        });
    }

    private reciveMessage(message: WebSocket.Data) {
        const msg = JSON.parse(message.toString()) as Message;

        if (msg.type !== 'Ping') {
            console.log('recive', msg);
        }
        if (msg.type === 'StartGame') {
            const playerDeck = new DeckList(standardFormat, msg.data.deck);
            const aiPlayerNumber = msg.data.playerNumber;
            this.aiManger.startAi(this.aiName, this.deckList, aiPlayerNumber);
            this.gameManger.startAIGame(
                undefined,
                undefined,
                aiPlayerNumber === 0 ? this.deckList : playerDeck,
                aiPlayerNumber === 1 ? this.deckList : playerDeck
            );
        } else if (msg.type === 'GameAction') {
            this.gameManger.syncAction(msg.data);
        }
    }

    private sendSyncEvent(syncEvent: GameSyncEvent) {
        if (!this.clientSocket) {
            throw new Error('Cannot send to empty socket');
        }
        console.log('Send', syncEvent);
        this.aiManger.reciveSyncronizationEvent(syncEvent);
        if (syncEvent.number === undefined) {
            return;
        }
        this.clientSocket.send(
            JSON.stringify({
                type: MessageType[MessageType.GameEvent],
                source: 'LocalServer',
                data: syncEvent
            } as Message)
        );
    }
}
