/**
 * Provedor Instagram.
 *
 * Encapsula a lógica de chamada à API de Instagram do amigo
 * (https://github.com/ReneDoFrete/instagram-api).
 *
 * A URL da API é configurável via variável de ambiente
 * INSTAGRAM_API_URL, permitindo trocar a implementação
 * sem alterar o código deste provedor.
 */
import DownloadProvider from './DownloadProvider.js';

const API_BASE =
    process.env.INSTAGRAM_API_URL ||
    'https://instagram-api-green.vercel.app';

export default class InstagramProvider extends DownloadProvider {
    get name() {
        return 'instagram';
    }

    supports(url) {
        return /^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|reels|tv)\//i.test(
            String(url || '').trim()
        );
    }

    async fetchMedia(url, options = {}) {
        const { signal } = options;

        const endpoint = `${API_BASE}/instagram?url=${encodeURIComponent(url)}`;

        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                signal
            });

            if (!response.ok) {
                return {
                    ok: false,
                    platform: this.name,
                    error: `Instagram API retornou HTTP ${response.status}`,
                    media: []
                };
            }

            const data = await response.json();

            if (!data || !data.ok) {
                return {
                    ok: false,
                    platform: this.name,
                    error: data?.error || 'Erro ao extrair mídias do Instagram.',
                    media: []
                };
            }

            return {
                ok: true,
                platform: this.name,
                shortcode: data.shortcode,
                method: data.method,
                media: Array.isArray(data.media) ? data.media : []
            };
        } catch (error) {
            if (error?.name === 'AbortError') {
                return {
                    ok: false,
                    platform: this.name,
                    error: 'Timeout ao acessar a API do Instagram.',
                    media: []
                };
            }

            return {
                ok: false,
                platform: this.name,
                error: error?.message || 'Erro de rede ao acessar a API do Instagram.',
                media: []
            };
        }
    }
}