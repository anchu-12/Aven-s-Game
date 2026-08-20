// ============================================================
// AI 文字冒险引擎 Ultra Pro
// Gemini 3.6 Flash + DeepSeek
// ============================================================

// ------------------------------------------------------------
// 全局状态
// ------------------------------------------------------------

let apiKey = "";
let chatHistory = [];
let currentSlot = null;

let isTyping = false;
let isRequesting = false;

// 默认模型
let currentModel = "gemini-3.6-flash";

// ------------------------------------------------------------
// DOM
// ------------------------------------------------------------

const setupContainer = document.getElementById("setup-container");
const gameContainer = document.getElementById("game-container");

const storyDisplay = document.getElementById("story-display");
const playerInput = document.getElementById("player-input");
const sendBtn = document.getElementById("send-btn");
const startGameBtn = document.getElementById("start-game-btn");

const gameModelSelect = document.getElementById("game-model-select");


// ============================================================
// 模型判断
// ============================================================

function isGeminiModel(model) {
    return typeof model === "string" &&
           model.toLowerCase().startsWith("gemini-");
}


// ============================================================
// API 地址
// ============================================================

function getApiUrl(model) {

    if (isGeminiModel(model)) {

        return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

    }

    return "https://api.deepseek.com/v1/chat/completions";
}


// ============================================================
// 模型名称
// ============================================================

function getModelLabel(model) {

    switch (model) {

        case "gemini-3.6-flash":
            return "Gemini 3.6 Flash";

        case "deepseek-v4-pro":
            return "DeepSeek Pro";

        case "deepseek-v4-flash":
            return "DeepSeek Flash";

        default:
            return model;
    }
}


// ============================================================
// API Key 本地保存
// ============================================================

const savedKey = localStorage.getItem("my_ai_game_key");

if (savedKey) {

    const keyInput = document.getElementById("api-key-input");

    if (keyInput) {
        keyInput.value = savedKey;
    }
}


// ============================================================
// 弹窗
// ============================================================

window.toggleModal = function (modalId, show) {

    const modal = document.getElementById(modalId);

    if (!modal) return;

    modal.style.display = show ? "block" : "none";
};


// ============================================================
// 快捷读档
// ============================================================

window.quickLoad = function (slot) {

    const saved = localStorage.getItem(`ai_story_slot_${slot}`);

    const inputKey =
        document.getElementById("api-key-input")?.value.trim() || "";

    const storedKey =
        localStorage.getItem("my_ai_game_key") || "";

    const key = inputKey || storedKey;


    if (!saved) {

        alert(
            `进度槽 ${slot} 是空的，请先创建并保存游戏。`
        );

        return;
    }


    if (!key) {

        alert(
            "请输入你的 Gemini 或 DeepSeek API Key。"
        );

        return;
    }


    apiKey = key;

    localStorage.setItem(
        "my_ai_game_key",
        apiKey
    );

    currentSlot = slot;

    loadGameFromSlot(slot);
};


// ============================================================
// 游戏中切换模型
// ============================================================

if (gameModelSelect) {

    gameModelSelect.addEventListener(
        "change",
        function (event) {

            if (isRequesting || isTyping) {

                event.target.value = currentModel;

                alert(
                    "当前 AI 正在生成内容，请等待本轮生成结束后再切换模型。"
                );

                return;
            }


            currentModel = event.target.value;

            const modelLabel =
                getModelLabel(currentModel);


            appendSystemMessage(
                `🤖 AI 核心已切换至：【${modelLabel}】`
            );


            if (currentSlot !== null) {

                saveDataToLocalStorage(
                    currentSlot
                );
            }
        }
    );
}


// ============================================================
// 开始游戏
// ============================================================

