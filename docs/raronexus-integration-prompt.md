# Prompt reutilizavel: integrar um projeto ao RaroNexus

Voce esta trabalhando em um novo projeto web e precisa integra-lo ao RaroNexus, a central de autenticacao SSO usada pelos projetos da Rarotec.

## Objetivo

Implementar autenticacao completa com RaroNexus seguindo o padrao ja usado no projeto RaroStock.

## Contexto do projeto

- Nome do projeto: `[NOME_DO_PROJETO]`
- Client ID no RaroNexus: `[RARONEXUS_CLIENT_ID]`
- URL base local/producao do projeto: `[APP_BASE_URL]`
- URL base do RaroNexus: `[RARONEXUS_BASE_URL]`
- Framework: `[Next.js App Router / outro]`
- Rotas protegidas: `[LISTAR_ROTAS]`
- Rota inicial apos login: `[ROTA_PADRAO, ex: /dashboard]`
- Papeis/permissoes esperados: `[admin, gestor, visualizador, nao_autorizado ou outros]`

## Variaveis de ambiente necessarias

- `RARONEXUS_BASE_URL`
- `RARONEXUS_CLIENT_ID`
- `RARONEXUS_CLIENT_SECRET`
- `APP_BASE_URL`, ou uma variavel equivalente especifica do projeto, por exemplo `RAROSTOCK_BASE_URL`

## Fluxo a implementar

### 1. Cookies de autenticacao

- Criar um cookie HTTP-only para armazenar o `global_session_token` recebido do RaroNexus.
- Nomear o cookie de forma especifica para o projeto, por exemplo: `[client_id]_global_session`.
- Usar:
  - `httpOnly: true`
  - `sameSite: "lax"`
  - `secure: process.env.NODE_ENV === "production"`
  - `path: "/"`
  - `maxAge` persistente, se o projeto desejar sessao longa.
- Criar tambem cookies temporarios para:
  - estado SSO: `[client_id]_sso_state`
  - proxima rota: `[client_id]_sso_next`

### 2. Inicio do login SSO

Criar a rota:

`GET /api/auth/raronexus/start`

Ela deve:

- Ler `next` da query string.
- Sanitizar `next`, permitindo apenas paths internos que:
  - comecam com `/`
  - nao comecam com `//`
  - nao comecam com `/api/`
- Gerar um `state` aleatorio seguro com `crypto.randomBytes`.
- Aceitar modo silencioso via `mode=silent`.
- Montar a URL:

`[RARONEXUS_BASE_URL]/sso/authorize`

Com os parametros:

- `client_id`
- `redirect_uri`
- `state`
- `prompt=none`, apenas se `mode=silent`

O `redirect_uri` deve ser:

`[APP_BASE_URL]/api/auth/raronexus/callback`

Salvar `state` e `next` em cookies HTTP-only temporarios com expiracao curta, por exemplo 5 minutos.

### 3. Callback SSO

Criar a rota:

`GET /api/auth/raronexus/callback`

Ela deve:

- Receber `code`, `state` e `error`.
- Validar se o `state` recebido bate com o cookie salvo.
- Em caso de erro ou state invalido, limpar cookies de sessao e responder com uma pagina HTML simples que envie `postMessage` para a janela pai/opener.
- Trocar o `code` por sessao chamando:

`POST [RARONEXUS_BASE_URL]/api/v1/sso/token`

Com JSON:

```json
{
  "grant_type": "authorization_code",
  "client_id": "[RARONEXUS_CLIENT_ID]",
  "client_secret": "[RARONEXUS_CLIENT_SECRET]",
  "code": "[CODE]",
  "redirect_uri": "[APP_BASE_URL]/api/auth/raronexus/callback"
}
```

A resposta esperada do RaroNexus possui:

```ts
{
  success: boolean;
  message?: string;
  data?: {
    global_session_token: string;
    user: {
      id: string;
      nome: string;
      email: string;
      avatar_url?: string | null;
    };
    role: {
      chave: string;
      nome: string;
    };
  };
}
```

- Validar o papel retornado em `role.chave`.
- Bloquear acesso se o usuario nao tiver papel autorizado para o app.
- Salvar `global_session_token` no cookie HTTP-only do projeto.
- Limpar cookies temporarios de SSO.
- Retornar uma pequena pagina HTML que faca:

```js
window.opener?.postMessage({
  type: "raronexus:sso",
  status: "success" | "error",
  mode: "interactive" | "silent",
  message,
  redirectTo
}, window.location.origin)
```

Se nao houver opener, redirecionar diretamente para `redirectTo`.

### 4. Introspeccao de sessao

Criar helper server-side equivalente a:

`getSessionFromRequest(request)`

