# Prompt reutilizavel: tela de login padrao RaroNexus

Voce esta trabalhando em um projeto web integrado ao RaroNexus e precisa criar ou padronizar a tela `/login` seguindo o padrao visual e comportamental descrito neste documento.

Use este prompt quando a autenticacao com RaroNexus ja existir ou estiver sendo implementada pelo prompt geral `docs/raronexus-integration-prompt.md`. Este arquivo trata apenas da tela de login e dos endpoints que ela consome.

## Objetivo

Criar uma tela de login padrao para projetos integrados ao RaroNexus, mantendo o fluxo padrao de login RaroNexus e alterando apenas:

- Nome do sistema: `[NOME_DO_SISTEMA]`
- Trecho destacado opcional do nome: `[NOME_DESTACADO_OPCIONAL]`
- Caminho do icone/logo do sistema: `[CAMINHO_DO_ICONE]`
- Rota padrao apos login: `[ROTA_PADRAO_APOS_LOGIN]`
- Evento local de troca de tema, se existir: `[THEME_CHANGE_EVENT]`

## Padrao esperado

Este documento contem a especificacao completa da tela. O agente que implementar esta tarefa nao precisa conhecer nenhum projeto anterior para reproduzir o padrao.

A tela final deve manter:

- Estrutura centralizada em tela cheia.
- Fundo escuro `bg-slate-950`.
- Card de login compacto.
- Logo do sistema acima do titulo.
- Botao principal azul para login com RaroNexus.
- Tentativa de SSO silencioso antes do login interativo.
- Popup para o fluxo interativo.
- Escuta de `postMessage` enviado pelo callback SSO.

## Implementacao esperada

Criar uma pagina `/login` em Next.js App Router com componente client-side:

```tsx
"use client";
```

Use, no minimo:

- `Suspense`
- `useRouter`
- `useSearchParams`
- `useMemo`
- `useEffect`
- `useState`
- `useRef`

Quando o projeto possuir suporte a tema, integrar com o mecanismo local ja existente. Se houver um evento proprio para sincronizar mudanca de tema, usar `[THEME_CHANGE_EVENT]`. Se nao houver suporte a tema no projeto, remover apenas o botao de tema, preservando todo o restante da tela.

## Layout visual padrao

O layout deve seguir este padrao:

- `<main>` com `relative min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10`.
- Botao de tema no canto superior direito, quando aplicavel:
  - `absolute right-4 top-4`
  - icone de sol/lua
  - `aria-label` e `title` coerentes com o tema atual
- Container central:
  - `w-full max-w-md space-y-8`
- Bloco de cabecalho:
  - `text-center space-y-4`
- Logo:
  - `src="[CAMINHO_DO_ICONE]"`
  - `alt="[NOME_DO_SISTEMA]"`
  - `className="mx-auto h-16 w-16 rounded-2xl bg-white object-contain"`
- Titulo:
  - exibir `[NOME_DO_SISTEMA]`
  - se fizer sentido destacar parte do nome, aplicar destaque visual em `[NOME_DESTACADO_OPCIONAL]`, como `text-blue-400`
- Subtitulo:
  - `Entre com sua conta RaroNexus para acessar a plataforma.`
- Card:
  - `rounded-xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl`
- Botao de login:
  - `flex w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-500`
  - incluir icone de chave
  - texto final `Entrar com RaroNexus`

## Comportamento de autenticacao

A tela deve preservar o fluxo padrao de login RaroNexus.

### Sanitizacao da proxima rota

Ler `next` da query string e aceitar apenas paths internos seguros:

- deve existir
- deve comecar com `/`
- nao pode comecar com `//`
- nao pode comecar com `/api/`

Se `next` for invalido ou ausente, usar `[ROTA_PADRAO_APOS_LOGIN]`.

### Verificacao de sessao existente

Ao montar a tela:

