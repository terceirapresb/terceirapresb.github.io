const fs = require('fs');
const path = require('path');

const audioDir = path.join(__dirname, 'audio');
const outputJsonPath = path.join(__dirname, 'songs.json');

try {
    console.log('🎵 Iniciando varredura do diretório de áudio...');
    
    // Verifica se o diretório audio existe
    if (!fs.existsSync(audioDir)) {
        throw new Error('Diretório /audio não encontrado!');
    }

    const songs = {};

    // 1. Ler as pastas de cada música dentro de /audio
    const items = fs.readdirSync(audioDir, { withFileTypes: true });
    const songFolders = items
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    console.log(`📁 Pastas encontradas: ${songFolders.join(', ')}`);

    // 2. Iterar sobre cada pasta de música
    for (const songFolder of songFolders) {
        const songPath = path.join(audioDir, songFolder);
        const tracks = [];

        console.log(`🔍 Analisando pasta: ${songFolder}`);

        // 3. Ler os arquivos de áudio dentro da pasta da música
        const files = fs.readdirSync(songPath);
        const audioFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.mp3', '.wav', '.ogg', '.flac', '.m4a'].includes(ext);
        });

        console.log(`  📄 Arquivos de áudio encontrados: ${audioFiles.join(', ')}`);

        // 4. Montar o array de tracks no formato esperado pelo seu código
        for (const audioFile of audioFiles) {
            // Remove a extensão para usar como nome da track
            const trackName = path.parse(audioFile).name;
            // Cria o caminho relativo que será usado no player
            const trackPath = `audio/${songFolder}/${audioFile}`;
            
            tracks.push({
                name: trackName,
                path: trackPath
            });
        }

        // Adiciona apenas se encontrou alguma faixa de áudio
        if (tracks.length > 0) {
            songs[songFolder] = tracks;
            console.log(`  ✅ ${tracks.length} tracks adicionadas para "${songFolder}"`);
        } else {
            console.log(`  ⚠️  Nenhuma track encontrada para "${songFolder}"`);
        }
    }

    // 5. Escrever o objeto songs no formato JSON
    const jsonContent = JSON.stringify(songs, null, 4);
    fs.writeFileSync(outputJsonPath, jsonContent);

    console.log('\n🎉 Sucesso! Arquivo songs.json gerado!');
    console.log(`📍 Local: ${outputJsonPath}`);
    console.log(`🎶 Total de músicas: ${Object.keys(songs).length}`);
    
    // Mostra um preview do JSON gerado
    console.log('\n📋 Preview do JSON gerado:');
    console.log(JSON.stringify(songs, null, 2));

} catch (error) {
    console.error('❌ Erro ao gerar o arquivo JSON:', error.message);
    process.exit(1);
}