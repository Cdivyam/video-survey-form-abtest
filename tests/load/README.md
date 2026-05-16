# Load Tests

Simulates concurrent survey respondents using [k6](https://k6.io/).

## Install k6

**macOS**
```bash
brew install k6
```

**Windows**
```bash
choco install k6
```

**Linux (Debian/Ubuntu)**
```bash
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

---

## Prerequisites

1. The app must be running and reachable (locally or on the server).
2. At least one survey must exist with status `ready` and have composite videos generated for its video sets.
3. Find the survey slug — it appears in the survey share URL: `https://your-domain.com/s/<slug>`.

---

## Running the test

### Single survey
```bash
k6 run \
  -e BASE_URL=https://your-domain.com \
  -e SURVEY_SLUG=your-survey-slug \
  tests/load/survey-respondent.js
```

### Multiple surveys (e.g. 3 surveys × 6 users each = 18 total)
```bash
k6 run \
  -e BASE_URL=https://your-domain.com \
  -e SURVEY_SLUGS=slug1,slug2,slug3 \
  -e USERS_PER_SURVEY=6 \
  tests/load/survey-respondent.js
```

Virtual users are distributed evenly — VU 1, 4, 7… → slug1; VU 2, 5, 8… → slug2; etc.
`USERS_PER_SURVEY` defaults to 6 if omitted.

### Against a local dev server
```bash
npm run dev   # Terminal 1

k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e SURVEY_SLUG=your-survey-slug \
  tests/load/survey-respondent.js
```

---

## What the test does

Each virtual user runs this flow once per iteration, matching what a real respondent's browser does:

| Step | Request |
|------|---------|
| Create session | `POST /api/sessions` |
| Load survey data | `GET /api/sessions/:token` |
| Stream composite video | `GET /api/files/...` (first 512 KB via Range header) |
| Submit responses | `POST /api/responses` |
| Mark complete | `PATCH /api/sessions/:token` |

Sleep periods between steps simulate realistic reading/watching time.

---

## Load profile

```
Users
 15 ┤          ┌─────────────┐
  5 ┤    ┌─────┘             └──
  0 ┤────┘                       ──
    0s   30s        90s      120s
```

- **0–30 s**: ramp from 0 → 5 users
- **30–90 s**: ramp to 15 users and hold
- **90–120 s**: ramp down to 0

---

## Reading the results

k6 prints a summary at the end. Key metrics:

| Metric | What it measures | Target |
|--------|-----------------|--------|
| `http_req_duration p(95)` | 95th percentile total request time | < 3 s |
| `http_req_failed` | Fraction of requests that errored | < 1% |
| `session_create_duration p(95)` | Session creation latency | < 2 s |
| `session_load_duration p(95)` | Survey data load latency | < 2 s |
| `video_fetch_duration p(95)` | First-chunk video latency | < 5 s |
| `submit_duration p(95)` | Response submission latency | < 2 s |
| `errors` | Combined error rate across all steps | < 1% |

A threshold marked `✓` passed. A threshold marked `✗` failed — that step is the bottleneck to investigate.

---

## Monitoring the server during the test

SSH into your instance in a second terminal while the test runs:

```bash
# CPU + memory overview (press F6 to sort by CPU)
htop

# Disk I/O — watch %util on the disk serving video files
iostat -x 2

# Top processes by CPU
watch -n 1 "ps aux --sort=-%cpu | head -8"

# App error log (adjust path to wherever your process manager writes logs)
# PM2:
pm2 logs --lines 50
# systemd:
journalctl -u your-app -f
```

### Warning signs

| Observation | Likely cause |
|-------------|-------------|
| `video_fetch_duration` fails threshold | Node.js streaming video files is the bottleneck; add Nginx + X-Accel-Redirect |
| CPU > 85% sustained | Increase vCPUs or add a second instance behind a load balancer |
| RAM > 1.8 GB on a 2 GB instance | Risk of swap/OOM; reduce Node.js heap or upgrade RAM |
| `http_req_failed` spikes | SQLite write contention or unhandled error; check app logs |

---

## Adjusting the load profile

Edit the `options.stages` block in `survey-respondent.js` to test different scenarios:

```js
// Spike test — sudden burst
stages: [
  { duration: "10s", target: 20 },
  { duration: "1m",  target: 20 },
  { duration: "10s", target: 0  },
],

// Soak test — sustained low load for a long time
stages: [
  { duration: "1m",  target: 10 },
  { duration: "30m", target: 10 },
  { duration: "1m",  target: 0  },
],
```
