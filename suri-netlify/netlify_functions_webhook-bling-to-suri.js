const { parseStringPromise } = require('xml2js');

const SURI_API_URL = process.env.SURI_API_URL;
const SURI_API_TOKEN = process.env.SURI_API_TOKEN;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

function log(level, ...args) {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  if (levels[level] >= levels[LOG_LEVEL]) return;
  console[level](...args);
}

function getHeader(headers, name) {
  if (!headers) return undefined;
  const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

async function parseBody(event) {
  const raw = event.body || '';
  const contentType = getHeader(event.headers, 'content-type') || '';
  // Netlify may send body as string (already). If base64Encoded, decode:
  const bodyText = event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw;

  if (contentType.includes('xml') || bodyText.trim().startsWith('<?xml') || bodyText.trim().startsWith('<')) {
    // Try parse XML
    try {
      const parsed = await parseStringPromise(bodyText, { explicitArray: false, mergeAttrs: true });
      return { format: 'xml', parsed, raw: bodyText };
    } catch (err) {
      throw new Error('Erro ao parsear XML: ' + err.message);
    }
  } else {
    // Try JSON
    try {
      const parsed = JSON.parse(bodyText);
      return { format: 'json', parsed, raw: bodyText };
    } catch (err) {
      // fallback: return raw
      return { format: 'text', parsed: bodyText, raw: bodyText };
    }
  }
}

function extractProductFromBling(parsedWrapper) {
  // Bling webhook payloads vary; tentamos localizar o objeto "produto" em várias estruturas comuns.
  // Ajuste conforme o payload real que você receber do Bling.
  const p = parsedWrapper;
  // Possíveis caminhos:
  // parsed.retorno.produtos.produto
  // parsed?.produto
  // parsed?.produto?.produto
  if (!p) return null;
  if (p.retorno && p.retorno.produtos) {
    const prod = p.retorno.produtos.produto || p.retorno.produtos;
    return Array.isArray(prod) ? prod[0] : prod;
  }
  if (p.produto) {
    return Array.isArray(p.produto) ? p.produto[0] : p.produto;
  }
  // Caso seja um object com 'produto' nested:
  if (p.resource && p.resource.produto) return p.resource.produto;
  // Fallback: se o objeto já parece conter campos do produto:
  // heurística simples:
  if (p.codigo || p.descricao || p.sku || p.id) return p;
  return null;
}

function mapBlingToSuri(blingProduct) {
  // Adapte este mapeamento ao esquema exigido pela Suri.
  const sku = blingProduct.codigo || blingProduct.sku || blingProduct.id || null;
  const title = blingProduct.descricao || blingProduct.nome || '';
  // descrição pode estar em 'descricao' ou 'descricaoProduto'
  const description = blingProduct.descricao || blingProduct.descricaoCurta || blingProduct.informacoesadicionais || '';
  const priceRaw = blingProduct.preco || blingProduct.precoVenda || blingProduct.preco_venda || blingProduct.valor || '0';
  const price = Number(String(priceRaw).replace(',', '.')) || 0;
  const stockRaw = blingProduct.estoque || blingProduct.quantidade || blingProduct.qtd || blingProduct.stock || 0;
  const stock_quantity = Number(stockRaw) || 0;

  const images = [];
  // Tenta extrair URLs de imagens em formatos comuns
  if (blingProduct.imagens) {
    // estruturas possíveis: imagens.imagem (array) / imagens => urlImagem
    if (blingProduct.imagens.imagem) {
      const imgs = Array.isArray(blingProduct.imagens.imagem) ? blingProduct.imagens.imagem : [blingProduct.imagens.imagem];
      imgs.forEach(i => {
        if (i.url) images.push(i.url);
        else if (typeof i === 'string') images.push(i);
      });
    } else if (typeof blingProduct.imagens === 'string') {
      images.push(blingProduct.imagens);
    }
  }
  if (blingProduct.urlImagem) images.push(blingProduct.urlImagem);
  if (blingProduct.fotos && Array.isArray(blingProduct.fotos)) {
    blingProduct.fotos.forEach(f => { if (f.url) images.push(f.url); });
  }

  // Remove duplicados e URLs vazias
  const filteredImages = [...new Set(images.filter(Boolean))];

  return {
    sku,
    title,
    description,
    price,
    stock_quantity,
    images: filteredImages
  };
}

async function upsertProductToSuri(suriProduct) {
  if (!SURI_API_URL || !SURI_API_TOKEN) {
    throw new Error('SURI_API_URL e SURI_API_TOKEN devem estar configurados como variáveis de ambiente.');
  }
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SURI_API_TOKEN}`
  };

  // Tente PUT /products/:sku (update/upsert pattern)
  const putUrl = `${SURI_API_URL.replace(/\/$/, '')}/products/${encodeURIComponent(suriProduct.sku)}`;

  try {
    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(suriProduct)
    });

    if (putRes.ok) {
      return { ok: true, action: 'updated', status: putRes.status };
    }

    // Se PUT falhar com 404 ou 400, tenta criar via POST
    if (putRes.status === 404 || putRes.status === 400) {
      const postUrl = `${SURI_API_URL.replace(/\/$/, '')}/products`;
      const postRes = await fetch(postUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(suriProduct)
      });
      if (postRes.ok) {
        return { ok: true, action: 'created', status: postRes.status };
      } else {
        const text = await postRes.text();
        return { ok: false, action: 'create_failed', status: postRes.status, body: text };
      }
    } else {
      const text = await putRes.text();
      return { ok: false, action: 'update_failed', status: putRes.status, body: text };
    }
  } catch (err) {
    return { ok: false, action: 'network_error', error: err.message };
  }
}

async function deleteProductOnSuri(sku) {
  const headers = {
    'Authorization': `Bearer ${SURI_API_TOKEN}`
  };
  const url = `${SURI_API_URL.replace(/\/$/, '')}/products/${encodeURIComponent(sku)}`;
  const res = await fetch(url, { method: 'DELETE', headers });
  return { status: res.status, ok: res.ok, body: await res.text() };
}

exports.handler = async function (event) {
  // Aceita apenas POST (webhook)
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    log('debug', 'Recebido evento:', event.headers);

    const { format, parsed, raw } = await parseBody(event);
    log('debug', 'body-format:', format);
    log('debug', 'parsed-body:', parsed);

    const blingProduct = extractProductFromBling(parsed);
    if (!blingProduct) {
      log('warn', 'Não foi possível extrair produto do payload. Payload recebido:', parsed);
      return { statusCode: 400, body: JSON.stringify({ ok: false, message: 'Produto não encontrado no payload' }) };
    }

    const mapped = mapBlingToSuri(blingProduct);
    if (!mapped.sku) {
      log('warn', 'Produto sem SKU identificado, pulando:', blingProduct);
      return { statusCode: 400, body: JSON.stringify({ ok: false, message: 'Produto sem SKU' }) };
    }

    // Detecta intenção de exclusão (heurística — ajuste conforme payload real do Bling)
    const wantsDelete = (() => {
      // Se houver um campo explícito 'action' ou 'evento' contendo 'delete'/'excluir'
      const action = parsed?.action || parsed?.evento || blingProduct?.acao || blingProduct?.evento;
      if (typeof action === 'string' && /delete|excluir|remover/i.test(action)) return true;
      // Se houver campo 'situacao' indicando inativo
      if (blingProduct.situacao && /inativ|inativo|exclu/i.test(String(blingProduct.situacao))) return true;
      // Se query param ?delete=true estiver na URL (útil para testes)
      try {
        const url = event.rawUrl || event.path || '';
        if (typeof url === 'string' && url.includes('delete=true')) return true;
      } catch (_) {}
      return false;
    })();

    if (wantsDelete) {
      log('info', `Solicitação de delete para SKU=${mapped.sku}`);
      const delRes = await deleteProductOnSuri(mapped.sku);
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, action: 'deleted', result: delRes })
      };
    }

    // Upsert
    const res = await upsertProductToSuri(mapped);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: res.ok, action: res.action, status: res.status, details: res.body || res.error || null })
    };
  } catch (err) {
    console.error('Erro ao processar webhook:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};