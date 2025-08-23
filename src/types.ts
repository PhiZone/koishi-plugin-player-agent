import { Event } from '@satorijs/protocol';

export interface MediaOptions {
  frameRate: number;
  overrideResolution: number[];
  resultsLoopsToRender: number;
  videoCodec: string;
  videoBitrate: number;
  audioBitrate: number;
}

export interface Preferences {
  backgroundBlur: number;
  backgroundLuminance: number;
  chartFlipping: number;
  chartOffset: number;
  fcApIndicator: boolean;
  hitSoundVolume: number;
  lineThickness: number;
  musicVolume: number;
  noteSize: number;
  simultaneousNoteHint: boolean;
}

export interface Toggles {
  autoplay: boolean;
}

export interface RunConfig {
  mediaOptions: MediaOptions;
  preferences: Preferences;
  toggles: Toggles;
  user: string;
}

export interface RunInput<T> {
  chartFiles: T[];
  respack?: T | undefined;
}

export type Run = {
  input: RunInput<string>;
} & RunConfig;

export type RunResult = {
  _id: string;
  id: string;
  outputFiles: {
    name: string;
    url: string;
  }[];
  status: string;
  dateCreated: string;
  dateCompleted?: string;
} & Run;

export interface Room {
  user: string;
  addr: [string, string, string];
  event: Event;
  payload: { status: string; progress: number; eta: number };
}
