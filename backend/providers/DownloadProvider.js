/**
 * Interface comum que todos os provedores de download devem implementar.
 *
 * Um provedor é responsável por:
 *  - dizer se suporta uma determinada URL (metodo `supports`)
 *  - baixar/extraír as mídias da URL (metodo `fetchMedia`)
 *
 * Isso permite adicionar novas plataformas (TikTok, YouTube, etc.)
 * sem precisar reescrever o restante do projeto.
 */
export default class DownloadProvider {
    /**
     * Nome identificador do provedor (ex: 'instagram', 'tiktok', 'youtube').
     * Deve ser único no registry.
     */
    get name() {
        throw new Error('Provider deve implementar getter name()');
    }

    /**
     * Verifica se o provedor suporta a URL informada.
     * @param {string} url
     * @returns {boolean}
     */
    supports(url) {
        throw new Error('Provider deve implementar supports(url)');
    }

    /**
     * Extrai as mídias da URL informada.
     * @param {string} url
     * @param {object} options
     * @param {object} options.signal - AbortSignal para cancelamento
     * @returns {Promise<{ ok: boolean, platform: string, media: Array<object>, error?: string }>}
     */
    async fetchMedia(url, options = {}) {
        throw new Error('Provider deve implementar fetchMedia(url, options)');
    }
}