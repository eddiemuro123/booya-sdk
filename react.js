/**
 * Booya SDK React Hook
 *
 * @example
 * import { useBooya } from 'booya-sdk/react';
 *
 * function MeasurementView() {
 *   const { containerRef, metrics, isRecording, start, stop, error } = useBooya({
 *     apiKey: 'bya_...',
 *     appId: 'your-app-id'
 *   });
 *
 *   return (
 *     <div>
 *       <div ref={containerRef} style={{ width: 640, height: 480 }} />
 *       {metrics && <p>Dominant: {metrics.dominantEmotion}</p>}
 *       <button onClick={isRecording ? stop : start}>
 *         {isRecording ? 'Stop' : 'Start'}
 *       </button>
 *       {error && <p>Error: {error.message}</p>}
 *     </div>
 *   );
 * }
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { BooyaSDK } from './index.js';

/**
 * @param {Object} config
 * @param {string} config.apiKey - Booya API key
 * @param {string} config.appId - Base44 app ID
 * @param {string} [config.cdnBase] - CDN URL for WASM assets
 * @param {string} [config.dashboardId] - Scope to a dashboard
 * @param {string} [config.skin='default'] - 'default' | 'minimal' | 'none'
 * @param {number} [config.metricsInterval=200] - How often to read metrics (ms)
 * @param {number} [config.eventInterval=2000] - How often to log events (ms)
 * @param {boolean} [config.autoInit=true] - Initialize on mount
 */
export function useBooya(config) {
  const {
    apiKey,
    appId,
    cdnBase,
    dashboardId,
    skin,
    metricsInterval,
    eventInterval,
    autoInit = true,
  } = config;

  const containerRef = useRef(null);
  const sdkRef = useRef(null);
  const mountedRef = useRef(true);

  const [isReady, setIsReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!autoInit || !containerRef.current || sdkRef.current) return;

    const sdk = new BooyaSDK({
      apiKey,
      appId,
      cdnBase,
      dashboardId,
      skin,
      metricsInterval,
      eventInterval,
      onMetrics: (m) => { if (mountedRef.current) setMetrics(m); },
      onError: (e) => { if (mountedRef.current) setError(e); },
    });

    sdkRef.current = sdk;

    sdk.init(containerRef.current)
      .then(() => { if (mountedRef.current) setIsReady(true); })
      .catch((e) => { if (mountedRef.current) setError(e); });

    return () => {
      sdk.destroy();
      sdkRef.current = null;
    };
  }, [apiKey, appId, cdnBase, dashboardId, skin, metricsInterval, eventInterval, autoInit]);

  const start = useCallback(async () => {
    if (!sdkRef.current) return;
    setError(null);
    try {
      const sid = await sdkRef.current.startSession();
      if (mountedRef.current) {
        setSessionId(sid);
        setIsRecording(true);
      }
      return sid;
    } catch (e) {
      if (mountedRef.current) setError(e);
      throw e;
    }
  }, []);

  const stop = useCallback(async () => {
    if (!sdkRef.current) return;
    try {
      const summary = await sdkRef.current.endSession();
      if (mountedRef.current) {
        setIsRecording(false);
        setSessionId(null);
      }
      return summary;
    } catch (e) {
      if (mountedRef.current) setError(e);
      throw e;
    }
  }, []);

  return {
    containerRef,
    metrics,
    isReady,
    isRecording,
    sessionId,
    error,
    start,
    stop,
    sdk: sdkRef.current,
  };
}

export default useBooya;
