/**
 * Serviço de download.
 *
 * É a camada de negócios que recebe uma URL, encontra o provedor
 * adequado e despacha a requisição para ele.
 *
 * Mantém uma cache simples em memória para evitar chamadas repetidas
 * à mesma URL dentro de um curto período.
 */
import registry from '../providers/ProviderRegistry.js';

// Cache em memória: url -> { data, expiresAt }
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Valida se a URL é absoluta e parece com uma URL válida.
 * @param {string} url
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateUrl(url) {
    if (!url || typeof url !== 'string') {
        return { valid: false, error: 'URL é obrigatória.' };
    }

    const trimmed = url.trim();
    if (trimmed.length === 0) {
        return { valid: false, error: 'URL não pode ser vazia.' };
    }

    try {
        new URL(trimmed);
    } catch {
        return { valid: false, error: 'URL inválida.' };
    }

    return { valid: true };
}

/**
 * Busca o provedor compatível com a URL.
 * @param {string} url
 * @returns {{ provider: object | null, error?: string }}
 */
export function resolveProvider(url) {
    const provider = registry.findProvider(url);
    if (!provider) {
        return {
            provider: null,
            error: 'Nenhum provedor compatível com esta URL foi encontrado.'
        };
    }
    return { provider };
}

/**
 * Executa o download/extração das mídias.
 * @param {string} url
 * @param {object} options
 * @param {object} options.signal
 * @param {boolean} options.useCache
 * @returns {Promise<{ ok: boolean, platform?: string, media?: Array<object>, error?: string }>}
 */
export async function downloadMedia(url, options = {}) {
    const { signal, useCache = true } = options;

    // 1. Validar URL
    const validation = validateUrl(url);
    if (!validation.valid) {
        return { ok: false, error: validation.error };
    }

    const trimmedUrl = url.trim();

    // 2. Verificar cache
    if (useCache) {
        const cached = cache.get(trimmedUrl);
        if (cached && cached.expiresAt > Date.now()) {
            return { ...cached.data, fromCache: true };
        }
    }

    // 3. Resolver provedor
    const { provider, error } = resolveProvider(trimmedUrl);
    if (!provider) {
        return { ok: false, error };
    }

    // 4. Executar extração
    const result = await provider.fetchMedia(trimmedUrl, { signal });

    // 5. Salvar no cache (apenas em caso de sucesso)
    if (result.ok && useCache) {
        cache.set(trimmedUrl, {
            data: result,
            expiresAt: Date.now() + CACHE_TTL_MS
        });
    }

    return result;
}

/**
 * Lista todos os provedores registrados.
 * @returns {string[]}
 */
export function listProviders() {
    return registry.listProviders();
}