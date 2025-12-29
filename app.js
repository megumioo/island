// ==================== 新增：GitHub 同步管理器 ====================
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

            // 更新用户信息
            document.getElementById('githubUsername').textContent = 
                this.userInfo.name || this.username || 'GitHub User';
            
            if (this.userInfo.avatar_url) {
                document.getElementById('githubAvatar').src = this.userInfo.avatar_url;
            }

            // 更新同步信息
            if (this.lastSync) {
                const lastSyncDate = new Date(this.lastSync);
                document.getElementById('lastSyncTime').textContent = 
                    lastSyncDate.toLocaleString('zh-CN');
            } else {
                document.getElementById('lastSyncTime').textContent = '从未同步';
            }

            // 计算记录数量
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
        const storageKeys = [
            'sleepData', 'breakfastData', 'workData', 'houseworkData',
            'lunchData', 'napData', 'dinnerData', 'studyData',
            'exerciseData', 'gameData', 'entertainmentData', 'financeData'
        ];

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
            // 首先查找现有的 Gist
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
                // 创建新的 Gist
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

// ==================== 新增：GitHub 同步 UI 控制函数 ====================
function openGitHubSyncPanel() {
    const panel = document.getElementById('githubSyncPanel');
    const overlay = document.getElementById('syncOverlay');
    panel.style.display = 'block';
    overlay.style.display = 'block';
    githubSyncManager.updateUI();
}

function closeGitHubSyncPanel() {
    const panel = document.getElementById('githubSyncPanel');
    const overlay = document.getElementById('syncOverlay');
    panel.style.display = 'none';
    overlay.style.display = 'none';
    hideSyncStatus();
}

function openPATModal() {
    document.getElementById('patConfigForm').style.display = 'block';
}

function closePATModal() {
    document.getElementById('patConfigForm').style.display = 'none';
}

async function connectWithPAT() {
    const pat = document.getElementById('githubPAT').value.trim();
    const description = document.getElementById('gistDescription').value.trim() || 'island sync data';

    if (!pat) {
        alert('请输入 GitHub Personal Access Token');
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
        
        // 测试连接
        const userData = await githubSyncManager.testConnection();
        
        showSyncStatus('正在设置 Gist...');
        updateProgress(30);
        
        // 查找或创建 Gist
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
            document.getElementById('githubPAT').value = '';
            document.getElementById('gistDescription').value = '';
        }, 1500);
        
    } catch (error) {
        showSyncStatus(`连接失败: ${error.message}`, 'error');
        githubSyncManager.clearConfig();
    }
}

function manualSyncConfig() {
    document.getElementById('syncConnected').style.display = 'none';
    document.getElementById('syncManualConfig').style.display = 'block';
    
    // 填充现有配置
    document.getElementById('manualUsername').value = githubSyncManager.username || '';
    document.getElementById('manualGistId').value = githubSyncManager.gistId || '';
}

function showConnectedView() {
    document.getElementById('syncManualConfig').style.display = 'none';
    document.getElementById('syncConnected').style.display = 'block';
}

async function saveManualConfig() {
    const username = document.getElementById('manualUsername').value.trim();
    const gistId = document.getElementById('manualGistId').value.trim();

    if (!username) {
        alert('请输入 GitHub 用户名');
        return;
    }

    githubSyncManager.username = username;
    if (gistId) githubSyncManager.gistId = gistId;
    
    githubSyncManager.saveConfig();
    githubSyncManager.updateUI();
    showNotification('手动配置已保存');
}

