/* ============================================================================
   SCRAPER GENÉRICO — obtiene datos JSON desde una URL remota (fetch nativo).
   ----------------------------------------------------------------------------
   Punto de partida genérico: no sabemos aún la fuente concreta. Para páginas
   que requieren JS/DOM (como las listas de Google Maps), usa Playwright y el
   patrón de tools/maria-import.js en su lugar; esto es solo para endpoints
   JSON simples.

   USO:  node tools/scraper.js <url>
============================================================================ */
'use strict';

class ScraperError extends Error {
  constructor(message, url, statusCode) {
    super(message);
    this.name = 'ScraperError';
    this.url = url;
    this.statusCode = statusCode;
  }
}

const DEFAULT_TIMEOUT_MS = 10000;

// Obtiene y parsea JSON desde `url`. Lanza ScraperError si falla la petición
// o la respuesta no es JSON válido.
async function fetchData(url, { headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, { headers, signal: controller.signal });
  } catch (e) {
    throw new ScraperError(`No se pudo conectar con ${url}: ${e.message}`, url);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new ScraperError(`Respuesta no válida de ${url}`, url, response.status);
  }

  try {
    return await response.json();
  } catch (e) {
    throw new ScraperError(`No se pudo parsear JSON de ${url}: ${e.message}`, url);
  }
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Uso: node tools/scraper.js <url>');
    process.exit(1);
  }
  const data = await fetchData(url);
  console.log(JSON.stringify(data, null, 2));
}

if (require.main === module) main().catch((e) => { console.error('FATAL', e); process.exit(1); });
module.exports = { fetchData, ScraperError };
