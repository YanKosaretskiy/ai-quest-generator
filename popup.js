document.addEventListener('DOMContentLoaded', () => {

  // --- ХРАНИЛИЩЕ КОНТЕКСТА ---
  let gameHistory = []; 

  const SYSTEM_INSTRUCTION = `Ты — профессиональный ведущий текстовых RPG квестов (Dungeon Master). 
Твоя задача — вести игрока по сюжету на основе выбранного им мира, персонажа и стартовой ситуации.
ПРАВИЛА:
1. Пиши сочно, атмосферно, но лаконично (не больше 2-3 абзацев за ход), чтобы текст легко читался в маленьком окне.
2. НИКОГДА не принимай решения за игрока и не пиши его действия. Опиши последствия его предыдущего хода, изменившуюся обстановку вокруг и ОСТАНОВИСЬ, ожидая его решения.
3. В самом конце своего ответа ОБЯЗАТЕЛЬНО предлагай 3 коротких и логичных варианта действий на выбор (каждый с новой строки, начиная с эмодзи 🔸). Например:
🔸 Попробовать взломать замок.
🔸 Спрятаться за ящиками.
🔸 Выйти на свет и поднять руки.`;

  // Элементы интерфейса
  const setupMenu = document.getElementById('setup-menu');
  const gameScreen = document.getElementById('game-screen');
  const chatHistory = document.getElementById('chat-history');
  const playerActionField = document.getElementById('player-action');
  const startBtn = document.getElementById('start-btn');
  const randomAllBtn = document.getElementById('random-all-btn');
  const sendBtn = document.getElementById('send-btn');
  const resetBtn = document.getElementById('reset-btn');
  const imageStyleSelect = document.getElementById('image-style');
  const questImageBox = document.getElementById('quest-image');

  // --- ЛОГИКА СОХРАНЕНИЯ ПРОГРЕССА (LOCAL STORAGE) ---
  function saveGameState() {
    const state = {
      history: gameHistory,
      chatHtml: chatHistory.innerHTML,
      currentImage: questImageBox.querySelector('img')?.src || '',
      style: imageStyleSelect.value
    };
    chrome.storage.local.set({ 'saved_quest_session': state });
  }

  function loadGameState() {
    chrome.storage.local.get(['saved_quest_session'], (result) => {
      if (result.saved_quest_session) {
        const data = result.saved_quest_session;
        gameHistory = data.history;
        chatHistory.innerHTML = data.chatHtml;
        imageStyleSelect.value = data.style || "photorealistic, high detail, 8k, cinematic lighting, moody atmosphere";
        
        setupMenu.style.display = 'none';
        gameScreen.style.display = 'flex';
        autoResizeField(playerActionField);
        
        if (data.currentImage) {
          questImageBox.innerHTML = `<img src="${data.currentImage}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">`;
        }
        
        rebindVariantButtons();
        chatHistory.scrollTop = chatHistory.scrollHeight;
      }
    });
  }

  // --- ДИНАМИЧЕСКИЕ ПОДСКАЗКИ ---
  const suggestButtons = document.querySelectorAll('.suggest-btn');
  suggestButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-target');
      const textValue = button.getAttribute('data-value');
      const inputField = document.getElementById(targetId);
      if (inputField) {
        inputField.value = textValue;
        autoResizeField(inputField);
      }
    });
  });

  function autoResizeField(field) {
    field.style.height = 'auto'; 
    field.style.height = (field.scrollHeight + 2) + 'px'; 
  }

  const textAreas = document.querySelectorAll('textarea');
  textAreas.forEach(field => {
    field.addEventListener('input', () => autoResizeField(field));
  });

  // --- КНОПКА СЛУЧАЙНОГО ПРЕСЕТА ---
  const questsDatabase = [
    {
      world: "Средневековое темное фэнтези с опасной магией и монстрами",
      char: "Маг-недоучка, изгнанный из академии за опасные эксперименты",
      situation: "Я исследую заброшенное древнее подземелье в поисках проклятого артефакта вместе со своей командой авантюристов. Мы только что услышали, как позади нас рухнул каменный проход..."
    },
    {
      world: "Космический научно-фантастический мир далекого будущего",
      char: "Бывалый наемник с кибернетическим протезом руки",
      situation: "Я остался последним выжившим на заброшенном исследовательском корабле. Системы жизнеобеспечения на исходе, в темноте коридоров слышны странные металлические щелчки, а радар показывает движение."
    },
    {
      world: "Мрачный киберпанк с неоновым смогом и всевластными корпорациями",
      char: "Опытный нетраннер (хакер) с поддельной цифровой личностью",
      situation: "Я проник в главный серверный дата-центм мегакорпорации, чтобы украсть секретные чертежи. Мой терминал внезапно заблокировался, включилась красная тревога, а двери шлюза начали закрываться."
    }
  ];

  randomAllBtn.addEventListener('click', () => {
    const randomIndex = Math.floor(Math.random() * questsDatabase.length);
    const selectedPreset = questsDatabase[randomIndex];
    const worldField = document.getElementById('world-setting');
    const charField = document.getElementById('char-class');
    const sitField = document.getElementById('start-situation');

    if (worldField && charField && sitField) {
      worldField.value = selectedPreset.world;
      charField.value = selectedPreset.char;
      sitField.value = selectedPreset.situation;
      autoResizeField(worldField);
      autoResizeField(charField);
      autoResizeField(sitField);
    }
  });

  // --- НАЧАЛО ИГРЫ ---
  startBtn.addEventListener('click', () => {
    const worldText = document.getElementById('world-setting').value.trim() || "Стандартное фэнтези";
    const charText = document.getElementById('char-class').value.trim() || "Искатель приключений";
    const situationText = document.getElementById('start-situation').value.trim() || "Я отправляюсь в путь.";

    setupMenu.style.display = 'none';
    gameScreen.style.display = 'flex';
    autoResizeField(playerActionField);

    const introElement = document.createElement('div');
    introElement.className = 'msg msg-ai';
    introElement.innerHTML = `
      <strong>Мир:</strong> ${worldText}<br>
      <strong>Персонаж:</strong> ${charText}<br>
      <hr style="border: 0; border-top: 1px solid #333; margin: 8px 0;">
      ${situationText}
    `;
    chatHistory.appendChild(introElement);

    const initialPrompt = `Привет! Мы начинаем текстовую игру. Мой игровой мир: "${worldText}". Мой персонаж: "${charText}". Вот стартовая ситуация: "${situationText}". Опиши, что происходит дальше и дай 3 варианта действий.`;

    sendRequestToGemini(initialPrompt);
  });

  // --- ГЕНЕРАЦИЯ КАРТИНКИ ЛОКАЦИИ ---
  async function updateSceneImage(textDescription) {
    const worldText = document.getElementById('world-setting').value.toLowerCase();
    const style = imageStyleSelect.value.toLowerCase() || "photorealistic, cinematic lighting";
    
    let englishWorldPrompt = "mysterious adventure location, fantasy landscape";
    
    if (worldText.includes("фэнтези") || worldText.includes("fantasy") || worldText.includes("маг")) {
      englishWorldPrompt = "dark medieval fantasy dungeon, ancient ruins, castle";
    } else if (worldText.includes("космос") || worldText.includes("sci-fi") || worldText.includes("космический")) {
      englishWorldPrompt = "abandoned sci-fi spaceship corridor, broken electronics, starship interior";
    } else if (worldText.includes("киберпанк") || worldText.includes("cyberpunk") || worldText.includes("нетраннер")) {
      englishWorldPrompt = "cyberpunk server room, neon glowing wires, mainframes, dark hacker room";
    } else if (worldText.includes("постапокалипсис") || worldText.includes("apocalypse")) {
      englishWorldPrompt = "post-apocalyptic ruined city, overgrown streets, moody fog";
    }

    const finalPrompt = `${englishWorldPrompt}, ${style}`;
    const promptText = encodeURIComponent(finalPrompt);
    
    const imageUrl = `https://image.pollinations.ai/p/${promptText}?width=512&height=512&seed=${Math.floor(Math.random() * 10000)}&model=flux&private=true`;

    questImageBox.innerHTML = `
      <div id="image-loading-status" style="font-size: 11px; color: #4CAF50; text-align: center; padding: 20px;">Нейросеть рисует кадр... 🎨</div>
      <img src="${imageUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:8px; opacity:0; transition: opacity 0.5s;">
    `;
    
    const imgElement = questImageBox.querySelector('img');
    
    imgElement.onload = () => { 
      imgElement.style.opacity = "1";
      const txt = document.getElementById('image-loading-status');
      if(txt) txt.remove();
      saveGameState();
    };

    imgElement.onerror = () => {
      const txt = document.getElementById('image-loading-status');
      if(txt) {
        txt.innerHTML = "<span style='color:#ff5252;'>Не удалось загрузить изображение 🖼️</span>";
      }
    };
  }

  // --- ЗАПРОС К GEMINI API ---
  async function sendRequestToGemini(userText) {
    const loadingElement = document.createElement('div');
    loadingElement.className = 'msg msg-ai';
    loadingElement.id = 'ai-loading-msg';
    loadingElement.innerHTML = `<em>Гейм-мастер подбрасывает кубики... 🎲</em>`;
    chatHistory.appendChild(loadingElement);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    gameHistory.push({ role: "user", parts: [{ text: userText }] });

    try {
      const response = await fetch(`${window.CONFIG.API_URL}?key=${window.CONFIG.API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: gameHistory,
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] }
        })
      });

      const data = await response.json();
      
      const loader = document.getElementById('ai-loading-msg');
      if (loader) loader.remove();

      if (data.error) throw new Error(data.error.message || "Ошибка API");

      const aiResponseText = data.candidates[0].content.parts[0].text;
      gameHistory.push({ role: "model", parts: [{ text: aiResponseText }] });

      // Отрисовка текста и превращение 🔸 в кликабельные кнопки
      const aiMsgElement = document.createElement('div');
      aiMsgElement.className = 'msg msg-ai';
      
      const lines = aiResponseText.split('\n');
      let htmlContent = '';
      
      lines.forEach(line => {
        if (line.trim().startsWith('🔸')) {
          const actionText = line.replace('🔸', '').trim();
          htmlContent += `<button class="action-variant-btn">${actionText}</button>`;
        } else {
          htmlContent += line + '<br>';
        }
      });

      aiMsgElement.innerHTML = htmlContent;
      chatHistory.appendChild(aiMsgElement);

      rebindVariantButtons();
      
      updateSceneImage(aiResponseText);
      
      saveGameState();
      
    } catch (error) {
      console.error("Ошибка:", error);
      const loader = document.getElementById('ai-loading-msg');
      if (loader) loader.remove();

      gameHistory.pop();

      const errorElement = document.createElement('div');
      errorElement.className = 'msg msg-ai';
      errorElement.style.borderLeftColor = '#f44336';
      errorElement.innerHTML = `<strong style="color: #f44336;">Ошибка связи:</strong> ${error.message || "Не удалось получить ответ"}.`;
      chatHistory.appendChild(errorElement);
    }

    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  // --- ХОД ИГРОКА ---
  function handlePlayerMove() {
    const actionText = playerActionField.value.trim();
    if (!actionText) return;

    const playerMsgElement = document.createElement('div');
    playerMsgElement.className = 'msg msg-player';
    playerMsgElement.innerHTML = `<strong>Вы:</strong> ${actionText}`;
    chatHistory.appendChild(playerMsgElement);

    playerActionField.value = '';
    autoResizeField(playerActionField);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    sendRequestToGemini(actionText);
  }

  sendBtn.addEventListener('click', handlePlayerMove);
  playerActionField.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handlePlayerMove();
    }
  });

  // --- СВЯЗЫВАНИЕ ВАРИАНТОВ ОТВЕТА ---
  function rebindVariantButtons() {
    const variantButtons = document.querySelectorAll('.action-variant-btn');
    variantButtons.forEach(btn => {
      btn.onclick = null; 
      btn.onclick = () => {
        const chosenAction = btn.textContent;
        const playerMsgElement = document.createElement('div');
        playerMsgElement.className = 'msg msg-player';
        playerMsgElement.innerHTML = `<strong>Вы:</strong> ${chosenAction}`;
        chatHistory.appendChild(playerMsgElement);
        
        chatHistory.scrollTop = chatHistory.scrollHeight;
        sendRequestToGemini(chosenAction);
      };
    });
  }

  // --- КНОПКА СБРОСА (НОВАЯ ИГРА) ---
  resetBtn.addEventListener('click', () => {
    if (confirm("Вы уверены, что хотите сбросить текущую игру и начать заново?")) {
      chrome.storage.local.remove('saved_quest_session', () => {
        location.reload(); 
      });
    }
  });

  // Запуск автозагрузки
  loadGameState();
});