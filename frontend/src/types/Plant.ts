import { Tag } from "./Tag";

export interface Plant {
    id: number;
    name: string;
    species: string;
    description: string | null;
    last_watered: Date;
    last_fertilized: Date;
    waterings: PlantWatering[];
    fertilizings: PlantFertilizing[];
    care_advice: PlantCareAdvice[];
    notes: PlantNote[];
    tags: Tag[];
    images: PlantImage[];
    is_archived: boolean;
    archive_reason: string;
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

export interface PlantFertilizing {
    id: number;
    fertilized_at: string;
}

export interface PlantCareAdvice {
    id: number;
    advice_text: string;
    generated_at: string;
}

export interface PlantNote {
    id: number;
    note_text: string;
    created_at: string;
}

export interface PlantActivity {
    id: string;
    plant_id: number;
    plant_name: string;
    activity_type: "watering" | "fertilizing" | "care_advice" | "image_upload" | "note";
    activity_data: any;
    timestamp: string;
}
