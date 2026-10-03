/**
 * Runner seguro do yt-dlp.
 *
 * Responsabilidades:
 *  - resolver os binarios externos a partir de variaveis de ambiente
 *    (YTDLP_PATH, FFMPEG_PATH, DENO_PATH);
 *  - executar o yt-dlp SEM shell, passando cada argumento separado,
 *    para evitar injecao de comandos via URL;
 *  - respeitar AbortSignal e timeout, encerrando o processo filho
 *    (e seus filhos) para nao deixar processos orfaos;
 *  - converter erros do yt-dlp em mensagens seguras para o usuario final,
 *    sem expor caminhos locais nem stack traces.
 *
 * Nenhuma informacao interna (caminho de executavel, comando completo,
 * stderr cru) e devolvida ao cliente.
 */
import { execFile, spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';

const IS_WINDOWS = process.platform === 'win32';
const DEFAULT_YTDLP_BIN = IS_WINDOWS ? 'yt-dlp.exe' : 'yt-dlp';
const MAX_BUFFER_BYTES = 32 * 1024 * 1024;

// Margem entre o nosso timeout e o timeout interno do execFile.
const KILL_GRACE_MS = 15000;

/**
 * Erro de extracao ja com mensagem segura para o usuario final.
 * O campo `code` permite que os provedores decidam o status HTTP.
 */
export class YtDlpError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'YtDlpError';
        this.code = code;
    }
}

/**
 * Le um valor de configuracao numerica do ambiente.
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
function readNumberEnv(name, fallback) {
    const raw = process.env[name];
    if (!raw) {
        return fallback;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getTimeoutMs() {
    return readNumberEnv('YTDLP_TIMEOUT_MS', 120000);
}

/**
 * Resolve o executavel do yt-dlp.
 * Se YTDLP_PATH nao estiver definida, tenta o PATH do sistema.
 * @returns {string}
 */
function resolveYtdlpBin() {
    const configured = process.env.YTDLP_PATH;

    if (configured && configured.trim()) {
        return configured.trim();
    }

    return DEFAULT_YTDLP_BIN;
}

/**
 * Monta os argumentos comuns do yt-dlp.
 * - --dump-single-json: uma unica linha de JSON estruturado no stdout
 * - --no-playlist: garante que apenas o item informado seja resolvido
 * - --ffmpeg-location: necessario para torchvision/pos-processamento
 * - --js-runtimes deno:<path>: habilita o solver de desafio JS quando o Deno esta configurado
 * @param {string[]} args
 * @returns {string[]}
 */
function buildArgs(args) {
    const common = [
        '--no-warnings',
        '--no-playlist',
        '--no-color',
        '--dump-single-json',
        // --dump-single-json ja implica --simulate, mas deixamos explicito:
        // qualquer downloads seria gravado em disco no servidor.
        '--simulate',
        '--no-progress'
    ];

    const ffmpegPath = process.env.FFMPEG_PATH;
    if (ffmpegPath && ffmpegPath.trim()) {
        common.push('--ffmpeg-location', ffmpegPath.trim());
    }

    const denoPath = process.env.DENO_PATH;
    if (denoPath && denoPath.trim()) {
        common.push('--js-runtimes', `deno:${denoPath.trim()}`);
    }

    // Argumentos extras de administracao (ex.: cookies, player-client).
    // Vem do ambiente do servidor, nunca do usuario.
    const extra = process.env.YTDLP_EXTRA_ARGS;
    if (extra && extra.trim()) {
        common.push(...extra.trim().split(/\s+/).filter(Boolean));
    }

    return [...common, ...args];
}

/**
 * Encerrar o processo filho e seus sub-processos.
 * @param {import('node:child_process').ChildProcess} child
 */
function killTree(child) {
    if (!child || !child.pid) {
        return;
    }

    if (IS_WINDOWS) {
        try {
            spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
                windowsHide: true,
                stdio: 'ignore'
            });
            return;
        } catch {
            // Cai no SIGKILL abaixo.
        }
    }

    try {
        child.kill('SIGKILL');
    } catch {
        // Processo ja encerrado.
    }
}

/**
 * Converte stderr do yt-dlp em codigo + mensagem amigavel.
 * Nenhum trecho de caminho local e exposto.
 * @param {string} stderr
 * @returns {{ code: string, message: string }}
 */
function classifyError(stderr) {
    const text = String(stderr || '').toLowerCase();

    if (text.includes('private video') || text.includes('this video is private')) {
        return {
            code: 'PRIVATE',
            message: 'Este vídeo é privado e não pode ser acessado.'
        };
    }

    if (text.includes('sign in') || text.includes('login required') || text.includes('confirm your age')) {
        return {
            code: 'AUTH_REQUIRED',
            message: 'Este conteúdo exige autenticação e não está disponível.'
        };
    }

    if (text.includes('not available in your country') || text.includes('geo restricted') || text.includes('geo-restricted')) {
        return {
            code: 'GEO_BLOCKED',
            message: 'Este conteúdo não está disponível na sua região.'
        };
    }

    if (text.includes('unavailable') || text.includes('has been removed') || text.includes('video unavailable') || text.includes('deleted')) {
        return {
            code: 'UNAVAILABLE',
            message: 'Este conteúdo não está mais disponível.'
        };
    }

    if (text.includes('unsupported url')) {
        return {
            code: 'UNSUPPORTED_URL',
            message: 'URL não suportada pelo provedor desta plataforma.'
        };
    }

    if (text.includes('unable to download') || text.includes('failed to resolve') || text.includes('timed out') || text.includes('connection')) {
        return {
            code: 'NETWORK',
            message: 'Não foi possível acessar o conteúdo. Verifique a conexão e tente novamente.'
        };
    }

    return {
        code: 'EXTRACTION_FAILED',
        message: 'Não foi possível extrair as mídias deste conteúdo.'
    };
}