async function syncToGitHub(action) {
    if (!githubSyncManager.isConnected()) {
        alert('请先连接 GitHub 账号');
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

async function uploadData() {
    updateProgress(20);
    showSyncStatus('正在收集数据...');
    
    // 收集所有数据
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
    
    // 简单加密
    const encryptedData = btoa(JSON.stringify(allData));
    
    updateProgress(60);
    showSyncStatus('正在上传到 GitHub...');
    
    // 更新 Gist
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
    showNotification('✅ 数据已备份到 GitHub！');
    
    setTimeout(() => {
        hideSyncStatus();
        githubSyncManager.updateUI();
    }, 1500);
}

async function downloadData() {
    if (!confirm('从 GitHub 下载数据将覆盖本地数据，是否继续？')) {
        return;
    }

    updateProgress(20);
    showSyncStatus('正在从 GitHub 获取数据...');
    
    // 获取 Gist 数据
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
    
    // 解密数据
    try {
        const decryptedData = JSON.parse(atob(encryptedContent));
        
        updateProgress(80);
        showSyncStatus('正在写入本地存储...');
        
        // 写入本地存储
        Object.keys(decryptedData).forEach(key => {
            localStorage.setItem(key, JSON.stringify(decryptedData[key]));
        });
        
        updateProgress(100);
        githubSyncManager.lastSync = new Date().toISOString();
        githubSyncManager.saveConfig();
        
        showSyncStatus('下载成功！', 'success');
        showNotification('✅ 已从 GitHub 恢复数据！');
        
        setTimeout(() => {
            hideSyncStatus();
            githubSyncManager.updateUI();
            // 刷新页面数据
            if (typeof loadAllData === 'function') {
                loadAllData();
            }
            location.reload();
        }, 1500);
        
    } catch (error) {
        throw new Error('数据解密失败');
    }
}

function disconnectGitHub() {
    if (confirm('确定要断开 GitHub 连接吗？\n这将清除所有同步配置。')) {
        githubSyncManager.clearConfig();
        githubSyncManager.updateUI();
        showNotification('已断开 GitHub 连接');
    }
}

function showSyncStatus(message, type = 'loading') {
    const statusEl = document.getElementById('syncStatus');
    const statusText = document.getElementById('statusText');
    
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

function hideSyncStatus() {
    document.getElementById('syncStatus').style.display = 'none';
    updateProgress(0);
}

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
// ==================== 新增结束 ====================

// 原有的应用数据模型
const STORAGE_KEYS = { 
SLEEP: 'sleepData', 
BREAKFAST: 'breakfastData', 
SUPPLEMENTS: 'supplementData', 
WORK: 'workData', 
HOUSEWORK: 'houseworkData', 
LUNCH: 'lunchData', 
NAP: 'napData', 
DINNER: 'dinnerData', 
VITAMIN: 'vitaminData', 
STUDY: 'studyData', 
EXERCISE: 'exerciseData', 
GAME: 'gameData', 
ENTERTAINMENT: 'entertainmentData', 
MAGNESIUM: 'magnesiumData', 
BODYCARE: 'bodycareData', 
FINANCE: 'financeData', 
ISLAND_INTERACTIONS: 'islandInteractions', 
IMPORTANT_DATES: 'importantDates' 
}; 

const ISLAND_RESIDENTS = [ 
'威亚', '丽婷', '茉莉', '樱桃', '贾洛斯', '草莓', '杰西卡', '大姐头', '小影', '哈姆' 
]; 

const INTERACTION_TYPES = ['打招呼', '送礼', '收礼', '收明信片']; 

const IMPORTANT_DATE_TYPES = { 
'anniversary': { name: '纪念日', color: 'important-red', class: 'important-anniversary' }, 
'deadline': { name: '截止日期', color: 'important-blue', class: 'important-deadline' }, 
'event': { name: '重要事件', color: 'important-green', class: 'important-event' }, 
'reminder': { name: '提醒事项', color: 'important-purple', class: 'important-reminder' }, 
'birthday': { name: '生日', color: 'important-pink', class: 'important-birthday' }, 
'other': { name: '其他', color: 'important-orange', class: 'important-other' } 
}; 

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

document.addEventListener('DOMContentLoaded', function() { 
updateDateTime(); 
setInterval(updateDateTime, 1000); 
initIslandResidentsTable(); 
initGameTypeToggle(); 
initCalendar(); 
loadTodayData(); 
initButtonEvents(); 
updateReviewData(); 
loadIslandInteractions(); 
loadImportantDates(); 
updateOverviewFromTemp(); 
document.getElementById('financeDate').value = todayStr; 
document.getElementById('importantDate').value = todayStr; 
loadWorkData(); 
initNavigation(); 
initOverviewPanel(); 
initNavSidebar(); 
initCollapsibleBlocks(); 
initHouseworkScore(); 

// ==================== 新增：初始化 GitHub 同步管理器 ====================
githubSyncManager.init();
// ==================== 新增结束 ====================

if (window.navigator.standalone) { 
const currentUrl = window.location.href; 
const correctUrl = 'https://yourdomain.com/island/index.html'; 
if (currentUrl === 'https://yourdomain.com/') { 
window.location.replace(correctUrl); 
} 
} 

if ('serviceWorker' in navigator) { 
window.addEventListener('load', () => { 
navigator.serviceWorker.register('service-worker.js') 
.then(registration => { 
console.log('ServiceWorker注册成功'); 
registration.addEventListener('updatefound', () => { 
const newWorker = registration.installing; 
console.log('发现新的Service Worker版本'); 
newWorker.addEventListener('statechange', () => { 
if (newWorker.state === 'installed' && navigator.serviceWorker.controller) { 
showNotification('✨ island有更新可用，请刷新页面获取新功能！'); 
} 
}); 
}); 
}) 
.catch(error => { 
console.log('ServiceWorker注册失败: ', error); 
}); 
}); 
} 

let deferredPrompt; 
window.addEventListener('beforeinstallprompt', (e) => { 
e.preventDefault(); 
deferredPrompt = e; 
console.log('可以显示安装提示了'); 
}); 
}); 

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

function initHouseworkScore() { 
const checkboxes = document.querySelectorAll('#家务记录-content input[type="checkbox"]'); 
checkboxes.forEach(checkbox => { 
checkbox.addEventListener('change', updateHouseworkScore); 
}); 
updateHouseworkScore(); 
} 

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
document.getElementById('currentDateTime').textContent = dateTimeStr; 
} 

function initOverviewPanel() { 
const overviewToggle = document.getElementById('overviewToggle'); 
const overviewPanel = document.getElementById('overviewPanel'); 
overviewToggle.addEventListener('click', function() { 
overviewPanel.classList.toggle('collapsed'); 
overviewPanel.classList.toggle('expanded'); 
}); 
} 

function initNavSidebar() { 
const navToggle = document.getElementById('navToggle'); 
const navSidebar = document.getElementById('navSidebar'); 
const closeNav = document.getElementById('closeNav'); 
const body = document.body; 
navToggle.addEventListener('click', function() { 
navSidebar.classList.add('active'); 
body.classList.add('nav-expanded'); 
}); 
closeNav.addEventListener('click', function() { 
navSidebar.classList.remove('active'); 
body.classList.remove('nav-expanded'); 
}); 

const navMainItems = document.querySelectorAll('.nav-menu-main'); 
navMainItems.forEach(item => { 
if (!item.id) { 
item.addEventListener('click', function() { 
const arrow = this.querySelector('.nav-menu-arrow'); 
if (arrow) { 
arrow.classList.toggle('rotated'); 
const submenu = this.parentElement.querySelector('.nav-submenu'); 
if (submenu) { 
submenu.classList.toggle('expanded'); 
} 
} 
navMainItems.forEach(i => { 
if (!i.id) i.classList.remove('active'); 
}); 
this.classList.add('active'); 
const section = this.dataset.section; 
if (section) { 
switchSection(section); 
} 
const targetId = this.dataset.target; 
if (targetId) { 
navigateToBlock(targetId); 
} 
}); 
} 
}); 

const navSubItems = document.querySelectorAll('.nav-submenu-item'); 
navSubItems.forEach(item => { 
item.addEventListener('click', function() { 
const targetId = this.dataset.target; 
navigateToBlock(targetId); 
if (window.innerWidth <= 768) { 
navSidebar.classList.remove('active'); 
body.classList.remove('nav-expanded'); 
} 
}); 
}); 

document.getElementById('navReviewToggle').addEventListener('click', function() { 
document.getElementById('reviewPanel').classList.add('active'); 
navSidebar.classList.remove('active'); 
body.classList.remove('nav-expanded'); 
}); 

document.getElementById('navTodayOverview').addEventListener('click', function() { 
const overviewPanel = document.getElementById('overviewPanel'); 
overviewPanel.classList.remove('collapsed'); 
overviewPanel.classList.add('expanded'); 
navSidebar.classList.remove('active'); 
body.classList.remove('nav-expanded'); 
}); 
} 

function navigateToBlock(blockId) { 
const targetElement = document.getElementById(blockId); 
if (targetElement) { 
if (blockId === 'calendarSection') { 
switchSection('calendar'); 
} else if (blockId === 'importantDatesPanel') { 
switchSection('calendar'); 
setTimeout(() => { 
const panel = document.getElementById('importantDatesPanel'); 
panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); 
}, 100); 
} else { 
if (blockId.includes('睡眠复盘') || blockId.includes('早餐记录') || blockId.includes('补铁片打卡') || blockId.includes('工作看板') || blockId.includes('家务记录') || blockId.includes('午餐记录') || blockId.includes('午休记录')) { 
switchSection('day'); 
} else { 
switchSection('night'); 
} 
const blockName = targetElement.id.replace('-block', ''); 
const content = document.getElementById(blockName + '-content'); 
if (content && !content.classList.contains('expanded')) { 
toggleBlock(blockName); 
} 
setTimeout(() => { 
targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' }); 
targetElement.style.boxShadow = '0 0 0 3px rgba(255, 179, 77, 0.3)'; 
targetElement.style.transition = 'box-shadow 0.5s ease'; 
setTimeout(() => { 
targetElement.style.boxShadow = ''; 
}, 1500); 
}, 100); 
} 
} 
} 

function initNavigation() { 
const navTabs = document.querySelectorAll('.nav-tab'); 
navTabs.forEach(tab => { 
tab.addEventListener('click', function() { 
const section = this.dataset.section; 
switchSection(section); 
navTabs.forEach(t => t.classList.remove('active')); 
this.classList.add('active'); 
const bottomNavItems = document.querySelectorAll('.bottom-nav-item'); 
bottomNavItems.forEach(item => { 
item.classList.remove('active'); 
if (item.dataset.section === section) { 
item.classList.add('active'); 
} 
}); 
}); 
}); 

const bottomNavItems = document.querySelectorAll('.bottom-nav-item'); 
bottomNavItems.forEach(item => { 
item.addEventListener('click', function() { 
const section = this.dataset.section; 
if (section === 'day' || section === 'night' || section === 'calendar') { 
switchSection(section); 
bottomNavItems.forEach(i => i.classList.remove('active')); 
this.classList.add('active'); 
navTabs.forEach(tab => { 
tab.classList.remove('active'); 
if (tab.dataset.section === section) { 
tab.classList.add('active'); 
} 
}); 
} 
}); 
}); 

document.getElementById('bottomReviewToggle').addEventListener('click', function() { 
document.getElementById('reviewPanel').classList.add('active'); 
}); 
} 

function initButtonEvents() { 
document.getElementById('reviewToggle').addEventListener('click', () => { 
document.getElementById('reviewPanel').classList.add('active'); 
}); 

document.getElementById('closeReview').addEventListener('click', () => { 
document.getElementById('reviewPanel').classList.remove('active'); 
}); 

document.getElementById('prevMonth').addEventListener('click', () => { 
currentMonth--; 
if (currentMonth < 0) { 
currentMonth = 11; 
currentYear--; 
} 
renderCalendar(); 
}); 

document.getElementById('nextMonth').addEventListener('click', () => { 
currentMonth++; 
if (currentMonth > 11) { 
currentMonth = 0; 
currentYear++; 
} 
renderCalendar(); 
}); 

document.getElementById('gameType').addEventListener('change', function() { 
const gameType = this.value; 
document.getElementById('generalGame').style.display = gameType === '通用游戏' ? 'block' : 'none'; 
document.getElementById('animalCrossing').style.display = gameType === '动物森友会' ? 'block' : 'none'; 
}); 

document.getElementById('toggleAddImportantForm').addEventListener('click', function() { 
const form = document.getElementById('addImportantForm'); 
if (form.style.display === 'none') { 
form.style.display = 'block'; 
this.innerHTML = '<i class="fas fa-minus"></i> 取消添加'; 
} else { 
form.style.display = 'none'; 
this.innerHTML = '<i class="fas fa-plus"></i> 添加重要日期'; 
} 
}); 

document.getElementById('cancelAddImportantForm').addEventListener('click', function() { 
document.getElementById('addImportantForm').style.display = 'none'; 
document.getElementById('toggleAddImportantForm').innerHTML = '<i class="fas fa-plus"></i> 添加重要日期'; 
}); 
} 

function switchSection(section) { 
document.getElementById('daySection').classList.toggle('active', section === 'day'); 
document.getElementById('nightSection').classList.toggle('active', section === 'night'); 
document.getElementById('calendarSection').classList.toggle('active', section === 'calendar'); 
if (section === 'calendar') { 
renderCalendar(); 
} 

const navTabs = document.querySelectorAll('.nav-tab'); 
navTabs.forEach(tab => { 
tab.classList.remove('active'); 
if (tab.dataset.section === section) { 
tab.classList.add('active'); 
} 
}); 

const bottomNavItems = document.querySelectorAll('.bottom-nav-item'); 
bottomNavItems.forEach(item => { 
item.classList.remove('active'); 
if (item.dataset.section === section) { 
item.classList.add('active'); 
} 
}); 
} 

function formatDate(date) { 
const year = date.getFullYear(); 
const month = String(date.getMonth() + 1).padStart(2, '0'); 
const day = String(date.getDate()).padStart(2, '0'); 
return `${year}-${month}-${day}`; 
} 

function showNotification(message) { 
const notification = document.getElementById('notification'); 
document.getElementById('notificationText').textContent = message; 
notification.style.display = 'flex'; 
setTimeout(() => { 
notification.style.display = 'none'; 
}, 3000); 
} 

function saveData(key, data) { 
const dateStr = formatDate(new Date()); 
const allData = JSON.parse(localStorage.getItem(key) || '{}'); 
if (!allData[dateStr]) { 
allData[dateStr] = []; 
} 
allData[dateStr].push({ ...data, timestamp: new Date().toISOString() }); 
localStorage.setItem(key, JSON.stringify(allData)); 
updateOverview(); 
updateReviewData(); 
renderCalendar(); 
return true; 
} 

function saveTempData(key, data) { 
const dateStr = formatDate(new Date()); 
const allData = JSON.parse(localStorage.getItem(key + '_TEMP') || '{}'); 
if (!allData[dateStr]) { 
allData[dateStr] = []; 
} 
allData[dateStr].push({ ...data, timestamp: new Date().toISOString() }); 
localStorage.setItem(key + '_TEMP', JSON.stringify(allData)); 
updateOverviewFromTemp(); 
return true; 
} 

function updateOverviewFromTemp() { 
const dateStr = formatDate(new Date()); 
const workData = JSON.parse(localStorage.getItem(STORAGE_KEYS.WORK + '_TEMP') || '{}'); 
let workOverview = '0/0'; 
if (workData[dateStr] && workData[dateStr].length > 0) { 
const latestWork = workData[dateStr][workData[dateStr].length - 1]; 
const todoCount = latestWork.todo ? latestWork.todo.length : 0; 
const doneCount = latestWork.done ? latestWork.done.length : 0; 
workOverview = `${doneCount}/${todoCount}`; 
} 
document.getElementById('workOverview').textContent = workOverview; 

const houseworkData = JSON.parse(localStorage.getItem(STORAGE_KEYS.HOUSEWORK + '_TEMP') || '{}'); 
let houseworkScore = 0; 
if (houseworkData[dateStr] && houseworkData[dateStr].length > 0) { 
const latestHousework = houseworkData[dateStr][houseworkData[dateStr].length - 1]; 
houseworkScore = latestHousework.score || 0; 
} 
document.getElementById('houseworkOverview').textContent = `${houseworkScore}分`; 

const studyData = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDY + '_TEMP') || '{}'); 
let totalStudyTime = 0; 
if (studyData[dateStr]) { 
studyData[dateStr].forEach(record => { 
totalStudyTime += record.duration || 0; 
}); 
} 
document.getElementById('studyOverview').textContent = `${totalStudyTime}分钟`; 

