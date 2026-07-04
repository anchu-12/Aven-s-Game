const apiUrl = "https://api.deepseek.com/v1/chat/completions"; 

let apiKey = "";
let chatHistory = [];
let currentSlot = 1; 
let isTyping = false; 

const setupContainer = document.getElementById('setup-container');
const gameContainer = document.getElementById('game-container');
const storyDisplay = document.getElementById('story-display');
const playerInput = document.getElementById('player-input');
const sendBtn = document.getElementById('send-btn');
const startGameBtn = document.getElementById('start-game-btn');

window.toggleModal = function(modalId, show) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = show ? 'block' : 'none';
    }
}

if(localStorage.getItem('my_ai_game_key')) {
    document.getElementById('api-key-input').value = localStorage.getItem('my_ai_game_key');
}

function quickLoad(slot) {
    const saved = localStorage.getItem(`ai_story_slot_${slot}`);
    const key = document.getElementById('api-key-input').value.trim() || localStorage.getItem('my_ai_game_key');
    if (!saved) {
        alert(`进度槽 ${slot} 是空的，请填写设定创建新游戏。`);
        return;
    }
    if (!key) {
        alert("请输入你的 API Key 才能读取存档！");
        return;
    }
    apiKey = key;
    localStorage.setItem('my_ai_game_key', apiKey);
    currentSlot = slot;
    loadGameFromSlot(slot);
}

startGameBtn.addEventListener('click', async () => {
    if(isTyping) return;
    apiKey = document.getElementById('api-key-input').value.trim();
    const worldSetting = document.getElementById('world-input').value.trim() || "普通的现代都市";
    const charSetting = document.getElementById('character-input').value.trim() || "普通人";
    const plotSetting = document.getElementById('plot-input').value.trim() || "自由探索世界";
    // 核心改动加回：抓取用户选择的叙事人称规则
    const povSetting = document.getElementById('pov-select').value;

    if (!apiKey) {
        alert("请输入你的 DeepSeek API Key 才能开始游戏！");
        return;
    }
    localStorage.setItem('my_ai_game_key', apiKey);

    chatHistory = [
        {
            role: "system",
            content: `你是一个顶级的纯场景叙事NPC和文字游戏环境渲染器。
【核心行动守则——玩家主导】：
1. 剧情的发展速度必须完全掌控在玩家手中。你绝对不主动推动时间流逝或剧情大跨步，严禁主动宣布“任务完成”、“成功逃脱”或直接转场。
2. 玩家做出一个动作，你只细腻、生动、富有文学张力地描绘这一个动作带来的实时环境改变、声音、光影及NPC的实时反应。
3. 严禁提供任何“下一步行动建议”、“选项123”或“温馨提示”。把想象力留给玩家，让他们完全自由地输入。
4. 绝对、严禁替玩家做任何决定，也不要代替玩家说出他的台词。

【人称视角约束守则】：
你必须完全遵循【${povSetting}】。请在后续所有的场景推演、环境渲染、环境变化描述中强制执行这个代词标准，绝对不允许中途切换或者混淆人称！

【状态面板数据同步规则】：
在每次回复的最末尾，你必须严格按照以下格式附带一行数据（不要更改标签名字），用于更新网页顶部的状态栏。请根据剧情合理扣除或增加属性：
DATA_START{"hp":"生命值数值","inv":"当前全部装备道具","loc":"当前精准位置"}DATA_END`
        },
        {
            role: "system",
            content: `【当前游戏剧本设定】\n世界观：${worldSetting}\n主角设定：${charSetting}\n主线大方向：${plotSetting}\n\n请以此生成精彩的第一章开场白，描绘开局场景，不要给选项。并在末尾附带初始 DATA 数据。`
        }
    ];

    setupContainer.style.display = 'none';
    gameContainer.style.display = 'block';
    storyDisplay.innerHTML = ""; 

    const loadingId = appendSystemMessage('⏳ 正在全速构建高精度 Pro 游戏世界...');
    await getAIResponse(loadingId);
});

sendBtn.addEventListener('click', handlePlayerTurn);
playerInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handlePlayerTurn(); });

async function handlePlayerTurn() {
    if (isTyping) return; 
    const action = playerInput.value.trim();
    if (!action) return;

    playerInput.value = '';
    const blockId = createStoryBlock(`> ${action}`);
    chatHistory.push({ role: "user", content: action });
    const loadingId = appendSystemMessage('⚡ 满血大模型正在深度推演中...');

    await getAIResponse(loadingId, blockId);
}

