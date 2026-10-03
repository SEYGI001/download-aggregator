/**
 * Rotas da API de download.
 *
 * Expõe um único endpoint unificado que despacha para o provedor
 * correto com base na URL informada.
 */
import { Router } from 'express';
import { downloadMedia, listProviders } from '../services/downloadService.js';

const router = Router();

/**
 * GET /api/download
 *
 * Parâmetros (query string):
 *   - url (obrigatório): URL da mídia a ser extraída.
 *
 * Resposta de sucesso:
 *   { ok: true, platform: "instagram", media: [...], fromCache?: boolean }
 *
 * Resposta de erro:
 *   { ok: false, error: "..." }
 */
router.get('/download', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({
            ok: false,
            error: 'Parâmetro "url" é obrigatório.',
            example: '/api/download?url=https://www.instagram.com/reel/SEU_SHORTCODE/'
        });
    }

    try {
        const result = await downloadMedia(String(url), {
            signal: req.signal
        });

        if (!result.ok) {
            // Determinar status code com base no tipo de erro
            const message = String(result.error || '').toLowerCase();
            const isClientError =
                message.includes('obrigatório') ||
                message.includes('inválida') ||
                message.includes('vazia') ||
                message.includes('compatível') ||
                message.includes('não está implementado');

            return res.status(isClientError ? 400 : 502).json(result);
        }

        return res.json(result);
    } catch (error) {
        if (error?.name === 'AbortError') {
            return res.status(504).json({
                ok: false,
                error: 'Timeout na requisição.'
            });
        }

        return res.status(500).json({
            ok: false,
            error: 'Erro interno no servidor.'
        });
    }
});

/**
 * GET /api/platforms
 *
 * Lista todos os provedores disponíveis.
 */
router.get('/platforms', (req, res) => {
    res.json({
        ok: true,
        platforms: listProviders()
    });
});

export default router;