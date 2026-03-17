/**
 * Booya SDK v1.0
 *
 * Real-time audience measurement and emotion detection.
 *
 * @example
 * import { BooyaSDK } from 'booya-sdk';
 *
 * const booya = new BooyaSDK({
 *   apiKey: 'bya_...',
 *   appId: 'your-base44-app-id'
 * });
 * await booya.init('#camera-container');
 * const sessionId = await booya.startSession();
 * booya.onMetrics(m => console.log(m.emotions));
 * const summary = await booya.endSession();
 */

const DEFAULT_SERVER = 'https://base44.app';
const PROCESS_SCALE = 0.5;

export class BooyaSDK {
  constructor(config = {}) {
    if (!config.apiKey) throw new Error('BooyaSDK: apiKey is required');
    if (!config.appId) throw new Error('BooyaSDK: appId is required');

    this._apiKey = config.apiKey;
    this._appId = config.appId;
    this._serverUrl = config.serverUrl || DEFAULT_SERVER;
    this._cdnBase = config.cdnBase || '';
    this._skin = config.skin || 'default';
    this._customCss = config.customCss || '';
    this._onMetrics = config.onMetrics || null;
    this._onError = config.onError || null;
    this._metricsInterval = config.metricsInterval || 200;
    this._eventInterval = config.eventInterval || 2000;

    this._container = null;
    this._videoEl = null;
    this._canvasEl = null;
    this._stream = null;
    this._engine = null;
    this._sessionId = null;
    this._dashboardId = config.dashboardId || null;
    this._running = false;
    this._animFrame = null;
    this._srcMat = null;
    this._dstMat = null;
    this._captureCanvas = null;
    this._captureCtx = null;
    this._outCtx = null;
    this._frameSize = { width: 0, height: 0 };
    this._resultImageData = null;
    this._lastMetricsTime = 0;
    this._lastEventTime = 0;
    this._metricsOverlay = null;
    this._latestMetrics = null;
    this._ready = false;
  }

  /**
   * Initialize the SDK: load WASM engine and set up the container.
   * @param {string|HTMLElement} container - CSS selector or DOM element
   */
  async init(container) {
    if (typeof container === 'string') {
      this._container = document.querySelector(container);
    } else {
      this._container = container;
    }

    if (!this._container) throw new Error('BooyaSDK: container not found');

    this._container.style.position = 'relative';
    this._container.style.overflow = 'hidden';

    this._videoEl = document.createElement('video');
    this._videoEl.setAttribute('playsinline', '');
    this._videoEl.setAttribute('autoplay', '');
    this._videoEl.setAttribute('muted', '');
    this._videoEl.muted = true;
    this._videoEl.style.display = 'none';

    this._canvasEl = document.createElement('canvas');
    this._canvasEl.style.width = '100%';
    this._canvasEl.style.height = '100%';
    this._canvasEl.style.objectFit = 'cover';

    this._container.appendChild(this._videoEl);
    this._container.appendChild(this._canvasEl);

    if (this._skin !== 'none') {
      this._createOverlay();
    }

    if (this._customCss) {
      const style = document.createElement('style');
      style.textContent = this._customCss;
      this._container.appendChild(style);
    }

    await this._loadWasm();
    this._ready = true;
  }

  /** Register a callback for real-time metrics. */
  onMetrics(callback) {
    this._onMetrics = callback;
  }

  /** Register a callback for errors. */
  onError(callback) {
    this._onError = callback;
  }

  /**
   * Start camera and processing. Creates a session via the API.
   * @returns {Promise<string>} session_id
   */
  async startSession() {
    if (!this._ready) throw new Error('BooyaSDK: call init() first');

    await this._startCamera();
    this._initEngine();

    const res = await this._apiCall('apiCreateSession', {
      dashboard_id: this._dashboardId,
      metadata: { source: 'sdk', skin: this._skin }
    });

    this._sessionId = res.data.session_id;
    this._running = true;
    this._processFrame();

    return this._sessionId;
  }

  /**
   * End the current session.
   * @returns {Promise<Object>} session summary
   */
  async endSession() {
    this._running = false;
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }

    this._stopCamera();

    if (!this._sessionId) return null;

    const res = await this._apiCall('apiEndSession', {
      session_id: this._sessionId
    });

    const sessionId = this._sessionId;
    this._sessionId = null;

