FROM mcr.microsoft.com/playwright:v1.55.0-noble
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libgl1 libgl1-mesa-dri \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /runner
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY runner.mjs ./
ENTRYPOINT ["node", "runner.mjs"]
