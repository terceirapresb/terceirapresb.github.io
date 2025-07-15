# Player de Áudio Multifaixa

Um player de áudio web que permite reproduzir múltiplas faixas de áudio simultaneamente com controle individual de volume, mute e solo para cada faixa.

## 🎵 Funcionalidades

- **Reprodução sincronizada** - Todas as faixas tocam em perfeita sincronia
- **Controles principais** - Play, Pause e Stop para todas as faixas
- **Barra de progresso interativa** - Clique para navegar na música
- **Controle individual por faixa**:
  - Volume (slider 0-100%)
  - Mute/Unmute
  - Solo (isola uma faixa, silenciando as outras)
- **Exibição de tempo** - Tempo atual e total da música
- **Design responsivo** - Funciona em desktop e mobile
- **Compatível com iframe** - Pode ser incorporado em outras páginas

## 🚀 Como Usar

### Uso Básico
1. Coloque seus arquivos de áudio na pasta `/audio/nome_da_musica/`
2. Abra o `index.html` no navegador

### Uso em Iframe
```html
<iframe 
  src="index.html" 
  data-musica="Clamo Jesus" 
  data-width="800" 
  data-height="600"
  width="800" 
  height="600">
</iframe>
```

## 📁 Estrutura de Arquivos

```
projeto/
├── index.html          # Player principal
├── README.md          # Este arquivo
└── audio/             # Pasta com as músicas
    ├── musica_1/      # Exemplo: primeira música
    │   ├── bateria.mp3
    │   ├── baixo.mp3
    │   ├── guitarra.mp3
    │   └── voz.mp3
    ├── Clamo Jesus/   # Exemplo: segunda música
    │   ├── Bass.wav
    │   ├── Drums.wav
    │   ├── Vocals.wav
    │   └── Piano.wav
    └── outra_musica/  # Mais músicas...
        ├── instrumento1.mp3
        └── instrumento2.mp3
```

## ⚙️ Configuração

### Parâmetros do Iframe

| Atributo | Descrição | Exemplo |
|----------|-----------|---------|
| `data-musica` | Nome da pasta da música | `"Clamo Jesus"` |
| `data-width` | Largura do player | `"800"` |
| `data-height` | Altura do player | `"600"` |

### Formatos de Áudio Suportados
- MP3
- WAV
- OGG
- M4A

## 🎛️ Controles

### Principais
- **▶ Play** - Inicia reprodução de todas as faixas
- **⏸ Pause** - Pausa todas as faixas
- **⏹ Stop** - Para e reinicia todas as faixas

### Por Faixa
- **🔊 Mute** - Silencia/ativa a faixa específica
- **Solo** - Isola a faixa (muta todas as outras)
- **Volume** - Controle deslizante de 0 a 100%

### Navegação
- **Barra de progresso** - Clique para pular para qualquer momento da música
- **Tempo** - Exibe tempo atual e duração total

## 🔧 Características Técnicas

- **HTML5 Audio API** - Usa elementos `<audio>` nativos
- **JavaScript puro** - Sem dependências externas
- **CSS responsivo** - Adapta-se a diferentes tamanhos de tela
- **Sincronização precisa** - Todas as faixas mantêm sincronia perfeita
- **Detecção automática** - Carrega automaticamente todos os arquivos de áudio da pasta especificada

## 📱 Compatibilidade

- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Mobile browsers

## 🌐 Hospedagem

Funciona em qualquer hospedagem estática:
- GitHub Pages
- Netlify
- Vercel
- Surge.sh
- Servidor web local

## 🎨 Personalização

O player pode ser facilmente personalizado editando o CSS no arquivo `index.html`:

- Cores e gradientes
- Tamanhos e espaçamentos
- Animações e transições
- Layout responsivo

## 📝 Exemplos de Uso

### Incorporar em uma página
```html
<!DOCTYPE html>
<html>
<head>
    <title>Minha Página</title>
</head>
<body>
    <h1>Minha Música</h1>
    <iframe 
        src="player/index.html" 
        data-musica="Clamo Jesus"
        data-width="800"
        data-height="600"
        width="800" 
        height="600"
        frameborder="0">
    </iframe>
</body>
</html>
```

### Múltiplos players na mesma página
```html
<div class="players-container">
    <iframe src="player/index.html" data-musica="musica_1" width="400" height="300"></iframe>
    <iframe src="player/index.html" data-musica="musica_2" width="400" height="300"></iframe>
</div>
```

## 🚧 Desenvolvimento

Para adicionar novas funcionalidades:

1. **Novos controles** - Adicione botões no HTML e implemente a lógica no JavaScript
2. **Efeitos de áudio** - Use Web Audio API para processamento avançado
3. **Visualização** - Adicione canvas para visualização em tempo real
4. **Playlist** - Implemente navegação entre múltiplas músicas

## 📄 Licença

Este projeto é de código aberto e pode ser usado livremente.

---

**Desenvolvido para reprodução de áudio multifaixa em ambiente web** 🎵