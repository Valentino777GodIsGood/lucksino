import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") coins: number = 1000;
  @type("boolean") isMoving: boolean = false;
  @type("string") direction: string = "down";
  @type("number") animFrame: number = 0;

  // Avatar customization fields (Sprint 3)
  @type("string") outfitColor: string = "#e74c3c";
  @type("string") hairColor: string = "#4a3728";
  @type("string") skinTone: string = "#ffdbac";
  @type("string") accessory: string = "none";
  @type("string") hat: string = "none";

  // Inventory (JSON-stringified owned item IDs)
  @type("string") inventory: string = "[]";

  // Daily bonus tracking
  @type("string") lastDailyBonus: string = "";
}

export class CrashPlayerSchema extends Schema {
  @type("string") name: string = "";
  @type("number") bet: number = 0;
  @type("boolean") cashedOut: boolean = false;
  @type("number") cashoutMultiplier: number = 0;
}

export class CrashStateSchema extends Schema {
  @type("string") phase: string = "waiting"; // waiting, running, crashed
  @type("number") multiplier: number = 1.0;
  @type("number") crashPoint: number = 0;
  @type([CrashPlayerSchema]) players = new ArraySchema<CrashPlayerSchema>();
  @type(["number"]) history = new ArraySchema<number>();
}

export class CasinoState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type(CrashStateSchema) crash = new CrashStateSchema();
}