const exerciseData = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXERCISE + '_TEMP') || '{}'); 
let totalExerciseTime = 0; 
if (exerciseData[dateStr]) { 
exerciseData[dateStr].forEach(record => { 
totalExerciseTime += record.duration || 0; 
}); 
} 
document.getElementById('exerciseOverview').textContent = `${totalExerciseTime}分钟`; 

const financeData = JSON.parse(localStorage.getItem(STORAGE_KEYS.FINANCE + '_TEMP') || '{}'); 
let todayExpense = 0; 
if (financeData[dateStr]) { 
financeData[dateStr].forEach(record => { 
if (record.type === '支出') { 
todayExpense += record.amount || 0; 
} 
}); 
} 
document.getElementById('expenseOverview').textContent = `${todayExpense.toFixed(2)}元`; 
} 

function archiveToday() { 
if (!confirm('确认要归档今日的记录吗？\\n归档后今日数据将永久保存，不可修改哦！')) { 
return; 
} 
const dateStr = formatDate(new Date()); 
let hasData = false; 
Object.values(STORAGE_KEYS).forEach(key => { 
const tempData = JSON.parse(localStorage.getItem(key + '_TEMP') || '{}'); 
if (tempData[dateStr] && tempData[dateStr].length > 0) { 
hasData = true; 
const finalData = JSON.parse(localStorage.getItem(key) || '{}'); 
if (!finalData[dateStr]) { 
finalData[dateStr] = []; 
} 
finalData[dateStr] = finalData[dateStr].concat(tempData[dateStr]); 
localStorage.setItem(key, JSON.stringify(finalData)); 
delete tempData[dateStr]; 
localStorage.setItem(key + '_TEMP', JSON.stringify(tempData)); 
} 
}); 

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
showNotification('❤️ 今日记录归档成功！小航小刀又度过了一天~'); 
clearAllForms(); 
updateReviewData(); 
renderCalendar(); 
} else { 
showNotification('📝 没有可归档的临时记录哦~'); 
} 
} 

