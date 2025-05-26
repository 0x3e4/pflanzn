export interface PlantIdentification {
  id: number;
  session_id: string;
  user_id?: number;
  image_path: string;
  scientific_name: string;
  common_name: string;
  confidence_score: string;
  result_images: string[];
  identified_at: string;
  is_primary: boolean;
}