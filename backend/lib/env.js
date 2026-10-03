/**
 * Carregamento de variaveis de ambiente.
 *
 * Usa o loader nativo do Node (process.loadEnvFile, disponivel a partir
 * da v20.12) para nao depender de pacote externo.
 *
 * O arquivo lido pode ser alterado com a variavel ENV_FILE.
 * O arquivo e opcional: se nao existir, o servidor continua funcionando
 * apenas com as variaveis ja presentes no ambiente.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envFile = process.env.ENV_FILE
    ? resolve(process.env.ENV_FILE)
    : resolve(process.cwd(), '.env');

if (existsSync(envFile) && typeof process.loadEnvFile === 'function') {
    try {
        process.loadEnvFile(envFile);
    } catch (error) {
        console.warn(
            `[env] Falha ao carregar ${envFile}: ${error?.message || error}`
        );
    }
}

export { envFile };