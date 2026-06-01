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

    const loadingId = appendSystemMessage('⏳ 正在全速构建高精度游戏世界...');
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
    const loadingId = appendSystemMessage('⚡ 推演环境中...');

    await getAIResponse(loadingId, blockId);
}

// =================【🎯 这就是你找的那个目标函数（已升级防卡死版）】=================
async function getAIResponse(loadingId, blockId = null) {
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat", 
                messages: chatHistory,
                temperature: 0.75
            })
        });

        if (!response.ok) {
            let errorMsg = "连线断开";
            if (response.status === 401) errorMsg = "API Key 错误或已失效";
            if (response.status === 402) errorMsg = "账户余额不足，请充值";
            if (response.status === 429) errorMsg = "请求太频繁，请稍后再试";
            if (response.status === 503) errorMsg = "DeepSeek 服务器繁忙，请稍后";
            throw new Error(errorMsg);
        }

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
            document.getElementById(loadingId).innerHTML = `<span style="color: #ff4757;">❌ ${error.message}</span>`;
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
    
    blockDiv.querySelector('.user-action').addEventListener('click', () => {
        if (blockDiv.classList.contains('collapsible')) {
            blockDiv.classList.toggle('collapsed');
        }
    });
    
    storyDisplay.appendChild(blockDiv);
    storyDisplay.scrollTop = storyDisplay.scrollHeight;
    return blockId;
}

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
        if(status.inv) document.getElementById('status-inv').innerText = status.inv;
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
    
   const apiUrl = "https://api.deepseek.com/v1/chat/completions"; 

let apiKey = "";
let chatHistory = [];
let currentSlot = 1; 
let isTyping = false; 

// 数据存储中继：防止老存档因为缺项而崩掉
let globalInvCache = "无";
let globalRelCache = "还未遇到重要角色，羁绊尚未建立...";

const setupContainer = document.getElementById('setup-container');
const gameContainer = document.getElementById('game-container');
const storyDisplay = document.getElementById('story-display');
const playerInput = document.getElementById('player-input');
const sendBtn = document.getElementById('send-btn');
const startGameBtn = document.getElementById('start-game-btn');

if(localStorage.getItem('my_ai_game_key')) {
    document.getElementById('api-key-input').value = localStorage.getItem('my_ai_game_key');
}

// 弹窗显隐控制器
function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if(show) {
        // 关闭另一个，防止重叠
        document.getElementById('modal-inv').style.display = 'none';
        document.getElementById('modal-rel').style.display = 'none';
        modal.style.display = 'block';
    } else {
        modal.style.display = 'none';
    }
}

document.getElementById('modal-inv-btn').addEventListener('click', () => toggleModal('modal-inv', true));
document.getElementById('modal-rel-btn').addEventListener('click', () => toggleModal('modal-rel', true));

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

