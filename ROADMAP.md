# Roadmap do Player de Prática Musical

Este documento descreve as funcionalidades planejadas para a evolução do player, garantindo que as ideias e os requisitos técnicos não se percam.

---

### Fase 1: Suíte de Prática (BPM & Tom) - **EM ANDAMENTO**

O objetivo desta fase é transformar o player em uma ferramenta de estudo poderosa, permitindo o controle de velocidade (BPM) e afinação (Tom) da música.

**Tarefas Detalhadas:**

1.  **Integração da Biblioteca `SoundTouchJS`**:
    *   **Descrição:** Adicionar a biblioteca SoundTouchJS ao projeto. Esta biblioteca é essencial para implementar as funcionalidades de *time-stretching* (mudar o tempo sem afetar o tom) e *pitch-shifting* (mudar o tom sem afetar o tempo) com alta qualidade.
    *   **Ação:** Incluir o script da biblioteca no `index.html`.

2.  **Atualização da Fonte de Dados (`songs.json`)**:
    *   **Descrição:** Enriquecer o arquivo `songs.json` com os metadados de BPM e Tom para cada música.
    *   **Ação:** Adicionar os campos `bpm` e `tom` aos objetos de cada música.
        *   Galileu: `bpm: 116`, `tom: "Am"`
        *   Clamo Jesus: `bpm: 74`, `tom: "E"`
        *   Eu e minha casa: `bpm: 75`, `tom: "G"`
        *   O senhor dos exercitos: `bpm: 74`, `tom: "Dm"`

3.  **Desenvolvimento da Interface (UI)**:
    *   **Descrição:** Criar os controles visuais para que o usuário possa interagir com as novas funcionalidades.
    *   **Ação:** Adicionar os seguintes elementos ao `index.html` e estilizá-los:
        *   **Controle de BPM:** Um slider ou campo numérico para ajustar o BPM.
        *   **Controle de Tom:** Um seletor (dropdown) com as 12 notas da escala cromática.
        *   **Metrônomo:** Um botão para ligar/desligar e um pequeno slider para seu volume.

4.  **Lógica do Player (`player.js`)**:
    *   **Descrição:** Implementar o "cérebro" das novas funcionalidades no motor de áudio.
    *   **Ação:**
        *   Integrar o SoundTouchJS para processar cada faixa de áudio.
        *   Criar a função `setBpm(novoBpm)` que ajusta o `playbackRate` de todas as faixas e a velocidade do metrônomo.
        *   Criar a função `setKey(novoTom)` que calcula a diferença em semitons e aplica o *pitch shift*.
        *   Implementar a lógica do metrônomo, incluindo a geração do som de "click" e o agendamento preciso usando o `audioContext.currentTime`.

5.  **Orquestração (`main.js` e `ui.js`)**:
    *   **Descrição:** Conectar os novos controles da UI às novas funções do player.
    *   **Ação:** Adicionar os `event listeners` para os controles de BPM, Tom e Metrônomo, que chamarão as respectivas funções em `player.js`.

---

### Fase 2: Ferramenta de Transcrição de Acordes (Ideia Futura)

O objetivo desta fase é criar uma ferramenta auxiliar, em uma página separada, para facilitar a criação dos dados de acordes sincronizados.

**Conceito:**

A ferramenta terá um "Modo de Transcrição" que permitirá ao usuário ouvir a música e marcar o tempo exato de cada mudança de acorde de forma interativa.

**Fluxo de Trabalho da Ferramenta:**

1.  **Página Dedicada:** A ferramenta viverá em uma página HTML separada (ex: `transcritor.html`) para não poluir a interface principal do player.
2.  **Carregar a Música:** O usuário seleciona a música que deseja transcrever.
3.  **Ativar "Modo de Transcrição"**:
    *   O usuário digita o nome do acorde em um campo de texto (ex: "Am").
    *   Ele dá play na música.
    *   No momento exato da mudança para "Am", ele aperta uma tecla (ex: Enter).
    *   O sistema captura o `currentTime` e armazena: `{"tempo": 15.2, "acorde": "Am"}`.
4.  **Repetir:** O processo é repetido para todos os acordes da música.
5.  **Exportar JSON:** Ao final, a ferramenta gera o bloco de código `acordes: [...]` completo, pronto para ser copiado e colado no arquivo `songs.json`.

---

### Fase 3: Outras Melhorias (Nice-to-Haves)

Funcionalidades adicionais para refinar ainda mais a experiência do usuário.

*   **Atalhos de Teclado:** Implementar atalhos para as ações mais comuns (Play/Pause, Stop, Mute/Solo, etc.).
*   **Persistência de Estado:** Usar o `localStorage` para salvar o mix de volume/mute/solo de cada música, para que as configurações do usuário não se percam.
