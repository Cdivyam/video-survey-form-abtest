/**
 * k6 load test — survey respondent flow
 *
 * Simulates the full path a respondent takes:
 *   create session → load survey → stream composite video → submit responses → complete session
 *
 * Usage: see tests/load/README.md
 */

import http from "k6/http";
import { sleep, check, group } from "k6";
import { Trend, Rate } from "k6/metrics";

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const SURVEY_SLUG = __ENV.SURVEY_SLUG || "";

if (!SURVEY_SLUG) {
  throw new Error("SURVEY_SLUG env var is required. See tests/load/README.md");
}

// ─── Custom metrics ───────────────────────────────────────────────────────────

const sessionCreateDuration = new Trend("session_create_duration", true);
const sessionLoadDuration   = new Trend("session_load_duration", true);
const videoFetchDuration    = new Trend("video_fetch_duration", true);
const submitDuration        = new Trend("submit_duration", true);
const errorRate             = new Rate("errors");

// ─── Test stages ─────────────────────────────────────────────────────────────

export const options = {
  stages: [
    { duration: "30s", target: 10 },  // ramp up to 10 concurrent users
    { duration: "1m",  target: 30 },  // ramp to 30 and hold
    { duration: "30s", target: 0  },  // ramp down
  ],
  thresholds: {
    // 95% of all requests complete within 3s
    http_req_duration: ["p(95)<3000"],
    // Less than 1% of requests fail
    http_req_failed: ["rate<0.01"],
    // Per-step thresholds
    session_create_duration: ["p(95)<2000"],
    session_load_duration:   ["p(95)<2000"],
    video_fetch_duration:    ["p(95)<5000"],
    submit_duration:         ["p(95)<2000"],
  },
};

// ─── Main scenario ───────────────────────────────────────────────────────────

export default function () {
  let token = null;
  let videoSets = [];
  let pages = [];

  // 1. Create session
  group("create_session", () => {
    const res = http.post(
      `${BASE_URL}/api/sessions`,
      JSON.stringify({ slug: SURVEY_SLUG }),
      { headers: { "Content-Type": "application/json" } }
    );

    sessionCreateDuration.add(res.timings.duration);
    const ok = check(res, {
      "create session 2xx": (r) => r.status >= 200 && r.status < 300,
      "token present":      (r) => !!r.json("token"),
    });
    errorRate.add(!ok);

    if (ok) token = res.json("token");
  });

  if (!token) return;
  sleep(1);

  // 2. Load session data (runner fetches template + video sets on mount)
  group("load_session", () => {
    const res = http.get(`${BASE_URL}/api/sessions/${token}`);

    sessionLoadDuration.add(res.timings.duration);
    const ok = check(res, {
      "load session 2xx":    (r) => r.status >= 200 && r.status < 300,
      "survey data present": (r) => !!r.json("survey"),
    });
    errorRate.add(!ok);

    if (ok) {
      videoSets = res.json("survey.videoSets") || [];
      pages = res.json("survey.template.pages") || [];
    }
  });

  sleep(1);

  // 3. Fetch composite video (simulates browser streaming the video element src)
  if (videoSets.length > 0) {
    group("stream_video", () => {
      const compositeUrl = videoSets[0].compositeUrl;
      const res = http.get(`${BASE_URL}${compositeUrl}`, {
        // Only fetch headers + first chunk — avoids downloading entire file in the test
        headers: { Range: "bytes=0-524287" }, // first 512 KB
      });

      videoFetchDuration.add(res.timings.duration);
      const ok = check(res, {
        "video reachable": (r) => r.status === 200 || r.status === 206,
      });
      errorRate.add(!ok);
    });
  }

  // Simulate respondent watching video and filling answers
  sleep(5);

  // 4. Submit responses
  group("submit_responses", () => {
    // Build payload using real element IDs from the session
    const videoElementIds = pages
      .flatMap((p) => p.elements || [])
      .filter((e) => e.elementType === "video_likert" || e.elementType === "video_preference")
      .map((e) => e.id);

    const responses = videoSets.flatMap((vs) =>
      videoElementIds.flatMap((elementId) =>
        vs.slots.map((slot) => ({
          surveyVideoSetId: vs.surveyVideoSetId,
          elementId,
          slotLabel: slot,
          value: "3",
        }))
      )
    );

    const res = http.post(
      `${BASE_URL}/api/responses`,
      JSON.stringify({ token, responses }),
      { headers: { "Content-Type": "application/json" } }
    );

    submitDuration.add(res.timings.duration);
    const ok = check(res, { "submit 2xx": (r) => r.status >= 200 && r.status < 300 });
    errorRate.add(!ok);
  });

  sleep(1);

  // 5. Mark session complete
  group("complete_session", () => {
    const res = http.patch(`${BASE_URL}/api/sessions/${token}`);
    check(res, { "complete 2xx": (r) => r.status >= 200 && r.status < 300 });
  });

  sleep(1);
}
