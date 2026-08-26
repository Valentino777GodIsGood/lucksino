import { Client, Room } from "colyseus.js";

const WS_URL = import.meta.env.VITE_SERVER_URL || "ws://localhost:2567";

export class NetworkManager {
  private client: Client;
  private room: Room | null = null;

  constructor() {
    this.client = new Client(WS_URL);
  }

  async joinCasino(playerName: string): Promise<Room> {
    try {
      this.room = await this.client.joinOrCreate("casino", { name: playerName });
      console.log(`🎰 Connected to casino! Session: ${this.room.sessionId}`);
      return this.room;
    } catch (error) {
      console.error("Failed to connect to casino server:", error);
      throw error;
    }
  }

  sendMove(x: number, y: number, isMoving: boolean, direction: string, animFrame: number): void {
    if (!this.room) return;
    this.room.send("move", { x, y, isMoving, direction, animFrame });
  }

  sendInteract(machineId: string): void {
    if (!this.room) return;
    this.room.send("interact", { machineId });
  }

  getRoom(): Room | null {
    return this.room;
  }

  getSessionId(): string {
    return this.room?.sessionId || "";
  }

  disconnect(): void {
    this.room?.leave();
    this.room = null;
  }
}

// Singleton instance used throughout the app
export const colyseusClient = new NetworkManager();
