/* ===================================
   小航小刀小岛 - 应用逻辑文件
   功能：个人生活记录管理
   版本：1.0.0
   =================================== */
// ==================== 调试信息 ====================
console.log('🏝️ 小航小刀小岛 - 应用启动');
console.log('当前URL:', window.location.href);
console.log('协议:', window.location.protocol);
console.log('主机:', window.location.hostname);
console.log('Service Worker 支持:', 'serviceWorker' in navigator);

// 检查图标文件
const iconFiles = ['icons/favicon.ico', 'icons/icon-192x192.png', 'icons/icon-512x512.png'];
iconFiles.forEach(icon => {
    const img = new Image();
    img.onload = () => console.log(`✅ ${icon} 加载成功`);
    img.onerror = () => console.log(`❌ ${icon} 加载失败`);
    img.src = icon;
});

// 检查manifest
fetch('manifest.json')
    .then(response => {
        if (response.ok) {
            console.log('✅ manifest.json 可访问');
            return response.json();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    })
    .then(manifest => {
        console.log('✅ manifest.json 解析成功');
        console.log('应用名称:', manifest.name);
        console.log('图标数量:', manifest.icons?.length || 0);
    })
    .catch(error => {
        console.log('❌ manifest.json 错误:', error.message);
    });
// ==================== 数据存储键定义 ====================
const STORAGE_KEYS = {
    SLEEP: 'sleepData',
    BREAKFAST: 'breakfastData',
    WORK: 'workData',
    HOUSEWORK: 'houseworkData',
    STUDY: 'studyData',
    LUNCH: 'lunchData',
    NAP: 'napData',
    EXERCISE: 'exerciseData',
    DINNER: 'dinnerData',
    GAME: 'gameData',
    ENTERTAINMENT: 'entertainmentData',
    FINANCE: 'financeData',
    SUPPLEMENTS: 'supplementData',
    BODYCARE: 'bodycareData',
    ISLAND_INTERACTIONS: 'islandInteractions',
    IMPORTANT_DATES: 'importantDates'
};

// ==================== 全局变量 ====================
let currentDate = new Date();
let currentYear = currentDate.getFullYear();
let currentMonth = currentDate.getMonth();
let today = new Date();
let todayStr = formatDate(today);
let selectedDate = todayStr;
let islandInteractions = {};
let importantDates = {};
let todoItemCount = 1;
let doneItemCount = 1;
let incomeItemCount = 1;
let expenseItemCount = 1;

// ==================== 自动归档定时器 ====================
let archiveTimer = null;

// ==================== GitHub同步管理器 ====================
const githubSyncManager = {
    accessToken: null,
    gistId: null,
    username: null,
    userInfo: {},
    lastSync: null,
    isAutoSync: false,

    init() {
        this.loadConfig();
        this.updateUI();
    },

    loadConfig() {
        this.accessToken = localStorage.getItem('github_pat');
        this.gistId = localStorage.getItem('github_gist_id');
        this.username = localStorage.getItem('github_username');
        this.lastSync = localStorage.getItem('github_last_sync');
        const userInfo = localStorage.getItem('github_user_info');
        if (userInfo) this.userInfo = JSON.parse(userInfo);
    },

    saveConfig() {
        if (this.accessToken) localStorage.setItem('github_pat', this.accessToken);
        if (this.gistId) localStorage.setItem('github_gist_id', this.gistId);
        if (this.username) localStorage.setItem('github_username', this.username);
        if (this.lastSync) localStorage.setItem('github_last_sync', this.lastSync);
        if (this.userInfo) localStorage.setItem('github_user_info', JSON.stringify(this.userInfo));
    },

    clearConfig() {
        localStorage.removeItem('github_pat');
        localStorage.removeItem('github_gist_id');
        localStorage.removeItem('github_username');
        localStorage.removeItem('github_last_sync');
        localStorage.removeItem('github_user_info');
        this.accessToken = null;
        this.gistId = null;
        this.username = null;
        this.userInfo = {};
        this.lastSync = null;
    },

    isConnected() {
        return !!this.accessToken;
    },

    updateUI() {
        const notConnectedView = document.getElementById('syncNotConnected');
        const connectedView = document.getElementById('syncConnected');
        const manualConfigView = document.getElementById('syncManualConfig');

        if (this.isConnected()) {
            notConnectedView.style.display = 'none';
            connectedView.style.display = 'block';
            manualConfigView.style.display = 'none';

            document.getElementById('githubUsername').textContent =
                this.userInfo.name || this.username || 'GitHub User';

            if (this.userInfo.avatar_url) {
                document.getElementById('githubAvatar').src = this.userInfo.avatar_url;
            }

            if (this.lastSync) {
                const lastSyncDate = new Date(this.lastSync);
                document.getElementById('lastSyncTime').textContent =
                    lastSyncDate.toLocaleString('zh-CN');
            } else {
                document.getElementById('lastSyncTime').textContent = '从未同步';
            }

            const recordCount = this.calculateRecordCount();
            document.getElementById('syncRecordCount').textContent = `${recordCount}条`;

        } else {
            notConnectedView.style.display = 'block';
            connectedView.style.display = 'none';
            manualConfigView.style.display = 'none';
        }
    },

    calculateRecordCount() {
        let count = 0;
        const storageKeys = Object.keys(STORAGE_KEYS).map(key => STORAGE_KEYS[key]);

        storageKeys.forEach(key => {
            const data = localStorage.getItem(key);
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    Object.values(parsed).forEach(records => {
                        count += Array.isArray(records) ? records.length : 0;
                    });
                } catch (e) {
                    console.error(`Error parsing ${key}:`, e);
                }
            }
        });

        return count;
    },

    async testConnection() {
        if (!this.accessToken) {
            throw new Error('未配置 PAT');
        }

        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API 错误: ${response.status}`);
            }

            const userData = await response.json();
            this.username = userData.login;
            this.userInfo = {
                name: userData.name || userData.login,
                avatar_url: userData.avatar_url,
                id: userData.id
            };

            return userData;
        } catch (error) {
            console.error('连接测试失败:', error);
            throw error;
        }
    },

    async findOrCreateGist(description = 'island sync data') {
        if (!this.accessToken) {
            throw new Error('未配置 PAT');
        }

        try {
            const response = await fetch('https://api.github.com/gists', {
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error(`获取 Gist 列表失败: ${response.status}`);
            }

            const gists = await response.json();
            const islandGist = gists.find(gist =>
                gist.description && gist.description.includes(description)
            );

            if (islandGist) {
                this.gistId = islandGist.id;
                return islandGist;
            } else {
                const createResponse = await fetch('https://api.github.com/gists', {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${this.accessToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        description: description,
                        public: false,
                        files: {
                            'island-data.json': {
                                content: JSON.stringify({ created: new Date().toISOString() })
                            }
                        }
                    })
                });

                if (!createResponse.ok) {
                    throw new Error(`创建 Gist 失败: ${createResponse.status}`);
                }

                const newGist = await createResponse.json();
                this.gistId = newGist.id;
                return newGist;
            }
        } catch (error) {
            console.error('Gist 操作失败:', error);
            throw error;
        }
    }
};

// ==================== 页面初始化 ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🏝️ 小航小刀小岛 - 应用启动');
    
    // 初始化日期时间显示
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // 初始化游戏类型切换
    initGameTypeToggle();
    
    // 初始化日历
    initCalendar();
    
    // 加载今日数据
    loadTodayData();
    
    // 初始化按钮事件
    initButtonEvents();
    
    // 更新复盘数据
    updateReviewData();
    
    // 加载重要日期
    loadImportantDates();
    
    // 更新概览数据
    updateOverviewFromTemp();
    
    // 设置重要日期输入框为今日
    document.getElementById('importantDate').value = todayStr;
    
    // 加载工作数据
    loadWorkData();
    
    // 加载财务数据
    loadFinanceData();
    
    // 初始化导航
    initNavigation();
    
    // 初始化概览面板
    initOverviewPanel();
    
    // 初始化导航侧边栏
    initNavSidebar();
    
    // 初始化折叠面板
    initCollapsibleBlocks();
    
    // 初始化家务积分
    initHouseworkScore();
    
    // 初始化GitHub同步
    githubSyncManager.init();
    
    // 初始化自动归档
    initAutoArchive();
    
// PWA Service Worker 注册
if ('serviceWorker' in navigator) {
    // 检查是否在支持的环境下运行（localhost 或 HTTPS）
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    const isSecure = window.location.protocol === 'https:';
    
    if (isLocalhost || isSecure) {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('ServiceWorker 注册成功');
                console.log('作用域:', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker 注册失败:', error);
            });
    } else if (window.location.protocol === 'file:') {
        console.log('⚠️ Service Worker 只能在 localhost 或 HTTPS 环境下运行');
        console.log('当前使用 file:// 协议，请使用本地服务器：python -m http.server 8000');
        console.log('或者访问：http://localhost:8000');
    }
}
});

// ==================== 时间管理函数 ====================

/**
 * 更新日期时间显示
 */
function updateDateTime() {
    const now = new Date();
    const dateTimeStr = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    
    const dateTimeElement = document.getElementById('currentDateTime');
    if (dateTimeElement) {
        dateTimeElement.textContent = dateTimeStr;
    }
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 获取时间差（毫秒）
 */
function getTimeUntilTarget(targetHour, targetMinute, targetSecond) {
    const now = new Date();
    const target = new Date(now);
    target.setHours(targetHour, targetMinute, targetSecond, 0);
    
    if (now > target) {
        target.setDate(target.getDate() + 1);
    }
    
    return target.getTime() - now.getTime();
}

// ==================== 自动归档系统 ====================

/**
 * 初始化自动归档
 */
function initAutoArchive() {
    console.log('🕐 初始化自动归档系统...');
    
    // 清除现有的定时器
    if (archiveTimer) {
        clearTimeout(archiveTimer);
    }
    
    // 计算距离23:59:59的时间
    const timeUntilArchive = getTimeUntilTarget(23, 59, 59);
    
    // 设置归档定时器
    archiveTimer = setTimeout(() => {
        autoArchiveToday();
        // 归档后设置明天的定时器
        setDailyArchiveTimer();
    }, timeUntilArchive);
    
    // 归档前30分钟提醒
    const timeUntilReminder = getTimeUntilTarget(23, 29, 59);
    setTimeout(() => {
        showNotification('⏰ 30分钟后将自动归档今日记录，请确认已保存所有数据');
    }, timeUntilReminder);
    
    console.log(`🕐 自动归档已设置，将在 ${formatTime(timeUntilArchive)} 后执行`);
}

/**
 * 设置每日归档定时器
 */
function setDailyArchiveTimer() {
    // 24小时后再次执行
    const oneDayInMs = 24 * 60 * 60 * 1000;
    
    archiveTimer = setTimeout(() => {
        autoArchiveToday();
        setDailyArchiveTimer();
    }, oneDayInMs);
}

/**
 * 自动归档今日数据
 */
function autoArchiveToday() {
    console.log('🔄 开始自动归档今日记录...');
    
    const dateStr = formatDate(new Date());
    let hasData = false;
    let archivedCount = 0;
    
    // 归档所有临时数据
    Object.values(STORAGE_KEYS).forEach(key => {
        const tempData = JSON.parse(localStorage.getItem(key + '_TEMP') || '{}');
        if (tempData[dateStr] && tempData[dateStr].length > 0) {
            hasData = true;
            archivedCount += tempData[dateStr].length;
            
            const finalData = JSON.parse(localStorage.getItem(key) || '{}');
            if (!finalData[dateStr]) {
                finalData[dateStr] = [];
            }
            finalData[dateStr] = finalData[dateStr].concat(tempData[dateStr]);
            localStorage.setItem(key, JSON.stringify(finalData));
            
            // 清理临时数据
            delete tempData[dateStr];
            localStorage.setItem(key + '_TEMP', JSON.stringify(tempData));
        }
    });
    
    // 归档岛民互动数据
    const islandTemp = JSON.parse(localStorage.getItem(STORAGE_KEYS.ISLAND_INTERACTIONS + '_TEMP') || '{}');
    if (islandTemp[dateStr]) {
        hasData = true;
        const finalIsland = JSON.parse(localStorage.getItem(STORAGE_KEYS.ISLAND_INTERACTIONS) || '{}');
        finalIsland[dateStr] = islandTemp[dateStr];
        localStorage.setItem(STORAGE_KEYS.ISLAND_INTERACTIONS, JSON.stringify(finalIsland));
        delete islandTemp[dateStr];
        localStorage.setItem(STORAGE_KEYS.ISLAND_INTERACTIONS + '_TEMP', JSON.stringify(islandTemp));
    }
    
    if (hasData) {
        showNotification(`✅ 今日 ${archivedCount} 条记录已自动归档！`);
        console.log(`✅ 自动归档完成，共归档 ${archivedCount} 条记录`);
        
        // 清空表单
        clearAllForms();
        
        // 更新数据显示
        updateReviewData();
        renderCalendar();
        updateOverviewFromTemp();
        
        // 设置下一次归档提醒
        const reminderTime = getTimeUntilTarget(23, 29, 59);
        setTimeout(() => {
            showNotification('⏰ 30分钟后将自动归档今日记录，请确认已保存所有数据');
        }, reminderTime - (30 * 60 * 1000));
    } else {
        console.log('📝 没有可归档的临时记录');
    }
}

/**
 * 格式化时间显示
 */
function formatTime(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${hours}小时${minutes}分钟${seconds}秒`;
}

