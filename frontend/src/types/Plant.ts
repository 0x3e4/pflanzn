export interface Plant {
  id: number;
  name: string;
  species: string | null;
  description: string | null;
  last_watered: Date;
  waterings: PlantWatering[];
  location_id?: number | null;
  images: PlantImage[];
}

export interface PlantImage {
  id: number;
  image_path: string;
  uploaded_at: string;
}

export interface PlantWatering {
  id: number;
  watered_at: string;
}