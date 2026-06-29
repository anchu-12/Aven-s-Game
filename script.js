const apiUrl = "https://api.deepseek.com/v1/chat/completions"; 

let apiKey = "";
let chatHistory = [];
let currentSlot = null; 
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

function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = show ? 'block' : 'none';
    }
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
    
    // 捕获玩家选择的人称视角
    const perspectiveType = document.getElementById('perspective-input').value;

    if (!apiKey) {
        alert("请输入你的 DeepSeek API Key 才能开始游戏！");
        return;
    }
    localStorage.setItem('my_ai_game_key', apiKey);
    currentSlot = null;

    // 动态为人称注入量身定制的最高指令
    let perspectivePrompt = "";
    if (perspectiveType === "third") {
        perspectivePrompt = `【核心叙事视角——第三人称小说上帝视角】：
- 你必须严格以【第三人称小说】的方式进行全知叙事。绝对、永远不准对玩家使用“你”这个词。
- 玩家的主角必须被称为“他”、“她”、或根据玩家设定里提供的具体姓名（如果没有名字，就用“他/她”或主角身份统称）。
- 示例：当玩家输入“我拔出剑”时，你必须写：“陆长风（或他）眼底一冷，腰间长剑悍然出鞘…”，而不是“你拔出了剑”。整个世界像一本宏大的实体小说。`;
    } else {
        perspectivePrompt = `【核心叙事视角——第二人称互动视角】：
- 你必须严格使用第二人称“你”来称呼玩家。
- 所有描写必须带入主观视角（例如：“你推开了门，迎面而来的是风雪…”、“他转头拍了拍你的肩膀”）。`;
    }

    chatHistory = [
        {
            role: "system",
            content: `你是一个顶级的动态剧情推演器与长篇小说编织者。你将扮演冷酷、真实且极具现场感的文字游戏环境渲染器。

${perspectivePrompt}

【行动守则 1——极致的上下文时空衔接】：
- 你的叙事必须具备极高的流体连续性（像一镜到底的电影长镜头）。除非玩家的输入中【明确】出现了时间的跳跃、宏观时段的概括（如“接下来的几年里…”）、空间的剧烈转变、或开启了独立于当下的第三者独白，否则你【绝对不允许】主动快进时间（严禁出现“几分钟后”、“经过一番折叠”等）、严禁擅自转场、严禁插入无关剧情。每一轮叙事必须死死咬住上一轮的末尾状态，一个场景必须通过多个回合进行极为细腻的持续推演。

==================================================
【行动守则 2——彻底抹杀意境定格与抒情收尾（抗尴尬强制令）】：
- ❌【绝对禁止】在每段回复的最后进行带有“总结性”、“大和解”、“戏剧升华”或“抒情画面描摹”的定格文青描写。
- ❌【极度油腻黑名单句式（严禁出现）】：禁止使用类似于“温柔地定格成一幅三人都找到自己位置的温暖的画面”、“月光落在她嘴角上，像是一层温柔地和解”、“而这一刻，空气中弥漫着久违的释怀…”、“在这静谧的夜里，你们的命运悄然交织…”等任何强行将动态场景打包收尾、自我感动的戏剧旁白。
- ⚡【正确做法】：你的每轮回复在字数达到时，【必须在最尖锐、最具体、最具有物理动态的瞬间断崖式戛然而止】。最后一句话必须是【正在发生的物理事实、环境噪声、或NPC未完的台词】（例如：刀锋卡在颈动脉前、冷汗顺着下巴滴落、NPC说到一半的冰冷台词、或者是远处突然炸响的警报）。直接把充满未知和惯性的现场丢给玩家，不要给现场画上完美的句号！
==================================================

【行动守则 3——半主动推动剧情】：
- 严禁死板地只对玩家的动作进行文字扩写。你必须根据玩家的当前行动，结合逻辑与世界观，【半主动地向前推进一步物理世界的连锁反应】。
- 当主角做出一个举动，你不仅要细腻渲染这个举动的结果，还要顺理成章地引出紧接着发生的合理后效、NPC的即时对策、环境的动态异变、或者是突如其来的小危机。以此半主动地为玩家拉开后续剧情的帷幕，让世界活过来。

【行动守则 4——玩家把控最终主动权】：
- 尽管你需要半主动抛出后续的连锁反应，但你【绝对严禁替玩家做决定】，更严禁替玩家说出台词或描述玩家的心理。
- 绝对不要代替玩家宣布任何长线的判定，如“你成功逃离了这里”、“任务已经完成”或“你击败了敌人”。
- 严禁提供任何“提示”、“选项123”，让玩家完全自由地决定下一步该怎么见招拆招。

【状态面板数据同步规则】：
在每次回复的最末尾，你必须严格按照以下格式附带一行数据（不要更改标签名字），用于更新网页顶部的状态栏。请根据剧情合理扣除或增加属性：
DATA_START{"hp":"生命值","inv":"全部装备道具","rel":"重要人物关系","loc":"当前精准位置"}DATA_END`
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

        if (!blockId) {
            blockId = createStoryBlock("【序章：命运的起点】");
        }

        const blockDiv = document.getElementById(blockId);
        const aiDiv = blockDiv.querySelector('.ai-response');
        await appendTextWithFastTypewriter(aiDiv, cleanStory);

        chatHistory.push({ role: "assistant", content: rawContent });
        refreshCollapsibleBlocks();

        if (currentSlot !== null) {
            localStorage.setItem(`ai_story_slot_${currentSlot}`, JSON.stringify(chatHistory));
        }

    } catch (error) {
        console.error(error);
        if (document.getElementById(loadingId)) {
            document.getElementById(loadingId).innerText = "❌ 连线断开，请检查网络或 Key 状态。";
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
        if(status.loc && document.getElementById('status-loc')) document.getElementById('status-loc').innerText = status.loc;
        if(status.inv && document.getElementById('status-inv-box')) document.getElementById('status-inv-box').innerText = status.inv;
        if(status.rel && document.getElementById('status-rel-box')) document.getElementById('status-rel-box').innerText = status.rel;
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
    textOutput += `当前槽位：${currentSlot ? `进度【${currentSlot}】` : '暂未存档（新冒险）'}\n`;
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

    const modal = document.getElementById('export-modal');
    const textarea = document.getElementById('export-textarea');
    if (modal && textarea) {
        textarea.value = textOutput;
        modal.style.display = 'flex';
    }

    try {
        const blob = new Blob(["\ufeff" + textOutput], { type: "text/plain;charset=utf-8" });
        const fileName = `我的冒险回忆录_${currentSlot ? '进度'+currentSlot : '临时新篇'}.txt`;
        const downloadUrl = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadUrl);
    } catch (e) {
        console.log("环境限制原生下载，已自动展示零乱码安全复制弹窗");
    }
});