if (startGameBtn) {

    startGameBtn.addEventListener(
        "click",
        async function () {

            if (isRequesting || isTyping) {
                return;
            }


            // ------------------------------------------------
            // 获取 API Key
            // ------------------------------------------------

            apiKey =
                document
                    .getElementById("api-key-input")
                    .value
                    .trim();


            // ------------------------------------------------
            // 获取游戏设定
            // ------------------------------------------------

            const worldSetting =
                document
                    .getElementById("world-input")
                    .value
                    .trim()
                ||
                "普通的现代都市";


            const charSetting =
                document
                    .getElementById("character-input")
                    .value
                    .trim()
                ||
                "普通人";


            const plotSetting =
                document
                    .getElementById("plot-input")
                    .value
                    .trim()
                ||
                "自由探索世界";


            const povSetting =
                document
                    .getElementById("pov-select")
                    .value;


            currentModel =
                document
                    .getElementById("model-select")
                    .value;


            if (gameModelSelect) {

                gameModelSelect.value =
                    currentModel;
            }


            // ------------------------------------------------
            // 检查 Key
            // ------------------------------------------------

            if (!apiKey) {

                alert(
                    "请输入你的 API Key 才能开始游戏！"
                );

                return;
            }


            // 保存 Key
            localStorage.setItem(
                "my_ai_game_key",
                apiKey
            );


            // 新游戏不属于任何存档槽
            currentSlot = null;


            // ------------------------------------------------
            // 系统 Prompt
            // ------------------------------------------------

            const systemPrompt = `你是一个顶级的纯场景叙事NPC和文字游戏环境渲染器。

【核心行动守则——玩家主导】

1. 剧情的发展速度必须完全掌控在玩家手中。
你绝对不主动推动时间流逝或剧情大跨步。

严禁主动宣布：
“任务完成”
“成功逃脱”
“已经到达某地”
“剧情进入下一章”
等玩家没有明确执行的行动。

2. 玩家做出一个动作，你只细腻、生动、富有文学张力地描绘这个动作带来的实时环境改变、声音、光影以及NPC的实时反应。

3. 严禁提供任何“下一步行动建议”。

严禁：
“你可以选择……”
“你接下来可以……”
“请选择……”
“选项1……”
“选项2……”
“你打算怎么办？”

不要替玩家设计选项。

4. 绝对严禁替玩家做任何决定。

不要替玩家移动。
不要替玩家攻击。
不要替玩家说话。
不要替玩家表达心理决定。

玩家只输入行动，你只负责描绘世界对行动的反馈。

【人称视角】

你必须完全遵循：

【${povSetting}】

在后续所有剧情、场景、NPC反应、环境描写中保持一致。

绝对不允许中途改变人称。

【状态面板】

在每次回复的最末尾，必须严格输出：

DATA_START{"hp":"生命值数值","inv":"当前全部装备道具","loc":"当前精准位置"}DATA_END

要求：

- DATA_START 和 DATA_END 必须完整出现。
- 中间必须是合法 JSON。
- hp、inv、loc 三个字段必须始终存在。
- 不允许使用 Markdown 代码块包裹 DATA。
- DATA_END 后不要继续输出任何正文。

【当前游戏剧本设定】

世界观：
${worldSetting}

主角：
${charSetting}

主线大方向：
${plotSetting}

请根据以上设定生成第一章开场。

要求：

- 描写环境。
- 描写声音。
- 描写光影。
- 描写气氛。
- 可以出现NPC。
- 可以出现悬念。
- 不要替玩家做行动。
- 不要提供选项。
- 不要解释游戏规则。
- 不要告诉玩家下一步应该做什么。

最后严格附带 DATA 数据。`;


            // ------------------------------------------------
            // 初始化聊天历史
            // ------------------------------------------------

           chatHistory = [

    {
        role: "system",
        content: systemPrompt
    },

    {
        role: "user",
        content: "请开始游戏。请根据以上世界观、主角和主线设定，正式生成第一章开场。现在不要询问我任何问题，也不要提供选项，只需要开始描写故事。"
    }

];


            // ------------------------------------------------
            // 切换界面
            // ------------------------------------------------

            setupContainer.style.display = "none";

            gameContainer.style.display = "block";

            storyDisplay.innerHTML = "";


            // ------------------------------------------------
            // 开始请求
            // ------------------------------------------------

            const modelLabel =
                getModelLabel(currentModel);


            const loadingId =
                appendSystemMessage(
                    `⏳ 正在通过 [${modelLabel}] 构建游戏世界……`
                );


            await getAIResponse(
                loadingId
            );
        }
    );
}


