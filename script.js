const apiUrl = "https://api.deepseek.com/v1/chat/completions"; 

let apiKey = "";
let chatHistory = [];
let currentSlot = 1; 
let isTyping = false; 

// 获取网页元素
const setupContainer = document.getElementById('setup-container');
const gameContainer = document.getElementById('game-container');
const storyDisplay = document.getElementById('story-display');
const playerInput = document.getElementById('player-input');
const sendBtn = document.getElementById('send-btn');
const startGameBtn = document.getElementById('start-game-btn');

// 初始化检查 Key 记忆
if(localStorage.getItem('my_ai_game_key')) {
    document.getElementById('api-key-input').value = localStorage.getItem('my_ai_game_key');
}

// 主菜单快捷读档
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

// 开启全新游戏
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

    // 重新定制的强约束提示词
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

    const loadingId = appendMessage('system', '⏳ 正在全速构建高精度游戏世界...');
    await getAIResponse(loadingId);
});

// 发送指令
sendBtn.addEventListener('click', handlePlayerTurn);
playerInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handlePlayerTurn(); });

async function handlePlayerTurn() {
    if (isTyping) return; 
    const action = playerInput.value.trim();
    if (!action) return;

    appendMessage('user', `> ${action}`);
    playerInput.value = '';

    chatHistory.push({ role: "user", content: action });
    const loadingId = appendMessage('system', '⚡ 推演环境中...');

    await getAIResponse(loadingId);
}

// 连线并解析结果
async function getAIResponse(loadingId) {
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

        // 提取并剥离后台数据
        let cleanStory = rawContent;
        const dataMatch = rawContent.match(/DATA_START([\s\S]*?)DATA_END/);
        
        if (dataMatch) {
            // 抓到了 JSON 数据，丢给专门的更新函数
            updateStatusBar(dataMatch[1]);
            // 把这串丑陋的代码从纯剧情文本中删掉，不污染玩家眼睛
            cleanStory = rawContent.replace(/DATA_START([\s\S]*?)DATA_END/, '').trim();
        }

        // 极速输出纯剧情
        await appendMessageWithFastTypewriter('assistant', cleanStory);

        // 存入记忆
        chatHistory.push({ role: "assistant", content: rawContent });
        
        // 每步自动存盘
        localStorage.setItem(`ai_story_slot_${currentSlot}`, JSON.stringify(chatHistory));

    } catch (error) {
        console.error(error);
        if (document.getElementById(loadingId)) {
            document.getElementById(loadingId).innerText = "❌ 连线断开，请检查网络或 Key 状态。";
        }
    }
}

// 更新顶部状态栏的魔术函数
function updateStatusBar(jsonStr) {
    try {
        const status = JSON.parse(jsonStr.trim());
        if(status.hp) document.getElementById('status-hp').innerText = status.hp;
        if(status.inv) document.getElementById('status-inv').innerText = status.inv;
        if(status.loc) document.getElementById('status-loc').innerText = status.loc;
    } catch(e) {
        console.log("数据解析出了点小碎屑", e);
    }
}

function appendMessage(role, text) {
    const msgDiv = document.createElement('div');
    const id = 'msg-' + Date.now();
    msgDiv.id = id;
    msgDiv.className = `message ${role}`;
    msgDiv.innerText = text;
    storyDisplay.appendChild(msgDiv);
    storyDisplay.scrollTop = storyDisplay.scrollHeight; 
    return id;
}

// 【全面加速：群组式滑行打字特效】
function appendMessageWithFastTypewriter(role, text) {
    return new Promise((resolve) => {
        isTyping = true;
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        storyDisplay.appendChild(msgDiv);
        
        let index = 0;
        const charsPerTick = 4; // 核心改动：每次不再只蹦1个字，而是同时蹦4个字
        
        const timer = setInterval(() => {
            msgDiv.innerText += text.substr(index, charsPerTick);
            index += charsPerTick;
            storyDisplay.scrollTop = storyDisplay.scrollHeight; 
            
            if (index >= text.length) {
                clearInterval(timer);
                isTyping = false;
                resolve();
            }
        }, 15); // 触发间隔从 25ms 缩短到 15ms，双重加速！
    });
}

// 绑定管理按钮
document.getElementById('save-btn-1').addEventListener('click', () => { manualSave(1); });
document.getElementById('save-btn-2').addEventListener('click', () => { manualSave(2); });
document.getElementById('save-btn-3').addEventListener('click', () => { manualSave(3); });

function manualSave(slot) {
    currentSlot = slot;
    localStorage.setItem(`ai_story_slot_${slot}`, JSON.stringify(chatHistory));
    alert(`💾 进度已覆盖保存在槽位【${slot}】。`);
}

function loadGameFromSlot(slot) {
    const saved = localStorage.getItem(`ai_story_slot_${slot}`);
    if (!saved) return;
    
    chatHistory = JSON.parse(saved);
    setupContainer.style.display = 'none';
    gameContainer.style.display = 'block';
    storyDisplay.innerHTML = ""; 
    
    chatHistory.forEach(msg => {
        if (msg.role !== 'system') {
            let cleanText = msg.content;
            const dataMatch = msg.content.match(/DATA_START([\s\S]*?)DATA_END/);
            if (dataMatch) {
                if(msg === chatHistory[chatHistory.length - 1] || msg.role === 'assistant') {
                    updateStatusBar(dataMatch[1]); // 恢复最后一次的数据
                }
                cleanText = msg.content.replace(/DATA_START([\s\S]*?)DATA_END/, '').trim();
            }
            const prefix = msg.role === 'user' ? '> ' : '';
            appendMessage(msg.role, prefix + cleanText);
        }
    });
    appendMessage('system', `💾 已无缝跃迁至进度【${slot}】。`);
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