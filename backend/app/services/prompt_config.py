"""
Shared prompt configuration for all LLM providers.
This prevents duplication and ensures consistent AI behavior across different clients.
"""
from typing import Optional

from app.core.config import settings


class PromptConfig:
    """Centralized prompt templates and configurations for LLM operations."""

    # Temperature settings for different use cases
    TEMPERATURE_CREATIVE = 0.7  # For descriptions and general content
    TEMPERATURE_PRECISE = 0.3   # For care advice and diagnostic responses

    # Max token settings
    MAX_TOKENS_DESCRIPTION = 800  # Reduced from 1000 for more concise descriptions
    MAX_TOKENS_CARE_ADVICE = 600  # For focused, actionable care advice
    MAX_TOKENS_LOCATION_DESCRIPTION = 900  # Location-focused seasonal crop guidance

    @staticmethod
    def get_species_description_prompt(common_name: str, species_name: str) -> str:
        """
        Generate prompt for plant species description.
        Uses creative temperature for engaging botanical descriptions.
        """
        return (
            f"Write a concise botanical description for '{species_name}' "
            f"(commonly known as '{common_name}'). "
            f"Include: natural habitat, distinctive appearance features, essential care requirements, "
            f"and one interesting fact. "
            f"Write in '{settings.LLM_LANGUAGE}' in a professional yet accessible style. "
            f"Avoid markdown formatting, titles, or bold text. Maximum 1500 characters."
        )

    @staticmethod
    def get_care_helper_prompt(
        species: str,
        watering_dates: list,
        user_message: str = None
    ) -> str:
        """
        Generate prompt for care advice based on plant condition and history.
        Uses precise temperature for accurate, actionable recommendations.

        Args:
            species: Plant species name
            watering_dates: List of recent watering dates
            user_message: Optional user observation (e.g., "losing leaves")
        """
        base_prompt = (
            f"You are an expert botanist analyzing a '{species}' plant. "
            f"Recent watering dates: {', '.join(watering_dates) if watering_dates else 'none recorded'}.\n\n"
        )

        if user_message:
            base_prompt += f"Owner's observation: {user_message}\n\n"

        base_prompt += (
            f"Based on the image and watering history, provide a focused analysis in '{settings.LLM_LANGUAGE}':\n"
            f"1. **Health Assessment**: Describe what you observe in the image\n"
            f"2. **Watering**: Is the frequency appropriate? Any signs of over/under-watering?\n"
            f"3. **Specific Issues**: Address the owner's concern with actionable solutions\n"
            f"4. **Next Steps**: Provide 2-3 concrete care recommendations\n\n"
            f"Be concise, specific, and actionable. Avoid generic advice. "
            f"Maximum 800 characters. No markdown formatting or titles."
        )

        return base_prompt

    @staticmethod
    def get_location_description_prompt(
        location_name: str,
        item_name: str,
        spot_type: str,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        existing_description: Optional[str] = None,
    ) -> str:
        """
        Generate prompt for a location-focused seasonal crop/herb description.
        """
        coordinates = "unknown"
        if latitude is not None and longitude is not None:
            coordinates = f"{latitude:.6f}, {longitude:.6f}"

        existing_text = existing_description.strip() if existing_description else "none"
        item_text = item_name.strip() if item_name else "mixed crop/herb area"

        return (
            f"Write a practical location description for '{location_name}'. "
            f"Focus on '{item_text}' in a '{spot_type}' area at coordinates: {coordinates}. "
            f"Current saved description: {existing_text}. "
            f"Write in '{settings.LLM_LANGUAGE}' and keep it concise, clear, and actionable. "
            f"Include: ideal sowing/planting window, growth phase notes, harvest season/timing, "
            f"harvest readiness indicators, and short post-harvest/storage tips. "
            f"If climate cannot be inferred from coordinates, state assumptions briefly. "
            f"Avoid markdown, headings, lists, or bold text. Maximum 1800 characters."
        )

    @staticmethod
    def get_system_message() -> str:
        """System message for models that support it."""
        return (
            "You are a professional botanist and plant care expert. "
            "Provide accurate, practical, and species-specific advice. "
            "Be concise and focus on actionable recommendations."
        )