document.getElementById('copy-text-btn').addEventListener('click', () => {
    const textarea = document.getElementById('export-textarea');
    if (textarea) {
        textarea.select();
        textarea.setSelectionRange(0, 99999); 
        try {
            document.execCommand('copy');
            alert('✨ 剧情文本已全选并成功复制到你的手机剪贴板！可以直接去微信或便签里粘贴啦。');
        } catch (err) {
            alert('请长按文本框内的文字进行手动全选复制。');
        }
    }
});

document.getElementById('close-export-btn').addEventListener('click', () => {
    const modal = document.getElementById('export-modal');
    if (modal) modal.style.display = 'none';
});

document.getElementById('save-btn-1').addEventListener('click', () => { manualSave(1); });
document.getElementById('save-btn-2').addEventListener('click', () => { manualSave(2); });
document.getElementById('save-btn-3').addEventListener('click', () => { manualSave(3); });

function manualSave(slot) {
    const isConfirmed = confirm(`⚠️ 是否确定要将当前进度保存到【进度 ${slot}】吗？\n此操作将无情覆盖该槽位原有的全部老剧情！`);
    if (!isConfirmed) return; 

    currentSlot = slot; 
    localStorage.setItem(`ai_story_slot_${slot}`, JSON.stringify(chatHistory));
    alert(`💾 进度已强制同步并绑定到槽位【${slot}】。`);
}

document.getElementById('back-menu-btn').addEventListener('click', () => {
    if(isTyping) return;
    location.reload();
});