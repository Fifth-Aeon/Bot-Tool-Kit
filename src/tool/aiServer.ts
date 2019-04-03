import * as WebSocket from 'ws';
import { DeckList } from '../game_model/deckList';
import { GameSyncEvent } from '../game_model/events/syncEvent';
import { standardFormat } from '../game_model/gameFormat';
import { AiManager } from './aiManager';
import { GameEventMessage, Message, MessageType } from './aiServerMessages';
import { GameManager } from './gameManager';

export class AiServer {
    private socketServer: WebSocket.Server;
    private clientSocket?: WebSocket;
    private gameManger = new GameManager(
        this.sendSyncEvent.bind(this),
        null,
        true
    );
    private aiManger = new AiManager(
        act => this.gameManger.syncAction(act),
        1000,
        1
    );

    constructor(
        private aiName: string,
        private scenarioName: string,
        private deckList: DeckList
    ) {
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
        if (msg.type === MessageType.StartGame) {
            const playerDeck = new DeckList(standardFormat, msg.data.deck);
            const aiPlayerNumber = msg.data.playerNumber;
            this.aiManger.startAi(this.aiName, this.deckList, aiPlayerNumber);
            this.gameManger.startAIGame(
                undefined,
                undefined,
                aiPlayerNumber === 0 ? this.deckList : playerDeck,
                aiPlayerNumber === 1 ? this.deckList : playerDeck
            );
        } else if (msg.type === MessageType.GameAction) {
            this.gameManger.syncAction(msg.data);
        }
    }

    private sendSyncEvent(syncEvent: GameSyncEvent) {
        if (!this.clientSocket) {
            throw new Error('Cannot send to empty socket');
        }
        this.aiManger.reciveSyncronizationEvent(syncEvent);
        if (syncEvent.number === undefined) {
            return;
        }
        this.clientSocket.send(
            JSON.stringify({
                type: MessageType.GameEvent,
                source: 'LocalServer',
                data: syncEvent
            } as GameEventMessage)
        );
    }
}
