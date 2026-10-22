from unittest.mock import MagicMock


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