// ==================== 数据存储函数 ====================

/**
 * 保存数据到临时存储
 */
function saveTempData(key, data) {
    const dateStr = formatDate(new Date());
    const allData = JSON.parse(localStorage.getItem(key + '_TEMP') || '{}');
    
    if (!allData[dateStr]) {
        allData[dateStr] = [];
    }
    
    allData[dateStr].push({
        ...data,
        timestamp: new Date().toISOString()
    });
    
    localStorage.setItem(key + '_TEMP', JSON.stringify(allData));
    updateOverviewFromTemp();
    return true;
}

/**
 * 保存数据到永久存储
 */
function saveData(key, data) {
    const dateStr = formatDate(new Date());
    const allData = JSON.parse(localStorage.getItem(key) || '{}');
    
    if (!allData[dateStr]) {
        allData[dateStr] = [];
    }
    
    allData[dateStr].push({
        ...data,
        timestamp: new Date().toISOString()
    });
    
    localStorage.setItem(key, JSON.stringify(allData));
    updateReviewData();
    renderCalendar();
    return true;
}

// ==================== 表单处理函数 ====================

/**
 * 初始化折叠面板
 */
function initCollapsibleBlocks() {
    const allBlocks = document.querySelectorAll('.collapsible-block');
    allBlocks.forEach(block => {
        const blockId = block.id.replace('-block', '');
        const content = document.getElementById(blockId + '-content');
        const toggle = block.querySelector('.block-toggle i');
        
        if (content) {
            content.classList.remove('expanded');
            toggle.classList.remove('fa-chevron-up');
            toggle.classList.add('fa-chevron-down');
        }
    });
}

/**
 * 切换折叠面板状态
 */
function toggleBlock(blockName) {
    const content = document.getElementById(blockName + '-content');
    const toggle = document.querySelector(`#${blockName}-block .block-toggle i`);
    
    if (content) {
        content.classList.toggle('expanded');
        if (content.classList.contains('expanded')) {
            toggle.classList.remove('fa-chevron-down');
            toggle.classList.add('fa-chevron-up');
        } else {
            toggle.classList.remove('fa-chevron-up');
            toggle.classList.add('fa-chevron-down');
        }
    }
}

/**
 * 清空所有表单
 */
