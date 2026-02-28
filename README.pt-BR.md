🇧🇷 Português | 🇺🇸 [English](./README.md)

<p align="center">
  <strong>Infrastructure-grade power. Developer-grade experience.</strong>
</p>

<p align="center">
  <img src=".github/assets/logo.svg" alt="Herdux banner" style="max-width: 100%; width: 600px;" />
</p>

## ⏭️ Herdux — Database Workflow CLI

Uma CLI rápida e interativa que remove a fricção dos workflows diários com bancos de dados locais, especialmente ao lidar com múltiplas instâncias e grandes datasets.

![Version](https://img.shields.io/badge/version-0.4.2-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-18%2B-43853d.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=flat&logo=mysql&logoColor=white)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-%E2%9D%A4-pink?style=flat&logo=github)](https://github.com/sponsors/eduardozaniboni)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy_Me_A_Coffee-FFDD00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/eduardozaniboni)

> Otimizado para ambientes locais e de desenvolvimento. O uso em produção é suportado com configuração explícita.

<!-- <p align="center">
  <img src=".github/herdux.gif" alt="herdux terminal gif" width="1220" />
</p> -->

---

## ⚡ Início Rápido

```bash
npm install -g herdux-cli

# Você pode usar 'herdux' ou o alias mais curto 'hdx'
hdx doctor
herdux list
```

É só isso. Você já está gerenciando bancos de dados.

---

## 🔌 Engines Suportadas

| Engine     | Status | Ferramentas Cliente Necessárias |
| ---------- | ------ | ------------------------------- |
| PostgreSQL | ✅     | `psql`, `pg_dump`, `pg_restore` |
| MySQL      | ✅     | `mysql`, `mysqldump`            |

O Herdux detecta automaticamente a engine a partir do seu perfil de servidor ou da flag `--engine`. PostgreSQL é o padrão quando nenhuma engine é especificada.

```bash
# PostgreSQL (padrão)
herdux list
herdux create mydb

# MySQL
herdux --engine mysql list
herdux --engine mysql create mydb

# Ou salve no perfil e esqueça
herdux config add mysql-local --port 3306 --user root --password secret --engine mysql
herdux list -s mysql-local
```

---

## Por que Herdux?

Gerenciar bancos de dados locais através de scripts bash ou binários crus é repetitivo, propenso a erros e doloroso em escala.

### ❌ Sem Herdux

```bash
# Backup PostgreSQL
pg_dump -U postgres -h localhost -p 5416 -Fc -f ./backups/mydb.dump mydb

# Backup MySQL
mysqldump -u root -h localhost -P 3306 -p mydb > ./backups/mydb.sql

# Dropar manualmente, restaurar, verificar ferramentas...
# Flags diferentes, ferramentas diferentes, memória muscular diferente para cada engine.
```

### ✅ Com Herdux

```bash
herdux backup mydb --drop --yes        # Backup + drop em um comando
herdux restore ./backups/mydb.dump --db mydb   # Cria o banco (se faltar) e detecta o formato
herdux clean                            # Multi-seleção e batch-drop de bancos
herdux doctor                           # Verificação completa do sistema
```

Mesmos comandos. Qualquer engine. Menos flags. Menos erros. Zero fadiga de terminal.

---

## 🎯 Para quem é o Herdux?

O **Herdux** foi construído _por desenvolvedores, para desenvolvedores_.

Ele nasceu da frustração diária de ter que constantemente restaurar backups para testar um estado específico, dropar bancos corrompidos durante o desenvolvimento e lidar com binários crus de bancos de dados toda hora.

Ele é especificamente projetado para desenvolvedores que:

- Gerenciam infraestruturas locais e precisam verificar o tamanho dos discos antes de popular novos bancos.
- Querem clonar, popular (seed) e resetar bancos de dados rapidamente sem precisar ler documentações complexas.
- Precisam de fluxos seguros de backup & restore que não dependam de scripts bash frágeis.
- Preferem ferramentas focadas no terminal (terminal-first).
- Querem resolução previsível de conexões sem mágicas ocultas.
- Trabalham com **múltiplas engines de banco de dados** (PostgreSQL, MySQL) e querem uma interface unificada.

Se você gerencia bancos de dados localmente e compartilha dessa dor, o Herdux foi criado para você.

---

## 🚀 Funcionalidades Principais

- **🔌 Suporte Multi-Engine** — Suporte de primeira classe para PostgreSQL e MySQL. Mesmos comandos, mesmo workflow, qualquer engine.
- **📋 Listagem Inteligente** — Estratégia otimizada para clusters massivos. Flag opcional `--size` para análise de uso de disco, ordenado do maior para o menor.
- **💾 Backup & Restore Inteligente** — Suporta formatos Custom (`.dump`) e Plain (`.sql`). Detecta automaticamente a ferramenta correta para restauração.
- **🧹 Limpeza em Massa** — Multi-seleção de bancos, backup opcional e batch-drop. Recupere espaço em disco instantaneamente.
- **🩺 Diagnóstico do Sistema** — Verificação completa de saúde com um único comando: binários, autenticação e conectividade.
- **⚙️ Perfis Persistentes** — Salve configurações de servidor nomeadas com tipo de engine. Alterne entre ambientes com `-s pg16`.
- **🎯 Resolução Inteligente de Conexão e Engine** — Flags CLI explícitas → perfis → padrões salvos → auto-descoberta. Sempre previsível.

---

## 💡 Filosofia

**Herdux** combina _herd_ (manada/rebanho) e _UX_ — entregando uma melhor Developer Experience ao gerenciar seus clusters de bancos de dados. O nome reflete nosso foco em melhorar a experiência de desenvolvimento ao gerenciar "manadas" de bancos.

O **Herdux** segue três princípios:

- **Segurança primeiro** — Nunca apaga dados sem confirmação explícita ou um backup verificado.
- **Explícito sobre implícito** — A resolução de conexão e engine segue uma prioridade estrita e documentada. Sem mágica.
- **Otimização de workflow** — Cada comando é projetado para te salvar de tarefas repetitivas no terminal.

---

## 🔒 Segurança

O **Herdux** trata operações destrutivas com cuidado:

- **Nunca dropa um banco** sem confirmação explícita
- **Aborta toda a operação** se um backup de segurança falhar durante o `herdux clean`
- **Valida códigos de saída das ferramentas de backup** antes de considerar um backup bem-sucedido
- **Requer a flag `--drop`** intencionalmente — dropar nunca é o padrão
- **`--yes` deve ser combinado com `--drop`** — não é possível pular confirmação sozinho

> Se você solicitar um backup antes de dropar e esse backup falhar, o **Herdux** para imediatamente. Nenhum dado é perdido.

---

## 🧩 Requisitos

- **Node.js** 18 ou superior
- **Para PostgreSQL:** `psql`, `pg_dump`, `pg_restore` instalados e disponíveis no `PATH`
- **Para MySQL:** `mysql`, `mysqldump` instalados e disponíveis no `PATH`

> [!TIP]
> Execute `herdux doctor` após a instalação para verificar se tudo está configurado corretamente. O comando doctor verifica as ferramentas da engine ativa.

---

## 📦 Instalação

**npm (recomendado):**

> **⚠️ IMPORTANTE:** Você precisa usar a flag `-g` (global) para que a CLI fique disponível no seu terminal.

```bash
npm install -g herdux-cli
```

**Pelo código-fonte:**

```bash
git clone https://github.com/herdux/herdux-cli.git
cd herdux-cli
npm install
npm run build
npm link
```

---

## 🛠️ Comandos

Todos os comandos funcionam tanto com PostgreSQL quanto com MySQL. Use `--engine mysql` ou configure a engine no seu perfil de servidor.

### `herdux version`

Mostra a versão da CLI e a versão do servidor de banco de dados conectado.

```bash
herdux version
herdux --engine mysql version
```

### `herdux doctor`

Executa uma verificação completa de saúde do sistema:

- Verifica se as ferramentas cliente necessárias estão instaladas e acessíveis (específicas por engine)
- Tenta uma conexão real usando a configuração resolvida
- Testa autenticação contra o servidor alvo

```bash
herdux doctor
herdux --engine mysql doctor
```

---

### 📋 `herdux list`

Lista todos os bancos de dados no servidor conectado.

```bash
herdux list              # Listagem rápida (nome, owner, encoding)
herdux ls --size         # Inclui tamanho em disco, ordenado do maior → menor
```

> [!NOTE]
> A flag `--size` calcula o uso físico de disco. Em servidores com dezenas de bancos multi-GB, isso pode levar alguns minutos dependendo da velocidade do disco.

---

### `herdux create <nome>`

Cria um novo banco de dados.

```bash
herdux create meu_novo_db
herdux --engine mysql create meu_novo_db
```

### `herdux drop <nome>`

Remove um banco de dados com confirmação interativa.

```bash
herdux drop meu_banco_antigo
```

---

### 🧹 `herdux clean` — Limpeza em Massa

Trabalhando com bancos de desenvolvimento cheios de seeds? Precisa recuperar espaço em disco rápido?

`herdux clean` permite:

- **Multi-seleção** de bancos a partir de uma interface interativa com checkboxes
- **Gerar backups de segurança opcionais** antes de qualquer ação destrutiva
- **Batch-drop** de todos os bancos selecionados com segurança
- **Abortar imediatamente** se qualquer backup falhar, prevenindo perda de dados

```bash
herdux clean
```

Projetado para o workflow real do desenvolvedor: clonar bancos, experimentar, depois limpar tudo de uma vez.

---

### 📦 `herdux backup <banco>`

Gera um backup com timestamp em `./backups/`.

```bash
herdux backup mydb                       # Formato custom (.dump para PG, .sql para MySQL)
herdux backup mydb --format plain        # SQL puro (.sql)
herdux backup mydb --drop                # Backup, depois pergunta se quer dropar
herdux backup mydb --drop --yes          # Backup + drop, sem perguntas
herdux backup mydb -o ./meus-backups     # Diretório de saída personalizado
```

| Opção                 | Descrição                                                  |
| --------------------- | ---------------------------------------------------------- |
| `-F, --format <tipo>` | `custom` (padrão, comprimido) ou `plain` (SQL puro)        |
| `-d, --drop`          | Pergunta se deseja dropar o banco após backup bem-sucedido |
| `-y, --yes`           | Pula confirmação do drop (requer `--drop`)                 |
| `-o, --output <dir>`  | Diretório de saída (padrão: `./backups`)                   |

---

### 📥 `herdux restore <arquivo>`

Restaura um banco de dados a partir de um arquivo de backup. Detecta automaticamente o formato:

- `.sql` → usa a ferramenta de importação SQL apropriada
- `.dump` ou qualquer outra extensão → usa a ferramenta de restore apropriada

```bash
herdux restore ./backups/mydb_2026-02-23.dump --db mydb
herdux restore ./exports/data.sql --db mydb
```

Precisa sobrescrever a auto-detecção? Use `--format`:

```bash
herdux restore arquivo.bkp --db mydb --format custom
herdux restore script.txt --db mydb --format plain
```

> [!NOTE]
> Ao restaurar backups vindos de ambientes gerenciados (ex: AWS RDS), o Herdux configura automaticamente a engine subjacente para ignorar atribuições de permissões e roles. Isso evita erros com roles que existem em produção mas não no seu ambiente local. Se a engine de restauração concluir a operação com avisos não-fatais (como roles ausentes), o Herdux irá te informar no terminal e prosseguir normalmente sem interromper o fluxo.

---

## ⚙️ Configuração & Perfis de Servidor

O `herdux` armazena configurações localmente em `~/.herdux/config.json`.

### Definir Padrões Globais

```bash
herdux config set engine postgres        # Engine padrão
herdux config set user postgres
herdux config set password minha_senha
herdux config set port 5432
```

### Perfis de Servidor Nomeados

Gerencie múltiplas instâncias de banco de dados sem esforço:

```bash
# Perfis PostgreSQL
herdux config add pg16 --port 5416
herdux config add pg17 --port 5417 --user admin

# Perfis MySQL (a engine é salva no perfil)
herdux config add mysql-dev --port 3306 --user root --password secret --engine mysql

# Servidores remotos
herdux config add staging --host 192.168.0.10 --port 5432
```

Depois conecte usando a flag `-s`:

```bash
herdux list -s pg16
herdux backup mydb -s mysql-dev
```

Ou simplesmente execute um comando sem flags — se você tiver perfis salvos, o Herdux mostrará um menu de seleção interativo exibindo a engine de cada perfil.

### Visualizar & Gerenciar Config

```bash
herdux config list           # Mostra todas as configurações e perfis salvos
herdux config get port       # Obtém um valor específico
herdux config rm pg16        # Remove um perfil de servidor
herdux config reset          # Limpa toda a configuração
```

---

## 🔌 Resolução de Conexão e Engine

Ao resolver como se conectar e qual engine usar, o **Herdux** segue uma ordem de prioridade estrita e previsível:

### Prioridade da Engine

| Prioridade | Fonte            | Exemplo                          |
| ---------- | ---------------- | -------------------------------- |
| 1️⃣         | **Flag CLI**     | `herdux --engine mysql list`     |
| 2️⃣         | **Perfil**       | Campo `engine` do perfil         |
| 3️⃣         | **Padrão salvo** | `herdux config set engine mysql` |
| 4️⃣         | **Fallback**     | `postgres`                       |

### Prioridade da Conexão

| Prioridade | Fonte                  | Exemplo                                                 |
| ---------- | ---------------------- | ------------------------------------------------------- |
| 1️⃣         | **Flags CLI**          | `herdux list --port 5417`                               |
| 2️⃣         | **Perfil de servidor** | `herdux list -s pg16`                                   |
| 3️⃣         | **Padrões salvos**     | `herdux config set port 5432`                           |
| 4️⃣         | **Auto-descoberta**    | Escaneia portas comuns; pergunta se encontrar múltiplas |

Isso significa que a entrada explícita sempre vence. Sem surpresas.

---

## 🤔 Por que não pgAdmin / phpMyAdmin?

O **Herdux** não é um substituto de GUI.
É um acelerador de workflow para desenvolvedores que vivem no terminal.

Sem GUI. Sem overhead. Só velocidade.

---

## 🧠 Princípios de Design

- Sem padrões ocultos (hidden defaults).
- Sem mágicas destrutivas.
- Resolução determinística de conexão e engine.
- Comandos explícitos e combináveis.
- Engine-agnostic: mesma interface, qualquer banco de dados.

---

## 🐳 Suporte Docker (Em Breve)

O **Herdux** poderá detectar e interagir com instâncias de banco de dados rodando dentro de containers Docker — listando, conectando e gerenciando-as tão naturalmente quanto instâncias locais.

---

## 🗺 Roadmap

Consulte o [ROADMAP.md](./ROADMAP.md) para ver nossos planos futuros detalhados, incluindo integração com Docker e backups criptografados.

---

## 🤝 Contribuindo

PRs são bem-vindas! Por favor, abra uma issue primeiro para discutir mudanças significativas.

```bash
git clone https://github.com/herdux/herdux-cli.git
cd herdux-cli
npm install
npm run dev

# Executar testes unitários
npm run test:unit
# Executar testes E2E (requer Docker)
npm run test:e2e:pgsql
npm run test:e2e:mysql
```

---

## ☕ Apoie o Projeto

Se o **Herdux** tem te salvado horas de dores de cabeça com bancos de dados, considere apoiar o projeto! Isso ajuda demais a mantê-lo ativo e open-source.

<a href="https://github.com/sponsors/eduardozaniboni" target="_blank"><img src="https://img.shields.io/badge/Sponsor-%E2%9D%A4-pink?style=for-the-badge&logo=github" alt="GitHub Sponsors"></a>
<a href="https://www.buymeacoffee.com/eduardozaniboni" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 28px !important;width: 100px !important;" ></a>

---

## 📄 Licença

MIT