// ============================================================
// 玩家发送行动
// ============================================================

if (sendBtn) {

    sendBtn.addEventListener(
        "click",
        handlePlayerTurn
    );
}


if (playerInput) {

    playerInput.addEventListener(
        "keypress",
        function (event) {

            if (event.key === "Enter") {

                event.preventDefault();

                handlePlayerTurn();
            }
        }
    );
}


// ============================================================
// 玩家行动处理
// ============================================================

async function handlePlayerTurn() {

    if (isRequesting || isTyping) {
        return;
    }


    const action =
        playerInput.value.trim();


    if (!action) {
        return;
    }


    // 清空输入框
    playerInput.value = "";


    // ------------------------------------------------
    // 显示玩家行动
    // ------------------------------------------------

    const blockId =
        createStoryBlock(
            `> ${action}`
        );


    // ------------------------------------------------
    // 加入聊天记录
    // ------------------------------------------------

    chatHistory.push({

        role: "user",

        content: action

    });


    // ------------------------------------------------
    // AI 请求提示
    // ------------------------------------------------

    const modelLabel =
        getModelLabel(currentModel);


    const loadingId =
        appendSystemMessage(
            `⚡ [${modelLabel}] 正在推演世界……`
        );


    await getAIResponse(
        loadingId,
        blockId
    );
}


// ============================================================
// 核心 AI 请求
// ============================================================