function clearAllForms() {
    // 清空输入框和文本域
    document.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(el => {
        el.value = '';
    });
    
    // 清空复选框
    document.querySelectorAll('input[type="checkbox"]').forEach(el => {
        el.checked = false;
    });
    
    // 重置选择器
    document.querySelectorAll('select').forEach(el => {
        el.selectedIndex = 0;
    });
    
    // 重置岛民互动按钮
    document.querySelectorAll('.island-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 重置工作看板
    resetWorkBoard();
    
    // 重置财务记账
    resetFinanceBoard();
    
    // 重置家务积分
    document.getElementById('houseworkScore').value = '0';
    
    // 更新概览
    updateOverviewFromTemp();
}

// ==================== 打卡功能 ====================

/**
 * 保存补剂打卡
 */
function saveSupplements() {
    const ironSupplement = document.getElementById('ironSupplement').checked;
    const vitaminDK = document.getElementById('vitaminDK').checked;
    const magnesiumSupplement = document.getElementById('magnesiumSupplement').checked;
    
    const data = {
        iron: ironSupplement,
        vitaminDK: vitaminDK,
        magnesium: magnesiumSupplement,
        date: formatDate(new Date())
    };
    
    if (saveTempData(STORAGE_KEYS.SUPPLEMENTS, data)) {
        showNotification('💊 补剂打卡已保存！');
    }
}

/**
 * 保存护理打卡
 */
function saveBodyCare() {
    const bodyScrub = document.getElementById('bodyScrub').checked;
    const hairRemoval = document.getElementById('hairRemoval').checked;
    const bodyLotion = document.getElementById('bodyLotion').checked;
    
    const data = {
        scrub: bodyScrub,
        hairRemoval: hairRemoval,
        lotion: bodyLotion,
        date: formatDate(new Date())
    };
    
    if (saveTempData(STORAGE_KEYS.BODYCARE, data)) {
        showNotification('✨ 护理打卡已保存！');
    }
}

// ==================== 时间轴记录功能 ====================

/**
 * 保存睡眠记录
 */
function saveSleep() {
    const sleepDuration = document.getElementById('sleepDuration').value;
    const sleepQuality = document.getElementById('sleepQuality').value;
    const sleepFeeling = document.getElementById('sleepFeeling').value;
    
    if (!sleepDuration || !sleepQuality) {
        showNotification('请填写睡眠时长和质量评分');
        return;
    }
    
    const data = {
        duration: parseFloat(sleepDuration),
        quality: parseInt(sleepQuality),
        feeling: sleepFeeling
    };
    
    if (saveTempData(STORAGE_KEYS.SLEEP, data)) {
        showNotification('💤 睡眠记录已保存！');
    }
}

/**
 * 保存早餐记录
 */
function saveBreakfast() {
    const breakfastContent = document.getElementById('breakfastContent').value;
    const breakfastFeeling = document.getElementById('breakfastFeeling').value;
    
    if (!breakfastContent) {
        showNotification('请填写早餐内容');
        return;
    }
    
    const data = {
        content: breakfastContent,
        feeling: breakfastFeeling
    };
    
    if (saveTempData(STORAGE_KEYS.BREAKFAST, data)) {
        showNotification('☕ 早餐记录已保存！');
    }
}

/**
 * 保存工作记录
 */
function saveWork() {
    const todoItems = document.querySelectorAll('.todo-item');
    const doneItems = document.querySelectorAll('.done-item');
    
    const todoList = Array.from(todoItems)
        .map(item => item.value.trim())
        .filter(item => item !== '');
    
    const doneList = Array.from(doneItems)
        .map(item => item.value.trim())
        .filter(item => item !== '');
    
    const data = {
        todo: todoList,
        done: doneList
    };
    
    if (saveTempData(STORAGE_KEYS.WORK, data)) {
        showNotification('💼 工作记录已保存！');
    }
}

/**
 * 保存家务记录
 */
function saveHousework() {
    const houseworkGarbage = document.getElementById('houseworkGarbage').checked;
    const houseworkCooking = document.getElementById('houseworkCooking').checked;
    const houseworkLaundry = document.getElementById('houseworkLaundry').checked;
    const houseworkHangingClothes = document.getElementById('houseworkHangingClothes').checked;
    const houseworkFoldingClothes = document.getElementById('houseworkFoldingClothes').checked;
    const houseworkCleaningKitchen = document.getElementById('houseworkCleaningKitchen').checked;
    const houseworkCleaningTable = document.getElementById('houseworkCleaningTable').checked;
    const houseworkCleaningBed = document.getElementById('houseworkCleaningBed').checked;
    const houseworkCleaningFridge = document.getElementById('houseworkCleaningFridge').checked;
    const houseworkFeeling = document.getElementById('houseworkFeeling').value;
    const houseworkScore = document.getElementById('houseworkScore').value;
    
    const data = {
        garbage: houseworkGarbage,
        cooking: houseworkCooking,
        laundry: houseworkLaundry,
        hangingClothes: houseworkHangingClothes,
        foldingClothes: houseworkFoldingClothes,
        cleaningKitchen: houseworkCleaningKitchen,
        cleaningTable: houseworkCleaningTable,
        cleaningBed: houseworkCleaningBed,
        cleaningFridge: houseworkCleaningFridge,
        feeling: houseworkFeeling,
        score: parseInt(houseworkScore) || 0
    };
    
    if (saveTempData(STORAGE_KEYS.HOUSEWORK, data)) {
        showNotification('🧹 家务记录已保存！');
    }
}

/**
 * 保存学习记录
 */
function saveStudy() {
    const studySubject = document.getElementById('studySubject').value;
    const studyDuration = document.getElementById('studyDuration').value;
    const studyContent = document.getElementById('studyContent').value;
    const studySummary = document.getElementById('studySummary').value;
    
    if (!studyDuration || !studyContent) {
        showNotification('请填写学习时长和内容');
        return;
    }
    
    const data = {
        subject: studySubject,
        duration: parseInt(studyDuration),
        content: studyContent,
        summary: studySummary
    };
    
    if (saveTempData(STORAGE_KEYS.STUDY, data)) {
        showNotification('📚 学习记录已保存！');
    }
}

/**
 * 保存午餐记录
 */
function saveLunch() {
    const lunchContent = document.getElementById('lunchContent').value;
    const lunchFeeling = document.getElementById('lunchFeeling').value;
    
    if (!lunchContent) {
        showNotification('请填写午餐内容');
        return;
    }
    
    const data = {
        content: lunchContent,
        feeling: lunchFeeling
    };
    
    if (saveTempData(STORAGE_KEYS.LUNCH, data)) {
        showNotification('🍲 午餐记录已保存！');
    }
}

/**
 * 保存午休记录
 */
function saveNap() {
    const napDuration = document.getElementById('napDuration').value;
    const napQuality = document.getElementById('napQuality').value;
    const napFeeling = document.getElementById('napFeeling').value;
    
    if (!napDuration || !napQuality) {
        showNotification('请填写午休时长和质量评分');
        return;
    }
    
    const data = {
        duration: parseInt(napDuration),
        quality: parseInt(napQuality),
        feeling: napFeeling
    };
    
    if (saveTempData(STORAGE_KEYS.NAP, data)) {
        showNotification('😴 午休记录已保存！');
    }
}

/**
 * 保存运动记录
 */
function saveExercise() {
    const exerciseType = document.getElementById('exerciseType').value;
    const exerciseDuration = document.getElementById('exerciseDuration').value;
    const exerciseItem = document.getElementById('exerciseItem').value;
    const exerciseCalories = document.getElementById('exerciseCalories').value;
    const exerciseFeeling = document.getElementById('exerciseFeeling').value;
    
    if (!exerciseDuration || !exerciseItem) {
        showNotification('请填写运动时长和项目');
        return;
    }
    
    const data = {
        type: exerciseType,
        duration: parseInt(exerciseDuration),
        item: exerciseItem,
        calories: exerciseCalories ? parseInt(exerciseCalories) : 0,
        feeling: exerciseFeeling
    };
    
    if (saveTempData(STORAGE_KEYS.EXERCISE, data)) {
        showNotification('🏃 运动记录已保存！');
    }
}

/**
 * 保存晚餐记录
 */
function saveDinner() {
    const dinnerContent = document.getElementById('dinnerContent').value;
    const dinnerFeeling = document.getElementById('dinnerFeeling').value;
    
    if (!dinnerContent) {
        showNotification('请填写晚餐内容');
        return;
    }
    
    const data = {
        content: dinnerContent,
        feeling: dinnerFeeling
    };
    
    if (saveTempData(STORAGE_KEYS.DINNER, data)) {
        showNotification('🍽️ 晚餐记录已保存！');
    }
}

/**
 * 保存游戏记录
 */
function saveGame() {
    const gameType = document.getElementById('gameType').value;
    
    if (gameType === '通用游戏') {
        const gameName = document.getElementById('gameName').value;
        const gameProgress = document.getElementById('gameProgress').value;
        const gameFeeling = document.getElementById('gameFeeling').value;
        
        if (!gameName) {
            showNotification('请填写游戏名称');
            return;
        }
        
        const data = {
            type: gameType,
            name: gameName,
            progress: gameProgress,
            feeling: gameFeeling
        };
        
        if (saveTempData(STORAGE_KEYS.GAME, data)) {
            showNotification('🎮 游戏记录已保存！');
        }
    } else if (gameType === '动物森友会') {
        const acWeather = document.getElementById('acWeather').value;
        const acNPC = document.getElementById('acNPC').value;
        const acEvent = document.getElementById('acEvent').value;
        const acFeeling = document.getElementById('acFeeling').value;
        
        const data = {
            type: gameType,
            weather: acWeather,
            npc: acNPC,
            event: acEvent,
            feeling: acFeeling,
            interactions: islandInteractions[formatDate(new Date())] || {}
        };
        
        if (saveTempData(STORAGE_KEYS.GAME, data)) {
            showNotification('🏝️ 动物森友会记录已保存！');
        }
    }
}

/**
 * 保存娱乐记录
 */
function saveEntertainment() {
    const entertainmentType = document.getElementById('entertainmentType').value;
    const entertainmentContent = document.getElementById('entertainmentContent').value;
    const entertainmentFeeling = document.getElementById('entertainmentFeeling').value;
    
    if (!entertainmentContent) {
        showNotification('请填写娱乐内容');
        return;
    }
    
    const data = {
        type: entertainmentType,
        content: entertainmentContent,
        feeling: entertainmentFeeling
    };
    
    if (saveTempData(STORAGE_KEYS.ENTERTAINMENT, data)) {
        showNotification('🎬 娱乐记录已保存！');
    }
}

// ==================== 工作看板功能 ====================

/**
 * 初始化家务积分
 */
function initHouseworkScore() {
    const checkboxes = document.querySelectorAll('#家务记录-content input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateHouseworkScore);
    });
    updateHouseworkScore();
}

/**
 * 更新家务积分
 */
function updateHouseworkScore() {
    let score = 0;
    const checkboxes = document.querySelectorAll('#家务记录-content input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            score++;
        }
    });
    document.getElementById('houseworkScore').value = score;
}

/**
 * 重置工作看板
 */
function resetWorkBoard() {
    const todoItems = document.getElementById('todoItems');
    const doneItems = document.getElementById('doneItems');
    
    while (todoItems.children.length > 1) {
        todoItems.removeChild(todoItems.lastChild);
    }
    
    while (doneItems.children.length > 1) {
        doneItems.removeChild(doneItems.lastChild);
    }
    
    const firstTodo = todoItems.querySelector('.todo-item');
    const firstDone = doneItems.querySelector('.done-item');
    
    if (firstTodo) firstTodo.value = '';
    if (firstDone) firstDone.value = '';
    
    todoItemCount = 1;
    doneItemCount = 1;
    updateWorkItemNumbers();
}

/**
 * 添加待办事项
 */
function addTodoItem() {
    const todoItems = document.getElementById('todoItems');
    const newItem = document.createElement('div');
    newItem.className = 'work-item';
    newItem.innerHTML = `
        <div class="item-number">${todoItemCount + 1}</div>
        <input type="text" class="todo-item" placeholder="待办事项..." data-index="${todoItemCount}">
    `;
    todoItems.appendChild(newItem);
    todoItemCount++;
    updateWorkItemNumbers();
}

/**
 * 添加完成事项
 */
function addDoneItem() {
    const doneItems = document.getElementById('doneItems');
    const newItem = document.createElement('div');
    newItem.className = 'work-item';
    newItem.innerHTML = `
        <div class="item-number">${doneItemCount + 1}</div>
        <input type="text" class="done-item" placeholder="已完成事项..." data-index="${doneItemCount}">
    `;
    doneItems.appendChild(newItem);
    doneItemCount++;
    updateWorkItemNumbers();
}

/**
 * 更新工作项编号
 */
function updateWorkItemNumbers() {
    const todoItems = document.querySelectorAll('#todoItems .work-item');
    const doneItems = document.querySelectorAll('#doneItems .work-item');
    
    todoItems.forEach((item, index) => {
        const numberDiv = item.querySelector('.item-number');
        if (numberDiv) {
            numberDiv.textContent = index + 1;
        }
        const input = item.querySelector('.todo-item');
        if (input) {
            input.dataset.index = index;
        }
    });
    
    doneItems.forEach((item, index) => {
        const numberDiv = item.querySelector('.item-number');
        if (numberDiv) {
            numberDiv.textContent = index + 1;
        }
        const input = item.querySelector('.done-item');
        if (input) {
            input.dataset.index = index;
        }
    });
    
    todoItemCount = todoItems.length;
    doneItemCount = doneItems.length;
}

/**
 * 加载工作数据
 */
function loadWorkData() {
    const dateStr = formatDate(new Date());
    const workData = JSON.parse(localStorage.getItem(STORAGE_KEYS.WORK + '_TEMP') || '{}');
    
    if (workData[dateStr] && workData[dateStr].length > 0) {
        const latestWork = workData[dateStr][workData[dateStr].length - 1];
        
        if (latestWork.todo && Array.isArray(latestWork.todo)) {
            const todoItems = document.getElementById('todoItems');
            todoItems.innerHTML = '';
            
            latestWork.todo.forEach((item, index) => {
                const newItem = document.createElement('div');
                newItem.className = 'work-item';
                newItem.innerHTML = `
                    <div class="item-number">${index + 1}</div>
                    <input type="text" class="todo-item" placeholder="待办事项..." data-index="${index}" value="${item || ''}">
                `;
                todoItems.appendChild(newItem);
            });
        }
        
        if (latestWork.done && Array.isArray(latestWork.done)) {
            const doneItems = document.getElementById('doneItems');
            doneItems.innerHTML = '';
            
            latestWork.done.forEach((item, index) => {
                const newItem = document.createElement('div');
                newItem.className = 'work-item';
                newItem.innerHTML = `
                    <div class="item-number">${index + 1}</div>
                    <input type="text" class="done-item" placeholder="已完成事项..." data-index="${index}" value="${item || ''}">
                `;
                doneItems.appendChild(newItem);
            });
        }
        
        updateWorkItemNumbers();
    }
}