【状态面板数据同步规则】：
在每次回复的最末尾，你必须严格按照以下格式附带一行数据（不要更改标签名字），用于更新网页顶部的隐藏面板。请根据剧情实时提炼并保持简短：
DATA_START{"inv":"当前持有的全部装备与道具（如有改变请更新）","loc":"当前所在位置","rel":"当前与各个主要NPC的关系（用一句极简短的话描绘，例如‘张三: 充满戒备，目前是同盟。’）"}DATA_END`
        },
        {
            role: "system",
            content: `【当前游戏剧本设定】\n世界观：${worldSetting}\n主角设定：${charSetting}\n主线大方向：${plotSetting}\n\n请以此生成精彩的第一章开场白，描绘开局场景，不要给选项。并在末尾附带初始 DATA 数据。`
        }
    ];

    setupContainer.style.display = 'none';
    gameContainer.style.display = 'block';
    storyDisplay.innerHTML = ""; 

    const loadingId = appendSystemMessage('⏳ 正在全速构建高精度游戏世界...');
    await getAIResponse(loadingId);
});

sendBtn.addEventListener('click', handlePlayerTurn);
playerInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handlePlayerTurn(); });

async function handlePlayerTurn() {
    if (isTyping) return; 
    const action = playerInput.value.trim();
    if (!action) return;

    playerInput.value = '';

    // 关闭打开着的弹窗，不挡住新剧情
    document.getElementById('modal-inv').style.display = 'none';
    document.getElementById('modal-rel').style.display = 'none';

    const blockId = createStoryBlock(`> ${action}`);
    chatHistory.push({ role: "user", content: action });
    const loadingId = appendSystemMessage('⚡ 推演环境中...');

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
                model: "deepseek-chat", 
                messages: chatHistory,
                temperature: 0.75
            })
        });

        if (!response.ok) {
            let errorMsg = "连线断开";
            if (response.status === 401) errorMsg = "API Key 错误或已失效";
            if (response.status === 402) errorMsg = "账户余额不足，请充值";
            if (response.status === 429) errorMsg = "请求太频繁，请稍后再试";
            if (response.status === 503) errorMsg = "DeepSeek 服务器繁忙，请稍后";
            throw new Error(errorMsg);
        }

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
        
        // 执行修改3：清点全场盒子，只留最后 3 个展开！
        refreshCollapsibleBlocks();
        localStorage.setItem(`ai_story_slot_${currentSlot}`, JSON.stringify(chatHistory));

    } catch (error) {
        console.error(error);
        if (document.getElementById(loadingId)) {
            document.getElementById(loadingId).innerHTML = `<span style="color: #ff4757;">❌ ${error.message}</span>`;
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
    
    blockDiv.querySelector('.user-action').addEventListener('click', () => {
        if (blockDiv.classList.contains('collapsible')) {
            blockDiv.classList.toggle('collapsed');
        }
    });
    
    storyDisplay.appendChild(blockDiv);
    storyDisplay.scrollTop = storyDisplay.scrollHeight;
    return blockId;
}

// ======【修改3：调整为只保留最近 3 个完全展开】======
function refreshCollapsibleBlocks() {
    const allBlocks = document.querySelectorAll('.story-block');
    const total = allBlocks.length;
    
    allBlocks.forEach((block, index) => {
        // 总数减去 3，前面所有的都丢进折叠池里
        if (index < total - 3) {
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

// ======【修改4：完美防呆！兼容旧存档数据解析】======
function updateStatusBar(jsonStr) {
    try {
        const status = JSON.parse(jsonStr.trim());
        
        if(status.loc) document.getElementById('status-loc').innerText = status.loc;
        
        // 装备数据更新（顺便存进缓存）
        if(status.inv) {
            globalInvCache = status.inv;
            document.getElementById('status-inv-box').innerText = status.inv;
        }
        
        // 人物关系更新：支持老玩家读档（如果老数据里不含 rel 字段，则使用缓存展示）
        if(status.rel) {
            globalRelCache = status.rel;
            document.getElementById('status-rel-box').innerText = status.rel;
        } else {
            document.getElementById('status-rel-box').innerText = globalRelCache;
        }
    } catch(e) {
        console.log("数据流解析异常", e);
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

document.getElementById('save-btn-1').addEventListener('click', () => { manualSave(1); });
document.getElementById('save-btn-2').addEventListener('click', () => { manualSave(2); });
document.getElementById('save-btn-3').addEventListener('click', () => { manualSave(3); });

function manualSave(slot) {
    currentSlot = slot;
    localStorage.setItem(`ai_story_slot_${slot}`, JSON.stringify(chatHistory));
    alert(`💾 进度已强制同步到槽位【${slot}】。`);
}

document.getElementById('del-btn-all').addEventListener('click', () => {
    if(confirm(`确定销毁槽位【${currentSlot}】的数据吗？`)) {
        localStorage.removeItem(`ai_story_slot_${currentSlot}`);
        location.reload();
    }
});

document.getElementById('back-menu-btn').addEventListener('click', () => {
    if(isTyping) return;
    location.reload();
});