# Análise pública — Grite Soluções (somente dados públicos)

Método: instruções da skill REA; servidor MCP `rea` não foi instalado (setup altera config global e exige interação). Análise feita por requisições HTTP públicas simples (GET/HEAD), sem login, sem contornar proteções.

## gritesolucoes.com.br (site institucional)
- Startup de "inovação aberta": hackathons, ideathons, processos de pré-incubação/incubação/aceleração.
- Produto: "Grite Hackathons", plataforma para gerir e compartilhar iniciativas de inovação aberta, linkada em grite.app.br.
- Clientes citados: Porto Digital (JUMP), Armazém da Criatividade, Campus Party Brasil, Sebrae.
- Navegação: HOME, "Grite Hackathons", âncora #servicos; rodapé com contato, Instagram, LinkedIn.
- Tom: informal, startup, português coloquial.

## grite.app.br (plataforma)
- Resposta 302 para `bubble.io/domain_not_supported` → app construído em Bubble.io, domínio atualmente não servido publicamente.
- Cookies de sessão com prefixo `gritethon_live_*` indicam nome interno do app ("gritethon") e ambiente live.
- `www` redireciona (301) para o apex; Express no cabeçalho `X-Powered-By` do redirect.
- Nenhuma tela, formulário ou fluxo público pôde ser observado.

## Limites
Observado: apenas o acima. Não observado: telas, papéis, fluxos, modelo de dados, API. Nada foi inferido além disso; os requisitos vêm do PDF.

## Pesquisa complementar (busca web)
- Grite Soluções Empresariais: Recife, desde 2013; consultoria de TI/inovação desde 2016; eventos como Global Legal Hackathon, Hack UPE, Desafio Augment, Desafio Portal de Periódicos CAPES 2024 (inscrição via Sympla).
- Eventos têm landing própria em subdomínios (ex.: hackps.gritesolucoes.com.br, WordPress): hero com datas + hashtag + botão "Inscreva-se", sobre a organização, premiação, patrocinadores, "Realização e Organização", o desafio em uma pergunta, CTA final "Vai topar o desafio?", regulamento em PDF, inscrição externa (Sympla).
- Lição para a nossa plataforma: página pública com a mesma narrativa (hero → desafio → premiação/programação → regulamento → CTA), mas com inscrição e login nativos (o PDF exige isso), em vez de Sympla.
- Fontes: gritesolucoes.com.br, hackps.gritesolucoes.com.br, sympla.com.br/gritesolucoes, br.linkedin.com/company/gritesolucoes.