/**
 * Valida a URL antes de entregar ao yt-dlp.
 * Apenas http/https sao aceitos, para evitar esquemas locais (file://)
 * ou argumentos que o yt-dlp poderia interpretar de outra forma.
 * @param {string} url
 */
function assertSafeUrl(url) {
    const text = String(url || '').trim();

    let parsed;
    try {
        parsed = new URL(text);
    } catch {
        throw new YtDlpError('INVALID_URL', 'URL invalida.');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new YtDlpError('INVALID_URL', 'URL invalida.');
    }
}

/**
 * Verifica se o executavel do yt-dlp esta acessivel.
 * @returns {Promise<boolean>}
 */
export async function isYtDlpAvailable() {
    const bin = resolveYtdlpBin();

    try {
        await access(bin, constants.X_OK | constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Executa o yt-dlp e devolve o objeto JSON de informacoes.
 *
 * @param {string[]} args Argumentos adicionais (normalmente a URL, isolada)
 * @param {object} options
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>}
 */
function runYtDlp(args, options = {}) {
    const { signal } = options;

    assertSafeUrl(args[args.length - 1]);

    const bin = resolveYtdlpBin();
    const finalArgs = buildArgs(args);
    const timeout = getTimeoutMs();

    return new Promise((resolve, reject) => {
        let settled = false;
        let abortedBySignal = false;
        let timedOut = false;

        const child = execFile(
            bin,
            finalArgs,
            {
                maxBuffer: MAX_BUFFER_BYTES,
                windowsHide: true,
                // Tempo limite interno do Node e maior que o nosso de proposito:
                // quem mata primeiro e o nosso timer, que consegue derrubar a
                // arvore inteira de processos. Se o Node matasse so o processo
                // pai, o runtime JS (Deno) ficaria orfao.
                timeout: timeout + KILL_GRACE_MS,
                killSignal: 'SIGKILL',
                shell: false
            },
            (error, stdout, stderr) => {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();

                if (abortedBySignal) {
                    reject(
                        new YtDlpError(
                            'ABORTED',
                            'Requisição cancelada antes da conclusão.'
                        )
                    );
                    return;
                }

                if (timedOut) {
                    reject(
                        new YtDlpError(
                            'TIMEOUT',
                            'Tempo limite excedido ao extrair o conteúdo.'
                        )
                    );
                    return;
                }

                if (error && typeof error.code === 'string' && error.code === 'ENOENT') {
                    reject(
                        new YtDlpError(
                            'NOT_CONFIGURED',
                            'Extração de vídeo indisponível: yt-dlp não está configurado no servidor.'
                        )
                    );
                    return;
                }

                if (error && (error.killed || error.signal)) {
                    killTree(child);
                    reject(
                        new YtDlpError(
                            'TIMEOUT',
                            'Tempo limite excedido ao extrair o conteúdo.'
                        )
                    );
                    return;
                }

                if (error) {
                    const classified = classifyError(stderr);
                    console.error(
                        `[yt-dlp] Falha na extracao (${classified.code}): ${String(stderr || error.message).slice(0, 400)}`
                    );
                    reject(new YtDlpError(classified.code, classified.message));
                    return;
                }

                resolve(parseOutput(stdout));
            }
        );

        const onAbort = () => {
            abortedBySignal = true;
            killTree(child);
        };

        // Timer proprio: dispara antes do timeout interno do Node para que a
        // arvore de processos (yt-dlp + Deno + eventual ffmpeg) seja derrubada
        // de uma vez, evitando processos orfaos.
        const timer = setTimeout(() => {
            timedOut = true;
            killTree(child);
        }, timeout);

        function cleanup() {
            clearTimeout(timer);
            if (signal && typeof signal.removeEventListener === 'function') {
                signal.removeEventListener('abort', onAbort);
            }
        }

        if (signal) {
            if (signal.aborted) {
                onAbort();
                return;
            }

            signal.addEventListener('abort', onAbort, { once: true });
        }
    });
}

/**
 * Converte o stdout do yt-dlp em objeto.
 * O yt-dlp pode imprimir linhas adicionais antes do JSON,
 * entao recortamos do primeiro '{' ate o ultimo '}'.
 * @param {string} stdout
 * @returns {object}
 */
function parseOutput(stdout) {
    const text = String(stdout || '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
        throw new YtDlpError(
            'EXTRACTION_FAILED',
            'Nao foi possivel extrair as midias deste conteudo.'
        );
    }

    try {
        return JSON.parse(text.slice(start, end + 1));
    } catch {
        throw new YtDlpError(
            'EXTRACTION_FAILED',
            'Nao foi possivel extrair as midias deste conteudo.'
        );
    }
}

/**
 * Executa o yt-dlp para uma URL e devolve as informacoes estruturadas.
 * @param {string} url
 * @param {object} options
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>}
 */
export function fetchInfoWithYtDlp(url, options = {}) {
    // A URL e passada como argumento isolado (nunca concatenada em string
    // de comando), mantendo o execFile seguro contra injecao.
    return runYtDlp([String(url || '').trim()], options);
}

/**
 * Converte um erro qualquer em mensagem segura para o cliente.
 * @param {unknown} error
 * @returns {string}
 */
export function toSafeMessage(error) {
    if (error instanceof YtDlpError) {
        return error.message;
    }

    if (error?.name === 'AbortError') {
        return 'Requisição cancelada antes da conclusão.';
    }

    return 'Erro inesperado ao extrair as mídias.';
}