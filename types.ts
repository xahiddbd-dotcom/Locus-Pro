
export interface Coords {
  lat: number;
  lng: number;
}

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export enum LocationStatus {
  IDLE = 'idle',
  TRACKING = 'tracking',
  ERROR = 'error',
  DENIED = 'denied'
}
