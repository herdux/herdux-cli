🇧🇷 Português | 🇺🇸 [English](./README.md)

# 🐘 herdux — PostgreSQL Manager CLI

Uma CLI moderna, rápida e interativa projetada para eliminar fricções de Developer Experience (DX) ao gerenciar bancos de dados PostgreSQL locais, especialmente em ambientes com datasets massivos, múltiplas instâncias de servidor e operações diárias pesadas.

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-18%2B-43853d.svg)

> Projetado principalmente para ambientes locais e de desenvolvimento.

<p align="center">
  <img src=".github/demo.png" alt="herdux terminal demo" width="720" />
</p>

---

## ⚡ Início Rápido

```bash
npm install -g herdux
herdux doctor
herdux list
```

É só isso. Você já está gerenciando bancos de dados.

---

## Por que herdux?

Gerenciar PostgreSQL através de comandos crus é repetitivo, propenso a erros e doloroso em escala.

### ❌ Sem herdux

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

### ✅ Com herdux

```bash
herdux backup mydb --drop --yes        # Backup + drop em um comando
herdux restore ./backups/mydb.dump --db mydb   # Detecta o formato automaticamente
herdux clean                            # Multi-seleção e batch-drop de bancos
herdux doctor                           # Verificação completa do sistema
```

Um comando. Menos flags. Menos erros.

---

## 💡 Filosofia

**Herdux** combina *herd* (manada) e *UX* — entregando uma melhor Developer Experience ao gerenciar seus clusters de banco de dados PostgreSQL. O nome reflete nosso foco em melhorar a experiência de desenvolvimento ao gerenciar "manadas" de bancos de dados.

O herdux segue três princípios:

- **Segurança primeiro** — Nunca apaga dados sem confirmação explícita ou um backup verificado.
- **Explícito sobre implícito** — A resolução de conexão segue uma prioridade estrita e documentada. Sem mágica.
- **Otimização de workflow** — Cada comando é projetado para te salvar de tarefas repetitivas no terminal.

---

## 🔒 Segurança

O `herdux` trata operações destrutivas com cuidado:

- **Nunca dropa um banco** sem confirmação explícita
- **Aborta toda a operação** se um backup de segurança falhar durante o `herdux clean`
- **Valida códigos de saída do `pg_dump`** antes de considerar um backup bem-sucedido
- **Requer a flag `--drop`** intencionalmente — dropar nunca é o padrão
- **`--yes` deve ser combinado com `--drop`** — não é possível pular confirmação sozinho

> Se você solicitar um backup antes de dropar e esse backup falhar, o herdux para imediatamente. Nenhum dado é perdido.

---

## 🚀 Funcionalidades Principais

- **📋 Listagem Inteligente** — Estratégia otimizada para clusters massivos. Flag opcional `--size` para análise de uso de disco, ordenado do maior para o menor.
- **💾 Backup & Restore Inteligente** — Suporta formatos Custom (`.dump`) e Plain (`.sql`). Detecta automaticamente a ferramenta correta para restauração.
- **🧹 Limpeza em Massa** — Multi-seleção de bancos, backup opcional e batch-drop. Recupere espaço em disco instantaneamente.
- **🩺 Diagnóstico do Sistema** — Verificação completa de saúde com um único comando: binários, autenticação e conectividade.
- **⚙️ Perfis Persistentes** — Salve configurações de servidor nomeadas. Alterne entre ambientes com `-s pg16`.
- **🎯 Resolução Inteligente de Conexão** — Flags CLI explícitas → perfis → padrões salvos → auto-descoberta. Sempre previsível.

---

## 🧩 Requisitos

- **Node.js** 18 ou superior
- **Ferramentas cliente PostgreSQL** (`psql`, `pg_dump`, `pg_restore`) instaladas e disponíveis no `PATH`

> [!TIP]
> Execute `herdux doctor` após a instalação para verificar se tudo está configurado corretamente.

---

## 📦 Instalação

**npm (recomendado):**

```bash
npm install -g herdux
```

**Pelo código-fonte:**

```bash
git clone https://github.com/your-user/cli-herdux.git
cd cli-herdux
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

Gerencie múltiplas instâncias PostgreSQL sem esforço:

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

Ao resolver como se conectar, o `herdux` segue uma ordem de prioridade estrita e previsível:

| Prioridade | Fonte | Exemplo |
|---|---|---|
| 1️⃣ | **Flags CLI** | `herdux list --port 5417` |
| 2️⃣ | **Perfil de servidor** | `herdux list -s pg16` |
| 3️⃣ | **Padrões salvos** | `herdux config set port 5432` |
| 4️⃣ | **Auto-descoberta** | Escaneia portas comuns; pergunta se encontrar múltiplas |

Isso significa que a entrada explícita sempre vence. Sem surpresas.

---

## 🤔 Por que não pgAdmin?

O pgAdmin é uma ferramenta GUI poderosa para administração de bancos de dados. O `herdux` não é um substituto para ele.

O `herdux` é otimizado para **workflows de desenvolvimento focados no terminal** — operações rápidas, scripting, pipelines de CI e gerenciamento de múltiplas instâncias locais sem sair do terminal.

Sem GUI. Sem overhead. Só velocidade.

---

## 🐳 Suporte Docker (Em Breve)

O `herdux` poderá detectar e interagir com instâncias PostgreSQL rodando dentro de containers Docker — listando, conectando e gerenciando-as tão naturalmente quanto instâncias locais.

---

## 🗺 Roadmap

- [x] Backup & restore
- [x] Perfis
- [x] Doctor
- [ ] Integração Docker
- [ ] Backups criptografados
- [ ] Limpeza com TTL
- [ ] Build binário Windows

---

## 🤝 Contribuindo

PRs são bem-vindas! Por favor, abra uma issue primeiro para discutir mudanças significativas.

```bash
git clone https://github.com/your-user/cli-herdux.git
cd cli-herdux
npm install
npm run dev
```

---

## 📄 Licença

MIT
