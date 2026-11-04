"""Care helper: Pl@ntNet reference lookup, the shared prompt context, and Claude's request."""
import json
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.core.config import settings
from app.services import plant_reference
from app.services.plant_reference import PlantReference, extract_facts, species_url

FULL = "Ficus elastica Roxb. ex Hornem."
PAGE = """<html><body><nav>Menu</nav><main>
<h3>Names</h3><span>Common names</span><a>Rubberplant</a><span>,</span><a>Rubber tree</a><span>,</span>
<a>India rubber fig</a><span>+8 more</span><a>All names &amp; votes</a>
<h3>Traits</h3><span>Growth form</span><span>Tree</span>
<h2>Diseases and pests</h2><span>Alternaria sp.</span>
<h5>At a glance</h5><span>Growth form</span><script>var x = "Common names";</script>
<a href="https://en.wikipedia.org/wiki/Ficus_elastica">Wikipedia</a>
</main></body></html>"""


class FakeRedis:
    def __init__(self):
        self.store = {}

    def get(self, key):
        return self.store.get(key)

    def setex(self, key, ttl, value):
        self.store[key] = value


@pytest.fixture
def fake_redis():
    fake = FakeRedis()
    with patch("app.services.plant_reference.redis_client", fake):
        yield fake


def _transport(pages, gbif=None, calls=None):
    """httpx transport serving Pl@ntNet pages by full name and one GBIF match."""
    def handler(request):
        if calls is not None:
            calls.append(str(request.url))
        if request.url.host == "api.gbif.org":
            return httpx.Response(200, json=gbif or {"matchType": "NONE"})
        for name, body in pages.items():
            if request.url.path == f"/k-world-flora/species/{name}/data":
                return httpx.Response(200, text=body)
        return httpx.Response(404)
    real_client = httpx.Client
    return patch("app.services.plant_reference.httpx.Client",
                 lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs))


def _db(identified_name=None):
    db = MagicMock()
    chain = db.query.return_value.filter.return_value.order_by.return_value
    chain.first.return_value = (identified_name,) if identified_name else None
    return db


class TestPlantNetPage:
    def test_facts_and_wikipedia(self):
        facts, wikipedia = extract_facts(PAGE)
        assert facts.splitlines() == [
            "Common names", "Rubberplant, Rubber tree, India rubber fig", "Traits", "Growth form", "Tree",
            "Diseases and pests", "Alternaria sp.",
        ]
        assert wikipedia == "https://en.wikipedia.org/wiki/Ficus_elastica"

    def test_page_without_the_expected_sections(self):
        assert extract_facts("<main><p>Something else</p></main>") == (None, None)

    def test_url_encodes_name_and_follows_language(self):
        assert species_url(FULL, "en") == (
            "https://identify.plantnet.org/k-world-flora/species/Ficus%20elastica%20Roxb.%20ex%20Hornem./data")
        assert species_url(FULL, "de").startswith("https://identify.plantnet.org/de/k-world-flora/")
        assert species_url(FULL, "../evil").startswith("https://identify.plantnet.org/k-world-flora/")
        assert "%2F" in species_url("a/../b", "en")