async function getAIResponse(
    loadingId,
    blockId = null
) {

    if (!apiKey) {

        throw new Error(
            "API Key 为空，请重新输入 API Key。"
        );
    }


    isRequesting = true;

    sendBtn.disabled = true;

    startGameBtn.disabled = true;


    try {

        // ----------------------------------------------------
        // API 地址
        // ----------------------------------------------------

        const apiUrl =
            getApiUrl(currentModel);


        // ----------------------------------------------------
        // 基础请求体
        // ----------------------------------------------------

        const requestBody = {

            model: currentModel,

            messages: chatHistory

        };


        // ----------------------------------------------------
        // DeepSeek 参数
        //
        // Gemini 3.6 Flash 不添加 temperature。
        // ----------------------------------------------------

        if (!isGeminiModel(currentModel)) {

            requestBody.temperature = 0.7;
        }


        // ----------------------------------------------------
        // 请求头
        // ----------------------------------------------------

        const headers = {

            "Content-Type":
                "application/json",

            "Authorization":
                `Bearer ${apiKey}`

        };


        // ----------------------------------------------------
        // Console 调试信息
        // ----------------------------------------------------

        console.log(
            "================================"
        );

        console.log(
            "AI REQUEST"
        );

        console.log(
            "Model:",
            currentModel
        );

        console.log(
            "URL:",
            apiUrl
        );

        console.log(
            "Message Count:",
            chatHistory.length
        );

        console.log(
            "================================"
        );


        // ----------------------------------------------------
        // 发起请求
        // ----------------------------------------------------

        const response =
            await fetch(
                apiUrl,
                {
                    method: "POST",

                    headers: headers,

                    body:
                        JSON.stringify(
                            requestBody
                        )
                }
            );


        // ----------------------------------------------------
        // 不直接 response.json()
        //
        // 先读取文本，避免服务器返回 HTML 时
        // JSON.parse 报错导致真正错误消失。
        // ----------------------------------------------------

        const responseText =
            await response.text();


        console.log(
            "================================"
        );

        console.log(
            "AI RESPONSE STATUS:",
            response.status
        );

        console.log(
            "AI RAW RESPONSE:",
            responseText
        );

        console.log(
            "================================"
        );


        // ----------------------------------------------------
        // 尝试解析 JSON
        // ----------------------------------------------------

        let data;

        try {

            data =
                JSON.parse(
                    responseText
                );

        } catch (jsonError) {

            throw new Error(
                `服务器返回的不是有效 JSON。

HTTP 状态码：${response.status}

服务器原始返回：
${responseText.substring(0, 1000)}`
            );
        }


        // ----------------------------------------------------
        // HTTP 错误
        // ----------------------------------------------------

        if (!response.ok) {

            let errorMessage = "";


            if (
                data &&
                data.error
            ) {

                if (
                    typeof data.error === "string"
                ) {

                    errorMessage =
                        data.error;

                } else {

                    errorMessage =
                        data.error.message ||
                        data.error.status ||
                        JSON.stringify(
                            data.error
                        );
                }

            } else {

                errorMessage =
                    data.message ||
                    JSON.stringify(data);
            }


            throw new Error(
                `HTTP ${response.status}

${errorMessage}`
            );
        }


        // ----------------------------------------------------
        // 检查 choices
        // ----------------------------------------------------

        if (
            !data ||
            !Array.isArray(data.choices) ||
            !data.choices.length
        ) {

            console.error(
                "异常 API 返回结构：",
                data
            );


            throw new Error(
                `接口请求成功，但返回数据中没有 choices。

请按 F12 → Console 查看：
AI RAW RESPONSE`
            );
        }


        // ----------------------------------------------------
        // 获取 message
        // ----------------------------------------------------

        const message =
            data.choices[0].message;


        if (!message) {

            throw new Error(
                "接口返回 choices，但没有 message。"
            );
        }


        // ----------------------------------------------------
        // 获取 content
        // ----------------------------------------------------

        let rawContent =
            message.content;


        // ----------------------------------------------------
        // 兼容数组形式 content
        // ----------------------------------------------------

        if (
            Array.isArray(rawContent)
        ) {

            rawContent =
                rawContent
                    .map(
                        function (item) {

                            if (
                                typeof item ===
                                "string"
                            ) {

                                return item;
                            }


                            if (
                                item &&
                                typeof item.text ===
                                "string"
                            ) {

                                return item.text;
                            }


                            return "";
                        }
                    )
                    .join("");
        }


        // ----------------------------------------------------
        // 转换为字符串
        // ----------------------------------------------------

        if (
            typeof rawContent !==
            "string"
        ) {

            rawContent =
                String(
                    rawContent ?? ""
                );
        }


        rawContent =
            rawContent.trim();


        // ----------------------------------------------------
        // 空文本检查
        // ----------------------------------------------------

        if (!rawContent) {

            console.error(
                "模型返回空文本。",
                data
            );


            throw new Error(
                `接口请求成功，但是模型返回了空文本。

finish_reason：
${data.choices[0].finish_reason || "未知"}

请打开 F12 → Console 查看完整响应。`
            );
        }


        // ----------------------------------------------------
        // 删除 Loading
        // ----------------------------------------------------

        const loadingElement =
            document.getElementById(
                loadingId
            );


        if (loadingElement) {

            loadingElement.remove();
        }


        // ====================================================
        // DATA 状态解析
        // ====================================================

        let cleanStory =
            rawContent;


        const dataMatch =
            rawContent.match(
                /DATA_START([\s\S]*?)DATA_END/
            );


        if (dataMatch) {

            updateStatusBar(
                dataMatch[1]
            );


            cleanStory =
                rawContent
                    .replace(
                        /DATA_START([\s\S]*?)DATA_END/,
                        ""
                    )
                    .trim();
        }


        // ----------------------------------------------------
        // 防止只有 DATA 没有正文
        // ----------------------------------------------------

        if (!cleanStory) {

            cleanStory =
                "（世界已经发生变化，但当前没有可显示的剧情文本。）";
        }


        // ====================================================
        // 创建剧情块
        // ====================================================

        if (!blockId) {

            blockId =
                createStoryBlock(
                    "【序章：命运的起点】"
                );
        }


        const blockDiv =
            document.getElementById(
                blockId
            );


        if (!blockDiv) {

            throw new Error(
                "找不到当前剧情显示区域。"
            );
        }


        const aiDiv =
            blockDiv.querySelector(
                ".ai-response"
            );


        if (!aiDiv) {

            throw new Error(
                "找不到 AI 剧情文本容器。"
            );
        }


        // ----------------------------------------------------
        // 打字机
        // ----------------------------------------------------

        await appendTextWithFastTypewriter(
            aiDiv,
            cleanStory
        );


        // ====================================================
        // 保存 AI 原始回复
        //
        // 注意：
        // 保存 rawContent，而不是 cleanStory。
        // 这样 DATA 状态不会丢失。
        // ====================================================

        chatHistory.push({

            role: "assistant",

            content: rawContent

        });


        // ----------------------------------------------------
        // 剧情折叠
        // ----------------------------------------------------

        refreshCollapsibleBlocks();


        // ----------------------------------------------------
        // 自动保存
        // ----------------------------------------------------

        if (currentSlot !== null) {

            saveDataToLocalStorage(
                currentSlot
            );
        }


    } catch (error) {

        console.error(
            "================================"
        );

        console.error(
            "AI REQUEST ERROR"
        );

        console.error(
            error
        );

        console.error(
            "================================"
        );


        const errorText =
            error instanceof Error
                ? error.message
                : String(error);


        const loadingElement =
            document.getElementById(
                loadingId
            );


        if (loadingElement) {

            loadingElement.innerText =
                `❌ 请求异常 [${currentModel}]

${errorText}`;

        } else {

            appendSystemMessage(
                `❌ 请求异常 [${currentModel}]

${errorText}`
            );
        }


    } finally {

        isRequesting = false;

        sendBtn.disabled = false;

        startGameBtn.disabled = false;
    }
}