// ==================== 财务记账功能 ====================

/**
 * 添加财务条目
 */
function addFinanceItem(type) {
    const dateStr = formatDate(new Date());
    const containerId = type === 'income' ? 'incomeItems' : 'expenseItems';
    const container = document.getElementById(containerId);
    const count = type === 'income' ? ++incomeItemCount : ++expenseItemCount;

    const newItem = document.createElement('div');
    newItem.className = `finance-item ${type}-item`;
    newItem.innerHTML = `
        <div class="item-number">${count}</div>
        <div class="finance-item-content">
            <div class="form-row">
                <div class="form-column">
                    <input type="number" class="finance-amount" placeholder="金额 (元)" min="0" step="0.01">
                </div>
                <div class="form-column">
                    <select class="finance-category">
                        ${type === 'income' ?
                            '<option value="工资">工资</option>' +
                            '<option value="奖金">奖金</option>' +
                            '<option value="兼职">兼职</option>' +
                            '<option value="投资收益">投资收益</option>' +
                            '<option value="礼金">礼金</option>' +
                            '<option value="其他收入">其他收入</option>' :
                            '<option value="正餐">正餐</option>' +
                            '<option value="零食奶茶宵夜">零食奶茶宵夜</option>' +
                            '<option value="日用">日用</option>' +
                            '<option value="服饰">服饰</option>' +
                            '<option value="游戏">游戏</option>' +
                            '<option value="兴趣爱好">兴趣爱好</option>' +
                            '<option value="礼物">礼物</option>' +
                            '<option value="交通">交通</option>' +
                            '<option value="医疗">医疗</option>' +
                            '<option value="其他支出">其他支出</option>'
                        }
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-column">
                    <select class="finance-payment-method">
                        <option value="">选择支付方式</option>
                        <option value="信用卡">💳 信用卡</option>
                        <option value="储蓄卡">🏦 储蓄卡</option>
                        <option value="支付宝">💰 支付宝</option>
                        <option value="微信">💚 微信</option>
                        <option value="现金">💵 现金</option>
                        <option value="其他">📱 其他</option>
                    </select>
                </div>
            </div>
            <input type="text" class="finance-description" placeholder="${type === 'income' ? '收入' : '支出'}描述...">
            <input type="date" class="finance-date" value="${dateStr}">
            <div class="finance-item-actions">
                <button class="delete-finance-item" onclick="deleteFinanceItem(this, '${type}')" title="删除此项">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;

    container.appendChild(newItem);
    updateFinanceItemNumbers(type);
    calculateFinanceSummary();
}

/**
 * 删除财务条目
 */
function deleteFinanceItem(button, type) {
    const item = button.closest(`.${type}-item`);
    if (item) {
        item.remove();
        updateFinanceItemNumbers(type);
        calculateFinanceSummary();
    }
}

/**
 * 更新财务条目编号
 */
function updateFinanceItemNumbers(type) {
    const containerId = type === 'income' ? 'incomeItems' : 'expenseItems';
    const items = document.querySelectorAll(`#${containerId} .finance-item`);

    items.forEach((item, index) => {
        const numberDiv = item.querySelector('.item-number');
        if (numberDiv) {
            numberDiv.textContent = index + 1;
        }
    });

    if (type === 'income') {
        incomeItemCount = items.length;
    } else {
        expenseItemCount = items.length;
    }
}

/**
 * 计算财务汇总
 */
function calculateFinanceSummary() {
    let totalIncome = 0;
    let totalExpense = 0;

    // 计算收入总额
    const incomeAmounts = document.querySelectorAll('.income-item .finance-amount');
    incomeAmounts.forEach(input => {
        const amount = parseFloat(input.value) || 0;
        totalIncome += amount;
    });

    // 计算支出总额
    const expenseAmounts = document.querySelectorAll('.expense-item .finance-amount');
    expenseAmounts.forEach(input => {
        const amount = parseFloat(input.value) || 0;
        totalExpense += amount;
    });

    // 更新显示
    const todayIncomeTotal = document.getElementById('todayIncomeTotal');
    const todayExpenseTotal = document.getElementById('todayExpenseTotal');
    const todayBalance = document.getElementById('todayBalance');
    const expenseOverview = document.getElementById('expenseOverview');

    if (todayIncomeTotal) todayIncomeTotal.textContent = totalIncome.toFixed(2);
    if (todayExpenseTotal) todayExpenseTotal.textContent = totalExpense.toFixed(2);
    if (todayBalance) todayBalance.textContent = (totalIncome - totalExpense).toFixed(2);
    if (expenseOverview) expenseOverview.textContent = `${totalExpense.toFixed(2)}元`;
}

/**
 * 保存财务记录
 */
function saveFinance() {
    const dateStr = formatDate(new Date());
    const financeData = {
        incomes: [],
        expenses: []
    };

    // 收集收入项
    const incomeItems = document.querySelectorAll('.income-item');
    incomeItems.forEach((item, index) => {
        const amountInput = item.querySelector('.finance-amount');
        const categorySelect = item.querySelector('.finance-category');
        const paymentMethodSelect = item.querySelector('.finance-payment-method');
        const descriptionInput = item.querySelector('.finance-description');
        const dateInput = item.querySelector('.finance-date');

        if (amountInput && categorySelect && descriptionInput && dateInput) {
            const amount = amountInput.value;
            const category = categorySelect.value;
            const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : '';
            const description = descriptionInput.value;
            const date = dateInput.value;

            if (amount && parseFloat(amount) > 0) {
                financeData.incomes.push({
                    id: index + 1,
                    amount: parseFloat(amount),
                    category: category,
                    paymentMethod: paymentMethod,
                    description: description,
                    date: date || dateStr,
                    type: '收入'
                });
            }
        }
    });

    // 收集支出项
    const expenseItems = document.querySelectorAll('.expense-item');
    expenseItems.forEach((item, index) => {
        const amountInput = item.querySelector('.finance-amount');
        const categorySelect = item.querySelector('.finance-category');
        const paymentMethodSelect = item.querySelector('.finance-payment-method');
        const descriptionInput = item.querySelector('.finance-description');
        const dateInput = item.querySelector('.finance-date');

        if (amountInput && categorySelect && descriptionInput && dateInput) {
            const amount = amountInput.value;
            const category = categorySelect.value;
            const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : '';
            const description = descriptionInput.value;
            const date = dateInput.value;

            if (amount && parseFloat(amount) > 0) {
                financeData.expenses.push({
                    id: index + 1,
                    amount: parseFloat(amount),
                    category: category,
                    paymentMethod: paymentMethod,
                    description: description,
                    date: date || dateStr,
                    type: '支出'
                });
            }
        }
    });

    // 保存数据
    if (saveTempData(STORAGE_KEYS.FINANCE, financeData)) {
        showNotification('💰 财务记录已保存！');
        calculateFinanceSummary();
    }
}

/**
 * 加载财务数据
 */
function loadFinanceData() {
    const dateStr = formatDate(new Date());
    const financeData = JSON.parse(localStorage.getItem(STORAGE_KEYS.FINANCE + '_TEMP') || '{}');

    if (financeData[dateStr]) {
        const data = financeData[dateStr];

        // 清空当前显示
        const incomeItems = document.getElementById('incomeItems');
        const expenseItems = document.getElementById('expenseItems');
        if (incomeItems) incomeItems.innerHTML = '';
        if (expenseItems) expenseItems.innerHTML = '';

        let incomeIndex = 0;
        let expenseIndex = 0;

        // 加载收入项
        if (data.incomes && Array.isArray(data.incomes)) {
            data.incomes.forEach(record => {
                const container = document.getElementById('incomeItems');
                if (container) {
                    const newItem = createFinanceItemElement('income', incomeIndex++, record);
                    container.appendChild(newItem);
                }
            });
        }

        // 加载支出项
        if (data.expenses && Array.isArray(data.expenses)) {
            data.expenses.forEach(record => {
                const container = document.getElementById('expenseItems');
                if (container) {
                    const newItem = createFinanceItemElement('expense', expenseIndex++, record);
                    container.appendChild(newItem);
                }
            });
        }

        incomeItemCount = incomeIndex;
        expenseItemCount = expenseIndex;
        updateFinanceItemNumbers('income');
        updateFinanceItemNumbers('expense');
        calculateFinanceSummary();
    }
}

/**
 * 创建财务条目元素
 */
