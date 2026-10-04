# Imagem de producao do backend.
# Instala yt-dlp, FFmpeg e Deno dentro da imagem, para que o usuario
# final nao precise instalar nada no servidor.
FROM node:22-bookworm-slim

# Ferramentas de extracao.
# - ffmpeg: merges e pos-processamento do yt-dlp
# - deno: runtime JavaScript exigido pelo yt-dlp em algumas URLs do YouTube
# - yt-dlp: extrator de video
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        ca-certificates \
        curl \
        unzip \
    && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh -s -- -y \
    && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
        -o /usr/local/bin/yt-dlp \
    && chmod 755 /usr/local/bin/yt-dlp /usr/local/bin/deno \
    && rm -rf /var/lib/apt/lists/*

# Caminhos usados pelo lib/ytdlp.js. Sao os mesmos em qualquer host,
# porque as ferramentas fazem parte da imagem.
ENV YTDLP_PATH=/usr/local/bin/yt-dlp \
    FFMPEG_PATH=/usr/local/bin \
    DENO_PATH=/usr/local/bin/deno \
    NODE_ENV=production \
    PORT=3001

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3001

# yt-dlp grava cache em $HOME; o usuario node ja tem HOME proprio.
USER node

# Sobe o servidor Express.
CMD ["node", "server.js"]