class TestLookup:
    def test_prefers_the_name_saved_with_an_identification(self, fake_redis):
        calls = []
        with _transport({FULL: PAGE}, calls=calls), patch.object(settings, "PLANTNET_LANGUAGE", "de"):
            reference = plant_reference.lookup(_db(FULL), "Ficus elastica")
        assert reference.name == FULL
        assert reference.url.startswith("https://identify.plantnet.org/de/")  # link in the user's language
        assert reference.facts.startswith("Common names")
        assert not any("/de/" in url for url in calls)  # facts come from the English page

    def test_falls_back_to_gbif(self, fake_redis):
        gbif = {"matchType": "EXACT", "rank": "SPECIES", "scientificName": "Monstera deliciosa Liebm."}
        with _transport({"Monstera deliciosa Liebm.": PAGE}, gbif=gbif):
            assert plant_reference.lookup(_db(), "Monstera deliciosa").name == "Monstera deliciosa Liebm."

    def test_gbif_name_that_plantnet_doesnt_know(self, fake_redis):
        gbif = {"matchType": "EXACT", "rank": "SPECIES", "scientificName": "Ficus elastica Roxb."}
        with _transport({}, gbif=gbif):
            assert plant_reference.lookup(_db(), "Ficus elastica") is None
        assert fake_redis.store == {"plantnet:ref:en:ficus elastica": ""}  # miss cached briefly

    def test_cached_result_skips_the_network(self, fake_redis):
        fake_redis.store["plantnet:ref:en:ficus elastica"] = json.dumps(
            {"name": FULL, "url": "u", "facts": None, "wikipedia_url": None})
        with patch("app.services.plant_reference.httpx.Client", side_effect=AssertionError("no network")):
            assert plant_reference.lookup(_db(), "Ficus elastica").name == FULL
        fake_redis.store["plantnet:ref:en:gummibaum"] = ""
        with patch("app.services.plant_reference.httpx.Client", side_effect=AssertionError("no network")):
            assert plant_reference.lookup(_db(), "Gummibaum") is None

    def test_network_errors_are_not_cached(self, fake_redis):
        def boom(request):
            raise httpx.ConnectError("down")
        real_client = httpx.Client
        with patch("app.services.plant_reference.httpx.Client",
                   lambda **kw: real_client(transport=httpx.MockTransport(boom), **kw)):
            assert plant_reference.lookup(_db(), "Ficus elastica") is None
        assert fake_redis.store == {}

    @pytest.mark.parametrize("species", [None, "", "Unknown", "x" * 201])
    def test_nothing_to_look_up(self, species):
        with patch("app.services.plant_reference.httpx.Client", side_effect=AssertionError("no network")):
            assert plant_reference.lookup(_db(), species) is None


def _plant(tmp_path, image_count=4):
    images = []
    for i in range(image_count):
        path = tmp_path / f"img{i}_medium.webp"
        path.write_bytes(f"image-{i}".encode())
        images.append(SimpleNamespace(image_path=f"img{i}", uploaded_at=datetime(2026, 10, 1 + i)))
    return SimpleNamespace(
        id=1, name="Gummi", species="Ficus elastica", is_outdoor=False, reaches_rain=False,
        watering_interval_days=7, images=images,
        waterings=[SimpleNamespace(watered_at=datetime(2026, 10, 20), rainfall_mm=None),
                   SimpleNamespace(watered_at=datetime(2026, 10, 27), rainfall_mm=None)],
        fertilizings=[SimpleNamespace(fertilized_at=datetime(2026, 9, 1))],
        notes=[SimpleNamespace(created_at=datetime(2026, 10, 15), note_text="Moved next to the window")],
        care_advice=[SimpleNamespace(generated_at=datetime(2026, 9, 10), advice_text="Water less often.")],
    )


@pytest.fixture
def plant_db(tmp_path):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = _plant(tmp_path)
    reference = PlantReference(FULL, "https://identify.plantnet.org/x", "Growth form\nTree",
                               "https://en.wikipedia.org/wiki/Ficus_elastica")
    with patch.object(settings, "UPLOAD_FOLDER", str(tmp_path)), \
         patch("app.services.care_context.plant_reference.lookup", return_value=reference):
        yield db


class TestCareContext:
    def test_prompt_has_the_plant_history_and_reference(self, plant_db):
        from app.services.care_context import build_care_context

        context = build_care_context(plant_db, 1, "Die Pflanze verliert Blätter")
        prompt = context.prompt
        for expected in ("Gummi", "Ficus elastica", "every 7 days", "2026-10-27, 2026-10-20", "2026-09-01",
                         "Moved next to the window", "Water less often.", "https://identify.plantnet.org/x",
                         "https://en.wikipedia.org/wiki/Ficus_elastica", "<plantnet>\nGrowth form\nTree\n</plantnet>",
                         "Die Pflanze verliert Blätter", "2026-10-04, 2026-10-03, 2026-10-02"):
            assert expected in prompt
        assert [image.taken for image in context.images] == ["2026-10-04", "2026-10-03", "2026-10-02"]

    def test_text_only_providers_get_no_photos(self, plant_db):
        from app.services.care_context import build_care_context

        context = build_care_context(plant_db, 1, max_images=0)
        assert context.images == []
        assert "You can't see photos" in context.prompt

    def test_plant_without_photos_still_gets_advice(self, plant_db, tmp_path):
        from app.services.care_context import build_care_context

        plant_db.query.return_value.filter.return_value.first.return_value = _plant(tmp_path, image_count=0)
        assert "No photo is available." in build_care_context(plant_db, 1).prompt


def _block(type_, **fields):
    return SimpleNamespace(type=type_, **fields)


