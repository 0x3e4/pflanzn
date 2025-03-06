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

const API_BASE = "/api/plants";

// Create a new plant
export async function createPlant(name: string, species: string, locationId?: number) {
  const body: any = { name };
  if (species) body.species = species;
  if (locationId) body.location_id = locationId;

  const response = await fetch(`${API_BASE}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, species, location_id: locationId }),
  });

  if (!response.ok) throw new Error("Failed to create plant");
  return response.json();
}

// Upload an image for a plant
export async function uploadPlantImage(plantId: number, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/${plantId}/upload_image`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Failed to upload image");
  return response.json();
}

// Identify plant species using Pl@ntNet API
export async function identifyPlant(plantId: number) {
  const response = await fetch(`/api/plants/${plantId}/identify`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to identify plant species");
  }

  return response.json();
}

// Update plant
export async function updatePlant(plantId: number, data: { name?: string | null; species?: string | null; description?: string | null; last_watered?: Date | null; }) {
  const response = await fetch(`/api/plants/${plantId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to update plant");
  }

  return response.json();
}

// Fetch single plant
export async function fetchSinglePlant(plantId: number): Promise<Plant> {
  const response = await fetch(`/api/plants/${plantId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch plant with ID ${plantId}`);
  }

  return response.json();
}

// Delete plant
export async function deletePlant(plantId: number): Promise<void> {
  const response = await fetch(`/api/plants/${plantId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete plant with ID ${plantId}`);
  }
}

// Delete plant image
export async function deletePlantImage(plantId: number, imageId: number) {
  const response = await fetch(`/api/plants/${plantId}/images/${imageId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete image (ID: ${imageId})`);
  }

  return response.json();
}

// Generate plant description via Hugging Face
export async function generatePlantDescription(plantId: number): Promise<{ description: string }> {
  const response = await fetch(`${API_BASE}/${plantId}/generate_description`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to generate description for plant ID ${plantId}`);
  }

  return response.json();
}

// Water plant
export const waterPlant = async (plantId: number, data: { watered_at?: string; notes?: string }) => {
  const response = await fetch(`${API_BASE}/${plantId}/water`, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
  });

  if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(errorBody.detail || 'Failed to water plant');
  }

  return await response.json();
};