# Publicação: Render + Neon

Este guia coloca a Sala de Enigmas no ar sem gastar nada e sem cartão de crédito:

- **Render** hospeda o servidor (API e tempo real) e o site.
- **Neon** hospeda o banco PostgreSQL.

Tudo parte do arquivo `render.yaml` (na raiz do repositório), que descreve os dois serviços da Render.

> Os nomes dos botões e das telas podem mudar um pouco com o tempo. Se algo não estiver igual, procure o item com o mesmo sentido.

## O que esperar do plano gratuito

- O servidor **dorme** depois de 15 minutos sem acesso e leva cerca de **1 minuto para acordar** quando alguém abre o site.
- A Render pode reiniciar o servidor a qualquer momento. As salas e o histórico ficam no banco, e o site reconecta sozinho.
- Antes de uma apresentação ou de um teste, **abra o site uns 2 minutos antes** para ele acordar.
- O banco da Neon também dorme quando fica parado e acorda na próxima consulta, em uma fração de segundo.

## Antes de começar

1. Faça o commit e o *push* deste pacote no GitHub (o `render.yaml` precisa estar na raiz do repositório, ao lado de `backend/` e `frontend/`).
2. Escolha o **e-mail** e a **senha** do primeiro mestre (use uma senha forte). Eles serão pedidos na Render.

## Parte 1: criar o banco na Neon

1. Entre em [neon.com](https://neon.com) e crie a conta (dá para entrar com o GitHub, sem cartão).
2. Crie um projeto novo:
   - Nome: `sala-enigma`.
   - Região: **AWS US East 1 (N. Virginia)**, a mesma do servidor da Render.
3. Na tela do projeto, clique em **Connect** (ou "Connection details").
4. Escolha a conexão **direta**: o endereço do servidor **não** deve ter `-pooler` no nome. Se houver uma opção "Connection pooling", deixe desligada.
5. Copie o endereço de conexão. Ele começa com `postgresql://` e termina com `?sslmode=require`. **Guarde esse texto**, ele será colado na Render. Não envie nem publique em lugar nenhum: ele contém a senha do banco.

## Parte 2: criar os serviços na Render

1. Entre em [render.com](https://render.com) e crie a conta com o GitHub. Autorize o acesso ao repositório `Enigma`.
2. Clique em **New** e depois em **Blueprint**.
3. Escolha o repositório `Enigma` e a branch `main`. A Render lê o `render.yaml` e mostra os dois serviços que vai criar:
   - `sala-enigma-api` (Web Service, plano Free)
   - `sala-enigma-site` (Static Site)
4. A Render pede **três valores**. Preencha:
   | Campo | O que colocar |
   |---|---|
   | `DATABASE_URL` | O endereço de conexão da Neon (Parte 1) |
   | `ADMIN_EMAIL` | O e-mail do primeiro mestre |
   | `ADMIN_PASSWORD` | A senha do primeiro mestre |
5. Clique para aplicar (**Apply** ou **Deploy Blueprint**) e espere. O primeiro deploy leva alguns minutos.

O que o servidor faz sozinho ao iniciar: cria as tabelas no banco (migrations), cria o primeiro mestre (seed) e liga o tempo real. Nos reinícios seguintes ele só confere que está tudo em dia, sem apagar nada.

## Parte 3: conferir que funcionou

1. Abra o serviço `sala-enigma-api` na Render e veja os **Logs**. Devem aparecer estas linhas:
   - `Batch 1 run: 5 migrations`
   - `Admin criado: ...`
   - `API rodando na porta 10000`
2. Abra `https://sala-enigma-api.onrender.com/health` no navegador. Deve responder `{"status":"ok"}`. A primeira vez pode demorar cerca de 1 minuto (o servidor acordando).
3. Abra `https://sala-enigma-site.onrender.com` e entre com o e-mail e a senha do mestre. Você deve ver o **Painel do mestre**.
4. Teste com **dois aparelhos**: no celular, cadastre um jogador e entre em uma sala criada pelo mestre no computador. A lista de jogadores deve atualizar na hora nos dois.

### Se os endereços forem diferentes

O `render.yaml` supõe que o servidor ficará em `https://sala-enigma-api.onrender.com`. Se a Render der outro endereço (porque o nome já estava em uso, ela acrescenta letras no final):

1. Copie o endereço real do servidor (aparece no topo da página do `sala-enigma-api`).
2. No serviço `sala-enigma-site`, abra **Environment**, troque o valor de `VITE_API_URL` por esse endereço (sem `/` no final) e salve.
3. Faça um novo deploy do site (**Manual Deploy**).

## Atualizar o projeto

Cada `git push` na branch `main` publica o servidor e o site automaticamente.

## Proteção extra (opcional)

Por padrão o tempo real (Socket.IO) aceita conexões de qualquer endereço. As conexões exigem o token de login, então isso não abre acesso, mas dá para restringir. No serviço `sala-enigma-api`, em **Environment**, crie `CORS_ORIGIN` com o endereço do site, sem `/` no final (`https://sala-enigma-site.onrender.com`).

## Problemas comuns

| O que aparece | Causa provável | O que fazer |
|---|---|---|
| O site abre, mas o login dá erro de rede | O servidor está acordando, ou `VITE_API_URL` está errado | Espere 1 minuto e tente de novo; se persistir, confira `VITE_API_URL` e refaça o deploy do site |
| O deploy do servidor falha logo no começo | Falta `ADMIN_EMAIL`, `ADMIN_PASSWORD` ou `DATABASE_URL` | Em **Environment**, preencha o que faltar e use **Manual Deploy** |
| Erro de autenticação ou de endereço no log do banco | `DATABASE_URL` copiado errado | Copie de novo da Neon, sem espaços e sem aspas |
| Erro de SSL ou de certificado no log | O endereço não termina com `?sslmode=require` | Use o endereço exatamente como a Neon entrega |
| O aviso "Reconectando..." não some | O servidor ainda está acordando | Espere cerca de 1 minuto |
| A primeira ação depois de um tempo parado demora | O servidor ou o banco estavam dormindo | É o esperado no plano gratuito |

## Limites do plano gratuito (resumo)

- Render: 750 horas por mês (o bastante para um serviço ligado o mês inteiro). Se o tráfego mensal incluído acabar e não houver cartão cadastrado, a Render suspende os serviços gratuitos até o mês seguinte, em vez de cobrar.
- Neon: 1 GB por projeto e sem prazo de validade.
- A própria Render avisa que o plano gratuito é para testes e protótipos, não para produção.

Confira as regras vigentes na hora de criar as contas: [Render](https://render.com/docs/free) e [Neon](https://neon.com/faqs/managed-postgres-databases-free-tier).
