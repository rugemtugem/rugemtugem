# Configuração do Webhook no Bling

Este guia mostra como configurar o webhook do Bling para enviar eventos de produtos para a função Netlify.

## Pré-requisitos

- Conta ativa no Bling
- Aplicação registrada no Bling Developer Portal
- URL da função Netlify deployada

## Passo a Passo

### 1. Acessar o Bling Developer Portal

1. Acesse [https://developer.bling.com.br](https://developer.bling.com.br)
2. Faça login com sua conta Bling
3. Acesse "Minhas Aplicações"

### 2. Criar ou Selecionar Aplicação

Se você ainda não tem uma aplicação:
1. Clique em "Nova Aplicação"
2. Preencha os dados básicos:
   - Nome da aplicação
   - Descrição
   - URL de redirecionamento (pode ser qualquer URL válida se não for usar OAuth)

### 3. Configurar Scopes

Para receber webhooks de produtos, você precisa adicionar o scope correto:

1. Na página da sua aplicação, vá para "Dados Básicos"
2. Na seção "Scopes", adicione:
   - **produto** (obrigatório para webhooks de produtos)
3. Salve as alterações

### 4. Configurar Webhook

1. Na página da sua aplicação, clique na aba "Webhooks"
2. Clique em "Adicionar Servidor"
3. Configure:
   - **URL do Servidor**: `https://seu-site.netlify.app/.netlify/functions/webhook-bling-to-suri`
   - **Recursos**: Selecione "produto"
   - **Eventos**: Marque os eventos desejados:
     - Criação de produto
     - Atualização de produto
     - Exclusão de produto (opcional)

### 5. Obter Token de Acesso

Para que o webhook funcione, você precisa autorizar a aplicação:

1. Ainda na página da aplicação, copie o **Client ID** e **Client Secret**
2. Siga o fluxo de autorização OAuth do Bling para obter um token de acesso
3. Após autorização, os webhooks começarão a ser enviados automaticamente

## Estrutura do Payload

O Bling pode enviar webhooks em formato JSON ou XML. Exemplos:

### JSON
```json
{
  "produto": {
    "codigo": "SKU123",
    "descricao": "Nome do Produto",
    "preco": "99.90",
    "estoque": "10",
    "imagens": {
      "imagem": {
        "url": "https://example.com/image.jpg"
      }
    }
  }
}
```

### XML
```xml
<?xml version="1.0" encoding="UTF-8"?>
<retorno>
  <produtos>
    <produto>
      <codigo>SKU123</codigo>
      <descricao>Nome do Produto</descricao>
      <preco>99.90</preco>
      <estoque>10</estoque>
      <urlImagem>https://example.com/image.jpg</urlImagem>
    </produto>
  </produtos>
</retorno>
```

## Testando o Webhook

Após configurar:

1. Crie ou edite um produto no Bling
2. Verifique os logs da função Netlify em: `https://app.netlify.com/sites/seu-site/functions`
3. Confirme que o produto foi sincronizado na Suri

## Troubleshooting

### Webhook não está sendo recebido

- Verifique se o scope "produto" está adicionado na aplicação
- Confirme que a URL do webhook está correta
- Verifique se você completou o fluxo de autorização OAuth

### Erros 401/403

- Verifique se as variáveis de ambiente `SURI_API_URL` e `SURI_API_TOKEN` estão configuradas corretamente no Netlify

### Produto não aparece na Suri

- Verifique os logs da função Netlify para ver se há erros
- Confirme que o token da Suri tem permissões para criar/atualizar produtos
- Verifique se o endpoint da API Suri está correto

## Referências

- [Documentação de Webhooks do Bling](https://developer.bling.com.br/webhooks)
- [Documentação da API Bling](https://developer.bling.com.br/aplicacoes)