// ============================================================
// 创建剧情块
// ============================================================

function createStoryBlock(
    userText
) {

    const blockId =
        "block-" +
        Date.now() +
        "-" +
        Math.random()
            .toString(36)
            .slice(2, 8);


    const blockDiv =
        document.createElement(
            "div"
        );


    blockDiv.id =
        blockId;


    blockDiv.className =
        "story-block";


    blockDiv.innerHTML = `
        <div class="user-action"></div>
        <div class="ai-response"></div>
    `;


    const userDiv =
        blockDiv.querySelector(
            ".user-action"
        );


    userDiv.innerText =
        userText;


    storyDisplay.appendChild(
        blockDiv
    );


    storyDisplay.scrollTop =
        storyDisplay.scrollHeight;


    return blockId;
}


// ============================================================
// 剧情块点击折叠
// ============================================================

storyDisplay.addEventListener(
    "click",
    function (event) {

        const target =
            event.target.closest(
                ".user-action"
            );


        if (!target) {
            return;
        }


        const blockDiv =
            target.parentElement;


        if (
            blockDiv &&
            blockDiv.classList.contains(
                "collapsible"
            )
        ) {

            blockDiv.classList.toggle(
                "collapsed"
            );
        }
    }
);


// ============================================================
// 剧情折叠
// ============================================================

function refreshCollapsibleBlocks() {

    const allBlocks =
        document.querySelectorAll(
            ".story-block"
        );


    const total =
        allBlocks.length;


    allBlocks.forEach(
        function (block, index) {

            if (
                index <
                total - 5
            ) {

                block.classList.add(
                    "collapsible"
                );

                block.classList.add(
                    "collapsed"
                );

            } else {

                block.classList.remove(
                    "collapsible"
                );

                block.classList.remove(
                    "collapsed"
                );
            }
        }
    );
}


// ============================================================
// 快速打字机
// ============================================================

function appendTextWithFastTypewriter(
    targetElement,
    text
) {

    return new Promise(
        function (resolve) {

            isTyping = true;


            let index = 0;


            // 每次输出 4 个字符
            const charsPerTick = 4;


            const timer =
                setInterval(
                    function () {

                        targetElement.innerText +=
                            text.substr(
                                index,
                                charsPerTick
                            );


                        index +=
                            charsPerTick;


                        storyDisplay.scrollTop =
                            storyDisplay.scrollHeight;


                        if (
                            index >=
                            text.length
                        ) {

                            clearInterval(
                                timer
                            );


                            isTyping =
                                false;


                            resolve();
                        }

                    },
                    15
                );
        }
    );
}


// ============================================================
// DATA 状态栏解析
// ============================================================

