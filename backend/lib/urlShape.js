/**
 * Validacao do formato da URL antes de chamar o yt-dlp.
 *
 * Sem isso, uma URL de perfil (ex.: tiktok.com/@usuario) faz o yt-dlp
 * tentar enumerar o conteudo do usuario e a request fica presa ate o
 * timeout. URLs de midia sao sempre pocas e bem definidas, entao
 * rejeitar cedo e mais barato e previsivel.
 */

/**
 * Monta a URL normalizando o protocolo quando necessario.
 * @param {string} url
 * @returns {URL | null}
 */
function parseUrl(url) {
    const text = String(url || '').trim();

    try {
        return new URL(text);
    } catch {
        try {
            return new URL(`https://${text}`);
        } catch {
            return null;
        }
    }
}

/**
 * Heuristica: a URL aponta para um perfil e nao para uma midia.
 *
 * Nao bloqueia links curtos (vm.tiktok.com/CODE, /t/CODE), que nao tem
 * o formato de perfil e sao resolvidos normalmente pelo yt-dlp.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isProfileUrl(url) {
    const parsed = parseUrl(url);

    if (!parsed) {
        return false;
    }

    const path = parsed.pathname.replace(/\/+$/, '');

    // tiktok.com/@usuario  e  youtube.com/@canal
    return /^\/@[^/]+$/i.test(path);
}

/**
 * Heuristica: a URL aponta para um canal/curso, nao para um video.
 * @param {string} url
 * @returns {boolean}
 */
export function isChannelUrl(url) {
    const parsed = parseUrl(url);

    if (!parsed) {
        return false;
    }

    const path = parsed.pathname.replace(/\/+$/, '');

    return /^\/(channel|c|user)\/[^/]+$/i.test(path) ||
        /^\/(results|feed)$/i.test(path);
}