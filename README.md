# Mural de Avisos IFC

Sistema de mural digital desenvolvido para o IFC, permitindo que a comunidade publique e consulte comunicados de forma organizada. O projeto usa login com OAuth com Google e Microsoft (contas [ifc.edu.br] de estudantes ou servidores após logar no email Microsoft).

## Autenticação

- Google OAuth 2.0, Microsoft OAuth 2.0 e JSON Web Tokens (JWT)

## Configuração e Instalação

### Para rodar o projeto

Clone o repositório e instale as dependências:

```bash
npm install
```

### Variáveis de Ambiente (.env)

Crie um arquivo `.env` na raiz do projeto e preencha conforme o exemplo:

```ini
PORT=3000
JWT_SECRET=sua_chave_secreta_aqui_gerada_aleatoriamente

# EXEMPLOS DE FORMATO (Substitua pelos seus)
GOOGLE_CLIENT_ID=000000000000-exemplo.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-exemplo_secret_google

MS_CLIENT_ID=00000000-0000-0000-0000-000000000000
MS_CLIENT_SECRET=exemplo~valor~da~chave~microsoft
```

> **Importante:** As Redirect URIs no console do Google/Azure devem ser:
> `http://localhost:3000/auth/google/callback` e `http://localhost:3000/auth/microsoft/callback`

### Execução

```bash
node server.js
```

Acesse: [http://localhost:3000](http://localhost:3000)

## Autenticação e API

O projeto utiliza um fluxo de OAuth2 para validar o e-mail institucional e gera um Token JWT que é armazenado no `localStorage` do navegador. Somente usuários com token válido podem consumir a API de avisos, e um usuário só tem permissão para excluir seus próprios posts.