function updateStatusBar(
    jsonString
) {

    try {

        const status =
            JSON.parse(
                jsonString.trim()
            );


        // ----------------------------------------------------
        // HP
        // ----------------------------------------------------

        const hpElement =
            document.getElementById(
                "status-hp"
            );


        if (
            hpElement &&
            status.hp !== undefined
        ) {

            hpElement.innerText =
                status.hp;
        }


        // ----------------------------------------------------
        // 装备
        // ----------------------------------------------------

        const inventoryElement =
            document.getElementById(
                "status-inv-box"
            );


        if (
            inventoryElement &&
            status.inv !== undefined
        ) {

            inventoryElement.innerText =
                status.inv;
        }


        // ----------------------------------------------------
        // 位置
        // ----------------------------------------------------

        const locationElement =
            document.getElementById(
                "status-loc"
            );


        if (
            locationElement &&
            status.loc !== undefined
        ) {

            locationElement.innerText =
                status.loc;
        }


    } catch (error) {

        console.warn(
            "DATA 状态解析失败：",
            error
        );

        console.warn(
            "收到的数据：",
            jsonString
        );
    }
}


// ============================================================
// 系统消息
// ============================================================

function appendSystemMessage(
    text
) {

    const id =
        "sys-" +
        Date.now() +
        "-" +
        Math.random()
            .toString(36)
            .slice(2, 8);


    const message =
        document.createElement(
            "div"
        );


    message.id =
        id;


    message.className =
        "system-msg";


    message.innerText =
        text;


    storyDisplay.appendChild(
        message
    );


    storyDisplay.scrollTop =
        storyDisplay.scrollHeight;


    return id;
}


// ============================================================
// 保存存档
// ============================================================

function saveDataToLocalStorage(
    slot
) {

    const saveData = {

        version: 2,

        model:
            currentModel,

        history:
            chatHistory,

        savedAt:
            new Date().toISOString()
    };


    localStorage.setItem(

        `ai_story_slot_${slot}`,

        JSON.stringify(
            saveData
        )
    );
}


// ============================================================
// 读取存档
// ============================================================

function loadGameFromSlot(
    slot
) {

    const saved =
        localStorage.getItem(
            `ai_story_slot_${slot}`
        );


    if (!saved) {
        return;
    }


    try {

        const parsed =
            JSON.parse(saved);


        // ----------------------------------------------------
        // 新版存档
        // ----------------------------------------------------

        if (
            parsed &&
            Array.isArray(
                parsed.history
            )
        ) {

            chatHistory =
                parsed.history;


            currentModel =
                parsed.model ||
                "gemini-3.6-flash";


        } else if (
            Array.isArray(parsed)
        ) {

            // ------------------------------------------------
            // 兼容旧版存档
            // ------------------------------------------------

            chatHistory =
                parsed;


            currentModel =
                "gemini-3.6-flash";

        } else {

            throw new Error(
                "存档格式无法识别。"
            );
        }


        // ----------------------------------------------------
        // 旧模型名称兼容
        // ----------------------------------------------------

        if (
            currentModel ===
            "deepseek-flash"
        ) {

            currentModel =
                "deepseek-v4-flash";
        }


        if (
            currentModel ===
            "deepseek-pro"
        ) {

            currentModel =
                "deepseek-v4-pro";
        }


        // ----------------------------------------------------
        // 更新模型选择器
        // ----------------------------------------------------

        if (gameModelSelect) {

            gameModelSelect.value =
                currentModel;
        }


        // ----------------------------------------------------
        // 切换到游戏界面
        // ----------------------------------------------------

        setupContainer.style.display =
            "none";


        gameContainer.style.display =
            "block";


        storyDisplay.innerHTML =
            "";


        // ----------------------------------------------------
        // 临时玩家行动
        // ----------------------------------------------------

        let pendingUserText =
            "【序章：重新连接】";


        // ----------------------------------------------------
        // 重建剧情
        // ----------------------------------------------------

        chatHistory.forEach(
            function (message) {

                if (
                    message.role ===
                    "system"
                ) {

                    return;
                }


                // --------------------------------------------
                // 玩家
                // --------------------------------------------

                if (
                    message.role ===
                    "user"
                ) {

                    pendingUserText =
                        `> ${message.content}`;

                    return;
                }


                // --------------------------------------------
                // AI
                // --------------------------------------------

                if (
                    message.role ===
                    "assistant"
                ) {

                    let cleanText =
                        message.content;


                    const dataMatch =
                        message.content.match(
                            /DATA_START([\s\S]*?)DATA_END/
                        );


                    if (dataMatch) {

                        updateStatusBar(
                            dataMatch[1]
                        );


                        cleanText =
                            message.content
                                .replace(
                                    /DATA_START([\s\S]*?)DATA_END/,
                                    ""
                                )
                                .trim();
                    }


                    const blockId =
                        createStoryBlock(
                            pendingUserText
                        );


                    const block =
                        document.getElementById(
                            blockId
                        );


                    if (block) {

                        const aiDiv =
                            block.querySelector(
                                ".ai-response"
                            );


                        aiDiv.innerText =
                            cleanText;
                    }


                    // 下一次 AI 回复之前
                    // 使用当前玩家行动
                    pendingUserText =
                        "【世界继续演化】";
                }

            }
        );


        refreshCollapsibleBlocks();


        // ----------------------------------------------------
        // 读取提示
        // ----------------------------------------------------

        const modelLabel =
            getModelLabel(
                currentModel
            );


        appendSystemMessage(

            `💾 成功读取进度【${slot}】。

已自动连接模型：
${modelLabel}`

        );


    } catch (error) {

        console.error(
            "读取存档失败：",
            error
        );


        alert(
            "读取存档失败：存档可能已经损坏。"
        );
    }
}