Ele deve:

- Ler o token do cookie HTTP-only.
- Chamar:

`POST [RARONEXUS_BASE_URL]/api/v1/sessions/introspect`

Com JSON:

```json
{
  "token": "[GLOBAL_SESSION_TOKEN]",
  "client_id": "[RARONEXUS_CLIENT_ID]"
}
```

A resposta esperada:

```ts
{
  success: boolean;
  message?: string;
  data?: {
    active: boolean;
    user: {
      id: string;
      nome: string;
      email: string;
      avatar_url?: string | null;
    };
    role: {
      id: string;
      nome: string;
      chave: string;
    };
  };
}
```

- Se a sessao estiver ativa e o papel for valido, retornar `{ role, user }`.
- Caso contrario, retornar `null`.

### 5. Endpoint de sessao do app

Criar:

`GET /api/auth/session`

Ele deve:

- Usar `getSessionFromRequest`.
- Se nao houver sessao valida, retornar:

```json
{
  "authenticated": false,
  "role": null,
  "permissions": {}
}
```

E limpar cookies locais.

- Se houver sessao valida, retornar:

```json
{
  "authenticated": true,
  "role": "...",
  "label": "...",
  "description": "...",
  "user": {
    "id": "...",
    "nome": "...",
    "email": "...",
    "avatar_url": "..."
  },
  "permissions": {
    "...": true
  }
}
```

### 6. Logout

Criar:

`POST /api/auth/logout`

Ele deve:

- Ler o token global do cookie.
- Se existir, chamar:

`POST [RARONEXUS_BASE_URL]/api/v1/sessions/revoke`

Com JSON:

```json
{
  "token": "[GLOBAL_SESSION_TOKEN]"
}
```

- Limpar cookies locais.
- Retornar `{ ok: true }`.

### 7. Protecao de APIs

Criar helpers como:

```ts
requirePermission(request, predicate)
hasAuthError(result)
```

Uso esperado nas rotas internas:

```ts
const auth = await requirePermission(req, canView);
if (hasAuthError(auth)) return auth.response;
```

Os helpers devem:

- Retornar 401 e limpar sessao se nao houver autenticacao.
- Retornar 403 se o papel nao tiver permissao.
- Retornar `{ role, user }` quando autorizado.

### 8. Tela de login

Criar uma pagina `/login` que:

- Verifique primeiro `/api/auth/session`.
- Se ja autenticado, redirecione para `next`.
- Tente SSO silencioso usando um iframe oculto:

`/api/auth/raronexus/start?mode=silent&next=[next]`

- Exiba botao "Entrar com RaroNexus".
- Ao clicar, abrir popup:

`/api/auth/raronexus/start?next=[next]`

- Escutar `window.message` com `type === "raronexus:sso"`.
- Em caso de sucesso, redirecionar para `redirectTo`.
- Em caso de erro interativo, mostrar mensagem amigavel.
- Se popup for bloqueado, mostrar instrucao para permitir popups.

### 9. Shell/layout protegido

No layout das areas privadas:

- Ao montar, chamar `/api/auth/session`.
- Enquanto verifica, mostrar loading.
- Se nao autenticado, redirecionar para:

`/login?next=[rota_atual]`

- Guardar `role`, `user` e permissoes em contexto/hook.
- Interceptar respostas 401 de APIs internas:
  - chamar `/api/auth/logout`
  - redirecionar para login com `next`.

### 10. Aplicacoes do RaroNexus no header, se aplicavel

Criar opcionalmente:

`GET /api/auth/applications`

Ele deve:

- Ler o token global.
- Chamar:

`GET [RARONEXUS_BASE_URL]/api/v1/applications`

Com header:

```http
Cookie: raronexus_global_session=[token]
```

- Retornar a lista de apps ativos autorizados, excluindo o app atual.
- Incluir link para o perfil:

`[RARONEXUS_BASE_URL]/profile`

### 11. Cuidados obrigatorios

- Nao expor `RARONEXUS_CLIENT_SECRET` no client.
- Nunca salvar token global em `localStorage` ou JS acessivel pelo browser.
- Sanitizar todo `next`.
- Usar cookies HTTP-only para sessao.
- Validar `state` no callback para evitar CSRF.
- Usar `cache: "no-store"` nas chamadas de sessao/introspeccao.
- Tratar falha do RaroNexus como sessao invalida ou erro 502, conforme o endpoint.
- Adaptar nomes de cookies, mensagens e roles para o novo projeto.
- Manter o fluxo compativel com popup e silent SSO via iframe.

Ao implementar, siga os padroes existentes do projeto, preserve a arquitetura local e entregue os arquivos necessarios para autenticacao completa com RaroNexus.
