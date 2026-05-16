"use client";
import { useEffect, useRef, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DemographicsConfig, VideosetBlockConfig,
} from "@/lib/types";

type FlatPage =
  | { kind: "static"; page: BuilderPage }
  | { kind: "video"; page: BuilderPage; videoSet: RunnerVideoSet };

type ResponseMap = Record<string, string>;

type SurveyProgress = { token: string; pageIndex: number; responses: ResponseMap };
const storageKey = (slug: string) => `survey-progress-${slug}`;

/** Splits a dynamic page's elements into three groups for the split layout. */
function partitionVideoPageElements(elements: BuilderElement[]) {
  const videoSetBlock = elements.find((e) => e.elementType === "videoset_block") ?? null;
  const associated = elements.filter((e) => {
    if (e.elementType !== "video_likert" && e.elementType !== "video_preference") return false;
    const ref = (e.config as { videosetBlockRef?: string | null }).videosetBlockRef;
    return !ref || ref === videoSetBlock?.id;
  });
  const associatedIds = new Set(associated.map((e) => e.id));
  const nonAssociated = elements.filter(
    (e) => e.id !== videoSetBlock?.id && !associatedIds.has(e.id)
  );
  return { videoSetBlock, associated, nonAssociated };
}

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
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isVideoStuck, setIsVideoStuck] = useState(false);
  const videoSentinelRef = useRef<HTMLDivElement>(null);

  // Step 1: restore from localStorage or create a new session
  useEffect(() => {
    const stored = localStorage.getItem(storageKey(slug));
    if (stored) {
      try {
        const progress = JSON.parse(stored) as SurveyProgress;
        setToken(progress.token);
        setPageIndex(progress.pageIndex);
        setResponses(progress.responses);
        return;
      } catch {
        localStorage.removeItem(storageKey(slug));
      }
    }

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

  // Step 2: load session data from DB
  useEffect(() => {
    if (!token) return;
    fetch(`/api/sessions/${token}`).then(async (r) => {
      if (!r.ok) {
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
      setPageIndex((prev) => Math.min(prev, Math.max(0, built.length - 1)));
    });
  }, [token]);

  // Persist progress to localStorage on every change
  useEffect(() => {
    if (!token || done) return;
    localStorage.setItem(storageKey(slug), JSON.stringify({ token, pageIndex, responses }));
  }, [token, pageIndex, responses, done]);

  // Reset carousel and scroll to top whenever the page changes
  useEffect(() => {
    setCarouselIndex(0);
    setIsVideoStuck(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pageIndex]);

  // Scroll mode: observe sentinel to detect when video has left its natural position
  useEffect(() => {
    if (!videoSentinelRef.current) return;
    const flat = flatPages[pageIndex];
    if (flat?.kind !== "video") return;
    const vsb = flat.page.elements.find((e) => e.elementType === "videoset_block");
    const mode = (vsb?.config as VideosetBlockConfig | undefined)?.layoutMode ?? "carousel";
    if (mode !== "scroll") return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVideoStuck(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(videoSentinelRef.current);
    return () => observer.disconnect();
  }, [flatPages, pageIndex]);

  // Set browser title once template name is known
  useEffect(() => {
    if (session) document.title = session.survey.template.name;
  }, [session]);

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

  // ─── Derived state (computed every render, before handlers) ─────────────────

  const currentFlat = flatPages[pageIndex];
  // videoSet and partition are computed unconditionally so handlers can close over them
  const videoSet = currentFlat?.kind === "video" ? currentFlat.videoSet : undefined;
  const { videoSetBlock, associated, nonAssociated } = videoSet && currentFlat
    ? partitionVideoPageElements(currentFlat.page.elements)
    : { videoSetBlock: null as BuilderElement | null, associated: [] as BuilderElement[], nonAssociated: [] as BuilderElement[] };

  const layoutMode = (videoSetBlock?.config as VideosetBlockConfig | undefined)?.layoutMode ?? "carousel";

  // Carousel mode: video page with associated questions presented one at a time
  const isCarouselMode = !!(videoSet && videoSetBlock && associated.length > 0 && layoutMode === "carousel");
  // Scroll mode: video page with associated questions all visible, validated as a whole page
  const isScrollMode   = !!(videoSet && videoSetBlock && associated.length > 0 && layoutMode === "scroll");

  // ─── Validation ─────────────────────────────────────────────────────────────

  function showValidationErrors(errors: Set<string>) {
    setValidationErrors(errors);
    if (validationTimer.current) clearTimeout(validationTimer.current);
    validationTimer.current = setTimeout(() => setValidationErrors(new Set()), 10000);
  }

  // Full-page validation (used by static pages and last carousel item)
  function getValidationErrors(): Set<string> {
    const errors = new Set<string>();
    if (!currentFlat) return errors;
    const vs = currentFlat.kind === "video" ? currentFlat.videoSet : null;

    for (const el of currentFlat.page.elements) {
      const type = el.elementType;
      if (type === "videoset_block") continue;
      const key = vs ? `${vs.surveyVideoSetId}::${el.id}` : el.id;

      if (type === "consent") {
        if (!responses[el.id]) errors.add(key);
      } else if (type === "demographics") {
        const c = el.config as DemographicsConfig;
        const vals = parseDemoValues(responses[el.id]);
        if (c.fields.some((f) => f.required && !vals[f.id])) errors.add(key);
      } else if (type === "video_likert" && vs) {
        if (vs.slots.some((s) => !responses[`${vs.surveyVideoSetId}::${el.id}::${s}`])) errors.add(key);
      } else if (type === "video_preference" && vs) {
        if (!responses[`${vs.surveyVideoSetId}::${el.id}::pref`]) errors.add(key);
      }
    }
    return errors;
  }

  // Single-item validation for carousel intermediate steps
  function validateCarouselItem(el: BuilderElement): Set<string> {
    const errors = new Set<string>();
    if (!videoSet) return errors;
    const key = `${videoSet.surveyVideoSetId}::${el.id}`;
    if (el.elementType === "video_likert") {
      if (videoSet.slots.some((s) => !responses[`${videoSet.surveyVideoSetId}::${el.id}::${s}`])) errors.add(key);
    } else if (el.elementType === "video_preference") {
      if (!responses[`${videoSet.surveyVideoSetId}::${el.id}::pref`]) errors.add(key);
    }
    return errors;
  }

  // ─── Page / carousel navigation ─────────────────────────────────────────────

  function buildAllResponses(): Array<{ surveyVideoSetId?: string; elementId: string; slotLabel?: string; value: string }> {
    const payload: Array<{ surveyVideoSetId?: string; elementId: string; slotLabel?: string; value: string }> = [];
    for (const flat of flatPages) {
      const vs = flat.kind === "video" ? flat.videoSet : null;
      for (const el of flat.page.elements) {
        if (el.elementType === "videoset_block") continue;
        if (el.elementType === "video_likert" && vs) {
          for (const slot of vs.slots) {
            const val = responses[`${vs.surveyVideoSetId}::${el.id}::${slot}`];
            if (val) payload.push({ surveyVideoSetId: vs.surveyVideoSetId, elementId: el.id, slotLabel: slot, value: val });
          }
        } else if (el.elementType === "video_preference" && vs) {
          const val = responses[`${vs.surveyVideoSetId}::${el.id}::pref`];
          if (val) payload.push({ surveyVideoSetId: vs.surveyVideoSetId, elementId: el.id, slotLabel: val, value: val });
        } else {
          const val = responses[el.id];
          if (val) payload.push({ elementId: el.id, value: val });
        }
      }
    }
    return payload;
  }

  async function advancePage() {
    setSubmitting(true);
    if (pageIndex + 1 >= flatPages.length) {
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

  // Carousel Next: validate current item → advance; on last item validate full page → advance page
  async function handleCarouselNext() {
    if (!videoSet || !associated[carouselIndex]) return;

    if (carouselIndex < associated.length - 1) {
      const itemErrors = validateCarouselItem(associated[carouselIndex]);
      if (itemErrors.size > 0) { showValidationErrors(itemErrors); return; }
      setValidationErrors(new Set());
      setCarouselIndex((i) => i + 1);
    } else {
      const allErrors = getValidationErrors();
      if (allErrors.size > 0) {
        showValidationErrors(allErrors);
        // Jump to first errored associated item
        const firstErrIdx = associated.findIndex(
          (el) => allErrors.has(`${videoSet.surveyVideoSetId}::${el.id}`)
        );
        if (firstErrIdx >= 0) setCarouselIndex(firstErrIdx);
        return;
      }
      setValidationErrors(new Set());
      await advancePage();
    }
  }

  // Carousel Back: go back in carousel, or back a page if at first question
  function handleCarouselBack() {
    setValidationErrors(new Set());
    if (carouselIndex > 0) {
      setCarouselIndex((i) => i - 1);
    } else if (pageIndex > 0) {
      setPageIndex((i) => i - 1);
      // carouselIndex reset to 0 by the pageIndex useEffect, but for a "back" we want the last question
      // We'll set it after the pageIndex state settles in the next render via a flag — simpler:
      // just go to first question of previous page (reset is correct behavior for back)
    }
  }

  // Static pages only
  async function next() {
    const errors = getValidationErrors();
    if (errors.size > 0) { showValidationErrors(errors); return; }
    setValidationErrors(new Set());
    await advancePage();
  }

  // ─── Element renderer ───────────────────────────────────────────────────────

  function renderElement(el: BuilderElement, vs?: RunnerVideoSet) {
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
        return vs ? (
          <video src={vs.compositeUrl} controls className="w-full rounded-lg" />
        ) : null;
      case "video_likert":
        return vs ? (
          <VideoLikertEl
            config={el.config as VideoLikertConfig}
            elementId={el.id}
            slots={vs.slots}
            surveyVideoSetId={vs.surveyVideoSetId}
            values={Object.fromEntries(vs.slots.map((s) => [s, responses[`${vs.surveyVideoSetId}::${el.id}::${s}`] ?? ""]))}
            onChange={(slot, val) => setResponse(`${vs.surveyVideoSetId}::${el.id}::${slot}`, val)}
          />
        ) : null;
      case "video_preference":
        return vs ? (
          <VideoPreferenceEl
            config={el.config as VideoPreferenceConfig}
            slots={vs.slots}
            value={responses[`${vs.surveyVideoSetId}::${el.id}::pref`] ?? ""}
            onChange={(val) => setResponse(`${vs.surveyVideoSetId}::${el.id}::pref`, val)}
          />
        ) : null;
      default:
        return null;
    }
  }

  function renderWithError(el: BuilderElement, vs?: RunnerVideoSet) {
    const errKey = vs ? `${vs.surveyVideoSetId}::${el.id}` : el.id;
    const hasError = validationErrors.has(errKey);
    return (
      <div key={el.id} className={hasError ? "rounded-lg ring-2 ring-red-400 p-3 -mx-3" : ""}>
        {renderElement(el, vs)}
        {hasError && <p className="text-xs text-red-500 mt-2">Required field</p>}
      </div>
    );
  }

  // ─── Early returns ───────────────────────────────────────────────────────────

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

  // ─── Display-layer derivations (after early returns) ────────────────────────

  const totalVideoSets = session.survey.videoSets.length;
  const containerWidth = (videoSetBlock?.config as VideosetBlockConfig | undefined)?.containerWidth ?? "100%";
  const maxWidth = (isCarouselMode || isScrollMode) ? "max-w-6xl" : "max-w-3xl";

  const isLastQuestion = carouselIndex === associated.length - 1;
  const isLastPage = pageIndex + 1 === flatPages.length;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className={`${maxWidth} mx-auto px-4 py-8 space-y-6`}>
        <h1 className="text-2xl font-bold text-zinc-900 text-center">
          {session.survey.template.name}
        </h1>

        <Card className={(isCarouselMode || isScrollMode) ? "overflow-visible" : ""}>
          <CardContent className="py-8 px-8 space-y-8">
            {/* Video set progress indicator */}
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

            {isCarouselMode ? (
              <>
                {/* Non-associated blocks (headings, textboxes, etc.) — full width above split */}
                {nonAssociated.map((el) => renderWithError(el, videoSet))}

                {/* Split layout: video left (45%), questions right (55%) */}
                <div className="grid grid-cols-1 lg:grid-cols-[9fr_11fr] gap-8 items-start">
                  {/* Left panel: composite video, sticky */}
                  <div className="lg:sticky lg:top-6">
                    <div style={{ maxWidth: containerWidth }} className="mx-auto">
                      <video
                        key={videoSet!.compositeUrl}
                        src={videoSet!.compositeUrl}
                        controls
                        className="w-full rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Right panel: one question at a time + carousel nav */}
                  <div className="flex flex-col gap-6">
                    <div className="min-h-[200px]">
                      {renderWithError(associated[carouselIndex], videoSet)}
                    </div>

                    {/* Carousel navigation — sole nav for video pages */}
                    <div className="grid grid-cols-3 items-center border-t border-zinc-100 pt-4">
                      <div>
                        <Button
                          variant="ghost"
                          onClick={handleCarouselBack}
                          disabled={carouselIndex === 0 && pageIndex === 0}
                        >
                          ← Back
                        </Button>
                      </div>
                      <span className="text-xs text-zinc-400 text-center">
                        {associated.length > 1 && `Question ${carouselIndex + 1}/${associated.length}`}
                      </span>
                      <div className="flex justify-end">
                        <Button onClick={handleCarouselNext} disabled={submitting} size="lg">
                          {submitting ? "Saving…" : isLastQuestion && isLastPage ? "Submit" : "Next →"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : isScrollMode ? (
              <>
                {/* Non-associated blocks — full width above split */}
                {nonAssociated.map((el) => renderWithError(el, videoSet))}

                {/* Sentinel — 1px div at top of grid; scrolling past it means video is now stuck */}
                <div ref={videoSentinelRef} className="h-px" />

                {/* Split layout: video left (45%), all questions right (55%) */}
                <div className="grid grid-cols-1 lg:grid-cols-[9fr_11fr] gap-8 items-start">
                  {/* Left panel: composite video, sticky with elevation when stuck */}
                  <div className="lg:sticky lg:top-6">
                    <div
                      style={{ maxWidth: containerWidth }}
                      className={`mx-auto transition-all duration-300 ${
                        isVideoStuck ? "rounded-xl shadow-xl ring-1 ring-black/10" : ""
                      }`}
                    >
                      <video
                        key={videoSet!.compositeUrl}
                        src={videoSet!.compositeUrl}
                        controls
                        className="w-full rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Right panel: all questions visible, scrollable */}
                  <div className="flex flex-col">
                    {associated.map((el, idx) => (
                      <div key={el.id}>
                        {idx > 0 && <div className="border-t border-zinc-100 my-6" />}
                        {renderWithError(el, videoSet)}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* Static pages — unchanged sequential render */
              currentFlat?.page.elements.map((el) => renderWithError(el, videoSet))
            )}
          </CardContent>
        </Card>

        {/* Footer nav — shown on static and scroll pages; carousel has its own inline nav */}
        {!isCarouselMode && (
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
                {submitting ? "Saving…" : isLastPage ? "Submit" : "Next →"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
