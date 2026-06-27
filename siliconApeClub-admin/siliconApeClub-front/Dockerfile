ARG PYTHON_BASE_IMAGE=docker.m.daocloud.io/library/python:3.11-slim

FROM ${PYTHON_BASE_IMAGE}

WORKDIR /app
COPY dist /app/static/m/silicon-ape-club-admin
COPY serve_static.py /app/serve_static.py
EXPOSE 80

CMD ["python", "/app/serve_static.py"]
