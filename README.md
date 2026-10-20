# 🗺️ WebGIS: Fluxos Migratórios para São Paulo
### Censo Demográfico das Origens Geográficas — 7º Ano do Ensino Fundamental
**Escola de Aplicação da Faculdade de Educação da Universidade de São Paulo (FEUSP / USP)**

---

## 📌 Sobre o Projeto

Este **WebGIS interativo** foi desenvolvido para cartografar e analisar os fluxos migratórios que formaram as famílias dos estudantes do **7º ano do Ensino Fundamental da Escola de Aplicação (FEUSP)**.

A pesquisa censitária escolar levantou as origens de nascimento em quatro gerações:
1. **Estudantes (7º ano):** 43 alunos (Turma 7º I com 23 alunos; Turma 7º II com 20 alunos).
2. **Pais (1ª geração ascendente):** Migrações mais recentes para São Paulo.
3. **Avós (2ª geração ascendente):** Auge das migrações inter-regionais do século XX.
4. **Bisavós (3ª geração ascendente):** Grandes ciclos migratórios nacionais e imigração internacional para o Brasil.

Todos os fluxos convergem diretamente para a **Escola de Aplicação da FEUSP**, localizada na Cidade Universitária (Butantã, São Paulo - SP).

---

## 🚀 Como Executar

### Opção 1: Direto no Navegador (Mais Rápido)
Basta dar **duplo clique** no arquivo:
👉 `index.html`

O mapa abrirá instantaneamente em qualquer navegador moderno (Chrome, Edge, Firefox, Safari) de forma rápida e 100% funcional offline.

### Opção 2: Via Servidor Local
👉 Dê duplo clique em `iniciar_webgis.bat` (ou execute `python -m http.server 8080` no terminal e acesse `http://localhost:8080`).

---

## ✨ Principais Atualizações & Recursos

### 1. 🎨 Setas Coloridas Distinguidas por Geração
As setas e linhas de fluxo agora são visualmente diferenciadas por cores vibrantes e contrastantes:
- 🟣 **Bisavós (3ª Geração):** Fúcsia / Magenta elétrico (`#d946ef`).
- 🟡 **Avós (2ª Geração):** Dourado / Âmbar solar (`#f59e0b`).
- 🔵 **Pais (1ª Geração):** Ciano / Turquesa elétrico (`#06b6d4`).
- 🎒 **Estudantes (Geração Atual):** Verde Esmeralda (`#10b981` - 100% nascidos em SP).

Quando a opção **"🌟 Todas Juntas"** está selecionada, o WebGIS desenha **arcos paralelos lado a lado** para cada geração existente em um mesmo local (ex: para a Bahia, você vê a seta de Bisavós, a de Avós e a de Pais fluindo juntas para São Paulo).

### 2. 🗺️ Mapa Político com Divisas Oficiais dos Estados (IBGE)
- **Divisas dos Estados do Brasil:** Malhas vetoriais oficiais do IBGE com os 27 estados desenhados com divisas nítidas, siglas UF e tooltips com os dados migratórios.
- **Divisas dos Países:** Contornos vetoriais de todos os países do mundo (*Natural Earth*).
- **Botão Flutuante de Divisas:** Permite ligar ou desligar as divisas estaduais sobre qualquer mapa de fundo (inclusive sobre a imagem de satélite).

### 3. 🛰️ Mapas Base 100% Livres de Marcas d'Água (Sem API Key)
Todas as camadas externas que exigiam chaves pagas foram substituídas por serviços públicos e abertos de alta qualidade:
- 🗺️ **Mapa Político:** Base clara neutra com divisas vetoriais de estados e países.
- 🛰️ **Satélite de Alta Resolução:** Imagens orbitais *Esri World Imagery*.
- 🛰️ **Satélite Híbrido:** Satélite com sobreposição de ruas, limites e cidades.
- 🗺️ **Mapa Urbano / Ruas:** Cartografia aberta e detalhada via *OpenStreetMap Standard*.
- 🌌 **Modo Noturno:** *Esri Dark Canvas* com alto contraste.

### 4. 📊 Top Origens & Ranking em Alto Contraste
- Cartões com contraste elevado e tipografia nítida.
- **Barra de Progresso Multisegmentada:** Cada barra exibe as proporções de Bisavós (🟣), Avós (🟡) e Pais (🔵).
- **Pílulas com Contadores por Geração:** Visualização instantânea de quantos migrantes pertencem a cada geração.
- Clicar em qualquer item da lista seleciona a rota e ajusta o zoom automaticamente.

---

## 📈 Principais Resultados do Censo

| Categoria | Destaques |
| :--- | :--- |
| **Estudantes (7º ano)** | **100% nascidos no Estado de São Paulo** (43 de 43). |
| **Top 5 Estados Brasileiros** | 1º **Bahia** (61 pessoas: 39 bisavós, 19 avós, 3 pais) <br> 2º **Minas Gerais** (53 pessoas: 35 bisavós, 16 avós, 2 pais) <br> 3º **Pernambuco** (35 pessoas: 19 bisavós, 13 avós, 3 pais) <br> 4º **Ceará** (19 pessoas: 13 bisavós, 6 avós) <br> 5º **Alagoas** (18 pessoas: 11 bisavós, 5 avós, 2 pais) |
| **Regiões Brasileiras** | **Nordeste:** Maior contingente migratório interno (143 pessoas - 63,5%). <br>**Sudeste (MG, RJ, ES):** 57 pessoas. <br>**Sul (RS, PR, SC):** 25 pessoas. |
| **Top Países Estrangeiros** | 1º **Portugal** (10 pessoas: 6 bisavós, 4 avós) <br> 2º **China** (6 pessoas: 4 avós, 2 pais) <br> 3º **Armênia** (4 pessoas: 4 bisavós) <br> 4º **Alemanha**, **El Salvador**, **França**, **Polônia** (3 cada) <br> Outros: **Itália**, **Inglaterra (Reino Unido)**, **Japão**, **Áustria**, **Rússia**, **Ucrânia**. |

---

## 📂 Arquivos do Projeto

```
Tabulação_Mari/
├── index.html                           # Interface WebGIS atualizada
├── styles.css                           # Estilos com alto contraste e barras multisegmentadas
├── app.js                               # Lógica das setas coloridas por geração e mapas
├── mapa_politico.js                     # Divisas oficiais dos Estados (IBGE) e Países (Natural Earth)
├── data.js                              # Banco de dados do censo tabulado e georreferenciado
├── data.json                            # Dados estruturados em formato JSON
├── iniciar_webgis.bat                   # Atalho de inicialização rápida
├── README.md                            # Documentação atualizada
└── Tabulacao Origens Geograficas7oEF 2026.xlsx # Planilha original do censo
```
