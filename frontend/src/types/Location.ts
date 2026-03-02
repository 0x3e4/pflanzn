export type SpotType = "field" | "public_spot" | "forest" | "meadow" | "other";
export type Visibility = "private" | "shared" | "public";
export type CoordinateSource = "manual" | "photo_exif" | null;

export interface LocationImage {
  id: number;
  image_path: string;
  uploaded_at: string;
  exif_latitude: number | null;
  exif_longitude: number | null;
}

export interface Location {
  id: number;
  name: string;
  item_name: string | null;
  description: string | null;
  spot_type: SpotType;
  visibility: Visibility;
  latitude: number | null;
  longitude: number | null;
  coordinate_source: CoordinateSource;
  created_at: string;
  updated_at: string;
  images: LocationImage[];
}

export interface LocationCreateInput {
  name: string;
  item_name?: string;
  description?: string;
  spot_type: SpotType;
  visibility?: Visibility;
  latitude?: number;
  longitude?: number;
}

export interface LocationUpdateInput {
  name?: string;
  item_name?: string;
  description?: string;
  spot_type?: SpotType;
  visibility?: Visibility;
  latitude?: number | null;
  longitude?: number | null;
}
