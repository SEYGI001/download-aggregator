/**
 * Provedor YouTube.
 *
 * A extracao e feita localmente pelo yt-dlp, sem depender de API
 * de terceiros. O yt-dlp devolve JSON estruturado, normalizado em
 * `media` pelo contrato compartilhado do projeto.
 *
 * Observacao sobre o YouTube: ele normalmente entrega video e audio em
 * faixas separadas. Nesse caso `media` traz o video com a melhor
 * resolucao e o audio com o melhor bitrate como itens separados. O
 * arquivo unico com audio exigiria mesclar as faixas com FFmpeg em
 * disco, o que nao e feito aqui para nao criar armazenamento no servidor.
 *
 * Configuracao (variaveis de ambiente):
 *   YTDLP_PATH  - caminho do executavel yt-dlp
 *   FFMPEG_PATH - caminho do ffmpeg (opcional)
 *   DENO_PATH   - caminho do Deno, usado como runtime JS (opcional)
 */
import DownloadProvider from './DownloadProvider.js';
import { fetchInfoWithYtDlp, toSafeMessage } from '../lib/ytdlp.js';
import { pickMedia } from '../lib/media.js';
import { isProfileUrl, isChannelUrl } from '../lib/urlShape.js';

export default class YouTubeProvider extends DownloadProvider {
    get name() {
        return 'youtube';
    }

    supports(url) {
        return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i.test(
            String(url || '').trim()
        );
    }

    async fetchMedia(url, options = {}) {
        const { signal } = options;

        // Perfil/canal nao e midia: rejeitar antes de gastar tempo de processo.
        if (isProfileUrl(url) || isChannelUrl(url)) {
            return {
                ok: false,
                platform: this.name,
                error: 'URL inválida: informe o link de um vídeo do YouTube, não o canal ou a busca.',
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
                    error: 'Nenhuma mídia foi encontrada neste vídeo do YouTube.',
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