// ============================================================
// 导出游戏
// ============================================================

const exportButton =
    document.getElementById(
        "export-btn"
    );


if (exportButton) {

    exportButton.addEventListener(
        "click",
        function () {

            if (
                !chatHistory ||
                chatHistory.length <= 1
            ) {

                alert(
                    "当前还没有可导出的冒险历史！"
                );

                return;
            }


            let textOutput =
                "==================================================\n";


            textOutput +=
                "        📜 《AI 文字冒险：我的命运回忆录》 📜\n";


            textOutput +=
                "==================================================\n";


            textOutput +=
                `导出时间：${new Date().toLocaleString()}\n`;


            textOutput +=
                `当前槽位：${
                    currentSlot
                        ? `进度【${currentSlot}】`
                        : "临时新游戏"
                }\n`;


            textOutput +=
                `采用引擎：${getModelLabel(currentModel)}\n`;


            textOutput +=
                "--------------------------------------------------\n\n";


            let turnNumber = 1;


            chatHistory.forEach(
                function (message) {

                    if (
                        message.role ===
                        "system"
                    ) {

                        return;
                    }


                    if (
                        message.role ===
                        "user"
                    ) {

                        textOutput +=
                            `【第 ${turnNumber} 步 · 我的抉择】>\n`;


                        textOutput +=
                            `${message.content}\n\n`;


                        turnNumber++;

                        return;
                    }


                    if (
                        message.role ===
                        "assistant"
                    ) {

                        const cleanNarrative =
                            message.content
                                .replace(
                                    /DATA_START([\s\S]*?)DATA_END/,
                                    ""
                                )
                                .trim();


                        textOutput +=
                            "【世界的推演】:\n";


                        textOutput +=
                            `${cleanNarrative}\n`;


                        textOutput +=
                            "\n--------------------------------------------------\n\n";
                    }

                }
            );


            textOutput +=
                "=== 剧本终 · 见证了你的伟大史诗 ===\n";


            // ------------------------------------------------
            // 显示导出窗口
            // ------------------------------------------------

            const modal =
                document.getElementById(
                    "export-modal"
                );


            const textarea =
                document.getElementById(
                    "export-textarea"
                );


            if (textarea) {

                textarea.value =
                    textOutput;
            }


            if (modal) {

                modal.style.display =
                    "flex";
            }


            // ------------------------------------------------
            // 自动下载 TXT
            // ------------------------------------------------

            try {

                const blob =
                    new Blob(
                        [
                            "\ufeff" +
                            textOutput
                        ],
                        {
                            type:
                                "text/plain;charset=utf-8"
                        }
                    );


                const downloadUrl =
                    URL.createObjectURL(
                        blob
                    );


                const downloadLink =
                    document.createElement(
                        "a"
                    );


                downloadLink.href =
                    downloadUrl;


                downloadLink.download =
                    `我的冒险回忆录_${
                        currentSlot
                            ? `进度${currentSlot}`
                            : "临时未存档"
                    }.txt`;


                document.body.appendChild(
                    downloadLink
                );


                downloadLink.click();


                document.body.removeChild(
                    downloadLink
                );


                URL.revokeObjectURL(
                    downloadUrl
                );


            } catch (error) {

                console.warn(
                    "自动下载失败：",
                    error
                );
            }

        }
    );
}


