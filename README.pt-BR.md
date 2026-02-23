🇧🇷 Português | 🇺🇸 [English](./README.md)

# 🐘 pgm — PostgreSQL Manager CLI

Uma CLI moderna, rápida e interativa projetada para eliminar fricções de Developer Experience (DX) ao gerenciar bancos de dados PostgreSQL locais, especialmente em ambientes com datasets massivos, múltiplas instâncias de servidor e operações diárias pesadas.

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-18%2B-43853d.svg)

> Projetado principalmente para ambientes locais e de desenvolvimento.

<p align="center">
  <img src=".github/demo.png" alt="pgm terminal demo" width="720" />
</p>

---

## ⚡ Início Rápido

```bash
npm install -g pgm
pgm doctor
pgm list
```

É só isso. Você já está gerenciando bancos de dados.

---

## Por que pgm?

Gerenciar PostgreSQL através de comandos crus é repetitivo, propenso a erros e doloroso em escala.

### ❌ Sem pgm

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

### ✅ Com pgm

```bash
pgm backup mydb --drop --yes        # Backup + drop em um comando
pgm restore ./backups/mydb.dump --db mydb   # Detecta o formato automaticamente
pgm clean                            # Multi-seleção e batch-drop de bancos
pgm doctor                           # Verificação completa do sistema
```

Um comando. Menos flags. Menos erros.

---

## 💡 Filosofia

O pgm segue três princípios:

- **Segurança primeiro** — Nunca apaga dados sem confirmação explícita ou um backup verificado.
- **Explícito sobre implícito** — A resolução de conexão segue uma prioridade estrita e documentada. Sem mágica.
- **Otimização de workflow** — Cada comando é projetado para te salvar de tarefas repetitivas no terminal.

---

## 🔒 Segurança

O `pgm` trata operações destrutivas com cuidado:

- **Nunca dropa um banco** sem confirmação explícita
- **Aborta toda a operação** se um backup de segurança falhar durante o `pgm clean`
- **Valida códigos de saída do `pg_dump`** antes de considerar um backup bem-sucedido
- **Requer a flag `--drop`** intencionalmente — dropar nunca é o padrão
- **`--yes` deve ser combinado com `--drop`** — não é possível pular confirmação sozinho

> Se você solicitar um backup antes de dropar e esse backup falhar, o pgm para imediatamente. Nenhum dado é perdido.

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
> Execute `pgm doctor` após a instalação para verificar se tudo está configurado corretamente.

---

## 📦 Instalação

**npm (recomendado):**

```bash
npm install -g pgm
```

**Pelo código-fonte:**

```bash
git clone https://github.com/your-user/cli-pgm.git
cd cli-pgm
npm install
npm run build
npm link
```

---

## 🛠️ Comandos

### `pgm version`

Mostra a versão da CLI e a versão do servidor PostgreSQL conectado.

```bash
pgm version
```

### `pgm doctor`

Executa uma verificação completa de saúde do sistema:

- Verifica se `psql`, `pg_dump` e `pg_restore` estão instalados e acessíveis
- Tenta uma conexão real usando a configuração resolvida
- Testa autenticação contra o servidor alvo

```bash
pgm doctor
```

---

### 📋 `pgm list`

Lista todos os bancos de dados no servidor conectado.

```bash
pgm list              # Listagem rápida (nome, owner, encoding)
pgm ls --size         # Inclui tamanho em disco, ordenado do maior → menor
```

> [!NOTE]
> A flag `--size` calcula o uso físico de disco via `pg_database_size()`. Em servidores com dezenas de bancos multi-GB, isso pode levar alguns minutos dependendo da velocidade do disco.

---

### `pgm create <nome>`

Cria um novo banco de dados.

```bash
pgm create meu_novo_db
```

### `pgm drop <nome>`

Remove um banco de dados com confirmação interativa.

```bash
pgm drop meu_banco_antigo
```

---

### 🧹 `pgm clean` — Limpeza em Massa

Trabalhando com bancos de desenvolvimento cheios de seeds? Precisa recuperar espaço em disco rápido?

`pgm clean` permite:

