# Download Agregador

Plataforma full-stack para download de mídias de múltiplas plataformas (Instagram, TikTok, YouTube).

## Estrutura

```
download-aggregator/
├── backend/
│   ├── server.js               # Entry point do Express
│   ├── package.json
│   ├── .env.example            # Modelo de variaveis de ambiente
│   ├── lib/
│   │   ├── env.js              # Carrega o .env (nativo do Node, sem dependencia)
│   │   ├── ytdlp.js            # Execucao segura do yt-dlp (execFile, sem shell)
│   │   ├── media.js            # Normaliza a saida do yt-dlp no contrato de media
│   │   └── urlShape.js         # Rejeita URL de perfil/canal antes do processo
│   ├── routes/
│   │   └── api.js              # Rotas /api/download e /api/platforms
│   ├── services/
│   │   └── downloadService.js  # Logica de validacao, cache e despacho
│   └── providers/
│       ├── DownloadProvider.js # Interface abstrata comum
│       ├── ProviderRegistry.js # Registry de provedores
│       ├── InstagramProvider.js# Chama a API do Instagram
│       ├── TikTokProvider.js   # Extracao local via yt-dlp
│       └── YouTubeProvider.js  # Extracao local via yt-dlp
└── frontend/
    ├── index.html
    ├── app.js
    └── styles.css
```

## Arquitetura de Provedores

Cada provedor implementa a interface `DownloadProvider`:

- `name` — identificador único
- `supports(url)` — verifica se a URL é suportada
- `fetchMedia(url, options)` — extrai as mídias, devolve `{ ok, platform, media, error }`

Para adicionar uma nova plataforma (ex: Vimeo), basta:

1. Criar `VimeoProvider.js` extendendo `DownloadProvider`.
2. Importar e registrar no `ProviderRegistry.js`.

Nenhum outro arquivo precisa ser modificado.

## Como cada plataforma é extraída

| Plataforma | Mecanismo | Ferramenta |
|------------|-----------|-----------|
| Instagram | Chama a API REST do Instagram | API externa (`INSTAGRAM_API_URL`) |
| TikTok | Executa o yt-dlp localmente | yt-dlp + FFmpeg + Deno |
| YouTube | Executa o yt-dlp localmente | yt-dlp + FFmpeg + Deno |

Nenhuma API de terceiros é usada para TikTok ou YouTube.

O yt-dlp roda em modo de simulação (`--dump-single-json` + `--simulate`): ele devolve
os endereços diretos das mídias, sem baixar arquivos para o servidor.

## Formato de `media`

Todos os provedores devolvem o mesmo formato, consumido pelo frontend:

```json
{
  "index": 1,
  "type": "video",
  "url": "https://...",
  "width": 1920,
  "height": 1080,
  "bitrate": 1500,
  "duration": 635
}
```

- `type`: `video`, `image` ou `audio`.
- `bitrate` e `duration`: opcionais (só aparecem quando o yt-dlp informa).
- Sem faixa de áudio e vídeo juntas (padrão do YouTube), `media` traz dois itens:
  o vídeo com a melhor resolução e o áudio com o melhor bitrate.

## Configuração

Copie o modelo e ajuste os caminhos da sua máquina:

```bash
cd backend
cp .env.example .env
```

| Variável | Obrigatória | Descrição |
|----------|--------------|-----------|
| `PORT` | Não | Porta do servidor (padrão `3001`) |
| `INSTAGRAM_API_URL` | Não | URL base da API do Instagram |
| `YTDLP_PATH` | Sim para TikTok/YouTube | Caminho do executável do yt-dlp. Vazio = procurar no PATH |
| `FFMPEG_PATH` | Não | Caminho do ffmpeg, usado pelo yt-dlp |
| `DENO_PATH` | Não | Caminho do Deno, runtime JS do yt-dlp (necessário em algumas extrações do YouTube) |
| `YTDLP_TIMEOUT_MS` | Não | Tempo limite da extração (padrão `120000`) |
| `YTDLP_EXTRA_ARGS` | Não | Argumentos extras do yt-dlp, separados por espaço |
| `ENV_FILE` | Não | Caminho alternativo do arquivo de ambiente |

### Windows

```env
YTDLP_PATH=C:\caminho\yt-dlp.exe
FFMPEG_PATH=C:\caminho\ffmpeg\bin
DENO_PATH=C:\caminho\deno.exe
```

### Linux/macOS

```env
YTDLP_PATH=/usr/local/bin/yt-dlp
FFMPEG_PATH=/usr/bin
DENO_PATH=/usr/local/bin/deno
```

## Instalação e Execução

### Desenvolvimento local

```bash
cd backend
npm install
npm run dev
```

A API fica em `http://localhost:3001`.

### Frontend

Abra `frontend/index.html` no navegador, ou sirva com um static server:

```bash
cd frontend
python -m http.server 8080
```

Acesse `http://localhost:8080`.

## Endpoints

### `GET /api/download?url=...`

Extrai mídias de uma URL. O provedor é selecionado automaticamente pelo domínio.

```bash
curl "http://localhost:3001/api/download?url=https://www.youtube.com/watch?v=aqz-KE-bpKQ"
```

### `GET /api/platforms`

Lista os provedores disponíveis.

### `GET /health`

Verifica se o servidor está no ar.

## Exemplo de Resposta

```json
{
  "ok": true,
  "platform": "youtube",
  "title": "Big Buck Bunny 60fps 4K",
  "method": "ytdlp",
  "media": [
    { "index": 1, "type": "video", "url": "https://...", "width": 3840, "height": 2160, "duration": 635 },
    { "index": 2, "type": "audio", "url": "https://...", "width": 0, "height": 0, "duration": 635 }
  ]
}
```

