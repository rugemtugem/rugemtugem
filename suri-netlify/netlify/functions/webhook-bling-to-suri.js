const { parseStringPromise } = require('xml2js');

const SURI_API_URL = process.env.SURI_API_URL;
const SURI_API_TOKEN = process.env.SURI_API_TOKEN;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

function log(level, ...args) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    if (levels[level] >= levels[LOG_LEVEL]) {
        console[level](...args);
    }
}

function getHeader(headers, name) {
    if (!headers) return undefined;
    const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
    return key ? headers[key] : undefined;
}

async function parseBody(event) {
    const raw = event.body || '';
    const contentType = getHeader(event.headers, 'content-type') || '';
    const bodyText = event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw;

    if (contentType.includes('xml') || bodyText.trim().startsWith('<?xml') || bodyText.trim().startsWith('<')) {
        try {
            const parsed = await parseStringPromise(bodyText, { explicitArray: false, mergeAttrs: true });
            return { format: 'xml', parsed, raw: bodyText };
        } catch (err) {
            throw new Error('Erro ao parsear XML: ' + err.message);
        }
    } else {
        try {
            const parsed = JSON.parse(bodyText);
            return { format: 'json', parsed, raw: bodyText };
        } catch (err) {
            return { format: 'text', parsed: bodyText, raw: bodyText };
        }
    }
}

function extractProductFromBling(parsedWrapper) {
    const p = parsedWrapper;
    if (!p) return null;

    // Estrutura: retorno.produtos.produto
    if (p.retorno && p.retorno.produtos) {
        const prod = p.retorno.produtos.produto || p.retorno.produtos;
        return Array.isArray(prod) ? prod[0] : prod;
    }

    // Estrutura: produto
    if (p.produto) {
        return Array.isArray(p.produto) ? p.produto[0] : p.produto;
    }

    // Estrutura: resource.produto
    if (p.resource && p.resource.produto) return p.resource.produto;

    // Estrutura: data (webhook v2 do Bling)
    if (p.data && (p.data.codigo || p.data.id || p.data.sku)) {
        return p.data;
    }

    // Fallback: se o objeto já contém campos do produto
    if (p.codigo || p.descricao || p.sku || p.id) return p;

    return null;
}

function mapBlingToSuri(blingProduct) {
    // SKU - identificador único
    const sku = blingProduct.codigo || blingProduct.sku || blingProduct.id || null;

    // Nome/Título
    const title = blingProduct.descricao || blingProduct.nome || blingProduct.name || '';

    // Descrição detalhada
    const description = blingProduct.descricaoDetalhada ||
        blingProduct.descricao ||
        blingProduct.descricaoCurta ||
        blingProduct.informacoesAdicionais ||
        '';

    // Preço
    const priceRaw = blingProduct.preco ||
        blingProduct.precoVenda ||
        blingProduct.preco_venda ||
        blingProduct.valor ||
        '0';
    const price = Number(String(priceRaw).replace(',', '.')) || 0;

    // Estoque
    const stockRaw = blingProduct.estoque ||
        blingProduct.quantidade ||
        blingProduct.qtd ||
        blingProduct.stock ||
        0;
    const stock_quantity = Number(stockRaw) || 0;

    // Imagens
    const images = [];

    if (blingProduct.imagens) {
        if (blingProduct.imagens.imagem) {
            const imgs = Array.isArray(blingProduct.imagens.imagem)
                ? blingProduct.imagens.imagem
                : [blingProduct.imagens.imagem];
            imgs.forEach(i => {
                if (i.url) images.push(i.url);
                else if (i.link) images.push(i.link);
                else if (typeof i === 'string') images.push(i);
            });
        } else if (typeof blingProduct.imagens === 'string') {
            images.push(blingProduct.imagens);
        }
    }

    if (blingProduct.urlImagem) images.push(blingProduct.urlImagem);
    if (blingProduct.imagemURL) images.push(blingProduct.imagemURL);

    if (blingProduct.fotos && Array.isArray(blingProduct.fotos)) {
        blingProduct.fotos.forEach(f => {
            if (f.url) images.push(f.url);
            else if (f.link) images.push(f.link);
        });
    }

    // Remove duplicados e URLs vazias
    const filteredImages = [...new Set(images.filter(Boolean))];

    const mapped = {
        sku,
        title,
        description,
        price,
        stock_quantity,
        images: filteredImages
    };

    log('debug', 'Produto mapeado:', mapped);
    return mapped;
}

