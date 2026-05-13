"use client";
import { useEffect, useRef, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import HeadingEl from "@/components/runner/elements/HeadingEl";
import TextboxEl from "@/components/runner/elements/TextboxEl";
import ConsentEl from "@/components/runner/elements/ConsentEl";
import DemographicsEl from "@/components/runner/elements/DemographicsEl";
import VideoLikertEl from "@/components/runner/elements/VideoLikertEl";
import VideoPreferenceEl from "@/components/runner/elements/VideoPreferenceEl";
import type {
  RunnerSession, BuilderPage, BuilderElement,
  RunnerVideoSet,
  ConsentConfig, VideoLikertConfig, VideoPreferenceConfig,
  HeadingConfig, TextboxConfig, ShortAnswerConfig,
  SingleChoiceConfig, MultiChoiceConfig, LikertConfig,
  DemographicsConfig,
} from "@/lib/types";

type FlatPage =
  | { kind: "static"; page: BuilderPage }
  | { kind: "video"; page: BuilderPage; videoSet: RunnerVideoSet };

// Response store: elementId → value (for non-video); or `${surveyVideoSetId}::${elementId}::${slot}` → value (for video)
type ResponseMap = Record<string, string>;

type SurveyProgress = { token: string; pageIndex: number; responses: ResponseMap };
const storageKey = (slug: string) => `survey-progress-${slug}`;

export default function SurveyRunner({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<RunnerSession | null>(null);
  const [flatPages, setFlatPages] = useState<FlatPage[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [responses, setResponses] = useState<ResponseMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const validationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 1: restore from localStorage or create a new session
  useEffect(() => {
    const stored = localStorage.getItem(storageKey(slug));
    if (stored) {
      try {
        const progress = JSON.parse(stored) as SurveyProgress;
        setToken(progress.token);
        setPageIndex(progress.pageIndex);
        setResponses(progress.responses);
        return; // Step 2 will load session data using the restored token
      } catch {
        localStorage.removeItem(storageKey(slug));
      }
    }

    // No stored progress — create a new session
    fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    }).then(async (r) => {
      const d = await r.json();
      if (d.token) {
        setToken(d.token);
      } else if (r.status === 410) {
        setError("This survey has been disabled by the owner. Please contact the form owner.");
      } else {
        setError("This survey is not available.");
      }
    }).catch(() => setError("Failed to load survey."));
  }, [slug]);

  // Step 2: load session data from DB (also validates the token is still alive)
  useEffect(() => {
    if (!token) return;
    fetch(`/api/sessions/${token}`).then(async (r) => {
      if (!r.ok) {
        // Stale token (survey deleted, DB reset, etc.) — clear storage and restart
        localStorage.removeItem(storageKey(slug));
        setToken(null);
        setPageIndex(0);
        setResponses({});
        setError("Your previous session has expired. Please refresh to start a new survey.");
        return;
      }
      const s: RunnerSession = await r.json();
      setSession(s);

      const nonEmpty = (p: BuilderPage) => p.elements.length > 0;

      const beforePages = s.survey.template.pages
        .filter((p) => p.section === "before" && nonEmpty(p))
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((p): FlatPage => ({ kind: "static", page: p }));

      const dynamicTemplate = s.survey.template.pages
        .filter((p) => p.section === "dynamic" && nonEmpty(p))
        .sort((a, b) => a.orderIndex - b.orderIndex)[0];

      const videoPages: FlatPage[] = dynamicTemplate
        ? s.survey.videoSets
            .sort((a, b) => a.positionIndex - b.positionIndex)
            .map((vs): FlatPage => ({ kind: "video", page: dynamicTemplate, videoSet: vs }))
        : [];

      const afterPages = s.survey.template.pages
        .filter((p) => p.section === "after" && nonEmpty(p))
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((p): FlatPage => ({ kind: "static", page: p }));

      const built = [...beforePages, ...videoPages, ...afterPages];
      setFlatPages(built);

      // Clamp restored pageIndex in case the survey structure changed since last visit
      setPageIndex((prev) => Math.min(prev, Math.max(0, built.length - 1)));
    });
  }, [token]);

  // Persist progress to localStorage on every change (except after final submit)
  useEffect(() => {
    if (!token || done) return;
    localStorage.setItem(storageKey(slug), JSON.stringify({ token, pageIndex, responses }));
  }, [token, pageIndex, responses, done]);

  function setResponse(key: string, val: string) {
    setResponses((prev) => ({ ...prev, [key]: val }));
  }

  function parseDemoValues(raw: string | undefined): Record<string, string> {
    try { return JSON.parse(raw ?? "{}"); } catch { return {}; }
  }

  function setDemoField(elId: string, fieldId: string, val: string) {
    const current = parseDemoValues(responses[elId]);
    setResponse(elId, JSON.stringify({ ...current, [fieldId]: val }));
  }

  const currentFlat = flatPages[pageIndex];
  const progress = flatPages.length > 0 ? Math.round((pageIndex / flatPages.length) * 100) : 0;

  // Returns the set of error keys for the current page (empty = all valid).
  // Key format: el.id for static elements, surveyVideoSetId::el.id for video elements.
  function getValidationErrors(): Set<string> {
    const errors = new Set<string>();
    if (!currentFlat) return errors;
    const page = currentFlat.page;
    const videoSet = currentFlat.kind === "video" ? currentFlat.videoSet : null;

    for (const el of page.elements) {
      const type = el.elementType;
      if (type === "videoset_block") continue;
      const key = videoSet ? `${videoSet.surveyVideoSetId}::${el.id}` : el.id;

      if (type === "consent") {
        if (!responses[el.id]) errors.add(key);
      } else if (type === "demographics") {
        const c = el.config as DemographicsConfig;
        const vals = parseDemoValues(responses[el.id]);
        if (c.fields.some((f) => f.required && !vals[f.id])) errors.add(key);
      } else if (type === "video_likert" && videoSet) {
        if (videoSet.slots.some((s) => !responses[`${videoSet.surveyVideoSetId}::${el.id}::${s}`])) errors.add(key);
      } else if (type === "video_preference" && videoSet) {
        if (!responses[`${videoSet.surveyVideoSetId}::${el.id}::pref`]) errors.add(key);
      }
    }
    return errors;
  }

  // Build the complete response payload from all accumulated responses across all pages
  function buildAllResponses(): Array<{ surveyVideoSetId?: string; elementId: string; slotLabel?: string; value: string }> {
    const payload: Array<{ surveyVideoSetId?: string; elementId: string; slotLabel?: string; value: string }> = [];

    for (const flat of flatPages) {
      const page = flat.page;
      const videoSet = flat.kind === "video" ? flat.videoSet : null;

      for (const el of page.elements) {
        if (el.elementType === "videoset_block") continue;

        if (el.elementType === "video_likert" && videoSet) {
          for (const slot of videoSet.slots) {
            const val = responses[`${videoSet.surveyVideoSetId}::${el.id}::${slot}`];
            if (val) payload.push({ surveyVideoSetId: videoSet.surveyVideoSetId, elementId: el.id, slotLabel: slot, value: val });
          }
        } else if (el.elementType === "video_preference" && videoSet) {
          const val = responses[`${videoSet.surveyVideoSetId}::${el.id}::pref`];
          if (val) payload.push({ surveyVideoSetId: videoSet.surveyVideoSetId, elementId: el.id, slotLabel: val, value: val });
        } else {
          const val = responses[el.id];
          if (val) payload.push({ elementId: el.id, value: val });
        }
      }
    }
    return payload;
  }

  // Set browser title once template name is known
  useEffect(() => {
    if (session) document.title = session.survey.template.name;
  }, [session]);

  // Scroll to top whenever the page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pageIndex]);

  async function next() {
    const errors = getValidationErrors();
    if (errors.size > 0) {
      setValidationErrors(errors);
      if (validationTimer.current) clearTimeout(validationTimer.current);
      validationTimer.current = setTimeout(() => setValidationErrors(new Set()), 10000);
      return;
    }
    // Clear any lingering errors on successful advance
    setValidationErrors(new Set());
    setSubmitting(true);

    if (pageIndex + 1 >= flatPages.length) {
      // Final submit: POST all accumulated responses then mark session complete
      const payload = buildAllResponses();
      if (payload.length > 0) {
        await fetch("/api/responses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, responses: payload }),
        });
      }
      await fetch(`/api/sessions/${token}`, { method: "PATCH" });
      localStorage.removeItem(storageKey(slug));
      setDone(true);
    } else {
      setPageIndex((i) => i + 1);
    }

    setSubmitting(false);
  }

  function renderElement(el: BuilderElement, videoSet?: RunnerVideoSet) {
    switch (el.elementType) {
      case "heading":
        return <HeadingEl config={el.config as HeadingConfig} />;
      case "textbox":
        return <TextboxEl config={el.config as TextboxConfig} />;
      case "consent":
        return <ConsentEl config={el.config as ConsentConfig} elementId={el.id}
          value={responses[el.id] ?? ""}
          onChange={(v) => setResponse(el.id, v)} />;
      case "demographics":
        return <DemographicsEl
          config={el.config as DemographicsConfig}
          values={parseDemoValues(responses[el.id])}
          onChange={(fieldId, val) => setDemoField(el.id, fieldId, val)}
        />;
      case "short_answer":
        return (
          <div className="space-y-2">
            <p className="font-medium text-zinc-900">{(el.config as ShortAnswerConfig).prompt}</p>
            <Input placeholder={(el.config as ShortAnswerConfig).placeholder}
              value={responses[el.id] ?? ""}
              onChange={(e) => setResponse(el.id, e.target.value)} />
          </div>
        );
      case "single_choice": {
        const c = el.config as SingleChoiceConfig;
        return (
          <div className="space-y-2">
            <p className="font-medium text-zinc-900">{c.prompt}</p>
            {c.options.map((opt) => (
              <label key={opt} className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name={el.id} value={opt} checked={responses[el.id] === opt}
                  onChange={() => setResponse(el.id, opt)} className="accent-zinc-900" />
                <span className="text-zinc-700">{opt}</span>
              </label>
            ))}
          </div>
        );
      }
      case "multi_choice": {
        const c = el.config as MultiChoiceConfig;
        const current = (responses[el.id] ?? "").split("||").filter(Boolean);
        return (
          <div className="space-y-2">
            <p className="font-medium text-zinc-900">{c.prompt}</p>
            {c.options.map((opt) => (
              <label key={opt} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={current.includes(opt)}
                  onChange={() => {
                    const next = current.includes(opt) ? current.filter((x) => x !== opt) : [...current, opt];
                    setResponse(el.id, next.join("||"));
                  }} className="accent-zinc-900" />
                <span className="text-zinc-700">{opt}</span>
              </label>
            ))}
          </div>
        );
      }
      case "likert": {
        const c = el.config as LikertConfig;
        return (
          <div className="space-y-2">
            <p className="font-medium text-zinc-900">{c.prompt}</p>
            <div className="flex gap-4 items-center">
              {c.scalePoints.map((pt) => (
                <label key={pt} className="flex flex-col items-center gap-1 cursor-pointer">
                  <input type="radio" name={el.id} value={String(pt)}
                    checked={responses[el.id] === String(pt)}
                    onChange={() => setResponse(el.id, String(pt))} className="accent-zinc-900" />
                  <span className="text-xs text-zinc-600">{c.scaleLabels[String(pt)] ?? pt}</span>
                </label>
              ))}
            </div>
          </div>
        );
      }
      case "videoset_block":
        return videoSet ? (
          <video src={videoSet.compositeUrl} controls className="w-full rounded-lg" />
        ) : null;
      case "video_likert":
        return videoSet ? (
          <VideoLikertEl
            config={el.config as VideoLikertConfig}
            elementId={el.id}
            slots={videoSet.slots}
            surveyVideoSetId={videoSet.surveyVideoSetId}
            values={Object.fromEntries(videoSet.slots.map((s) => [s, responses[`${videoSet.surveyVideoSetId}::${el.id}::${s}`] ?? ""]))}
            onChange={(slot, val) => setResponse(`${videoSet.surveyVideoSetId}::${el.id}::${slot}`, val)}
          />
        ) : null;
      case "video_preference":
        return videoSet ? (
          <VideoPreferenceEl
            config={el.config as VideoPreferenceConfig}
            slots={videoSet.slots}
            value={responses[`${videoSet.surveyVideoSetId}::${el.id}::pref`] ?? ""}
            onChange={(val) => setResponse(`${videoSet.surveyVideoSetId}::${el.id}::pref`, val)}
          />
        ) : null;
      default:
        return null;
    }
  }

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-zinc-500">{error}</p>
    </div>
  );

  if (!session || flatPages.length === 0) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-zinc-400">Loading survey…</p>
    </div>
  );

  if (done) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-zinc-900">Thank you!</h1>
        <p className="text-zinc-500">Your responses have been recorded.</p>
      </div>
    </div>
  );

  const videoSet = currentFlat?.kind === "video" ? currentFlat.videoSet : undefined;
  const totalVideoSets = session.survey.videoSets.length;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 text-center">
          {session.survey.template.name}
        </h1>

        <Progress value={progress} className="h-1.5" />

        <Card>
          <CardContent className="py-8 px-8 space-y-8">
            {videoSet && totalVideoSets > 1 && (
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4 -mt-2">
                <span className="text-sm font-medium text-zinc-500">
                  Video Set {videoSet.positionIndex + 1} / {totalVideoSets}
                </span>
                <div className="flex gap-1">
                  {Array.from({ length: totalVideoSets }).map((_, i) => (
                    <div key={i} className={`h-1.5 w-6 rounded-full transition-colors
                      ${i <= videoSet.positionIndex ? "bg-zinc-800" : "bg-zinc-200"}`} />
                  ))}
                </div>
              </div>
            )}
            {currentFlat?.page.elements.map((el) => {
              const errKey = videoSet ? `${videoSet.surveyVideoSetId}::${el.id}` : el.id;
              const hasError = validationErrors.has(errKey);
              return (
                <div key={el.id}
                  className={hasError ? "rounded-lg ring-2 ring-red-400 p-3 -mx-3" : ""}>
                  {renderElement(el, videoSet)}
                  {hasError && (
                    <p className="text-xs text-red-500 mt-2">Required field</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 items-center">
          <div>
            {pageIndex > 0 && (
              <Button variant="ghost" onClick={() => setPageIndex((i) => i - 1)} disabled={submitting}>
                ← Back
              </Button>
            )}
          </div>
          <span className="text-sm text-zinc-400 text-center">
            Page {pageIndex + 1} of {flatPages.length}
          </span>
          <div className="flex justify-end">
            <Button onClick={next} disabled={submitting} size="lg">
              {submitting ? "Saving…" : pageIndex + 1 === flatPages.length ? "Submit" : "Next →"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
