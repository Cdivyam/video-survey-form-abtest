// ─── Element Config Types ─────────────────────────────────────────────────────

export type HeadingConfig = {
  text: string;
};

export type TextboxConfig = {
  content: string; // markdown
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

export type VideosetBlockConfig = Record<string, never>;

export type VideoLikertConfig = {
  prompt: string;
  scalePoints: number[];
  scaleLabels: Record<string, string>;
};

export type VideoPreferenceConfig = {
  prompt: string;
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
      pages: BuilderPage[];
      setsPerSurvey: number;
    };
    videoSets: RunnerVideoSet[];
  };
};
