export type Verdict = "clear" | "caution" | "blocked";
export interface Signal {
  code: string;
  title: string;
  detail: string;
}
export interface LinkAnalysis {
  original: string;
  cleaned: string;
  hostname: string;
  removed: string[];
  originalLength: number;
  cleanedLength: number;
  verdict: Verdict;
  signals: Signal[];
  details: {
    protocol: string;
    port: number;
    parameterCount: number;
    keptParameterCount: number;
    hasFragment: boolean;
  };
}
export interface SavedLink {
  code: string;
  title: string;
  destination: string;
  shortUrl: string;
  removedCount: number;
  verdict: Verdict;
  clicks: number;
  createdAt: string;
  expiresAt: string | null;
  expired: boolean;
}
export interface LinkStats {
  totalLinks: number;
  totalClicks: number;
  removedParameters: number;
  daily: { date: string; clicks: number }[];
}
export interface Library {
  links: SavedLink[];
  stats: LinkStats;
}