    return { session_id: sessionId, ...res.data };
  }

  /** Get the latest metrics snapshot. */
  getMetrics() {
    return this._latestMetrics;
  }

  /** Check if the SDK is initialized and ready. */
  isReady() {
    return this._ready;
  }

  /** Check if a session is currently active. */
  isRecording() {
    return this._running && !!this._sessionId;
  }

  /** Destroy the SDK and clean up resources. */
  destroy() {
    this._running = false;
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
    this._stopCamera();
    if (this._srcMat) { try { this._srcMat.delete(); } catch (_) {} }
    if (this._dstMat) { try { this._dstMat.delete(); } catch (_) {} }
    this._engine = null;
    if (this._container) {
      this._container.innerHTML = '';
    }
  }

  // ── Private ──────────────────────────────────────────────

  async _loadWasm() {
    return new Promise((resolve, reject) => {
      const Module = window.Module;

      if (Module && typeof Module.Engine === 'function') {
        resolve();
        return;
      }

      window.Module = {
        ...(Module || {}),
        preloadResults: (Module && Module.preloadResults) || {},
        dataFileDownloads: (Module && Module.dataFileDownloads) || {},
        expectedDataFileDownloads: (Module && Module.expectedDataFileDownloads) || 0,
        locateFile: (path) => {
          const filename = path.split('/').pop();
          return this._cdnBase ? `${this._cdnBase}/${filename}` : `/${filename}`;
        },
        onRuntimeInitialized: () => resolve()
      };

      const existing = document.querySelector('script[data-booya-wasm="demo-js"]');
      if (existing) { resolve(); return; }

      const script = document.createElement('script');
      script.src = this._cdnBase ? `${this._cdnBase}/demo.js` : '/demo.js';
      script.async = true;
      script.dataset.booyaWasm = 'demo-js';
      script.onerror = () => reject(new Error('Failed to load WASM engine'));
      document.head.appendChild(script);
    });
  }

  _initEngine() {
    if (this._engine) return;
    const Module = window.Module;
    this._engine = new Module.Engine();
    this._engine.init('resources');
  }

  async _startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    this._stream = stream;
    this._videoEl.srcObject = stream;
    await new Promise((resolve) => { this._videoEl.onloadedmetadata = resolve; });
    await this._videoEl.play();
  }

  _stopCamera() {
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    if (this._videoEl) {
      this._videoEl.srcObject = null;
    }
  }

  _processFrame() {
    if (!this._running) return;

    const video = this._videoEl;
    const canvas = this._canvasEl;
    const engine = this._engine;
    const Module = window.Module;

    if (!video || !canvas || !engine || video.readyState < 4) {
      this._animFrame = requestAnimationFrame(() => this._processFrame());
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    const pw = Math.max(1, Math.floor(width * PROCESS_SCALE));
    const ph = Math.max(1, Math.floor(height * PROCESS_SCALE));

    if (width === 0 || height === 0) {
      this._animFrame = requestAnimationFrame(() => this._processFrame());
      return;
    }

    if (!this._captureCanvas) {
      this._captureCanvas = document.createElement('canvas');
    }
    if (this._captureCanvas.width !== pw || this._captureCanvas.height !== ph) {
      this._captureCanvas.width = pw;
      this._captureCanvas.height = ph;
      this._captureCtx = this._captureCanvas.getContext('2d', { willReadFrequently: true });
    }

    const sizeChanged = this._frameSize.width !== pw || this._frameSize.height !== ph;
    if (!this._srcMat || !this._dstMat || sizeChanged) {
      if (this._srcMat) { try { this._srcMat.delete(); } catch (_) {} }
      if (this._dstMat) { try { this._dstMat.delete(); } catch (_) {} }
      this._srcMat = new Module.Mat(ph, pw);
      this._dstMat = new Module.Mat(ph, pw);
      this._frameSize = { width: pw, height: ph };
      this._resultImageData = null;
    }

    try {
      this._captureCtx.drawImage(video, 0, 0, pw, ph);
      const imageData = this._captureCtx.getImageData(0, 0, pw, ph);
      this._srcMat.data.set(imageData.data);

      engine.process(this._srcMat, this._dstMat);

      if (!this._outCtx || canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
        this._outCtx = canvas.getContext('2d');
        this._outCtx.imageSmoothingEnabled = true;
        this._resultImageData = null;
      }

      if (!this._resultImageData) {
        this._resultImageData = new ImageData(pw, ph);
      }
      this._resultImageData.data.set(this._dstMat.data);
      this._outCtx.putImageData(this._resultImageData, 0, 0);

      const now = Date.now();
      if (now - this._lastMetricsTime > this._metricsInterval) {
        this._lastMetricsTime = now;
        try {
          const jsonStr = engine.getMetricsJson();
          const parsed = JSON.parse(jsonStr);
          this._latestMetrics = parsed;

          if (this._onMetrics) this._onMetrics(parsed);
          if (this._metricsOverlay) this._updateOverlay(parsed);

          if (this._sessionId && (now - this._lastEventTime > this._eventInterval)) {
            this._lastEventTime = now;
            this._logEvent(parsed);
          }
        } catch (_) {}
      }
    } catch (err) {
      if (this._onError) this._onError(err);
    }

    this._animFrame = requestAnimationFrame(() => this._processFrame());
  }

  async _logEvent(parsed) {
    if (!this._sessionId) return;
    try {
      await this._apiCall('apiLogEvent', {
        session_id: this._sessionId,
        emotions: parsed.emotions || {},
        viewer_count: parsed.viewerCount || 0,
        attention_score: parsed.engagementScore || 0,
        timestamp: new Date().toISOString()
      });
    } catch (_) {}
  }

  _buildFunctionUrl(functionName) {
    return `${this._serverUrl}/api/apps/${this._appId}/functions/${functionName}`;
  }

  async _apiCall(functionName, body = {}) {
    const url = this._buildFunctionUrl(functionName);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this._apiKey
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API request failed');
    return data;
  }

  _createOverlay() {
    this._metricsOverlay = document.createElement('div');
    this._metricsOverlay.className = 'booya-metrics-overlay';

    const baseStyles = `
      position: absolute; bottom: 16px; left: 16px;
      padding: 12px 16px; border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; line-height: 1.5; pointer-events: none; z-index: 10;
    `;

    if (this._skin === 'default') {
      this._metricsOverlay.style.cssText = baseStyles +
        'background: rgba(0,0,0,0.75); color: #fff; backdrop-filter: blur(10px);';
    } else if (this._skin === 'minimal') {
      this._metricsOverlay.style.cssText = baseStyles +
        'background: transparent; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.8);';
    }

    this._metricsOverlay.innerHTML = '<div class="booya-metrics-content">Initializing...</div>';
    this._container.appendChild(this._metricsOverlay);
  }

  _updateOverlay(metrics) {
    if (!this._metricsOverlay) return;

    let dominant = 'neutral';
    let maxVal = 0;
    if (metrics.emotions) {
      for (const [k, v] of Object.entries(metrics.emotions)) {
        if (v > maxVal) { maxVal = v; dominant = k; }
      }
    }

    const icons = {
      happy: '\u{1F60A}', surprised: '\u{1F632}', angry: '\u{1F621}',
      sad: '\u{1F622}', disgust: '\u{1F922}', neutral: '\u{1F610}'
    };

    const content = this._metricsOverlay.querySelector('.booya-metrics-content') || this._metricsOverlay;
    content.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px">${icons[dominant] || ''} ${dominant}</div>
      <div>Viewers: ${metrics.viewerCount || 0}</div>
      <div>Engagement: ${Math.round(metrics.engagementScore || 0)}%</div>
    `;
  }
}

/** Static API helpers — data-only access, no WASM needed. */
BooyaSDK.api = {
  _buildUrl(appId, fn, serverUrl) {
    return `${serverUrl || DEFAULT_SERVER}/api/apps/${appId}/functions/${fn}`;
  },

  async getSessions(apiKey, appId, options = {}) {
    const { serverUrl, dashboardId, limit, offset } = options;
    const params = new URLSearchParams();
    if (dashboardId) params.set('dashboard_id', dashboardId);
    if (limit) params.set('limit', limit);
    if (offset) params.set('offset', offset);
    const url = this._buildUrl(appId, 'apiGetSessions', serverUrl);
    const res = await fetch(`${url}?${params}`, { headers: { 'X-API-Key': apiKey } });
    return res.json();
  },

  async getSession(apiKey, appId, sessionId, options = {}) {
    const url = this._buildUrl(appId, 'apiGetSession', options.serverUrl);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({ session_id: sessionId })
    });
    return res.json();
  },

  async getAnalytics(apiKey, appId, options = {}) {
    const { serverUrl, dashboardId, startDate, endDate } = options;
    const params = new URLSearchParams();
    if (dashboardId) params.set('dashboard_id', dashboardId);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    const url = this._buildUrl(appId, 'apiGetAnalytics', serverUrl);
    const res = await fetch(`${url}?${params}`, { headers: { 'X-API-Key': apiKey } });
    return res.json();
  }
};

export default BooyaSDK;