function clearAllForms() { 
document.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(el => { 
el.value = ''; 
}); 
document.querySelectorAll('input[type="checkbox"]').forEach(el => { 
el.checked = false; 
}); 
document.querySelectorAll('select').forEach(el => { 
el.selectedIndex = 0; 
}); 
document.querySelectorAll('.island-btn').forEach(btn => { 
btn.classList.remove('active'); 
}); 
resetWorkBoard(); 
document.getElementById('financeDate').value = formatDate(new Date()); 
document.getElementById('houseworkScore').value = '0'; 
initCollapsibleBlocks(); 
} 

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

function loadTodayData() { 
const dateStr = formatDate(new Date()); 
// 原有的加载逻辑
} 

function initIslandResidentsTable() { 
const tbody = document.getElementById('islandResidents'); 
tbody.innerHTML = ''; 
ISLAND_RESIDENTS.forEach(resident => { 
const row = document.createElement('tr'); 
const nameCell = document.createElement('td'); 
nameCell.textContent = resident; 
row.appendChild(nameCell); 
INTERACTION_TYPES.forEach(interaction => { 
const cell = document.createElement('td'); 
const button = document.createElement('button'); 
button.className = 'island-btn'; 
button.textContent = interaction; 
button.dataset.resident = resident; 
button.dataset.interaction = interaction; 
button.addEventListener('click', function() { 
this.classList.toggle('active'); 
saveIslandInteraction(resident, interaction, this.classList.contains('active')); 
}); 
cell.appendChild(button); 
row.appendChild(cell); 
}); 
tbody.appendChild(row); 
}); 
} 