function createFinanceItemElement(type, index, record) {
    const dateStr = formatDate(new Date());
    const item = document.createElement('div');
    item.className = `finance-item ${type}-item`;
    item.innerHTML = `
        <div class="item-number">${index + 1}</div>
        <div class="finance-item-content">
            <div class="form-row">
                <div class="form-column">
                    <input type="number" class="finance-amount" placeholder="金额 (元)" min="0" step="0.01" value="${record.amount || ''}">
                </div>
                <div class="form-column">
                    <select class="finance-category">
                        ${getCategoryOptions(type, record.category)}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-column">
                    <select class="finance-payment-method">
                        <option value="">选择支付方式</option>
                        <option value="信用卡" ${record.paymentMethod === '信用卡' ? 'selected' : ''}>💳 信用卡</option>
                        <option value="储蓄卡" ${record.paymentMethod === '储蓄卡' ? 'selected' : ''}>🏦 储蓄卡</option>
                        <option value="支付宝" ${record.paymentMethod === '支付宝' ? 'selected' : ''}>💰 支付宝</option>
                        <option value="微信" ${record.paymentMethod === '微信' ? 'selected' : ''}>💚 微信</option>
                        <option value="现金" ${record.paymentMethod === '现金' ? 'selected' : ''}>💵 现金</option>
                        <option value="其他" ${record.paymentMethod === '其他' ? 'selected' : ''}>📱 其他</option>
                    </select>
                </div>
            </div>
            <input type="text" class="finance-description" placeholder="${type === 'income' ? '收入' : '支出'}描述..." value="${record.description || ''}">
            <input type="date" class="finance-date" value="${record.date || dateStr}">
            <div class="finance-item-actions">
                <button class="delete-finance-item" onclick="deleteFinanceItem(this, '${type}')" title="删除此项">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;

    // 设置选中正确的分类
    if (record.category) {
        const select = item.querySelector('select');
        if (select) {
            select.value = record.category;
        }
    }

    return item;
}

/**
 * 获取分类选项
 */
function getCategoryOptions(type, selectedCategory) {
    const incomeOptions = [
        {value: '工资', label: '工资'},
        {value: '奖金', label: '奖金'},
        {value: '兼职', label: '兼职'},
        {value: '投资收益', label: '投资收益'},
        {value: '礼金', label: '礼金'},
        {value: '其他收入', label: '其他收入'}
    ];

    const expenseOptions = [
        {value: '正餐', label: '正餐'},
        {value: '零食奶茶宵夜', label: '零食奶茶宵夜'},
        {value: '日用', label: '日用'},
        {value: '服饰', label: '服饰'},
        {value: '游戏', label: '游戏'},
        {value: '兴趣爱好', label: '兴趣爱好'},
        {value: '礼物', label: '礼物'},
        {value: '交通', label: '交通'},
        {value: '医疗', label: '医疗'},
        {value: '其他支出', label: '其他支出'}
    ];

    const options = type === 'income' ? incomeOptions : expenseOptions;
    let html = '';

    options.forEach(option => {
        const selected = option.value === selectedCategory ? 'selected' : '';
        html += `<option value="${option.value}" ${selected}>${option.label}</option>`;
    });

    return html;
}

/**
 * 重置财务记账板
 */
function resetFinanceBoard() {
    const incomeItems = document.getElementById('incomeItems');
    const expenseItems = document.getElementById('expenseItems');
    
    if (incomeItems) incomeItems.innerHTML = '';
    if (expenseItems) expenseItems.innerHTML = '';
    
    // 添加默认项
    addFinanceItem('income');
    addFinanceItem('expense');
    
    incomeItemCount = 1;
    expenseItemCount = 1;
    calculateFinanceSummary();
}

// ==================== 日历功能 ====================

/**
 * 初始化日历
 */
function initCalendar() {
    renderCalendar();
}

/**
 * 渲染日历
 */
function renderCalendar() {
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    document.getElementById('calendarMonth').textContent = `${currentYear}年${monthNames[currentMonth]}`;

    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const firstDayOfWeek = firstDay.getDay();

    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';

    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const day = document.createElement('div');
        day.className = 'calendar-day other-month';
        day.textContent = prevMonthLastDay - i;
        calendarDays.appendChild(day);
    }

    const todayStr = formatDate(new Date());
    const daysWithRecords = getDaysWithRecords();

    for (let i = 1; i <= daysInMonth; i++) {
        const day = document.createElement('div');
        day.className = 'calendar-day';
        day.textContent = i;
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        day.dataset.date = dateStr;

        if (dateStr === todayStr) {
            day.classList.add('today');
        }

        if (daysWithRecords[dateStr]) {
            day.classList.add('has-record');
        }

        if (importantDates[dateStr]) {
            day.classList.add('has-important');
            const importantType = importantDates[dateStr].type;
            day.classList.add(`important-${importantType}`);
        }

        day.addEventListener('click', function() {
            showDateDetails(this.dataset.date);
        });

        calendarDays.appendChild(day);
    }

    const totalCells = 42;
    const daysSoFar = firstDayOfWeek + daysInMonth;
    const nextMonthDays = totalCells - daysSoFar;

    for (let i = 1; i <= nextMonthDays; i++) {
        const day = document.createElement('div');
        day.className = 'calendar-day other-month';
        day.textContent = i;
        calendarDays.appendChild(day);
    }
}

/**
 * 获取有记录的日子
 */
function getDaysWithRecords() {
    const daysWithRecords = {};
    Object.values(STORAGE_KEYS).forEach(key => {
        if (key === STORAGE_KEYS.ISLAND_INTERACTIONS || key === STORAGE_KEYS.IMPORTANT_DATES) return;
        
        const data = localStorage.getItem(key);
        if (data) {
            const parsedData = JSON.parse(data);
            Object.keys(parsedData).forEach(date => {
                if (!daysWithRecords[date]) {
                    daysWithRecords[date] = [];
                }
                daysWithRecords[date].push(key);
            });
        }
        
        const tempData = localStorage.getItem(key + '_TEMP');
        if (tempData) {
            const parsedTempData = JSON.parse(tempData);
            Object.keys(parsedTempData).forEach(date => {
                if (!daysWithRecords[date]) {
                    daysWithRecords[date] = [];
                }
                if (!daysWithRecords[date].includes(key)) {
                    daysWithRecords[date].push(key);
                }
            });
        }
    });
    
    return daysWithRecords;
}

/**
 * 显示日期详情
 */
function showDateDetails(dateStr) {
    selectedDate = dateStr;
    const detailsDiv = document.getElementById('dateDetails');
    let html = `<h4>${dateStr} 的记录</h4>`;

    if (importantDates[dateStr]) {
        const importantInfo = importantDates[dateStr];
        const dateType = getImportantDateTypeName(importantInfo.type);
        html += `<div class="record-item" style="background-color: #FFF3E0; padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid ${getImportantDateColor(importantInfo.type)}">
            <strong><i class="fas fa-star"></i> 重要日期: ${dateType}</strong><br>
            <span>${importantInfo.label}</span>
        </div>`;
    }

    let hasRecords = false;
    Object.values(STORAGE_KEYS).forEach(key => {
        if (key === STORAGE_KEYS.ISLAND_INTERACTIONS || key === STORAGE_KEYS.IMPORTANT_DATES) return;
        
        const data = localStorage.getItem(key);
        if (data) {
            const parsedData = JSON.parse(data);
            if (parsedData[dateStr] && parsedData[dateStr].length > 0) {
                hasRecords = true;
                html += `<h5>${getRecordTypeName(key)}</h5>`;
                parsedData[dateStr].forEach(record => {
                    html += `<div class="record-item">`;
                    switch(key) {
                        case STORAGE_KEYS.SLEEP:
                            html += `睡眠时长: ${record.duration}小时, 质量评分: ${record.quality}, 感受: ${record.feeling}`;
                            break;
                        case STORAGE_KEYS.BREAKFAST:
                            html += `早餐内容: ${record.content}, 感受: ${record.feeling}`;
                            break;
                        case STORAGE_KEYS.HOUSEWORK:
                            html += `家务积分: ${record.score}分, 感受: ${record.feeling}`;
                            break;
                        case STORAGE_KEYS.STUDY:
                            html += `科目: ${record.subject}, 时长: ${record.duration}分钟, 内容: ${record.content}`;
                            break;
                        case STORAGE_KEYS.EXERCISE:
                            html += `类型: ${record.type}, 项目: ${record.item}, 时长: ${record.duration}分钟`;
                            break;
                        case STORAGE_KEYS.FINANCE:
                            if (record.incomes && record.incomes.length > 0) {
                                html += `收入: ${record.incomes.length}笔<br>`;
                            }
                            if (record.expenses && record.expenses.length > 0) {
                                html += `支出: ${record.expenses.length}笔`;
                            }
                            break;
                        case STORAGE_KEYS.GAME:
                            html += `游戏类型: ${record.type}`;
                            if (record.type === '动物森友会') {
                                html += `, 天气: ${record.weather}, NPC: ${record.npc}`;
                            }
                            break;
                        case STORAGE_KEYS.ENTERTAINMENT:
                            html += `娱乐类型: ${record.type}, 内容: ${record.content}`;
                            break;
                        default:
                            html += JSON.stringify(record);
                    }
                    html += `</div>`;
                });
            }
        }
    });

    if (!hasRecords && !importantDates[dateStr]) {
        html += `<p>这一天没有已归档的记录</p>`;
        html += `<p><small>（临时保存的记录不会在这里显示）</small></p>`;
    }

    detailsDiv.innerHTML = html;
}

/**
 * 跳转到今天
 */
function goToToday() {
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();
    renderCalendar();
    showDateDetails(formatDate(today));
}

// ==================== 重要日期功能 ====================

/**
 * 加载重要日期
 */
function loadImportantDates() {
    const data = localStorage.getItem(STORAGE_KEYS.IMPORTANT_DATES);
    if (data) {
        importantDates = JSON.parse(data);
        renderImportantDatesList();
    }
}

/**
 * 渲染重要日期列表
 */
function renderImportantDatesList() {
    const listContainer = document.getElementById('importantDatesList');
    if (Object.keys(importantDates).length === 0) {
        listContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">暂无重要日期标记</p>';
        return;
    }
    
    let html = '';
    const sortedDates = Object.keys(importantDates).sort();
    sortedDates.forEach(dateStr => {
        const dateInfo = importantDates[dateStr];
        const dateType = getImportantDateTypeName(dateInfo.type);
        html += `
        <div class="important-date-item">
            <div class="important-date-info">
                <span class="important-date-type ${dateInfo.type}"></span>
                <span><strong>${dateStr}</strong> - ${dateInfo.label} (${dateType})</span>
            </div>
            <button class="delete-important-date" onclick="deleteImportantDate('${dateStr}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        `;
    });
    listContainer.innerHTML = html;
}

/**
 * 添加重要日期
 */
function addImportantDate() {
    const date = document.getElementById('importantDate').value;
    const type = document.getElementById('importantType').value;
    const label = document.getElementById('importantLabel').value;
    
    if (!date || !label) {
        showNotification('请填写日期和标签');
        return;
    }
    
    importantDates[date] = {
        type: type,
        label: label,
        addedDate: formatDate(new Date())
    };
    
    localStorage.setItem(STORAGE_KEYS.IMPORTANT_DATES, JSON.stringify(importantDates));
    renderImportantDatesList();
    renderCalendar();
    
    document.getElementById('importantLabel').value = '';
    document.getElementById('addImportantForm').style.display = 'none';
    document.getElementById('toggleAddImportantForm').innerHTML = '<i class="fas fa-plus"></i> 添加重要日期';
    
    showNotification('⭐ 重要日期已添加！');
}

