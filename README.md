# 💊 Farmacinha Leticia

Aplicativo de **desktop para Windows** (Electron) para controle dos medicamentos
domésticos da família. Os dados ficam salvos **permanentemente no seu computador**,
mesmo depois de fechar o programa.

O grande diferencial: você cadastra medicamentos **fotografando a caixa com o
iPhone**. O celular manda a foto para o computador pela rede Wi-Fi e a **IA
(Claude Vision)** lê a embalagem e preenche os campos automaticamente para você
revisar.

---

## Funcionalidades

- ✅ Cadastro com **nome, forma farmacêutica, quantidade em estoque e validade**
- ✅ Três campos obrigatórios: **para que serve**, **dosagem recomendada para adulto**
  e **principais contraindicações**
- ✅ **Busca** por nome ou indicação (tolerante a acentos e maiúsculas)
- ✅ **Alerta automático** de vencimento quando faltam **15 dias ou menos**
- ✅ **Tela inicial** com resumo: total, no prazo, próximos do vencimento e vencidos
- ✅ **Editar** e **excluir** medicamentos
- ✅ **Persistência local** em arquivo (nada vai para a nuvem, exceto a foto enviada
  à IA no momento da leitura)
- ✅ Cadastro por **foto/vídeo do iPhone** (ou por arquivo no PC, ou manual)

---

## Como a captura pelo celular funciona

1. O app roda um pequeno **servidor local** no seu PC.
2. Na tela **Cadastrar**, aparece um **QR Code**.
3. Você abre a **câmera do iPhone** e aponta para o QR Code (ou digita o endereço
   no Safari). Importante: o celular precisa estar na **mesma rede Wi-Fi** do PC.
4. No celular, você tira a foto da caixa (frente com o nome e lateral com a validade)
   e toca em **Enviar**.
5. No computador, o app **abre o cadastro já preenchido** pela IA. Você confere,
   ajusta o que precisar e salva.

> Vídeos curtos também funcionam: o app extrai alguns quadros automaticamente.

### Consultar pelo celular

Na mesma tela do celular (a que abre pelo QR Code), toque em **“🔎 Consultar se já
tenho um remédio”**. Você digita o nome ou o sintoma e vê na hora o que já tem em
casa, com a validade e os detalhes — útil para checar na farmácia ou no mercado.
Também é possível salvar o endereço nos favoritos do Safari para abrir direto.

---

## Pré-requisitos

- **Windows 10 ou 11**
- **[Node.js 18+](https://nodejs.org)** (para rodar/gerar o app a partir do código)
- Uma **chave de API da Anthropic** (para a leitura por IA). Crie em
  <https://console.anthropic.com> → *API Keys*. A leitura de cada foto custa
  poucos centavos.

---

## Instalação e execução (modo desenvolvedor)

Abra o **Prompt de Comando** (ou PowerShell) na pasta do projeto e rode:

```bash
npm install
npm start
```

Na primeira vez, vá em **⚙️ Configurações** e cole sua **chave de API do Claude**.

---

## Gerar o instalador `.exe` (para instalar como um programa normal)

```bash
npm run dist
```

O instalador será criado na pasta `dist/` (ex.: `Farmacinha Leticia Setup 1.0.0.exe`).
Basta dar duplo-clique para instalar. Um atalho será criado na área de trabalho.

> Dica: para apenas empacotar sem gerar instalador, use `npm run pack`
> (resultado em `dist/win-unpacked/`).

---

## Liberar no Firewall do Windows (para o celular alcançar o PC)

Na **primeira vez** que o app iniciar o servidor, o Windows pode mostrar um aviso
do Firewall. Marque **"Redes privadas"** e clique em **Permitir acesso**. Sem isso,
o celular não consegue enviar as fotos.

Se você recusou sem querer: *Painel de Controle → Firewall do Windows Defender →
Permitir um aplicativo* e habilite o Farmacinha Leticia (ou o Electron/Node) em
redes privadas.

---

## Consultar fora de casa, com o PC desligado (PDF no OneDrive)

Os dados ficam no computador, então a consulta em casa exige o PC ligado. Para
consultar **de qualquer lugar**, o app pode gerar automaticamente um PDF
**“Minha Farmácia”** dentro do seu **OneDrive** sempre que você cadastra ou edita
um medicamento.

1. Vá em **⚙️ Configurações → Consulta fora de casa (OneDrive)**.
2. Deixe marcado **“Atualizar o PDF automaticamente”** (o app tenta usar a pasta do
   OneDrive; se preferir, use **“Mudar pasta”**).
3. Clique em **“Gerar/atualizar PDF agora”** para criar o arquivo pela primeira vez.

No celular, abra o **app do OneDrive**, entre na pasta **Farmacinha Leticia**, abra
o **Minha Farmacia.pdf** e use a busca do próprio leitor de PDF. Funciona com o
**computador desligado**, porque o OneDrive sincroniza o arquivo para a nuvem e para
o celular. É uma “fotografia” da farmácia, atualizada a cada mudança no PC.

## Onde os dados ficam salvos

Tudo fica na pasta de dados do app do Windows:

```
C:\Users\<seu-usuario>\AppData\Roaming\farmacinha-leticia\
├── farmacinha.json   ← seus medicamentos
├── config.json       ← chave de API e modelo
└── fotos\            ← fotos das embalagens
```

Para **fazer backup**, basta copiar essa pasta.

---

## Tecnologias

| Parte | Tecnologia | Por quê |
|------|------------|--------|
| App desktop | **Electron** | Instalável no Windows, com toda a interface em HTML/CSS/JS |
| Leitura das fotos | **Claude Vision** (`@anthropic-ai/sdk`) | Lê a embalagem e preenche os campos |
| Vídeo → quadros | **ffmpeg-static** | Extrai imagens de vídeos curtos, sem instalação extra |
| Captura pelo iPhone | **Express** (servidor local) + QR Code | Funciona por `http` na rede local, sem App Store |
| Dados | **Arquivo JSON local** (escrita atômica) | Simples, robusto e 100% offline |

Nenhum módulo nativo é compilado, então o empacotamento no Windows é direto.

---

## Estrutura do projeto

```
src/
├── main.js            App Electron: janela, servidor, IPC, protocolo de fotos
├── preload.js         Ponte segura entre a interface e o sistema
├── server.js          Servidor local que recebe fotos/vídeos do celular
├── store.js           Persistência em JSON + gerenciamento das fotos
├── ai.js              Leitura da embalagem com Claude Vision (+ ffmpeg)
├── meds.js            Regras de validade, busca e resumo
├── phone/capture.html Página aberta no iPhone para tirar/enviar a foto
└── renderer/          Interface do app (index.html, styles.css, app.js)
assets/                Ícones do aplicativo
```

---

## ⚠️ Aviso importante

As informações preenchidas pela IA (para que serve, dosagem, contraindicações)
são **sugestões para organização doméstica** e podem conter erros. **Sempre confira
a bula e consulte um médico ou farmacêutico** antes de usar qualquer medicamento.