function saveIslandInteraction(resident, interaction, isActive) { 
const dateStr = formatDate(new Date()); 
const tempData = JSON.parse(localStorage.getItem(STORAGE_KEYS.ISLAND_INTERACTIONS + '_TEMP') || '{}'); 
if (!tempData[dateStr]) { 
tempData[dateStr] = {}; 
} 
if (!tempData[dateStr][resident]) { 
tempData[dateStr][resident] = {}; 
} 
tempData[dateStr][resident][interaction] = isActive; 
localStorage.setItem(STORAGE_KEYS.ISLAND_INTERACTIONS + '_TEMP', JSON.stringify(tempData)); 
if (!islandInteractions[dateStr]) { 
islandInteractions[dateStr] = {}; 
} 
if (!islandInteractions[dateStr][resident]) { 
islandInteractions[dateStr][resident] = {}; 
} 
islandInteractions[dateStr][resident][interaction] = isActive; 
} 

function loadIslandInteractions() { 
const tempData = localStorage.getItem(STORAGE_KEYS.ISLAND_INTERACTIONS + '_TEMP'); 
if (tempData) { 
islandInteractions = JSON.parse(tempData); 
} else { 
const data = localStorage.getItem(STORAGE_KEYS.ISLAND_INTERACTIONS); 
if (data) { 
islandInteractions = JSON.parse(data); 
} 
} 
const dateStr = formatDate(new Date()); 
if (islandInteractions[dateStr]) { 
ISLAND_RESIDENTS.forEach(resident => { 
INTERACTION_TYPES.forEach(interaction => { 
const isActive = islandInteractions[dateStr][resident] && islandInteractions[dateStr][resident][interaction]; 
const button = document.querySelector(`.island-btn[data-resident="${resident}"][data-interaction="${interaction}"]`); 
if (button) { 
if (isActive) { 
button.classList.add('active'); 
} else { 
button.classList.remove('active'); 
} 
} 
}); 
}); 
} 
} 