/**
 * 删除重要日期
 */
function deleteImportantDate(dateStr) {
    if (confirm(`确定要删除 ${dateStr} 的重要日期标记吗？`)) {
        delete importantDates[dateStr];
        localStorage.setItem(STORAGE_KEYS.IMPORTANT_DATES, JSON.stringify(importantDates));
        renderImportantDatesList();
        renderCalendar();
        showNotification('🗑️ 重要日期已删除！');
    }
}

/**
 * 获取重要日期类型名称
 */
function getImportantDateTypeName(type) {
    const typeNames = {
        'anniversary': '纪念日',
        'deadline': '截止日期',
        'event': '重要事件',
        'reminder': '提醒事项',
        'birthday': '生日',
        'other': '其他'
    };
    return typeNames[type] || '其他';
}

/**
 * 获取重要日期颜色
 */
function getImportantDateColor(type) {
    const colors = {
        'anniversary': '#FF6B6B',
        'deadline': '#4ECDC4',
        'event': '#95E1D3',
        'reminder': '#C7CEEA',
        'birthday': '#FFC8DD',
        'other': '#FFAFCC'
    };
    return colors[type] || '#FFAFCC';
}

// ==================== 数据复盘功能 ====================

/**
 * 更新复盘数据
 */
function updateReviewData() {
    updateHealthReview();
    updateStudyReview();
    updateHouseworkReview();
    updateFinanceReview();
    updateEntertainmentReview();
}

/**
 * 更新健康复盘数据
 */
function updateHealthReview() {
    const sleepData = JSON.parse(localStorage.getItem(STORAGE_KEYS.SLEEP) || '{}');
    const exerciseData = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXERCISE) || '{}');
    const supplementData = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUPPLEMENTS) || '{}');
    const bodycareData = JSON.parse(localStorage.getItem(STORAGE_KEYS.BODYCARE) || '{}');

    // 平均睡眠时长
    let totalSleepHours = 0;
    let sleepCount = 0;
    Object.keys(sleepData).forEach(date => {
        sleepData[date].forEach(record => {
            if (record.duration) {
                totalSleepHours += record.duration;
                sleepCount++;
            }
        });
    });
    const avgSleepHours = sleepCount > 0 ? (totalSleepHours / sleepCount).toFixed(1) : '--';
    document.getElementById('avgSleepHours').textContent = avgSleepHours;

    // 本周运动天数
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    let exerciseDays = 0;
    Object.keys(exerciseData).forEach(date => {
        const recordDate = new Date(date);
        if (recordDate >= oneWeekAgo && exerciseData[date].length > 0) {
            exerciseDays++;
        }
    });
    document.getElementById('exerciseDays').textContent = exerciseDays;

    // 补剂打卡率（最近30天）
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let supplementDays = 0;
    let totalDays = 0;
    
    for (let d = new Date(thirtyDaysAgo); d <= new Date(); d.setDate(d.getDate() + 1)) {
        const dateStr = formatDate(d);
        totalDays++;
        if (supplementData[dateStr] && supplementData[dateStr].some(r => r.iron || r.vitaminDK || r.magnesium)) {
            supplementDays++;
        }
    }
    
    const supplementRate = totalDays > 0 ? Math.round((supplementDays / totalDays) * 100) : 0;
    document.getElementById('supplementRate').textContent = `${supplementRate}%`;

    // 护理完成率（最近30天）
    let bodycareDays = 0;
    totalDays = 0;
    
    for (let d = new Date(thirtyDaysAgo); d <= new Date(); d.setDate(d.getDate() + 1)) {
        const dateStr = formatDate(d);
        totalDays++;
        if (bodycareData[dateStr] && bodycareData[dateStr].some(r => r.scrub || r.hairRemoval || r.lotion)) {
            bodycareDays++;
        }
    }
    
    const bodycareRate = totalDays > 0 ? Math.round((bodycareDays / totalDays) * 100) : 0;
    document.getElementById('bodycareRate').textContent = `${bodycareRate}%`;
}

/**
 * 更新学习复盘数据
 */
function updateStudyReview() {
    const studyData = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDY) || '{}');
    let totalStudyTime = 0;
    let studyDays = 0;
    let subjectDistribution = {};

    Object.keys(studyData).forEach(date => {
        studyDays++;
        studyData[date].forEach(record => {
            totalStudyTime += record.duration || 0;
            const subject = record.subject || '未分类';
            if (!subjectDistribution[subject]) {
                subjectDistribution[subject] = 0;
            }
            subjectDistribution[subject] += record.duration || 0;
        });
    });

    document.getElementById('totalStudyTime').textContent = totalStudyTime;
    document.getElementById('studyDays').textContent = studyDays;

    const subjectList = document.getElementById('subjectDistribution');
    subjectList.innerHTML = '';
    
    if (Object.keys(subjectDistribution).length > 0) {
        Object.keys(subjectDistribution).forEach(subject => {
            const li = document.createElement('li');
            li.textContent = `${subject}: ${subjectDistribution[subject]}分钟`;
            subjectList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = '暂无学习记录';
        subjectList.appendChild(li);
    }
}

/**
 * 更新家务复盘数据
 */
function updateHouseworkReview() {
    const houseworkData = JSON.parse(localStorage.getItem(STORAGE_KEYS.HOUSEWORK) || '{}');
    let totalPoints = 0;
    let houseworkDays = 0;
    let houseworkStats = {
        '丢垃圾': 0,
        '做饭': 0,
        '洗衣服': 0,
        '晾衣服': 0,
        '叠衣服': 0,
        '收拾厨房': 0,
        '收拾桌子': 0,
        '收拾床铺': 0,
        '清理冰箱': 0
    };

    Object.keys(houseworkData).forEach(date => {
        houseworkData[date].forEach(record => {
            totalPoints += record.score || 0;
            houseworkDays++;
            if (record.garbage) houseworkStats['丢垃圾']++;
            if (record.cooking) houseworkStats['做饭']++;
            if (record.laundry) houseworkStats['洗衣服']++;
            if (record.hangingClothes) houseworkStats['晾衣服']++;
            if (record.foldingClothes) houseworkStats['叠衣服']++;
            if (record.cleaningKitchen) houseworkStats['收拾厨房']++;
            if (record.cleaningTable) houseworkStats['收拾桌子']++;
            if (record.cleaningBed) houseworkStats['收拾床铺']++;
            if (record.cleaningFridge) houseworkStats['清理冰箱']++;
        });
    });

    const avgDailyPoints = houseworkDays > 0 ? (totalPoints / houseworkDays).toFixed(1) : 0;
    document.getElementById('totalHouseworkPoints').textContent = totalPoints;
    document.getElementById('avgDailyHouseworkPoints').textContent = avgDailyPoints;

    const houseworkList = document.getElementById('houseworkStats');
    houseworkList.innerHTML = '';
    
    if (houseworkDays > 0) {
        Object.keys(houseworkStats).forEach(type => {
            if (houseworkStats[type] > 0) {
                const li = document.createElement('li');
                li.textContent = `${type}: ${houseworkStats[type]}次`;
                houseworkList.appendChild(li);
            }
        });
        
        if (houseworkList.children.length === 0) {
            const li = document.createElement('li');
            li.textContent = '暂无家务记录';
            houseworkList.appendChild(li);
        }
    } else {
        const li = document.createElement('li');
        li.textContent = '暂无家务记录';
        houseworkList.appendChild(li);
    }
}

/**
 * 更新财务复盘数据
 */
function updateFinanceReview() {
    const financeData = JSON.parse(localStorage.getItem(STORAGE_KEYS.FINANCE) || '{}');
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    let monthExpense = 0;
    let monthIncome = 0;
    let expenseDays = 0;
    let incomeDays = 0;
    let categoryStats = {};

    for (let d = new Date(firstDayOfMonth); d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDate(d);
        let dayExpense = 0;
        let dayIncome = 0;

        if (financeData[dateStr]) {
            const data = financeData[dateStr];

            // 处理支出
            if (data.expenses && Array.isArray(data.expenses)) {
                data.expenses.forEach(record => {
                    const amount = record.amount || 0;
                    monthExpense += amount;
                    dayExpense += amount;
                    const category = record.category || '未分类';
                    if (!categoryStats[category]) {
                        categoryStats[category] = { expense: 0, income: 0 };
                    }
                    categoryStats[category].expense += amount;
                });
            }

            // 处理收入
            if (data.incomes && Array.isArray(data.incomes)) {
                data.incomes.forEach(record => {
                    const amount = record.amount || 0;
                    monthIncome += amount;
                    dayIncome += amount;
                    const category = record.category || '未分类';
                    if (!categoryStats[category]) {
                        categoryStats[category] = { expense: 0, income: 0 };
                    }
                    categoryStats[category].income += amount;
                });
            }
        }

        if (dayExpense > 0) expenseDays++;
        if (dayIncome > 0) incomeDays++;
    }

    const avgDailyExpense = expenseDays > 0 ? (monthExpense / expenseDays).toFixed(2) : 0;
    document.getElementById('monthExpense').textContent = monthExpense.toFixed(2);
    document.getElementById('avgDailyExpense').textContent = avgDailyExpense;

    const categoryList = document.getElementById('expenseCategories');
    categoryList.innerHTML = '';
    
    if (Object.keys(categoryStats).length > 0) {
        Object.keys(categoryStats).forEach(category => {
            const stats = categoryStats[category];
            if (stats.expense > 0 || stats.income > 0) {
                const li = document.createElement('li');
                let text = `${category}: `;
                if (stats.expense > 0) {
                    text += `${stats.expense.toFixed(2)}元 (支出)`;
                }
                if (stats.income > 0) {
                    if (stats.expense > 0) text += ', ';
                    text += `${stats.income.toFixed(2)}元 (收入)`;
                }
                li.textContent = text;
                categoryList.appendChild(li);
            }
        });
    } else {
        const li = document.createElement('li');
        li.textContent = '暂无财务记录';
        categoryList.appendChild(li);
    }
}

/**
 * 更新娱乐复盘数据
 */
function updateEntertainmentReview() {
    const entertainmentData = JSON.parse(localStorage.getItem(STORAGE_KEYS.ENTERTAINMENT) || '{}');
    const gameData = JSON.parse(localStorage.getItem(STORAGE_KEYS.GAME) || '{}');

    let entertainmentStats = {};

    Object.keys(entertainmentData).forEach(date => {
        entertainmentData[date].forEach(record => {
            const type = record.type || '未分类';
            if (!entertainmentStats[type]) {
                entertainmentStats[type] = 0;
            }
            entertainmentStats[type]++;
        });
    });

    Object.keys(gameData).forEach(date => {
        gameData[date].forEach(record => {
            const type = '游戏-' + (record.type || '未分类');
            if (!entertainmentStats[type]) {
                entertainmentStats[type] = 0;
            }
            entertainmentStats[type]++;
        });
    });

    const entertainmentList = document.getElementById('entertainmentStats');
    entertainmentList.innerHTML = '';
    
    if (Object.keys(entertainmentStats).length > 0) {
        Object.keys(entertainmentStats).forEach(type => {
            const li = document.createElement('li');
            li.textContent = `${type}: ${entertainmentStats[type]}次`;
            entertainmentList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = '暂无娱乐记录';
        entertainmentList.appendChild(li);
    }
}

// ==================== 今日概览功能 ====================

/**
 * 从临时数据更新概览
 */
function updateOverviewFromTemp() {
    const dateStr = formatDate(new Date());
    
    // 家务积分
    const houseworkData = JSON.parse(localStorage.getItem(STORAGE_KEYS.HOUSEWORK + '_TEMP') || '{}');
    let houseworkScore = 0;
    if (houseworkData[dateStr] && houseworkData[dateStr].length > 0) {
        const latestHousework = houseworkData[dateStr][houseworkData[dateStr].length - 1];
        houseworkScore = latestHousework.score || 0;
    }
    const houseworkOverviewEl = document.getElementById('houseworkOverview');
    if (houseworkOverviewEl) {
        houseworkOverviewEl.textContent = `${houseworkScore}分`;
    }

    // 学习时长
    const studyData = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDY + '_TEMP') || '{}');
    let totalStudyTime = 0;
    if (studyData[dateStr]) {
        studyData[dateStr].forEach(record => {
            totalStudyTime += record.duration || 0;
        });
    }
    const studyOverviewEl = document.getElementById('studyOverview');
    if (studyOverviewEl) {
        studyOverviewEl.textContent = `${totalStudyTime}分钟`;
    }

    // 运动时长
    const exerciseData = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXERCISE + '_TEMP') || '{}');
    let totalExerciseTime = 0;
    if (exerciseData[dateStr]) {
        exerciseData[dateStr].forEach(record => {
            totalExerciseTime += record.duration || 0;
        });
    }
    const exerciseOverviewEl = document.getElementById('exerciseOverview');
    if (exerciseOverviewEl) {
        exerciseOverviewEl.textContent = `${totalExerciseTime}分钟`;
    }

    // 今日支出
    const financeData = JSON.parse(localStorage.getItem(STORAGE_KEYS.FINANCE + '_TEMP') || '{}');
    let todayExpense = 0;
    
    if (financeData[dateStr]) {
        const data = financeData[dateStr];
        if (data.expenses && Array.isArray(data.expenses)) {
            data.expenses.forEach(record => {
                todayExpense += record.amount || 0;
            });
        }
    }
    
    const expenseOverviewEl = document.getElementById('expenseOverview');
    if (expenseOverviewEl) {
        expenseOverviewEl.textContent = `${todayExpense.toFixed(2)}元`;
    }
}

