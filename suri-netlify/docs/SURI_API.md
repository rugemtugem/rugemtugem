# API Suri - Documentação

Esta documentação descreve os endpoints da API Suri utilizados nesta integração.

## Base URL

```
https://api.suri.com.br
```

## Autenticação

Todas as requisições devem incluir o header de autenticação:

```
Authorization: Bearer SEU_TOKEN_AQUI
```

## Endpoints de Produtos

### Criar Produto

Cria um novo produto na Suri.

**Endpoint:** `POST /products`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Body:**
```json
{
  "sku": "SKU123",
  "title": "Nome do Produto",
  "description": "Descrição detalhada do produto",
  "price": 99.90,
  "stock_quantity": 10,
  "images": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ]
}
```

**Resposta de Sucesso (201):**
```json
{
  "id": "produto-id-123",
  "sku": "SKU123",
  "title": "Nome do Produto",
  "description": "Descrição detalhada do produto",
  "price": 99.90,
  "stock_quantity": 10,
  "images": ["https://example.com/image1.jpg"],
  "created_at": "2026-01-12T19:50:00Z"
}
```

---

### Atualizar Produto

Atualiza um produto existente na Suri.

**Endpoint:** `PUT /products/{sku}`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Body:**
```json
{
  "sku": "SKU123",
  "title": "Nome do Produto Atualizado",
  "description": "Nova descrição",
  "price": 89.90,
  "stock_quantity": 15,
  "images": [
    "https://example.com/new-image.jpg"
  ]
}
```

**Resposta de Sucesso (200):**
```json
{
  "id": "produto-id-123",
  "sku": "SKU123",
  "title": "Nome do Produto Atualizado",
  "description": "Nova descrição",
  "price": 89.90,
  "stock_quantity": 15,
  "images": ["https://example.com/new-image.jpg"],
  "updated_at": "2026-01-12T20:00:00Z"
}
```

**Resposta de Erro (404):**
```json
{
  "error": "Product not found",
  "message": "No product found with SKU: SKU123"
}
```

---

### Deletar Produto

Remove um produto da Suri.

**Endpoint:** `DELETE /products/{sku}`

**Headers:**
```
Authorization: Bearer {token}
```

**Resposta de Sucesso (200 ou 204):**
```json
{
  "message": "Product deleted successfully",
  "sku": "SKU123"
}
```

---

## Campos do Produto

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `sku` | string | Sim | Identificador único do produto (código/SKU) |
| `title` | string | Sim | Nome/título do produto |
| `description` | string | Não | Descrição detalhada do produto |
| `price` | number | Sim | Preço do produto (formato decimal) |
| `stock_quantity` | number | Sim | Quantidade em estoque |
| `images` | array | Não | Array de URLs de imagens do produto |

## Códigos de Status HTTP

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso - Recurso atualizado ou deletado |
| 201 | Sucesso - Recurso criado |
| 400 | Bad Request - Dados inválidos |
| 401 | Unauthorized - Token inválido ou ausente |
| 403 | Forbidden - Sem permissão para a operação |
| 404 | Not Found - Recurso não encontrado |
| 500 | Internal Server Error - Erro no servidor |

## Notas Importantes

1. **SKU como Identificador**: O SKU é usado como identificador único. Não pode haver produtos duplicados com o mesmo SKU.

2. **Preço**: Deve ser enviado como número decimal (ex: `99.90`), não como string.

3. **Imagens**: URLs devem ser públicas e acessíveis. A Suri pode fazer cache das imagens.

4. **Rate Limiting**: A API pode ter limites de requisições. Consulte a documentação oficial da Suri para detalhes.

5. **Webhooks da Suri**: A Suri também pode enviar webhooks quando produtos são alterados. Consulte a documentação oficial para configurar.

## Referências

- [Documentação Oficial da API Suri](https://documenter.getpostman.com/view/17684221/UUxz9mt5)
- [Manual de Integração Suri](https://sejasuri.gitbook.io/manual-de-integracao)