- chamar `GET /api/auth/session`
- se a resposta indicar usuario autenticado e com papel/permissao valida, redirecionar para `nextPath`
- se nao houver sessao local valida, iniciar tentativa de SSO silencioso

### SSO silencioso

Criar uma URL de iframe oculto:

```txt
/api/auth/raronexus/start?mode=silent&next=[nextPath]&attempt=[timestamp]
```

Renderizar:

```tsx
<iframe title="Verificacao RaroNexus" src={silentSsoUrl} className="hidden" />
```

Manter estado de verificacao por alguns segundos e depois liberar o botao de login interativo caso o silent SSO nao finalize.

### Login interativo

Ao clicar no botao principal:

- limpar mensagens e erros anteriores
- ativar estado de loading
- abrir popup:

```txt
/api/auth/raronexus/start?next=[nextPath]
```

Usar nome de janela:

```txt
raronexus-login
```

Usar dimensoes proximas de:

```txt
width=520,height=720,menubar=no,toolbar=no,location=no,status=no
```

Se o popup for bloqueado, exibir:

```txt
Permita popups para entrar com RaroNexus.
```

Monitorar fechamento do popup para remover o loading se o usuario fechar a janela antes de concluir.

### Mensagens do callback

Escutar mensagens com:

```ts
window.addEventListener("message", handleMessage);
```

Aceitar apenas mensagens onde:

- `event.origin === window.location.origin`
- `event.data?.type === "raronexus:sso"`

Ao receber mensagem:

- encerrar monitoramento do popup
- remover loading quando o modo nao for `silent`
- marcar verificacao silenciosa como encerrada
- se `status === "success"`, redirecionar para `event.data.redirectTo || nextPath`
- se houver erro interativo, mostrar `event.data.message` ou a mensagem padrao:

```txt
Nao foi possivel entrar com RaroNexus.
```

## Textos obrigatorios

Preservar os textos abaixo para manter consistencia entre os projetos:

- `Verificando RaroNexus...`
- `Aguardando RaroNexus...`
- `Entrar com RaroNexus`
- `Nao foi possivel entrar com RaroNexus.`
- `Permita popups para entrar com RaroNexus.`
- `Carregando...`
- `Entre com sua conta RaroNexus para acessar a plataforma.`

## Cuidados obrigatorios

- Nao alterar o fluxo SSO se os endpoints ja seguirem o padrao do RaroNexus.
- Nao implementar token no client.
- Nao usar `localStorage` para sessao.
- Nao expor `RARONEXUS_CLIENT_SECRET`.
- Nao aceitar redirects externos no parametro `next`.
- Nao misturar neste prompt a implementacao completa do backend de autenticacao; para isso, usar `docs/raronexus-integration-prompt.md`.
- Adaptar apenas nome, logo/icone, rota padrao apos login e integracao com tema local.

## Checklist de aceite

Ao finalizar a tela, validar:

- `/login` renderiza em tela cheia com fundo escuro e conteudo centralizado.
- O logo em `[CAMINHO_DO_ICONE]` aparece acima do titulo.
- O nome `[NOME_DO_SISTEMA]` aparece no titulo.
- O botao mostra `Verificando RaroNexus...` durante a verificacao inicial.
- O botao mostra `Aguardando RaroNexus...` durante o popup.
- O botao mostra `Entrar com RaroNexus` quando esta pronto para interacao.
- A tela tenta `/api/auth/session` antes de abrir qualquer popup.
- A tela cria iframe oculto para SSO silencioso.
- O popup abre a rota `/api/auth/raronexus/start?next=...`.
- O `postMessage` `raronexus:sso` redireciona corretamente em caso de sucesso.
- Erros interativos aparecem em mensagem amigavel dentro do card.
- O parametro `next` invalido cai em `[ROTA_PADRAO_APOS_LOGIN]`.

Ao implementar, siga este documento como fonte unica do padrao de tela e ajuste somente os placeholders do sistema alvo.
