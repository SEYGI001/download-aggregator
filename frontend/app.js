/**
 * Frontend do Download Agregador.
 *
 * Faz chamadas à API backend (/api/download e /api/platforms)
 * e exibe as mídias encontradas.
 */

/**
 * Configuracao do backend.
 *
 * A prioridade e o arquivo config.js (editado no deploy).
 * Sem ele, cai em deteccao automatica para nao quebrar o uso local:
 *   - abrindo o index.html direto (file://) ou em localhost, usa a porta 3001;
 *   - em qualquer outro host, usa a mesma origem (ex.: com proxy /api).
 */
function resolveApiBase() {
    const configured = String(
        (window.APP_CONFIG && window.APP_CONFIG.apiBaseUrl) || ''
    ).trim();

    if (configured) {
        return configured.replace(/\/+$/, '');
    }

    const host = location.hostname;

    if (host === 'localhost' || host === '127.0.0.1' || host === '') {
        return 'http://localhost:3001';
    }

    return '';
}

const API_BASE = resolveApiBase();

const form = document.getElementById('download-form');
const urlInput = document.getElementById('url-input');
const downloadBtn = document.getElementById('download-btn');
const platformBadge = document.getElementById('platform-badge');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const mediaListEl = document.getElementById('media-list');
const platformsSection = document.getElementById('platforms-section');
const platformsListEl = document.getElementById('platforms-list');

// Detectar plataforma com base na URL
function detectPlatform(url) {
    if (/instagram\.com/i.test(url)) return 'Instagram';
    if (/tiktok\.com|vm\.tiktok\.com/i.test(url)) return 'TikTok';
    if (/youtube\.com|youtu\.be/i.test(url)) return 'YouTube';
    return null;
}

// Atualizar badge de plataforma
function updatePlatformBadge(url) {
    const platform = detectPlatform(url);
    if (platform) {
        platformBadge.textContent = platform;
        platformBadge.classList.remove('hidden');
    } else {
        platformBadge.classList.add('hidden');
    }
}

// Mostrar status
function showStatus(message, type = 'info') {
    statusEl.textContent = message;
    statusEl.className = `status ${type} hidden`;
    void statusEl.offsetWidth;
    statusEl.classList.remove('hidden');
}

// Ocultar status
function hideStatus() {
    statusEl.classList.add('hidden');
}

// Renderizar lista de mídias
function renderMedia(media) {
    mediaListEl.innerHTML = '';

    if (!Array.isArray(media) || media.length === 0) {
        mediaListEl.innerHTML = '<p>Nenhuma mídia encontrada.</p>';
        return;
    }

    media.forEach(item => {
        const card = document.createElement('div');
        card.className = 'media-card';

        const indexLabel = document.createElement('div');
        indexLabel.className = 'media-index';
        indexLabel.textContent = `#${item.index || 1}`;

        const typeLabel = document.createElement('div');
        typeLabel.className = `media-type type-${item.type}`;
        typeLabel.textContent =
            item.type === 'video' ? '🎬 Vídeo'
                : item.type === 'audio' ? '🔊 Áudio'
                    : '📷 Foto';

        const preview = document.createElement('div');
        preview.className = 'media-preview';

        if (item.type === 'audio') {
            const audio = document.createElement('audio');
            audio.src = item.url;
            audio.controls = true;
            audio.preload = 'metadata';
            preview.appendChild(audio);
        } else if (item.type === 'video') {
            const video = document.createElement('video');
            video.src = item.url;
            video.controls = true;
            video.preload = 'metadata';
            video.addEventListener('error', () => {
                video.style.display = 'none';
                const fallback = document.createElement('a');
                fallback.href = item.url;
                fallback.target = '_blank';
                fallback.rel = 'noopener noreferrer';
                fallback.className = 'media-link';
                fallback.textContent = 'Baixar vídeo (link direto)';
                preview.appendChild(fallback);
            });
            preview.appendChild(video);
        } else {
            const img = document.createElement('img');
            img.src = item.url;
            img.alt = 'Imagem do post';
            img.addEventListener('error', () => {
                img.style.display = 'none';
                const fallback = document.createElement('a');
                fallback.href = item.url;
                fallback.target = '_blank';
                fallback.rel = 'noopener noreferrer';
                fallback.className = 'media-link';
                fallback.textContent = 'Abrir imagem (link direto)';
                preview.appendChild(fallback);
            });
            preview.appendChild(img);
        }

        const meta = document.createElement('div');
        meta.className = 'media-meta';
        const dims = item.width && item.height
            ? `${item.width}x${item.height}`
            : '—';
        meta.innerHTML = `
            <span>Resolução: ${dims}</span>
            ${item.bitrate ? `<span>Bitrate: ${item.bitrate}</span>` : ''}
            ${item.duration ? `<span>Duração: ${item.duration}s</span>` : ''}
        `;

        const link = document.createElement('a');
        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'media-link';
        link.textContent = 'Abrir link direto';

        card.appendChild(indexLabel);
        card.appendChild(typeLabel);
        card.appendChild(preview);
        card.appendChild(meta);
        card.appendChild(link);

        mediaListEl.appendChild(card);
    });
}

// Renderizar lista de plataformas
function renderPlatforms(platforms) {
    platformsListEl.innerHTML = '';
    platforms.forEach(p => {
        const span = document.createElement('span');
        span.className = 'platform-tag';
        span.textContent = p;
        platformsListEl.appendChild(span);
    });
}

// Carregar plataformas ao iniciar
async function loadPlatforms() {
    try {
        const res = await fetch(`${API_BASE}/api/platforms`);
        const data = await res.json();
        if (data.ok && Array.isArray(data.platforms)) {
            renderPlatforms(data.platforms);
            platformsSection.classList.remove('hidden');
        }
    } catch {
        // Silencioso: a seção de plataformas é apenas informativa
    }
}

// Processar envio do formulário
async function handleSubmit(e) {
    e.preventDefault();
    hideStatus();
    resultsEl.classList.add('hidden');

    const url = urlInput.value.trim();
    if (!url) {
        showStatus('Por favor, cole uma URL válida.', 'error');
        return;
    }

    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Buscando...';

    showStatus('Buscando mídias...', 'info');

    try {
        const res = await fetch(`${API_BASE}/api/download?url=${encodeURIComponent(url)}`);
        const data = await res.json();

        if (!data.ok) {
            showStatus(data.error || 'Erro ao buscar mídias.', 'error');
            return;
        }

        const cacheLabel = data.fromCache ? ' (do cache)' : '';
        showStatus(
            `${data.count || 0} mídia(s) encontrada(s) em ${data.platform}.${cacheLabel}`,
            'success'
        );

        renderMedia(data.media || []);
        resultsEl.classList.remove('hidden');
    } catch (error) {
        if (error?.name === 'AbortError') {
            showStatus('Timeout na requisição.', 'error');
        } else {
            showStatus('Erro de rede ao contatar a API.', 'error');
        }
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Baixar';
    }
}

// Event listeners
form.addEventListener('submit', handleSubmit);
urlInput.addEventListener('input', () => updatePlatformBadge(urlInput.value));

// Inicializar
loadPlatforms();
updatePlatformBadge(urlInput.value);