async function getAIResponse(loadingId, blockId = null) {
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-v4-pro", 
                messages: chatHistory,
                temperature: 0.75
            })
        });

        const data = await response.json();
        let rawContent = data.choices[0].message.content;

        if (document.getElementById(loadingId)) {
            document.getElementById(loadingId).remove();
        }

        let cleanStory = rawContent;
        const dataMatch = rawContent.match(/DATA_START([\s\S]*?)DATA_END/);
        
        if (dataMatch) {
            updateStatusBar(dataMatch[1]);
            cleanStory = rawContent.replace(/DATA_START([\s\S]*?)DATA_END/, '').trim();
        }

        if (!blockId) {
            blockId = createStoryBlock("【序章：命运的起点】");
        }

        const blockDiv = document.getElementById(blockId);
        const aiDiv = blockDiv.querySelector('.ai-response');
        await appendTextWithFastTypewriter(aiDiv, cleanStory);

        chatHistory.push({ role: "assistant", content: rawContent });
        refreshCollapsibleBlocks();
        localStorage.setItem(`ai_story_slot_${currentSlot}`, JSON.stringify(chatHistory));

    } catch (error) {
        console.error(error);
        if (document.getElementById(loadingId)) {
            document.getElementById(loadingId).innerText = "❌ 连线断开，请检查网络、中转平台余额或 Key 状态。";
        }
    }
}

function createStoryBlock(userText) {
    const blockId = 'block-' + Date.now();
    const blockDiv = document.createElement('div');
    blockDiv.id = blockId;
    blockDiv.className = 'story-block';
    
    blockDiv.innerHTML = `
        <div class="user-action">${userText}</div>
        <div class="ai-response"></div>
    `;
    
    storyDisplay.appendChild(blockDiv);
    storyDisplay.scrollTop = storyDisplay.scrollHeight;
    return blockId;
}

storyDisplay.addEventListener('click', (e) => {
    const targetAction = e.target.closest('.user-action');
    if (!targetAction) return;
    const blockDiv = targetAction.parentElement;
    if (blockDiv && blockDiv.classList.contains('collapsible')) {
        blockDiv.classList.toggle('collapsed');
    }
});

function refreshCollapsibleBlocks() {
    const allBlocks = document.querySelectorAll('.story-block');
    const total = allBlocks.length;
    
    allBlocks.forEach((block, index) => {
        if (index < total - 5) {
            if (!block.classList.contains('collapsible')) {
                block.classList.add('collapsible');
                block.classList.add('collapsed');
            }
        } else {
            block.classList.remove('collapsible');
            block.classList.remove('collapsed');
        }
    });
}

function appendTextWithFastTypewriter(targetElement, text) {
    return new Promise((resolve) => {
        isTyping = true;
        let index = 0;
        const charsPerTick = 4; 
        
        const timer = setInterval(() => {
            targetElement.innerText += text.substr(index, charsPerTick);
            index += charsPerTick;
            storyDisplay.scrollTop = storyDisplay.scrollHeight; 
            
            if (index >= text.length) {
                clearInterval(timer);
                isTyping = false;
                resolve();
            }
        }, 15); 
    });
}

function updateStatusBar(jsonStr) {
    try {
        const status = JSON.parse(jsonStr.trim());
        if(status.hp) document.getElementById('status-hp').innerText = status.hp;
        if(status.inv) document.getElementById('status-inv-box').innerText = status.inv;
        if(status.loc) document.getElementById('status-loc').innerText = status.loc;
    } catch(e) {
        console.log("数据同步轻微溢出", e);
    }
}

function appendSystemMessage(text) {
    const msgDiv = document.createElement('div');
    const id = 'sys-' + Date.now();
    msgDiv.id = id;
    msgDiv.className = 'system-msg';
    msgDiv.innerText = text;
    storyDisplay.appendChild(msgDiv);
    storyDisplay.scrollTop = storyDisplay.scrollHeight; 
    return id;
}