function initGameTypeToggle() { 
const gameTypeSelect = document.getElementById('gameType'); 
gameTypeSelect.addEventListener('change', function() { 
const gameType = this.value; 
document.getElementById('generalGame').style.display = gameType === '通用游戏' ? 'block' : 'none'; 
document.getElementById('animalCrossing').style.display = gameType === '动物森友会' ? 'block' : 'none'; 
}); 
} 

function saveSleep() { 
const sleepDuration = document.getElementById('sleepDuration').value; 
const sleepQuality = document.getElementById('sleepQuality').value; 
const sleepFeeling = document.getElementById('sleepFeeling').value; 
if (!sleepDuration || !sleepQuality) { 
showNotification('请填写睡眠时长和质量评分'); 
return; 
} 
const data = { 
duration: parseInt(sleepDuration), 
quality: parseInt(sleepQuality), 
feeling: sleepFeeling 
}; 
if (saveTempData(STORAGE_KEYS.SLEEP, data)) { 
showNotification('睡眠记录已暂时保存！'); 
} 
} 

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
showNotification('早餐记录已暂时保存！'); 
} 
} 

function saveSupplements() { 
const ironSupplement = document.getElementById('ironSupplement').checked; 
const data = { 
iron: ironSupplement, 
date: formatDate(new Date()) 
}; 
if (saveTempData(STORAGE_KEYS.SUPPLEMENTS, data)) { 
showNotification('补剂记录已暂时保存！'); 
} 
} 

function saveWork() { 
const todoItems = document.querySelectorAll('.todo-item'); 
const doneItems = document.querySelectorAll('.done-item'); 
const todoList = Array.from(todoItems).map(item => item.value.trim()).filter(item => item !== ''); 
const doneList = Array.from(doneItems).map(item => item.value.trim()).filter(item => item !== ''); 
const data = { 
todo: todoList, 
done: doneList 
}; 
if (saveTempData(STORAGE_KEYS.WORK, data)) { 
showNotification('工作记录已暂时保存！'); 
} 
} 

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
score: parseInt(houseworkScore) 
}; 
if (saveTempData(STORAGE_KEYS.HOUSEWORK, data)) { 
showNotification('家务记录已暂时保存！'); 
} 
} 

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
showNotification('午餐记录已暂时保存！'); 
} 
} 

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
showNotification('午休记录已暂时保存！'); 
} 
} 

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
showNotification('晚餐记录已暂时保存！'); 
} 
} 

function saveVitamin() { 
const vitaminDK = document.getElementById('vitaminDK').checked; 
const data = { 
vitaminDK: vitaminDK, 
date: formatDate(new Date()) 
}; 
if (saveTempData(STORAGE_KEYS.VITAMIN, data)) { 
showNotification('维生素记录已暂时保存！'); 
} 
} 

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
showNotification('学习记录已暂时保存！'); 
} 
} 

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
showNotification('运动记录已暂时保存！'); 
} 
} 

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
showNotification('游戏记录已暂时保存！'); 
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
showNotification('动物森友会记录已暂时保存！'); 
} 
} 
} 

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
showNotification('娱乐记录已暂时保存！'); 
} 
} 

function saveMagnesium() { 
const magnesiumSupplement = document.getElementById('magnesiumSupplement').checked; 
const data = { 
magnesium: magnesiumSupplement, 
date: formatDate(new Date()) 
}; 
if (saveTempData(STORAGE_KEYS.MAGNESIUM, data)) { 
showNotification('补镁记录已暂时保存！'); 
} 
} 

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
showNotification('身体护理记录已暂时保存！'); 
} 
} 

function saveFinance() { 
const financeType = document.getElementById('financeType').value; 
const financeCategory = document.getElementById('financeCategory').value; 
const financeAmount = document.getElementById('financeAmount').value; 
const financeDate = document.getElementById('financeDate').value; 
const financeDescription = document.getElementById('financeDescription').value; 
if (!financeAmount || !financeDate) { 
showNotification('请填写金额和日期'); 
return; 
} 
const data = { 
type: financeType, 
category: financeCategory, 
amount: parseFloat(financeAmount), 
date: financeDate, 
description: financeDescription 
}; 
if (saveTempData(STORAGE_KEYS.FINANCE, data)) { 
showNotification('财务记录已暂时保存！'); 
} 
} 

function loadImportantDates() { 
const data = localStorage.getItem(STORAGE_KEYS.IMPORTANT_DATES); 
if (data) { 
importantDates = JSON.parse(data); 
renderImportantDatesList(); 
} 
} 

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
const dateType = IMPORTANT_DATE_TYPES[dateInfo.type] || IMPORTANT_DATE_TYPES.other; 
html += ` 
<div class="important-date-item"> 
<div class="important-date-info"> 
<span class="important-date-type ${dateInfo.type}"></span> 
<span><strong>${dateStr}</strong> - ${dateInfo.label} (${dateType.name})</span> 
</div> 
<button class="delete-important-date" onclick="deleteImportantDate('${dateStr}')"> 
<i class="fas fa-trash"></i> 
</button> 
</div> 
`; 
}); 
listContainer.innerHTML = html; 
} 

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
showNotification('重要日期已添加！'); 
} 

