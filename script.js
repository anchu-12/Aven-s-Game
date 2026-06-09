const apiUrl = "https://api.deepseek.com/v1/chat/completions"; 
let apiKey = ""; let chatHistory = []; let currentSlot = 1; let isTyping = false; 
let globalInvCache = "无"; let globalRelCache = "还未遇到重要角色...";

const setupContainer = document.getElementById('setup-container');
const gameContainer = document.getElementById('game-container');
const storyDisplay = document.getElementById('story-display');
const playerInput = document.getElementById('player-input');

if(localStorage.getItem('my_ai_game_key')) {
    document.getElementById('api-key-input').value = localStorage.getItem('my_ai_game_key');
}

function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if(show) {
        document.getElementById('modal-inv').style.display = 'none';
        document.getElementById('modal-rel').style.display = 'none';
        modal.style.display = 'block';
    } else {
        modal.style.display = 'none';
    }
}

function quickLoad(slot) {
    const saved = localStorage.getItem(`ai_story_slot_${slot}`);
    const key = document.getElementById('api-key-input').value.trim() || localStorage.getItem('my_ai_game_key');
    if (!saved) return alert(`进度槽 ${slot} 是空的，请填写设定创建新游戏。`);
    if (!key) return alert("请输入你的 API Key 才能读取存档！");
    apiKey = key; localStorage.setItem('my_ai_game_key', apiKey);
    currentSlot = slot; loadGameFromSlot(slot);
}

document.getElementById('start-game-btn').addEventListener('click', async () => {
    if(isTyping) return;
    apiKey = document.getElementById('api-key-input').value.trim();
    if (!apiKey) return alert("请输入你的 DeepSeek API Key 才能开始游戏！");
    localStorage.setItem('my_ai_game_key', apiKey);

    chatHistory = [
        { role: "system", content: `你是一个顶级的纯场景叙事NPC。规则：玩家主导，你只描绘环境变化，绝不替玩家做决定。每次回复末尾必须附带一行：DATA_START{"inv":"当前持有的全部装备","loc":"当前所在位置","rel":"与各个主要NPC的关系（一句话短评）"}DATA_END` },
        { role: "system", content: `世界观：${document.getElementById('world-input').value||"都市"}\n主角：${document.getElementById('character-input').value||"普通人"}\n主线：${document.getElementById('plot-input').value||"自由探索"}\n请生成开场白，末尾带上初始DATA。` }
    ];
    setupContainer.style.display = 'none'; gameContainer.style.display = 'block'; storyDisplay.innerHTML = ""; 
    await getAIResponse(appendSystemMessage('⏳ 正在构建世界...'));
});

document.getElementById('send-btn').addEventListener('click', handlePlayerTurn);
playerInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handlePlayerTurn(); });

async function handlePlayerTurn() {
    if (isTyping || !playerInput.value.trim()) return; 
    const action = playerInput.value.trim(); playerInput.value = '';
    document.getElementById('modal-inv').style.display = 'none'; document.getElementById('modal-rel').style.display = 'none';
    chatHistory.push({ role: "user", content: action });
    await getAIResponse(appendSystemMessage('⚡ 推演中...'), createStoryBlock(`> ${action}`));
}

async function getAIResponse(loadingId, blockId = null) {
    try {
        const response = await fetch(apiUrl, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: "deepseek-chat", messages: chatHistory, temperature: 0.75 })
        });
        if (!response.ok) throw new Error("连线断开");
        const data = await response.json(); let rawContent = data.choices[0].message.content;
        document.getElementById(loadingId)?.remove();

        let cleanStory = rawContent;
        const dataMatch = rawContent.match(/DATA_START([\s\S]*?)DATA_END/);
        if (dataMatch) { updateStatusBar(dataMatch[1]); cleanStory = rawContent.replace(/DATA_START([\s\S]*?)DATA_END/, '').trim(); }
        
        if (!blockId) blockId = createStoryBlock("【序章：命运的起点】");
        await appendTextWithFastTypewriter(document.getElementById(blockId).querySelector('.ai-response'), cleanStory);
        
        chatHistory.push({ role: "assistant", content: rawContent });
        refreshCollapsibleBlocks(); localStorage.setItem(`ai_story_slot_${currentSlot}`, JSON.stringify(chatHistory));
    } catch (error) { document.getElementById(loadingId).innerText = `❌ ${error.message}`; }
}

function createStoryBlock(userText) {
    const blockId = 'block-' + Date.now(); const blockDiv = document.createElement('div');
    blockDiv.id = blockId; blockDiv.className = 'story-block';
    blockDiv.innerHTML = `<div class="user-action">${userText}</div><div class="ai-response"></div>`;
    blockDiv.querySelector('.user-action').addEventListener('click', () => { if (blockDiv.classList.contains('collapsible')) blockDiv.classList.toggle('collapsed'); });
    storyDisplay.appendChild(blockDiv); storyDisplay.scrollTop = storyDisplay.scrollHeight;
    return blockId;
}

