/**
 * Normalizacao das informacoes do yt-dlp para o contrato de `media`
 * usado pelo restante do projeto (InstagramProvider + frontend).
 *
 * Formato por item:
 *   {
 *     index:    number (1-based)
 *     type:     'video' | 'image' | 'audio'
 *     url:      string
 *     width:    number
 *     height:   number
 *     bitrate:  number  (opcional)
 *     duration: number  (opcional)
 *   }
 *
 * Sem isso, cada provedor devolveria um formato diferente e o frontend
 * precisaria conhecer detalhes de cada plataforma.
 */

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']);
const SAFE_PROTOCOLS = new Set(['http', 'https']);

/**
 * Verifica se o formato tem uma URL direta utilizavel.
 * Exclui mhtml, http_dash_segments, manifestos HLS/DASH e o que vier vazio.
 * @param {object} format
 * @returns {boolean}
 */
function hasDirectUrl(format) {
    if (!format?.url) {
        return false;
    }

    const protocol = String(format.protocol || '').split('+')[0];

    return SAFE_PROTOCOLS.has(protocol);
}

function isImage(format) {
    return IMAGE_EXTENSIONS.has(String(format.ext || '').toLowerCase());
}

function hasVideo(format) {
    return Boolean(format.vcodec) && format.vcodec !== 'none';
}

function hasAudio(format) {
    return Boolean(format.acodec) && format.acodec !== 'none';
}

function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Converte um formato do yt-dlp em item de midia do nosso contrato.
 * @param {object} format
 * @param {number} index
 * @param {string} type
 * @param {number} durationFallback
 * @returns {object}
 */
function toMediaItem(format, index, type, durationFallback) {
    const bitrate = toNumber(format.tbr);
    const duration = toNumber(format.duration) || durationFallback;

    const item = {
        index,
        type,
        url: String(format.url),
        width: toNumber(format.width),
        height: toNumber(format.height)
    };

    if (bitrate > 0) {
        item.bitrate = bitrate;
    }

    if (duration > 0) {
        item.duration = Math.round(duration);
    }

    return item;
}

/**
 * Ordena formatos por qualidade decrescente:
 * resolucao, depois bitrate, depois tamanho estimado.
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
function byQuality(a, b) {
    const pixelsA = toNumber(a.width) * toNumber(a.height);
    const pixelsB = toNumber(b.width) * toNumber(b.height);

    if (pixelsB !== pixelsA) {
        return pixelsB - pixelsA;
    }

    const bitrateA = toNumber(a.tbr);
    const bitrateB = toNumber(b.tbr);

    if (bitrateB !== bitrateA) {
        return bitrateB - bitrateA;
    }

    return toNumber(b.filesize) - toNumber(a.filesize);
}

/**
 * Extrai a lista de midias no contrato do projeto.
 *
 * Regras:
 *  - imagem (TikTok em modo foto): todos os itens entram, em ordem;
 *  - video com audio junto: usa o melhor formato combinado;
 *  - video sem audio junto (comum no YouTube): devolve o melhor video
 *    e o melhor audio como itens separados, porque o yt-dlp so teria
 *    um arquivo unico apos mesclar com FFmpeg em disco.
 *
 * @param {object} info Objeto JSON devolvido pelo yt-dlp
 * @returns {Array<object>}
 */
export function pickMedia(info) {
    const formats = Array.isArray(info?.formats) ? info.formats : [];
    const usable = formats.filter(hasDirectUrl);

    if (usable.length === 0) {
        return [];
    }

    const durationFallback = toNumber(info?.duration);
    const media = [];

    // 1. Imagens (ex.: TikTok em modo foto)
    const images = usable
        .filter(format => isImage(format))
        .sort((a, b) => byQuality(a, b));

    for (const image of images) {
        media.push(toMediaItem(image, media.length + 1, 'image', 0));
    }

    if (media.length > 0) {
        return media;
    }

    // 2. Video com audio (TikTok, Vimeo e varios formatos do YouTube)
    const combined = usable
        .filter(format => hasVideo(format) && hasAudio(format))
        .sort(byQuality);

    if (combined.length > 0) {
        media.push(toMediaItem(combined[0], media.length + 1, 'video', durationFallback));
        return media;
    }

    // 3. Somente video (padrao do YouTube: faixas separadas)
    const videoOnly = usable
        .filter(format => hasVideo(format))
        .sort(byQuality);

    if (videoOnly.length > 0) {
        media.push(toMediaItem(videoOnly[0], media.length + 1, 'video', durationFallback));
    }

    // 4. Somente audio
    const audioOnly = usable
        .filter(format => !hasVideo(format) && hasAudio(format))
        .sort(byQuality);

    if (audioOnly.length > 0) {
        media.push(toMediaItem(audioOnly[0], media.length + 1, 'audio', durationFallback));
    }

    return media;
}