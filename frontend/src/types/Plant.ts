import { Tag } from "./Tag";

export interface Plant {
  id: number;
  name: string;
  species: string;
  description: string | null;
  last_watered: Date;
  waterings: PlantWatering[];
  tags: Tag[];
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