async function upsertProductToSuri(suriProduct) {
    if (!SURI_API_URL || !SURI_API_TOKEN) {
        throw new Error('SURI_API_URL e SURI_API_TOKEN devem estar configurados como variáveis de ambiente.');
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SURI_API_TOKEN}`
    };

    // Tenta PUT /products/:sku (atualizar)
    const putUrl = `${SURI_API_URL.replace(/\/$/, '')}/products/${encodeURIComponent(suriProduct.sku)}`;

    try {
        log('info', `Tentando atualizar produto SKU=${suriProduct.sku} via PUT`);
        const putRes = await fetch(putUrl, {
            method: 'PUT',
            headers,
            body: JSON.stringify(suriProduct)
        });

        if (putRes.ok) {
            log('info', `Produto SKU=${suriProduct.sku} atualizado com sucesso`);
            return { ok: true, action: 'updated', status: putRes.status };
        }

        // Se PUT falhar com 404 ou 400, tenta criar via POST
        if (putRes.status === 404 || putRes.status === 400) {
            log('info', `Produto não encontrado, tentando criar via POST`);
            const postUrl = `${SURI_API_URL.replace(/\/$/, '')}/products`;
            const postRes = await fetch(postUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(suriProduct)
            });

            if (postRes.ok) {
                log('info', `Produto SKU=${suriProduct.sku} criado com sucesso`);
                return { ok: true, action: 'created', status: postRes.status };
            } else {
                const text = await postRes.text();
                log('error', `Falha ao criar produto: ${postRes.status} - ${text}`);
                return { ok: false, action: 'create_failed', status: postRes.status, body: text };
            }
        } else {
            const text = await putRes.text();
            log('error', `Falha ao atualizar produto: ${putRes.status} - ${text}`);
            return { ok: false, action: 'update_failed', status: putRes.status, body: text };
        }
    } catch (err) {
        log('error', `Erro de rede: ${err.message}`);
        return { ok: false, action: 'network_error', error: err.message };
    }
}

async function deleteProductOnSuri(sku) {
    const headers = {
        'Authorization': `Bearer ${SURI_API_TOKEN}`
    };
    const url = `${SURI_API_URL.replace(/\/$/, '')}/products/${encodeURIComponent(sku)}`;

    try {
        log('info', `Tentando deletar produto SKU=${sku}`);
        const res = await fetch(url, { method: 'DELETE', headers });
        const body = await res.text();
        log('info', `Produto SKU=${sku} deletado - Status: ${res.status}`);
        return { status: res.status, ok: res.ok, body };
    } catch (err) {
        log('error', `Erro ao deletar produto: ${err.message}`);
        return { status: 500, ok: false, error: err.message };
    }
}

exports.handler = async function (event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        log('info', '=== Webhook recebido do Bling ===');
        log('debug', 'Headers:', event.headers);

        const { format, parsed, raw } = await parseBody(event);
        log('info', `Formato do payload: ${format}`);
        log('debug', 'Payload parseado:', JSON.stringify(parsed, null, 2));

        const blingProduct = extractProductFromBling(parsed);
        if (!blingProduct) {
            log('warn', 'Não foi possível extrair produto do payload');
            log('debug', 'Payload recebido:', parsed);
            return {
                statusCode: 400,
                body: JSON.stringify({ ok: false, message: 'Produto não encontrado no payload' })
            };
        }

        log('info', 'Produto extraído do Bling:', blingProduct);

        const mapped = mapBlingToSuri(blingProduct);
        if (!mapped.sku) {
            log('warn', 'Produto sem SKU identificado');
            return {
                statusCode: 400,
                body: JSON.stringify({ ok: false, message: 'Produto sem SKU' })
            };
        }

        // Detecta intenção de exclusão
        const wantsDelete = (() => {
            const action = parsed?.action || parsed?.evento || blingProduct?.acao || blingProduct?.evento;
            if (typeof action === 'string' && /delete|excluir|remover/i.test(action)) return true;

            if (blingProduct.situacao && /inativ|inativo|exclu/i.test(String(blingProduct.situacao))) return true;

            try {
                const url = event.rawUrl || event.path || '';
                if (typeof url === 'string' && url.includes('delete=true')) return true;
            } catch (_) { }

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
        log('info', `Processando upsert para SKU=${mapped.sku}`);
        const res = await upsertProductToSuri(mapped);

        return {
            statusCode: 200,
            body: JSON.stringify({
                ok: res.ok,
                action: res.action,
                status: res.status,
                details: res.body || res.error || null
            })
        };
    } catch (err) {
        log('error', 'Erro ao processar webhook:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ ok: false, error: err.message })
        };
    }
};
