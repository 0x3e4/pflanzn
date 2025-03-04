export interface PlantImage {
  id: number;
  image_path: string;
  uploaded_at: string;
}

export interface Plant {
  id: number;
  name: string;
  species: string | null;
  lastWatered: string;
  location_id?: number | null;
  images: PlantImage[];
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

export async function updatePlant(plantId: number, data: { name?: string; species?: string }) {
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

export async function deletePlant(plantId: number): Promise<void> {
  const response = await fetch(`/api/plants/${plantId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete plant with ID ${plantId}`);
  }
}
