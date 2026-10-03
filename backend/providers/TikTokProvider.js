/**
 * Provedor TikTok.
 *
 * A extracao e feita localmente pelo yt-dlp, sem depender de API
 * de terceiros. O yt-dlp resolve a URL (inclusive links curtos como
 * vm.tiktok.com) e devolve JSON estruturado, normalizado em `media`
 * pelo contrato compartilhado do projeto.
 *
 * Configuracao (variaveis de ambiente):
 *   YTDLP_PATH  - caminho do executavel yt-dlp
 *   FFMPEG_PATH - caminho do ffmpeg (opcional)
 *   DENO_PATH   - caminho do Deno, usado como runtime JS (opcional)
 */
import DownloadProvider from './DownloadProvider.js';
import { fetchInfoWithYtDlp, toSafeMessage } from '../lib/ytdlp.js';
import { pickMedia } from '../lib/media.js';
import { isProfileUrl } from '../lib/urlShape.js';

export default class TikTokProvider extends DownloadProvider {
    get name() {
        return 'tiktok';
    }

    supports(url) {
        return /^(https?:\/\/)?(www\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)\/.+/i.test(
            String(url || '').trim()
        );
    }

    async fetchMedia(url, options = {}) {
        const { signal } = options;

        // Perfil nao e midia: rejeitar antes de gastar tempo de processo.
        if (isProfileUrl(url)) {
            return {
                ok: false,
                platform: this.name,
                error: 'URL inválida: informe o link de um vídeo ou foto do TikTok, não o perfil do usuário.',
                media: []
            };
        }

        try {
            const info = await fetchInfoWithYtDlp(url, { signal });
            const media = pickMedia(info);

            if (media.length === 0) {
                return {
                    ok: false,
                    platform: this.name,
                    error: 'Nenhuma mídia foi encontrada neste conteúdo do TikTok.',
                    media: []
                };
            }

            return {
                ok: true,
                platform: this.name,
                title: info?.title ?? null,
                method: 'ytdlp',
                media
            };
        } catch (error) {
            return {
                ok: false,
                platform: this.name,
                error: toSafeMessage(error),
                media: []
            };
        }
    }
}