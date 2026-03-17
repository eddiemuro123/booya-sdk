import { RefObject } from 'react';
import { BooyaSDK, BooyaMetrics, SessionSummary } from './index';

export interface UseBooyaConfig {
  /** Booya API key (required) */
  apiKey: string;
  /** Base44 app ID (required) */
  appId: string;
  /** CDN base URL for WASM assets */
  cdnBase?: string;
  /** Dashboard ID to scope the session */
  dashboardId?: string;
  /** Overlay skin: 'default' | 'minimal' | 'none' */
  skin?: 'default' | 'minimal' | 'none';
  /** Frequency of metrics reads in ms (default: 200) */
  metricsInterval?: number;
  /** Frequency of event logging in ms (default: 2000) */
  eventInterval?: number;
  /** Automatically initialize on mount (default: true) */
  autoInit?: boolean;
}

export interface UseBooyaResult {
  /** Attach this ref to the container div */
  containerRef: RefObject<HTMLDivElement>;
  /** Latest real-time metrics (null until first frame) */
  metrics: BooyaMetrics | null;
  /** true when WASM engine is loaded and ready */
  isReady: boolean;
  /** true when a session is active */
  isRecording: boolean;
  /** Current session ID, or null */
  sessionId: string | null;
  /** Last error, or null */
  error: Error | null;
  /** Start a new session */
  start(): Promise<string>;
  /** End the current session */
  stop(): Promise<SessionSummary | null>;
  /** Direct access to the underlying SDK instance */
  sdk: BooyaSDK | null;
}

export declare function useBooya(config: UseBooyaConfig): UseBooyaResult;
export default useBooya;
