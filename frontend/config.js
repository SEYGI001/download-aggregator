/**
 * Configuracao do frontend.
 *
 * Este e o unico arquivo que precisa ser editado para apontar o site
 * para um backend hospedado. Ele e carregado antes do app.js.
 *
 * apiBaseUrl:
 *   ''                  -> mesma origem do site.
 *                          Use quando houver proxy (/api) na frente,
 *                          que e o caso do docker-compose.yml.
 *   'https://api.exemplo.com' -> backend em outro dominio.
 *                          O backend ja libera CORS, entao funciona
 *                          sem configuracao extra.
 */
window.APP_CONFIG = {
    apiBaseUrl: ''
};