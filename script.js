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

// 【核心修改：玩家回合】
async function handlePlayerTurn() {
    if (isTyping) return; 
    const action = playerInput.value.trim();
    if (!action) return;

    playerInput.value = '';

    // 1. 创建一个新的剧情块（包含本次玩家输入，等待AI回复填充）
    const blockId = createStoryBlock(`> ${action}`);
    
    chatHistory.push({ role: "user", content: action });
    const loadingId = appendSystemMessage('⚡ 推演环境中...');

    await getAIResponse(loadingId, blockId);
}

// 连线并解析结果
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

        // 2. 如果是第一局没有 blockId，就新建一个只有 AI 回复的块
        if (!blockId) {
            blockId = createStoryBlock("【序章：命运的起点】");
        }

        // 3. 把 AI 的纯剧情飞速灌进这个盒子里
        const blockDiv = document.getElementById(blockId);
        const aiDiv = blockDiv.querySelector('.ai-response');
        await appendTextWithFastTypewriter(aiDiv, cleanStory);

        chatHistory.push({ role: "assistant", content: rawContent });
        
        // 4. 【核心升级】：每次打完字，立刻重新清点全场盒子，进行“折叠管理”
        refreshCollapsibleBlocks();

        localStorage.setItem(`ai_story_slot_${currentSlot}`, JSON.stringify(chatHistory));

    } catch (error) {
        console.error(error);
        if (document.getElementById(loadingId)) {
            document.getElementById(loadingId).innerText = "❌ 连线断开，请检查网络或 Key 状态。";
        }
    }
}

// =================【核心升级：动态生成组装一个剧情大组合盒子】=================
function createStoryBlock(userText) {
    const blockId = 'block-' + Date.now();
    const blockDiv = document.createElement('div');
    blockDiv.id = blockId;
    blockDiv.className = 'story-block';
    
    // 盒子里包含：上层的玩家行动行，以及下层留给AI回复的空白行
    blockDiv.innerHTML = `
        <div class="user-action">${userText}</div>
        <div class="ai-response"></div>
    `;
    
    // 给玩家输入行绑定一个点击事件：如果以后被贴上了“可折叠”标签，点它就能切换开关
    blockDiv.querySelector('.user-action').addEventListener('click', () => {
        if (blockDiv.classList.contains('collapsible')) {
            blockDiv.classList.toggle('collapsed');
        }
    });
    
    storyDisplay.appendChild(blockDiv);
    storyDisplay.scrollTop = storyDisplay.scrollHeight;
    return blockId;
}

// =================【核心升级：清点全场盒子，只留最后5个展开】=================
function refreshCollapsibleBlocks() {
    const allBlocks = document.querySelectorAll('.story-block');
    const total = allBlocks.length;
    
    allBlocks.forEach((block, index) => {
        // 如果这个盒子排在倒数第5个之前（代表是老剧情了）
        if (index < total - 5) {
            // 如果它还没被设置过折叠，就给它套上折叠皮肤，并默认闭合(collapsed)
            if (!block.classList.contains('collapsible')) {
                block.classList.add('collapsible');
                block.classList.add('collapsed');
            }
        } else {
            // 如果是最近的5个盒子，确保它们不带有折叠属性，保持完全展开
            block.classList.remove('collapsible');
            block.classList.remove('collapsed');
        }
    });
}

// 极速打字渲染
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

// 读档还原
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
            
            // 恢复时，根据当时的一问一答，组合塞进大盒子里
            const blockId = createStoryBlock(tempUserText);
            document.getElementById(blockId).querySelector('.ai-response').innerText = cleanText;
        }
    });
    
    // 还原后同样立刻刷新全场的折叠状态
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