// ==================== 导航功能 ====================

/**
 * 初始化导航
 */
function initNavigation() {
    // 底部导航
    const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
    bottomNavItems.forEach(item => {
        item.addEventListener('click', function() {
            const section = this.dataset.section;
            if (section) {
                switchSection(section);
                bottomNavItems.forEach(i => i.classList.remove('active'));
                this.classList.add('active');
            } else if (this.id === 'bottomReviewToggle') {
                document.getElementById('reviewPanel').classList.add('active');
            }
        });
    });
}

/**
 * 切换显示区域
 */
function switchSection(section) {
    // 隐藏所有区域
    const allSections = document.querySelectorAll('.section');
    allSections.forEach(sec => {
        sec.classList.remove('active');
    });
    
    // 显示目标区域
    const targetSection = document.getElementById(`${section}-block`) || document.getElementById(section);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // 如果是日历，重新渲染
    if (section === 'calendar') {
        renderCalendar();
    }
}

/**
 * 初始化导航侧边栏
 */
function initNavSidebar() {
    const navToggle = document.getElementById('navToggle');
    const navSidebar = document.getElementById('navSidebar');
    const closeNav = document.getElementById('closeNav');
    const body = document.body;
    
    // 打开侧边栏
    navToggle.addEventListener('click', function() {
        navSidebar.classList.add('active');
        body.classList.add('nav-expanded');
    });
    
    // 关闭侧边栏
    closeNav.addEventListener('click', function() {
        navSidebar.classList.remove('active');
        body.classList.remove('nav-expanded');
    });
    
    // 侧边栏菜单项点击
    const navMenuItems = document.querySelectorAll('.nav-menu-main');
    navMenuItems.forEach(item => {
        item.addEventListener('click', function() {
            const targetId = this.dataset.target;
            const section = this.dataset.section;
            
            if (targetId) {
                // 导航到具体块
                navigateToBlock(targetId);
                navSidebar.classList.remove('active');
                body.classList.remove('nav-expanded');
            } else if (section) {
                // 切换到对应区域
                switchSection(section);
                navSidebar.classList.remove('active');
                body.classList.remove('nav-expanded');
            }
        });
    });
}

/**
 * 导航到具体块
 */
function navigateToBlock(blockId) {
    const targetElement = document.getElementById(blockId);
    if (targetElement) {
        // 确保显示正确的区域
        if (blockId.includes('block')) {
            const blockName = blockId.replace('-block', '');
            switchSection('时间轴记录');
            
            // 展开对应的块
            const content = document.getElementById(blockName + '-content');
            if (content && !content.classList.contains('expanded')) {
                toggleBlock(blockName);
            }
        }
        
        // 滚动到目标位置
        setTimeout(() => {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // 添加视觉反馈
            targetElement.style.boxShadow = '0 0 0 3px rgba(255, 183, 197, 0.3)';
            targetElement.style.transition = 'box-shadow 0.5s ease';
            
            setTimeout(() => {
                targetElement.style.boxShadow = '';
            }, 1500);
        }, 100);
    }
}

/**
 * 初始化概览面板
 */
function initOverviewPanel() {
    const overviewToggle = document.getElementById('overviewToggle');
    const overviewPanel = document.getElementById('overviewPanel');
    
    overviewToggle.addEventListener('click', function() {
        overviewPanel.classList.toggle('collapsed');
        overviewPanel.classList.toggle('expanded');
    });
}

/**
 * 初始化游戏类型切换
 */
function initGameTypeToggle() {
    const gameTypeSelect = document.getElementById('gameType');
    if (gameTypeSelect) {
        gameTypeSelect.addEventListener('change', function() {
            const gameType = this.value;
            document.getElementById('generalGame').style.display = gameType === '通用游戏' ? 'block' : 'none';
            document.getElementById('animalCrossing').style.display = gameType === '动物森友会' ? 'block' : 'none';
        });
    }
}

// ==================== 按钮事件初始化 ====================

/**
 * 初始化按钮事件
 */
function initButtonEvents() {
    // 复盘面板开关
    document.getElementById('reviewToggle')?.addEventListener('click', () => {
        document.getElementById('reviewPanel').classList.add('active');
    });
    
    document.getElementById('bottomReviewToggle')?.addEventListener('click', () => {
        document.getElementById('reviewPanel').classList.add('active');
    });
    
    document.getElementById('closeReview')?.addEventListener('click', () => {
        document.getElementById('reviewPanel').classList.remove('active');
    });
    
    // 日历导航
    document.getElementById('prevMonth')?.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar();
    });
    
    document.getElementById('nextMonth')?.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar();
    });
    
    // 重要日期表单
    document.getElementById('toggleAddImportantForm')?.addEventListener('click', function() {
        const form = document.getElementById('addImportantForm');
        if (form.style.display === 'none') {
            form.style.display = 'block';
            this.innerHTML = '<i class="fas fa-minus"></i> 取消添加';
        } else {
            form.style.display = 'none';
            this.innerHTML = '<i class="fas fa-plus"></i> 添加重要日期';
        }
    });
    
    document.getElementById('cancelAddImportantForm')?.addEventListener('click', function() {
        document.getElementById('addImportantForm').style.display = 'none';
        document.getElementById('toggleAddImportantForm').innerHTML = '<i class="fas fa-plus"></i> 添加重要日期';
    });
}

// ==================== 辅助函数 ====================

/**
 * 获取记录类型名称
 */
function getRecordTypeName(key) {
    const names = {
        'sleepData': '睡眠记录',
        'breakfastData': '早餐记录',
        'workData': '工作记录',
        'houseworkData': '家务记录',
        'studyData': '学习记录',
        'lunchData': '午餐记录',
        'napData': '午休记录',
        'exerciseData': '运动记录',
        'dinnerData': '晚餐记录',
        'gameData': '游戏记录',
        'entertainmentData': '娱乐记录',
        'financeData': '财务记录',
        'supplementData': '补剂打卡',
        'bodycareData': '护理打卡'
    };
    return names[key] || key;
}

/**
 * 显示通知
 */
