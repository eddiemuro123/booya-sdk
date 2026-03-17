# PROMPT.md — Booya SDK (AI-Optimized Documentation)

> This file is optimized for AI coding assistants (Cursor, Copilot, Lovable, v0, etc.).
> Paste or reference this file when building apps with the Booya SDK.

## What is Booya SDK?

A JavaScript SDK for real-time audience measurement and emotion detection. It uses a WebAssembly engine to process video from the user's camera, detects faces, tracks engagement, and measures emotional response — all client-side. Events are automatically logged to the Booya backend.

## Install

```bash
npm install booya-sdk
```

## Credentials

You need two values from your Booya dashboard:
- `apiKey` — starts with `bya_`
- `appId` — your Base44 application ID

## Vanilla JavaScript — Minimal Example

```html
<div id="camera" style="width:640px;height:480px"></div>
<button id="start">Start</button>
<button id="stop">Stop</button>

<script type="module">
import { BooyaSDK } from 'booya-sdk';

const booya = new BooyaSDK({
  apiKey: 'bya_YOUR_KEY',
  appId: 'YOUR_APP_ID',
  cdnBase: 'https://cdn.booya.ai/wasm/v1', // or omit to load from /public
});

await booya.init('#camera');

document.getElementById('start').onclick = async () => {
  const sessionId = await booya.startSession();
  console.log('Session:', sessionId);
};

document.getElementById('stop').onclick = async () => {
  const summary = await booya.endSession();
  console.log('Summary:', summary);
};

booya.onMetrics((m) => {
  // m.emotions = { happy, sad, surprised, angry, neutral, disgust } (0-100)
  // m.viewerCount = number of people looking at camera
  // m.totalPersons = total faces detected
  // m.engagementScore = 0-100
  // m.dominantEmotion = string
});
</script>
```

## React — useBooya Hook

```jsx
import { useBooya } from 'booya-sdk/react';

function MeasurementView() {
  const {
    containerRef,  // attach to a <div>
    metrics,       // real-time BooyaMetrics or null
    isReady,       // true when WASM loaded
    isRecording,   // true during active session
    sessionId,     // current session ID or null
    error,         // last Error or null
    start,         // () => Promise<sessionId>
    stop,          // () => Promise<summary>
  } = useBooya({
    apiKey: 'bya_YOUR_KEY',
    appId: 'YOUR_APP_ID',
    cdnBase: 'https://cdn.booya.ai/wasm/v1',
  });

  return (
    <div>
      <div ref={containerRef} style={{ width: 640, height: 480 }} />

      {!isReady && <p>Loading engine...</p>}

      {metrics && (
        <div>
          <p>Emotion: {metrics.dominantEmotion}</p>
          <p>Viewers: {metrics.viewerCount}</p>
          <p>Engagement: {metrics.engagementScore}%</p>
        </div>
      )}

      <button onClick={isRecording ? stop : start} disabled={!isReady}>
        {isRecording ? 'End Session' : 'Start Session'}
      </button>

      {error && <p style={{color:'red'}}>{error.message}</p>}
    </div>
  );
}
```

## Data-Only API (No Camera / No WASM)

For dashboards, admin panels, or server-side analysis:

```javascript
import { BooyaSDK } from 'booya-sdk';

// List sessions
const { data } = await BooyaSDK.api.getSessions('bya_KEY', 'APP_ID', {
  dashboardId: 'optional-dashboard-id',
  limit: 20,
});

// Get single session with events
const session = await BooyaSDK.api.getSession('bya_KEY', 'APP_ID', 'session-id');

// Get analytics summary
const analytics = await BooyaSDK.api.getAnalytics('bya_KEY', 'APP_ID', {
  startDate: '2026-01-01',
  endDate: '2026-03-01',
});
```

## WASM Assets

Three files must be accessible at runtime:
- `demo.js` (loader, ~200KB)
- `demo.wasm` (engine, ~5MB)
- `demo.data` (models, ~30MB)

Pass `cdnBase` to load from a CDN, or place them in your `/public` folder.

## Key Configuration

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| apiKey | string | yes | — | Starts with `bya_` |
| appId | string | yes | — | Base44 app ID |
| cdnBase | string | no | `''` | CDN URL for WASM files |
| dashboardId | string | no | null | Scope to a dashboard |
| skin | string | no | `'default'` | `'default'` / `'minimal'` / `'none'` |
| metricsInterval | number | no | 200 | ms between metric reads |
| eventInterval | number | no | 2000 | ms between event logs |

## Metrics Shape

```typescript
interface BooyaMetrics {
  emotions: {
    happy: number;      // 0-100
    sad: number;        // 0-100
    surprised: number;  // 0-100
    angry: number;      // 0-100
    neutral: number;    // 0-100
    disgust: number;    // 0-100
  };
  viewerCount: number;      // actively looking at camera
  totalPersons: number;     // faces detected
  engagementScore: number;  // 0-100
  dominantEmotion: string;  // key with highest score
}
```

## Common Patterns

### Show emotion bars

```jsx
{metrics && Object.entries(metrics.emotions).map(([name, value]) => (
  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ width: 80 }}>{name}</span>
    <div style={{ flex: 1, background: '#eee', borderRadius: 4, height: 8 }}>
      <div style={{ width: `${value}%`, background: '#6366f1', borderRadius: 4, height: 8 }} />
    </div>
    <span>{Math.round(value)}%</span>
  </div>
))}
```

### Auto-start on mount

```jsx
const { containerRef, isReady, start } = useBooya({ apiKey, appId });

useEffect(() => {
  if (isReady) start();
}, [isReady]);
```

### Custom overlay (no built-in skin)

```jsx
const { containerRef, metrics } = useBooya({ apiKey, appId, skin: 'none' });

return (
  <div style={{ position: 'relative' }}>
    <div ref={containerRef} style={{ width: '100%', height: 400 }} />
    {metrics && (
      <div style={{ position: 'absolute', top: 10, right: 10, background: '#000a', color: '#fff', padding: 8, borderRadius: 8 }}>
        {metrics.dominantEmotion} — {metrics.viewerCount} viewers
      </div>
    )}
  </div>
);
```

## Troubleshooting

| Issue | Fix |
|---|---|
| "container not found" | Pass a valid CSS selector or DOM element to `init()` |
| Camera permission denied | The browser blocked `getUserMedia` — check HTTPS and permissions |
| WASM fails to load | Verify `cdnBase` URL or that files exist in `/public` |
| No metrics | Ensure `startSession()` was called and face is visible to camera |
| 0 viewers but faces detected | "Viewers" = people looking at camera; check gaze angle |
