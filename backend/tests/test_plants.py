from unittest.mock import MagicMock, patch


def _make_plant(id=1, name="Monstera", species="Monstera deliciosa", is_archived=False):
    plant = MagicMock()
    plant.id = id
    plant.name = name
    plant.species = species
    plant.description = "A tropical plant"
    plant.is_archived = is_archived
    plant.archive_reason = None
    plant.tags = []
    plant.images = []
    plant.waterings = []
    plant.care_advice = []
    plant.notes = []
    return plant


class TestGetPlants:
    def test_get_plants_returns_list(self, client, mock_db):
        """GET /api/plants/ returns a list of plants."""
        mock_plant = _make_plant()
        mock_db.query.return_value.filter.return_value.all.return_value = [mock_plant]

        response = client.get("/api/plants/")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_plants_empty(self, client, mock_db):
        """GET /api/plants/ returns empty list when no plants."""
        mock_db.query.return_value.filter.return_value.all.return_value = []

        response = client.get("/api/plants/")

        assert response.status_code == 200
        assert response.json() == []


class TestCreatePlant:
    def test_create_plant(self, client, mock_db):
        """POST /api/plants/ creates a new plant."""
        mock_plant = _make_plant()
        mock_db.add.return_value = None
        mock_db.commit.return_value = None
        mock_db.refresh.side_effect = lambda p: setattr(p, "id", 1)

        response = client.post("/api/plants/", json={
            "name": "Monstera",
            "species": "Monstera deliciosa"
        })

        assert response.status_code == 200


class TestDeletePlant:
    def test_delete_nonexistent_plant(self, client, mock_db):
        """DELETE /api/plants/999 returns 404."""
        mock_db.query.return_value.filter.return_value.first.return_value = None

        response = client.delete("/api/plants/999")

        assert response.status_code == 404


class TestWateringInterval:
    def test_create_plant_with_interval(self, client, mock_db):
        """POST /api/plants/ stores the watering interval."""
        added = []
        mock_db.add.side_effect = added.append
        mock_db.refresh.side_effect = lambda p: setattr(p, "id", 1)

        response = client.post("/api/plants/", json={"name": "Fern", "watering_interval_days": 3})

        assert response.status_code == 200
        assert added[0].watering_interval_days == 3
        assert response.json()["watering_interval_days"] == 3

    def test_update_plant_rejects_invalid_interval(self, client, mock_db):
        """PUT /api/plants/{id} rejects intervals outside 1-365 days."""
        mock_db.query.return_value.filter.return_value.first.return_value = _make_plant()

        assert client.put("/api/plants/1", json={"watering_interval_days": 0}).status_code == 422
        assert client.put("/api/plants/1", json={"watering_interval_days": 366}).status_code == 422

    def test_update_keeps_last_watered_in_the_response(self, client, mock_db):
        """Regression: PUT returned last_watered=None, so the page showed "Water today"
        after any edit until it was reloaded."""
        from datetime import datetime

        from app.models import Plant, PlantWatering

        plant = Plant(id=1, name="Curio", species="Curio citriformis", watering_interval_days=7)
        watering = PlantWatering(id=1, plant_id=1, watered_at=datetime(2026, 11, 1, 9, 0))
        plant.waterings = [watering]

        def query(model, *args):
            chain = MagicMock()
            chain.filter.return_value = chain
            chain.order_by.return_value = chain
            chain.first.return_value = {Plant: plant, PlantWatering: watering}.get(model)
            return chain
        mock_db.query.side_effect = query

        response = client.put("/api/plants/1", json={"watering_interval_days": 24})

        assert response.status_code == 200
        body = response.json()
        assert body["watering_interval_days"] == 24
        assert body["last_watered"].startswith("2026-11-01")


class TestWateringDue:
    def test_no_interval_is_never_due(self):
        from app.services.mcp_tools import _watering_due

        assert _watering_due(None, None) == (None, False)

    def test_never_watered_is_due(self):
        from app.services.mcp_tools import _watering_due

        assert _watering_due(3, None) == (0, True)

    def test_counts_local_calendar_days(self):
        from datetime import date, datetime

        from app.services.mcp_tools import _watering_due

        watered = datetime(2026, 5, 1, 10, 0)  # naive UTC
        assert _watering_due(3, watered, today=date(2026, 5, 2)) == (2, False)
        assert _watering_due(3, watered, today=date(2026, 5, 4)) == (0, True)
        assert _watering_due(3, watered, today=date(2026, 5, 6)) == (-2, True)


class TestSpeciesDescription:
    """GET /api/plants/{id}/species_description offers another plant's text for the same species."""

    def _setup(self, mock_db, plant, source):
        chain = mock_db.query.return_value.filter.return_value
        chain.first.return_value = plant
        chain.order_by.return_value.first.return_value = source

    def test_offers_the_description_of_the_same_species(self, client, mock_db):
        plant = _make_plant(id=2, name="Gummi 2", species="Ficus elastica")
        source = _make_plant(id=1, name="Gummibaum", species="Ficus elastica")
        source.description = "Der Gummibaum stammt aus Südostasien."
        self._setup(mock_db, plant, source)

        with patch("app.core.security.AUTH_MODE", "no"):
            body = client.get("/api/plants/2/species_description").json()

        assert body == {"description": "Der Gummibaum stammt aus Südostasien.", "source_plant_id": 1,
                        "source_plant_name": "Gummibaum"}

    def test_nothing_to_offer(self, client, mock_db):
        self._setup(mock_db, _make_plant(id=2, species="Ficus elastica"), None)
        with patch("app.core.security.AUTH_MODE", "no"):
            assert client.get("/api/plants/2/species_description").json()["description"] is None

    def test_unknown_species_is_not_looked_up(self, client, mock_db):
        self._setup(mock_db, _make_plant(id=2, species="Unknown"), _make_plant(id=1))
        with patch("app.core.security.AUTH_MODE", "no"):
            assert client.get("/api/plants/2/species_description").json()["description"] is None


class TestTagEndpointsReturnTheWholePlant:
    def test_set_tags_keeps_last_watered_and_flags(self, client, mock_db):
        """Regression: the tag endpoints built a partial response (no care advice, outdoor
        flags or archive state), so changing tags blanked those parts until a reload."""
        from datetime import datetime

        from app.models import Plant, PlantWatering

        plant = Plant(id=1, name="Curio", species="Curio citriformis", watering_interval_days=7,
                      is_outdoor=True, is_archived=False)
        watering = PlantWatering(id=1, plant_id=1, watered_at=datetime(2026, 11, 1, 9, 0))
        plant.waterings = [watering]

        def query(model, *args):
            chain = MagicMock()
            chain.filter.return_value = chain
            chain.order_by.return_value = chain
            chain.all.return_value = []
            chain.first.return_value = {Plant: plant, PlantWatering: watering}.get(model)
            return chain
        mock_db.query.side_effect = query

        with patch("app.core.security.AUTH_MODE", "no"):
            response = client.put("/api/plants/1/tags", json={"tag_ids": []})

        assert response.status_code == 200
        body = response.json()
        assert body["last_watered"].startswith("2026-11-01")
        assert body["is_outdoor"] is True
        assert "care_advice" in body
