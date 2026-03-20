from unittest.mock import MagicMock, PropertyMock, patch


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

        with patch("app.api.routes.plants.get_current_user", return_value=None):
            response = client.get("/api/plants/")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_plants_empty(self, client, mock_db):
        """GET /api/plants/ returns empty list when no plants."""
        mock_db.query.return_value.filter.return_value.all.return_value = []

        with patch("app.api.routes.plants.get_current_user", return_value=None):
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

        with patch("app.api.routes.plants.get_current_user", return_value=None):
            response = client.post("/api/plants/", json={
                "name": "Monstera",
                "species": "Monstera deliciosa"
            })

        assert response.status_code == 200


class TestDeletePlant:
    def test_delete_nonexistent_plant(self, client, mock_db):
        """DELETE /api/plants/999 returns 404."""
        mock_db.query.return_value.filter.return_value.first.return_value = None

        with patch("app.api.routes.plants.get_current_user", return_value=None):
            response = client.delete("/api/plants/999")

        assert response.status_code == 404