function loadGameFromSlot(slot) {
    const saved = localStorage.getItem(`ai_story_slot_${slot}`);
    if (!saved) return;
    
    chatHistory = JSON.parse(saved);
    setupContainer.style.display = 'none';
    gameContainer.style.display = 'block';
    storyDisplay.innerHTML = ""; 
    
    let tempUserText = "【序章：重新连接】";
    
    chatHistory.forEach(msg => {
        if (msg.role === 'user') {
            tempUserText = `> ${msg.content}`;
        } else if (msg.role === 'assistant') {
            let cleanText = msg.content;
            const dataMatch = msg.content.match(/DATA_START([\s\S]*?)DATA_END/);
            if (dataMatch) {
                updateStatusBar(dataMatch[1]);
                cleanText = msg.content.replace(/DATA_START([\s\S]*?)DATA_END/, '').trim();
            }
            const blockId = createStoryBlock(tempUserText);
            document.getElementById(blockId).querySelector('.ai-response').innerText = cleanText;
        }
    });
    
    refreshCollapsibleBlocks();
    appendSystemMessage(`💾 成功跃迁回时空节点【${slot}】。`);
}

document.getElementById('export-btn').addEventListener('click', () => {
    if (!chatHistory || chatHistory.length <= 2) {
        return alert("当前还没有可导出的冒险历史！");
    }

    let textOutput = `==================================================\n`;
    textOutput += `        📜 《AI 文字冒险：我的命运回忆录》 📜        \n`;
    textOutput += `==================================================\n`;
    textOutput += `导出时间：${new Date().toLocaleString()}\n`;
    textOutput += `当前槽位：进度【${currentSlot}】\n`;
    textOutput += `--------------------------------------------------\n\n`;

    let turnNumber = 1;
    chatHistory.forEach(msg => {
        if (msg.role === 'system') return;
        if (msg.role === 'user') {
            textOutput += `【第 ${turnNumber} 步 · 我的抉择】>\n${msg.content}\n\n`;
            turnNumber++;
        } else if (msg.role === 'assistant') {
            let cleanNarrative = msg.content.replace(/DATA_START([\s\S]*?)DATA_END/, '').trim();
            textOutput += `【世界的推演】:\n${cleanNarrative}\n`;
            textOutput += `\n--------------------------------------------------\n\n`;
        }
    });

    textOutput += `=== 剧本终 · 见证了你的伟大史诗 ===\n`;

    const blob = new Blob(["\ufeff" + textOutput], { type: "text/plain;charset=utf-8" });
    const fileName = `我的冒险回忆录_进度${currentSlot}.txt`;

    const modal = document.getElementById('export-modal');
    const textarea = document.getElementById('export-textarea');
    textarea.value = textOutput;
    modal.style.display = 'flex'; 

    try {
        const downloadUrl = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadUrl);
    } catch (e) {
        console.log("环境限制原生下载，已自动切换到安全的内嵌面板复制方案");
    }
});

document.getElementById('copy-text-btn').addEventListener('click', () => {
    const textarea = document.getElementById('export-textarea');
    textarea.select();
    textarea.setSelectionRange(0, 99999); 
    try {
        document.execCommand('copy');
        alert('✨ 剧情文本已全选并成功复制到你的手机剪贴板！可以直接去粘贴保存啦。');
    } catch (err) {
        alert('请长按文本框内的文字进行手动全选复制。');
    }
});

document.getElementById('close-export-btn').addEventListener('click', () => {
    document.getElementById('export-modal').style.display = 'none';
});

// 注册存档按钮监听
document.getElementById('save-btn-1').addEventListener('click', () => { manualSave(1); });
document.getElementById('save-btn-2').addEventListener('click', () => { manualSave(2); });
document.getElementById('save-btn-3').addEventListener('click', () => { manualSave(3); });

// 核心改动：加回弹窗防误触的拦截机制
function manualSave(slot) {
    const isConfirm = confirm(`⚠️ 覆盖确认：\n你确定要将当前最新的游戏进度，覆盖并保存到【进度 ${slot}】吗？这将会抹除该槽位先前的历史旧数据！`);
    if (!isConfirm) {
        return; // 用户点击取消，直接安全退出，不作处理
    }
    currentSlot = slot;
    localStorage.setItem(`ai_story_slot_${slot}`, JSON.stringify(chatHistory));
    alert(`💾 进度已成功强制同步到槽位【${slot}】。`);
}

document.getElementById('back-menu-btn').addEventListener('click', () => {
    if(isTyping) return;
    location.reload();
});