// ============================================================
// 复制导出文本
// ============================================================

const copyTextButton =
    document.getElementById(
        "copy-text-btn"
    );


if (copyTextButton) {

    copyTextButton.addEventListener(
        "click",
        async function () {

            const textarea =
                document.getElementById(
                    "export-textarea"
                );


            if (!textarea) {
                return;
            }


            textarea.select();


            try {

                await navigator.clipboard.writeText(
                    textarea.value
                );


                alert(
                    "✨ 剧情文本已经复制到剪贴板！"
                );


            } catch (error) {

                // 兼容旧浏览器
                try {

                    document.execCommand(
                        "copy"
                    );


                    alert(
                        "✨ 剧情文本已经复制到剪贴板！"
                    );

                } catch (copyError) {

                    alert(
                        "复制失败，请手动全选文本后复制。"
                    );
                }
            }

        }
    );
}


// ============================================================
// 关闭导出窗口
// ============================================================

const closeExportButton =
    document.getElementById(
        "close-export-btn"
    );


if (closeExportButton) {

    closeExportButton.addEventListener(
        "click",
        function () {

            const modal =
                document.getElementById(
                    "export-modal"
                );


            if (modal) {

                modal.style.display =
                    "none";
            }

        }
    );
}


// ============================================================
// 手动存档按钮
// ============================================================

const saveButton1 =
    document.getElementById(
        "save-btn-1"
    );


const saveButton2 =
    document.getElementById(
        "save-btn-2"
    );


const saveButton3 =
    document.getElementById(
        "save-btn-3"
    );


if (saveButton1) {

    saveButton1.addEventListener(
        "click",
        function () {
            manualSave(1);
        }
    );
}


if (saveButton2) {

    saveButton2.addEventListener(
        "click",
        function () {
            manualSave(2);
        }
    );
}


if (saveButton3) {

    saveButton3.addEventListener(
        "click",
        function () {
            manualSave(3);
        }
    );
}


// ============================================================
// 手动存档
// ============================================================

function manualSave(slot) {

    if (
        !chatHistory ||
        chatHistory.length <= 1
    ) {

        alert(
            "当前还没有可保存的游戏进度！"
        );

        return;
    }


    const confirmSave =
        confirm(
            `⚠️ 覆盖确认：

确定要把当前游戏进度保存到【进度 ${slot}】吗？`
        );


    if (!confirmSave) {
        return;
    }


    currentSlot =
        slot;


    saveDataToLocalStorage(
        slot
    );


    alert(
        `💾 游戏进度已经保存到【进度 ${slot}】。`
    );
}


// ============================================================
// 返回主菜单
// ============================================================

const backMenuButton =
    document.getElementById(
        "back-menu-btn"
    );


if (backMenuButton) {

    backMenuButton.addEventListener(
        "click",
        function () {

            if (
                isRequesting ||
                isTyping
            ) {

                alert(
                    "当前 AI 正在生成内容，请等待本轮生成结束。"
                );

                return;
            }


            location.reload();
        }
    );
}


// ============================================================
// 页面加载完成
// ============================================================

console.log(
    "================================"
);

console.log(
    "AI 文字冒险引擎 Ultra Pro"
);

console.log(
    "Gemini / DeepSeek API Engine Loaded"
);

console.log(
    "Default Model:",
    currentModel
);

console.log(
    "Gemini Endpoint:",
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
);

console.log(
    "================================"
);