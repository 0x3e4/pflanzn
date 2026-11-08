# syntax=docker/dockerfile:1
# docker build -f docs/Dockerfile -t pflanzn-docs .   (from the repo root:
# mkdocs.yml lives there, since MkDocs refuses a config inside its docs_dir;
# the changelog page also includes CHANGELOG.md from the root)
# The documentation site, served by nginx; nothing on it loads from elsewhere.
FROM python:3.14-slim AS build
ENV PYTHONDONTWRITEBYTECODE=1 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1 \
    NO_MKDOCS_2_WARNING=1
RUN pip install --no-cache-dir poetry==2.3.3
WORKDIR /src
# The same lock as a local `poetry run mkdocs serve` in docs/.
COPY docs/pyproject.toml docs/poetry.lock ./docs/
RUN cd docs && poetry install --no-root
COPY mkdocs.yml CHANGELOG.md ./
COPY docs ./docs
# Optional canonical URL, e.g. --build-arg DOCS_SITE_URL=https://docs.example.com/
# Pages link relatively, so the same build works on its own domain and under /docs/.
ARG DOCS_SITE_URL
# --strict fails the build on broken links and pages missing from the nav.
RUN mkdocs build --strict --site-dir /site

FROM nginx:1.31-alpine
# The nginx tag is rebuilt only now and then; Alpine fixes land in between,
# so take them at build time.
RUN apk upgrade --no-cache
COPY docs/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /site /usr/share/nginx/html
EXPOSE 80
