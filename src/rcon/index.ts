export type Player = {
    steamId: string;
    name: string;
    connectedSeconds: number;
    ping: number;
  };
  
  export type ServerSnapshot = {
    hostname: string;
    map: string | null;
    playersOnline: number | null;
    maxPlayers: number | null;
    queued: number | null;
    joining: number | null;
    entityCount: number | null;
    uptimeSeconds: number | null;
    rawStatus: string;
    players: Player[];
  };
  