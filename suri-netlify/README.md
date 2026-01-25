# Integração Bling → Suri (Netlify Function)

Esta função Netlify recebe webhooks do Bling e sincroniza produtos automaticamente com a API da Suri, permitindo que os produtos apareçam na seção shop da plataforma Suri.

## 🚀 Funcionalidades

- ✅ Recebe webhooks do Bling (JSON ou XML)
- ✅ Cria produtos automaticamente na Suri
- ✅ Atualiza produtos existentes (upsert)
- ✅ Suporta exclusão de produtos
- ✅ Logs detalhados para debugging
- ✅ Tratamento robusto de erros

## 📋 Pré-requisitos

- Conta no [Netlify](https://www.netlify.com/)
- Conta no [Bling](https://www.bling.com.br/)
- Acesso à API da [Suri](https://suri.ai/)
- Node.js 18.x ou superior (para desenvolvimento local)

## 🔧 Configuração

### 1. Clone e Instale Dependências

```bash
cd c:\xampp\htdocs\suri-netlify
npm install
```

### 2. Configure Variáveis de Ambiente

Copie o arquivo de exemplo e preencha com suas credenciais:

```bash
cp .env.example .env
```

Edite o arquivo `.env`:

```env
SURI_API_URL=https://api.suri.com.br
SURI_API_TOKEN=seu_token_bearer_da_suri
LOG_LEVEL=info
```

**Onde obter as credenciais:**
- **SURI_API_URL**: URL base da API Suri (geralmente `https://api.suri.com.br`)
- **SURI_API_TOKEN**: Token de autenticação fornecido pela Suri
- **LOG_LEVEL**: Nível de log (`debug`, `info`, `warn`, `error`)

### 3. Deploy no Netlify

#### Opção A: Via Git (Recomendado)

1. Faça commit do código para um repositório Git (GitHub, GitLab, etc.)
2. Acesse [Netlify](https://app.netlify.com/)
3. Clique em "Add new site" → "Import an existing project"
4. Conecte seu repositório
5. Configure as variáveis de ambiente no painel do Netlify:
   - Site Settings → Environment Variables
   - Adicione `SURI_API_URL` e `SURI_API_TOKEN`
6. Faça deploy

#### Opção B: Via Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

### 4. Configure o Webhook no Bling

Após o deploy, você terá uma URL como:
```
https://seu-site.netlify.app/.netlify/functions/webhook-bling-to-suri
```

Siga o guia detalhado: [docs/BLING_WEBHOOK_SETUP.md](docs/BLING_WEBHOOK_SETUP.md)

**Resumo:**
1. Acesse [Bling Developer Portal](https://developer.bling.com.br)
2. Crie/selecione sua aplicação
3. Adicione o scope **produto**
4. Configure o webhook com a URL acima
5. Selecione eventos: criação, atualização, exclusão de produtos

## 🧪 Testes Locais

### Executar servidor local

```bash
npm start
```

O servidor estará disponível em `http://localhost:8888`

### Testar com payload JSON

```bash
curl -X POST "http://localhost:8888/.netlify/functions/webhook-bling-to-suri" \
  -H "Content-Type: application/json" \
  -d '{
    "produto": {
      "codigo": "TEST001",
      "descricao": "Produto de Teste",
      "preco": "99.90",
      "estoque": "10",
      "urlImagem": "https://example.com/image.jpg"
    }
  }'
```

### Testar com payload XML

```bash
curl -X POST "http://localhost:8888/.netlify/functions/webhook-bling-to-suri" \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0" encoding="UTF-8"?>
  <retorno>
    <produtos>
      <produto>
        <codigo>TEST001</codigo>
        <descricao>Produto de Teste</descricao>
        <preco>99.90</preco>
        <estoque>10</estoque>
        <urlImagem>https://example.com/image.jpg</urlImagem>
      </produto>
    </produtos>
  </retorno>'
```

## 📊 Mapeamento de Campos

| Bling | Suri | Descrição |
|-------|------|-----------|
| `codigo` / `sku` / `id` | `sku` | Identificador único do produto |
| `descricao` / `nome` | `title` | Nome do produto |
| `descricaoDetalhada` / `descricao` | `description` | Descrição completa |
| `preco` / `precoVenda` | `price` | Preço (convertido para número) |
| `estoque` / `quantidade` | `stock_quantity` | Quantidade em estoque |
| `imagens` / `urlImagem` | `images` | Array de URLs de imagens |

## 📚 Documentação Adicional

- [Configuração do Webhook no Bling](docs/BLING_WEBHOOK_SETUP.md)
- [Documentação da API Suri](docs/SURI_API.md)

## 🐛 Troubleshooting

### Webhook não está sendo recebido

1. Verifique se o scope "produto" está configurado no Bling
2. Confirme que a URL do webhook está correta
3. Verifique se você completou o fluxo de autorização OAuth no Bling

### Erro 401/403 na API Suri

1. Verifique se `SURI_API_TOKEN` está correto
2. Confirme que o token tem permissões para criar/atualizar produtos
3. Verifique se `SURI_API_URL` está correto

### Produto não aparece na Suri

1. Verifique os logs da função no Netlify: `https://app.netlify.com/sites/seu-site/functions`
2. Confirme que o produto tem um SKU válido
3. Verifique se a resposta da API Suri indica sucesso

### Logs detalhados

Para ativar logs de debug, configure:
```env
LOG_LEVEL=debug
```

## 🔄 Fluxo de Dados

```
┌─────────┐      Webhook       ┌──────────────┐      API Call      ┌──────┐
│  Bling  │ ───────────────▶  │   Netlify    │ ─────────────────▶ │ Suri │
│         │   (JSON/XML)       │   Function   │   (JSON)           │      │
└─────────┘                    └──────────────┘                    └──────┘
                                      │
                                      ▼
                               1. Parse payload
                               2. Extract product
                               3. Map fields
                               4. Upsert to Suri
```

## 📝 Estrutura do Projeto

```
suri-netlify/
├── netlify/
│   └── functions/
│       └── webhook-bling-to-suri.js  # Função principal
├── docs/
│   ├── BLING_WEBHOOK_SETUP.md        # Guia de configuração Bling
│   └── SURI_API.md                   # Documentação API Suri
├── .env.example                       # Exemplo de variáveis de ambiente
├── .gitignore                         # Arquivos ignorados pelo Git
├── netlify.toml                       # Configuração Netlify
├── package.json                       # Dependências do projeto
└── README.md                          # Este arquivo
```

## 🤝 Suporte

Para problemas ou dúvidas:
- Verifique a [documentação do Bling](https://developer.bling.com.br)
- Consulte a [documentação da Suri](https://documenter.getpostman.com/view/17684221/UUxz9mt5)
- Revise os logs da função no painel do Netlify

## 📄 Licença

Este projeto é fornecido como está, sem garantias.