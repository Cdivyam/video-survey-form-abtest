// ─── Element Config Types ─────────────────────────────────────────────────────

export type HeadingConfig = {
  text: string;
};

export type TextboxConfig = {
  content: string; // Tiptap HTML
};

export type ConsentConfig = {
  text: string;
  required: boolean;
};

export type DemographicsField = {
  id: string;
  label: string;
  type: "text" | "select" | "radio";
  options?: string[];
  required: boolean;
};

export type DemographicsConfig = {
  fields: DemographicsField[];
};

export type SingleChoiceConfig = {
  prompt: string;
  options: string[];
};

export type MultiChoiceConfig = {
  prompt: string;
  options: string[];
};

export type ShortAnswerConfig = {
  prompt: string;
  placeholder?: string;
};

export type LikertConfig = {
  prompt: string;
  scalePoints: number[];
  scaleLabels: Record<string, string>; // sparse: { "1": "Poor", "5": "Excellent" }
};

export type VideosetBlockConfig = {
  name: string; // display name; used as column reference in CSV export
  containerWidth: "33%" | "50%" | "75%" | "100%"; // max-width of video player within the left panel
  layoutMode: "carousel" | "scroll"; // how associated questions are presented on the right panel
};

export type VideoLikertConfig = {
  name: string; // display name; used as column header in CSV export
  prompt: string; // Tiptap HTML
  scalePoints: number[];
  scaleLabels: Record<string, string>;
  videosetBlockRef: string | null; // element id of the videoset_block this rates
};

export type VideoPreferenceConfig = {
  name: string; // display name; used as column header in CSV export
  prompt: string; // Tiptap HTML
  videosetBlockRef: string | null; // element id of the videoset_block this rates
};

export type ElementType =
  | "heading"
  | "textbox"
  | "consent"
  | "demographics"
  | "single_choice"
  | "multi_choice"
  | "short_answer"
  | "likert"
  | "videoset_block"
  | "video_likert"
  | "video_preference";

export type ElementConfig =
  | HeadingConfig
  | TextboxConfig
  | ConsentConfig
  | DemographicsConfig
  | SingleChoiceConfig
  | MultiChoiceConfig
  | ShortAnswerConfig
  | LikertConfig
  | VideosetBlockConfig
  | VideoLikertConfig
  | VideoPreferenceConfig;

// ─── Page Builder Types ───────────────────────────────────────────────────────

export type PageSection = "before" | "dynamic" | "after";

export type BuilderElement = {
  id: string;
  elementType: ElementType;
  config: ElementConfig;
  orderIndex: number;
};

export type BuilderPage = {
  id: string;
  section: PageSection;
  orderIndex: number;
  elements: BuilderElement[];
};

// ─── Slot Map ─────────────────────────────────────────────────────────────────

export type SlotLabel = "A" | "B" | "C" | "D" | "E";
export type SlotMap = Partial<Record<SlotLabel, string>>; // label → videoId

// ─── Survey Runner Types ──────────────────────────────────────────────────────

export type RunnerVideoSet = {
  surveyVideoSetId: string;
  positionIndex: number;
  compositeUrl: string;
  slotMap: SlotMap;
  slots: SlotLabel[]; // ordered list of slot labels present
};

export type RunnerSession = {
  token: string;
  survey: {
    id: string;
    template: {
      name: string;
      pages: BuilderPage[];
      setsPerSurvey: number;
    };
    videoSets: RunnerVideoSet[];
  };
};
