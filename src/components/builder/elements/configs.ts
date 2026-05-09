import type { ElementType, ElementConfig } from "@/lib/types";

export const ELEMENT_LABELS: Record<ElementType, string> = {
  heading: "Heading",
  textbox: "Text Block",
  consent: "Consent",
  demographics: "Demographics",
  single_choice: "Single Choice",
  multi_choice: "Multiple Choice",
  short_answer: "Short Answer",
  likert: "Likert Scale",
  videoset_block: "Video Set Block",
  video_likert: "Video Likert Matrix",
  video_preference: "Video Preference",
};

export const VIDEO_ELEMENTS: ElementType[] = ["videoset_block", "video_likert", "video_preference"];

export const GENERAL_ELEMENTS: ElementType[] = [
  "heading", "textbox", "consent", "demographics",
  "single_choice", "multi_choice", "short_answer", "likert",
];

export function defaultConfig(type: ElementType): ElementConfig {
  switch (type) {
    case "heading": return { text: "Section Heading" };
    case "textbox": return { content: "Enter instructions here..." };
    case "consent": return { text: "I agree to participate in this survey.", required: true };
    case "demographics": return { fields: [
      { id: "age", label: "Age range", type: "select", options: ["18–24","25–34","35–44","45–54","55+"], required: true },
      { id: "gender", label: "Gender", type: "radio", options: ["Male","Female","Non-binary","Prefer not to say"], required: false },
    ]};
    case "single_choice": return { prompt: "Select one option:", options: ["Option A", "Option B", "Option C"] };
    case "multi_choice": return { prompt: "Select all that apply:", options: ["Option A", "Option B", "Option C"] };
    case "short_answer": return { prompt: "Your answer:", placeholder: "Type here…" };
    case "likert": return { prompt: "Rate the following:", scalePoints: [1,2,3,4,5], scaleLabels: { "1": "Strongly Disagree", "5": "Strongly Agree" } };
    case "videoset_block": return {};
    case "video_likert": return { prompt: "Rate each video:", scalePoints: [1,2,3,4,5], scaleLabels: { "1": "Poor", "5": "Excellent" } };
    case "video_preference": return { prompt: "Which video do you prefer most?" };
    default: return {};
  }
}
