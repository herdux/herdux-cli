🇧🇷 Português | 🇺🇸 [English](./README.md)

# Herdux — Database Workflow CLI

<p align="center">
  <strong>Infrastructure-grade power. Developer-grade experience.</strong>
</p>

Uma CLI rápida e interativa que remove a fricção dos workflows diários com bancos de dados locais, especialmente ao lidar com múltiplas instâncias e grandes datasets.

![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-18%2B-43853d.svg)
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

## Por que Herdux?

Gerenciar bancos de dados locais através de scripts bash ou binários crus é repetitivo, propenso a erros e doloroso em escala.

### ❌ Sem Herdux

```bash
# Fazer backup de um banco
pg_dump -U postgres -h localhost -p 5416 -Fc -f ./backups/mydb_2026-02-23.dump mydb

# Depois dropar manualmente
psql -U postgres -h localhost -p 5416 -c "DROP DATABASE mydb;"

# Restaurar do backup
pg_restore -U postgres -h localhost -p 5416 -d mydb --clean --if-exists ./backups/mydb_2026-02-23.dump

# Verificar se as ferramentas estão instaladas
psql --version && pg_dump --version && pg_restore --version
```

### ✅ Com Herdux

```bash
herdux backup mydb --drop --yes        # Backup + drop em um comando
herdux restore ./backups/mydb.dump --db mydb   # Cria o banco (se faltar) e detecta o formato
herdux clean                            # Multi-seleção e batch-drop de bancos
herdux doctor                           # Verificação completa do sistema
```

Menos flags. Menos erros. Zero fadiga de terminal.

---

## 🎯 Para quem é o Herdux?

O **Herdux** foi construído *por desenvolvedores, para desenvolvedores*. 

Ele nasceu da frustração diária de ter que constantemente restaurar backups para testar um estado específico, dropar bancos corrompidos durante o desenvolvimento e lidar com binários crus de bancos de dados toda hora.

Ele é especificamente projetado para desenvolvedores que:
- Gerenciam infraestruturas locais e precisam verificar o tamanho dos discos antes de popular novos bancos.
- Querem clonar, popular (seed) e resetar bancos de dados rapidamente sem precisar ler documentações complexas.
- Precisam de fluxos seguros de backup & restore que não dependam de scripts bash frágeis.
- Preferem ferramentas focadas no terminal (terminal-first).
- Querem resolução previsível de conexões sem mágicas ocultas.

Se você gerencia bancos de dados localmente e compartilha dessa dor, o Herdux foi criado para você.

---

## 🚀 Funcionalidades Principais

- **📋 Listagem Inteligente** — Estratégia otimizada para clusters massivos. Flag opcional `--size` para análise de uso de disco, ordenado do maior para o menor.
- **💾 Backup & Restore Inteligente** — Suporta formatos Custom (`.dump`) e Plain (`.sql`). Detecta automaticamente a ferramenta correta para restauração.
- **🧹 Limpeza em Massa** — Multi-seleção de bancos, backup opcional e batch-drop. Recupere espaço em disco instantaneamente.
- **🩺 Diagnóstico do Sistema** — Verificação completa de saúde com um único comando: binários, autenticação e conectividade.
- **⚙️ Perfis Persistentes** — Salve configurações de servidor nomeadas. Alterne entre ambientes com `-s pg16`.
- **🎯 Resolução Inteligente de Conexão** — Flags CLI explícitas → perfis → padrões salvos → auto-descoberta. Sempre previsível.

---

## 💡 Filosofia

**Herdux** combina *herd* (manada/rebanho) e *UX* — entregando uma melhor Developer Experience ao gerenciar seus clusters de bancos de dados. O nome reflete nosso foco em melhorar a experiência de desenvolvimento ao gerenciar "manadas" de bancos.

O **Herdux** segue três princípios:

- **Segurança primeiro** — Nunca apaga dados sem confirmação explícita ou um backup verificado.
- **Explícito sobre implícito** — A resolução de conexão segue uma prioridade estrita e documentada. Sem mágica.
- **Otimização de workflow** — Cada comando é projetado para te salvar de tarefas repetitivas no terminal.

---

## 🔒 Segurança

O **Herdux** trata operações destrutivas com cuidado:

- **Nunca dropa um banco** sem confirmação explícita
- **Aborta toda a operação** se um backup de segurança falhar durante o `herdux clean`
- **Valida códigos de saída do `pg_dump`** antes de considerar um backup bem-sucedido
- **Requer a flag `--drop`** intencionalmente — dropar nunca é o padrão
- **`--yes` deve ser combinado com `--drop`** — não é possível pular confirmação sozinho

> Se você solicitar um backup antes de dropar e esse backup falhar, o **Herdux** para imediatamente. Nenhum dado é perdido.

---

## 🧩 Requisitos

- **Node.js** 18 ou superior
- **Ferramentas cliente PostgreSQL** (`psql`, `pg_dump`, `pg_restore`) instaladas e disponíveis no `PATH`

> [!TIP]
> Execute `herdux doctor` após a instalação para verificar se tudo está configurado corretamente.

---

## 📦 Instalação

**npm (recomendado):**

> **⚠️ IMPORTANTE:** Você precisa usar a flag `-g` (global) para que a CLI fique disponível no seu terminal.

```bash
npm install -g herdux-cli
```

**Pelo código-fonte:**

```bash
git clone https://github.com/herdux/herdux.git
cd herdux
npm install
npm run build
npm link
```

