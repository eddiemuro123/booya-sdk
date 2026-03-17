# booya-sdk

Real-time audience measurement and emotion detection SDK powered by [Booya AI](https://booya.ai).

Detect faces, track engagement, and measure emotional response in real-time using WebAssembly — all client-side. Events are logged to the Booya backend for analytics and dashboards.

## Install

```bash
npm install booya-sdk
```

## Quick Start

```javascript
import { BooyaSDK } from 'booya-sdk';

const booya = new BooyaSDK({
  apiKey: 'bya_your_api_key',
  appId: 'your-base44-app-id',
});

await booya.init('#camera');
const sessionId = await booya.startSession();

booya.onMetrics((m) => {
  console.log(m.emotions);      // { happy, sad, surprised, angry, neutral, disgust }
  console.log(m.viewerCount);   // people actively looking at camera
  console.log(m.totalPersons);  // total faces detected
});

// When done:
const summary = await booya.endSession();
```

```html
<div id="camera" style="width: 640px; height: 480px;"></div>
```

## React

```jsx
import { useBooya } from 'booya-sdk/react';

function MeasurementView() {
  const { containerRef, metrics, isRecording, start, stop, error } = useBooya({
    apiKey: 'bya_your_api_key',
    appId: 'your-base44-app-id',
  });

  return (
    <div>
      <div ref={containerRef} style={{ width: 640, height: 480 }} />
      {metrics && <p>Emotion: {metrics.dominantEmotion}</p>}
      <button onClick={isRecording ? stop : start}>
        {isRecording ? 'Stop' : 'Start'}
      </button>
    </div>
  );
}
```

## WASM Assets

The SDK requires three WASM engine files at runtime:
- `demo.js` — loader script
- `demo.wasm` — WebAssembly binary
- `demo.data` — model data (~30MB)

**Option A** — Host on your own CDN and pass `cdnBase`:

```javascript
new BooyaSDK({ apiKey, appId, cdnBase: 'https://pub-8a8663514dfc4903b92d92bad4ead7b1.r2.dev' });
```

**Option B** — Place files in your public directory (e.g. `/public/demo.js`).

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | *required* | Your Booya API key |
| `appId` | `string` | *required* | Base44 application ID |
| `cdnBase` | `string` | `''` | CDN URL for WASM assets |
| `dashboardId` | `string` | `null` | Scope session to a dashboard |
| `skin` | `string` | `'default'` | Overlay: `'default'`, `'minimal'`, `'none'` |
| `metricsInterval` | `number` | `200` | Read metrics every N ms |
| `eventInterval` | `number` | `2000` | Log events every N ms |
| `onMetrics` | `function` | `null` | Callback for real-time metrics |
| `onError` | `function` | `null` | Callback for errors |

## API Methods

### `BooyaSDK`

| Method | Returns | Description |
|---|---|---|
| `init(container)` | `Promise<void>` | Load WASM and attach to a container element |
| `startSession()` | `Promise<string>` | Start camera, create session, return session_id |
| `endSession()` | `Promise<SessionSummary>` | Stop recording and return session summary |
| `onMetrics(cb)` | `void` | Register real-time metrics callback |
| `onError(cb)` | `void` | Register error callback |
| `getMetrics()` | `BooyaMetrics \| null` | Latest metrics snapshot |
| `isReady()` | `boolean` | Whether the engine is loaded |
| `isRecording()` | `boolean` | Whether a session is active |
| `destroy()` | `void` | Clean up all resources |

### Static API (data-only, no WASM)

```javascript
const sessions = await BooyaSDK.api.getSessions(apiKey, appId, { dashboardId });
const session  = await BooyaSDK.api.getSession(apiKey, appId, sessionId);
const analytics = await BooyaSDK.api.getAnalytics(apiKey, appId, { startDate, endDate });
```

## Metrics Object

```typescript
{
  emotions: { happy, sad, surprised, angry, neutral, disgust }, // 0-100
  viewerCount: number,     // people actively looking at camera
  totalPersons: number,    // total faces detected
  engagementScore: number, // 0-100 aggregate score
  dominantEmotion: string  // highest-scored emotion
}
```

## License

MIT
