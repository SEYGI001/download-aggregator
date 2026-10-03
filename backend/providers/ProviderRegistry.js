/**
 * Registry de provedores de download.
 *
 * Mantém uma lista de provedores registrados e fornece métodos
 * para encontrar o provedor correto com base na URL informada.
 *
 * Para adicionar uma nova basta instanciar a classe e chamar `register()`.
 */
import InstagramProvider from './InstagramProvider.js';
import TikTokProvider from './TikTokProvider.js';
import YouTubeProvider from './YouTubeProvider.js';

class ProviderRegistry {
    constructor() {
        /** @type {DownloadProvider[]} */
        this.providers = [];
    }

    /**
     * Registra um provedor.
     * @param {DownloadProvider} provider
     */
    register(provider) {
        const exists = this.providers.some(p => p.name === provider.name);
        if (exists) {
            console.warn(`[Registry] Provedor "${provider.name}" já está registrado. Substituindo.`);
        }
        this.providers = this.providers.filter(p => p.name !== provider.name);
        this.providers.push(provider);
    }

    /**
     * Encontra o primeiro provedor que suporta a URL.
     * @param {string} url
     * @returns {DownloadProvider | null}
     */
    findProvider(url) {
        return this.providers.find(provider => provider.supports(url)) || null;
    }

    /**
     * Lista os nomes de todos os provedores registrados.
     * @returns {string[]}
     */
    listProviders() {
        return this.providers.map(p => p.name);
    }
}

// Instância singleton com os provedores atualmente disponíveis.
const registry = new ProviderRegistry();
registry.register(new InstagramProvider());
registry.register(new TikTokProvider());
registry.register(new YouTubeProvider());

export default registry;