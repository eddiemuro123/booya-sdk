export interface BooyaConfig {
  /** Booya API key (required) */
  apiKey: string;
  /** Base44 app ID (required) */
  appId: string;
  /** Base44 server URL (default: https://base44.app) */
  serverUrl?: string;
  /** CDN base URL for WASM assets (demo.js, demo.wasm, demo.data) */
  cdnBase?: string;
  /** Dashboard ID to scope the session */
  dashboardId?: string;
  /** Overlay skin: 'default' | 'minimal' | 'none' (default: 'default') */
  skin?: 'default' | 'minimal' | 'none';
  /** Custom CSS injected into the container */
  customCss?: string;
  /** Callback for real-time metrics */
  onMetrics?: (metrics: BooyaMetrics) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
  /** Frequency of metrics reads in ms (default: 200) */
  metricsInterval?: number;
  /** Frequency of event logging in ms (default: 2000) */
  eventInterval?: number;
}

export interface BooyaMetrics {
  emotions: {
    happy: number;
    sad: number;
    surprised: number;
    angry: number;
    neutral: number;
    disgust: number;
  };
  viewerCount: number;
  totalPersons: number;
  engagementScore: number;
  dominantEmotion: string;
  [key: string]: unknown;
}

export interface SessionSummary {
  session_id: string;
  duration: number;
  total_events: number;
  [key: string]: unknown;
}

export declare class BooyaSDK {
  constructor(config: BooyaConfig);

  /** Initialize: load WASM engine and attach to a container */
  init(container: string | HTMLElement): Promise<void>;

  /** Register a metrics callback */
  onMetrics(callback: (metrics: BooyaMetrics) => void): void;

  /** Register an error callback */
  onError(callback: (error: Error) => void): void;

  /** Start camera, create a session, begin processing */
  startSession(): Promise<string>;

  /** End the session and return a summary */
  endSession(): Promise<SessionSummary | null>;

  /** Get the latest metrics snapshot */
  getMetrics(): BooyaMetrics | null;

  /** Check if the SDK is initialized */
  isReady(): boolean;

  /** Check if a session is active */
  isRecording(): boolean;

  /** Clean up all resources */
  destroy(): void;

  static api: {
    getSessions(
      apiKey: string,
      appId: string,
      options?: { serverUrl?: string; dashboardId?: string; limit?: number; offset?: number }
    ): Promise<any>;

    getSession(
      apiKey: string,
      appId: string,
      sessionId: string,
      options?: { serverUrl?: string }
    ): Promise<any>;

    getAnalytics(
      apiKey: string,
      appId: string,
      options?: { serverUrl?: string; dashboardId?: string; startDate?: string; endDate?: string }
    ): Promise<any>;
  };
}

export default BooyaSDK;
