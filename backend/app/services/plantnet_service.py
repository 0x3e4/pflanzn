import requests
import json
from app.core.config import settings

def identify_species(file):
    api_url = f"https://my-api.plantnet.org/v2/identify/all?api-key={settings.PLANTNET_API_KEY}"
    files = {"images": (file.filename, file.file, file.content_type)}
    data = {"organs": ["auto"]}
    
    response = requests.post(api_url, files=files, data=data)
    
    if response.status_code == 200:
        result = response.json()
        if "results" in result and len(result["results"]) > 0:
            species_data = result["results"][0]["species"]
            return {
                "scientific_name": species_data.get("scientificNameWithoutAuthor", "Unknown"),
                "common_names": species_data.get("commonNames", []),
                "genus": species_data.get("genus", {}).get("scientificNameWithoutAuthor", "Unknown"),
                "family": species_data.get("family", {}).get("scientificNameWithoutAuthor", "Unknown"),
                "score": result["results"][0].get("score", 0)
            }
    return {"scientific_name": "Unknown", "common_names": [], "genus": "Unknown", "family": "Unknown", "score": 0}