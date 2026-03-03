🇧🇷 Português | 🇺🇸 [English](./README.md)

<p align="center">
  <strong>Infrastructure-grade power. Developer-grade experience.</strong>
</p>

<p align="center">
  <img src=".github/assets/logo.svg" alt="Herdux banner" style="max-width: 100%; width: 600px;" />
</p>

## Herdux — Database Workflow CLI

Uma CLI rápida e interativa que remove a fricção dos workflows diários com bancos de dados locais, especialmente ao lidar com múltiplas instâncias e grandes datasets.

![Version](https://img.shields.io/badge/version-0.8.2-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-18%2B-43853d.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=flat&logo=mysql&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat&logo=sqlite&logoColor=white)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-%E2%9D%A4-pink?style=flat&logo=github)](https://github.com/sponsors/eduardozaniboni)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy_Me_A_Coffee-FFDD00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/eduardozaniboni)

> Otimizado para ambientes locais e de desenvolvimento. O uso em produção é suportado com configuração explícita.

---

## Início Rápido

```bash
npm install -g herdux-cli

# Use 'herdux' ou o alias mais curto 'hdx'
hdx doctor
herdux list
```

---

## Engines Suportadas

| Engine     | Status | Ferramentas Cliente Necessárias |
| ---------- | ------ | ------------------------------- |
| PostgreSQL | ✅     | `psql`, `pg_dump`, `pg_restore` |
| MySQL      | ✅     | `mysql`, `mysqldump`            |
| SQLite     | ✅     | `sqlite3`                       |

Use `--engine <nome>` ou configure a engine em um perfil salvo. PostgreSQL é o padrão.

```bash
herdux list                        # PostgreSQL (padrão)
herdux --engine mysql list         # MySQL
herdux --engine sqlite list        # SQLite (baseado em arquivos, sem servidor)
herdux list -s meu-perfil          # Usando um perfil de servidor salvo
```

---

## Por que Herdux?

Gerenciar bancos de dados locais por meio de binários brutos é repetitivo, propenso a erros e diferente para cada engine.

**Antes:**

```bash
# Backup PostgreSQL
pg_dump -U postgres -h localhost -p 5416 -Fc -f ./backups/mydb.dump mydb

# Backup MySQL
mysqldump -u root -h localhost -P 3306 -p mydb > ./backups/mydb.sql

# Flags diferentes, ferramentas diferentes, memória muscular diferente para cada engine.
```

**Depois:**

```bash
herdux backup mydb --drop --yes        # Backup + drop em um comando
herdux restore ./backups/mydb.dump --db mydb   # Detecta formato, cria DB se necessário
herdux clean                            # Multi-seleção e batch-drop de bancos
herdux doctor                           # Verificação completa do sistema
```

Mesmos comandos. Qualquer engine. Menos flags. Menos erros. Zero fadiga de terminal.

---

## Requisitos

- **Node.js** 18 ou superior
- **Para PostgreSQL:** `psql`, `pg_dump`, `pg_restore` instalados e no `PATH`
- **Para MySQL:** `mysql`, `mysqldump` instalados e no `PATH`
- **Para SQLite:** `sqlite3` instalado e no `PATH`

> [!TIP]
> Execute `herdux doctor` após a instalação para verificar se tudo está configurado corretamente.

---

## Instalação

**npm (recomendado):**

> **Importante:** Use a flag `-g` para que a CLI fique disponível em qualquer lugar no terminal.

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

## Comandos

### `herdux version`

Mostra a versão da CLI e a versão do servidor de banco de dados conectado.

```bash
herdux version
herdux --engine mysql version
```

### `herdux doctor`

Executa uma verificação completa do sistema: verifica ferramentas cliente, testa conectividade e valida autenticação.

```bash
herdux doctor
herdux --engine mysql doctor
```

---

### `herdux list`

Lista todos os bancos de dados no servidor conectado.

```bash
herdux list              # Nome, owner, encoding
herdux ls --size         # Inclui tamanho em disco, ordenado do maior para o menor
```

> [!NOTE]
> A flag `--size` calcula o uso físico de disco. Em servidores com dezenas de bancos de vários GBs, isso pode levar alguns minutos.

---

### `herdux create <nome>`

Cria um novo banco de dados.

```bash
herdux create meu_novo_banco
herdux --engine mysql create meu_novo_banco
```

### `herdux drop <nome>`

Remove um banco de dados com confirmação interativa.

```bash
herdux drop banco_antigo
```

---

### `herdux clean`

Limpeza em massa interativa: selecione vários bancos, gere backups de segurança e remova-os em lote.

```bash
herdux clean
```

Aborta imediatamente se algum backup de segurança falhar. Nenhum dado é removido sem um backup confirmado.

---

### `herdux backup <database>`

Cria um backup com timestamp em `~/.herdux/backups/` por padrão.

```bash
herdux backup mydb                       # Formato nativo da engine (.dump para PG, .db para SQLite, .sql para MySQL)
herdux backup mydb --format plain        # SQL puro (.sql)
herdux backup mydb --drop                # Backup e depois pergunta se quer dropar
herdux backup mydb --drop --yes          # Backup + drop sem confirmação
herdux backup mydb -o ./meus-backups     # Diretório de saída personalizado
```

| Opção                 | Descrição                                                  |
| --------------------- | ---------------------------------------------------------- |
| `-F, --format <tipo>` | `custom` (padrão, nativo da engine) ou `plain` (SQL)       |
| `-d, --drop`          | Pergunta se quer dropar o banco após o backup bem-sucedido |
| `-y, --yes`           | Pula a confirmação de drop (requer `--drop`)               |
| `-o, --output <dir>`  | Diretório de saída (padrão: `~/.herdux/backups`)           |

---

### `herdux restore <arquivo>`

Restaura um banco de dados a partir de um arquivo de backup. Detecta automaticamente o formato pela extensão.

```bash
herdux restore ./backups/mydb_2026-02-23.dump --db mydb
herdux restore ./exports/data.sql --db mydb
herdux restore archive.bkp --db mydb --format custom   # Forçar formato
```

O banco de dados é criado automaticamente se não existir.

> [!NOTE]
> Ao restaurar dumps de ambientes gerenciados (ex: AWS RDS), o Herdux configura a ferramenta de restauração para ignorar ownership e ACLs, evitando erros por roles de produção ausentes localmente.

---

### `herdux inspect <arquivo>`

Inspeciona o conteúdo de um arquivo de backup sem se conectar ao banco de dados. Funciona completamente offline.

| Extensão          | Output                                                                         |
| ----------------- | ------------------------------------------------------------------------------ |
| `.dump`           | Formato custom do PostgreSQL: Table of Contents completo (`pg_restore --list`) |
| `.tar`            | Formato tar do PostgreSQL: Table of Contents completo (`pg_restore --list`)    |
| `.sql`            | SQL puro (qualquer engine): declarações CREATE TABLE, VIEW, INDEX, SEQUENCE    |
| `.db` / `.sqlite` | Arquivo SQLite: schema (`sqlite3 .schema`)                                     |

```bash
hdx inspect backup.dump           # Table of Contents de um dump custom do PostgreSQL
hdx inspect backup.tar            # Table of Contents de um dump tar do PostgreSQL
hdx inspect export.sql            # CREATE statements extraídos de SQL puro
hdx inspect mydb.db               # Schema do SQLite
```

---

### `herdux docker`

Gerencia containers de banco de dados rodando via Docker. Nao requer conexao ativa com o banco.

```bash
hdx docker list             # Lista containers postgres/mysql em execucao
hdx docker list --all       # Inclui containers parados
hdx docker start pg-dev     # Inicia um container parado
hdx docker stop pg-dev      # Para um container em execucao
hdx docker stop pg-dev --remove   # Para e remove o container
```

---

### `herdux cloud`

Gerencia arquivos de backup em cloud storage S3-compatible (AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces e outros).

```bash
# Configurar
hdx cloud config bucket meu-bucket
hdx cloud config region us-east-1
hdx cloud config access-key AKIAIO...
hdx cloud config secret-key wJalrX...
hdx cloud config endpoint https://account.r2.cloudflarestorage.com  # opcional, para provedores nao-AWS

# Gerenciar backups no bucket
hdx cloud list                            # Lista todos os arquivos de backup no bucket
hdx cloud list --prefix backups/mydb/    # Filtra por prefixo
hdx cloud download backups/mydb_2026-03-03.dump
hdx cloud download backups/mydb_2026-03-03.dump -o /tmp/
hdx cloud delete backups/mydb_2026-03-03.dump   # Pede confirmacao
hdx cloud delete backups/mydb_2026-03-03.dump --yes

# Backup direto para o S3
hdx backup mydb --upload backups/         # Backup e upload para o prefixo backups/
hdx backup mydb --upload                  # Backup e upload para a raiz do bucket

# Restore direto do S3
hdx restore s3://meu-bucket/backups/mydb_2026-03-03.dump --db mydb
```

As credenciais tambem podem ser fornecidas via variaveis de ambiente (recomendado para CI/producao):

```bash
export AWS_ACCESS_KEY_ID=AKIAIO...
export AWS_SECRET_ACCESS_KEY=wJalrX...
export AWS_DEFAULT_REGION=us-east-1
```

---

## Configuração e Perfis de Servidor

A configuração é armazenada em `~/.herdux/config.json`.

### Valores globais padrão

```bash
herdux config set engine postgres
herdux config set user postgres
herdux config set password minha_senha
herdux config set port 5432
```

### Perfis de servidor nomeados

```bash
herdux config add pg16 --port 5416
herdux config add pg17 --port 5417 --user admin
herdux config add mysql-dev --port 3306 --user root --password secret --engine mysql
herdux config add staging --host 192.168.0.10 --port 5432
```

Use perfis com a flag `-s`:

```bash
herdux list -s pg16
herdux backup mydb -s mysql-dev
```

### Gerenciar configuração

```bash
herdux config list           # Mostrar todas as configurações e perfis
herdux config get port       # Obter um valor específico
herdux config rm pg16        # Remover um perfil
herdux config reset          # Limpar toda a configuração
```

---

## Resolução de Conexão e Engine

O Herdux segue uma prioridade estrita e previsível ao resolver como se conectar.

**Prioridade de engine:**

| Prioridade | Fonte        | Exemplo                          |
| ---------- | ------------ | -------------------------------- |
| 1          | Flag CLI     | `herdux --engine mysql list`     |
| 2          | Perfil       | Campo `engine` do perfil         |
| 3          | Padrão salvo | `herdux config set engine mysql` |
| 4          | Fallback     | `postgres`                       |

**Prioridade de conexão:**

| Prioridade | Fonte          | Exemplo                                    |
| ---------- | -------------- | ------------------------------------------ |
| 1          | Flags CLI      | `herdux list --port 5417`                  |
| 2          | Perfil         | `herdux list -s pg16`                      |
| 3          | Padrões salvos | `herdux config set port 5432`              |
| 4          | Auto-discovery | Escaneia portas comuns; pergunta se vários |

Input explícito sempre vence. Sem surpresas.

---

## Contribuindo

```bash
git clone https://github.com/herdux/herdux-cli.git
cd herdux-cli
npm install

npm run test:unit           # Testes unitários (238 testes, todas as engines)
npm run test:integration    # Testes de integração
npm run test:e2e:pgsql      # Testes E2E para PostgreSQL (requer Docker)
npm run test:e2e:mysql      # Testes E2E para MySQL (requer Docker)
npm run test:e2e:sqlite     # Testes E2E para SQLite (requer sqlite3)
```

O Herdux segue limites arquiteturais estritos: comandos são agnósticos de engine, engines encapsulam todo comportamento específico de banco, e todos os binários são isolados por adaptadores. Mantenha esses limites ao contribuir.

PRs são bem-vindos. Abra uma issue primeiro para mudanças maiores.

---

## Suporte

Se o Herdux te salvou horas de debugging e trabalho com bancos de dados, considere apoiar o projeto:

<a href="https://github.com/sponsors/eduardozaniboni" target="_blank"><img src="https://img.shields.io/badge/Sponsor-%E2%9D%A4-pink?style=for-the-badge&logo=github" alt="GitHub Sponsors"></a>
<a href="https://www.buymeacoffee.com/eduardozaniboni" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 28px !important;width: 100px !important;" ></a>

---

## Licença

MIT
