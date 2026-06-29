ARG PYTHON_BASE_IMAGE=docker.m.daocloud.io/library/python:3.11-slim
FROM ${PYTHON_BASE_IMAGE}

WORKDIR /app
COPY requirements.txt .
ARG PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple
RUN pip install --no-cache-dir -i ${PIP_INDEX_URL} -r requirements.txt
COPY app ./app
EXPOSE 8090
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]