## Segurança

- O yt-dlp é executado com `execFile` e `shell: false`; a URL é sempre um argumento
  separado, nunca concatenada em um comando de shell.
- A URL é validada antes do processo: apenas `http`/`https` são aceitos.
- O domínio já é validado por `supports()` de cada provedor.
- Timeout e `AbortSignal` derrubam a árvore de processos (yt-dlp + Deno + FFmpeg),
  evitando processos órfãos.
- Mensagens de erro do yt-dlp são convertidas em texto amigável; caminhos locais,
  comandos completos e stack traces nunca são expostos.

## Limitações conhecidas

- O YouTube entrega vídeo e áudio em faixas separadas. O arquivo único exigiria mesclar
  com FFmpeg em disco, o que não é feito para não criar armazenamento no servidor.
- A primeira extração do YouTube pode demorar (solver de desafio JS). Por isso o timeout
  padrão é de 120s.
- URLs de perfil (`tiktok.com/@user`, `youtube.com/@canal`) são rejeitadas com HTTP 400.
- Conteúdo privado, com restrição de idade ou bloqueado por região não é acessível.
- A API do Instagram (provedor externo) é um scraper e pode quebrar com mudanças no site.

## Próximos Passos

- Adicionar rate limiting e autenticação.
- Adicionar cache distribuído (Redis).

---

# Deploy (Produção)

O usuário final acessa o site, cola uma URL e baixa. Ele **não** instala Node.js,
yt-dlp, FFmpeg nem Deno: essas ferramentas já vêm na imagem Docker do backend.

O frontend e o backend continuam separados. Há dois caminhos de publicação.

## Caminho A — Docker Compose (recomendado)

Frontend e backend no mesmo domínio, com o nginx encaminhando `/api` para o backend.
Sem CORS, um único domínio, um único deploy.

```bash
docker compose up --build -d
```

Site em `http://localhost`. Para publicar, exponha a porta 80 do host e aponte o domínio
para ele (Nginx, Cloudflare Tunnel, Caddy com HTTPS automático, etc.).

## Caminho B — Hospedagem gerenciada

### Backend (Render, Railway, Fly.io, ou qualquer VPS)

O ponto importante: a imagem precisa ter as ferramentas. Use o `backend/Dockerfile`
como *Dockerfile* do serviço (Render e Railway detectam automaticamente).

Como o `Dockerfile` já define os caminhos, basta:

| Variável | Valor |
|----------|-------|
| `YTDLP_PATH` | `/usr/local/bin/yt-dlp` |
| `FFMPEG_PATH` | `/usr/local/bin` |
| `DENO_PATH` | `/usr/local/bin/deno` |
| `YTDLP_TIMEOUT_MS` | `120000` |
| `INSTAGRAM_API_URL` | URL da API do Instagram |

Comando de start: `node server.js`. Porta: a que a plataforma injetar em `PORT`
(Render/Railway definem sozinhas).

Defina também um **health check** apontando para `GET /health`.

### Frontend (Vercel, Netlify, Cloudflare Pages, ou o mesmo servidor)

Os arquivos de `frontend/` são estáticos: basta publicar a pasta.
O único ajuste é `frontend/config.js`:

```js
window.APP_CONFIG = {
    apiBaseUrl: 'https://SEU-BACKEND.exemplo.com'
};
```

Deixe vazio (`''`) se houver proxy para `/api` na mesma origem.
O backend já libera CORS, então domínios diferentes funcionam sem ajuste extra.

## Configuração do servidor sem Docker

Em uma VPS, instale as ferramentas no host e aponte as variáveis para elas:

```bash
# Ubuntu/Debian
sudo apt install -y ffmpeg
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
     -o /usr/local/bin/yt-dlp && sudo chmod 755 /usr/local/bin/yt-dlp
sudo curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh -s -- -y
```

```env
YTDLP_PATH=/usr/local/bin/yt-dlp
FFMPEG_PATH=/usr/local/bin
DENO_PATH=/usr/local/bin/deno
```

Rode o backend com um gerenciador de processos (systemd, pm2) e um proxy
nginx para o frontend estático.

## Regras de deploy que já estão tratadas

- **Timeout em três níveis.** O yt-dlp aborta em `YTDLP_TIMEOUT_MS` (120s), o nginx
  responde até `proxy_read_timeout` (180s) e o proxy da hospedagem precisa de um
  limite maior. Se a hospedagem cortar em menos de 120s, reduza `YTDLP_TIMEOUT_MS`.
- **Nenhum arquivo é gravado.** O yt-dlp roda com `--dump-single-json --simulate`;
  só devolve URLs, nunca baixa para o servidor.
- **Processos temporários.** Cada requisição cria um processo yt-dlp, encerrado ao
  responder, com timeout, com a árvore de processos derrubada em abort.
- **Aumente o timeout do proxy da hospedagem** se usar Cloudflare/Render no plano
  padrão: o limite de requisição em algumas plataformas pode ser menor que 120s.

## O que ainda não existe em produção

- **Rate limiting e autenticação**: a API é pública. Em um site aberto, abuse é provável.
- **HTTPS**: use o proxy da hospedagem (Caddy/Nginx/Cloudflare) para terminar TLS.
- **Cache distribuído**: o cache em memória de `downloadService.js` é por instância.
  Com mais de uma réplica, use Redis.