def _response(*blocks, stop_reason="end_turn"):
    return SimpleNamespace(content=list(blocks), stop_reason=stop_reason)


class TestClaudeCareHelper:
    @pytest.fixture
    def create(self, plant_db):
        with patch("app.services.anthropic.anthropic_client") as client, \
             patch.object(settings, "CLAUDE_MODEL_NAME", "claude-opus-5-5"), \
             patch.object(settings, "CARE_WEB_SEARCH", True):
            yield client.messages.create

    def test_request_shape(self, create, plant_db):
        from app.services.anthropic import ClaudeClient

        create.return_value = _response(_block("thinking", thinking=""), _block("text", text="Diagnose: ok"))
        assert ClaudeClient().care_helper(plant_db, 1) == "Diagnose: ok"

        request = create.call_args.kwargs
        assert "temperature" not in request
        assert request["max_tokens"] == 16000
        content = request["messages"][0]["content"]
        assert [block["type"] for block in content] == ["image", "image", "image", "text"]
        assert [tool["type"] for tool in request["tools"]] == ["web_search_20260209", "web_fetch_20260209"]

    def test_older_models_get_the_basic_web_tools(self, create, plant_db):
        from app.services.anthropic import ClaudeClient

        create.return_value = _response(_block("text", text="ok"))
        with patch.object(settings, "CLAUDE_MODEL_NAME", "claude-sonnet-4-5"):
            ClaudeClient().care_helper(plant_db, 1)
        assert [tool["type"] for tool in create.call_args.kwargs["tools"]] == [
            "web_search_20250305", "web_fetch_20250910"]

    def test_web_search_off(self, create, plant_db):
        from app.services.anthropic import ClaudeClient

        create.return_value = _response(_block("text", text="ok"))
        with patch.object(settings, "CARE_WEB_SEARCH", False):
            ClaudeClient().care_helper(plant_db, 1)
        assert "tools" not in create.call_args.kwargs

    def test_answer_is_the_text_after_the_last_search(self, create, plant_db):
        from app.services.anthropic import ClaudeClient

        create.return_value = _response(
            _block("text", text="Let me look that up."), _block("server_tool_use"),
            _block("web_search_tool_result"), _block("text", text="Diagnose: "), _block("text", text="zu nass."))
        assert ClaudeClient().care_helper(plant_db, 1) == "Diagnose: zu nass."

    def test_paused_turn_is_resumed(self, create, plant_db):
        from app.services.anthropic import ClaudeClient

        paused = _response(_block("server_tool_use"), stop_reason="pause_turn")
        create.side_effect = [paused, _response(_block("text", text="done"))]
        assert ClaudeClient().care_helper(plant_db, 1) == "done"
        messages = create.call_args.kwargs["messages"]
        assert [m["role"] for m in messages] == ["user", "assistant"]
        assert messages[1]["content"] == paused.content

    def test_rejected_web_tools_fall_back_to_plain_request(self, create, plant_db):
        from anthropic import BadRequestError

        from app.services.anthropic import ClaudeClient

        error = BadRequestError("web search is disabled", response=httpx.Response(
            400, request=httpx.Request("POST", "https://api.anthropic.com/v1/messages")), body=None)
        create.side_effect = [error, _response(_block("text", text="ok"))]
        assert ClaudeClient().care_helper(plant_db, 1) == "ok"
        assert "tools" not in create.call_args.kwargs

    def test_empty_answer_is_an_error(self, create, plant_db):
        from app.services.anthropic import ClaudeClient

        create.return_value = _response(stop_reason="refusal")
        with pytest.raises(RuntimeError, match="refusal"):
            ClaudeClient().care_helper(plant_db, 1)


class TestPlantNetEndpoint:
    def test_returns_the_link(self, client, mock_db):
        mock_db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(species="Ficus elastica")
        reference = PlantReference(FULL, "https://identify.plantnet.org/x")
        with patch("app.core.security.AUTH_MODE", "no"), \
             patch("app.api.routes.plants.plant_reference.lookup", return_value=reference):
            response = client.get("/api/plants/1/plantnet")
        assert response.json() == {"name": FULL, "url": "https://identify.plantnet.org/x"}

    def test_no_match(self, client, mock_db):
        mock_db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(species="Gummibaum")
        with patch("app.core.security.AUTH_MODE", "no"), \
             patch("app.api.routes.plants.plant_reference.lookup", return_value=None):
            assert client.get("/api/plants/1/plantnet").json() == {"name": None, "url": None}