---

## 🛠️ Comandos

### `herdux version`

Mostra a versão da CLI e a versão do servidor PostgreSQL conectado.

```bash
herdux version
```

### `herdux doctor`

Executa uma verificação completa de saúde do sistema:

- Verifica se `psql`, `pg_dump` e `pg_restore` estão instalados e acessíveis
- Tenta uma conexão real usando a configuração resolvida
- Testa autenticação contra o servidor alvo

```bash
herdux doctor
```

---

### 📋 `herdux list`

Lista todos os bancos de dados no servidor conectado.

```bash
herdux list              # Listagem rápida (nome, owner, encoding)
herdux ls --size         # Inclui tamanho em disco, ordenado do maior → menor
```

> [!NOTE]
> A flag `--size` calcula o uso físico de disco via `pg_database_size()`. Em servidores com dezenas de bancos multi-GB, isso pode levar alguns minutos dependendo da velocidade do disco.

---

### `herdux create <nome>`

Cria um novo banco de dados.

```bash
herdux create meu_novo_db
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
herdux backup mydb                       # Formato custom (.dump)
herdux backup mydb --format plain        # SQL puro (.sql)
herdux backup mydb --drop                # Backup, depois pergunta se quer dropar
herdux backup mydb --drop --yes          # Backup + drop, sem perguntas
herdux backup mydb -o ./meus-backups     # Diretório de saída personalizado
```

| Opção | Descrição |
|---|---|
| `-F, --format <tipo>` | `custom` (padrão, comprimido) ou `plain` (SQL puro) |
| `-d, --drop` | Pergunta se deseja dropar o banco após backup bem-sucedido |
| `-y, --yes` | Pula confirmação do drop (requer `--drop`) |
| `-o, --output <dir>` | Diretório de saída (padrão: `./backups`) |

---

### 📥 `herdux restore <arquivo>`

Restaura um banco de dados a partir de um arquivo de backup. Detecta automaticamente o formato:

- `.sql` → usa `psql -f`
- `.dump` ou qualquer outra extensão → usa `pg_restore`

```bash
herdux restore ./backups/mydb_2026-02-23.dump --db mydb
herdux restore ./exports/data.sql --db mydb
```

Precisa sobrescrever a auto-detecção? Use `--format`:

```bash
herdux restore arquivo.bkp --db mydb --format custom
herdux restore script.txt --db mydb --format plain
```

---

## ⚙️ Configuração & Perfis de Servidor

O `herdux` armazena configurações localmente em `~/.herdux/config.json`.

### Definir Padrões Globais

```bash
herdux config set user postgres
herdux config set password minha_senha
herdux config set port 5432
```

### Perfis de Servidor Nomeados

Gerencie múltiplas instâncias de banco de dados sem esforço:

```bash
herdux config add pg16 --port 5416
herdux config add pg17 --port 5417 --user admin
herdux config add staging --host 192.168.0.10 --port 5432
```

Depois conecte usando a flag `-s`:

```bash
herdux list -s pg16
herdux backup mydb -s staging
```

### Visualizar & Gerenciar Config

```bash
herdux config list           # Mostra todas as configurações e perfis salvos
herdux config get port       # Obtém um valor específico
herdux config rm pg16        # Remove um perfil de servidor
herdux config reset          # Limpa toda a configuração
```

---

## 🔌 Prioridade de Conexão

Ao resolver como se conectar, o **Herdux** segue uma ordem de prioridade estrita e previsível:

| Prioridade | Fonte | Exemplo |
|---|---|---|
| 1️⃣ | **Flags CLI** | `herdux list --port 5417` |
| 2️⃣ | **Perfil de servidor** | `herdux list -s pg16` |
| 3️⃣ | **Padrões salvos** | `herdux config set port 5432` |
| 4️⃣ | **Auto-descoberta** | Escaneia portas comuns; pergunta se encontrar múltiplas |

Isso significa que a entrada explícita sempre vence. Sem surpresas.

---

## 🤔 Por que não pgAdmin?

O **Herdux** não é um substituto de GUI.
É um acelerador de workflow para desenvolvedores que vivem no terminal.

Sem GUI. Sem overhead. Só velocidade.

---

## 🧠 Princípios de Design

- Sem padrões ocultos (hidden defaults).
- Sem mágicas destrutivas.
- Resolução de conexão determinística.
- Comandos explícitos e combináveis.

---

## 🐳 Suporte Docker (Em Breve)

O **Herdux** poderá detectar e interagir com instâncias PostgreSQL rodando dentro de containers Docker — listando, conectando e gerenciando-as tão naturalmente quanto instâncias locais.

---

## 🗺 Roadmap

Consulte o [ROADMAP.md](./ROADMAP.md) para ver nossos planos futuros detalhados, incluindo integração com Docker e backups criptografados.

---

## 🤝 Contribuindo

PRs são bem-vindas! Por favor, abra uma issue primeiro para discutir mudanças significativas.

```bash
git clone https://github.com/herdux/herdux.git
cd herdux
npm install
npm run dev
```

---

## ☕ Apoie o Projeto

Se o **Herdux** tem te salvado horas de dores de cabeça com bancos de dados, considere pagar um café! Isso ajuda demais a manter o projeto ativo e open-source.

<a href="https://www.buymeacoffee.com/eduardozaniboni" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 50px !important;width: 181px !important;" ></a>

---

## 📄 Licença

MIT