function refreshCollapsibleBlocks() {
    const allBlocks = document.querySelectorAll('.story-block');
    allBlocks.forEach((block, index) => {
        if (index < allBlocks.length - 3) {
            if (!block.classList.contains('collapsible')) { block.classList.add('collapsible', 'collapsed'); }
        } else { block.classList.remove('collapsible', 'collapsed'); }
    });
}

function appendTextWithFastTypewriter(target, text) {
    return new Promise((resolve) => {
        isTyping = true; let index = 0;
        const timer = setInterval(() => {
            target.innerText += text.substr(index, 4); index += 4; storyDisplay.scrollTop = storyDisplay.scrollHeight; 
            if (index >= text.length) { clearInterval(timer); isTyping = false; resolve(); }
        }, 15); 
    });
}

function updateStatusBar(jsonStr) {
    try {
        const status = JSON.parse(jsonStr.trim());
        if(status.loc) document.getElementById('status-loc').innerText = status.loc;
        if(status.inv) { globalInvCache = status.inv; document.getElementById('status-inv-box').innerText = status.inv; }
        if(status.rel) { globalRelCache = status.rel; document.getElementById('status-rel-box').innerText = status.rel; }
        else document.getElementById('status-rel-box').innerText = globalRelCache;
    } catch(e) {}
}

function appendSystemMessage(text) {
    const msgDiv = document.createElement('div'); msgDiv.id = 'sys-' + Date.now();
    msgDiv.className = 'system-msg'; msgDiv.innerText = text;
    storyDisplay.appendChild(msgDiv); storyDisplay.scrollTop = storyDisplay.scrollHeight; return msgDiv.id;
}

function loadGameFromSlot(slot) {
    const saved = localStorage.getItem(`ai_story_slot_${slot}`); if (!saved) return;
    chatHistory = JSON.parse(saved); setupContainer.style.display = 'none'; gameContainer.style.display = 'block'; storyDisplay.innerHTML = ""; 
    let tempUserText = "【序章：重新连接】";
    chatHistory.forEach(msg => {
        if (msg.role === 'user') tempUserText = `> ${msg.content}`;
        else if (msg.role === 'assistant') {
            let cleanText = msg.content; const dataMatch = msg.content.match(/DATA_START([\s\S]*?)DATA_END/);
            if (dataMatch) { updateStatusBar(dataMatch[1]); cleanText = msg.content.replace(/DATA_START([\s\S]*?)DATA_END/, '').trim(); }
            document.getElementById(createStoryBlock(tempUserText)).querySelector('.ai-response').innerText = cleanText;
        }
    });
    refreshCollapsibleBlocks(); appendSystemMessage(`💾 成功跃迁回时空节点【${slot}】。`);
}

// 核心功能：一键将当前全部剧情打包生成纯净 TXT 小说文档
function exportStory() {
    if (!chatHistory || chatHistory.length <= 2) {
        return alert("当前还没有任何冒险记录，无法导出！");
    }
    
    let textOutput = `==================================================\n`;
    textOutput += `        📜 《AI 文字冒险：我的命运回忆录》 📜        \n`;
    textOutput += `==================================================\n`;
    textOutput += `导出时间：${new Date().toLocaleString()}\n`;
    textOutput += `当前存档：进度槽位 【${currentSlot}】\n`;
    textOutput += `--------------------------------------------------\n\n`;

    let turnNumber = 1;
    chatHistory.forEach(msg => {
        if (msg.role === 'system') return; // 自动跳过后台系统参数设定

        if (msg.role === 'user') {
            textOutput += `【第 ${turnNumber} 步 · 我的抉择】>\n${msg.content}\n\n`;
            turnNumber++;
        } else if (msg.role === 'assistant') {
            // 核心清洗：自动精准剔除不可见的 DATA_START / DATA_END 数据，保留最纯净的小说剧情文本
            let cleanNarrative = msg.content.replace(/DATA_START([\s\S]*?)DATA_END/, '').trim();
            textOutput += `【世界的推演】:\n${cleanNarrative}\n`;
            textOutput += `\n--------------------------------------------------\n\n`;
        }
    });

    textOutput += `=== 剧本终 · 见证了你的伟大史诗 ===\n`;

    try {
        const blob = new Blob([textOutput], { type: "text/plain;charset=utf-8" });
        const downloadUrl = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        downloadLink.download = `我的文字冒险回忆录_进度${currentSlot}_${new Date().toISOString().slice(0,10)}.txt`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadUrl);
    } catch (e) {
        alert("浏览器限制了自动下载，请尝试在手机独立浏览器（如 Safari, Chrome, Edge）中打开此游戏。");
    }
}

[1,2,3].forEach(slot => document.getElementById(`save-btn-${slot}`).addEventListener('click', () => { currentSlot = slot; localStorage.setItem(`ai_story_slot_${slot}`, JSON.stringify(chatHistory)); alert(`💾 已保存至槽位【${slot}】`); }));
document.getElementById('del-btn-all').addEventListener('click', () => { if(confirm("销毁此档？")) { localStorage.removeItem(`ai_story_slot_${currentSlot}`); location.reload(); }});
document.getElementById('back-menu-btn').addEventListener('click', () => { if(!isTyping) location.reload(); });