function showNotification(message) {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    if (notification && notificationText) {
        notificationText.textContent = message;
        notification.style.display = 'flex';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
}

/**
 * 加载今日数据
 */
function loadTodayData() {
    // 加载今日的临时数据到表单
    console.log('📊 加载今日数据...');
}

// ==================== GitHub同步功能 ====================

/**
 * 打开GitHub同步面板
 */
function openGitHubSyncPanel() {
    const panel = document.getElementById('githubSyncPanel');
    const overlay = document.getElementById('syncOverlay');
    
    if (panel && overlay) {
        panel.style.display = 'block';
        overlay.style.display = 'block';
        githubSyncManager.updateUI();
    }
}

/**
 * 关闭GitHub同步面板
 */
function closeGitHubSyncPanel() {
    const panel = document.getElementById('githubSyncPanel');
    const overlay = document.getElementById('syncOverlay');
    
    if (panel && overlay) {
        panel.style.display = 'none';
        overlay.style.display = 'none';
        hideSyncStatus();
    }
}

/**
 * 打开PAT配置模态框
 */
function openPATModal() {
    const form = document.getElementById('patConfigForm');
    if (form) {
        form.style.display = 'block';
    }
}

/**
 * 关闭PAT配置模态框
 */
function closePATModal() {
    const form = document.getElementById('patConfigForm');
    if (form) {
        form.style.display = 'none';
    }
}

/**
 * 使用PAT连接GitHub
 */
async function connectWithPAT() {
    const pat = document.getElementById('githubPAT')?.value.trim();
    const description = document.getElementById('gistDescription')?.value.trim() || 'island sync data';

    if (!pat) {
        showNotification('请输入 GitHub Personal Access Token');
        return;
    }

    if (!pat.startsWith('ghp_') && !pat.startsWith('github_pat_')) {
        if (!confirm('这个看起来不像有效的 PAT。请确认您输入的是正确的 Personal Access Token。\n\n是否继续？')) {
            return;
        }
    }

    showSyncStatus('正在验证 PAT...');

    try {
        githubSyncManager.accessToken = pat;

        const userData = await githubSyncManager.testConnection();

        showSyncStatus('正在设置 Gist...');
        updateProgress(30);

        await githubSyncManager.findOrCreateGist(description);

        updateProgress(80);
        showSyncStatus('正在保存配置...');

        githubSyncManager.saveConfig();

        updateProgress(100);
        showSyncStatus('连接成功！', 'success');

        setTimeout(() => {
            hideSyncStatus();
            githubSyncManager.updateUI();
            closePATModal();
            
            const patInput = document.getElementById('githubPAT');
            const descInput = document.getElementById('gistDescription');
            if (patInput) patInput.value = '';
            if (descInput) descInput.value = '';
        }, 1500);

    } catch (error) {
        showSyncStatus(`连接失败: ${error.message}`, 'error');
        githubSyncManager.clearConfig();
    }
}

/**
 * 手动同步配置
 */
function manualSyncConfig() {
    document.getElementById('syncConnected').style.display = 'none';
    document.getElementById('syncManualConfig').style.display = 'block';

    const usernameInput = document.getElementById('manualUsername');
    const gistIdInput = document.getElementById('manualGistId');
    
    if (usernameInput) usernameInput.value = githubSyncManager.username || '';
    if (gistIdInput) gistIdInput.value = githubSyncManager.gistId || '';
}

/**
 * 显示已连接视图
 */
function showConnectedView() {
    document.getElementById('syncManualConfig').style.display = 'none';
    document.getElementById('syncConnected').style.display = 'block';
}

/**
 * 保存手动配置
 */
function saveManualConfig() {
    const username = document.getElementById('manualUsername')?.value.trim();
    const gistId = document.getElementById('manualGistId')?.value.trim();

    if (!username) {
        showNotification('请输入 GitHub 用户名');
        return;
    }

    githubSyncManager.username = username;
    if (gistId) githubSyncManager.gistId = gistId;

    githubSyncManager.saveConfig();
    githubSyncManager.updateUI();
    showNotification('⚙️ 手动配置已保存');
}

/**
 * 同步到GitHub
 */
async function syncToGitHub(action) {
    if (!githubSyncManager.isConnected()) {
        showNotification('请先连接 GitHub 账号');
        return;
    }

    showSyncStatus(action === 'upload' ? '正在准备上传数据...' : '正在下载数据...');

    try {
        if (action === 'upload') {
            await uploadData();
        } else {
            await downloadData();
        }
    } catch (error) {
        showSyncStatus(`${action === 'upload' ? '上传' : '下载'}失败: ${error.message}`, 'error');
    }
}

/**
 * 上传数据到GitHub
 */
async function uploadData() {
    updateProgress(20);
    showSyncStatus('正在收集数据...');

    const allData = {};
    const storageKeys = Object.keys(localStorage);

    storageKeys.forEach(key => {
        if (!key.includes('github_') && !key.includes('_temp')) {
            try {
                const value = localStorage.getItem(key);
                if (value) {
                    allData[key] = JSON.parse(value);
                }
            } catch (e) {
                console.warn(`无法解析 ${key}:`, e);
            }
        }
    });

    updateProgress(40);
    showSyncStatus('正在加密数据...');

    const encryptedData = btoa(JSON.stringify(allData));

    updateProgress(60);
    showSyncStatus('正在上传到 GitHub...');

    const response = await fetch(`https://api.github.com/gists/${githubSyncManager.gistId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `token ${githubSyncManager.accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            description: `island sync data - ${new Date().toLocaleString('zh-CN')}`,
            files: {
                'island-data.json': {
                    content: encryptedData
                }
            }
        })
    });

    if (!response.ok) {
        throw new Error(`上传失败: ${response.status}`);
    }

    updateProgress(100);
    githubSyncManager.lastSync = new Date().toISOString();
    githubSyncManager.saveConfig();

    showSyncStatus('上传成功！', 'success');
    showNotification('☁️ 数据已备份到 GitHub！');

    setTimeout(() => {
        hideSyncStatus();
        githubSyncManager.updateUI();
    }, 1500);
}

/**
 * 从GitHub下载数据
 */
async function downloadData() {
    if (!confirm('从 GitHub 下载数据将覆盖本地数据，是否继续？')) {
        return;
    }

    updateProgress(20);
    showSyncStatus('正在从 GitHub 获取数据...');

    const response = await fetch(`https://api.github.com/gists/${githubSyncManager.gistId}`, {
        headers: {
            'Authorization': `token ${githubSyncManager.accessToken}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (!response.ok) {
        throw new Error(`下载失败: ${response.status}`);
    }

    const gistData = await response.json();
    const encryptedContent = gistData.files['island-data.json'].content;

    updateProgress(60);
    showSyncStatus('正在解密数据...');

    try {
        const decryptedData = JSON.parse(atob(encryptedContent));

        updateProgress(80);
        showSyncStatus('正在写入本地存储...');

        Object.keys(decryptedData).forEach(key => {
            localStorage.setItem(key, JSON.stringify(decryptedData[key]));
        });

        updateProgress(100);
        githubSyncManager.lastSync = new Date().toISOString();
        githubSyncManager.saveConfig();

        showSyncStatus('下载成功！', 'success');
        showNotification('☁️ 已从 GitHub 恢复数据！');

        setTimeout(() => {
            hideSyncStatus();
            githubSyncManager.updateUI();
            
            // 重新加载数据
            loadTodayData();
            loadWorkData();
            loadFinanceData();
            loadImportantDates();
            updateReviewData();
            renderCalendar();
            updateOverviewFromTemp();
            
            showNotification('🔄 页面数据已刷新！');
        }, 1500);

    } catch (error) {
        throw new Error('数据解密失败');
    }
}

/**
 * 断开GitHub连接
 */
function disconnectGitHub() {
    if (confirm('确定要断开 GitHub 连接吗？\n这将清除所有同步配置。')) {
        githubSyncManager.clearConfig();
        githubSyncManager.updateUI();
        showNotification('🔌 已断开 GitHub 连接');
    }
}

/**
 * 显示同步状态
 */
function showSyncStatus(message, type = 'loading') {
    const statusEl = document.getElementById('syncStatus');
    const statusText = document.getElementById('statusText');

    if (!statusEl || !statusText) return;

    statusEl.style.display = 'block';
    statusText.textContent = message;

    const spinner = statusEl.querySelector('.spinner');
    if (type === 'success') {
        statusText.style.color = '#4CAF50';
        if (spinner) spinner.style.display = 'none';
    } else if (type === 'error') {
        statusText.style.color = '#F44336';
        if (spinner) spinner.style.display = 'none';
    } else {
        statusText.style.color = '#24292e';
        if (spinner) spinner.style.display = 'block';
    }
}

/**
 * 隐藏同步状态
 */
function hideSyncStatus() {
    const statusEl = document.getElementById('syncStatus');
    if (statusEl) {
        statusEl.style.display = 'none';
    }
    updateProgress(0);
}

/**
 * 更新进度条
 */
function updateProgress(percent) {
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.getElementById('progressText');

    if (progressFill) {
        progressFill.style.width = percent + '%';
    }
    if (progressText) {
        progressText.textContent = percent + '%';
    }
}

// ==================== 全局导出 ====================
// 确保函数在全局作用域中可用
window.toggleBlock = toggleBlock;
window.saveSleep = saveSleep;
window.saveBreakfast = saveBreakfast;
window.saveWork = saveWork;
window.saveHousework = saveHousework;
window.saveStudy = saveStudy;
window.saveLunch = saveLunch;
window.saveNap = saveNap;
window.saveExercise = saveExercise;
window.saveDinner = saveDinner;
window.saveGame = saveGame;
window.saveEntertainment = saveEntertainment;
window.saveFinance = saveFinance;
window.saveSupplements = saveSupplements;
window.saveBodyCare = saveBodyCare;
window.addTodoItem = addTodoItem;
window.addDoneItem = addDoneItem;
window.addFinanceItem = addFinanceItem;
window.deleteFinanceItem = deleteFinanceItem;
window.goToToday = goToToday;
window.addImportantDate = addImportantDate;
window.deleteImportantDate = deleteImportantDate;
window.openGitHubSyncPanel = openGitHubSyncPanel;
window.closeGitHubSyncPanel = closeGitHubSyncPanel;
window.openPATModal = openPATModal;
window.closePATModal = closePATModal;
window.connectWithPAT = connectWithPAT;
window.manualSyncConfig = manualSyncConfig;
window.showConnectedView = showConnectedView;
window.saveManualConfig = saveManualConfig;
window.syncToGitHub = syncToGitHub;
window.disconnectGitHub = disconnectGitHub;

console.log('🚀 小航小刀小岛 - 应用逻辑加载完成');