function deleteImportantDate(dateStr) { 
if (confirm(`确定要删除 ${dateStr} 的重要日期标记吗？`)) { 
delete importantDates[dateStr]; 
localStorage.setItem(STORAGE_KEYS.IMPORTANT_DATES, JSON.stringify(importantDates)); 
renderImportantDatesList(); 
renderCalendar(); 
showNotification('重要日期已删除！'); 
} 
} 

function initCalendar() { 
renderCalendar(); 
} 

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
if (daysWithRecords[dateStr].includes('sleep') || daysWithRecords[dateStr].includes('exercise')) { 
day.classList.add('has-health'); 
} else if (daysWithRecords[dateStr].includes('study')) { 
day.classList.add('has-study'); 
} else if (daysWithRecords[dateStr].includes('finance')) { 
day.classList.add('has-finance'); 
} else if (daysWithRecords[dateStr].includes('housework')) { 
day.classList.add('has-study'); 
} 
} 

if (importantDates[dateStr]) { 
day.classList.add('has-important'); 
const importantType = importantDates[dateStr].type; 
day.classList.add(IMPORTANT_DATE_TYPES[importantType].class); 
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

function showDateDetails(dateStr) { 
selectedDate = dateStr; 
const detailsDiv = document.getElementById('dateDetails'); 
let html = `<h4>${dateStr} 的记录</h4>`; 

if (importantDates[dateStr]) { 
const importantInfo = importantDates[dateStr]; 
const dateType = IMPORTANT_DATE_TYPES[importantInfo.type] || IMPORTANT_DATE_TYPES.other; 
html += `<div class="record-item" style="background-color: #FFF3E0; padding: 10px; border-radius: 6px; margin-bottom: 10px; border-left: 4px solid ${importantInfo.type === 'anniversary' ? '#FF5252' : importantInfo.type === 'deadline' ? '#2196F3' : importantInfo.type === 'event' ? '#4CAF50' : '#9C27B0'}"> 
<strong><i class="fas fa-star"></i> 重要日期: ${dateType.name}</strong><br> 
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
html += `睡眠时长: ${(record.duration/60).toFixed(1)}小时, 质量评分: ${record.quality}, 感受: ${record.feeling}`; 
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
html += `类型: ${record.type}, 分类: ${record.category}, 金额: ${record.amount}元, 描述: ${record.description}`; 
break; 
case STORAGE_KEYS.GAME: 
html += `游戏类型: ${record.type}`; 
if (record.type === '动物森友会') { 
html += `, 天气: ${record.weather}, NPC: ${record.npc}, 感受: ${record.feeling}`; 
} else { 
html += `, 名称: ${record.name}, 进度: ${record.progress}, 感受: ${record.feeling}`; 
} 
break; 
case STORAGE_KEYS.ENTERTAINMENT: 
html += `娱乐类型: ${record.type}, 内容: ${record.content}, 感受: ${record.feeling}`; 
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

function getRecordTypeName(key) { 
const names = { 
'sleepData': '睡眠记录', 
'breakfastData': '早餐记录', 
'supplementData': '补剂记录', 
'workData': '工作记录', 
'houseworkData': '家务记录', 
'lunchData': '午餐记录', 
'napData': '午休记录', 
'dinnerData': '晚餐记录', 
'vitaminData': '维生素记录', 
'studyData': '学习记录', 
'exerciseData': '运动记录', 
'gameData': '游戏记录', 
'entertainmentData': '娱乐记录', 
'magnesiumData': '补镁记录', 
'bodycareData': '身体护理记录', 
'financeData': '财务记录' 
}; 
return names[key] || key; 
} 

function goToToday() { 
currentYear = today.getFullYear(); 
currentMonth = today.getMonth(); 
renderCalendar(); 
showDateDetails(formatDate(today)); 
} 

function updateOverview() { 
const dateStr = formatDate(new Date()); 
const workData = JSON.parse(localStorage.getItem(STORAGE_KEYS.WORK) || '{}'); 
let workOverview = '0/0'; 
if (workData[dateStr] && workData[dateStr].length > 0) { 
const latestWork = workData[dateStr][workData[dateStr].length - 1]; 
const todoCount = latestWork.todo ? latestWork.todo.length : 0; 
const doneCount = latestWork.done ? latestWork.done.length : 0; 
workOverview = `${doneCount}/${todoCount}`; 
} 
document.getElementById('workOverview').textContent = workOverview; 

const houseworkData = JSON.parse(localStorage.getItem(STORAGE_KEYS.HOUSEWORK) || '{}'); 
let houseworkScore = 0; 
if (houseworkData[dateStr] && houseworkData[dateStr].length > 0) { 
const latestHousework = houseworkData[dateStr][houseworkData[dateStr].length - 1]; 
houseworkScore = latestHousework.score || 0; 
} 
document.getElementById('houseworkOverview').textContent = `${houseworkScore}分`; 

const studyData = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDY) || '{}'); 
let totalStudyTime = 0; 
if (studyData[dateStr]) { 
studyData[dateStr].forEach(record => { 
totalStudyTime += record.duration || 0; 
}); 
} 
document.getElementById('studyOverview').textContent = `${totalStudyTime}分钟`; 

const exerciseData = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXERCISE) || '{}'); 
let totalExerciseTime = 0; 
if (exerciseData[dateStr]) { 
exerciseData[dateStr].forEach(record => { 
totalExerciseTime += record.duration || 0; 
}); 
} 
document.getElementById('exerciseOverview').textContent = `${totalExerciseTime}分钟`; 

const financeData = JSON.parse(localStorage.getItem(STORAGE_KEYS.FINANCE) || '{}'); 
let todayExpense = 0; 
if (financeData[dateStr]) { 
financeData[dateStr].forEach(record => { 
if (record.type === '支出') { 
todayExpense += record.amount || 0; 
} 
}); 
} 
document.getElementById('expenseOverview').textContent = `${todayExpense.toFixed(2)}元`; 
} 

function updateReviewData() { 
updateHealthReview(); 
updateStudyReview(); 
updateHouseworkReview(); 
updateFinanceReview(); 
updateEntertainmentReview(); 
} 

function updateHealthReview() { 
const sleepData = JSON.parse(localStorage.getItem(STORAGE_KEYS.SLEEP) || '{}'); 
const exerciseData = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXERCISE) || '{}'); 
const supplementData = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUPPLEMENTS) || '{}'); 
const vitaminData = JSON.parse(localStorage.getItem(STORAGE_KEYS.VITAMIN) || '{}'); 
const magnesiumData = JSON.parse(localStorage.getItem(STORAGE_KEYS.MAGNESIUM) || '{}'); 
const bodycareData = JSON.parse(localStorage.getItem(STORAGE_KEYS.BODYCARE) || '{}'); 

let totalSleepHours = 0; 
let sleepCount = 0; 
Object.keys(sleepData).forEach(date => { 
sleepData[date].forEach(record => { 
if (record.duration) { 
totalSleepHours += record.duration / 60; 
sleepCount++; 
} 
}); 
}); 
const avgSleepHours = sleepCount > 0 ? (totalSleepHours / sleepCount).toFixed(1) : '--'; 
document.getElementById('avgSleepHours').textContent = avgSleepHours; 

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

let supplementDays = 0; 
let totalDays = 0; 
const today = new Date(); 
const thirtyDaysAgo = new Date(); 
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); 
for (let d = new Date(thirtyDaysAgo); d <= today; d.setDate(d.getDate() + 1)) { 
const dateStr = formatDate(d); 
totalDays++; 
if ((supplementData[dateStr] && supplementData[dateStr].some(r => r.iron)) || 
(vitaminData[dateStr] && vitaminData[dateStr].some(r => r.vitaminDK)) || 
(magnesiumData[dateStr] && magnesiumData[dateStr].some(r => r.magnesium))) { 
supplementDays++; 
} 
} 
const supplementRate = totalDays > 0 ? Math.round((supplementDays / totalDays) * 100) : 0; 
document.getElementById('supplementRate').textContent = `${supplementRate}%`; 

let bodycareDays = 0; 
totalDays = 0; 
for (let d = new Date(thirtyDaysAgo); d <= today; d.setDate(d.getDate() + 1)) { 
const dateStr = formatDate(d); 
totalDays++; 
if (bodycareData[dateStr] && bodycareData[dateStr].some(r => r.scrub && r.hairRemoval && r.lotion)) { 
bodycareDays++; 
} 
} 
const bodycareRate = totalDays > 0 ? Math.round((bodycareDays / totalDays) * 100) : 0; 
document.getElementById('bodycareRate').textContent = `${bodycareRate}%`; 
} 

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

function updateFinanceReview() { 
const financeData = JSON.parse(localStorage.getItem(STORAGE_KEYS.FINANCE) || '{}'); 
const today = new Date(); 
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1); 

let monthExpense = 0; 
let expenseDays = 0; 
let categoryStats = {}; 

for (let d = new Date(firstDayOfMonth); d <= today; d.setDate(d.getDate() + 1)) { 
const dateStr = formatDate(d); 
let dayExpense = 0; 
if (financeData[dateStr]) { 
financeData[dateStr].forEach(record => { 
if (record.type === '支出') { 
const amount = record.amount || 0; 
monthExpense += amount; 
dayExpense += amount; 
const category = record.category || '未分类'; 
if (!categoryStats[category]) { 
categoryStats[category] = 0; 
} 
categoryStats[category] += amount; 
} 
}); 
} 
if (dayExpense > 0) { 
expenseDays++; 
} 
} 

const avgDailyExpense = expenseDays > 0 ? (monthExpense / expenseDays).toFixed(2) : 0; 
document.getElementById('monthExpense').textContent = monthExpense.toFixed(2); 
document.getElementById('avgDailyExpense').textContent = avgDailyExpense; 

const categoryList = document.getElementById('expenseCategories'); 
categoryList.innerHTML = ''; 
if (Object.keys(categoryStats).length > 0) { 
Object.keys(categoryStats).forEach(category => { 
const li = document.createElement('li'); 
li.textContent = `${category}: ${categoryStats[category].toFixed(2)}元`; 
categoryList.appendChild(li); 
}); 
} else { 
const li = document.createElement('li'); 
li.textContent = '暂无财务记录'; 
categoryList.appendChild(li); 
} 
} 

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


// ==================== 新增结束 ====================