- **Multi-seleção** de bancos a partir de uma interface interativa com checkboxes
- **Gerar backups de segurança opcionais** antes de qualquer ação destrutiva
- **Batch-drop** de todos os bancos selecionados com segurança
- **Abortar imediatamente** se qualquer backup falhar, prevenindo perda de dados

```bash
pgm clean
```

Projetado para o workflow real do desenvolvedor: clonar bancos, experimentar, depois limpar tudo de uma vez.

---

### 📦 `pgm backup <banco>`

Gera um backup com timestamp em `./backups/`.

```bash
pgm backup mydb                       # Formato custom (.dump)
pgm backup mydb --format plain        # SQL puro (.sql)
pgm backup mydb --drop                # Backup, depois pergunta se quer dropar
pgm backup mydb --drop --yes          # Backup + drop, sem perguntas
pgm backup mydb -o ./meus-backups     # Diretório de saída personalizado
```

| Opção | Descrição |
|---|---|
| `-F, --format <tipo>` | `custom` (padrão, comprimido) ou `plain` (SQL puro) |
| `-d, --drop` | Pergunta se deseja dropar o banco após backup bem-sucedido |
| `-y, --yes` | Pula confirmação do drop (requer `--drop`) |
| `-o, --output <dir>` | Diretório de saída (padrão: `./backups`) |

---

### 📥 `pgm restore <arquivo>`

Restaura um banco de dados a partir de um arquivo de backup. Detecta automaticamente o formato:

- `.sql` → usa `psql -f`
- `.dump` ou qualquer outra extensão → usa `pg_restore`

```bash
pgm restore ./backups/mydb_2026-02-23.dump --db mydb
pgm restore ./exports/data.sql --db mydb
```

Precisa sobrescrever a auto-detecção? Use `--format`:

```bash
pgm restore arquivo.bkp --db mydb --format custom
pgm restore script.txt --db mydb --format plain
```

---

## ⚙️ Configuração & Perfis de Servidor

O `pgm` armazena configurações localmente em `~/.pgm/config.json`.

### Definir Padrões Globais

```bash
pgm config set user postgres
pgm config set password minha_senha
pgm config set port 5432
```

### Perfis de Servidor Nomeados

Gerencie múltiplas instâncias PostgreSQL sem esforço:

```bash
pgm config add pg16 --port 5416
pgm config add pg17 --port 5417 --user admin
pgm config add staging --host 192.168.0.10 --port 5432
```

Depois conecte usando a flag `-s`:

```bash
pgm list -s pg16
pgm backup mydb -s staging
```

### Visualizar & Gerenciar Config

```bash
pgm config list           # Mostra todas as configurações e perfis salvos
pgm config get port       # Obtém um valor específico
pgm config rm pg16        # Remove um perfil de servidor
pgm config reset          # Limpa toda a configuração
```

---

## 🔌 Prioridade de Conexão

Ao resolver como se conectar, o `pgm` segue uma ordem de prioridade estrita e previsível:

| Prioridade | Fonte | Exemplo |
|---|---|---|
| 1️⃣ | **Flags CLI** | `pgm list --port 5417` |
| 2️⃣ | **Perfil de servidor** | `pgm list -s pg16` |
| 3️⃣ | **Padrões salvos** | `pgm config set port 5432` |
| 4️⃣ | **Auto-descoberta** | Escaneia portas comuns; pergunta se encontrar múltiplas |

Isso significa que a entrada explícita sempre vence. Sem surpresas.

---

## 🤔 Por que não pgAdmin?

O pgAdmin é uma ferramenta GUI poderosa para administração de bancos de dados. O `pgm` não é um substituto para ele.

O `pgm` é otimizado para **workflows de desenvolvimento focados no terminal** — operações rápidas, scripting, pipelines de CI e gerenciamento de múltiplas instâncias locais sem sair do terminal.

Sem GUI. Sem overhead. Só velocidade.

---

## 🐳 Suporte Docker (Em Breve)

O `pgm` poderá detectar e interagir com instâncias PostgreSQL rodando dentro de containers Docker — listando, conectando e gerenciando-as tão naturalmente quanto instâncias locais.

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
git clone https://github.com/your-user/cli-pgm.git
cd cli-pgm
npm install
npm run dev
```

---

## 📄 Licença

MIT
