import type {
  CroppieBindOptions,
  CroppieOptions,
  CroppieResult,
} from "./croppie";

export interface CroppieComponentProps {
  src?: string | null;
  options?: CroppieOptions;
  bind?: Omit<CroppieBindOptions, "url">;
}

export interface CroppieSlotProps {
  ready: boolean;
  data: CroppieResult | null;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  normalizedZoom: number;
  setZoom: (value: number) => void;
  setNormalizedZoom: (value: number) => void;
}
