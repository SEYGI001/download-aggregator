/**
 * Servidor principal da API agregadora de download.
 *
 * Arquitetura:
 *   - Camada de rotas: routes/api.js
 *   - Camada de serviço: services/downloadService.js
 *   - Camada de provedores: providers/*.js
 *
 * Cada provedor implementa a interface DownloadProvider e é
 * registrado no ProviderRegistry. Para adicionar uma nova plataforma
 * basta criar um novo provider e registrá-lo no registry.
 */

// Precisa vir antes dos provedores: carrega o arquivo .env (opcional).
import './lib/env.js';

import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas
app.get('/', (req, res) => {
    res.json({
        ok: true,
        name: 'Download Aggregator API',
        status: 'online',
        endpoints: {
            download: 'GET /api/download?url=...',
            platforms: 'GET /api/platforms'
        }
    });
});

app.get('/health', (req, res) => {
    res.json({
        ok: true,
        status: 'online',
        timestamp: new Date().toISOString()
    });
});

app.use('/api', apiRoutes);

// 404
app.use((req, res) => {
    res.status(404).json({
        ok: false,
        error: 'Rota não encontrada.'
    });
});

// Inicia o servidor apenas quando executado diretamente
if (process.argv[1] && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log('');
        console.log('======================================');
        console.log(' DOWNLOAD AGGREGATOR API');
        console.log('======================================');
        console.log('');
        console.log(`Servidor: http://localhost:${PORT}`);
        console.log(`Health:   http://localhost:${PORT}/health`);
        console.log(`Download: http://localhost:${PORT}/api/download?url=...`);
        console.log(`Plataformas: http://localhost:${PORT}/api/platforms`);
        console.log('');
    });
}

export default app;